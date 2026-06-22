---
menuCode: QC_IQC_PART_SPEC
audience: operator
title: Per-Item IQC Item Management — Operator Guide
summary: Per-item IQC inspection criteria (header/inspection items) full column·DB mapping, inspection type·sample method logic, inspection item pool·AQL linkage and troubleshooting
tags: [quality, IQC, inspection, operations, reference data]
keywords: [IQC_PART_SPECS, IQC_PART_SPEC_ITEMS, IQC_ITEM_POOL, inspection item, inspection type, sample method, INSPECTION_TYPE, SAMPLE_METHOD, DESTRUCTIVE, FULL, AQL, FIXED, LSL, USL, defect grade, inspection level, multi-tenancy, troubleshooting]
related: [QC_IQC_ITEM, QC_AQL, MST_PART, QC_IQC]
---

# Per-Item IQC Item Management — Operator Guide

## System Purpose & Role
Defines **IQC inspection criteria sheets** per raw material item. Saves the header (sample qty·destructive test flag) and N inspection items (referencing the inspection item pool + specification·defect grade·sample method) in one go. These criteria become the inspection template in the IQC screen and the input for AQL judgment. Item definitions themselves come from the inspection item pool (`IQC_ITEM_POOL`), while sample size·Ac/Re thresholds come from AQL policies/standards.

## Data Structure
```
IQC_PART_SPECS (header: COMPANY+PLANT_CD+ITEM_CODE)
        │ 1:N (CASCADE)
        ▼
IQC_PART_SPEC_ITEMS (inspection items: +SEQ)
        │ (INSP_ITEM_CODE reference, eager)
        ▼
IQC_ITEM_POOL (inspection item pool: name·judgment method·unit)

ITEM_MASTERS.IQC_AQL_POLICY_CODE ──▶ AQL policy/standard (summary card·auto sample size calculation)
```

---

## ① Inspection Criteria Header — IQC_PART_SPECS (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Item Code | `ITEM_CODE` | Part of PK. Raw material item selected from left list. Queried via `/master/parts?itemType=RAW_MATERIAL`. |
| Default Sample Qty | `SAMPLE_QTY` | Default sample count when items don't have a fixed sample size. Default 1. |
| Destructive Test Flag | `IS_DEST` | `Y`=destructive test / `N`=non-destructive. Indicates sample consumption. |
| Use Flag | `USE_YN` | Only `Y` is an inspection target. Default `Y`. |
| Audit Columns | `CREATED_BY`/`UPDATED_BY`/`CREATED_AT`/`UPDATED_AT` | Creation/update history. `CREATED_AT`/`UPDATED_AT` use DB DEFAULT SYSTIMESTAMP. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | Part of PK. `COMPANY='40'`, `PLANT_CD='1000'` scope. |

> Save is an upsert that sends **header + all items in one POST** (`/master/iqc-part-specs`). Items are reconstructed on each save; rows with empty `INSP_ITEM_CODE` are excluded.

---

