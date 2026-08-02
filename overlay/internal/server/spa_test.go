package server

import (
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
)

func TestSPADeepRoutesServeReactIndexWithoutRedirect(t *testing.T) {
	handler := (&Server{}).spaHandler()
	for _, route := range []string{"/", "/files", "/docker", "/security", "/github", "/services", "/timers", "/updates", "/host", "/snapshots"} {
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
			if !strings.Contains(recorder.Body.String(), `<div id="root"></div>`) {
				t.Fatal("deep route did not serve React SPA index")
			}
		})
	}
}

func TestSPAStillServesHashedStaticAssets(t *testing.T) {
	index, err := webAssets.ReadFile("webdist/index.html")
	if err != nil {
		t.Fatal(err)
	}
	match := regexp.MustCompile(`src="([^"]+\.js)"`).FindStringSubmatch(string(index))
	if len(match) != 2 {
		t.Fatal("built JavaScript asset is not referenced by index")
	}
	handler := (&Server{}).spaHandler()
	req := httptest.NewRequest(http.MethodGet, match[1], nil)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", recorder.Code)
	}
	if recorder.Body.Len() < 1000 {
		t.Fatal("built JavaScript asset is unexpectedly empty")
	}
}
