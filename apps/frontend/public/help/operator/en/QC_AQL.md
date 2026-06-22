---
menuCode: QC_AQL
audience: operator
title: AQL Standard Management — Operator Guide
summary: Full column meaning of AQL policy/standard/judgment criteria, DB mapping, judgment logic, item linkage and troubleshooting
tags: [quality, IQC, AQL, operations, settings]
keywords: [IQC_AQL_POLICIES, AQL_STANDARDS, item linkage, inspection level, critical defect, IMMEDIATE_FAIL, Ac, Re, sample size, troubleshooting, ITEM_MASTERS]
related: [MST_PART]
---

# AQL Standard Management — Operator Guide

## System Purpose & Role
Defines **AQL policies / AQL standards / LOT quantity-based judgment criteria** that serve as the basis for IQC judgment per item. The item master's AQL policy field (`ITEM_MASTERS.IQC_AQL_POLICY_CODE`) references this policy. During receiving LOT inspection, the system resolves policy → standard → LOT range to calculate sample size, Ac, and Re for automatic pass/fail judgment.

## Data Structure (3 Tiers)
```
ITEM_MASTERS.IQC_AQL_POLICY_CODE
        │ (reference)
        ▼
IQC_AQL_POLICIES  ──(MAJOR_AQL_CODE / MINOR_AQL_CODE)──▶  AQL_STANDARDS  ──(1:N)──▶  LOT qty-based judgment criteria (rules)
```

---

## ① AQL Policy — IQC_AQL_POLICIES (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Policy Code | `POLICY_CODE` | PK. Key referenced by Item Master. Immutable (prevents broken links). Naming convention recommended: `AQLP-{inspection level}-{Major}-{Minor}`. |
| Policy Name | `POLICY_NAME` | Display name. |
| Inspection Level | `INSPECTION_LEVEL` | Common code `AQL_INSP_LEVEL`. Determines code letter from LOT size. Standard is II. |
| Major AQL | `MAJOR_AQL_CODE` | References `AQL_STANDARDS.AQL_CODE` for major defects (FK-like). If unset, major defect auto-judgment is unavailable. |
| Minor AQL | `MINOR_AQL_CODE` | References `AQL_STANDARDS.AQL_CODE` for minor defects. |
| Critical Defect Mode | `CRITICAL_MODE` | `IMMEDIATE_FAIL` = LOT immediately fails if any critical defect occurs (regardless of sample size/Ac). |
| Use Flag | `USE_YN` | Only `Y` allows item linking and inspection. Soft deactivate policy to `N`. |
| Remark | `REMARK` | Notes. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | Policy managed under `COMPANY='40'`, `PLANT_CD='1000'` scope. |

---

## ② AQL Standard — AQL_STANDARDS (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| AQL Code | `AQL_CODE` | PK. Referenced by policy's Major/Minor. Immutable. Example: `AQL-1.0`. |
| AQL Name | `AQL_NAME` | Display name. |
| Inspection Level | `INSPECTION_LEVEL` | Common code `AQL_INSP_LEVEL`. Should be consistent with policy's inspection level. |
| AQL Value | `AQL_VALUE` | Common code `AQL_VALUE` (0.65/1.0/2.5 etc.). Acceptable Quality Limit value. **Smaller = stricter**. Combined with sample size to determine Ac/Re. |
| Use Flag | `USE_YN` | Only `Y` selectable in policies. |
| Remark | `REMARK` | Notes. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | `40` / `1000` scope. |

---

## ③ LOT Quantity-Based Judgment Criteria — Rules (All Columns)

One AQL standard can have multiple LOT range rows. Each LOT size range defines sample size, Ac, and Re (based on KS Q ISO 2859-1 table).

| Screen Field | Column | Role / Meaning |
|------|------|------|
| LOT From | `lotQtyFrom` | Lower bound of applicable LOT quantity range. |
| LOT To | `lotQtyTo` | Upper bound of applicable LOT quantity range. |
| Sample Size (n) | `sampleSize` | Number of inspection samples. |
| Ac | `acceptQty` | Acceptance number. Defect count ≤ Ac → Pass. |
| Re | `rejectQty` | Rejection number. Defect count ≥ Re → Fail. Typically Re = Ac + 1. |
| Sort Order | `sortOrder` | Re-sorted by LOT quantity on save. |

**Input validation (blocked on save)**: From ≤ To, Re > Ac, non-overlapping ranges (current To < next From).

---

## Judgment Logic (Receiving LOT Inspection)
1. Look up policy via item's `IQC_AQL_POLICY_CODE`. If absent, auto-judgment is not applied.
2. If critical defect exists and `CRITICAL_MODE='IMMEDIATE_FAIL'`, immediately fail.
3. For each of Major/Minor: resolve policy's AQL standard → select LOT range row matching LOT size → apply that row's n, Ac, Re.
4. Compare defect count by grade against Ac/Re for pass/fail judgment. If any grade fails, the LOT fails.

## Prerequisites (Master·Common Code)
- Common codes: `AQL_INSP_LEVEL`(inspection level), `AQL_VALUE`(AQL value)
- Register in order: AQL standards → LOT judgment criteria → policy, then link policy to item in Item Master

## Operating Procedure
1. Define `AQL_STANDARDS` (by AQL value) + register LOT range judgment criteria for each standard
2. Link criteria to Major/Minor in `IQC_AQL_POLICIES`, set inspection level and critical defect mode
3. Link policy to item in [Item Master] (`ITEM_MASTERS.IQC_AQL_POLICY_CODE`)
4. Verify auto-judgment during receiving LOT inspection

## Permissions
Quality administrator (standard create/update). General users can only view.

## Troubleshooting
| Symptom | Cause | Action |
|------|------|------|
| AQL auto-judgment not working in inspection | Policy not linked to item | Set AQL policy in Item Master |
| Standard not selectable in policy | AQL standard `USE_YN='N'` | Activate standard to `Y` |
| Judgment missing for specific LOT size | No range row covering that quantity | Add LOT range row (eliminate gaps) |
| Critical defect passed | `CRITICAL_MODE` not set | Set `IMMEDIATE_FAIL` in policy |
| Save rejected (range overlap/Re≤Ac) | Input validation violation | Fix: From≤To, Re>Ac, non-overlapping ranges |

## Data & Integration
- Tables: `IQC_AQL_POLICIES`, `AQL_STANDARDS`(+ LOT judgment criteria rules)
- Integration: Item Master (`ITEM_MASTERS.IQC_AQL_POLICY_CODE`), IQC judgment engine
- Scope: `COMPANY='40'`, `PLANT_CD='1000'`
