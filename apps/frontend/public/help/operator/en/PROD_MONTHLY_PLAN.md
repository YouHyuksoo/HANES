---
menuCode: PROD_MONTHLY_PLAN
audience: operator
title: Production Plan — Operator Guide
summary: PROD_PLANS table full columns·DB mapping, state transition/work order issuance logic, auto-generation (MPS)·Excel upload procedure, generation·permissions·troubleshooting·multi-tenancy
tags: [production, production plan, MPS, work order, operations, settings]
keywords: [PROD_PLANS, PLAN_NO, production plan, monthly plan, MPS, generation, PP-YYYYMM-NNN, ORDER_QTY, PLAN_QTY, issue rate, work order issuance, issue-job-order, DRAFT, CONFIRMED, CLOSED, confirm, unconfirm, close, auto-generate, Excel upload, bulk, autoCreateChildren, BOM expansion, COMPANY, PLANT_CD, troubleshooting]
related: [MST_PART, PROD_JOB_ORDER]
---

# Production Plan — Operator Guide

## System Purpose & Role
This master-transaction boundary screen manages **monthly (YYYY-MM) production plans** for finished goods and semi-products. After **confirming** a plan (`CONFIRMED`), you **issue work orders (`JOB_ORDERS`)** to hand off to actual production flow. On issuance, the plan's issued quantity (`ORDER_QTY`) accumulates incrementally, and the issue rate·remaining quantity are calculated from this value. Auto-generation (MPS) creates DRAFT plans in bulk based on customer orders (`/shipping/customer-orders`).

> The menu/title has recently changed from "Monthly Production Plan" to "Production Plan", but the route (`/production/monthly-plan`), API (`/production/prod-plans`), table (`PROD_PLANS`), and i18n namespace (`monthlyPlan.*`) remain unchanged.

## Data Structure
```
PROD_PLANS (PK: PLAN_NO = PP-YYYYMM-NNN, STATUS: DRAFT→CONFIRMED→CLOSED)
   │ ITEM_CODE (ManyToOne, nullable)
   ▼
PART_MASTERS (item name·BOM·routing reference)

On work order issuance:
PROD_PLANS.ORDER_QTY += issueQty   (atomic increment within transaction)
   └─▶ JOB_ORDERS (status=WAITING) [+ autoCreateChildren: recursive generation of BOM child SEMI_PRODUCT]
```
- API base: `@Controller('production/prod-plans')` → `/api/v1/production/prod-plans`
- List sort: `priority ASC, createdAt DESC`. Screen filter truncates `startDate/endDate` to **month (first 7 characters)** for `planMonth` range comparison.

---

## ① Production Plan — PROD_PLANS (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Plan No. | `PLAN_NO` | PK. Natural key. Format `PP-YYYYMM-NNN`. Generation uses MAX+1 of the same month prefix (see below). Immutable. |
| Plan Month | `PLAN_MONTH` | `VARCHAR2(7)`, `YYYY-MM`. Indexed. No date column (monthly plan). DTO validates with `^\d{4}-\d{2}$`. |
| Item Code | `ITEM_CODE` | `VARCHAR2(50)`. ManyToOne to `PART_MASTERS.ITEM_CODE` (nullable). Validates item existence on registration (404 if none). |
| Item Type | `ITEM_TYPE` | `VARCHAR2(10)`. Only `FINISHED`/`SEMI_PRODUCT` allowed (`@IsIn`). |
| Plan Qty | `PLAN_QTY` | `int`. Target quantity. `@Min(1)`. Upper limit for work order issuance. |
| Order Qty | `ORDER_QTY` | `int`, default 0. Cumulative issued quantity. Atomically incremented via SQL `ORDER_QTY + :issueQty` on issuance (not app memory sum). |
| Issue Rate | (calculated) | Screen calculation `min(round(ORDER_QTY/PLAN_QTY*100),100)`. Not a DB column. |
| Customer | `CUSTOMER` | `VARCHAR2(50)`, nullable. Customer code. For reference/customer order matching. |
| Line | `LINE_CODE` | `VARCHAR2(255)`, nullable. Default production line. Inherited as default on work order issuance. |
| Priority | `PRIORITY` | `int`, default 5. 1~10 (`@Min(1)@Max(10)`). List sort priority 1 (ASC). |
| Status | `STATUS` | `VARCHAR2(20)`, default `DRAFT`. Indexed. Badge from common code `PROD_PLAN_STATUS`. Transitions: DRAFT→CONFIRMED→CLOSED, CONFIRMED→DRAFT (unconfirm). |
| Remark | `REMARK` | `VARCHAR2(500)`, nullable. |
| Company | `COMPANY` | `VARCHAR2(50)`. Multi-tenancy scope. Included in all query/update WHERE clauses. |
| Plant | `PLANT_CD` | `VARCHAR2(50)` (entity property `plant`). Multi-tenancy scope. |
| Creator/Modifier | `CREATED_BY` / `UPDATED_BY` | `VARCHAR2(50)`, nullable. |
| Created/Updated At | `CREATED_AT` / `UPDATED_AT` | `timestamp`. `@CreateDateColumn`/`@UpdateDateColumn`. |

