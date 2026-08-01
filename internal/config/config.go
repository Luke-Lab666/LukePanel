package config

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/Luke-Lab666/LukePanel/internal/auth"
)

type InitOptions struct {
	AdminUser string
	Password  string
	Listen    string
	DataDir   string
}

type TrustedDevice struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	TokenHash string    `json:"token_hash"`
	CreatedAt time.Time `json:"created_at"`
	LastUsed  time.Time `json:"last_used"`
	LastIP    string    `json:"last_ip,omitempty"`
}

var adminUserPattern = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_.-]{2,31}$`)

type Config struct {
	Listen             string                   `json:"listen"`
	DataDir            string                   `json:"data_dir"`
	AdminUser          string                   `json:"admin_user"`
	PasswordHash       string                   `json:"password_hash"`
	SessionSecret      string                   `json:"session_secret"`
	AgentSecret        string                   `json:"agent_secret"`
	AgentSocket        string                   `json:"agent_socket"`
	TrustedProxy       string                   `json:"trusted_proxy"`
	SecureCookie       bool                     `json:"secure_cookie"`
	AllowedRoots       []string                 `json:"allowed_roots"`
	AutoRefreshSeconds int                      `json:"auto_refresh_seconds"`
	TOTPSecret         string                   `json:"totp_secret,omitempty"`
	RecoveryCodeHashes []string                 `json:"recovery_code_hashes,omitempty"`
	Passkeys           []auth.PasskeyCredential `json:"passkeys,omitempty"`
	TrustedDevices     []TrustedDevice          `json:"trusted_devices,omitempty"`
	IPAllowlistEnabled bool                     `json:"ip_allowlist_enabled,omitempty"`
	IPAllowlist        []string                 `json:"ip_allowlist,omitempty"`
	IPRecoveryHash     string                   `json:"ip_recovery_hash,omitempty"`
	IPRecoveryExpires  time.Time                `json:"ip_recovery_expires,omitempty"`
	LoginNotifyEnabled bool                     `json:"login_notify_enabled,omitempty"`
	TelegramBotToken   string                   `json:"telegram_bot_token,omitempty"`
	TelegramChatID     string                   `json:"telegram_chat_id,omitempty"`
}

func Default() Config {
	return Config{
		Listen:             "127.0.0.1:6767",
		DataDir:            "/var/lib/lukepanel",
		AdminUser:          "admin",
		AgentSocket:        "/run/lukepanel/agent.sock",
		SecureCookie:       true,
		AllowedRoots:       []string{"/"},
		AutoRefreshSeconds: 5,
	}
}

func LoadOrCreate(path string) (Config, string, error) {
	return LoadOrCreateWithOptions(path, InitOptions{})
}

func LoadOrCreateWithOptions(path string, options InitOptions) (Config, string, error) {
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
		// v0.9.6 removes the file-manager root allowlist. Existing installations
		// are migrated to the real filesystem root while sensitive reads remain
		// protected by secondary authentication.
		if len(cfg.AllowedRoots) != 1 || filepath.Clean(cfg.AllowedRoots[0]) != "/" {
			cfg.AllowedRoots = []string{"/"}
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

	if value := strings.TrimSpace(options.AdminUser); value != "" {
		cfg.AdminUser = value
	}
	if value := strings.TrimSpace(options.Listen); value != "" {
		cfg.Listen = value
	}
	if value := strings.TrimSpace(options.DataDir); value != "" {
		cfg.DataDir = value
	}
	password := options.Password
	if password == "" {
		password, err = randomString(18)
		if err != nil {
			return Config{}, "", err
		}
	}
	if err := auth.ValidatePasswordStrength(password, cfg.AdminUser); err != nil {
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
	if !adminUserPattern.MatchString(c.AdminUser) {
		return errors.New("admin_user must start with a letter and contain 3-32 letters, digits, dots, underscores or hyphens")
	}
	host, port, err := net.SplitHostPort(c.Listen)
	if err != nil || strings.TrimSpace(host) == "" && !strings.HasPrefix(c.Listen, ":") {
		return errors.New("listen must be a valid host:port address")
	}
	if parsed, err := strconv.Atoi(port); err != nil || parsed < 1 || parsed > 65535 {
		return errors.New("listen port must be between 1 and 65535")
	}
	if len(c.AllowedRoots) == 0 {
		return errors.New("allowed_roots must not be empty")
	}
	if c.AutoRefreshSeconds < 2 || c.AutoRefreshSeconds > 300 {
		return errors.New("auto_refresh_seconds must be between 2 and 300")
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
