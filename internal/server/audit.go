package server

import (
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const (
	auditRotateBytes = 20 << 20
	auditRotateFiles = 3
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

type AuditLog struct {
	mu   sync.Mutex
	path string
}

func NewAuditLog(dataDir string) *AuditLog {
	return &AuditLog{path: filepath.Join(dataDir, "audit.jsonl")}
}
func (a *AuditLog) Write(event AuditEvent) {
	a.mu.Lock()
	defer a.mu.Unlock()
	_ = os.MkdirAll(filepath.Dir(a.path), 0o750)
	_ = a.rotateIfNeeded()
	f, err := os.OpenFile(a.path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		return
	}
	defer f.Close()
	event.Time = time.Now().UTC().Format(time.RFC3339Nano)
	_ = json.NewEncoder(f).Encode(event)
}
func (a *AuditLog) Read(limit int) ([]AuditEvent, error) {
	if limit < 1 || limit > 2000 {
		limit = 300
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	events := make([]AuditEvent, 0, limit)
	// Start with the newest file and stop as soon as enough records are found.
	// This avoids scanning tens of megabytes merely to show the latest 300 rows.
	paths := []string{a.path}
	for i := 1; i <= auditRotateFiles; i++ {
		paths = append(paths, a.rotatedPath(i))
	}
	for _, path := range paths {
		remaining := limit - len(events)
		if remaining <= 0 {
			break
		}
		part, err := readAuditTail(path, remaining)
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			return nil, err
		}
		events = append(events, part...)
	}
	return events, nil
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
func (a *AuditLog) rotatedPath(index int) string {
	return a.path + "." + string(rune('0'+index))
}
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
