package server

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Luke-Lab666/LukePanel/internal/auth"
	"github.com/Luke-Lab666/LukePanel/internal/config"
)

const authTestPassword = "StrongPass!123"

func newAuthFlowServer(t *testing.T, recoveryCodes ...string) *Server {
	t.Helper()
	dir := t.TempDir()
	passwordHash, err := auth.HashPassword(authTestPassword)
	if err != nil {
		t.Fatal(err)
	}
	cfg := config.Default()
	cfg.DataDir = filepath.Join(dir, "data")
	cfg.AdminUser = "admin"
	cfg.PasswordHash = passwordHash
	cfg.SessionSecret = "test-session-secret-that-is-long-enough"
	cfg.AgentSecret = "test-agent-secret-that-is-long-enough"
	cfg.AgentSocket = filepath.Join(dir, "agent.sock")
	cfg.SecureCookie = false
	cfg.TOTPSecret = "JBSWY3DPEHPK3PXP"
	for _, code := range recoveryCodes {
		cfg.RecoveryCodeHashes = append(cfg.RecoveryCodeHashes, auth.HashRecoveryCode(code, cfg.SessionSecret))
	}
	configPath := filepath.Join(dir, "config.json")
	if err := config.Save(configPath, cfg); err != nil {
		t.Fatal(err)
	}
	srv, err := New(cfg, configPath, "v2.0.2", "", slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	return srv
}

func authJSONRequest(method, target, body string) *http.Request {
	req := httptest.NewRequest(method, target, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	return req
}

func decodeAuthResponse(t *testing.T, recorder *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var out map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode response: %v; body=%s", err, recorder.Body.String())
	}
	return out
}

func TestPasswordLoginAlwaysRequiresSecondFactorWhenTOTPEnabled(t *testing.T) {
	srv := newAuthFlowServer(t, "ABCD-EFGH-IJKL")
	req := authJSONRequest(http.MethodPost, "/api/v1/auth/login", `{"username":"admin","password":"StrongPass!123"}`)
	// A cookie from an older LukePanel version must never bypass TOTP.
	req.AddCookie(&http.Cookie{Name: "lukepanel_trusted_device", Value: "legacy-token"})
	recorder := httptest.NewRecorder()
	srv.login(recorder, req)
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401; body=%s", recorder.Code, recorder.Body.String())
	}
	if code := decodeAuthResponse(t, recorder)["code"]; code != "totp_required" {
		t.Fatalf("code = %#v, want totp_required", code)
	}
	if len(srv.sessions.List()) != 0 {
		t.Fatal("session was created without a second factor")
	}
}

func TestPasswordLoginAcceptsAndConsumesRecoveryCode(t *testing.T) {
	const recoveryCode = "ABCD-EFGH-IJKL"
	srv := newAuthFlowServer(t, recoveryCode)
	req := authJSONRequest(http.MethodPost, "/api/v1/auth/login", `{"username":"admin","password":"StrongPass!123","otp":"ABCD-EFGH-IJKL"}`)
	recorder := httptest.NewRecorder()
	srv.login(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", recorder.Code, recorder.Body.String())
	}
	body := decodeAuthResponse(t, recorder)
	if body["username"] != "admin" || body["totp_enabled"] != true {
		t.Fatalf("unexpected body: %#v", body)
	}
	srv.configMu.RLock()
	remaining := len(srv.cfg.RecoveryCodeHashes)
	srv.configMu.RUnlock()
	if remaining != 0 {
		t.Fatalf("recovery code was not consumed; remaining=%d", remaining)
	}
	legacyExpired := false
	for _, cookie := range recorder.Result().Cookies() {
		if cookie.Name == "lukepanel_trusted_device" && cookie.MaxAge < 0 {
			legacyExpired = true
		}
	}
	if !legacyExpired {
		t.Fatal("successful login did not expire the legacy trusted-device cookie")
	}
}

func TestPasskeyLoginBeginDoesNotRequireUsername(t *testing.T) {
	srv := newAuthFlowServer(t)
	srv.configMu.Lock()
	srv.cfg.Passkeys = []auth.PasskeyCredential{{ID: "credential-id", Name: "iPhone", CreatedAt: time.Now().UTC()}}
	srv.configMu.Unlock()
	recorder := httptest.NewRecorder()
	srv.passkeyLoginBegin(recorder, authJSONRequest(http.MethodPost, "/api/v1/auth/passkey/login/begin", `{}`))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", recorder.Code, recorder.Body.String())
	}
	body := decodeAuthResponse(t, recorder)
	if body["user_verification"] != "required" {
		t.Fatalf("user_verification = %#v, want required", body["user_verification"])
	}
	if body["flow_id"] == "" {
		t.Fatalf("missing flow_id: %#v", body)
	}
}

