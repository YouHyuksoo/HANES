---
menuCode: MAT_LOT_SPLIT
audience: user
title: Material LOT Split
summary: Split one received material LOT into two new serials. The original serial is discarded and split result labels are printed.
tags: [material, LOT, split, serial, stock]
keywords: [lot split, LOT split, material split, split quantity, material lot, serial, material serial, matUid, new serial, original discarded, SPLIT, received, current quantity, remaining, label print, trace, origin]
related: [MAT_LOT, MAT_LOT_MERGE, MAT_ARRIVAL, MAT_ISSUE]
---

# Material LOT Split

## Screen Purpose
Split one received material LOT (serial) **into two parts**. Use this when you need to separate only part of the quantity in a serial for a different job, warehouse, or purpose. After splitting, the original serial is discarded (SPLIT) and **two new material serials** — the split quantity piece and the remaining quantity piece — are generated.

> Split = 1 serial → 2 serials. The original does not remain; it is discarded, and both pieces receive new serials and labels.

## Split Flow
```
Received LOT (1 serial, quantity 100)
  → Enter split quantity 30
  → Original serial discarded (SPLIT, stock 0)
  → New serial A (30) + New serial B (70) generated
  → Material labels for both pieces printed
```

## Screen Layout
- **Top Statistics Cards**: Shows total number of splittable LOTs and total quantity.
- **Main Grid (Splittable LOT List)**: Only displays LOTs that are received, have quantity > 1, and are in NORMAL status. Top bar has LOT number and item name search.
- **Split Button (row left)**: Opens the split input modal for that LOT.
- **Split Modal**: Enter the split quantity; a preview showing the two pieces is displayed.
- **Label Preview Modal**: Print labels for the 2 new serials after a successful split.

---

## ① Splittable LOT Grid Columns

| Column | Role / Description |
|------|------|
| **(Action) Split** | Button to open the split modal for that LOT. All rows displayed are splittable since the list only shows received, quantity > 1, NORMAL status LOTs. |
| **Material Serial (matUid)** | Unique identifier (serial) of the material LOT. The original serial that is the target of the split. |
| **Item Code (itemCode)** | MES internal item code of the material. |
| **Item Name (itemName)** | Material item name. |
| **Current Quantity (qty)** | Current stock quantity of this serial, including unit. The split quantity must be less than this value. |
| **Vendor (vendor)** | Name of the vendor that supplied this material. If only a code exists, the code is displayed. |

> List conditions: **Received** (fully processed receipt) + **Current quantity ≥ 2** + **Reserved quantity = 0** + **Status NORMAL**. LOTs with issue history or HOLD status are not shown.

---

## ② Split Modal (opened by clicking the Split button)

Input screen to split the selected LOT into two pieces.

| Input Item | Role / Description |
|------|------|
| **Original Info (top summary)** | Displays the selected material serial, item code, item name, and current quantity (read-only). |
| **Split Quantity \*** | Quantity to separate from the original. Must be **1 or more and less than the current quantity**. The remainder automatically becomes the other piece. |
| **Split Preview** | Shows a preview of how the two pieces will be divided (e.g., `{split qty} + {remainder}`) as you enter the split quantity. |
| **Remark** | Optional split reason or memo (max 200 characters). |

After saving, the original serial is discarded, 2 new serials are created, and the **Label Preview Modal** opens.

---

## ③ Label Preview Modal (after successful split)

Preview and print labels for the 2 newly generated serials.

| Item | Role / Description |
|------|------|
| **Label Preview Area** | Labels for the two new serials are displayed. Each label prints the new material serial, item code, quantity, etc. |
| **Manufacturer Display** | Both pieces inherit and display/print the original LOT's manufacturer. |
| **Print Label (Print Button)** | Sends to the label printer via the local Print Agent. |

---

## Usage Procedure

1. Find the LOT to split using the top search (material serial or item name).
2. Click the **Split** button on the target row.
3. In the modal, enter the **Split Quantity** (less than the current quantity).
4. Verify that the preview shows the intended `split qty + remainder` division.
5. Optionally enter a **Remark** and click **Split**.
6. In the label preview, verify the labels for the 2 new serials and **print them**.
7. Attach the printed labels to each material bundle (discard the original label).

---

## Input Rules / Validation

- Split quantity must be **1 or more and less than the current quantity**. Equal to or greater than the current quantity disables the split button.
- The following LOTs cannot be split (not shown in list or blocked during save):
  - **LOTs not yet fully received** (receipt must be completed first)
  - **LOTs with status other than NORMAL** (HOLD/SPLIT/MERGED/DEPLETED, etc.)
  - **LOTs with reserved quantities** (reservations must be cleared first)
  - **LOTs with issue history** (issues must be cleared first)
  - **Items marked as non-splittable in the part master (isSplittable = N)**
- Splits are irreversible. The original serial is discarded and replaced by 2 new serials.

---

## FAQ

- **Q.** What happens to the original serial after splitting?
  **A.** The original is processed as discarded (SPLIT), its stock becomes 0, and it can no longer be used. The split quantity piece and remaining piece are each issued **new serials**.

- **Q.** Can I split into three or more?
  **A.** One split operation produces two pieces. To split further, split one of the resulting new serials again (re-splitting is allowed).

- **Q.** Is the receipt and inspection history of the split material traceable?
  **A.** Yes. The new pieces inherit the original's arrival number, manufacturer, and origin (original serial) information, allowing backward traceability.

- **Q.** A LOT is not showing in the list.
  **A.** It may be before receipt completion, current quantity is 1 or less, has reservation/issue history, or has a non-NORMAL status. Check the status in [Raw Material LOT Status].

- **Q.** The label won't print.
  **A.** Verify that the Print Agent is running on your PC.

---

## Related Screens
- [Raw Material LOT Status](/material/lot) — Check LOT status and quantity
- [Material LOT Merge](/material/lot-merge) — Combine LOTs of the same item into one
- [Arrival Management](/material/arrival) — Initial material LOT issuance
- [Material Issuing](/material/issue) — LOT-level issuing
