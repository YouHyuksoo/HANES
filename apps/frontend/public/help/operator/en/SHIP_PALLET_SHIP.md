---
menuCode: SHIP_PALLET_SHIP
audience: operator
title: Pallet Shipment — Operations Guide
summary: Shipment confirmation process for PALLET_MASTERS·SHIPMENT_LOGS, inventory deduction logic, transaction structure, and troubleshooting
tags: [shipment, pallet, shipment-confirmation, operations, SHIPPED, inventory]
keywords: [SHIP_PALLET_SHIP, PALLET_MASTERS, SHIPMENT_LOGS, SHIPMENT_ORDER, PALLET_NO, CLOSED, SHIPPED, shipment-confirmation, FG-inventory-deduction, FIFO]
related: [SHIP_ORDER, SHIP_PALLET]
---

# Pallet Shipment — Operations Guide

## System Purpose & Role
Processes pallets with loaded-complete (CLOSED) status into shipment-confirmed (SHIPPED) status. **Auto-numbering of shipment number** → `ShipmentLog` creation → `PalletMaster.STATUS='SHIPPED'` → `BoxMaster.STATUS='SHIPPED'` → `FgLabel.STATUS='SHIPPED'` → **FG inventory deduction (FIFO)** → `ShipmentOrderItem.shippedQty` update → when all items are fully shipped, `ShipmentOrder.STATUS='CLOSED'`. All handled within a single transaction.

## Data Structure
```
ShipmentOrder (shipment order, STATUS=CONFIRMED)
    │
    ├── ShipmentOrderItem (item-level shipment qty)
    │
    └── PALLET_MASTERS (PK: COMPANY + PLANT_CD + PALLET_NO)
            │   STATUS: OPEN → CLOSED → SHIPPED
            │   BOX_COUNT, TOTAL_QTY
            │   SHIP_ORDER_NO (→ ShipmentOrder)
            │   SHIPMENT_ID (→ ShipmentLog.SHIP_NO)
            │
            ├── BOX_MASTERS (PK: COMPANY + PLANT_CD + BOX_NO)
            │       STATUS: OPEN → CLOSED → SHIPPED
            │       PART_CODE, QTY
            │
            └── FG_LABELS (when serials exist)
                    STATUS: SHIPPED
```

---

## ① Pallet Master — PALLET_MASTERS (All Columns)

| Screen Field | DB Column | Role / Description · Operational Point |
|------|------|------|
| Pallet No. | `PALLET_NO` | **PK (3/3)**. Unique pallet identifier. |
| Box Count | `BOX_COUNT` | Number of boxes loaded on the pallet. |
| Total Qty | `TOTAL_QTY` | Total product quantity (sum of box QTY). |
| Status | `STATUS` | `OPEN` / `CLOSED` / `LOADED` / `SHIPPED`. Only CLOSED can be shipped. |
| Load Complete Time | `CLOSE_TIME` | Time pallet was set to CLOSED. |
| Ship Time | `SHIPPED_TIME` | Time of SHIPPED. |
| Shipment No. | `SHIPMENT_ID` | References `ShipmentLog.SHIP_NO` (set at shipment confirmation). |
| Order No. | `SHIP_ORDER_NO` | References `ShipmentOrder.SHIP_ORDER_NO`. |
| Loaded By | `LOADED_BY` | Worker who completed loading. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | **PK (1,2/3)**. Company code (`40`) / Plant code (`1000`). |
| Created By | `CREATED_BY` | Pallet creator. |
| Updated By | `UPDATED_BY` | Last modifier. |

---

## ② Shipment Log — SHIPMENT_LOGS (All Columns)

| DB Column | Role / Description |
|---------|------|
| `SHIP_NO` | **PK (3/3)**. Shipment number (auto-numbered via sequence). |
| `SHIP_DATE` | Shipment date. |
| `SHIP_TIME` | Shipment timestamp (transaction time). |
| `DESTINATION` | Destination (references shipment order). |
| `CUSTOMER` | Customer (references shipment order). |
| `SHIP_ORDER_NO` | Shipment order number. |
| `PALLET_COUNT` | Number of shipped pallets. |
| `BOX_COUNT` | Number of shipped boxes. |
| `TOTAL_QTY` | Total shipped quantity. |
| `STATUS` | `LOADED` (loaded shipment) / `SHIPPED` (shipment confirmed) |
| `ERP_SYNC_YN` | ERP sync flag (`Y`/`N`). |
| `COMPANY`, `PLANT_CD` | **PK (1,2/3)**. |

---

## Shipment Confirmation Transaction Details

When `POST /shipping/orders/:id/ship-pallets` is called, `ShipOrderService.shipOrderPallets()` executes:

1. **Validation Phase**:
   - Verify shipment order `status === 'CONFIRMED'`
   - Verify requested items match shipment order items
   - Verify each `PALLET_NO` has `status === 'CLOSED'`
   - Verify `shipmentId === null` (not yet shipped)
   - Verify all boxes under the pallet are `CLOSED` + OQC PASS status
   - Verify serial list matches box qty

2. **Transaction Execution**:
   - Generate shipment number → create `ShipmentLog` (status=`LOADED`)
   - Update `PalletMaster`: `shipmentId=shipNo, status='SHIPPED', shippedTime=now`
   - Update `BoxMaster`: `status='SHIPPED', shippedAt=now`
   - Update `FgLabel`: `status='SHIPPED'` (when serials exist)
   - `ProductInventory.issueStockByItemFifoInTx()` — FIFO-based FG inventory deduction
   - `ShipmentOrderItem.shippedQty += box.qty`
   - When all items fully shipped, `ShipmentOrder.status = 'CLOSED'`

---

## Status Flow

```
OPEN (pallet created)
  │
  ▼
CLOSED (loaded complete = ready to ship)
  │
  ▼ [Scan + confirm shipment on Pallet Shipment screen]
SHIPPED (shipment confirmed)
  ├── Inventory deducted
  ├── BoxMaster.STATUS → SHIPPED
  └── When all items on order shipped → ShipmentOrder.CLOSED
```

---

## Permissions
Shipment processing permission (shipping/warehouse staff). Viewing available to all users.

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| Shipment order list is empty | No CONFIRMED orders exist | Register a shipment order → process approval |
| Cannot scan pallet | Pallet is not in CLOSED status | Complete loading on the Pallet Loading screen |
| "Already shipped pallet" error | Pallet is already in SHIPPED status | Check shipment history |
| Ship Confirm button disabled | No valid pallet entered | Scan or enter a pallet number |
| Inventory deduction failed | Insufficient inventory | Check FG inventory and replenish |
| Serial mismatch error | Serial list does not match box qty | Verify serial scan records |

## Data & Integration
- **Tables**: `PALLET_MASTERS`, `BOX_MASTERS`, `SHIPMENT_LOGS`, `SHIPMENT_ORDER`, `SHIPMENT_ORDER_ITEM`, `FG_LABEL`
- **Integration**: FG inventory (FIFO deduction), ERP sync (`ERP_SYNC_YN`)
- **Scope**: `COMPANY='40'`, `PLANT_CD='1000'`
