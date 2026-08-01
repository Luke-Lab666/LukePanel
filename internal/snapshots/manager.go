package snapshots

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"syscall"
	"time"
)

const maxSnapshots = 80

type Item struct {
	Original string `json:"original"`
	Stored   string `json:"stored"`
	Exists   bool   `json:"exists"`
	IsDir    bool   `json:"is_dir"`
	Mode     uint32 `json:"mode"`
	UID      int    `json:"uid,omitempty"`
	GID      int    `json:"gid,omitempty"`
}

type Snapshot struct {
	ID        string    `json:"id"`
	Kind      string    `json:"kind"`
	Name      string    `json:"name"`
	Note      string    `json:"note,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	Items     []Item    `json:"items"`
	Size      int64     `json:"size"`
}

type Manager struct{ root string }

func New(dataDir string) *Manager { return &Manager{root: filepath.Join(dataDir, "snapshots")} }

func (m *Manager) Create(kind, name, note string, paths []string) (Snapshot, error) {
	kind = cleanLabel(kind, "general")
	name = strings.TrimSpace(name)
	if name == "" {
		name = "配置快照"
	}
	if len(name) > 120 || len(note) > 1000 {
		return Snapshot{}, errors.New("快照名称或说明过长")
	}
	if len(paths) == 0 || len(paths) > 32 {
		return Snapshot{}, errors.New("快照路径数量无效")
	}
	now := time.Now().UTC()
	id := now.Format("20060102T150405.000000000") + "-" + kind
	dir := filepath.Join(m.root, id)
	itemsDir := filepath.Join(dir, "items")
	if err := os.MkdirAll(itemsDir, 0o700); err != nil {
		return Snapshot{}, err
	}
	snapshot := Snapshot{ID: id, Kind: kind, Name: name, Note: note, CreatedAt: now}
	for index, raw := range paths {
		path := filepath.Clean(strings.TrimSpace(raw))
		if !filepath.IsAbs(path) || path == "/" || strings.ContainsRune(path, '\x00') {
			_ = os.RemoveAll(dir)
			return Snapshot{}, fmt.Errorf("快照路径无效: %s", raw)
		}
		item := Item{Original: path, Stored: fmt.Sprintf("%03d", index)}
		info, err := os.Lstat(path)
		if errors.Is(err, os.ErrNotExist) {
			snapshot.Items = append(snapshot.Items, item)
			continue
		}
		if err != nil {
			_ = os.RemoveAll(dir)
			return Snapshot{}, fmt.Errorf("读取 %s: %w", path, err)
		}
		item.Exists = true
		item.IsDir = info.IsDir()
		item.Mode = uint32(info.Mode())
		item.UID, item.GID = ownership(info)
		stored := filepath.Join(itemsDir, item.Stored)
		size, err := copyEntry(path, stored, info)
		if err != nil {
			_ = os.RemoveAll(dir)
			return Snapshot{}, fmt.Errorf("备份 %s: %w", path, err)
		}
		snapshot.Size += size
		snapshot.Items = append(snapshot.Items, item)
	}
	if err := writeJSON(filepath.Join(dir, "snapshot.json"), snapshot); err != nil {
		_ = os.RemoveAll(dir)
		return Snapshot{}, err
	}
	_ = m.prune(maxSnapshots)
	return snapshot, nil
}

func (m *Manager) List() ([]Snapshot, error) {
	entries, err := os.ReadDir(m.root)
	if errors.Is(err, os.ErrNotExist) {
		return []Snapshot{}, nil
	}
	if err != nil {
		return nil, err
	}
	out := make([]Snapshot, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		var snapshot Snapshot
		if readJSON(filepath.Join(m.root, entry.Name(), "snapshot.json"), &snapshot) == nil {
			out = append(out, snapshot)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out, nil
}

func (m *Manager) Restore(id string) (Snapshot, error) {
	snapshot, dir, err := m.load(id)
	if err != nil {
		return Snapshot{}, err
	}
	rollbackDir, err := os.MkdirTemp(m.root, ".restore-rollback-*")
	if err != nil {
		return Snapshot{}, err
	}
	defer os.RemoveAll(rollbackDir)
	type rollbackItem struct {
		path   string
		stored string
		exists bool
		info   os.FileInfo
	}
	rollback := make([]rollbackItem, 0, len(snapshot.Items))
	for index, item := range snapshot.Items {
		current, statErr := os.Lstat(item.Original)
		rb := rollbackItem{path: item.Original, stored: filepath.Join(rollbackDir, fmt.Sprintf("%03d", index)), exists: statErr == nil, info: current}
		if statErr != nil && !errors.Is(statErr, os.ErrNotExist) {
			return Snapshot{}, statErr
		}
		if rb.exists {
			if _, err := copyEntry(item.Original, rb.stored, current); err != nil {
				return Snapshot{}, err
			}
		}
		rollback = append(rollback, rb)
	}
	applyErr := error(nil)
	for _, item := range snapshot.Items {
		if err := restoreItem(dir, item); err != nil {
			applyErr = err
			break
		}
	}
	if applyErr == nil {
		return snapshot, nil
	}
	for _, rb := range rollback {
		_ = os.RemoveAll(rb.path)
		if rb.exists {
			_, _ = copyEntry(rb.stored, rb.path, rb.info)
		}
	}
	return Snapshot{}, fmt.Errorf("恢复失败，已尝试回滚: %w", applyErr)
}

func (m *Manager) Delete(id string) error {
	if !validID(id) {
		return errors.New("快照编号无效")
	}
	path := filepath.Join(m.root, id)
	if _, err := os.Stat(filepath.Join(path, "snapshot.json")); err != nil {
		return errors.New("快照不存在")
	}
	return os.RemoveAll(path)
}

func (m *Manager) load(id string) (Snapshot, string, error) {
	if !validID(id) {
		return Snapshot{}, "", errors.New("快照编号无效")
	}
	dir := filepath.Join(m.root, id)
	var snapshot Snapshot
	if err := readJSON(filepath.Join(dir, "snapshot.json"), &snapshot); err != nil {
		return Snapshot{}, "", errors.New("快照不存在或已损坏")
	}
	return snapshot, dir, nil
}

func (m *Manager) prune(max int) error {
	items, err := m.List()
	if err != nil {
		return err
	}
	for len(items) > max {
		oldest := items[len(items)-1]
		_ = os.RemoveAll(filepath.Join(m.root, oldest.ID))
		items = items[:len(items)-1]
	}
	return nil
}

func restoreItem(snapshotDir string, item Item) error {
	if err := os.MkdirAll(filepath.Dir(item.Original), 0o755); err != nil {
		return err
	}
	if err := os.RemoveAll(item.Original); err != nil {
		return err
	}
	if !item.Exists {
		return nil
	}
	stored := filepath.Join(snapshotDir, "items", item.Stored)
	info, err := os.Lstat(stored)
	if err != nil {
		return err
	}
	_, err = copyEntry(stored, item.Original, info)
	return err
}

func copyEntry(source, destination string, info os.FileInfo) (int64, error) {
	if info.Mode()&os.ModeSymlink != 0 {
		target, err := os.Readlink(source)
		if err != nil {
			return 0, err
		}
		if err := os.MkdirAll(filepath.Dir(destination), 0o755); err != nil {
			return 0, err
		}
		if err := os.Symlink(target, destination); err != nil {
			return 0, err
		}
		uid, gid := ownership(info)
		_ = os.Lchown(destination, uid, gid)
		return 0, nil
	}
	if info.IsDir() {
		if err := os.MkdirAll(destination, info.Mode().Perm()); err != nil {
			return 0, err
		}
		uid, gid := ownership(info)
		_ = os.Chown(destination, uid, gid)
		_ = os.Chmod(destination, info.Mode().Perm())
		entries, err := os.ReadDir(source)
		if err != nil {
			return 0, err
		}
		var total int64
		for _, entry := range entries {
			childInfo, err := os.Lstat(filepath.Join(source, entry.Name()))
			if err != nil {
				return total, err
			}
			size, err := copyEntry(filepath.Join(source, entry.Name()), filepath.Join(destination, entry.Name()), childInfo)
			total += size
			if err != nil {
				return total, err
			}
		}
		return total, nil
	}
	if !info.Mode().IsRegular() {
		return 0, fmt.Errorf("不支持快照特殊文件: %s", source)
	}
	if err := os.MkdirAll(filepath.Dir(destination), 0o755); err != nil {
		return 0, err
	}
	in, err := os.Open(source)
	if err != nil {
		return 0, err
	}
	defer in.Close()
	out, err := os.OpenFile(destination, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, info.Mode().Perm())
	if err != nil {
		return 0, err
	}
	n, copyErr := io.Copy(out, in)
	closeErr := out.Close()
	if copyErr != nil {
		return n, copyErr
	}
	if closeErr != nil {
		return n, closeErr
	}
	uid, gid := ownership(info)
	_ = os.Chown(destination, uid, gid)
	_ = os.Chmod(destination, info.Mode().Perm())
	return n, nil
}

func ownership(info os.FileInfo) (int, int) {
	if stat, ok := info.Sys().(*syscall.Stat_t); ok {
		return int(stat.Uid), int(stat.Gid)
	}
	return os.Geteuid(), os.Getegid()
}

func cleanLabel(value, fallback string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	var b strings.Builder
	for _, r := range value {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			b.WriteRune(r)
		}
	}
	if b.Len() == 0 {
		return fallback
	}
	return b.String()
}

func validID(id string) bool {
	if len(id) < 10 || len(id) > 80 || strings.Contains(id, "..") || strings.ContainsAny(id, "/\\\x00\r\n") {
		return false
	}
	return filepath.Base(id) == id
}

func writeJSON(path string, value any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	return os.WriteFile(path, data, 0o600)
}

func readJSON(path string, output any) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, output)
}
