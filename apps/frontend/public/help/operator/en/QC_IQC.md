---
menuCode: QC_IQC
audience: operator
title: IQC — Operator Guide
summary: IQC screen DB structure·full column mapping, AQL auto-judgment logic, stock movement on failure, destructive test auto-issue, judgment cancel conditions, multi-tenancy scope and other key operational points
tags: [quality, IQC, inspection, operations, AQL, defect warehouse]
keywords: [IQC_LOGS, MAT_LOTS, MAT_ARRIVALS, IQC_PART_SPECS, IQC_PART_SPEC_ITEMS, IQC_ITEM_POOL, PENDING, PASSED, FAILED, IQC_IN_PROGRESS, PASS, FAIL, INITIAL, RETEST, AQL judgment, defect warehouse, destructive test, AUTO_ISSUE, DEFECT_TYPE, DEFECT_GRADE, CRITICAL, MAJOR, MINOR, LSL, USL, INSPECT_DATE, SEQ, multi-tenancy, COMPANY, PLANT_CD, inspection certificate, CERT_FILE_PATH, cancel, CANCELED]
related: [QC_AQL, MST_PART]
---

# IQC — Operator Guide

## System Purpose & Role
This screen inspects the quality of received material LOTs and determines pass/fail.
- Results are immediately reflected in `MAT_LOTS.IQC_STATUS` and `MAT_ARRIVALS.IQC_STATUS`.
- On FAIL, all serials of the arrival are automatically moved to the **defect warehouse (warehouseType='DEFECT')** (`MAT_STOCKS` qty zeroed and reallocated to defect warehouse).
- On PASS, if the item has an expiry period set, `MAT_LOTS.EXPIRE_DATE` is auto-calculated from the arrival date.
- With `IQC_SAMPLE_ISSUE_MODE = 'AUTO_ISSUE'` setting, destructive test samples are auto-issued on PASS + sample qty > 0 (`STOCK_TRANSACTIONS` recorded, `refType='IQC_DESTRUCT'`).
- AQL supplier inspection level is updated after judgment (cumulative IQC history → inspection mode switch).

## Data Structure

```
MAT_LOTS (PK: COMPANY, PLANT_CD, MAT_UID)
   ├─ IQC_STATUS: PENDING / PASS / FAIL  ← updated after IQC judgment
   ├─ ARRIVAL_NO ──▶ MAT_ARRIVALS (arrival header, IQC_STATUS synced)
   └─ ITEM_CODE ──▶ ITEM_MASTERS (item info)
                        └─ IQC_AQL_POLICY_CODE ──▶ IQC_AQL_POLICIES (AQL policy)
                                                        └─ AQL_STANDARDS → LOT judgment criteria

IQC_PART_SPECS (PK: COMPANY, PLANT_CD, ITEM_CODE) ── per-item IQC criteria header
   └─ IQC_PART_SPEC_ITEMS (PK: ... ITEM_CODE, SEQ) ── per-item LSL/USL/AQL
         └─ INSP_ITEM_CODE ──▶ IQC_ITEM_POOL (global inspection item definition)

IQC_LOGS (PK: INSPECT_DATE, SEQ) ── 1 inspection history record (per arrival, matUid=null)
   ├─ ARRIVAL_NO, ITEM_CODE, VENDOR_CODE
   ├─ RESULT: PASS / FAIL
   ├─ DETAILS (CLOB, JSON) ── per-serial measurement details
   ├─ ITEM_RESULTS (CLOB, JSON) ── per-item AQL judgment results
   └─ AQL_* columns ── AQL criteria snapshot used at judgment

MAT_STOCKS ── stock qty (moved to defect warehouse on FAIL)
STOCK_TRANSACTIONS ── stock move/issue history (refType: IQC_FAIL / IQC_DESTRUCT)
```

---

## ① Inspection Target List — MAT_LOTS (Aggregated View)

The screen list is the result of GROUP BY `ARRIVAL_NO + ITEM_CODE` on `MAT_LOTS`.

