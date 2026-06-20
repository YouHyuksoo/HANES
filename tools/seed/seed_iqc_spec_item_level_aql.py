# -*- coding: utf-8 -*-
"""품목별 IQC 검사항목 — 검사항목별 불량등급/검사수준/AQL 도입.

검사기준서(Control Plan) 구조: 품목 × 검사항목마다 불량등급/검사수준/AQL을 관리한다.

- IQC_PART_SPEC_ITEMS에 컬럼 추가(비파괴):
  - DEFECT_GRADE     VARCHAR2(10)  불량등급(CRITICAL/MAJOR/MINOR)
  - INSPECTION_LEVEL VARCHAR2(5)   검사수준(II, S4 ...)
  - AQL              NUMBER        합격품질수준
- COM_CODES DEFECT_GRADE 그룹 시드(CRITICAL/MAJOR/MINOR).

검사수준/AQL 코드는 기존 AQL_INSP_LEVEL/AQL_VALUE 공통코드 재사용.

사용: python tools/seed/seed_iqc_spec_item_level_aql.py [--commit]
"""
import json
import os
import sys

import oracledb

COMMIT = "--commit" in sys.argv
CO, PLANT = "40", "1000"
WORKER = "seed"

# 불량등급: (DETAIL_CODE, CODE_NAME, SORT, ATTR1=배지색)
DEFECT_GRADES = [
    ("CRITICAL", "치명(Critical)", 1, "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"),
    ("MAJOR", "중결점(Major)", 2, "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"),
    ("MINOR", "경결점(Minor)", 3, "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300"),
]

with open(os.path.expanduser("~/.oracle_db_config.json"), encoding="utf-8") as f:
    cfg = json.load(f)["profiles"]["JSHANES"]
conn = oracledb.connect(user=cfg["user"], password=cfg["password"],
                        dsn=f"{cfg['host']}:{cfg['port']}/{cfg['service_name']}")
conn.autocommit = False
cur = conn.cursor()


def col_exists(table, col):
    cur.execute(
        "SELECT COUNT(*) FROM USER_TAB_COLUMNS WHERE TABLE_NAME=:t AND COLUMN_NAME=:c",
        {"t": table, "c": col},
    )
    return cur.fetchone()[0] > 0


# 0) 컬럼 추가 (없을 때만) — DDL 자동 커밋
for col, ddl in [
    ("DEFECT_GRADE", "ALTER TABLE IQC_PART_SPEC_ITEMS ADD (DEFECT_GRADE VARCHAR2(10))"),
    ("INSPECTION_LEVEL", "ALTER TABLE IQC_PART_SPEC_ITEMS ADD (INSPECTION_LEVEL VARCHAR2(5))"),
    ("AQL", "ALTER TABLE IQC_PART_SPEC_ITEMS ADD (AQL NUMBER)"),
]:
    if col_exists("IQC_PART_SPEC_ITEMS", col):
        print(f"[DDL] {col} 이미 존재 — skip")
    else:
        cur.execute(ddl)
        print(f"[DDL] {col} 컬럼 추가")
cur.execute("COMMENT ON COLUMN IQC_PART_SPEC_ITEMS.DEFECT_GRADE IS '불량등급: CRITICAL/MAJOR/MINOR'")
cur.execute("COMMENT ON COLUMN IQC_PART_SPEC_ITEMS.INSPECTION_LEVEL IS 'ISO 2859-1 검사수준'")
cur.execute("COMMENT ON COLUMN IQC_PART_SPEC_ITEMS.AQL IS '합격품질수준(AQL)'")

# 1) DEFECT_GRADE 공통코드 (멱등)
cur.execute(
    "DELETE FROM COM_CODES WHERE GROUP_CODE='DEFECT_GRADE' AND COMPANY=:1 AND PLANT_CD=:2",
    [CO, PLANT],
)
print(f"[CLEAN] COM_CODES DEFECT_GRADE {cur.rowcount}")
for code, name, order, attr1 in DEFECT_GRADES:
    cur.execute(
        """INSERT INTO COM_CODES
             (GROUP_CODE, DETAIL_CODE, CODE_NAME, CODE_DESC, SORT_ORDER,
              USE_YN, ATTR1, COMPANY, PLANT_CD, CREATED_BY)
           VALUES ('DEFECT_GRADE', :d, :n, '불량등급', :o, 'Y', :a, :co, :pl, :w)""",
        dict(d=code, n=name, o=order, a=attr1, co=CO, pl=PLANT, w=WORKER),
    )

# 검증
print("\n[VERIFY]")
cur.execute("SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME='IQC_PART_SPEC_ITEMS' AND COLUMN_NAME IN ('DEFECT_GRADE','INSPECTION_LEVEL','AQL') ORDER BY COLUMN_NAME")
print("   추가 컬럼:", [r[0] for r in cur.fetchall()])
cur.execute("SELECT COUNT(*) FROM COM_CODES WHERE GROUP_CODE='DEFECT_GRADE' AND COMPANY=:1 AND PLANT_CD=:2", [CO, PLANT])
print("   DEFECT_GRADE 코드:", cur.fetchone()[0])

if COMMIT:
    conn.commit()
    print("\n>>> COMMITTED")
else:
    conn.rollback()
    print("\n>>> DRY-RUN (rolled back). 실제 반영하려면 --commit")
    print("    (LINE 컬럼 ADD는 DDL이라 자동 커밋됨)")
conn.close()
