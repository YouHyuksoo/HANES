---
menuCode: INV_MAT_PHYSICAL_INV
audience: user
title: Physical Inventory Management
summary: Start and complete physical inventory sessions and monitor PDA scan progress
tags: [stock, physical, inventory, session, PDA]
keywords: [physical inventory, Physical Inventory, count session, IN_PROGRESS, PDA scan, counted qty, system qty, difference]
related: [INV_MAT_PHYSICAL_INV_APPLY, INV_MAT_STOCK]
---

# Physical Inventory Management

## Screen Purpose
Manage **physical inventory** sessions that compare actual warehouse stock with system stock. Start a session to enable PDA scanning, then review results after session completion.

## Screen Layout
- **Top — Base Year-Month / Warehouse / Search Filter**: Select query criteria.
- **Session Status Display**: Shows the current active physical count session if one exists.
- **DataGrid List**: Displays system quantity / PDA counted quantity / difference per item.
- **Start / End Session Buttons**: Begin or complete a session.

---

## ① DataGrid List Columns

| Column | Role / Description |
|------|------|
| **Warehouse (warehouseName)** | The warehouse where stock is located. |
| **Item Code (itemCode)** | The code of the item being counted. |
| **Item Name (itemName)** | The name of the item being counted. |
| **Material Serial (matUid)** | LOT/serial number. |
| **System Qty (qty)** | System stock quantity at the time the session started. |
| **Counted Qty (countedQty)** | Physical count quantity scanned via PDA. Displayed as `-` if not yet scanned. |
| **Difference (diffQty)** | Counted qty - system qty. **Positive (blue)** = physical count higher, **Negative (red)** = physical count lower, **0 (green)** = match. |
| **Count Time (countedAt)** | Timestamp of the last PDA scan. |
| **Last Count Date (lastCountDate)** | The date this item was last physically counted. |

---

## ② Physical Inventory Session Management

| Action | Description |
|------|------|
| **Start Session** | Select base year-month and warehouse to start a count session. After starting, **all stock changes (receipt, issue, adjustment) are blocked**, and PDA scanning is enabled. |
| **End Session** | End the session once PDA scanning is complete. Stock change blocking is released after ending. |
| **Apply Count** | After ending, review counted quantities and apply them to stock in the [Physical Inventory Apply] screen. |

> ⚠️ Once a physical inventory session is started, all stock transactions including material receipt, issue, adjustment, and LOT split/merge are blocked.

## Usage Procedure
1. Click the **Start Session** button, select base year-month and warehouse to begin a session.
2. Scan items in the warehouse using PDA to enter counted quantities.
3. Refresh the screen to monitor PDA scan progress in real time.
4. When all scans are complete, click **End Session** to close the session.
5. Review and apply the count results to stock in the [Physical Inventory Apply] screen.

## Related Screens
- [Physical Inventory Apply](/inventory/material-physical-inv-apply) — Apply counted quantities to stock
- [Material Stock Status](/inventory/material-stock) — View current stock status
