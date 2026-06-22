---
menuCode: CONS_RECEIVING
audience: operator
title: Consumable Receiving — Operator Guide
summary: Two consumable receiving paths (barcode scan label confirmation / manual IN) and DB mapping (CONSUMABLE_LOGS·CONSUMABLE_STOCKS·CONSUMABLE_MASTERS), stock update·sign logic, generation, permissions, troubleshooting, multi-tenancy
tags: [consumable, receiving, stock transaction, operations]
keywords: [consumable receiving, receipt, return receipt, IN, IN_RETURN, CONSUMABLE_LOGS, CONSUMABLE_STOCKS, CONSUMABLE_MASTERS, STOCK_QTY, conUid, CON_UID, PENDING, ACTIVE, SEQ_CONSUMABLE_LOGS, generation, stock update, receiving type, NEW, REPLACEMENT, multi-tenancy, COMPANY, PLANT_CD]
related: [CONS_MASTER, CONS_LABEL, CONS_STOCK]
---

# Consumable Receiving — Operator Guide

## System Purpose & Role
This screen handles **receiving transactions that confirm consumables into warehouse stock**. When receiving is processed, the consumable master's (`CONSUMABLE_MASTERS.STOCK_QTY`) held stock increases or decreases, and one transaction is generated and recorded in the receipt/issue history table (`CONSUMABLE_LOGS`). There are two receiving paths.

> Two receiving paths:
> - **① Barcode Scan Receiving**(`POST /consumables/label/confirm`): Confirms individual instances (`CONSUMABLE_STOCKS`, `CON_UID`) generated via label issuance from `PENDING → ACTIVE`. UID-level tracking.
> - **② Manual Receiving**(`POST /consumables/receiving`, `logType: 'IN'`): Increases stock by consumable code + quantity without UID. Does not create `CONSUMABLE_STOCKS` instances.

## Data Structure
```
CONSUMABLE_MASTERS (PK: CONSUMABLE_CODE, STOCK_QTY = held stock)
   ├─ 1:N ─▶ CONSUMABLE_STOCKS (PK: CON_UID, status PENDING→ACTIVE→…) ← scan receiving target
   └─ 1:N ─▶ CONSUMABLE_LOGS   (composite PK: TRANS_DATE + SEQ, receipt/issue history) ← both paths recorded
```
- Scan receiving: `CONSUMABLE_STOCKS` state transition + 1 `CONSUMABLE_LOGS` (IN) record + `STOCK_QTY +1`.
- Manual receiving: 1 `CONSUMABLE_LOGS` (IN) record + `STOCK_QTY += qty`. (No instance created)

## API
| Action | Method · Path | Description |
|------|------|------|
| Unreceived waiting list | `GET /consumables/label/pending` | List of `CONSUMABLE_STOCKS.STATUS='PENDING'` |
| Scan receive confirm | `POST /consumables/label/confirm` `{ conUid, location?, remark? }` | PENDING→ACTIVE, `STOCK_QTY +1`, IN log |
| Scan return receipt | `POST /consumables/label/return` `{ conUid, returnReason? }` | ACTIVE→RETURNED, `STOCK_QTY -1`, IN_RETURN log |
| Bulk scan receive | `POST /consumables/label/confirm-bulk` `{ conUids[], location? }` | Sequential confirm loop |
| Manual receiving | `POST /consumables/receiving` `{ consumableId, qty, logType:'IN', … }` | `STOCK_QTY += qty`, IN log (no instance created) |
| Receiving history list | `GET /consumables/logs` | `logType` / `logTypeGroup=RECEIVING` / date filter |

> The `SELECT * FROM CONSUMABLE_LOGS …` in the grid is a display label only; actual data comes from the APIs above.

---

## ① Barcode Scan Panel ↔ DB

