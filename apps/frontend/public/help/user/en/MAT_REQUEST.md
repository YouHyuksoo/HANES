---
menuCode: MAT_REQUEST
audience: user
title: Issue Request Management
summary: Request raw material issues based on work orders or manually, and view request status (pending, approved, rejected, completed).
tags: [material, issue request, work order, BOM]
keywords: [issue request, material issue, request number, requestNo, REQUESTED, APPROVED, REJECTED, COMPLETED, pending, approved, rejected, issue complete, work order, BOM requirement, bomReqQty, previously issued, prevIssueQty, floor stock, floorStockQty, current stock, request quantity, production input, prototype, sample, manual issue request]
related: [MAT_ISSUE, MST_PART]
---

# Issue Request Management

## Screen Purpose

Request raw materials needed for a work order from the **warehouse staff**. Required quantities are automatically calculated based on the BOM, reducing the burden of quantity entry. The entire flow from request, approval, and issuing is tracked on one screen.

> Flow: Issue request (REQUESTED) → Approved (APPROVED) → Actual issue (COMPLETED) / Rejected (REJECTED)

The default method links to a work order, but you can also directly search for items and create a **manual issue request** without a work order.

## Screen Layout

- **Top Header**: Screen title + [Manual Issue Request] button.
- **Filter Bar**: Enter work order number, model (item code/name), or work order status to narrow the left list.
- **Left — Work Order List**: Displays existing work orders as cards. Clicking one shows the details on the right.
- **Right — Issue Request Details / New Entry**: Selecting a work order shows existing issue requests grouped by request. Clicking [New Entry] switches to the BOM-based item grid. If no work order is selected, the most recent issue requests are shown by default.

---

## ① Filter Bar Items

| Item | Role / Description |
|------|------|
| **Work Order Number** | Enter a specific work order number to filter the left list. Search triggers 300ms after input. |
| **Model (Item Code/Name)** | Filter by the item code or name of the product linked to the work order. |
| **Work Order Status** | Select a status based on common code `JOB_ORDER_STATUS` (WAITING/RUNNING/HOLD/DONE etc.). Use when you only want to see active work orders. |
| **Reset** | Clears all entered filters. Only shown when at least one filter is entered. |

---

## ② Work Order List (Left) Columns

| Item | Role / Description |
|------|------|
| **Work Order Number (orderNo)** | Work order identifier. Click to select the order and load its details on the right. |
| **Item Name (itemName)** | Name of the product to produce. |
| **Item Code (itemCode)** | Item code of the product (shown below the item name in lowercase). |
| **Planned Quantity (planQty)** | Production target quantity for the work order. Basis for BOM requirement calculation. |
| **Status (status)** | Badge based on common code `JOB_ORDER_STATUS` (e.g., Waiting/Running/Done). |

---

## ③ Issue Request Details (Right — Details Mode)

Selecting a work order displays issue requests linked to that order, grouped by request.

### Request Group Header

| Item | Role / Description |
|------|------|
| **Request Number (requestNo)** | Issue request identifier. Click to open the detail modal. |
| **Status (status)** | Current status badge of the request (see status definitions below). |
| **Request Date (requestDate)** | Date and time the issue request was registered. |
| **Item Count** | Number of items included in this issue request. |
| **Total Requested Qty (totalRequestQty)** | Sum of all requested quantities across items in this request. |
| **Requester (requester)** | Person who requested the issue. |

### Request Group Item Table

| Column | Role / Description |
|------|------|
| **Item Code (itemCode)** | Code of the requested item. |
| **Item Name (itemName)** | Name of the requested item. |
| **Unit (unit)** | Unit of quantity (EA, M, KG, etc.). |
| **Requested Qty (requestQty)** | Quantity requested from the warehouse. |
| **Already Issued (issuedQty)** | Cumulative quantity actually issued for this request. When equal to the requested qty, it is complete. |

---

## ④ New Entry — BOM Item Grid (Right — New Entry Mode)

Clicking the [New Entry] button automatically calculates and displays the raw material requirements based on the work order's BOM.

| Column | Role / Description |
|------|------|
| **Item Code (itemCode)** | Code of the required raw material. |
| **Item Name (itemName)** | Name of the required raw material. |
| **Unit (unit)** | Unit of quantity. |
| **BOM Required (bomReqQty)** | BOM requirement based on the work order's planned quantity (= BOM per-unit requirement × planned quantity). |
| **Previously Issued (prevIssueQty)** | Cumulative quantity already issued for this work order. Subtracting this from BOM Required shows the additional quantity needed. |
| **Floor Stock (floorStockQty)** | Quantity already available on the shop floor (production line). If sufficient, the issue request quantity can be reduced. |
| **Current Stock (currentStock)** | Current warehouse stock quantity. A red warning is shown if the request quantity exceeds current stock. |
| **Requested Qty (requestQty)** | Directly entered issue request quantity. Items with 0 quantity are excluded from the request. |

