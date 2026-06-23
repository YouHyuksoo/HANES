---
menuCode: EQUIP_PERIODIC_CALENDAR
audience: user
title: Periodic Inspection Calendar
summary: A screen to view monthly periodic inspection (PERIODIC) status on a calendar and execute inspections for individual equipment
tags: [equipment, inspection, periodic, calendar, PERIODIC]
keywords: [EQUIP_PERIODIC_CALENDAR, periodic-inspection-calendar, PERIODIC, equipment-periodic-inspection, monthly-inspection-status]
related: [EQUIP_PERIODIC, EQUIP_INSPECT_CALENDAR, EQUIP_INSPECT_ITEM]
---

# Periodic Inspection Calendar

## Screen Purpose
View monthly periodic inspection (PERIODIC) status on a calendar view, check inspection items for equipment by date, and execute inspections. Uses the same UI as the daily inspection calendar but displays PERIODIC type data.

## Screen Layout
- **Top — Statistics Cards**: Displays summary of total inspection schedules for the month, completed count, fail count, and incomplete (overdue) count.
- **Left — Calendar Grid**: Displays daily inspection status on a monthly calendar, color-coded by status.
- **Right — Daily Equipment Inspection Panel**: Displays inspection targets and results by equipment for the selected date.

## Calendar Color Coding

| Status | Color | Meaning |
|------|------|------|
| **All Pass (ALL_PASS)** | Green | All equipment inspections for the day completed, all items passed |
| **Has Fail (HAS_FAIL)** | Red | Inspection results for the day include FAIL |
| **In Progress (IN_PROGRESS)** | Yellow | Some equipment inspections completed, some not |
| **Not Started (NOT_STARTED)** | Gray | Inspection targets exist but not yet started |
| **Overdue (OVERDUE)** | Red Border | Inspection deadline passed but not completed |

## Usage Sequence
1. Click a date on the calendar to select it.
2. The right panel displays the list of equipment inspection targets for that date.
3. Click the **Run Inspection** or **Modify** button on each equipment card.
4. In the inspection execution modal, select the inspector, enter PASS/FAIL judgment for each item, and input defect reasons.
5. After saving, the calendar and panel are automatically refreshed.

## Related Screens
- [Periodic Inspection Results](/equipment/periodic-inspect) — Screen for managing periodic inspection results in list form
- [Daily Inspection Calendar](/equipment/inspect-calendar) — Screen for managing daily inspections (DAILY) via calendar
