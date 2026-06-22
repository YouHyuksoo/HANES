---
menuCode: QC_DEFECT_CODE
audience: operator
title: Defect Code Management — Operator Guide
summary: Defect 3-level classification (inspection stage/model group/defect type) and defect code master full column·DB mapping, model group common code linkage, grade/scope code values, operating procedure and troubleshooting
tags: [quality, defect code, operations, master, settings]
keywords: [DEFECT_CODE_MASTERS, DEFECT_CATEGORY_MASTERS, DEFECT_CODE_PRODUCT_TYPES, DEFECT_MODEL_GROUP, DEFECT_LOGS, defect grade, defectGrade, CRITICAL, MAJOR, MINOR, defect scope, defectScope, RAW_MATERIAL, PRODUCT, PROCESS, COMMON, inspection stage, IQC, LQC, OQC, model group, LV, HV, low voltage, high voltage, defect type, 3-level, hierarchy, COMPANY, PLANT_CD, troubleshooting]
related: [QC_DEFECT, QC_AQL, MST_PART]
---

# Defect Code Management — Operator Guide

## System Purpose & Role
The defect code master is the **single source of truth for defect codes** used in inspection (IQC/LQC/OQC) and production result defect registration. Defect codes are linked only at the **3-level** of the **3-level classification hierarchy** (Level 1: inspection stage → Level 2: model group → Level 3: defect type). Each code has a **defect grade**, **defect scope**, and **model group application list**. Defect history (`DEFECT_LOGS.DEFECT_CODE`) references this code.

## Data Structure (3 Tiers + Model Mapping)
```
DEFECT_CATEGORY_MASTERS (self-referencing tree, LEVEL_NO 1→2→3)
  Level 1 Inspection Stage: IQC / LQC / OQC
    Level 2 Model Group: {stage}_LV / {stage}_HV         (e.g., IQC_LV)
      Level 3 Defect Type: {level2}_FUNCTION / _APPEARANCE / _ETC   (e.g., IQC_LV_FUNCTION)
                             │ (CATEGORY_CODE, only Level 3 linked)
                             ▼
DEFECT_CODE_MASTERS ──(DEFECT_CODE)──▶ DEFECT_CODE_PRODUCT_TYPES (per model group application, 1:N)
                                              │ PRODUCT_TYPE = DEFECT_MODEL_GROUP code (LV/HV)
DEFECT_LOGS.DEFECT_CODE ──(reference)──▶ DEFECT_CODE_MASTERS.DEFECT_CODE
```
- Level 2 codes follow `{level1}_{model group}` convention (e.g., `IQC_LV`). The screen strips the prefix (`IQC_`) from the Level 2 code to derive the model group (`LV`), and saves it as 1 record in `DEFECT_CODE_PRODUCT_TYPES.PRODUCT_TYPE`.

---

## ① Defect Category — DEFECT_CATEGORY_MASTERS (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Category Code | `CATEGORY_CODE` | PK. Node key in self-referencing tree. Naming convention: Level 1 `IQC`, Level 2 `IQC_LV`, Level 3 `IQC_LV_FUNCTION`. Uppercase. |
| Category Name | `CATEGORY_NAME` | Display name (e.g., `IQC`, `Low Voltage`, `Function`). |
| Level No. | `LEVEL_NO` | `1`=inspection stage, `2`=model group, `3`=defect type. Defect codes can only link to Level 3. |
| Parent Category | `PARENT_CATEGORY_CODE` | Parent node (self FK `FK_DEFECT_CATEGORY_PARENT`). NULL for Level 1. Parent level must be `current-1` (server validated). |
| Sort Order | `SORT_ORDER` | Tree display order. |
| Use Flag | `USE_YN` | Only `Y` shown in options and linkable. Discontinued categories set to `N` (soft deactivation). |
| Description | `DESCRIPTION` | Notes. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | Part of PK. Standard scope `COMPANY='40'`, `PLANT_CD='1000'`. |
| (Audit) | `CREATED_BY` / `UPDATED_BY` / `CREATED_AT` / `UPDATED_AT` | Creator/modifier/time. |

Query API `GET /quality/defect-codes/categories` assembles flat rows into a tree.

---

## ② Defect Code — DEFECT_CODE_MASTERS (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Defect Code | `DEFECT_CODE` | PK. Key referenced by `DEFECT_LOGS`. Immutable after registration (locked on screen). Uppercase normalized. |
| Defect Name | `DEFECT_NAME` | Display name. Required. |
| (Level 3) Category | `CATEGORY_CODE` | Linked Level 3 category code. Server validates it has `LEVEL_NO=3` and `USE_YN='Y'` (`assertLeafCategory`). Screen list's Level 1·2·3 are derived by traversing parents from this code. |
| Grade | `DEFECT_GRADE` | `CRITICAL`=critical (safety·core function), `MAJOR`=major, `MINOR`=minor. Default `MAJOR`. Basis for inspection pass/fail and statistics. |
| Scope | `DEFECT_SCOPE` | `COMMON`=common, `RAW_MATERIAL`=raw material, `PRODUCT`=product, `PROCESS`=process. Default `COMMON`. When filtering by `defectScope` in `findOptions`, both the matching scope and `COMMON` are shown. |
| Use Flag | `USE_YN` | Only `Y` shown in options/inspection. Soft deactivation via `USE_YN='N'` (DELETE API). |
| Description | `DESCRIPTION` | Notes (max 500 chars). |
| Sort Order | `SORT_ORDER` | List/option sort key (ASC, then code order). |
| (Model Group Appl.) | — (separate table) | Model group (LV/HV) derived from screen Level 2 selection and saved to `DEFECT_CODE_PRODUCT_TYPES`. Not a column in this table. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | Part of PK. `40` / `1000` scope. |
| (Audit) | `CREATED_BY` / `UPDATED_BY` / `CREATED_AT` / `UPDATED_AT` | Creator/modifier/time. |

