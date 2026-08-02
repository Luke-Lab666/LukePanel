package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Luke-Lab666/LukePanel/internal/auth"
)

func githubTestRequest(method, target, body string) *http.Request {
	req := httptest.NewRequest(method, target, strings.NewReader(body))
	return req.WithContext(withSession(req.Context(), auth.Session{ID: "session-1", Username: "admin"}))
}

func TestGitHubAuthStatusReportsDeviceLoginAvailability(t *testing.T) {
	srv := &Server{githubClientID: "Ov23li12345678901234", githubTokens: make(map[string]githubCredential)}
	recorder := httptest.NewRecorder()
	srv.githubAuthStatus(recorder, githubTestRequest(http.MethodGet, "/api/v1/github/auth/status", ""))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d", recorder.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["connected"] != false || body["device_login_available"] != true || body["device_login_configurable"] != false {
		t.Fatalf("body = %#v", body)
	}
}

func TestEffectiveGitHubClientIDUsesGitHubCLIFallback(t *testing.T) {
	srv := &Server{}
	if got := srv.effectiveGitHubClientID(); got != defaultGitHubDeviceClientID {
		t.Fatalf("client id = %q", got)
	}
}

func TestEffectiveGitHubClientIDAllowsProjectOverride(t *testing.T) {
	const custom = "Ov23li12345678901234"
	srv := &Server{githubClientID: custom}
	if got := srv.effectiveGitHubClientID(); got != custom {
		t.Fatalf("client id = %q", got)
	}
}

func TestGitHubAuthStatusUsesZeroSetupDeviceLogin(t *testing.T) {
	srv := &Server{githubTokens: make(map[string]githubCredential)}
	recorder := httptest.NewRecorder()
	srv.githubAuthStatus(recorder, githubTestRequest(http.MethodGet, "/api/v1/github/auth/status", ""))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d", recorder.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["device_login_available"] != true || body["device_login_configurable"] != false || body["device_login_provider"] != "github-cli" {
		t.Fatalf("body = %#v", body)
	}
}
