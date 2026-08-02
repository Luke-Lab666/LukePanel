#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import shutil
import sys
from pathlib import Path

EXPECTED = {
    "web/app.js": [
        "const app = document.querySelector('#app');",
        "if (form.id === 'ufw-rule-form')",
        "if (button.dataset.ufwDelete",
        "function securityPage()",
    ],
    "web/styles.css": [":root", ".app-shell"],
    "internal/hostadmin/firewall.go": [
        "func AddUFWRule",
        "args := []string{request.Direction, request.Action}",
    ],
    "internal/agent/server.go": [
        'Operation string',
        '`json:"operation"`',
        'Rule      hostadmin.FirewallRuleRequest',
    ],
}


def fail(message: str) -> None:
    raise RuntimeError(message)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        fail(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, replacement: str, label: str, flags: int = 0) -> str:
    result, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        fail(f"{label}: expected exactly one match, found {count}")
    return result


def patch_app_js(text: str) -> str:
    text = replace_once(
        text,
        "        error.code = body.code || '';\n        throw error;",
        "        error.code = body.code || '';\n"
        "        error.command = body.command || body.details?.command || '';\n"
        "        error.output = body.output || body.details?.output || '';\n"
        "        throw error;",
        "preserve structured command output",
    )

    error_box = "function errorBox(message) { return message ? `<div class=\"alert error\">${icon('alert', 18)}${escapeHTML(message)}</div>` : ''; }"
    error_helpers = error_box + "\n" + r'''function formatAPIError(error) {
    const message = String(error?.message || '操作失败').trim();
    const command = String(error?.command || '').trim();
    const output = String(error?.output || '').trim();
    const parts = [message];
    if (command && !message.includes(command))
        parts.push(`执行命令：\n${command}`);
    if (output && !message.includes(output))
        parts.push(`UFW 输出：\n${output}`);
    return parts.filter(Boolean).join('\n\n');
}'''
    text = replace_once(text, error_box, error_helpers, "add structured API error formatter")

    old_form = r'''<form id="ufw-rule-form" class="inline-form"><select name="action"><option value="allow">允许</option><option value="deny">拒绝</option><option value="limit">限速</option></select><select name="protocol"><option value="tcp">TCP</option><option value="udp">UDP</option><option value="any">全部协议</option></select><input name="port" placeholder="端口，例如 443" required><input name="source" placeholder="来源 IP/CIDR，留空=任意"><input name="comment" placeholder="备注"><button class="primary-button" type="submit">添加规则</button></form>'''
    new_form = r'''<form id="ufw-rule-form" class="firewall-rule-form" novalidate><label class="firewall-field"><span>动作</span><select name="action" aria-label="规则动作"><option value="allow">允许</option><option value="deny">拒绝</option><option value="reject">拒绝并响应</option><option value="limit">连接限速</option></select></label><label class="firewall-field"><span>方向</span><select name="direction" aria-label="规则方向"><option value="in">入站</option><option value="out">出站</option></select></label><label class="firewall-field"><span>协议</span><select name="protocol" aria-label="网络协议"><option value="tcp">TCP</option><option value="udp">UDP</option><option value="any">全部协议</option></select></label><label class="firewall-field"><span>端口或范围</span><input name="port" inputmode="numeric" autocomplete="off" placeholder="443 或 1000:2000" required></label><label class="firewall-field"><span>来源 IP / CIDR</span><input name="source" autocomplete="off" placeholder="留空表示任意来源"></label><label class="firewall-field"><span>备注</span><input name="comment" maxlength="80" autocomplete="off" placeholder="例如 HTTPS"></label><button class="primary-button firewall-rule-submit" type="submit">${icon('plus', 17)}<span>添加规则</span></button></form>'''
    text = replace_once(text, old_form, new_form, "replace firewall form")

    old_rules = r'''<div class="source-list">${(fw.rules || []).map(rule => `<article><div><strong>#${rule.number} ${escapeHTML(rule.action)} → ${escapeHTML(rule.to)}</strong><p>来源 ${escapeHTML(rule.from)}</p></div><button class="danger-button compact" data-ufw-delete="${rule.number}">删除</button></article>`).join('') || '<div class="empty-list">暂无自定义规则</div>'}</div>'''
    new_rules = r'''<div class="firewall-rule-list">${(fw.rules || []).map(rule => `<article class="firewall-rule-card"><div class="firewall-rule-number">#${rule.number}</div><div class="firewall-rule-content"><div class="firewall-rule-heading"><strong>${escapeHTML(rule.to)}</strong><span class="state-pill ${String(rule.action || '').toLowerCase().includes('allow') ? 'success' : 'warning'}">${escapeHTML(rule.action)}</span></div><p>来源：${escapeHTML(rule.from || 'Anywhere')}</p><small>${String(rule.to || '').includes('(v6)') || String(rule.from || '').includes('(v6)') ? 'IPv6' : 'IPv4'} · 编号规则</small></div><button class="danger-button compact firewall-rule-delete" data-ufw-delete="${rule.number}" aria-label="删除规则 #${rule.number}">${icon('trash', 16)}<span>删除</span></button></article>`).join('') || '<div class="empty-list firewall-empty">暂无自定义规则</div>'}</div>'''
    text = replace_once(text, old_rules, new_rules, "replace firewall rule list")

    submit_pattern = r"""    if \(form\.id === 'ufw-rule-form'\) \{\n        event\.preventDefault\(\);\n        const f = new FormData\(form\);\n        try \{\n            await secureApi\('/api/v1/security/firewall/rule', \{ method: 'POST', body: jsonBody\(\{ action: 'add', direction: 'in', protocol: f\.get\('protocol'\), port: f\.get\('port'\), source: f\.get\('source'\), comment: f\.get\('comment'\) \}\) \}\);\n            showToast\('防火墙规则已添加'\);\n            await loadSecurity\(\);\n        \}\n        catch \(e\) \{\n            await showError\(e\.message\);\n        \}\n    \}"""
    submit_replacement = r'''    if (form.id === 'ufw-rule-form') {
        event.preventDefault();
        const f = new FormData(form), submit = form.querySelector('button[type=submit]');
        const port = String(f.get('port') || '').trim();
        if (!port) {
            form.querySelector('[name=port]')?.focus();
            await showError('请输入端口或端口范围', '无法添加规则');
            return;
        }
        submit.disabled = true;
        submit.innerHTML = `${icon('activity', 17, 'spin')}<span>正在添加…</span>`;
        try {
            await secureApi('/api/v1/security/firewall/rule', {
                method: 'POST',
                body: jsonBody({
                    operation: 'add',
                    rule: {
                        action: f.get('action'),
                        direction: f.get('direction'),
                        protocol: f.get('protocol'),
                        port,
                        source: String(f.get('source') || '').trim(),
                        comment: String(f.get('comment') || '').trim()
                    }
                })
            });
            form.reset();
            showToast('防火墙规则已添加');
            await loadSecurity();
        }
        catch (e) {
            await showError(formatAPIError(e), 'UFW 添加规则失败');
        }
        finally {
            if (submit.isConnected) {
                submit.disabled = false;
                submit.innerHTML = `${icon('plus', 17)}<span>添加规则</span>`;
            }
        }
    }'''
    text = regex_once(text, submit_pattern, submit_replacement, "replace firewall submit contract")

    delete_pattern = r"""    if \(button\.dataset\.ufwDelete && await askConfirm\(`删除防火墙规则 #\$\{button\.dataset\.ufwDelete\}？`, \{ title: '删除 UFW 规则', confirmText: '删除', danger: true \}\)\)\n        try \{\n            await secureApi\('/api/v1/security/firewall/rule', \{ method: 'POST', body: jsonBody\(\{ action: 'delete', number: Number\(button\.dataset\.ufwDelete\) \}\) \}\);\n            showToast\('规则已删除'\);\n            await loadSecurity\(\);\n        \}\n        catch \(e\) \{\n            await showError\(e\.message\);\n        \}"""
    delete_replacement = r'''    if (button.dataset.ufwDelete && await askConfirm(`删除防火墙规则 #${button.dataset.ufwDelete}？`, { title: '删除 UFW 规则', confirmText: '删除', danger: true })) {
        button.disabled = true;
        try {
            await secureApi('/api/v1/security/firewall/rule', {
                method: 'POST',
                body: jsonBody({ operation: 'delete', number: Number(button.dataset.ufwDelete) })
            });
            showToast('规则已删除');
            await loadSecurity();
        }
        catch (e) {
            button.disabled = false;
            await showError(formatAPIError(e), 'UFW 删除规则失败');
        }
    }'''
    text = regex_once(text, delete_pattern, delete_replacement, "replace firewall delete contract")

    return text


