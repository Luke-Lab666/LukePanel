package server

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	auditRotateBytes = 20 << 20
	auditRotateFiles = 6
)

type AuditEvent struct {
	Time   string `json:"time"`
	IP     string `json:"ip"`
	User   string `json:"user"`
	Action string `json:"action"`
	Target string `json:"target,omitempty"`
	Result string `json:"result"`
	Detail string `json:"detail,omitempty"`
}

type AuditQuery struct {
	Search string
	User   string
	IP     string
	Action string
	Result string
	From   string
	To     string
	Limit  int
	Offset int
}

type AuditQueryResult struct {
	Events  []AuditEvent `json:"events"`
	Total   int          `json:"total"`
	Indexed bool         `json:"indexed"`
}

type AuditLog struct {
	mu        sync.Mutex
	indexMu   sync.Mutex
	path      string
	dbPath    string
	sqlite    string
	indexCh   chan AuditEvent
	closeOnce sync.Once
}

func NewAuditLog(dataDir string) *AuditLog {
	a := &AuditLog{path: filepath.Join(dataDir, "audit.jsonl"), dbPath: filepath.Join(dataDir, "audit.sqlite3")}
	if binary, err := exec.LookPath("sqlite3"); err == nil {
		a.sqlite = binary
		if a.initDB() == nil {
			a.indexCh = make(chan AuditEvent, 512)
			go a.indexWorker()
			go a.rebuildIfNeeded()
		} else {
			a.sqlite = ""
		}
	}
	return a
}

func (a *AuditLog) Write(event AuditEvent) {
	a.mu.Lock()
	_ = os.MkdirAll(filepath.Dir(a.path), 0o750)
	_ = a.rotateIfNeeded()
	f, err := os.OpenFile(a.path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err == nil {
		event.Time = time.Now().UTC().Format(time.RFC3339Nano)
		_ = json.NewEncoder(f).Encode(event)
		_ = f.Close()
	}
	a.mu.Unlock()
	if err == nil && a.indexCh != nil {
		select {
		case a.indexCh <- event:
		default:
		}
	}
}

func (a *AuditLog) Read(limit int) ([]AuditEvent, error) {
	result, err := a.Query(AuditQuery{Limit: limit})
	return result.Events, err
}

func (a *AuditLog) Query(query AuditQuery) (AuditQueryResult, error) {
	if query.Limit < 1 || query.Limit > 2000 {
		query.Limit = 300
	}
	if query.Offset < 0 || query.Offset > 1000000 {
		query.Offset = 0
	}
	if a.sqlite != "" {
		if result, err := a.querySQLite(query); err == nil {
			return result, nil
		}
	}
	return a.queryFiles(query)
}

func (a *AuditLog) initDB() error {
	if err := os.MkdirAll(filepath.Dir(a.dbPath), 0o750); err != nil {
		return err
	}
	sql := `PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA temp_store=MEMORY;
CREATE TABLE IF NOT EXISTS audit_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 time TEXT NOT NULL,
 ip TEXT NOT NULL,
 user TEXT NOT NULL,
 action TEXT NOT NULL,
 target TEXT NOT NULL DEFAULT '',
 result TEXT NOT NULL,
 detail TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_events(time DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_events(action);
CREATE INDEX IF NOT EXISTS idx_audit_ip ON audit_events(ip);
CREATE INDEX IF NOT EXISTS idx_audit_result ON audit_events(result);
CREATE TABLE IF NOT EXISTS audit_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);`
	cmd := exec.Command(a.sqlite, a.dbPath)
	cmd.Stdin = strings.NewReader(sql)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("sqlite init: %s", strings.TrimSpace(string(output)))
	}
	_ = os.Chmod(a.dbPath, 0o600)
	return nil
}

func (a *AuditLog) indexWorker() {
	batch := make([]AuditEvent, 0, 64)
	ticker := time.NewTicker(800 * time.Millisecond)
	defer ticker.Stop()
	flush := func() {
		if len(batch) == 0 {
			return
		}
		var sql strings.Builder
		sql.WriteString("BEGIN IMMEDIATE;\n")
		for _, event := range batch {
			sql.WriteString(auditInsertSQL(event))
		}
		sql.WriteString("COMMIT;\n")
		a.indexMu.Lock()
		cmd := exec.Command(a.sqlite, a.dbPath)
		cmd.Stdin = strings.NewReader(sql.String())
		_ = cmd.Run()
		a.indexMu.Unlock()
		batch = batch[:0]
	}
	for {
		select {
		case event, ok := <-a.indexCh:
			if !ok {
				flush()
				return
			}
			batch = append(batch, event)
			if len(batch) >= 64 {
				flush()
			}
		case <-ticker.C:
			flush()
		}
	}
}

