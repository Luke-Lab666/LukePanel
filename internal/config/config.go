package config

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"syscall"

	"github.com/Luke-Lab666/LukePanel/internal/auth"
)

type Config struct {
	Listen             string   `json:"listen"`
	DataDir            string   `json:"data_dir"`
	AdminUser          string   `json:"admin_user"`
	PasswordHash       string   `json:"password_hash"`
	SessionSecret      string   `json:"session_secret"`
	AgentSecret        string   `json:"agent_secret"`
	AgentSocket        string   `json:"agent_socket"`
	TrustedProxy       string   `json:"trusted_proxy"`
	SecureCookie       bool     `json:"secure_cookie"`
	AllowedRoots       []string `json:"allowed_roots"`
	AutoRefreshSeconds int      `json:"auto_refresh_seconds"`
}

func Default() Config {
	return Config{
		Listen:             "127.0.0.1:6767",
		DataDir:            "/var/lib/lukepanel",
		AdminUser:          "admin",
		AgentSocket:        "/run/lukepanel/agent.sock",
		SecureCookie:       true,
		AllowedRoots:       []string{"/home", "/root", "/opt", "/srv", "/var/www", "/etc", "/usr/local"},
		AutoRefreshSeconds: 5,
	}
}

func LoadOrCreate(path string) (Config, string, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return Config{}, "", fmt.Errorf("create config dir: %w", err)
	}
	lock, err := os.OpenFile(path+".lock", os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return Config{}, "", fmt.Errorf("open config lock: %w", err)
	}
	defer lock.Close()
	if err := syscall.Flock(int(lock.Fd()), syscall.LOCK_EX); err != nil {
		return Config{}, "", fmt.Errorf("lock config: %w", err)
	}
	defer syscall.Flock(int(lock.Fd()), syscall.LOCK_UN)

	cfg := Default()
	if raw, err := os.ReadFile(path); err == nil {
		if err := json.Unmarshal(raw, &cfg); err != nil {
			return Config{}, "", fmt.Errorf("parse config: %w", err)
		}
		changed := false
		if cfg.AgentSocket == "" {
			cfg.AgentSocket = Default().AgentSocket
			changed = true
		}
		if cfg.AgentSecret == "" {
			secret, err := randomString(48)
			if err != nil {
				return Config{}, "", err
			}
			cfg.AgentSecret = secret
			changed = true
		}
		if cfg.AutoRefreshSeconds == 0 {
			cfg.AutoRefreshSeconds = Default().AutoRefreshSeconds
			changed = true
		}
		// v0.1/v0.2 used the original default roots. Extend only that known
		// default set so custom administrator policies are never silently widened.
		if legacyDefaultRoots(cfg.AllowedRoots) {
			cfg.AllowedRoots = Default().AllowedRoots
			changed = true
		}
		if err := cfg.Validate(); err != nil {
			return Config{}, "", err
		}
		if changed {
			if err := Save(path, cfg); err != nil {
				return Config{}, "", fmt.Errorf("migrate config: %w", err)
			}
		}
		return cfg, "", nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return Config{}, "", fmt.Errorf("read config: %w", err)
	}

	password, err := randomString(18)
	if err != nil {
		return Config{}, "", err
	}
	cfg.PasswordHash, err = auth.HashPassword(password)
	if err != nil {
		return Config{}, "", err
	}
	cfg.SessionSecret, err = randomString(48)
	if err != nil {
		return Config{}, "", err
	}
	cfg.AgentSecret, err = randomString(48)
	if err != nil {
		return Config{}, "", err
	}
	if err := os.MkdirAll(cfg.DataDir, 0o750); err != nil {
		return Config{}, "", fmt.Errorf("create data dir: %w", err)
	}
	if err := Save(path, cfg); err != nil {
		return Config{}, "", err
	}
	return cfg, password, nil
}

func Save(path string, cfg Config) error {
	if err := cfg.Validate(); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(&cfg, "", "  ")
	if err != nil {
		return err
	}
	raw = append(raw, '\n')
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return err
	}
	temp, err := os.CreateTemp(filepath.Dir(path), ".config-*.tmp")
	if err != nil {
		return fmt.Errorf("create temporary config: %w", err)
	}
	tempName := temp.Name()
	defer os.Remove(tempName)
	if err := temp.Chmod(0o600); err != nil {
		temp.Close()
		return err
	}
	if _, err := temp.Write(raw); err != nil {
		temp.Close()
		return err
	}
	if err := temp.Sync(); err != nil {
		temp.Close()
		return err
	}
	if err := temp.Close(); err != nil {
		return err
	}
	if err := os.Rename(tempName, path); err != nil {
		return fmt.Errorf("replace config: %w", err)
	}
	return nil
}

func (c Config) Validate() error {
	if c.Listen == "" || c.DataDir == "" || c.AdminUser == "" || c.PasswordHash == "" || c.SessionSecret == "" || c.AgentSecret == "" || c.AgentSocket == "" {
		return errors.New("config contains empty required fields")
	}
	if len(c.AllowedRoots) == 0 {
		return errors.New("allowed_roots must not be empty")
	}
	if c.AutoRefreshSeconds < 2 || c.AutoRefreshSeconds > 300 {
		return errors.New("auto_refresh_seconds must be between 2 and 300")
	}
	return nil
}

func legacyDefaultRoots(roots []string) bool {
	legacy := []string{"/home", "/opt", "/srv", "/var/www", "/etc"}
	if len(roots) != len(legacy) {
		return false
	}
	for i := range legacy {
		if filepath.Clean(roots[i]) != legacy[i] {
			return false
		}
	}
	return true
}

func randomString(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
