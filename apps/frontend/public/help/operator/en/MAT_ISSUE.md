---
menuCode: MAT_ISSUE
audience: operator
title: Material Issue Management (Production) — Operator Guide
summary: Production material issue request approval·processing and barcode scan issue DB structure, stock deduction logic, state transitions, cancellation·reversal mechanism and troubleshooting
tags: [material, issue, production, operations, stock deduction]
keywords: [material issue, production issue, MAT_ISSUES, MAT_ISSUE_REQUESTS, MAT_ISSUE_REQUEST_ITEMS, MAT_STOCKS, STOCK_TRANSACTIONS, issue account, ISSUE_TYPE, PRODUCTION, stock deduction, reversal, issue cancel, WIP_MAT_STOCKS, process move, WIP_MOVE, MAT_OUT, issue number, request number, matUid, material serial, IQC pass, HOLD, DEPLETED, multi-tenancy, COMPANY, PLANT_CD]
related: [MAT_REQUEST, MAT_ISSUE_OTHER, MST_PART]
---

# Material Issue Management (Production) — Operator Guide

## System Purpose & Role
This screen issues materials from the warehouse to the production floor under the PRODUCTION account. On issue confirmation, it **deducts from `MAT_STOCKS` (raw material stock)** and creates **`MAT_ISSUES` (issue history)** and **`STOCK_TRANSACTIONS` (stock transactions)** records. When equipment is assigned to a work order, raw material warehouse deduction is accompanied by **WIP_MAT_STOCKS (WIP stock) addition**.

## Process Flow
```
Issue request created (MAT_ISSUE_REQUESTS: REQUESTED)
  → Approved (APPROVED)
  → Issue processing (MatIssueService.createInTx)
      → MAT_ISSUES created (DONE)
      → MAT_STOCKS deducted (availableQty/qty decreased)
      → STOCK_TRANSACTIONS recorded (MAT_OUT or WIP_MOVE)
      → [Equipment assigned] WIP_MAT_STOCKS added
      → If remaining stock is 0, MAT_LOTS.status → DEPLETED
  → All items fully issued → request status → COMPLETED
```

---

## Data Structure
```
MAT_ISSUE_REQUESTS (issue request header)
  └─ MAT_ISSUE_REQUEST_ITEMS (request item details, PK: REQUEST_ID + SEQ)

MAT_ISSUES (issue result, PK: ISSUE_NO + SEQ)
  ├─ MAT_LOTS (material LOT, matUid reference)
  ├─ MAT_STOCKS (stock by warehouse — deduction target)
  └─ STOCK_TRANSACTIONS (stock transaction history)

MAT_STOCKS (PK: COMPANY + PLANT_CD + WAREHOUSE_CODE + ITEM_CODE + MAT_UID)
  └─ WIP_MAT_STOCKS (WIP stock, equipment unit — added on process move)
```

---

## ① Issue Request — MAT_ISSUE_REQUESTS / MAT_ISSUE_REQUEST_ITEMS (All Columns)

### MAT_ISSUE_REQUESTS

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|---|---|---|
| **Request No.** | `REQUEST_NO` VARCHAR2(50) PK | Natural key. Auto-generated via `MAT_REQ` sequence (`REQ-YYYYMMDD-NNN` format). |
| **Work Order No.** | `ORDER_NO` VARCHAR2(50) | Linked work order. If present, BOM-based items are auto-calculated and populated as request items. |
| **Request Date** | `REQUEST_DATE` TIMESTAMP | Request registration timestamp. DEFAULT CURRENT_TIMESTAMP. |
| **Status** | `STATUS` VARCHAR2(20) | REQUESTED → APPROVED → COMPLETED (or REJECTED). DEFAULT 'REQUESTED'. |
| **Requester** | `REQUESTER` VARCHAR2(100) | Staff member who requested the issue. Currently SYSTEM fixed. |
| **Approver** | `APPROVER` VARCHAR2(100) | Staff member who approved. |
| **Approved At** | `APPROVED_AT` TIMESTAMP | Approval timestamp. |
| **Reject Reason** | `REJECT_REASON` VARCHAR2(500) | Reason entered on rejection. |
| **Issue Type** | `ISSUE_TYPE` VARCHAR2(20) | Based on common code `ISSUE_TYPE`. This screen uses PRODUCTION. |
| **Remark** | `REMARK` VARCHAR2(500) | Free-text notes. |
| **Multi-tenancy Scope** | `COMPANY` / `PLANT_CD` | `COMPANY='40'`, `PLANT_CD='1000'`. Auto-applied to all queries and processing. |

