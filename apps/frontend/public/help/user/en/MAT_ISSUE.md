---
menuCode: MAT_ISSUE
audience: user
title: Material Issuing (Production)
summary: Approve and process production floor material issue requests, or issue immediately via LOT barcode scan — dedicated to production use.
tags: [material, issue, production, barcode scan, issue request]
keywords: [material issuing, production issue, issue request, approve, reject, issue processing, barcode scan, LOT scan, full issue, issue history, cancel issue, PRODUCTION, issue type, ISSUE_TYPE, issue number, request number, work order, stock deduction, MatStock, matUid, material serial]
related: [MAT_REQUEST, MAT_ISSUE_OTHER, MST_PART]
---

# Material Issuing (Production)

## Screen Purpose
Review, approve, and process **material issue requests** from the production floor, or allow warehouse staff to **scan LOT barcodes for immediate full-issue processing**. The issue type is fixed to **Production (PRODUCTION)**, while non-production types (defect, sample, subcontract, scrap, etc.) are handled in [Other Issuing](/material/issue-other).

> Flow: Issue request created (floor) → Approved (warehouse/manager) → Issue processed → Stock deducted (MatStock)

## Screen Layout
The screen is organized into three tabs.

| Tab | Role |
|---|---|
| **Issue Request Processing** | View received issue requests. Perform approve, reject, and issue actions. |
| **Barcode Scan** | Scan LOT barcodes directly for immediate full-quantity issuing. |
| **Issue History** | View all issue history including completed and canceled items, and cancel issuances. |

---

## ① Issue Request Processing Tab

### Statistics Cards

| Card | Description |
|---|---|
| **Requested** | Number of issue requests pending approval. |
| **Approved** | Number of approved requests awaiting issue processing. |
| **Completed** | Number of fully processed issuances. |
| **Rejected** | Number of rejected requests. |

### Request List Columns

| Column | Role / Description |
|---|---|
| **Request Number (requestNo)** | Unique identifier for the issue request. Format: `REQ-YYYYMMDD-NNN`. |
| **Request Date (requestDate)** | Date the issue request was registered. |
| **Work Order (workOrderNo)** | Production work order number linked to this request. Highlighted in blue if the request is work-order-based. |
| **Item Count (itemCount)** | Number of item lines in this request. |
| **Total Quantity (totalQty)** | Sum of quantities across all items in the request. |
| **Issue Type (issueType)** | Issue type. Fixed to **Production (PRODUCTION)** on this screen. |
| **Status (status)** | Current processing status (see status values below). |
| **Requester (requester)** | Person who requested the issue. |
| **Actions (actions)** | Buttons for approve, reject, or issue processing based on status. |

### Issue Request Status Values

| Status Code | Display | Description |
|---|---|---|
| `REQUESTED` | Requested | Issue request received, pending approval. |
| `APPROVED` | Approved | Approved, awaiting issue processing. |
| `COMPLETED` | Completed | All items have been issued. |
| `REJECTED` | Rejected | Request has been rejected. |

### Issue Processing Modal Columns (after approval)

| Column | Role / Description |
|---|---|
| **Item Code (itemCode)** | Code of the item to issue (based on part master). |
| **Item Name (itemName)** | Name of the item to issue. |
| **Requested Qty (requestQty)** | Quantity requested by the floor. |
| **Already Issued (issuedQty)** | Cumulative quantity already issued (partial issue total). |
| **Remaining (remainQty)** | Quantity not yet issued (= requested − already issued). |
| **Issue LOT (matUidSelect)** | Select the material LOT to issue. Displays as `LOT Serial / Warehouse Name / Available Qty` when selected. |
| **Issue Quantity (issueQty)** | Actual quantity to issue. Cannot exceed the remaining quantity. |
| **Unit (unit)** | Unit of quantity (based on part master). |

---

## ② Barcode Scan Tab

Scanning a LOT barcode **immediately issues the full remaining stock** of that LOT. Use when quick issuing is needed without individual quantity adjustment.

### Scan Result Info

| Item | Role / Description |
|---|---|
| **Item Code** | Item code of the scanned LOT. |
| **Item Name** | Item name of the scanned LOT. |
| **Material Serial (matUid)** | Unique serial (LOT identifier) of the scanned LOT. |
| **Current Quantity** | Current stock quantity of the LOT. This quantity is deducted for full issues. |
| **IQC** | Incoming inspection result. HOLD or non-PASS LOTs are blocked from issuing. |
| **Supplier** | Supplier name of the material. |

