package server

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type testTarEntry struct {
	name     string
	content  string
	typeflag byte
	linkname string
}

func makeBackupArchive(t *testing.T, entries ...testTarEntry) []byte {
	t.Helper()
	var buffer bytes.Buffer
	gz := gzip.NewWriter(&buffer)
	tw := tar.NewWriter(gz)
	for _, entry := range entries {
		typeflag := entry.typeflag
		if typeflag == 0 {
			typeflag = tar.TypeReg
		}
		header := &tar.Header{Name: entry.name, Mode: 0o600, Typeflag: typeflag, Linkname: entry.linkname}
		if typeflag == tar.TypeReg {
			header.Size = int64(len(entry.content))
		}
		if err := tw.WriteHeader(header); err != nil {
			t.Fatal(err)
		}
		if header.Size > 0 {
			if _, err := tw.Write([]byte(entry.content)); err != nil {
				t.Fatal(err)
			}
		}
	}
	if err := tw.Close(); err != nil {
		t.Fatal(err)
	}
	if err := gz.Close(); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes()
}

func TestExtractPanelBackupArchive(t *testing.T) {
	archive := makeBackupArchive(t,
		testTarEntry{name: "manifest.json", content: `{"format":2}`},
		testTarEntry{name: "panel/config.json", content: `{"admin_user":"admin"}`},
		testTarEntry{name: "data/file-preferences.json", content: `{"favorites":[]}`},
		testTarEntry{name: "ignored/other.txt", content: "ignored"},
	)
	destination := t.TempDir()
	files, total, err := extractPanelBackupArchive(bytes.NewReader(archive), destination)
	if err != nil {
		t.Fatal(err)
	}
	if files != 3 || total == 0 {
		t.Fatalf("files=%d total=%d", files, total)
	}
	data, err := os.ReadFile(filepath.Join(destination, "data", "file-preferences.json"))
	if err != nil || !strings.Contains(string(data), "favorites") {
		t.Fatalf("restored preference = %q, err=%v", data, err)
	}
	if _, err := os.Stat(filepath.Join(destination, "ignored", "other.txt")); !os.IsNotExist(err) {
		t.Fatal("unknown archive paths must be ignored")
	}
}

func TestExtractPanelBackupRejectsTraversalAndLinks(t *testing.T) {
	for name, archive := range map[string][]byte{
		"traversal": makeBackupArchive(t, testTarEntry{name: "../config.json", content: "bad"}),
		"symlink":   makeBackupArchive(t, testTarEntry{name: "data/snapshots/link", typeflag: tar.TypeSymlink, linkname: "/etc/passwd"}),
	} {
		t.Run(name, func(t *testing.T) {
			if _, _, err := extractPanelBackupArchive(bytes.NewReader(archive), t.TempDir()); err == nil {
				t.Fatal("expected unsafe archive to be rejected")
			}
		})
	}
}

func TestInstallRestoredDataRollbackAndCommit(t *testing.T) {
	makeTree := func(t *testing.T) (string, string) {
		t.Helper()
		root := t.TempDir()
		data := filepath.Join(root, "data")
		staged := filepath.Join(root, "staged")
		if err := os.MkdirAll(data, 0o750); err != nil {
			t.Fatal(err)
		}
		if err := os.MkdirAll(staged, 0o750); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(data, "file-preferences.json"), []byte("old"), 0o600); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(staged, "file-preferences.json"), []byte("new"), 0o600); err != nil {
			t.Fatal(err)
		}
		return data, staged
	}

	t.Run("rollback", func(t *testing.T) {
		data, staged := makeTree(t)
		_, rollback, err := installRestoredData(staged, data)
		if err != nil {
			t.Fatal(err)
		}
		if content, _ := os.ReadFile(filepath.Join(data, "file-preferences.json")); string(content) != "new" {
			t.Fatalf("installed content=%q", content)
		}
		if err := rollback(); err != nil {
			t.Fatal(err)
		}
		if content, _ := os.ReadFile(filepath.Join(data, "file-preferences.json")); string(content) != "old" {
			t.Fatalf("rolled back content=%q", content)
		}
	})

	t.Run("commit", func(t *testing.T) {
		data, staged := makeTree(t)
		commit, _, err := installRestoredData(staged, data)
		if err != nil {
			t.Fatal(err)
		}
		if err := commit(); err != nil {
			t.Fatal(err)
		}
		if content, _ := os.ReadFile(filepath.Join(data, "file-preferences.json")); string(content) != "new" {
			t.Fatalf("committed content=%q", content)
		}
	})
}

func TestCreateScheduledPanelBackupAndRetention(t *testing.T) {
	root := t.TempDir()
	configPath := filepath.Join(root, "etc", "config.json")
	dataDir := filepath.Join(root, "data")
	backupDir := filepath.Join(root, "scheduled")
	if err := os.MkdirAll(filepath.Dir(configPath), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(dataDir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(configPath, []byte(`{"test":true}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dataDir, "audit.jsonl"), []byte("{}\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	path, err := CreateScheduledPanelBackup(configPath, dataDir, "test", backupDir, 2)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"lukepanel-scheduled-20000101-000000.tar.gz", "lukepanel-scheduled-20000102-000000.tar.gz"} {
		if err := os.WriteFile(filepath.Join(backupDir, name), []byte("old"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	if err := pruneScheduledBackups(backupDir, 2); err != nil {
		t.Fatal(err)
	}
	entries, err := os.ReadDir(backupDir)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 2 {
		t.Fatalf("expected 2 retained backups, got %d", len(entries))
	}
	if _, err := CreateScheduledPanelBackup(configPath, dataDir, "test", filepath.Join(dataDir, "backups", "nested"), 2); err == nil {
		t.Fatal("expected backup directory inside data directory to be rejected")
	}
}
