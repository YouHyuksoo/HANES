# -*- coding: utf-8 -*-
"""HNS02 제품재고 100개 BOM 완전 다단계 정합 시드.
spec: docs/superpowers/specs/2026-06-19-hns02-product-stock-100-seed-design.md
사용: python tools/seed/seed_hns02_stock100.py [--commit]
  --commit 없으면 dry-run(rollback). 검증 쿼리는 양쪽 모두 출력.
"""
import json, os, sys, collections, datetime
import oracledb

COMMIT = "--commit" in sys.argv
CO, PLANT = "40", "1000"
TOP, TOP_QTY = "HNS02", 100
SG_PACK = 5                       # SG 묶음 단위
WH_RAW, WH_WIP, WH_FG = "W001", "WIP_MAIN", "FG_MAIN"
VENDOR_ID, VENDOR_NM = "VND-001", "한국단자공업"
D = "260619"                     # YYMMDD 시드 마커
EQ_TEST, EQ_AINSP = "EQ-TEST-01", "EQ-AINSP-01"
WORKER = "seed"

with open(os.path.expanduser("~/.oracle_db_config.json"), encoding="utf-8") as f:
    cfg = json.load(f)["profiles"]["JSHANES"]
conn = oracledb.connect(user=cfg["user"], password=cfg["password"],
                        dsn=f"{cfg['host']}:{cfg['port']}/{cfg['service_name']}")
conn.autocommit = False
cur = conn.cursor()

def ins(table, **cols):
    keys = list(cols.keys())
    sql = f"INSERT INTO {table} ({','.join(keys)}) VALUES ({','.join(':'+k for k in keys)})"
    cur.execute(sql, cols)

# ---------- 0) BOM 전개 ----------
cur.execute("SELECT ITEM_CODE, ITEM_TYPE FROM ITEM_MASTERS")
itype = {r[0]: r[1] for r in cur.fetchall()}
cur.execute("SELECT PARENT_ITEM_CODE,CHILD_ITEM_CODE,QTY_PER,OPER FROM BOM_MASTERS WHERE REVISION='A'")
bom = collections.defaultdict(list)
for p, c, q, op in cur.fetchall():
    bom[p].append((c, float(q), op))

semi = collections.defaultdict(float)
raw = collections.defaultdict(float)
raw_parent = {}      # 원자재 -> 소비 반제품(첫 parent)
parent_of = {}       # 반제품 -> 상위 품번 (작업지시 트리)
def expand(item, mult):
    for c, qper, op in bom.get(item, []):
        tot = mult * qper
        if itype.get(c) == "SEMI_PRODUCT":
            semi[c] += tot
            parent_of.setdefault(c, item)
            expand(c, tot)
        else:
            raw[c] += tot
            raw_parent.setdefault(c, item)
expand(TOP, TOP_QTY)

# 작업지시 대상: 완제품 + 반제품
wo_items = [TOP] + sorted(semi.keys())
wo_qty = {TOP: TOP_QTY}
wo_qty.update({k: int(v) for k, v in semi.items()})
raw_qty = {k: int(v) for k, v in raw.items()}
print(f"[BOM] 작업지시 {len(wo_items)}건, 원자재 {len(raw_qty)}종")

# 라우팅 코드 맵
cur.execute("SELECT ITEM_CODE, ROUTING_CODE FROM ROUTING_GROUPS WHERE COMPANY=:1 AND PLANT_CD=:2", [CO, PLANT])
routing = {r[0]: r[1] for r in cur.fetchall()}

now = datetime.datetime.now()
def ts(offset_min=0):
    return now + datetime.timedelta(minutes=offset_min)

