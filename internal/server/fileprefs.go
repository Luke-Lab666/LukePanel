package server

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

type FilePreferenceEntry struct {
	Path         string    `json:"path"`
	Name         string    `json:"name"`
	IsDir        bool      `json:"is_dir"`
	LastAccess   time.Time `json:"last_access,omitempty"`
	LastModify   time.Time `json:"last_modify,omitempty"`
	LastDownload time.Time `json:"last_download,omitempty"`
}

type filePreferencesData struct {
	Favorites []FilePreferenceEntry `json:"favorites"`
	Recent    []FilePreferenceEntry `json:"recent"`
}

type FilePreferenceStore struct {
	mu   sync.Mutex
	path string
	data filePreferencesData
}

func NewFilePreferenceStore(dataDir string) *FilePreferenceStore {
	store := &FilePreferenceStore{path: filepath.Join(dataDir, "file-preferences.json")}
	_ = store.load()
	return store
}
func (s *FilePreferenceStore) load() error {
	data, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	return json.Unmarshal(data, &s.data)
}

func (s *FilePreferenceStore) Reload() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data = filePreferencesData{}
	data, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	return json.Unmarshal(data, &s.data)
}
func (s *FilePreferenceStore) saveLocked() error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0o750); err != nil {
		return err
	}
	data, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(s.path), ".prefs-*.tmp")
	if err != nil {
		return err
	}
	name := tmp.Name()
	defer os.Remove(name)
	_ = tmp.Chmod(0o600)
	if _, err := tmp.Write(append(data, '\n')); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(name, s.path)
}
func (s *FilePreferenceStore) Snapshot() filePreferencesData {
	s.mu.Lock()
	defer s.mu.Unlock()
	return filePreferencesData{Favorites: append([]FilePreferenceEntry{}, s.data.Favorites...), Recent: append([]FilePreferenceEntry{}, s.data.Recent...)}
}
func (s *FilePreferenceStore) Favorite(entry FilePreferenceEntry, enabled bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	entry.Path = filepath.Clean(entry.Path)
	entry.Name = filepath.Base(entry.Path)
	next := s.data.Favorites[:0]
	found := false
	for _, item := range s.data.Favorites {
		if item.Path == entry.Path {
			found = true
			if enabled {
				next = append(next, entry)
			}
			continue
		}
		next = append(next, item)
	}
	if enabled && !found {
		next = append(next, entry)
	}
	sort.Slice(next, func(i, j int) bool { return strings.ToLower(next[i].Name) < strings.ToLower(next[j].Name) })
	if len(next) > 100 {
		next = next[:100]
	}
	s.data.Favorites = next
	return s.saveLocked()
}
func (s *FilePreferenceStore) Touch(entry FilePreferenceEntry, kind string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	entry.Path = filepath.Clean(entry.Path)
	entry.Name = filepath.Base(entry.Path)
	now := time.Now().UTC()
	entry.LastAccess = now
	if kind == "modify" {
		entry.LastModify = now
	}
	if kind == "download" {
		entry.LastDownload = now
	}
	next := []FilePreferenceEntry{entry}
	for _, item := range s.data.Recent {
		if item.Path == entry.Path {
			if item.LastModify.After(entry.LastModify) {
				next[0].LastModify = item.LastModify
			}
			if item.LastDownload.After(entry.LastDownload) {
				next[0].LastDownload = item.LastDownload
			}
			continue
		}
		next = append(next, item)
		if len(next) >= 50 {
			break
		}
	}
	s.data.Recent = next
	return s.saveLocked()
}
