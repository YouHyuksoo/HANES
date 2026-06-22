---
menuCode: QC_AQL
audience: user
title: AQL Standards
summary: Register and manage AQL policies and standards for pass/fail judgment of LOTs in incoming inspection (IQC), including judgment criteria by LOT size.
tags: [quality, IQC, AQL, incoming inspection, sampling]
keywords: [Acceptable Quality Limit, Major, Minor, inspection level, sampling inspection, Ac, Re, sample size, LOT, critical defect, policy code, AQL code, AQL value]
related: [MST_PART]
---

# AQL Standards

## Screen Purpose
Register and manage standards for **sampling inspection** pass/fail judgment of received LOTs during incoming inspection (IQC).
Since the entire LOT is not inspected — only a sample is — you need to define "how many samples to take (sample size), how many defects are acceptable (Ac), and how many constitute rejection (Re)." These criteria bundles are called **AQL policies** and **AQL standards**.

> AQL (Acceptable Quality Limit): The maximum acceptable defect level for a LOT. **Smaller values are stricter** (e.g., 1.0 is stricter than 2.5).

## Screen Layout
- **Left — AQL Policy Management**: Unit directly linked to items. Bundles which AQL standards to use for Major and Minor defects.
- **Top Right — AQL Standard List**: Standards at the AQL value level. Policies reference these standards.
- **Bottom Right — LOT Size Judgment Criteria**: Defines sample size, Ac, and Re for each LOT size range under a selected AQL standard.

## Concept Relationship
```
Part Master ──Linked──▶ AQL Policy ──(Major/Minor)──▶ AQL Standard ──▶ LOT Size Judgment Criteria (Sample Size, Ac, Re)
```

---

## ① AQL Policy Columns (IQC_AQL_POLICIES)

| Column | Role / Description |
|------|------|
| **Policy Code (policyCode)** | Unique code identifying the policy. **The 'AQL Policy' field in the part master references this code.** Example: `AQLP-II-1.0-2.5`. Cannot be changed after registration. |
| **Policy Name (policyName)** | Human-readable name. Example: `II Major 1.0 Minor 2.5`. |
| **Inspection Level (inspectionLevel)** | Level determining the sample size. Generally **II (Normal)** is used. I takes fewer samples (reduced), III takes more (tightened). The sample size is determined by the LOT size and inspection level. |
| **Major AQL (majorAqlCode)** | AQL standard to apply for **Major defects** (defects significantly affecting function or safety). Selects an item from the 'AQL Standard List' on the right. Typically a stricter (smaller value) standard than Minor. |
| **Minor AQL (minorAqlCode)** | AQL standard to apply for **Minor defects** (minor defects such as appearance). Typically a looser standard than Major. |
| **Critical Mode (criticalMode)** | Handling method for **Critical defects**. `IMMEDIATE_FAIL` means if any critical defect is found, the LOT is **immediately rejected** regardless of sample size or Ac count. |
| **Use Flag (useYn)** | Only `Y` is used for item linking and inspection. `N` = inactive (deactivated). |
| **Remark (remark)** | Management memo. |

---

## ② AQL Standard Columns (AQL_STANDARDS)

| Column | Role / Description |
|------|------|
| **AQL Code (aqlCode)** | Unique code identifying the AQL standard. The policy's Major/Minor field references this code. Example: `AQL-1.0`. Cannot be changed after registration. |
| **AQL Name (aqlName)** | Name of the standard. Example: `Normal Inspection AQL 1.0`. |
| **Inspection Level (inspectionLevel)** | The inspection level this standard assumes (usually II). |
| **AQL Value (aqlValue)** | **Acceptable Quality Limit numeric value** (e.g., 0.65, 1.0, 2.5). Represents the upper limit of the acceptable defect rate. **Smaller values are stricter**. Together with the sample size, determines Ac/Re. |
| **Use Flag (useYn)** | Only `Y` can be selected in policies. |
| **Remark (remark)** | Management memo. |

---

## ③ LOT Size Judgment Criteria (rules)

Even with the same AQL value, **larger LOTs require more sampling**, so separate sample sizes, Ac, and Re are defined for each LOT size range.

| Column | Role / Description |
|------|------|
| **lotQtyFrom** | **Start (lower limit)** of the LOT size range for this row. |
| **lotQtyTo** | **End (upper limit)** of the LOT size range for this row (e.g., 51–500). |
| **sampleSize (n)** | **Number of samples to inspect** from a LOT in this range. |
| **acceptQty (Ac)** | **Acceptance number**. If the number of defects found is **Ac or fewer**, the LOT is accepted. |
| **rejectQty (Re)** | **Rejection number**. If the number of defects found is **Re or more**, the LOT is rejected. (Typically Re = Ac + 1) |
| **Sort Order (sortOrder)** | Row display order. Automatically sorted by LOT quantity on save. |

> Judgment example: sample size n=13, Ac=1, Re=2 → Up to **1 defect** in 13 samples is acceptable; **2 or more defects** result in rejection.

---

## Usage Procedure
1. First, register the **AQL Standards** on the right (e.g., `AQL-1.0`, `AQL-2.5`). Fill in the **LOT Size Judgment Criteria** (sample size, Ac, Re) for each standard.
2. Create an **AQL Policy** on the left and link the above standards to **Major/Minor**.
3. In [Part Master], specify this policy in the item's **AQL Policy** field.
4. Thereafter, during incoming inspection of this item's receipt LOTs, pass/fail is automatically determined based on these criteria.

## Input Rules / Validation
- LOT quantity From cannot be greater than To.
- Re quantity must be greater than Ac quantity.
- LOT size ranges cannot overlap (the next range's From must be greater than the previous range's To).

## FAQ
- **Q.** Why are Major and Minor separate?
  **A.** To apply different acceptance criteria based on defect severity. Typically, Major defects have stricter criteria (smaller AQL), while Minor defects are looser.
- **Q.** Why are LOT size judgment criteria needed?
  **A.** Because larger LOTs require more samples to achieve the same confidence level (based on KS Q ISO 2859-1 sampling tables).
- **Q.** What happens if the policy is left empty (not linked to an item)?
  **A.** Automatic AQL judgment is not applied (no inspection or manual judgment).

## Related Screens
- [Part Master](/master/part) — Link AQL policies to items
