# -*- coding: utf-8 -*-
"""AQL 표준 시드 — ISO 2859-1 단일 샘플링 / 정상검사 / 일반검사수준 II.
AQL 1.0 / 2.5 / 4.0. 로트크기 15구간, 화살표(↓↑)는 실효 샘플크기/Ac/Re로 해소.
사용: python tools/seed/seed_aql_iso2859.py [--commit]
"""
import json, os, sys
import oracledb

COMMIT = "--commit" in sys.argv
CO, PLANT = "40", "1000"
LEVEL = "II"
WORKER = "seed"

# 로트크기 구간 (from, to) — ISO 2859-1 검사수준 II
LOTS = [
    (2, 8), (9, 15), (16, 25), (26, 50), (51, 90), (91, 150), (151, 280),
    (281, 500), (501, 1200), (1201, 3200), (3201, 10000), (10001, 35000),
    (35001, 150000), (150001, 500000), (500001, 999999999),
]

# AQL별 15구간 (sampleSize, Ac, Re) — 화살표 해소된 실효값
AQL = {
    "1.0": [(8,0,1),(8,0,1),(8,0,1),(8,0,1),(13,0,1),(20,0,1),(32,1,2),(50,1,2),
            (80,2,3),(125,3,4),(200,5,6),(315,7,8),(500,10,11),(800,14,15),(1250,21,22)],
    "2.5": [(5,0,1),(5,0,1),(5,0,1),(8,0,1),(13,1,2),(20,1,2),(32,2,3),(50,3,4),
            (80,5,6),(125,7,8),(200,10,11),(315,14,15),(500,21,22),(500,21,22),(500,21,22)],
    "4.0": [(3,0,1),(3,0,1),(5,0,1),(8,1,2),(13,1,2),(20,2,3),(32,3,4),(50,5,6),
            (80,7,8),(125,10,11),(200,14,15),(315,21,22),(315,21,22),(315,21,22),(315,21,22)],
}

with open(os.path.expanduser("~/.oracle_db_config.json"), encoding="utf-8") as f:
    cfg = json.load(f)["profiles"]["JSHANES"]
conn = oracledb.connect(user=cfg["user"], password=cfg["password"],
                        dsn=f"{cfg['host']}:{cfg['port']}/{cfg['service_name']}")
conn.autocommit = False
cur = conn.cursor()

def ins(table, **cols):
    keys = list(cols.keys())
    cur.execute(f"INSERT INTO {table} ({','.join(keys)}) VALUES ({','.join(':'+k for k in keys)})", cols)

# 정리(멱등) — 이 시드가 만든 AQL-II-* 만
cur.execute("DELETE FROM AQL_SAMPLING_RULES WHERE AQL_CODE LIKE 'AQL-II-%' AND COMPANY=:1 AND PLANT_CD=:2", [CO, PLANT])
print(f"[CLEAN] AQL_SAMPLING_RULES {cur.rowcount}")
cur.execute("DELETE FROM AQL_STANDARDS WHERE AQL_CODE LIKE 'AQL-II-%' AND COMPANY=:1 AND PLANT_CD=:2", [CO, PLANT])
print(f"[CLEAN] AQL_STANDARDS {cur.rowcount}")

for aql_val, rules in AQL.items():
    code = f"AQL-{LEVEL}-{aql_val}"
    ins("AQL_STANDARDS", COMPANY=CO, PLANT_CD=PLANT, AQL_CODE=code,
        AQL_NAME=f"일반검사수준 {LEVEL} · AQL {aql_val}", INSPECTION_LEVEL=LEVEL,
        AQL_VALUE=float(aql_val), USE_YN="Y",
        REMARK="ISO 2859-1 단일 샘플링/정상검사 (화살표 해소)", CREATED_BY=WORKER)
    for i, ((lf, lt), (n, ac, re)) in enumerate(zip(LOTS, rules), start=1):
        ins("AQL_SAMPLING_RULES", COMPANY=CO, PLANT_CD=PLANT, AQL_CODE=code,
            LOT_QTY_FROM=lf, LOT_QTY_TO=lt, SAMPLE_SIZE=n, ACCEPT_QTY=ac, REJECT_QTY=re,
            SORT_ORDER=i, CREATED_BY=WORKER)

# 검증
print("\n[VERIFY]")
cur.execute("SELECT COUNT(*) FROM AQL_STANDARDS WHERE AQL_CODE LIKE 'AQL-II-%'")
print("   AQL_STANDARDS  ", cur.fetchone()[0])
cur.execute("SELECT COUNT(*) FROM AQL_SAMPLING_RULES WHERE AQL_CODE LIKE 'AQL-II-%'")
print("   SAMPLING_RULES ", cur.fetchone()[0])
cur.execute("SELECT AQL_CODE, LOT_QTY_FROM, LOT_QTY_TO, SAMPLE_SIZE, ACCEPT_QTY, REJECT_QTY FROM AQL_SAMPLING_RULES WHERE AQL_CODE='AQL-II-1.0' AND LOT_QTY_FROM IN (281, 501) ORDER BY LOT_QTY_FROM")
for r in cur.fetchall():
    print("   샘플:", r)

if COMMIT:
    conn.commit(); print("\n>>> COMMITTED")
else:
    conn.rollback(); print("\n>>> DRY-RUN (rolled back). 실제 반영하려면 --commit")
conn.close()