## ② Inspection Items — IQC_PART_SPEC_ITEMS (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Sequence | `SEQ` | Part of PK. Reassigned from 1 on save. |
| Inspection Item | `INSP_ITEM_CODE` | References `IQC_ITEM_POOL.INSP_ITEM_CODE` (eager). Type·unit come from the pool. |
| Type | (pool's `judgeMethod`) | `MEASURE`(measurement)=LSL/USL comparison / `VISUAL`(judgmental)=judgment criteria. Not stored in this table; determined by the pool. |
| Inspection Type | `INSPECTION_TYPE` | Common code `IQC_ITEM_INSP_TYPE`. `AQL`/`DESTRUCTIVE`/`FULL`. **NULL treated as AQL**. |
| Sample Method | `SAMPLE_METHOD` | Common code `IQC_SAMPLE_METHOD`. `AQL`(auto)/`FIXED`(fixed). Auto-set to `AQL` if inspection type is AQL, otherwise `FIXED`. **NULL treated as AQL**. |
| Sample Qty | `SAMPLE_QTY` | Fixed sample count (per LOT) for FIXED/DESTRUCTIVE/FULL. NULL for AQL (auto-calculated). |
| Defect Grade | `DEFECT_GRADE` | Common code `DEFECT_GRADE`. `CRITICAL`/`MAJOR`/`MINOR`. Used to apply grade-specific Ac/Re in AQL judgment. |
| Inspection Level | `INSPECTION_LEVEL` | Common code `AQL_INSP_LEVEL` (II, S4 etc.). Determines sample size. |
| AQL | `AQL` | Common code `AQL_VALUE` (0.65/1.0/2.5 etc.). Acceptable Quality Limit. Smaller = stricter. |
| LSL | `LSL` | Measurement type minimum allowable value. Below = defect. NUMBER(12,4). |
| USL | `USL` | Measurement type maximum allowable value. Above = defect. NUMBER(12,4). |
| Judgment Criteria | `JUDGE_CRITERIA` | Judgmental type pass/fail criteria text (max 500 chars). |
| Use Flag | `USE_YN` | Only `Y` applies. |
| Unit | (pool's `unit`) | Display only. Comes from the pool. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | Part of PK. `40` / `1000` scope. |

---

## Inspection Type·Sample Method Logic
- **Changing inspection type (`INSPECTION_TYPE`) links sample method**. Selecting `AQL` sets `SAMPLE_METHOD='AQL'` + `SAMPLE_QTY=NULL` (auto-calculated). Selecting other types (`DESTRUCTIVE`/`FULL`) switches to `SAMPLE_METHOD='FIXED'` for **direct sample qty input**.
- **Type (`judgeMethod`) is determined by the inspection item pool**. Only `MEASURE` opens LSL/USL input fields; `VISUAL` is managed via judgment criteria.
- The sample size·Ac/Re in the AQL summary card are not from this table — they are reference values calculated from the **item's AQL policy**(`/quality/aql/resolve-iqc-items`) based on LOT quantity.

## Prerequisites (Master·Common Code)
- Common codes: `DEFECT_GRADE`(defect grade), `AQL_INSP_LEVEL`(inspection level), `AQL_VALUE`(AQL value), `IQC_ITEM_INSP_TYPE`(inspection type), `IQC_SAMPLE_METHOD`(sample method)
- Masters: Inspection item pool (`IQC_ITEM_POOL`, `USE_YN='Y'`), raw material items (`ITEM_MASTERS` itemType=RAW_MATERIAL), item's AQL policy link (`ITEM_MASTERS.IQC_AQL_POLICY_CODE`)

## Operating Procedure
1. Register items (name·judgment method·unit) in [Inspection Item Pool] first.
2. Select item → set header (sample qty·destructive flag) → add inspection items (or apply template).
3. Enter per-item inspection type·defect grade·inspection level·AQL·spec (LSL/USL or judgment criteria) → save.
4. Link AQL policy in [Item Master] to populate the summary card and IQC auto sample size.

## Permissions
Quality administrator (criteria create/update). General users can only view.

## Troubleshooting
| Symptom | Cause | Action |
|------|------|------|
| Inspection item selection list empty | Inspection item pool not registered or `USE_YN='N'` | Register and activate items in [Inspection Item Pool] |
| Items disappear after save | Rows without `INSP_ITEM_CODE` selected are excluded | Select an inspection item for every row before saving |
| LSL/USL input fields not opening | Item type is `VISUAL` (judgmental) | Use judgment criteria instead, or replace with `MEASURE` item from the pool |
| Sample qty only shows `Auto` | Inspection type is `AQL` | Change to `DESTRUCTIVE`/`FULL` if fixed sample is needed |
| AQL summary card all `-` | AQL policy not linked to item | Set AQL policy in [Item Master] |
| Other plant data visible/invisible | `COMPANY`/`PLANT_CD` scope | Verify scope is `40`/`1000` |

## Data & Integration
- Tables: `IQC_PART_SPECS`(header), `IQC_PART_SPEC_ITEMS`(items, CASCADE)
- References: `IQC_ITEM_POOL`(inspection item pool), `ITEM_MASTERS`(item·AQL policy)
- Integration: Inspection item pool, AQL standard management (summary·sample size calculation), IQC inspection execution
- Scope: `COMPANY='40'`, `PLANT_CD='1000'`
