package config

import "testing"

func validSecurityTestConfig() Config {
	return Config{
		Listen: "127.0.0.1:6767", DataDir: "/tmp/lukepanel", AdminUser: "admin",
		PasswordHash: "hash", SessionSecret: "session", AgentSecret: "agent",
		AgentSocket: "/tmp/agent.sock", SecureCookie: true, AllowedRoots: []string{"/"},
		AutoRefreshSeconds: 5,
	}
}

func TestWebAuthnOriginValidation(t *testing.T) {
	cfg := validSecurityTestConfig()
	cfg.WebAuthnOrigin = "https://panel.example.com"
	cfg.WebAuthnRPID = "panel.example.com"
	if err := cfg.Validate(); err != nil {
		t.Fatalf("valid WebAuthn origin rejected: %v", err)
	}

	cfg.WebAuthnRPID = "attacker.example.com"
	if err := cfg.Validate(); err == nil {
		t.Fatal("mismatched RP ID was accepted")
	}

	cfg.WebAuthnOrigin = "http://panel.example.com"
	cfg.WebAuthnRPID = "panel.example.com"
	if err := cfg.Validate(); err == nil {
		t.Fatal("insecure non-loopback WebAuthn origin was accepted")
	}
}