| Screen Field | DB Column/Source | Role / Meaning · Operational Notes |
|------|------|------|
| Arrival No. | `MAT_LOTS.ARRIVAL_NO` | Arrival identifier. GROUP BY key. |
| Arrival Date | `MIN(MAT_LOTS.RECV_DATE)` | Earliest receipt date of the arrival. |
| Supplier | `MAT_LOTS.VENDOR` (→ partner name JOIN) | Supplying vendor code and name. |
| Item Code | `MAT_LOTS.ITEM_CODE` | GROUP BY key. |
| Item Name | `ITEM_MASTERS.ITEM_NAME` | LEFT JOIN. |
| Inspection Type | `ITEM_MASTERS.INSPECT_METHOD` | Common code `IQC_INSPECT_METHOD`. `FULL`=inspect, `SKIP`=skip. (Different from `INSPECT_CLASS` — IQC_LOGS legacy column). |
| Serial Count | `COUNT(*)` | Number of serials in this arrival. |
| Total Qty | `SUM(MAT_LOTS.INIT_QTY)` | Total initial quantity across serials. |
| Status | `MAT_LOTS.IQC_STATUS` | `PENDING`=awaiting inspection, `PASS`=passed (→ frontend `PASSED`), `FAIL`=failed (→ `FAILED`). Screen can also show `IQC_IN_PROGRESS` (if some LOTs in progress). |

---

## ② Inspection History — IQC_LOGS (All Columns)

1 record is created per arrival on inspection result registration (`MAT_UID=null`, marking per-arrival inspection).

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| (Composite PK) | `INSPECT_DATE` | Inspection registration timestamp (TIMESTAMP). Part of PK. |
| (Composite PK) | `SEQ` | Sequence within same timestamp (default 1). Part of PK. |
| Arrival No. | `ARRIVAL_NO` | Inspected arrival. Required for per-arrival inspection. |
| Material UID | `MAT_UID` | Serial identifier for per-serial inspection. `null` for per-arrival inspection (current method). |
| Item Code | `ITEM_CODE` | Inspected item. |
| Vendor Code | `VENDOR_CODE` | Supplying partner code (basis for AQL inspection level update). |
| Inspection Type | `INSPECT_TYPE` | `INITIAL`=first inspection (default), `RETEST`=re-inspection. Used with `RETEST_ROUND`. |
| Result | `RESULT` | `PASS` / `FAIL`. Frontend submission values (`PASSED`/`FAILED`) are converted by the service. |
| Details | `DETAILS` (CLOB) | Per-serial·per-item measurement JSON. Format: `{type:"SERIAL_INSPECTION", serials:[...], destructive:[...]}`. |
| Per-Item Judgment | `ITEM_RESULTS` (CLOB) | Per-inspection-item AQL judgment result JSON. Generated by AQL service. |
| Inspector Name | `INSPECTOR_NAME` | Inspector name (free-text input). |
| Inspection Class | `INSPECT_CLASS` | Legacy column. Not used for IQC inspection type (FULL/SKIP) recording on the current screen. |
| Destructive Sample Qty | `DESTRUCT_SAMPLE_QTY` | Destructive test sample quantity. If > 0 and PASS, auto-issued in AUTO_ISSUE mode. |
| Inspection Certificate | `CERT_FILE_PATH` | Server path of uploaded file (`/uploads/iqc/...`). Saved separately via file upload API. |
| Sample Barcode | `SAMPLE_BARCODE` | Scanned serial list (comma-separated). Auto-compressed with `...(+N more)` suffix if over 500 bytes. |
| LOT Qty | `LOT_QTY` | Total LOT quantity used for AQL judgment. |
| AQL Inspection Level | `AQL_INSPECTION_LEVEL` | Applied AQL inspection level (e.g., `II`). |
| AQL Inspection Mode | `AQL_INSPECTION_MODE` | Applied inspection mode (e.g., `NORMAL`). |
| AQL Sample Qty | `AQL_SAMPLE_QTY` | Recommended sample count calculated from AQL standards. |
| Major AQL Code | `AQL_MAJOR_CODE` | Applied Major AQL standard code. |
| Major Ac | `AQL_MAJOR_AC` | Major acceptance number. |
| Major Re | `AQL_MAJOR_RE` | Major rejection number. |
| Minor AQL Code | `AQL_MINOR_CODE` | Applied Minor AQL standard code. |
| Minor Ac | `AQL_MINOR_AC` | Minor acceptance number. |
| Minor Re | `AQL_MINOR_RE` | Minor rejection number. |
| Critical Defect Count | `DEFECT_CRITICAL` | Quantity of Critical grade defects. |
| Major Defect Count | `DEFECT_MAJOR` | Quantity of Major grade defects. |
| Minor Defect Count | `DEFECT_MINOR` | Quantity of Minor grade defects. |
| AQL Judgment Reason | `AQL_JUDGE_REASON` | Result reason from AQL auto-judgment logic (auto-generated). |
| Status | `STATUS` | `DONE`=judgment complete (default), `CANCELED`=cancelled. |
| Retest Round | `RETEST_ROUND` | For `INSPECT_TYPE=RETEST`. Re-inspection round number. |
| Remark | `REMARK` | Inspection notes. Cancel reason also recorded here. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | `40` / `1000` scope. |
| Created/Updated | `CREATED_AT`, `UPDATED_AT`, `CREATED_BY`, `UPDATED_BY` | Audit columns. |