> Grid columns **partName** is `part.itemName` (PART_MASTERS join), **partCode** is `part.itemCode ?? itemCode` — derived columns. PROD_PLANS has no item name column.

---

## ② Create/Edit Form Fields (PlanFormPanel)

| Screen Field | DB/DTO | Role / Meaning · Operational Notes |
|------|------|------|
| Plan Month | `planMonth` | Input only on create, disabled on edit (generation basis). |
| Item Type | `itemType` | Select only on create, disabled on edit. Also used as item search modal filter. |
| Item Code | `itemCode` | PartSearchModal select only (readOnly). Disabled on edit. Required. |
| Plan Qty | `planQty` | QtyInput. Save button disabled if `≤0`. |
| Priority | `priority` | number, default 5. |
| Customer | `customer` | Select via `usePartnerOptions('CUSTOMER')`. Optional. |
| Line | `lineCode` | Select via `/master/prod-lines`. Optional. |
| Remark | `remark` | text. Optional. |

Save branch: New `POST /production/prod-plans`, Edit `PUT /production/prod-plans/:planNo`. Server blocks edits outside **DRAFT** (BadRequest).

---

## ③ Work Order Issuance Form (IssueJobOrderModal → issue-job-order)

| Screen Field | DTO Field | Role / Meaning · Operational Notes |
|------|------|------|
| Issue Qty | `issueQty` | `@Min(1)`. **400 if exceeds remaining (planQty−orderQty)**. Screen also blocks via maxValue. Required. |
| Plan Date | `planDate` | `@IsDateString`. Maps to JobOrder.planDate (`parseDateStart`). Optional. |
| Line | `lineCode` | Inherits from plan.lineCode if not entered. |
| Priority | `priority` | Inherits from plan.priority if not entered. |
| Auto-create BOM Semi-Products | `autoCreateChildren` | `@IsBoolean`. If true, recursively creates work orders for BOM child SEMI_PRODUCTs (see logic below). |
| Remark | `remark` | Defaults to `Issued from (planNo)` if not entered. |

---

## State Transition / Issuance Logic

### State Transitions (Service Guard)
| Action | API | Pre-state | Result | Violation |
|------|------|------|------|------|
| Confirm | `POST :planNo/confirm` | DRAFT | CONFIRMED | 400 (DRAFT only) |
| Unconfirm | `POST :planNo/unconfirm` | CONFIRMED | DRAFT | 400 (CONFIRMED only) |
| Close | `close()` | CONFIRMED | CLOSED | 400 (CONFIRMED only) |
| Edit | `PUT :planNo` | DRAFT | Updated | 400 (DRAFT only) |
| Delete | `DELETE :planNo` | DRAFT | Deleted | 400 (DRAFT only) |
| Bulk Confirm | `bulkConfirm` | Filters only DRAFT | CONFIRMED | Non-DRAFT ignored (count 0) |

> Screen display: DRAFT rows → Confirm button + left-side edit/delete icons. CONFIRMED rows → Issue work order (if remaining>0) + Unconfirm. CLOSED has no actions. **Close is implemented in the service but currently no button is exposed in the grid UI** (API direct call/future exposure target).

### Work Order Issuance Logic (`issueJobOrder`, transaction)
1. Look up plan → 400 if `STATUS!=CONFIRMED`.
2. `remainQty = planQty − orderQty`. 400 if `issueQty > remainQty`.
3. Generate work order number via `numbering.nextJobOrderNo()`.
4. Resolve item's routing (`RoutingGroup.useYn='Y'`) → first process (`RoutingProcess` seq ASC).
5. Create `JOB_ORDERS` (status=`WAITING`, erpSyncYn=`N`, lineCode/priority inherited from dto→plan).
6. If `autoCreateChildren=true`, recursive BOM expansion (see below).
7. Atomically increment `PROD_PLANS.ORDER_QTY += issueQty` via SQL update.