---

## ③ Model Group Application Mapping — DEFECT_CODE_PRODUCT_TYPES (All Columns)

Maps N model group applications to 1 defect code (currently saves 1 record derived from Level 2).

| DB Column | Role / Meaning · Operational Notes |
|------|------|
| `COMPANY`, `PLANT_CD`, `DEFECT_CODE`, `PRODUCT_TYPE` | Composite PK. `PRODUCT_TYPE` is the DETAIL_CODE of common code `DEFECT_MODEL_GROUP` (`LV`=low voltage, `HV`=high voltage). |
| `CREATED_BY`, `CREATED_AT` | Creator/time. |

Save logic (`replaceProductTypes`): Delete all existing mappings for the defect code, then INSERT new ones (full replacement). The screen derives 1 model group from the Level 2 code.

---

## Code Value Summary (Options·Common Codes)

| Category | Value | Meaning |
|------|------|------|
| Grade `DEFECT_GRADE` | CRITICAL / MAJOR / MINOR | Critical / Major / Minor |
| Scope `DEFECT_SCOPE` | COMMON / RAW_MATERIAL / PRODUCT / PROCESS | Common / Raw Material / Product / Process |
| Model Group `DEFECT_MODEL_GROUP` (common code) | LV / HV | Low Voltage / High Voltage |
| Inspection Stage (Level 1 category) | IQC / LQC / OQC | IQC / In-Process Inspection / OQC |
| Defect Type (Level 3 category) | FUNCTION / APPEARANCE / ETC | Function / Appearance / Other |

> Grade and Scope are fixed screen enums (server DTO `IsIn`). Only Model Group is extensible via common code (`DEFECT_MODEL_GROUP`).

## Prerequisites (Master·Common Code)
- Common code `DEFECT_MODEL_GROUP`(LV/HV) registered — basis for Level 2 category·model group mapping.
- Category tree: Level 1 (IQC/LQC/OQC) → Level 2 (`{stage}_LV`/`{stage}_HV`) → Level 3 (`{level2}_FUNCTION`/`_APPEARANCE`/`_ETC`) must be built first.
- Use flag `USE_YN` common code (screen use flag select).

## Operating Procedure
1. Verify/register `DEFECT_MODEL_GROUP` common code (LV/HV).
2. Use quick-add to build the 1→2→3 level category tree (levels must increment by 1 to save).
3. Register defect code: select Level 1·2·3 + enter defect code·name·grade·scope. Level 2 selection value is saved as the model group mapping.
4. Verify code appears in [Defect Management]·Inspection·Production Result Kiosk.
5. Discontinue codes by switching to `USE_YN='N'` (deletion prohibited).

## Permissions
Quality administrator (category·code create/update/discontinue). General users can only view and select in inspection/results.

## Troubleshooting
| Symptom | Cause | Action |
|------|------|------|
| "Enter a Level 3 category" on save | Level 1·2·3 not all selected | Select all 1→2→3 in order |
| "Defect codes can only link to Level 3 categories" | Level 1 or 2 code set as category | Select a Level 3 (defect type) category |
| "Only active defect categories can be linked" | Target Level 3 category `USE_YN='N'` | Activate category to `Y` |
| Level 2 options not showing | Level 1 not selected, or no/lower-level 2 subcategories exist/are inactive | Select Level 1 first, register and activate Level 2 categories |
| Defect code not showing in inspection/results | Code `USE_YN='N'` or scope·model mismatch | Activate code, check `DEFECT_SCOPE` and model group |
| "Defect code already exists" | Duplicate code registration | Use a different code (unique within tenant) |
| Model group mapping empty | Level 2 does not follow `{stage}_{model}` convention | Standardize Level 2 code to `IQC_LV` format |

## Data & Integration
- Tables: `DEFECT_CATEGORY_MASTERS`(category tree), `DEFECT_CODE_MASTERS`(code), `DEFECT_CODE_PRODUCT_TYPES`(model group mapping).
- API: `GET/POST /quality/defect-codes/categories`, `PUT .../categories/:categoryCode`, `GET /quality/defect-codes`, `GET /quality/defect-codes/options`, `POST /quality/defect-codes`, `PUT/DELETE /quality/defect-codes/:defectCode`.
- Integration: Defect history (`DEFECT_LOGS.DEFECT_CODE`), Defect Management (`/quality/defect`), Integrated Inspection (`/inspection/integrated`), Production Result Kiosk defect input.
- Scope: `COMPANY='40'`, `PLANT_CD='1000'` (included in PK of all tables).
