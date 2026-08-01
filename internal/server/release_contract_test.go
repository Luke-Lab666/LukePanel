package server

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestAgentServiceFilesPreserveAPTPrivilegeTransitions(t *testing.T) {
	root := filepath.Join("..", "..")
	paths := []string{
		filepath.Join(root, "install.sh"),
		filepath.Join(root, "packaging", "systemd", "lukepanel-agent.service"),
	}
	required := []string{
		"User=root",
		"NoNewPrivileges=false",
		"CapabilityBoundingSet=~",
		"RestrictSUIDSGID=false",
		"ProtectKernelModules=false",
	}
	for _, path := range paths {
		raw, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("read %s: %v", path, err)
		}
		content := string(raw)
		for _, directive := range required {
			if !strings.Contains(content, directive) {
				t.Fatalf("%s is missing required Agent directive %q", path, directive)
			}
		}
	}
}

func TestReadmeIsPublicProjectDocumentation(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("..", "..", "README.md"))
	if err != nil {
		t.Fatal(err)
	}
	readme := string(raw)
	for _, required := range []string{
		"## 主要特点",
		"## 支持范围",
		"## 安装",
		"## 安全模型",
		"## 本地开发",
		"v1.0.0",
	} {
		if !strings.Contains(readme, required) {
			t.Fatalf("README is missing public documentation section %q", required)
		}
	}
	for _, forbidden := range []string{
		"obliviatedig.top",
		"只适合我",
		"我的服务器",
		"按我的环境",
	} {
		if strings.Contains(strings.ToLower(readme), strings.ToLower(forbidden)) {
			t.Fatalf("README still contains user-specific wording %q", forbidden)
		}
	}
}

func TestStableReleaseMetadataIsConsistent(t *testing.T) {
	root := filepath.Join("..", "..")
	checks := map[string][]string{
		filepath.Join(root, "VERSION"):                             {"v1.0.0"},
		filepath.Join(root, "README.md"):                           {"当前版本：<code>v1.0.0</code>", "首个稳定发行版"},
		filepath.Join(root, "SECURITY.md"):                         {"v1.0.0 已进入稳定维护阶段"},
		filepath.Join(root, ".github", "workflows", "release.yml"): {"版本号，例如 v1.0.0"},
	}
	for path, required := range checks {
		raw, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("read %s: %v", path, err)
		}
		content := strings.TrimSpace(string(raw))
		for _, marker := range required {
			if !strings.Contains(content, marker) {
				t.Fatalf("%s is missing stable release marker %q", path, marker)
			}
		}
	}
}

func TestReleaseFrontendHasNoHistoricalPatchLayersOrDebugStatements(t *testing.T) {
	files := []string{"webdist/app.js", "webdist/styles.css"}
	forbidden := []string{
		"v0.9 delegated",
		"v0.9.7 zero-setup",
		"v10-",
		"v0910",
		"v096",
		"console.log(",
		"debugger;",
		"TODO:",
		"FIXME:",
	}
	for _, path := range files {
		raw, err := webAssets.ReadFile(path)
		if err != nil {
			t.Fatalf("read %s: %v", path, err)
		}
		content := string(raw)
		for _, marker := range forbidden {
			if strings.Contains(content, marker) {
				t.Fatalf("%s contains forbidden release residue %q", path, marker)
			}
		}
	}
}

func TestEmbeddedFrontendMatchesSource(t *testing.T) {
	root := filepath.Join("..", "..")
	for _, name := range []string{"app.js", "styles.css", "index.html", "manifest.webmanifest"} {
		source, err := os.ReadFile(filepath.Join(root, "web", name))
		if err != nil {
			t.Fatalf("read source %s: %v", name, err)
		}
		embedded, err := webAssets.ReadFile(filepath.ToSlash(filepath.Join("webdist", name)))
		if err != nil {
			t.Fatalf("read embedded %s: %v", name, err)
		}
		if string(source) != string(embedded) {
			t.Fatalf("embedded frontend is stale for %s; run make frontend", name)
		}
	}
}
