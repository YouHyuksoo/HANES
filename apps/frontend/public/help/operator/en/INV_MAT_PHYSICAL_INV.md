---
menuCode: INV_MAT_PHYSICAL_INV
audience: operator
title: Physical Inventory Management — Operator Guide
summary: PHYSICAL_INV_SESSIONS + COUNT_DETAILS full columns, count process (session→scan→apply), inventory freeze mechanism
tags: [stock, physical, operations, session, freeze]
keywords: [PHYSICAL_INV_SESSIONS, PHYSICAL_INV_COUNT_DETAILS, physical inventory, IN_PROGRESS, InventoryFreezeGuard, PDA scan, session start, session end, count apply, MAT_STOCKS]
related: [INV_MAT_PHYSICAL_INV_APPLY, INV_MAT_STOCK, MAT_ADJUSTMENT]
---

# Physical Inventory Management — Operator Guide

## System Purpose & Role
Manages **physical inventory** sessions to find differences between actual warehouse stock and system stock. When a session is started, stock transactions for that warehouse are blocked (`InventoryFreezeGuard`), and PDA scanning of item count quantities is enabled. After session completion, the count results are applied to stock.

## Data Structure
```
PHYSICAL_INV_SESSIONS (PK: SESSION_DATE + SEQ)
    │
    ├── STATUS: IN_PROGRESS → COMPLETED
    ├── INV_TYPE: MATERIAL / PRODUCT
    │
    └──▶ PHYSICAL_INV_COUNT_DETAILS (PK: SESSION_DATE + SEQ + WAREHOUSE_CODE + ITEM_CODE + MAT_UID)
            │
            ├── SYSTEM_QTY (snapshot at session start)
            ├── COUNTED_QTY (PDA cumulative scan)
            └──▶ On apply → MAT_STOCKS updated + STOCK_TRANSACTIONS + INV_ADJ_LOGS
```

---

## ① Physical Inventory Session — PHYSICAL_INV_SESSIONS (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Session Date | `SESSION_DATE` | **PK (1/2)**. Session creation date. Auto-generated (`SYSDATE`). |
| Sequence | `SEQ` | **PK (2/2)**. Sequence generated. |
| Count Type | `INV_TYPE` | `MATERIAL` (material) / `PRODUCT` (product). |
| Status | `STATUS` | `IN_PROGRESS` (in progress) / `COMPLETED` (completed) / `CANCELLED` (canceled). |
| Count Month | `COUNT_MONTH` | Target month for the count. `YYYY-MM` format. |
| Warehouse Code | `WAREHOUSE_CODE` | Target warehouse (NULL = all). |
| Company | `COMPANY` | Multi-tenancy. |
| Plant | `PLANT_CD` | Multi-tenancy. |
| Started By | `STARTED_BY` | User who started the session. |
| Completed By | `COMPLETED_BY` | User who completed the session. |
| Completed At | `COMPLETED_AT` | Session completion time. |
| Remark | `REMARK` | Notes. |
| Created At | `CREATED_AT` | Record creation time. |
| Updated At | `UPDATED_AT` | Record modification time. |

---

## ② Count Detail — PHYSICAL_INV_COUNT_DETAILS (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Session Date | `SESSION_DATE` | **PK (1/5)**. References parent session. |
| Session SEQ | `SEQ` | **PK (2/5)**. References parent session. |
| Warehouse Code | `WAREHOUSE_CODE` | **PK (3/5)**. |
| Item Code | `ITEM_CODE` | **PK (4/5)**. |
| Material Serial | `MAT_UID` | **PK (5/5)**. LOT serial. |
| Location Code | `LOCATION_CODE` | Location on PDA scan. |
| System Qty | `SYSTEM_QTY` | System stock snapshot at session start. |
| Counted Qty | `COUNTED_QTY` | Cumulative count quantity scanned by PDA. |
| Counted By | `COUNTED_BY` | Last scan user. |
| Actual Location | `ACTUAL_LOCATION` | Confirmed actual storage location (for adjustment). |
| Remark | `REMARK` | Notes. |
| Created At | `CREATED_AT` | |
| Updated At | `UPDATED_AT` | |

---

## Inventory Freeze Mechanism

While a physical inventory session is `IN_PROGRESS`, `InventoryFreezeGuard` blocks the following transactions:

| Blocked Operation | Details |
|----------|------|
| Material Receipt | `POST /material/receiving` |
| Material Issue | `POST /material/issue` |
| Stock Adjustment | `POST /material/adjustment` |
| LOT Split/Merge | Related APIs |
| Stock Transfer | Related APIs |

> The freeze operates by checking for an existing `IN_PROGRESS` row in `PHYSICAL_INV_SESSIONS`. It is automatically released when the session is completed or canceled.

---

## Full Physical Inventory Process

```
1. [PC] Session Start → POST /material/physical-inv/session/start
    → PHYSICAL_INV_SESSIONS INSERT (IN_PROGRESS)
    → Stock transactions blocked

2. [PDA] Shop Floor Scan → POST /material/physical-inv/count
    → PHYSICAL_INV_COUNT_DETAILS UPSERT (countedQty cumulative +1)
    → Repeated scanning accumulates count quantity

3. [PC] Session End → POST /material/physical-inv/session/:date/:seq/complete
    → PHYSICAL_INV_SESSIONS UPDATE (COMPLETED)
    → Stock transaction block released

4. [PC] Apply Count → POST /material/physical-inv
    → MAT_STOCKS.qty updated
    → STOCK_TRANSACTIONS (PHYSCOUNT_IN/OUT)
    → INV_ADJ_LOGS (PHYSICAL_COUNT)
```

---

## Permissions
Users with physical inventory management authority (material/quality manager). PDA scanning performed by shop floor workers.

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| "Session already in progress" error | Same IN_PROGRESS session already exists | Complete existing session first, then restart |
| Receipt/issue/adjustment blocked (403) | Physical inventory session is IN_PROGRESS | End or cancel the session |
| PDA scan not working | No active session or warehouse mismatch | Verify session is started and warehouse matches |
| Counted qty shown as 0 | Not yet scanned or UPSERT failed | Check PDA connection and rescan |
| Difference column not calculated | `countedQty` is NULL | Refresh after PDA scan completion |

## Data & Integration
- **Tables**: `PHYSICAL_INV_SESSIONS`, `PHYSICAL_INV_COUNT_DETAILS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS`, `INV_ADJ_LOGS`
- **Integration**: PDA interface (`POST /count`), Count Apply page, `InventoryFreezeGuard`
- **Scope**: `COMPANY='40'`, `PLANT_CD='1000'`
