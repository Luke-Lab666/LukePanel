#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

PACKAGE = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("migration", PACKAGE / "tools/migrate.py")
assert SPEC and SPEC.loader
migration = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(migration)


ORIGINAL_APP = r'''const app = document.querySelector('#app');
function icon(name, size, cls) { return `<i>${name}</i>`; }
function escapeHTML(v) { return String(v); }
function jsonBody(v) { return JSON.stringify(v); }
function showToast(v) {}
async function showError(v, t) {}
async function secureApi() {}
async function loadSecurity() {}
async function askConfirm() { return true; }
function errorBox(message) { return message ? `<div class="alert error">${icon('alert', 18)}${escapeHTML(message)}</div>` : ''; }
async function api(url, options = {}) {
    const response = { ok: false, status: 400, json: async () => ({ error: 'bad' }) };
    const body = await response.json();
    if (!response.ok) {
        const error = new Error(body.error || '请求失败');
        error.status = response.status;
        error.code = body.code || '';
        throw error;
    }
    return body;
}
function securityPage() {
 const fw = {rules: []};
 return `<form id="ufw-rule-form" class="inline-form"><select name="action"><option value="allow">允许</option><option value="deny">拒绝</option><option value="limit">限速</option></select><select name="protocol"><option value="tcp">TCP</option><option value="udp">UDP</option><option value="any">全部协议</option></select><input name="port" placeholder="端口，例如 443" required><input name="source" placeholder="来源 IP/CIDR，留空=任意"><input name="comment" placeholder="备注"><button class="primary-button" type="submit">添加规则</button></form><div class="source-list">${(fw.rules || []).map(rule => `<article><div><strong>#${rule.number} ${escapeHTML(rule.action)} → ${escapeHTML(rule.to)}</strong><p>来源 ${escapeHTML(rule.from)}</p></div><button class="danger-button compact" data-ufw-delete="${rule.number}">删除</button></article>`).join('') || '<div class="empty-list">暂无自定义规则</div>'}</div>`;
}
document.addEventListener('submit', async event => {
    const form = event.target;
    if (form.id === 'ufw-rule-form') {
        event.preventDefault();
        const f = new FormData(form);
        try {
            await secureApi('/api/v1/security/firewall/rule', { method: 'POST', body: jsonBody({ action: 'add', direction: 'in', protocol: f.get('protocol'), port: f.get('port'), source: f.get('source'), comment: f.get('comment') }) });
            showToast('防火墙规则已添加');
            await loadSecurity();
        }
        catch (e) {
            await showError(e.message);
        }
    }
});
document.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.ufwDelete && await askConfirm(`删除防火墙规则 #${button.dataset.ufwDelete}？`, { title: '删除 UFW 规则', confirmText: '删除', danger: true }))
        try {
            await secureApi('/api/v1/security/firewall/rule', { method: 'POST', body: jsonBody({ action: 'delete', number: Number(button.dataset.ufwDelete) }) });
            showToast('规则已删除');
            await loadSecurity();
        }
        catch (e) {
            await showError(e.message);
        }
});
'''

ORIGINAL_FIREWALL = """package hostadmin

func AddUFWRule(ctx context.Context, request FirewallRuleRequest) (FirewallStatus, error) {
\tif !firewallPortPattern.MatchString(request.Port) {
\t\treturn FirewallStatus{}, errors.New(\"端口必须是单个端口或端口范围\")
\t}
\tfor _, p := range strings.Split(request.Port, \":\") {
\t\tn, _ := strconv.Atoi(p)
\t\tif n < 1 || n > 65535 {
\t\t\treturn FirewallStatus{}, errors.New(\"端口必须是 1-65535\")
\t\t}
\t}
\tif request.Source != \"\" && request.Source != \"any\" {
\t\tif _, _, err := net.ParseCIDR(request.Source); err != nil && net.ParseIP(request.Source) == nil {
\t\t\treturn FirewallStatus{}, errors.New(\"来源必须是有效 IP 或 CIDR\")
\t\t}
\t}
\targs := []string{request.Direction, request.Action}
\tif request.Source != \"\" && request.Source != \"any\" {
\t\targs = append(args, \"from\", request.Source)
\t}
\targs = append(args, \"to\", \"any\", \"port\", request.Port)
\tif request.Protocol != \"any\" {
\t\targs = append(args, \"proto\", request.Protocol)
\t}
\tif request.Comment != \"\" {
\t\tif len(request.Comment) > 80 || strings.ContainsAny(request.Comment, \"\\x00\\r\\n\") {
\t\t\treturn FirewallStatus{}, errors.New(\"备注无效\")
\t\t}
\t\targs = append(args, \"comment\", request.Comment)
\t}
\tout, err := commandOutput(ctx, \"ufw\", args...)
\tif err != nil {
\t\treturn FirewallStatus{}, fmt.Errorf(\"添加规则失败: %s\", strings.TrimSpace(out))
\t}
\treturn FirewallInfo(ctx), nil
}

func DeleteUFWRule(ctx context.Context, number int) (FirewallStatus, error) {
\tout, err := commandOutput(ctx, \"ufw\", \"--force\", \"delete\", strconv.Itoa(number))
\tif err != nil {
\t\treturn FirewallStatus{}, fmt.Errorf(\"删除规则失败: %s\", strings.TrimSpace(out))
\t}
\treturn FirewallInfo(ctx), nil
}
""".replace("\\t", "\t").replace('\\"', '"')

