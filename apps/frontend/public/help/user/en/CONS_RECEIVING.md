---
menuCode: CONS_RECEIVING
audience: user
title: Consumable Receiving
summary: Process consumable receipt and return via barcode scan or manual entry, and view receipt history and pending receipt lists.
tags: [consumable, receiving, stock transaction]
keywords: [consumable receiving, receipt, return, return receipt, receipt return, quantity, stock, barcode, scan, UID, conUid, pending, waiting list, supplier, unit price, receipt type, new, replacement, storage location]
related: [CONS_MASTER, CONS_LABEL, CONS_STOCK]
---

# Consumable Receiving

## Screen Purpose
This screen **confirms consumables into warehouse stock**. Scan consumable UID barcodes issued via label issuance to receive items one by one, or manually receive by quantity without a UID. Once processed, the consumable master's stock increases and a receipt history is recorded.

> There are two receipt methods: **① Barcode Scan Receiving** scans individual UIDs pre-issued from [Consumable Label Issuance](/consumables/label) for confirmation, and **② Manual Receiving** increases stock by consumable and quantity without a UID.

## Screen Layout
- **Top (Barcode Scan Panel)**: Toggle between Receive and Return modes and scan UID barcodes. In Receive mode, the **Pending List** of unreceived items is also shown.
- **Bottom (Receipt History)**: Grid of receipt and return history. Use the toolbar above to filter by **date range**, **search term**, and **type filter**.
- **Right (Slide Panel)**: Manual receiving form opened by clicking the **Register Receipt** button at the top.

---

## ① Barcode Scan Panel

| Item | Role / Description |
|------|------|
| **Receive / Return Mode** | Toggle on the left to select the processing type. **Receive** confirms PENDING UIDs, **Return (Return Receipt)** reverses already received UIDs and deducts stock. |
| **UID Barcode Input** | Scan (or type and press Enter) a consumable UID barcode for immediate processing. After scanning, the input field auto-clears for the next scan. |
| **Storage Location (Receive Mode)** | Select the storage location for the received consumable (optional). Recorded as the UID's storage location upon receipt confirmation. |
| **Return Reason (Return Mode)** | Enter the reason for return (optional). Stored as the reason in the return history. |
| **Confirm Receive / Confirm Return Button** | Processes the entered UID. If a barcode scanner sends Enter, it auto-processes without clicking the button. |

### Pending List (Receive Mode Only)
Shows UIDs that have been labeled but not yet received (pending).

| Column | Role / Description |
|------|------|
| **UID (conUid)** | Individual identifier of the consumable awaiting receipt. |
| **Consumable Code (consumableCode)** | Consumable code for this UID. |
| **Consumable Name (consumableName)** | Consumable name. |
| **Category (category)** | Classification: Mold, Jig, Tool, etc. |
| **Label Printed At (labelPrintedAt)** | Time when the UID label was issued. |
| **Vendor Name (vendorName)** | Supplier entered at label issuance. |

## ② Receipt History Grid

| Column | Role / Description |
|------|------|
| **Date/Time (createdAt)** | Date and time when the receipt or return was processed. |
| **Consumable Code (consumableCode)** | Code of the received consumable. |
| **Consumable Name (consumableName)** | Consumable name. |
| **UID (conUid)** | Individual UID for barcode scan receipts. Manual receipts show `-` (no UID). |
| **Type (logType)** | **Receive (IN)** or **Receive Return (IN_RETURN)**. Differentiated by color badges. |
| **Quantity (qty)** | Receipt/return quantity. Receive is shown as `+`, Return as `-`. |
| **Vendor Code (vendorCode)** | Supplier code. |
| **Vendor Name (vendorName)** | Supplier name. |
| **Unit Price (unitPrice)** | Receipt unit price (KRW). |
| **Receipt Type (incomingType)** | **New (NEW)** or **Replacement (REPLACEMENT)**. |
| **Remark (remark)** | Notes left during receipt/return. |

### Toolbar Filters
| Item | Role / Description |
|------|------|
| **Start Date / End Date** | Date range for receipt history lookup. |
| **Search Term** | Search by consumable code or name. |
| **Type Filter** | Select type to display: All / Receive / Receive Return. |

## ③ Manual Receiving Form (Right Panel)
Opened by clicking the **Register Receipt** button at the top. Increases stock by consumable and quantity without a UID.

| Item | Role / Description |
|------|------|
| **Consumable** | Search and select a consumable using the magnifying glass button. Required. |
| **Quantity (qty)** | Quantity to receive. Stock increases by this amount (default 1). |
| **Receipt Type (incomingType)** | Select **New** or **Replacement**. |
| **Vendor Code / Vendor Name** | Supplier information for the received consumable. |
| **Unit Price (unitPrice)** | Receipt unit price per consumable (optional). |
| **Remark (remark)** | Receipt memo (optional). |

## Usage Procedure
1. **Barcode Scan Receiving**: Verify **Receive** mode at the top → (if needed) select storage location → scan UID barcode → immediate receipt confirmation. Check the Pending List for target UIDs.
2. **Return Receiving**: Switch to **Return** mode → (if needed) enter a return reason → scan a received UID → confirm return (stock deducted).
3. **Manual Receiving**: Click **Register Receipt** at the top → search and select a consumable → enter quantity, receipt type, vendor, and unit price → click **Register**.
4. Verify results in the **Receipt History** grid below.

## Input Rules / Validation
- Manual receiving requires **selecting a consumable** to enable the register button.
- Scan receiving can only confirm **PENDING (awaiting) UIDs**. Scanning an already received UID will cause an error.
- Return receiving can only process **currently received (active) UIDs**.

## FAQ
- **Q.** There are no UIDs in the Pending List.
  **A.** You must first issue UIDs from [Consumable Label Issuance](/consumables/label). They will appear in the Pending List once issued.
- **Q.** When I scan, I get "Already received" error.
  **A.** That UID has already been confirmed as received. Check the receipt history.
- **Q.** What is the difference between manual and scan receiving?
  **A.** Scan receiving processes individual UIDs for tracking, while manual receiving increases stock by quantity without UIDs. Both increase the available stock.
- **Q.** How does the receipt quantity affect stock?
  **A.** Receive (IN) increases the consumable's stock, while Return (IN_RETURN) decreases it.

## Related Screens
- [Consumable Label Issuance](/consumables/label) — Issue UID (barcode) before receiving
- [Consumable Master](/consumables/master) — Standard data for received consumables
- [Consumable Stock](/consumables/stock) — Stock status after receiving
