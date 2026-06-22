---
menuCode: CONS_ISSUING
audience: operator
title: Consumable Issuing — Operator Guide
summary: Consumable UID scan issuance/return API·DB mapping (CONSUMABLE_STOCKS state transitions, CONSUMABLE_LOGS history), stock adjustment logic, permissions, troubleshooting, multi-tenancy scope
tags: [consumable, issuing, return, operations, stock deduction]
keywords: [consumable issuing, issue, issue cancel, issue return, OUT, OUT_RETURN, ISSUED, ACTIVE, conUid, CONSUMABLE_STOCKS, CONSUMABLE_LOGS, CONSUMABLE_MASTERS, STOCK_QTY, SEQ_CONSUMABLE_LOGS, issueByScan, issueReturnByScan, logTypeGroup, multi-tenancy, COMPANY, PLANT_CD]
related: [CONS_MASTER, CONS_RECEIVING, CONS_STOCK]
---

# Consumable Issuing — Operator Guide

## System Purpose & Role
This screen handles **UID (`CON_UID`) based issuing/return** of individual consumable instances (`CONSUMABLE_STOCKS`). On issue, the instance status transitions from `ACTIVE → ISSUED`, the master (`CONSUMABLE_MASTERS.STOCK_QTY`) decrements by 1, and one `OUT` log is recorded in the history (`CONSUMABLE_LOGS`). Return reverses the process (`ISSUED → ACTIVE`, stock +1, `OUT_RETURN` log).

> API reference: Issue `POST /consumables/label/issue`(`{ conUid, department?, issueReason?, remark? }`), return `POST /consumables/label/issue-return`(`{ conUid, returnReason? }`), history `GET /consumables/logs?logTypeGroup=ISSUING&startDate=&endDate=&limit=`. The `SELECT * FROM CONSUMABLE_LOGS ...` in the grid is a display label; actual data comes from the logs API above.

## Data Structure
```
CONSUMABLE_MASTERS (PK: CONSUMABLE_CODE)
   ├─ STOCK_QTY  (decremented -1 on issue / incremented +1 on return)
   └─ 1:N ─▶ CONSUMABLE_STOCKS (individual instances, PK: CON_UID)
                  └─ STATUS: PENDING → ACTIVE → ISSUED (returns to ACTIVE on cancel)

CONSUMABLE_LOGS (PK: TRANS_DATE + SEQ)  ← issue/return history (SEQ_CONSUMABLE_LOGS sequence)
   └─ LOG_TYPE: OUT(issue) / OUT_RETURN(issue return)  · query group logTypeGroup=ISSUING = In('OUT','OUT_RETURN')
```

## Issue/Return State Transitions (Operational Meaning)
- **Issue (`issueByScan`)**: Only UIDs with `STATUS='ACTIVE'` allowed. Otherwise 400 (`Only ACTIVE status can be issued`). UID not found returns 404.
- **Return (`issueReturnByScan`)**: Only UIDs with `STATUS='ISSUED'` allowed. Otherwise 400 (`Only ISSUED status can be returned`).
- Each transaction processes 1 UID = quantity 1. Multiple items are scanned sequentially (per-item transaction).

---

## ① Scan Panel (Screen Input ↔ DTO)

| Screen Field | DTO Field | Role / Meaning · Operational Notes |
|------|------|------|
| Issue / Issue Return (mode toggle) | (FE state `mode`) | `issue` → `/consumables/label/issue`, `issue-return` → `/consumables/label/issue-return` API branch. Not stored in DB. |
| UID input | `conUid` (IssueConDto / IssueReturnConDto) | Scanned/entered `CON_UID`. Required. Single record lookup key for `CONSUMABLE_STOCKS`. |
| (Auto/hidden) Issue department | `department` → `CONSUMABLE_LOGS.DEPARTMENT` | Optionally passed during issue. Currently not sent by scan panel (saved as null). |
| (Auto/hidden) Issue reason | `issueReason` → `CONSUMABLE_LOGS.ISSUE_REASON` | Issue reason. Currently not sent by scan panel. |
| (Auto/hidden) Remark | `remark` → `CONSUMABLE_STOCKS.REMARK` | Instance remark updated on issue. Currently not sent. |
| (Cancel) Return reason | `returnReason` → `CONSUMABLE_LOGS.RETURN_REASON` · `STOCKS.REMARK` | Reason for return. Currently not sent by scan panel (null). |

> `department`/`issueReason`/`remark`/`returnReason` exist in DTO and DB but are currently not sent by the scan UI, so they are stored as null (available for future input expansion).

## ② Issue History — CONSUMABLE_LOGS (Table Columns ↔ DB)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Date/Time | `CREATED_AT` | Log creation timestamp (TIMESTAMP, DEFAULT SYSTIMESTAMP). Date range filter is `Between(start,end)` based on `CREATED_AT`. |
| Consumable Code | `CONSUMABLE_CODE` | Master FK (`CONSUMABLE_MASTERS.CONSUMABLE_CODE`). |
| Consumable Name | (join) `CONSUMABLE_MASTERS.NAME` | Mapped as `consumableName` after `relations:['master']` join. |
| UID | `CON_UID` | Issued instance UID. Nullable (compatible with legacy quantity-type logs). |
| Type | `LOG_TYPE` | `OUT`(issue)/`OUT_RETURN`(issue return). `logTypeGroup=ISSUING` filters `In('OUT','OUT_RETURN')`. |
| Quantity | `QTY` | INT, default 1. Displayed as `-` for OUT, `+` for OUT_RETURN (stored as positive 1). |
| Line | `LINE_CODE` | Issue line (nullable). |
| Equipment | `EQUIP_CODE` | Issue equipment (nullable). |
| Remark | `REMARK` | Notes (nullable). |
| (Key) Transaction Date | `TRANS_DATE` | Composite PK. Stored truncated to midnight (`setHours(0,0,0,0)`). |
| (Key) Sequence | `SEQ` | Composite PK. Generated via `SEQ_CONSUMABLE_LOGS.NEXTVAL`. |
| (Conditional) Issue Department | `DEPARTMENT` | Issue logs only. |
| (Conditional) Issue Reason | `ISSUE_REASON` | Issue logs only. |
| (Conditional) Return Reason | `RETURN_REASON` | Issue return logs only. |
| Multi-tenancy | `COMPANY` / `PLANT_CD` | `40` / `1000` (entity properties `company`/`plant`). |