---

## ③ Per-Item IQC Criteria — IQC_PART_SPECS / IQC_PART_SPEC_ITEMS

Reference tables queried during inspection modal for the item's inspection items and default sample qty.

### IQC_PART_SPECS (Per-Item Header)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| (PK) | `COMPANY`, `PLANT_CD`, `ITEM_CODE` | Composite PK. 1 row per item. |
| Default Sample Qty | `SAMPLE_QTY` | Loaded as default sample qty in inspection modal. Inspector can modify. |
| Destructive Test Flag | `IS_DEST` | `Y` if the item is a destructive test target. |
| Use Flag | `USE_YN` | Excluded from inspection item query if `N`. |

### IQC_PART_SPEC_ITEMS (Per-Item Details)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| (PK) | `COMPANY`, `PLANT_CD`, `ITEM_CODE`, `SEQ` | Composite PK. Items distinguished by sequence. |
| Inspection Item Code | `INSP_ITEM_CODE` | References `IQC_ITEM_POOL.INSP_ITEM_CODE`. Retrieves item name·judgment method·default LSL/USL. |
| LSL | `LSL` | Measurement lower spec limit (NULL if none). NULL = treated as visual judgment. |
| USL | `USL` | Measurement upper spec limit (NULL if none). |
| Judgment Criteria | `JUDGE_CRITERIA` | Visual judgment criteria description. |
| Defect Grade | `DEFECT_GRADE` | `CRITICAL`/`MAJOR`/`MINOR`. Common code `DEFECT_GRADE`. This grade maps defect counts to AQL Ac/Re. |
| Inspection Level | `INSPECTION_LEVEL` | ISO 2859-1 inspection level. Common code `AQL_INSP_LEVEL`. |
| AQL Value | `AQL` | Per-item AQL (Acceptable Quality Limit). Common code `AQL_VALUE`. |
| Inspection Type | `INSPECTION_TYPE` | `AQL`(default)/`DESTRUCTIVE`(destructive)/`FULL`(100%). NULL treated as AQL. Common code `IQC_ITEM_INSP_TYPE`. |
| Sample Method | `SAMPLE_METHOD` | `AQL`(auto)/`FIXED`(fixed). NULL treated as AQL. Common code `IQC_SAMPLE_METHOD`. |
| Fixed Sample Qty | `SAMPLE_QTY` | Per-LOT fixed sample qty for `INSPECTION_TYPE=DESTRUCTIVE/FULL` or `SAMPLE_METHOD=FIXED` items. |
| Use Flag | `USE_YN` | Not displayed in inspection if `N`. |

