# -*- coding: utf-8 -*-
"""HNS02 통전검사 가능 시드 (검사 대기 작업지시 + 생산실적).
발행모드 ON_INSPECT: 통전검사(/inspection/result, GET /quality/continuity-inspect/job-orders)는
JOB_ORDERS.status IN (RUNNING/IN_PROGRESS/WAITING) 작업지시를 대상으로 하고,
PASS 시 FG_LABELS를 자동 채번(과발행 차단: COUNT(FG) < SUM(PROD_RESULTS.goodQty)).
→ RUNNING 작업지시 1건 + 생산실적 goodQty=N 만 있으면 N개까지 통전검사 가능.
사용: python tools/seed/seed_hns02_continuity.py [--commit]
"""
import json, os, sys, datetime
import oracledb

COMMIT = "--commit" in sys.argv
CO, PLANT = "40", "1000"
TOP, QTY = "HNS02", 10
D = "260619"
WO = f"WOH-INSP-{D}-01"
PR = f"PRH-INSP-{D}-01"
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

# 라우팅
cur.execute("SELECT ROUTING_CODE FROM ROUTING_GROUPS WHERE ITEM_CODE=:1 AND COMPANY=:2 AND PLANT_CD=:3", [TOP, CO, PLANT])
row = cur.fetchone()
routing = row[0] if row else "RT-HNS02"

# 정리 (멱등) — 이 통전검사 시드가 만든 것 + 그 검사로 발행된 FG/검사결과
clean = [
 f"DELETE FROM INSPECT_RESULTS WHERE PROD_RESULT_ID='{PR}' OR FG_BARCODE IN (SELECT FG_BARCODE FROM FG_LABELS WHERE ORDER_NO='{WO}')",
 f"DELETE FROM FG_LABELS WHERE ORDER_NO='{WO}'",
 f"DELETE FROM PROD_RESULTS WHERE RESULT_NO='{PR}'",
 f"DELETE FROM JOB_ORDERS WHERE ORDER_NO='{WO}'",
]
for s in clean:
    cur.execute(s)
    if cur.rowcount:
        print(f"[CLEAN] {cur.rowcount:4d}  {s[:60]}")

# FG 바코드 발행은 라우팅(조립 키팅, ISSUE_FG_LABEL_YN)으로 일원화됨 — 전역 발행시점 설정 폐기.
# 통전검사는 조립에서 발행된 ISSUED 라벨을 스캔해 판정한다.
cur.execute("DELETE FROM SYS_CONFIGS WHERE CONFIG_KEY='FG_BARCODE_ISSUE_TIMING' AND COMPANY=:1 AND PLANT_CD=:2", [CO, PLANT])

# 작업지시 (RUNNING = 통전검사 대상)
ins("JOB_ORDERS", ORDER_NO=WO, ITEM_CODE=TOP, PLAN_QTY=QTY, GOOD_QTY=0, DEFECT_QTY=0,
    PRIORITY=5, STATUS="RUNNING", ERP_SYNC_YN="N", ROUTING_CODE=routing,
    COMPANY=CO, PLANT_CD=PLANT, CREATED_BY=WORKER)

# 생산실적 (작업지시 진행 맥락)
ins("PROD_RESULTS", RESULT_NO=PR, ORDER_NO=WO, GOOD_QTY=QTY, DEFECT_QTY=0, STATUS="DONE",
    PROCESS_CODE="SASSY", WORKER_ID=WORKER, START_TIME=now, END_TIME=now,
    COMPANY=CO, PLANT_CD=PLANT, CREATED_BY=WORKER)

# FG라벨 ISSUED 사전발행(키팅 발행 시뮬) — ON_SUBPROCESS 스캔 대상. FG_BARCODE는 운영 시퀀스로 채번
fg_list = []
for i in range(1, QTY + 1):
    cur.execute("SELECT SEQ_FG_BARCODE.NEXTVAL FROM DUAL")
    fg = f"FG{D}{cur.fetchone()[0]:05d}"
    fg_list.append(fg)
    ins("FG_LABELS", FG_BARCODE=fg, ITEM_CODE=TOP, ORDER_NO=WO, STATUS="ISSUED",
        REPRINT_COUNT=0, ISSUED_AT=now, COMPANY=CO, PLANT_CD=PLANT)

# 검증
print("\n[VERIFY]")
checks = [
 ("작업지시(RUNNING)", f"SELECT COUNT(*) FROM JOB_ORDERS WHERE ORDER_NO='{WO}' AND STATUS='RUNNING'"),
 ("통전검사 목록 노출(status필터)", f"SELECT COUNT(*) FROM JOB_ORDERS WHERE ITEM_CODE='{TOP}' AND STATUS IN ('RUNNING','IN_PROGRESS','WAITING') AND ORDER_NO='{WO}'"),
 ("FG라벨 ISSUED(스캔대상)", f"SELECT COUNT(*) FROM FG_LABELS WHERE ORDER_NO='{WO}' AND STATUS='ISSUED'"),
]
for name, sql in checks:
    cur.execute(sql); print(f"   {name:30s} {cur.fetchone()[0]}")
print("   스캔용 FG 바코드:", ", ".join(fg_list[:5]), "...")

if COMMIT:
    conn.commit(); print("\n>>> COMMITTED")
else:
    conn.rollback(); print("\n>>> DRY-RUN (rolled back). 실제 반영하려면 --commit")
conn.close()
