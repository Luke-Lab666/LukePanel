package server

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestFirewallFrontendUsesAgentContract(t *testing.T) {
	root := filepath.Join("..", "..")
	raw, err := os.ReadFile(filepath.Join(root, "web", "app.js"))
	if err != nil {
		t.Fatalf("read web/app.js: %v", err)
	}
	content := string(raw)
	for _, required := range []string{
		"operation: 'add'",
		"rule: {",
		"operation: 'delete'",
		"name=\"direction\"",
		"firewall-rule-card",
		"formatAPIError(e)",
	} {
		if !strings.Contains(content, required) {
			t.Fatalf("web/app.js is missing firewall contract marker %q", required)
		}
	}
	for _, forbidden := range []string{
		"jsonBody({ action: 'add', direction: 'in'",
		"jsonBody({ action: 'delete', number:",
	} {
		if strings.Contains(content, forbidden) {
			t.Fatalf("web/app.js still contains legacy firewall payload %q", forbidden)
		}
	}
}

func TestFrontendSourceAndEmbeddedCopiesMatch(t *testing.T) {
	root := filepath.Join("..", "..")
	for _, name := range []string{"app.js", "styles.css"} {
		source, err := os.ReadFile(filepath.Join(root, "web", name))
		if err != nil {
			t.Fatalf("read source %s: %v", name, err)
		}
		embedded, err := os.ReadFile(filepath.Join(root, "internal", "server", "webdist", name))
		if err != nil {
			t.Fatalf("read embedded %s: %v", name, err)
		}
		if string(source) != string(embedded) {
			t.Fatalf("embedded frontend is stale for %s", name)
		}
	}
}
