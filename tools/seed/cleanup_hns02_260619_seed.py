# -*- coding: utf-8 -*-
"""Clean HNS02 260619 seed rows from JSHANES.

Default is dry-run rollback. Use --commit to apply.
The scope is intentionally marker-based to avoid touching normal material IQC data.
"""
import json
import os
import sys

import oracledb


SITE = "JSHANES"
CO = "40"
PLANT = "1000"
D = "260619"
COMMIT = "--commit" in sys.argv


def connect():
    with open(os.path.expanduser("~/.oracle_db_config.json"), encoding="utf-8") as f:
        cfg = json.load(f)["profiles"][SITE]
    return oracledb.connect(
        user=cfg["user"],
        password=cfg["password"],
        dsn=f"{cfg['host']}:{cfg['port']}/{cfg['service_name']}",
    )


DELETE_SQLS = [
    (
        "PRODUCT_GENEALOGY_FGH_SGH",
        f"""
        DELETE FROM PRODUCT_GENEALOGY
         WHERE COMPANY = :co AND PLANT_CD = :plant
           AND (
             PARENT_KEY LIKE 'FGH{D}%' OR CHILD_KEY LIKE 'FGH{D}%'
             OR PARENT_KEY LIKE 'SGH{D}%' OR CHILD_KEY LIKE 'SGH{D}%'
           )
        """,
    ),
    (
        "INSPECT_RESULTS_IRH_FGH_PRH",
        f"""
        DELETE FROM INSPECT_RESULTS
         WHERE COMPANY = :co AND PLANT_CD = :plant
           AND (
             RESULT_NO LIKE 'IRH{D}%'
             OR FG_BARCODE LIKE 'FGH{D}%'
             OR PROD_RESULT_ID LIKE 'PRH-{D}%'
           )
        """,
    ),
    (
        "BOX_MASTERS_BXH",
        f"DELETE FROM BOX_MASTERS WHERE COMPANY = :co AND PLANT_CD = :plant AND BOX_NO LIKE 'BXH{D}-%'",
    ),
    (
        "FG_LABELS_FGH",
        f"DELETE FROM FG_LABELS WHERE COMPANY = :co AND PLANT_CD = :plant AND FG_BARCODE LIKE 'FGH{D}%'",
    ),
    (
        "SG_LABELS_SGH",
        f"DELETE FROM SG_LABELS WHERE COMPANY = :co AND PLANT_CD = :plant AND SG_BARCODE LIKE 'SGH{D}%'",
    ),
    (
        "SHIPMENT_ORDER_ITEMS_SOH",
        f"DELETE FROM SHIPMENT_ORDER_ITEMS WHERE COMPANY = :co AND PLANT_CD = :plant AND SHIP_ORDER_ID LIKE 'SOH-{D}-%'",
    ),
    (
        "SHIPMENT_ORDERS_SOH",
        f"DELETE FROM SHIPMENT_ORDERS WHERE COMPANY = :co AND PLANT_CD = :plant AND SHIP_ORDER_NO LIKE 'SOH-{D}-%'",
    ),
    (
        "PRODUCT_TRANSACTIONS_PTH_WOH",
        f"""
        DELETE FROM PRODUCT_TRANSACTIONS
         WHERE COMPANY = :co AND PLANT_CD = :plant
           AND (TRANS_NO LIKE 'PTH-{D}-%' OR ORDER_NO LIKE 'WOH-{D}-%')
        """,
    ),
    (
        "PRODUCT_STOCKS_WOH",
        f"DELETE FROM PRODUCT_STOCKS WHERE COMPANY = :co AND PLANT_CD = :plant AND ORDER_NO LIKE 'WOH-{D}-%'",
    ),
    (
        "PROD_RESULTS_PRH_WOH",
        f"""
        DELETE FROM PROD_RESULTS
         WHERE COMPANY = :co AND PLANT_CD = :plant
           AND (RESULT_NO LIKE 'PRH-{D}-%' OR ORDER_NO LIKE 'WOH-{D}-%')
        """,
    ),
    (
        "MAT_ISSUE_REQUEST_ITEMS_WOH",
        f"""
        DELETE FROM MAT_ISSUE_REQUEST_ITEMS
         WHERE COMPANY = :co AND PLANT_CD = :plant
           AND REQUEST_ID IN (
             SELECT REQUEST_NO
               FROM MAT_ISSUE_REQUESTS
              WHERE COMPANY = :co AND PLANT_CD = :plant
                AND ORDER_NO LIKE 'WOH-{D}-%'
           )
        """,
    ),
    (
        "MAT_ISSUE_REQUESTS_WOH",
        f"DELETE FROM MAT_ISSUE_REQUESTS WHERE COMPANY = :co AND PLANT_CD = :plant AND ORDER_NO LIKE 'WOH-{D}-%'",
    ),
    (
        "MAT_ISSUES_ISH_WOH",
        f"""
        DELETE FROM MAT_ISSUES
         WHERE COMPANY = :co AND PLANT_CD = :plant
           AND (ISSUE_NO LIKE 'ISH-{D}-%' OR ORDER_NO LIKE 'WOH-{D}-%')
        """,
    ),
    (
        "STOCK_TRANSACTIONS_STH",
        f"DELETE FROM STOCK_TRANSACTIONS WHERE COMPANY = :co AND PLANT_CD = :plant AND TRANS_NO LIKE 'STH-{D}-%'",
    ),
    (
        "MAT_STOCKS_RVH_UID",
        f"""
        DELETE FROM MAT_STOCKS
         WHERE COMPANY = :co AND PLANT_CD = :plant
           AND CREATED_BY = 'seed'
           AND MAT_UID IN (
             SELECT MAT_UID
               FROM MAT_RECEIVINGS
              WHERE COMPANY = :co AND PLANT_CD = :plant
                AND RECEIVE_NO LIKE 'RVH-{D}-%'
           )
        """,
    ),
    (
        "MAT_RECEIVINGS_RVH",
        f"DELETE FROM MAT_RECEIVINGS WHERE COMPANY = :co AND PLANT_CD = :plant AND RECEIVE_NO LIKE 'RVH-{D}-%'",
    ),
    (
        "MAT_LOTS_ARH_POH",
        f"""
        DELETE FROM MAT_LOTS
         WHERE COMPANY = :co AND PLANT_CD = :plant
           AND (ARRIVAL_NO LIKE 'ARH-{D}-%' OR PO_NO = 'POH-{D}-001')
        """,
    ),
    (
        "IQC_LOGS_ARH",
        f"DELETE FROM IQC_LOGS WHERE COMPANY = :co AND PLANT_CD = :plant AND ARRIVAL_NO LIKE 'ARH-{D}-%'",
    ),
    (
        "MAT_ARRIVAL_STOCKS_ARH",
        f"DELETE FROM MAT_ARRIVAL_STOCKS WHERE COMPANY = :co AND PLANT_CD = :plant AND ARRIVAL_NO LIKE 'ARH-{D}-%'",
    ),
    (
        "MAT_ARRIVALS_ARH",
        f"DELETE FROM MAT_ARRIVALS WHERE COMPANY = :co AND PLANT_CD = :plant AND ARRIVAL_NO LIKE 'ARH-{D}-%'",
    ),
    (
        "JOB_ORDERS_WOH",
        f"DELETE FROM JOB_ORDERS WHERE COMPANY = :co AND PLANT_CD = :plant AND ORDER_NO LIKE 'WOH-{D}-%'",
    ),
    (
        "PURCHASE_ORDER_ITEMS_POH",
        f"DELETE FROM PURCHASE_ORDER_ITEMS WHERE COMPANY = :co AND PLANT_CD = :plant AND PO_ID LIKE 'POH-{D}-%'",
    ),
    (
        "PURCHASE_ORDERS_POH",
        f"DELETE FROM PURCHASE_ORDERS WHERE COMPANY = :co AND PLANT_CD = :plant AND PO_NO LIKE 'POH-{D}-%'",
    ),
]


