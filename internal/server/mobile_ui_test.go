package server

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestMobileUIUsesOneResponsiveDesignSystem(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("..", "..", "frontend", "src", "app.css"))
	if err != nil {
		t.Fatal(err)
	}
	css := string(raw)
	for _, required := range []string{
		"@media (max-width: 900px)", "@media (max-width: 680px)", "font-size: 16px", ".mobile-bottom-nav", ".firewall-rule-card", ".firewall-form-grid", ".page-actions", "env(safe-area-inset-bottom)",
	} {
		if !strings.Contains(css, required) {
			t.Fatalf("responsive stylesheet is missing %q", required)
		}
	}
	for _, forbidden := range []string{"align-items:flex-start!important", "body.keyboard-open", ".login-logo{background:"} {
		if strings.Contains(css, forbidden) {
			t.Fatalf("responsive stylesheet contains legacy conflict %q", forbidden)
		}
	}
}

func TestBrandAssetsAreAvailableEverywhere(t *testing.T) {
	index, err := webAssets.ReadFile("webdist/index.html")
	if err != nil {
		t.Fatal(err)
	}
	manifest, err := webAssets.ReadFile("webdist/manifest.webmanifest")
	if err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"webdist/assets/lukepanel-icon-192.png", "webdist/assets/lukepanel-icon-512.png", "webdist/assets/apple-touch-icon.png", "webdist/assets/favicon-32.png"} {
		if _, err := webAssets.ReadFile(path); err != nil {
			t.Fatalf("brand asset %s missing: %v", path, err)
		}
	}
	if !strings.Contains(string(index), "/assets/apple-touch-icon.png") || !strings.Contains(string(index), "/assets/favicon-64.png") {
		t.Fatal("index does not expose project icons")
	}
	if !strings.Contains(string(manifest), "lukepanel-icon-512.png") {
		t.Fatal("manifest does not contain PWA icon")
	}
	foundReactBundle := false
	_ = fs.WalkDir(webAssets, "webdist/assets", func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr == nil && !entry.IsDir() && strings.HasSuffix(path, "app.js") {
			foundReactBundle = true
		}
		return nil
	})
	if !foundReactBundle {
		t.Fatal("built React JavaScript bundle is missing")
	}
}

func TestMobileFirewallUsesIndependentCards(t *testing.T) {
	content := readReactSource(t)
	for _, required := range []string{"firewall-rule-list", "firewall-rule-card", "rule-number", "rule-main", "删除防火墙规则"} {
		if !strings.Contains(content, required) {
			t.Fatalf("mobile firewall UI is missing %q", required)
		}
	}
}
