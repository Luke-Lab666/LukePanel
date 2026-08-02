#!/usr/bin/env python3
"""Browser-level audit for LukePanel's real embedded frontend.

This script serves the real web/ directory, provides a deterministic mock API,
and exercises every public application route with Chromium at phone, tablet,
landscape and desktop viewport sizes. It also performs an interactive UFW add,
error and delete flow against the actual app.js code.
"""
from __future__ import annotations

import argparse
import copy
import json
import mimetypes
import os
import socket
import threading
import time
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "web"
REPORTS = ROOT / "reports"
SCREENSHOTS = REPORTS / "screenshots"

ROUTES: list[tuple[str, str]] = [
    ("/", "概览"),
    ("/system", "系统管理"),
    ("/services", "服务管理"),
    ("/processes", "进程管理"),
    ("/network", "网络管理"),
    ("/storage", "存储管理"),
    ("/tasks", "计划任务"),
    ("/updates", "软件管理"),
    ("/host", "主机设置"),
    ("/snapshots", "配置快照"),
    ("/files", "文件管理"),
    ("/docker", "Docker"),
    ("/tools", "常用工具"),
    ("/github", "GitHub 助手"),
    ("/ssh", "SSH 管理"),
    ("/audit", "日志审计"),
    ("/security", "我的与安全"),
    ("/login", "欢迎回来"),
]

VIEWPORTS: list[dict[str, Any]] = [
    {"name": "phone-320", "width": 320, "height": 900, "mobile": True},
    {"name": "phone-360", "width": 360, "height": 800, "mobile": True},
    {"name": "iphone-se", "width": 375, "height": 667, "mobile": True},
    {"name": "iphone-390", "width": 390, "height": 844, "mobile": True},
    {"name": "iphone-430", "width": 430, "height": 932, "mobile": True},
    {"name": "phone-landscape", "width": 844, "height": 390, "mobile": True},
    {"name": "tablet-768", "width": 768, "height": 1024, "mobile": False},
    {"name": "tablet-landscape", "width": 1024, "height": 768, "mobile": False},
    {"name": "desktop-1280", "width": 1280, "height": 800, "mobile": False},
    {"name": "desktop-1440", "width": 1440, "height": 900, "mobile": False},
    {"name": "desktop-1920", "width": 1920, "height": 1080, "mobile": False},
]


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def initial_firewall() -> dict[str, Any]:
    return {
        "installed": True,
        "enabled": True,
        "recovery_pending": False,
        "default_incoming": "deny",
        "default_outgoing": "allow",
        "rules": [
            {"number": 1, "to": "22/tcp", "action": "ALLOW IN", "from": "203.0.113.0/24"},
            {"number": 2, "to": "443/tcp", "action": "ALLOW IN", "from": "Anywhere"},
            {"number": 3, "to": "53/udp", "action": "ALLOW IN", "from": "Anywhere"},
        ],
    }


class MockState:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.firewall = initial_firewall()
        self.firewall_requests: list[dict[str, Any]] = []

    def reset_firewall(self) -> None:
        with self.lock:
            self.firewall = initial_firewall()
            self.firewall_requests.clear()


STATE = MockState()


