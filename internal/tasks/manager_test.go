package tasks

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestValidateAndCalendar(t *testing.T) {
	task := CreateRequest{Name: "Restart mosDNS", Type: "service-restart", Target: "mosdns.service", Frequency: "weekly", Hour: 4, Minute: 15, Weekday: 1}
	if err := validateRequest(&task); err != nil {
		t.Fatal(err)
	}
	got := onCalendar(Task{Frequency: task.Frequency, Hour: task.Hour, Minute: task.Minute, Weekday: task.Weekday})
	if got != "Mon *-*-* 04:15:00" {
		t.Fatalf("calendar = %q", got)
	}
}

func TestRenderServiceTaskNeverUsesShell(t *testing.T) {
	service, timer, err := renderUnits(Task{ID: "123", Name: "Restart nginx", Type: "service-restart", Target: "nginx.service", Frequency: "daily", Hour: 3, Minute: 5})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(service, "sh -c") || !strings.Contains(service, `ExecStart="/usr/bin/systemctl" "restart" "nginx.service"`) {
		t.Fatalf("unexpected service unit:\n%s", service)
	}
	if !strings.Contains(timer, "OnCalendar=*-*-* 03:05:00") {
		t.Fatalf("unexpected timer unit:\n%s", timer)
	}
}

func TestRejectUnsafeTarget(t *testing.T) {
	req := CreateRequest{Name: "bad", Type: "service-restart", Target: "nginx.service; reboot", Frequency: "daily", Hour: 1, Minute: 0}
	if err := validateRequest(&req); err == nil {
		t.Fatal("expected unsafe target to be rejected")
	}
}

func TestCreateRollsBackWhenEnableFails(t *testing.T) {
	root := t.TempDir()
	binDir := filepath.Join(root, "bin")
	if err := os.MkdirAll(binDir, 0o755); err != nil {
		t.Fatal(err)
	}
	fake := filepath.Join(binDir, "systemctl")
	if err := os.WriteFile(fake, []byte("#!/bin/sh\n[ \"$1\" = enable ] && exit 1\nexit 0\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", binDir+":"+os.Getenv("PATH"))
	manager := &Manager{dataDir: filepath.Join(root, "data"), unitDir: filepath.Join(root, "units")}
	_, err := manager.Create(context.Background(), CreateRequest{
		Name: "Restart nginx", Type: "service-restart", Target: "nginx.service",
		Frequency: "daily", Hour: 3, Minute: 0,
	})
	if err == nil {
		t.Fatal("expected enable failure")
	}
	for _, dir := range []string{manager.dataDir, manager.unitDir} {
		entries, readErr := os.ReadDir(dir)
		if readErr != nil && !os.IsNotExist(readErr) {
			t.Fatal(readErr)
		}
		if len(entries) != 0 {
			t.Fatalf("rollback left files in %s: %v", dir, entries)
		}
	}
}
