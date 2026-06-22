---
menuCode: QC_DEFECT_CODE
audience: user
title: Defect Code Management
summary: Register defect codes under a 3-level classification (inspection stage, model type, defect category), assign defect grades (Critical/Major/Minor) and scope, for use in inspection and production result defect entry.
tags: [quality, defect code, defect classification, master, inspection]
keywords: [defect code, defect name, defect category, defect grade, defect classification, model type, inspection stage, scope, Critical, Major, Minor, IQC, LQC, OQC, low voltage, high voltage, LV, HV, level 1, level 2, level 3, classification]
related: [QC_DEFECT, QC_AQL, MST_PART]
---

# Defect Code Management

## Screen Purpose
Register and manage **defect codes** used when recording defects during inspection and production results. Defect codes are not used directly; they are first placed under a **3-level classification** (Inspection Stage → Model Type → Defect Category), then assigned a **defect grade** and **scope**.

> The 3-level classification: **Level 1 = Inspection Stage** (IQC incoming / LQC in-process / OQC outgoing), **Level 2 = Model Type** (Low Voltage LV / High Voltage HV), **Level 3 = Defect Category** (Function / Appearance / Other). Defect codes must be linked to a **Level 3 classification**.

## Screen Layout
- **Left — All Registered Defects**: Shows all defect codes in a table. Click a row to edit on the right. Use the top search bar to find by defect code or name.
- **Top Right — Add/Edit Defect Code**: All fields for a single defect code. All three classification levels must be selected sequentially to save.
- **Bottom Right — Quick Classification Add**: Area to create new classifications (inspection stage / model type / defect category) on the fly.

## Concept Relationship
```
Inspection Stage (Lv1) ──▶ Model Type (Lv2) ──▶ Defect Category (Lv3) ──Linked──▶ Defect Code ──(Grade/Scope)
   IQC/LQC/OQC              LV/HV                   Function/Appearance/Other   e.g., SOLDER-01
```
- The Model Type (LV/HV) is also automatically reflected in the defect code's **model type application list**. So the selected Level 2 determines which models the defect code applies to.

---

## ① Defect Code List Columns (Left Table)

| Column | Role / Description |
|------|------|
| **Defect Code (defectCode)** | Unique code identifying the defect. Selected in inspection and result screens. Example: `SOLDER-01`. Cannot be changed after registration (to prevent broken links). |
| **Defect Name (defectName)** | Human-readable defect name. Example: `Soldering defect`. Displayed in inspection screen lists. |
| **Level 1** | **Inspection stage** classification name for this defect code (IQC/LQC/OQC). Auto-displayed based on the Level 3 classification. |
| **Level 2** | **Model type** classification name (Low Voltage / High Voltage). |
| **Level 3** | **Defect category** classification name (Function / Appearance / Other). The classification the defect code is actually linked to. |
| **Grade (defectGrade)** | Defect severity: **Critical (CRITICAL)** = fatal to safety/function, **Major (MAJOR)** = significantly affects function, **Minor (MINOR)** = minor defects like appearance. Basis for pass/fail judgment and statistics. |
| **Scope (defectScope)** | Where this defect is used: **Common (COMMON)** = everywhere, **Raw Material (RAW_MATERIAL)** = for materials (incoming inspection), **Product (PRODUCT)** = finished products, **Process (PROCESS)** = production process. |
| **Use Flag (useYn)** | Only `Active (Y)` can be selected in inspections and results. `Inactive (N)` is excluded from lists. |

---

## ② Add/Edit Defect Code Fields (Top Right)

| Field | Role / Description |
|------|------|
| **Defect Code (defectCode)** | Unique code entered during new registration. Auto-converted to uppercase. **Locked and cannot be changed during editing**. |
| **Defect Name (defectName)** | Defect name. Required. |
| **Level 1 (Inspection Stage)** | Select an inspection stage classification (IQC/LQC/OQC). Level 2 becomes available only after Level 1 is selected. |
| **Level 2 (Model Type)** | Select a model type under Level 1 (LV/HV). The selected model type becomes the **applicable model** for this defect code. |
| **Level 3 (Defect Category)** | Select a defect category under Level 2 (Function/Appearance/Other). **The defect code is actually linked to this Level 3 classification**, so it must be selected to save. |
| **Grade (defectGrade)** | Select one: Critical / Major / Minor. Default is **Major**. |
| **Scope (defectScope)** | Select one: Common / Raw Material / Product / Process. Default is **Common**. |
| **Use Flag (useYn)** | Select Active or Inactive. |
| **Description (description)** | Supplementary description or criteria for the defect (optional). |

> Save conditions: **Defect code, defect name, and Level 3 classification** must all be filled in. Levels 1, 2, and 3 must be selected sequentially from top to bottom.

---

## ③ Quick Classification Add Fields (Bottom Right)

Used to create new inspection stages, model types, or defect category classifications.

| Field | Role / Description |
|------|------|
| **Classification Level (levelNo)** | Level of the classification to create: Level 1 (Inspection Stage) / Level 2 (Model Type) / Level 3 (Defect Category). |
| **Parent Classification (parentCategoryCode)** | The immediate parent classification for Level 2 or 3 categories. **Leave empty for Level 1** (no parent). Select Level 1 for Level 2, and Level 2 for Level 3. |
| **Category Code (categoryCode)** | Unique code for the classification. Converted to uppercase. Example: `IQC`, `IQC_LV`, `IQC_LV_FUNCTION`. |
| **Category Name (categoryName)** | Classification name. Example: `IQC`, `Low Voltage`, `Function`. |

> Classifications must match levels exactly. For example, a Level 2's parent must be Level 1, and Level 1 cannot have a parent.

---

## Usage Procedure
1. (If classifications do not exist) Use **Quick Classification Add** to create Level 1 (Inspection Stage) → Level 2 (Model Type) → Level 3 (Defect Category) in order.
2. In **Add Defect Code**, select Levels 1, 2, and 3 classifications, then enter the defect code, name, grade, and scope, and save.
3. Registered defect codes are available in [Defect Management], inspection, and the production result kiosk for defect entry.

## Input Rules / Validation
- Defect code, defect name, and Level 3 classification are required. If any is missing, saving is blocked.
- Defect code cannot be changed after registration (the code input field is locked during editing).
- Defect codes are linked **only to Level 3 (Defect Category)** classifications. They cannot be directly linked to Level 1 or Level 2.
- Defect codes can only be linked to `Active` classifications.

## FAQ
- **Q.** How are grades (Critical/Major/Minor) determined?
  **A.** Critical = fatal to safety or core function, Major = defect significantly affecting function, Minor = minor defects like appearance. Grades are used for pass/fail judgment and defect statistics.
- **Q.** Why do I need to select Level 2 (Model Type)?
  **A.** Even for the same defect, management may differ between LV and HV products, so defect codes are registered and aggregated separately by model type. The selected model type becomes the defect code's applicable model.
- **Q.** Should I delete a defect code I no longer use?
  **A.** Instead of deleting, set the **Use Flag to Inactive (N)**. This preserves links to past defect records.

## Related Screens
- [Defect Management](/quality/defect) — Record and manage defects using registered defect codes
- [AQL Standards](/quality/aql) — Incoming inspection pass/fail criteria
- [Part Master](/master/part) — Item model type standards
