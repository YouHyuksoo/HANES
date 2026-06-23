---
menuCode: EQUIP_INSPECT_ITEM
audience: operator
title: Equipment Inspection Items — Operator Guide
summary: All columns of the EQUIP_INSPECT_ITEM_POOL table, equipment-item mapping process, QR labels, and troubleshooting
tags: [equipment, inspection, mapping, operator, assignment, QR]
keywords: [EQUIP_INSPECT_ITEM_POOL, EQUIP_INSPECT_ITEM_MASTERS, EQUIP_MASTERS, equipment inspection item mapping, batch registration, SORT_SEQ, QR label, inspection type tabs]
related: [EQUIP_INSPECT_ITEM_MASTER]
---

# Equipment Inspection Items — Operator Guide

## System Purpose & Role
Through the `EQUIP_INSPECT_ITEM_POOL` table, individual equipment (`EQUIP_MASTERS`) and inspection items (`EQUIP_INSPECT_ITEM_MASTERS`) are connected in an N:M relationship. Even the same inspection item can be independently connected/disconnected per equipment, and managed by classification into inspection type tabs. On-site, QR labels are attached and inspection results are entered via PDA.

## Data Structure
```
EQUIP_MASTERS (Individual Equipment)
    │
    └──▶ EQUIP_INSPECT_ITEM_POOL (PK: COMPANY + PLANT_CD + EQUIP_CODE + ITEM_CODE + INSPECT_TYPE)
              │
              ├── SORT_SEQ (Display order)
              └── USE_YN (Connection active/inactive)
                    │
                    └──▶ EQUIP_INSPECT_ITEM_MASTERS (Inspection item standard information)
                              ├── ITEM_NAME, CRITERIA, CYCLE
                              ├── ITEM_TYPE(VISUAL/MEASURE), UNIT, LSL_VALUE, USL_VALUE
                              ├── IMAGE_URL
                              └── INSPECT_TYPE (DAILY/PERIODIC/PM/WORKER)
```

---

## ① Equipment-Item Mapping — EQUIP_INSPECT_ITEM_POOL (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Equipment Code | `EQUIP_CODE` | **PK (1/5)**. Individual equipment. References `EQUIP_MASTERS.EQUIP_CODE`. |
| Item Code | `ITEM_CODE` | **PK (2/5)**. Inspection item. References `EQUIP_INSPECT_ITEM_MASTERS.ITEM_CODE`. |
| Inspection Type | `INSPECT_TYPE` | **PK (3/5)**. `DAILY` / `PERIODIC` / `PM` / `WORKER`. Must match the master's INSPECT_TYPE. |
| Active Flag | `USE_YN` | `Y` (active) / `N` (inactive). Keeps the connection but used for temporary exclusion. Default `Y`. |
| Display Order | `SORT_SEQ` | Display order of inspection items within equipment. Lower numbers appear first. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | **PK (4,5/5)**. Company code (`40`) / Plant code (`1000`). |
| Created By | `CREATED_BY` | User who registered the mapping. |
| Updated By | `UPDATED_BY` | User who last modified the mapping. |
| Created At | `CREATED_AT` | Timestamp of mapping registration. |
| Updated At | `UPDATED_AT` | Timestamp of mapping modification. |

---

## Inspection Type Tab Structure

The 4 tabs at the top right of the screen filter `EQUIP_INSPECT_ITEM_POOL` by each inspection type:

| Tab | INSPECT_TYPE | Pool Filter Condition |
|-----|-------------|---------------|
| Daily Inspection | DAILY | `POOL.INSPECT_TYPE = 'DAILY'` |
| Periodic Inspection | PERIODIC | `POOL.INSPECT_TYPE = 'PERIODIC'` |
| Preventive Maintenance | PM | `POOL.INSPECT_TYPE = 'PM'` |
| Worker Inspection | WORKER | `POOL.INSPECT_TYPE = 'WORKER'` |

Each time a tab is switched, the API re-queries with the selected equipment + inspection type:
`GET /master/equip-inspect-items?equipCode={code}&inspectType={type}`

---

## Item Addition (Mapping) Process

1. In the `InspectItemSelectPanel` drawer, call `GET /master/equip-inspect-item-masters?useYn=Y&inspectType={type}`
2. Display the master list with checkboxes (already mapped items are disabled and marked "Registered")
3. Sequentially call `POST /master/equip-inspect-items` for the selected items
4. Body of each POST: `{ equipCode, itemCode, inspectType }`

---

## QR Label Issuance

In `InspectItemLabelModal`, encode `itemCode` as QR using `react-qr-code` and print the label:
- Label size: 60mm × 55mm (print CSS)
- Composition: Header ("Equipment Inspection Item") + QR Code (128px) + Item Code + Item Name + Inspection Type + Cycle + Criteria
- Call `window.print()` to open the print dialog

---

## Permissions
Only users with equipment inspection item management authority (equipment/quality managers). General users can only view.

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| Left equipment list not visible | No data in equipment master | Register equipment and re-query |
| No items in specific inspection type tab | No items mapped for that type | Add items in the corresponding type tab |
| Items not visible in add drawer | `USE_YN='N'` in master or INSPECT_TYPE mismatch | Check usage status and inspection type in master |
| Displayed as "Already registered" | Same equipment+item+type combination already exists in Pool | Duplicate mapping not allowed |
| QR Label not printing | Browser popup blocked | Allow popups and retry |
| QR Label size incorrect | Print settings don't match label size | Adjust paper size and margins in print settings |

## Data & Integration
- **Tables**: `EQUIP_INSPECT_ITEM_POOL` (mapping), `EQUIP_INSPECT_ITEM_MASTERS` (item standard info), `EQUIP_MASTERS` (equipment)
- **Integration**: Equipment Inspection (Equip Inspect) result entry screen, QR label issuance
- **Scope**: `COMPANY='40'`, `PLANT_CD='1000'`