func (a *AuditLog) rebuildIfNeeded() {
	a.indexMu.Lock()
	defer a.indexMu.Unlock()
	cmd := exec.Command(a.sqlite, "-noheader", a.dbPath, "SELECT COUNT(*) FROM audit_events;")
	out, err := cmd.Output()
	if err != nil || strings.TrimSpace(string(out)) != "0" {
		return
	}
	a.rebuildFromFilesLocked()
}

func (a *AuditLog) rebuildFromFilesLocked() {
	paths := []string{}
	for i := auditRotateFiles; i >= 1; i-- {
		paths = append(paths, a.rotatedPath(i))
	}
	paths = append(paths, a.path)
	var batch []AuditEvent
	for _, path := range paths {
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		for _, line := range bytes.Split(data, []byte{'\n'}) {
			var event AuditEvent
			if json.Unmarshal(bytes.TrimSpace(line), &event) == nil && event.Time != "" {
				batch = append(batch, event)
				if len(batch) >= 500 {
					a.insertBatchLocked(batch)
					batch = batch[:0]
				}
			}
		}
	}
	if len(batch) > 0 {
		a.insertBatchLocked(batch)
	}
}

func (a *AuditLog) insertBatch(events []AuditEvent) {
	a.indexMu.Lock()
	defer a.indexMu.Unlock()
	a.insertBatchLocked(events)
}

func (a *AuditLog) insertBatchLocked(events []AuditEvent) {
	if a.sqlite == "" || len(events) == 0 {
		return
	}
	var sql strings.Builder
	sql.WriteString("BEGIN IMMEDIATE;\n")
	for _, event := range events {
		sql.WriteString(auditInsertSQL(event))
	}
	sql.WriteString("COMMIT;\n")
	cmd := exec.Command(a.sqlite, a.dbPath)
	cmd.Stdin = strings.NewReader(sql.String())
	_ = cmd.Run()
}

// ResetIndex rebuilds the optional SQLite index from the JSONL source after a backup restore.
func (a *AuditLog) ResetIndex() error {
	if a.sqlite == "" {
		return nil
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	a.indexMu.Lock()
	defer a.indexMu.Unlock()
	for _, suffix := range []string{"", "-wal", "-shm"} {
		if err := os.Remove(a.dbPath + suffix); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
	}
	if err := a.initDB(); err != nil {
		return err
	}
	a.rebuildFromFilesLocked()
	return nil
}

func auditInsertSQL(event AuditEvent) string {
	return fmt.Sprintf("INSERT INTO audit_events(time,ip,user,action,target,result,detail) VALUES(%s,%s,%s,%s,%s,%s,%s);\n", sqlQuote(event.Time), sqlQuote(event.IP), sqlQuote(event.User), sqlQuote(event.Action), sqlQuote(event.Target), sqlQuote(event.Result), sqlQuote(event.Detail))
}

func (a *AuditLog) querySQLite(query AuditQuery) (AuditQueryResult, error) {
	a.indexMu.Lock()
	defer a.indexMu.Unlock()
	where := []string{"1=1"}
	if v := strings.TrimSpace(query.User); v != "" {
		where = append(where, "user="+sqlQuote(v))
	}
	if v := strings.TrimSpace(query.IP); v != "" {
		where = append(where, "ip="+sqlQuote(v))
	}
	if v := strings.TrimSpace(query.Action); v != "" {
		where = append(where, "action LIKE "+sqlQuote("%"+v+"%"))
	}
	if v := strings.TrimSpace(query.Result); v != "" {
		where = append(where, "result="+sqlQuote(v))
	}
	if v := strings.TrimSpace(query.From); v != "" {
		where = append(where, "time >= "+sqlQuote(v))
	}
	if v := strings.TrimSpace(query.To); v != "" {
		where = append(where, "time <= "+sqlQuote(v))
	}
	if v := strings.TrimSpace(query.Search); v != "" {
		pattern := sqlQuote("%" + v + "%")
		where = append(where, "(action LIKE "+pattern+" OR target LIKE "+pattern+" OR detail LIKE "+pattern+" OR ip LIKE "+pattern+" OR user LIKE "+pattern+")")
	}
	clause := strings.Join(where, " AND ")
	countSQL := "SELECT COUNT(*) AS total FROM audit_events WHERE " + clause + ";"
	rowsSQL := fmt.Sprintf("SELECT time,ip,user,action,target,result,detail FROM audit_events WHERE %s ORDER BY time DESC LIMIT %d OFFSET %d;", clause, query.Limit, query.Offset)
	var countRows []struct {
		Total int `json:"total"`
	}
	if err := a.runSQLiteJSON(countSQL, &countRows); err != nil {
		return AuditQueryResult{}, err
	}
	var events []AuditEvent
	if err := a.runSQLiteJSON(rowsSQL, &events); err != nil {
		return AuditQueryResult{}, err
	}
	total := 0
	if len(countRows) > 0 {
		total = countRows[0].Total
	}
	return AuditQueryResult{Events: events, Total: total, Indexed: true}, nil
}

func (a *AuditLog) runSQLiteJSON(sql string, out any) error {
	cmd := exec.Command(a.sqlite, "-json", a.dbPath, sql)
	data, err := cmd.Output()
	if err != nil {
		return err
	}
	if len(bytes.TrimSpace(data)) == 0 {
		data = []byte("[]")
	}
	return json.Unmarshal(data, out)
}

func (a *AuditLog) queryFiles(query AuditQuery) (AuditQueryResult, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	paths := []string{a.path}
	for i := 1; i <= auditRotateFiles; i++ {
		paths = append(paths, a.rotatedPath(i))
	}
	max := 50000
	all := make([]AuditEvent, 0, minIntAudit(max, query.Offset+query.Limit+500))
	for _, path := range paths {
		part, err := readAuditTail(path, max-len(all))
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			return AuditQueryResult{}, err
		}
		all = append(all, part...)
		if len(all) >= max {
			break
		}
	}
	matched := make([]AuditEvent, 0)
	for _, event := range all {
		if auditMatches(event, query) {
			matched = append(matched, event)
		}
	}
	total := len(matched)
	start := query.Offset
	if start > total {
		start = total
	}
	end := start + query.Limit
	if end > total {
		end = total
	}
	return AuditQueryResult{Events: matched[start:end], Total: total, Indexed: false}, nil
}

