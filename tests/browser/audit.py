#!/usr/bin/env python3
from __future__ import annotations

import base64
import json
import shutil
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path
from typing import Any

import requests
import websocket

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "reports" / "screenshots"
OUT.mkdir(parents=True, exist_ok=True)
CSS = (ROOT / "assets" / "styles.css").read_text(encoding="utf-8")
JS = (Path(__file__).with_name("harness.js")).read_text(encoding="utf-8")

DEVICES = [
    ("phone-320", 320, 900, True),
    ("android-360", 360, 800, True),
    ("iphone-se-375", 375, 667, True),
    ("iphone-390", 390, 844, True),
    ("iphone-max-430", 430, 932, True),
    ("phone-landscape", 844, 390, True),
    ("ipad-768", 768, 1024, True),
    ("tablet-1024", 1024, 768, False),
    ("desktop-1280", 1280, 800, False),
    ("desktop-1440", 1440, 900, False),
    ("desktop-1920", 1920, 1080, False),
]
SCENARIOS = ["/login", "/", "/security", "/docker", "/files", "/ssh", "/settings", "/dialog"]


def wait_http(url: str, timeout: float = 10.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=0.4):
                return
        except Exception:
            time.sleep(0.1)
    raise RuntimeError(f"service did not become ready: {url}")


class CDP:
    def __init__(self, url: str):
        self.ws = websocket.create_connection(url, timeout=20, suppress_origin=True)
        self.seq = 0

    def close(self) -> None:
        self.ws.close()

    def call(self, method: str, params: dict[str, Any] | None = None) -> Any:
        self.seq += 1
        ident = self.seq
        self.ws.send(json.dumps({"id": ident, "method": method, "params": params or {}}))
        while True:
            message = json.loads(self.ws.recv())
            if message.get("id") != ident:
                continue
            if "error" in message:
                raise RuntimeError(f"CDP {method}: {message['error']}")
            return message.get("result", {})


def evaluate(cdp: CDP, expression: str) -> Any:
    result = cdp.call("Runtime.evaluate", {
        "expression": expression,
        "returnByValue": True,
        "awaitPromise": True,
    })
    return result.get("result", {}).get("value")


def document(route: str) -> str:
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,interactive-widget=resizes-content"><meta name="color-scheme" content="light dark"><style>{CSS}</style></head><body><div id="app"></div><script>window.__LP_ROUTE__={json.dumps(route)};</script><script>{JS}</script></body></html>'''


def wait_page(cdp: CDP) -> None:
    deadline = time.monotonic() + 8
    while time.monotonic() < deadline:
        ready = evaluate(cdp, "document.querySelector('#app > *') !== null")
        if ready:
            time.sleep(.08)
            return
        time.sleep(.04)
    raise RuntimeError("page did not render")


def check_no_overlap(cdp: CDP, selector: str) -> bool:
    expression = f'''(() => {{
      const els=[...document.querySelectorAll({json.dumps(selector)})].filter(e=>{{const s=getComputedStyle(e);return s.display!=="none"&&e.getBoundingClientRect().width>0}});
      for(let i=0;i<els.length;i++) for(let j=i+1;j<els.length;j++) {{
        const a=els[i].getBoundingClientRect(), b=els[j].getBoundingClientRect();
        const x=Math.min(a.right,b.right)-Math.max(a.left,b.left), y=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
        if(x>3&&y>3) return false;
      }}
      return true;
    }})()'''
    return bool(evaluate(cdp, expression))


