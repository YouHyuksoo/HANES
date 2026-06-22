---
menuCode: CONS_LABEL
audience: operator
title: Consumable Label Issuance — Operator Guide
summary: Consumable UID (conUid) generation·unreceived (PENDING) instance creation, label printing/reprint logic, CONSUMABLE_STOCKS·LABEL_PRINT_LOGS mapping, generation rules (F_GET_CON_UID), label templates, receiving confirmation linkage, permissions, troubleshooting, multi-tenancy
tags: [consumable, label, issuance, print, operations]
keywords: [CONSUMABLE_STOCKS, CONSUMABLE_MASTERS, LABEL_PRINT_LOGS, CON_UID, conUid, F_GET_CON_UID, CON_UID_SEQ, consumable UID, generation, PENDING, ACTIVE, CON_STOCK_STATUS, label issuance, label template, LABEL_TEMPLATES, print, reprint, print agent, ZPL, BROWSER, multi-tenancy, COMPANY, PLANT_CD]
related: [CONS_MASTER, CONS_RECEIVING]
---

# Consumable Label Issuance — Operator Guide

## System Purpose & Role
This screen generates **individual tracking UIDs (`CON_UID`)** based on the consumable master (`CONSUMABLE_MASTERS`), creates **unreceived (PENDING) instances** in `CONSUMABLE_STOCKS`, and prints/reprints labels. Issuance is not receiving — it is **tracking object creation + label output**. Actual receiving (stock increase) is confirmed via barcode scan in [Consumable Receiving](`CONS_RECEIVING`).

> API reference (controller `consumables/label`): Issuable masters `GET /consumables/label/masters`, UID generation+PENDING creation `POST /consumables/label/create`, unreceived list `GET /consumables/label/pending`, single/bulk receiving confirmation `POST /consumables/label/confirm`·`confirm-bulk`, scan return/issue/issue-return `POST /consumables/label/return`·`issue`·`issue-return`. The right panel instance lookup uses `GET /consumables/stocks`(params `consumableCode`·`status`), print log enrichment uses `POST /material/label-print/log`, templates use `GET /master/label-templates?category=jig`.
>
> The `SELECT * FROM CON_LABELS ...` text at the bottom of the grid is a display label only; the actual table name is `CONSUMABLE_STOCKS`.

## Data Structure
```
CONSUMABLE_MASTERS (PK: CONSUMABLE_CODE)              Consumable master
   └─ 1:N ─▶ CONSUMABLE_STOCKS (PK: CON_UID)          Individual instances (issuance unit)
                  status: PENDING → ACTIVE → MOUNTED/ISSUED/RETURNED ...

LABEL_PRINT_LOGS (PK: PRINTED_AT + SEQ)               Label issuance history
   category='con_uid', UID_LIST=issued UID JSON array
```
- 1 issuance = create `qty` `CONSUMABLE_STOCKS` rows + 1 `LABEL_PRINT_LOGS` record.
- The unreceived panel displays only rows with `status='PENDING'` for the same master, filtered client-side.

## ① Issuance Target List — CONSUMABLE_MASTERS / Aggregation (CONSUMABLE_STOCKS)

`GET /consumables/label/masters` returns masters with `useYn='Y'` along with instance aggregation.

| Screen Field | DB Column / Calculation | Role / Meaning · Operational Notes |
|------|------|------|
| Select (checkbox) | (UI state) | Multi-select issuance targets. Header checkbox toggles all. Button disabled if 0 selected. |
| Image | `CONSUMABLE_MASTERS.IMAGE_URL` | Thumbnail/label image. Resolved via `resolveBackendFileUrl` for backend path, placeholder on load failure. |
| Consumable Code | `CONSUMABLE_MASTERS.CONSUMABLE_CODE` | Natural key (FK target) for grouping issued UIDs. |
| Consumable Name | `CONSUMABLE_MASTERS.NAME` (property `consumableName`) | Search/label display. |
| Category | `CONSUMABLE_MASTERS.CATEGORY` | Common code `CONSUMABLE_CATEGORY` (MOLD/JIG/TOOL). Top filter criterion. Displayed with `ComCodeBadge`. |
| Current Stock | `CONSUMABLE_MASTERS.STOCK_QTY` | Held quantity: +1 on receive confirm, -1 on return/issue. |
| Instances | `COUNT(*)` of `CONSUMABLE_STOCKS` (property `instanceCount`) | Cumulative issued object count. `(Unreceived: n)` alongside is `SUM(status='PENDING')` (property `pendingCount`). |
| Issue Qty | (UI state `qtyMap`) | Quantity for this generation. UI adjusts 1~99, DTO validates 1~999 (`@Min(1)@Max(999)`). |

