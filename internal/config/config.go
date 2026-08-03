package config

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/url"
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
	WebAuthnOrigin     string                   `json:"webauthn_origin,omitempty"`
	WebAuthnRPID       string                   `json:"webauthn_rp_id,omitempty"`
	AllowedRoots       []string                 `json:"allowed_roots"`
	AutoRefreshSeconds int                      `json:"auto_refresh_seconds"`
	TOTPSecret         string                   `json:"totp_secret,omitempty"`
	RecoveryCodeHashes []string                 `json:"recovery_code_hashes,omitempty"`
	Passkeys           []auth.PasskeyCredential `json:"passkeys,omitempty"`
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

// Clone returns a mutation-safe copy of Config. Config contains slices, so a plain
// struct assignment can otherwise share backing arrays and leak partial changes
// into the live configuration when persistence fails.
func (c Config) Clone() Config {
	clone := c
	clone.AllowedRoots = append([]string(nil), c.AllowedRoots...)
	clone.RecoveryCodeHashes = append([]string(nil), c.RecoveryCodeHashes...)
	clone.Passkeys = append([]auth.PasskeyCredential(nil), c.Passkeys...)
	clone.IPAllowlist = append([]string(nil), c.IPAllowlist...)
	return clone
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
		legacyFields := map[string]json.RawMessage{}
		_ = json.Unmarshal(raw, &legacyFields)
		_, hadLegacyTrustedDevices := legacyFields["trusted_devices"]
		changed := hadLegacyTrustedDevices
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
		// The file manager no longer uses a configurable root allowlist. Existing installations
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
	origin := strings.TrimSpace(c.WebAuthnOrigin)
	rpID := strings.TrimSpace(c.WebAuthnRPID)
	if (origin == "") != (rpID == "") {
		return errors.New("webauthn_origin and webauthn_rp_id must be configured together")
	}
	if origin != "" {
		if origin != c.WebAuthnOrigin || rpID != c.WebAuthnRPID {
			return errors.New("WebAuthn origin and RP ID must not contain surrounding whitespace")
		}
		parsed, err := url.Parse(origin)
		if err != nil || parsed.Host == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" || (parsed.Path != "" && parsed.Path != "/") {
			return errors.New("webauthn_origin must be an origin without path, query, fragment or credentials")
		}
		host := strings.ToLower(parsed.Hostname())
		if host == "" || !strings.EqualFold(host, rpID) {
			return errors.New("webauthn_rp_id must match the WebAuthn origin hostname")
		}
		loopback := host == "localhost"
		if ip := net.ParseIP(host); ip != nil && ip.IsLoopback() {
			loopback = true
		}
		if parsed.Scheme != "https" && !(parsed.Scheme == "http" && loopback) {
			return errors.New("WebAuthn requires HTTPS except on loopback hosts")
		}
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
