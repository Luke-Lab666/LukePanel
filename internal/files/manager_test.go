package files

import (
	"os"
	"path/filepath"
	"testing"
)

func TestManagerWriteCreatesBackup(t *testing.T) {
	root := t.TempDir()
	data := t.TempDir()
	path := filepath.Join(root, "config.yaml")
	if err := os.WriteFile(path, []byte("old\n"), 0o640); err != nil {
		t.Fatal(err)
	}
	m, err := NewManager([]string{root}, data)
	if err != nil {
		t.Fatal(err)
	}
	if err := m.Write(path, "new\n"); err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(content) != "new\n" {
		t.Fatalf("unexpected content %q", content)
	}
	backups, err := os.ReadDir(filepath.Join(data, "backups", "files"))
	if err != nil {
		t.Fatal(err)
	}
	if len(backups) != 1 {
		t.Fatalf("expected one backup, got %d", len(backups))
	}
}

func TestManagerBlocksPrivateKey(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "server.key")
	if err := os.WriteFile(path, []byte("secret"), 0o600); err != nil {
		t.Fatal(err)
	}
	m, err := NewManager([]string{root}, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := m.Read(path); err == nil {
		t.Fatal("expected sensitive file read to fail")
	}
	if err := m.Write(path, "new"); err == nil {
		t.Fatal("expected sensitive file write to fail")
	}
}

func TestManagerRejectsOutsideRoot(t *testing.T) {
	m, err := NewManager([]string{t.TempDir()}, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := m.List("/etc"); err == nil {
		t.Fatal("expected outside root to fail")
	}
}
