---
menuCode: SHIP_PACK
audience: operator
title: Product Packing — Operator Guide
summary: Box-level packing management — create box, add/remove serials, close/reopen, print label. Full BOX_MASTERS columns, FG_LABELS state transition, auto OQC request generation
tags: [shipping, packing, box, operations]
keywords: [BOX_MASTERS, FG_LABELS, BOX_NO, ITEM_CODE, SERIAL_LIST, PALLET_NO, BOX_STATUS, OQC_STATUS, BOX_QTY, OPEN, CLOSED, SHIPPED, VISUAL_PASS, PACKED, OQC_REQUEST, box packing, serial, box label, box qty, pallet, multi-tenancy]
related: [SHIP_PALLET, SHIP_ORDER, SHIP_CONFIRM, SHIP_HISTORY]
---

# Product Packing — Operator Guide

## System Purpose & Role
This screen packs finished goods (FG) that passed inspection into **boxes** for shipping preparation. The workflow consists of 3 steps: create box → add serials → close (→ auto OQC request).

| Step | Action | Result |
|------|--------|--------|
| 1 | Create box (select item) | OPEN box created in `BOX_MASTERS`, boxNo auto-generated |
| 2 | Add serials (barcode scan) | FG serials added to box, serialList JSON updated, qty incremented |
| 3 | Close box | status→CLOSED, OQC auto-created, FG_LABELS→PACKED |

Packed boxes proceed to pallet loading (`/shipping/pallet`) → OQC (`/quality/oqc`) → shipment confirmation (`/shipping/confirm`).

## Data Structure
```
BOX_MASTERS (PK: COMPANY + PLANT_CD + BOX_NO)
   ├─ ITEM_CODE ─▶ ITEM_MASTERS (item, boxQty=max serials per box)
   ├─ PALLET_NO ─▶ PALLET_MASTERS (pallet)
   └─ SERIAL_LIST (CLOB) ─▶ FG_LABELS (serial JSON array, e.g., ["SN001","SN002"])

FG_LABELS (PK: FG_BARCODE)
   State transition: ISSUED → VISUAL_PASS → PACKED → SHIPPED
   On box close: status→PACKED, boxNo set

OQC_REQUESTS (auto-created on box close)
   remark = "AUTO_CREATED_FROM_BOX:{boxNo}"
```

## Box Status (BOX_STATUS) Code Values

| Code | Display | Description |
|------|---------|-------------|
| `OPEN` | Open | Serials can be added/removed |
| `CLOSED` | Closed | Serials confirmed, awaiting OQC, can reopen (if no pallet assigned) |
| `SHIPPED` | Shipped | Shipment complete, no further changes allowed |

## Box Number Format
- Format: `BX` + `YYMMDD` + `NNNN` (daily serial 4-digit, resets daily)
- Example: `BX2606230001`
- Generation: `NumberingService.nextBoxNo()` → Oracle `SEQ_BOX_NO_DAILY`

## All Columns — BOX_MASTERS

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Box No. | `BOX_NO` | PK. Auto-generated BX+date+serial. Label & barcode identifier. |
| Item Code | `ITEM_CODE` | References `ITEM_MASTERS.ITEM_CODE`. One box holds a single item only. |
| Packed Qty | `QTY` | Serial count (= serialList JSON array length). Cannot exceed boxQty. |
| Serial List | `SERIAL_LIST` | CLOB. FG barcode JSON array. Thousands possible but OQC/query performance should be considered. |
| Pallet No. | `PALLET_NO` | References `PALLET_MASTERS.PALLET_NO`. Assigned when loaded onto a pallet. Can be assigned after close. |
| Status | `STATUS` | `OPEN`/`CLOSED`/`SHIPPED`. Default OPEN. |
| OQC Status | `OQC_STATUS` | `PENDING`/`PASS`/`FAIL`/`null`. Set to PENDING on close. |
| Ship Order No. | `SHIP_ORDER_NO` | Assigned when linked to a shipment order. Set during shipment confirmation. |
| Shipped At | `SHIPPED_AT` | Timestamp of shipment confirmation. |
| Close Time | `CLOSE_TIME` | Timestamp of box close (closeAt). |
| Audit | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | Creation/update history. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | PK component. `40` / `1000` scope. |

Indexes: `ITEM_CODE`, `PALLET_NO`, `STATUS`, `SHIP_ORDER_NO` — utilized based on search conditions.

## Detailed Workflow

