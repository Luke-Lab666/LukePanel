#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
errors=[]
def check(cond,msg):
    if not cond: errors.append(msg)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
version=(ROOT/'VERSION').read_text().strip()
check(version=='v2.0.6', f'VERSION must be v2.0.6, got {version}')
source=(ROOT/'frontend/src/app.tsx').read_text()
css=(ROOT/'frontend/src/app.css').read_text()
html=(ROOT/'web/index.html').read_text()
readme=(ROOT/'README.md').read_text()
changelog=(ROOT/'CHANGELOG.md').read_text()
workflows='\n'.join(p.read_text() for p in (ROOT/'.github/workflows').glob('*.yml'))
# Framework and hygiene
check('React 18' in readme and 'TypeScript' in readme, 'README must document React 18 + TypeScript')
for label, text in [('source',source),('README',readme),('workflows',workflows)]:
    check(not re.search(r'\b(Vue 3|Quasar|vue3|quasar)\b', text, re.I), f'{label} still contains Vue/Quasar migration residue')
check('window.prompt' not in source and 'window.confirm' not in source, 'native browser dialog found')
for token in ['debugger;', 'TODO:', 'FIXME:', 'console.log(']:
    check(token not in source, f'frontend source contains forbidden debug marker: {token}')
check('dangerouslySetInnerHTML' not in source, 'dangerouslySetInnerHTML is forbidden')
check('innerHTML' not in source, 'direct innerHTML is forbidden')
# Route hierarchy
routes=re.findall(r"\{ path: '([^']+)', title: '([^']+)'[^}]+level: ([12])(?:, parent: '([^']+)')?", source)
check(len(routes)==18, f'expected 18 routes, found {len(routes)}')
paths={r[0] for r in routes}
check('/audit' in paths and next((r for r in routes if r[0]=='/audit'),('', '', '', ''))[2]=='1', 'audit must be level-1')
check('/tools/github' in paths and next((r for r in routes if r[0]=='/tools/github'),('', '', '', ''))[3]=='/tools', 'GitHub helper must be child of /tools')
for path,title,level,parent in routes:
    check((level=='1' and not parent) or (level=='2' and parent in paths), f'invalid route hierarchy: {path}')
check('route.parent ? <button className="back-button"' in source, 'back button must be controlled by route.parent')
# Security contracts
for marker in ["operation: 'add', rule:", "operation: 'delete', number:", "await reload()", "UFW", "flow_id", "allow_credentials", "client_data_json"]:
    check(marker in source, f'missing security/auth contract marker: {marker}')
check('data.docker.installed' not in source and 'data.docker.running' not in source, 'dashboard still guesses obsolete Docker fields')
check('statsError' in source and '容器实时统计读取失败' in source, 'Docker stats failures must be shown explicitly')
check('overview.memory?.SwapTotal' in source and 'overview.memory?.SwapUsed' in source, 'dashboard must read the real Go collector Swap fields')
check("percent={swapTotal ? swapPct : undefined}" in source, 'unconfigured Swap must not render a fake zero-percent progress bar')
check('header-refresh-button' in source and '.header-refresh-button' in css, 'page refresh button must have a stable default outline')
check('/* LukePanel v2.0.6 UI affordance and layout polish. */' in css, 'v2.0.6 UI polish layer missing')
check('.button-ghost {' in css and 'border-color: var(--line-strong);' in css, 'ghost actions must have a stable default button block')
check('.passkey-login-button::before' in css and '-webkit-mask: url(' in css, 'Passkey replacement glyph missing')
check('.credential-row,\n  .key-row {\n    display: grid;' in css, 'credential and key rows must use stable grid layout')
check((ROOT/'tests/browser/ui_regression.py').is_file() and 'tests/browser/ui_regression.py' in (ROOT/'Makefile').read_text(), 'UI regression suite is not wired into browser-test')
check('无需先输入用户名、密码或两步验证码' not in source and 'Passkey 独立完成强认证' not in source, 'login page still contains redundant authentication hints')
check('icon="passkey"' in source and "passkey: [" in source, 'Passkey controls must use the dedicated Passkey icon')
# Frontend API paths must exist in the Go router. Dynamic security/host helpers are expanded separately.
server_source=(ROOT/'internal/server/server.go').read_text()
backend_routes=set(re.findall(r'mux\.HandleFunc\("([^"]+)"', server_source))
frontend_routes={match.rstrip('/') for match in re.findall(r'/api/v1/[A-Za-z0-9_./-]+', source) if not match.endswith('/')}
for fragment in re.findall(r"securityAction\('([^']+)'", source):
    frontend_routes.add('/api/v1/security/'+fragment)
for fragment in ('dns','ntp','swap','sysctl'):
    if f"mutate('{fragment}'" in source: frontend_routes.add('/api/v1/system/host/'+fragment)
missing_routes=sorted(frontend_routes-backend_routes)
check(not missing_routes, f'frontend API routes missing from Go router: {missing_routes}')
browser_audit=(ROOT/'tests/browser/audit.py').read_text()
check('INTERACTION_COUNT=51' in browser_audit, 'browser interaction count must remain 51')
check("return self.response(501" in browser_audit and 'unregistered_mock_endpoint' in browser_audit, 'browser mock must reject unregistered APIs')
# Build/runtime
check('https://' not in html and 'http://' not in html, 'runtime HTML must not load network assets')
for asset in ['vendor-runtime.js','react-18.2.0.js','react-dom-18.2.0.js','react-bootstrap.js','app.js','app.css']:
    check((ROOT/'web/assets'/asset).is_file(), f'missing built asset {asset}')
meta=json.loads((ROOT/'web/build-meta.json').read_text())
check(meta.get('version')=='v2.0.6' and meta.get('framework')=='React' and meta.get('react')=='18.2.0','invalid build metadata')
for webfile in (ROOT/'web').rglob('*'):
    if webfile.is_file():
        peer=ROOT/'internal/server/webdist'/webfile.relative_to(ROOT/'web')
        check(peer.is_file() and sha(peer)==sha(webfile), f'embedded frontend differs: {webfile.relative_to(ROOT)}')
check("font-size: 16px" in css, 'mobile CSS must include 16px form controls')
check('env(safe-area-inset-bottom)' in css, 'mobile safe-area handling missing')
check('@media' in css and 'max-width: 680px' in css, 'phone breakpoint missing')
# Version alignment
for path in ['frontend/package.json','README.md','CHANGELOG.md']:
    check('2.0.6' in (ROOT/path).read_text(), f'{path} not aligned to 2.0.6')
check('## v2.0.6' in changelog, 'v2.0.6 changelog section missing')
if errors:
    print('STATIC AUDIT FAILED')
    for e in errors: print(' -',e)
    sys.exit(1)
print(f'STATIC AUDIT PASS: {len(routes)} routes, React 18.2.0, embedded resources identical')
