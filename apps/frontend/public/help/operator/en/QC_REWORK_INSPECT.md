---
menuCode: QC_REWORK_INSPECT
audience: operator
title: Rework Inspection — Operator Guide
summary: IATF 16949 rework verification inspection — pending inspection list, PASS/FAIL/SCRAP judgment, quantity entry, automatic inventory transfer
tags: [quality, rework, re-inspection, IATF16949]
keywords: [REWORK_ORDERS, REWORK_INSPECTS, INSPECT_PENDING, INSPECT_METHOD, PASS, FAIL, SCRAP, DEFECT_LOG, rework inspection, re-inspection, rework, defect handling]
related: [QC_INSPECT, INSP_RESULT]
---

# Rework Inspection — Operator Guide

## System Purpose & Role
Performs **rework verification inspection** per IATF 16949 requirements. Browse orders in `INSPECT_PENDING` status after rework completion, judge PASS/FAIL/SCRAP, and register inspection results. **Inventory auto-transfers** based on results, and the linked DefectLog status is synchronized.

```
Defect → DefectLog → ReworkOrder(REGISTERED) → Approval → Rework → INSPECT_PENDING
    → Inspect(PASS/FAIL/SCRAP) → Inventory Transfer + DefectLog sync
```

## Status Flow (REWORK_ORDERS)
```
REGISTERED → QC_PENDING → PROD_PENDING → APPROVED
    → IN_PROGRESS → INSPECT_PENDING → PASS / FAIL / SCRAP
```

## Data Structure
```
REWORK_ORDERS (PK: REWORK_NO, format: RW-YYYYMMDD-NNN)
   ├─ DEFECT_LOG_ID → DefectLog
   ├─ ITEM_CODE → PartMaster
   ├─ REWORK_QTY / RESULT_QTY / PASS_QTY / FAIL_QTY
   └─ STATUS: INSPECT_PENDING

REWORK_INSPECTS (PK: REWORK_ORDER_ID + SEQ)
   Inspection results (SEQ auto-increments per order)
```

## Screen Layout

### Main Area
- **Header**: Title + Refresh button
- **StatCard (3)**:
  - 🔵 Pending count (list count)
  - 🟢 PASS count (statistics)
  - 🔴 FAIL count (statistics)
- **DataGrid**: `GET /quality/reworks?status=INSPECT_PENDING&limit=5000`
  - Columns: rework no·item code·item name·rework qty·result qty·worker·complete time·status
  - Status shown as `REWORK_STATUS` common code badge
  - Search: rework no·item code·item name (300ms debounce)
  - Click `FileSearch` icon → open right panel

### Right Panel (480px, InspectFormPanel)
`POST /quality/reworks/inspects`

| Field | Component | Description |
|------|----------|-------------|
| Target Summary | Card | Rework no·item code·rework qty·result qty |
| Inspector | `WorkerSelect` | Required. Submit disabled if empty |
| Inspect Method | `ComCodeSelect` | Common code `INSPECT_METHOD` |
| Inspect Result | Radio (3) | PASS / FAIL / SCRAP (default: PASS) |
| Pass Qty | `QtyInput` | Good quantity on PASS (default: resultQty) |
| Fail Qty | `QtyInput` | Defect quantity on FAIL/SCRAP |
| Defect Detail | textarea | FAIL/SCRAP reason |
| Remark | `Input` | |

## Inspection Flow

### ① Check Pending List
`GET /quality/reworks?status=INSPECT_PENDING`
- Auto-transitions to `INSPECT_PENDING` when all rework processes complete
- Use search to filter orders

### ② Enter Inspection Info
- Select inspector (required)
- Select inspect method (e.g., 100% inspection, sampling)
- Select result: **PASS** / **FAIL** / **SCRAP**
  - **PASS**: Good → inventory `DEFECT` → `WIP_MAIN` transfer
  - **FAIL**: Rework defect → stays in `DEFECT` warehouse (re-rework)
  - **SCRAP**: Scrap → `DEFECT` → `SCRAP` warehouse transfer

### ③ Register Inspection (POST /quality/reworks/inspects)
Server processing:
1. Status validation: throws `BadRequestException` if not `INSPECT_PENDING`
2. Auto SEQ: existing inspect count + 1
3. Update REWORK_ORDERS status/qty:
   - `status` = inspect result (PASS/FAIL/SCRAP)
   - `passQty`, `failQty` updated
   - `isolationFlag`: PASS=0(released), FAIL/SCRAP=1(isolated)
4. DefectLog sync (if linked):
   - PASS → `DONE`, SCRAP → `SCRAP`, FAIL → `REWORK` (unchanged)
