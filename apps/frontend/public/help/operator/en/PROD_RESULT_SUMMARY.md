---
menuCode: PROD_RESULT_SUMMARY
audience: operator
title: Production Result Summary — Operator Guide
summary: Finished-product production result aggregation — plan qty, good qty, defect qty, achievement rate, yield rate, defect rate by product
tags: [production, result, summary, aggregation]
keywords: [PROD_RESULTS, JOB_ORDERS, PART_MASTERS, totalPlanQty, totalGoodQty, totalDefectQty, achieveRate, yieldRate, defectRate, production result, summary, yield, achievement]
related: [PROD_ORDER, PROD_INPUT_KIOSK]
---

# Production Result Summary — Operator Guide

## System Purpose & Role
Aggregate production results by finished product. View plan vs actual achievement, yield rate, and defect rate at a glance.

```
JOB_ORDERS(plan) + PROD_RESULTS(result) → Group by product → achievement·yield·defect rates
```

## Data Structure
```
PROD_RESULTS ← JOB_ORDERS → PART_MASTERS (ITEM_MASTERS)
```

## Screen Layout
- **Header**: Title + Refresh button
- **Toolbar**: Search (item code·name) + DateRangeFilter (default today)
- **DataGrid**: `GET /production/prod-results/summary/by-product`

| Column | Description | Formula |
|------|-------------|---------|
| Item Code | `PART_MASTERS.ITEM_CODE` | |
| Item Name | `PART_MASTERS.ITEM_NAME` | |
| Item Type | `PART_MASTERS.ITEM_TYPE` | |
| Line | `JOB_ORDERS.LINE_CODE` | |
| Plan Qty | `SUM(JOB_ORDERS.PLAN_QTY)` | |
| Good Qty | `SUM(PROD_RESULTS.GOOD_QTY)` | |
| Defect Qty | `SUM(PROD_RESULTS.DEFECT_QTY)` | |
| Total Prod | `goodQty + defectQty` | |
| Achievement | `goodQty / planQty × 100` | |
| Yield | `goodQty / (goodQty + defectQty) × 100` | |
| Defect Rate | `defectQty / (goodQty + defectQty) × 100` | |
| Order Count | `COUNT(DISTINCT JOB_ORDERS.ORDER_NO)` | |
| Result Count | `COUNT(PROD_RESULTS.RESULT_NO)` | |

## Filter Conditions
- **Date range**: `PROD_RESULTS.START_TIME`, default today
- **Excluded**: `PROD_RESULTS.STATUS = 'CANCELED'`
- **Sort**: good qty descending

## Key Metrics
| Metric | Meaning | Target |
|------|---------|--------|
| Achievement | Plan vs actual | 100% ↑ |
| Yield | Good product ratio | 100% ↑ |
| Defect Rate | Defect ratio | 0% ↓ |

## Troubleshooting
| Symptom | Cause | Action |
|------|------|------|
| No data | No results in period | Expand date range |
| 0% achievement | No plan qty | Check job order plan |
| 100% yield | Defects not registered | Check DefectLog |

## Data & Integration
- Tables: `PROD_RESULTS`, `JOB_ORDERS`, `PART_MASTERS`
- Integration: Job order(`/production/order`) → Result input(`/production/input-kiosk`) → **Summary(this)**
- Scope: `COMPANY='40'`, `PLANT_CD='1000'`
