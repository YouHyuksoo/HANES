---
menuCode: MAT_ISSUE_OTHER
audience: operator
title: Other Issuing — Operator Guide
summary: Non-production material issue — LOT barcode scan full issue, issue history query·cancel, defect/sample/outsourcing/scrap/return/other accounts
tags: [material, issue, other issuing, LOT, barcode]
keywords: [MAT_ISSUES, MAT_LOTS, MAT_STOCKS, STOCK_TRANSACTIONS, ISSUE_TYPE, DONE, CANCELED, MAT_OUT, WIP_MOVE, other issuing, LOT issue, barcode scan, issue cancel]
related: [MAT_ISSUE, MAT_RECEIVE]
---

# Other Issuing — Operator Guide

## System Purpose & Role
Handle non-production material issues (defect/sample/outsourcing/scrap/return/other). Scan LOT barcode to issue full quantity, or query/cancel issue history.

```
Scan tab: LOT scan → Full issue
History tab: Query → Cancel (reason required)
```

## Data Structure
```
MAT_LOTS (PK: matUid)
   ├─ ITEM_CODE → ITEM_MASTERS
   ├─ currentQty / iqcStatus / status(NORMAL/HOLD/DEPLETED)
   └─ MAT_STOCKS (qty / availableQty / reservedQty)

MAT_ISSUES (PK: issueNo + seq)
   ├─ matUid / issueQty / issueType / status(DONE/CANCELED)
   └─ STOCK_TRANSACTIONS (transType=MAT_OUT/WIP_MOVE)
```

## Screen Layout

### Barcode Scan Tab
- **Issue Type Select**: `ISSUE_TYPE` comCode (excludes PRODUCTION)
- **LOT Barcode Input**: Auto-focus, Enter → `GET /material/lots/by-uid/{matUid}`
- **Scan Result Card**:
  - itemCode·itemName·LOT·stock qty·unit
  - IQC status (PASS required)
  - Receive date·supplier
- **Full Issue Button**: `POST /material/issues/scan { matUid, issueType }`
- **Today's Scan History**: Local DataGrid

### Issue History Tab
- **Filters**: status·issue type·date range
- **DataGrid**: `GET /material/issues?limit=200`
  - Columns: issue no·date·item code·item name·LOT·qty·type·order·status
  - Cancel button (DONE only)
- **Cancel Modal**:
  - Issue detail display
  - Cancel reason required
  - `POST /material/issues/{issueNo}/{seq}/cancel { reason }`

## Workflow

### ① Barcode Scan Issue
1. Select issue type (defect/sample/outsourcing/etc)
2. Scan LOT barcode or manual entry
3. Verify scan result (IQC PASS required)
4. Click `Full Issue`
5. Stock deducted + STOCK_TRANSACTIONS recorded

### ② Issue History Query
- Filter by date·status·issue type
- Issue type shown as `ISSUE_TYPE` comcode badge
- DONE/CANCELED status distinction

### ③ Issue Cancel
- DONE status only
- Cancel reason required
- Stock restored + reverse transaction recorded
- Blocks cancel if downstream production in progress

## Interlock

| Condition | Description |
|------|-------------|
| IQC not PASS | Cannot issue |
| HOLD/DEPLETED status | Cannot issue |
| Insufficient stock | Cannot issue |
| Production in progress | Cannot cancel |
| Already canceled | Cannot cancel |

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| LOT not found | Barcode error | Check LOT barcode |
| No issue type | PRODUCTION excluded | Select other type |
| Issue fails | IQC or stock issue | Check material status |
| Cancel fails | Production linked | Complete downstream first |

## Data & Integration
- Tables: `MAT_ISSUES`, `MAT_LOTS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS`, `WIP_MAT_STOCKS`
- Integration: Receiving(`/material/receive`) → **Other issuing(this)** → Production input
- ComCode: `ISSUE_TYPE` (PRODUCTION/SCRAP/SAMPLE/OUTSOURCING/RETURN/DEFECT/OTHER)
- Scope: `COMPANY='40'`, `PLANT_CD='1000'`
