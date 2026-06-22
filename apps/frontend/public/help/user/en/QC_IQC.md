---
menuCode: QC_IQC
audience: user
title: Incoming Inspection (IQC)
summary: Inspect the quality of arrived materials and judge pass/fail. View the inspection pending list by arrival number + item, and judge inspection items per serial.
tags: [quality, IQC, incoming inspection, material]
keywords: [incoming inspection, inspection pending, inspection result, pass, fail, PASS, FAIL, PENDING, IQC_IN_PROGRESS, PASSED, FAILED, arrival number, serial, scan, inspection item, measured value, LSL, USL, AQL, default sample size, inspection certificate, defect code, destructive test, full inspection, judgment, Major, Minor, Critical, inspection type, FULL, SKIP]
related: [QC_AQL, MST_PART]
---

# Incoming Inspection (IQC)

## Screen Purpose
Inspect the quality of arrived material LOTs and judge **PASS or FAIL**.
Items with `IQC Required = Y` in the part master enter the inspection pending (PENDING) status after arrival and must be inspected on this screen before proceeding to receipt processing.

> Inspection targets are grouped and displayed by arrival number + item. If one arrival contains the same item across multiple serials, it is aggregated into one row.

## Screen Layout
- **Top Filter Bar**: Search term (arrival number, item code, item name), inspection type (FULL/SKIP) filter, inspection status filter.
- **List Grid**: Displays inspection pending, in-progress, and completed items in a table. Each row has an **Inspect** button.
- **Inspection Modal**: Opens when clicking the Inspect button on a row. Serial scan → per-item measurement/judgment → result registration.

---

## ① List Grid Columns

| Column | Role / Description |
|------|------|
| **Inspect (Button)** | Opens the inspection modal for the selected arrival. Only active for items with `Pending` or `In Progress` inspection status. |
| **Arrival Number (arrivalNo)** | Number identifying the arrival. Tracks which arrival the item belongs to. |
| **Arrival Date (arrivalDate)** | Date the material arrived. |
| **Supplier (supplierName)** | Name of the vendor that supplied the material. |
| **Item Code (itemCode)** | MES internal code of the item under inspection. |
| **Item Name (itemName)** | Name of the item under inspection. |
| **Inspection Type (inspectMethod)** | Inspection method set in the part master. `Inspect (FULL)` = formal incoming inspection, `Skip (SKIP)` = inspection skipped. |
| **Serial Count (serialCount)** | Number of material serials (LOTs) in this arrival. Indicates how many need to be scanned. |
| **Total Quantity (totalQty)** | Sum of quantities across all serials (including unit). |
| **Status (status)** | Inspection progress status. See status values below. |
| **Inspector (inspector)** | Name of the person who performed the inspection. Displayed after inspection is complete. |

### Inspection Status Values

| Status Code | Display | Description |
|------|------|------|
| `PENDING` | Pending | After arrival completion, before inspection. Inspection can be started from this status. |
| `IQC_IN_PROGRESS` | In Progress | Inspection has started but is not yet complete. The Inspect button is enabled. |
| `PASSED` | Passed | Inspection judgment result: passed. Proceeds to receipt processing. |
| `FAILED` | Failed | Inspection judgment result: failed. Serials are auto-moved to the scrap warehouse. |

---

## ② Inspection Modal — Arrival Info Display

The top of the modal shows fixed basic information about the arrival.

| Item | Role / Description |
|------|------|
| **Arrival Number** | Number of the arrival currently being inspected. |
| **Supplier** | Vendor name. |
| **Serial Count** | Total number of serials in this arrival. |
| **Total Quantity** | Sum of quantities across all serials. |
| **Item** | Item name and item code of the inspection target. |

---

## ③ Inspection Modal — Left Input Panel

| Item | Role / Description |
|------|------|
| **Serial Scan (Input)** | Scan the serial barcode to inspect or enter it manually and press Enter. Serials not in the pending list show an error message. Use the **View Pending Serials** button to check the pending list, and click individually or **Add All** for batch registration. |
| **Scan Progress Counter** | Displays progress in `Scanned / Total Pending` format. |
| **Inspector** | Enter the name of the person performing the inspection. |
| **Remark** | Enter inspection-related notes. |
| **Default Sample Size** | The default sample quantity registered in the part master. The inspector can modify it. |
| **AQL Sample Quantity** | Recommended sample quantity auto-calculated based on the AQL policy linked to the item. The inspection level and mode (e.g., `Normal II`) are also displayed. Pre-check the per-item Ac/Re (accept/reject counts). |
| **Inspection Certificate** | Attach PDF, image, or Excel files. Saved to the server after result registration. |
| **Defect Code** | Enter the defect type (common code `DEFECT_TYPE`) and quantity when a FAIL judgment occurs. Use the Add Row button to register multiple defect types simultaneously. Cannot be entered if there is no FAIL. |
| **Destructive / Full Inspection** | Displayed when the item has destructive (DESTRUCTIVE) or full (FULL) inspection items registered. For each item, directly enter the **Inspection Quantity** and **Defect Count**. If the defect count is 1 or more, the item is processed as FAIL. |

