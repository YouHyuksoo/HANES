---
menuCode: QC_DEFECT
audience: operator
title: Defect Management — Operator Guide
summary: Defect log search·register·status change — scan product barcode/work order, auto-display defect code·grade·scope, WAIT→REPAIR/REWORK/SCRAP/DONE state transition
tags: [quality, defect, defect management, defect log]
keywords: [DEFECT_LOGS, DEFECT_CODE_MASTERS, DEFECT_CATEGORY_MASTERS, WAIT, REPAIR, REWORK, SCRAP, DONE, CRITICAL, MAJOR, MINOR, defect management, defect log, defect code, defect grade]
related: [QC_DEFECT_CODE, QC_REWORK_INSPECT]
---

# Defect Management — Operator Guide

## System Purpose & Role
Register, search, and manage defect status during production. Scan product barcode (PROD_RESULT) or FG barcode to register defects, transition status through WAIT→REPAIR/REWORK/SCRAP/DONE. Defect codes use a 3-level category hierarchy with grade (CRITICAL/MAJOR/MINOR) and scope auto-displayed.

```
Defect → Register(WAIT) → Repair(REPAIR) → Done(DONE)
                         → Rework(REWORK) → Done(DONE)
                         → Scrap(SCRAP)
```

## Data Structure
```
DEFECT_LOGS (PK: OCCUR_TIME + SEQ, ID: "occurAtISO|seq")
   ├─ PROD_RESULT_ID → PROD_RESULTS
   ├─ DEFECT_CODE → DEFECT_CODE_MASTERS
   ├─ QTY / STATUS / CAUSE
   └─ STATUS: WAIT → REPAIR / REWORK / SCRAP → DONE

DEFECT_CODE_MASTERS (PK: COMPANY + PLANT_CD + DEFECT_CODE)
   3-level category hierarchy + grade(CRITICAL/MAJOR/MINOR) + scope

REPAIR_LOGS (PK: REPAIR_DATE + SEQ)
   Repair history (worker·action·material·time·result)
```

## Screen Layout

### Main Area
- **Header**: Title + Refresh·Register buttons
- **Toolbar Filters**:
  - Search (product barcode·work order no)
  - Date range (DateRangeFilter)
  - Defect type Select (`GET /quality/defect-codes/options?defectScope=PRODUCT`)
  - Status Select (`DEFECT_LOG_STATUS` common code)
- **DataGrid**: `GET /quality/defect-logs?limit=5000`
  - Columns: actions·occur time·work order no·defect code·defect name·qty·status·operator·cause
  - Row click → open right panel

### Right Panel (DefectFormPanel, 480px)
`POST /quality/defect-logs`

| Field | Description |
|------|-------------|
| Product Barcode | Scan PROD_RESULT.prdUid or FG_LABELS.fgBarcode (auto-focus) |
| Work Order No | Manual input (barcode fallback) |
| Defect Type | Select defect code (PRODUCT scope) |
| Defect Grade | Auto-display: 🔴 CRITICAL / 🟠 MAJOR / 🟡 MINOR |
| Defect Scope | Auto-display: RAW_MATERIAL / PRODUCT / PROCESS / COMMON |
| Qty | Default 1 |
| Cause | Defect cause text |
- Save condition: `prdUid` or `workOrderNo` required

### Status Change Modal
`PATCH /quality/defect-logs/{id}/status { status }`

| Current Status | Transitions To |
|---------------|----------------|
| WAIT | REPAIR, REWORK, SCRAP |
| REPAIR | DONE, SCRAP, WAIT |
| REWORK | DONE, SCRAP, WAIT |
| SCRAP | (terminal) |
| DONE | (terminal) |

## Status Codes (DEFECT_LOG_STATUS)

| Code | Meaning | Next State |
|------|---------|-----------|
| WAIT | Defect received (initial) | REPAIR / REWORK / SCRAP |
| REPAIR | Repair in progress | DONE / SCRAP / WAIT |
| REWORK | Rework in progress | DONE / SCRAP / WAIT |
| SCRAP | Scrapped (terminal) | - |
| DONE | Completed (terminal) | - |

## Defect Grades

| Grade | Color | Meaning |
|------|-------|---------|
| CRITICAL | 🔴 Red | Critical defect |
| MAJOR | 🟠 Orange | Major defect |
| MINOR | 🟡 Yellow | Minor defect |

## Interlock

| Condition | Description |
|------|-------------|
| Barcode + Work Order both empty | Cannot register |
| Defect code not selected | Cannot register |
| SCRAP/DONE cannot change status | Terminal states |
| Rework-linked cannot edit/delete | ReworkOrder restriction |

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| Barcode not recognized | PROD_RESULT or FG_LABELS not found | Use work order as fallback |
| No defect codes | PRODUCT scope codes not registered | Register in defect code master |
| Status change fails | Terminal state (SCRAP/DONE) | Cannot change |
| Cannot edit | Rework linked | Handle via rework inspection |

## Data & Integration
- Tables: `DEFECT_LOGS`, `DEFECT_CODE_MASTERS`, `DEFECT_CATEGORY_MASTERS`, `DEFECT_CODE_PRODUCT_TYPES`, `REPAIR_LOGS`, `PROD_RESULTS`, `FG_LABELS`, `REWORK_ORDERS`
- Integration: Production result → **Defect registration(this)** → Repair/Rework/Scrap → Rework inspection
- Scope: `COMPANY='40'`, `PLANT_CD='1000'`
