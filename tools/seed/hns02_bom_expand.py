# -*- coding: utf-8 -*-
"""HNS02 BOM 재귀 전개 + 정리 대상 확인 (읽기 전용, DB 무변경)."""
import json, os, sys, collections
import oracledb

with open(os.path.expanduser("~/.oracle_db_config.json"), encoding="utf-8") as f:
    cfg = json.load(f)["profiles"]["JSHANES"]
conn = oracledb.connect(user=cfg["user"], password=cfg["password"],
                        dsn=f"{cfg['host']}:{cfg['port']}/{cfg['service_name']}")
cur = conn.cursor()
CO, PLANT = "40", "1000"
TOP, TOP_QTY = "HNS02", 100

# 1) 품목 타입 맵
cur.execute("SELECT ITEM_CODE, ITEM_TYPE FROM ITEM_MASTERS")
itype = {r[0]: r[1] for r in cur.fetchall()}

# 2) BOM 맵 (rev A 기준): parent -> [(child, qty_per, oper)]
cur.execute("""SELECT PARENT_ITEM_CODE, CHILD_ITEM_CODE, QTY_PER, OPER
               FROM BOM_MASTERS WHERE REVISION='A'""")
bom = collections.defaultdict(list)
for p, c, q, op in cur.fetchall():
    bom[p].append((c, float(q), op))

# 3) 재귀 전개
semi = collections.defaultdict(float)   # 반제품 누적 소요
raw = collections.defaultdict(float)    # 원자재 누적 소요
raw_by_oper = collections.defaultdict(float)  # (item, oper) 단위

def expand(item, mult):
    for c, qper, op in bom.get(item, []):
        tot = mult * qper
        t = itype.get(c, "RAW")
        if t == "SEMI_PRODUCT":
            semi[c] += tot
            expand(c, tot)
        else:  # FINISHED 자식은 없음 → 원자재
            raw[c] += tot
            raw_by_oper[(c, op)] += tot

expand(TOP, TOP_QTY)

print("=== 작업지시(품번) 수량: 완제품 1 + 반제품 %d ===" % len(semi))
print(f"  {TOP:16s} (FINISHED)  {TOP_QTY}")
for k in sorted(semi):
    print(f"  {k:16s} (SEMI)      {int(semi[k])}")
print(f"  -> 작업지시 총 {1+len(semi)}건")

print("\n=== 원자재 총소요량 (%d종) ===" % len(raw))
for k in sorted(raw, key=lambda x: -raw[x]):
    print(f"  {k:12s} {int(raw[k]):>8d}   [{itype.get(k)}]")

# 4) 정리 대상 현황
print("\n=== 기존 HNS02 계열 트랜잭션 현황 ===")
checks = [
 ("JOB_ORDERS", "SELECT COUNT(*) FROM JOB_ORDERS WHERE ITEM_CODE LIKE 'HNS02%'"),
 ("PROD_RESULTS", "SELECT COUNT(*) FROM PROD_RESULTS PR WHERE EXISTS(SELECT 1 FROM JOB_ORDERS J WHERE J.ORDER_NO=PR.ORDER_NO AND J.ITEM_CODE LIKE 'HNS02%')"),
 ("FG_LABELS", "SELECT COUNT(*) FROM FG_LABELS WHERE ITEM_CODE LIKE 'HNS02%'"),
 ("SG_LABELS", "SELECT COUNT(*) FROM SG_LABELS WHERE ITEM_CODE LIKE 'HNS02%'"),
 ("PRODUCT_STOCKS", "SELECT COUNT(*) FROM PRODUCT_STOCKS WHERE ITEM_CODE LIKE 'HNS02%'"),
 ("PRODUCT_TRANSACTIONS", "SELECT COUNT(*) FROM PRODUCT_TRANSACTIONS WHERE ITEM_CODE LIKE 'HNS02%'"),
 ("INSPECT_RESULTS(FG HNS02)", "SELECT COUNT(*) FROM INSPECT_RESULTS WHERE FG_BARCODE IN (SELECT FG_BARCODE FROM FG_LABELS WHERE ITEM_CODE LIKE 'HNS02%')"),
 ("PRODUCT_GENEALOGY", "SELECT COUNT(*) FROM PRODUCT_GENEALOGY WHERE PARENT_KEY LIKE 'HNS02%' OR CHILD_KEY LIKE 'HNS02%'"),
 ("MAT_ARRIVALS(원자재)", "SELECT COUNT(*) FROM MAT_ARRIVALS WHERE ITEM_CODE IN (%s)" % ",".join("'%s'"%k for k in raw)),
 ("MAT_LOTS(원자재)", "SELECT COUNT(*) FROM MAT_LOTS WHERE ITEM_CODE IN (%s)" % ",".join("'%s'"%k for k in raw)),
 ("MAT_STOCKS(원자재)", "SELECT COUNT(*) FROM MAT_STOCKS WHERE ITEM_CODE IN (%s)" % ",".join("'%s'"%k for k in raw)),
 ("MAT_ISSUES(원자재)", "SELECT COUNT(*) FROM MAT_ISSUES WHERE ITEM_CODE IN (%s)" % ",".join("'%s'"%k for k in raw)),
 ("STOCK_TX(원자재)", "SELECT COUNT(*) FROM STOCK_TRANSACTIONS WHERE ITEM_CODE IN (%s)" % ",".join("'%s'"%k for k in raw)),
]
for name, sql in checks:
    try:
        cur.execute(sql); print(f"  {name:28s} {cur.fetchone()[0]}")
    except Exception as e:
        print(f"  {name:28s} ERR {e}")

conn.close()