### IQC_ITEM_POOL (Global Inspection Item Definition)

| Column | Role / Meaning · Operational Notes |
|------|------|
| `INSP_ITEM_CODE` | Inspection item unique code (PK). Example: `IQC-001`. |
| `INSP_ITEM_NAME` | Inspection item name. Displayed in modal inspection item column. |
| `JUDGE_METHOD` | `VISUAL`(visual)/`MEASURE`(measurement). Measurement activates measurement value input field. |
| `CRITERIA` | Default judgment criteria. Used if `IQC_PART_SPEC_ITEMS.JUDGE_CRITERIA` is empty. |
| `LSL`, `USL`, `UNIT` | Default acceptable range. Can be overridden in per-item definition. |
| `REVISION`, `EFFECTIVE_DATE` | Inspection item revision history management. |

---

## AQL Judgment Logic

When registering per-arrival inspection results (`POST /material/iqc-history/arrival`), the final result is determined in the following order:

```
1. Query all PENDING serials of the arrival → calculate total LOT qty
2. Parse DETAILS JSON → aggregate FAIL counts per serial per item (itemDefectCounts)
3. Parse destructive section → aggregate inspectedQty/defectQty per item
4. AQL service calls resolveIqcPolicyByItem:
   a. Look up item's IQC_AQL_POLICY_CODE → IQC_AQL_POLICIES
   b. If critical defect exists and criticalMode='IMMEDIATE_FAIL' → immediate FAIL
   c. defectGrade-set items: query LOT range by item's inspectionLevel/AQL → compare Ac/Re
   d. Items without grade set: fall back to overall Major/Minor Ac/Re
   e. If Major or Minor defect count ≥ Re → FAIL / ≤ Ac → PASS
5. Batch update PENDING serials with final result (PASS/FAIL)
6. Create 1 IQC_LOGS record (save AQL criteria snapshot columns)
7. FAIL → auto-move to defect warehouse (STOCK_TRANSACTIONS refType='IQC_FAIL')
8. PASS + expiry period → auto-calculate EXPIRE_DATE
9. PASS + sample qty > 0 + AUTO_ISSUE mode → auto-issue destructive samples (refType='IQC_DESTRUCT')
10. Update AQL supplier inspection level
```

> When entering defect codes (`defects[]`), a 400 error is returned if there are no FAIL judgment items (`assertDefectCodesHaveFailedInspection`).

---

## Judgment Cancel Conditions

When calling `DELETE /material/iqc-history/{inspectDate}/{seq}`, the following conditions are checked:

| Condition | Action |
|------|------|
| Already `STATUS='CANCELED'` | 400 error ("Already cancelled judgment") |
| Receiving exists for arrival (`MAT_RECEIVINGS.STATUS='DONE'`) | 400 error ("Arrival already received") |
| PASS + destructive auto-issue exists (`refType='IQC_DESTRUCT'`) | 400 error ("Clear sample issue first") |
| FAIL + defect warehouse move history exists | Auto-reverse move (`refType='IQC_FAIL_CANCEL'`) then allow cancel |
| Cancel success | `IQC_LOGS.STATUS='CANCELED'`, serials → `IQC_STATUS='PENDING'` restored |

---

## API Routes

| Purpose | Method | Route |
|------|------|------|
| Pending arrival list | GET | `/material/iqc-history/pending-arrivals` |
| Pending serial list | GET | `/material/iqc-history/pending-serials` |
| Register per-arrival inspection result | POST | `/material/iqc-history/arrival` |
| Upload inspection certificate | POST | `/material/iqc-history/{inspectDate}/{seq}/upload-cert` |
| Cancel judgment | DELETE | `/material/iqc-history/{inspectDate}/{seq}` |
| Query item inspection items | GET | `/master/iqc-part-specs/{itemCode}/resolve-items` |
| Query item criteria header | GET | `/master/iqc-part-specs/{itemCode}` |
| Query AQL sample qty | GET | `/quality/aql/resolve-iqc-items` |

