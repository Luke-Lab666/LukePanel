package server

import (
	"archive/tar"
	"compress/gzip"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/Luke-Lab666/LukePanel/internal/config"
)

const (
	maxPanelBackupUpload = 512 << 20
	maxPanelBackupFiles  = 10000
	maxPanelBackupBytes  = int64(2 << 30)
)

var panelBackupDataRoots = []string{
	"audit.jsonl", "audit.jsonl.1", "audit.jsonl.2", "audit.jsonl.3", "audit.jsonl.4", "audit.jsonl.5", "audit.jsonl.6",
	"file-preferences.json", "snapshots", "backups", "recycle",
}

// CreateScheduledPanelBackup creates an atomic full panel backup outside the live data directory.
// It is used by the fixed systemd task template and never executes user supplied commands.
func CreateScheduledPanelBackup(configPath, dataDir, version, backupDir string, keep int) (string, error) {
	if keep < 1 || keep > 100 {
		keep = 7
	}
	absData, err := filepath.Abs(dataDir)
	if err != nil {
		return "", err
	}
	absBackup, err := filepath.Abs(backupDir)
	if err != nil {
		return "", err
	}
	if rel, err := filepath.Rel(absData, absBackup); err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
		if rel != "scheduled-backups" {
			return "", errors.New("面板数据目录内只允许使用 scheduled-backups 作为计划备份目录")
		}
	}
	if err := os.MkdirAll(absBackup, 0o700); err != nil {
		return "", err
	}
	ownerUID, ownerGID := -1, -1
	if info, err := os.Stat(absData); err == nil {
		if stat, ok := info.Sys().(*syscall.Stat_t); ok {
			ownerUID, ownerGID = int(stat.Uid), int(stat.Gid)
			_ = os.Chown(absBackup, ownerUID, ownerGID)
		}
	}
	name := "lukepanel-scheduled-" + time.Now().UTC().Format("20060102-150405") + ".tar.gz"
	finalPath := filepath.Join(absBackup, name)
	temp, err := os.CreateTemp(absBackup, ".lukepanel-backup-*.tmp")
	if err != nil {
		return "", err
	}
	tempPath := temp.Name()
	defer os.Remove(tempPath)
	if err := temp.Chmod(0o600); err != nil {
		temp.Close()
		return "", err
	}
	gz := gzip.NewWriter(temp)
	tw := tar.NewWriter(gz)
	writeErr := writeBackupPath(tw, configPath, "panel/config.json")
	if writeErr == nil {
		for _, item := range panelBackupDataRoots {
			if err := writeBackupPath(tw, filepath.Join(dataDir, item), "data/"+item); err != nil && !errors.Is(err, os.ErrNotExist) {
				writeErr = err
				break
			}
		}
	}
	manifest, _ := json.MarshalIndent(map[string]any{
		"version": version, "created_at": time.Now().UTC(), "format": 2, "scheduled": true,
		"note": "audit.sqlite3 is rebuilt from audit.jsonl on restore",
	}, "", "  ")
	if writeErr == nil {
		writeErr = tw.WriteHeader(&tar.Header{Name: "manifest.json", Mode: 0o600, Size: int64(len(manifest)), ModTime: time.Now()})
	}
	if writeErr == nil {
		_, writeErr = tw.Write(manifest)
	}
	if closeErr := tw.Close(); writeErr == nil {
		writeErr = closeErr
	}
	if closeErr := gz.Close(); writeErr == nil {
		writeErr = closeErr
	}
	if syncErr := temp.Sync(); writeErr == nil {
		writeErr = syncErr
	}
	if closeErr := temp.Close(); writeErr == nil {
		writeErr = closeErr
	}
	if writeErr != nil {
		return "", writeErr
	}
	if err := os.Rename(tempPath, finalPath); err != nil {
		return "", err
	}
	if ownerUID >= 0 {
		_ = os.Chown(finalPath, ownerUID, ownerGID)
	}
	if err := pruneScheduledBackups(absBackup, keep); err != nil {
		return finalPath, err
	}
	return finalPath, nil
}

