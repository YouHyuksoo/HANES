---
menuCode: MST_PART
audience: operator
title: Item Master — Operator Guide
summary: Full column DB mapping of Item Master, ERP sync (IF_ITEM_MASTER), IQC/AQL linkage, permissions, troubleshooting
tags: [reference data, item, master, operations, ERP]
keywords: [ITEM_MASTERS, IF_ITEM_MASTER, ERP-IF, IQC_AQL_POLICY_CODE, PRODUCT_TYPE, IQC_INSPECT_METHOD, UNIT_TYPE, item type, sync, multi-tenancy]
related: [QC_AQL]
---

# Item Master — Operator Guide

## System Purpose & Role
This screen manages **master table `ITEM_MASTERS`**, which holds reference data for all items. BOM, production results, material stock transactions, IQC, and inventory all reference this master via `ITEM_CODE`.

## Data Structure
```
ITEM_MASTERS (PK: COMPANY, PLANT_CD, ITEM_CODE)
   ├─ IQC_AQL_POLICY_CODE ──▶ IQC_AQL_POLICIES (IQC AQL policy)
   └─ References: BOM / Production / Material Stock / Inventory / Label
```

## All Columns — ITEM_MASTERS

| Screen Field | DB Column | Meaning · Operational Notes |
|------|------|------|
| Item Code | `ITEM_CODE` | PK component. Immutable recommended (referential integrity). |
| Part No. | `PART_NO` | Drawing/ERP/customer part number. |
| Item Name | `ITEM_NAME` | Display name. |
| Customer Part No. | `CUST_PART_NO` | Customer part number (shipping/label matching). |
| Rev | `REV` | Drawing/spec revision. |
| Marking Text | `MARKING_TEXT` | Text passed to label/marking equipment. |
| Item Type | `ITEM_TYPE` | RAW_MATERIAL/SEMI_PRODUCT/FINISHED/CONSUMABLE. Branches material·production processing. |
| Product Group | `PRODUCT_TYPE` | Common code PRODUCT_TYPE. |
| Model Name | `MODEL_NAME` | Management characteristic. |
| Spec | `SPEC` | Specification/dimensions. |
| Color | `COLOR` | Wire color etc. |
| Unit | `UNIT` | Common code UNIT_TYPE. Basis unit for stock and issue. |
| IQC Flag | `IQC_FLAG` | Y=IQC target. |
| Inspection Method | `INSPECT_METHOD` | Common code IQC_INSPECT_METHOD. |
| Default Sample Qty | `SAMPLE_QTY` | IQC default sample quantity (separate from AQL sample count). |
| AQL Policy | `IQC_AQL_POLICY_CODE` | References `IQC_AQL_POLICIES.POLICY_CODE`. Receiving LOT judgment basis. |
| Box Qty | `BOX_QTY` | Box packing standard. |
| Min Pack Qty | `MIN_PACK_QTY` | Minimum issue unit. |
| LOT Unit Qty | `LOT_UNIT_QTY` | Process product bundle unit. |
| Pallet Unit | `PACK_UNIT` | Upper packaging unit. |
| Safety Stock | `SAFETY_STOCK` | Shortage judgment basis. |
| Expiry Days | `EXPIRY_DATE` | Expiry period in days. |
| Expiry Extension Days | `EXPIRY_EXT_DAYS` | Maximum extendable days. |
| Storage Location | `STORAGE_LOCATION` | Default storage location. |
| Image | `IMAGE_URL` | Upload file path (`/uploads/parts/...`). |
| Use Flag | `USE_YN` | Only Y active. |
| Remark | `REMARK` | Notes. |
| Audit | `CREATED_BY`, `CREATED_AT`, `UPDATED_AT` | Creation/update history. ERP synced entries have `CREATED_BY='ERP-IF'`. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | `40` / `1000` scope. |

## ERP Sync (IF_ITEM_MASTER)
- Top **ERP Sync** button → `POST /interface/inbound/item-master` → executes Oracle procedure **`IF_ITEM_MASTER`** (after confirmation modal).
- Operation: **MERGE** from ERP `MTL_SYSTEM_ITEMS` into `ITEM_MASTERS`. New items are INSERTed (`CREATED_BY='ERP-IF'`), existing items are UPDATEed with latest ERP values.
- Result: Returns `{ insert, update }` counts.
- **Mistake recovery**: New items incorrectly added via ERP can be identified by `CREATED_BY='ERP-IF'` + batch `CREATED_AT` and deleted (check child references like PROD_PLANS before deletion). Since tens of thousands may be loaded at once, always verify the confirmation modal before execution.

## IQC / AQL Linkage
- Items with `IQC_FLAG='Y'` are IQC targets on receipt.
- `IQC_AQL_POLICY_CODE` references `IQC_AQL_POLICIES` → automatically calculates sample size, Ac, Re for receiving LOT inspection. If unset, auto-judgment is not applied.

## Prerequisites (Master·Common Code)
- Common codes: `PRODUCT_TYPE`, `IQC_INSPECT_METHOD`, `UNIT_TYPE`, `USE_YN`
- AQL policy ([AQL Standard Management]) must be set up before linking to items.

## Permissions
Reference data administrator (create/update/ERP sync). General users can only view.

## Troubleshooting
| Symptom | Cause | Action |
|------|------|------|
| Bulk items incorrectly added by ERP sync | ERP sync mis-executed | Identify `CREATED_BY='ERP-IF'` batch and delete (check child references) |
| Image broken in list | `IMAGE_URL` file missing (404) | Reupload image or clean up path (frontend has placeholder fallback) |
| AQL auto-judgment not working in IQC | `IQC_AQL_POLICY_CODE` not set | Link AQL policy to item |
| Item not showing in selection lists | `USE_YN='N'` | Activate use flag to Y |
| Code duplicate error on save | Same `ITEM_CODE` exists | Check code (immutable key) |

## Data & Integration
- Table: `ITEM_MASTERS`
- Integration: BOM, Production Results, Material Stock, Inventory, Label, IQC·AQL (`IQC_AQL_POLICIES`)
- External: ERP `MTL_SYSTEM_ITEMS` (IF_ITEM_MASTER MERGE)
- Scope: `COMPANY='40'`, `PLANT_CD='1000'`
