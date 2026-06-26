# -*- coding: utf-8 -*-
"""HNS02 BOM 트리 + KS_ 접두 품목 한정 삭제 (기준정보 + 전 트랜잭션).

대상 품목 집합:
  - HNS02 BOM 트리 전개 하위 전체(반제품 + 전용 원자재) ∪ {HNS02}
  - ITEM_MASTERS 의 ITEM_CODE LIKE 'HNS02%' 또는 'KS\\_%'
다른 품목(N91H00-X9800 등)은 보존한다.

처리:
  1) 대상 품목 집합 / 키 집합(작업지시·실적·FG/SG/MAT·박스·라우팅) 전파
  2) 트랜잭션 테이블: ITEM_CODE 직접 보유 → WHERE ITEM_CODE IN(대상)
     간접 테이블 → 명시 RULES(키 집합) 로 삭제
  3) 기준정보(BOM_MASTERS/ROUTING_*/WORK_INSTRUCTIONS/ITEM_MASTERS) 품목 한정 삭제
  FK: 관련 ENABLED R 제약 비활성화 → DELETE(자식→부모 순) → 재활성화

사용:
  python tools/seed/purge_items_hns02_ks.py            # dry-run (건수만)
  python tools/seed/purge_items_hns02_ks.py --commit   # 실제 삭제 + commit
"""
import json
import os
import sys

import oracledb

SITE = "JSHANES"
COMPANY = "40"
COMMIT = "--commit" in sys.argv

# 절대 보존(순수 설정/코드/권한/공유 마스터). 품목/BOM/라우팅/작업지도서는 여기 없음 = 품목 한정 삭제 대상.
CONFIG_KEEP = {
    "COM_CODES", "SYS_CONFIGS", "COMM_CONFIGS", "SEQ_RULES", "NUM_RULE_MASTERS",
    "MENU_CATEGORIES", "MENU_CATEGORY_ITEMS", "ROLES", "ROLE_MENU_PERMISSIONS",
    "PDA_ROLE", "PDA_ROLE_MENU", "USERS", "USER_AUTHS", "WORKER_MASTERS",
    "DEPARTMENT_MASTERS", "COMPANY_MASTERS", "PLANTS", "PROD_LINE_MASTERS",
    "PROCESS_MASTERS", "PROCESS_MAPS", "PROCESS_EQUIPMENTS", "PROCESS_QUALITY_CONDITIONS",
    "PROCESS_CAPAS", "MODEL_SUFFIXES",
    "EQUIP_MASTERS", "EQUIP_PROTOCOLS", "EQUIP_BOM_ITEMS", "EQUIP_BOM_RELS",
    "EQUIP_CONDITION_RULES", "EQUIP_INSPECT_ITEM_MASTERS", "EQUIP_INSPECT_ITEM_POOL",
    "WAREHOUSES", "WAREHOUSE_LOCATIONS", "WAREHOUSE_TRANSFER_RULES",
    "PARTNER_MASTERS", "VENDOR_MASTERS", "VENDOR_BARCODE_MAPPINGS",
    "DEFECT_CODE_MASTERS", "DEFECT_CATEGORY_MASTERS", "DEFECT_CODE_PRODUCT_TYPES",
    "IQC_ITEM_MASTERS", "IQC_ITEM_POOL", "IQC_PART_SPECS", "IQC_PART_SPEC_ITEMS",
    "IQC_TEMPLATES", "IQC_TEMPLATE_ITEMS", "IQC_AQL_POLICIES", "AQL_STANDARDS",
    "AQL_SAMPLING_RULES", "SELF_INSPECT_ITEMS", "CONTROL_PLANS", "CONTROL_PLAN_ITEMS",
    "GAUGE_MASTERS", "CONSUMABLE_MASTERS", "CONSUMABLE_USAGE_MAP",
    "HARNESS_CIRCUIT_SPECS", "HARNESS_DRAWING_MASTERS", "HARNESS_DRAWING_REVISIONS",
    "DOCUMENT_MASTERS", "LABEL_TEMPLATES",
    "WORK_CALENDARS", "WORK_CALENDAR_DAYS", "SHIFT_PATTERNS", "MOLD_MASTERS",
    "PM_PLANS", "PM_PLAN_ITEMS", "SCHEDULER_JOBS", "SPC_CHARTS", "TRAINING_PLANS",
}