def main() -> int:
    chromium = shutil.which("chromium") or shutil.which("chromium-browser") or shutil.which("google-chrome")
    if not chromium:
        raise RuntimeError("Chromium not found")

    profile = tempfile.mkdtemp(prefix="lukepanel-ui-audit-")
    port = 19224
    browser = subprocess.Popen([
        chromium,
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-sync",
        "--no-first-run",
        "--no-default-browser-check",
        "--remote-allow-origins=*",
        f"--remote-debugging-port={port}",
        f"--user-data-dir={profile}",
        "about:blank",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    failures: list[str] = []
    measurements: list[dict[str, Any]] = []
    try:
        wait_http(f"http://127.0.0.1:{port}/json/version")
        tabs = requests.get(f"http://127.0.0.1:{port}/json", timeout=3).json()
        if not tabs:
            raise RuntimeError("Chromium did not expose a page target")
        cdp = CDP(tabs[0]["webSocketDebuggerUrl"])
        try:
            cdp.call("Page.enable")
            cdp.call("Runtime.enable")
            frame_id = cdp.call("Page.getFrameTree")["frameTree"]["frame"]["id"]
            for device, width, height, mobile in DEVICES:
                cdp.call("Emulation.setDeviceMetricsOverride", {
                    "width": width,
                    "height": height,
                    "deviceScaleFactor": 1,
                    "mobile": mobile,
                    "screenWidth": width,
                    "screenHeight": height,
                })
                for route in SCENARIOS:
                    cdp.call("Page.setDocumentContent", {"frameId": frame_id, "html": document(route)})
                    wait_page(cdp)
                    key = f"{route}@{device}"
                    unresolved = evaluate(cdp, r"(/undefined|null|\[object Object\]/).test(document.body.innerText)")
                    if unresolved:
                        failures.append(f"{key}: unresolved value rendered")

                    dims = evaluate(cdp, "({sw:document.documentElement.scrollWidth,iw:window.innerWidth,sh:document.documentElement.scrollHeight,ih:window.innerHeight})")
                    if dims["sw"] > dims["iw"] + 1:
                        failures.append(f"{key}: horizontal overflow {dims}")

                    if route not in {"/login"}:
                        layout = evaluate(cdp, "({sidebar:getComputedStyle(document.querySelector('.sidebar')).display,mobile:getComputedStyle(document.querySelector('.mobile-nav')).display})")
                        expected_mobile_nav = width <= 899
                        if expected_mobile_nav and (layout["sidebar"] != "none" or layout["mobile"] == "none"):
                            failures.append(f"{key}: mobile navigation breakpoint incorrect {layout}")
                        if not expected_mobile_nav and (layout["sidebar"] == "none" or layout["mobile"] != "none"):
                            failures.append(f"{key}: desktop navigation breakpoint incorrect {layout}")

                    if width <= 640:
                        fonts_ok = evaluate(cdp, "Array.from(document.querySelectorAll('input,select,textarea')).every(e=>parseFloat(getComputedStyle(e).fontSize)>=16)")
                        if not fonts_ok:
                            failures.append(f"{key}: input font below 16px, iOS zoom risk")
                        touch_ok = evaluate(cdp, "Array.from(document.querySelectorAll('button,.mobile-nav a')).filter(e=>{const r=e.getBoundingClientRect();return getComputedStyle(e).display!=='none'&&r.width>0&&r.height>0}).every(e=>{const r=e.getBoundingClientRect();return r.height>=36&&r.width>=36})")
                        if not touch_ok:
                            failures.append(f"{key}: touch target below 36x36")

                    if route == "/security":
                        cards = evaluate(cdp, "document.querySelectorAll('.firewall-rule-card').length")
                        if cards != 3:
                            failures.append(f"{key}: expected 3 firewall cards, got {cards}")
                        columns = evaluate(cdp, "getComputedStyle(document.querySelector('.firewall-rule-form')).gridTemplateColumns.split(' ').filter(Boolean).length")
                        expected = 1 if width <= 640 else (2 if width <= 1180 else 3)
                        if columns != expected:
                            failures.append(f"{key}: firewall form expected {expected} columns, got {columns}")
                        if not check_no_overlap(cdp, ".firewall-rule-card"):
                            failures.append(f"{key}: firewall cards overlap")
                        delete_ok = evaluate(cdp, "Array.from(document.querySelectorAll('.firewall-rule-delete')).every(e=>{const r=e.getBoundingClientRect();return r.height>=36&&r.width>=56})")
                        if not delete_ok:
                            failures.append(f"{key}: firewall delete action too small")

                    if route == "/dialog":
                        modal = evaluate(cdp, "(()=>{const r=document.querySelector('.modal-card').getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}})()")
                        if modal["left"] < -1 or modal["right"] > width + 1 or modal["top"] < -1 or modal["bottom"] > height + 1:
                            failures.append(f"{key}: modal escapes viewport {modal}")
                        footer_ok = evaluate(cdp, "document.querySelector('.modal-card footer').getBoundingClientRect().bottom <= window.innerHeight + 1")
                        if not footer_ok:
                            failures.append(f"{key}: modal actions inaccessible")

                    if route == "/login":
                        login = evaluate(cdp, "(()=>{const r=document.querySelector('.login-card').getBoundingClientRect();return {left:r.left,right:r.right,width:r.width}})()")
                        if login["left"] < -1 or login["right"] > width + 1:
                            failures.append(f"{key}: login card escapes viewport {login}")

                    name = route.strip("/") or "dashboard"
                    shot = cdp.call("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})
                    raw = base64.b64decode(shot["data"])
                    (OUT / f"{name}-{device}.png").write_bytes(raw)
                    if len(raw) < 4500:
                        failures.append(f"{key}: screenshot unexpectedly small ({len(raw)} bytes)")
                    measurements.append({"scenario": route, "device": device, "width": width, "height": height, **dims})
        finally:
            cdp.close()

        report = {
            "engine": Path(chromium).name,
            "mode": "real Chromium via Chrome DevTools Protocol",
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "devices": [{"name": n, "width": w, "height": h, "mobile_emulation": m} for n, w, h, m in DEVICES],
            "scenarios": SCENARIOS,
            "screenshots": len(DEVICES) * len(SCENARIOS),
            "checks": [
                "horizontal overflow",
                "desktop/mobile navigation breakpoint",
                "unresolved values",
                "iOS 16px form font",
                "touch target sizing",
                "firewall card count and overlap",
                "firewall responsive columns",
                "modal viewport containment",
                "login viewport containment",
            ],
            "failures": failures,
            "measurements": measurements,
        }
        report_path = ROOT / "reports" / "browser-report.json"
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps({k: v for k, v in report.items() if k != "measurements"}, ensure_ascii=False, indent=2))
        return 1 if failures else 0
    finally:
        browser.terminate()
        try:
            browser.wait(timeout=5)
        except subprocess.TimeoutExpired:
            browser.kill()
        shutil.rmtree(profile, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
