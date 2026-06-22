---
menuCode: PUR_PO
audience: user
title: PO Management
summary: Register and manage purchase orders (PO) sent to suppliers. Enter PO number, vendor, order date, due date, and item quantities, and manage status up to confirmed and closed.
tags: [material management, purchase order, PO, ordering]
keywords: [PO number, order number, vendor, supplier, order date, due date, order quantity, received quantity, unit price, total amount, item count, line number, release number, DRAFT, CONFIRMED, PARTIAL, RECEIVED, CLOSED, confirm, close, partial receipt, receipt complete]
related: [PUR_PO_STATUS, MAT_RECEIVE, MST_PART]
---

# PO Management

## Screen Purpose
Register, view, edit, and delete **purchase orders (PO)** for raw materials and other items from suppliers.
The PO must be **CONFIRMED** to proceed to the arrival and incoming inspection stages. When all items are fully received, the PO is **CLOSED**.

## Screen Layout
- **Left (PO List Grid)**: Displays registered POs in a table. Use the top bar for integrated search (PO number, vendor, item) or filtering by order date range and status.
- **Right (Register/Edit Panel)**: Opens as a slide from the right when clicking the **Register** button or a row's ✏️. PO header info and item list are entered together.

---

## ① PO List Columns

| Column | Role / Description |
|------|------|
| **PO No. (poNo)** | Unique number identifying the order. Auto-generated on registration (`PO-YYYYMMDD-NNN` format). Cannot be changed once created. |
| **Vendor (partnerName)** | Name of the target supplier. Selected from SUPPLIER type vendors in the vendor master. |
| **Order Date (orderDate)** | Date the PO was issued. Defaults to today (on registration). |
| **Due Date (dueDate)** | Requested delivery date. Used as the basis for on-time delivery rate evaluation in arrival management. |
| **Item Count (itemCount)** | Number of lines in this PO. |
| **Total Amount (totalAmount)** | Sum of (order quantity × unit price) per item. Calculated as 0 if unit prices are not entered. |
| **Status (status)** | Current progress status of the PO (see status flow below). |

### Status Flow

```
DRAFT (Temporary)
    ↓ Confirm
CONFIRMED (Order Confirmed)
    ↓ Partial Receipt
PARTIAL (Partially Received)
    ↓ Full Receipt
RECEIVED (Receipt Complete)
    ↓ Close
CLOSED (Closed)
```

> **Editing and deletion are only possible in DRAFT status.** After CONFIRMED, the status changes automatically during the arrival process.

---

## ② PO Header Input Fields

| Column | Role / Description |
|------|------|
| **PO No. (poNo)** | Auto-generated on registration (`PO-YYYYMMDD-NNN`). Can be edited manually but must not be duplicated. Cannot be changed during editing (locked). |
| **Vendor (partnerName)** | Select the supplier to order from. Only SUPPLIER type vendors appear in the selection list. |
| **Order Date (orderDate)** | PO issue date. Defaults to today. |
| **Due Date (dueDate)** | Requested delivery date. Can be left empty, but entering it is recommended for arrival schedule management. |
| **Remark (remark)** | Memo for the entire PO (special notes, reference contract numbers, etc.). |

---

## ③ Order Item Input Fields

Clicking the Add Item button opens an item search modal. Multiple items can be selected at once (multi-select supported). Already added item codes are not duplicated.

| Column | Role / Description |
|------|------|
| **Item Code (itemCode)** | MES code of the item to order. Auto-filled when selected from the item search modal. |
| **Item Name (itemName)** | Name of the selected item (auto-displayed). |
| **Line Number (lineNo)** | Sequential number for each item row within this PO. Auto-assigned based on addition order by default. |
| **Release Number (revNo)** | Order round for the same item. Used when splitting the same item with different due dates within the same PO. Default is 1. |
| **Order Quantity (orderQty)** | Quantity ordered for this line. Only **integers of 1 or more** are accepted. |
| **Remark (remark)** | Memo for this item line. |

> The unit price (unitPrice) is not directly entered on this screen. Contact an operator if needed. The total amount is auto-calculated when unit price data is available.

---

## Search / Filters

| Filter | Action |
|------|------|
| **Integrated Search** | Enter a PO number or vendor name for case-insensitive partial match search. |
| **Order Date Range** | Set the search period by order date. Defaults to today. |
| **Status** | Displays only POs with the selected status. Empty shows all. |

---

## Usage Procedure

1. Click the **Register** button at the top right to open the PO registration panel.
2. Select a **Vendor** (SUPPLIER type).
3. Enter the **Order Date** and **Due Date**.
4. Click the **Add Item** button to search and select items to order (multi-select supported).
5. Enter the **Order Quantity** for each item (must be an integer of 1 or more).
6. Click the **Register** button to save. The PO number is auto-generated, and the status is DRAFT.
7. Once the order content is final, open the PO in the grid and change the status to **CONFIRMED**.
8. Receiving is processed on the **Arrival Management** screen.

---

## Input Rules / Validation

- **PO No.**: Required. Cannot be duplicated.
- **Vendor**: Required.
- **Order Items**: At least 1 required.
- **Order Quantity**: Must be an integer of 1 or more. Decimal, 0, and negative inputs are blocked.
- **Deletion Condition**: Must be in DRAFT status with no arrival history.

---

## FAQ

- **Q.** I want to specify the PO number manually.
  **A.** You can edit the auto-generated number manually. However, duplicates will block saving.

- **Q.** I want to edit a confirmed PO.
  **A.** POs with CONFIRMED or later status cannot be edited directly on this screen. Ask an operator about reverting to DRAFT.

- **Q.** I can't delete a PO.
  **A.** Deletion is only possible for DRAFT status POs with no arrival history. Deletion is blocked after CONFIRMED or if any arrival has been processed.

- **Q.** The total amount shows as 0.
  **A.** If unit prices are not entered, the total amount is calculated as 0. Unit price registration requires operator setup.

- **Q.** Can I add the same item twice in the same PO?
  **A.** The same item code can only be added once. If you need different due dates or rounds, use separate release numbers or create a separate PO.

---

## Related Screens
- [PO Status](/material/po-status) — View receipt progress per PO
- [Arrival Management](/material/receive) — Receiving and inspection linkage
- [Part Master](/master/part) — Register orderable items
