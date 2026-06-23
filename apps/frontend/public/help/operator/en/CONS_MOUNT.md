---
menuCode: CONS_MOUNT
audience: operator
title: Consumable Mount Management — Operator Guide
summary: Manage the physical state transitions of consumables mounted on equipment—mount, unmount, and repair—and understand data flow and troubleshooting for CONSUMABLE_MASTERS and CONSUMABLE_MOUNT_LOGS.
tags: [consumable, mount, unmount, repair, operation, setup]
keywords: [CONSUMABLE_MASTERS, CONSUMABLE_MOUNT_LOGS, EQUIP_MASTERS, OPER_STATUS, MOUNTED, WAREHOUSE, REPAIR, MOUNT, UNMOUNT, SEQ_CONSUMABLE_MOUNT_LOGS]
related: [CONS_MASTER, CONS_STOCK, CONS_LIFE]
---

# Consumable Mount Management — Operator Guide

## System Purpose and Role
This screen manages the **physical status** of consumables (mold, jig, tool) used on production equipment. It updates `OPER_STATUS` and `MOUNTED_EQUIP_ID` in `CONSUMABLE_MASTERS`, and every state change is recorded as an audit trail in `CONSUMABLE_MOUNT_LOGS`. This is a separate status-management flow from receiving/issue or life-cycle management.

## Data Structure
```
CONSUMABLE_MASTERS (PK: CONSUMABLE_CODE, COMPANY, PLANT_CD)
   ├─ OPER_STATUS        : WAREHOUSE / MOUNTED / REPAIR
   ├─ MOUNTED_EQUIP_ID   : Currently mounted equipment (only when MOUNTED)
   └─ 1:N ─▶ CONSUMABLE_MOUNT_LOGS (PK: MOUNT_DATE, SEQ)
              ├─ ACTION: MOUNT / UNMOUNT
              ├─ EQUIP_CODE
              ├─ WORKER_NO
              └─ REMARK

EQUIP_MASTERS (PK: EQUIP_CODE, COMPANY, PLANT_CD)
   └─ Referenced by: MOUNTED_EQUIP_ID
```

## ① Main Grid — CONSUMABLE_MASTERS (All Columns)

| Screen Item       | DB Column         | Role / Meaning · Operating Point |
|-------------------|-------------------|----------------------------------|
| Consumable Code   | `CONSUMABLE_CODE` | PK. Reference key for other consumable flows. |
| Consumable Name   | `NAME`            | Display name (entity attribute `consumableName`). |
| Category          | `CATEGORY`        | Common code `CONSUMABLE_CATEGORY` (MOLD/JIG/TOOL). |
| Operation Status  | `OPER_STATUS`     | `WAREHOUSE` / `MOUNTED` / `REPAIR`. Determines which action buttons are shown. |
| Mounted Equipment | `MOUNTED_EQUIP_ID`| Populated only when `MOUNTED`; null when `WAREHOUSE` or `REPAIR`. |
| Life Status       | `STATUS`          | `NORMAL` / `WARNING` / `REPLACE`. Updated by the life-cycle module. |
| Current Use Count | `CURRENT_COUNT`   | Accumulated via kiosk/shot-count API. |
| Expected Life     | `EXPECTED_LIFE`   | Threshold for `REPLACE` status. |
| Storage Location  | `LOCATION`        | Default storage location. |
| Use Y/N           | `USE_YN`          | Only `Y` records appear in the list. |
| Multi-tenancy     | `COMPANY`, `PLANT_CD` | Scoped to `40` / `1000`. |

## ② Mount/Unmount History — CONSUMABLE_MOUNT_LOGS (All Columns)

| Screen Item       | DB Column         | Role / Meaning · Operating Point |
|-------------------|-------------------|----------------------------------|
| Date              | `MOUNT_DATE`      | PK(1). Date on which the mount/unmount occurred. |
| Sequence          | `SEQ`             | PK(2). Assigned by `SEQ_CONSUMABLE_MOUNT_LOGS.NEXTVAL`. |
| Consumable Code   | `CONSUMABLE_CODE` | FK characteristic. References `CONSUMABLE_MASTERS`. |
| Equipment Code    | `EQUIP_CODE`      | Equipment that was the target of the mount/unmount. |
| Action            | `ACTION`          | `MOUNT` or `UNMOUNT`. |
| Worker            | `WORKER_NO`       | API requester or `dto.workerId`. |
| Remark            | `REMARK`          | Up to 500 characters. |
| CON_UID           | `CON_UID`         | Optional individual instance tracking identifier. |
| Multi-tenancy     | `COMPANY`, `PLANT_CD` | `40` / `1000`. |

