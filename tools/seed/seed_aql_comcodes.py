# -*- coding: utf-8 -*-
"""AQL 화면 공통코드 시드 — ISO 2859-1 검사수준/AQL값.

`/quality/aql` 검사수준(INSPECTION_LEVEL)과 AQL값(AQL_VALUE)을 자유입력에서
ComCodeSelect 드롭다운으로 전환하기 위한 COM_CODES 그룹 2종을 등록한다.

- 그룹 AQL_INSP_LEVEL : ISO 2859-1 검사수준 7종(특별 S-1~S-4, 일반 I/II/III)
- 그룹 AQL_VALUE      : ISO 2859-1 합격품질수준(AQL) 26종(0.010~1000)

CRITICAL: AQL_VALUE의 DETAIL_CODE는 프론트 String(aqlValue) 와 정확히 매칭돼야
드롭다운에서 기존 값이 선택 표시된다. 따라서 DETAIL_CODE는 JS canonical 표기
(1.0->"1", 0.040->"0.04")로 두고, CODE_NAME(라벨)만 ISO 표준 표기를 쓴다.

사용: python tools/seed/seed_aql_comcodes.py [--commit]
"""
import json
import os
import sys

import oracledb

COMMIT = "--commit" in sys.argv
CO, PLANT = "40", "1000"
WORKER = "seed"

# 검사수준: (DETAIL_CODE, CODE_NAME)
INSP_LEVELS = [
    ("S-1", "특별검사수준 S-1"),
    ("S-2", "특별검사수준 S-2"),
    ("S-3", "특별검사수준 S-3"),
    ("S-4", "특별검사수준 S-4"),
    ("I", "일반검사수준 I"),
    ("II", "일반검사수준 II"),
    ("III", "일반검사수준 III"),
]

# AQL값: (DETAIL_CODE = JS canonical, CODE_NAME = ISO 표준 표기)
AQL_VALUES = [
    ("0.01", "0.010"), ("0.015", "0.015"), ("0.025", "0.025"), ("0.04", "0.040"),
    ("0.065", "0.065"), ("0.1", "0.10"), ("0.15", "0.15"), ("0.25", "0.25"),
    ("0.4", "0.40"), ("0.65", "0.65"), ("1", "1.0"), ("1.5", "1.5"),
    ("2.5", "2.5"), ("4", "4.0"), ("6.5", "6.5"), ("10", "10"),
    ("15", "15"), ("25", "25"), ("40", "40"), ("65", "65"),
    ("100", "100"), ("150", "150"), ("250", "250"), ("400", "400"),
    ("650", "650"), ("1000", "1000"),
]

with open(os.path.expanduser("~/.oracle_db_config.json"), encoding="utf-8") as f:
    cfg = json.load(f)["profiles"]["JSHANES"]
conn = oracledb.connect(user=cfg["user"], password=cfg["password"],
                        dsn=f"{cfg['host']}:{cfg['port']}/{cfg['service_name']}")
conn.autocommit = False
cur = conn.cursor()


def ins_code(group, detail, name, desc, order):
    cur.execute(
        """INSERT INTO COM_CODES
             (GROUP_CODE, DETAIL_CODE, CODE_NAME, CODE_DESC, SORT_ORDER,
              USE_YN, COMPANY, PLANT_CD, CREATED_BY)
           VALUES (:g, :d, :n, :c, :o, 'Y', :co, :pl, :w)""",
        dict(g=group, d=detail, n=name, c=desc, o=order, co=CO, pl=PLANT, w=WORKER),
    )


# 정리(멱등) — 이 시드가 만든 두 그룹만
for grp in ("AQL_INSP_LEVEL", "AQL_VALUE"):
    cur.execute(
        "DELETE FROM COM_CODES WHERE GROUP_CODE=:g AND COMPANY=:1 AND PLANT_CD=:2",
        {"g": grp, "1": CO, "2": PLANT},
    )
    print(f"[CLEAN] COM_CODES {grp} {cur.rowcount}")

for i, (code, name) in enumerate(INSP_LEVELS, start=1):
    ins_code("AQL_INSP_LEVEL", code, name, "ISO 2859-1 검사수준", i)

for i, (code, name) in enumerate(AQL_VALUES, start=1):
    ins_code("AQL_VALUE", code, name, "ISO 2859-1 합격품질수준(AQL)", i)

# 검증
print("\n[VERIFY]")
for grp in ("AQL_INSP_LEVEL", "AQL_VALUE"):
    cur.execute(
        "SELECT COUNT(*) FROM COM_CODES WHERE GROUP_CODE=:g AND COMPANY=:1 AND PLANT_CD=:2",
        {"g": grp, "1": CO, "2": PLANT},
    )
    print(f"   {grp:16s}", cur.fetchone()[0])

if COMMIT:
    conn.commit()
    print("\n>>> COMMITTED")
else:
    conn.rollback()
    print("\n>>> DRY-RUN (rolled back). 실제 반영하려면 --commit")
conn.close()
