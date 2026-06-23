---
menuCode: EQUIP_INSPECT_ITEM_MASTER
audience: user
title: Inspection Item Master
summary: Master data screen for registering, editing, and deleting inspection items (item code, inspection type, judgment criteria, cycle) by equipment type
tags: [설비, 점검, 항목, 마스터, 기준정보, 관리]
keywords: [EQUIP_INSPECT_ITEM_MASTERS, 점검항목, 설비점검, 일상점검, 정기점검, PM, 작업자점검, 판정형, 측정형, VISUAL, MEASURE, LSL, USL]
related: [EQUIP_INSPECT_ITEM]
---

# Inspection Item Master

## Screen Purpose
Register and manage **Inspection Items** used for equipment inspection as master data. Each item has attributes such as inspection type (Daily/Periodic/PM/Worker), judgment type (Visual/Measure), cycle, and judgment criteria (upper/lower limits). Registered items are linked to individual equipment on the [Inspection Items by Equipment] screen.

## Screen Layout
- **DataGrid List**: Displays registered inspection items along with photo, item code, equipment type, inspection item name, inspection type, judgment type, judgment criteria, cycle, and usage status.
- **Right Panel (Register/Edit)**: A slide panel opens on the right when adding or editing an item.
- **Top Filter**: Search keyword + equipment type + inspection type selection

---

## ① DataGrid List Columns

| Column | Role / Description |
|------|------|
| **Photo (imageUrl)** | Reference image related to the inspection item. Displayed as a thumbnail; click to enlarge. |
| **Item Code (itemCode)** | Unique code identifying the inspection item. Cannot be modified after registration. |
| **Equipment Type (equipType)** | Type of equipment to which the inspection item applies (common code `EQUIP_TYPE`). |
| **Inspection Item Name (itemName)** | Name of the inspection item. |
| **Inspection Type (inspectType)** | Classification by inspection subject/timing. **DAILY** (daily inspection, blue) / **PERIODIC** (periodic inspection, orange) / **PM** (preventive maintenance, purple) / **WORKER** (worker inspection, green). |
| **Judgment Type (itemType)** | Method of judging inspection results. **VISUAL** (visual judgment, gray) = visual OK/NG / **MEASURE** (measurement, cyan) = numerical measurement. |
| **Judgment Criteria (criteria)** | Pass/fail criteria for inspection results. For measurement type, displayed as **Lower Spec Limit (LSL) ~ Upper Spec Limit (USL)** values with unit. |
| **Cycle (cycle)** | Inspection performance cycle. DAILY / WEEKLY / MONTHLY / QUARTERLY / SEMI_ANNUAL / ANNUAL. |
| **Usage (useYn)** | `Y` (green) = In use, `N` (red) = Not in use. |

---

## ② Register/Edit Panel Fields

| Field | Role / Description |
|------|------|
| **Item Code (itemCode)** | Unique identification code for the inspection item. Cannot be modified after registration. |
| **Equipment Type (equipType)** | Equipment type to which the inspection item applies. |
| **Inspection Item Name (itemName)** | Name of the inspection item. |
| **Inspection Type (inspectType)** | Select the inspection type (DAILY/PERIODIC/PM/WORKER). |
| **Judgment Type (itemType)** | **VISUAL** (visual): OK/NG judgment by sight / **MEASURE** (measurement): measure values to check if within criteria range. |
| **Cycle (cycle)** | Select the inspection performance cycle. |
| **Usage (useYn)** | Usage status (Y/N). |
| **Judgment Criteria (criteria)** | VISUAL: Input OK/NG judgment criteria text. / MEASURE: Select unit + enter **Lower Limit (LSL)** + **Upper Limit (USL)** values. |
| **Photo (imageUrl)** | Upload inspection reference image (JPEG/PNG/GIF/WebP). Can be uploaded by clicking or drag & drop. |
| **Remarks (remark)** | Additional management notes. |

## Usage Sequence
1. Click the **Add** button to register a new inspection item (right panel).
2. Enter attributes such as inspection type, judgment type, and cycle. For measurement type, set the upper/lower limit criteria values.
3. Upload an inspection reference photo if needed.
4. Click the edit icon in the list to modify an existing item.
5. Registered items are linked to individual equipment on the [Inspection Items by Equipment] screen.

## Input Rules / Validation
- Item code and inspection item name are **required fields**.
- For measurement type (MEASURE), both lower limit (LSL) and upper limit (USL) must be entered.
- Only image files (JPEG/PNG/GIF/WebP) can be uploaded, with a maximum size of 5MB.

## Frequently Asked Questions
- **Q.** What is the difference between inspection types? **A.** **DAILY** = daily pre-work inspection, **PERIODIC** = periodic (monthly/quarterly/semi-annual/annual), **PM** = preventive maintenance, **WORKER** = inspection performed by the worker themselves.
- **Q.** What is the difference between visual (VISUAL) and measurement (MEASURE) types? **A.** Visual type involves qualitative judgment like OK/NG, while measurement type measures specific values to check if they fall within the criteria range (lower~upper limit).
- **Q.** Can I change the item code after registration? **A.** No, it is the PK and cannot be changed. You must delete it and register a new one.

## Related Screens
- [Inspection Items by Equipment](/master/equip-inspect) — Screen that links registered inspection items to individual equipment
