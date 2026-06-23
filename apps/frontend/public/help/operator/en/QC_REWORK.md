---
menuCode: QC_REWORK
audience: operator
title: Rework Order Management — Operator Guide
summary: IATF 16949 rework order full lifecycle — register·QC approval·production approval·process execution·complete, DefectLog integration, isolation/inventory handling
tags: [quality, rework, IATF16949, approval, process]
keywords: [REWORK_ORDERS, REWORK_PROCESSES, REWORK_RESULTS, DEFECT_LOG, REGISTERED, QC_PENDING, PROD_PENDING, APPROVED, IN_PROGRESS, INSPECT_PENDING, rework, rework order, QC approval, production approval, process management]
related: [QC_REWORK_INSPECT, QC_DEFECT]
---

# Rework Order Management — Operator Guide

## System Purpose & Role
Manage the full lifecycle of **rework orders** per IATF 16949. Register from DefectLog, obtain QC/production approval, execute processes, and transition to inspection pending.

```
DefectLog → REGISTERED → QC_PENDING → PROD_PENDING → APPROVED → IN_PROGRESS → INSPECT_PENDING
               ↑              ↓              ↓
          QC_REJECTED    PROD_REJECTED
```

## Data Structure
```
REWORK_ORDERS (PK: REWORK_NO, format: RW-YYYYMMDD-NNN)
   ├─ DEFECT_LOG_ID → DefectLog (occurAt|seq)
   ├─ ITEM_CODE / REWORK_QTY / REWORK_METHOD / STATUS
   ├─ QC_APPROVER / PROD_APPROVER (dual approval)
   └─ ISOLATION_FLAG (isolated: 1 / normal: 0)

REWORK_PROCESSES (PK: REWORK_NO + PROCESS_CODE)
   └─ STATUS: WAITING → IN_PROGRESS → COMPLETED / SKIPPED

REWORK_RESULTS (PK: REWORK_NO + PROCESS_CODE + SEQ)
   └─ workerId / goodQty / defectQty / workDetail / workTimeMin

REWORK_INSPECTS (PK: REWORK_NO + SEQ)
   └─ Inspect results (PASS/FAIL/SCRAP)
```

## Screen Layout

### Main Area
- **Header**: Title + Refresh·Register buttons
- **StatCard (5)**: Total·Pending·In Progress·Done·Inspect Pending
- **Toolbar**: Search·date·status·line filters
- **DataGrid**: `GET /quality/reworks`
  - Columns: actions·rework no·item code·item name·qty·defect type·status·worker·created
  - Row click → right panel

### Right Panel (3 types)
| Panel | Trigger | Function |
|------|---------|----------|
| ReworkFormPanel | Create/Edit | Create or modify rework order |
| ReworkApprovePanel | Approval | QC or production approve/reject |
| ReworkResultPanel | Result entry | Per-process work result |

## Workflow

### ① Register
`POST /quality/reworks { defectLogId, itemCode, reworkQty, reworkMethod, processItems, ... }`
- Links DefectLog → `DEFECT_LOG.status = 'REWORK'`
- `isolationFlag = 1`
- May include process items

### ② Request Approval
`PATCH /quality/reworks/{id}/request-approval`
- REGISTERED → QC_PENDING

### ③ QC Approve
`PATCH /quality/reworks/{id}/qc-approve { action: APPROVE|REJECT, reason }`
- Approve: QC_PENDING → PROD_PENDING
- Reject: QC_PENDING → QC_REJECTED (reason required)

### ④ Production Approve
`PATCH /quality/reworks/{id}/prod-approve { action: APPROVE|REJECT, reason }`
- Approve: PROD_PENDING → APPROVED
- Reject: PROD_PENDING → PROD_REJECTED (reason required)

### ⑤ Start
`PATCH /quality/reworks/{id}/start`
- APPROVED → IN_PROGRESS

### ⑥ Process Execution
`PATCH /quality/reworks/processes/{orderId}/{processCode}/start`
`PATCH /quality/reworks/processes/{orderId}/{processCode}/complete { resultQty }`
`PATCH /quality/reworks/processes/{orderId}/{processCode}/skip`
- Per-process: worker·qty·time input
- Result: `POST /quality/reworks/results`

### ⑦ Complete
`PATCH /quality/reworks/{id}/complete { resultQty }`
- Auto-transitions to INSPECT_PENDING when all processes done
- Final PASS/FAIL/SCRAP at `/quality/rework-inspect`

## Status Codes (REWORK_STATUS)

| Code | Meaning | Actions |
|------|---------|---------|
| REGISTERED | Registered | Edit·Delete·Request approval |
| QC_PENDING | QC pending | QC approve/reject |
| QC_REJECTED | QC rejected | Edit·Re-request |
| PROD_PENDING | Production pending | Prod approve/reject |
| PROD_REJECTED | Prod rejected | Edit·Re-request |
| APPROVED | Approved | Start work |
| IN_PROGRESS | In progress | Process·Complete |
| INSPECT_PENDING | Inspect pending | Inspect |
| PASS | Passed | |
| FAIL | Failed | |
| SCRAP | Scrapped | |

## Key Rules

| Rule | Description |
|------|-------------|
| Rework No. | `RW-YYYYMMDD-NNN` auto-numbered |
| Approval | Sequential dual: QC → Production |
| DefectLog | Register→REWORK, PASS→DONE, SCRAP→SCRAP |
| Isolation | Register/FAIL→1, PASS→0 |
| Inventory | PASS:DEFECT→WIP_MAIN, SCRAP:DEFECT→SCRAP, FAIL:DEFECT |
| Delete | REGISTERED only, blocked if process/inspect exists |

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| Cannot register | Missing required fields | Check item·qty·method |
| Approve button hidden | Wrong status | Check current status |
| Cannot start | Not approved | Complete QC+prod approval |
| No processes | processItems missing | Add processes then retry |

## Data & Integration
- Tables: `REWORK_ORDERS`, `REWORK_PROCESSES`, `REWORK_RESULTS`, `REWORK_INSPECTS`, `DEFECT_LOGS`
- Integration: Defect mgmt(`/quality/defect`) → **Rework order(this)** → Rework inspect(`/quality/rework-inspect`)
- Inventory: `ProductInventoryService` (DEFECT→WIP_MAIN/SCRAP)
- Scope: `COMPANY='40'`, `PLANT_CD='1000'`