# ---------- 1) 정리 (논리 역순) ----------
print("[CLEAN] 기존 HNS02 트랜잭션 정리...")
hns_orders = "(SELECT ORDER_NO FROM JOB_ORDERS WHERE ITEM_CODE LIKE 'HNS02%')"
clean_sqls = [
 f"DELETE FROM PRODUCT_GENEALOGY WHERE PARENT_KEY LIKE 'HNS02%' OR CHILD_KEY LIKE 'HNS02%' OR PARENT_KEY LIKE 'FGH{D}%' OR PARENT_KEY LIKE 'SGH{D}%' OR CHILD_KEY LIKE 'SGH{D}%'",
 f"DELETE FROM INSPECT_RESULTS WHERE FG_BARCODE IN (SELECT FG_BARCODE FROM FG_LABELS WHERE ITEM_CODE LIKE 'HNS02%') OR RESULT_NO LIKE 'IRH{D}%'",
 "DELETE FROM FG_LABELS WHERE ITEM_CODE LIKE 'HNS02%'",
 "DELETE FROM SG_LABELS WHERE ITEM_CODE LIKE 'HNS02%'",
 "DELETE FROM PRODUCT_TRANSACTIONS WHERE ITEM_CODE LIKE 'HNS02%'",
 "DELETE FROM PRODUCT_STOCKS WHERE ITEM_CODE LIKE 'HNS02%'",
 f"DELETE FROM PROD_RESULTS WHERE ORDER_NO IN {hns_orders} OR RESULT_NO LIKE 'PRH-{D}%'",
 f"DELETE FROM MAT_ISSUES WHERE ORDER_NO IN {hns_orders} OR ISSUE_NO LIKE 'ISH-{D}%'",
 f"DELETE FROM STOCK_TRANSACTIONS WHERE TRANS_NO LIKE 'STH-{D}%' OR MAT_UID LIKE 'VH1-RM{D}%'",
 f"DELETE FROM MAT_STOCKS WHERE MAT_UID LIKE 'VH1-RM{D}%'",
 f"DELETE FROM MAT_RECEIVINGS WHERE RECEIVE_NO LIKE 'RVH-{D}%' OR MAT_UID LIKE 'VH1-RM{D}%'",
 f"DELETE FROM MAT_LOTS WHERE MAT_UID LIKE 'VH1-RM{D}%'",
 f"DELETE FROM IQC_LOGS WHERE MAT_UID LIKE 'VH1-RM{D}%'",
 f"DELETE FROM MAT_ARRIVAL_STOCKS WHERE MAT_UID LIKE 'VH1-RM{D}%'",
 f"DELETE FROM MAT_ARRIVALS WHERE ARRIVAL_NO LIKE 'ARH-{D}%'",
 f"DELETE FROM MAT_ISSUE_REQUEST_ITEMS WHERE REQUEST_ID IN (SELECT REQUEST_NO FROM MAT_ISSUE_REQUESTS WHERE ORDER_NO IN {hns_orders})",
 f"DELETE FROM MAT_ISSUE_REQUESTS WHERE ORDER_NO IN {hns_orders}",
 "DELETE FROM JOB_ORDERS WHERE ITEM_CODE LIKE 'HNS02%'",
 f"DELETE FROM PURCHASE_ORDER_ITEMS WHERE PO_ID LIKE 'POH-{D}%'",
 f"DELETE FROM PURCHASE_ORDERS WHERE PO_NO LIKE 'POH-{D}%'",
]
for s in clean_sqls:
    try:
        cur.execute(s)
        if cur.rowcount:
            print(f"   - {cur.rowcount:5d}  {s[:60]}")
    except Exception as e:
        print(f"   ! SKIP {s[:50]} :: {e}")

# ---------- 2) 구매발주 ----------
PO = f"POH-{D}-001"
ins("PURCHASE_ORDERS", PO_NO=PO, PARTNER_ID=VENDOR_ID, PARTNER_NAME=VENDOR_NM,
    STATUS="CLOSED", USE_TYPE="PROD", ORDER_DATE=ts(0), DUE_DATE=ts(0),
    REMARK="HNS02 100개 시드", COMPANY=CO, PLANT_CD=PLANT, CREATED_BY=WORKER)
for i, (item, qty) in enumerate(sorted(raw_qty.items()), start=1):
    ins("PURCHASE_ORDER_ITEMS", PO_ID=PO, ITEM_CODE=item, ORDER_QTY=qty, RECEIVED_QTY=qty,
        UNIT_PRICE=100, SEQ=i, LINE_NO=i, REV_NO=1, LINE_STATUS="CLOSED",
        COMPANY=CO, PLANT_CD=PLANT, CREATED_BY=WORKER)

# ---------- 3) 원자재 입하→IQC→입고→LOT→재고→수불(MAT_IN) ----------
mat_uid = {}        # 원자재 -> MAT_UID
stx = 0             # stock tx 카운터
def stx_no():
    global stx; stx += 1; return f"STH-{D}-{stx:05d}"
