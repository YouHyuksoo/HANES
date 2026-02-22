"""
@file scripts/verify-material-flow.py
@description 자재 플로우 검증 스크립트 (입하 -> IQC -> 입고 -> 출고 -> 재고 검증)

초보자 가이드:
1. 백엔드 서버가 localhost:3003에서 실행 중이어야 합니다
2. 실행: python scripts/verify-material-flow.py
3. 각 단계별로 API를 호출하고 결과를 검증합니다
4. 최종적으로 재고 수불 정합성을 확인합니다
"""

import requests
import json
import sys
import time
from datetime import datetime, timedelta

BASE_URL = "http://localhost:3003/api/v1"
HEADERS = {
    "Content-Type": "application/json",
    "x-company": "40",
    "x-plant": "VN",
}


def ok(msg):
    print(f"  [OK] {msg}")

def fail(msg):
    print(f"  [FAIL] {msg}")

def info(msg):
    print(f"  [INFO] {msg}")

def header(step, title):
    print(f"\n{'='*60}")
    print(f"  STEP {step}: {title}")
    print(f"{'='*60}")

def api_get(path, params=None):
    r = requests.get(f"{BASE_URL}{path}", headers=HEADERS, params=params or {})
    return r.json(), r.status_code

def api_post(path, data):
    r = requests.post(f"{BASE_URL}{path}", headers=HEADERS, json=data)
    return r.json(), r.status_code

def api_patch(path, data=None):
    r = requests.patch(f"{BASE_URL}{path}", headers=HEADERS, json=data or {})
    return r.json(), r.status_code


