---
menuCode: EQUIP_HISTORY
audience: user
title: Inspection History
summary: Screen for integrated viewing of all inspection history for daily (DAILY) and periodic (PERIODIC) inspections
tags: [설비, 점검, 이력, 조회, 통합]
keywords: [EQUIP_HISTORY, 점검이력, 설비점검이력, 통합조회, DAILY, PERIODIC, 검색]
related: [EQUIP_DAILY, EQUIP_PERIODIC, EQUIP_INSPECT_CALENDAR, EQUIP_PERIODIC_CALENDAR]
---

# Inspection History

## Screen Purpose
View all inspection history for both daily (DAILY) and periodic (PERIODIC) inspections in an integrated manner. This is a read-only screen that allows searching for desired history using various filter conditions.

## Screen Layout
- **Filter Area**: Search keyword + Inspection type (Daily/Periodic) + Equipment type + Result (Pass/Fail/Conditional) + Date range
- **DataGrid List**: Displays inspection history matching search criteria in table format. Provides column filtering and Excel export functionality.

## DataGrid Columns

| Column | Role / Meaning |
|------|------|
| **Inspection Date** | Date the inspection was performed. |
| **Inspection Type** | DAILY or PERIODIC classification. |
| **Equipment Code** | Unique code of the inspected equipment. |
| **Equipment Name** | Name of the inspected equipment. |
| **Equipment Type** | Equipment type classification. |
| **Inspector** | Name of the inspector who performed the check. |
| **Result** | Overall inspection result (PASS / FAIL / CONDITIONAL). |
| **Remarks** | Additional inspection notes. |

## Usage Sequence
1. Set conditions in the top filter area (Inspection type, Equipment type, Result, Period).
2. Click the **Search** button to retrieve history.
3. Review each entry in the result list.
4. Export data via Excel export if needed.

## Filter Conditions

| Filter | Description |
|------|------|
| **Search Keyword** | Search by equipment code or equipment name. |
| **Inspection Type** | Select All / Daily Inspection (DAILY) / Periodic Inspection (PERIODIC). |
| **Equipment Type** | Filter by specific equipment type. |
| **Result** | Filter by PASS / FAIL / CONDITIONAL. |
| **Inspection Date Range** | Select start and end dates for inspection date. |

## Related Screens
- [Daily Inspection](/equipment/daily-inspect) — Daily inspection result entry screen
- [Periodic Inspection](/equipment/periodic-inspect) — Periodic inspection result entry screen
- [Daily Inspection Calendar](/equipment/inspect-calendar) — Calendar view of inspection status