func auditMatches(event AuditEvent, q AuditQuery) bool {
	if q.User != "" && event.User != q.User {
		return false
	}
	if q.IP != "" && event.IP != q.IP {
		return false
	}
	if q.Action != "" && !strings.Contains(strings.ToLower(event.Action), strings.ToLower(q.Action)) {
		return false
	}
	if q.Result != "" && event.Result != q.Result {
		return false
	}
	if q.From != "" && event.Time < q.From {
		return false
	}
	if q.To != "" && event.Time > q.To {
		return false
	}
	if q.Search != "" {
		hay := strings.ToLower(event.Action + "\n" + event.Target + "\n" + event.Detail + "\n" + event.IP + "\n" + event.User)
		if !strings.Contains(hay, strings.ToLower(q.Search)) {
			return false
		}
	}
	return true
}

func (a *AuditLog) rotateIfNeeded() error {
	info, err := os.Stat(a.path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil || info.Size() < auditRotateBytes {
		return err
	}
	_ = os.Remove(a.rotatedPath(auditRotateFiles))
	for i := auditRotateFiles - 1; i >= 1; i-- {
		from, to := a.rotatedPath(i), a.rotatedPath(i+1)
		if err := os.Rename(from, to); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
	}
	return os.Rename(a.path, a.rotatedPath(1))
}
func (a *AuditLog) rotatedPath(index int) string { return a.path + "." + strconv.Itoa(index) }
func readAuditTail(path string, limit int) ([]AuditEvent, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return nil, err
	}
	const blockSize int64 = 64 << 10
	position := info.Size()
	prefix := []byte{}
	out := make([]AuditEvent, 0, limit)
	for position > 0 && len(out) < limit {
		readSize := blockSize
		if position < readSize {
			readSize = position
		}
		position -= readSize
		chunk := make([]byte, readSize)
		if _, err := file.ReadAt(chunk, position); err != nil {
			return nil, err
		}
		data := append(chunk, prefix...)
		lines := bytes.Split(data, []byte{'\n'})
		start := 0
		if position > 0 {
			prefix = append(prefix[:0], lines[0]...)
			start = 1
		} else {
			prefix = nil
		}
		for i := len(lines) - 1; i >= start && len(out) < limit; i-- {
			line := bytes.TrimSpace(lines[i])
			if len(line) == 0 {
				continue
			}
			var event AuditEvent
			if json.Unmarshal(line, &event) == nil {
				out = append(out, event)
			}
		}
		if len(prefix) > 1<<20 {
			return nil, errors.New("audit line exceeds 1MB")
		}
	}
	return out, nil
}
func sqlQuote(value string) string {
	return "'" + strings.ReplaceAll(strings.ReplaceAll(value, "\x00", ""), "'", "''") + "'"
}
func minIntAudit(a, b int) int {
	if a < b {
		return a
	}
	return b
}
