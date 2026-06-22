---
menuCode: PROD_ORDER
audience: user
title: Work Order Management
summary: Issue production orders for finished and semi-finished products, manage statuses (start, hold, complete, cancel), and auto-generate BOM-based semi-finished work orders.
tags: [production, work order, WO, status management, BOM]
keywords: [work order, WO, order number, work order number, start, complete, hold, cancel, result, priority, planned quantity, plan date, BOM, semi-finished, auto-generate, tree view, routing, process, equipment, progress rate, pre-issue]
related: [PROD_RESULT, MST_PART]
---

# Work Order Management

## Screen Purpose
Create **production orders (work orders)** for finished and semi-finished products and manage their production progress status.
One work order is an instruction to "make a specific item, on a specific date (plan date), in a specific quantity (planned quantity)." After creation, it progresses through **Start → Complete**. You can **Hold (pause)** or **Cancel** as needed.

> Work orders are the starting point for production results, inspections, and shipping. Without a work order, no results can be registered for that item.

## Screen Layout
- **Top — Title/Buttons**: Tool view, Refresh, List view/Tree view toggle, Create Work Order.
- **Action Bar**: When a row is selected, the work order's number and status are displayed, and only the available action buttons (Start/Complete/Hold/Unhold/Cancel) for the current status are enabled. The work order sheet print button is also here.
- **List (Grid)**: Work order list. Top has search, status, equipment, process, and plan date filters.
- **Right Slide Panel**: Create/edit input form (opens from the right).

## Status Flow
Work orders have 5 states, transitioning only in a defined order.

```
WAITING ──Start──▶ RUNNING ──Complete──▶ DONE
   │                        │
   │                        └──Hold──┐
   └──Hold───────────────────────────┤
   │                                 ▼
   │                            HOLD ──Unhold──▶ Return to previous status
   │
   └──Cancel──▶ CANCELED   (Cancel also possible from HOLD)
```

| Status | Description |
|------|------|
| **Waiting (WAITING)** | Default status immediately after creation. Work has not started yet. Start, Hold, and Cancel are available. |
| **Running (RUNNING)** | Work has started. Production results are registered during this status. Complete and Hold are available. |
| **Hold (HOLD)** | Temporarily paused. **Result registration and shipping are entirely blocked**. Unhold returns to the previous status (Waiting/Running). |
| **Done (DONE)** | Work is finished. Results are automatically tallied. No further edits or status changes are possible. |
| **Canceled (CANCELED)** | Canceled. Cannot be canceled if even one result record exists. |

---

## ① List Columns

| Column | Role / Description |
|------|------|
| **Actions (Edit/Delete)** | Quick action buttons per row. Pencil=open edit panel, Trash=delete. (Running work orders cannot be deleted.) |
| **Plan Date (planDate)** | **Planned production date** for this work order. The list is queried by plan date range by default; items without a plan date are always shown together. |
| **Priority (priority)** | Work order processing order. **1 is the highest, 10 is the lowest** (default 5). Priorities 1–3 are highlighted (red border), 7–10 are dimmed for quick identification of urgent orders. The list is sorted by priority ascending. |
| **Work Order Number (orderNo)** | Unique number identifying the work order (e.g., `W260519-001`). In tree view, indentation and arrows show parent-child (finished-semi-finished) relationships. |
| **Item Code (partCode)** | Code of the item to produce. |
| **Item Name (partName)** | Name of the item to produce. |
| **Item Type (partType)** | Item type. **FG = Finished**, **WIP = Semi-finished**, distinguished by color badges. |
| **Line (lineCode)** | Production line for the work (optional). |
| **Process (processCode)** | **Representative process** for this work order. Auto-inherited from the first process in the item's routing, or can be specified directly. |
| **Equipment (equipCode)** | Equipment code. Can be left empty at creation and assigned later. |
| **Customer PO (custPoNo)** | Customer purchase order number that this order corresponds to (optional). |
| **Planned Quantity (planQty)** | Quantity planned for production. |
| **Good Quantity (goodQty)** | **Quantity of good units** actually produced. Aggregated from production results. |
| **Progress Rate (progress)** | Ratio of good quantity to planned quantity (%). Displayed as a bar graph. |
| **Status (status)** | Current work order status (Waiting/Running/Hold/Done/Canceled). Displayed as a color badge. |

---

## ② Create/Edit Panel Input Fields

