#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import importlib.util
import json
import sys
from pathlib import Path

from playwright.async_api import async_playwright

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
spec = importlib.util.spec_from_file_location('audit_core', HERE / 'audit.py')
a = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(a)


def is_transparent(value: str) -> bool:
    normalized = value.replace(' ', '').lower()
    return normalized in {'transparent', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.0)'}


async def inspect_case(browser, name: str, width: int, height: int, path: str, authenticated: bool) -> dict:
    context, page, _state, errors = await a.setup_page(browser, width, height, path, authenticated)
    try:
        if authenticated:
            await a.navigate_to(page, path)
        await page.wait_for_timeout(120)
        metrics = await page.evaluate(
            """() => ({
              overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
              ghosts: [...document.querySelectorAll('.button-ghost')].filter(e => {
                const s=getComputedStyle(e), r=e.getBoundingClientRect();
                return s.display!=='none' && s.visibility!=='hidden' && r.width>0 && r.height>0;
              }).map(e => { const s=getComputedStyle(e); return {text:(e.textContent||e.getAttribute('aria-label')||'').trim(), background:s.backgroundColor, border:s.borderTopColor}; }),
              passkeys: [...document.querySelectorAll('.passkey-login-button, .settings-page .card:has(.inline-form) .credential-icon')].map(e => {
                const old=e.querySelector('.icon'); const before=getComputedStyle(e,'::before');
                return {className:e.className, oldDisplay:old?getComputedStyle(old).display:null, mask:before.webkitMaskImage||before.maskImage, width:parseFloat(before.width)||0};
              }),
              credentialRows: [...document.querySelectorAll('.credential-row')].map(e => { const r=e.getBoundingClientRect(), button=e.querySelector('.button'); return {display:getComputedStyle(e).display, left:r.left, right:r.right, buttonWidth:button?button.getBoundingClientRect().width:0, rowWidth:r.width}; })
            })"""
        )
        issues = list(errors)
        if metrics['overflow'] > 1:
            issues.append(f"horizontal overflow {metrics['overflow']}px")
        for ghost in metrics['ghosts']:
            if is_transparent(ghost['background']) or is_transparent(ghost['border']):
                issues.append(f"ghost action lacks default button block: {ghost['text'] or '<icon>'}")
        if path in ('/', '/settings') and not metrics['passkeys']:
            issues.append('Passkey control not found')
        for icon in metrics['passkeys']:
            if icon['oldDisplay'] != 'none':
                issues.append('legacy Passkey SVG is still visible')
            if not icon['mask'] or icon['mask'] == 'none' or icon['width'] < 18:
                issues.append('new Passkey glyph is missing or undersized')
        for row in metrics['credentialRows']:
            if row['display'] != 'grid':
                issues.append('credential row is not using stable grid layout')
            if width <= 680 and row['buttonWidth'] < row['rowWidth'] - 26:
                issues.append('mobile credential action does not span the row')
        return {'name': name, 'width': width, 'height': height, 'path': path, 'passed': not issues, 'issues': issues, 'metrics': metrics}
    finally:
        await context.close()


async def main() -> None:
    cases = [
        ('login-phone-390', 390, 844, '/', False),
        ('settings-phone-390', 390, 844, '/settings', True),
        ('settings-desktop-1440', 1440, 900, '/settings', True),
        ('docker-phone-390', 390, 844, '/docker', True),
        ('files-phone-390', 390, 844, '/files', True),
    ]
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'])
        try:
            results = [await inspect_case(browser, *case) for case in cases]
        finally:
            await browser.close()
    report = {'checks': len(results), 'passed': sum(1 for row in results if row['passed']), 'results': results}
    (ROOT / 'reports').mkdir(exist_ok=True)
    (ROOT / 'reports' / 'ui-regression.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'checks': report['checks'], 'passed': report['passed']}, ensure_ascii=False))
    failures = [row for row in results if not row['passed']]
    if failures:
        print(json.dumps(failures, ensure_ascii=False, indent=2))
        raise SystemExit(1)


if __name__ == '__main__':
    asyncio.run(main())
