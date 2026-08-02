package files

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestBackupDiffAndRestore(t *testing.T) {
	root := t.TempDir()
	data := t.TempDir()
	path := filepath.Join(root, "config.yaml")
	if err := os.WriteFile(path, []byte("enabled: false\nport: 80\n"), 0o640); err != nil {
		t.Fatal(err)
	}
	manager, err := NewManager([]string{root}, data)
	if err != nil {
		t.Fatal(err)
	}
	if err := manager.Write(path, "enabled: true\nport: 8080\n"); err != nil {
		t.Fatal(err)
	}
	versions, err := manager.ListBackups(path)
	if err != nil {
		t.Fatal(err)
	}
	if len(versions) != 1 {
		t.Fatalf("expected one backup, got %d", len(versions))
	}
	diff, err := manager.BackupDiff(path, versions[0].ID)
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"-enabled: false", "+enabled: true", "-port: 80", "+port: 8080"} {
		if !strings.Contains(diff.Diff, want) {
			t.Fatalf("diff missing %q:\n%s", want, diff.Diff)
		}
	}
	if err := manager.RestoreBackup(path, versions[0].ID); err != nil {
		t.Fatal(err)
	}
	restored, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := string(restored), "enabled: false\nport: 80\n"; got != want {
		t.Fatalf("restored content = %q, want %q", got, want)
	}
}