| Item | Role / Description |
|------|------|
| **Work Order Number (orderNo)** | Not entered manually. **Auto-generated on save** (`W + date + sequence`). |
| **Item Name (itemCode)** | Use the magnifying glass button to open an item search modal. Only **finished and semi-finished items** can be selected. Routing info is auto-retrieved upon selection. |
| **Planned Quantity (planQty)** | Quantity to produce. **Required** and must be 1 or more. |
| **Plan Date (planDate)** | Planned production date. **Required**. |
| **Priority (priority)** | Value between 1–10 (default 5). Lower values are processed first. |
| **Customer PO (custPoNo)** | Corresponding customer PO number (optional, e.g., `PO-2026-0001`). |
| **Routing Info** | **Auto-displayed**, not entered. Shows the routing code, name, and process sequence (arrows) for the selected item. If no routing exists, a "No routing registered for this item" message appears. |
| **Line (lineCode)** | Select a work line (optional). |
| **Process (processCode)** | Select a representative process. If not specified, the first routing process is auto-applied. Changing the process resets the equipment selection. |
| **Equipment (equipCode)** | Select from the list of equipment registered for the selected process. Can be left unspecified. If the process has no equipment, a notice is displayed. |
| **Remark (remark)** | Management memo. |
| **Auto-Create BOM Semi-Finished Work Orders (autoCreateChildren)** | Checkbox that appears **only during creation** (default on). If enabled, the finished product BOM is exploded and **semi-finished work orders are automatically created together**. Semi-finished quantities are calculated based on BOM requirements. |

---

## ③ Action Bar Operations

| Button | Available Statuses | Action |
|------|------|------|
| **Print Work Order Sheet** | Any row selected | Prints the work order sheet (A4: top = work order, bottom = material request). |
| **Start** | Waiting (WAITING) | Transitions to Running (RUNNING) and records the start time. |
| **Complete** | Running (RUNNING) | Transitions to Done (DONE) and auto-tallies results. **Finishes even if there is remaining quantity**. |
| **Hold** | Waiting / Running | Transitions to Hold (HOLD). Result registration and shipping are blocked. |
| **Unhold** | Hold (HOLD) | Returns to the status immediately before Hold (Waiting/Running). |
| **Cancel** | Waiting / Hold | Transitions to Canceled (CANCELED). **Cannot be canceled if any results exist**. |
| **Pre-Issue** | (Only in pre-issue mode) | Pre-issues finished product barcodes equal to the work order quantity. |

---

## Usage Procedure
1. Click **[Create Work Order]** to open the right panel.
2. Enter **Item** (magnifying glass), **Planned Quantity**, and **Plan Date** (3 required fields). Optionally specify line, process, equipment, priority, and customer PO.
3. For finished products that also need semi-finished items, keep **BOM Auto-Create** checked and save.
4. Click a work order row in the list to select it, then click the **Start** button to begin work.
5. As production progresses, register results on the [Production Result] screen.
6. When work is complete, click the **Complete** button to finish (results are auto-tallied).

## Input Rules / Validation
- Item, planned quantity, and plan date must all be present to save (planned quantity must be 1 or more).
- Work order numbers are not entered manually; they are auto-generated on save.
- Status can only be changed via action buttons and cannot be skipped (e.g., cannot go directly from Waiting to Done).
- Completed or canceled work orders cannot be edited.
- Running work orders cannot be deleted.
- Cancellation is only possible when there are zero result records.

## FAQ
- **Q.** Can I set the work order number manually?
  **A.** No. It is auto-generated on save in the format `W + YYMMDD + sequence`.
- **Q.** What is created when BOM Auto-Create is enabled?
  **A.** The finished product's BOM is exploded, and **work orders are created for each semi-finished item** (shown as children in tree view). Semi-finished quantities are calculated from BOM requirements.
- **Q.** What's the difference between Hold and Cancel?
  **A.** Hold is a **temporary pause** (can be released later to resume), while Cancel is **final termination** (irreversible).
- **Q.** I clicked Complete, but the planned quantity was not fully met.
  **A.** Completion finishes even if there is remaining quantity. Results up to the time of completion are tallied.
- **Q.** A work order is not showing in the list.
  **A.** Check the plan date filter range at the top. The default is today's date. Wider date ranges show more items.

## Related Screens
- [Production Result](/production/result) — Register results for running work orders
- [Part Master](/master/part) — Register items, BOM, and routing
