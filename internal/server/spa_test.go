package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSPADeepRoutesServeIndexWithoutRedirect(t *testing.T) {
	handler := (&Server{}).spaHandler()
	routes := []string{
		"/", "/system", "/system/services", "/system/processes", "/system/network", "/system/storage", "/system/tasks", "/system/updates", "/system/host", "/system/snapshots",
		"/docker", "/files", "/tools", "/tools/github", "/ssh", "/audit", "/security", "/settings", "/login",
		"/github", "/services", "/updates", "/host", "/snapshots",
	}
	for _, route := range routes {
		t.Run(strings.TrimPrefix(route, "/"), func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, route, nil)
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, req)
			if recorder.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200", recorder.Code)
			}
			if location := recorder.Header().Get("Location"); location != "" {
				t.Fatalf("unexpected redirect %q", location)
			}
			if !strings.Contains(recorder.Body.String(), `<div id="app"`) {
				t.Fatal("deep route did not serve SPA index")
			}
		})
	}
}

func TestSPAStillServesReactStaticAssets(t *testing.T) {
	handler := (&Server{}).spaHandler()
	indexRequest := httptest.NewRequest(http.MethodGet, "/", nil)
	indexRecorder := httptest.NewRecorder()
	handler.ServeHTTP(indexRecorder, indexRequest)
	if indexRecorder.Code != http.StatusOK {
		t.Fatalf("index status = %d", indexRecorder.Code)
	}
	index := indexRecorder.Body.String()
	if !strings.Contains(index, "/assets/app.js?v=v2.0.4") || !strings.Contains(index, "/assets/app.css?v=v2.0.4") {
		t.Fatal("versioned frontend asset URLs are missing from index")
	}
	for _, asset := range []string{"/assets/vendor-runtime.js", "/assets/react-18.2.0.js", "/assets/react-dom-18.2.0.js", "/assets/react-bootstrap.js", "/assets/app.js"} {
		if !strings.Contains(index, asset) {
			t.Fatalf("React runtime asset %s is missing from index", asset)
		}
		req := httptest.NewRequest(http.MethodGet, asset, nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("asset status = %d for %s", rec.Code, asset)
		}
		if rec.Body.Len() < 300 {
			t.Fatalf("JavaScript asset %s is unexpectedly small: %d", asset, rec.Body.Len())
		}
		if contentType := rec.Header().Get("Content-Type"); !strings.Contains(contentType, "javascript") {
			t.Fatalf("unexpected JavaScript content type %q for %s", contentType, asset)
		}
		if cacheControl := rec.Header().Get("Cache-Control"); cacheControl != "no-cache, must-revalidate" {
			t.Fatalf("unexpected asset cache policy %q for %s", cacheControl, asset)
		}
	}
}
