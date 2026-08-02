package files

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"errors"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type SearchResult struct {
	Root    string  `json:"root"`
	Query   string  `json:"query"`
	Entries []Entry `json:"entries"`
	Limited bool    `json:"limited"`
}

type Preview struct {
	Path string `json:"path"`
	Name string `json:"name"`
	MIME string `json:"mime"`
	Kind string `json:"kind"`
	Size int64  `json:"size"`
}

type ArchiveEntry struct {
	Name       string    `json:"name"`
	IsDir      bool      `json:"is_dir"`
	Size       int64     `json:"size"`
	Compressed uint64    `json:"compressed"`
	ModifiedAt time.Time `json:"modified_at"`
}

type ArchiveList struct {
	Path    string         `json:"path"`
	Entries []ArchiveEntry `json:"entries"`
	Limited bool           `json:"limited"`
}

type ArchiveCreateRequest struct {
	Destination string   `json:"destination"`
	Sources     []string `json:"sources"`
	Format      string   `json:"format"`
}

type ArchiveCreateResult struct {
	Path  string `json:"path"`
	Files int    `json:"files"`
	Dirs  int    `json:"dirs"`
	Bytes int64  `json:"bytes"`
}

func (m *Manager) Search(root, query string) (SearchResult, error) {
	query = strings.TrimSpace(query)
	if len(query) < 1 || len(query) > 120 || strings.ContainsAny(query, "\x00\r\n") {
		return SearchResult{}, errors.New("搜索词必须是 1-120 个字符")
	}
	resolved, info, err := m.resolveExisting(root, true)
	if err != nil {
		return SearchResult{}, err
	}
	if !info.IsDir() {
		return SearchResult{}, errors.New("搜索范围不是文件夹")
	}
	lower := strings.ToLower(query)
	result := SearchResult{Root: resolved, Query: query}
	const maxResults = 300
	const maxVisited = 50000
	visited := 0
	err = filepath.WalkDir(resolved, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			if entry != nil && entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		visited++
		if visited > maxVisited || len(result.Entries) >= maxResults {
			result.Limited = true
			if entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if path == resolved {
			return nil
		}
		if IsVirtualPath(path) {
			if entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if entry.Type()&os.ModeSymlink != 0 {
			if entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.Contains(strings.ToLower(entry.Name()), lower) {
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return nil
		}
		result.Entries = append(result.Entries, Entry{Name: entry.Name(), Path: path, IsDir: entry.IsDir(), Size: info.Size(), Mode: info.Mode().String(), ModifiedAt: info.ModTime()})
		return nil
	})
	if err != nil {
		return SearchResult{}, err
	}
	sort.Slice(result.Entries, func(i, j int) bool {
		if result.Entries[i].IsDir != result.Entries[j].IsDir {
			return result.Entries[i].IsDir
		}
		return strings.ToLower(result.Entries[i].Path) < strings.ToLower(result.Entries[j].Path)
	})
	return result, nil
}

func (m *Manager) PreviewInfo(path string) (Preview, error) {
	resolved, info, err := m.resolveExisting(path, false)
	if err != nil {
		return Preview{}, err
	}
	mimeType, err := detectMIME(resolved)
	if err != nil {
		return Preview{}, err
	}
	kind := "download"
	switch {
	case strings.HasPrefix(mimeType, "image/"):
		kind = "image"
	case mimeType == "application/pdf":
		kind = "pdf"
	case strings.HasPrefix(mimeType, "text/") || strings.Contains(mimeType, "json") || strings.Contains(mimeType, "xml") || strings.Contains(mimeType, "yaml"):
		kind = "text"
	case strings.HasSuffix(strings.ToLower(resolved), ".md") || strings.HasSuffix(strings.ToLower(resolved), ".markdown"):
		kind = "markdown"
	case strings.HasSuffix(strings.ToLower(resolved), ".zip"):
		kind = "archive"
	}
	return Preview{Path: resolved, Name: filepath.Base(resolved), MIME: mimeType, Kind: kind, Size: info.Size()}, nil
}

func (m *Manager) OpenPreview(path string) (*os.File, os.FileInfo, string, error) {
	preview, err := m.PreviewInfo(path)
	if err != nil {
		return nil, nil, "", err
	}
	if preview.Size > 100<<20 {
		return nil, nil, "", errors.New("在线预览限制为 100MB")
	}
	if preview.Kind != "image" && preview.Kind != "pdf" {
		return nil, nil, "", errors.New("这个文件类型不支持二进制预览")
	}
	resolved, info, err := m.resolveExisting(path, false)
	if err != nil {
		return nil, nil, "", err
	}
	file, err := os.Open(resolved)
	return file, info, preview.MIME, err
}

func (m *Manager) ListZIP(path string) (ArchiveList, error) {
	resolved, info, err := m.resolveExisting(path, false)
	if err != nil {
		return ArchiveList{}, err
	}
	if info.Size() > MaxUploadSize {
		return ArchiveList{}, errors.New("ZIP 文件超过 512MB")
	}
	archive, err := zip.OpenReader(resolved)
	if err != nil {
		return ArchiveList{}, errors.New("不是有效的 ZIP 文件")
	}
	defer archive.Close()
	result := ArchiveList{Path: resolved}
	for index, entry := range archive.File {
		if index >= 1000 {
			result.Limited = true
			break
		}
		result.Entries = append(result.Entries, ArchiveEntry{Name: entry.Name, IsDir: entry.FileInfo().IsDir(), Size: int64(entry.UncompressedSize64), Compressed: entry.CompressedSize64, ModifiedAt: entry.Modified})
	}
	return result, nil
}

func (m *Manager) CreateArchive(request ArchiveCreateRequest) (ArchiveCreateResult, error) {
	if len(request.Sources) == 0 || len(request.Sources) > 100 {
		return ArchiveCreateResult{}, errors.New("请选择 1-100 个文件或文件夹")
	}
	format := strings.ToLower(strings.TrimSpace(request.Format))
	if format == "" {
		format = "zip"
	}
	if format != "zip" && format != "tar.gz" {
		return ArchiveCreateResult{}, errors.New("只支持 ZIP 和 TAR.GZ")
	}
	destination, err := m.resolveNew(request.Destination)
	if err != nil {
		return ArchiveCreateResult{}, err
	}
	if _, err := os.Stat(destination); err == nil {
		return ArchiveCreateResult{}, errors.New("目标压缩包已存在")
	}
	if err := os.MkdirAll(filepath.Dir(destination), 0o750); err != nil {
		return ArchiveCreateResult{}, err
	}
	tmp, err := os.CreateTemp(filepath.Dir(destination), ".lukepanel-archive-*.tmp")
	if err != nil {
		return ArchiveCreateResult{}, err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	result := ArchiveCreateResult{Path: destination}
	if format == "zip" {
		writer := zip.NewWriter(tmp)
		err = m.writeZIP(writer, request.Sources, &result)
		if closeErr := writer.Close(); err == nil {
			err = closeErr
		}
	} else {
		gz := gzip.NewWriter(tmp)
		writer := tar.NewWriter(gz)
		err = m.writeTar(writer, request.Sources, &result)
		if closeErr := writer.Close(); err == nil {
			err = closeErr
		}
		if closeErr := gz.Close(); err == nil {
			err = closeErr
		}
	}
	if closeErr := tmp.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		return ArchiveCreateResult{}, err
	}
	if err := os.Chmod(tmpName, 0o640); err != nil {
		return ArchiveCreateResult{}, err
	}
	if err := os.Rename(tmpName, destination); err != nil {
		return ArchiveCreateResult{}, err
	}
	return result, nil
}

func (m *Manager) writeZIP(writer *zip.Writer, sources []string, result *ArchiveCreateResult) error {
	for _, raw := range sources {
		source, _, err := m.resolveAny(raw)
		if err != nil {
			return err
		}
		if IsVirtualPath(source) {
			return errors.New("虚拟系统目录不支持打包")
		}
		base := filepath.Base(source)
		err = filepath.Walk(source, func(path string, info os.FileInfo, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			if info.Mode()&os.ModeSymlink != 0 {
				return nil
			}
			rel, _ := filepath.Rel(source, path)
			name := filepath.ToSlash(base)
			if rel != "." {
				name = filepath.ToSlash(filepath.Join(base, rel))
			}
			if info.IsDir() {
				result.Dirs++
				if !strings.HasSuffix(name, "/") {
					name += "/"
				}
				_, err := writer.CreateHeader(&zip.FileHeader{Name: name, Method: zip.Store})
				return err
			}
			if !info.Mode().IsRegular() {
				return nil
			}
			header, err := zip.FileInfoHeader(info)
			if err != nil {
				return err
			}
			header.Name, header.Method = name, zip.Deflate
			out, err := writer.CreateHeader(header)
			if err != nil {
				return err
			}
			in, err := os.Open(path)
			if err != nil {
				return err
			}
			n, copyErr := io.Copy(out, in)
			closeErr := in.Close()
			result.Files++
			result.Bytes += n
			if copyErr != nil {
				return copyErr
			}
			return closeErr
		})
		if err != nil {
			return err
		}
	}
	return nil
}

func (m *Manager) writeTar(writer *tar.Writer, sources []string, result *ArchiveCreateResult) error {
	for _, raw := range sources {
		source, _, err := m.resolveAny(raw)
		if err != nil {
			return err
		}
		if IsVirtualPath(source) {
			return errors.New("虚拟系统目录不支持打包")
		}
		base := filepath.Base(source)
		err = filepath.Walk(source, func(path string, info os.FileInfo, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			if info.Mode()&os.ModeSymlink != 0 {
				return nil
			}
			rel, _ := filepath.Rel(source, path)
			name := base
			if rel != "." {
				name = filepath.Join(base, rel)
			}
			header, err := tar.FileInfoHeader(info, "")
			if err != nil {
				return err
			}
			header.Name = filepath.ToSlash(name)
			if err := writer.WriteHeader(header); err != nil {
				return err
			}
			if info.IsDir() {
				result.Dirs++
				return nil
			}
			if !info.Mode().IsRegular() {
				return nil
			}
			in, err := os.Open(path)
			if err != nil {
				return err
			}
			n, copyErr := io.Copy(writer, in)
			closeErr := in.Close()
			result.Files++
			result.Bytes += n
			if copyErr != nil {
				return copyErr
			}
			return closeErr
		})
		if err != nil {
			return err
		}
	}
	return nil
}

func detectMIME(path string) (string, error) {
	if ext := strings.ToLower(filepath.Ext(path)); ext != "" {
		if value := mime.TypeByExtension(ext); value != "" {
			return strings.Split(value, ";")[0], nil
		}
	}
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	buffer := make([]byte, 512)
	n, _ := file.Read(buffer)
	return http.DetectContentType(buffer[:n]), nil
}