# 품목 한정으로 삭제할 기준정보(트랜잭션 처리 후 마지막에 삭제)
MASTER_PURGE_ORDER = [
    "WORK_INSTRUCTIONS", "ROUTING_MATERIALS", "ROUTING_PROCESSES", "ROUTING_GROUPS",
    "BOM_MASTERS", "ITEM_MASTERS",
]


def connect():
    with open(os.path.expanduser("~/.oracle_db_config.json"), encoding="utf-8") as f:
        cfg = json.load(f)["profiles"][SITE]
    return oracledb.connect(
        user=cfg["user"], password=cfg["password"],
        dsn=f"{cfg['host']}:{cfg['port']}/{cfg['service_name']}",
    )


def binds(vals):
    """IN 절용 named-bind dict + placeholder 문자열."""
    d = {f"b{i}": v for i, v in enumerate(vals)}
    ph = ",".join(f":b{i}" for i in range(len(vals))) if vals else "NULL"
    return ph, d


def fetch_set(cur, sql, params=None):
    cur.execute(sql, params or {})
    return {r[0] for r in cur.fetchall() if r[0] is not None}


def count_where(cur, table, where, params):
    cur.execute(f'SELECT COUNT(*) FROM "{table}" WHERE {where}', params)
    return cur.fetchone()[0]


def cols_of(cur, table):
    cur.execute(
        "SELECT column_name FROM user_tab_columns WHERE table_name = :t", {"t": table}
    )
    return {r[0] for r in cur.fetchall()}


