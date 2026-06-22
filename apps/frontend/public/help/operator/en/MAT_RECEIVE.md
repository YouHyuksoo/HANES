---
menuCode: MAT_RECEIVE
audience: operator
title: Material Receiving Management — Operator Guide
summary: Scan receiving logic for IQC-passed LOTs, receivable condition calculation, barcode mapping/certificate blocking, stock update and troubleshooting
tags: [material, receiving, stock transaction, operations]
keywords: [receivable, IQC pass, matUid, vendor-barcode, manufacturer barcode mapping, MatStock, stock update, certificate, certRequired, remaining quantity, generation, PROD, MRO]
related: [MST_PART, QC_AQL]
---

# Material Receiving Management — Operator Guide

## System Purpose & Role
This screen confirms materials that have passed arrival and IQC inspection into **warehouse stock**. Only IQC-passed LOTs are eligible for receiving. On receiving confirmation, stock (`MatStock`) is updated and a receiving transaction history is created.

## Process Flow
```
Arrival (PO receipt) → IQC inspection → [Passed + remaining > 0] = Receivable
   → Scan receiving (vendor barcode + material serial mapping) → Stock (MatStock) update + receiving history generation
```

## Data / API
- Receivable query: `GET /material/receiving/receivable` — returns only **IQC passed + unreceived (remaining qty > 0)** LOTs.
- Receiving confirmation: processed per scan mapping (`{ vendorBarcode, matUid }`). Only mapped entries are confirmed.
- Stock basis: Current stock quantity managed in `MatStock` (increases on receiving).

## Receivable Calculation Conditions (Operator Check Points)
A LOT must satisfy **all** to appear as receivable:
- IQC result `iqcStatus = PASS`
- Remaining quantity (`remainingQty = initQty − receivedQty`) > 0
- (For certificate-required items) No receiving block reason

## Key Field Meanings · Operational Notes

| Screen Field | Meaning / Calculation · Integration |
|------|------|
| Material Serial (matUid) | LOT identifier generated at arrival. Scanned from attached barcode. |
| Arrival Qty / Received / Remaining | `initQty` / `receivedQty`(partial receipt cumulative) / `remainingQty`(receivable). Supports partial receipt. |
| Inspection Status (iqcStatus) | IQC judgment. Only passed items included as receivable. |
| Arrival Warehouse | Staging warehouse at arrival. Moves to receiving warehouse on receipt. |
| Certificate (certRequired/certUploaded) | If required but not uploaded, `receivingBlockedReason` is set → receiving blocked. |
| Receiving Block Reason | Cause of receiving impossibility. Resolve to allow receiving. |
| Vendor Barcode | Connected to MES part number/serial via [Vendor Barcode Mapping] master. Unregistered mapping causes scan failure. |
| Classification (materialClass) | PROD(production) / MRO(consumable). Receiving history classification. |
| Receive No./Transaction No. | Receiving process generation values. |

## Scan Receiving Logic
1. Start receiving → scan vendor barcode → interpret part number/serial via vendor-barcode master.
2. Scan material serial (matUid) → map to receivable LOT.
3. Only successfully mapped entries are confirmed → `MatStock` increased + receiving history created.
4. Mapping failures (unregistered barcode/not a target) are not confirmed.

## Prerequisites
- Item Master (IQC flag·certificate requirement), AQL policy (IQC), vendor barcode mapping, Warehouse Master.

## Permissions
Material staff (receiving processing). General users can only view.

## Troubleshooting
| Symptom | Cause | Action |
|------|------|------|
| LOT not in receivable list | IQC not passed or remaining qty 0 | Check inspection completion/result and previous receipts |
| Receiving blocked | Certificate required but not uploaded | Upload certificate to resolve block reason |
| Vendor barcode scan failed | Vendor-barcode mapping not registered | Register barcode↔part number in [Vendor Barcode Mapping] |
| Material serial scan not matching | Not a receivable target (different LOT/already fully received) | Verify target LOT and remaining quantity |
| Not reflected in stock | Receiving not confirmed (mapped but not confirmed) | Ensure confirmation after scan mapping |

## Data & Integration
- Stock: `MatStock`(increases on receiving)
- Integration: Arrival/PO, IQC·AQL, vendor barcode mapping, warehouse, Item Master
- Scope: `COMPANY='40'`, `PLANT_CD='1000'`
