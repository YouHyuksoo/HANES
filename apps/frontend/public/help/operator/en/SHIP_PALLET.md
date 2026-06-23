---
menuCode: SHIP_PALLET
audience: operator
title: Pallet Loading — Operator Guide
summary: Shipping pallet management — pallet creation, box assignment/removal, CLOSE/REOPEN, label print, OQC PASS boxes only
tags: [shipping, pallet, loading, box, label]
keywords: [PALLET_MASTERS, BOX_MASTERS, SHIPMENT_ORDERS, OPEN, CLOSED, LOADED, SHIPPED, PALLET_STATUS, OQC_STATUS, pallet, pallet loading, box assignment, label print]
related: [SHIP_PACK, SHIP_ORDER]
---

# Pallet Loading — Operator Guide

## System Purpose & Role
Create shipping pallets and assign boxes. Palletizes CLOSED+OQC PASS boxes against CONFIRMED ship orders. Print pallet labels after CLOSE and await shipment.

```
CONFIRMED Ship Order → Create Pallet(OPEN) → Assign Boxes → CLOSE → Print Label → LOADED → SHIPPED
```

## Status Flow (Pallet)
```
OPEN → CLOSED(label printed) → LOADED(shipment allocated) → SHIPPED(shipped)
CLOSED → OPEN (reopen allowed)
```

## Data Structure
```
PALLET_MASTERS (PK: PALLET_NO)
   ├─ SHIP_ORDER_NO → SHIPMENT_ORDERS
   ├─ BOX_COUNT / TOTAL_QTY (auto-calculated)
   ├─ STATUS: OPEN → CLOSED → LOADED → SHIPPED
   └─ CLOSE_TIME / SHIPPED_TIME / SHIPMENT_ID

BOX_MASTERS (PK: BOX_NO + COMPANY + PLANT_CD)
   ├─ ITEM_CODE → ITEM_MASTERS
   ├─ PALLET_NO → PALLET_MASTERS
   ├─ STATUS: OPEN → CLOSED → SHIPPED
   └─ OQC_STATUS: PENDING / PASS / FAIL
```

## Screen Layout

### Top
- **Header**: Title + Refresh·Create Pallet buttons
- **Left(2/3)**: DataGrid — pallet list
  - Columns: actions·ship order no·pallet no·box count·total qty·status·shipment no·created at
  - Actions: assign boxes(OPEN)·CLOSE(OPEN)·reopen(CLOSED)·print label(CLOSED+)
  - Search: pallet no, barcode scan, status filter
  - `HelpCircle` on status header → transition help
- **Right(1/3)**: Selected pallet detail
  - Pallet summary
  - Assigned box list (removable in OPEN)
  - Box info: box no·item code·qty·OQC status

### Create Modal
- Scan/select CONFIRMED ship order → create pallet
- Only CONFIRMED status orders selectable

### Assign Box Modal
- `+` button or barcode scan
- Available boxes: `CLOSED` + `unassigned=true` + `oqcStatus=PASS`
- OQC FAIL boxes cannot be assigned

### Label Modal (PalletLabelModal)
- Code128 barcode (bwip-js)
- Box count·total qty·status·item name
- Template selectable (master/label-templates)
- Auto-print mode supported
- Media: 100mm × 120mm

## Workflow

### ① Create Pallet
`POST /shipping/orders/{shipOrderNo}/pallets`
- Select CONFIRMED ship order (scan or list)
- 1 pallet per order limit

### ② Assign Boxes
`POST /shipping/orders/{shipOrderNo}/pallets/{palletNo}/boxes`
- Scan box or select from list
- Multi-select supported
- OQC PASS + CLOSED + unassigned only

### ③ Close Pallet
`POST /shipping/orders/{shipOrderNo}/pallets/{palletNo}/close`
- OPEN → CLOSED transition
- Label printable after CLOSE

### ④ Reopen Pallet
`POST /shipping/pallets/{palletNo}/reopen`
- CLOSED → OPEN transition
- For reassignment/removal

### ⑤ Print Label
- Open label modal in CLOSED+ status
- bwip-js Code128 barcode
- Template selectable·print

## Box Assignment Conditions

| Condition | Description |
|------|-------------|
| BOX_MASTERS.STATUS = CLOSED | Box packed |
| OQC_STATUS = PASS | OQC inspection passed |
| PALLET_NO = NULL | Not assigned to another pallet |
| Same ship order scope | Matching order items only |

## Interlock

| Condition | Description |
|------|-------------|
| OQC FAIL box | Cannot assign |
| Already assigned box | Cannot duplicate |
| Not CONFIRMED order | Cannot create pallet |
| SHIPPED/LOADED pallet | Cannot close/reopen |
| 1 pallet per order | Creation limit |

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| Cannot create pallet | Order not CONFIRMED | Confirm order first |
| Cannot assign box | OQC not PASS | Complete visual inspection |
| Box not found | Already assigned | Check unassigned boxes |
| CLOSE disabled | 0 boxes | Assign boxes first |
| Label not printing | Printer settings | Check browser print setup |

## Data & Integration
- Tables: `PALLET_MASTERS`, `BOX_MASTERS`, `SHIPMENT_ORDERS`, `SHIPMENT_ORDER_ITEMS`
- Integration: Ship order(`/shipping/order`) → Pack(`/shipping/pack`) → **Pallet loading(this)** → Ship
- OQC gate: Visual inspection(`/quality/inspect`) PASS required
- Label: bwip-js Code128, `master/label-templates` design system
- Scope: `COMPANY='40'`, `PLANT_CD='1000'`
