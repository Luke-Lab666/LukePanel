package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strings"
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

func TestExistingRootsMigrateToFullFilesystem(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.json")
	cfg := Default()
	cfg.AllowedRoots = []string{"/custom/restricted/path"}
	cfg.PasswordHash, _ = auth.HashPassword("example-password")
	cfg.SessionSecret = "session-secret"
	cfg.AgentSecret = "agent-secret"
	if err := Save(path, cfg); err != nil {
		t.Fatal(err)
	}
	loaded, _, err := LoadOrCreate(path)
	if err != nil {
		t.Fatal(err)
	}
	want := Default().AllowedRoots
	if !reflect.DeepEqual(loaded.AllowedRoots, want) {
		t.Fatalf("allowed roots = %#v, want %#v", loaded.AllowedRoots, want)
	}
}

func TestValidateRejectsUnsafeAdminUsername(t *testing.T) {
	cfg := Default()
	cfg.AdminUser = "../root"
	cfg.PasswordHash, _ = auth.HashPassword("valid-long-password-2026")
	cfg.SessionSecret = "session-secret"
	cfg.AgentSecret = "agent-secret"
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected unsafe admin username to be rejected")
	}
}

func TestLoadOrCreateWithOptionsInitializesCustomAccountAndPort(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.json")
	cfg, password, err := LoadOrCreateWithOptions(path, InitOptions{
		AdminUser: "LukeAdmin",
		Password:  "Strong-Install-Password-2026!",
		Listen:    "127.0.0.1:7788",
		DataDir:   filepath.Join(dir, "data"),
	})
	if err != nil {
		t.Fatal(err)
	}
	if cfg.AdminUser != "LukeAdmin" || cfg.Listen != "127.0.0.1:7788" {
		t.Fatalf("unexpected initialized config: %#v", cfg)
	}
	if password != "Strong-Install-Password-2026!" {
		t.Fatalf("returned password = %q", password)
	}
	ok, err := auth.VerifyPassword(password, cfg.PasswordHash)
	if err != nil || !ok {
		t.Fatalf("custom password was not stored: ok=%v err=%v", ok, err)
	}

	loaded, returned, err := LoadOrCreateWithOptions(path, InitOptions{
		AdminUser: "IgnoredUser",
		Password:  "Another-Strong-Password-2026!",
		Listen:    "127.0.0.1:9999",
	})
	if err != nil {
		t.Fatal(err)
	}
	if returned != "" || loaded.AdminUser != "LukeAdmin" || loaded.Listen != "127.0.0.1:7788" {
		t.Fatalf("existing configuration was unexpectedly replaced: %#v password=%q", loaded, returned)
	}
}

func TestLoadOrCreateRemovesLegacyTrustedDevices(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.json")
	cfg := Default()
	cfg.DataDir = filepath.Join(dir, "data")
	cfg.PasswordHash, _ = auth.HashPassword("valid-long-password-2026")
	cfg.SessionSecret = "session-secret"
	cfg.AgentSecret = "agent-secret"
	raw, err := json.Marshal(cfg)
	if err != nil {
		t.Fatal(err)
	}
	var document map[string]any
	if err := json.Unmarshal(raw, &document); err != nil {
		t.Fatal(err)
	}
	document["trusted_devices"] = []map[string]any{{"id": "legacy", "token_hash": "obsolete"}}
	raw, _ = json.Marshal(document)
	if err := os.WriteFile(path, raw, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, _, err := LoadOrCreate(path); err != nil {
		t.Fatal(err)
	}
	migrated, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(migrated), "trusted_devices") {
		t.Fatalf("legacy trusted_devices survived migration: %s", migrated)
	}
}

func TestCloneDoesNotAliasSliceFields(t *testing.T) {
	cfg := Default()
	cfg.RecoveryCodeHashes = []string{"recovery-a"}
	cfg.Passkeys = []auth.PasskeyCredential{{ID: "passkey-a", Name: "Phone"}}
	cfg.IPAllowlist = []string{"192.0.2.1"}

	clone := cfg.Clone()
	clone.AllowedRoots[0] = "/tmp"
	clone.RecoveryCodeHashes[0] = "recovery-b"
	clone.Passkeys[0].Name = "Laptop"
	clone.IPAllowlist[0] = "198.51.100.1"

	if cfg.AllowedRoots[0] != "/" || cfg.RecoveryCodeHashes[0] != "recovery-a" || cfg.Passkeys[0].Name != "Phone" || cfg.IPAllowlist[0] != "192.0.2.1" {
		t.Fatalf("Clone mutated original config: %#v", cfg)
	}
}