func pruneScheduledBackups(directory string, keep int) error {
	entries, err := os.ReadDir(directory)
	if err != nil {
		return err
	}
	names := make([]string, 0)
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasPrefix(entry.Name(), "lukepanel-scheduled-") && strings.HasSuffix(entry.Name(), ".tar.gz") {
			names = append(names, entry.Name())
		}
	}
	sort.Strings(names)
	for len(names) > keep {
		if err := os.Remove(filepath.Join(directory, names[0])); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
		names = names[1:]
	}
	return nil
}

type ScheduledBackupInfo struct {
	Name    string    `json:"name"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"modified_at"`
}

func (s *Server) scheduledBackups(w http.ResponseWriter, r *http.Request) {
	s.configMu.RLock()
	dataDir := s.cfg.DataDir
	s.configMu.RUnlock()
	directory := filepath.Join(dataDir, "scheduled-backups")
	switch r.Method {
	case http.MethodGet:
		if name := strings.TrimSpace(r.URL.Query().Get("download")); name != "" {
			if !s.requireElevation(w, r) {
				return
			}
			path, err := scheduledBackupPath(directory, name)
			if err != nil {
				writeError(w, http.StatusBadRequest, err.Error())
				return
			}
			file, err := os.Open(path)
			if err != nil {
				writeError(w, http.StatusNotFound, "计划备份不存在")
				return
			}
			defer file.Close()
			info, err := file.Stat()
			if err != nil || !info.Mode().IsRegular() {
				writeError(w, http.StatusBadRequest, "计划备份无效")
				return
			}
			w.Header().Set("Content-Type", "application/gzip")
			w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, name))
			w.Header().Set("Content-Length", strconv.FormatInt(info.Size(), 10))
			w.Header().Set("Cache-Control", "no-store")
			http.ServeContent(w, r, name, info.ModTime(), file)
			s.auditRequest(r, "backup.scheduled.download", name, "success", "")
			return
		}
		items, err := listScheduledBackups(directory)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"backups": items, "retention": 7})
	case http.MethodPost:
		if !s.requireElevation(w, r) {
			return
		}
		var req struct {
			Action string `json:"action"`
			Name   string `json:"name"`
		}
		if decodeJSON(w, r, 8192, &req) != nil {
			return
		}
		switch req.Action {
		case "create":
			path, err := CreateScheduledPanelBackup(s.configPath, dataDir, s.version, directory, 7)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "创建计划备份失败："+err.Error())
				return
			}
			s.auditRequest(r, "backup.scheduled.create", filepath.Base(path), "success", "")
		case "delete":
			path, err := scheduledBackupPath(directory, req.Name)
			if err != nil {
				writeError(w, http.StatusBadRequest, err.Error())
				return
			}
			if err := os.Remove(path); err != nil {
				writeError(w, http.StatusBadRequest, "删除计划备份失败")
				return
			}
			s.auditRequest(r, "backup.scheduled.delete", req.Name, "success", "")
		default:
			writeError(w, http.StatusBadRequest, "不支持的计划备份操作")
			return
		}
		items, _ := listScheduledBackups(directory)
		writeJSON(w, http.StatusOK, map[string]any{"backups": items, "retention": 7})
	default:
		methodNotAllowed(w)
	}
}

func scheduledBackupPath(directory, name string) (string, error) {
	name = strings.TrimSpace(name)
	if filepath.Base(name) != name || !strings.HasPrefix(name, "lukepanel-scheduled-") || !strings.HasSuffix(name, ".tar.gz") {
		return "", errors.New("计划备份名称无效")
	}
	return filepath.Join(directory, name), nil
}

func listScheduledBackups(directory string) ([]ScheduledBackupInfo, error) {
	entries, err := os.ReadDir(directory)
	if errors.Is(err, os.ErrNotExist) {
		return []ScheduledBackupInfo{}, nil
	}
	if err != nil {
		return nil, err
	}
	items := make([]ScheduledBackupInfo, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if _, err := scheduledBackupPath(directory, entry.Name()); err != nil {
			continue
		}
		info, err := entry.Info()
		if err == nil && info.Mode().IsRegular() {
			items = append(items, ScheduledBackupInfo{Name: entry.Name(), Size: info.Size(), ModTime: info.ModTime().UTC()})
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ModTime.After(items[j].ModTime) })
	return items, nil
}