ORIGINAL_AGENT = '''package agent
// Operation string `json:"operation"`
// Rule      hostadmin.FirewallRuleRequest `json:"rule"`
'''


class MigrationTests(unittest.TestCase):
    def make_repo(self) -> Path:
        root = Path(tempfile.mkdtemp(prefix="lp-migration-test-"))
        for path in ["web", "internal/hostadmin", "internal/agent", "internal/server/webdist"]:
            (root / path).mkdir(parents=True, exist_ok=True)
        (root / "web/app.js").write_text(ORIGINAL_APP, encoding="utf-8")
        (root / "web/styles.css").write_text(":root{}\n.app-shell{}\n", encoding="utf-8")
        (root / "web/index.html").write_text("<!doctype html>", encoding="utf-8")
        (root / "web/manifest.webmanifest").write_text("{}", encoding="utf-8")
        (root / "internal/server/webdist/app.js").write_text(ORIGINAL_APP, encoding="utf-8")
        (root / "internal/server/webdist/styles.css").write_text(":root{}\n.app-shell{}\n", encoding="utf-8")
        (root / "internal/hostadmin/firewall.go").write_text(ORIGINAL_FIREWALL, encoding="utf-8")
        (root / "internal/agent/server.go").write_text(ORIGINAL_AGENT, encoding="utf-8")
        (root / "README.md").write_text("当前版本：<code>v1.0.0</code>\n\n## 项目状态\n", encoding="utf-8")
        (root / "VERSION").write_text("v1.0.0\n", encoding="utf-8")
        return root

    def test_patch_app_contract_and_cards(self) -> None:
        patched = migration.patch_app_js(ORIGINAL_APP)
        self.assertIn("operation: 'add'", patched)
        self.assertIn("rule: {", patched)
        self.assertIn("operation: 'delete'", patched)
        self.assertIn('name="direction"', patched)
        self.assertIn("firewall-rule-card", patched)
        self.assertIn("formatAPIError(e)", patched)
        self.assertNotIn("jsonBody({ action: 'add', direction: 'in'", patched)
        self.assertNotIn("jsonBody({ action: 'delete'", patched)

    def test_patch_firewall_command_order(self) -> None:
        patched = migration.patch_firewall_go(ORIGINAL_FIREWALL)
        self.assertIn("func buildUFWRuleArgs", patched)
        self.assertIn("[]string{request.Action, request.Direction}", patched)
        self.assertIn("端口范围起始值不能大于结束值", patched)
        self.assertIn("连接限速仅支持 TCP", patched)
        self.assertIn("执行命令: ufw %s", patched)
        self.assertNotIn("[]string{request.Direction, request.Action}", patched)

    def test_full_apply_and_rollback(self) -> None:
        root = self.make_repo()
        try:
            result = migration.apply(root, PACKAGE)
            self.assertEqual((root / "VERSION").read_text().strip(), "v2.0.0")
            self.assertEqual((root / "web/app.js").read_text(), (root / "internal/server/webdist/app.js").read_text())
            self.assertEqual((root / "web/styles.css").read_text(), (root / "internal/server/webdist/styles.css").read_text())
            self.assertTrue((root / "internal/hostadmin/firewall_contract_test.go").is_file())
            self.assertTrue((root / "internal/server/frontend_contract_test.go").is_file())
            backup = Path(result["backup"])
            migration.rollback(root, backup)
            self.assertIn("action: 'add'", (root / "web/app.js").read_text())
            self.assertEqual((root / "VERSION").read_text().strip(), "v1.0.0")
        finally:
            shutil.rmtree(root, ignore_errors=True)


    def test_generated_firewall_go_tests_compile_and_run(self) -> None:
        patched = migration.patch_firewall_go(ORIGINAL_FIREWALL)
        with tempfile.TemporaryDirectory(prefix="lp-go-contract-") as tmp:
            root = Path(tmp)
            (root / "go.mod").write_text("module fixture\n\ngo 1.23\n", encoding="utf-8")
            body = patched.replace("package hostadmin\n", "", 1)
            source = """package hostadmin

import (
    "context"
    "errors"
    "fmt"
    "net"
    "regexp"
    "strconv"
    "strings"
)

type FirewallRuleRequest struct {
    Action string
    Direction string
    Protocol string
    Port string
    Source string
    Comment string
}

type FirewallStatus struct{}

var firewallPortPattern = regexp.MustCompile(`^[0-9]{1,5}(:[0-9]{1,5})?$`)

func commandOutput(context.Context, string, ...string) (string, error) { return "simulated ufw output", errors.New("simulated failure") }
func FirewallInfo(context.Context) FirewallStatus { return FirewallStatus{} }

""" + body
            (root / "firewall.go").write_text(source, encoding="utf-8")
            shutil.copy2(PACKAGE / "generated-tests/firewall_contract_test.go", root / "firewall_contract_test.go")
            subprocess.run(["gofmt", "-w", str(root / "firewall.go"), str(root / "firewall_contract_test.go")], check=True)
            subprocess.run(["go", "test", "./..."], cwd=root, check=True, capture_output=True, text=True)

    def test_patched_javascript_parses(self) -> None:
        patched = migration.patch_app_js(ORIGINAL_APP)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "app.js"
            path.write_text(patched, encoding="utf-8")
            subprocess.run(["node", "--check", str(path)], check=True, capture_output=True, text=True)


if __name__ == "__main__":
    unittest.main(verbosity=2)
