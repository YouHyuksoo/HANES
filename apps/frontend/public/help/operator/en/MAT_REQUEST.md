---
menuCode: MAT_REQUEST
audience: operator
title: Issue Request Management — Operator Guide
summary: Material issue request (MAT_ISSUE_REQUESTS) creation·approval·rejection·actual issue linkage logic, DB structure, state transitions, permissions·troubleshooting
tags: [material, issue request, operations, BOM]
keywords: [MAT_ISSUE_REQUESTS, MAT_ISSUE_REQUEST_ITEMS, REQUEST_NO, ORDER_NO, ISSUE_TYPE, REQUESTED, APPROVED, REJECTED, COMPLETED, bomReqQty, BOM_REQ_QTY, prevIssueQty, PREV_ISSUE_QTY, floorStockQty, FLOOR_STOCK_QTY, RAW_MATERIAL, issue request, approval, rejection, actual issue, production input, prototype, sample]
related: [MAT_ISSUE, MST_PART]
---

# Issue Request Management — Operator Guide

## System Purpose & Role

This approval workflow screen enables the production floor to **request** raw materials from the warehouse, warehouse staff to **approve/reject**, and then link to actual issue (`MAT_ISSUES`). The 3-step flow (request-approve-issue) is tracked in the DB to ensure stock accuracy and issue accountability.

```
Issue request registered (REQUESTED)
  ↓ Approve (PATCH /approve)          → APPROVED
  ↓ Reject (PATCH /reject)           → REJECTED
      ↓ Actual issue (POST /:requestNo/issue) → COMPLETED
```

Multi-tenancy scope: `COMPANY='40'`, `PLANT_CD='1000'` applied to all queries.

---

## Data Structure

```
MAT_ISSUE_REQUESTS (header, 1 = 1 issue request)
  └─ MAT_ISSUE_REQUEST_ITEMS (items, N)
         ↓ On actual issue processing
     MAT_ISSUES / MAT_ISSUE_ITEMS (actual issue records)
```

- **MAT_ISSUE_REQUESTS** — Issue request header. Natural key `REQUEST_NO` PK.
- **MAT_ISSUE_REQUEST_ITEMS** — Issue request item details. `REQUEST_ID + SEQ` composite PK.
- Actual issue is recorded in the separate `MAT_ISSUES` table and reflected in `MatStock`.

---

## ① Issue Request Header — MAT_ISSUE_REQUESTS (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| **Request No.** | `REQUEST_NO VARCHAR2(50) PK` | Issue request natural key. Generation method determined by service layer. |
| **Work Order No.** | `ORDER_NO VARCHAR2(50)` | Linked work order number. NULL allowed (manual issue request). Logically linked to `PRODUCTION_JOB_ORDERS`. |
| **Request Date** | `REQUEST_DATE TIMESTAMP` | Request registration time. Default `CURRENT_TIMESTAMP`. |
| **Status** | `STATUS VARCHAR2(20)` | Default `REQUESTED`. Allowed values: `REQUESTED / APPROVED / REJECTED / COMPLETED`. |
| **Requester** | `REQUESTER VARCHAR2(100)` | User identifier who requested the issue. NOT NULL. |
| **Approver** | `APPROVER VARCHAR2(100)` | User who approved. Recorded at approval time. NULL allowed. |
| **Approved At** | `APPROVED_AT TIMESTAMP` | Approval time. NULL allowed. |
| **Reject Reason** | `REJECT_REASON VARCHAR2(500)` | Reason entered on rejection. NULL allowed. |
| **Issue Type** | `ISSUE_TYPE VARCHAR2(20)` | Issue account classification per common code `ISSUE_TYPE`. NULL allowed. Passed to `MAT_ISSUES.ISSUE_TYPE` on actual issue. |
| **Remark** | `REMARK VARCHAR2(500)` | Request reason/notes (production input, prototype, sample, etc.). NULL allowed. |
| Multi-tenancy | `COMPANY VARCHAR2(50)` | Company identifier. Default `'40'`. Mandatory on all queries and registrations. |
| Multi-tenancy | `PLANT_CD VARCHAR2(50)` | Plant identifier. Default `'1000'`. Mandatory on all queries and registrations. |
| Audit | `CREATED_BY VARCHAR2(50)` | Creator user ID. NULL allowed. |
| Audit | `UPDATED_BY VARCHAR2(50)` | Last modifier user ID. NULL allowed. |
| Audit | `CREATED_AT TIMESTAMP` | TypeORM `@CreateDateColumn`. Auto-recorded. |
| Audit | `UPDATED_AT TIMESTAMP` | TypeORM `@UpdateDateColumn`. Auto-recorded. |

