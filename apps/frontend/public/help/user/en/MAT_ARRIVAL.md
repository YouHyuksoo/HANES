---
menuCode: MAT_ARRIVAL
audience: user
title: Arrival Management
summary: Register material arrivals by PO line, issue material LOT serials, and print labels.
tags: [material, arrival, PO, LOT, serial, label]
keywords: [arrival, purchase order, PO number, line number, remaining quantity, arrival quantity, manufacturer, warehouse, serial, LOT, material UID, matUid, arrival number, arrivalNo, manual arrival, label print, IQC, inspection, delivery, vendor]
related: [PUR_PO, QC_IQC, MAT_ARRIVAL_RESULT, MAT_ARRIVAL_TRANSACTION, INV_ARRIVAL_STOCK]
---

# Arrival Management

## Screen Purpose
Register the **arrival** of items ordered via PO when they are actually delivered. Recording the arrival quantity per line automatically generates material LOT serials, allowing LOT labels to be printed and attached on site. Arrived materials transition to the incoming inspection (IQC) pending status.

> Arrival = delivery confirmation step. Receiving (stock update) is a separate process after IQC approval.

## Flow
```
PO confirmed → Arrival Management (this screen) confirms delivery
  → Material LOT serials auto-issued + label printed
  → IQC incoming inspection pending (PENDING)
  → IQC passed → arrival stock → receipt (material current stock)
```

## Screen Layout
- **Main Grid (PO Line List)**: Displays all PO lines available for arrival. Top bar has status filter, item code, and PO number search.
- **Material Arrival Button (cell or row click)**: Opens the arrival registration modal for that line.
- **Manual Arrival Button (top right)**: Register arrival without a PO by directly specifying item/quantity.
- **Label Template Select (top right)**: Pre-select the template for label printing.

---

## ① PO Line Grid Columns

| Column | Role / Description |
|------|------|
| **(Action)** | **Material Arrival** button. Disabled when remaining quantity is 0 or status is CLOSE. |
| **PO Number (poNo)** | Purchase order number. Only PO with CONFIRMED status from PO Management are displayed. |
| **L/N (lineNo)** | PO line number. Distinguishes each item when a single PO has multiple items. |
| **R/N (revNo)** | Line revision number. Distinguishes revision history of the same line. |
| **Item Code (itemCode)** | MES internal item code of the material. |
| **Item Name (itemName)** | Material item name. |
| **Order Quantity (orderQty)** | Total ordered quantity on the PO. |
| **Cumulative Arrival (receivedQty)** | Sum of all arrival quantities registered for this line so far. |
| **Remaining (remainingQty)** | Quantity not yet arrived (order quantity − cumulative arrival). Displayed in bold blue. |
| **Order Date (orderDate)** | Date the PO was created. |
| **Vendor (partnerName)** | Name of the supplying vendor. |
| **Use Type (useType)** | Purpose classification of the PO (e.g., PROD for production, non-production, etc.). Based on common code `PO_USE_TYPE`. |
| **Status (lineStatus)** | Line arrival progress status: `OPEN` (not arrived) / `PARTIAL` (partially arrived, yellow background) / `CLOSE` (completed, gray background/disabled). |

> Row background colors: white = not arrived, yellow = partially arrived, blue = remaining 0 (before CLOSE), gray = CLOSE (arrival complete).

---

## ② Arrival Registration Modal (opened by clicking Material Arrival)

Enter arrival information for the selected PO line.

| Input Item | Role / Description |
|------|------|
| **PO Info (top summary)** | Displays selected PO number / L number / R number with item code, name, and vendor (read-only). |
| **Cumulative Arrival / Order Qty / Remaining** | Summarizes current arrival status (read-only). Remaining is the maximum possible arrival quantity. |
| **Arrival Quantity \*** | Actual quantity delivered this time. Cannot exceed the remaining quantity. |
| **Arrival Date \*** | Date the material actually arrived. Defaults to today; future dates cannot be entered. |
| **Manufacturer \*** | Company that actually manufactured the material. Selected from `PARTNER_MASTERS` with MFG type. Printed on the label. |
| **Warehouse \*** | Raw material warehouse where the arrived material will be stored. Only RAW type warehouses can be selected. |
| **Serial Unit Quantity (lotUnitQty)** | LOT composition quantity registered in the part master (quantity per serial). Read-only. Displays "1 LOT" if not set. |
| **Estimated Serial Count** | Automatically calculated as arrival quantity ÷ serial unit quantity. Shows the number of serials to be issued. Informational only, cannot be edited. |
| **Remark** | Optional arrival memo. |