def patch_firewall_go(text: str) -> str:
    validation_old = '''	for _, p := range strings.Split(request.Port, ":") {
		n, _ := strconv.Atoi(p)
		if n < 1 || n > 65535 {
			return FirewallStatus{}, errors.New("端口必须是 1-65535")
		}
	}
	if request.Source != "" && request.Source != "any" {'''
    validation_new = '''	portParts := strings.Split(request.Port, ":")
	for _, p := range portParts {
		n, _ := strconv.Atoi(p)
		if n < 1 || n > 65535 {
			return FirewallStatus{}, errors.New("端口必须是 1-65535")
		}
	}
	if len(portParts) == 2 {
		start, _ := strconv.Atoi(portParts[0])
		end, _ := strconv.Atoi(portParts[1])
		if start > end {
			return FirewallStatus{}, errors.New("端口范围起始值不能大于结束值")
		}
	}
	if request.Action == "limit" && request.Protocol != "tcp" {
		return FirewallStatus{}, errors.New("连接限速仅支持 TCP")
	}
	if request.Source != "" && request.Source != "any" {'''
    text = replace_once(text, validation_old, validation_new, "strengthen UFW port validation")

    assembly_old = '''	args := []string{request.Direction, request.Action}
	if request.Source != "" && request.Source != "any" {
		args = append(args, "from", request.Source)
	}
	args = append(args, "to", "any", "port", request.Port)
	if request.Protocol != "any" {
		args = append(args, "proto", request.Protocol)
	}
	if request.Comment != "" {
		if len(request.Comment) > 80 || strings.ContainsAny(request.Comment, "\\x00\\r\\n") {
			return FirewallStatus{}, errors.New("备注无效")
		}
		args = append(args, "comment", request.Comment)
	}'''
    assembly_new = '''	if request.Comment != "" {
		if len(request.Comment) > 80 || strings.ContainsAny(request.Comment, "\\x00\\r\\n") {
			return FirewallStatus{}, errors.New("备注无效")
		}
	}
	args := buildUFWRuleArgs(request)'''
    text = replace_once(text, assembly_old, assembly_new, "extract UFW command generation")

    helper = '''
func buildUFWRuleArgs(request FirewallRuleRequest) []string {
	args := []string{request.Action, request.Direction}
	if request.Source != "" && request.Source != "any" {
		args = append(args, "from", request.Source)
	}
	args = append(args, "to", "any", "port", request.Port)
	if request.Protocol != "any" {
		args = append(args, "proto", request.Protocol)
	}
	if request.Comment != "" {
		args = append(args, "comment", request.Comment)
	}
	return args
}

'''
    text = replace_once(text, "func DeleteUFWRule(ctx context.Context, number int) (FirewallStatus, error) {", helper + "func DeleteUFWRule(ctx context.Context, number int) (FirewallStatus, error) {", "add UFW command helper")
    text = replace_once(
        text,
        'return FirewallStatus{}, fmt.Errorf("添加规则失败: %s", strings.TrimSpace(out))',
        'return FirewallStatus{}, fmt.Errorf("添加规则失败\\n执行命令: ufw %s\\nUFW 输出:\\n%s", strings.Join(args, " "), strings.TrimSpace(out))',
        "preserve UFW add command and output",
    )
    text = replace_once(
        text,
        'return FirewallStatus{}, fmt.Errorf("删除规则失败: %s", strings.TrimSpace(out))',
        'return FirewallStatus{}, fmt.Errorf("删除规则失败\\n执行命令: ufw --force delete %d\\nUFW 输出:\\n%s", number, strings.TrimSpace(out))',
        "preserve UFW delete command and output",
    )
    return text