CHECK_SQLS = [
    (
        "seed_marker_residual",
        f"""
        SELECT 'ARH_ARRIVALS' target, COUNT(*) cnt FROM MAT_ARRIVALS WHERE COMPANY=:co AND PLANT_CD=:plant AND ARRIVAL_NO LIKE 'ARH-{D}-%'
        UNION ALL SELECT 'RVH_RECEIVINGS', COUNT(*) FROM MAT_RECEIVINGS WHERE COMPANY=:co AND PLANT_CD=:plant AND RECEIVE_NO LIKE 'RVH-{D}-%'
        UNION ALL SELECT 'STH_STOCK_TX', COUNT(*) FROM STOCK_TRANSACTIONS WHERE COMPANY=:co AND PLANT_CD=:plant AND TRANS_NO LIKE 'STH-{D}-%'
        UNION ALL SELECT 'ISH_ISSUES', COUNT(*) FROM MAT_ISSUES WHERE COMPANY=:co AND PLANT_CD=:plant AND ISSUE_NO LIKE 'ISH-{D}-%'
        UNION ALL SELECT 'WOH_JOB_ORDERS', COUNT(*) FROM JOB_ORDERS WHERE COMPANY=:co AND PLANT_CD=:plant AND ORDER_NO LIKE 'WOH-{D}-%'
        UNION ALL SELECT 'PRH_PROD_RESULTS', COUNT(*) FROM PROD_RESULTS WHERE COMPANY=:co AND PLANT_CD=:plant AND RESULT_NO LIKE 'PRH-{D}-%'
        UNION ALL SELECT 'FGH_LABELS', COUNT(*) FROM FG_LABELS WHERE COMPANY=:co AND PLANT_CD=:plant AND FG_BARCODE LIKE 'FGH{D}%'
        UNION ALL SELECT 'SGH_LABELS', COUNT(*) FROM SG_LABELS WHERE COMPANY=:co AND PLANT_CD=:plant AND SG_BARCODE LIKE 'SGH{D}%'
        UNION ALL SELECT 'BXH_BOXES', COUNT(*) FROM BOX_MASTERS WHERE COMPANY=:co AND PLANT_CD=:plant AND BOX_NO LIKE 'BXH{D}-%'
        UNION ALL SELECT 'SOH_SHIP_ORDERS', COUNT(*) FROM SHIPMENT_ORDERS WHERE COMPANY=:co AND PLANT_CD=:plant AND SHIP_ORDER_NO LIKE 'SOH-{D}-%'
        """,
    ),
    (
        "lot_receiving_item_arrival_mismatch",
        """
        SELECT COUNT(*) bad_cnt
          FROM MAT_LOTS l
          JOIN MAT_RECEIVINGS r
            ON r.COMPANY = l.COMPANY
           AND r.PLANT_CD = l.PLANT_CD
           AND r.MAT_UID = l.MAT_UID
         WHERE l.COMPANY = :co
           AND l.PLANT_CD = :plant
           AND (l.ITEM_CODE <> r.ITEM_CODE OR NVL(l.ARRIVAL_NO, '-') <> NVL(r.ARRIVAL_NO, '-'))
        """,
    ),
    (
        "lot_stock_tx_item_mismatch",
        """
        SELECT COUNT(*) bad_cnt
          FROM MAT_LOTS l
          JOIN STOCK_TRANSACTIONS t
            ON t.COMPANY = l.COMPANY
           AND t.PLANT_CD = l.PLANT_CD
           AND t.MAT_UID = l.MAT_UID
         WHERE l.COMPANY = :co
           AND l.PLANT_CD = :plant
           AND l.ITEM_CODE <> t.ITEM_CODE
        """,
    ),
    (
        "mat_stocks_qty_invariant",
        """
        SELECT COUNT(*) bad_cnt
          FROM MAT_STOCKS
         WHERE COMPANY = :co
           AND PLANT_CD = :plant
           AND (QTY < 0 OR RESERVED_QTY < 0 OR AVAILABLE_QTY < 0 OR QTY <> RESERVED_QTY + AVAILABLE_QTY)
        """,
    ),
]