class Handler(BaseHTTPRequestHandler):
    server_version = "LukePanelAudit/2.0"

    def log_message(self, fmt: str, *args: Any) -> None:
        return

    def send_json(self, payload: Any, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if not length:
            return {}
        raw = self.rfile.read(length)
        try:
            value = json.loads(raw.decode("utf-8"))
            return value if isinstance(value, dict) else {}
        except (json.JSONDecodeError, UnicodeDecodeError):
            return {}

    def do_HEAD(self) -> None:  # noqa: N802
        self.do_GET(head_only=True)

    def do_GET(self, head_only: bool = False) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        if path.startswith("/api/v1/"):
            self.handle_api_get(path, parse_qs(parsed.query))
            return
        if path == "/manifest.webmanifest":
            self.serve_file(WEB / "manifest.webmanifest", head_only)
            return
        if path == "/app.js":
            self.serve_file(WEB / "app.js", head_only)
            return
        if path == "/styles.css":
            self.serve_file(WEB / "styles.css", head_only)
            return
        if path.startswith("/assets/"):
            candidate = (WEB / path.lstrip("/")).resolve()
            if WEB.resolve() not in candidate.parents:
                self.send_error(HTTPStatus.FORBIDDEN)
                return
            self.serve_file(candidate, head_only)
            return
        # SPA fallback.
        self.serve_file(WEB / "index.html", head_only)

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        body = self.read_json()
        if path == "/api/v1/security/firewall/rule":
            operation = body.get("operation")
            with STATE.lock:
                STATE.firewall_requests.append(copy.deepcopy(body))
                if operation == "add":
                    rule = body.get("rule") or {}
                    port = str(rule.get("port") or "")
                    if port == "9999":
                        self.send_json(
                            {
                                "error": "添加规则失败\n执行命令: ufw allow in to any port 9999 proto tcp\nUFW 输出:\nERROR: Invalid port specification"
                            },
                            400,
                        )
                        return
                    protocol = str(rule.get("protocol") or "tcp")
                    direction = str(rule.get("direction") or "in").upper()
                    action = str(rule.get("action") or "allow").upper()
                    to = port if protocol == "any" else f"{port}/{protocol}"
                    STATE.firewall["rules"].append(
                        {
                            "number": max([r["number"] for r in STATE.firewall["rules"]] + [0]) + 1,
                            "to": to,
                            "action": f"{action} {direction}",
                            "from": str(rule.get("source") or "Anywhere"),
                        }
                    )
                    self.send_json(copy.deepcopy(STATE.firewall))
                    return
                if operation == "delete":
                    number = int(body.get("number") or 0)
                    STATE.firewall["rules"] = [r for r in STATE.firewall["rules"] if r["number"] != number]
                    for index, rule in enumerate(STATE.firewall["rules"], start=1):
                        rule["number"] = index
                    self.send_json(copy.deepcopy(STATE.firewall))
                    return
            self.send_json({"error": "未知防火墙操作"}, 400)
            return
        if path in {
            "/api/v1/auth/elevate",
            "/api/v1/auth/logout",
            "/api/v1/security/firewall/install",
            "/api/v1/security/firewall/enable",
            "/api/v1/security/firewall/disable",
            "/api/v1/security/firewall/confirm",
            "/api/v1/security/fail2ban/install",
            "/api/v1/security/auto-updates/enable",
        }:
            if path.endswith("/disable") and "firewall" in path:
                with STATE.lock:
                    STATE.firewall["enabled"] = False
                    self.send_json(copy.deepcopy(STATE.firewall))
                    return
            if path.endswith("/enable") and "firewall" in path:
                with STATE.lock:
                    STATE.firewall["enabled"] = True
                    self.send_json(copy.deepcopy(STATE.firewall))
                    return
            self.send_json({"ok": True, "message": "操作完成"})
            return
        if path == "/api/v1/tools/run":
            self.send_json({"output": "测试完成\n所有固定诊断项正常", "duration_ms": 18})
            return
        if path == "/api/v1/auth/login":
            self.send_json({"username": "admin", "csrf_token": "audit-csrf", "session_id": "audit-session"})
            return
        if path == "/api/v1/jobs/start":
            self.send_json({"job": {"id": "audit-job", "kind": body.get("action", "job"), "status": "success", "result": {"output": "完成"}, "created_at": now()}})
            return
        # Mutation endpoints not central to layout return a deterministic success.
        self.send_json({"ok": True, "message": "模拟操作完成"})

    def do_PATCH(self) -> None:  # noqa: N802
        self.read_json()
        self.send_json({"ok": True, "username": "admin"})

    def do_PUT(self) -> None:  # noqa: N802
        self.read_json()
        self.send_json({"ok": True, "output": "配置已保存并通过校验"})

    def do_DELETE(self) -> None:  # noqa: N802
        self.read_json()
        self.send_json({"ok": True, "revoked": 1})

    def serve_file(self, path: Path, head_only: bool = False) -> None:
        if not path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        data = path.read_bytes()
        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        if path.suffix == ".webmanifest":
            content_type = "application/manifest+json"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if not head_only:
            self.wfile.write(data)

    def handle_api_get(self, path: str, query: dict[str, list[str]]) -> None:
        referer = self.headers.get("Referer", "")
        if path == "/api/v1/auth/me":
            if urlparse(referer).path == "/login":
                self.send_json({"error": "未登录"}, 401)
            else:
                self.send_json({"username": "admin", "csrf_token": "audit-csrf", "session_id": "audit-session"})
            return
        responses: dict[str, Any] = {
            "/api/v1/settings": {
                "version": "v2.0.0",
                "listen": "127.0.0.1:8080",
                "secure_cookie": True,
                "agent_socket": "/run/lukepanel/agent.sock",
                "admin_user": "admin",
                "auto_refresh_seconds": 5,
            },
            "/api/v1/system/overview": {
                "hostname": "lukepanel-audit",
                "os": "Debian GNU/Linux 13",
                "kernel": "6.12.0-amd64",
                "architecture": "amd64",
                "uptime_seconds": 345678,
                "load_1": 0.42,
                "load_5": 0.36,
                "load_15": 0.31,
                "cpu_percent": 23.5,
                "cpu_cores": 4,
                "memory": {"Used": 2147483648, "Total": 4294967296, "SwapTotal": 2147483648, "SwapUsed": 134217728},
                "disk": {"Used": 32212254720, "Total": 85899345920},
                "network": {"download_bps": 524288, "upload_bps": 131072},
                "collected_at": now(),
            },
            "/api/v1/system/services": {
                "services": [
                    {"name": "lukepanel.service", "description": "LukePanel Web service", "active": "active", "sub": "running", "enabled": "enabled"},
                    {"name": "docker.service", "description": "Docker Engine", "active": "active", "sub": "running", "enabled": "enabled"},
                    {"name": "example-failed.service", "description": "Failure sample", "active": "failed", "sub": "failed", "enabled": "disabled"},
                ]
            },
            "/api/v1/system/processes": {
                "processes": [
                    {"pid": 1001, "user": "root", "cpu_percent": 18.2, "memory_bytes": 134217728, "state": "S", "command": "lukepanel-agent"},
                    {"pid": 1002, "user": "lukepanel", "cpu_percent": 5.4, "memory_bytes": 94371840, "state": "S", "command": "lukepanel"},
                ]
            },
            "/api/v1/system/network": {
                "interfaces": [
                    {"name": "eth0", "flags": "up,broadcast,running", "addresses": ["10.0.0.8/24", "2001:db8::8/64"], "mtu": 1500, "received_bytes": 9876543210, "sent_bytes": 3456789012},
                    {"name": "lo", "flags": "up,loopback,running", "addresses": ["127.0.0.1/8"], "mtu": 65536, "received_bytes": 102400, "sent_bytes": 102400},
                ],
                "listening": "tcp LISTEN 0 4096 0.0.0.0:22\ntcp LISTEN 0 4096 127.0.0.1:8080\nudp UNCONN 0 0 0.0.0.0:53",
            },
            "/api/v1/system/storage": {
                "mounts": [
                    {"mountpoint": "/", "filesystem": "ext4", "device": "/dev/vda1", "total": 85899345920, "used": 32212254720, "virtual": False},
                    {"mountpoint": "/boot/efi", "filesystem": "vfat", "device": "/dev/vda15", "total": 536870912, "used": 67108864, "virtual": False},
                    {"mountpoint": "/proc", "filesystem": "proc", "device": "proc", "total": 0, "used": 0, "virtual": True},
                ]
            },
            "/api/v1/system/tasks": {
                "tasks": [
                    {"id": "backup-daily", "name": "每日完整备份", "type": "panel-backup", "target": "safe", "frequency": "daily", "hour": 4, "minute": 0, "weekday": 1, "enabled": True, "next_run": "明天 04:00"},
                    {"id": "docker-clean", "name": "每周安全清理", "type": "docker-cleanup-safe", "target": "safe", "frequency": "weekly", "hour": 5, "minute": 15, "weekday": 0, "enabled": False, "next_run": "未启用"},
                ]
            },
            "/api/v1/system/timers": {"timers": "NEXT LEFT LAST PASSED UNIT ACTIVATES\nMon 04:00 12h Sun 04:00 lukepanel-backup.timer"},
            "/api/v1/system/apt/preflight": {
                "available": True,
                "locked": False,
                "upgrade_count": 12,
                "install_count": 1,
                "remove_count": 0,
                "download_bytes": 125829120,
                "disk_delta_bytes": 67108864,
                "reboot_required": False,
                "packages": ["curl", "openssl", "systemd", "linux-image-amd64"],
            },
            "/api/v1/system/apt/sources": {
                "sources": [
                    {"name": "sources.list", "path": "/etc/apt/sources.list", "enabled": True, "content": "deb https://deb.debian.org/debian trixie main"},
                    {"name": "docker.list", "path": "/etc/apt/sources.list.d/docker.list", "enabled": True, "content": "deb https://download.docker.com/linux/debian trixie stable"},
                ]
            },
            "/api/v1/system/host": {
                "hostname": "lukepanel-audit",
                "timezone": "Asia/Shanghai",
                "systemd_resolved": True,
                "dns": ["1.1.1.1", "8.8.8.8"],
                "swap": {"enabled": True, "managed": True, "total": 2147483648, "used": 134217728},
                "bbr": True,
                "sysctl": {"preset": "network", "label": "网络吞吐", "bbr": True, "managed": True, "congestion_control": "bbr", "default_qdisc": "fq", "swappiness": 10, "config_path": "/etc/sysctl.d/99-lukepanel.conf"},
            },
            "/api/v1/system/host/ntp": {"available": True, "enabled": True, "synchronized": True, "service": "systemd-timesyncd", "service_active": True, "service_unit": "systemd-timesyncd.service", "timezone": "Asia/Shanghai", "server_name": "ntp.tencent.com", "server_address": "203.107.6.88", "last_sync": "刚刚"},
            "/api/v1/system/snapshots": {"snapshots": [{"id": "snap-1", "kind": "ssh", "name": "SSH 修改前", "note": "自动快照", "created_at": now(), "size": 4096, "items": [{"original": "/etc/ssh/sshd_config", "exists": True}]}]},
            "/api/v1/backup/scheduled": {"backups": [{"name": "lukepanel-backup-20260802.tar.gz", "modified_at": now(), "size": 524288}], "retention": 7},
            "/api/v1/docker/status": {"available": True, "version": "28.3.3"},
            "/api/v1/docker/containers": {"containers": [
                {"id": "abcdef0123456789", "names": ["/adguardhome"], "image": "adguard/adguardhome:latest", "state": "running", "status": "Up 3 days", "ports": [{"PublicPort": 53, "PrivatePort": 53, "Type": "udp"}, {"PublicPort": 3000, "PrivatePort": 3000, "Type": "tcp"}]},
                {"id": "0123456789abcdef", "names": ["/nginx"], "image": "nginx:alpine", "state": "exited", "status": "Exited (0) 2 hours ago", "ports": []},
            ]},
            "/api/v1/docker/images": {"images": [{"id": "sha256:1234567890abcdef", "repo_tags": ["nginx:alpine"], "size": 52428800, "created": 1785600000, "containers": 1}]},
            "/api/v1/docker/networks": {"networks": [{"id": "network123456789", "name": "bridge", "driver": "bridge", "scope": "local", "internal": False, "containers": 2}, {"id": "custom123456789", "name": "app-network", "driver": "bridge", "scope": "local", "internal": False, "containers": 1}]},
            "/api/v1/docker/volumes": {"volumes": [{"name": "app-data", "driver": "local", "mountpoint": "/var/lib/docker/volumes/app-data/_data", "scope": "local"}]},
            "/api/v1/docker/volumes/usage": {"volumes": [{"name": "app-data", "size": 1073741824, "ref_count": 1}]},
            "/api/v1/docker/compose": {"projects": [{"name": "dns-stack", "running": 1, "total": 1, "working_dir": "/opt/dns-stack", "config_files": ["/opt/dns-stack/compose.yaml"], "containers": [{"service": "adguard", "name": "adguardhome", "state": "running"}]}]},
            "/api/v1/files/preferences": {"favorites": [{"path": "/opt", "name": "opt", "is_dir": True}], "recent": [{"path": "/etc", "name": "etc", "is_dir": True, "last_access": now()}]},
            "/api/v1/files/recycle": {"entries": []},
            "/api/v1/auth/sessions": {"sessions": [{"id": "audit-session", "current": True, "ip": "127.0.0.1", "created_at": now()}]},
            "/api/v1/auth/totp/status": {"enabled": True, "recovery_codes_remaining": 8},
            "/api/v1/security/status": {"score": 92, "checks": [
                {"id": "https", "title": "HTTPS", "status": "good", "detail": "安全连接已启用"},
                {"id": "firewall", "title": "UFW 防火墙", "status": "good", "detail": "防火墙正在运行"},
                {"id": "fail2ban", "title": "Fail2ban", "status": "good", "detail": "SSH 防暴力破解已启用"},
                {"id": "auto-updates", "title": "安全更新", "status": "advice", "detail": "建议启用自动安全更新", "recommendation": "不会自动重启"},
            ]},
            "/api/v1/auth/passkeys": {"passkeys": [{"id": "pk1", "name": "iPhone Passkey", "last_used": now()}]},
            "/api/v1/auth/trusted-devices": {"devices": [{"id": "dev1", "name": "iPhone", "ip": "127.0.0.1", "last_used": now()}]},
            "/api/v1/security/ip-allowlist": {"enabled": False, "entries": [], "current_ip": "127.0.0.1"},
            "/api/v1/security/login-notifications": {"enabled": False, "chat_id": ""},
            "/api/v1/security/fail2ban": {"installed": True, "active": True, "currently_failed": 0, "total_failed": 12, "currently_banned": 0, "total_banned": 2, "banned_ips": [], "ignore_ips": ["127.0.0.1", "10.0.0.0/8"]},
            "/api/v1/ssh/status": {"available": True, "running": True, "port": "22", "permit_root_login": "prohibit-password", "password_authentication": "no", "allow_tcp_forwarding": "yes", "allow_agent_forwarding": "no", "x11_forwarding": "no"},
            "/api/v1/ssh/users": {"users": [{"name": "root", "uid": 0, "home": "/root", "shell": "/bin/bash", "key_count": 2, "sudo": True}, {"name": "deploy", "uid": 1000, "home": "/home/deploy", "shell": "/bin/bash", "key_count": 1, "sudo": True}]},
            "/api/v1/ssh/keys": {"keys": [{"id": "key1", "type": "ssh-ed25519", "comment": "iPhone", "fingerprint": "SHA256:audittest", "preview": "ssh-ed25519 AAAAC3... iPhone"}]},
            "/api/v1/audit": {"indexed": True, "total": 3, "events": [
                {"time": now(), "result": "success", "action": "firewall.rule.add", "target": "443/tcp", "user": "admin", "ip": "127.0.0.1", "detail": "规则已添加"},
                {"time": now(), "result": "success", "action": "docker.restart", "target": "adguardhome", "user": "admin", "ip": "127.0.0.1", "detail": "容器已重启"},
                {"time": now(), "result": "failed", "action": "login", "target": "admin", "user": "admin", "ip": "198.51.100.9", "detail": "密码错误"},
            ]},
            "/api/v1/logs/system": {"logs": "Aug 02 12:00:00 server lukepanel[1002]: service ready\nAug 02 12:00:01 server agent[1001]: agent ready"},
            "/api/v1/github/auth/status": {"connected": False},
            "/api/v1/jobs": {"jobs": []},
        }
        if path == "/api/v1/security/firewall":
            with STATE.lock:
                self.send_json(copy.deepcopy(STATE.firewall))
            return
        if path == "/api/v1/files":
            requested = query.get("path", ["/"])[0]
            entries = [
                {"name": "etc", "path": "/etc", "is_dir": True, "size": 4096, "modified_at": now(), "mode": "drwxr-xr-x"},
                {"name": "opt", "path": "/opt", "is_dir": True, "size": 4096, "modified_at": now(), "mode": "drwxr-xr-x"},
                {"name": "README.txt", "path": "/README.txt", "is_dir": False, "size": 1280, "modified_at": now(), "mode": "-rw-r--r--"},
            ]
            self.send_json({"path": requested, "parent": None if requested == "/" else "/", "entries": entries})
            return
        if path == "/api/v1/docker/stats":
            self.send_json({"stats": [{"id": "abcdef0123456789", "cpu_percent": 2.3, "memory_usage": 67108864, "memory_limit": 1073741824, "network_rx": 1048576, "network_tx": 524288}]})
            return
        if path == "/api/v1/system/overview/stream":
            self.send_response(204)
            self.end_headers()
            return
        payload = responses.get(path)
        if payload is None:
            self.send_json({})
        else:
            self.send_json(payload)


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def start_server() -> tuple[ThreadingHTTPServer, str]:
    port = free_port()
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, f"http://127.0.0.1:{port}"


def install_error_capture(page: Page) -> list[str]:
    errors: list[str] = []
    page.on("pageerror", lambda exc: errors.append(f"pageerror: {exc}"))
    page.on("console", lambda msg: errors.append(f"console.{msg.type}: {msg.text}") if msg.type == "error" else None)
    return errors


def wait_for_page(page: Page, expected: str) -> None:
    page.wait_for_selector("h1", state="visible", timeout=8000)
    page.wait_for_function(
        "expected => document.querySelector('h1')?.textContent?.includes(expected)",
        arg=expected,
        timeout=8000,
    )
    page.wait_for_timeout(180)


def route_checks(page: Page, viewport: dict[str, Any], route: str, expected: str, errors: list[str]) -> list[str]:
    failures: list[str] = []
    result = page.evaluate(
        """({width, route}) => {
            const visible = el => {
                const s = getComputedStyle(el), r = el.getBoundingClientRect();
                return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) !== 0 && r.width > 0 && r.height > 0;
            };
            const doc = document.documentElement;
            const body = document.body;
            const overflow = Math.max(doc.scrollWidth, body.scrollWidth) - window.innerWidth;
            const text = body.innerText || '';
            const badText = ['undefined', '[object Object]'].filter(x => text.includes(x));
            const tiny = [];
            if (width <= 640) {
                document.querySelectorAll('button, a, input:not([type=hidden]), select, textarea').forEach(el => {
                    if (!visible(el)) return;
                    const r = el.getBoundingClientRect();
                    const tag = el.tagName.toLowerCase();
                    if ((tag === 'button' || tag === 'a') && (r.width < 32 || r.height < 32)) {
                        tiny.push(`${tag}:${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0,40)}:${Math.round(r.width)}x${Math.round(r.height)}`);
                    }
                });
            }
            const smallFonts = [];
            if (width <= 640) {
                document.querySelectorAll('input, select, textarea').forEach(el => {
                    if (!visible(el)) return;
                    const size = parseFloat(getComputedStyle(el).fontSize);
                    if (size < 16) smallFonts.push(`${el.name || el.id || el.tagName}:${size}`);
                });
            }
            const sidebar = document.querySelector('.product-sidebar');
            const mobileNav = document.querySelector('.mobile-nav');
            const sidebarVisible = sidebar ? visible(sidebar) : false;
            const mobileVisible = mobileNav ? visible(mobileNav) : false;
            const outOfViewport = [];
            document.querySelectorAll('.modal-card,.app-dialog-card,.elevation-dialog-card').forEach(el => {
                if (!visible(el)) return;
                const r = el.getBoundingClientRect();
                if (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1) {
                    outOfViewport.push(`${el.className}:${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`);
                }
            });
            return {overflow, badText, tiny, smallFonts, sidebarVisible, mobileVisible, outOfViewport, title: document.querySelector('h1')?.textContent || '', route};
        }""",
        {"width": viewport["width"], "route": route},
    )
    if result["overflow"] > 1:
        failures.append(f"horizontal overflow {result['overflow']}px")
    if result["badText"]:
        failures.append(f"bad rendered text: {result['badText']}")
    if result["tiny"]:
        failures.append(f"small mobile targets: {result['tiny'][:8]}")
    if result["smallFonts"]:
        failures.append(f"mobile input font below 16px: {result['smallFonts'][:8]}")
    if result["outOfViewport"]:
        failures.append(f"overlay outside viewport: {result['outOfViewport']}")
    if route != "/login":
        if viewport["width"] >= 1024 and not result["sidebarVisible"]:
            failures.append("desktop sidebar is hidden")
        if viewport["width"] <= 640 and result["sidebarVisible"]:
            failures.append("desktop sidebar visible on phone")
    if expected not in result["title"]:
        failures.append(f"unexpected h1: {result['title']!r}")
    expected_errors = []
    for error in errors:
        if route == "/login" and "401 (Unauthorized)" in error:
            continue
        expected_errors.append(error)
    failures.extend(expected_errors)
    return failures


def security_layout_checks(page: Page, width: int) -> list[str]:
    result = page.evaluate(
        """width => {
            const form = document.querySelector('#ufw-rule-form');
            const rules = [...document.querySelectorAll('.firewall-rule-card')];
            if (!form) return {missing: true};
            const cols = getComputedStyle(form).gridTemplateColumns.split(' ').filter(Boolean).length;
            const overlap = rules.some(card => {
                const button = card.querySelector('[data-ufw-delete]');
                const content = card.querySelector('.firewall-rule-content');
                if (!button || !content) return false;
                const a = button.getBoundingClientRect(), b = content.getBoundingClientRect();
                return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
            });
            return {missing: false, cols, count: rules.length, overlap};
        }""",
        width,
    )
    failures: list[str] = []
    if result.get("missing"):
        return ["firewall form missing"]
    expected_cols = 1 if width <= 640 else 2 if width < 1200 else 3
    if result["cols"] != expected_cols:
        failures.append(f"firewall form columns {result['cols']}, expected {expected_cols}")
    if result["count"] != 3:
        failures.append(f"firewall initial card count {result['count']}, expected 3")
    if result["overlap"]:
        failures.append("firewall card content overlaps delete button")
    return failures


def interactive_firewall_test(browser: Browser, base: str) -> dict[str, Any]:
    STATE.reset_firewall()
    context = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=1)
    page = context.new_page()
    errors = install_error_capture(page)
    result: dict[str, Any] = {"name": "interactive-firewall", "failures": []}
    try:
        page.goto(base + "/security", wait_until="domcontentloaded", timeout=5000)
        wait_for_page(page, "我的与安全")
        page.wait_for_selector("#ufw-rule-form", state="visible")
        initial = page.locator(".firewall-rule-card").count()
        page.select_option("#ufw-rule-form [name=action]", "allow")
        page.select_option("#ufw-rule-form [name=direction]", "out")
        page.select_option("#ufw-rule-form [name=protocol]", "tcp")
        page.fill("#ufw-rule-form [name=port]", "8443")
        page.fill("#ufw-rule-form [name=source]", "198.51.100.0/24")
        page.fill("#ufw-rule-form [name=comment]", "Audit rule")
        page.click("#ufw-rule-form button[type=submit]")
        page.wait_for_function("count => document.querySelectorAll('.firewall-rule-card').length === count + 1", arg=initial, timeout=5000)
        with STATE.lock:
            request = copy.deepcopy(STATE.firewall_requests[-1])
        expected_request = {
            "operation": "add",
            "rule": {
                "action": "allow",
                "direction": "out",
                "protocol": "tcp",
                "port": "8443",
                "source": "198.51.100.0/24",
                "comment": "Audit rule",
            },
        }
        if request != expected_request:
            result["failures"].append(f"unexpected add payload: {request!r}")
        if page.locator(".firewall-rule-card").count() != initial + 1:
            result["failures"].append("add did not refresh rule cards immediately")

        page.fill("#ufw-rule-form [name=port]", "9999")
        page.click("#ufw-rule-form button[type=submit]")
        page.wait_for_selector(".app-dialog-card", state="visible", timeout=5000)
        dialog = page.locator(".app-dialog-card").inner_text()
        for marker in ["UFW 添加规则失败", "执行命令", "ufw allow in", "UFW 输出", "Invalid port specification"]:
            if marker not in dialog:
                result["failures"].append(f"error dialog missing {marker!r}")
        box = page.locator(".app-dialog-card").bounding_box()
        if not box or box["x"] < -1 or box["x"] + box["width"] > 391 or box["y"] < -1 or box["y"] + box["height"] > 845:
            result["failures"].append(f"error dialog outside phone viewport: {box}")
        page.click("[data-dialog-confirm]")
        page.wait_for_selector(".app-dialog-card", state="detached")

        # Delete the first card; confirm dialog then immediate card refresh.
        before_delete = page.locator(".firewall-rule-card").count()
        page.locator("[data-ufw-delete]").first.click()
        page.wait_for_selector(".app-dialog-card", state="visible")
        page.click("[data-dialog-confirm]")
        page.wait_for_function("count => document.querySelectorAll('.firewall-rule-card').length === count - 1", arg=before_delete, timeout=5000)
        with STATE.lock:
            delete_request = copy.deepcopy(STATE.firewall_requests[-1])
        if delete_request.get("operation") != "delete" or not isinstance(delete_request.get("number"), int):
            result["failures"].append(f"unexpected delete payload: {delete_request!r}")
        unexpected_errors = [error for error in errors if "400 (Bad Request)" not in error]
        if unexpected_errors:
            result["failures"].extend(unexpected_errors)
        SCREENSHOTS.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(SCREENSHOTS / "security-interactive-phone-390.png"), full_page=True)
    finally:
        context.close()
    result["passed"] = not result["failures"]
    return result


