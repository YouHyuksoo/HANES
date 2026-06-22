---
menuCode: PROD_INPUT_KIOSK
audience: user
title: Production Result Entry (Kiosk)
summary: An integrated production kiosk for tablets/PCs at shop-floor equipment where work order selection, material input, production quantity/defect entry, and self-inspection are handled on one screen.
tags: [production, result entry, kiosk, shop floor]
keywords: [production result, kiosk, work order, equipment, operator, good quantity, defect quantity, material input, consumable, self-inspection, first piece, in-process, last piece, work instruction, interlock, preparation check]
related: [MST_PART, MST_BOM]
---

# Production Result Entry (Kiosk)

## Screen Purpose
An integrated screen where operators directly enter production results on **tablets/PCs next to shop-floor equipment**. From work order selection to material input, work instruction review, production quantity/defect entry, and self-inspection — all processed on one screen. (Used in full-screen chromeless mode.)

## Screen Layout
```
┌──────────────────────────────────────────────────────────┐
│ Top Header (2 rows): ①Equipment ID·Barcode·Daily Check  ②Work Order·Operator·Production Result·Equip Check │
├───────────────┬──────────────────────────┬───────────────┤
│ Left: BOM Mat.│ Center: Work Instruction │ Right: Good   │
│   + Consumable│   Bottom 3 sections:     │   Conditions  │
│   Equip Parts │   Self-Inspect|Defect|Result│ + Job History│
└───────────────┴──────────────────────────┴───────────────┘
```

## ① Top Header (Selection / Checks)
| Item | Role / Description |
|------|------|
| **Equipment ID / Barcode** | Select the equipment to work on. Work orders, processes, and materials are linked based on the equipment. |
| **Equipment Daily Check** | The equipment's daily inspection must be completed before work can proceed (preparation check = interlock). |
| **Work Order** | Select the work order (production target and quantity) to perform on this equipment. |
| **Operator** | Select the operator(s) to register the result (multiple allowed). |
| **Operator Equipment Check** | Equipment check performed by the operator (subject to interlock). |
| **Production Result (Progress)** | Shows the results/progress rate registered so far relative to the work order. |

> **Interlock (Preparation Check)**: Essential checks such as equipment daily checks and operator equipment checks must be completed before result saving is enabled. Incomplete checks block progress.

## ② Left — Material Input
| Item | Role / Description |
|------|------|
| **BOM Material List** | List of materials to be input based on the BOM of the selected work order (product). Check input quantity against required quantity. |
| **Material Scan** | Scan the material serial (matUid) to be input for processing. |
| **Consumable Equipment Parts** | Consumables mounted on the equipment (separate from the product BOM). Scan input in the lower section. |

## ③ Center — Work Instruction + Result/Inspection
| Item | Role / Description |
|------|------|
| **Work Instruction** | Displays work guidelines (images/PDFs/documents) by item and process. Click to enlarge. |
| **Result Entry** | Enter **good quantity (goodQty)** and **defect quantity (defectQty)** (and production serial if needed), then save the result. |
| **Defect** | Enter defects in detail **by grade (Critical/Major/Minor)**. The sum of entered defects is saved together with the defect quantity in the result. |
| **Self-Inspection** | Operator self-inspection (see flow below). |

## ④ Right — Good Conditions / Job History
| Item | Role / Description |
|------|------|
| **Good Conditions** | Guidelines on criteria for acceptable quality. |
| **Job History** | History of results registered for this job. |

## Self-Inspection Flow (First Piece / In-Process / Last Piece)
| Timing | Trigger | Description |
|------|------|------|
| **First Piece (FIRST)** | **Auto-opens** immediately after the first result is saved | Quality check at the start of production |
| **In-Process (MID)** | Panel button click or **blocked at 60% progress** | Quality check during production |
| **Last Piece (LAST)** | Panel button click | Quality check at the end of production |

## Usage Procedure
1. **Select Equipment** → Complete equipment daily check.
2. **Select Work Order and Operator** → Complete operator equipment check (interlock released).
3. **Scan input materials/consumables** on the left.
4. Work while checking the work instruction in the center.
5. **Enter good quantity and defect quantity, then save** (enter defects in detail by grade).
6. Perform **self-inspection** (first piece / in-process / last piece) at appropriate timings.

## FAQ
- **Q.** The result save button won't click.
  **A.** Preparation checks (equipment/operator checks) may not be completed, or the work order/operator may not be selected. Check the interlock status.
- **Q.** I haven't done the in-process inspection, and progress stopped.
  **A.** The in-process self-inspection blocks progress at 60%. Performing the inspection releases it.
- **Q.** If I enter the defect quantity directly, does it overlap with the per-grade entry?
  **A.** If per-grade defect details are entered, that sum takes priority (no double counting).

## Related Screens
- [Part Master](/master/part) · [BOM Management](/master/bom) — Product and material structure standards
