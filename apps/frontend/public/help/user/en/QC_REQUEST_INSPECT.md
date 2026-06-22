---
menuCode: QC_REQUEST_INSPECT
audience: user
title: Delegate Inspection Entry
summary: Enter measured values and judge pass/fail for delegate inspection (DELEGATE) pending items that kiosk operators have forwarded to quality personnel instead of judging themselves.
tags: [quality, self-inspection, delegate inspection, DELEGATE, in-process inspection]
keywords: [delegate inspection, self-inspection, delegated inspection, DELEGATE, measured value, LSL, USL, specification, first piece, in-process, last piece, pass, fail, PASS, FAIL, pending, PENDING, timing, work order]
related: [QC_AQL]
---

# Delegate Inspection Entry

## Screen Purpose
For inspection items that are **difficult for shop-floor operators to judge directly** at the kiosk (e.g., items requiring measuring instruments or testers, destructive tests), the operator can **delegate (DELEGATE)** them to quality personnel instead of entering results themselves. These delegated inspections accumulate in "Pending (PENDING)" status on this screen, where quality personnel measure and verify them, then determine **PASS or FAIL**.

> Self-inspection (自主檢査): In-process inspection performed directly by the operator or responsible personnel at the production line. If the inspection method is **Direct (DIRECT)**, the judgment is made at the kiosk. If it is **Delegate (DELEGATE)**, it is forwarded to this screen.

> If a delegate inspection remains in **PENDING** status, **production result entry for that work order is blocked** at the kiosk. The judgment must be completed on this screen before the operator can proceed.

## Screen Layout
- **Left — Delegate Inspection Pending List**: Shows items not yet judged (PENDING) in order of request (oldest first). Click a row to open the input area on the right.
- **Right — Result Entry**: Check the inspection criteria (LSL/USL, unit, standard) for the selected item, enter measured values and remarks, then click Pass or Fail. Before selection, only a "Select an item from the left" guide is displayed.

## Processing Flow
```
Kiosk self-inspection (delegate item) ──Delegate──▶ Pending List ──Quality personnel judgment──▶ PASS / FAIL
                                                                           │
                                                                  Pending cleared → Kiosk result entry enabled
```

---

## ① Pending List Columns

| Column | Role / Description |
|------|------|
| **Work Order (orderNo)** | Production work order number where this inspection occurred. Identifies which order's production generated the inspection. |
| **Process (processCode)** | Process code where the inspection occurred. Distinguishes which process stage the inspection belongs to. |
| **Item Name (itemName)** | Name of the inspection item (e.g., Appearance, Dimension, Crimp Force). Indicates what is being inspected. |
| **Timing (timing)** | Inspection timing during production. **First (FIRST)** = first product after start, **Mid (MID)** = during production, **Last (LAST)** = at the end of the job. Separate inspections can occur for each timing within the same job. |
| **Requested At (createdAt)** | Time when this inspection was delegated from the kiosk. Older requests appear at the top, so process them in order. |

---

## ② Result Entry Area

When a row is selected, the following items are displayed and entered along with the item information.

| Item | Role / Description |
|------|------|
| **Inspection Criteria — LSL** | Lower Specification Limit. A measured value **below this is out of spec**. Only displayed for measure-type items. |
| **Inspection Criteria — USL** | Upper Specification Limit. A measured value **above this exceeds the spec**. LSL–USL is the normal range. |
| **Unit (unit)** | Unit of the measured value (e.g., mm, N, kgf). Indicates the unit for measurement and entry. |
| **Standard/Criteria (standard)** | Text description of the inspection criteria set for the item (e.g., judgment criteria when no numeric specification exists). |
| **Measured Value (measureValue)** | Enter the actual measured numeric value. Optional. Can be left empty for visual-type items. If entered, it is recorded with the inspection result. |
| **Remark (remark)** | Memo for special notes or judgment reasons. Optional. |
| **Pass (PASS)** | Confirms the inspection result as **Pass**. Saved with the entered measured value and remark, and removed from the pending list. |
| **Fail (FAIL)** | Confirms the inspection result as **Fail**. Subsequent quality actions (defect processing, etc.) follow separate procedures after a Fail judgment. |

> For items with LSL/USL criteria set, a measured value **between LSL and USL (inclusive)** is generally considered Pass. However, since Pass/Fail on this screen is a **manual judgment** made by the responsible person, use the specifications as a reference while making the final decision.

---

## Usage Procedure
1. In the left **Pending List**, click the item to process (older requests appear at the top).
2. On the right, review the **Inspection Criteria (LSL/USL, Unit)**.
3. After actually measuring and verifying, enter the **Measured Value** (if needed, add a **Remark**), then click **Pass (PASS)** or **Fail (FAIL)** based on the result.
4. The processed item is removed from the pending list, and the kiosk production result entry block for that work order is released.
5. If the list does not refresh, click **Refresh** at the top right.

## Input Rules / Validation
- An item must be selected to enable the result entry and judgment buttons.
- Measured Value and Remark are both **optional**. Visual-type items (appearance, etc.) can be judged Pass/Fail without a measured value.
- Measured Value accepts only numeric input.

## FAQ
- **Q.** What is the difference between Direct and Delegate inspection?
  **A.** Direct (DIRECT) inspection is judged by the operator at the kiosk. Delegate (DELEGATE) inspection is forwarded to quality personnel for judgment on this screen.
- **Q.** What happens if I don't process items here?
  **A.** If a PENDING delegate inspection remains for a work order, kiosk production result entry is blocked. Judgment must be completed promptly to allow production to continue.
- **Q.** LSL/USL is not displayed.
  **A.** The item is a visual-type item or has no LSL/USL specification set. In this case, "Visual-type item (no specification)" or "No specification set" is displayed, and the responsible person judges by eye or other criteria.

## Related Screens
- [AQL Standards](/quality/aql) — Sampling pass/fail criteria for IQC (separate from in-process self-inspection on this screen)