### ① Create Box
`POST /shipping/boxes { itemCode }`
- Item selection modal → only finished goods (`FINISHED`) selectable (`PartSelect partType="FINISHED"`)
- BoxNo auto-generated, `qty=0`, `serialList=null`
- `BOX_QTY` from item master (box capacity) used as serial addition limit

### ② Add Serial
`POST /shipping/boxes/:boxNo/serials { serials: ["FG_BARCODE"] }`
- Conditions: box `OPEN`, FG_LABELS `VISUAL_PASS` + `inspectPassYn='Y'`, item code match, under boxQty limit
- **Cross-box duplication prevention**: same serial already in another box → rejected

### ③ Close Box (Manual/Auto)
`POST /shipping/boxes/:boxNo/close`
- **Manual close**: lock icon on box info panel or `Complete & Print Label` button in serial modal
- **Auto close**: when serial count reaches `boxQty` → auto close + auto print label
- Side effects on close:
  1. `BOX_MASTERS.status` → `CLOSED`, `closeAt` → current time
  2. `FG_LABELS` serials: `status` → `PACKED`, `boxNo` set
  3. `OQC_REQUESTS` auto-created (`status=PENDING`, `remark=AUTO_CREATED_FROM_BOX:{boxNo}`)
  4. `OQC_REQUEST_BOXES` auto-created (box info)

### ④ Reopen Box
`POST /shipping/boxes/:boxNo/reopen`
- Condition: no pallet assigned (`palletNo IS NULL`)
- Restoration: serials → `VISUAL_PASS`, auto-created OQC request deleted

### ⑤ Delete Empty Box
- Conditions: `OPEN` status, no pallet, `qty=0`, no serialList, no OQC history

## Screen Layout
- **Main left**(2/3): DataGrid — box list (boxNo, itemCode, itemName, packed qty, status, closeAt)
  - Row click → right panel shows box details
  - 4 action buttons: Pack(Plus) / Close-Reopen(Lock-LockOpen) / ReprintLabel(Printer) / DeleteEmptyBox(Trash2)
  - Search: boxNo, itemCode; status filter (BOX_STATUS common code)
- **Right panel**(1/3): Selected box details
  - Item, capacity (current/max), serial list (BoxItem API), status, pallet info

### Serial Add Modal
- Serial barcode input → Enter to add (FG barcode or serial)
- Auto close + auto label print on reaching `boxQty`
- Recently added serial can be canceled (removed)
- Warning shown when capacity is reached

## Prerequisites (Master·Common Code)
- Common codes: `BOX_STATUS`, `OQC_STATUS`
- Item master (`ITEM_MASTERS`): `BOX_QTY` (box capacity) should be configured (unlimited if unset)
- FG_LABELS: visual inspection passed (`VISUAL_PASS`) serials required for packing
- Linked menus: Pallet management (`/shipping/pallet`), OQC (`/quality/oqc`), Shipment confirmation (`/shipping/confirm`)

## Permissions
Shipping manager (box create/serial add/close/reopen). General users can view.

## Troubleshooting
| Symptom | Cause | Action |
|------|------|------|
| Serial add fails (item mismatch) | Scanned FG item differs from box item | Only same-item FG can be packed in this box |
| Serial add fails (status mismatch) | FG not in `VISUAL_PASS` status | Process visual inspection pass first |
| Serial add fails (duplicate) | Serial already in another box | Check in the other box |
| Box close fails | Already CLOSED or SHIPPED | Check status |
| Box reopen fails | Pallet already assigned | Remove from pallet first |
| Empty box delete fails | qty>0 or serialList exists or OQC history | Empty box contents first |
| No items when creating box | No FINISHED type items in master | Register FINISHED items in item master |
| OQC not auto-created | Close process error | Reopen and re-close the box |

## Data & Integration
- Tables: `BOX_MASTERS`, `FG_LABELS`, `OQC_REQUESTS`, `OQC_REQUEST_BOXES`, `PALLET_MASTERS`
- Integration: FG inspection (`FG_LABELS.status: VISUAL_PASS`), Pallet loading (`/shipping/pallet`), OQC (`/quality/oqc`), Shipment confirmation (`/shipping/confirm`), Shipment history (`/shipping/history`)
- Serial generation: `SEQ_BOX_NO_DAILY` (BX + YYMMDD + 4-digit)
- Image storage: N/A (labels rendered in real-time via bwip-js Code128 barcode)
- Scope: `COMPANY='40'`, `PLANT_CD='1000'`
