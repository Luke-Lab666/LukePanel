package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Luke-Lab666/LukePanel/internal/auth"
	"github.com/Luke-Lab666/LukePanel/internal/config"
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
	if body["connected"] != false || body["device_login_available"] != true {
		t.Fatalf("body = %#v", body)
	}
}

func TestGitHubDeviceStartWithoutClientIDReturnsUnavailable(t *testing.T) {
	srv := &Server{
		cfg:          config.Config{SecureCookie: true},
		githubTokens: make(map[string]githubCredential),
		githubFlows:  make(map[string]*githubDeviceFlow),
	}
	recorder := httptest.NewRecorder()
	req := githubTestRequest(http.MethodPost, "/api/v1/github/auth/device/start", `{}`)
	req.Header.Set("Content-Type", "application/json")
	srv.githubDeviceStart(recorder, req)
	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, body=%s", recorder.Code, recorder.Body.String())
	}
	var body map[string]string
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["code"] != "github_device_unavailable" {
		t.Fatalf("body = %#v", body)
	}
}
