---
menuCode: MAT_SHELF_LIFE_HISTORY
audience: operator
title: Shelf-Life Inspection History — Operator Guide
summary: Shelf-life reinspection history lookup — inspect date·LOT·item·round·PASS/FAIL result·inspection item detail
tags: [material, shelf-life, reinspect, history, lookup]
keywords: [SHELF_LIFE, HISTORY, REINSPECT, IQC_LOGS, RETEST, PASS, FAIL, retestRound, inspectDate, shelf life, inspection history, reinspection history]
related: [MAT_SHELF_LIFE, MAT_SHELF_LIFE_REINSPECT]
---

# Shelf-Life Inspection History — Operator Guide

## System Purpose & Role
Read-only screen for viewing shelf-life reinspection (`RETEST`) history. Displays inspection date, LOT, item, retest round, PASS/FAIL result, and inspection item measurements.

```
IQC_LOGS (inspectType='RETEST') → History list → Select row → Inspection item detail modal
```

## Data Structure
```
IQC_LOGS (PK: inspectDate + seq, inspectType='RETEST' fixed)
   ├─ matUid → MAT_LOTS (LOT)
   ├─ itemCode → PART_MASTERS (item)
   ├─ retestRound (auto-increment)
   ├─ result (PASS / FAIL)
   ├─ inspectorName / destructSampleQty
   ├─ details (CLOB) — inspection items JSON
   │   └─ [{ inspectItem, spec, lsl, usl, unit, measuredValue, judge }]
   └─ remark
```

## Screen Layout
- **Header**: Title + Refresh button
- **Toolbar**:
  - Search input (`LOT·품목 검색...` — filters `matUid`·`itemCode`·`itemName`·`inspectorName` client-side)
  - Item select (`PartSelect` component, exact match)
  - Result filter (`All`/`PASS`/`FAIL`, triggers server re-fetch)
- **DataGrid**: `GET /material/shelf-life/reinspect?limit=2000`

| Column | Description |
|------|-------------|
| Actions | Eye button → inspection detail modal |
| Inspect Date | `inspectDate` |
| LOT No. | `matUid` (monospace) |
| Item Code | `itemCode` (monospace) |
| Item Name | `itemName` (server JOIN) |
| Retest Round | `retestRound` (1, 2, 3...) |
| Result | `result` (PASS/FAIL badge) |
| Inspector | `inspectorName` |
| Remark | `remark` |

### Inspection Detail Modal
- **Header info**: Item name · LOT No. · Round · Result(badge) · Inspector · Sample Qty · Remark
- **Items table**:

| Column | Description |
|------|-------------|
| # | Sequence |
| Inspect Item | `inspectItem` |
| Spec | `spec` |
| LSL | `lsl` |
| USL | `usl` |
| Measured Value | `measuredValue` |
| Judge | PASS(CheckCircle) / FAIL(XCircle) |

※ If details is empty/null: displays `"No measurement data (manual judgment)"`

## Workflow

### ① Query History
- `GET /material/shelf-life/reinspect` — all `inspectType='RETEST'` records
- Result filter (PASS/FAIL) → server re-fetch
- Search/Item filter → client-side filtering

### ② View Inspection Detail
- Click Eye button on row
- `details` JSON parsed → inspection items with measured values and judgment
- Review PASS/FAIL reason

## Key Rules

| Rule | Description |
|------|-------------|
| Read-only | View only (no edit/delete/create) |
| RETEST only | `inspectType='RETEST'` only (excludes INITIAL) |
| Auto-judgment | LSL/USL-based auto PASS/FAIL (manual judgment → details=null) |

## Data & Integration
- Tables: `IQC_LOGS`, `MAT_LOTS`, `PART_MASTERS`
- Integration: Shelf-life status(`/material/shelf-life`) → Reinspect(`/material/shelf-life-reinspect`) → **History(this)**
- Separate from IQC history(`/material/iqc-history`) — RETEST dedicated screen
- Scope: `COMPANY='40'`, `PLANT_CD='1000'`