def patch_readme(text: str) -> str:
    text = text.replace("当前版本：<code>v1.0.0</code>", "当前版本：<code>v2.0.0</code>")
    marker = "## 项目状态\n"
    note = (
        "## v2.0.0 UI 与防火墙可靠性重构\n\n"
        "- 以 CSS Cascade Layers、统一设计令牌和响应式组件替换旧的全局样式堆叠。\n"
        "- 保留全部现有业务功能与安全模型，不以占位页面替换真实操作。\n"
        "- 修复 Web / Agent 防火墙协议、UFW 命令顺序、真实错误输出和规则即时刷新。\n"
        "- 防火墙表单与规则列表在手机、平板和桌面均使用独立卡片布局。\n"
        "- 增加源码契约测试与 Chromium 多尺寸 UI 回归。\n\n"
    )
    if note not in text and marker in text:
        text = text.replace(marker, note + marker, 1)
    return text


def write_tests(root: Path, package_dir: Path) -> None:
    generated = package_dir / "generated-tests"
    shutil.copy2(generated / "firewall_contract_test.go", root / "internal/hostadmin/firewall_contract_test.go")
    shutil.copy2(generated / "frontend_contract_test.go", root / "internal/server/frontend_contract_test.go")


def validate_root(root: Path) -> None:
    missing = [path for path in EXPECTED if not (root / path).is_file()]
    if missing:
        fail("not a LukePanel source root; missing: " + ", ".join(missing))
    for rel, markers in EXPECTED.items():
        content = (root / rel).read_text(encoding="utf-8")
        absent = [marker for marker in markers if marker not in content]
        if absent:
            fail(f"{rel} does not match the supported v1.0.0 baseline; missing markers: {absent}")