for i, (item, qty) in enumerate(sorted(raw_qty.items()), start=1):
    arr = f"ARH-{D}-{i:03d}"
    rcv = f"RVH-{D}-{i:03d}"
    uid = f"VH1-RM{D}-{i:05d}"
    mat_uid[item] = uid
    ins("MAT_ARRIVALS", ARRIVAL_NO=arr, ITEM_CODE=item, QTY=qty, VENDOR_ID=VENDOR_ID,
        VENDOR_NAME=VENDOR_NM, WAREHOUSE_CODE=WH_RAW, ARRIVAL_DATE=ts(0), ARRIVAL_TYPE="PO",
        STATUS="DONE", IQC_STATUS="PASS", PO_NO=PO, COMPANY=CO, PLANT_CD=PLANT, CREATED_BY=WORKER)
    ins("IQC_LOGS", ARRIVAL_NO=arr, ITEM_CODE=item, MAT_UID=uid, INSPECT_TYPE="INITIAL",
        RESULT="PASS", STATUS="DONE", SEQ=i, INSPECT_DATE=ts(1), INSPECTOR_NAME=WORKER,
        COMPANY=CO, PLANT_CD=PLANT, CREATED_BY=WORKER)
    ins("MAT_RECEIVINGS", RECEIVE_NO=rcv, MAT_UID=uid, ITEM_CODE=item, QTY=qty,
        WAREHOUSE_CODE=WH_RAW, RECEIVE_DATE=ts(2), STATUS="DONE", ARRIVAL_NO=arr,
        COMPANY=CO, PLANT_CD=PLANT, CREATED_BY=WORKER)
    ins("MAT_LOTS", MAT_UID=uid, ITEM_CODE=item, INIT_QTY=qty, CURRENT_QTY=0, VENDOR=VENDOR_NM,
        IQC_STATUS="PASS", STATUS="DEPLETED", SPECIAL_ACCEPT_YN="N", ARRIVAL_NO=arr, PO_NO=PO,
        RECV_DATE=ts(2), COMPANY=CO, PLANT_CD=PLANT, CREATED_BY=WORKER)
    ins("MAT_STOCKS", WAREHOUSE_CODE=WH_RAW, ITEM_CODE=item, MAT_UID=uid, QTY=0,
        RESERVED_QTY=0, AVAILABLE_QTY=0, COMPANY=CO, PLANT_CD=PLANT, CREATED_BY=WORKER)
    ins("STOCK_TRANSACTIONS", TRANS_NO=stx_no(), TRANS_TYPE="MAT_IN", TRANS_DATE=ts(2),
        ITEM_CODE=item, MAT_UID=uid, QTY=qty, STATUS="DONE", COMPANY=CO, PLANT_CD=PLANT, CREATED_BY=WORKER)

# ---------- 4) 작업지시 17건 (DONE) ----------
wo_no = {}
for idx, item in enumerate(wo_items, start=1):
    wo = f"WOH-{D}-{idx:02d}"
    wo_no[item] = wo
for item in wo_items:
    parent_item = parent_of.get(item)
    ins("JOB_ORDERS", ORDER_NO=wo_no[item], ITEM_CODE=item, PLAN_QTY=wo_qty[item],
        GOOD_QTY=wo_qty[item], DEFECT_QTY=0, PRIORITY=5, STATUS="DONE", ERP_SYNC_YN="N",
        ROUTING_CODE=routing.get(item, item),
        PARENT_ID=(wo_no[parent_item] if parent_item in wo_no else None),
        COMPANY=CO, PLANT_CD=PLANT, CREATED_BY=WORKER)

# ---------- 5) 자재 소비(출고) MAT_ISSUE + STOCK_TX(MAT_OUT) ----------
isn = 0
for i, (item, qty) in enumerate(sorted(raw_qty.items()), start=1):
    isn += 1
    consumer = raw_parent[item]
    ins("MAT_ISSUES", ISSUE_NO=f"ISH-{D}-{isn:03d}", ORDER_NO=wo_no.get(consumer),
        MAT_UID=mat_uid[item], ISSUE_QTY=qty, ISSUE_DATE=ts(10), ISSUE_TYPE="PROD",
        STATUS="DONE", ISSUER_ID=WORKER, ISSUER_NAME=WORKER, COMPANY=CO, PLANT_CD=PLANT, CREATED_BY=WORKER)
    ins("STOCK_TRANSACTIONS", TRANS_NO=stx_no(), TRANS_TYPE="MAT_OUT", TRANS_DATE=ts(10),
        ITEM_CODE=item, MAT_UID=mat_uid[item], QTY=-qty, STATUS="DONE",
        COMPANY=CO, PLANT_CD=PLANT, CREATED_BY=WORKER)