### Today's Scan Issue History

| Column | Role / Description |
|---|---|
| **Time (issuedAt)** | Time of the scan issue processing. |
| **Item Code** | Code of the issued item. |
| **Item Name** | Name of the issued item. |
| **Material Serial (matUid)** | Serial of the issued LOT. |
| **Issue Quantity (issueQty)** | Quantity issued. |
| **Unit (unit)** | Unit of quantity. |

---

## ③ Issue History Tab

### Filters

| Filter | Role / Description |
|---|---|
| **Issue Date (range)** | Date range for the issue lookup. Defaults to today. |
| **Search (searchText)** | Text search by issue number, item code, item name, or material serial. |
| **Status (statusFilter)** | Filter by completed/canceled. |
| **Issue Type (issueTypeFilter)** | Filter by issue type (common code ISSUE_TYPE). |

### History Columns

| Column | Role / Description |
|---|---|
| **Issue Number (issueNo)** | Unique identifier for the issue transaction. |
| **Issue Date (issueDate)** | Date the issue was processed. |
| **Item Code (itemCode)** | Code of the issued item. |
| **Item Name (itemName)** | Name of the issued item. |
| **Material Serial (matUid)** | Serial of the issued LOT. |
| **Quantity (issueQty)** | Issue quantity, including unit. |
| **Issue Type (issueType)** | Issue type (common code ISSUE_TYPE). |
| **Work Order (jobOrderNo)** | Work order number linked to the issue (if any). |
| **Status (status)** | Completed (DONE) or Canceled (CANCELED). |
| **(Cancel Button)** | Displayed only for DONE status. Clicking cancels the issue after entering a reason. Stock is restored on cancel. |

---

## Usage Procedure

### Issue Request Processing Method
1. Click the **Issue Request Processing** tab.
2. Check the target in the request list. Use status filters or text search as needed.
3. For items with **Requested (REQUESTED)** status, click the check (approve) icon. If rejection is needed, click the X icon and enter a reason.
4. For items with **Approved (APPROVED)** status, click the replay (issue) icon.
5. In the issue processing modal, select the **Issue LOT** for each item, verify (or adjust) the **Issue Quantity**, then click the **Issue** button.
6. When all items are fully issued, the request status changes to **Completed (COMPLETED)**.

### Barcode Scan Method
1. Click the **Barcode Scan** tab.
2. Scan the LOT barcode or manually enter the material serial in the input field and press Enter.
3. Verify the LOT information (item name, current quantity, IQC status, etc.).
4. Click the **Full Issue** button.
5. The processed item is added to the "Today's Scan Issue History" at the bottom, and the input field refocuses for continued scanning.

---

## Input Rules / Validation

- An **Issue LOT must be selected** during issue processing; otherwise, the issue is blocked.
- Issue quantity **cannot exceed the remaining quantity**.
- Barcode scan issuing is only possible for LOTs with **IQC PASS** status and **not on HOLD**.
- LOTs with exhausted stock are rejected during barcode scanning.
- Issue cancelation is only possible for **DONE** status, and a cancel reason is required.
- Issues already processed by downstream operations (production results) cannot be canceled.

---

## FAQ

- **Q.** No items appear in the issue request list.
  **A.** Check if a specific status filter is applied. Try changing to 'All Statuses' or clearing the search term.

- **Q.** The LOT list is empty in the issue processing modal.
  **A.** There is no available stock (IQC passed, available > 0) for that item. Check the receiving status.

- **Q.** I get a "LOT not IQC approved" error when scanning a barcode.
  **A.** That LOT has not passed incoming inspection (IQC). Ask the IQC personnel to complete the inspection.

- **Q.** I can't cancel an issue.
  **A.** If downstream operations (production results) have already been processed, cancellation is blocked. Process in reverse order: production results → FG label → Box/OQC → Pallet → Shipping, then try again.

- **Q.** How do I issue for non-production types (sample, defect, etc.)?
  **A.** Use the [Other Issuing](/material/issue-other) screen.

---

## Related Screens
- [Other Issuing](/material/issue-other) — Non-production type issuing
- [Part Master](/master/part) — Item and unit standards
- [Issue Request Management](/material/request) — Register and view issue requests
