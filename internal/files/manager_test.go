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

func TestCopyMoveAndRecycle(t *testing.T) {
	root := t.TempDir()
	data := filepath.Join(t.TempDir(), "data")
	m, err := NewManager([]string{root}, data)
	if err != nil {
		t.Fatal(err)
	}
	source := filepath.Join(root, "source.txt")
	if err := os.WriteFile(source, []byte("hello"), 0o640); err != nil {
		t.Fatal(err)
	}
	copyPath := filepath.Join(root, "copy.txt")
	if err := m.Copy(source, copyPath); err != nil {
		t.Fatal(err)
	}
	if b, _ := os.ReadFile(copyPath); string(b) != "hello" {
		t.Fatalf("copy content = %q", b)
	}
	moved := filepath.Join(root, "moved.txt")
	if err := m.Move(copyPath, moved); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(copyPath); !os.IsNotExist(err) {
		t.Fatalf("copy source still exists: %v", err)
	}
	if err := m.Chmod(moved, "600"); err != nil {
		t.Fatal(err)
	}
	if info, _ := os.Stat(moved); info.Mode().Perm() != 0o600 {
		t.Fatalf("mode = %o", info.Mode().Perm())
	}
	if _, err := m.Trash(moved); err != nil {
		t.Fatal(err)
	}
	items, err := m.ListRecycle()
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].OriginalPath != moved {
		t.Fatalf("recycle = %#v", items)
	}
	restored, err := m.RestoreRecycle(items[0].ID, "")
	if err != nil {
		t.Fatal(err)
	}
	if restored != moved {
		t.Fatalf("restored = %q", restored)
	}
	if b, _ := os.ReadFile(moved); string(b) != "hello" {
		t.Fatalf("restored content = %q", b)
	}
}

func TestCopyDirectoryRejectsSelf(t *testing.T) {
	root := t.TempDir()
	m, err := NewManager([]string{root}, filepath.Join(t.TempDir(), "data"))
	if err != nil {
		t.Fatal(err)
	}
	source := filepath.Join(root, "dir")
	if err := os.Mkdir(source, 0o750); err != nil {
		t.Fatal(err)
	}
	if err := m.Copy(source, filepath.Join(source, "child")); err == nil {
		t.Fatal("expected self-copy error")
	}
}

func TestManagerProtectsAllowedRoot(t *testing.T) {
	root := t.TempDir()
	m, err := NewManager([]string{root}, filepath.Join(t.TempDir(), "data"))
	if err != nil {
		t.Fatal(err)
	}
	for name, fn := range map[string]func() error{
		"copy":  func() error { return m.Copy(root, filepath.Join(filepath.Dir(root), "copy")) },
		"move":  func() error { return m.Move(root, filepath.Join(filepath.Dir(root), "move")) },
		"chmod": func() error { return m.Chmod(root, "700") },
		"trash": func() error { _, err := m.Trash(root); return err },
	} {
		if err := fn(); err == nil {
			t.Fatalf("%s should reject the allowed root", name)
		}
	}
}