def main():
    conn = connect()
    conn.autocommit = False
    cur = conn.cursor()

    print(f"[START] purge HNS02-tree + KS_ items on {SITE}  mode={'COMMIT' if COMMIT else 'DRY-RUN'}\n")

    # ---- 1) 대상 품목 집합 ----
    items = fetch_set(
        cur,
        "SELECT ITEM_CODE FROM ITEM_MASTERS WHERE COMPANY = :c "
        "AND (ITEM_CODE LIKE 'HNS02%' OR ITEM_CODE LIKE 'KS\\_%' ESCAPE '\\')",
        {"c": COMPANY},
    )
    items |= fetch_set(
        cur,
        "SELECT DISTINCT CHILD_ITEM_CODE FROM BOM_MASTERS WHERE COMPANY = :c "
        "START WITH PARENT_ITEM_CODE = 'HNS02' "
        "CONNECT BY NOCYCLE PRIOR CHILD_ITEM_CODE = PARENT_ITEM_CODE",
        {"c": COMPANY},
    )
    items.add("HNS02")
    items = sorted(items)
    ph_items, p_items = binds(items)
    print(f"[TARGET-ITEMS] {len(items)}개")
    print("   " + ", ".join(items) + "\n")

    # ---- 2) 키 집합 전파 (대상 품목 기준) ----
    keysets = {"ITEM_CODE": (items, ph_items, p_items)}

    def add_key(name, sql):
        vals = sorted(fetch_set(cur, sql.format(ph=ph_items), p_items))
        ph, p = binds(vals)
        keysets[name] = (vals, ph, p)
        print(f"   key {name:16s} {len(vals):6d}")

    print("[KEY-SETS]")
    add_key("ORDER_NO", f"SELECT ORDER_NO FROM JOB_ORDERS WHERE ITEM_CODE IN ({{ph}})")
    o_vals, o_ph, o_p = keysets["ORDER_NO"]
    # RESULT_NO 는 ORDER_NO 바인드를 써야 하므로 add_key(품목 바인드) 대신 별도 처리.
    res_vals = sorted(fetch_set(
        cur,
        f"SELECT RESULT_NO FROM PROD_RESULTS WHERE ORDER_NO IN ({o_ph})" if o_vals
        else "SELECT RESULT_NO FROM PROD_RESULTS WHERE 1=0",
        o_p,
    ))
    res_ph, res_p = binds(res_vals)
    keysets["RESULT_NO"] = (res_vals, res_ph, res_p)
    print(f"   key {'RESULT_NO':16s} {len(res_vals):6d}")
    add_key("FG_BARCODE", f"SELECT FG_BARCODE FROM FG_LABELS WHERE ITEM_CODE IN ({{ph}})")
    add_key("SG_BARCODE", f"SELECT SG_BARCODE FROM SG_LABELS WHERE ITEM_CODE IN ({{ph}})")
    add_key("MAT_UID", f"SELECT MAT_UID FROM MAT_LOTS WHERE ITEM_CODE IN ({{ph}})")
    add_key("BOX_NO", f"SELECT BOX_NO FROM BOX_MASTERS WHERE ITEM_CODE IN ({{ph}})")
    add_key("ROUTING_CODE",
            f"SELECT ROUTING_CODE FROM ROUTING_GROUPS WHERE ITEM_CODE IN ({{ph}})")
    add_key("PO_NO", f"SELECT PO_ID FROM PURCHASE_ORDER_ITEMS WHERE ITEM_CODE IN ({{ph}})")
    add_key("SHIP_ORDER_NO",
            f"SELECT SHIP_ORDER_ID FROM SHIPMENT_ORDER_ITEMS WHERE ITEM_CODE IN ({{ph}})")
    print()

    # ---- 3) 트랜잭션 테이블 산출 ----
    all_tables = fetch_set(cur, "SELECT table_name FROM user_tables")
    txn_tables = sorted(
        t for t in all_tables
        if t not in CONFIG_KEEP and t not in MASTER_PURGE_ORDER
        and "BAK" not in t.upper() and t.upper() != "MIGRATIONS"
    )

    # 간접 참조 명시 규칙: table -> (column, keyset_name). 컬럼 존재는 introspect로 검증.
    INDIRECT = {
        "PROD_RESULTS": ("ORDER_NO", "ORDER_NO"),
        "MAT_ISSUE_REQUESTS": ("ORDER_NO", "ORDER_NO"),
        "SAMPLE_INSPECT_RESULTS": ("ORDER_NO", "ORDER_NO"),
        "SELF_INSPECT_RESULTS": ("ORDER_NO", "ORDER_NO"),
        "EQUIP_INSPECT_LOGS": ("ORDER_NO", "ORDER_NO"),
        "DEFECT_LOGS": ("PROD_RESULT_ID", "RESULT_NO"),
        "OQC_REQUEST_BOXES": ("BOX_NO", "BOX_NO"),
        "ROUTING_PROCESSES": ("ROUTING_CODE", "ROUTING_CODE"),
        "ROUTING_MATERIALS": ("ROUTING_CODE", "ROUTING_CODE"),
        "VENDOR_INSPECTION_MODE_HISTORY": ("REF_ITEM_CODE", "ITEM_CODE"),
        "PURCHASE_ORDERS": ("PO_NO", "PO_NO"),
        "SHIPMENT_ORDERS": ("SHIP_ORDER_NO", "SHIP_ORDER_NO"),
        "PALLET_MASTERS": ("SHIP_ORDER_NO", "SHIP_ORDER_NO"),
    }
    # ORDER_NO 컬럼이지만 작업지시가 아닌(헤더 자체) 테이블 → 자동 ITEM_CODE 외 처리 제외
    HEADER_ORDER_NO = {"CUSTOMER_ORDERS"}

    def predicate(table):
        """(where, params, kind) | None(미매핑)"""
        c = cols_of(cur, table)
        # 1) 명시 간접 규칙 우선
        if table in INDIRECT:
            col, ks = INDIRECT[table]
            if col in c:
                vals, ph, p = keysets[ks]
                if not vals:
                    return ("1=0", {}, f"{col}∈{ks}(0)")
                return (f"{col} IN ({ph})", p, f"{col}∈{ks}")
        # 2) ITEM_CODE 직접
        if "ITEM_CODE" in c and table not in HEADER_ORDER_NO:
            return (f"ITEM_CODE IN ({ph_items})", p_items, "ITEM_CODE")
        # 3) 시리얼/박스/uid 직접 컬럼
        for col, ks in (("FG_BARCODE", "FG_BARCODE"), ("SG_BARCODE", "SG_BARCODE"),
                        ("MAT_UID", "MAT_UID"), ("BOX_NO", "BOX_NO")):
            if col in c:
                vals, kph, kp = keysets[ks]
                if not vals:
                    return ("1=0", {}, f"{col}∈{ks}(0)")
                return (f"{col} IN ({kph})", kp, f"{col}∈{ks}")
        return None

    print("[TXN-TABLES] 대상건수 / 전체건수  (kind)")
    mapped, unmapped = [], []
    grand = 0
    for t in txn_tables:
        cur.execute(f'SELECT COUNT(*) FROM "{t}"')
        total = cur.fetchone()[0]
        pred = predicate(t)
        if pred is None:
            if total:
                unmapped.append((t, total))
            continue
        where, params, kind = pred
        cnt = count_where(cur, t, where, params)
        if cnt or total:
            mapped.append((t, cnt, total, kind))
        grand += cnt
    for t, cnt, total, kind in sorted(mapped, key=lambda x: -x[1]):
        flag = " " if cnt else " ·"
        print(f"  {flag}{t:32s} {cnt:6d} / {total:6d}   ({kind})")
    print(f"\n   [TXN 대상 합계] {grand}행")

    if unmapped:
        print("\n[UNMAPPED] ITEM_CODE/키 컬럼 없음 → 자동 미처리(수동 검토 필요), 전체행:")
        for t, total in sorted(unmapped, key=lambda x: -x[1]):
            print(f"   ? {t:32s} {total:6d}")

    # ---- 4) 기준정보 품목 한정 건수 ----
    print("\n[MASTER] 품목 한정 삭제 대상(기준정보):")
    rc_vals, rc_ph, rc_p = keysets["ROUTING_CODE"]
    master_pred = {
        "WORK_INSTRUCTIONS": (f"ITEM_CODE IN ({ph_items})", p_items),
        "ROUTING_MATERIALS": (f"ROUTING_CODE IN ({rc_ph})" if rc_vals else "1=0", rc_p if rc_vals else {}),
        "ROUTING_PROCESSES": (f"ROUTING_CODE IN ({rc_ph})" if rc_vals else "1=0", rc_p if rc_vals else {}),
        "ROUTING_GROUPS": (f"ITEM_CODE IN ({ph_items})", p_items),
        "BOM_MASTERS": (f"PARENT_ITEM_CODE IN ({ph_items}) OR CHILD_ITEM_CODE IN ({ph_items})", p_items),
        "ITEM_MASTERS": (f"ITEM_CODE IN ({ph_items})", p_items),
    }
    for t in MASTER_PURGE_ORDER:
        where, params = master_pred[t]
        cnt = count_where(cur, t, where, params)
        cur.execute(f'SELECT COUNT(*) FROM "{t}"')
        total = cur.fetchone()[0]
        print(f"   {t:24s} {cnt:6d} / {total:6d}")

    if not COMMIT:
        print("\n>>> DRY-RUN: 실제 삭제 안 함. 반영하려면 --commit")
        cur.close(); conn.close()
        return

    # ===== 실제 삭제 =====
    delete_tables = [t for t, *_ in sorted(mapped, key=lambda x: x[1])]  # 적은건수=자식 우선 근사
    # 안전: 명시 의존성 순서(자식→부모)로 트랜잭션 삭제. mapped 중 INDIRECT/자식 먼저.
    CHILD_FIRST = [
        "INSPECT_RESULTS", "DEFECT_LOGS", "SAMPLE_INSPECT_RESULTS", "SELF_INSPECT_RESULTS",
        "EQUIP_INSPECT_LOGS", "VENDOR_INSPECTION_MODE_HISTORY",
        "OQC_REQUEST_BOXES", "PRODUCT_GENEALOGY", "TRACE_LOGS", "LABEL_PRINT_LOGS",
        "FG_LABELS", "SG_LABELS",
        "PROD_RESULTS", "PROD_PLANS", "MAT_ISSUES", "MAT_ISSUE_REQUEST_ITEMS", "MAT_ISSUE_REQUESTS",
        "JOB_MATERIAL_LOTS",
        "WIP_MAT_TRANSACTIONS", "WIP_MAT_STOCKS",
        "STOCK_TRANSACTIONS", "MAT_ARRIVAL_TRANSACTIONS", "PRODUCT_TRANSACTIONS",
        "MAT_STOCKS", "MAT_ARRIVAL_STOCKS", "PRODUCT_STOCKS",
        "MAT_LOTS",
        "MAT_RECEIVINGS", "MAT_ARRIVALS",
        "PURCHASE_ORDER_ITEMS", "PURCHASE_ORDERS", "IQC_LOGS",
        "REPAIR_ORDERS",
        "PALLET_MASTERS", "BOX_MASTERS", "OQC_REQUESTS",
        "SHIPMENT_ORDER_ITEMS", "SHIPMENT_ORDERS", "SHIPMENT_RETURN_ITEMS", "CUSTOMER_ORDER_ITEMS",
        "REWORK_ORDERS",
        "JOB_ORDERS",
        "ROUTING_MATERIALS",
    ]
    mapped_names = {t for t, *_ in mapped}
    ordered = [t for t in CHILD_FIRST if t in mapped_names]
    ordered += [t for t in delete_tables if t not in ordered]  # 누락분 뒤에

    # FK 비활성화
    cur.execute(
        "SELECT c.constraint_name, c.table_name, p.table_name "
        "FROM user_constraints c JOIN user_constraints p "
        "ON p.owner=c.r_owner AND p.constraint_name=c.r_constraint_name "
        "WHERE c.constraint_type='R' AND c.status='ENABLED'"
    )
    touch = set(ordered) | set(MASTER_PURGE_ORDER)
    fk = [(n, ch) for (n, ch, par) in cur.fetchall() if ch in touch or par in touch]
    print(f"\n[FK] 비활성화 {len(fk)}개")
    for n, ch in fk:
        cur.execute(f'ALTER TABLE "{ch}" DISABLE CONSTRAINT "{n}"')

    deleted = 0
    try:
        for t in ordered:
            pred = predicate(t)
            if not pred:
                continue
            where, params, _ = pred
            cur.execute(f'DELETE FROM "{t}" WHERE {where}', params)
            n = cur.rowcount or 0
            deleted += n
            if n:
                print(f"   DEL {t:32s} {n:6d}")
        for t in MASTER_PURGE_ORDER:
            where, params = master_pred[t]
            cur.execute(f'DELETE FROM "{t}" WHERE {where}', params)
            n = cur.rowcount or 0
            deleted += n
            if n:
                print(f"   DEL {t:32s} {n:6d}  (master)")
        conn.commit()
        print(f"\n[DELETE_TOTAL] {deleted}  >>> COMMITTED")
    except Exception as e:  # noqa: BLE001
        conn.rollback()
        print(f"\n[ERROR] 롤백: {e}")
    finally:
        fail = []
        for n, ch in fk:
            try:
                cur.execute(f'ALTER TABLE "{ch}" ENABLE CONSTRAINT "{n}"')
            except Exception as e:  # noqa: BLE001
                fail.append((ch, n, str(e).splitlines()[0]))
        if fail:
            print(f"[FK][WARN] 재활성화 실패 {len(fail)}개:")
            for ch, n, msg in fail:
                print(f"   {ch}.{n} :: {msg}")
        else:
            print(f"[FK] {len(fk)}개 재활성화 완료")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
