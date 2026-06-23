---
menuCode: MAT_RECEIPT_CANCEL
audience: user
title: Material Receipt Cancellation
summary: Select and cancel completed material receipt transactions (reverse transaction) and view cancellation history
tags: [material, receipt, cancel, stock, reverse transaction]
keywords: [receipt cancellation, material receipt cancel, STOCK_TRANSACTIONS, cancel reason, reverse transaction, DONE, CANCELED, MatStock]
related: [MAT_RECEIVE, MAT_ARRIVAL]
---

# Material Receipt Cancellation

## Screen Purpose
Select and cancel **already completed (DONE) material receipt transactions** and manage the history. Upon cancellation, the original transaction status changes to `CANCELED`, a reverse transaction with opposite sign is automatically created in `STOCK_TRANSACTIONS`, and `MatStock` inventory is reduced.

> Used to reverse receipts for materials that were incorrectly received or found to have quality issues.

## Screen Layout
- **Top — Filter Area**: Use the **Date Range Filter** to specify the receipt period and **search keyword** to find items by item code, item name, vendor, or transaction number. The **Refresh** button updates the list.
- **Bottom — DataGrid List**: Displays cancellable receipt (DONE) transactions and already canceled (CANCELED) ones. Use the status filter to view **DONE (normal)** / **CANCELED (canceled)** separately.
- **Modal — Cancel Processing**: Click the **Cancel** button in the list to open the cancellation confirmation modal. Review the transaction info, enter the **cancel reason**, and confirm.

---

## ① DataGrid List Columns

| Column | Role / Description |
|------|------|
| **Transaction Date (transDate)** | The date the receipt transaction occurred. Filterable by date range. |
| **Transaction No. (transNo)** | Unique identifier (PK) of the receipt transaction. |
| **Transaction Type (transType)** | Transaction type. Only `RECEIVE` type is displayed on the receipt cancellation screen. |
| **Item Code (itemCode)** | The code of the received item. |
| **Item Name (itemName)** | The name of the received item. |
| **Material Serial (matUid)** | The unique serial of the received material LOT. |
| **Vendor (vendorName)** | The supplier who delivered the material. |
| **Warehouse (warehouseName)** | The warehouse where the material was received. |
| **Quantity (qty)** | The received quantity. |
| **Status (status)** | Displayed as `DONE` (normal, green) / `CANCELED` (canceled, red). |
| **Actions (actions)** | Shows a **Cancel** button. Disabled for `CANCELED` transactions. |

---

## ② Cancel Processing Modal

| Item | Role / Description |
|------|------|
| **Transaction No. (transNo)** | Displays the original transaction number to be canceled. |
| **Transaction Date (transDate)** | Displays the original transaction date. |
| **Item Code / Item Name** | Displays the item to be canceled. |
| **Material Serial (matUid)** | Displays the LOT serial to be canceled. |
| **Vendor / Warehouse** | Displays vendor and warehouse information. |
| **Cancel Quantity** | Displays the original receipt quantity. |
| **Cancel Reason (reason)** | **Required field**. Enter the specific reason for cancellation (e.g., "Return due to quality defect", "Receipt quantity error correction"). |
| **Confirm Cancel** | Click the **Cancel** button after entering the reason to confirm. |

---

## Usage Procedure
1. Select the receipt period using the **Date Range Filter** at the top and click the **Search** button.
2. Find the receipt transaction to cancel in the list and click the **Cancel** button.
3. Review the transaction information in the cancel modal and enter the **cancel reason**.
4. Click the **Confirm Cancel** button. A reverse transaction is created and the status changes to `CANCELED`.
5. Filter by status in the list to view cancellation history.

## Input Rules / Validation
- Cancel reason is **required**. The cancel button is disabled if empty.
- **Already canceled** transactions cannot be canceled again (button disabled).
- Only `RECEIVE` type transactions appear on this screen; other types are not eligible for cancellation.
- Cancellation may be blocked if the receipt transaction has **subsequent progress** (e.g., the LOT has already been issued to production).

## FAQ
- **Q.** Can I undo a cancellation? **A.** No, cancellations cannot be reversed. If re-receipt is needed, process a standard receipt through the Material Receiving screen (MAT_RECEIVE).
- **Q.** Why don't I see receipt transactions in the list? **A.** Check if the date range filter is appropriate. The default is today; expand the range for past receipts. Only `RECEIVE` type is displayed.
- **Q.** Why is the Cancel button disabled? **A.** The transaction is already in `CANCELED` status, or subsequent progress (production input, etc.) makes cancellation impossible.
- **Q.** How does cancellation affect stock? **A.** `MatStock` is reduced by the original receipt quantity, and a reverse-sign transaction is recorded in `STOCK_TRANSACTIONS`.

## Related Screens
- [Material Receiving](/material/receive) — Standard receipt processing screen
- [Arrival Management](/material/arrival) — Pre-receipt arrival and inspection stage
- [Stock Transaction History](/inventory/transaction) — View all stock transaction history
