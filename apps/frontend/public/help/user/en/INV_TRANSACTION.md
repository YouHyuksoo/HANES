---
menuCode: INV_TRANSACTION
audience: user
title: Stock Transaction History
summary: View all material stock change history (receipt/issue/transfer/adjustment/scrap)
tags: [stock, transaction, history, view, ledger]
keywords: [STOCK_TRANSACTIONS, transaction history, receipt, issue, transfer, adjustment, scrap, LOT, transaction inquiry]
related: [INV_MAT_STOCK, MAT_ADJUSTMENT]
---

# Stock Transaction History

## Screen Purpose
View all material stock transaction history (receipt, issue, transfer, adjustment, scrap, etc.). Track every stock change by date and type.

## Screen Layout
- **DataGrid List**: Displays 13 columns including transaction number, type, date, warehouse, item, quantity, status, etc.
- **Top Filter**: Transaction type selection + date range + LOT number search

---

## ① DataGrid List Columns

| Column | Role / Description |
|------|------|
| **Transaction No. (transNo)** | Unique number identifying each stock change. |
| **Type (transType)** | Stock change type. Includes **receipt/issue/transfer/adjustment/scrap**, distinguished by color chips. |
| **Date (transDate)** | The date and time of the transaction. |
| **From Warehouse (fromWarehouse)** | The warehouse stock was moved from (issue/transfer). |
| **To Warehouse (toWarehouse)** | The warehouse stock was moved to (receipt/transfer). |
| **Item Code (itemCode)** | The code of the changed item. |
| **Item Name (itemName)** | The name of the changed item. |
| **LOT No. (matUid)** | The LOT/serial associated with the transaction. |
| **Quantity (qty)** | The changed quantity. **Positive (+) = stock increase, Negative (-) = stock decrease**. |
| **Status (status)** | Transaction status. `DONE` (normal, green) / `CANCELED` (canceled, red). |
| **Original Transaction (original)** | Original transaction number for cancellations (shown for canceled entries). |
| **Remark (remark)** | Additional notes about the transaction. |

## Usage Procedure
1. Set transaction type, date range, and LOT number in the top filter.
2. View specific transaction details from the results.
3. Use column filter and sort functions to find desired data.
4. **Export** to download results as Excel.

## Key Transaction Types
| Type | Meaning | Quantity Sign |
|------|------|----------|
| RECEIVE | Material receipt | + |
| MAT_OUT | Material issue | - |
| ADJUST_IN | Adjustment increase | + |
| ADJUST_OUT | Adjustment decrease | - |
| TRANSFER | Inter-warehouse transfer | From -, To + |
| LOT_SPLIT_IN/OUT | LOT split | Split -, Created + |
| SCRAP | Disposal | - |
| MISC_IN | Miscellaneous receipt | + |
| PROD_CONSUME | Production consumption | - |

## Related Screens
- [Material Stock Status](/inventory/material-stock) — View current stock status
- [Stock Adjustment](/material/adjustment) — Register manual stock adjustments
