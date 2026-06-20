# -*- coding: utf-8 -*-
"""IQC_LOGS 항목별 판정결과 영구저장 컬럼 추가.

검사항목별 AQL 판정 결과(itemResults)를 이력에 JSON으로 남긴다.
- IQC_LOGS.ITEM_RESULTS CLOB (비파괴, 멱등)

사용: python tools/seed/seed_iqc_log_item_results.py
"""
import json
import os

import oracledb

with open(os.path.expanduser("~/.oracle_db_config.json"), encoding="utf-8") as f:
    cfg = json.load(f)["profiles"]["JSHANES"]
conn = oracledb.connect(user=cfg["user"], password=cfg["password"],
                        dsn=f"{cfg['host']}:{cfg['port']}/{cfg['service_name']}")
cur = conn.cursor()

cur.execute(
    "SELECT COUNT(*) FROM USER_TAB_COLUMNS WHERE TABLE_NAME='IQC_LOGS' AND COLUMN_NAME='ITEM_RESULTS'",
)
if cur.fetchone()[0] == 0:
    cur.execute("ALTER TABLE IQC_LOGS ADD (ITEM_RESULTS CLOB)")
    cur.execute("COMMENT ON COLUMN IQC_LOGS.ITEM_RESULTS IS '검사항목별 AQL 판정결과(JSON)'")
    print("[DDL] ITEM_RESULTS 컬럼 추가")
else:
    print("[DDL] ITEM_RESULTS 이미 존재 — skip")

cur.execute("SELECT COLUMN_NAME, DATA_TYPE FROM USER_TAB_COLUMNS WHERE TABLE_NAME='IQC_LOGS' AND COLUMN_NAME='ITEM_RESULTS'")
print("[VERIFY]", cur.fetchall())
conn.close()
