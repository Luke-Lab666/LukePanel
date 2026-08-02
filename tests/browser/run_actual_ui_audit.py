#!/usr/bin/env python3
"""Run each viewport audit in a fresh Python/Chromium process and merge reports."""
from __future__ import annotations
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "tests/browser/actual_ui_audit.py"
OUT = ROOT / "reports/browser-parts"
FINAL = ROOT / "reports/browser-report.json"
VIEWPORTS = [
    "phone-320", "phone-360", "iphone-se", "iphone-390", "iphone-430",
    "phone-landscape", "tablet-768", "tablet-landscape", "desktop-1280",
    "desktop-1440", "desktop-1920",
]

def run(args: list[str]) -> int:
    return subprocess.run([sys.executable, str(SCRIPT), *args], cwd=ROOT, check=False).returncode

def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    reports = []
    for name in VIEWPORTS:
        path = OUT / f"{name}.json"
        run(["--viewport", name, "--skip-interactions", "--output", str(path)])
        reports.append(json.loads(path.read_text()))
    interaction_path = OUT / "interactions.json"
    run(["--interactions-only", "--output", str(interaction_path)])
    interaction = json.loads(interaction_path.read_text())
    records = [record for report in reports for record in report["records"]]
    extras = interaction["interactive_checks"]
    final = {
        "generated_at": interaction["generated_at"],
        "chromium": interaction["chromium"],
        "route_count": 18,
        "viewport_count": len(VIEWPORTS),
        "render_checks": len(records),
        "records": records,
        "interactive_checks": extras,
        "passed": all(item["passed"] for item in records) and all(item["passed"] for item in extras),
    }
    FINAL.write_text(json.dumps(final, ensure_ascii=False, indent=2) + "\n")
    failures = [item for item in records if not item["passed"]]
    extra_failures = [item for item in extras if not item["passed"]]
    print(f"Merged {len(records)} render checks and {len(extras)} interactive checks")
    print(f"Failed renders: {len(failures)}; failed interactions: {len(extra_failures)}")
    for item in failures[:50]:
        print(f"FAIL {item['viewport']} {item['route']}: {'; '.join(item['failures'])}")
    for item in extra_failures:
        print(f"FAIL {item['name']}: {'; '.join(item['failures'])}")
    return 0 if final["passed"] else 1

if __name__ == "__main__":
    raise SystemExit(main())