class MaterialFlowVerifier:
    """입하 -> IQC -> 입고 -> 출고 전체 흐름 검증"""

    def __init__(self):
        self.errors = []
        self.results = {}
        self.part_ids = []
        self.part_codes = []
        self.warehouse_codes = []
        self.po_id = None
        self.po_item_ids = []
        self.lot_ids = []
        self.lot_nos = []

    def run(self):
        print(f"\n{'='*60}")
        print(f"  HANES MES Material Flow Verification")
        print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*60}")

        try:
            self.step0_check_prerequisites()
            self.step1_create_po()
            self.step1b_confirm_po()
            self.step2_arrival()
            self.step3_check_after_arrival()
            self.step4_iqc()
            self.step5_receiving()
            self.step6_check_after_receiving()
            self.step7_issue()
            self.step8_final_verify()
        except Exception as e:
            fail(f"Exception: {e}")
            import traceback
            traceback.print_exc()
            self.errors.append(str(e))

        self.summary()

    def step0_check_prerequisites(self):
        header(0, "Prerequisites Check")

        # RAW parts
        resp, _ = api_get("/master/parts", {"limit": "5", "partType": "RAW"})
        parts = resp.get("data", [])
        assert len(parts) >= 3, f"RAW parts insufficient: {len(parts)}"
        self.part_ids = [p["id"] for p in parts[:3]]
        self.part_codes = [p["partCode"] for p in parts[:3]]
        for p in parts[:3]:
            ok(f"Part: {p['partCode']} - {p['partName']}")

        # Warehouses
        resp, _ = api_get("/inventory/warehouses", {"limit": "10"})
        wh_data = resp.get("data", {})
        warehouses = wh_data.get("data", wh_data) if isinstance(wh_data, dict) else wh_data
        raw_whs = [w for w in warehouses if w.get("warehouseType") == "RAW"]
        assert len(raw_whs) >= 1, "No RAW warehouse"
        self.warehouse_codes = [w["warehouseCode"] for w in raw_whs[:2]]
        for w in raw_whs[:2]:
            ok(f"Warehouse: {w['warehouseCode']} - {w['warehouseName']}")

    def step1_create_po(self):
        header(1, "Create Purchase Order")

        po_no = f"PO-TEST-{int(time.time())}"
        today = datetime.now().strftime("%Y-%m-%d")
        due = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")

        po_data = {
            "poNo": po_no,
            "partnerName": "Test Supplier",
            "orderDate": today,
            "dueDate": due,
            "items": [
                {"partId": self.part_ids[0], "orderQty": 1000, "unitPrice": 500},
                {"partId": self.part_ids[1], "orderQty": 500, "unitPrice": 300},
                {"partId": self.part_ids[2], "orderQty": 200, "unitPrice": 1500},
            ],
        }

        resp, code = api_post("/material/purchase-orders", po_data)
        if resp.get("success"):
            data = resp["data"]
            self.po_id = data["id"]
            self.po_item_ids = [item["id"] for item in data.get("items", [])]
            ok(f"PO created: {po_no} (ID: {self.po_id[:20]}...)")
            ok(f"PO items: {len(self.po_item_ids)}")
            self.results["po"] = True
        else:
            fail(f"PO creation failed: {resp.get('message','')}")
            self.errors.append("PO creation failed")
            info("Will use manual arrival instead")

    def step1b_confirm_po(self):
        header("1b", "Confirm PO (DRAFT -> CONFIRMED)")

        if not self.po_id:
            info("No PO to confirm, skipping")
            return

        resp, code = api_patch(f"/material/purchase-orders/{self.po_id}/confirm")
        if resp.get("success"):
            status = resp.get("data", {}).get("status", "")
            ok(f"PO confirmed: status={status}")
            self.results["po_confirm"] = True
        else:
            fail(f"PO confirm failed: {resp.get('message','')}")
            self.errors.append("PO confirm failed")

    def step2_arrival(self):
        header(2, "Arrival Registration")

        if self.po_id and self.po_item_ids:
            self._arrival_from_po()
        else:
            self._arrival_manual()

    def _arrival_from_po(self):
        arrival_data = {
            "poId": self.po_id,
            "items": [
                {
                    "poItemId": self.po_item_ids[0],
                    "partId": self.part_ids[0],
                    "receivedQty": 1000,
                    "warehouseId": self.warehouse_codes[0],
                    "manufactureDate": (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d"),
                },
                {
                    "poItemId": self.po_item_ids[1],
                    "partId": self.part_ids[1],
                    "receivedQty": 500,
                    "warehouseId": self.warehouse_codes[0],
                    "manufactureDate": (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d"),
                },
                {
                    "poItemId": self.po_item_ids[2],
                    "partId": self.part_ids[2],
                    "receivedQty": 200,
                    "warehouseId": self.warehouse_codes[0],
                },
            ],
        }

        resp, code = api_post("/material/arrivals/po", arrival_data)
        if resp.get("success"):
            self._extract_lots(resp.get("data", {}))
            ok(f"PO arrival success: {len(self.lot_ids)} LOTs created")
            self.results["arrival"] = True
        else:
            fail(f"PO arrival failed: {resp.get('message','')}")
            info("Fallback to manual arrival...")
            self._arrival_manual()

    def _arrival_manual(self):
        qtys = [1000, 500, 200]
        mfg = [
            (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d"),
            (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d"),
            None,
        ]

        for i, (pid, qty) in enumerate(zip(self.part_ids, qtys)):
            data = {
                "partId": pid,
                "warehouseId": self.warehouse_codes[0],
                "qty": qty,
                "vendor": "TestSupplier",
            }
            if mfg[i]:
                data["manufactureDate"] = mfg[i]

            resp, _ = api_post("/material/arrivals/manual", data)
            if resp.get("success"):
                d = resp.get("data", {})
                lot_id = d.get("lotId") or d.get("id") or d.get("lot", {}).get("id", "")
                lot_no = d.get("lotNo") or d.get("lot", {}).get("lotNo", "")
                if lot_id:
                    self.lot_ids.append(lot_id)
                    self.lot_nos.append(lot_no)
                ok(f"Manual arrival #{i+1}: part={self.part_codes[i]}, qty={qty}, LOT={lot_no}")
            else:
                fail(f"Manual arrival #{i+1} failed: {resp.get('message','')}")
                self.errors.append(f"Manual arrival #{i+1} failed")

        self.results["arrival"] = len(self.lot_ids) > 0

    def _extract_lots(self, data):
        if isinstance(data, list):
            for item in data:
                self._add_lot(item)
        elif isinstance(data, dict):
            for key in ["lots", "results", "items"]:
                if key in data and isinstance(data[key], list):
                    for item in data[key]:
                        self._add_lot(item)
                    return
            self._add_lot(data)

    def _add_lot(self, item):
        lot_id = item.get("lotId") or item.get("id") or item.get("lot", {}).get("id", "")
        lot_no = item.get("lotNo") or item.get("lot", {}).get("lotNo", "")
        if lot_id and lot_id not in self.lot_ids:
            self.lot_ids.append(lot_id)
            self.lot_nos.append(lot_no)

    def step3_check_after_arrival(self):
        header(3, "Post-Arrival LOT Check")

        if not self.lot_ids:
            fail("No LOTs! Searching recent...")
            self._search_recent_lots()

        expected_qtys = [1000, 500, 200]
        for i, lot_id in enumerate(self.lot_ids):
            resp, _ = api_get(f"/material/lots/{lot_id}")
            if resp.get("success"):
                lot = resp["data"]
                iqc = lot.get("iqcStatus", "")
                qty = lot.get("currentQty", 0)
                init_qty = lot.get("initQty", 0)
                ok(f"LOT[{i}] {lot.get('lotNo','')}: init={init_qty}, curr={qty}, iqc={iqc}")

                if iqc == "PENDING":
                    ok(f"  iqcStatus correct: PENDING")
                else:
                    fail(f"  iqcStatus wrong: {iqc} (expected PENDING)")
                    self.errors.append(f"LOT[{i}] iqcStatus={iqc}")

                if i < len(expected_qtys) and init_qty == expected_qtys[i]:
                    ok(f"  qty correct: {init_qty}")
                elif i < len(expected_qtys):
                    fail(f"  qty mismatch: {init_qty} (expected {expected_qtys[i]})")
            else:
                fail(f"LOT[{i}] query failed")

    def _search_recent_lots(self):
        resp, _ = api_get("/material/lots", {"limit": "10"})
        lots = resp.get("data", [])
        if isinstance(lots, dict):
            lots = lots.get("data", [])
        for lot in lots[:3]:
            if lot.get("id") and lot["id"] not in self.lot_ids:
                self.lot_ids.append(lot["id"])
                self.lot_nos.append(lot.get("lotNo", ""))
                info(f"Found LOT: {lot.get('lotNo','')}")

    def step4_iqc(self):
        header(4, "IQC Inspection (PASS)")

        if not self.lot_ids:
            fail("No LOTs to inspect!")
            return

        for i, lot_id in enumerate(self.lot_ids):
            iqc_data = {
                "lotId": lot_id,
                "result": "PASS",
                "inspectType": "INITIAL",
                "inspectorName": "AutoVerifier",
            }

            resp, _ = api_post("/material/iqc-history", iqc_data)
            if resp.get("success"):
                ok(f"IQC PASS: LOT[{i}]")
            else:
                fail(f"IQC failed LOT[{i}]: {resp.get('message','')}")
                self.errors.append(f"IQC #{i} failed")

        # Verify status
        for i, lot_id in enumerate(self.lot_ids):
            resp, _ = api_get(f"/material/lots/{lot_id}")
            if resp.get("success"):
                iqc = resp["data"].get("iqcStatus", "")
                if iqc == "PASS":
                    ok(f"LOT[{i}] iqcStatus=PASS confirmed")
                else:
                    fail(f"LOT[{i}] iqcStatus={iqc} (expected PASS)")
                    self.errors.append(f"Post-IQC LOT[{i}] status wrong")

        self.results["iqc"] = True

    def step5_receiving(self):
        header(5, "Receiving Confirmation")

        if not self.lot_ids:
            fail("No LOTs to receive!")
            return

        recv_wh = self.warehouse_codes[1] if len(self.warehouse_codes) > 1 else self.warehouse_codes[0]
        qtys = [1000, 500, 200]

        recv_data = {
            "items": [
                {"lotId": self.lot_ids[i], "qty": qtys[i], "warehouseId": recv_wh}
                for i in range(min(len(self.lot_ids), len(qtys)))
            ],
        }

        resp, code = api_post("/material/receiving", recv_data)
        if resp.get("success"):
            ok(f"Bulk receiving success: {len(recv_data['items'])} items -> {recv_wh}")
            self.results["receiving"] = {"warehouse": recv_wh}
        else:
            fail(f"Bulk receiving failed: {resp.get('message','')}")
            info("Trying individual receiving...")
            success = 0
            for i, item in enumerate(recv_data["items"]):
                resp2, _ = api_post("/material/receiving", {"items": [item]})
                if resp2.get("success"):
                    ok(f"Individual receiving #{i+1} success")
                    success += 1
                else:
                    fail(f"Individual receiving #{i+1} failed: {resp2.get('message','')}")
                    self.errors.append(f"Receiving #{i+1} failed")
            self.results["receiving"] = {"warehouse": recv_wh, "count": success}

    def step6_check_after_receiving(self):
        header(6, "Post-Receiving Stock Check")

        recv_wh = self.results.get("receiving", {}).get("warehouse", self.warehouse_codes[0])

        resp, _ = api_get("/material/stocks", {"warehouseCode": recv_wh, "limit": "50"})
        if resp.get("success"):
            stocks = resp.get("data", [])
            if isinstance(stocks, dict):
                stocks = stocks.get("data", [])

            test_stocks = [s for s in stocks if s.get("partId") in self.part_ids]
            info(f"Warehouse {recv_wh} test stocks: {len(test_stocks)}")
            for s in test_stocks:
                ok(f"  {s.get('partCode', s.get('partId','')[:10])}: qty={s.get('qty',0)}, avail={s.get('availableQty',0)}")

    def step7_issue(self):
        header(7, "Material Issue")

        if len(self.lot_ids) < 3:
            fail(f"Not enough LOTs: {len(self.lot_ids)} (need 3)")
            return

        recv_wh = self.results.get("receiving", {}).get("warehouse", self.warehouse_codes[0])

        # Partial issue: LOT[0] 300, LOT[1] 200
        issue1 = {
            "warehouseCode": recv_wh,
            "issueType": "PROD",
            "items": [
                {"lotId": self.lot_ids[0], "issueQty": 300},
                {"lotId": self.lot_ids[1], "issueQty": 200},
            ],
        }

        resp, _ = api_post("/material/issues", issue1)
        if resp.get("success"):
            ok(f"Partial issue OK: LOT[0] -300, LOT[1] -200")
            self.results["issue1"] = True
        else:
            fail(f"Partial issue failed: {resp.get('message','')}")
            self.errors.append("Partial issue failed")

        # Full issue: LOT[2] -200 (deplete)
        issue2 = {
            "warehouseCode": recv_wh,
            "issueType": "PROD",
            "items": [
                {"lotId": self.lot_ids[2], "issueQty": 200},
            ],
        }

        resp, _ = api_post("/material/issues", issue2)
        if resp.get("success"):
            ok(f"Full issue OK: LOT[2] -200 (should deplete)")
            self.results["issue2"] = True
        else:
            fail(f"Full issue failed: {resp.get('message','')}")
            self.errors.append("Full issue failed")

    def step8_final_verify(self):
        header(8, "FINAL VERIFICATION - Inventory Reconciliation")

        expected = [
            (0, 700, "NORMAL"),
            (1, 300, "NORMAL"),
            (2, 0, "DEPLETED"),
        ]

        all_ok = True
        print()
        info(f"{'LOT':<6} {'LOT No':<25} {'Expect':>8} {'Actual':>8} {'ExpStat':<10} {'ActStat':<10} {'Result'}")
        info(f"{'-'*85}")

        for idx, exp_qty, exp_status in expected:
            if idx >= len(self.lot_ids):
                continue

            resp, _ = api_get(f"/material/lots/{self.lot_ids[idx]}")
            if not resp.get("success"):
                fail(f"LOT[{idx}] query failed")
                all_ok = False
                continue

            lot = resp["data"]
            act_qty = lot.get("currentQty", -1)
            act_status = lot.get("status", "")
            lot_no = lot.get("lotNo", "")

            qty_ok = act_qty == exp_qty
            status_ok = act_status == exp_status
            result = "PASS" if (qty_ok and status_ok) else "FAIL"

            marker = "[OK]" if result == "PASS" else "[FAIL]"
            print(f"  {marker} [{idx}]  {lot_no:<25} {exp_qty:>8} {act_qty:>8} {exp_status:<10} {act_status:<10}")

            if not qty_ok:
                all_ok = False
                self.errors.append(f"LOT[{idx}] qty: {act_qty} != {exp_qty}")
            if not status_ok:
                all_ok = False
                self.errors.append(f"LOT[{idx}] status: {act_status} != {exp_status}")

        # LOT-level stock verification (current test LOTs only)
        print()
        info(f"LOT-based stock summary:")
        info(f"{'LOT':<6} {'Expect':>8} {'Actual':>8} {'Result'}")
        info(f"{'-'*40}")
        total_actual = 0
        for idx, exp_qty, _ in expected:
            if idx >= len(self.lot_ids):
                continue
            resp2, _ = api_get(f"/material/lots/{self.lot_ids[idx]}")
            act = resp2.get("data", {}).get("currentQty", -1) if resp2.get("success") else -1
            total_actual += max(act, 0)
            mark = "[OK]" if act == exp_qty else "[FAIL]"
            info(f"  {mark} [{idx}]  {exp_qty:>8} {act:>8}")
        info(f"{'-'*40}")
        info(f"{'TOTAL':<12} {1000:>8} {total_actual:>8}")

        if total_actual == 1000:
            ok(f"Stock total correct: 1000 (1700 received - 700 issued)")
        else:
            fail(f"Stock total mismatch: {total_actual} (expected 1000)")
            self.errors.append(f"Stock total: {total_actual} != 1000")

        if all_ok and not self.errors:
            print(f"\n  *** ALL VERIFICATION PASSED! ***")
        else:
            print(f"\n  Some verifications FAILED")

    def summary(self):
        print(f"\n{'='*60}")
        print(f"  SUMMARY")
        print(f"{'='*60}")

        checks = [
            ("PO Creation", self.results.get("po")),
            ("PO Confirm", self.results.get("po_confirm")),
            ("Arrival Registration", self.results.get("arrival")),
            ("IQC Inspection", self.results.get("iqc")),
            ("Receiving", "receiving" in self.results),
            ("Partial Issue", self.results.get("issue1")),
            ("Full Issue (Deplete)", self.results.get("issue2")),
        ]

        for name, passed in checks:
            mark = "[OK]" if passed else "[FAIL]"
            print(f"  {mark} {name}")

        if self.errors:
            print(f"\n  Errors ({len(self.errors)}):")
            for e in self.errors:
                print(f"    - {e}")
            sys.exit(1)
        else:
            print(f"\n  ALL PASSED! Arrival->IQC->Receiving->Issue flow verified.")
        print()


if __name__ == "__main__":
    verifier = MaterialFlowVerifier()
    verifier.run()
