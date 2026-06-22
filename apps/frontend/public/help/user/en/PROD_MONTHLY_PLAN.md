---
menuCode: PROD_MONTHLY_PLAN
audience: user
title: Production Plan
summary: Register monthly (YYYY-MM) production plans for finished and semi-finished products, confirm them, and issue work orders.
tags: [production, production plan, MPS, work order, monthly plan]
keywords: [production plan, monthly production plan, MPS, planned quantity, issued quantity, remaining quantity, issue rate, work order, issue work order, confirm, unconfirm, close, draft, DRAFT, CONFIRMED, CLOSED, auto-schedule, Excel upload, priority, finished product, semi-finished product, FINISHED, SEMI_PRODUCT, plan number]
related: [MST_PART, PROD_JOB_ORDER]
---

# Production Plan

## Screen Purpose
Register and manage plans for **when (which month) and how much** to produce finished and semi-finished products.
Plans are created on a **monthly (YYYY-MM) basis**, with each record representing "produce X units of this item this month." After **confirming** a plan, you can issue **work orders** based on it to direct actual production.

> Production plans are **monthly**, not daily. Multiple plans can exist for the same month and same item, each with its own plan number (PLAN_NO).

## Screen Layout
- **Top — Tool Buttons**: Refresh / Download Template / Excel Upload / ERP Interface / Auto-Schedule / Add Plan
- **Top Filters (above grid)**: Start date / End date (plan month range), search term, item type, status
- **Center — Plan List (Grid)**: Displays registered production plans in rows. DRAFT rows have edit and delete icons on the left.
- **Right — Register/Edit Panel**: Opens as a slide from the right when clicking 'Add Plan' or the edit icon.

## Status Flow
```
DRAFT ──Confirm──▶ CONFIRMED ──Close──▶ CLOSED
                 ◀─Unconfirm─┘
Edit/delete only available in DRAFT / Work orders can only be issued from CONFIRMED
```

---

## ① Plan List Columns

| Column | Role / Description |
|------|------|
| **(Edit/Delete)** | Icons on the left that appear only for **DRAFT** rows. Pencil=open edit panel, Trash=delete. Not shown for confirmed or later statuses (cannot be edited or deleted). |
| **Plan Number (planNo)** | Unique number identifying the plan. Format: `PP-YYYYMM-NNN` (e.g., `PP-202606-001`). Auto-generated on registration and cannot be changed. |
| **Plan Month (planMonth)** | **Target production month** for this plan (`YYYY-MM`). No specific day is set; the specific planned date is specified when issuing work orders. |
| **Actions** | Buttons change based on status. DRAFT shows **Confirm**, CONFIRMED shows **Issue Work Order** and **Unconfirm**. The issue button is disabled when remaining quantity is 0. |
| **Item Type (itemType)** | `FINISHED` or `SEMI_PRODUCT`. Distinguishes what is being produced. |
| **Item Code (partCode)** | Code of the item to produce. Selected from the part master. |
| **Item Name (partName)** | Name linked to the item code (from the part master). |
| **Planned Quantity (planQty)** | **Target quantity** to produce this month. Serves as the upper limit for work order issuance. |
| **Issued Quantity (orderQty)** | **Cumulative quantity issued as work orders** from this plan so far. Increases automatically each time a work order is issued. |
| **Issue Rate (issueRate)** | Displays `Issued Quantity ÷ Planned Quantity` as a bar graph and percentage. 100% means the full planned quantity has been issued, and the bar turns green. |
| **Line (lineCode)** | Default production line for the plan. Inherited as the default when issuing work orders, and can be changed. |
| **Customer (customer)** | Customer linked to this plan (for order response reference, etc.). |
| **Priority (priority)** | Plan processing priority (1–10, default 5). **Lower values are processed first**. The list is sorted by priority in ascending order. |
| **Status (status)** | Plan progress stage: **DRAFT** = editable/deletable, **CONFIRMED** = not editable/deletable, work orders can be issued, **CLOSED** = finished. The header question mark (?) has transition descriptions. |

> The **Start Date / End Date** filters at the top are for the plan month range. Only the **month (first 7 characters)** of the entered date is compared, so any day within the same month includes that month.

---

## ② Register/Edit Panel Input Fields

Input fields in the right panel opened by 'Add Plan' or the edit icon. **In edit mode, plan month, item code, and item type cannot be changed** (locked).

