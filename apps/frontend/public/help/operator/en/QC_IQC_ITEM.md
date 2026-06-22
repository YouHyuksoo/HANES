---
menuCode: QC_IQC_ITEM
audience: operator
title: Inspection Item Master — Operator Guide
summary: IQC global inspection item pool (IQC_ITEM_POOL) management screen operator guide. Screen field↔DB column mapping, judgment method values, related screens.
tags: [quality, IQC, inspection, inspection item, reference data, operator guide]
keywords: [IQC_ITEM_POOL, inspection item pool, INSP_ITEM_CODE, INSP_ITEM_NAME, JUDGE_METHOD, LSL, USL, CRITERIA, USE_YN, judgment method, visual, measure, unit, UNIT_TYPE, multi-tenancy]
related: [QC_IQC_PART_SPEC, QC_IQC, QC_AQL]
---

# Inspection Item Master — Operator Guide

## System Purpose & Role
This is the **shared inspection item pool** for the IQC system. Items registered here are referenced by [Per-Item IQC Item Management](/master/iqc-part-spec) to configure which items and specifications each item should be inspected against. Responsibility is split into **item definition (here) ↔ per-item application/specification (Per-Item IQC Item Management)**.

## Data Structure
```
IQC_ITEM_POOL (inspection item pool · this screen)
   └─ Referenced by INSP_ITEM_CODE ─▶ IQC_PART_SPEC_ITEMS (per-item inspection item details)
                                      └─ IQC_PART_SPECS (per-item IQC criteria header)
```
- This screen's API: `GET/POST/PUT/DELETE /master/iqc-item-pool`
- Key: `INSP_ITEM_CODE` (+ multi-tenancy `COMPANY`/`PLANT_CD`)

## ① Inspection Item — IQC_ITEM_POOL (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|---|---|---|
| **Item Code** | `INSP_ITEM_CODE` | Inspection item identification key (NOT NULL). Input only on new registration, locked on edit. Exercise caution deleting codes in use since per-item details reference this code. |
| **Inspection Item** | `INSP_ITEM_NAME` | Inspection item name (NOT NULL). |
| **Judgment Method** | `JUDGE_METHOD` | NOT NULL. Screen selection values: **VISUAL=visual / MEASURE=measurement**. (DB column comments still show NUMERIC/VISUAL/GONOGG notation, but this screen uses VISUAL·MEASURE.) |
| **Unit** | `UNIT` | Measurement unit (NULL allowed). Selected from common code `UNIT_TYPE`. Used for measurement items. |
| (Not edited here) | `CRITERIA` | Judgment criteria text. Not entered on this screen — per-item specifications managed in IQC_PART_SPEC_ITEMS. |
| (Not edited here) | `LSL` / `USL` | Lower/upper spec limit (NUMBER). Not edited on this screen (per-item spec in Per-Item IQC Item Management). |
| (Not edited here) | `REVISION` | Revision number (NOT NULL). |
| (Not edited here) | `EFFECTIVE_DATE` | Effective date. |
| (Not edited here) | `USE_YN` | Use flag (NOT NULL, default Y). Managed via deletion on this screen (no toggle UI). |
| (Not edited here) | `REMARK` | Notes. |
| Scope | `COMPANY` / `PLANT_CD` | Multi-tenancy scope (NOT NULL). Default `40` / `1000`. |
| Audit | `CREATED_BY` `UPDATED_BY` `CREATED_AT` `UPDATED_AT` | Creation/update tracking. CREATED_AT/UPDATED_AT are NOT NULL (default SYSTIMESTAMP). |

> This screen's form directly edits only 4 fields: `INSP_ITEM_CODE / INSP_ITEM_NAME / JUDGE_METHOD / UNIT`. The rest (CRITERIA·LSL·USL·USE_YN etc.) are created with defaults; per-item specifications are set in Per-Item IQC Item Management.

## Judgment Method (JUDGE_METHOD) Values
| Value | Screen Label | Meaning |
|---|---|---|
| `VISUAL` | Visual | Pass/fail judged by eye (appearance etc.). No unit needed. |
| `MEASURE` | Measurement | Spec (LSL/USL) comparison with measurement tool value. Unit recommended. |

## Prerequisites (Master·Common Code)
- Common code `UNIT_TYPE` — unit dropdown source. Add missing units (mm, g, kg etc.) in [Common Code Management] first.

## Operating Procedure
1. `Add Inspection Item` → enter item code, inspection item name, judgment method (·unit) → save (`POST /master/iqc-item-pool`).
2. Edit via row ✎ → modify fields except code (`PUT /master/iqc-item-pool/{code}`).
3. Delete via 🗑 → confirm (`DELETE /master/iqc-item-pool/{code}`). **Check impact before deleting codes in use by per-item details.**

## Permissions
- Managed by users with reference data master registration authority (quality/reference data administrator).

## Troubleshooting
| Symptom | Cause | Action |
|---|---|---|
| Unit dropdown empty | Common code `UNIT_TYPE` not registered | Add unit codes in Common Code Management |
| Save button disabled | Item code or inspection item name not entered | Enter both required fields |
| Item code cannot be modified | Code is a key (locked on edit) | Delete and re-register (also reset linkages) |
| Item disappears from item inspection after deletion | Per-item details reference this code | Check usage in Per-Item IQC Item Management before deletion |

## Data & Integration
- Table: `IQC_ITEM_POOL`
- Related screens: [Per-Item IQC Item Management](/master/iqc-part-spec) (references this pool), [IQC](/material/iqc)
- Multi-tenancy scope: `COMPANY='40'`, `PLANT_CD='1000'`
