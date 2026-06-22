---
menuCode: QC_REQUEST_INSPECT
audience: operator
title: Delegate Inspection Input — Operator Guide
summary: Self-inspection delegate inspection (DELEGATE) pending entry measurement input·judgment screen. SELF_INSPECT_RESULTS/SELF_INSPECT_ITEMS columns·DB mapping, state transitions, kiosk blocking linkage, troubleshooting
tags: [quality, self-inspection, delegate inspection, DELEGATE, operations]
keywords: [SELF_INSPECT_RESULTS, SELF_INSPECT_ITEMS, DELEGATE, DIRECT, PENDING, PASS, FAIL, INSPECT_METHOD, STATUS, MEASURE_VALUE, LSL_VALUE, USL_VALUE, ITEM_TYPE, MEASURE, VISUAL, TIMING, INSPECTED_AT, kiosk block, self-inspection]
related: [QC_AQL]
---

# Delegate Inspection Input — Operator Guide

## System Purpose & Role
During process **self-inspection (SELF_INSPECT)**, items with inspection method **Delegate (DELEGATE)** are not directly judged by the operator at the kiosk — instead, result records are loaded with `STATUS='PENDING'`. This screen allows quality staff to review those pending entries, **enter measurement values, and confirm PASS/FAIL**. Direct (DIRECT) inspection items are immediately judged PASS/FAIL at the kiosk and do not appear on this screen.

> Core integration: If any `INSPECT_METHOD='DELEGATE' AND STATUS='PENDING'` result exists for a specific work order, **the kiosk production result input for that work order is blocked** (based on entity comment). The block is released only after judgment is completed on this screen.

## Data Structure
Delegate inspection results are stored in the results table, with inspection criteria (specifications·type·unit) joined from the item master.

```
SELF_INSPECT_ITEMS (inspection item master)            SELF_INSPECT_RESULTS (inspection results)
  ID (PK) ─────────────────┐                            ID (PK)
  INSPECT_METHOD=DELEGATE   │  INSPECT_ITEM_ID           INSPECT_ITEM_ID ──(LEFT JOIN i.id)
  ITEM_TYPE / LSL / USL /   └──────────────────────────  INSPECT_METHOD = 'DELEGATE'
  UNIT / STANDARD                                        STATUS = 'PENDING' → target of this screen
```

- Pending list query: `SELF_INSPECT_RESULTS r LEFT JOIN SELF_INSPECT_ITEMS i ON i.ID = r.INSPECT_ITEM_ID`, conditions `r.INSPECT_METHOD='DELEGATE' AND r.STATUS='PENDING' AND r.COMPANY/PLANT_CD scope`, sorted by `r.CREATED_AT ASC`.
- API: List `GET /production/self-inspect/delegates`, judgment `PATCH /production/self-inspect/results/:id/status`.
- (Note) The left grid's `sqlQuery` display text points to `INSPECT_REQUESTS`, but the actual data source is `SELF_INSPECT_RESULTS` (this is a display SQL label, not the actual query path).

---

## ① Pending List / Results — SELF_INSPECT_RESULTS (Relevant Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| (Row ID) | `ID` | PK (UUID, `PrimaryGeneratedColumn('uuid')`). Used as `:id` in judgment PATCH. |
| Work Order | `ORDER_NO` | Work order number where inspection occurred. Indexed. Key for kiosk block determination. |
| Process | `PROCESS_CODE` | Process code where inspection occurred (nullable). |
| (Inspection Item Key) | `INSPECT_ITEM_ID` | References `SELF_INSPECT_ITEMS.ID` (nullable). JOIN key for spec/type/unit. |
| Item Name | `ITEM_NAME` | Inspection item name (result-time snapshot, length 200). |
| Timing | `TIMING` | `FIRST`(first piece) / `MID`(middle) / `LAST`(last piece). Single timing value per result. |
| (Inspection Method) | `INSPECT_METHOD` | `DIRECT`(direct) / `DELEGATE`(delegate). This screen only targets `DELEGATE`. Default `DIRECT`. |
| (Status) | `STATUS` | `PENDING`(pending) / `PASS`(pass) / `FAIL`(fail). Default `PENDING`. Indexed. Only PENDING shown in list. |
| Measurement Value | `MEASURE_VALUE` | NUMBER, nullable. Used only for MEASURE items; null for VISUAL. Saved together with judgment. |
| Remark | `REMARK` | varchar2(500), nullable. Notes/judgment reason. |
| Sample No. | `SAMPLE_NO` | NUMBER, default 1. 1..N for FIRST multiple samples; 1 for MID/LAST. (Included in list query but not displayed in grid.) |
| Request Date | `CREATED_AT` | `CreateDateColumn`. Delegate request time. List sort (ASC) basis. |
| (Inspection Complete Time) | `INSPECTED_AT` | timestamp, nullable. **Set to `new Date()` when transitioning to non-PENDING status (`status !== 'PENDING'`)**. Null if not yet judged. |
| (Production Qty) | `PROD_QTY_AT_INSPECT` | NUMBER, nullable. Production quantity at inspection time (kiosk-stored value). Not displayed on this screen. |
| (Equipment) | `EQUIP_CODE` | varchar2(50), nullable. Inspection equipment code. Not displayed on this screen. |
| (Inspector) | `INSPECTOR_ID` | varchar2(50), nullable. Not displayed on this screen. |
| Audit | `CREATED_BY`, `UPDATED_BY`, `UPDATED_AT` | Creator/modifier·modification time. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | `COMPANY='40'`, `PLANT_CD='1000'` scope. List and judgment both apply scope filter. |

