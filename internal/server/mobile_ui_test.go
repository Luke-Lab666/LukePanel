package server

import (
	"strings"
	"testing"
)

func TestMobileUIUsesUnifiedVisualViewportLayout(t *testing.T) {
	styles, err := webAssets.ReadFile("webdist/styles.css")
	if err != nil {
		t.Fatal(err)
	}
	css := string(styles)
	for _, required := range []string{
		"--visual-viewport-height:100dvh",
		".elevation-dialog-backdrop{position:fixed",
		"align-items:flex-end!important",
		"body.overlay-locked",
		".apt-source-card",
		"grid-template-columns:repeat(auto-fit,minmax(140px,1fr))",
		".tab-bar{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))",
	} {
		if !strings.Contains(css, required) {
			t.Fatalf("mobile stylesheet is missing %q", required)
		}
	}
	for _, forbidden := range []string{
		"body.keyboard-open .elevation-dialog-backdrop{\n    align-items:flex-start",
		"body.keyboard-open #elevation-direct-form header{display:none}",
		"--visual-viewport-bottom",
	} {
		if strings.Contains(css, forbidden) {
			t.Fatalf("mobile stylesheet still contains conflicting rule %q", forbidden)
		}
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
