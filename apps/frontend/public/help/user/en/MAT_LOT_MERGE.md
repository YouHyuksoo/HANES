---
menuCode: MAT_LOT_MERGE
audience: user
title: Material LOT Merge
summary: Scan multiple material LOTs of the same item and arrival using barcodes, and merge them into a single new integrated serial.
tags: [material, LOT, merge, serial, barcode]
keywords: [lot merge, LOT merge, material merge, combine, material lot, serial, matUid, material UID, integrated serial, merge, arrival number, arrivalNo, barcode scan, discard, MERGED, split, lot-split]
related: [MAT_LOT_SPLIT, MAT_ARRIVAL, QC_IQC]
---

# Material LOT Merge

## Screen Purpose
Merge multiple material LOTs (serials) of the **same item and same arrival** into a **single new integrated serial**. Used to consolidate small fragmented LOTs for simpler management and dispensing. After merging, the original LOTs are all discarded (MERGED) and a **new material serial** with the combined quantity is generated, with a label available for printing.

> LOT Merge is the counterpart of LOT Split. Split divides one into many; merge combines many into one.

## Screen Layout
- **Barcode Scan Area (Top)**: Scan or manually enter serials to accumulate for merging. Accumulated serials are displayed as tags, along with selected LOT count, total quantity statistics, and the [Merge Selected] button.
- **Mergeable LOT List (Bottom Grid)**: Shows all currently mergeable LOTs. Use the **＋** button on each row to add it to the scan area. Filter by LOT number or item code using the top search.
- **Merge Confirmation Modal**: Final confirmation of the merge targets and combined quantity.
- **Label Preview Modal**: Preview and print the material label for the new serial after a successful merge.

---

## ① Mergeable LOT List Grid Columns

| Column | Role / Description |
|------|------|
| **(Add)** | **＋** button to add a row to the scan area. Disabled if the serial has already been added. |
| **Material Serial (matUid)** | Unique identifier (label barcode) of the material LOT. The basis for identifying merge targets. |
| **Item Code (itemCode)** | Item code of the material. Merging is only possible between items with the **same item code**. |
| **Item Name (itemName)** | Material item name. |
| **Quantity (qty)** | Current stock quantity of the LOT. These quantities are all summed during merging. |
| **Arrival Number (arrivalNo)** | Arrival number under which the LOT was received. Merging is only allowed for LOTs with the **same arrival number** (to maintain arrival label traceability). |
| **Vendor (vendor)** | Vendor that supplied the LOT. Displayed as name if available, otherwise as code. |

> Only LOTs that satisfy all of the following conditions are displayed: **NORMAL status, has stock, receipt completed, no reservations, no issue history.**

---

## ② Barcode Scan Area

| Item | Role / Description |
|------|------|
| **Scan Input Field** | Scan a material barcode or manually enter a serial and press Enter to accumulate it. Auto-focuses after each scan. |
| **Add Button** | Adds the value in the input field to the accumulation list. |
| **Accumulated Serial Tags** | Shows accumulated serials as tags with quantities. Each tag has a **✕** to remove it individually. |
| **Selected LOTs (Card)** | Number of accumulated serials. |
| **Total Quantity (Card)** | Sum of quantities from accumulated serials. Becomes the quantity of the new serial after merging. |
| **Clear Button** | Clears all accumulated serials. |
| **Merge Selected Button** | Opens the merge confirmation modal. Disabled when fewer than 2 serials are accumulated. |

---

## ③ Merge Confirmation Modal

| Item | Role / Description |
|------|------|
| **LOTs to Merge** | Shows the list of serials to be merged (read-only). |
| **Total Quantity** | Total quantity that will go into the new integrated serial. |
| **Execute Merge Button** | Performs the actual merge. All originals are discarded and a new serial is generated. |

> Once merged, the original LOTs are discarded (MERGED) and a **new single serial** with the combined quantity is created. This action is irreversible, so verify carefully.

---

## ④ Label Preview Modal

After a successful merge, the material label for the new serial opens in preview mode. The label prints the new material UID, item code/name, total quantity, arrival number, manufacturer, etc. Click [Print Label] to send it to the label printer and attach it to the new serial box.

---

## Usage Procedure

1. Find LOTs to merge in the bottom list or filter using the top search.
2. Scan material barcodes or use the **＋** button on each row to accumulate serials (2 or more).
3. Verify the accumulated serials and total quantity on the statistics cards.
4. Click the **Merge Selected** button.
5. Confirm the LOTs and total quantity in the confirmation modal, then click **Execute Merge**.
6. Preview the new serial label and **print the label** to attach to the new box.

---

## Input Rules / Validation

- **2 or more** different serials must be accumulated to merge.
- Only LOTs with the **same item code** can be merged (adding a different item shows an error).
- Only LOTs with the **same arrival number** can be merged. LOTs without an arrival number cannot be merged.
- The following LOTs cannot be merged: HOLD status, non-NORMAL status, zero stock, with reserved quantities, incomplete receipt (needs receipt confirmation), or with issue history.
- Already added serials are not duplicated.

---

## FAQ

- **Q.** I scanned a different item and got an error.
  **A.** Merging is only possible between LOTs with the same item code. A different item from the first added LOT will not be added.

- **Q.** Why can't I merge LOTs with different arrival numbers?
  **A.** The new serial must inherit the arrival number and information of the originals for consistent label and history tracking. Only LOTs from the same arrival are allowed.

- **Q.** What happens to the original serials after merging?
  **A.** All original LOTs are discarded (MERGED) and their stock becomes zero. A single new serial with the combined quantity is generated. Transaction history is retained for traceability.

- **Q.** I merged incorrectly. Can I revert it?
  **A.** There is no revert function for merging. If needed, use [Material LOT Split](/material/lot-split) to divide it again.

- **Q.** A LOT is not showing in the list.
  **A.** LOTs with incomplete receipt, zero stock, reservations, issue history, or HOLD/abnormal status are excluded from the list. First verify receipt confirmation, reservation release, etc.

---

## Related Screens
- [Material LOT Split](/material/lot-split) — Split one LOT into multiple (counterpart of merge)
- [Arrival Management](/material/arrival) — Material arrival and LOT serial issuance
- [IQC (Incoming Inspection)](/quality/iqc) — Incoming inspection of arrived LOTs
