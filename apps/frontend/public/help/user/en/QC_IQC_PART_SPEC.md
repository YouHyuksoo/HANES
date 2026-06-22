---
menuCode: QC_IQC_PART_SPEC
audience: user
title: Item-Specific IQC Item Management
summary: Register and manage inspection items, specifications (LSL/USL, judgment criteria), defect grades, and sampling methods for each material item in incoming inspection (IQC).
tags: [quality, IQC, incoming inspection, inspection item, standard data]
keywords: [per-item inspection, inspection item, inspection criteria, sample quantity, sample size, destructive test, non-destructive, LSL, USL, lower limit, upper limit, judgment criteria, defect grade, inspection level, AQL, inspection type, measure type, judgment type, full inspection, fixed sample, template]
related: [QC_IQC_ITEM, QC_AQL, MST_PART, QC_IQC]
---

# Item-Specific IQC Item Management

## Screen Purpose
Define **what to inspect during incoming inspection (IQC)** for each material item (raw material).
After selecting an item, register the **inspection items** (e.g., appearance, dimension, tensile strength) to apply, along with each item's **specifications** (upper/lower limits, judgment criteria), **defect grade**, and **sampling method**. The registered content is faithfully reflected as the inspection sheet on the actual incoming inspection screen.

> The inspection items themselves (name, judgment method, unit) are first registered in the [Inspection Item Pool]. This screen is where you **attach those items to a specific material item and fill in the specifications**.

## Screen Layout
- **Left — Material Item List**: List of raw material (RAW_MATERIAL) items. Search by item code or name. Items with registered inspection items show a **count badge** on the right.
- **Top Right — AQL Summary (Read-Only)**: A **read-only card** that pre-displays the sample size, Ac/Re, etc., calculated from the AQL policy linked to the selected item (based on the policy linked in the part master).
- **Bottom Right — Inspection Items**: Area to add, edit, delete inspection items for the item in a table, and [Save]. The top toolbar also sets the **default sample size** and **destructive test flag**.

## ① Material Item List (Left)

| Column | Role / Description |
|------|------|
| **Item Code / Name** | Raw material items for which to set inspection criteria. Click to display the item's inspection items on the right. |
| **Count Badge** | Number of **inspection items** registered for that item. No badge (unset) if 0; a number indicates items with registered criteria. |
| **Search** | Filter the list by item code or name. |

## ② AQL Summary Card (Top Right, Read-Only)
This card is a **reference summary**, not an input field. Values are automatically calculated from the **AQL policy** linked to the item in [Part Master] and the settings in [AQL Standards].

| Item | Role / Description |
|------|------|
| **LOT Quantity Preview** | Enter a hypothetical receipt LOT quantity to preview the resulting sample size, Ac/Re based on that quantity. |
| **AQL Policy** | The AQL policy code linked to this item in the part master. If empty, automatic AQL judgment is not applied. |
| **Default Sample Size** | The default sample size set in this item's inspection criteria header (same as the toolbar value below). |
| **Inspection Level** | The inspection level from the AQL policy (usually II). Determines sample size together with LOT size. |
| **Sample Quantity** | The calculated sample size based on the LOT quantity above. |
| **Major Ac/Re** | Accept (Ac) and Reject (Re) counts for Major defects. |
| **Minor Ac/Re** | Accept and Reject counts for Minor defects. |
| **Inspection Item Count** | Number of inspection items registered for this item. |
| **Destructive/Fixed** | Number of items with **destructive, full, or fixed sample** types that use separate sample sizes. |

## ③ Inspection Item Header (Bottom Right Toolbar)

| Item | Role / Description |
|------|------|
| **Default Sample Size** | Default sample count for this item's inspection (the default when individual items do not specify a fixed sample size). |
| **Destructive / Non-Destructive** | Whether this item's inspection destroys the sample. `Destructive` means the sample cannot be used after inspection. |
| **Load/Save Template** | Save frequently used inspection item sets as templates and apply them to new items at once. |
| **Add Item** | Adds one inspection item row and immediately enters edit mode. |
| **Save** | Saves the entire header and inspection item changes. Disabled when there are no changes. |

