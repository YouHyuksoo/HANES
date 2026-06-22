---
menuCode: CONS_ISSUING
audience: user
title: Consumable Issuing
summary: Scan individual UID (conUid) barcodes to issue consumables to the shop floor, cancel (return) issuances, and view issuance and cancellation history.
tags: [consumable, issuing, return]
keywords: [consumable issuing, issue, confirm issue, cancel issue, issue return, return, cancel confirm, barcode scan, conUid, UID, usage location, equipment, line, issuing department, issue reason, stock, mold, jig, tool]
related: [CONS_MASTER, CONS_RECEIVING, CONS_STOCK]
---

# Consumable Issuing

## Screen Purpose
This screen is used to **scan individual UID (conUid) barcodes of received consumables to issue them to the shop floor**, or to **cancel (return) incorrectly issued items**. Processed issuance and cancellation records can be viewed in the history table below using date range and type filters.

> Each consumable receives a unique UID (conUid) upon receipt, enabling **individual tracking**. Issuance is processed per UID, with each scan deducting a quantity of 1 (individual batch issuing).

## Screen Layout
- **Top (Scan Panel)**: Select Issue or Cancel (Return) mode and scan UID barcodes.
- **Bottom (History Table)**: List of issuance and cancellation history. Use the toolbar above for date range, search, and type filters.
- The **Refresh** button at the top right reloads the list.

---

## Issue / Cancel Flow
The same UID moves between states:

```
Received(ACTIVE)  ──[Issue]──▶  Issued(ISSUED)
       ▲                              │
       └──────[Cancel (Return)]────────┘
```

- **Issue**: Only UIDs in Received (ACTIVE) status can be issued. Issuing changes the status to **Issued (ISSUED)** and decreases the master stock quantity by 1.
- **Cancel (Return)**: Only UIDs in Issued (ISSUED) status can be canceled. Canceling restores the status to **Received (ACTIVE)** and restores the stock quantity by 1.

---

## ① Scan Panel

| Item | Role / Description |
|------|------|
| **Issue (Mode Button)** | Mode for processing scanned UIDs as issued. Default mode. |
| **Issue Return (Mode Button)** | Mode for canceling (returning) a scanned UID's issuance. When selected, a "Cancel Mode" guide is displayed. |
| **UID Input Field** | Scan or manually enter the consumable UID barcode. Press Enter or click the confirm button to process. After processing, the field auto-focuses for continuous scanning. |
| **Confirm Issue / Confirm Cancel (Button)** | Label changes based on the current mode: **Confirm Issue** in Issue mode, **Confirm Cancel** in Issue Return mode. Disabled when input is empty. |

## ② Issuance History Table Columns

| Column | Role / Description |
|------|------|
| **Date/Time (createdAt)** | Date and time when the issuance or cancellation was processed. |
| **Consumable Code (consumableCode)** | Master code of the issued consumable. |
| **Consumable Name (consumableName)** | Name of the issued consumable. |
| **UID (conUid)** | Unique UID of the issued individual instance. Identifies which physical item was sent out. |
| **Type (logType)** | **Issue (OUT)** or **Issue Return (OUT_RETURN)**. Issue is displayed with a blue badge, Issue Return with a purple badge. |
| **Quantity (qty)** | Processed quantity. Issue is shown as red `-1`, Cancel (Return) as green `+1` (sign indicates direction). |
| **Line (lineCode)** | Target line for the issue (if recorded). |
| **Equipment (equipCode)** | Target equipment for the issue (if recorded). |
| **Remark (remark)** | Notes entered during issue/cancel or auto-generated messages. |

> Toolbar above the table: **Start Date / End Date** (defaults to today), **Search** (consumable code/name), **Type Filter** (All / Issue / Issue Return). Use the **Export** button at the top right to save the table as a file.

---

## Usage Procedure
1. In the top scan panel, select **Issue** mode (or **Issue Return** to reverse an incorrect issue).
2. **Scan the consumable UID barcode** (or enter it manually) in the UID input field.
3. Press Enter or click the **Confirm Issue / Confirm Cancel** button.
4. Once processed, the input field clears and refocuses so you can immediately scan the next UID.
5. Verify the result in the history table below (use date/type filters to narrow results).

## Input Rules / Validation
- **Issue**: Only UIDs in Received (ACTIVE) status are allowed. Pending (PENDING), already Issued (ISSUED), or Returned (RETURNED) statuses are rejected.
- **Cancel (Issue Return)**: Only UIDs in Issued (ISSUED) status are allowed.
- Scanning a non-existent UID displays a "UID not found" error.
- Each scan processes a quantity of 1. To issue multiple items, scan each UID sequentially.

## FAQ
- **Q.** When I scan, I get a "Only ACTIVE status allowed" error.
  **A.** The UID has not been received yet (PENDING) or has already been issued. Check the receipt status in [Consumable Receiving](/consumables/receiving).
- **Q.** I issued the wrong item. How do I revert it?
  **A.** Switch to **Issue Return** mode at the top, scan the same UID, and click **Confirm Cancel**. It will be restored to Received (ACTIVE) status.
- **Q.** My recently issued item is not showing in the history table.
  **A.** The default search range is today. Check the date range and type filter, then click **Refresh**.
- **Q.** Can I issue a quantity of 2 or more at once?
  **A.** Consumables are tracked and issued per UID. For multiple items, scan each UID individually.

## Related Screens
- [Consumable Master](/consumables/master) — Consumable master data and usage location (equipment) mapping
- [Consumable Receiving](/consumables/receiving) — UID receipt confirmation (ACTIVE transition before issue)
- [Consumable Stock](/consumables/stock) — Current status and stock by UID