func (s *Server) backupExport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	name := "lukepanel-backup-" + time.Now().Format("20060102-150405") + ".tar.gz"
	w.Header().Set("Content-Type", "application/gzip")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, name))
	w.Header().Set("Cache-Control", "no-store")

	gz := gzip.NewWriter(w)
	tw := tar.NewWriter(gz)
	writeErr := writeBackupPath(tw, s.configPath, "panel/config.json")
	if writeErr == nil {
		// JSONL is the durable audit source. SQLite is intentionally rebuilt on restore.
		s.audit.mu.Lock()
		for _, item := range panelBackupDataRoots {
			if !strings.HasPrefix(item, "audit.jsonl") {
				continue
			}
			if err := writeBackupPath(tw, filepath.Join(s.cfg.DataDir, item), "data/"+item); err != nil && !errors.Is(err, os.ErrNotExist) {
				s.logger.Warn("backup audit entry skipped", "path", item, "error", err)
			}
		}
		s.audit.mu.Unlock()
		for _, item := range panelBackupDataRoots {
			if strings.HasPrefix(item, "audit.jsonl") {
				continue
			}
			if err := writeBackupPath(tw, filepath.Join(s.cfg.DataDir, item), "data/"+item); err != nil && !errors.Is(err, os.ErrNotExist) {
				s.logger.Warn("backup entry skipped", "path", item, "error", err)
			}
		}
	}
	manifest, _ := json.MarshalIndent(map[string]any{
		"version": s.version, "created_at": time.Now().UTC(), "format": 2,
		"note": "audit.sqlite3 is rebuilt from audit.jsonl on restore",
	}, "", "  ")
	if writeErr == nil {
		writeErr = tw.WriteHeader(&tar.Header{Name: "manifest.json", Mode: 0o600, Size: int64(len(manifest)), ModTime: time.Now()})
	}
	if writeErr == nil {
		_, writeErr = tw.Write(manifest)
	}
	if closeErr := tw.Close(); writeErr == nil {
		writeErr = closeErr
	}
	if closeErr := gz.Close(); writeErr == nil {
		writeErr = closeErr
	}
	if writeErr != nil {
		s.logger.Error("backup export failed", "error", writeErr)
		return
	}
	s.auditRequest(r, "backup.export", name, "success", "")
}

func writeBackupPath(tw *tar.Writer, source, archive string) error {
	if _, err := os.Lstat(source); err != nil {
		return err
	}
	return filepath.Walk(source, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.Mode()&os.ModeSymlink != 0 {
			return nil
		}
		if !info.IsDir() && !info.Mode().IsRegular() {
			return nil
		}
		if info.Mode().IsRegular() && info.Size() > maxPanelBackupBytes {
			return fmt.Errorf("backup file exceeds 2GB: %s", path)
		}
		rel, err := filepath.Rel(source, path)
		if err != nil {
			return err
		}
		name := archive
		if rel != "." {
			name = filepath.ToSlash(filepath.Join(archive, rel))
		}
		header, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}
		header.Name = name
		header.Uid, header.Gid, header.Uname, header.Gname = 0, 0, "", ""
		if err := tw.WriteHeader(header); err != nil {
			return err
		}
		if !info.Mode().IsRegular() {
			return nil
		}
		file, err := os.Open(path)
		if err != nil {
			return err
		}
		_, copyErr := io.CopyN(tw, file, info.Size())
		closeErr := file.Close()
		if copyErr != nil {
			return copyErr
		}
		return closeErr
	})
}