## ② Label Issuance Tool (Top Right)

| Screen Field | Integration | Role / Meaning · Operational Notes |
|------|------|------|
| Status Message | (UI `issueStatus`) | Single-line loading/success/error display. `aria-live=polite`. |
| Refresh | `GET /consumables/label/masters` | Reloads list and aggregation. |
| Label Template Select | `GET /master/label-templates?category=jig` | jig category from `LABEL_TEMPLATES`. Priority to `isDefault`, otherwise first item. `__default__` uses built-in design (`createDefaultLabelDesign('jig')`). `designData` is JSON (parsed if string). |
| Issue UID | `POST /consumables/label/create` | Sends `{consumableCode, qty}` per selected master → generates conUid → prints. |

## ③ Unreceived Instance Panel — CONSUMABLE_STOCKS

Queried via `GET /consumables/stocks?consumableCode=...`, displaying only `status='PENDING'`.

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Consumable UID | `CON_UID` | PK. Label/barcode tracking key. |
| Status | `STATUS` | Common code `CON_STOCK_STATUS`. Panel shows only `PENDING`. (Transition: PENDING→ACTIVE→MOUNTED/ISSUED/RETURNED/REPAIR/SCRAPPED) |
| Location | `LOCATION` | Can be set at receive confirmation. |
| Usage Count | `CURRENT_COUNT` / Master `EXPECTED_LIFE` | Displayed as `current count / expected life`. Usually 0 for unreceived. |
| Receive Date | `RECV_DATE` | Receive confirmation time. PENDING shows null (`-`). |
| Mounted Equipment | `MOUNTED_EQUIP_CODE` (property `mountedEquipCode`) | Updated during mounting flow. |
| Supplier | `VENDOR_CODE`, `VENDOR_NAME` | Inherited from DTO/master at generation. |
| Preview | (UI) | Modal preview with `LabelDesignRenderer` (no print). |
| Reprint | `POST /material/label-print/log` + print agent | Renders label as PNG → sends via `printAgentPng` to printer + records print log. |

## ④ Label Issuance History — LABEL_PRINT_LOGS

| Screen Field (hidden) | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| (Auto) Print Time | `PRINTED_AT` | Composite PK 1. |
| (Auto) Sequence | `SEQ` | Composite PK 2 (fixed to 1 at create). |
| (Auto) Category | `CATEGORY` | Fixed to `'con_uid'`. |
| (Auto) Print Mode | `PRINT_MODE` | `BROWSER`(browser print) / `ZPL`(direct output). create·log uses `BROWSER`. |
| (Auto) UID List | `UID_LIST` | JSON array of generated conUids (CLOB). |
| (Auto) Label Count | `LABEL_COUNT` | Number of issuances (create = `qty`). |
| (Auto) Status | `STATUS` | `SUCCESS`/`FAILED`. |
| (Key) Multi-tenancy | `COMPANY`, `PLANT_CD` | `40` / `1000` (properties `company`, `plant`). |

## UID Generation Rules (CON_UID)
- On issuance, `NumberingService.nextConUid()` → `PKG_SEQ_GENERATOR`(generation type `CON_UID`) generates within transaction (no gaps).
- Format function `F_GET_CON_UID`: `'C' + TO_CHAR(SYSDATE,'YYMMDD') + LPAD(CON_UID_SEQ.NEXTVAL, 5, '0')`.
  - Example: 2026-06-23 issuance → `C2606230001`, `C2606230002` …
- `CON_UID_SEQ` is an Oracle SEQUENCE. The date prefix separates by date, with sequence values guaranteeing uniqueness.