| Screen Field | DB Column / Parameter | Role / Meaning · Operational Notes |
|------|------|------|
| Receive/Return Mode | (request branch) | Receive=`/label/confirm`, Return=`/label/return` endpoint. |
| UID Barcode | `ConfirmConReceivingDto.conUid` → `CONSUMABLE_STOCKS.CON_UID` | Individual instance PK generated during label issuance. Processed immediately on Enter. |
| Location (Receive) | `ConfirmConReceivingDto.location` → `CONSUMABLE_STOCKS.LOCATION` | Recorded as the storage location for that UID on receive confirm (optional). |
| Return Reason (Return) | `ReturnConReceivingDto.returnReason` → `CONSUMABLE_STOCKS.REMARK`, `CONSUMABLE_LOGS.RETURN_REASON` | Reason for return. Recorded in instance remark and log reason. |

### Unreceived Waiting List — CONSUMABLE_STOCKS (STATUS='PENDING')
| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| UID | `CON_UID` | Instance PK. |
| Consumable Code | `CONSUMABLE_CODE` | Master FK. |
| Consumable Name | `CONSUMABLE_MASTERS.NAME` | Joined from master (property name `consumableName`). |
| Category | `CONSUMABLE_MASTERS.CATEGORY` | Common code `CONSUMABLE_CATEGORY`(MOLD/JIG/TOOL). |
| Label Print Date | `LABEL_PRINTED_AT` | Label issuance time. |
| Vendor Name | `VENDOR_NAME` | Input value at label issuance (also holds `VENDOR_CODE`). |

## ② Receiving History Grid — CONSUMABLE_LOGS (All Display Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Date/Time | `CREATED_AT` | Processing timestamp (TIMESTAMP). Sort key (DESC). |
| (Key) Transaction Date | `TRANS_DATE` | Composite PK. Stored as midnight (`00:00`) of the receipt processing date. |
| (Key) Serial Number | `SEQ` | Composite PK. Generated via `SEQ_CONSUMABLE_LOGS` sequence. |
| Consumable Code | `CONSUMABLE_CODE` | Master FK. |
| Consumable Name | `CONSUMABLE_MASTERS.NAME` | Displayed via join. |
| UID | `CON_UID` | Populated only for scan receiving. Null → `-` for manual receiving. |
| Type | `LOG_TYPE` | `IN`(receipt)/`IN_RETURN`(receipt return). Full set includes OUT/OUT_RETURN/USAGE/REPLACE. |
| Quantity | `QTY` | Receipt/return quantity (INT, default 1). Displayed as IN `+`, IN_RETURN `-` (stored as positive). |
| Vendor Code | `VENDOR_CODE` | Supplier code. |
| Vendor Name | `VENDOR_NAME` | Supplier name. |
| Unit Price | `UNIT_PRICE` | NUMBER(12,2). Receipt unit price. |
| Receiving Type | `INCOMING_TYPE` | `NEW`(new)/`REPLACEMENT`(replacement). Scan receiving is fixed to `NEW`. |
| Remark | `REMARK` | Receipt/return notes. |
| Return Reason | `RETURN_REASON` | Return receipt reason (IN_RETURN). |
| Audit | `CREATED_BY`, `UPDATED_BY`, `UPDATED_AT` | Creation/update history. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | `40` / `1000` scope (entity property names `company`, `plant`). |

> Issue-only columns `DEPARTMENT`/`LINE_CODE`/`EQUIP_CODE`/`ISSUE_REASON` exist in the same table but are not used on the receiving screen (used in the Consumable Issuing screen `CONS_ISSUING`).

## ③ Manual Receiving Form ↔ CONSUMABLE_LOGS

`POST /consumables/receiving` forces `logType:'IN'` in the body and processes via `createLog`.

| Screen Field | DTO Field → DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Consumable | `consumableId` → `CONSUMABLE_CODE` | Validates existence (404 if not found). |
| Quantity | `qty` → `QTY` | `STOCK_QTY += qty`. Default 1, min 1. |
| Receiving Type | `incomingType` → `INCOMING_TYPE` | NEW/REPLACEMENT. |
| Vendor Code/Name | `vendorCode`/`vendorName` → `VENDOR_CODE`/`VENDOR_NAME` | Supplier info. |
| Unit Price | `unitPrice` → `UNIT_PRICE` | Receipt unit price (optional). |
| Remark | `remark` → `REMARK` | Notes (optional). |