## ③ Instance Status — CONSUMABLE_STOCKS (Issue Target)

| DB Column | Role / Meaning · Operational Notes |
|------|------|
| `CON_UID` | PK (natural key). Scan key. |
| `CONSUMABLE_CODE` | Master FK. |
| `STATUS` | PENDING/ACTIVE/ISSUED/RETURNED etc. Issue=ACTIVE→ISSUED, Return=ISSUED→ACTIVE. |
| `REMARK` | Updated with remark/returnReason passed on issue/return. |
| `COMPANY` / `PLANT_CD` | Multi-tenancy (`40`/`1000`, properties `company`/`plantCd`). |

---

## Issue Processing Logic (Stock Adjustment)

### Issue (`issueByScan`)
1. Look up single `CONSUMABLE_STOCKS` by `CON_UID` → 404 if not found.
2. Validate `STATUS='ACTIVE'` → 400 if not.
3. Within a transaction:
   - Save `STATUS='ISSUED'`, `REMARK=remark`.
   - `CONSUMABLE_MASTERS.STOCK_QTY -= 1` (`decrement`).
   - Get `SEQ_CONSUMABLE_LOGS.NEXTVAL` → record `LOG_TYPE='OUT'`, `QTY=1`, `CON_UID`, `DEPARTMENT`, `ISSUE_REASON` in `CONSUMABLE_LOGS`.

### Issue Return (`issueReturnByScan`)
1-2. Same lookup, then validate `STATUS='ISSUED'` (400 if not).
3. Within a transaction:
   - Save `STATUS='ACTIVE'`, `REMARK=returnReason`.
   - `CONSUMABLE_MASTERS.STOCK_QTY += 1` (`increment`).
   - Record `LOG_TYPE='OUT_RETURN'`, `QTY=1`, `RETURN_REASON` in `CONSUMABLE_LOGS`.

> The single source of truth for stock quantity is `CONSUMABLE_MASTERS.STOCK_QTY`, which is only adjusted by issue/return. Instance-level tracking is handled by `CONSUMABLE_STOCKS.STATUS`.

## Prerequisites (Master·Common Code)
- The target UID must be **confirmed received (`ACTIVE`)** in [Consumable Receiving](/consumables/receiving) (unreceived PENDING cannot be issued).
- UID generation is handled via `SEQ_CON_UID`/`F_GET_CON_UID` in [Consumable Receiving] based on the [Consumable Master](/consumables/master).
- Type labels (issue/return) are displayed via i18n (`consumables.issuing.typeOut`/`typeOutReturn`). The `LOG_TYPE` code values themselves are fixed (OUT/OUT_RETURN).

## Operating Procedure
1. Confirm receipt to set UID to `ACTIVE` status (Consumable Receiving screen).
2. Scan UID in **Issue** mode → confirm issue (`ACTIVE→ISSUED`, stock -1).
3. For mistaken issues, scan the same UID in **Issue Return** mode → confirm return (`ISSUED→ACTIVE`, stock +1).
4. Check and export processing history using period/type filters in the history table.

## Permissions
| Role | Permitted Actions |
|------|------|
| Warehouse/Field Staff | UID scan issue/return, history lookup |
| General Users | History lookup only |

## Troubleshooting
| Symptom | Cause | Action |
|------|------|------|
| Scan returns "UID not found" (404) | `CON_UID` does not exist or is outside company/plant scope | Verify UID/barcode, check COMPANY/PLANT_CD match |
| Issue returns "Only ACTIVE status can be issued" (400) | UID is PENDING (unreceived), ISSUED (already issued), or RETURNED | Confirm receipt in Consumable Receiving or check current status |
| Return returns "Only ISSUED status can be returned" (400) | UID is not in issued status | If already ACTIVE, no return needed. Recheck status |
| Recent entry not showing in history | Default query period is today only / type filter active | Adjust date range and type filter, then refresh |
| Stock quantity mismatch | Manual INSERT or other non-standard flow changes | Issue/return only performs `STOCK_QTY` ±1. Cross-check instance STATUS and logs |
| Issue department/reason saved as empty | Current scan panel does not send those fields | Normal behavior (future expansion items). Use the stock transaction API if reason recording is needed |

## Data & Integration
- Tables: `CONSUMABLE_STOCKS` (state transition target), `CONSUMABLE_LOGS` (issue/return history), `CONSUMABLE_MASTERS` (stock quantity `STOCK_QTY`)
- Related screens: [Consumable Master](/consumables/master), [Consumable Receiving](/consumables/receiving), [Consumable Stock](/consumables/stock)
- API: `POST /consumables/label/issue`, `POST /consumables/label/issue-return`, `GET /consumables/logs?logTypeGroup=ISSUING`
- Scope: `COMPANY='40'`, `PLANT_CD='1000'` — automatically applied to all queries, issues, and returns