### Basic Info
| Field | Role / Description |
|------|------|
| **Plan Month (planMonth)** | Select the target production month (`YYYY-MM`). Basis for plan number generation. Locked during editing. |
| **Item Type (itemType)** | Select finished or semi-finished. Also used as a filter for item search. Locked during editing. |
| **Item Code (itemCode)** | Use the magnifying glass button to select a production item from the part master. Direct entry is not allowed (search selection only). Required. |
| **Planned Quantity (planQty)** | Target production quantity. Must be **1 or more** to save (0 or less disables the save button). |
| **Priority (priority)** | Value between 1 and 10 (default 5). Lower values are processed first. |

### Details
| Field | Role / Description |
|------|------|
| **Customer (customer)** | Select from the customer list (optional). |
| **Line (lineCode)** | Select a default production line (optional). Used as the default when issuing work orders. |
| **Remark (remark)** | Free-form memo (optional). |

---

## ③ Issue Work Order Input Fields

Modal opened by clicking the **Issue Work Order** button on a **CONFIRMED** plan. The top shows a summary of plan number, item, planned quantity, issued quantity, and **remaining quantity**.

| Field | Role / Description |
|------|------|
| **Issue Quantity (issueQty)** | Quantity to issue as a work order this time. Must be **equal to or less than the remaining quantity (planned − issued)**. Exceeding it shows a warning and blocks issuance. Required. |
| **Plan Date (planDate)** | Specific production date for the work order (optional). Plans are monthly, but work orders have a specific date. |
| **Line (lineCode)** | Line for the work order. Inherits the plan's line as the default and can be changed. |
| **Priority (priority)** | Work order priority (1–10). Inherits the plan value. |
| **Auto-Create BOM Children (autoCreateChildren)** | If checked, automatically creates work orders for **semi-finished (SEMI_PRODUCT)** items in all lower BOM levels. Use when semi-finished items need to be produced together. |
| **Remark (remark)** | Work order memo. If empty, records as `(Issued from plan number)` by default. |

> Issuing creates a work order (status WAITING) and the plan's **issued quantity increases by the issued amount**. When the remaining quantity reaches zero, the issue rate becomes 100%.

---

## ④ Auto-Schedule (MPS) Input Fields

Modal opened by the **Auto-Schedule** button at the top. Creates plans in bulk as DRAFT based on customer orders.

| Item | Role / Description |
|------|------|
| **Target Month (month)** | Month for the plans to create (default = next month). Changing the month auto-sets the delivery period to the 1st to last day of that month. |
| **Delivery Start / End Date** | Delivery date range for the target orders. |
| **Customer (customer)** | Can narrow down to a specific customer's orders (no selection = all). |
| **Preview (preview)** | Displays matching orders in a table. Each row has a checkbox to select only the items to schedule (shows order number, delivery date, item, customer, order quantity). |
| **Execute Scheduling** | Creates production plan DRAFTs from the selected orders. The **existing DRAFTs for that month are deleted and regenerated**, so a confirmation modal appears. |

---

## Usage Procedure
1. Register a plan via **Add Plan** (or Auto-Schedule/Excel Upload) → status **DRAFT**.
2. If correct, click the **Confirm** button in the list to transition to **CONFIRMED** (cannot be edited or deleted afterward).
3. For CONFIRMED plans, click the **Issue Work Order** button to issue work orders within the remaining quantity.
4. The issued quantity and issue rate update with each issuance. Close (CLOSED) plans that no longer need processing.
5. If you confirmed incorrectly, click **Unconfirm** to return to DRAFT, then edit.

## Input Rules / Validation
- Item code is required; planned quantity must be **1 or more** to save.
- Only **DRAFT status** can be edited or deleted (CONFIRMED and CLOSED cannot).
- Work orders are only issued from **CONFIRMED** status and only for quantities **equal to or less than the remaining quantity**.
- Priority must be between 1 and 10.
- Excel Upload requires all rows to pass validation (0 errors) for the upload button to be enabled.

## FAQ
- **Q.** I confirmed the plan but entered the wrong quantity.
  **A.** If no work orders have been issued yet, use **Unconfirm** to revert to DRAFT, edit, then reconfirm.
- **Q.** The issue button is disabled.
  **A.** The remaining quantity (planned − issued) is 0, or the plan is not in CONFIRMED status.
- **Q.** Can I issue work orders from one plan in multiple batches?
  **A.** Yes. As long as the remaining quantity is available, you can issue in multiple batches (the issued quantity accumulates).
- **Q.** Does Auto-Schedule delete existing plans?
  **A.** Only **DRAFT plans for the same month** are replaced. CONFIRMED and CLOSED plans are not affected.

## Related Screens
- [Part Master](/master/part) — Manage target items, BOM, and routing
- [Work Order](/production/job-order) — View and manage work orders issued from this screen
