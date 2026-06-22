---
menuCode: PUR_PO
audience: operator
title: PO Management — Operator Guide
summary: PURCHASE_ORDERS / PURCHASE_ORDER_ITEMS table structure, state transition logic, generation rules, multi-tenancy scope, troubleshooting included
tags: [material management, purchase order, PO, operations, master]
keywords: [PURCHASE_ORDERS, PURCHASE_ORDER_ITEMS, PO_NO, PARTNER_ID, PARTNER_NAME, ORDER_DATE, DUE_DATE, STATUS, USE_TYPE, TOTAL_AMOUNT, LINE_NO, REV_NO, SEQ, ORDER_QTY, RECEIVED_QTY, LINE_STATUS, REL_NO, UNIT_PRICE, DRAFT, CONFIRMED, PARTIAL, RECEIVED, CLOSED, generation, multi-tenancy, COMPANY, PLANT_CD, arrival, IQC]
related: [PUR_PO_STATUS, MAT_RECEIVE, MST_PART]
---

# PO Management — Operator Guide

## System Purpose & Role
This is the core screen of the material management module, managing the entire lifecycle of purchase orders (POs). Registered POs are referenced during arrival processing in Arrival Management (MAT_RECEIVE), with status auto-updated to PARTIAL/RECEIVED. Arrival processing is impossible without a PO.

## Data Structure

```
PURCHASE_ORDERS (PK: PO_NO)
  ├─ PARTNER_ID ──▶ PARTNER_MASTERS (supplier)
  └─ PURCHASE_ORDER_ITEMS (PK: PO_ID + SEQ)
       └─ ITEM_CODE ──▶ ITEM_MASTERS (item master)
       └─ References: MAT_ARRIVALS (arrival linkage)
```

## ① PO Header — PURCHASE_ORDERS (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| PO No. | `PO_NO` | PK (natural key). Generation rule: `PO-YYYYMMDD-NNN` (NumberingService). Immutable — cannot change after creation. |
| Vendor (ID) | `PARTNER_ID` | References `PARTNER_MASTERS.PARTNER_CODE`. Screen displays name (`partnerName`). |
| Vendor Name | `PARTNER_NAME` | Auto-filled from master based on `PARTNER_ID` at registration. PO record retains registration-time name even if vendor name changes later. |
| Order Date | `ORDER_DATE` | date type. Defaults to today at registration. List filter column (`@Index`). |
| Due Date | `DUE_DATE` | date type. nullable. Used for arrival on-time delivery analysis. |
| Status | `STATUS` | State flow (see below). Default `DRAFT`. Common code `PO_STATUS`. `@Index` present. |
| Usage Type | `USE_TYPE` | PO purpose classification. Currently defaults to `PROD` (production). Not exposed in UI. |
| Total Amount | `TOTAL_AMOUNT` | decimal(14,2). Sum of item `ORDER_QTY × UNIT_PRICE`. 0 if unit price not entered. Calculated at service layer on save. |
| Remark | `REMARK` | varchar2(500). |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | Scope: `'40'` / `'1000'`. Applied to all queries and saves. |
| Creator | `CREATED_BY` | Session user ID. |
| Modifier | `UPDATED_BY` | Session user ID on update. |
| Audit | `CREATED_AT`, `UPDATED_AT` | timestamp. TypeORM `@CreateDateColumn` / `@UpdateDateColumn`. |

## ② PO Items — PURCHASE_ORDER_ITEMS (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| (None) | `PO_ID` | PK component (composite). References `PURCHASE_ORDERS.PO_NO`. Entity field name is `poNo`. |
| (None) | `SEQ` | PK component (composite). Item save order (0-based index + 1). |
| Item Code | `ITEM_CODE` | References `ITEM_MASTERS.ITEM_CODE`. `@Index` present. |
| Order Qty | `ORDER_QTY` | int. Required integer ≥ 1. |
| Received Qty | `RECEIVED_QTY` | int. Default 0. Auto-accumulated on arrival processing. Not editable on screen (PO registration) — only changed in Arrival Management. |
| Line No. | `LINE_NO` | User-assigned PO line identifier. Defaults to addition order. |
| Rev No. | `REV_NO` | PO revision for the same item. Default 1. Screen label: "Rev No." |
| Line Status | `LINE_STATUS` | Default `OPEN`. Changes with receipt progress (operational reference). Not exposed on screen. |
| Rel No. | `REL_NO` | nullable int. Reference for ERP or external system release. Currently not shown on screen. |
| Unit Price | `UNIT_PRICE` | decimal(12,4). nullable. No input UI on screen (API direct or future expansion). Used for total amount calculation. |
| Remark | `REMARK` | varchar2(500). Item line notes. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | Auto-applied same scope as header. |
| Audit | `CREATED_AT`, `UPDATED_AT` | timestamp. |