### MAT_ISSUE_REQUEST_ITEMS

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|---|---|---|
| **Request ID** | `REQUEST_ID` VARCHAR2(50) PK | FK referencing header `REQUEST_NO`. |
| **Seq** | `SEQ` INT PK | Item sequence within request. Part of composite PK. |
| **Item Code** | `ITEM_CODE` VARCHAR2(50) | Item requested for issue. Only raw materials (RAW) included; products and consumables (MRO) excluded. |
| **Request Qty** | `REQUEST_QTY` INT | Quantity requested by the field. |
| **Issued Qty** | `ISSUED_QTY` INT | Cumulative quantity actually issued. DEFAULT 0. Incremented on partial issue. |
| **Unit** | `UNIT` VARCHAR2(20) | Quantity unit. |
| **BOM Req Qty** | `BOM_REQ_QTY` NUMBER(12,3) | BOM qtyPer × production quantity. Auto-calculated for work order-based requests. |
| **Prev Issue Qty** | `PREV_ISSUE_QTY` NUMBER(12,3) | Quantity already issued to the same work order. |
| **Floor Stock Qty** | `FLOOR_STOCK_QTY` NUMBER(12,3) | Available stock at floor (FLOOR type warehouse). |
| **Remark** | `REMARK` VARCHAR2(500) | Item-specific notes. |
| **Multi-tenancy** | `COMPANY` / `PLANT_CD` | Same scope as header. |

---

## ② Issue Result — MAT_ISSUES (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|---|---|---|
| **Issue No.** | `ISSUE_NO` VARCHAR2(50) PK | Generated via `MAT_ISSUE` sequence. Multiple SEQ entries under a single issue transaction. |
| **Seq** | `SEQ` INT PK | Item row sequence. DEFAULT 1. |
| **Work Order No.** | `ORDER_NO` VARCHAR2(50) | Linked work order. NULL if none. |
| **Prod Result No.** | `PROD_RESULT_ID` VARCHAR2(50) | Link to production result. Used to check downstream process progress on cancel. |
| **Material Serial** | `MAT_UID` VARCHAR2(50) | Issued LOT serial. References `MAT_LOTS.MAT_UID`. |
| **Issue Qty** | `ISSUE_QTY` INT | Quantity actually issued. |
| **Issue Date** | `ISSUE_DATE` TIMESTAMP | Issue processing timestamp. DEFAULT CURRENT_TIMESTAMP. |
| **Issue Type** | `ISSUE_TYPE` VARCHAR2(20) | Based on common code `ISSUE_TYPE`. DEFAULT 'PROD'. This screen creates as PRODUCTION. |
| **Worker ID** | `WORKER_ID` VARCHAR2(50) | Processing worker ID. |
| **Issuer** | `ISSUER_ID` / `ISSUER_NAME` | Staff ID·name who physically issued the material (barcode scan support planned). |
| **Receiver** | `RECEIVER_ID` / `RECEIVER_NAME` | Staff ID·name who received the material (barcode scan support planned). |
| **Remark** | `REMARK` VARCHAR2(500) | Issue reason or auto-generated message. |
| **Status** | `STATUS` VARCHAR2(20) | DONE(complete) / CANCELED(cancelled). DEFAULT 'DONE'. |
| **Multi-tenancy** | `COMPANY` / `PLANT_CD` | `COMPANY='40'`, `PLANT_CD='1000'`. |

---

