---
menuCode: EQUIP_PERIODIC_CALENDAR
audience: user
title: Periodic Inspection Calendar
summary: View monthly periodic inspection schedules on a calendar (auto-calculated from the inspection item master and cycle per equipment), and record inspection results (pass/fail) by selecting a date.
tags: [equipment, periodic-inspection, inspection-calendar, preventive-maintenance, PERIODIC]
keywords: [periodic-inspection, inspection-calendar, inspection-cycle, cycle, periodic-check, monthly-inspection, weekly-inspection, preventive-inspection, pass, fail, PASS, FAIL, overdue, OVERDUE, interlock, INTERLOCK, individual-inspection-add]
related: [EQUIP_INSPECT_CALENDAR, EQUIP_INSPECT_ITEM, EQUIP_PERIODIC]
---

# Periodic Inspection Calendar

## Screen Purpose
This screen manages equipment **periodic inspections** (preventive inspections performed on a regular cycle) using a monthly calendar.
Based on the **cycle** defined in the inspection item master per equipment, "which equipment to inspect on which day" is automatically calculated and displayed on the calendar. Select a date to enter inspection results (pass/fail) for each piece of equipment.

> The screen structure and operation are identical to the daily inspection calendar; only the **inspection type is PERIODIC**. Inspection items and results are managed separately from daily inspections.

## Screen Layout
- **Top Header**: Process filter, current/next month generate buttons, refresh
- **4 Monthly Statistics Cards**: Total scheduled / Completed / Failed / Overdue
- **Left — Calendar**: Shows daily inspection progress using colors and progress bars
- **Right — Daily Panel**: List of equipment to inspect on the selected date + run/add individual inspection
- **Inspection Execution Modal**: Enter pass/fail per item and save

## Concept Relationship
```
Equipment inspection items (cycle) ──auto-schedule──▶ Calendar (daily targets) ──date select──▶ Inspection execution (pass/fail per item) ──▶ Overall result (PASS/FAIL)
```

---

## ① Top Header

| Item | Role / Meaning |
|------|------|
| **Process Filter** | Shows only equipment for a specific process in the calendar and daily panel. Leave empty to include all processes. |
| **Generate Current Month** | Moves to the current month and recalculates the inspection schedule for that month. |
| **Generate Next Month** | Moves to next month to preview the next month's inspection schedule in advance. |
| **Refresh** | Reloads the data for the currently displayed month. |

## ② Monthly Statistics Cards

| Card | Role / Meaning |
|------|------|
| **Total Scheduled** | Total count of (equipment × date) inspections scheduled for this month. Automatically calculated based on the cycle. |
| **Completed** | Count of inspections that have been completed with results entered. |
| **Failed** | Count of inspections with an overall result of **FAIL**. |
| **Overdue** | Number of days where the inspection was due but no inspection has been performed — **OVERDUE**. |

## ③ Calendar

Each date cell shows the daily inspection progress at a glance.

| Display | Role / Meaning |
|------|------|
| **Ratio Text (N/M)** | Completed count / total scheduled count. |
| **Progress Bar** | Displays completion ratio as a bar. |
| **Status Color** | Distinguishes status by color per date (see below). |

> Date status
> - **All Pass (ALL_PASS)**: All scheduled inspections completed with no failures — green
> - **Has Fail (HAS_FAIL)**: One or more failed inspections — red
> - **In Progress (IN_PROGRESS)**: Partially completed — yellow
> - **Overdue (OVERDUE)**: Due date passed with no start — red border
> - **Not Started (NOT_STARTED)**: Future scheduled date not yet reached
> - **None (NONE)**: No inspection schedule for that day

## ④ Daily Panel — Equipment Cards

Equipment to inspect on the selected date is listed as cards.

| Item | Role / Meaning |
|------|------|
| **Equipment Code / Name** | The equipment to be inspected. |
| **Line / Equipment Type** | The equipment's line code and type (reference information). |
| **Status Icon** | Indicates pass (green check) / fail (red X) / not inspected (gray clock). |
| **Overall Result** | Displayed as a PASS/FAIL badge when inspection is complete. |
| **Inspection Item Tags** | Inspection items for that equipment. Each item shows ✅pass / ❌fail / ⏳not inspected. |
| **Inspector** | Name of the worker who performed the inspection. |
| **Run / Edit Button** | **Run Inspection** if not yet inspected; **Edit** to modify a completed result. |
| **Add Individual Inspection** | Button at the top right of the panel. Allows adding an inspection for equipment not in the auto-schedule for that day. |

## ⑤ Inspection Execution Modal

| Item | Role / Meaning |
|------|------|
| **Inspection Date** | Automatically set to the selected date (cannot be changed). |
| **Inspector** | Select the worker who performed the inspection. |
| **Inspection Items (sequence, item name, criteria, reference image)** | Items and judgment criteria defined in the master are displayed. Reference images are shown if available. |
| **Result (Pass/Fail)** | Select PASS or FAIL for each item. |
| **Fail Reason (Remark)** | Enter a reason when an item is marked as FAIL. |
| **Overall Result** | Automatically calculated from the entered results. **If even one item is FAIL, the overall result is FAIL**; all pass means PASS. |
| **General Remarks** | Overall memo for the inspection (optional). |

> ⚠️ If the overall result is saved as **FAIL**, the equipment is automatically set to **INTERLOCK (usage lock)** status. The equipment status must be restored to normal after corrective action.

## ⑥ Add Individual Inspection Modal

| Item | Role / Meaning |
|------|------|
| **Select Equipment** | Choose the equipment to inspect. When selected, the **periodic inspection items** for that equipment are automatically loaded from the master. |
| **Next** | Opens the inspection execution modal with the loaded items. |

---

## Usage Steps
1. Set the month to inspect using the **process filter** (if needed) and **generate current/next month** buttons.
2. **Click a date** on the calendar to display the inspection target equipment for that day on the right.
3. Press **Run Inspection** on an equipment card to enter **pass/fail** for each item (enter reason for any fail).
4. After **saving**, the overall result is automatically calculated and the calendar progress is updated.
5. To inspect equipment not in the auto-schedule, use **Add Individual Inspection**.

## Input Rules / Validation
- **All items must have pass/fail selected** for the overall result to be finalized (a confirmation will appear before saving if any item is unanswered).
- **Failed items** should have a reason (remark) entered.
- The inspection date is fixed to the date selected on the calendar.
- Periodic inspections for the same equipment on the same date are managed as 1 record; re-inspection uses **Edit** to modify.

## FAQ
- **Q.** No inspection targets appear on the calendar.
  **A.** **PERIODIC items** and a **cycle** must be registered in the inspection item master for each equipment. Items are only shown on applicable dates based on the cycle (weekly = Monday, monthly = 1st of each month).
- **Q.** How is this different from daily inspections?
  **A.** The screen operation is the same, but the inspection type is PERIODIC, and items/results are aggregated separately from daily inspections.
- **Q.** The equipment is locked after saving a fail result.
  **A.** A fail result triggers an interlock (usage lock) on the equipment. Take corrective action and then change the equipment status back to normal.
- **Q.** When does OVERDUE appear?
  **A.** It appears on dates where the inspection was scheduled but there is no inspection record at all.

## Related Screens
- [Daily Inspection Calendar](/equipment/inspect-calendar) — Daily inspections performed every day
- [Equipment Inspection Items](/master/equip-inspect) — Where periodic inspection items and cycles are linked to equipment
- [Periodic Inspection Results](/equipment/periodic-inspect) — List view of periodic inspection records
