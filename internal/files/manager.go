package files

import (
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

const (
	MaxEditableSize = 2 << 20
	MaxUploadSize   = 512 << 20
)

type FileContent struct {
	Path       string    `json:"path"`
	Name       string    `json:"name"`
	Content    string    `json:"content"`
	Size       int64     `json:"size"`
	Mode       string    `json:"mode"`
	ModifiedAt time.Time `json:"modified_at"`
}

type Manager struct {
	browser *Browser
	roots   []string
	dataDir string
}

func NewManager(roots []string, dataDir string) (*Manager, error) {
	browser, err := NewBrowser(roots)
	if err != nil {
		return nil, err
	}
	return &Manager{browser: browser, roots: browser.roots, dataDir: dataDir}, nil
}

func (m *Manager) List(path string) (Listing, error) { return m.browser.List(path) }

func (m *Manager) Read(path string) (FileContent, error) {
	resolved, info, err := m.resolveExisting(path, false)
	if err != nil {
		return FileContent{}, err
	}
	if sensitivePath(resolved) {
		return FileContent{}, errors.New("敏感文件禁止在线预览")
	}
	if info.Size() > MaxEditableSize {
		return FileContent{}, errors.New("文件超过 2MB，请下载后编辑")
	}
	f, err := os.Open(resolved)
	if err != nil {
		return FileContent{}, err
	}
	defer f.Close()
	reader := bufio.NewReader(io.LimitReader(f, MaxEditableSize+1))
	data, err := io.ReadAll(reader)
	if err != nil {
		return FileContent{}, err
	}
	if isBinary(data) {
		return FileContent{}, errors.New("二进制文件不支持在线预览")
	}
	return FileContent{Path: resolved, Name: filepath.Base(resolved), Content: string(data), Size: info.Size(), Mode: info.Mode().String(), ModifiedAt: info.ModTime()}, nil
}

func (m *Manager) Write(path, content string) error {
	if len(content) > MaxEditableSize {
		return errors.New("文件内容超过 2MB")
	}
	resolved, info, err := m.resolveExisting(path, false)
	if err != nil {
		return err
	}
	if sensitivePath(resolved) {
		return errors.New("敏感文件禁止在线编辑")
	}
	if err := m.backup(resolved, info); err != nil {
		return fmt.Errorf("创建备份失败: %w", err)
	}
	tmp, err := os.CreateTemp(filepath.Dir(resolved), ".lukepanel-*.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if err := tmp.Chmod(info.Mode().Perm()); err != nil {
		tmp.Close()
		return err
	}
	if _, err := io.WriteString(tmp, content); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Chown(tmpName, statUID(info), statGID(info)); err != nil && !errors.Is(err, syscall.EPERM) {
		return err
	}
	return os.Rename(tmpName, resolved)
}

func (m *Manager) CreateFile(path string) error {
	resolved, err := m.resolveNew(path)
	if err != nil {
		return err
	}
	if sensitivePath(resolved) {
		return errors.New("不允许创建敏感文件")
	}
	f, err := os.OpenFile(resolved, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o640)
	if err != nil {
		return err
	}
	return f.Close()
}

func (m *Manager) Mkdir(path string) error {
	resolved, err := m.resolveNew(path)
	if err != nil {
		return err
	}
	return os.Mkdir(resolved, 0o750)
}

func (m *Manager) Rename(source, destination string) error {
	src, _, err := m.resolveExisting(source, false)
	if err != nil {
		if srcDir, _, dirErr := m.resolveExisting(source, true); dirErr == nil {
			src = srcDir
		} else {
			return err
		}
	}
	dst, err := m.resolveNew(destination)
	if err != nil {
		return err
	}
	return os.Rename(src, dst)
}

func (m *Manager) Trash(path string) (string, error) {
	resolved, _, err := m.resolveExisting(path, false)
	if err != nil {
		if dir, _, dirErr := m.resolveExisting(path, true); dirErr == nil {
			resolved = dir
		} else {
			return "", err
		}
	}
	root := filepath.Join(m.dataDir, "recycle")
	if err := os.MkdirAll(root, 0o750); err != nil {
		return "", err
	}
	name := fmt.Sprintf("%s-%s", time.Now().UTC().Format("20060102T150405.000000000"), filepath.Base(resolved))
	destination := filepath.Join(root, name)
	if err := os.Rename(resolved, destination); err != nil {
		if errors.Is(err, syscall.EXDEV) {
			return "", errors.New("当前版本暂不支持跨文件系统移动到回收站")
		}
		return "", err
	}
	return destination, nil
}

func (m *Manager) OpenDownload(path string) (*os.File, os.FileInfo, error) {
	resolved, info, err := m.resolveExisting(path, false)
	if err != nil {
		return nil, nil, err
	}
	if sensitivePath(resolved) {
		return nil, nil, errors.New("敏感文件禁止下载")
	}
	f, err := os.Open(resolved)
	return f, info, err
}

func (m *Manager) SaveUpload(directory, filename string, source io.Reader, sizeLimit int64) (string, error) {
	if filename == "" || filepath.Base(filename) != filename || strings.ContainsRune(filename, os.PathSeparator) {
		return "", errors.New("invalid upload filename")
	}
	dir, _, err := m.resolveExisting(directory, true)
	if err != nil {
		return "", err
	}
	destination, err := m.resolveNew(filepath.Join(dir, filename))
	if err != nil {
		return "", err
	}
	if sensitivePath(destination) {
		return "", errors.New("不允许上传敏感文件")
	}
	if sizeLimit <= 0 || sizeLimit > MaxUploadSize {
		sizeLimit = MaxUploadSize
	}
	tmp, err := os.CreateTemp(dir, ".lukepanel-upload-*.tmp")
	if err != nil {
		return "", err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	written, err := io.Copy(tmp, io.LimitReader(source, sizeLimit+1))
	if err != nil {
		tmp.Close()
		return "", err
	}
	if written > sizeLimit {
		tmp.Close()
		return "", errors.New("上传文件超过限制")
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return "", err
	}
	if err := tmp.Close(); err != nil {
		return "", err
	}
	if err := os.Chmod(tmpName, 0o640); err != nil {
		return "", err
	}
	if _, err := os.Stat(destination); err == nil {
		return "", errors.New("目标文件已存在")
	}
	if err := os.Rename(tmpName, destination); err != nil {
		return "", err
	}
	return destination, nil
}

func (m *Manager) resolveExisting(path string, wantDir bool) (string, os.FileInfo, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", nil, err
	}
	abs = filepath.Clean(abs)
	if !m.allowed(abs) {
		return "", nil, errors.New("path is outside allowed roots")
	}
	resolved, err := filepath.EvalSymlinks(abs)
	if err != nil {
		return "", nil, err
	}
	if !m.allowed(resolved) {
		return "", nil, errors.New("symlink target is outside allowed roots")
	}
	info, err := os.Stat(resolved)
	if err != nil {
		return "", nil, err
	}
	if wantDir != info.IsDir() {
		if wantDir {
			return "", nil, errors.New("path is not a directory")
		}
		return "", nil, errors.New("path is not a file")
	}
	return resolved, info, nil
}

func (m *Manager) resolveNew(path string) (string, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	abs = filepath.Clean(abs)
	if !m.allowed(abs) {
		return "", errors.New("path is outside allowed roots")
	}
	parent := filepath.Dir(abs)
	resolvedParent, info, err := m.resolveExisting(parent, true)
	if err != nil {
		return "", err
	}
	if !info.IsDir() {
		return "", errors.New("parent is not a directory")
	}
	resolved := filepath.Join(resolvedParent, filepath.Base(abs))
	if !m.allowed(resolved) {
		return "", errors.New("path is outside allowed roots")
	}
	return resolved, nil
}

func (m *Manager) allowed(path string) bool {
	clean := filepath.Clean(path)
	for _, root := range m.roots {
		if clean == root || strings.HasPrefix(clean, root+string(os.PathSeparator)) {
			return true
		}
	}
	return false
}

func (m *Manager) backup(path string, info os.FileInfo) error {
	if info.Size() > 20<<20 {
		return nil
	}
	src, err := os.Open(path)
	if err != nil {
		return err
	}
	defer src.Close()
	sum := sha256.Sum256([]byte(path))
	dir := filepath.Join(m.dataDir, "backups", "files")
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return err
	}
	name := fmt.Sprintf("%s-%s-%s.bak", time.Now().UTC().Format("20060102T150405.000000000"), hex.EncodeToString(sum[:8]), filepath.Base(path))
	dst, err := os.OpenFile(filepath.Join(dir, name), os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	defer dst.Close()
	_, err = io.Copy(dst, src)
	return err
}

func sensitivePath(path string) bool {
	clean := filepath.Clean(path)
	base := strings.ToLower(filepath.Base(clean))
	if clean == "/etc/shadow" || clean == "/etc/gshadow" {
		return true
	}
	if strings.Contains(clean, string(os.PathSeparator)+".ssh"+string(os.PathSeparator)) && (strings.HasPrefix(base, "id_") || base == "authorized_keys") {
		return true
	}
	return strings.HasSuffix(base, ".key") || strings.HasSuffix(base, ".pem") || strings.HasSuffix(base, ".p12") || strings.HasSuffix(base, ".pfx")
}

func isBinary(data []byte) bool {
	limit := len(data)
	if limit > 8192 {
		limit = 8192
	}
	for _, b := range data[:limit] {
		if b == 0 {
			return true
		}
	}
	return false
}

func statUID(info os.FileInfo) int {
	if st, ok := info.Sys().(*syscall.Stat_t); ok {
		return int(st.Uid)
	}
	return -1
}
func statGID(info os.FileInfo) int {
	if st, ok := info.Sys().(*syscall.Stat_t); ok {
		return int(st.Gid)
	}
	return -1
}