Indexes: `ORDER_NO`, `STATUS`, `REQUEST_DATE` — each a single index.

---

## ② Issue Request Items — MAT_ISSUE_REQUEST_ITEMS (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| — | `REQUEST_ID VARCHAR2(50) PK` | References header `REQUEST_NO` (composite PK 1/2). Same value as header. |
| — | `SEQ INT PK` | Item sequence (composite PK 2/2). Starts at 1. |
| **Item Code** | `ITEM_CODE VARCHAR2(50)` | Item requested for issue. FK to `ITEM_MASTERS`. Indexed. |
| **Request Qty** | `REQUEST_QTY INT` | Quantity requested from the warehouse. Integer ≥ 1. NOT NULL. |
| **Issued Qty** | `ISSUED_QTY INT DEFAULT 0` | Cumulative value updated on actual issue processing. Equals requestQty when fully issued. |
| **Unit** | `UNIT VARCHAR2(20)` | Quantity unit (EA, M, KG etc.). NOT NULL. |
| **BOM Req Qty** | `BOM_REQ_QTY NUMBER(12,3)` | Calculated as work order plan qty × BOM unit usage. NULL allowed (for manually added items). |
| **Prev Issue Qty** | `PREV_ISSUE_QTY NUMBER(12,3)` | Cumulative quantity already issued to the same work order via previous requests. NULL allowed. |
| **Floor Stock Qty** | `FLOOR_STOCK_QTY NUMBER(12,3)` | Quantity held on the floor (production line). Snapshot at request time. NULL allowed. |
| **Remark** | `REMARK VARCHAR2(500)` | Item-specific notes. NULL allowed. |
| Multi-tenancy | `COMPANY VARCHAR2(50)` | Same scope as header. |
| Multi-tenancy | `PLANT_CD VARCHAR2(50)` | Same scope as header. |
| Audit | `CREATED_BY`, `UPDATED_BY` | Change tracking. NULL allowed. |
| Audit | `CREATED_AT`, `UPDATED_AT` | TypeORM auto-managed. |

---

## State Transition Logic

### State Meanings

| Status | Transition API | Description |
|------|------|------|
| `REQUESTED` | (initial) | Immediately after request registration. Awaiting warehouse staff review. |
| `APPROVED` | `PATCH /:requestNo/approve` | Staff approved. Ready for actual issue processing. |
| `REJECTED` | `PATCH /:requestNo/reject` | Request rejected. `REJECT_REASON` recorded. Can re-request. |
| `COMPLETED` | `POST /:requestNo/issue` | Actual issue processed. `MAT_ISSUES` records created. |

### Allowable Transitions

```
REQUESTED → APPROVED  (approve)
REQUESTED → REJECTED  (reject)
APPROVED  → COMPLETED (actual issue)
```

> No further transitions from `COMPLETED` or `REJECTED`. Rejected requests are not reused; create a new request instead.

---

## BOM-Based Requirement Calculation Logic

API: `GET /material/issue-requests/job-orders/:orderNo/bom-items`

Backend `IssueRequestService.buildBomRequestItems(orderNo, company, plant)` calculation:

1. Look up work order (`orderNo`) → check plan quantity (`planQty`).
2. Query BOM for the work order item → unit usage (BOM quantity).
3. Calculate `bomReqQty = planQty × unit usage`.
4. Sum `ISSUED_QTY` from existing issue requests for the same work order → `prevIssueQty`.
5. Query floor stock (`floorStockQty`).
6. Query current stock (`currentStock`) based on `MatStock`.
7. Return results per raw material (RAW_MATERIAL) item.

> Item search (`/master/parts?itemType=RAW_MATERIAL`) is also limited to raw materials only.

---

## API Route List

