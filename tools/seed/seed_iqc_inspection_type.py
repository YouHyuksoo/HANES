# -*- coding: utf-8 -*-
"""IQC 검사유형/샘플방식 공통코드 시드 (IQC_INSPECT_TYPE, IQC_SAMPLE_METHOD)."""
import json, os, sys, oracledb

COMMIT = "--commit" in sys.argv
CO, PLANT, WORKER = "40", "1000", "seed"

GROUPS = {
    "IQC_INSPECT_TYPE": [
        ("AQL", "AQL샘플링", 1),
        ("DESTRUCTIVE", "파괴검사", 2),
        ("FULL", "전수검사", 3),
    ],
    "IQC_SAMPLE_METHOD": [
        ("AQL", "AQL자동", 1),
        ("FIXED", "고정수량", 2),
    ],
}

with open(os.path.expanduser("~/.oracle_db_config.json"), encoding="utf-8") as f:
    cfg = json.load(f)["profiles"]["JSHANES"]
conn = oracledb.connect(user=cfg["user"], password=cfg["password"],
                        dsn=f"{cfg['host']}:{cfg['port']}/{cfg['service_name']}")
conn.autocommit = False
cur = conn.cursor()

ins = 0
for group, rows in GROUPS.items():
    for code, name, order in rows:
        cur.execute(
            "SELECT COUNT(*) FROM COM_CODES WHERE COMPANY=:1 AND PLANT_CD=:2 AND GROUP_CODE=:3 AND DETAIL_CODE=:4",
            [CO, PLANT, group, code],
        )
        if cur.fetchone()[0] > 0:
            continue
        cur.execute(
            """INSERT INTO COM_CODES (COMPANY, PLANT_CD, GROUP_CODE, DETAIL_CODE, CODE_NAME, SORT_ORDER, USE_YN, CREATED_BY, UPDATED_BY)
                 VALUES (:co,:pl,:g,:d,:n,:o,'Y',:w,:w)""",
            dict(co=CO, pl=PLANT, g=group, d=code, n=name, o=order, w=WORKER),
        )
        ins += cur.rowcount
print(f"[INSERT] COM_CODES {ins}건")

if COMMIT:
    conn.commit(); print(">>> COMMITTED")
else:
    conn.rollback(); print(">>> DRY-RUN (--commit 필요)")
conn.close()