---

## ④ Inspection Modal — Center Panel (Scanned Serial List)

Scanned or added serials are listed in order.

| Item | Role / Description |
|------|------|
| **Sequence** | Scan sequence number. |
| **Serial (matUid)** | Unique identifier (serial) of the material LOT. |
| **Judgment Status** | Current judgment result for this serial. PASS/FAIL is displayed when all inspection items are judged; `Pending` is shown if incomplete. |
| **Remove Button** | Removes an incorrectly scanned serial from the list. |

---

## ⑤ Inspection Modal — Right Measurement Panel

Select a serial in the Serial List to display that serial's inspection item table on the right.

| Column | Role / Description |
|------|------|
| **#** | Inspection item sequence number. |
| **Inspection Item** | Name of the item to inspect. Defect grade (Critical/Major/Minor) badges and AQL values may be displayed. |
| **Spec (spec)** | Specification description for the item. |
| **LSL (Lower Spec Limit)** | Lower acceptable limit for measured values. If the entered value is below this, FAIL is automatically applied. |
| **USL (Upper Spec Limit)** | Upper acceptable limit for measured values. If the entered value exceeds this, FAIL is automatically applied. |
| **Judgment Criteria** | Describes the acceptance criteria in text for visual inspections and other non-numeric checks. |
| **Measured Value** | For items with LSL/USL, enter the numeric value directly. If within range, PASS is auto-judged. For visual items without LSL/USL, select PASS/FAIL directly with buttons. |
| **Judgment** | PASS (✓) / FAIL (✗) icon based on measurement/input results. |

> **Items without inspection items**: If no IQC inspection items are registered for the item, select PASS/FAIL manually per serial.

---

## Usage Procedure

1. In the list, find the arrival row to inspect and click the **Inspect** button.
2. In the modal, scan or manually enter material serials in the left scan field and press Enter (or use **View Pending Serials → Add All**).
3. Select a serial in the center panel to display the inspection item table on the right.
4. Enter measured values or select PASS/FAIL for each item. Items with LSL/USL are auto-judged.
5. For destructive/full inspection items, enter the inspection quantity and defect count in the lower left panel.
6. If a FAIL judgment occurs, select a **Defect Code** and enter the quantity (required).
7. If needed, attach an **Inspection Certificate** file.
8. Click the **Register Inspection Result** button at the bottom of the modal to save the results.

---

## Input Rules / Validation

- Serials that have not been scanned (not yet inspected) cannot be registered without a judgment.
- If any scanned serial has an incomplete judgment, the register button is disabled.
- If a FAIL judgment (serial or destructive test) occurs, **at least one defect code must be entered**.
- If there is no FAIL, entering a defect code blocks registration.
- If a scanned serial number is not in the pending list, an error message is displayed and it is not registered.

---

## FAQ

- **Q.** The Inspect button is disabled.
  **A.** The arrival's status is already `PASSED` or `FAILED` (judgment complete). Contact an operator if you need to cancel the judgment.
- **Q.** The AQL sample quantity is not displayed.
  **A.** No AQL policy is linked to this item. Set an AQL policy in the part master.
- **Q.** I get a "Not a pending serial" error when scanning.
  **A.** The scanned serial is not in PENDING status or belongs to a different arrival. Use **View Pending Serials** to check the correct list.
- **Q.** The stock disappeared after a FAIL judgment.
  **A.** IQC-failed serials are automatically moved to the scrap warehouse. Ask an operator to cancel if a re-inspection is needed.
- **Q.** How do I judge when there are no inspection items?
  **A.** If no IQC inspection items are registered for the item, click the PASS/FAIL buttons directly per serial in the right area of the modal.
- **Q.** Can I proceed with only destructive test items and no serial scans?
  **A.** Yes. If there are no AQL serial inspection items and only destructive/full test items, enter only the destructive test quantities and register the result without scanning serials.

---

## Related Screens
- [AQL Standards](/quality/aql) — Register sample size, Accept (Ac), and Reject (Re) criteria
- [Part Master](/master/part) — Set IQC requirements and AQL policies for items
