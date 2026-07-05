# -*- coding: utf-8 -*-
"""PROCESS_MASTERS 정비 — THN 제조공정 흐름도(03.제조공정_THN.pdf) 기준.

설계: docs/specs/2026-06-20-process-master-pdf-reorg-design.md

- LINE_TYPE 컬럼 추가(LV/HV/CM). nullable, 비파괴.
- 기존 18개: 코드 유지, PROCESS_NAME/LINE_TYPE/SORT_ORDER 정비(UPDATE).
- 신규 23개(LV 17·HV 4·CM 2): 없을 때만 INSERT.
- 미사용 잉여 PRC-* 4개: USE_YN='N' 비활성.

CRITICAL: PROCESS_CODE는 23개 테이블이 참조 → 절대 변경/삭제 안 함.

사용: python tools/seed/seed_process_master_pdf.py [--commit]
"""
import json
import os
import sys

import oracledb

COMMIT = "--commit" in sys.argv
CO, PLANT = "40", "1000"
WORKER = "seed"

# 기존 18개 정비: (CODE, 정비명, LINE_TYPE, SORT_ORDER)
EXISTING = [
    ("ATCUT", "자동절단", "LV", 1010),
    ("ATCNS", "자동절단탈피", "LV", 1020),
    ("STRPB", "양단탈피", "LV", 1030),
    ("CRMPF", "전단압착", "LV", 1040),
    ("CRMPR", "후단압착", "LV", 1050),
    ("CRMPB", "양단압착", "LV", 1060),
    ("WELDR", "초음파융착", "LV", 1120),
    ("TUBHT", "열수축", "LV", 1130),
    ("HEXCP", "육각압착", "HV", 2040),
    ("SHDRM", "실드편조절단", "HV", 2020),
    ("TINSP", "단자검사", "CM", 3010),
    ("AINSP", "통합검사", "CM", 3020),
    ("OINSP", "육안검사", "CM", 3030),
    ("SASSY", "서브작업", "CM", 3110),
    ("MASSY", "조립", "CM", 3120),
    ("MTASY", "자재장착", "CM", 3130),
    ("AUXMT", "부자재부착", "CM", 3140),
    ("TAPPN", "배판작업(테이핑)", "CM", 3150),
]

# 신규 23개: (CODE, 명칭, PROCESS_TYPE, PROCESS_CATEGORY, LINE_TYPE, SORT_ORDER)
NEW = [
    # 저전압 LV (17)
    ("SHDCT", "실드절단", "CUTTING", "WIRE", "LV", 1070),
    ("SACRP", "반자동압착", "CRIMPING", "TERMINAL", "LV", 1090),
    ("MIDST", "중간탈피", "STRIPPING", "WIRE", "LV", 1100),
    ("SJCRP", "S/JOINT압착", "CRIMPING", "TERMINAL", "LV", 1110),
    ("ATAPE", "자동테이핑", "ASSEMBLY", "ASSEMBLY", "LV", 1140),
    ("TWIST", "트위스트", "ASSEMBLY", "WIRE", "LV", 1150),
    ("CRINS", "절압물검사", "INSPECTION", "INSPECTION", "LV", 1160),
    ("SACMB", "반제품조합", "ASSEMBLY", "ASSEMBLY", "LV", 1170),
    ("TAPNG", "테이핑", "ASSEMBLY", "ASSEMBLY", "LV", 1180),
    ("PROTC", "프로텍트체결", "ASSEMBLY", "ASSEMBLY", "LV", 1200),
    ("STINS", "구조검사", "INSPECTION", "INSPECTION", "LV", 1210),
    ("CIINS", "회로검사", "INSPECTION", "INSPECTION", "LV", 1220),
    ("FUSIN", "퓨즈삽입/토크체결", "ASSEMBLY", "ASSEMBLY", "LV", 1230),
    ("VISIN", "비전검사", "INSPECTION", "INSPECTION", "LV", 1240),
    ("RLYIN", "릴레이기능검사", "INSPECTION", "INSPECTION", "LV", 1250),
    ("FINSH", "마무리", "ASSEMBLY", "ASSEMBLY", "LV", 1260),
    ("ABAG", "A/BAG제작", "ASSEMBLY", "ASSEMBLY", "LV", 1900),
    # 고전압 HV (4)
    ("CBLCT", "케이블절단", "CUTTING", "WIRE", "HV", 2010),
    ("TMCRP", "단자압착", "CRIMPING", "TERMINAL", "HV", 2050),
    ("QCINS", "QC검사", "INSPECTION", "INSPECTION", "HV", 2060),
    ("ATAPG", "자동TAP'G", "ASSEMBLY", "ASSEMBLY", "HV", 2080),
    # 공통 CM (2)
    ("AUXIN", "부자재삽입", "ASSEMBLY", "ASSEMBLY", "CM", 3160),
    ("GRMMT", "그로멧체결", "ASSEMBLY", "ASSEMBLY", "CM", 3170),
]

