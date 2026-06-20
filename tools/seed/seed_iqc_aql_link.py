# -*- coding: utf-8 -*-
"""품목관리 · 품목별 IQC 항목관리 · AQL 기준관리 유기적 연결 시드.

세 화면의 데이터가 판정까지 일관되게 연결되도록 빈 필드를 채운다(비파괴 UPDATE).

연결고리:
- AQL 기준관리(AQL_STANDARDS): 검사수준 II + AQL 1.0/2.5 (기존). 판정 시 AQL-II-{값} 조회.
- 품목별 IQC 항목(IQC_PART_SPEC_ITEMS): 검사항목 성격별 불량등급/검사수준(II)/AQL 부여.
  · 전기연속성·락 → CRITICAL(1건 FAIL, AQL 없음)
  · 치수류 → MAJOR, II, AQL 1.0
  · 외관/표면류 → MINOR, II, AQL 2.5
- 품목관리(ITEM_MASTERS): 검사수준 II, Critical 0 / Major 1.0 / Minor 2.5, 기본시료수 동기화.

기존 검사항목 매핑·LSL/USL은 보존하고 등급/검사수준/AQL만 채운다.

사용: python tools/seed/seed_iqc_aql_link.py [--commit]
"""
import json
import os
import sys

import oracledb

COMMIT = "--commit" in sys.argv
CO, PLANT = "40", "1000"
WORKER = "seed"

# 검사항목 성격별 등급/AQL (검사수준은 모두 II)
CRITICAL_ITEMS = {"IQC-CONTINUITY", "IQC-LOCK"}
MAJOR_ITEMS = {
    "IQC-DIMENSION", "IQC-CONN-DIM", "IQC-CRIMP-DIM",
    "IQC-WIRE-OD", "IQC-LENGTH", "IQC-HARDNESS", "IQC-FIT",
}
# 그 외(IQC-VISUAL/PLATING/ADHESION/FLEX/PRINT/WIRE-COLOR 등) → MINOR


def grade_aql(insp_code):
    if insp_code in CRITICAL_ITEMS:
        return ("CRITICAL", None)   # CRITICAL은 AQL 무관(1건 FAIL)
    if insp_code in MAJOR_ITEMS:
        return ("MAJOR", 1.0)
    return ("MINOR", 2.5)


with open(os.path.expanduser("~/.oracle_db_config.json"), encoding="utf-8") as f:
    cfg = json.load(f)["profiles"]["JSHANES"]
conn = oracledb.connect(user=cfg["user"], password=cfg["password"],
                        dsn=f"{cfg['host']}:{cfg['port']}/{cfg['service_name']}")
conn.autocommit = False
cur = conn.cursor()

# ── 0) AQL 기준 존재 확인 (연결 전제) ──
cur.execute(
    "SELECT AQL_CODE FROM AQL_STANDARDS WHERE COMPANY=:1 AND PLANT_CD=:2 AND AQL_CODE IN ('AQL-II-1.0','AQL-II-2.5') AND USE_YN='Y'",
    [CO, PLANT],
)
have = {r[0] for r in cur.fetchall()}
missing = {"AQL-II-1.0", "AQL-II-2.5"} - have
if missing:
    print(f"[WARN] AQL 기준 누락: {missing} — seed_aql_iso2859.py --commit 먼저 실행 필요")

# ── 1) 품목별 IQC 검사항목: 등급/검사수준/AQL 채우기 ──
cur.execute(
    "SELECT ITEM_CODE, SEQ, INSP_ITEM_CODE FROM IQC_PART_SPEC_ITEMS WHERE COMPANY=:1 AND PLANT_CD=:2",
    [CO, PLANT],
)
rows = cur.fetchall()
upd_items = 0
grade_count = {"CRITICAL": 0, "MAJOR": 0, "MINOR": 0}
for item_code, seq, insp_code in rows:
    grade, aql = grade_aql(insp_code)
    grade_count[grade] += 1
    cur.execute(
        """UPDATE IQC_PART_SPEC_ITEMS
             SET DEFECT_GRADE=:g, INSPECTION_LEVEL='II', AQL=:a, UPDATED_BY=:w
           WHERE COMPANY=:co AND PLANT_CD=:pl AND ITEM_CODE=:ic AND SEQ=:sq""",
        dict(g=grade, a=aql, w=WORKER, co=CO, pl=PLANT, ic=item_code, sq=seq),
    )
    upd_items += cur.rowcount
print(f"[UPDATE] IQC_PART_SPEC_ITEMS {upd_items}건 (Critical {grade_count['CRITICAL']} / Major {grade_count['MAJOR']} / Minor {grade_count['MINOR']})")

# ── 2) 품목관리(ITEM_MASTERS): 검사수준/AQL/기본시료수 채우기 ──
# 기본시료수는 품목별 IQC 헤더(IQC_PART_SPECS) 값과 동기화
cur.execute(
    "SELECT ITEM_CODE, SAMPLE_QTY FROM IQC_PART_SPECS WHERE COMPANY=:1 AND PLANT_CD=:2",
    [CO, PLANT],
)
spec_sample = {r[0]: r[1] for r in cur.fetchall()}

cur.execute(
    "SELECT ITEM_CODE FROM ITEM_MASTERS WHERE COMPANY=:1 AND PLANT_CD=:2 AND ITEM_TYPE='RAW_MATERIAL'",
    [CO, PLANT],
)
raw_items = [r[0] for r in cur.fetchall()]
upd_parts = 0
for item_code in raw_items:
    sample = spec_sample.get(item_code, 3)
    cur.execute(
        """UPDATE ITEM_MASTERS
             SET INSPECTION_LEVEL='II', AQL_CRITICAL=0, AQL_MAJOR=1.0, AQL_MINOR=2.5,
                 SAMPLE_QTY=:sm, UPDATED_BY=:w
           WHERE COMPANY=:co AND PLANT_CD=:pl AND ITEM_CODE=:ic""",
        dict(sm=sample, w=WORKER, co=CO, pl=PLANT, ic=item_code),
    )
    upd_parts += cur.rowcount
print(f"[UPDATE] ITEM_MASTERS(RAW_MATERIAL) {upd_parts}건 (검사수준 II / Critical 0·Major 1.0·Minor 2.5)")

# ── 검증 ──
print("\n[VERIFY]")
cur.execute(
    "SELECT DEFECT_GRADE, COUNT(*) FROM IQC_PART_SPEC_ITEMS WHERE COMPANY=:1 AND PLANT_CD=:2 GROUP BY DEFECT_GRADE ORDER BY DEFECT_GRADE",
    [CO, PLANT],
)
for r in cur.fetchall():
    print(f"   IQC 항목 등급 {str(r[0]):9s} {r[1]}")
cur.execute(
    "SELECT COUNT(*) FROM ITEM_MASTERS WHERE COMPANY=:1 AND PLANT_CD=:2 AND ITEM_TYPE='RAW_MATERIAL' AND INSPECTION_LEVEL IS NOT NULL",
    [CO, PLANT],
)
print(f"   품목 검사수준/AQL 설정 {cur.fetchone()[0]}/{len(raw_items)}")

if COMMIT:
    conn.commit()
    print("\n>>> COMMITTED")
else:
    conn.rollback()
    print("\n>>> DRY-RUN (rolled back). 실제 반영하려면 --commit")
conn.close()
