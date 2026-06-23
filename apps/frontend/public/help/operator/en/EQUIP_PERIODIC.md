---
menuCode: EQUIP_PERIODIC
audience: operator
title: Periodic Inspection — Operator Guide
summary: EQUIP_INSPECT_LOGS table PERIODIC type inspection, differences from DAILY, interlock handling, periodic scheduling
tags: [설비, 점검, 정기, 운영, PERIODIC, 결과, 인터록]
keywords: [EQUIP_INSPECT_LOGS, PERIODIC, 정기점검결과, OVERALL_RESULT, INTERLOCK, CYCLE, QUARTERLY, SEMI_ANNUAL, ANNUAL]
related: [EQUIP_PERIODIC_CALENDAR, EQUIP_DAILY]
---

# Periodic Inspection — Operator Guide

## System Purpose & Role
Register, view, and modify periodic inspection results stored in the `EQUIP_INSPECT_LOGS` table with `INSPECT_TYPE='PERIODIC'`. Uses the same `EquipInspectService` as daily inspection (DAILY), with `inspectType` fixed to `'PERIODIC'`.

## Differences from DAILY Inspection

| Item | Daily Inspection (DAILY) | Periodic Inspection (PERIODIC) |
|------|---------------|-------------------|
| **INSPECT_TYPE** | `'DAILY'` | `'PERIODIC'` |
| **Cycle** | Every day | MONTHLY / QUARTERLY / SEMI_ANNUAL / ANNUAL |
| **API Path** | `/equipment/daily-inspect` | `/equipment/periodic-inspect` |
| **Item Filter** | `inspectType=DAILY` | `inspectType=PERIODIC` |
| **Controller** | `DailyInspectController` | `PeriodicInspectController` |
| **Service** | `EquipInspectService` (same) | `EquipInspectService` (same) |
| **Page Icon** | `ClipboardCheck` | `CalendarCheck` |
| **Title** | Daily Inspection | Periodic Inspection |

## Shared with Daily Inspection
- Reuses `EquipListPanel`, `InspectEntryPanel` components
- Inspection save logic: POST (new) / PUT (modify)
- Interlock handling: on FAIL, `EquipMaster.status = 'INTERLOCK'`
- Same DETAILS (CLOB) JSON structure

## Periodic Inspection Scheduling

`EquipInspectService`'s `getCalendarSummary()` and `getDaySchedule()` determine target equipment based on:

| CYCLE Value | Inspection Target Date |
|---------|-----------|
| MONTHLY | 1st day of each month |
| QUARTERLY | First day of each quarter (1/1, 4/1, 7/1, 10/1) |
| SEMI_ANNUAL | First day of each half-year (1/1, 7/1) |
| ANNUAL | January 1st each year |

## Data Structure
`EQUIP_INSPECT_LOGS` (INSPECT_TYPE='PERIODIC') — Uses the exact same table/columns as DAILY.

Periodic inspection items are filtered from `EQUIP_INSPECT_ITEM_POOL` with the condition `INSPECT_TYPE='PERIODIC'`.

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| Periodic inspection target not showing in equipment list | PERIODIC items not mapped to equipment | Go to Equipment Inspection Items screen → PERIODIC tab → Add |
| No inspection items for a specific equipment | No PERIODIC link in EQUIP_INSPECT_ITEM_POOL | Register master data then map |
| Save button disabled | Inspector not selected or some items missing judgment | Check all required fields |
| Interlock not triggered on FAIL save | Server exception or transaction issue | Check logs |

## Data & Integration
- **Table**: `EQUIP_INSPECT_LOGS` (INSPECT_TYPE='PERIODIC'), `EQUIP_INSPECT_ITEM_POOL`, `EQUIP_MASTERS`
- **Shared Components**: EquipListPanel, InspectEntryPanel from daily-inspect/components/
- **Scope**: `COMPANY='40'`, `PLANT_CD='1000'`
