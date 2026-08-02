package server

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func readReactSource(t *testing.T) string {
	t.Helper()
	path := filepath.Join("..", "..", "frontend", "src", "app.tsx")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return string(raw)
}

func TestFirewallFrontendUsesAgentContract(t *testing.T) {
	content := readReactSource(t)
	for _, required := range []string{
		"operation: 'add'", "rule: { action: rule.action", "operation: 'delete'", "number: Number(item.number)",
		"await reload()", "errorDetail(cause)", "firewall-rule-card", "添加防火墙规则",
	} {
		if !strings.Contains(content, required) {
			t.Fatalf("React SecurityPage is missing firewall marker %q", required)
		}
	}
	for _, forbidden := range []string{"action: 'add', direction: 'in'", "action: 'delete', number:"} {
		if strings.Contains(content, forbidden) {
			t.Fatalf("React SecurityPage still contains legacy payload %q", forbidden)
		}
	}
}

func TestRouterEncodesProductHierarchy(t *testing.T) {
	content := readReactSource(t)
	for _, required := range []string{
		"path: '/audit', title: '日志中心'", "path: '/tools/github'", "parent: '/tools'",
		"path: '/system/services'", "parent: '/system'", "'/github': '/tools/github'",
	} {
		if !strings.Contains(content, required) {
			t.Fatalf("React route model is missing marker %q", required)
		}
	}
}

func TestPasskeyFrontendPreservesFlowAndWebAuthnMapping(t *testing.T) {
	content := readReactSource(t)
	for _, required := range []string{"flow_id", "normalizeRequestOptions", "serializeCredential", "normalizeCreationOptions", "allow_credentials", "user_verification", "exclude_credentials"} {
		if !strings.Contains(content, required) {
			t.Fatalf("Passkey implementation is missing %q", required)
		}
	}
}

func TestPageBackButtonOnlyUsesExplicitParentRoute(t *testing.T) {
	content := readReactSource(t)
	if !strings.Contains(content, "route.parent ? <button className=\"back-button\"") || !strings.Contains(content, "navigate(route.parent!)") {
		t.Fatal("PageHeader must render back only for routes with an explicit parent")
	}
	if !strings.Contains(content, "path: '/audit', title: '日志中心'") {
		t.Fatal("audit must remain a first-level route")
	}
}
