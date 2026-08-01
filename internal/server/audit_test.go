package server

import (
	"os"
	"path/filepath"
	"testing"
)

func TestAuditReadKeepsLatestAndReverses(t *testing.T) {
	log := NewAuditLog(t.TempDir())
	for i := 0; i < 5; i++ {
		log.Write(AuditEvent{Action: string(rune('a' + i)), Result: "success"})
	}
	events, err := log.Read(3)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 3 || events[0].Action != "e" || events[2].Action != "c" {
		t.Fatalf("events = %#v", events)
	}
}

func TestAuditReadsRotatedFiles(t *testing.T) {
	dir := t.TempDir()
	log := NewAuditLog(dir)
	if err := os.WriteFile(filepath.Join(dir, "audit.jsonl.1"), []byte("{\"action\":\"old\",\"result\":\"success\"}\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	log.Write(AuditEvent{Action: "new", Result: "success"})
	events, err := log.Read(10)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 2 || events[0].Action != "new" || events[1].Action != "old" {
		t.Fatalf("events = %#v", events)
	}
}

func TestAuditQueryImmediatelySeesWritesWithSQLite(t *testing.T) {
	log := NewAuditLog(t.TempDir())
	if log.sqlite == "" {
		t.Skip("sqlite3 not available")
	}
	for i := 0; i < 5; i++ {
		log.Write(AuditEvent{Action: string(rune('a' + i)), Result: "success"})
	}
	result, err := log.Query(AuditQuery{Limit: 3})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Events) != 3 || result.Events[0].Action != "e" || result.Events[2].Action != "c" {
		t.Fatalf("events = %#v (indexed=%v)", result.Events, result.Indexed)
	}
}

func TestAuditSQLiteRebuildIncludesLegacyRotatedEvents(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "audit.jsonl.1"), []byte("{\"action\":\"old\",\"result\":\"success\"}\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	log := NewAuditLog(dir)
	if log.sqlite == "" {
		t.Skip("sqlite3 not available")
	}
	result, err := log.Query(AuditQuery{Limit: 10})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Events) != 1 || result.Events[0].Action != "old" {
		t.Fatalf("events = %#v (indexed=%v)", result.Events, result.Indexed)
	}
}
