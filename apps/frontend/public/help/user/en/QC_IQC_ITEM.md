---
menuCode: QC_IQC_ITEM
audience: user
title: Inspection Item Master
summary: Register and manage global inspection items used in IQC (incoming inspection). Defines item code, name, judgment method, and unit.
tags: [quality, IQC, incoming inspection, inspection item, standard data]
keywords: [inspection item, inspection item master, item pool, inspection item pool, item code, judgment method, visual, measurement, measure, VISUAL, MEASURE, unit, incoming inspection, IQC]
related: [QC_IQC_PART_SPEC, QC_IQC, QC_AQL]
---

# Inspection Item Master

## Screen Purpose
Register and manage **global inspection items** used in incoming inspection (IQC) in one place. Items created here serve as a **shared item pool** that can be selected per item in [Item-Specific IQC Item Management](/master/iqc-part-spec). This avoids re-creating the same inspection items (e.g., appearance, dimensions) for every item.

## Screen Layout
- **Left — Inspection Item List (Grid)**: Displays registered inspection items in a table. Provides search and judgment method filters.
- **Right — Add/Edit Panel**: Opens as a slide from the right when clicking `Add Inspection Item` or the edit (✎) icon on a row.

## ① Inspection Item List (Grid) Columns

| Column | Role / Description |
|---|---|
| **Edit / Delete** | ✎ opens the edit panel, 🗑 deletes (after confirmation). Be careful when deleting items in use on other screens. |
| **Item Code (inspItemCode)** | Unique identifier for the inspection item. Referenced by this code in item-specific criteria. **Cannot be changed after registration** (key). |
| **Inspection Item (inspItemName)** | Inspection item name. Example: Appearance, Dimension, Tensile Strength, Color. The name seen by the actual inspector. |
| **Judgment Method (judgeMethod)** | How to judge the inspection result. **Visual (VISUAL)** = pass/fail by eye, **Measure (MEASURE)** = compare measured value against specifications. Distinguished by color badges. |
| **Unit (unit)** | Measurement unit for measure-type items (mm, g, etc.). Selected from common code `UNIT_TYPE`. Visual items are usually left empty. |

> Top toolbar: **Search** (code/item name), **Judgment Method Filter** (Visual/Measure), **Refresh**, **Add Inspection Item**.

## ② Add / Edit Inspection Item Columns

Clicking `Add Inspection Item` shows the following input fields in the right panel.

| Column | Role / Description |
|---|---|
| **Item Code** | Required. Unique code for the item. **Locked and cannot be changed during editing** (key). Only entered during new registration. |
| **Judgment Method** | Required selection. **Visual** or **Measure**. If Measure is selected, specifying a unit is recommended. |
| **Inspection Item** | Required. Inspection item name. |
| **Unit** | Optional. Selected from common code `UNIT_TYPE` list (mm, g, kg, etc.). Can be left empty for visual items. |

## Usage Procedure
1. Click `Add Inspection Item`.
2. Enter **Item Code** and **Inspection Item**, then select a **Judgment Method**.
3. If it is a measure-type item, select a **Unit**.
4. Click `Add` to save.
5. The registered item can then be linked to an item and configured with specifications (upper/lower limits, judgment criteria) in [Item-Specific IQC Item Management](/master/iqc-part-spec).

## Input Rules / Validation
- **Item Code** and **Inspection Item** are required. If either is empty, the save button is disabled.
- **Item Code cannot be changed after registration**. If entered incorrectly, delete it and register again.
- Search performs a partial match on **Item Code** and **Inspection Item Name**.

## FAQ
- **I want to change the item code** — The code is a key and cannot be modified. Delete it and register with a new code (if already linked to items, the links must be re-established).
- **Where do I enter LSL/USL specifications or judgment criteria?** — This screen only defines **shared items**. Per-item specifications, judgment criteria, and sampling methods are set per item in [Item-Specific IQC Item Management](/master/iqc-part-spec).
- **What is the difference between Visual and Measure?** — Visual is pass/fail judged by eye (e.g., appearance scratches), Measure is using a measuring instrument to compare values against specifications (e.g., dimension in mm).

## Related Screens
- [Item-Specific IQC Item Management](/master/iqc-part-spec) — Select inspection items for each item and set specifications
- [IQC (Incoming Inspection)](/material/iqc) — Perform incoming inspection on received materials
- [AQL Standards](/quality/aql) — Sampling acceptance quality limit criteria