## ③ Stock — MAT_STOCKS (Issue Deduction Target)

| DB Column | Role / Meaning · Operational Notes |
|---|---|
| `COMPANY` + `PLANT_CD` + `WAREHOUSE_CODE` + `ITEM_CODE` + `MAT_UID` | Composite PK. Manages stock by warehouse, item, LOT unit. |
| `QTY` | Total quantity. Decreased on issue. |
| `RESERVED_QTY` | Reserved (pre-allocated) quantity. |
| `AVAILABLE_QTY` | Available quantity (= QTY − RESERVED_QTY). Actual deduction basis on issue. |
| `LOCATION_CODE` | Location within warehouse. |

> On issue, `QTY` and `AVAILABLE_QTY` are deducted simultaneously. If stock is distributed across multiple warehouses, the specified warehouse is prioritized, then remaining is deducted in ascending warehouse code order.

---

## Issue Processing Logic (Stock Deduction)

### Standard Issue (Simple MAT_OUT)
1. Look up LOT (`matUid`) → verify IQC passed (PASS) · not on hold (not HOLD).
2. Query available quantity in `MAT_STOCKS` → verify it meets the requested quantity.
3. Create `MAT_ISSUES` row (status=DONE).
4. Deduct `MAT_STOCKS.QTY` and `AVAILABLE_QTY`.
5. Record `STOCK_TRANSACTIONS` (`transType='MAT_OUT'`, `qty=−issueQty`).
6. If LOT's total remaining stock = 0 after deduction → `MAT_LOTS.status → 'DEPLETED'`.

### Process Move Issue (Work Order + Equipment Assigned, WIP_MOVE)
- Same steps 1-5 as above for MAT_STOCKS deduction.
- Additionally **adds** the same quantity to `WIP_MAT_STOCKS` (WIP stock) (`transType='WIP_MOVE'`, `transType='WIP_IN'`).
- Consumed from WIP stock when production results are entered.

### Barcode Scan Issue (scan)
- Calls `POST /material/issues/scan`. Sends `{ matUid, issueType }`.
- Issues **full** available stock of the LOT in one go. Quantity adjustment not possible.
- Internally reuses the standard issue logic above.

---

## Issue Cancel Logic (Reversal)

1. Update `MAT_ISSUES.status → 'CANCELED'`.
2. Look up original `STOCK_TRANSACTIONS` (refType='MAT_ISSUE', refId='issueNo-seq').
3. Create **reversal transaction** for each original transaction:
   - Simple issue (MAT_OUT) → `MAT_OUT_CANCEL` transaction + restore `MAT_STOCKS` (addition).
   - Process move (WIP_MOVE) → `WIP_MOVE_CANCEL` transaction + restore `MAT_STOCKS` + deduct `WIP_MAT_STOCKS` (`WIP_IN_CANCEL`).
4. Restore `MAT_LOTS.status → 'NORMAL'` (if DEPLETED, release).

> **Non-cancellable condition**: If downstream processes (production result RUNNING/DONE, FG label) exist for this issue, cancellation is blocked. Reverse process in order: shipping → pallet → box/OQC → FG label → production result, then retry.

---

## Issue Request State Transition

```
REQUESTED  → (approve) →  APPROVED
           → (reject)  →  REJECTED

APPROVED   → (all items fully issued) →  COMPLETED
           → (partial issue)         →  APPROVED (maintained)
```

- Approve/reject only possible in `REQUESTED` status.
- Issue processing only possible in `APPROVED` status.
- If remaining quantity exists, `APPROVED` status is maintained even after partial issue.

---

## Issue Availability Conditions (Operator Check Points)

To issue a LOT, **all** must be satisfied:

- `MAT_LOTS.iqcStatus = 'PASS'` (IQC passed)
- `MAT_LOTS.status != 'HOLD'` (not on hold)
- `MAT_STOCKS.availableQty >= issue request qty` (sufficient stock)
- `MAT_LOTS.status != 'DEPLETED'` (not already depleted, for scan issue)
- For request-based issue: `MAT_ISSUE_REQUESTS.status = 'APPROVED'`
- For request-based issue: LOT item code matches request item code

