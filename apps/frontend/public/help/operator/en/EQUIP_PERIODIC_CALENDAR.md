---
menuCode: EQUIP_PERIODIC_CALENDAR
audience: operator
title: Periodic Inspection Calendar — Operations Guide
summary: Full field and DB mapping for the periodic inspection (PERIODIC) calendar, cycle schedule calculation, overall result and interlock logic, master linkage and troubleshooting
tags: [equipment, periodic-inspection, operations, PERIODIC, preventive-maintenance]
keywords: [EQUIP_INSPECT_LOGS, EQUIP_INSPECT_ITEM_POOL, EQUIP_INSPECT_ITEM_MASTERS, EQUIP_MASTERS, INSPECT_TYPE, PERIODIC, cycle, isDue, OVERALL_RESULT, INTERLOCK, OVERDUE, DETAILS, interlock]
related: [EQUIP_INSPECT_CALENDAR, EQUIP_INSPECT_ITEM, EQUIP_PERIODIC]
---

# Periodic Inspection Calendar — Operations Guide

## System Purpose and Role
This screen manages equipment **periodic inspections (INSPECT_TYPE='PERIODIC')** on a monthly calendar. It automatically calculates daily inspection targets based on the **cycle** in the equipment inspection item mapping (`EQUIP_INSPECT_ITEM_POOL`) and item master (`EQUIP_INSPECT_ITEM_MASTERS`), and stores inspection results in `EQUIP_INSPECT_LOGS`. The same components as the daily inspection calendar (InspectCalendar / DaySchedulePanel / InspectExecuteModal) are reused via `inspectType` and `apiBasePath` props; **data is distinguished solely by INSPECT_TYPE** (shared tables).

## Data Structure
```
EQUIP_INSPECT_ITEM_MASTERS (item criteria: item name, criteria, CYCLE, reference image)
        │ (ITEM_CODE reference)
        ▼
EQUIP_INSPECT_ITEM_POOL (per-equipment item mapping, INSPECT_TYPE='PERIODIC', USE_YN='Y')
        │  + EQUIP_MASTERS (equipment info)
        ▼  cycle-based isDue() → calculate daily inspection targets
Calendar/Daily Panel ──run inspection──▶ EQUIP_INSPECT_LOGS (1 record per equipment/date, item results in DETAILS JSON)
```

---

## ① Inspection Results — EQUIP_INSPECT_LOGS (all columns)
1 record per equipment × inspection type × inspection date. Shared table for daily/periodic/worker inspections.

| Screen Field | DB Column | Role / Meaning · Operations Note |
|------|------|------|
| (key) Equipment | `EQUIP_CODE` | Composite PK1. Equipment being inspected. |
| Inspection type | `INSPECT_TYPE` | Composite PK2. Fixed to **`PERIODIC`** in this screen. (DAILY=daily, WORKER=worker inspection) |
| Inspection date | `INSPECT_DATE` | Composite PK3. Date selected on calendar (YYYY-MM-DD). |
| — | `WORK_DATE` | Work date (server-calculated). |
| — | `INSPECT_AT` | Actual timestamp when inspection was saved (TIMESTAMP). |
| — | `OP_WINDOW_START_AT` / `OP_WINDOW_END_AT` | Operation window start/end (calculated at save time). |
| Inspector | `INSPECTOR_NAME` | Name of worker who performed the inspection. |
| Overall result | `OVERALL_RESULT` | `PASS` / `FAIL` / `CONDITIONAL` (unused). Auto-calculated from item results. |
| Item results | `DETAILS` (CLOB) | Item result JSON: `{items:[{itemId,seq,itemName,result,remark}]}`. Stores PASS/FAIL and reason per item. |
| General remark | `REMARK` | Overall memo for the inspection. |
| — | `ORDER_NO` | Work order number (for WORKER inspection; unused for periodic inspections). |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | `40` / `1000` scope. |
| — | `CREATED_BY/AT`, `UPDATED_BY/AT` | Audit columns. |

---

## ② Per-Equipment Inspection Item Mapping — EQUIP_INSPECT_ITEM_POOL
Defines which periodic inspection items are assigned to each equipment. Managed in the [Equipment Inspection Items] screen.

| Screen Field | DB Column | Role / Meaning · Operations Note |
|------|------|------|
| Company/Plant | `COMPANY`, `PLANT_CD` | Composite PK1·2. |
| Equipment | `EQUIP_CODE` | Composite PK3. |
| Inspection item | `ITEM_CODE` | Composite PK4. References item master. |
| Inspection type | `INSPECT_TYPE` | Composite PK5. **Target for this screen is `PERIODIC`**. |
| In use | `USE_YN` | Only `Y` records are included in schedule calculation. |
| Sort order | `SORT_SEQ` | Display order of items when executing inspection. |

---

## ③ Inspection Item Master — EQUIP_INSPECT_ITEM_MASTERS
Source for item name, judgment criteria, **cycle**, and reference images.

| Screen Field | DB Column | Role / Meaning · Operations Note |
|------|------|------|
| Item code | `ITEM_CODE` | PK (includes company/plant). |
| Item name | `ITEM_NAME` | Displayed in inspection execution modal and tags. |
| Inspection type | `INSPECT_TYPE` | `DAILY` / `PERIODIC`. |
| Equipment type | `EQUIP_TYPE` | Filter/template classification. |
| Item type | `ITEM_TYPE` | VISUAL/MEASUREMENT, etc. |
| Judgment criteria | `CRITERIA` | Displayed as reference value/description during inspection execution. |
| **Cycle** | `CYCLE` | **`DAILY`/`WEEKLY`/`MONTHLY`. Core of isDue() — determines which dates are inspection targets.** |
| Measurement unit | `UNIT` | Unit for measurement-type items. |
| Spec lower/upper limit | `LSL_VALUE` / `USL_VALUE` | Judgment range for measurement-type items. |
| Worker QR | `WORKER_QR_CODE` | For worker inspection integration. |
| Reference image | `IMAGE_URL` | Displayed as a reference image in the inspection execution modal. |
| In use | `USE_YN` | Only `Y` records are used. |
| Remark | `REMARK` | Memo. |

