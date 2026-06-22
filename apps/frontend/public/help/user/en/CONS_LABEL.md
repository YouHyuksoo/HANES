---
menuCode: CONS_LABEL
audience: user
title: Consumable Label Issuance
summary: Select a consumable master to issue individual UIDs, print labels with template designs, and preview or reissue PENDING instances.
tags: [consumable, label, issuance, print]
keywords: [consumable label, consumable label issuance, UID, conUid, consumable UID, label issuance, print, barcode, label print, issue quantity, pending, PENDING, instance, reissue, preview, label template, label design, mold, jig, tool]
related: [CONS_MASTER, CONS_RECEIVING]
---

# Consumable Label Issuance

## Screen Purpose
This screen issues a unique **consumable UID (conUid)** for each individual consumable (mold, jig, tool, etc.) to enable **individual instance tracking**, and prints labels (barcodes) containing that UID. Even for the same consumable code, each received item gets its own UID, allowing individual management of receipt, issue, mounting, and replacement.

> UID issuance creates a **PENDING instance**. After printing and attaching the label to the physical item, scan the barcode on the Consumable Receiving screen to confirm receipt. The item becomes usable (ACTIVE) and the stock quantity increases.

## Screen Layout
- **Left (List)**: Grid of consumable masters available for label issuance. Use the top bar for **consumable code/name search**, **category filter**, and **refresh**. Each row has a **selection checkbox** and an **issue quantity** input field.
- **Top Right (Issue Tools)**: **Status message** (issue/print progress), **Refresh**, **Label Template Select**, **Issue UID** button.
- **Right (Detail Panel)**: Clicking a row in the list opens the **PENDING instance list** for that consumable. You can **preview** each instance or **reissue** (reprint) the label.

## Flow from Issuance to Print
```
Select consumable + enter issue quantity
        │
        ▼
Click [Issue UID] → Generate conUids for the quantity (create PENDING instances)
        │
        ▼
Draw label using the selected template, open browser print dialog
        │
        ▼
Attach label to physical consumable → Scan and confirm receipt on Consumable Receiving screen
```

---

## ① List Columns (Left Grid)

| Column | Role / Description |
|------|------|
| **Select (Checkbox)** | Select consumables to issue labels for. The header checkbox enables **select all / deselect all**. At least one item must be selected to activate UID issuance. |
| **Image** | Thumbnail of the consumable photo. Click to enlarge. It is also included on the printed label (depending on template settings). Displays `-` if no image is available. |
| **Consumable Code (consumableCode)** | Unique code of the consumable to issue. All issued UIDs are tied to this code. |
| **Consumable Name (consumableName)** | Name of the consumable. Used for search and label display. |
| **Category (category)** | Classification: Mold (MOLD), Jig (JIG), or Tool (TOOL) (common code CONSUMABLE_CATEGORY). Used as the top category filter criterion. |
| **Current Stock (stockQty)** | Accumulated stock quantity for this consumable master. Increases with each receipt confirmation. |
| **Instances (instanceCount)** | **Total number of UIDs (instances) issued** for this consumable. If the yellow **(Pending: n)** indicator appears beside it, it shows how many are still PENDING (not yet confirmed received). |
| **Issue Quantity (qtyInput)** | Number of UIDs to issue this time (1–99). For example, entering `5` generates 5 conUids. Default is 1. |

## ② Label Issuance Tools (Top Right)

| Item | Role / Description |
|------|------|
| **Status Message** | Shows issuance and print progress in one line (e.g., "{{count}} items issued", red on error). When items are selected and no operation is in progress, displays "{{count}} items selected". |
| **Refresh** | Reloads the list, issue counts, and pending counts to the latest state. |
| **Label Template Select** | Choose the label design for printing. Select **Default Design** or a registered template (consumable/jig category). Each template has different label size, barcode, display items, and print method. |
| **Issue UID** | Generates UIDs for the selected consumable according to the issue quantity and immediately opens the label print dialog. Changes to "Issuing..." during generation and "Printing..." during print preparation. |

## ③ Pending Instance Panel (Right)
Opens when you click a consumable row in the list. Shows only the **PENDING UIDs** for that consumable (excludes already received items).

| Item | Role / Description |
|------|------|
| **Summary (Current Stock / Pending / Location)** | Summarizes the current stock, pending count, and default storage location of the selected consumable at the panel top. |
| **Consumable UID (conUid)** | The issued individual UID. The tracking key printed on the label and barcode. |
| **Status** | Instance status badge. This panel displays **Pending (PENDING)** only (common code CON_STOCK_STATUS). |
| **Usage Count (currentCount / expectedLife)** | Accumulated strokes and expected lifespan. Typically `0` at the pending stage. |
| **Receipt Date (recvDate)** | Date the receipt was confirmed. Empty (`-`) for pending items. |
| **Preview** | View the barcode and layout of that UID label in a modal before printing (does not print). |
| **Reissue** | **Reprints** the label for that UID. Used when a label is damaged or lost. Sent to the label printer (agent). |

## Usage Procedure
1. In the left list, **check** the consumables to issue labels for (use search and category filter to find items quickly).
2. Enter the **issue quantity** for each row (number of individual items).
3. Verify and select the **label template** at the top.
4. Click **Issue UID** to generate UIDs and open the print dialog. Print from the dialog.
5. Attach the printed labels to the physical consumables.
6. (If reprint is needed) Click the consumable in the list and **Preview/Reissue** the UID in the right panel.
7. After attaching labels, scan the barcodes on the **Consumable Receiving** screen to confirm receipt.

## Input Rules / Validation
- **At least one consumable must be selected** to enable the Issue UID button.
- **Issue quantity** must be between 1 and 99 (auto-corrected if outside range).
- Printing opens a **new popup window**. If the browser blocks popups, issuance will stop. Allow popups for this site.
- If there are many issuances or barcode generation is still in progress, preview the label before printing (printing is blocked if barcodes are incomplete).

## FAQ
- **Q.** Does issuing a UID immediately increase stock?
  **A.** No. Issuance only creates a **PENDING instance**. You must attach the label, then scan and confirm receipt on the **Consumable Receiving** screen to change it to ACTIVE and increase current stock.
- **Q.** I lost the label. How do I reprint?
  **A.** Click the consumable in the list, then click **Reissue** for the UID in the right pending panel. It will reprint with the same UID.
- **Q.** The print dialog doesn't appear.
  **A.** This is due to the browser's popup blocker. Allow popups in the address bar and issue again.
- **Q.** I can't enter an issue quantity of 100 or more.
  **A.** Only 1–99 can be issued at a time. For larger quantities, issue in batches.
- **Q.** What does "(Pending: n)" next to an instance mean?
  **A.** It indicates the number of UIDs that have been issued but not yet confirmed received. The label is attached, but the receipt process is still pending.

## Related Screens
- [Consumable Master](/consumables/master) — Register basic info, expected life, and storage location for consumables
- [Consumable Receiving](/consumables/receiving) — Scan issued labels to confirm receipt (PENDING → ACTIVE)