func (s *Server) backupImport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxPanelBackupUpload)
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		writeError(w, 400, "备份文件格式错误或超过 512MB")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		writeError(w, 400, "请选择 LukePanel 备份文件")
		return
	}
	defer file.Close()

	temp, err := os.MkdirTemp(s.cfg.DataDir, ".panel-restore-*")
	if err != nil {
		writeError(w, 500, "无法创建恢复临时目录")
		return
	}
	defer os.RemoveAll(temp)
	files, _, err := extractPanelBackupArchive(file, temp)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}

	configRaw, err := os.ReadFile(filepath.Join(temp, "panel", "config.json"))
	if err != nil {
		writeError(w, 400, "备份缺少 panel/config.json")
		return
	}
	var restored config.Config
	if err := json.Unmarshal(configRaw, &restored); err != nil {
		writeError(w, 400, "备份配置无法解析")
		return
	}

	s.configMu.RLock()
	current := s.cfg.Clone()
	s.configMu.RUnlock()
	// Runtime endpoints and machine-local secrets never come from an uploaded archive.
	restored.Listen = current.Listen
	restored.DataDir = current.DataDir
	restored.AgentSocket = current.AgentSocket
	restored.AgentSecret = current.AgentSecret
	restored.SessionSecret = current.SessionSecret
	restored.SecureCookie = current.SecureCookie
	restored.TrustedProxy = current.TrustedProxy
	restored.WebAuthnOrigin = current.WebAuthnOrigin
	restored.WebAuthnRPID = current.WebAuthnRPID
	if restored.AutoRefreshSeconds == 0 {
		restored.AutoRefreshSeconds = config.Default().AutoRefreshSeconds
	}
	if err := restored.Validate(); err != nil {
		writeError(w, 400, "备份配置无效："+err.Error())
		return
	}

	commitData, rollbackData, err := installRestoredData(filepath.Join(temp, "data"), current.DataDir)
	if err != nil {
		writeError(w, 500, "恢复面板数据失败："+err.Error())
		return
	}
	committed := false
	defer func() {
		if !committed {
			_ = rollbackData()
		}
	}()
	if err := config.Save(s.configPath, restored); err != nil {
		writeError(w, 500, "恢复配置失败")
		return
	}
	s.configMu.Lock()
	s.cfg = restored
	s.configMu.Unlock()
	session, _ := sessionFromContext(r)
	revoked := s.sessions.RenameCurrentAndDeleteOthers(session.ID, restored.AdminUser)
	s.elevatedMu.Lock()
	s.elevated = map[string]time.Time{}
	s.elevatedMu.Unlock()
	if err := commitData(); err != nil {
		s.logger.Warn("restore cleanup failed", "error", err)
	}
	committed = true
	if err := s.filePrefs.Reload(); err != nil {
		s.logger.Warn("file preference reload failed", "error", err)
	}
	if err := s.audit.ResetIndex(); err != nil {
		s.logger.Warn("audit index rebuild failed", "error", err)
	}
	s.auditRequest(r, "backup.import", "panel", "success", fmt.Sprintf("files=%d revoked_sessions=%d", files, revoked))
	writeJSON(w, 200, map[string]any{"ok": true, "message": "备份已恢复。账号、安全设置和面板数据已更新。", "files": files})
}