After saving, the **serial issuance final confirmation modal** appears. Confirming registers it on the server and opens the **label preview modal**.

---

## ③ Label Preview Modal (after successful arrival registration)

Preview the issued material LOT serial labels.

| Item | Role / Description |
|------|------|
| **Label Template Select** | Choose the label design for printing. The template pre-selected at the top right is applied by default. |
| **Label Preview Area** | Lists labels equal to the number of issued serials. Each label prints material UID, item code, item name, quantity, manufacturer, arrival number, arrival date, etc. |
| **Print Label (Print Button)** | Sends to the label printer via the local Print Agent. |

---

## ④ Manual Arrival Modal (Arrival without PO)

Used for exceptions such as urgent deliveries without a PO or stock adjustments.

| Input Item | Role / Description |
|------|------|
| **Item Code \*** | Search and select the material to be arrived. |
| **Warehouse \*** | Warehouse to store the arrived material. |
| **Quantity \*** | Arrival quantity. |
| **Supplier UID (supUid)** | Material serial number assigned by the supplier (optional). |
| **Manufacture Date (manufactureDate)** | Material production date (optional). |
| **Vendor (vendor)** | Supplying vendor (optional). Selected from `SUPPLIER` type vendors. |
| **Remark** | Arrival reason or memo (optional). |

---

## Usage Procedure

**PO-Based Arrival (Standard)**
1. Use the top search to find the desired line by item code or PO number.
2. Verify that `OPEN` / `PARTIAL` is checked in the status filter.
3. Click the **Material Arrival** button on the target line.
4. Enter arrival quantity, arrival date, manufacturer, and warehouse, then click **Save**.
5. Verify the estimated serial count and click **Confirm**.
6. Check the label content in the label preview and **print the label**.
7. Attach the printed label to the material box.

**Urgent Arrival Without PO**
1. Click the **Manual Arrival** button at the top right.
2. Enter required fields (item, warehouse, quantity) and click **Register**.

---

## Input Rules / Validation

- Arrival quantity must be at least 1 and cannot exceed the remaining quantity.
- Arrival date must be today or earlier (past dates including today are allowed).
- Manufacturer and warehouse are required.
- Lines with CLOSE status or 0 remaining have the **Material Arrival** button disabled.

---

## FAQ

- **Q.** There's a line with 0 remaining but not CLOSE.
  **A.** The PO has not been CLOSE-processed even though the remaining is 0. The Material Arrival button is disabled, so no further arrival is possible.

- **Q.** The serial unit quantity is empty (1 LOT).
  **A.** The LOT unit quantity (lotUnitQty) is not set in the part master. In this case, the entire arrival quantity is issued as a single serial.

- **Q.** Where do I perform IQC inspection after arrival?
  **A.** After completing registration in Arrival Management, proceed with inspection per LOT on the [IQC (Incoming Inspection)] screen.

- **Q.** I registered an incorrect arrival. Can I cancel it?
  **A.** If you have operator permissions, you can cancel DONE-status arrival records on the [Arrival History / Stock Ledger] screen. Cancellation is processed via reverse entry, not deletion.

- **Q.** The label won't print.
  **A.** Verify that the Print Agent is running on your PC. If the Agent is unavailable, you can manually save and print labels from the preview screen.

---

## Related Screens
- [PO Management](/purchase/po) — PO registration and CONFIRMED processing
- [IQC (Incoming Inspection)](/quality/iqc) — Incoming inspection of arrived LOTs
- [Arrival Result / Stock Ledger](/material/arrival-result) — Arrival history and cancellation
- [Arrival Stock](/material/arrival-stock) — Arrival stock status pending IQC
