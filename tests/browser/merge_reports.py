#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]; reports=ROOT/'reports'; parts=reports/'browser-parts'
devices=[('phone-320',320,900),('phone-360',360,800),('iphone-se',375,667),('iphone-390',390,844),('iphone-max',430,932),('phone-landscape',844,390),('tablet-768',768,1024),('tablet-landscape',1024,768),('desktop-1280',1280,800),('desktop-1440',1440,900),('desktop-1920',1920,1080)]
rows=[]; failures=[]; duration=0.0
for name,_,_ in devices:
    data=json.loads((parts/f'{name}.json').read_text()); rows.extend(data['results']); failures.extend(data['failures']); duration+=data['duration_seconds']
interaction_count=51; chunk_size=5; interaction_tests=[]; interaction_checks=0; interaction_passed=0
expected_files=[]
for chunk_start in range(0, interaction_count, chunk_size):
    chunk_end=min(chunk_start+chunk_size, interaction_count)
    expected_files.append(parts/f'interactions-{chunk_start}-{chunk_end}.json')
for path in expected_files:
    if not path.is_file(): raise SystemExit(f'missing interaction chunk: {path.name}')
    inter=json.loads(path.read_text())
    duration+=inter['duration_seconds']; interaction_checks+=inter['checks']; interaction_passed+=inter['passed']; interaction_tests.extend(inter['tests'])
if interaction_checks != interaction_count:
    raise SystemExit(f'expected {interaction_count} interaction checks, got {interaction_checks}')
failures.extend({'device':'interaction','route':t['name'],'issues':t['issues']} for t in interaction_tests if not t['passed'])
report={'version':'v2.0.4','framework':'React 18.2.0','render_checks':len(rows),'render_passed':sum(1 for r in rows if r['passed']),'interaction_checks':interaction_checks,'interaction_passed':interaction_passed,'failures':failures,'interactions':interaction_tests,'results':rows,'duration_seconds':round(duration,2)}
(reports/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ('render_checks','render_passed','interaction_checks','interaction_passed','duration_seconds')},ensure_ascii=False))
if failures: raise SystemExit(1)
