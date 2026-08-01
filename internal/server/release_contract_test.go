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
		"v0.9.9-beta",
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