# ---------- 6) 생산실적 17건 + 반제품 재고/수불 + SG라벨 ----------
pr_no = {}
ptx = 0
def ptx_no():
    global ptx; ptx += 1; return f"PTH-{D}-{ptx:05d}"
for idx, item in enumerate(wo_items, start=1):
    pr = f"PRH-{D}-{idx:03d}"
    pr_no[item] = pr
    rc = routing.get(item, item)
    # 라우팅 마지막/대표 공정
    proc = "SASSY" if item == TOP else ("TAPPN" if item == "HNS02_FA" else rc)
    ins("PROD_RESULTS", RESULT_NO=pr, ORDER_NO=wo_no[item], GOOD_QTY=wo_qty[item], DEFECT_QTY=0,
        STATUS="DONE", PROCESS_CODE=proc, EQUIP_CODE=None, WORKER_ID=WORKER,
        START_TIME=ts(20), END_TIME=ts(30), COMPANY=CO, PLANT_CD=PLANT, CREATED_BY=WORKER)

# 반제품: WIP 입고(+) → 상위 소비(-) → 최종 QTY=0, 수불 2건
for item in sorted(semi.keys()):
    qty = wo_qty[item]
    ins("PRODUCT_STOCKS", WAREHOUSE_CODE=WH_WIP, ITEM_CODE=item, ITEM_TYPE="SEMI_PRODUCT",
        QTY=0, RESERVED_QTY=0, AVAILABLE_QTY=0, STATUS="NORMAL", VERSION=1,
        ORDER_NO=wo_no[item], COMPANY=CO, PLANT_CD=PLANT)
    ins("PRODUCT_TRANSACTIONS", TRANS_NO=ptx_no(), TRANS_TYPE="WIP_IN", TRANS_DATE=ts(31),
        ITEM_CODE=item, QTY=qty, STATUS="DONE", ORDER_NO=wo_no[item], COMPANY=CO, PLANT_CD=PLANT, CREATED_BY=WORKER)
    ins("PRODUCT_TRANSACTIONS", TRANS_NO=ptx_no(), TRANS_TYPE="WIP_OUT", TRANS_DATE=ts(32),
        ITEM_CODE=item, QTY=-qty, STATUS="DONE", ORDER_NO=wo_no[item], COMPANY=CO, PLANT_CD=PLANT, CREATED_BY=WORKER)

# SG 라벨 (HNS02_FA, 5개 묶음 → 20건, 전량 CONSUMED)
sg_barcodes = []
n_sg = TOP_QTY // SG_PACK
for i in range(1, n_sg + 1):
    sg = f"SGH{D}-{i:05d}"
    sg_barcodes.append(sg)
    ins("SG_LABELS", SG_BARCODE=sg, ITEM_CODE="HNS02_FA", ORDER_NO=wo_no["HNS02_FA"],
        ISSUE_PROCESS_CODE="TAPPN", CURRENT_PROCESS_CODE="SASSY", MOUNTED_EQUIP_CODE=None,
        WAREHOUSE_CODE=WH_WIP, INIT_QTY=SG_PACK, REMAIN_QTY=0, STATUS="CONSUMED",
        RESULT_NO=pr_no["HNS02_FA"], WORKER_ID=WORKER, ISSUED_AT=ts(25), COMPANY=CO, PLANT_CD=PLANT)

# ---------- 7) 완제품 FG라벨 100 + 제품재고 100 + 수불 ----------
fg_barcodes = []
for i in range(1, TOP_QTY + 1):
    fg = f"FGH{D}-{i:05d}"
    fg_barcodes.append(fg)
    ins("FG_LABELS", FG_BARCODE=fg, ITEM_CODE=TOP, ORDER_NO=wo_no[TOP], STATUS="PACKED",
        REPRINT_COUNT=0, INSPECT_PASS_YN="Y", EQUIP_CODE=EQ_TEST, WORKER_ID=WORKER,
        ISSUED_AT=ts(40), COMPANY=CO, PLANT_CD=PLANT)
ins("PRODUCT_STOCKS", WAREHOUSE_CODE=WH_FG, ITEM_CODE=TOP, ITEM_TYPE="FINISHED",
    QTY=TOP_QTY, RESERVED_QTY=0, AVAILABLE_QTY=TOP_QTY, STATUS="NORMAL", VERSION=1,
    ORDER_NO=wo_no[TOP], COMPANY=CO, PLANT_CD=PLANT)
