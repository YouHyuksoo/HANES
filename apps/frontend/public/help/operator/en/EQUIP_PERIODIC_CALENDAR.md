---
menuCode: EQUIP_PERIODIC_CALENDAR
audience: operator
title: Periodic Inspection Calendar — Operation Guide
summary: PERIODIC inspection calendar view and execution screen, differences from DAILY, API structure, interlock handling
tags: [equipment, inspection, periodic, calendar, operation, PERIODIC]
keywords: [EQUIP_PERIODIC_CALENDAR, periodic-inspection-calendar, PERIODIC, INSPECT_TYPE, CALENDAR_DAY_SUMMARY, equipment-interlock]
related: [EQUIP_PERIODIC, EQUIP_INSPECT_CALENDAR]
---

# Periodic Inspection Calendar — Operation Guide

## System Purpose & Role
Reuses the same 3 components (InspectCalendar, DaySchedulePanel, InspectExecuteModal) as the daily inspection calendar (`EQUIP_INSPECT_CALENDAR`) to view and execute `INSPECT_TYPE='PERIODIC'` data on a calendar.

## Differences from DAILY Calendar

| Item | Daily Inspection Calendar | Periodic Inspection Calendar |
|------|---------------|----------------|
| **INSPECT_TYPE** | `'DAILY'` | `'PERIODIC'` |
| **API Path** | `/equipment/daily-inspect/calendar` | `/equipment/periodic-inspect/calendar` |
| **Daily API** | `/equipment/daily-inspect/calendar/day` | `/equipment/periodic-inspect/calendar/day` |
| **Inspect Execute API** | POST/PUT `/equipment/daily-inspect` | POST/PUT `/equipment/periodic-inspect` |
| **Title** | Daily Inspection Calendar | Periodic Inspection Calendar |
| **Current/Next Month Create Button** | Available | Not available |

## API Structure

### Monthly Calendar Summary
`GET /equipment/periodic-inspect/calendar?year={yyyy}&month={MM}[&processCode={code}]`

Response: `CalendarDaySummary[]` — total, completed, pass, fail, status for each date

### Daily Equipment Schedule
`GET /equipment/periodic-inspect/calendar/day?date={yyyy-MM-dd}[&processCode={code}]`

Response: `DayScheduleEquip[]` — equipCode, equipName, inspected, overallResult, items[] per equipment

## Shared Inspection Execution Modal
`InspectExecuteModal` receives `'PERIODIC'` via the `inspectType` prop and executes inspections with the same UI:
- Select inspector (worker master API)
- Toggle PASS/FAIL per item
- Cause/remarks required on FAIL
- Overall result auto-calculated
- POST (new) or PUT (modify) on save

## INTERLOCK Handling
When a FAIL result is saved, `EquipMaster.status` is automatically changed to `'INTERLOCK'` (same as DAILY).

## Permissions
Permission to input inspection results (worker/equipment manager). All users can view.

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| No data on calendar | No PERIODIC inspection target equipment for the month | Verify periodic inspection target equipment |
| Right panel empty when date selected | No schedule data for that date | Check inspection item mapping and cycle settings |
| Inspection save fails | Inspector not selected or FAIL reason not entered | Check required inputs |

## Data & Links
- **Tables**: `EQUIP_INSPECT_LOGS` (INSPECT_TYPE='PERIODIC')
- **Shared Components**: 3 components from inspect-calendar/components/
- **Scope**: `COMPANY='40'`, `PLANT_CD='1000'`
