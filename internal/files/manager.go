package files

import (
	"archive/zip"
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	pathpkg "path"
	"path/filepath"
	"sort"
	"strconv"
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

type RecycleEntry struct {
	ID           string    `json:"id"`
	OriginalPath string    `json:"original_path"`
	RecycledPath string    `json:"recycled_path"`
	Name         string    `json:"name"`
	IsDir        bool      `json:"is_dir"`
	Size         int64     `json:"size"`
	DeletedAt    time.Time `json:"deleted_at"`
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
	return m.Move(source, destination)
}

func (m *Manager) Copy(source, destination string) error {
	src, info, err := m.resolveAny(source)
	if err != nil {
		return err
	}
	if m.isManagedRoot(src) {
		return errors.New("不允许直接复制授权根目录")
	}
	dst, err := m.resolveNew(destination)
	if err != nil {
		return err
	}
	if src == dst {
		return errors.New("源路径和目标路径相同")
	}
	if info.IsDir() && strings.HasPrefix(dst+string(os.PathSeparator), src+string(os.PathSeparator)) {
		return errors.New("不能把文件夹复制到自身内部")
	}
	if _, err := os.Lstat(dst); err == nil {
		return errors.New("目标路径已存在")
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return copyPath(src, dst, info)
}

func (m *Manager) Move(source, destination string) error {
	src, info, err := m.resolveAny(source)
	if err != nil {
		return err
	}
	if m.isManagedRoot(src) {
		return errors.New("不允许移动授权根目录")
	}
	dst, err := m.resolveNew(destination)
	if err != nil {
		return err
	}
	if src == dst {
		return nil
	}
	if info.IsDir() && strings.HasPrefix(dst+string(os.PathSeparator), src+string(os.PathSeparator)) {
		return errors.New("不能把文件夹移动到自身内部")
	}
	if _, err := os.Lstat(dst); err == nil {
		return errors.New("目标路径已存在")
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	if err := os.Rename(src, dst); err == nil {
		return nil
	} else if !errors.Is(err, syscall.EXDEV) {
		return err
	}
	if err := copyPath(src, dst, info); err != nil {
		return err
	}
	if info.IsDir() {
		return os.RemoveAll(src)
	}
	return os.Remove(src)
}

func (m *Manager) Chmod(path, mode string) error {
	resolved, _, err := m.resolveAny(path)
	if err != nil {
		return err
	}
	if m.isManagedRoot(resolved) {
		return errors.New("不允许修改授权根目录权限")
	}
	value, err := parseMode(mode)
	if err != nil {
		return err
	}
	return os.Chmod(resolved, value)
}

func (m *Manager) Trash(path string) (string, error) {
	resolved, info, err := m.resolveAny(path)
	if err != nil {
		return "", err
	}
	if m.isManagedRoot(resolved) {
		return "", errors.New("不允许删除授权根目录")
	}
	root := filepath.Join(m.dataDir, "recycle")
	itemsDir := filepath.Join(root, "items")
	metaDir := filepath.Join(root, "meta")
	if err := os.MkdirAll(itemsDir, 0o750); err != nil {
		return "", err
	}
	if err := os.MkdirAll(metaDir, 0o750); err != nil {
		return "", err
	}
	now := time.Now().UTC()
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s:%d", resolved, now.UnixNano())))
	id := fmt.Sprintf("%s-%s", now.Format("20060102T150405"), hex.EncodeToString(sum[:5]))
	destination := filepath.Join(itemsDir, id)
	if err := moveInternal(resolved, destination, info); err != nil {
		return "", err
	}
	entry := RecycleEntry{ID: id, OriginalPath: resolved, RecycledPath: destination, Name: filepath.Base(resolved), IsDir: info.IsDir(), Size: info.Size(), DeletedAt: now}
	if err := writeJSONFile(filepath.Join(metaDir, id+".json"), entry, 0o600); err != nil {
		_ = moveInternal(destination, resolved, info)
		return "", err
	}
	return destination, nil
}

func (m *Manager) ListRecycle() ([]RecycleEntry, error) {
	metaDir := filepath.Join(m.dataDir, "recycle", "meta")
	entries, err := os.ReadDir(metaDir)
	if errors.Is(err, os.ErrNotExist) {
		return []RecycleEntry{}, nil
	}
	if err != nil {
		return nil, err
	}
	out := make([]RecycleEntry, 0, len(entries))
	for _, item := range entries {
		if item.IsDir() || !strings.HasSuffix(item.Name(), ".json") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(metaDir, item.Name()))
		if err != nil {
			continue
		}
		var entry RecycleEntry
		if json.Unmarshal(data, &entry) != nil || entry.ID == "" {
			continue
		}
		if _, err := os.Lstat(entry.RecycledPath); err != nil {
			continue
		}
		out = append(out, entry)
	}
	sortRecycle(out)
	if len(out) > 500 {
		out = out[:500]
	}
	return out, nil
}

func (m *Manager) RestoreRecycle(id, destination string) (string, error) {
	entry, metaPath, err := m.recycleEntry(id)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(destination) == "" {
		destination = entry.OriginalPath
	}
	dst, err := m.resolveNew(destination)
	if err != nil {
		return "", err
	}
	if _, err := os.Lstat(dst); err == nil {
		return "", errors.New("恢复目标已存在，请改名后再恢复")
	} else if !errors.Is(err, os.ErrNotExist) {
		return "", err
	}
	info, err := os.Lstat(entry.RecycledPath)
	if err != nil {
		return "", err
	}
	if err := moveInternal(entry.RecycledPath, dst, info); err != nil {
		return "", err
	}
	_ = os.Remove(metaPath)
	return dst, nil
}

func (m *Manager) PurgeRecycle(id string) error {
	entry, metaPath, err := m.recycleEntry(id)
	if err != nil {
		return err
	}
	if err := os.RemoveAll(entry.RecycledPath); err != nil {
		return err
	}
	return os.Remove(metaPath)
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
	return m.SaveUploadRelative(directory, filename, source, sizeLimit, false)
}

func (m *Manager) SaveUploadRelative(directory, relativePath string, source io.Reader, sizeLimit int64, overwrite bool) (string, error) {
	relativePath = strings.ReplaceAll(strings.TrimSpace(relativePath), `\\`, "/")
	clean := pathpkg.Clean(relativePath)
	if clean == "." || clean == "" || pathpkg.IsAbs(clean) || clean == ".." || strings.HasPrefix(clean, "../") || strings.ContainsRune(clean, '\x00') {
		return "", errors.New("上传路径无效")
	}
	dir, info, err := m.resolveExisting(directory, true)
	if err != nil {
		return "", err
	}
	if !info.IsDir() {
		return "", errors.New("上传目标不是文件夹")
	}
	destination, err := m.resolveNestedNew(dir, clean)
	if err != nil {
		return "", err
	}
	if sensitivePath(destination) {
		return "", errors.New("不允许上传敏感文件")
	}
	rel, err := filepath.Rel(dir, destination)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
		return "", errors.New("上传路径越界")
	}
	if sizeLimit <= 0 || sizeLimit > MaxUploadSize {
		sizeLimit = MaxUploadSize
	}
	if err := os.MkdirAll(filepath.Dir(destination), 0o750); err != nil {
		return "", err
	}
	if old, statErr := os.Stat(destination); statErr == nil {
		if old.IsDir() {
			return "", errors.New("目标位置已有同名文件夹")
		}
		if !overwrite {
			return "", errors.New("目标文件已存在")
		}
		if err := m.backup(destination, old); err != nil {
			return "", fmt.Errorf("覆盖前备份失败: %w", err)
		}
	} else if !errors.Is(statErr, os.ErrNotExist) {
		return "", statErr
	}
	tmp, err := os.CreateTemp(filepath.Dir(destination), ".lukepanel-upload-*.tmp")
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
	if err := os.Rename(tmpName, destination); err != nil {
		return "", err
	}
	return destination, nil
}

type ExtractResult struct {
	Files int   `json:"files"`
	Dirs  int   `json:"dirs"`
	Bytes int64 `json:"bytes"`
}

func (m *Manager) ExtractZIP(directory string, source io.Reader, overwrite bool) (ExtractResult, error) {
	dir, info, err := m.resolveExisting(directory, true)
	if err != nil {
		return ExtractResult{}, err
	}
	if !info.IsDir() {
		return ExtractResult{}, errors.New("解压目标不是文件夹")
	}
	tmp, err := os.CreateTemp(m.dataDir, ".lukepanel-archive-*.zip")
	if err != nil {
		return ExtractResult{}, err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	written, err := io.Copy(tmp, io.LimitReader(source, MaxUploadSize+1))
	if err != nil {
		tmp.Close()
		return ExtractResult{}, err
	}
	if written > MaxUploadSize {
		tmp.Close()
		return ExtractResult{}, errors.New("压缩包超过 512MB")
	}
	if err := tmp.Close(); err != nil {
		return ExtractResult{}, err
	}
	archive, err := zip.OpenReader(tmpName)
	if err != nil {
		return ExtractResult{}, errors.New("不是有效的 ZIP 压缩包")
	}
	defer archive.Close()
	if len(archive.File) > 5000 {
		return ExtractResult{}, errors.New("压缩包文件数量超过 5000")
	}
	var result ExtractResult
	const maxExpanded = int64(2 << 30)
	for _, item := range archive.File {
		name := strings.ReplaceAll(item.Name, `\\`, "/")
		clean := pathpkg.Clean(name)
		if clean == "." || clean == "" {
			continue
		}
		if pathpkg.IsAbs(clean) || clean == ".." || strings.HasPrefix(clean, "../") || strings.ContainsRune(clean, '\x00') {
			return result, errors.New("压缩包包含越界路径")
		}
		if item.Mode()&os.ModeSymlink != 0 {
			return result, errors.New("压缩包包含符号链接，已拒绝")
		}
		destination, err := m.resolveNestedNew(dir, clean)
		if err != nil {
			return result, err
		}
		rel, err := filepath.Rel(dir, destination)
		if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
			return result, errors.New("解压路径越界")
		}
		if sensitivePath(destination) {
			return result, errors.New("压缩包试图写入敏感文件")
		}
		if item.FileInfo().IsDir() {
			if err := os.MkdirAll(destination, 0o750); err != nil {
				return result, err
			}
			result.Dirs++
			continue
		}
		if item.UncompressedSize64 > uint64(MaxUploadSize) || result.Bytes+int64(item.UncompressedSize64) > maxExpanded {
			return result, errors.New("压缩包解压后体积超过限制")
		}
		if err := os.MkdirAll(filepath.Dir(destination), 0o750); err != nil {
			return result, err
		}
		if old, statErr := os.Stat(destination); statErr == nil {
			if old.IsDir() {
				return result, fmt.Errorf("目标位置已有同名文件夹: %s", clean)
			}
			if !overwrite {
				return result, fmt.Errorf("文件已存在: %s", clean)
			}
			if err := m.backup(destination, old); err != nil {
				return result, fmt.Errorf("覆盖前备份失败: %w", err)
			}
		} else if !errors.Is(statErr, os.ErrNotExist) {
			return result, statErr
		}
		r, err := item.Open()
		if err != nil {
			return result, err
		}
		tmpOut, err := os.CreateTemp(filepath.Dir(destination), ".lukepanel-extract-*.tmp")
		if err != nil {
			r.Close()
			return result, err
		}
		tmpOutName := tmpOut.Name()
		copied, copyErr := io.Copy(tmpOut, io.LimitReader(r, MaxUploadSize+1))
		r.Close()
		closeErr := tmpOut.Close()
		if copyErr != nil || closeErr != nil || copied > MaxUploadSize {
			os.Remove(tmpOutName)
			if copyErr != nil {
				return result, copyErr
			}
			if closeErr != nil {
				return result, closeErr
			}
			return result, errors.New("压缩包中的单个文件超过限制")
		}
		mode := item.Mode().Perm()
		if mode == 0 {
			mode = 0o640
		}
		mode &= 0o755
		if err := os.Chmod(tmpOutName, mode); err != nil {
			os.Remove(tmpOutName)
			return result, err
		}
		if err := os.Rename(tmpOutName, destination); err != nil {
			os.Remove(tmpOutName)
			return result, err
		}
		result.Files++
		result.Bytes += copied
	}
	return result, nil
}

func (m *Manager) resolveAny(path string) (string, os.FileInfo, error) {
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
	info, err := os.Lstat(resolved)
	if err != nil {
		return "", nil, err
	}
	if info.Mode()&os.ModeSymlink != 0 {
		return "", nil, errors.New("不支持直接操作符号链接")
	}
	return resolved, info, nil
}

func (m *Manager) recycleEntry(id string) (RecycleEntry, string, error) {
	if id == "" || filepath.Base(id) != id || strings.ContainsAny(id, `/\\`) {
		return RecycleEntry{}, "", errors.New("invalid recycle id")
	}
	metaPath := filepath.Join(m.dataDir, "recycle", "meta", id+".json")
	data, err := os.ReadFile(metaPath)
	if err != nil {
		return RecycleEntry{}, "", err
	}
	var entry RecycleEntry
	if err := json.Unmarshal(data, &entry); err != nil || entry.ID != id {
		return RecycleEntry{}, "", errors.New("回收站记录损坏")
	}
	itemsDir := filepath.Join(m.dataDir, "recycle", "items")
	clean := filepath.Clean(entry.RecycledPath)
	if !strings.HasPrefix(clean, filepath.Clean(itemsDir)+string(os.PathSeparator)) {
		return RecycleEntry{}, "", errors.New("回收站路径异常")
	}
	return entry, metaPath, nil
}

func copyPath(source, destination string, info os.FileInfo) error {
	if info.Mode()&os.ModeSymlink != 0 {
		return errors.New("不支持复制符号链接")
	}
	if !info.IsDir() {
		return copyFile(source, destination, info)
	}
	if err := os.Mkdir(destination, info.Mode().Perm()); err != nil {
		return err
	}
	entries, err := os.ReadDir(source)
	if err != nil {
		_ = os.Remove(destination)
		return err
	}
	for _, entry := range entries {
		src := filepath.Join(source, entry.Name())
		dst := filepath.Join(destination, entry.Name())
		childInfo, err := os.Lstat(src)
		if err != nil {
			_ = os.RemoveAll(destination)
			return err
		}
		if childInfo.Mode()&os.ModeSymlink != 0 {
			_ = os.RemoveAll(destination)
			return fmt.Errorf("目录包含符号链接：%s", src)
		}
		if err := copyPath(src, dst, childInfo); err != nil {
			_ = os.RemoveAll(destination)
			return err
		}
	}
	_ = os.Chown(destination, statUID(info), statGID(info))
	return os.Chtimes(destination, info.ModTime(), info.ModTime())
}

func copyFile(source, destination string, info os.FileInfo) error {
	src, err := os.Open(source)
	if err != nil {
		return err
	}
	defer src.Close()
	dst, err := os.OpenFile(destination, os.O_CREATE|os.O_EXCL|os.O_WRONLY, info.Mode().Perm())
	if err != nil {
		return err
	}
	ok := false
	defer func() {
		_ = dst.Close()
		if !ok {
			_ = os.Remove(destination)
		}
	}()
	buffer := make([]byte, 128<<10)
	if _, err := io.CopyBuffer(dst, src, buffer); err != nil {
		return err
	}
	if err := dst.Sync(); err != nil {
		return err
	}
	if err := dst.Close(); err != nil {
		return err
	}
	_ = os.Chown(destination, statUID(info), statGID(info))
	_ = os.Chtimes(destination, info.ModTime(), info.ModTime())
	ok = true
	return nil
}

func moveInternal(source, destination string, info os.FileInfo) error {
	if err := os.Rename(source, destination); err == nil {
		return nil
	} else if !errors.Is(err, syscall.EXDEV) {
		return err
	}
	if err := copyPath(source, destination, info); err != nil {
		return err
	}
	if info.IsDir() {
		return os.RemoveAll(source)
	}
	return os.Remove(source)
}

func parseMode(value string) (os.FileMode, error) {
	value = strings.TrimSpace(strings.TrimPrefix(value, "0o"))
	if len(value) < 3 || len(value) > 4 {
		return 0, errors.New("权限格式应为 644、755 或 0644")
	}
	n, err := strconv.ParseUint(value, 8, 32)
	if err != nil || n > 0o7777 {
		return 0, errors.New("无效的八进制权限")
	}
	return os.FileMode(n), nil
}

func writeJSONFile(path string, value any, mode os.FileMode) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	tmp, err := os.CreateTemp(filepath.Dir(path), ".meta-*.tmp")
	if err != nil {
		return err
	}
	name := tmp.Name()
	defer os.Remove(name)
	if err := tmp.Chmod(mode); err != nil {
		tmp.Close()
		return err
	}
	if _, err := tmp.Write(data); err != nil {
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
	return os.Rename(name, path)
}

func sortRecycle(entries []RecycleEntry) {
	for i := 1; i < len(entries); i++ {
		for j := i; j > 0 && entries[j].DeletedAt.After(entries[j-1].DeletedAt); j-- {
			entries[j], entries[j-1] = entries[j-1], entries[j]
		}
	}
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

func (m *Manager) resolveNestedNew(root, relative string) (string, error) {
	root = filepath.Clean(root)
	parts := strings.Split(filepath.FromSlash(relative), string(os.PathSeparator))
	current := root
	for _, part := range parts[:len(parts)-1] {
		if part == "" || part == "." || part == ".." {
			return "", errors.New("nested path is invalid")
		}
		current = filepath.Join(current, part)
		info, err := os.Lstat(current)
		if errors.Is(err, os.ErrNotExist) {
			if err := os.Mkdir(current, 0o750); err != nil && !errors.Is(err, os.ErrExist) {
				return "", err
			}
			info, err = os.Lstat(current)
		}
		if err != nil {
			return "", err
		}
		if info.Mode()&os.ModeSymlink != 0 || !info.IsDir() {
			return "", errors.New("nested upload path contains a symlink or non-directory")
		}
	}
	destination := filepath.Join(current, parts[len(parts)-1])
	if !m.allowed(destination) {
		return "", errors.New("path is outside allowed roots")
	}
	rel, err := filepath.Rel(root, destination)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
		return "", errors.New("nested path escapes the target directory")
	}
	return destination, nil
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

func (m *Manager) isManagedRoot(path string) bool {
	clean := filepath.Clean(path)
	for _, root := range m.roots {
		if clean == filepath.Clean(root) {
			return true
		}
	}
	return false
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
	if _, err = io.Copy(dst, src); err != nil {
		dst.Close()
		_ = os.Remove(dst.Name())
		return err
	}
	if err := dst.Close(); err != nil {
		return err
	}
	_ = pruneDirectory(dir, 500<<20, 500)
	return nil
}

func pruneDirectory(dir string, maxBytes int64, maxFiles int) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}
	type candidate struct {
		path string
		size int64
		at   time.Time
	}
	files := make([]candidate, 0, len(entries))
	var total int64
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		files = append(files, candidate{path: filepath.Join(dir, entry.Name()), size: info.Size(), at: info.ModTime()})
		total += info.Size()
	}
	sort.Slice(files, func(i, j int) bool { return files[i].at.Before(files[j].at) })
	for len(files) > 0 && (len(files) > maxFiles || total > maxBytes) {
		item := files[0]
		files = files[1:]
		if err := os.Remove(item.path); err == nil || errors.Is(err, os.ErrNotExist) {
			total -= item.size
		}
	}
	return nil
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

// ResolveExisting validates a path against the configured roots for other trusted modules.
func (m *Manager) ResolveExisting(path string, wantDir bool) (string, os.FileInfo, error) {
	return m.resolveExisting(path, wantDir)
}
