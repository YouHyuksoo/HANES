---
menuCode: MST_WAREHOUSE
audience: user
title: Warehouse / Location Management
summary: Register and manage warehouse master data, detailed locations within warehouses, and inter-warehouse transfer rules.
tags: [standard data, warehouse, location, stock]
keywords: [warehouse, warehouse code, warehouse name, warehouse type, location, storage location, detailed location, zone, area, rack, row, column, level, transfer rule, movement rule, from warehouse, to warehouse, allow, prohibit, default warehouse, raw material warehouse, semi-finished warehouse, finished goods warehouse, floor stock, defect warehouse, scrap warehouse, subcontractor]
related: [MST_PART]
---

# Warehouse / Location Management

## Screen Purpose
Register and manage **warehouses** where stock is stored and moved, **detailed storage locations (locations)** within warehouses, and **inter-warehouse transfer rules**. Warehouses and locations registered here serve as the basis for receiving, issuing, inventory, production results, and stock transfers.

## Screen Layout
The screen is divided into three tabs. The buttons at the top right (refresh/register) change according to the selected tab.

- **Warehouse Management Tab**: Warehouse master list (left grid) + search and warehouse type filter. Row ✏️ (edit) / 🗑️ (delete), top right **New Registration**. Click opens a registration/edit modal.
- **Location Tab**: Detailed location list within a warehouse + warehouse filter. Location registration/edit/delete.
- **Warehouse Transfer Rules Tab**: List of allow/prohibit rules for from-warehouse → to-warehouse transfers + add/edit/delete rules.

Relationship between the three areas:
```
Warehouse (WAREHOUSES)
  ├─ Location (WAREHOUSE_LOCATIONS)   : Multiple detailed locations within one warehouse
  └─ Transfer Rule (WAREHOUSE_TRANSFER_RULES) : Allow/prohibit warehouse ↔ warehouse transfers
```

---

## ① Warehouse Management Tab — Columns / Form Fields

| Column / Field | Role / Description |
|------|------|
| **Warehouse Code (warehouseCode)** | **Unique code** identifying the warehouse. Cannot be changed after registration (stock, results, and transfer rules are linked to this code). |
| **Warehouse Name (warehouseName)** | Warehouse name for identification on the shop floor. |
| **Warehouse Type (warehouseType)** | Usage classification of the warehouse. Receipt, stock, and production processing methods differ based on this value. Values: Raw Material (RAW) · Semi-Finished (WIP) · Finished Goods (FG) · Floor Stock (FLOOR) · Defect (DEFECT) · Scrap (SCRAP) · Subcontractor (SUBCON). |
| **Line (lineCode)** | Production line to which a **Floor Stock (FLOOR)** warehouse belongs. Only entered when the type is FLOOR. |
| **Process (processCode)** | Process to which a **Floor Stock (FLOOR)** warehouse belongs. Only entered when the type is FLOOR. |
| **Default (isDefault)** | Whether this is the default warehouse for the same type. The type-specific default warehouse is preferentially selected for automatic receiving/put-away. |
| **Use (useYn)** | Only `Y` items are visible, selectable, and usable. Set to `N` to deactivate. |

> Only **Floor Stock (FLOOR)** warehouse types show the line and process input fields. Other types do not use line/process.

## ② Location Tab — Columns / Form Fields

A warehouse can have multiple locations (bin/rack/shelf, etc.).

| Column / Field | Role / Description |
|------|------|
| **Warehouse (warehouseCode)** | The warehouse this location belongs to. Cannot be changed after registration. |
| **Location Code (locationCode)** | Code identifying the detailed location within the warehouse. Cannot be changed after registration (warehouse + location code combination is unique). |
| **Location Name (locationName)** | Location name for identification on the shop floor. |
| **Zone (zone)** | Zone classification within the warehouse. |
| **Row (rowNo)** | Rack/shelf row number. |
| **Column (colNo)** | Rack/shelf column number. |
| **Level (levelNo)** | Rack/shelf level number. |
| **Use (useYn)** | Only `Y` items are usable (displayed with ● green dot in the list). |
| **Remark (remark)** | Location management notes. |

## ③ Warehouse Transfer Rules Tab — Columns / Form Fields

Defines whether stock transfers from a source warehouse to a destination warehouse are allowed or prohibited. One rule per pair (from → to).

| Column / Field | Role / Description |
|------|------|
| **From Warehouse (fromWarehouse) / From Warehouse Code / Name** | Source warehouse for the transfer. Selected from the warehouse list in the form. |
| **To Warehouse (toWarehouse) / To Warehouse Code / Name** | Destination warehouse for the transfer. |
| **Allow (allowYn)** | Whether transfers on this route are allowed. `Allow (Y)` = from → to is possible, `Prohibit (N)` = blocked. |
| **Remark (remark)** | Transfer rule management notes. |

---

## Usage Procedure
1. In the **Warehouse Management Tab**, click **New Registration** at the top right to create a warehouse (warehouse code, name, and type are required; line/process for FLOOR type).
2. If needed, use the **Location Tab** to register detailed locations (zone/row/column/level) for the warehouse.
3. If you need to control inter-warehouse transfers, use the **Warehouse Transfer Rules Tab** to register from→to pairs and specify allow/prohibit.
4. Set the **Default** check for the warehouse to be used for automatic put-away by type.

## Input Rules / Validation
- Warehouse codes and location codes cannot be changed after registration (code field is disabled during editing).
- The same warehouse code, same (warehouse + location) combination, and same (from → to) pair cannot be duplicated.
- **Warehouses with remaining stock cannot be deleted.**

## FAQ
- **Q.** The line/process fields are not showing.
  **A.** You must select **Floor Stock (FLOOR)** as the warehouse type to display the line and process input fields.
- **Q.** I can't delete a warehouse.
  **A.** Deletion is blocked if there is remaining stock in the warehouse. Clear the stock first, or set the use flag to `N` to deactivate it.
- **Q.** Are transfers allowed between warehouse pairs without a registered rule?
  **A.** This depends on the operating policy. Routes with an explicit **Prohibit (N)** rule are blocked (see the operations guide).

## Related Screens
- [Part Master](/master/part) — Set default storage locations per item
