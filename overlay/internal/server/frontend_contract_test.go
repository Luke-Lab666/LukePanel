package server

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestReactFrontendUsesCurrentBackendContracts(t *testing.T) {
	root := filepath.Join("..", "..")
	read := func(path string) string {
		raw, err := os.ReadFile(filepath.Join(root, path))
		if err != nil {
			t.Fatalf("read %s: %v", path, err)
		}
		return string(raw)
	}
	contracts := map[string][]string{
		"frontend/src/pages/SystemPages.tsx": {
			"/api/v1/system/apt/preflight",
			"body: jsonBody({ action, packages: [name] })",
			"/api/v1/system/apt/sources",
			"/api/v1/system/timers",
		},
		"frontend/src/pages/DockerPage.tsx": {
			"/api/v1/docker/images/build",
			"body: jsonBody({ project: config.project, files, deploy: config.deploy })",
			"/api/v1/docker/compose/create",
			"/api/v1/docker/recreate",
			"{ value: 'identity'",
			"{ value: 'list-root'",
		},
		"frontend/src/pages/SecurityPages.tsx": {
			"body: jsonBody({ keep_new: true })",
			"permit_root_login",
			"/api/v1/auth/passkey/register/begin",
			"<Status value={value.enabled}/>",
			"value.recovery_pending",
			"{ action: 'create', name: name.trim(), sudo }",
			"{ action: 'delete', name, remove_home: removeHome }",
		},
		"frontend/src/pages/FilesPage.tsx": {
			"/api/v1/files/backups/diff",
			"/api/v1/files/preferences",
			"apiBlob('/api/v1/files/preview/raw",
		},
	}
	for path, markers := range contracts {
		content := read(path)
		for _, marker := range markers {
			if !strings.Contains(content, marker) {
				t.Fatalf("%s is missing backend contract marker %q", path, marker)
			}
		}
	}
	for _, forbidden := range []string{
		"/api/v1/system/updates",
		"jsonBody({ project: config.project, content: config.content })",
		"body: jsonBody({ port: Number(port) })",
		"value=\"traceroute\"",
		"value.active ?? value.enabled",
	} {
		for path := range contracts {
			if strings.Contains(read(path), forbidden) {
				t.Fatalf("%s still contains obsolete contract %q", path, forbidden)
			}
		}
	}
}

func TestReactBuildReplacesLegacyFrontend(t *testing.T) {
	index, err := webAssets.ReadFile("webdist/index.html")
	if err != nil {
		t.Fatal(err)
	}
	html := string(index)
	for _, required := range []string{`<div id="root"></div>`, `/assets/`, `type="module"`, `/manifest.webmanifest`} {
		if !strings.Contains(html, required) {
			t.Fatalf("React index is missing %q", required)
		}
	}
	for _, forbidden := range []string{`<div id="app"`, `/app.js`, `/styles.css`} {
		if strings.Contains(html, forbidden) {
			t.Fatalf("React index still references legacy frontend marker %q", forbidden)
		}
	}
}
