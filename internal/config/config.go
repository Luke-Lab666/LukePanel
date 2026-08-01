package config

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/Luke-Lab666/LukePanel/internal/auth"
)

type Config struct {
	Listen        string   `json:"listen"`
	DataDir       string   `json:"data_dir"`
	AdminUser     string   `json:"admin_user"`
	PasswordHash  string   `json:"password_hash"`
	SessionSecret string   `json:"session_secret"`
	TrustedProxy  string   `json:"trusted_proxy"`
	SecureCookie  bool     `json:"secure_cookie"`
	AllowedRoots  []string `json:"allowed_roots"`
}

func Default() Config {
	return Config{
		Listen:       "127.0.0.1:6767",
		DataDir:      "/var/lib/lukepanel",
		AdminUser:    "admin",
		SecureCookie: true,
		AllowedRoots: []string{"/home", "/opt", "/srv", "/var/www", "/etc"},
	}
}

func LoadOrCreate(path string) (Config, string, error) {
	cfg := Default()
	if raw, err := os.ReadFile(path); err == nil {
		if err := json.Unmarshal(raw, &cfg); err != nil {
			return Config{}, "", fmt.Errorf("parse config: %w", err)
		}
		if err := cfg.Validate(); err != nil {
			return Config{}, "", err
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
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return Config{}, "", fmt.Errorf("create config dir: %w", err)
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
	if c.Listen == "" || c.DataDir == "" || c.AdminUser == "" || c.PasswordHash == "" || c.SessionSecret == "" {
		return errors.New("config contains empty required fields")
	}
	if len(c.AllowedRoots) == 0 {
		return errors.New("allowed_roots must not be empty")
	}
	return nil
}

func randomString(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
