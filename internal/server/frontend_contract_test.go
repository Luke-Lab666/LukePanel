package server

import (
	"os"
	"regexp"
	"sort"
	"strings"
	"testing"
)

var (
	buttonTagPattern = regexp.MustCompile(`<button\b[^>]*>`)
	formTagPattern   = regexp.MustCompile(`<form\b[^>]*>`)
	idPattern        = regexp.MustCompile(`\bid=["']([A-Za-z0-9_-]+)["']`)
	dataPattern      = regexp.MustCompile(`\bdata-([A-Za-z0-9_-]+)(?:=|\s|>)`)
)

func TestRenderedControlsHaveRealInteractionHandlers(t *testing.T) {
	asset, err := webAssets.ReadFile("webdist/app.js")
	if err != nil {
		t.Fatal(err)
	}
	source := string(asset)

	handledIDs := setFromPatterns(source,
		regexp.MustCompile(`querySelector(?:All)?\(["']#([A-Za-z0-9_-]+)`),
		regexp.MustCompile(`(?:button|form|event\.target|target)\.id\s*(?:===|!==)\s*["']([A-Za-z0-9_-]+)`),
		regexp.MustCompile(`closest\(["']#([A-Za-z0-9_-]+)`),
	)
	handledData := setFromPatterns(source,
		regexp.MustCompile(`\[data-([A-Za-z0-9_-]+)`),
		regexp.MustCompile(`hasAttribute\(["']data-([A-Za-z0-9_-]+)`),
		regexp.MustCompile(`getAttribute\(["']data-([A-Za-z0-9_-]+)`),
	)
	for _, name := range regexp.MustCompile(`dataset\.([A-Za-z0-9_]+)`).FindAllStringSubmatch(source, -1) {
		handledData[camelToKebab(name[1])] = true
	}
	for _, name := range []string{"nav", "logout", "copy-text", "back"} {
		handledData[name] = true
	}

	var missing []string
	for _, tag := range buttonTagPattern.FindAllString(source, -1) {
		if strings.Contains(tag, `type="submit"`) || strings.Contains(tag, `type='submit'`) || strings.Contains(tag, `type="reset"`) {
			continue
		}
		if interactionMarkerHandled(tag, handledIDs, handledData) {
			continue
		}
		missing = append(missing, tag)
	}
	for _, tag := range formTagPattern.FindAllString(source, -1) {
		if interactionMarkerHandled(tag, handledIDs, handledData) {
			continue
		}
		missing = append(missing, tag)
	}
	if len(missing) > 0 {
		sort.Strings(missing)
		t.Fatalf("rendered controls without a real handler:\n%s", strings.Join(missing, "\n"))
	}
}

func TestFrontendAPIPathsAreBackedByServerRoutes(t *testing.T) {
	asset, err := webAssets.ReadFile("webdist/app.js")
	if err != nil {
		t.Fatal(err)
	}
	serverSource, err := os.ReadFile("server.go")
	if err != nil {
		t.Fatal(err)
	}

	routePattern := regexp.MustCompile(`HandleFunc\(["\x60]([^"\x60]+)`)
	routes := map[string]bool{}
	for _, match := range routePattern.FindAllStringSubmatch(string(serverSource), -1) {
		if len(match) == 2 {
			routes[match[1]] = true
		}
	}

	apiPattern := regexp.MustCompile(`/api/v1/[A-Za-z0-9_./-]+`)
	missing := map[string]bool{}
	for _, path := range apiPattern.FindAllString(string(asset), -1) {
		if index := strings.IndexByte(path, '?'); index >= 0 {
			path = path[:index]
		}
		// A trailing slash is the static prefix of a template-literal route,
		// such as /files/${action}; concrete static API paths are checked here.
		if strings.HasSuffix(path, "/") {
			continue
		}
		if !routes[path] {
			missing[path] = true
		}
	}
	if len(missing) > 0 {
		items := make([]string, 0, len(missing))
		for path := range missing {
			items = append(items, path)
		}
		sort.Strings(items)
		t.Fatalf("frontend references API paths without server routes:\n%s", strings.Join(items, "\n"))
	}
}

func TestFrontendDoesNotAdvertiseFakeInstallationOrPlaceholderActions(t *testing.T) {
	asset, err := webAssets.ReadFile("webdist/app.js")
	if err != nil {
		t.Fatal(err)
	}
	source := string(asset)
	for _, forbidden := range []string{
		"启用 GitHub 助手</button>",
		"安装 GitHub 助手",
		`href="#"`,
		"javascript:void(0)",
		"即将开放",
	} {
		if strings.Contains(source, forbidden) {
			t.Fatalf("frontend still contains misleading or fake interaction %q", forbidden)
		}
	}
	for _, required := range []string{
		"这是内置功能，无需安装",
		"data-copy-audit",
		"hasAttribute('data-copy-audit')",
	} {
		if !strings.Contains(source, required) {
			t.Fatalf("frontend interaction contract is missing %q", required)
		}
	}
}

func interactionMarkerHandled(tag string, ids, data map[string]bool) bool {
	if match := idPattern.FindStringSubmatch(tag); len(match) == 2 && ids[match[1]] {
		return true
	}
	for _, match := range dataPattern.FindAllStringSubmatch(tag, -1) {
		if len(match) == 2 && data[match[1]] {
			return true
		}
	}
	return false
}

func setFromPatterns(source string, patterns ...*regexp.Regexp) map[string]bool {
	result := map[string]bool{}
	for _, pattern := range patterns {
		for _, match := range pattern.FindAllStringSubmatch(source, -1) {
			if len(match) == 2 {
				result[match[1]] = true
			}
		}
	}
	return result
}

func camelToKebab(value string) string {
	var out strings.Builder
	for i, r := range value {
		if r >= 'A' && r <= 'Z' {
			if i > 0 {
				out.WriteByte('-')
			}
			out.WriteRune(r + ('a' - 'A'))
			continue
		}
		if r == '_' {
			out.WriteByte('-')
			continue
		}
		out.WriteRune(r)
	}
	return out.String()
}