## Issuance / Print Logic (Browser Output)
1. **Selection Validation**: Stop if `selectedCodes` is 0. If `window.open` fails (popup blocked), show error and stop.
2. **Generation** (`createConUids`): For each selected master, `POST /consumables/label/create`. Server transaction: for `qty` times, `nextConUid()` → save `CONSUMABLE_STOCKS`(status=`PENDING`, `LABEL_PRINTED_AT`=now, inherit vendor·unitPrice) + 1 `LABEL_PRINT_LOGS` record. Returns 404 if master not found.
3. **Label Data Assembly**: Bundle each conUid with `consumableCode/Name/category/imageUrl/stockQty/expectedLife/location` and render with `LabelPrintRenderer`.
4. **Render Wait**: Wait up to 2.5s for `data-label-barcode-pending` flag and image loading. Block print if barcode incomplete (preview recommended).
5. **Print**: Open new window with label HTML + `@page size:{labelWidth}mm {labelHeight}mm` then call `window.print()`.
6. **Print Log Enrichment**: `POST /material/label-print/log`(category=`con_uid`, printMode=`BROWSER`, uidList, SUCCESS). Ignore on failure (silent).
7. **Cleanup**: Deselect, reset state, refresh list.

### Reprint Logic (Direct Agent Output)
- Right panel **Reprint**: Convert single conUid label to PNG (3x scale) via `renderLabelNodeToPngBase64` → send `printAgentPng({ jobId: 'CON-REPRINT-{conUid}', widthMm, heightMm, copies:1, contentBase64 })` → log via `POST /material/label-print/log`. Requires the label print agent (local output service) to be running.
- **Preview** shows only the `LabelDesignRenderer` modal without generation or transmission (for checking barcode/layout before printing).

## Prerequisites (Master·Common Code)
- Common codes: `CONSUMABLE_CATEGORY`(MOLD/JIG/TOOL), `CON_STOCK_STATUS`(PENDING/ACTIVE/MOUNTED/REPAIR/SCRAPPED etc.).
- Generation: Oracle `CON_UID_SEQ` sequence + `F_GET_CON_UID` function, `PKG_SEQ_GENERATOR` with `CON_UID` type registered (`seed_seq_rules.sql`).
- Label templates: `category='jig'` designs must exist in `LABEL_TEMPLATES` to be selectable (otherwise built-in default design used). Use Label Management screen for design/template management.
- Target consumables must have `CONSUMABLE_MASTERS.USE_YN='Y'` to appear in the list.

## Operating Procedure
1. Create consumable (jig) label **templates** in Label Management and set defaults (optional).
2. On this screen, select consumable + enter quantity → **Issue UID** → print label → attach physically.
3. If label is lost/damaged, **Reprint** the UID from the right panel.
4. After attachment, scan barcode in **Consumable Receiving** → confirm receive (`POST /consumables/label/confirm`): `CONSUMABLE_STOCKS.STATUS` PENDING→ACTIVE, set `RECV_DATE`, `CONSUMABLE_MASTERS.STOCK_QTY +1`, record IN history in `CONSUMABLE_LOGS` (`SEQ_CONSUMABLE_LOGS.NEXTVAL`).

## Permissions
Consumable/material administrators (issuance/reprint). General users can only view. Direct label output (agent) only works on terminals with the print agent installed.

## Troubleshooting
| Symptom | Cause | Action |
|------|------|------|
| Issue UID button disabled | 0 selected or issue/print in progress | Check at least 1 consumable, wait for completion |
| "Browser blocked print window" | Popup blocked | Allow site popups, then retry |
| "No UIDs issued" | 0 selected or issue quantity 0 | Check issue quantity (1~99) |
| "Barcode generation incomplete" | Barcode render incomplete (2.5s exceeded) | Preview label first, then print again |
| 404 on issue (master not found) | `consumableCode` missing/wrong tenant | Register consumable master, check tenant |
| "Agent output error" on reprint | Label print agent not running/error | Check agent status and printer connection |
| Unreceived list empty | No PENDING for that consumable (already received/none) | Check issuance status and receive confirm status |
| Image not showing on label | `IMAGE_URL` file 404 | Reupload image in consumable master |
| Instance count increases but stock unchanged | Receive confirm not performed (PENDING status) | Scan and confirm receipt in Consumable Receiving |

## Data & Integration
- Tables: `CONSUMABLE_STOCKS`(issued instances·PK `CON_UID`), `CONSUMABLE_MASTERS`(master·issue target), `LABEL_PRINT_LOGS`(issuance history), `CONSUMABLE_LOGS`(IN history on receive confirm), `LABEL_TEMPLATES`(label design)
- Generation: `CON_UID_SEQ` + `F_GET_CON_UID` + `PKG_SEQ_GENERATOR(CON_UID)`
- Related screens: Consumable Master (issue target), Consumable Receiving (scan receive confirm), Label Management (template design)
- Scope: `COMPANY='40'`, `PLANT_CD='1000'`
