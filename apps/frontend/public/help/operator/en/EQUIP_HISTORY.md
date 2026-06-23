---
menuCode: EQUIP_HISTORY
audience: operator
title: Inspection History — Operator Guide
summary: EQUIP_INSPECT_LOGS table unified inspection history (DAILY+PERIODIC) query, filter conditions, backend query structure
tags: [설비, 점검, 이력, 운영, 통합조회, DAILY, PERIODIC]
keywords: [EQUIP_INSPECT_LOGS, EQUIP_HISTORY, 점검이력조회, INSPECT_TYPE, OVERALL_RESULT, 통합조회API, 데이터그리드]
related: [EQUIP_DAILY, EQUIP_PERIODIC]
---

# Inspection History — Operator Guide

## System Purpose & Role
Unified query of all records (DAILY + PERIODIC) from the `EQUIP_INSPECT_LOGS` table. Read-only; the backend `InspectHistoryController` calls `EquipInspectService.findAll()` without an `inspectType` condition, returning history of all types.

## Data Structure
```
EQUIP_INSPECT_LOGS (PK: COMPANY + PLANT_CD + EQUIP_CODE + INSPECT_TYPE + INSPECT_DATE)
    │
    ├── INSPECT_TYPE: 'DAILY' or 'PERIODIC' (no condition on query → all)
    ├── OVERALL_RESULT: 'PASS' / 'FAIL' / 'CONDITIONAL'
    ├── EQUIP_CODE → EQUIP_MASTERS (JOIN for equipment code, name, type)
    └── Frontend DataGrid supports column filtering, sorting, export
```

## API Structure

### Query Inspection History List
`GET /equipment/inspect-history?search={text}&inspectType={type}&equipType={type}&overallResult={result}&inspectDateFrom={date}&inspectDateTo={date}&limit=5000`

- `search`: Partial match on equipment code or name
- `inspectType`: `'DAILY'` / `'PERIODIC'` (all if unspecified)
- `equipType`: Common code `EQUIP_TYPE` value
- `overallResult`: `'PASS'` / `'FAIL'` / `'CONDITIONAL'`
- `inspectDateFrom` / `inspectDateTo`: Inspection date range

### Statistics Summary
`GET /equipment/inspect-history/summary` — Inspection statistics data

## Column Mapping

| Screen Column | DB Column | JOIN |
|---------|---------|------|
| Inspection Date | `LOG.INSPECT_DATE` | - |
| Inspection Type | `LOG.INSPECT_TYPE` | - |
| Equipment Code | `LOG.EQUIP_CODE` | - |
| Equipment Name | `EQ.EQUIP_NAME` | `EQUIP_MASTERS` |
| Equipment Type | `EQ.EQUIP_TYPE` | `EQUIP_MASTERS` |
| Inspector | `LOG.INSPECTOR_NAME` | - |
| Result | `LOG.OVERALL_RESULT` | - |
| Remarks | `LOG.REMARK` | - |

## Permissions
Query available to all users. Excel export requires login.

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| No query results | Filter conditions too narrow | Broaden the filter and re-query |
| Date range filter not working | Date format mismatch | Verify YYYY-MM-DD format |
| Specific equipment history not showing | Equipment deleted or EQUIP_CODE changed | Check equipment master |
| Excel export fails | Too much data | Narrow date range before exporting |

## Data & Integration
- **Table**: `EQUIP_INSPECT_LOGS` (all), `EQUIP_MASTERS` (JOIN for equipment name/type)
- **Controller**: `InspectHistoryController` (independent controller, inspectType unfixed when calling `findAll()`)
- **Scope**: `COMPANY='40'`, `PLANT_CD='1000'`