ins("PRODUCT_TRANSACTIONS", TRANS_NO=ptx_no(), TRANS_TYPE="FG_IN", TRANS_DATE=ts(45),
    ITEM_CODE=TOP, QTY=TOP_QTY, STATUS="DONE", ORDER_NO=wo_no[TOP], COMPANY=CO, PLANT_CD=PLANT, CREATED_BY=WORKER)

# ---------- 8) 검사이력 200건 (FG 100 × AINSP+OINSP) ----------
irn = 0
for fg in fg_barcodes:
    for itype_, eq in (("AINSP", EQ_TEST), ("OINSP", EQ_AINSP)):
        irn += 1
        ins("INSPECT_RESULTS", RESULT_NO=f"IRH{D}-{irn:05d}", FG_BARCODE=fg,
            PROD_RESULT_ID=pr_no[TOP], INSPECT_TYPE=itype_, INSPECT_SCOPE="FULL",
            PASS_YN="Y", EQUIP_CODE=eq, INSPECTOR_ID=WORKER, INSPECT_TIME=ts(42),
            COMPANY=CO, PLANT_CD=PLANT)

# ---------- 9) Genealogy FG←SG ----------
for i, fg in enumerate(fg_barcodes):
    sg = sg_barcodes[i // SG_PACK]
    cur.execute("SELECT SEQ_PROD_GENEALOGY.NEXTVAL FROM DUAL")
    gid = cur.fetchone()[0]
    ins("PRODUCT_GENEALOGY", GENEALOGY_ID=gid, PARENT_TYPE="FG", PARENT_KEY=fg,
        CHILD_TYPE="SG", CHILD_KEY=sg, QTY=1, COMPANY=CO, PLANT_CD=PLANT)

# ---------- 검증 ----------
print("\n[VERIFY]")
checks = [
 ("PRODUCT_STOCKS HNS02 FG QTY", "SELECT NVL(SUM(QTY),0) FROM PRODUCT_STOCKS WHERE ITEM_CODE='HNS02' AND WAREHOUSE_CODE='FG_MAIN'"),
 ("FG_LABELS HNS02", "SELECT COUNT(*) FROM FG_LABELS WHERE ITEM_CODE='HNS02'"),
 ("SG_LABELS HNS02_FA", "SELECT COUNT(*) FROM SG_LABELS WHERE ITEM_CODE='HNS02_FA'"),
 ("JOB_ORDERS HNS02 DONE", "SELECT COUNT(*) FROM JOB_ORDERS WHERE ITEM_CODE LIKE 'HNS02%' AND STATUS='DONE'"),
 ("PROD_RESULTS 시드", f"SELECT COUNT(*) FROM PROD_RESULTS WHERE RESULT_NO LIKE 'PRH-{D}%'"),
 ("INSPECT_RESULTS 시드", f"SELECT COUNT(*) FROM INSPECT_RESULTS WHERE RESULT_NO LIKE 'IRH{D}%'"),
 ("반제품 WIP 잔량합", "SELECT NVL(SUM(QTY),0) FROM PRODUCT_STOCKS WHERE WAREHOUSE_CODE='WIP_MAIN' AND ITEM_CODE LIKE 'HNS02%'"),
 ("원자재 시드 MAT_STOCKS 잔량", f"SELECT NVL(SUM(QTY),0) FROM MAT_STOCKS WHERE MAT_UID LIKE 'VH1-RM{D}%'"),
 ("STOCK_TX 합(IN+OUT=0)", f"SELECT NVL(SUM(QTY),0) FROM STOCK_TRANSACTIONS WHERE TRANS_NO LIKE 'STH-{D}%'"),
 ("genealogy FG<-SG", f"SELECT COUNT(*) FROM PRODUCT_GENEALOGY WHERE PARENT_KEY LIKE 'FGH{D}%'"),
 ("SHIPMENT_LOGS(무변화확인)", "SELECT COUNT(*) FROM SHIPMENT_LOGS"),
]
for name, sql in checks:
    cur.execute(sql); print(f"   {name:32s} {cur.fetchone()[0]}")

if COMMIT:
    conn.commit(); print("\n>>> COMMITTED")
else:
    conn.rollback(); print("\n>>> DRY-RUN (rolled back). 실제 반영하려면 --commit")
conn.close()
