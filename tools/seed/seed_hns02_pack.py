# -*- coding: utf-8 -*-
"""HNS02 포장(/shipping/pack) 담을 대상 시드 — 외관검사 합격(VISUAL_PASS) FG라벨.
포장 담을대상 = FG_LABELS.status='VISUAL_PASS' AND inspectPassYn='Y' AND boxNo IS NULL.
포장 화면: 박스 생성(품목 HNS02) → 제품담기(아래 FG 바코드 스캔) → 박스마감(→PACKED).
사용: python tools/seed/seed_hns02_pack.py [--commit]
"""
import json, os, sys, datetime
import oracledb

COMMIT = "--commit" in sys.argv
CO, PLANT = "40", "1000"
TOP, QTY = "HNS02", 10
D = "260619"
ORDER = f"WOH-PACK-{D}-01"   # 마커(작업지시 미생성, FG 추적/정리용)
WH_WIP = "WIP_MAIN"          # 완제품 재고 창고(키팅 입고 흐름)
WORKER = "seed"

with open(os.path.expanduser("~/.oracle_db_config.json"), encoding="utf-8") as f:
    cfg = json.load(f)["profiles"]["JSHANES"]
conn = oracledb.connect(user=cfg["user"], password=cfg["password"],
                        dsn=f"{cfg['host']}:{cfg['port']}/{cfg['service_name']}")
conn.autocommit = False
cur = conn.cursor()
now = datetime.datetime.now()

def ins(table, **cols):
    keys = list(cols.keys())
    cur.execute(f"INSERT INTO {table} ({','.join(keys)}) VALUES ({','.join(':'+k for k in keys)})", cols)

# 정리(멱등): 이 포장 시드가 만든 FG라벨 + 박스마감으로 PACKED 된 것 + 관련 박스
cur.execute(f"SELECT BOX_NO FROM FG_LABELS WHERE ORDER_NO='{ORDER}' AND BOX_NO IS NOT NULL")
boxes = [r[0] for r in cur.fetchall()]
cur.execute(f"DELETE FROM FG_LABELS WHERE ORDER_NO='{ORDER}'")
print(f"[CLEAN] FG_LABELS {cur.rowcount}")
for b in boxes:
    cur.execute("DELETE FROM BOX_MASTERS WHERE BOX_NO=:1", [b])
# 제품재고/수불 정리(멱등)
cur.execute(f"DELETE FROM PRODUCT_TRANSACTIONS WHERE TRANS_NO LIKE 'PTH-PACK-{D}%'")
cur.execute(f"DELETE FROM PRODUCT_STOCKS WHERE ITEM_CODE='{TOP}' AND WAREHOUSE_CODE='{WH_WIP}' AND ITEM_TYPE='FINISHED'")

# FG라벨 VISUAL_PASS 발행 (포장 담을 대상). FG_BARCODE는 운영 시퀀스로 채번
fg_list = []
for i in range(1, QTY + 1):
    cur.execute("SELECT SEQ_FG_BARCODE.NEXTVAL FROM DUAL")
    fg = f"FG{D}{cur.fetchone()[0]:05d}"
    fg_list.append(fg)
    ins("FG_LABELS", FG_BARCODE=fg, ITEM_CODE=TOP, ORDER_NO=ORDER, STATUS="VISUAL_PASS",
        INSPECT_PASS_YN="Y", BOX_NO=None, REPRINT_COUNT=0, ISSUED_AT=now,
        COMPANY=CO, PLANT_CD=PLANT)

# 제품재고(PRODUCT_STOCKS) +QTY — FG라벨 수량과 정합. 완제품 WIP_MAIN 창고(키팅 입고 흐름)
ins("PRODUCT_STOCKS", WAREHOUSE_CODE=WH_WIP, ITEM_CODE=TOP, ITEM_TYPE="FINISHED",
    QTY=QTY, RESERVED_QTY=0, AVAILABLE_QTY=QTY, STATUS="NORMAL", VERSION=1,
    ORDER_NO=ORDER, COMPANY=CO, PLANT_CD=PLANT)
ins("PRODUCT_TRANSACTIONS", TRANS_NO=f"PTH-PACK-{D}-00001", TRANS_TYPE="WIP_IN", TRANS_DATE=now,
    ITEM_CODE=TOP, QTY=QTY, STATUS="DONE", ORDER_NO=ORDER, COMPANY=CO, PLANT_CD=PLANT, CREATED_BY=WORKER)

# 검증
print("\n[VERIFY]")
checks = [
 ("포장대상 FG(VISUAL_PASS, boxNo NULL)", f"SELECT COUNT(*) FROM FG_LABELS WHERE ITEM_CODE='{TOP}' AND STATUS='VISUAL_PASS' AND INSPECT_PASS_YN='Y' AND BOX_NO IS NULL AND ORDER_NO='{ORDER}'"),
 ("FG 합계(ORDER 마커)", f"SELECT COUNT(*) FROM FG_LABELS WHERE ORDER_NO='{ORDER}'"),
 ("제품재고 PRODUCT_STOCKS(HNS02)", f"SELECT NVL(SUM(QTY),0) FROM PRODUCT_STOCKS WHERE ITEM_CODE='{TOP}' AND WAREHOUSE_CODE='{WH_WIP}'"),
 ("제품수불 WIP_IN", f"SELECT NVL(SUM(QTY),0) FROM PRODUCT_TRANSACTIONS WHERE TRANS_NO LIKE 'PTH-PACK-{D}%'"),
]
for name, sql in checks:
    cur.execute(sql); print(f"   {name:38s} {cur.fetchone()[0]}")
print("   포장 스캔용 FG 바코드:", ", ".join(fg_list))

if COMMIT:
    conn.commit(); print("\n>>> COMMITTED")
else:
    conn.rollback(); print("\n>>> DRY-RUN (rolled back). 실제 반영하려면 --commit")
conn.close()