## Receiving / Stock Update Logic
**Manual Receiving (`createLog`) stock sign** — `stockDelta` per `logType`:
- `IN` → `+qty`, `OUT` → `-qty`, `IN_RETURN` → `-qty`, `OUT_RETURN` → `+qty`.
- If `stockDelta < 0` and `STOCK_QTY + stockDelta < 0` → **stock shortage 400**.
- Transaction: 1 `CONSUMABLE_LOGS` record saved + `CONSUMABLE_MASTERS.STOCK_QTY` updated (atomic). For IN, `LAST_REPLACE` is also updated to now.

**Scan Receive Confirm (`confirmReceiving`)**:
1. Look up `CON_UID`. If `STATUS != 'PENDING'` → **400** (already received).
2. Set `STATUS='ACTIVE'`, `RECV_DATE`=now, update `LOCATION`/`REMARK`.
3. `CONSUMABLE_MASTERS.STOCK_QTY` **+1**.
4. Record 1 IN log in `CONSUMABLE_LOGS` (includes `CON_UID`, `INCOMING_TYPE='NEW'`).

**Scan Return (`returnByScan`)**: Only `STATUS='ACTIVE'` allowed (400 otherwise) → `STATUS='RETURNED'`, `STOCK_QTY -1`, IN_RETURN log.

## Generation
- `CONSUMABLE_LOGS.SEQ`: Oracle sequence `SEQ_CONSUMABLE_LOGS.NEXTVAL`. Composite PK with `TRANS_DATE` (midnight).
- `CON_UID` (instance): Issued during the label issuance stage (`CONS_LABEL`) via generation service `CON_UID` channel. The receiving screen only confirms existing UIDs, not generates them.

## Prerequisites
- The target consumable must be registered in [Consumable Master](`CONSUMABLE_MASTERS`) with `USE_YN='Y'`.
- For scan receiving, `CON_UID` must have been issued in [Consumable Label Issuance](`CONS_LABEL`) and exist in PENDING status.
- Location options based on location master (`useLocationOptions`).
- Common code: `CONSUMABLE_CATEGORY`(waiting list category badge).

## Operating Procedure
1. Issue `CON_UID` via label issuance (scan receiving path) → appears in unreceived waiting list.
2. Scan UID in Receive mode → confirm receipt (stock +1, IN log).
3. For items without UID, use **Receiving Registration** form for manual receiving (stock += qty).
4. For mistaken receipts, scan UID in **Return** mode (ACTIVE→RETURNED, stock -1).
5. Verify via receiving history grid (period/type filters).

## Permissions
Consumable/material staff (receiving/return processing). General users can only view.

## Troubleshooting
| Symptom | Cause | Action |
|------|------|------|
| Unreceived waiting list empty | `CON_UID` not issued or all already received | Issue UID in [Consumable Label Issuance] and retry |
| "Already received status" on scan (400) | `STATUS != 'PENDING'` (already ACTIVE etc.) | Check receiving history. Not a duplicate receipt |
| "UID not found" on scan (404) | Typo/different site UID/not issued | Check UID and multi-tenancy (`COMPANY`/`PLANT_CD`) |
| Return blocked (400) | UID is not ACTIVE | Only confirmed (active) UIDs can be returned |
| Manual receive register button disabled | No consumable selected | Select a consumable via the search dialog |
| "Stock shortage" on manual receive/return (400) | `STOCK_QTY + delta < 0` | Check current stock for deduction paths (return) |
| Stock not increasing after receipt | Viewing different site scope | Verify `COMPANY='40'`/`PLANT_CD='1000'` scope |

## Data & Integration
- Tables: `CONSUMABLE_LOGS`(receipt/issue history), `CONSUMABLE_STOCKS`(individual instances/status), `CONSUMABLE_MASTERS`(held stock `STOCK_QTY`)
- Integration: [Consumable Label Issuance](`CONS_LABEL`, `CON_UID` generation), [Consumable Master](`CONSUMABLE_MASTERS`), [Consumable Stock](`CONS_STOCK`), Consumable Issuing (`CONS_ISSUING`, same log table)
- Scope: `COMPANY='40'`, `PLANT_CD='1000'`