def backup_files(root: Path, files: list[str]) -> Path:
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = root / f".lukepanel-v2-backup-{stamp}"
    for rel in files:
        src = root / rel
        if src.exists():
            dst = backup / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
    return backup


def apply(root: Path, package_dir: Path) -> dict[str, str]:
    validate_root(root)
    files = [
        "web/app.js",
        "web/styles.css",
        "internal/server/webdist/app.js",
        "internal/server/webdist/styles.css",
        "internal/hostadmin/firewall.go",
        "README.md",
        "VERSION",
    ]
    backup = backup_files(root, files)

    app_path = root / "web/app.js"
    app = patch_app_js(app_path.read_text(encoding="utf-8"))
    app_path.write_text(app, encoding="utf-8")

    css = (package_dir / "assets/styles.css").read_text(encoding="utf-8")
    (root / "web/styles.css").write_text(css, encoding="utf-8")

    fw_path = root / "internal/hostadmin/firewall.go"
    fw_path.write_text(patch_firewall_go(fw_path.read_text(encoding="utf-8")), encoding="utf-8")

    readme_path = root / "README.md"
    readme_path.write_text(patch_readme(readme_path.read_text(encoding="utf-8")), encoding="utf-8")
    (root / "VERSION").write_text("v2.0.0\n", encoding="utf-8")

    webdist = root / "internal/server/webdist"
    webdist.mkdir(parents=True, exist_ok=True)
    shutil.copy2(root / "web/app.js", webdist / "app.js")
    shutil.copy2(root / "web/styles.css", webdist / "styles.css")
    if (root / "web/index.html").exists():
        shutil.copy2(root / "web/index.html", webdist / "index.html")
    if (root / "web/manifest.webmanifest").exists():
        shutil.copy2(root / "web/manifest.webmanifest", webdist / "manifest.webmanifest")

    write_tests(root, package_dir)

    manifest = {
        "version": "v2.0.0",
        "applied_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "backup": str(backup),
        "base": "LukePanel v1.0.0 compatible source",
        "changed": files + [
            "internal/hostadmin/firewall_contract_test.go",
            "internal/server/frontend_contract_test.go",
        ],
    }
    (root / ".lukepanel-v2-migration.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"backup": str(backup), "manifest": str(root / ".lukepanel-v2-migration.json")}


def rollback(root: Path, backup: Path) -> None:
    if not backup.is_dir():
        fail(f"backup directory does not exist: {backup}")
    for src in backup.rglob("*"):
        if not src.is_file():
            continue
        rel = src.relative_to(backup)
        dst = root / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
    for extra in [
        root / "internal/hostadmin/firewall_contract_test.go",
        root / "internal/server/frontend_contract_test.go",
        root / ".lukepanel-v2-migration.json",
    ]:
        extra.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply LukePanel v2.0.0 complete UI and firewall migration")
    parser.add_argument("root", type=Path, help="LukePanel repository root")
    parser.add_argument("--rollback", type=Path, help="restore a migration backup directory")
    args = parser.parse_args()
    root = args.root.resolve()
    package_dir = Path(__file__).resolve().parents[1]
    try:
        if args.rollback:
            rollback(root, args.rollback.resolve())
            print(json.dumps({"ok": True, "rolled_back": str(args.rollback.resolve())}, ensure_ascii=False))
        else:
            result = apply(root, package_dir)
            print(json.dumps({"ok": True, **result}, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(f"migration failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