## ④ Inspection Item Columns

| Column | Role / Description |
|------|------|
| **Sequence (seq)** | Display order of items on the inspection sheet. Automatically renumbered when rows are added or deleted. |
| **Inspection Item (inspItemCode)** | Selects an item from the [Inspection Item Pool]. Upon selection, the type and unit are auto-filled. |
| **Type (judgeMethod)** | Judgment method of the item. **Measure (MEASURE)** = enter a numeric value and compare with LSL/USL, **Visual (VISUAL)** = check pass/fail by eye. LSL/USL are entered only for measure-type items. |
| **Inspection Type (inspectionType)** | Sampling method: `AQL` = auto-calculated from AQL table, `DESTRUCTIVE` = destructive test, `FULL` = 100% inspection. If not AQL, **sample size** is entered directly. |
| **Sample Size (sampleQty)** | **Fixed sample count** for destructive/full/fixed types. For AQL type, displays `Auto` and is not entered. |
| **Defect Grade (defectGrade)** | Severity of a defect in this item: `CRITICAL` · `MAJOR` · `MINOR`. Ac/Re is applied differently by grade in AQL judgment. |
| **Inspection Level (inspectionLevel)** | ISO 2859-1 inspection level (II, S4, etc.) applied to this item. Used to determine sample size. |
| **AQL** | Acceptable Quality Limit value for this item (0.65/1.0/2.5, etc.). **Smaller values are stricter**. |
| **LSL (Lower Spec Limit)** | **Minimum allowable value** for measure-type items. A measured value below this is a defect. |
| **USL (Upper Spec Limit)** | **Maximum allowable value** for measure-type items. A measured value above this is a defect. |
| **Judgment Criteria (judgeCriteria)** | Text description of pass/fail criteria for visual-type items (e.g., "No scratches or foreign matter"). |
| **Unit (unit)** | Unit of measurement. Auto-filled from the inspection item pool, for display only. |

> Example: Set the `Dimension` item as measure type with LSL=9.8, USL=10.2 → a measured value outside the 9.8–10.2 (mm) range is judged as a defect.

## Usage Procedure
1. On the left, select the **item** to configure inspection criteria for.
2. In the toolbar, set the **Default Sample Size** and **Destructive Test flag**.
3. Click **[Add Item]** (or **[Load Template]**) to add inspection items, then fill in the type, inspection type, defect grade, and specifications for each row.
4. For measure-type items, enter **LSL** and **USL**. For visual-type items, enter **Judgment Criteria**.
5. Edit each row with **[Edit]→[Confirm]**, then click **[Save]** at the end.

## Input Rules / Validation
- **Rows with an empty inspection item (inspItemCode) are not saved** (empty rows are auto-excluded).
- Items that are not measure-type cannot have LSL/USL entered (managed by judgment criteria).
- If the inspection type is `AQL`, the sample size is auto-calculated and not entered directly.
- Only one row can be edited at a time; editing locks other rows from modification or deletion.

## FAQ
- **Q.** I can't find the desired item in the inspection item selection list.
  **A.** It must first be registered (with `Use Flag = Y`) in the [Inspection Item Pool] to appear here.
- **Q.** Can I change the values in the AQL Summary card here?
  **A.** No. Those values are read-only reference information determined by the [Part Master]'s AQL policy link and [AQL Standards] configuration.
- **Q.** It's cumbersome to add the same items every time.
  **A.** Use [Load/Save Template] to save item sets and apply them to new items at once.

## Related Screens
- [Inspection Item Pool](/master/iqc-item) — First register inspection items (name, judgment method, unit)
- [AQL Standards](/quality/aql) — Define AQL policies, standards, and LOT judgment criteria
- [Part Master](/master/part) — Link AQL policies to items
- [IQC (Incoming Inspection)](/material/iqc) — Perform actual inspections using the registered items