| Method | Route | Description |
|------|------|------|
| `POST` | `/material/issue-requests` | Create issue request (status: REQUESTED fixed) |
| `GET` | `/material/issue-requests` | List query (pagination, status·search·orderNo filters) |
| `GET` | `/material/issue-requests/:requestNo` | Detail query (including items) |
| `GET` | `/material/issue-requests/job-orders/:orderNo/bom-items` | Calculate BOM-based requirements for work order |
| `PATCH` | `/material/issue-requests/:requestNo/approve` | Approve |
| `PATCH` | `/material/issue-requests/:requestNo/reject` | Reject (body: `reason`) |
| `POST` | `/material/issue-requests/:requestNo/issue` | Actual issue (APPROVED → COMPLETED) |

---

## Prerequisites (Master·Common Code)

| Setting | Location | Impact |
|------|------|------|
| Item Master (itemType=RAW_MATERIAL) | `ITEM_MASTERS` | Issue request item search target |
| BOM Registration | `MAT_BOM` (or equivalent) | BOM-based requirement calculation basis |
| Common Code `JOB_ORDER_STATUS` | `COM_CODES` | Left-side work order status filter select |
| Common Code `ISSUE_TYPE` | `COM_CODES` | Issue account field code resolution |
| Warehouse Master | `WAREHOUSE_MASTERS` | Warehouse selection basis for actual issue |

---

## Operating Procedure

### New Issue Request Registration
1. Select work order or use manual issue request modal to enter items·quantities.
2. Call `POST /material/issue-requests` → `REQUEST_NO` generated, `STATUS='REQUESTED'` saved.

### Issue Request Approval
1. Review REQUESTED entries in Material Issue Management (MAT_ISSUE) screen.
2. After review, call `PATCH /material/issue-requests/:requestNo/approve`.
3. Records `STATUS='APPROVED'`, `APPROVER`, `APPROVED_AT`.

### Rejection Processing
1. After confirming reason, call `PATCH /material/issue-requests/:requestNo/reject` (body: `reason`).
2. Saves `STATUS='REJECTED'`, `REJECT_REASON`. Requester must submit a new request.

### Actual Issue Processing
1. For approved (APPROVED) entries, call `POST /material/issue-requests/:requestNo/issue`.
2. Creates `MAT_ISSUES`, `MAT_ISSUE_ITEMS` records → deducts `MatStock`.
3. Sets request `STATUS='COMPLETED'`, updates item-level `ISSUED_QTY`.

---

## Permissions

| Role | Permitted Operations |
|------|------|
| Production/Field staff | Register issue requests, view own requests |
| Warehouse staff | View issue requests, approve, reject, actual issue processing |
| Administrator | All operations |

> Currently, the API only enforces tenant scope (`COMPANY`, `PLANT_CD`) without separate role checks. Add `@Guard` configuration if role-based permissions are needed.

---

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| BOM items show 0 results | Work order BOM not registered or plan qty is 0 | Check BOM registration and work order plan qty |
| Item search has no results | Item type is not RAW_MATERIAL | Check itemType in Item Master |
| Status not changing after request | Not yet approved (normal REQUESTED status) | Process approval in Material Issue Management screen |
| Stock not reducing after approval | Approval is just permission. Actual issue not yet processed | Call `POST /:requestNo/issue` actual issue API |
| Want to reject after APPROVED | APPROVED → REJECTED transition not defined in code | Do not complete the request; replace with new request or handle via DB directly (operator judgment) |
| `ISSUED_QTY` less than `REQUEST_QTY` | Partial issue status. May not be COMPLETED | Check remaining qty and process additional issue |
| Slow issue request list query | STATUS / ORDER_NO / REQUEST_DATE indexes exist. Check pagination with data accumulation | Use page/limit params, leverage filters |

---

## Data & Integration

- **Header table**: `MAT_ISSUE_REQUESTS` — `COMPANY='40'`, `PLANT_CD='1000'` scope fixed.
- **Item table**: `MAT_ISSUE_REQUEST_ITEMS` — same scope.
- **Actual issue linkage**: On actual issue, creates `MAT_ISSUES` + `MAT_ISSUE_ITEMS`, deducts `MatStock`.
- **Work order linkage**: Logical link to `PRODUCTION_JOB_ORDERS.ORDER_NO` (no FK constraint, validated at service layer).
- **Item Master linkage**: Logical link to `ITEM_MASTERS.ITEM_CODE`.
- **Related screen**: Material Issue Management (MAT_ISSUE) — approval·actual issue processing.
