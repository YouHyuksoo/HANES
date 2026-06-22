---
menuCode: CONS_MASTER
audience: user
title: Consumable Master
summary: Register and manage identification, classification, expected life, safety stock, unit price, storage location, and product/equipment usage mappings for consumables such as molds, jigs, and tools.
tags: [consumable, master, standard data]
keywords: [consumable, consumable master, consumable code, mold, jig, tool, MOLD, JIG, TOOL, expected life, stroke count, warning threshold, safety stock, unit price, storage location, vendor, usage mapping, equipment part, product BOM, usage per unit, active status]
related: [MST_PART]
---

# Consumable Master

## Screen Purpose
Register and manage the **standard data for consumables (molds, jigs, tools, etc.)** used in production. Consumables registered here serve as the basis for receiving, issuing, inventory, lifespan (stroke count) management, consumable input in kiosk production records, and product/equipment usage mapping.

> Consumables are materials that wear out or deplete over time. This screen defines **what (code, name, classification), how long they last (expected life, warning threshold), where and how much to stock (safety stock, storage location), and where they are used (usage mapping)** — all in one place.

## Screen Layout
- **Left (List)**: Consumable grid. Use the top bar for **name/code search**, **category filter**, **refresh**, and **register consumable**.
- **Center (Slide Panel)**: Registration/editing form that opens when clicking ✏️ (edit) on a row or "Register Consumable".
- **Right (Usage Mapping Panel)**: When a row is selected, you can register, edit, or delete **product/equipment usage mappings** for that consumable.

## Two Usage Types for Consumables
Even with the same consumable master, it is used in two ways on the shop floor:
- **Equipment Mounting (molds, jigs, blades, etc.)**: Mounted on equipment, accumulating stroke count (usage count). Replaced when the expected life is reached. Managed under "Consumable Equipment Parts" in the kiosk.
- **Product BOM Input**: Consumable parts added during product manufacturing. Included in the product BOM and deducted based on production quantity.

> Which consumables are used for which products/equipment is defined in the **Usage Mapping** on the right panel.

---

## ① Basic Info

| Column | Role / Description |
|------|------|
| **Consumable Code (consumableCode)** | **Unique code** identifying the consumable (e.g., `CM-AP-110`). Connected to receiving, issuing, inventory, and usage mapping. Once registered, it should not be changed (locked in edit mode). |
| **Consumable Name (consumableName)** | Name for identification on the shop floor (e.g., `110 Terminal Crimping Mold`). |
| **Category (category)** | Type of consumable: Mold (MOLD), Jig (JIG), or Tool (TOOL) (common code CONSUMABLE_CATEGORY). Used for list filtering and statistics. |
| **Image (imageUrl)** | Photo of the consumable. Can only be uploaded **after saving (registering)**. Displayed as a list thumbnail. |

## ② Lifespan / Management

| Column | Role / Description |
|------|------|
| **Expected Life (expectedLife)** | **Accumulated stroke count (usage count)** before replacement is needed (e.g., `100000`). When the accumulated count reaches this value, the status changes to **Needs Replacement (REPLACE)**. |
| **Warning Threshold (warningCount)** | Stroke count that triggers an early replacement alert (e.g., `80000`). When the accumulated count reaches this value, the status changes to **Warning (WARNING)** to prepare for replacement. Usually set lower than the expected life. |
| **Safety Stock (safetyStock)** | Reference quantity for determining stock shortage. If the current stock falls below this value, it is considered insufficient. |

> The accumulated stroke count (current usage count) is automatically accumulated and reset through kiosk production and replacement processes. This screen only defines the **reference values (expected life, warning threshold)**.

## ③ Vendor / Location

| Column | Role / Description |
|------|------|
| **Storage Location (location)** | Default storage location for the consumable (e.g., `Mold Room-A1`). |
| **Vendor (vendor)** | Supplier/manufacturer of the consumable (e.g., `JST`). |
| **Unit Price (unitPrice)** | Price per unit. Used for receipt cost and asset valuation reference. |

---

## Usage Mapping (Right Panel)
Registers **which products (models) and equipment** use the selected consumable. This is the basis for finding consumables that match the work order (product/equipment) in kiosk production records.

| Item | Role / Description |
|------|------|
| **Product/Model (productItemCode)** | Product/model that uses this consumable. Only finished or semi-finished items can be selected. |
| **Equipment (equipCode)** | Equipment that uses this consumable when producing the product. |
| **Usage Per Unit (usagePerUnit)** | **Number of strokes (usage count) consumed per unit of production**. The consumable's stroke count accumulates by production quantity × this value. Default is 1. |
| **Active (useYn)** | Active only when `Y`. When `N`, the mapping is retained but excluded from use (toggle by clicking the `Y` badge in the list). |
| **Remark (remark)** | Notes for mapping management. |

> Usage mapping is one record per **product + equipment + consumable** combination. The same consumable can be mapped to multiple products and equipment.

## Usage Procedure
1. Click **Register Consumable** (or the row's ✏️) at the top to open the slide form.
2. Enter **Basic Info** (code, name, category) and save.
3. After saving, reopen the form to upload an **image** (upload is not available immediately after registration).
4. Fill in **Lifespan/Management** (expected life, warning threshold, safety stock) and **Vendor/Location** (storage location, vendor, unit price).
5. Select a consumable row in the list and register product, equipment, and usage per unit in the **Usage Mapping** on the right.

## Input Rules / Validation
- **Consumable Code** and **Consumable Name** are required. The save button is disabled if either is empty.
- Consumable Code cannot be duplicated (save is rejected if it already exists).
- Images can only be uploaded **after saving** (jpg/png/gif/webp, max 5MB).
- Usage mapping requires **both product and equipment to be selected** before saving.

## FAQ
- **Q.** I entered the wrong code and can't change it in edit mode.
  **A.** The consumable code is the key that connects receiving, issuing, inventory, and mappings, so it cannot be changed. Delete it and register again.
- **Q.** The image upload field is grayed out during registration.
  **A.** Images are uploaded after saving. First save the basic info, then reopen the form to upload.
- **Q.** What's the difference between expected life and warning threshold?
  **A.** When the warning threshold is reached, the status changes to **Warning (prepare for replacement)**. When the expected life is reached, it changes to **Needs Replacement**. It's a sequence of advance notice → actual replacement timing.
- **Q.** I can't find a consumable in the list.
  **A.** The list only shows active consumables (`useYn=Y`). Also check the category filter and search term.

## Related Screens
- [Part Master](/master/part) — Register products/models for usage mapping
