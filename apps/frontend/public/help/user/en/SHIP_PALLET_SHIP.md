---
menuCode: SHIP_PALLET_SHIP
audience: user
title: Pallet Shipment
summary: Scan loaded pallets to confirm shipment. Review box composition per pallet and process shipment.
tags: [shipment, pallet, shipment-confirmation, scan, SHIPPED]
keywords: [SHIP_PALLET_SHIP, pallet-shipment, shipment-confirmation, PALLET_NO, SHIPPED, CLOSED, barcode-scan]
related: [SHIP_ORDER, SHIP_PALLET]
---

# Pallet Shipment

## Screen Purpose
Search for pallets that are loaded and ready for shipment (CLOSED) via barcode scan or manual input, then process final shipment confirmation (SHIPPED). Review the list of boxes included in each pallet.

## Screen Layout
- **Left — Shipment Order List**: Displays shipment orders with CONFIRMED status.
- **Center — Pallet List**: Displays the pallet list for the selected shipment order in a DataGrid.
- **Right — Box Details**: Displays the list and status of boxes included in the selected pallet.

---

## Usage Sequence
1. Select a shipment order from the left shipment order list.
2. Review pallets to ship in the center pallet list.
3. Scan or manually enter a pallet barcode in the **Pallet Scan** input field.
4. If the scanned pallet is valid, it is added to the list and the **Ship Confirm** button is enabled.
5. Click the Ship Confirm button to finalize shipment.

## Center — Pallet DataGrid Columns

| Column | Role / Description |
|------|------|
| **Pallet No. (PALLET_NO)** | Unique identifier of the pallet. |
| **Box Count (BOX_COUNT)** | Number of boxes loaded on the pallet. |
| **Total Qty (TOTAL_QTY)** | Total product quantity on the pallet. |
| **Status (STATUS)** | Current pallet status (OPEN / CLOSED / LOADED / SHIPPED). |
| **Load Complete Time (CLOSE_TIME)** | Time when pallet loading was completed. |
| **Ship Time (SHIPPED_TIME)** | Time of shipment confirmation. |

## Right — Box Detail Columns

| Column | Role / Description |
|------|------|
| **Box No. (BOX_NO)** | Unique identifier of the box. |
| **Item Code** | Item code of the product in the box. |
| **Item Name** | Product name. |
| **Qty (QTY)** | Product quantity per box. |
| **Status (STATUS)** | Box status. |

## Input Rules
- Pallet numbers can be scanned with a barcode scanner or entered manually.
- Only pallets with **CLOSED** (loaded complete) status can be shipped.
- Upon shipment confirmation, the pallet and all its boxes change to **SHIPPED** status, and inventory is deducted.

## Status Flow
```
OPEN(pallet created) → CLOSED(loaded, ready to ship) → SHIPPED(shipment confirmed)
```

## Related Screens
- [Create Shipment Order](/shipping/order) — Screen to register a shipment order
- [Pallet Loading](/shipping/pallet) — Screen for loading boxes onto pallets
