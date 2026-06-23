---
menuCode: INV_MAT_PHYSICAL_INV_APPLY
audience: user
title: Physical Inventory Apply
summary: Review and adjust PDA scan quantities after a physical inventory session, then apply to system stock
tags: [stock, physical, apply, adjustment, quantity]
keywords: [count apply, count qty input, difference review, stock adjustment, PHYSICAL_COUNT, count confirm]
related: [INV_MAT_PHYSICAL_INV, INV_MAT_STOCK, MAT_ADJUSTMENT]
---

# Physical Inventory Apply

## Screen Purpose
Review the counted quantities scanned by PDA after a physical inventory session is completed, directly modify them if necessary, and **apply** them to system stock. This is the final step to reflect count result differences in actual stock quantities.

## Screen Layout
- **Top — 4 Stats Cards**: Summary of total / counted / matching / mismatching items
- **Filter Area**: Base year-month + warehouse selection + search keyword
- **DataGrid List**: Displays system quantity, counted quantity, and difference per item. The **counted qty column is directly editable**.
- **Apply Button**: Enabled when mismatching items exist.

---

## ① DataGrid List Columns

| Column | Role / Description |
|------|------|
| **Warehouse (warehouseName)** | The warehouse where stock is located. |
| **Item Code (itemCode)** | The code of the counted item. |
| **Item Name (itemName)** | The name of the counted item. |
| **Material Serial (matUid)** | LOT/serial number. |
| **System Qty (qty)** | Current system stock quantity. |
| **Counted Qty (countedQty)** | Count quantity scanned by PDA. **Click to edit directly**. |
| **Difference (diffQty)** | Counted qty - system qty. Positive (blue) / Negative (red) / 0 (green). |
| **Count Time (countedAt)** | Timestamp of the last PDA scan. |

---

## Usage Procedure
1. Select the base year-month and warehouse in the top filter to query count results.
2. Compare each item's **counted qty** with the PDA scan results in the list.
3. If needed, **click to edit** the counted qty directly (error correction).
4. Click the **Apply** button and confirm in the confirmation modal.
5. After applying, verify the changed stock quantities in [Material Stock Status].

## Input Rules / Validation
- Counted qty must be an integer **0 or greater**.
- Double-check mismatched items before applying. Reversal is difficult after application.

## Related Screens
- [Physical Inventory Management](/inventory/material-physical-inv) — Start/end count sessions and monitor PDA scans
- [Material Stock Status](/inventory/material-stock) — View applied stock status
