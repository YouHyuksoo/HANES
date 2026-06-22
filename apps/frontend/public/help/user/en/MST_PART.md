---
menuCode: MST_PART
audience: user
title: Part Master
summary: Register and manage identification, classification, specifications, IQC, and packaging standards for all items — raw materials, semi-finished products, finished products, and consumables.
tags: [standard data, item, master]
keywords: [part number, item code, item type, item group, vehicle model, model, specification, unit, IQC, incoming inspection, AQL, safety stock, expiry date, box quantity, packaging unit, storage location, ERP sync, item photo]
related: [QC_AQL]
---

# Part Master

## Screen Purpose
Register and manage the **basic information for all items (raw materials, semi-finished, finished products, consumables)** handled in MES. Items registered here become the basis for BOM, production, material transactions, incoming inspection, and inventory.

## Screen Layout
- **Left (List)**: Item grid. Top bar has item type, use status filter, part number/item name search, **ERP Sync**, and **Add Item**.
- **Right (Slide Panel)**: Registration/edit form opened by clicking ✏️ (edit) on a row or "Add Item".
- For IQC-target items (`iqcYn=Y`), you can set up **IQC inspection criteria** separately.

---

## ① Identification Info

| Column | Role / Description |
|------|------|
| **Item Code (itemCode)** | **Unique code** identifying the item within MES. Should not be changed once registered (BOM, inventory, and results are linked to this code). |
| **Part Number (itemNo)** | Part number used in drawings, ERP, and customer documents. The most commonly used number on the shop floor. |
| **Item Name (itemName)** | Item name for identification on the shop floor. |
| **Customer Part Number (custPartNo)** | Part number used by the customer (for shipping/label matching). |
| **Rev (rev)** | Revision of the item drawing/specification. Tracks specification changes. |
| **Marking Text (markingText)** | Text to be printed on labels or transferred to marking equipment. |

## ② Classification

| Column | Role / Description |
|------|------|
| **Item Type (itemType)** | Major classification in the MES flow: Raw Material (RAW_MATERIAL), Semi-Finished (SEMI_PRODUCT), Finished (FINISHED), Consumable (CONSUMABLE). Material transaction and production processing methods differ based on this value. |
| **Item Group (productType)** | Product family/item group code (common code PRODUCT_TYPE). Referenced for circuit specifications, etc. |
| **Model (modelName)** | Management characteristic for distinguishing vehicle models. |

## ③ Specifications

| Column | Role / Description |
|------|------|
| **Specification (spec)** | Supplementary description of item specifications, dimensions, etc. |
| **Color (color)** | Item color information (e.g., wire color). |
| **Unit (unit)** | Base unit for quantity interpretation (EA, etc., common code UNIT_TYPE). Stock and issue quantities are based on this unit. |

## ④ Incoming Inspection (IQC)

| Column | Role / Description |
|------|------|
| **IQC Required (iqcYn)** | Whether incoming inspection is required upon receipt. If `Y`, IQC is applied to the receipt LOT. |
| **Inspection Method (inspectMethod)** | Application method for IQC (inspection/skip, etc., common code IQC_INSPECT_METHOD). |
| **Default Sample Qty (sampleQty)** | Default sample quantity for IQC inspection. (Separate from the sample size calculated by AQL.) |
| **AQL Policy (iqcAqlPolicyCode)** | **AQL policy** to apply to this item. Used to automatically calculate sample size, Accept (Ac), and Reject (Re) during LOT inspection. Policies are registered in [AQL Standards]. If empty, automatic AQL judgment is not applied. |

## ⑤ Quantity / Packaging

| Column | Role / Description |
|------|------|
| **Box Quantity (boxQty)** | Standard quantity per box (for packaging and box labels). |
| **Min Package Qty (minPackQty)** | Minimum unit quantity for material dispensing. |
| **LOT Unit Qty (lotUnitQty)** | Standard quantity for processing production items as a batch unit. |
| **Pallet Unit (packUnit)** | Pallet or upper packaging unit standard. |
| **Safety Stock (safetyStock)** | Reference quantity for determining stock shortage. Below this value is considered insufficient. |

## ⑥ Expiry

| Column | Role / Description |
|------|------|
| **Expiry Days (expiryDate)** | **Number of days** for the expiry period from receipt or manufacture. |
| **Expiry Extension Days (expiryExtDays)** | **Maximum days** the expiry can be extended after quality assessment. |

## ⑦ Other

| Column | Role / Description |
|------|------|
| **Storage Location (storageLocation)** | Default storage location fixed for the item. |
| **Photo (imageUrl)** | Item photo. Uploaded via the form and displayed as a list thumbnail. |
| **Use Flag (useYn)** | Only `Y` items are visible, selectable, and usable. Set to `N` to deactivate. |
| **Remark (remark)** | Item management notes. |

---

## ERP Sync
The **ERP Sync** button at the top imports the item master from ERP to **add/update** items in MES. A confirmation modal appears before execution. This can import tens of thousands of items at once, so only run when intended.

## Usage Procedure
1. Click **Add Item** (or ✏️ on a row) to open the slide form.
2. Enter **Identification Info** (item code, part number, item name) and **Classification** (item type).
3. Fill in required fields (specifications, IQC, packaging, expiry, etc.) and save.
4. For IQC-target items, link the **IQC inspection criteria** and the item's **AQL policy**.

## FAQ
- **Q.** What is the difference between item code and part number?
  **A.** The item code is the MES internal identifier (recommended to be immutable), while the part number is used in drawings, ERP, and customer documents.
- **Q.** What if I leave the AQL policy empty?
  **A.** Automatic AQL judgment is not applied during incoming inspection (no inspection or manual judgment).
- **Q.** An item was incorrectly added via ERP sync.
  **A.** Items imported via the ERP interface can be cleaned up by an operator (see the operations guide).

## Related Screens
- [AQL Standards](/quality/aql) — Register AQL policies linked to items
