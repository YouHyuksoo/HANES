---
menuCode: EQUIP_DAILY
audience: user
title: Daily Inspection
summary: A screen for registering and managing daily equipment inspection results, where PASS/FAIL judgments are entered for each inspection item per equipment
tags: [equipment, inspection, daily, DAILY, result, management]
keywords: [EQUIP_DAILY, daily-inspection, equipment-inspection, inspection-result, PASS, FAIL, judgment-type, measurement-type, VISUAL, MEASURE]
related: [EQUIP_INSPECT_CALENDAR, EQUIP_INSPECT_ITEM]
---

# Daily Inspection

## Screen Purpose
Register and manage the results of daily equipment inspections (DAILY) performed before and after work each day. Select a target equipment from the left equipment list, and judge each inspection item as PASS/FAIL in the right panel to save.

## Screen Layout
- **Left — Equipment List (EquipListPanel)**: Displays today's inspection target equipment list grouped by equipment type. Provides search filters and status filters (Not Inspected / Completed OK / Completed NG).
- **Right — Inspection Entry (InspectEntryPanel)**: Displays the inspection item list and judgment input form for the selected equipment.

---

## ① Left Equipment List Columns

| Item | Role / Meaning |
|------|------|
| **Equipment Code** | Unique identification code for each equipment. |
| **Equipment Name** | Name of the equipment. |
| **Inspector** | Name of the worker who performed the inspection for the equipment. |
| **Result** | Overall inspection result (Not Inspected / Pass / Fail). |
| **Item Count** | Number of inspection items registered for the equipment. |

## ② Inspection Entry Panel Layout

| Item | Role / Meaning |
|------|------|
| **Inspection Date** | Date of inspection (default: today). |
| **Inspector (Required)** | Select the worker who performed the inspection. Queried from the worker master. |
| **Start Time** | Inspection start time. |
| **Inspection Item List** | Displays inspection items linked to the selected equipment. |
| **Judgment Input** | Select OK (Pass) or NG (Fail) for each item, or enter a numeric value for measurement type. |
| **Overall Judgment** | Automatically displayed based on the combined results of all items. |

## Inspection Item List Columns

| Column | Role / Meaning |
|------|------|
| **Photo** | Inspection reference image (thumbnail). |
| **Inspection Item** | Item name from the inspection item master. |
| **Type** | Classification: judgment type (VISUAL) or measurement type (MEASURE). |
| **Criteria** | Pass/fail criteria or measurement range. |
| **Measured Value / Input** | Enter a measured value for measurement type, or select OK/NG for judgment type. |
| **Judgment** | OK (Pass) or NG (Fail) result. |

## Usage Sequence
1. Select the equipment to inspect from the left equipment list.
2. Check/select the inspection date and inspector in the right panel.
3. Enter the result for each inspection item:
   - **Judgment Type (VISUAL)**: Select OK/NG using dropdown or buttons
   - **Measurement Type (MEASURE)**: Enter the actual measured value as a number
4. If there is an NG (Fail) item, enter the defect details.
5. Save the result using the **Save (PASS)** or **Save (NG)** button.

## Input Rules
- **Inspector is required**.
- Results must be entered for all inspection items to save.
- Measurement type is automatically judged as NG if the value is outside the LSL (lower limit) and USL (upper limit) range.
- If NG (Fail), cause/remarks input is required.

## Related Screens
- [Daily Inspection Calendar](/equipment/inspect-calendar) — View daily inspection status on a monthly calendar and execute inspections
- [Inspection Item Master](/master/equip-inspect-item) — Reference screen for registering inspection items
- [Equipment Inspection Items](/master/equip-inspect) — Screen for linking inspection items to individual equipment
