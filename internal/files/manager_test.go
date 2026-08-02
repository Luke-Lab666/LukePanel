package files

import (
	"archive/zip"
	"bytes"
	"os"
	"path/filepath"
	"strings"
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

func TestManagerAllowsSensitiveFilesForElevatedCaller(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "server.key")
	if err := os.WriteFile(path, []byte("secret"), 0o600); err != nil {
		t.Fatal(err)
	}
	m, err := NewManager([]string{root}, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	content, err := m.Read(path)
	if err != nil || content.Content != "secret" {
		t.Fatalf("read sensitive file: content=%q err=%v", content.Content, err)
	}
	if err := m.Write(path, "new"); err != nil {
		t.Fatal(err)
	}
	if got, err := os.ReadFile(path); err != nil || string(got) != "new" {
		t.Fatalf("write sensitive file: content=%q err=%v", got, err)
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

func TestSaveUploadRelativePreservesFoldersAndRejectsTraversal(t *testing.T) {
	root := t.TempDir()
	m, err := NewManager([]string{root}, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	path, err := m.SaveUploadRelative(root, "project/config/app.yaml", strings.NewReader("ok\n"), 1024, false)
	if err != nil {
		t.Fatal(err)
	}
	if want := filepath.Join(root, "project", "config", "app.yaml"); path != want {
		t.Fatalf("path = %q, want %q", path, want)
	}
	if content, err := os.ReadFile(path); err != nil || string(content) != "ok\n" {
		t.Fatalf("content=%q err=%v", content, err)
	}
	if _, err := m.SaveUploadRelative(root, "../escape.txt", strings.NewReader("bad"), 1024, false); err == nil {
		t.Fatal("expected traversal to be rejected")
	}
}

func TestExtractZIPRejectsTraversal(t *testing.T) {
	root := t.TempDir()
	m, err := NewManager([]string{root}, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	var archive bytes.Buffer
	writer := zip.NewWriter(&archive)
	file, err := writer.Create("../escape.txt")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = file.Write([]byte("bad"))
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	if _, err := m.ExtractZIP(root, bytes.NewReader(archive.Bytes()), false); err == nil {
		t.Fatal("expected zip traversal to be rejected")
	}
}

func TestExtractZIPCreatesNestedFiles(t *testing.T) {
	root := t.TempDir()
	m, err := NewManager([]string{root}, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	var archive bytes.Buffer
	writer := zip.NewWriter(&archive)
	file, err := writer.Create("folder/readme.txt")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = file.Write([]byte("hello"))
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	result, err := m.ExtractZIP(root, bytes.NewReader(archive.Bytes()), false)
	if err != nil {
		t.Fatal(err)
	}
	if result.Files != 1 {
		t.Fatalf("files = %d", result.Files)
	}
	content, err := os.ReadFile(filepath.Join(root, "folder", "readme.txt"))
	if err != nil || string(content) != "hello" {
		t.Fatalf("content=%q err=%v", content, err)
	}
}

func TestRootManagerListsRealFilesystem(t *testing.T) {
	m, err := NewManager([]string{"/"}, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	listing, err := m.List("/")
	if err != nil {
		t.Fatal(err)
	}
	if listing.Virtual {
		t.Fatal("root manager must list the real filesystem, not a virtual roots page")
	}
	if listing.Path != "/" || listing.Parent != "" || len(listing.Entries) == 0 {
		t.Fatalf("unexpected root listing: %#v", listing)
	}
}

func TestVirtualFilesystemRejectsWrites(t *testing.T) {
	m, err := NewManager([]string{"/"}, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := m.CreateFile("/proc/lukepanel-test"); err == nil {
		t.Fatal("expected /proc write to be rejected")
	}
	if err := m.Mkdir("/sys/lukepanel-test"); err == nil {
		t.Fatal("expected /sys write to be rejected")
	}
}
func TestSensitivePathClassification(t *testing.T) {
	for _, path := range []string{
		"/etc/shadow",
		"/etc/lukepanel/config.json",
		"/root/.ssh/custom-private-key",
		"/etc/ssl/private/server.key",
	} {
		if !IsSensitivePath(path) {
			t.Fatalf("expected sensitive path: %s", path)
		}
	}
	if IsSensitivePath("/root/.ssh-public/readme.txt") {
		t.Fatal("unrelated path must not be classified as sensitive")
	}
}
