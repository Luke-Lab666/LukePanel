package files

import (
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type Entry struct {
	Name       string    `json:"name"`
	Path       string    `json:"path"`
	IsDir      bool      `json:"is_dir"`
	IsSymlink  bool      `json:"is_symlink"`
	Size       int64     `json:"size"`
	Mode       string    `json:"mode"`
	ModifiedAt time.Time `json:"modified_at"`
}

type Listing struct {
	Path    string  `json:"path"`
	Parent  string  `json:"parent,omitempty"`
	Entries []Entry `json:"entries"`
	Virtual bool    `json:"virtual"`
}

type Browser struct{ roots []string }

func NewBrowser(roots []string) (*Browser, error) {
	clean := make([]string, 0, len(roots))
	for _, root := range roots {
		abs, err := filepath.Abs(root)
		if err != nil {
			return nil, err
		}
		clean = append(clean, filepath.Clean(abs))
	}
	return &Browser{roots: clean}, nil
}

func (b *Browser) List(requested string) (Listing, error) {
	if requested == "" || requested == "/" {
		entries := make([]Entry, 0, len(b.roots))
		for _, root := range b.roots {
			info, err := os.Stat(root)
			if err != nil {
				continue
			}
			entries = append(entries, Entry{Name: root, Path: root, IsDir: true, Size: info.Size(), Mode: info.Mode().String(), ModifiedAt: info.ModTime()})
		}
		return Listing{Path: "/", Entries: entries, Virtual: true}, nil
	}
	resolved, err := b.resolve(requested)
	if err != nil {
		return Listing{}, err
	}
	items, err := os.ReadDir(resolved)
	if err != nil {
		return Listing{}, err
	}
	entries := make([]Entry, 0, len(items))
	for _, item := range items {
		info, err := item.Info()
		if err != nil {
			continue
		}
		path := filepath.Join(resolved, item.Name())
		entries = append(entries, Entry{Name: item.Name(), Path: path, IsDir: item.IsDir(), IsSymlink: item.Type()&os.ModeSymlink != 0, Size: info.Size(), Mode: info.Mode().String(), ModifiedAt: info.ModTime()})
	}
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].IsDir != entries[j].IsDir {
			return entries[i].IsDir
		}
		return strings.ToLower(entries[i].Name) < strings.ToLower(entries[j].Name)
	})
	parent := filepath.Dir(resolved)
	if !b.allowed(parent) {
		parent = "/"
	}
	return Listing{Path: resolved, Parent: parent, Entries: entries}, nil
}

func (b *Browser) resolve(requested string) (string, error) {
	abs, err := filepath.Abs(requested)
	if err != nil {
		return "", err
	}
	abs = filepath.Clean(abs)
	if !b.allowed(abs) {
		return "", errors.New("path is outside allowed roots")
	}
	resolved, err := filepath.EvalSymlinks(abs)
	if err != nil {
		return "", err
	}
	if !b.allowed(resolved) {
		return "", errors.New("symlink target is outside allowed roots")
	}
	info, err := os.Stat(resolved)
	if err != nil {
		return "", err
	}
	if !info.IsDir() {
		return "", errors.New("path is not a directory")
	}
	return resolved, nil
}
func (b *Browser) allowed(path string) bool {
	clean := filepath.Clean(path)
	for _, root := range b.roots {
		if clean == root || strings.HasPrefix(clean, root+string(os.PathSeparator)) {
			return true
		}
	}
	return false
}
