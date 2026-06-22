---
menuCode: MST_BOM
audience: user
title: BOM Management
summary: Register and manage the bill of materials (child items, quantities, operations, and validity periods) for parent items in a tree structure.
tags: [standard data, BOM, bill of materials, master]
keywords: [bill of materials, parent item, child item, quantity, qtyPer, operation, revision, side, validity period, BOM tree, level, explosion, Excel upload, ECO]
related: [MST_PART]
---

# BOM Management

## Screen Purpose
Manage the **Bill of Materials (BOM)** that defines which **child items (materials)** make up a finished or semi-finished product. The registered structure serves as the basis for material requirement calculation (explosion) and input during production.

## Screen Layout
- **Left**: Parent item (finished/semi-finished product) selection.
- **Right**: **BOM tree** for the selected parent item. If a child item has its own sub-items, it expands by **Level (Lv)** (recursive structure). Rows can be collapsed/expanded (collapse all / expand all).
- **Excel Upload**: Register multiple BOM rows at once.
- Row add/edit is done via the BOM form, and the child item's operation routing can also be viewed.

## Concept Relationship
```
Parent Item (Finished Product) ─┬─ Child Item A (Quantity)
                                ├─ Child Item B (Quantity)
                                └─ Semi-Finished C (Quantity) ─┬─ Child Item C1
                                                               └─ Child Item C2
```

---

## BOM Columns (BOM_MASTERS)

| Column | Role / Description |
|------|------|
| **Lv (Level)** | Depth in the BOM tree. Level 1 is directly below the parent, level 2 means the child item is itself a parent, etc. (calculated, not stored). |
| **Child Item Code (childItemCode)** | **Code of the child item** that makes up the parent. Must be an item registered in the part master. (Parent + child item + revision = row key) |
| **Child Item Name (childPartName)** | Name of the child item (from part master, for display). |
| **Type (type)** | Item type of the child (raw material, semi-finished, etc., from part master). Semi-finished items expand further into sub-BOMs. |
| **Operation (oper)** | **Operation** where this child item is consumed. Specifies which operation requires it. |
| **Quantity (qtyPer)** | **Quantity of this child item required to make one parent**. Total requirement = production quantity × quantity. |
| **Revision (revision)** | BOM configuration revision (default `A`). Differentiates versions of the same parent-child pair (part of the key). |
| **Side (side)** | Identifies the application side (e.g., TOP/BOT) for double-sided boards. |
| **Valid From (validFrom)** | Date from which this BOM row is effective. |
| **Valid To (validTo)** | Date after which this BOM row is no longer effective. |

### Additional Fields in the Form
| Column | Role / Description |
|------|------|
| **Sequence (seq)** | Display/processing order of child items within the same parent. |
| **BOM Group (bomGrp)** | Classification value for grouping BOMs. |
| **ECO Number (ecoNo)** | Engineering Change Order tracking number. For change history. |
| **Remark (remark)** | Memo. |
| **Use Flag (useYn)** | Only effective when `Y`. |

---

## Usage Procedure
1. Select a **parent item** on the left.
2. Select a row in the right tree and **add a child item** (enter child item code, quantity, operation, validity period).
3. If the child item is semi-finished, it becomes a parent for further sub-BOMs.
4. For bulk entries, use **Excel Upload**.

## Input Rules
- The child item code must exist in the part master.
- Quantity must be greater than 0.
- The same parent + child item + revision combination cannot be duplicated (it is the row key).

## FAQ
- **Q.** How is the Level (Lv) determined?
  **A.** It is not manually entered. It deepens automatically when a child item has its own BOM (recursive explosion).
- **Q.** What is the quantity based on?
  **A.** It is the quantity of the child item needed to make one parent. Total required = production quantity × quantity.
- **Q.** Why is revision part of the key?
  **A.** Because different configurations can exist for the same parent-child pair under different specification revisions.

## Related Screens
- [Part Master](/master/part) — Parent/child items must be registered first