---

## ② Inspection Criteria (JOIN Display) — SELF_INSPECT_ITEMS (Columns Retrieved in Pending List)

The pending list LEFT JOINs the item master to populate the "Inspection Criteria" in the right-side input area.

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| (Item Type) | `ITEM_TYPE` | `MEASURE`(measurement) / `VISUAL`(judgmental). For MEASURE without specifications, shows "No LSL/USL configured". For VISUAL, shows "Judgmental item (no spec)". Default `VISUAL`. |
| LSL | `LSL_VALUE` | NUMBER, nullable. Lower spec limit. If either LSL or USL exists, value is displayed in the inspection criteria box. |
| USL | `USL_VALUE` | NUMBER, nullable. Upper spec limit. |
| Unit | `UNIT` | varchar2(20), nullable. Measurement unit (mm, N etc.). Only shown if present. |
| Standard/Spec | `STANDARD` | varchar2(500), nullable. Text criteria. Only shown if present. |

> If `INSPECT_ITEM_ID` is null or no matching item master exists (LEFT JOIN miss), LSL/USL/unit/standard are empty — shown as "No spec". For measurement-type items with empty specs, fill in LSL/USL in the item master.

---

## Judgment Logic (PATCH /results/:id/status)
1. Look up result record by `id` + COMPANY/PLANT_CD scope. 404 if not found (`SelfInspectResult {id} not found`).
2. Change `STATUS` to the requested value (`PASS`/`FAIL`).
3. If `remark` is provided, update `REMARK`; if `measureValue` is provided, update `MEASURE_VALUE` (keep existing if undefined).
4. If `status !== 'PENDING'`, set `INSPECTED_AT = current time` (= record inspection completion time).
5. Save. Response message: `Status changed to {status}`.

> Pass/fail judgment is **manual by the inspector**, not automatic LSL/USL comparison. The screen directly reflects the PASS/FAIL button click value to STATUS (specifications are for reference display).

## Prerequisites (Master)
- In the process self-inspection item master (`SELF_INSPECT_ITEMS`), set the item's `INSPECT_METHOD='DELEGATE'` → kiosk generates PENDING results instead of direct judgment.
- For measurement-type items, fill in `ITEM_TYPE='MEASURE'` + `LSL_VALUE`/`USL_VALUE`/`UNIT` so specifications appear on this screen.
- Item master create/edit via self-inspection item management API (`/production/self-inspect/items`).

## Operating Procedure
1. On screen entry, `GET /delegates` is auto-called → pending list loaded (oldest first).
2. Select item → measure → enter measurement value/remark → PASS/FAIL.
3. After judgment, list auto-refreshes, processed entry removed.
4. When backlog accumulates, process by work order to prioritize releasing the kiosk block for that order.

## Permissions
JWT authentication required (`JwtAuthGuard`). Quality staff perform judgment. Multi-tenancy scope (COMPANY/PLANT_CD) injected from token context.

## Troubleshooting
| Symptom | Cause | Action |
|------|------|------|
| Kiosk result input blocked | `DELEGATE`+`PENDING` results exist for that work order | Judge PASS/FAIL on this screen → block released |
| Item not showing in pending list | Item is DIRECT or already PASS/FAIL, or different COMPANY/PLANT scope | Verify it is a DELEGATE item and within current site scope |
| LSL/USL·unit empty | Item is VISUAL or matching item has no spec set / JOIN miss | For measurement type, enter LSL/USL/UNIT in item master |
| 404 on judgment | ID from a different scope or already deleted | Verify it's current site (COMPANY=40/PLANT=1000) data and re-query |
| Measurement value not saved | Empty string not sent (undefined) | Enter a numeric value and click judgment button |

## Data & Integration
- Tables: `SELF_INSPECT_RESULTS`(results·status), `SELF_INSPECT_ITEMS`(inspection criteria JOIN).
- API: `GET /production/self-inspect/delegates`, `PATCH /production/self-inspect/results/:id/status`. Related: `GET /pending/:orderNo`(kiosk block check), `POST /results`(kiosk delegate load).
- Related screens: Production Kiosk (self-inspection delegate·result blocking), Self-Inspection Item Management (`SELF_INSPECT_ITEMS`).
- Scope: `COMPANY='40'`, `PLANT_CD='1000'`.
