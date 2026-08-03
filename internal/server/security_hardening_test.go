package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Luke-Lab666/LukePanel/internal/auth"
	"github.com/Luke-Lab666/LukePanel/internal/config"
)

func requestWithSession(method, target string) *http.Request {
	request := httptest.NewRequest(method, target, nil)
	return request.WithContext(withSession(request.Context(), auth.Session{ID: "test-session", Username: "admin"}))
}

func TestHealthDoesNotExposeFingerprintingMetadata(t *testing.T) {
	server := &Server{version: "v-secret"}
	recorder := httptest.NewRecorder()
	server.health(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/health", nil))
	var payload map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload) != 1 || payload["status"] != "ok" {
		t.Fatalf("unexpected health payload: %#v", payload)
	}
}

func TestDockerSensitiveReadsRequireElevation(t *testing.T) {
	server := &Server{elevated: map[string]time.Time{}}
	cases := []struct {
		name    string
		path    string
		handler http.HandlerFunc
	}{
		{"logs", "/api/v1/docker/logs?id=container", server.dockerLogs},
		{"inspect", "/api/v1/docker/inspect?id=container", server.dockerInspect},
		{"compose", "/api/v1/docker/compose/config?project=app", server.dockerComposeConfig},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			test.handler(recorder, requestWithSession(http.MethodGet, test.path))
			if recorder.Code != http.StatusForbidden || !strings.Contains(recorder.Body.String(), "elevation_required") {
				t.Fatalf("expected elevation rejection, got %d %s", recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestRecoveryRejectsGETAndWebAuthnUsesPinnedOrigin(t *testing.T) {
	server := &Server{cfg: config.Config{WebAuthnOrigin: "https://panel.example.com", WebAuthnRPID: "panel.example.com", SecureCookie: true}}
	recorder := httptest.NewRecorder()
	server.ipAllowlistRecover(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/security/ip-allowlist/recover?token=secret", nil))
	if recorder.Code != http.StatusMethodNotAllowed {
		t.Fatalf("GET recovery must be rejected, got %d", recorder.Code)
	}
	request := httptest.NewRequest(http.MethodPost, "https://attacker.invalid/api/v1/auth/passkey/login/begin", nil)
	request.Host = "attacker.invalid"
	origin, rpID := server.webauthnContext(request)
	if origin != "https://panel.example.com" || rpID != "panel.example.com" {
		t.Fatalf("pinned WebAuthn context ignored: %s %s", origin, rpID)
	}
}