---

## ④ Equipment Info — EQUIP_MASTERS (reference columns)

| Screen Field | DB Column | Role / Meaning · Operations Note |
|------|------|------|
| Equipment code/name | `EQUIP_CODE` / `EQUIP_NAME` | Displayed on cards. |
| Line | `LINE_CODE` | Supplementary info on cards. |
| Equipment type | `EQUIP_TYPE` | Supplementary info on cards. |
| Process | `PROCESS_CODE` | Basis for **process filter**. |
| Status | `STATUS` | `NORMAL` / `INTERLOCK`. **Automatically set to INTERLOCK when a fail is saved.** |
| In use | `USE_YN` | Only `Y` equipment is included in the schedule. |

---

## Schedule and Judgment Logic

### Cycle-Based Inspection Target Calculation (isDue)
Determines whether each date is an inspection target based on `EQUIP_INSPECT_ITEM_MASTERS.CYCLE`:
- `DAILY` → every day
- `WEEKLY` → **Monday only** (getDay()===1)
- `MONTHLY` → **1st of each month** (getDate()===1)
- No value → treated as DAILY

### Date Status Calculation
`GET /calendar` calculates per date (priority order):
1. 0 target equipment → `NONE`
2. Completed ≥ total AND fail = 0 → `ALL_PASS`
3. Fail > 0 → `HAS_FAIL`
4. 0 < completed < total → `IN_PROGRESS`
5. Completed = 0 → past: `OVERDUE`, future: `NOT_STARTED`

### Overall Result (OVERALL_RESULT)
Auto-calculated in the inspection execution modal: **if even 1 item result is `FAIL`, the overall is `FAIL`**; all `PASS` results → `PASS`. (Only finalized when all item results are entered.)

### Automatic INTERLOCK Handling
When saving (POST/PUT) an inspection with `OVERALL_RESULT` of FAIL, `EQUIP_MASTERS.STATUS` is automatically changed to `'INTERLOCK'`. Equipment must be restored to `NORMAL` after corrective action before operations can resume.

## Prerequisites (Master and Common Code)
1. Register `INSPECT_TYPE='PERIODIC'` items and **CYCLE** in the **inspection item master** (`EQUIP_INSPECT_ITEM_MASTERS`).
2. Map PERIODIC items to equipment in **equipment inspection items** (`EQUIP_INSPECT_ITEM_POOL`) with `USE_YN='Y'`.
3. Target equipment must have `EQUIP_MASTERS.USE_YN='Y'`.
4. Inspector selection uses the worker master.

## Operations Procedure
1. Display the target month using process filter and current/next month generate buttons.
2. Select a calendar date → **Run/Edit inspection** per equipment in the daily panel.
3. Enter pass/fail per item and save → upsert to `EQUIP_INSPECT_LOGS`, calendar updated.
4. Check interlock status for failed equipment and take corrective action/restore.
5. Inspect equipment outside the auto-schedule using **Add Individual Inspection** (select equipment → PERIODIC items auto-loaded).

## Permissions
- Input inspection results: worker/equipment administrator.
- View: all users.

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| No inspection targets on calendar | PERIODIC items not mapped or `USE_YN='N'` | Verify PERIODIC item mapping in `EQUIP_INSPECT_ITEM_POOL` |
| Only specific dates are empty | CYCLE condition mismatch (weekly=Monday, monthly=1st) | Check CYCLE setting in item master |
| Inspection save fails | Inspector not selected / items not entered / FAIL reason missing | Complete required fields and re-save |
| Equipment unusable after saving | INTERLOCK automatically set due to fail result | Take corrective action and restore `EQUIP_MASTERS.STATUS` to NORMAL |
| Daily inspection results mixed in | INSPECT_TYPE confusion | This screen queries PERIODIC only (API base is periodic-inspect) |

## Data and Linkage
- **Tables**: `EQUIP_INSPECT_LOGS` (INSPECT_TYPE='PERIODIC'), `EQUIP_INSPECT_ITEM_POOL`, `EQUIP_INSPECT_ITEM_MASTERS`, `EQUIP_MASTERS`
- **APIs**: `GET /equipment/periodic-inspect/calendar` (monthly summary), `GET /equipment/periodic-inspect/calendar/day` (daily schedule), `POST /equipment/periodic-inspect` (save), `PUT /equipment/periodic-inspect/{equipCode}/{inspectDate}` (modify), `DELETE …` (delete). For individual addition: `GET /master/equip-inspect-items?inspectType=PERIODIC`.
- **Differences from daily inspection**: Only INSPECT_TYPE (`PERIODIC` vs `DAILY`) and apiBasePath differ; tables, components, and logic are shared. Periodic inspection does not have the `/check` (inspection completion confirmation) endpoint from daily inspection.
- **Linked screens**: [Equipment Inspection Items](/master/equip-inspect), [Periodic Inspection Results](/equipment/periodic-inspect), [Daily Inspection Calendar](/equipment/inspect-calendar)
- **Multi-tenancy scope**: `COMPANY='40'`, `PLANT_CD='1000'`
