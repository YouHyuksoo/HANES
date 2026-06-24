---
menuCode: QC_INSPECT
audience: operator
title: Visual Inspection — Operator Guide
summary: INSPECT_RESULTS (VISUAL) table structure, FG_LABELS status transitions, PASS/FAIL transaction flow, and troubleshooting
tags: [quality, visual-inspection, operation, VISUAL, FG_LABELS, INSPECT_RESULTS]
keywords: [QC_INSPECT, INSPECT_RESULTS, VISUAL, FG_LABELS, PASS_YN, VISUAL_DEFECT, FG_BARCODE, visual-inspection, VISUAL_PASS, VISUAL_FAIL, ISSUED]
related: [QC_DEFECT_CODE, QC_DEFECT]
---

# Visual Inspection — Operator Guide

## System Purpose
Visually inspect products whose FG labels have been issued (`ISSUED`), and store results in the `INSPECT_RESULTS` table with `INSPECT_TYPE='VISUAL'`. Based on the pass/fail result, `FG_LABELS.STATUS` transitions to `VISUAL_PASS` or `VISUAL_FAIL`.

## Data Structure
```
FG_LABELS (FG_BARCODE PK)
    │   STATUS: ISSUED → VISUAL_PASS / VISUAL_FAIL → PACKED → SHIPPED
    │   INSPECT_RESULT_ID → INSPECT_RESULTS.RESULT_NO
    │   ORDER_NO → JOB_ORDERS
    │
    └──▶ INSPECT_RESULTS (RESULT_NO PK)
            │   INSPECT_TYPE = 'VISUAL' (fixed)
            │   INSPECT_SCOPE = 'FULL' (fixed)
            │   PASS_YN = 'Y'(pass) / 'N'(fail)
            │   ERROR_CODE → COM_CODES.VISUAL_DEFECT
            │   ERROR_DETAIL (VARCHAR2 500)
            │   FG_BARCODE → FG_LABELS
            │   INSPECTOR_ID → WORKER_MASTERS
```

---

## ① Inspection Results — INSPECT_RESULTS (Visual-Inspection Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Result No. | `RESULT_NO` | **PK**. Auto-numbered via sequence. |
| Production Result ID | `PROD_RESULT_ID` | → `PROD_RESULTS` FK (may be omitted for visual inspection). |
| Inspection Type | `INSPECT_TYPE` | Fixed as `'VISUAL'`. |
| Inspection Scope | `INSPECT_SCOPE` | Fixed as `'FULL'`. |
| Pass/Fail | `PASS_YN` | `'Y'`(pass) / `'N'`(fail). Default `'Y'`. |
| Defect Code | `ERROR_CODE` | References common code group `VISUAL_DEFECT`. |
| Detail Reason | `ERROR_DETAIL` | Detailed reason for failure. Max 500 characters. |
| Inspection Data | `INSPECT_DATA` | CLOB — additional inspection data (JSON). |
| FG Barcode | `FG_BARCODE` | → `FG_LABELS.FG_BARCODE`. |
| Inspection Time | `INSPECT_TIME` | Timestamp of inspection. |
| Inspector ID | `INSPECTOR_ID` | → `WORKER_MASTERS`. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | Company code (`40`) / Plant code (`1000`). |

---

## ② FG Label — FG_LABELS (Status Transition)

| DB Column | Role / Meaning |
|---------|------|
| `FG_BARCODE` | **PK**. FG barcode (serial). |
| `STATUS` | `ISSUED` → `VISUAL_PASS`(visual pass) / `VISUAL_FAIL`(visual fail) → `PACKED` → `SHIPPED`. |
| `INSPECT_RESULT_ID` | References `INSPECT_RESULTS.RESULT_NO` after inspection. |
| `INSPECT_PASS_YN` | Final inspection pass/fail result. |

---

## Pass/Fail Transaction Details

When `POST /quality/continuity-inspect/visual-inspect/{fgBarcode}` is called, `visualInspect()` executes:

1. **Validation Phase**:
   - Checks `VISUAL_INSP_BYPASS` system setting (400 error if enabled)
   - Verifies FG label exists and `STATUS` is `ISSUED`
   - `PACKED`, `SHIPPED`, `VOIDED` statuses cannot be inspected

2. **Transaction Execution**:
   - Sequence-numbered `RESULT_NO`
   - INSERT into `INSPECT_RESULTS` (`INSPECT_TYPE='VISUAL'`, `INSPECT_SCOPE='FULL'`, `PASS_YN`, `ERROR_CODE`, `ERROR_DETAIL`)
   - `FG_LABELS.UPDATE`: sets `STATUS='VISUAL_PASS'` or `STATUS='VISUAL_FAIL'`, sets `INSPECT_RESULT_ID`

---

## Common Codes

| Group Code | Usage | Examples |
|---------|------|------|
| `VISUAL_DEFECT` | Visual inspection defect codes | Scratch, Foreign matter, Discoloration, Print defect, Other |

---

## Validation Rules

| Condition | Handling |
|------|------|
| FG barcode does not exist | `BadRequestException` |
| FG label status is not `ISSUED` | Inspection not possible notification (already inspected/packed/shipped/voided) |
| Barcode does not belong to selected job order | Warning message displayed |
| `VISUAL_INSP_BYPASS` ON | 400 BadRequest |
| Defect code not selected on FAIL | Mandatory input via `FailModal` |

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| FG barcode lookup fails | Incorrect barcode or does not exist | Re-check barcode |
| "Already inspected" message | FG label already in `VISUAL_PASS`/`VISUAL_FAIL` status | Re-inspection not possible; check in Defect Management screen |
| "Different job order label" error | Scanned barcode does not match selected job order | Select correct job order or re-check barcode |
| FAIL save failure | Defect code not selected or detail reason not entered | Verify mandatory fields |
| System setting error (400) | `VISUAL_INSP_BYPASS` is enabled | Contact administrator to check settings |
| No status change after inspection | Transaction failure (DB error) | Check logs and retry |

## Data & Relationships
- **Tables**: `INSPECT_RESULTS` (inspection results), `FG_LABELS` (labels/status), `COM_CODES` (defect codes)
- **Relationships**: Production results (`PROD_RESULTS`), Workers (`WORKER_MASTERS`)
- **Scope**: `COMPANY='40'`, `PLANT_CD='1000'`