## State Transition Logic
1. **Mount** (`POST /equipment/consumables/:id/mount`)
   - `OPER_STATUS` must be `'WAREHOUSE'` and `MOUNTED_EQUIP_ID` must be null.
   - `OPER_STATUS` → `MOUNTED`, `MOUNTED_EQUIP_ID` → requested equipment.
   - A `MOUNT` record is inserted into `CONSUMABLE_MOUNT_LOGS`.
2. **Unmount** (`POST /equipment/consumables/:id/unmount`)
   - `OPER_STATUS` must be `'MOUNTED'`.
   - `OPER_STATUS` → `WAREHOUSE`, `MOUNTED_EQUIP_ID` → null.
   - An `UNMOUNT` record is inserted for the previously mounted equipment.
3. **Send to Repair** (`POST /equipment/consumables/:id/repair`)
   - If currently mounted, an `UNMOUNT` record is created first.
   - `OPER_STATUS` → `REPAIR`, `MOUNTED_EQUIP_ID` → null.
4. **Complete Repair** (`POST /equipment/consumables/:id/complete-repair`)
   - `OPER_STATUS` must be `'REPAIR'`.
   - `OPER_STATUS` → `WAREHOUSE`.
   - No history record is created (status-only recovery).

> Equipment interlocked due to exceeded life (`STATUS='REPLACE'`) should be unmounted on this screen and then processed for replacement.

## Prerequisites (Master and Common Codes)
- Common codes: `CONSUMABLE_CATEGORY` (MOLD/JIG/TOOL), `CONSUMABLE_STATUS` (NORMAL/WARNING/REPLACE), `CONSUMABLE_OPER_STATUS` (WAREHOUSE/MOUNTED/REPAIR)
- The target consumable must be registered in `CONSUMABLE_MASTERS` with `USE_YN='Y'`.
- The target equipment must be registered in `EQUIP_MASTERS`.
- Oracle SEQUENCE: `SEQ_CONSUMABLE_MOUNT_LOGS.NEXTVAL`

## Operating Procedure
1. Register the consumable master ([Consumables Master]) and receive it ([Consumables Receiving]) to ensure `OPER_STATUS='WAREHOUSE'`.
2. On this screen, filter the target consumable and perform mount/unmount/repair actions.
3. Monitor replacement timing from [Life Status] as needed.
4. After repair is complete, return the item to warehouse using the `Complete Repair` action on this screen.

## Permissions
Production/equipment managers may execute mount, unmount, and repair actions. General users have read and history-view access only.

## Troubleshooting
| Symptom | Cause | Action |
|---------|-------|--------|
| Mount fails with "Already mounted on equipment" (409) | `OPER_STATUS='MOUNTED'` | Unmount first, then remount. |
| Unmount fails with "Not in mounted status" (400) | `OPER_STATUS` is WAREHOUSE or REPAIR | Check the current status. |
| Complete Repair fails with "Not in repair status" (400) | `OPER_STATUS != 'REPAIR'` | Run Send to Repair first. |
| No records in history modal | `CONSUMABLE_MOUNT_LOGS` not created | Verify mount/unmount/repair API calls completed successfully. |
| Consumable not visible in list | `USE_YN='N'` or filter mismatch | Check master use flag and applied filters. |
| Target equipment cannot be selected | `EQUIP_MASTERS` not registered or `USE_YN='N'` | Activate the equipment master. |

## Data and Integration
- Tables: `CONSUMABLE_MASTERS`, `CONSUMABLE_MOUNT_LOGS`, `EQUIP_MASTERS`
- Integration: [Consumables Master] (`CONSUMABLE_MASTERS`), [Consumables Receiving] (`CONSUMABLE_LOGS`), [Life Status] (`CURRENT_COUNT` / `EXPECTED_LIFE`), Equipment Master (`EQUIP_MASTERS`)
- Scope: `COMPANY='40'`, `PLANT_CD='1000'`