def run_check(cur, name, sql):
    cur.execute(sql, {"co": CO, "plant": PLANT})
    rows = cur.fetchall()
    print(f"\n[CHECK] {name}")
    for row in rows:
        print("  " + " | ".join(str(v) for v in row))


def main():
    conn = connect()
    conn.autocommit = False
    cur = conn.cursor()
    binds = {"co": CO, "plant": PLANT}

    print(f"[START] cleanup HNS02 {D} seed on {SITE} {CO}/{PLANT} mode={'COMMIT' if COMMIT else 'DRY-RUN'}")
    print("\n[BEFORE]")
    for name, sql in CHECK_SQLS:
        run_check(cur, name, sql)

    print("\n[DELETE]")
    total = 0
    for name, sql in DELETE_SQLS:
        cur.execute(sql, binds)
        count = cur.rowcount if cur.rowcount is not None and cur.rowcount >= 0 else 0
        total += count
        print(f"  {name:34s} {count}")

    print(f"\n[DELETE_TOTAL] {total}")
    print("\n[AFTER_IN_TX]")
    for name, sql in CHECK_SQLS:
        run_check(cur, name, sql)

    if COMMIT:
        conn.commit()
        print("\n[COMMIT] applied")
    else:
        conn.rollback()
        print("\n[ROLLBACK] dry-run only")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