## State Transition Logic

| Transition | API Path | Condition | Notes |
|------|------|------|------|
| DRAFT → CONFIRMED | `PATCH /material/purchase-orders/:id/confirm` | Current status must be `DRAFT` | PO confirmed. Ready for arrival. |
| CONFIRMED → PARTIAL | (auto on arrival processing) | Some items received | Auto-changed on MAT_ARRIVALS processing |
| PARTIAL → RECEIVED | (auto on arrival processing) | All items received | Auto-changed on MAT_ARRIVALS processing |
| RECEIVED/PARTIAL → CLOSED | `PATCH /material/purchase-orders/:id/close` | Current status `RECEIVED` or `PARTIAL` | Manual close |
| DRAFT → (delete) | `DELETE /material/purchase-orders/:id` | DRAFT + no arrival history | 400 error if arrival exists |

> Statuses cannot be directly rolled back via screen UI after CONFIRMED. DB direct modification or API calls are needed for status restoration.

## PO Number Generation Rules

- Service: `NumberingService.nextPoNo()`
- Format: `PO-YYYYMMDD-NNN` (e.g., `PO-20260621-001`)
- API: `GET /material/purchase-orders/next-no` — auto-called when registration panel opens.
- PO No. is the PK (`PO_NO`) of `PURCHASE_ORDERS`, so duplicate registration returns 409 ConflictException.

## Item Edit Behavior (on Save)

On save, items (PURCHASE_ORDER_ITEMS) are processed as **delete all existing → re-insert** (transaction-protected). `SEQ` is re-issued (0-based index + 1). `RECEIVED_QTY` may also be reset in this process, so avoid item edits on POs with partial arrivals.

## Total Amount Calculation

Total amount (`TOTAL_AMOUNT`) is calculated at the service layer on save as follows:

```
TOTAL_AMOUNT = Σ (ORDER_QTY × UNIT_PRICE)
```

If `UNIT_PRICE` is null, it is treated as 0. Total amount is recorded in `PURCHASE_ORDERS.TOTAL_AMOUNT` on save and is not recalculated in real time.

## Prerequisites (Master·Common Code)

- Common code `PO_STATUS`: DRAFT / CONFIRMED / PARTIAL / RECEIVED / CLOSED — each code's `attr1` (CSS class) controls list badge color
- Vendor Master (`PARTNER_MASTERS`): Only `partnerType='SUPPLIER'` types are selectable
- Item Master (`ITEM_MASTERS`): Only `itemType='RAW_MATERIAL'` types are searchable in the item add modal

## Operating Procedure

1. **PO Registration**: Select vendor → set order date/due date → add items (multi-select possible) → enter order qty → save (DRAFT)
2. **PO Confirm**: From DRAFT PO, execute confirm action → CONFIRMED (arrival-ready status)
3. **Arrival Linkage**: Process receipt in Arrival Management screen by PO number → RECEIVED_QTY updated → status auto-transitioned
4. **Close**: Manual close (CLOSED) after all receipts complete

## Permissions

- **Create·Edit·Delete**: Material management staff (DRAFT status only)
- **Confirm·Close**: Material management staff or purchasing approver
- **View**: All users

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| "PO number already exists" on save (409) | `PO_NO` duplicate | Use auto-generated number as is, or change to a different number |
| Save blocked when order qty is 0 or decimal | `ORDER_QTY` validation (integer ≥ 1) | Change to integer ≥ 1 and save |
| Cannot delete PO "Arrival in progress" error | Arrival history exists for this `PO_NO` in `MAT_ARRIVALS` | Cancel/delete arrival history first, then delete PO |
| Cannot delete PO "Only DRAFT can be deleted" error | `STATUS != 'DRAFT'` | Restore status via DB direct manipulation or operational procedure |
| Total amount shows 0 | `UNIT_PRICE` not entered | Register item unit price (API or DB direct) |
| Item name/spec not showing in list | `ITEM_CODE` does not exist in `ITEM_MASTERS` | Verify item is registered in Item Master |
| RECEIVED_QTY reset to 0 after edit | Save triggers full item delete·re-insert | Avoid item edits on POs with arrivals; use DB direct correction if needed |

## Data & Integration

- Tables: `PURCHASE_ORDERS`, `PURCHASE_ORDER_ITEMS`
- Integration: `PARTNER_MASTERS`(supplier), `ITEM_MASTERS`(item), `MAT_ARRIVALS`(arrival processing)
- API routes: `GET|POST /material/purchase-orders`, `GET|PUT|DELETE /material/purchase-orders/:id`, `PATCH /material/purchase-orders/:id/confirm`, `PATCH /material/purchase-orders/:id/close`
- Scope: `COMPANY='40'`, `PLANT_CD='1000'` (auto-applied to all queries and saves)
