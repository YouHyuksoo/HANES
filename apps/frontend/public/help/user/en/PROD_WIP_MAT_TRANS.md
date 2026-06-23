---
menuCode: PROD_WIP_MAT_TRANS
audience: user
title: WIP Material Transactions
summary: View WIP material stock transaction history (receipt/consumption/cancel) by equipment
tags: [production, WIP, process, transaction, equipment, inquiry]
keywords: [WIP_MAT_TRANSACTIONS, WIP transaction, WIP stock, WIP_IN, PROD_CONSUME, equipment stock, material consumption, work-in-process]
related: [PROD_ORDER, PROD_INPUT_KIOSK]
---

# WIP Material Transactions

## Screen Purpose
View the transaction history of **raw material WIP (Work-In-Process) stock** managed by equipment. Track when raw materials are transferred into a process (WIP_IN), consumed in production (PROD_CONSUME), or when those transactions are canceled, organized by equipment and date.

## Screen Layout
- **DataGrid**: 8 columns — date, type, equipment, item, LOT, quantity, reference, remark
- **Toolbar filters**: Equipment selector + transaction type + date range + keyword search (item code/name/LOT/equipment name)

---

## ① DataGrid Columns

| Column | Role / Description |
|------|------|
| **Date(createdAt)** | When the transaction was processed. |
| **Type(transType)** | Transaction type. **WIP_IN**(blue) / **WIP_IN_CANCEL**(red) / **PROD_CONSUME**(orange) / **PROD_CONSUME_CANCEL**(red). |
| **Equipment(equipName)** | Equipment name and code where the transaction occurred. |
| **Item(itemCode)** | Raw material item code and name. |
| **LOT(matUid)** | LOT/serial number involved. |
| **Qty(qty)** | Quantity changed. **Positive(blue)** = stock increase, **Negative(red)** = stock decrease. |
| **Reference(refType)** | Original reference type and ID (e.g., work order number). |
| **Remark(remark)** | Additional notes about the transaction. |

## Transaction Types
| Type | Description | Quantity |
|------|-------|------|
| WIP_IN | Raw material transferred from warehouse to equipment | + (positive) |
| WIP_IN_CANCEL | Cancel WIP_IN — material returned to warehouse | - (negative) |
| PROD_CONSUME | Material consumed in production at equipment | - (negative) |
| PROD_CONSUME_CANCEL | Cancel consumption — material restored to WIP stock | + (positive) |

## Usage
1. Select **equipment** and **transaction type** from the toolbar filters, optionally set **date range** and **search keyword**.
2. Review individual transactions in the list.
3. Use column filters and sorting to find specific data.
4. **Export** results to Excel.

## Related Screens
- [Work Order Management](/production/order) — Track WIP transactions by work order
- [Production Input (Kiosk)](/production/input-kiosk) — Production result entry generates WIP transactions