# 미사용 잉여 비활성
DEACTIVATE = ["PRC-CUT", "PRC-STRIP", "PRC-CRIMP", "PRC-TEST"]

with open(os.path.expanduser("~/.oracle_db_config.json"), encoding="utf-8") as f:
    cfg = json.load(f)["profiles"]["JSHANES"]
conn = oracledb.connect(user=cfg["user"], password=cfg["password"],
                        dsn=f"{cfg['host']}:{cfg['port']}/{cfg['service_name']}")
conn.autocommit = False
cur = conn.cursor()

# 0) LINE_TYPE 컬럼 추가 (없을 때만) — DDL은 자동 커밋
cur.execute("SELECT COUNT(*) FROM USER_TAB_COLUMNS WHERE TABLE_NAME='PROCESS_MASTERS' AND COLUMN_NAME='LINE_TYPE'")
if cur.fetchone()[0] == 0:
    cur.execute("ALTER TABLE PROCESS_MASTERS ADD (LINE_TYPE VARCHAR2(2))")
    cur.execute("COMMENT ON COLUMN PROCESS_MASTERS.LINE_TYPE IS '공정 라인구분: LV=저전압 HV=고전압 CM=공통'")
    print("[DDL] LINE_TYPE 컬럼 추가")
else:
    print("[DDL] LINE_TYPE 이미 존재 — skip")

# 1) 기존 18개 정비
upd = 0
for code, name, line, sort in EXISTING:
    cur.execute(
        """UPDATE PROCESS_MASTERS
             SET PROCESS_NAME=:n, LINE_TYPE=:l, SORT_ORDER=:s, UPDATED_BY=:w
           WHERE PROCESS_CODE=:c AND COMPANY=:co AND PLANT_CD=:pl""",
        dict(n=name, l=line, s=sort, w=WORKER, c=code, co=CO, pl=PLANT),
    )
    upd += cur.rowcount
print(f"[UPDATE] 기존 공정 정비 {upd}/{len(EXISTING)}")

# 2) 신규 23개 INSERT (없을 때만)
ins = 0
for code, name, ptype, pcat, line, sort in NEW:
    cur.execute(
        "SELECT COUNT(*) FROM PROCESS_MASTERS WHERE PROCESS_CODE=:c AND COMPANY=:co AND PLANT_CD=:pl",
        dict(c=code, co=CO, pl=PLANT),
    )
    if cur.fetchone()[0]:
        continue
    cur.execute(
        """INSERT INTO PROCESS_MASTERS
             (PROCESS_CODE, PROCESS_NAME, PROCESS_TYPE, PROCESS_CATEGORY,
              LINE_TYPE, SORT_ORDER, USE_YN, COMPANY, PLANT_CD, CREATED_BY)
           VALUES (:c, :n, :t, :cat, :l, :s, 'Y', :co, :pl, :w)""",
        dict(c=code, n=name, t=ptype, cat=pcat, l=line, s=sort, co=CO, pl=PLANT, w=WORKER),
    )
    ins += cur.rowcount
print(f"[INSERT] 신규 공정 {ins}/{len(NEW)}")

# 3) 미사용 잉여 비활성
deact = 0
for code in DEACTIVATE:
    cur.execute(
        "UPDATE PROCESS_MASTERS SET USE_YN='N', UPDATED_BY=:w WHERE PROCESS_CODE=:c AND COMPANY=:co AND PLANT_CD=:pl",
        dict(w=WORKER, c=code, co=CO, pl=PLANT),
    )
    deact += cur.rowcount
print(f"[DEACTIVATE] PRC-* 비활성 {deact}/{len(DEACTIVATE)}")

# 검증
print("\n[VERIFY]")
cur.execute(
    "SELECT LINE_TYPE, COUNT(*) FROM PROCESS_MASTERS WHERE COMPANY=:1 AND PLANT_CD=:2 AND USE_YN='Y' GROUP BY LINE_TYPE ORDER BY LINE_TYPE",
    [CO, PLANT],
)
for r in cur.fetchall():
    print(f"   LINE_TYPE {str(r[0]):4s} 활성 {r[1]}")
cur.execute("SELECT COUNT(*) FROM PROCESS_MASTERS WHERE COMPANY=:1 AND PLANT_CD=:2 AND USE_YN='Y'", [CO, PLANT])
print(f"   활성 총계 {cur.fetchone()[0]}")
cur.execute("SELECT COUNT(*) FROM PROCESS_MASTERS WHERE COMPANY=:1 AND PLANT_CD=:2 AND USE_YN='N'", [CO, PLANT])
print(f"   비활성   {cur.fetchone()[0]}")

if COMMIT:
    conn.commit()
    print("\n>>> COMMITTED")
else:
    conn.rollback()
    print("\n>>> DRY-RUN (rolled back). 실제 반영하려면 --commit")
    print("    (주의: LINE_TYPE 컬럼 ADD는 DDL이라 자동 커밋됨 — 컬럼 자체는 이미 추가됨)")
conn.close()