func extractPanelBackupArchive(reader io.Reader, destination string) (int, int64, error) {
	gz, err := gzip.NewReader(reader)
	if err != nil {
		return 0, 0, errors.New("备份不是有效的 tar.gz")
	}
	defer gz.Close()
	tr := tar.NewReader(gz)
	var total int64
	files := 0
	for {
		header, err := tr.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return files, total, errors.New("读取备份失败")
		}
		name := filepath.Clean(filepath.FromSlash(header.Name))
		if name == "." || name == ".." || filepath.IsAbs(name) || strings.HasPrefix(name, ".."+string(os.PathSeparator)) {
			return files, total, errors.New("备份包含不安全路径")
		}
		if header.Typeflag == tar.TypeSymlink || header.Typeflag == tar.TypeLink {
			return files, total, errors.New("备份不能包含链接文件")
		}
		if !allowedPanelBackupEntry(name) {
			continue
		}
		if header.Size < 0 {
			return files, total, errors.New("备份包含无效文件大小")
		}
		files++
		total += header.Size
		if files > maxPanelBackupFiles || total > maxPanelBackupBytes {
			return files, total, errors.New("备份内容超过安全限制")
		}
		target := filepath.Join(destination, name)
		rel, err := filepath.Rel(destination, target)
		if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
			return files, total, errors.New("备份路径越界")
		}
		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0o700); err != nil {
				return files, total, errors.New("恢复临时目录失败")
			}
		case tar.TypeReg, tar.TypeRegA:
			if err := os.MkdirAll(filepath.Dir(target), 0o700); err != nil {
				return files, total, errors.New("恢复临时目录失败")
			}
			out, err := os.OpenFile(target, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
			if err != nil {
				return files, total, errors.New("恢复临时文件失败")
			}
			_, copyErr := io.CopyN(out, tr, header.Size)
			closeErr := out.Close()
			if copyErr != nil || closeErr != nil {
				return files, total, errors.New("写入恢复临时文件失败")
			}
		default:
			return files, total, errors.New("备份包含不支持的文件类型")
		}
	}
	return files, total, nil
}

func allowedPanelBackupEntry(name string) bool {
	if name == "manifest.json" || name == filepath.Join("panel", "config.json") || name == "panel" || name == "data" {
		return true
	}
	prefix := "data" + string(os.PathSeparator)
	if !strings.HasPrefix(name, prefix) {
		return false
	}
	rel := strings.TrimPrefix(name, prefix)
	root := strings.SplitN(rel, string(os.PathSeparator), 2)[0]
	for _, allowed := range panelBackupDataRoots {
		if root == allowed {
			return true
		}
	}
	return false
}

type restoreMove struct {
	target    string
	old       string
	hadOld    bool
	installed bool
}

// installRestoredData swaps staged data into place and returns explicit commit and rollback functions.
func installRestoredData(stagedRoot, dataRoot string) (func() error, func() error, error) {
	rollbackRoot, err := os.MkdirTemp(dataRoot, ".restore-rollback-*")
	if err != nil {
		return nil, nil, err
	}
	moves := make([]restoreMove, 0, len(panelBackupDataRoots))
	done := false
	rollback := func() error {
		if done {
			return nil
		}
		done = true
		var first error
		for i := len(moves) - 1; i >= 0; i-- {
			move := moves[i]
			if move.installed {
				if err := os.RemoveAll(move.target); err != nil && first == nil {
					first = err
				}
			}
			if move.hadOld {
				if err := os.Rename(move.old, move.target); err != nil && first == nil {
					first = err
				}
			}
		}
		if err := os.RemoveAll(rollbackRoot); err != nil && first == nil {
			first = err
		}
		return first
	}
	commit := func() error {
		if done {
			return nil
		}
		done = true
		return os.RemoveAll(rollbackRoot)
	}
	fail := func(err error) (func() error, func() error, error) {
		_ = rollback()
		return nil, nil, err
	}
	for _, item := range panelBackupDataRoots {
		staged := filepath.Join(stagedRoot, item)
		if _, err := os.Lstat(staged); errors.Is(err, os.ErrNotExist) {
			continue
		} else if err != nil {
			return fail(err)
		}
		target := filepath.Join(dataRoot, item)
		old := filepath.Join(rollbackRoot, item)
		move := restoreMove{target: target, old: old}
		if _, err := os.Lstat(target); err == nil {
			if err := os.MkdirAll(filepath.Dir(old), 0o700); err != nil {
				return fail(err)
			}
			if err := os.Rename(target, old); err != nil {
				return fail(err)
			}
			move.hadOld = true
		} else if !errors.Is(err, os.ErrNotExist) {
			return fail(err)
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o750); err != nil {
			moves = append(moves, move)
			return fail(err)
		}
		if err := os.Rename(staged, target); err != nil {
			moves = append(moves, move)
			return fail(err)
		}
		move.installed = true
		moves = append(moves, move)
	}
	return commit, rollback, nil
}