### BOM Semi-Product Recursive Generation (`createChildOrdersFromPlanRecursive`)
- Among parent item's `BOM_MASTERS`(useYn='Y') children, only those with **PART_MASTERS.ITEM_TYPE='SEMI_PRODUCT'** get child work orders.
- Child qty = `ceil(parent.planQty × qtyPer)`. Records parentOrderNo/rootOrderNo chain.
- **Circular reference guard**: Tracks ancestor itemCode path, stops on re-encounter (warn). Depth 50 backstop.

---

## Generation (PLAN_NO)
- Format: `PP-` + `YYYYMM`(planMonth with `-` removed) + `-` + 3-digit zero-pad.
- Algorithm: LIKE query on prefix → `ORDER BY planNo DESC` top 1 row seq +1.
- Bulk create·auto-generation sequentially generates within the same transaction.

> This uses **SELECT MAX+1** (not Oracle SEQUENCE), so PK conflicts are possible under high concurrent parallel creation. Current assumption is single-user/sequential input. Consider switching to SEQUENCE if concurrent bulk input becomes frequent.

## Auto-Generation (MPS) Procedure
1. `POST /production/prod-plans/auto-generate/preview` { month, startDate?, endDate?, customerId? } → returns customer order-based candidates (items: orderNo·dueDate·itemCode·demandQty·planQty), `existingDraftCount`, `warnings`.
2. Select items from the screen.
3. `POST /production/prod-plans/auto-generate` { month, selectedItems[] } → creates selected items as DRAFT. **Existing DRAFTs for that month are deleted and regenerated** (confirmation modal, shows `existingDraftCount`). CONFIRMED/CLOSED are preserved.

## Excel Upload Procedure
1. Download template (`downloadProdPlanTemplate`).
2. Select file → frontend parses xlsx (header Korean/English mapping) → row validation (itemCode required, itemType∈{FINISHED,SEMI_PRODUCT}, planQty>0).
3. Upload enabled only when errors are 0 → `POST /production/prod-plans/bulk` { planMonth, items[] }. Server validates all items IN batch within a transaction; if any item is missing, the entire batch is rolled back.

## Prerequisites (Master·Common Code)
- Common codes: `PROD_PLAN_STATUS`(status badge), `ITEM_TYPE`(filter).
- Masters: `PART_MASTERS`(item·item type), `PROD_LINES`(line), `PARTNER_MASTERS`(customer, partnerType='CUSTOMER').
- Work order issuance prerequisite: Item must have `ROUTING_GROUPS`(useYn='Y') + `ROUTING_PROCESS` registered. Otherwise routingCode/processCode will be issued as null.
- For BOM auto-generation: `BOM_MASTERS`(useYn='Y', qtyPer) + child item ITEM_TYPE='SEMI_PRODUCT'.

## Permissions
- Production plan staff: Create/edit/confirm/issue. General users: view.
- ERP interface button currently only shows an **under-implementation notice modal** (preparing).

## Troubleshooting
| Symptom | Cause | Action |
|------|------|------|
| "Item not found" on registration | itemCode not in PART_MASTERS for this COMPANY/PLANT scope | Register Item Master and verify scope |
| Edit/delete blocked (400) | Plan is CONFIRMED/CLOSED | Unconfirm back to DRAFT first |
| Issue work order button disabled | Remaining qty 0 or not CONFIRMED | Check remaining qty and status |
| "Issue qty exceeds remaining" | issueQty > planQty−orderQty | Set issue qty ≤ remaining |
| Issued work order has no process | Item routing (useYn='Y')·process not registered | Register ROUTING_GROUPS/PROCESS and re-issue |
| BOM auto-generation not working | Child item ITEM_TYPE≠SEMI_PRODUCT or BOM useYn='N' | Check item type and BOM use flag |
| DRAFTs disappeared after auto-generation | Same-month DRAFT regenerated (normal by design) | Reconfirm after auto-generation to preserve |
| Excel upload button disabled | Validation error rows exist | Fix red error rows (itemCode/itemType/planQty) |

## Data & Integration
- Table: `PROD_PLANS`(main), `PART_MASTERS`(join), `JOB_ORDERS`(issuance result), `BOM_MASTERS`/`ROUTING_GROUPS`/`ROUTING_PROCESS`(issuance support).
- Related screens: [Item Master](/master/part), [Work Order](/production/job-order). Auto-generation references customer orders (`/shipping/customer-orders`).
- Scope: `COMPANY='40'`, `PLANT_CD='1000'`. COMPANY·PLANT included in all query/update/delete WHERE clauses.
