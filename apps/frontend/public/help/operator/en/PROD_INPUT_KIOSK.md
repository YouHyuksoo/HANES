---
menuCode: PROD_INPUT_KIOSK
audience: operator
title: Production Result Input (Kiosk) — Operator Guide
summary: Kiosk production result processing interlocks (pre-checks)·self-inspection triggers·material/consumable 2-type input·result/defect save transaction and troubleshooting
tags: [production, result input, kiosk, operations]
keywords: [production result, interlock, self-inspection, FIRST, MID, LAST, goodQty, defectQty, prdUid, BOM input, consumable equipment parts, WIP, work instruction, chromeless]
related: [MST_PART, MST_BOM]
---

# Production Result Input (Kiosk) — Operator Guide

## System Purpose & Role
An integrated screen at the equipment-side terminal for registering production results. It handles equipment·work order·worker selection, pre-checks (interlocks), material/consumable input, production quantity·defect entry, and self-inspection (FIRST/MID/LAST) all in one screen. Operates in full-screen (chromeless, `view=work`) mode, with state preserved via `kioskStore` (zustand persist).

## Screen Layout (4 Areas)
- Top header (2 rows): ①Equipment ID·barcode·daily equipment inspection ②Work order·worker·production result·worker equipment inspection
- Left: BOM material list + consumable equipment parts
- Center: Work instruction + bottom 3 panels (self-inspection | defects | result input)
- Right: Good conditions + work history

## Interlock (Pre-check) Logic
- Result save is blocked until required pre-checks (daily equipment inspection·worker equipment inspection etc.) are completed (`isAllInterlockDone`).
- Save also blocked when work order or worker is not selected.

## Self-Inspection Triggers
| Timing | Condition |
|------|------|
| FIRST | First save after `savedResultCount === 0` → auto-opens |
| MID | Panel button click, or **blocked at 60% progress** (cannot proceed if not done) |
| LAST | Panel button click |

## Material/Consumable 2-Type Distinction
- **BOM Input Materials**: Left-side material list = BOM-based input targets for the work order's product (material scan).
- **Consumable Equipment Parts**: Lower "Consumable Equipment Parts" section = consumables mounted on equipment, separate from product BOM. (Visually separated to avoid confusion.)

## Result/Defect Save
| Input | Meaning / Processing |
|------|------|
| Good Qty (goodQty) | Good production quantity. |
| Defect Qty (defectQty) | Defect quantity. **If grade-level details (pendingDefects) have a sum, that value takes priority** (prevents double counting). |
| Production Serial (prdUid) | Product serial (if applicable). |
| Defect Grades | CRITICAL/MAJOR/MINOR grade details saved in the **same transaction** as the production result (resolves previous separate defect-logs double-count issue). |

- On result save, work order progress and production results are updated, reflected in WIP/product stock flow (depending on equipment assignment and process).

## Permissions
Field worker (result registration). Terminal operates in kiosk mode.

## Troubleshooting
| Symptom | Cause | Action |
|------|------|------|
| Cannot save result | Interlock incomplete (equipment/worker inspection) or work order·worker not selected | Complete pre-checks and selection |
| Blocked at 60% | MID self-inspection not performed | Perform MID self-inspection |
| Suspected double-counting of defects | Mixing grade-level details and direct entry | Grade-level sum takes priority (no double counting by design) |
| Material scan not matching | Not a BOM input material / confused with consumable | Distinguish left-side BOM materials vs lower consumable equipment parts |
| Work instruction not showing | Work instruction not registered for item/process, or file path issue | Register work instruction and verify path |

## Data & Integration
- State: `kioskStore` (zustand persist)
- Integration: Work order, Item/BOM, Work instruction, Equipment/Process, Self-inspection, Production result·defect, Stock (WIP/Product)
- Scope: `COMPANY='40'`, `PLANT_CD='1000'`
