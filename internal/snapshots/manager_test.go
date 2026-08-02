package snapshots

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCreateAndRestore(t *testing.T) {
	root := t.TempDir()
	data := filepath.Join(root, "data")
	config := filepath.Join(root, "config.txt")
	if err := os.WriteFile(config, []byte("before"), 0o640); err != nil {
		t.Fatal(err)
	}
	manager := New(data)
	snapshot, err := manager.Create("test", "测试", "", []string{config})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(config, []byte("after"), 0o640); err != nil {
		t.Fatal(err)
	}
	if _, err := manager.Restore(snapshot.ID); err != nil {
		t.Fatal(err)
	}
	content, _ := os.ReadFile(config)
	if string(content) != "before" {
		t.Fatalf("got %q", content)
	}
	info, err := os.Stat(config)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o640 {
		t.Fatalf("mode=%o", info.Mode().Perm())
	}
	items, err := manager.List()
	if err != nil || len(items) != 1 {
		t.Fatalf("list=%v err=%v", items, err)
	}
}

func TestSnapshotMissingPathRemovesOnRestore(t *testing.T) {
	root := t.TempDir()
	missing := filepath.Join(root, "created-later")
	manager := New(filepath.Join(root, "data"))
	snapshot, err := manager.Create("test", "missing", "", []string{missing})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(missing, []byte("temporary"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := manager.Restore(snapshot.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(missing); !os.IsNotExist(err) {
		t.Fatalf("path still exists: %v", err)
	}
}