def dialog_landscape_test(browser: Browser, base: str) -> dict[str, Any]:
    context = browser.new_context(viewport={"width": 844, "height": 390}, is_mobile=True, has_touch=True, device_scale_factor=1)
    page = context.new_page()
    errors = install_error_capture(page)
    result: dict[str, Any] = {"name": "phone-landscape-dialog", "failures": []}
    try:
        page.goto(base + "/security", wait_until="domcontentloaded", timeout=5000)
        wait_for_page(page, "我的与安全")
        page.click("#disable-ufw")
        page.wait_for_selector(".app-dialog-card", state="visible")
        box = page.locator(".app-dialog-card").bounding_box()
        if not box or box["x"] < -1 or box["x"] + box["width"] > 845 or box["y"] < -1 or box["y"] + box["height"] > 391:
            result["failures"].append(f"confirm dialog outside landscape viewport: {box}")
        if page.evaluate("document.documentElement.scrollWidth - innerWidth") > 1:
            result["failures"].append("landscape dialog caused horizontal overflow")
        result["failures"].extend(errors)
        SCREENSHOTS.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(SCREENSHOTS / "dialog-phone-landscape.png"), full_page=True)
    finally:
        context.close()
    result["passed"] = not result["failures"]
    return result


def audit_viewport(browser: Browser, base: str, viewport: dict[str, Any]) -> list[dict[str, Any]]:
    representative = {
        ("phone-320", "/security"): "security-phone-320.png",
        ("iphone-390", "/"): "dashboard-iphone-390.png",
        ("phone-320", "/files"): "files-phone-320.png",
        ("phone-landscape", "/security"): "security-phone-landscape.png",
        ("desktop-1440", "/security"): "security-desktop-1440.png",
        ("desktop-1440", "/"): "dashboard-desktop-1440.png",
        ("desktop-1920", "/docker"): "docker-desktop-1920.png",
    }
    records: list[dict[str, Any]] = []
    SCREENSHOTS.mkdir(parents=True, exist_ok=True)
    context = browser.new_context(
        viewport={"width": viewport["width"], "height": viewport["height"]},
        is_mobile=viewport["mobile"],
        has_touch=viewport["mobile"],
        device_scale_factor=1,
    )
    page = context.new_page()
    errors = install_error_capture(page)
    print(f"AUDIT {viewport['name']} {viewport['width']}x{viewport['height']}", flush=True)
    try:
        for route, expected in ROUTES:
            errors.clear()
            started = time.monotonic()
            failures: list[str] = []
            try:
                page.goto(base + route, wait_until="domcontentloaded", timeout=5000)
                wait_for_page(page, expected)
                failures.extend(route_checks(page, viewport, route, expected, errors))
                if route == "/security":
                    failures.extend(security_layout_checks(page, viewport["width"]))
                shot = representative.get((viewport["name"], route))
                if shot:
                    page.screenshot(path=str(SCREENSHOTS / shot), full_page=True, timeout=30000)
            except Exception as exc:  # noqa: BLE001
                failures.append(f"browser exception: {exc}")
            records.append(
                {
                    "viewport": viewport["name"],
                    "width": viewport["width"],
                    "height": viewport["height"],
                    "route": route,
                    "expected_heading": expected,
                    "duration_ms": round((time.monotonic() - started) * 1000),
                    "passed": not failures,
                    "failures": failures,
                }
            )
    finally:
        context.close()
    return records

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default=str(REPORTS / "browser-report.json"))
    parser.add_argument("--headed", action="store_true")
    parser.add_argument("--viewport", choices=[item["name"] for item in VIEWPORTS])
    parser.add_argument("--skip-interactions", action="store_true")
    parser.add_argument("--interactions-only", action="store_true")
    args = parser.parse_args()
    server, base = start_server()
    try:
        with sync_playwright() as playwright:
            records: list[dict[str, Any]] = []
            chromium_version = "unknown"
            selected_viewports = [] if args.interactions_only else ([item for item in VIEWPORTS if item["name"] == args.viewport] if args.viewport else VIEWPORTS)
            for viewport in selected_viewports:
                browser = playwright.chromium.launch(
                    headless=not args.headed,
                    executable_path=os.environ.get("CHROMIUM", "/usr/bin/chromium"),
                    args=["--no-sandbox", "--disable-dev-shm-usage"],
                )
                chromium_version = browser.version
                records.extend(audit_viewport(browser, base, viewport))
                browser.close()
            extras: list[dict[str, Any]] = []
            if not args.skip_interactions:
                interaction_browser = playwright.chromium.launch(
                    headless=not args.headed,
                    executable_path=os.environ.get("CHROMIUM", "/usr/bin/chromium"),
                    args=["--no-sandbox", "--disable-dev-shm-usage"],
                )
                chromium_version = interaction_browser.version
                extras = [interactive_firewall_test(interaction_browser, base), dialog_landscape_test(interaction_browser, base)]
                interaction_browser.close()
            report = {
                "generated_at": now(),
                "chromium": chromium_version,
                "route_count": len(ROUTES),
                "viewport_count": len(selected_viewports),
                "render_checks": len(records),
                "records": records,
                "interactive_checks": extras,
                "passed": all(item["passed"] for item in records) and all(item["passed"] for item in extras),
            }
    finally:
        server.shutdown()
        server.server_close()
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    failed = [r for r in report["records"] if not r["passed"]]
    failed_extras = [r for r in report["interactive_checks"] if not r["passed"]]
    print(f"Chromium {report['chromium']}")
    print(f"Routes: {report['route_count']}; viewports: {report['viewport_count']}; renders: {report['render_checks']}")
    print(f"Failed renders: {len(failed)}; failed interactive checks: {len(failed_extras)}")
    for item in failed[:30]:
        print(f"FAIL {item['viewport']} {item['route']}: {'; '.join(item['failures'])}")
    for item in failed_extras:
        print(f"FAIL {item['name']}: {'; '.join(item['failures'])}")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
