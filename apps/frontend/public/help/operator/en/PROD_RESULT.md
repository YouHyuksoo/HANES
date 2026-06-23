---
menuCode: PROD_RESULT
audience: operator
title: Production Result — Operator Guide
summary: Unified production result inquiry·edit·cancel by process — CUT/CRIMP/ASSY/INSP/PACK, worker avatar display, auto stock reversal on cancel
tags: [production, result, inquiry, edit, cancel]
keywords: [PROD_RESULTS, JOB_ORDERS, RUNNING, DONE, CANCELED, goodQty, defectQty, cycleTime, prdUid, production result, work result, result cancel, stock reversal]
related: [PROD_RESULT_SUMMARY, PROD_INPUT_KIOSK, PROD_ORDER]
---

# Production Result — Operator Guide

## System Purpose & Role
Unified inquiry, edit, and cancel of production results by process (CUT/CRIMP/ASSY/INSP/PACK). Displays worker profile avatars. Cancel reverses materials and product stock automatically.

```
RUNNING → DONE (complete) / CANCELED (cancel → stock reversal)
```

## Data Structure
```
PROD_RESULTS (PK: RESULT_NO, auto-numbered)
   ├─ ORDER_NO → JOB_ORDERS
   ├─ EQUIP_CODE → EQUIP_MASTER
   ├─ WORKER_NO → WORKER_MASTERS
   ├─ GOOD_QTY / DEFECT_QTY
   ├─ START_TIME / END_TIME / CYCLE_TIME
   └─ STATUS: RUNNING → DONE / CANCELED
```

## Screen Layout
- **Header**: Title + Refresh button
- **Toolbar**: Search (result no·order no·product UID) + Process filter (CUT/CRIMP/ASSY/INSP/PACK) + DateRangeFilter (default today)
- **DataGrid**: `GET /production/prod-results?limit=5000`

| Column | Description |
|------|-------------|
| Result No. | `RESULT_NO` (PK) |
| Work Date | `START_TIME` |
| Process | `PROCESS_CODE` (ComCodeBadge) |
| Order No. | `ORDER_NO` |
| Item Name | `JOB_ORDERS → PART_MASTERS.ITEM_NAME` |
| Line | `JOB_ORDERS.LINE_CODE` |
| Equipment | `EQUIP_MASTER.EQUIP_NAME` |
| Worker | `WORKER_MASTERS` (avatar + name) |
| Product UID | `PRD_UID` (serial/LOT) |
| Good Qty | `GOOD_QTY` (green) |
| Defect Qty | `DEFECT_QTY` (red) |
| Defect Rate | `DEFECT_QTY / (GOOD_QTY + DEFECT_QTY) × 100` |
| Work Time | `START_TIME ~ END_TIME` |
| Cycle Time | `CYCLE_TIME` (sec) |
| Status | `STATUS` (RUNNING/DONE/CANCELED) |
| Actions | Edit·Cancel·Delete |

## Workflow

### ① Query
- Filter by process type (CUT/CRIMP/ASSY/INSP/PACK)
- Date range (START_TIME)
- Search by order no·result no·product UID

### ② Edit
`PUT /production/prod-results/{resultNo} { goodQty, defectQty, remark }`
- RUNNING/DONE status only
- Qty changes trigger auto material reversal/re-issue + stock adjustment

### ③ Cancel
`POST /production/prod-results/{resultNo}/cancel { remark }`
- RUNNING/DONE → CANCELED
- Reverses: materials, product stock, equipment assignment
- Blocked if downstream (FG_LABELS·BOX·PALLET·SHIPMENT) exists

### ④ Delete
`DELETE /production/prod-results/{resultNo}`
- CANCELED status only

## Key Rules

| Rule | Description |
|------|-------------|
| Auto material deduction | BOM-based on create (ON_CREATE) and complete (ON_COMPLETE) |
| Product stock immediate | Good→WIP_MAIN, Defect→DEFECT warehouse on create |
| Equipment BOM interlock | Blocks if equipment BOM ≠ job order part |
| Job order auto-promote | First result→WAITING→RUNNING, plan met→auto DONE |
| Shift auto-assignment | Via SHIFT_PATTERNS |
| Mold stroke count | ConsumableMaster.currentCount increments on complete |

## Interlock

| Condition | Description |
|------|-------------|
| Downstream exists on cancel | Blocked if FG_LABELS/BOX/PALLET/SHIPMENT exist |
| Already CANCELED | Delete only |
| ORDER_NO change | Not allowed |
| Direct STATUS change | Must use complete/cancel API |

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| No results | No data in period/filter | Relax filter conditions |
| Cannot cancel | Pack/ship in progress | Check downstream, reverse order |
| Cannot edit | CANCELED status | Cancel and rework |
| Cannot create | Equipment BOM mismatch | Check equipment BOM |

## Data & Integration
- Tables: `PROD_RESULTS`, `JOB_ORDERS`, `EQUIP_MASTER`, `WORKER_MASTERS`, `PART_MASTERS`, `DEFECT_LOGS`, `FG_LABELS`, `SG_LABELS`, `PRODUCT_TRANSACTIONS`, `MAT_ISSUES`, `STOCK_TRANSACTIONS`, `BOX_MASTERS`, `PALLET_MASTERS`, `SHIPMENT_LOGS`
- Integration: Job order(`/production/order`) → **Production result(this)** → Summary(`/production/result-summary`)
- Scope: `COMPANY='40'`, `PLANT_CD='1000'`
