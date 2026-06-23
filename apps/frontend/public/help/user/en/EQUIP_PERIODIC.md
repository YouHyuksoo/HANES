---
menuCode: EQUIP_PERIODIC
audience: user
title: Periodic Inspection
summary: Screen for registering and managing periodic inspection (PERIODIC) results performed on a regular cycle
tags: [설비, 점검, 정기, PERIODIC, 결과, 관리]
keywords: [EQUIP_PERIODIC, 정기점검, 설비정기점검, PERIODIC, 점검결과, PASS, FAIL]
related: [EQUIP_PERIODIC_CALENDAR, EQUIP_DAILY, EQUIP_INSPECT_ITEM]
---

# Periodic Inspection

## Screen Purpose
Register and manage inspection results for equipment periodic inspections (PERIODIC) performed on a monthly/quarterly/semi-annual/annual cycle. Uses the same left/right split layout as daily inspection, handling PERIODIC type inspection data.

## Screen Layout
- **Left — Equipment List**: Displays equipment subject to periodic inspection grouped by equipment type.
- **Right — Inspection Entry Panel**: Shows the PERIODIC inspection item list and judgment entry form for the selected equipment.

## Inspection Entry Panel Fields

| Field | Role / Meaning |
|------|------|
| **Inspection Date** | Date the periodic inspection was performed. |
| **Inspector (Required)** | Select the inspector from the worker master. |
| **Start Time** | Inspection start time. |
| **Inspection Item List** | PERIODIC inspection items linked to the equipment. |
| **Judgment Entry** | Enter OK (Pass) / NG (Fail) judgment or measured values for each item. |
| **Overall Judgment** | Automatically displayed by aggregating all item results. |

## Usage Sequence
1. Select equipment for periodic inspection from the left equipment list.
2. Verify/select the inspection date and inspector in the right panel.
3. Enter results for each inspection item (judgment type OK/NG, measurement type numeric entry).
4. If there are NG items, enter defect details.
5. Save using the **Save (PASS)** or **Save (NG)** button.

## Related Screens
- [Periodic Inspection Calendar](/equipment/periodic-inspect-calendar) — View periodic inspection status via monthly calendar
- [Daily Inspection](/equipment/daily-inspect) — Daily inspection screen
- [Inspection Item Master](/master/equip-inspect-item) — Register inspection items