5. Inventory (except FAIL):
   - PASS: passQty → DEFECT→WIP_MAIN (supplemental receipt if short)
   - SCRAP: failQty → DEFECT→SCRAP
   - FAIL: no movement, stays in DEFECT

## Interlock (Blocking Conditions)

| Condition | Message | Resolution |
|------|--------|-----------|
| Inspector not selected | Select an inspector | Pick from WorkerSelect |
| Status not INSPECT_PENDING | Not in pending inspection status | Refresh and retry |

## Rework Status Codes (REWORK_STATUS)

| Code | Meaning | Note |
|------|---------|------|
| REGISTERED | Registered | Created from DefectLog |
| QC_PENDING | QC approval pending | |
| PROD_PENDING | Production approval pending | |
| APPROVED | Approved | QC + Production approved |
| IN_PROGRESS | Rework in progress | Per-process work |
| INSPECT_PENDING | **Pending inspection** | **Filtered by this screen** |
| PASS | Passed | Inventory restored |
| FAIL | Failed | Re-rework needed |
| SCRAP | Scrapped | Scrap processed |

## All Columns — REWORK_ORDERS

| Field | DB Column | Role |
|------|---------|------|
| Rework No. | `REWORK_NO` | PK. Format `RW-YYYYMMDD-NNN` |
| Defect Log ID | `DEFECT_LOG_ID` | Linked DefectLog |
| Item Code | `ITEM_CODE` | FK → PartMaster |
| Item Name | `ITEM_NAME` | |
| Rework Qty | `REWORK_QTY` | Total rework target qty |
| Result Qty | `RESULT_QTY` | Actual completed qty |
| Status | `STATUS` | `REWORK_STATUS` common code |
| Rework Method | `REWORK_METHOD` | IATF: approved method |
| Isolation Flag | `ISOLATION_FLAG` | 1=isolated, 0=released |
| Pass Qty | `PASS_QTY` | Set by inspection |
| Fail Qty | `FAIL_QTY` | Set by inspection |
| Worker | `WORKER_CODE` | |
| Line | `LINE_CODE` | FK → ProdLineMaster |
| Equipment | `EQUIP_CODE` | FK → EquipMaster |
| Start | `START_AT` | |
| End | `END_AT` | |
| Remark | `REMARK` | |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | `40` / `1000` |

## All Columns — REWORK_INSPECTS

| Field | DB Column | Role |
|------|---------|------|
| Rework Order ID | `REWORK_ORDER_ID` | PK (FK → REWORK_ORDERS) |
| Seq | `SEQ` | PK (auto-increment per order) |
| Inspector | `INSPECTOR_CODE` | |
| Inspect At | `INSPECT_AT` | |
| Inspect Method | `INSPECT_METHOD` | Common code `INSPECT_METHOD` |
| Inspect Result | `INSPECT_RESULT` | PASS / FAIL / SCRAP |
| Pass Qty | `PASS_QTY` | |
| Fail Qty | `FAIL_QTY` | |
| Defect Detail | `DEFECT_DETAIL` | Max 1000 chars |
| Remark | `REMARK` | |

## Prerequisites
- Common codes: `REWORK_STATUS`, `INSPECT_METHOD`
- Rework orders must be in `INSPECT_PENDING` status
- Inventory: DEFECT/WIP_MAIN/SCRAP warehouses must be registered
- Permissions: Quality inspector (register inspection), Admin (edit history)

## DefectLog Link Rules
- DefectLog linked to rework cannot be directly deleted/modified
- Auto-synced on inspection registration, no separate DefectLog handling needed
- Deleting linked DefectLog throws `Cannot directly process defect linked to rework`

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| List is empty | No `INSPECT_PENDING` orders | Check rework process completion |
| Submit button disabled | Inspector not selected | Select inspector |
| "Not in pending inspection" error | Status wrong | Refresh and retry |
| Inventory insufficient on SCRAP | DEFECT warehouse shortage | Check inventory, adjust qty |
| DefectLog cannot be edited | Linked to ReworkOrder | Handle via inspection |

## Data & Integration
- Tables: `REWORK_ORDERS`, `REWORK_INSPECTS`, `REWORK_PROCESSES`, `REWORK_RESULTS`, `DEFECT_LOGS`, `PartMaster`
- Integration: DefectLog → Rework Order → Process → **Inspection (this screen)** → Inventory
- Rework No. format: `RW-YYYYMMDD-NNN` (auto-generated)
- Scope: `COMPANY='40'`, `PLANT_CD='1000'`
