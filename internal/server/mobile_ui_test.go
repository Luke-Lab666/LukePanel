package server

import (
	"strings"
	"testing"
)

func TestMobileUIUsesOneResponsiveDesignSystem(t *testing.T) {
	styles, err := webAssets.ReadFile("webdist/styles.css")
	if err != nil {
		t.Fatal(err)
	}
	css := string(styles)
	for _, required := range []string{
		"--visual-viewport-height: 100dvh",
		"body.overlay-locked",
		"body.keyboard-open .elevation-dialog-card",
		"input, select, textarea { font-size: 16px; }",
		".mobile-nav {",
		".apt-source-list",
		".page-header__actions",
	} {
		if !strings.Contains(css, required) {
			t.Fatalf("mobile stylesheet is missing %q", required)
		}
	}
	for _, forbidden := range []string{
		"align-items:flex-start!important",
		"body.keyboard-open #elevation-direct-form header{display:none}",
		".login-logo{background:",
	} {
		if strings.Contains(css, forbidden) {
			t.Fatalf("mobile stylesheet still contains conflicting legacy rule %q", forbidden)
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
	app, err := webAssets.ReadFile("webdist/app.js")
	if err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{
		"webdist/assets/lukepanel-icon-192.png",
		"webdist/assets/lukepanel-icon-512.png",
		"webdist/assets/apple-touch-icon.png",
		"webdist/assets/favicon-32.png",
	} {
		if _, err := webAssets.ReadFile(path); err != nil {
			t.Fatalf("brand asset %s missing: %v", path, err)
		}
	}
	if !strings.Contains(string(index), "/assets/apple-touch-icon.png") || !strings.Contains(string(index), "/assets/favicon-32.png") {
		t.Fatal("index does not expose the LukePanel icon to browsers and iOS")
	}
	if !strings.Contains(string(manifest), "lukepanel-icon-512.png") {
		t.Fatal("manifest does not contain the LukePanel PWA icon")
	}
	if !strings.Contains(string(app), "function brandIcon") || strings.Contains(string(app), `<div class="brand-mark">L</div>`) {
		t.Fatal("application still uses a letter placeholder instead of the project icon")
	}
}

func TestMobileUIRendersCompactAPTSourceCards(t *testing.T) {
	app, err := webAssets.ReadFile("webdist/app.js")
	if err != nil {
		t.Fatal(err)
	}
	javascript := string(app)
	for _, required := range []string{
		"function aptSourceView(source)",
		"function aptSourceCard(source)",
		"apt-source-card__meta",
		"系统主软件源不能删除",
	} {
		if !strings.Contains(javascript, required) {
			t.Fatalf("mobile APT source UI is missing %q", required)
		}
	}
}