func TestElevationRequiresSecondFactorWhenTOTPEnabled(t *testing.T) {
	const recoveryCode = "MNOP-QRST-UVWX"
	srv := newAuthFlowServer(t, recoveryCode)
	session := auth.Session{ID: "session-1", Username: "admin"}

	missing := authJSONRequest(http.MethodPost, "/api/v1/auth/elevate", `{"password":"StrongPass!123"}`)
	missing = missing.WithContext(withSession(missing.Context(), session))
	missingRecorder := httptest.NewRecorder()
	srv.elevate(missingRecorder, missing)
	if missingRecorder.Code != http.StatusUnauthorized || decodeAuthResponse(t, missingRecorder)["code"] != "totp_required" {
		t.Fatalf("missing OTP response = %d %s", missingRecorder.Code, missingRecorder.Body.String())
	}
	if srv.elevationActive(missing) {
		t.Fatal("elevation became active without TOTP")
	}

	valid := authJSONRequest(http.MethodPost, "/api/v1/auth/elevate", `{"password":"StrongPass!123","otp":"MNOP-QRST-UVWX"}`)
	valid = valid.WithContext(withSession(valid.Context(), session))
	validRecorder := httptest.NewRecorder()
	srv.elevate(validRecorder, valid)
	if validRecorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", validRecorder.Code, validRecorder.Body.String())
	}
	if !srv.elevationActive(valid) {
		t.Fatal("elevation was not activated after valid password and recovery code")
	}
}

func TestRequireAuthReturnsMachineReadableSessionCodes(t *testing.T) {
	srv := newAuthFlowServer(t)
	handler := srv.requireAuth(func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	})

	missing := httptest.NewRecorder()
	handler(missing, httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil))
	if missing.Code != http.StatusUnauthorized || decodeAuthResponse(t, missing)["code"] != "session_required" {
		t.Fatalf("missing-session response = %d %s", missing.Code, missing.Body.String())
	}

	expiredRequest := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	expiredRequest.AddCookie(&http.Cookie{Name: "lukepanel_session", Value: "expired-token"})
	expired := httptest.NewRecorder()
	handler(expired, expiredRequest)
	if expired.Code != http.StatusUnauthorized || decodeAuthResponse(t, expired)["code"] != "session_expired" {
		t.Fatalf("expired-session response = %d %s", expired.Code, expired.Body.String())
	}
}

func TestPasswordChangeVerifiesPasswordAndSecondFactorInSingleRequest(t *testing.T) {
	const recoveryCode = "PASS-WORD-OTPX"
	srv := newAuthFlowServer(t, recoveryCode)
	session := auth.Session{ID: "session-password", Username: "admin"}

	missing := authJSONRequest(http.MethodPost, "/api/v1/auth/password", `{"current_password":"StrongPass!123","new_password":"NewStrongPass!456"}`)
	missing = missing.WithContext(withSession(missing.Context(), session))
	missingRecorder := httptest.NewRecorder()
	srv.changePassword(missingRecorder, missing)
	if missingRecorder.Code != http.StatusUnauthorized || decodeAuthResponse(t, missingRecorder)["code"] != "totp_required" {
		t.Fatalf("missing second factor response = %d %s", missingRecorder.Code, missingRecorder.Body.String())
	}

	valid := authJSONRequest(http.MethodPost, "/api/v1/auth/password", `{"current_password":"StrongPass!123","new_password":"NewStrongPass!456","otp":"PASS-WORD-OTPX"}`)
	valid = valid.WithContext(withSession(valid.Context(), session))
	validRecorder := httptest.NewRecorder()
	srv.changePassword(validRecorder, valid)
	if validRecorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", validRecorder.Code, validRecorder.Body.String())
	}
	srv.configMu.RLock()
	newHash := srv.cfg.PasswordHash
	remaining := len(srv.cfg.RecoveryCodeHashes)
	srv.configMu.RUnlock()
	ok, err := auth.VerifyPassword("NewStrongPass!456", newHash)
	if err != nil || !ok {
		t.Fatalf("new password was not stored: ok=%v err=%v", ok, err)
	}
	if remaining != 0 {
		t.Fatalf("recovery code was not consumed; remaining=%d", remaining)
	}
}

func TestUsernameChangeRequiresSecondFactorInSameForm(t *testing.T) {
	const recoveryCode = "USER-NAME-OTPX"
	srv := newAuthFlowServer(t, recoveryCode)
	session := auth.Session{ID: "session-username", Username: "admin"}

	req := authJSONRequest(http.MethodPatch, "/api/v1/auth/account", `{"username":"lukeadmin","current_password":"StrongPass!123","otp":"USER-NAME-OTPX"}`)
	req = req.WithContext(withSession(req.Context(), session))
	recorder := httptest.NewRecorder()
	srv.changeAccount(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", recorder.Code, recorder.Body.String())
	}
	srv.configMu.RLock()
	username := srv.cfg.AdminUser
	remaining := len(srv.cfg.RecoveryCodeHashes)
	srv.configMu.RUnlock()
	if username != "lukeadmin" || remaining != 0 {
		t.Fatalf("username=%q remaining recovery codes=%d", username, remaining)
	}
}
