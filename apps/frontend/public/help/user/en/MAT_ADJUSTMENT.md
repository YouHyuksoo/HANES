---
menuCode: MAT_ADJUSTMENT
audience: user
title: Stock Adjustment
summary: Manually correct differences between actual stock and system stock, and view adjustment history
tags: [material, stock, adjustment, correction, physical]
keywords: [stock adjustment, inventory adjustment, quantity correction, INV_ADJ_LOGS, physical count, MANUAL_ADJ, stock discrepancy, increase decrease]
related: [MAT_RECEIVE, MAT_ISSUE]
---

# Stock Adjustment

## Screen Purpose
Manually **adjust** the difference between actual warehouse stock quantity and the system-recorded stock quantity, and manage the history. Used for reflecting physical inventory results, correcting receipt/issue errors, and handling damage or loss.

## Screen Layout
- **Top — 3 Stats Cards**: View total adjustments / increase adjustments / decrease adjustments at a glance.
- **Bottom — DataGrid List**: Displays adjustment history with date, item, quantity change, reason, etc. Filter by date range and search keyword.
- **Modal — Register Adjustment**: Open the modal by clicking the **Register Adjustment** button at the top right to register a new adjustment. Applied to stock immediately upon registration (no approval required).

---

## ① DataGrid List Columns

| Column | Role / Description |
|------|------|
| **Date (createdAt)** | The date and time the adjustment was registered. Displays year-month-day only; filterable by date range. |
| **Warehouse (warehouseCode)** | The warehouse code where the adjustment occurred. |
| **Item Code (itemCode)** | The code of the adjusted item. |
| **Item Name (itemName)** | The name of the adjusted item. |
| **Before (beforeQty)** | System stock quantity before adjustment. Unit is displayed together. |
| **After (afterQty)** | System stock quantity after adjustment. |
| **Difference (diffQty)** | Quantity difference before and after adjustment. **Positive (blue)** = stock increase, **Negative (red)** = stock decrease. |
| **Reason (reason)** | The reason for the adjustment. |
| **Processor (createdBy)** | The user who registered the adjustment. |

---

## ② Register Adjustment Modal Fields

| Field | Role / Description |
|------|------|
| **Warehouse (warehouseCode)** | Select the warehouse where the stock being adjusted is located. |
| **Item Search (partSearch)** | Search and select the item to adjust. Enter 2 or more characters of item code or name to see search results in a dropdown. |
| **After Qty (afterQty)** | Enter the **final quantity** after adjustment. The difference from the before quantity is automatically calculated and recorded in diffQty. |
| **Reason (reason)** | Enter the reason for the adjustment. Example: "Physical count discrepancy", "Receipt omission correction", "Damage disposal". |

---

## Usage Procedure
1. Click the **Register Adjustment** button at the top to open the modal.
2. Select a warehouse and search for an item to select.
3. Enter the final quantity after adjustment and the reason, then save (applied to stock immediately).
4. Check the result in the list. A positive diffQty means stock increase, negative means stock decrease.

## Input Rules / Validation
- Warehouse, item, quantity, and reason are **all required**. The save button is disabled if any are empty.
- The after adjustment quantity (afterQty) must be an integer **0 or greater**.

## FAQ
- **Q.** Can I cancel an incorrectly registered adjustment? **A.** There is no cancel (delete) function after registration. You must register an opposite adjustment (e.g., decrease if you increased) to restore.
- **Q.** What is the difference between adjustment and receipt/issue? **A.** Receipt/issue are regular stock changes (purchase receipt, production issue), while adjustment is an **exceptional correction** to align system quantity with actual quantity.
- **Q.** How long is adjustment history retained? **A.** Permanently unless there is a separate deletion policy (periodic purging follows operational policy).

## Related Screens
- [Material Receiving](/material/receive) — Standard receipt processing screen
- [Material Issuing](/material/issue) — Standard issue processing screen
