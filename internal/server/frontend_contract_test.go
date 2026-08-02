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

func TestFrontendOnlyClearsAuthenticationForExpiredSessions(t *testing.T) {
	content := readReactSource(t)
	for _, required := range []string{"session_required", "session_expired", "elevation_required", "totp_invalid"} {
		if !strings.Contains(content, required) {
			t.Fatalf("React auth state machine is missing %q", required)
		}
	}
	if strings.Contains(content, "if (response.status === 401) unauthorizedHandler?.()") {
		t.Fatal("frontend still logs out for every 401 response")
	}
}

func TestDashboardReadsCollectorSwapFieldsAndUsesCleanEmptyState(t *testing.T) {
	content := readReactSource(t)
	for _, required := range []string{
		"overview.memory?.SwapTotal", "overview.memory?.SwapUsed",
		"percent={swapTotal ? swapPct : undefined}", "resource-row-empty",
	} {
		if !strings.Contains(content, required) {
			t.Fatalf("dashboard Swap contract is missing %q", required)
		}
	}
}

func TestLoginUsesDedicatedPasskeyIconWithoutRedundantHints(t *testing.T) {
	content := readReactSource(t)
	for _, forbidden := range []string{
		"无需先输入用户名、密码或两步验证码",
		"Passkey 独立完成强认证；账户密码登录在开启 TOTP 后每次都必须验证",
	} {
		if strings.Contains(content, forbidden) {
			t.Fatalf("login page still contains redundant hint %q", forbidden)
		}
	}
	if !strings.Contains(content, `Button icon="passkey" tone="primary"`) {
		t.Fatal("login Passkey action must use the dedicated Passkey icon")
	}
	if !strings.Contains(content, `className="header-refresh-button"`) {
		t.Fatal("page refresh action must keep a stable default button appearance")
	}
}