---

## Prerequisites (Master·Common Code)

- Common codes: `IQC_INSPECT_METHOD`(FULL/SKIP), `IQC_STATUS`, `DEFECT_TYPE`(defect code, `ATTR1` must have grade), `DEFECT_GRADE`(CRITICAL/MAJOR/MINOR), `IQC_ITEM_INSP_TYPE`(AQL/DESTRUCTIVE/FULL), `IQC_SAMPLE_METHOD`(AQL/FIXED), `AQL_INSP_LEVEL`, `AQL_VALUE`
- `ITEM_MASTERS.IQC_FLAG='Y'` required (IQC target item)
- `IQC_ITEM_POOL` — inspection item pool must be registered
- `IQC_PART_SPECS` + `IQC_PART_SPEC_ITEMS` — per-item inspection items must be configured
- `IQC_AQL_POLICIES` — AQL policy must be set and linked to item
- Defect warehouse (`warehouseType='DEFECT'`, `USE_YN='Y'`) must be registered — otherwise Failed stock cannot be moved (skipped without error)

---

## Permissions

| Role | Permitted Operations |
|------|------|
| Inspector | Register inspection results, scan serials, upload certificates |
| Quality administrator | Above + cancel judgment |
| Operator | Above + common code·criteria settings |

---

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| Inspection button disabled | Status is PASSED/FAILED | Cancel judgment needed (operator). Must have no receiving history |
| AQL sample qty not showing | AQL policy not linked to item | Set `IQC_AQL_POLICY_CODE` in Item Master |
| Stock not moving to defect warehouse on FAIL | Defect warehouse (`warehouseType='DEFECT'`) not registered | Register DEFECT type warehouse in Warehouse Master |
| "Arrival already received" error on cancel | Arrival already received (MAT_RECEIVINGS DONE) | Cancel receiving first, then cancel IQC judgment |
| "Clear sample issue first" error on cancel | IQC_DESTRUCT auto-issue history exists | Cancel that STOCK_TRANSACTIONS first, then retry |
| Inspection items not showing in modal | `IQC_PART_SPECS`/`IQC_PART_SPEC_ITEMS` not registered or `USE_YN='N'` | Check IQC inspection item master setup |
| Registration blocked after defect code entry | No FAIL judgment items with defect codes | Defect codes can only be entered if FAIL judgment items exist |
| ORA-04068 (500 on first call) | PL/SQL package INVALID after table DDL | Run `ALTER PACKAGE <package_name> COMPILE` or retry (callProc has 1 retry hardening) |
| Destructive samples not auto-issued | `IQC_SAMPLE_ISSUE_MODE != 'AUTO_ISSUE'` or `DESTRUCT_SAMPLE_QTY=0` | Verify system setting `IQC_SAMPLE_ISSUE_MODE='AUTO_ISSUE'` and enter sample qty |

---

## Data & Integration

- **Main tables**: `IQC_LOGS`, `MAT_LOTS`, `MAT_ARRIVALS`, `IQC_PART_SPECS`, `IQC_PART_SPEC_ITEMS`, `IQC_ITEM_POOL`
- **Stock tables**: `MAT_STOCKS`(stock), `STOCK_TRANSACTIONS`(move/issue history)
- **Master tables**: `ITEM_MASTERS`(item), `IQC_AQL_POLICIES`, `AQL_STANDARDS`(AQL criteria)
- **Related screens**: [AQL Standard Management](/quality/aql), [Item Master](/master/part), Material Receiving, IQC History
- **Multi-tenancy scope**: `COMPANY='40'`, `PLANT_CD='1000'`. Tenant parameters included in all queries and saves. `assertSameTenant` blocks cross-access.
