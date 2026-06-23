---
menuCode: SHIP_ORDER
audience: operator
title: Ship Order — Operator Guide
summary: Ship order CRUD — customer, PO number, ship date assignment, item addition/quantity, DRAFT→CONFIRMED transition, QR code printing
tags: [shipping, ship order, dispatch, CRUD]
keywords: [SHIPMENT_ORDERS, SHIPMENT_ORDER_ITEMS, DRAFT, CONFIRMED, SHIPPED, CLOSED, SHIP_ORDER_STATUS, CUSTOMER, ship order, shipping, dispatch, customer]
related: [SHIP_PACK, SHIP_PALLET]
---

# Ship Order — Operator Guide

## System Purpose & Role
Register and manage **ship orders** specifying items and quantities to ship to customers. Write/edit in DRAFT status, then confirm (CONFIRMED) to enable box shipping and pallet loading operations.

```
DRAFT → CONFIRMED → SHIPPING → SHIPPED → CLOSED
```

## Data Structure
```
SHIPMENT_ORDERS (PK: SHIP_ORDER_NO, auto-numbered)
   ├─ CUSTOMER_ID → PARTNER_MASTERS
   ├─ CUSTOMER_PO_NO
   ├─ DUE_DATE / SHIP_DATE
   └─ STATUS: DRAFT → CONFIRMED → SHIPPING → SHIPPED → CLOSED

SHIPMENT_ORDER_ITEMS (PK: SHIP_ORDER_ID + SEQ)
   ├─ ITEM_CODE → ITEM_MASTERS (FINISHED goods)
   ├─ ORDER_QTY / SHIPPED_QTY
   └─ REMARK
```

## Screen Layout

### Main Area
- **Header**: Title + Refresh·Create buttons
- **DataGrid**: `GET /shipping/orders?limit=5000`
  - Columns: actions·ship order no·customer·PO no·due date·ship date·item count·total qty·status
  - Actions: print·confirm(DRAFT)·edit(DRAFT)·delete(DRAFT)
  - `HelpCircle` on status header → status help tooltip
  - Search: order no, status filter

### Right Panel (480px)
| Field | Description |
|------|-------------|
| Ship Order No. | Auto-generated (shown on edit) |
| Customer | `CUSTOMER` type partner selector |
| Customer PO No | Manual input (max 100 chars) |
| Due Date / Ship Date | Date picker (ship date required) |
| Remark | Free text |
| Items | `+` button → `PartSearchModal`(FINISHED) |
| Item Card | Code·name·unit, qty(`QtyInput`), remark, delete |
| Summary | Item count, total qty |

### Print Area (A4 Ship Order Form)
- `Printer` icon → A4 portrait format
- QR code(order no), customer info, item table
- Hidden on screen via `@media print` CSS

## Workflow

### ① Create (POST /shipping/orders)
- Enter customer, ship date, items in right panel
- Duplicate items prevented (by itemCode)
- All items must have `orderQty > 0` + ship date required

### ② Edit (PUT /shipping/orders/:id)
- **DRAFT status only**
- Add/remove items, change quantities

### ③ Confirm (PUT /shipping/orders/:id/confirm)
- DRAFT → CONFIRMED transition
- Cannot edit/delete after confirm
- Requires at least 1 item

### ④ Delete (DELETE /shipping/orders/:id)
- **DRAFT status only**

### ⑤ Print
- Available in any status
- A4 with QR code

## Status Codes (SHIP_ORDER_STATUS)

| Code | Meaning | Actions Allowed |
|------|---------|-----------------|
| DRAFT | Writing | Edit·Delete·Confirm |
| CONFIRMED | Confirmed | Box ship·Pallet loading |
| SHIPPING | Shipping in progress | Partial shipment |
| SHIPPED | Shipped | View only |
| CLOSED | Closed | View only |

## Interlock

| Condition | Description |
|------|-------------|
| Ship date empty | Save button disabled |
| Item qty = 0 | Save button disabled |
| After CONFIRMED | Edit/delete disabled |
| No items on confirm | Confirm button disabled + tooltip |

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| Cannot select item | PartSearchModal filter | Only FINISHED goods selectable |
| Confirm fails | No items | Add at least 1 item |
| Print not working | Browser popup blocked | Allow popups |
| Save fails | Missing required fields | Check ship date, item qty |

## Data & Integration
- Tables: `SHIPMENT_ORDERS`, `SHIPMENT_ORDER_ITEMS`, `PARTNER_MASTERS`, `ITEM_MASTERS`
- Integration: Packing(`/shipping/pack`) → Pallet loading(`/shipping/pallet`) → Shipping
- Scope: `COMPANY='40'`, `PLANT_CD='1000'`
