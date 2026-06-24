---
menuCode: QC_INSPECT
audience: user
title: Visual Inspection
summary: Screen for visually inspecting finished products, determining PASS/FAIL, and recording inspection history
tags: [quality, visual-inspection, VISUAL, pass-fail, FG-label]
keywords: [QC_INSPECT, visual-inspection, VISUAL, FG_BARCODE, PASS, FAIL, VISUAL_DEFECT, pass, fail]
related: [QC_DEFECT_CODE, QC_DEFECT]
---

# Visual Inspection

## Screen Purpose
Visually inspect products that have been completed and issued an FG label, determine PASS or FAIL, and register the results.

## Screen Layout
- **Left — Job Order List**: Lists job orders (completed orders) subject to visual inspection. Searchable by job order number and item code.
- **Right — Visual Inspection Panel**: Displays FG barcode scan, pass/fail judgment, and inspection history for the selected job order.

---

## Usage Sequence
1. Select a job order to inspect from the left list.
2. Scan the product barcode into the FG barcode input field.
3. Verify the scanned product information.
4. Click **PASS** or **FAIL** to make a judgment.
   - On FAIL, you must enter a defect code and detailed reason.
5. The inspection result is immediately reflected in the history grid at the bottom right.

## Input Rules
- Only FG labels with **ISSUED** status can be inspected (already inspected, packed, or shipped products cannot be inspected).
- The scanned barcode must belong to the selected job order.
- On FAIL, a defect code (`VISUAL_DEFECT` group code) and detailed reason must be entered.
- Once inspected, a product cannot be re-inspected.

## Inspection History Columns

| Column | Role / Meaning |
|--------|------|
| **Inspection Time** | The date and time the visual inspection was performed. |
| **Judgment** | PASS (green) or FAIL (red) result. |
| **FG Barcode** | The FG barcode of the inspected product. |
| **Defect Code** | The defect code selected on FAIL. |
| **Detail Reason** | The detailed defect description entered on FAIL. |

## Related Screens
- [Defect Code Management](/quality/defect-code) — Screen for registering defect codes (`VISUAL_DEFECT`) used in visual inspection
- [Defect Management](/quality/defect) — Screen for viewing registered defect records