---

## Prerequisites (Master·Common Code)

| Setting | Location | Details |
|---|---|---|
| Item Master | `MST_PART` | Item type must be raw material to be included in issue request items |
| Common Code ISSUE_TYPE | Common Code Management | Defines issue types like PRODUCTION, MANUAL, SCRAP |
| Warehouse Master | Warehouse Management | Raw material warehouse · FLOOR type warehouse registration |
| BOM Master | `MST_BOM` | Used for auto-calculation of work order-based items |
| Work Order · Equipment Assignment | `PRD_JOB_ORDERS` | Equipment assignment determines MAT_OUT vs WIP_MOVE branch |

---

## Operating Procedure

1. Field registers issue request → `MAT_ISSUE_REQUESTS` created (REQUESTED).
2. Warehouse/manager reviews request in **Issue Request Processing** tab → approve or reject.
3. After approval, use **Issue Processing** button to select LOT · confirm quantity · execute issue.
4. Partial issue possible — remaining quantity keeps APPROVED status, additional issue possible.
5. Emergency issue: use **Barcode Scan** tab to scan LOT barcode → immediate full quantity issue.
6. For mistaken issues, find the entry in **Issue History** tab and cancel (reason required).

---

## Permissions

| Role | Permitted Actions |
|---|---|
| Warehouse staff | Issue processing (barcode scan), history lookup |
| Manager / Material staff | Issue request approve·reject·issue processing, cancel, history lookup |
| General users | History lookup only |

---

## Troubleshooting

| Symptom | Cause | Action |
|---|---|---|
| LOT list empty in issue modal | No IQC passed + available qty > 0 stock for that item | Check material receiving status and IQC results |
| "IQC not passed" error on barcode scan | `MAT_LOTS.iqcStatus != 'PASS'` | Request IQC completion from inspector |
| "LOT on hold" error on barcode scan | `MAT_LOTS.status = 'HOLD'` | Release hold before issuing |
| "LOT already depleted" error on barcode scan | `MAT_LOTS.status = 'DEPLETED'` or available qty = 0 | Use a different LOT or check stock adjustment |
| "Insufficient LOT stock" error | `MAT_STOCKS.availableQty < issueQty` | Check stock status and reconfirm quantity |
| Issue cancel blocked | Downstream processes exist (production result RUNNING/DONE, FG label) | Reverse process: shipping → pallet → box/OQC → FG label → production result, then retry |
| "Already cancelled issue" error | `MAT_ISSUES.status = 'CANCELED'` | Already cancelled. Prevent duplicate request |
| Item code mismatch error | Selected LOT item code differs from request item code | Select correct LOT or recheck request item |
| Cannot issue after approval | `MAT_ISSUE_REQUESTS.status != 'APPROVED'` | Check status; if REQUESTED, approve first |

---

## Data & Integration

| Item | Details |
|---|---|
| **Core tables** | `MAT_ISSUES`, `MAT_ISSUE_REQUESTS`, `MAT_ISSUE_REQUEST_ITEMS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS` |
| **Related tables** | `MAT_LOTS`(LOT info), `PART_MASTERS`(item name·unit), `JOB_ORDERS`(work order·equipment), `WIP_MAT_STOCKS`(WIP stock), `MAT_LOTS.status`(auto-set DEPLETED) |
| **Related screens** | Issue Request Management (MAT_REQUEST), Other Issue Management (MAT_ISSUE_OTHER), Material Stock Status (MAT_STOCK), Production Result |
| **API** | `GET /material/issue-requests`, `PATCH /material/issue-requests/:id/approve·reject`, `POST /material/issue-requests/:id/issue`, `POST /material/issues/scan`, `GET /material/issues`, `POST /material/issues/:no/:seq/cancel` |
| **Multi-tenancy scope** | `COMPANY='40'`, `PLANT_CD='1000'` — auto-applied to all queries, creation, and cancellation |
