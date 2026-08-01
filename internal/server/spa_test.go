package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSPADeepRoutesServeIndexWithoutRedirect(t *testing.T) {
	handler := (&Server{}).spaHandler()
	for _, route := range []string{"/", "/files", "/docker", "/security", "/github", "/services", "/updates", "/host", "/snapshots"} {
		t.Run(route, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, route, nil)
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, req)
			if recorder.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200; location=%q", recorder.Code, recorder.Header().Get("Location"))
			}
			if location := recorder.Header().Get("Location"); location != "" {
				t.Fatalf("unexpected redirect location %q", location)
			}
			if !strings.Contains(recorder.Body.String(), `<div id="app"`) {
				t.Fatal("deep route did not serve SPA index")
			}
		})
	}
}

func TestSPAStillServesStaticAssets(t *testing.T) {
	handler := (&Server{}).spaHandler()
	req := httptest.NewRequest(http.MethodGet, "/app.js", nil)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", recorder.Code)
	}
	if !strings.Contains(recorder.Body.String(), "const app") {
		t.Fatal("app.js content missing")
	}
}