After entering quantities, select a **[Request Reason]** (Production Input / Prototype / Sample / Other) at the top and click **[Register Request]**.

---

## ⑤ Issue Request Detail Modal

Clicking a request number opens the detail modal.

| Item | Role / Description |
|------|------|
| **Request Number (requestNo)** | Unique issue request identifier. |
| **Work Order (workOrderNo)** | Linked work order number. '-' if none. |
| **Status (status)** | Current request status badge. |
| **Issue Type (issueType)** | Issue type based on common code `ISSUE_TYPE` (e.g., Production Input, Sample, etc.). |
| **Request Date/Time (requestDate)** | Date and time the issue request was registered. |
| **Requester (requester)** | Person who registered the request. |
| **Approver (approver)** | Person who approved the request. '-' if not yet approved. |
| **Approved At (approvedAt)** | Date and time of approval. |
| **Requested Qty / Issued Qty / Remaining Qty** | Aggregated values for the entire request. Remaining = Requested − Issued. |
| **Remark (remark)** | Reason or memo entered during the request. |
| **Reject Reason (rejectReason)** | Reason displayed if the request was rejected. |

### Detail Modal Item Table

| Column | Role / Description |
|------|------|
| **Item Code / Name** | Requested item identification. |
| **Requested (requestQty)** | Requested quantity. |
| **Issued (issuedQty)** | Quantity actually issued. |
| **Remaining** | Quantity not yet issued (= Requested − Issued). |
| **Current Stock (currentStock)** | Warehouse stock quantity at the time of request. |
| **BOM Required (bomReqQty)** | BOM-based requirement quantity. |
| **Previously Issued (prevIssueQty)** | Quantity already issued for this work order previously. |
| **Floor Stock (floorStockQty)** | Quantity available on the shop floor. |
| **Unit (unit)** | Unit of quantity. |

---

## ⑥ Manual Issue Request Modal

Use the [Manual Issue Request] button at the top when raw materials are needed without a work order.

1. **Work Order**: Selecting one auto-fills BOM-based items. Optional.
2. **Request Reason**: Select from Production Input / Prototype / Sample / Other.
3. **Item Search**: Enter item code or name and search. Check current stock of found items, then use [+] to add to the request list.
4. **Enter Request Quantity**: Enter quantity for each item. A warning is shown if current stock is exceeded.
5. Click the **Register Request** button.

---

## Issue Request Status Values

| Status Code | Display | Description |
|------|------|------|
| **REQUESTED** | Pending (yellow) | Issue request registered, awaiting warehouse staff approval. |
| **APPROVED** | Approved (blue) | Approved by the staff, ready for actual issuing. |
| **REJECTED** | Rejected (red) | Request rejected. Check the reject reason and re-request. |
| **COMPLETED** | Completed (green) | Actual issuing completed after approval. |

---

## Usage Procedure (Work Order Based)

1. Enter a work order number or model name in the filter bar to find the target work order.
2. Click the work order in the left list to select it.
3. In the right details mode, check for existing requests.
4. Click [New Entry] to switch to the BOM-based item grid.
5. Refer to BOM Required, Previously Issued, Floor Stock, and Current Stock for each item, then enter the request quantity.
6. Select a request reason and click [Register Request].
7. Check the registered request and its status in the right details mode.

> Items with a request quantity of 0 are automatically excluded. At least 1 item must have a quantity of 1 or more to register.

---

## Input Rules

- Request quantity must be a positive integer (1 or more).
- In the manual issue request modal, all items must have a quantity entered to register (items with 0 are not allowed).
- In the BOM new entry mode, items with quantity 0 are excluded from registration.
- Requesting a quantity exceeding current stock is allowed (with a warning), but not blocked.

---

## FAQ

- **Q.** BOM-based quantities are showing as 0.
  **A.** Either no BOM is registered in the part master, or the work order's planned quantity is 0. Manually enter the quantity or check the BOM.

- **Q.** Can I request more than the current stock?
  **A.** A warning is shown, but registration is allowed. Actual issuing is limited to available warehouse stock.

- **Q.** My issue request was rejected.
  **A.** Check the reject reason in the detail modal. Resolve the issue and create a new request.

- **Q.** The status is APPROVED but stock hasn't changed.
  **A.** Approval only permits the issue request. Actual stock changes occur after issuing is processed on the Material Issuing screen.

- **Q.** Non-raw material items are not found in the manual issue request search.
  **A.** The item search in issue requests only targets raw material (RAW_MATERIAL) items.

---

## Related Screens

- [Material Issuing](/material/issue) — Actual issue processing based on approved requests
- [Part Master](/master/part) — Item code/name and BOM standards
