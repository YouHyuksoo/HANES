---
menuCode: MAT_HOLD
audience: user
title: Material Stock Hold Management
summary: Place material LOTs on hold (suspend usage) or release hold
tags: [material, hold, LOT, suspend, block]
keywords: [stock hold, HOLD, LOT hold, material block, quality hold, MAT_LOTS, suspend, hold release]
related: [INV_MAT_STOCK]
---

# Material Stock Hold Management

## Screen Purpose
Manage **stock hold (suspend usage)** or **hold release** per material LOT (serial). Used when specific LOTs need to be temporarily suspended due to quality issues or other reasons. Held LOTs cannot be used for issue or production.

## Screen Layout
- **Top — 3 Stats Cards**: Total LOTs / On Hold / Normal
- **Filter Area**: Search keyword + LOT status (All / Normal / Hold) selection
- **DataGrid List**: Displays LOT status with hold/release action buttons
- **Modal**: Enter reason when holding or releasing

---

## ① DataGrid List Columns

| Column | Role / Description |
|------|------|
| **LOT No. (matUid)** | The material LOT/serial number to be held. |
| **Item Code (itemCode)** | Item code for the LOT. |
| **Item Name (itemName)** | Item name for the LOT. |
| **Current Qty (qty)** | Current quantity of the LOT. |
| **Vendor (vendor)** | The supplier who supplied the LOT. |
| **Status (status)** | Current LOT status. **HOLD** (red) = suspended, **NORMAL** (green) = normal. |

---

## Usage Procedure
1. **Hold**: Click the 🔒 (lock) icon on the LOT to hold. Enter the reason in the modal and confirm. The LOT status changes to `HOLD` and issue/usage is blocked.
2. **Release Hold**: Click the 🔓 (unlock) icon on a held LOT. Enter the reason in the modal and confirm. The LOT status is restored to `NORMAL`.
3. Use the status filter to view only **On Hold** LOTs.

## Related Screens
- [Material Stock Status](/inventory/material-stock) — View stock status of held LOTs
