---
menuCode: INV_MAT_STOCK
audience: user
title: Material Stock Status
summary: View material stock status by warehouse and item in serial detail or item group summary
tags: [stock, material, status, view, realtime]
keywords: [MAT_STOCKS, stock inquiry, safety stock, serial, LOT, expiry date, stock quantity, available stock, reserved stock]
related: [INV_TRANSACTION, INV_MAT_PHYSICAL_INV]
---

# Material Stock Status

## Screen Purpose
View real-time material stock by warehouse and item. Provides serial (LOT) level detail and item group summary tabs, with safety stock status and expiry date information at a glance.

## Screen Layout
- **Two Tabs**: **Serial Detail** (individual LOT level) / **Item Group Summary** (item-based aggregation)
- **Top Filter**: Warehouse dropdown + item code/item name search input
- **DataGrid List**: Different column sets depending on the selected tab

---

## ① Serial Detail Tab Columns

| Column | Role / Description |
|------|------|
| **Item Code (itemCode)** | The code of the stock item. |
| **Item Name (itemName)** | The name of the stock item. |
| **Material Serial (matUid)** | Individual LOT/serial number. Different serials of the same item are managed as separate rows. |
| **Warehouse (warehouseName)** | The warehouse where stock is located. |
| **Quantity (qty)** | Total stock quantity currently stored in the warehouse. |
| **Safety Stock (safetyStock)** | The safety stock target for this item (set in the item master). |
| **Status (stockLevel)** | Whether safety stock is met relative to actual quantity. **Shortage** (red) / **Caution** (yellow) / **Normal** (green). |
| **Manufacture Date (manufactureDate)** | The manufacture date of the LOT. |
| **Elapsed Days (elapsedDays)** | Days elapsed since the manufacture date. |
| **Remaining Days (remainingDays)** | Days remaining until expiry. **Negative means expired**. |
| **Shelf Life Status (shelfLifeStatus)** | Shelf life status. **Expired** (red) / **Imminent** (yellow) / **Normal** (green). |

---

## ② Item Group Summary Tab Columns

| Column | Role / Description |
|------|------|
| **Item Code (itemCode)** | Item code. |
| **Item Name (itemName)** | Item name. |
| **Total Stock (totalQty)** | Total stock quantity across all warehouses for this item. |
| **Safety Stock (safetyStock)** | Safety stock target for the item. |
| **Status (stockLevel)** | Whether total stock meets safety stock. |
| **Serial Count (serialCount)** | Number of LOT/serials this item has. |
| **Warehouse Count (warehouseCount)** | Number of warehouses where this item is distributed. |

---

## Usage Procedure
1. Select the **warehouse** and enter a **search term** (item code/name) in the top filter.
2. View individual LOT-level stock in the **Serial Detail** tab.
3. View item-level aggregated stock in the **Item Group Summary** tab.
4. Items marked as safety stock shortage (red) or expiry (red) may need immediate action.
5. Use the **Export** button at the top right to download the current results as an Excel file.

## Related Screens
- [Stock Transaction History](/inventory/transaction) — View stock change (receipt/issue/transfer) history
- [Physical Inventory Management](/inventory/material-physical-inv) — Reconcile physical vs system stock
