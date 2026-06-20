# -*- coding: utf-8 -*-
"""LINE_TYPE 공통코드 시드 — 공정 라인구분(저전압/고전압/공통).

PROCESS_MASTERS.LINE_TYPE 표시용. ComCodeBadge/ComCodeSelect groupCode="LINE_TYPE".

사용: python tools/seed/seed_line_type_comcode.py [--commit]
"""
import json
import os
import sys

import oracledb

COMMIT = "--commit" in sys.argv
CO, PLANT = "40", "1000"
WORKER = "seed"

# (DETAIL_CODE, CODE_NAME, SORT, ATTR1=배지색)
CODES = [
    ("LV", "저전압", 1, "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"),
    ("HV", "고전압", 2, "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"),
    ("CM", "공통", 3, "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"),
]

with open(os.path.expanduser("~/.oracle_db_config.json"), encoding="utf-8") as f:
    cfg = json.load(f)["profiles"]["JSHANES"]
conn = oracledb.connect(user=cfg["user"], password=cfg["password"],
                        dsn=f"{cfg['host']}:{cfg['port']}/{cfg['service_name']}")
conn.autocommit = False
cur = conn.cursor()

cur.execute(
    "DELETE FROM COM_CODES WHERE GROUP_CODE='LINE_TYPE' AND COMPANY=:1 AND PLANT_CD=:2",
    [CO, PLANT],
)
print(f"[CLEAN] COM_CODES LINE_TYPE {cur.rowcount}")

for code, name, order, attr1 in CODES:
    cur.execute(
        """INSERT INTO COM_CODES
             (GROUP_CODE, DETAIL_CODE, CODE_NAME, CODE_DESC, SORT_ORDER,
              USE_YN, ATTR1, COMPANY, PLANT_CD, CREATED_BY)
           VALUES ('LINE_TYPE', :d, :n, '공정 라인구분', :o, 'Y', :a, :co, :pl, :w)""",
        dict(d=code, n=name, o=order, a=attr1, co=CO, pl=PLANT, w=WORKER),
    )

cur.execute(
    "SELECT COUNT(*) FROM COM_CODES WHERE GROUP_CODE='LINE_TYPE' AND COMPANY=:1 AND PLANT_CD=:2",
    [CO, PLANT],
)
print(f"[VERIFY] LINE_TYPE {cur.fetchone()[0]}")

if COMMIT:
    conn.commit()
    print(">>> COMMITTED")
else:
    conn.rollback()
    print(">>> DRY-RUN (rolled back). 실제 반영하려면 --commit")
conn.close()
