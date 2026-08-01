package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/Luke-Lab666/LukePanel/internal/auth"
)

func TestLoadOrCreateMigratesAgentSettings(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.json")
	hash, err := auth.HashPassword("a-secure-test-password")
	if err != nil {
		t.Fatal(err)
	}
	legacy := map[string]any{
		"listen": "127.0.0.1:6767", "data_dir": filepath.Join(dir, "data"), "admin_user": "admin",
		"password_hash": hash, "session_secret": "existing-session-secret", "secure_cookie": false,
		"allowed_roots": []string{dir},
	}
	raw, _ := json.Marshal(legacy)
	if err := os.WriteFile(path, raw, 0o600); err != nil {
		t.Fatal(err)
	}
	cfg, password, err := LoadOrCreate(path)
	if err != nil {
		t.Fatal(err)
	}
	if password != "" {
		t.Fatal("migration must not generate a new admin password")
	}
	if cfg.AgentSecret == "" || cfg.AgentSocket == "" {
		t.Fatal("agent settings were not migrated")
	}
	if cfg.AutoRefreshSeconds != 5 {
		t.Fatalf("unexpected refresh interval %d", cfg.AutoRefreshSeconds)
	}
}
