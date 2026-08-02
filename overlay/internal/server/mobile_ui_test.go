package server

import (
	"regexp"
	"strings"
	"testing"
)

func builtAsset(t *testing.T, pattern string) []byte {
	t.Helper()
	index, err := webAssets.ReadFile("webdist/index.html")
	if err != nil {
		t.Fatal(err)
	}
	match := regexp.MustCompile(pattern).FindStringSubmatch(string(index))
	if len(match) != 2 {
		t.Fatalf("built asset not found with pattern %s", pattern)
	}
	asset, err := webAssets.ReadFile("webdist" + match[1])
	if err != nil {
		t.Fatalf("read built asset %s: %v", match[1], err)
	}
	return asset
}

func TestMobileUIUsesOneResponsiveDesignSystem(t *testing.T) {
	css := string(builtAsset(t, `href="([^"]+\.css)"`))
	for _, required := range []string{
		"100dvh",
		"env(safe-area-inset-bottom)",
		".mobile-nav",
		".mobile-topbar",
		"font-size:16px",
		"overflow-x:hidden",
	} {
		compact := strings.ReplaceAll(css, " ", "")
		if !strings.Contains(compact, strings.ReplaceAll(required, " ", "")) {
			t.Fatalf("mobile stylesheet is missing %q", required)
		}
	}
}

func TestBrandAssetsAreEmbedded(t *testing.T) {
	for _, path := range []string{
		"webdist/assets/lukepanel-icon-192.png",
		"webdist/assets/lukepanel-icon-512.png",
		"webdist/assets/apple-touch-icon.png",
		"webdist/assets/favicon-32.png",
		"webdist/assets/favicon-64.png",
		"webdist/manifest.webmanifest",
	} {
		if _, err := webAssets.ReadFile(path); err != nil {
			t.Fatalf("brand asset %s missing: %v", path, err)
		}
	}
}
