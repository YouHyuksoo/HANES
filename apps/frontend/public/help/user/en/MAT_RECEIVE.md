---
menuCode: MAT_RECEIVE
audience: user
title: Material Receiving
summary: Scan IQC-passed material LOT barcodes to process receipt (warehouse put-away) and view receiving status.
tags: [material, receiving, stock transaction, scan]
keywords: [material receiving, scan receiving, IQC passed, awaiting receipt, material serial, matUid, vendor barcode, internal barcode, remaining quantity, expiry date, certificate, receipt history, production, MRO]
related: [MST_PART, QC_AQL]
---

# Material Receiving

## Screen Purpose
**Receive (put away) material LOTs that have passed incoming inspection (IQC)** into the warehouse. Instead of manual full entry, this screen uses **barcode scanning** to map vendor barcodes with internally attached barcodes for accurate receipt confirmation.

> Flow: Arrival (PO receipt) → Incoming Inspection (IQC) → **Only passed items pending receipt** → Scan receipt → Stock update

## Screen Layout
- **Top Statistics**: Count/quantity of items awaiting receipt, today's receipt count/quantity.
- **Filters**: Arrival date (defaults to today), supplier, item search.
- **Awaiting Receipt Grid**: List of IQC-passed LOTs with remaining quantity. For verification of receipt targets.
- **Receipt Processing (Scan) Modal**: Cyclic scanning of vendor barcode → internal barcode. **Only scanned mappings are confirmed as received**.

---

## ① Awaiting Receipt Columns (Receivable LOTs)

| Column | Role / Description |
|------|------|
| **Material Serial (matUid)** | Unique serial of the material LOT targeted for receipt. The material identifier assigned at arrival. |
| **Item Code / Name (part.itemCode / itemName)** | Targeted item (based on part master). |
| **Item Type (itemType)** | Classification: raw material, consumable, etc. |
| **Unit (part.unit)** | Unit of quantity. |
| **Arrival Quantity (initQty)** | Initial LOT quantity at arrival time. |
| **Already Received (receivedQty)** | Quantity already processed as received (cumulative partial receipt). |
| **Remaining Quantity (remainingQty)** | Quantity not yet received (= available for receipt). |
| **Arrival Date (recvDate)** | Date the material arrived. |
| **Manufacture Date (manufactureDate)** | Material manufacturing date. |
| **Expiry Date (expireDate / expiryDays)** | Material expiry date and remaining days. Used for expiry management. |
| **PO Number (poNo)** | Linked purchase order number. |
| **Vendor (vendor)** | Supplier of the material. |
| **Inspection Status (iqcStatus)** | Incoming inspection result. Only **passed** items are displayed for awaiting receipt. |
| **Arrival Warehouse (arrivalWarehouse)** | Warehouse where the material is currently stored. |
| **Certificate (certRequired / certUploaded)** | Whether a certificate is required and if it has been uploaded. Receipt may be blocked if required but not uploaded. |
| **Receipt Block Reason (receivingBlockedReason)** | Reason the receipt is blocked (e.g., certificate not submitted). |

## ② Scan Receipt Method
1. Identify the target in the Awaiting Receipt grid and click the **Receipt Processing** button.
2. **Scan the vendor barcode** (barcode attached by the supplier).
3. Then **scan the internal barcode (material serial)**.
4. Only the mapped barcode pair is confirmed as received. You can cycle through multiple items.

> Vendor barcodes are linked to MES part numbers/serials through rules registered in [Manufacturer Barcode Mapping].

## ③ Receipt History Columns
| Column | Role / Description |
|------|------|
| **Receipt No / Transaction No (receiveNo / transNo)** | Receipt processing identifier. |
| **Receipt Date (transDate)** | Date of receipt processing. |
| **Quantity (qty)** | Quantity received. |
| **Receipt Warehouse (toWarehouse)** | Warehouse where the material was put away. |
| **Vendor / Manufacturer (vendor / manufacturer)** | Supplying vendor and manufacturer. |
| **Class (materialClass)** | Production (PROD) / Consumable (MRO) classification. |
| **Status (status)** | Receipt status. |

## FAQ
- **Q.** Materials are not showing in the Awaiting Receipt list.
  **A.** They must have IQC PASS status and remaining quantity. Items with incomplete inspection, FAIL status, or fully received are not shown.
- **Q.** My receipt is blocked.
  **A.** Check the 'Receipt Block Reason'. It may be due to a certificate requirement not yet fulfilled.
- **Q.** Can I receive only part of the quantity?
  **A.** Yes, partial receipts within the remaining quantity can be accumulated.

## Related Screens
- [Part Master](/master/part) — Item and certificate requirement standards
- [AQL Standards](/quality/aql) — IQC inspection criteria before receiving
