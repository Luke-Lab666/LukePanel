#!/usr/bin/env python3
from __future__ import annotations
import re, shutil, subprocess, sys
from pathlib import Path
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
ROUTES=['/','/system','/system/services','/system/processes','/system/network','/system/storage','/system/tasks','/system/updates','/system/host','/system/snapshots','/docker','/files','/tools','/tools/github','/ssh','/audit','/security','/settings']
parts=ROOT/'reports/truth-parts'
if parts.exists(): shutil.rmtree(parts)
for route in ROUTES:
    subprocess.run([sys.executable,str(HERE/'truth_worker.py'),route],check=True)
subprocess.run([sys.executable,str(HERE/'merge_truth.py')],check=True)
