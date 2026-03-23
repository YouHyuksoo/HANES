"""
Extracts INSERT statements from seed_material_data.sql and executes them one by one.
"""
import os
import subprocess
import re
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SQL_FILE = os.path.join(PROJECT_ROOT, "scripts", "seed_material_data.sql")

# Oracle DB 스킬 경로 (표준 위치)
SKILL_PATH = os.path.expanduser("~/.claude/skills/oracle-db/scripts/oracle_connector.py")
SITE = 'JSHANES'

with open(SQL_FILE, "r", encoding="utf-8") as f:
    content = f.read()

# Extract all INSERT statements (multi-line aware)
inserts = re.findall(r"(INSERT INTO .+?);", content, re.DOTALL)

print(f"Found {len(inserts)} INSERT statements")

success_count = 0
fail_count = 0

for i, stmt in enumerate(inserts, 1):
    # Clean up newlines for --query
    clean = " ".join(stmt.split())
    result = subprocess.run(
        ["python", SKILL_PATH, "--site", SITE, "--query", clean],
        capture_output=True, text=True, encoding="utf-8"
    )
    if '"success": true' in result.stdout:
        success_count += 1
    else:
        fail_count += 1
        print(f"FAIL [{i}]: {clean[:80]}...")
        print(f"  Error: {result.stdout[:200]}")

print(f"\nDone: {success_count} success, {fail_count} failed out of {len(inserts)} total")
