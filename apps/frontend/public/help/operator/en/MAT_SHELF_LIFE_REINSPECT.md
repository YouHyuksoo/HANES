---
menuCode: MAT_SHELF_LIFE_REINSPECT
audience: operator
title: Shelf Life Reinspect — Operator Guide
summary: Near-expiry/expired LOT reinspection — IQC inspection measurement·PASS/FAIL judgment·extend days setting·auto quarantine/scrap on FAIL
tags: [material, shelf life, reinspect, IQC, LOT, expiry]
keywords: [SHELF_LIFE, REINSPECT, MAT_LOTS, IQC_LOGS, RETEST, EXPIRED, NEAR_EXPIRY, VALID, DISCARDED, expireDate, extendDays, shelf life, reinspect, expiry, LOT extension]
related: [MAT_SHELF_LIFE, MAT_SHELF_LIFE_HISTORY, QC_IQC]
---

# Shelf Life Reinspect — Operator Guide

## System Purpose & Role
Reinspect near-expiry(`NEAR_EXPIRY`) or expired(`EXPIRED`) material LOTs for extension or disposal. Measure against IQC inspection items (IQC_PART_SPEC), judge PASS/FAIL. PASS extends expiry date; FAIL auto-quarantines the LOT to DEFECT warehouse and marks DISCARDED.

```
Target LOT list → IQC measurement → PASS: extend expiry / FAIL: DEFECT quarantine+DISCARDED
```

## Data Structure
```
MAT_LOTS (PK: matUid)
   ├─ itemCode → ITEM_MASTERS (expiryExtDays: max extension)
   ├─ expireDate
   └─ status: NORMAL / DISCARDED

IQC_LOGS (inspectType='RETEST')
   ├─ matUid / retestRound (auto-increment)
   ├─ result (PASS/FAIL) / extendDays
   └─ details (measurement JSON)
```

## Screen Layout

### Main Area
- **Header**: Title + links (Shelf Life Status·Reinspect History)
- **DataGrid**: `GET /material/shelf-life?limit=5000`
  - Client filter: `EXPIRED` + `NEAR_EXPIRY` only
  - Columns: actions·LOT No.·item code·item name·current qty·expiry·days left·status
  - Search: LOT no·item code·item name, status filter
  - `Inspect` button per row → ReinspectModal
  - URL `?matUid=XXX` auto-open support

### ReinspectModal
| Area | Description |
|------|-------------|
| Target Info | LOT·item·qty·current expiry·days left |
| IQC Items | `GET /master/iqc-part-specs/{itemCode}/resolve-items` |
| Measurements | LSL/USL items → number input (auto PASS/FAIL) |
| | No LSL/USL → PASS/FAIL toggle |
| Overall | All PASS → auto PASS / Any FAIL → FAIL |
| Inspector | Optional |
| Sample Qty | Destructive test consumption |
| Extend Days | Days to extend on PASS (empty = max expiryExtDays) |
| Remark | |

## Reinspect Flow

### ① Select Target LOT
`GET /material/shelf-life?limit=5000`
- EXPIRED + NEAR_EXPIRY lots only
- Also accessible from Shelf Life Status page (`/material/shelf-life`)

### ② Load IQC Items
`GET /master/iqc-part-specs/{itemCode}/resolve-items`
- Registered IQC inspection items for the item
- Auto-judge based on LSL/USL range

### ③ Enter Measurements
- Numeric: enter actual value → PASS if within range
- Toggle: PASS/FAIL direct select

### ④ Submit
`POST /material/shelf-life/reinspect { matUid, result, inspectorName, extendDays, destructSampleQty, details, remark }`

| Result | Action |
|------|--------|
| **PASS** | `MatLot.expireDate` = inspectDate + `extendDays` (max `expiryExtDays`) |
| **FAIL** | Good stock → DEFECT warehouse, `MatLot.status = 'DISCARDED'` |

## Expiry Status Criteria

| Status | Condition |
|------|-----------|
| EXPIRED | `expireDate < today` |
| NEAR_EXPIRY | `expireDate <= today + nearExpiryDays(default 10)` |
| VALID | Otherwise |
| DISCARDED | `MatLot.status = 'DISCARDED'` |

## Interlock

| Condition | Description |
|------|-------------|
| Already DISCARDED | Cannot reinspect |
| Extend > expiryExtDays | Max extension limit |
| Reserved qty on FAIL | DEFECT move blocked |

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| No target lots | No EXPIRED/NEAR_EXPIRY | Check shelf life status |
| No IQC items | IQC_PART_SPEC not registered | Register item spec |
| Cannot extend | expiryExtDays=0 | Check item master |
| FAIL error | DEFECT warehouse missing | Register DEFECT warehouse |

## Data & Integration
- Tables: `MAT_LOTS`, `IQC_LOGS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS`, `ITEM_MASTERS`
- Integration: Shelf Life Status(`/material/shelf-life`) → **Reinspect(this)** → History(`/material/shelf-life-history`)
- IQC: Based on `IQC_PART_SPEC` inspection items
- Scope: `COMPANY='40'`, `PLANT_CD='1000'`
