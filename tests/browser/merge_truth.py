#!/usr/bin/env python3
from __future__ import annotations
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
ROUTES=['/','/system','/system/services','/system/processes','/system/network','/system/storage','/system/tasks','/system/updates','/system/host','/system/snapshots','/docker','/files','/tools','/tools/github','/ssh','/audit','/security','/settings']
def slug(path): return 'root' if path=='/' else re.sub(r'[^a-z0-9]+','-',path.strip('/').lower())
parts=ROOT/'reports/truth-parts'; rows=[]; failures=[]; durations=0.0
for route in ROUTES:
    p=parts/f'{slug(route)}.json'
    if not p.is_file(): failures.append({'route':route,'issue':'missing truth audit result'}); continue
    data=json.loads(p.read_text()); rows.extend(data['rows']); failures.extend(data['failures']); durations+=data['duration_seconds']
report={'routes':len(ROUTES),'controls':len(rows),'passed':sum(r['status']!='no-effect' for r in rows),'failures':failures,'duration_seconds':round(durations,2),'rows':rows}
(ROOT/'reports/truth-audit-buttons.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ('routes','controls','passed','duration_seconds')},ensure_ascii=False))
if failures or report['passed']!=report['controls']: raise SystemExit(1)
