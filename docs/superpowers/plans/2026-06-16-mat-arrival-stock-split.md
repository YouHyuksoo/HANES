# Mat Arrival Stock Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split material arrival stock from warehouse stock, migrate existing `MAT_IN` data into arrival-specific tables, and make `/inventory/transaction` show only post-receipt warehouse ledger rows.

**Architecture:** Add `MAT_ARRIVAL_STOCKS` for pending arrival stock and `MAT_ARRIVAL_TRANSACTIONS` for arrival-only ledger rows. Arrival APIs write only arrival stock/ledger; receiving APIs consume arrival stock and write normal `MAT_STOCKS` plus `STOCK_TRANSACTIONS(RECEIVE)`.

**Tech Stack:** NestJS, TypeORM entities/repositories, Oracle raw SQL migrations via `oracle_connector.py`, Jest, TypeScript, HANES JSHANES site.

---

## References

- Spec: `docs/superpowers/specs/2026-06-16-mat-arrival-stock-split-design.md`
- Decision: `.ai-coordination/DECISIONS.md` `D-20260616-MAT-ARRIVAL-STOCK-SPLIT`
- Oracle connector: `python C:/Users/hsyou/.codex/skills/oracle-db/scripts/oracle_connector.py --site JSHANES ...`
- DB schema rule: after schema change, run `python tools/generate_db_schema_doc.py`
- Do not use TypeORM CLI for this migration.
- Do not use `MAX(...)+1` or reset-style numbering. Use existing `NumberingService`/Oracle sequences.

## File Structure

Create:

- `apps/backend/src/entities/mat-arrival-stock.entity.ts`
  - Current pending arrival stock per `COMPANY`, `PLANT_CD`, `MAT_UID`.
- `apps/backend/src/entities/mat-arrival-transaction.entity.ts`
  - Arrival-only ledger rows: `ARRIVAL_IN`, `ARRIVAL_OUT`, `ARRIVAL_CANCEL`, `ARRIVAL_RESTORE`.
- `apps/backend/src/modules/material/services/arrival-stock.service.ts`
  - Shared transactional helpers for arrival stock increase, consume, restore, cancel, and lookups.
- `apps/backend/src/modules/material/services/arrival-stock.service.spec.ts`
  - Unit tests for helper behavior.
- `apps/backend/src/migrations/2026-06-16_mat_arrival_stock_split.sql`
  - Idempotent Oracle DDL and data migration with backup and guard checks.
- `docs/reports/hanes-mat-arrival-stock-split-migration-2026-06-16.md`
  - Runtime migration evidence after dry-run/apply.

Modify:

- `apps/backend/src/modules/material/receiving/receiving.module.ts`
  - Register new entities and `ArrivalStockService`.
- `apps/backend/src/modules/material/services/arrival.service.ts`
  - Stop writing `MAT_STOCKS` and `STOCK_TRANSACTIONS(MAT_IN)` during arrival.
  - Write `MAT_ARRIVAL_STOCKS` and `MAT_ARRIVAL_TRANSACTIONS(ARRIVAL_IN)` instead.
  - Cancel via arrival stock/ledger instead of stock transaction `MAT_IN_CANCEL`.
- `apps/backend/src/modules/material/services/arrival.service.spec.ts`
  - Update expectations from `StockTransaction(MAT_IN)` to arrival ledger.
- `apps/backend/src/modules/material/services/arrival.service.po-line.spec.ts`
  - Update IQC005 PO-line arrival expectations.
- `apps/backend/src/modules/material/services/receiving.service.ts`
  - Validate remaining receive quantity from `MAT_ARRIVAL_STOCKS`.
  - On receive, consume arrival stock and increase `MAT_STOCKS`.
  - Preserve `STOCK_TRANSACTIONS(RECEIVE)` for warehouse stock ledger.
- `apps/backend/src/modules/material/services/receiving.service.spec.ts`
  - Update receive tests for arrival stock consumption.
- `apps/backend/src/modules/material/services/receipt-cancel.service.ts`
  - Fix current stale `RECEIPT`/`RECEIPT_CANCEL` references to `RECEIVE`/`RECEIVE_CANCEL`.
  - Restore arrival stock on receipt cancel.
- `apps/backend/src/modules/material/services/receipt-cancel.service.spec.ts`
  - Update cancellation tests.
- `apps/backend/src/modules/inventory/services/inventory-query.service.ts`
  - Add defensive exclusion for legacy `MAT_IN`/`MAT_IN_CANCEL` from `/inventory/transactions`.
- `apps/backend/src/modules/inventory/services/inventory-query.service.spec.ts`
  - Assert query excludes arrival ledger legacy types.
- `apps/backend/src/modules/inventory/dto/inventory.dto.ts`
  - Remove `MAT_IN`/`MAT_IN_CANCEL` from user-facing transaction filter only if DTO values are local. If values come from shared constants, update shared constants in a separate small step.
- `apps/frontend/src/app/(authenticated)/inventory/transaction/page.tsx`
  - Remove `MAT_IN` and `MAT_IN_CANCEL` filter labels.
- `apps/frontend/src/locales/ko.json`
  - Keep legacy labels only if still used elsewhere; otherwise remove from transaction filter scope.
- `docs/reports/db-schema-erd.md`
  - Regenerate after DB schema migration.

## Execution Rules

- Work in small steps. Do not apply live DB migration until dry-run checks pass and the user approves the impact.
- This repo may already be dirty. Do not revert unrelated changes.
- Only commit if the user explicitly asks. The steps below include "commit checkpoint" wording for isolated worker branches, but in this repo follow the AGENTS.md rule.
- Use `.ai-coordination/LOCKS.md` before editing implementation files.

---

### Task 1: Preflight Current Data And Dry-Run Queries

**Files:**
- Create: `docs/reports/hanes-mat-arrival-stock-split-migration-2026-06-16.md`

- [ ] **Step 1: Capture current ledger totals**

Run:

```powershell
python C:/Users/hsyou/.codex/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT TRANS_TYPE, STATUS, COUNT(*) CNT, SUM(QTY) SUM_QTY FROM STOCK_TRANSACTIONS WHERE COMPANY='40' AND PLANT_CD='1000' AND TRANS_TYPE IN ('MAT_IN','MAT_IN_CANCEL','RECEIVE','RECEIVE_CANCEL') GROUP BY TRANS_TYPE, STATUS ORDER BY TRANS_TYPE, STATUS"
```

Expected: confirms current `MAT_IN` and `RECEIVE` totals before migration.

- [ ] **Step 2: Check `MAT_UID` migration key coverage**

Run:

```powershell
python C:/Users/hsyou/.codex/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT SUM(CASE WHEN MAT_UID IS NULL THEN 1 ELSE 0 END) NULL_MAT_UID_ROWS, COUNT(*) TOTAL_ROWS FROM STOCK_TRANSACTIONS WHERE COMPANY='40' AND PLANT_CD='1000' AND TRANS_TYPE='MAT_IN'"
```

Expected: `NULL_MAT_UID_ROWS = 0` for current JSHANES. If not, stop and extend the migration for legacy non-serial rows.

- [ ] **Step 3: Dry-run pending arrival stock calculation**

Run:

```powershell
python C:/Users/hsyou/.codex/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "WITH led AS (SELECT company, plant_cd, item_code, mat_uid, SUM(CASE WHEN trans_type='MAT_IN' AND status='DONE' THEN qty WHEN trans_type='MAT_IN_CANCEL' AND status='DONE' THEN qty ELSE 0 END) arrival_qty, SUM(CASE WHEN trans_type='RECEIVE' AND status='DONE' THEN qty WHEN trans_type='RECEIVE_CANCEL' AND status='DONE' THEN -qty ELSE 0 END) received_qty FROM stock_transactions WHERE company='40' AND plant_cd='1000' AND trans_type IN ('MAT_IN','MAT_IN_CANCEL','RECEIVE','RECEIVE_CANCEL') GROUP BY company, plant_cd, item_code, mat_uid) SELECT item_code, mat_uid, arrival_qty, received_qty, arrival_qty - received_qty AS pending_qty FROM led WHERE arrival_qty - received_qty <> 0 ORDER BY pending_qty DESC"
```

Expected: rows with `pending_qty > 0` are the arrival stock candidates. Any `pending_qty < 0` is a blocker.

- [ ] **Step 4: Dry-run stock subtraction safety**

Run:

```powershell
python C:/Users/hsyou/.codex/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "WITH pending AS (SELECT company, plant_cd, item_code, mat_uid, SUM(CASE WHEN trans_type='MAT_IN' AND status='DONE' THEN qty WHEN trans_type='MAT_IN_CANCEL' AND status='DONE' THEN qty WHEN trans_type='RECEIVE' AND status='DONE' THEN -qty WHEN trans_type='RECEIVE_CANCEL' AND status='DONE' THEN qty ELSE 0 END) pending_qty FROM stock_transactions WHERE company='40' AND plant_cd='1000' AND trans_type IN ('MAT_IN','MAT_IN_CANCEL','RECEIVE','RECEIVE_CANCEL') GROUP BY company, plant_cd, item_code, mat_uid HAVING SUM(CASE WHEN trans_type='MAT_IN' AND status='DONE' THEN qty WHEN trans_type='MAT_IN_CANCEL' AND status='DONE' THEN qty WHEN trans_type='RECEIVE' AND status='DONE' THEN -qty WHEN trans_type='RECEIVE_CANCEL' AND status='DONE' THEN qty ELSE 0 END) > 0), stock AS (SELECT company, plant_cd, item_code, mat_uid, SUM(qty) stock_qty, SUM(available_qty) available_qty FROM mat_stocks GROUP BY company, plant_cd, item_code, mat_uid) SELECT p.item_code, p.mat_uid, p.pending_qty, NVL(s.stock_qty,0) stock_qty, NVL(s.available_qty,0) available_qty FROM pending p LEFT JOIN stock s ON s.company=p.company AND s.plant_cd=p.plant_cd AND s.item_code=p.item_code AND s.mat_uid=p.mat_uid WHERE NVL(s.stock_qty,0) < p.pending_qty OR NVL(s.available_qty,0) < p.pending_qty"
```

Expected: zero rows. If rows exist, stop and ask for a data correction decision.

- [ ] **Step 5: Record evidence**

Add a short report to `docs/reports/hanes-mat-arrival-stock-split-migration-2026-06-16.md`:

```markdown
# 입하재고 분리 마이그레이션 사전 점검

- 실행일:
- 대상 DB: JSHANES
- MAT_IN/RECEIVE 합계:
- MAT_UID NULL:
- pending_qty 음수:
- MAT_STOCKS 차감 불가:
- 결론:
```

- [ ] **Step 6: Verify no code formatting issue**

Run:

```powershell
git diff --check -- docs/reports/hanes-mat-arrival-stock-split-migration-2026-06-16.md
```

Expected: no output.

---

### Task 2: Add Oracle Migration For New Tables And Existing Data

**Files:**
- Create: `apps/backend/src/migrations/2026-06-16_mat_arrival_stock_split.sql`

- [ ] **Step 1: Write migration DDL**

Create `apps/backend/src/migrations/2026-06-16_mat_arrival_stock_split.sql` with idempotent Oracle SQL. Use `DECLARE ... BEGIN ... END; /`.

Required DDL:

```sql
-- Create MAT_ARRIVAL_STOCKS if missing
CREATE TABLE MAT_ARRIVAL_STOCKS (
  COMPANY VARCHAR2(50) NOT NULL,
  PLANT_CD VARCHAR2(50) NOT NULL,
  MAT_UID VARCHAR2(50) NOT NULL,
  ARRIVAL_NO VARCHAR2(50),
  ARRIVAL_SEQ NUMBER,
  WAREHOUSE_CODE VARCHAR2(50) NOT NULL,
  ITEM_CODE VARCHAR2(50) NOT NULL,
  QTY NUMBER DEFAULT 0 NOT NULL,
  AVAILABLE_QTY NUMBER DEFAULT 0 NOT NULL,
  STATUS VARCHAR2(20) DEFAULT 'AVAILABLE' NOT NULL,
  CREATED_BY VARCHAR2(50),
  UPDATED_BY VARCHAR2(50),
  CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  UPDATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT PK_MAT_ARRIVAL_STOCKS PRIMARY KEY (COMPANY, PLANT_CD, MAT_UID)
);
```

Required transaction table:

```sql
CREATE TABLE MAT_ARRIVAL_TRANSACTIONS (
  TRANS_NO VARCHAR2(50) NOT NULL,
  TRANS_TYPE VARCHAR2(50) NOT NULL,
  TRANS_DATE TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  ARRIVAL_NO VARCHAR2(50),
  ARRIVAL_SEQ NUMBER,
  WAREHOUSE_CODE VARCHAR2(50),
  ITEM_CODE VARCHAR2(50) NOT NULL,
  MAT_UID VARCHAR2(50),
  QTY NUMBER NOT NULL,
  REF_TYPE VARCHAR2(50),
  REF_ID VARCHAR2(50),
  CANCEL_REF_ID VARCHAR2(50),
  WORKER_ID VARCHAR2(50),
  REMARK VARCHAR2(500),
  STATUS VARCHAR2(20) DEFAULT 'DONE' NOT NULL,
  COMPANY VARCHAR2(50) NOT NULL,
  PLANT_CD VARCHAR2(50) NOT NULL,
  CREATED_BY VARCHAR2(50),
  UPDATED_BY VARCHAR2(50),
  CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  UPDATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT PK_MAT_ARRIVAL_TRANSACTIONS PRIMARY KEY (TRANS_NO)
);
```

Also create indexes:

```sql
CREATE INDEX IX_MAT_ARR_STOCK_ITEM ON MAT_ARRIVAL_STOCKS (ITEM_CODE);
CREATE INDEX IX_MAT_ARR_STOCK_ARRIVAL ON MAT_ARRIVAL_STOCKS (ARRIVAL_NO, ARRIVAL_SEQ);
CREATE INDEX IX_MAT_ARR_TX_TYPE ON MAT_ARRIVAL_TRANSACTIONS (TRANS_TYPE);
CREATE INDEX IX_MAT_ARR_TX_DATE ON MAT_ARRIVAL_TRANSACTIONS (TRANS_DATE);
CREATE INDEX IX_MAT_ARR_TX_MAT_UID ON MAT_ARRIVAL_TRANSACTIONS (MAT_UID);
CREATE INDEX IX_MAT_ARR_TX_ARRIVAL ON MAT_ARRIVAL_TRANSACTIONS (ARRIVAL_NO, ARRIVAL_SEQ);
```

- [ ] **Step 2: Add backup and guard checks**

In the same migration:

- Create `STOCK_TRANSACTIONS_BAK_20260616` with `CREATE TABLE ... AS SELECT * FROM STOCK_TRANSACTIONS WHERE 1=0` if missing.
- Insert all rows with `TRANS_TYPE IN ('MAT_IN','MAT_IN_CANCEL')` into the backup table if not already present.
- Raise an error if any `MAT_IN` row has `MAT_UID IS NULL`.
- Raise an error if pending arrival quantity is negative.
- Raise an error if subtracting pending arrival stock from `MAT_STOCKS` would make `QTY` or `AVAILABLE_QTY` negative.

- [ ] **Step 3: Add data migration statements**

In the migration:

- Insert `MAT_IN` rows into `MAT_ARRIVAL_TRANSACTIONS` as `ARRIVAL_IN`.
- Insert `MAT_IN_CANCEL` rows as `ARRIVAL_CANCEL`.
- Fill `ARRIVAL_NO` and `ARRIVAL_SEQ` from `MAT_LOTS` by `MAT_UID`.
- Insert pending positive quantities into `MAT_ARRIVAL_STOCKS`.
- Insert pending positive quantities into `MAT_ARRIVAL_STOCKS` only up to current available warehouse stock: `safe_qty = MIN(pending_qty, current_mat_stock_qty)`.
- Subtract only `safe_qty` from `MAT_STOCKS`.
- Leave negative pending `RECEIVE`/`MAT_OUT` legacy warehouse ledger rows intact. They are post-receipt warehouse movements and can remain in `STOCK_TRANSACTIONS`.
- Delete zero `MAT_STOCKS` rows where `QTY = 0`, `AVAILABLE_QTY = 0`, `RESERVED_QTY = 0`.
- Delete migrated `MAT_IN` and `MAT_IN_CANCEL` rows from `STOCK_TRANSACTIONS`.

- [ ] **Step 4: Validate migration syntax with dry execution on a disposable test DB if available**

If no disposable DB exists, do not run the migration yet. Run static checks:

```powershell
git diff --check -- apps/backend/src/migrations/2026-06-16_mat_arrival_stock_split.sql
```

Expected: no whitespace errors.

- [ ] **Step 5: Defer live DB apply**

Do not apply this migration immediately after writing it. The live DB apply must happen after Tasks 3-8 are implemented and verified, so running backend code and database state switch together.

Record the pre-apply impact now:

- backup table name
- number of `MAT_IN` rows to move
- pending arrival stock rows and quantity
- rows that will be subtracted from `MAT_STOCKS`
- confirmation that negative stock guard returns zero rows

### Task 2A: Apply Oracle Migration After Code Is Ready

**Files:**
- Modify after applying: `docs/reports/db-schema-erd.md`

- [ ] **Step 1: Ask for live DB apply approval**

Before applying to JSHANES, show:

- backup table name
- number of `MAT_IN` rows to move
- pending arrival stock rows and quantity
- rows that will be subtracted from `MAT_STOCKS`
- confirmation that negative stock guard returns zero rows

Apply only after explicit approval.

- [ ] **Step 2: Apply migration after approval**

Run:

```powershell
python C:/Users/hsyou/.codex/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-06-16_mat_arrival_stock_split.sql
```

Expected: success.

- [ ] **Step 3: Post-migration DB verification**

Run:

```powershell
python C:/Users/hsyou/.codex/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT COUNT(*) CNT FROM STOCK_TRANSACTIONS WHERE TRANS_TYPE IN ('MAT_IN','MAT_IN_CANCEL')"
python C:/Users/hsyou/.codex/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT TRANS_TYPE, COUNT(*) CNT, SUM(QTY) SUM_QTY FROM MAT_ARRIVAL_TRANSACTIONS GROUP BY TRANS_TYPE ORDER BY TRANS_TYPE"
python C:/Users/hsyou/.codex/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT COUNT(*) CNT FROM MAT_ARRIVAL_STOCKS WHERE QTY < 0 OR AVAILABLE_QTY < 0"
python C:/Users/hsyou/.codex/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT COUNT(*) CNT FROM MAT_STOCKS WHERE QTY < 0 OR AVAILABLE_QTY < 0"
```

Expected:

- `STOCK_TRANSACTIONS` legacy count = 0
- arrival transaction totals match migrated `MAT_IN`
- negative counts = 0

- [ ] **Step 4: Regenerate DB schema doc**

Run:

```powershell
python tools/generate_db_schema_doc.py
```

Expected: `docs/reports/db-schema-erd.md` regenerated and includes new tables.

---

### Task 3: Add TypeORM Entities

**Files:**
- Create: `apps/backend/src/entities/mat-arrival-stock.entity.ts`
- Create: `apps/backend/src/entities/mat-arrival-transaction.entity.ts`

- [ ] **Step 1: Write failing entity metadata tests**

Add tests in `apps/backend/src/modules/material/services/arrival-stock.service.spec.ts` or a small entity spec if local convention is preferred.

Test expectations:

```ts
expect(getMetadataArgsStorage().tables.some((t) => t.target === MatArrivalStock)).toBe(true);
expect(getMetadataArgsStorage().columns.some((c) => c.target === MatArrivalStock && c.propertyName === 'matUid')).toBe(true);
expect(getMetadataArgsStorage().tables.some((t) => t.target === MatArrivalTransaction)).toBe(true);
```

Run:

```powershell
pnpm --filter @harness/backend test -- arrival-stock.service.spec.ts --runInBand
```

Expected: fail because entities do not exist.

- [ ] **Step 2: Implement `MatArrivalStock`**

Use this structure:

```ts
@Entity({ name: 'MAT_ARRIVAL_STOCKS' })
@Index(['itemCode'])
@Index(['arrivalNo', 'arrivalSeq'])
export class MatArrivalStock {
  @PrimaryColumn({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ type: 'varchar2', name: 'MAT_UID', length: 50 })
  matUid: string;

  @Column({ type: 'varchar2', name: 'ARRIVAL_NO', length: 50, nullable: true })
  arrivalNo: string | null;

  @Column({ type: 'number', name: 'ARRIVAL_SEQ', nullable: true })
  arrivalSeq: number | null;

  @Column({ name: 'WAREHOUSE_CODE', length: 50 })
  warehouseCode: string;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'QTY', type: 'int', default: 0 })
  qty: number;

  @Column({ name: 'AVAILABLE_QTY', type: 'int', default: 0 })
  availableQty: number;

  @Column({ name: 'STATUS', length: 20, default: 'AVAILABLE' })
  status: string;
}
```

Include `createdBy`, `updatedBy`, `CreateDateColumn`, `UpdateDateColumn` following `MatStock`.

- [ ] **Step 3: Implement `MatArrivalTransaction`**

Mirror `StockTransaction` but use `warehouseCode` and arrival fields:

```ts
@Entity({ name: 'MAT_ARRIVAL_TRANSACTIONS' })
@Index(['transType'])
@Index(['transDate'])
@Index(['matUid'])
@Index(['arrivalNo', 'arrivalSeq'])
export class MatArrivalTransaction {
  @PrimaryColumn({ name: 'TRANS_NO', length: 50 })
  transNo: string;

  @Column({ name: 'TRANS_TYPE', length: 50 })
  transType: string;

  // add transDate, arrivalNo, arrivalSeq, warehouseCode, itemCode, matUid,
  // qty, refType, refId, cancelRefId, workerId, remark, status, company, plant.
}
```

- [ ] **Step 4: Run entity tests and typecheck**

Run:

```powershell
pnpm --filter @harness/backend test -- arrival-stock.service.spec.ts --runInBand
pnpm --dir apps/backend exec tsc --noEmit --pretty false
```

Expected: tests pass, typecheck passes or only fails because service is not implemented yet.

---

### Task 4: Add `ArrivalStockService`

**Files:**
- Create: `apps/backend/src/modules/material/services/arrival-stock.service.ts`
- Modify: `apps/backend/src/modules/material/receiving/receiving.module.ts`
- Test: `apps/backend/src/modules/material/services/arrival-stock.service.spec.ts`

- [ ] **Step 1: Write failing helper tests**

Test cases:

- `recordArrivalIn` creates `ARRIVAL_IN` and upserts `MAT_ARRIVAL_STOCKS`.
- `consumeForReceive` rejects insufficient arrival stock.
- `consumeForReceive` writes `ARRIVAL_OUT` and decrements stock.
- `restoreAfterReceiveCancel` writes `ARRIVAL_RESTORE` and increments stock.
- tenant mismatch rejects.

- [ ] **Step 2: Implement constructor and dependencies**

Inject:

```ts
@InjectRepository(MatArrivalStock)
private readonly arrivalStockRepo: Repository<MatArrivalStock>,
@InjectRepository(MatArrivalTransaction)
private readonly arrivalTxRepo: Repository<MatArrivalTransaction>,
private readonly numbering: NumberingService,
```

Helper methods should accept `EntityManager`/`QueryRunner.manager` for transactional writes:

```ts
async recordArrivalIn(manager: EntityManager, input: ArrivalStockMovementInput): Promise<MatArrivalTransaction>
async consumeForReceive(manager: EntityManager, input: ArrivalStockMovementInput): Promise<MatArrivalTransaction>
async restoreAfterReceiveCancel(manager: EntityManager, input: ArrivalStockMovementInput): Promise<MatArrivalTransaction>
async cancelArrival(manager: EntityManager, input: ArrivalStockMovementInput): Promise<MatArrivalTransaction>
```

- [ ] **Step 3: Implement stock upsert**

Rules:

- `qtyDelta > 0`: create or update stock.
- `qtyDelta < 0`: require existing stock and `availableQty >= abs(qtyDelta)`.
- update `QTY` and `AVAILABLE_QTY` together.
- delete row if both become zero and no reservation concept exists.
- always scope by `company`, `plant`, `matUid`.

- [ ] **Step 4: Register in module**

Modify `apps/backend/src/modules/material/receiving/receiving.module.ts`:

- import `MatArrivalStock`
- import `MatArrivalTransaction`
- add both to `TypeOrmModule.forFeature`
- add `ArrivalStockService` to providers

- [ ] **Step 5: Run tests**

Run:

```powershell
pnpm --filter @harness/backend test -- arrival-stock.service.spec.ts --runInBand
pnpm --dir apps/backend exec tsc --noEmit --pretty false
```

Expected: pass.

---

### Task 5: Change Arrival Writes From Warehouse Stock To Arrival Stock

**Files:**
- Modify: `apps/backend/src/modules/material/services/arrival.service.ts`
- Test: `apps/backend/src/modules/material/services/arrival.service.spec.ts`
- Test: `apps/backend/src/modules/material/services/arrival.service.po-line.spec.ts`

- [ ] **Step 1: Update tests first**

Replace expectations like:

```ts
expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ transNo: 'TX-PO-001', transType: 'MAT_IN' }));
```

with:

```ts
expect(arrivalStockService.recordArrivalIn).toHaveBeenCalledWith(
  manager,
  expect.objectContaining({ transType: 'ARRIVAL_IN', matUid: expect.any(String), qty: expect.any(Number) }),
);
```

Also assert no `MatStock` save and no `StockTransaction(MAT_IN)` save in arrival flows.

- [ ] **Step 2: Inject `ArrivalStockService`**

Modify `ArrivalService` constructor to include:

```ts
private readonly arrivalStockService: ArrivalStockService,
```

Keep `StockTransaction` repository only if still needed for legacy reads during transition. Remove only after all references are gone.

- [ ] **Step 3: Change `createPoArrival` and `createManualArrival`**

Replace:

- `StockTransaction` create/save with `transType: 'MAT_IN'`
- `upsertStock(... MatStock ...)`

with:

```ts
await this.arrivalStockService.recordArrivalIn(queryRunner.manager, {
  transNo,
  transType: 'ARRIVAL_IN',
  arrivalNo,
  arrivalSeq: itemSeq,
  warehouseCode,
  itemCode,
  matUid,
  qty,
  refType,
  refId,
  workerId,
  remark,
  company,
  plant,
});
```

Use existing `NumberingService` for `transNo`. Do not use `MAX+1`.

- [ ] **Step 4: Change `receivePoLine` IQC005 path**

Rename `recordIqc005StockArrival` to `recordIqc005ArrivalStock` and make it:

- not save `MatStock`
- not save `StockTransaction`
- call `ArrivalStockService.recordArrivalIn`

Update comments:

```text
MAT_ARRIVAL_STOCKS upsert + MAT_ARRIVAL_TRANSACTIONS(ARRIVAL_IN)
```

- [ ] **Step 5: Change arrival cancel path**

Current cancel looks up `StockTransaction(MAT_IN)`. Replace with lookup in `MatArrivalTransaction(ARRIVAL_IN)`.

Rules:

- if any `RECEIVE` exists for the `matUid`, keep blocking arrival cancel.
- mark original arrival transaction `CANCELED` or set `cancelRefId` consistently.
- create `ARRIVAL_CANCEL`.
- decrement `MAT_ARRIVAL_STOCKS`.
- keep `MAT_ARRIVALS` and `MAT_LOTS` status update behavior.

- [ ] **Step 6: Run focused tests**

Run:

```powershell
pnpm --filter @harness/backend test -- arrival.service.spec.ts --runInBand
pnpm --filter @harness/backend test -- arrival.service.po-line.spec.ts --runInBand
pnpm --dir apps/backend exec tsc --noEmit --pretty false
```

Expected: pass.

---

### Task 6: Change Receiving To Consume Arrival Stock And Create Warehouse Stock

**Files:**
- Modify: `apps/backend/src/modules/material/services/receiving.service.ts`
- Test: `apps/backend/src/modules/material/services/receiving.service.spec.ts`

- [ ] **Step 1: Update tests first**

Add/modify test cases:

- `createBulkReceive` checks remaining quantity from `MAT_ARRIVAL_STOCKS`, not `STOCK_TRANSACTIONS(RECEIVE)` only.
- receive creates `MatReceiving`.
- receive calls `ArrivalStockService.consumeForReceive`.
- receive creates `StockTransaction` with `transType: 'RECEIVE'`.
- receive increases `MAT_STOCKS` at target receive warehouse.
- no source warehouse `MAT_STOCKS` subtraction for normal PASS lots.

- [ ] **Step 2: Inject `ArrivalStockService`**

Add to constructor:

```ts
private readonly arrivalStockService: ArrivalStockService,
```

- [ ] **Step 3: Replace pre-validation remaining check**

Current:

```ts
const receivedQty = SUM(STOCK_TRANSACTIONS.RECEIVE)
const remaining = lot.initQty - receivedQty
```

New:

```ts
const arrivalStock = await this.arrivalStockService.findAvailableByMatUid(item.matUid, company, plant);
const remaining = arrivalStock?.availableQty ?? 0;
if (item.qty > remaining) throw new BadRequestException(...)
```

Still keep PO tolerance check.

- [ ] **Step 4: Replace source warehouse subtraction**

For normal PASS:

- do not subtract `MAT_STOCKS` from arrival warehouse.
- call `arrivalStockService.consumeForReceive(...)`.
- keep `StockTransaction.fromWarehouseId` as the arrival warehouse for audit display if useful, but the physical subtraction comes from `MAT_ARRIVAL_STOCKS`.

For concession:

- first check if `MAT_ARRIVAL_STOCKS` exists for that `matUid`.
- if yes, consume arrival stock.
- if no because legacy fail stock was moved to a bad warehouse, keep existing `MatStock` source subtraction for backward compatibility and document this branch in code comment.

- [ ] **Step 5: Keep target warehouse stock increase**

Preserve:

```ts
await this.upsertStock(queryRunner.manager, receiveWarehouseCode, lot.itemCode, item.matUid, item.qty, lot.company, lot.plant);
```

- [ ] **Step 6: Run focused tests**

Run:

```powershell
pnpm --filter @harness/backend test -- receiving.service.spec.ts --runInBand
pnpm --dir apps/backend exec tsc --noEmit --pretty false
```

Expected: pass.

---

### Task 7: Fix Receipt Cancel Contract And Restore Arrival Stock

**Files:**
- Modify: `apps/backend/src/modules/material/services/receipt-cancel.service.ts`
- Test: `apps/backend/src/modules/material/services/receipt-cancel.service.spec.ts`

- [ ] **Step 1: Update tests first**

Replace `RECEIPT` expectations with `RECEIVE`.

Add test:

```ts
it('restores arrival stock when RECEIVE is canceled', async () => {
  // original RECEIVE qty 10
  // expect ArrivalStockService.restoreAfterReceiveCancel called with qty 10
  // expect StockTransaction RECEIVE_CANCEL saved
});
```

- [ ] **Step 2: Change cancellable query**

Change:

```ts
transType: 'RECEIPT'
```

to:

```ts
transType: 'RECEIVE'
```

Also exclude already-canceled rows by checking no later transaction references `cancelRefId` if current model requires it.

- [ ] **Step 3: Change cancel validation**

Change:

```ts
if (originalTransaction.transType !== 'RECEIPT')
```

to:

```ts
if (originalTransaction.transType !== 'RECEIVE')
```

- [ ] **Step 4: Create `RECEIVE_CANCEL`**

Change cancel transaction type:

```ts
transType: 'RECEIVE_CANCEL'
```

Keep `qty: -qty`.

- [ ] **Step 5: Restore arrival stock**

After subtracting `MAT_STOCKS`, call:

```ts
await this.arrivalStockService.restoreAfterReceiveCancel(queryRunner.manager, {
  matUid,
  itemCode,
  qty,
  warehouseCode: originalTransaction.fromWarehouseId ?? originalTransaction.toWarehouseId,
  refType: 'RECEIVE_CANCEL',
  refId: originalTransaction.transNo,
  workerId,
  remark: reason,
  company: originalTransaction.company,
  plant: originalTransaction.plant,
});
```

- [ ] **Step 6: Run focused tests**

Run:

```powershell
pnpm --filter @harness/backend test -- receipt-cancel.service.spec.ts --runInBand
pnpm --dir apps/backend exec tsc --noEmit --pretty false
```

Expected: pass.

---

### Task 8: Hide Arrival Ledger From Inventory Transaction API/UI

**Files:**
- Modify: `apps/backend/src/modules/inventory/services/inventory-query.service.ts`
- Test: `apps/backend/src/modules/inventory/services/inventory-query.service.spec.ts`
- Modify: `apps/frontend/src/app/(authenticated)/inventory/transaction/page.tsx`
- Optional modify: `apps/frontend/src/locales/ko.json`

- [ ] **Step 1: Backend test**

In `inventory-query.service.spec.ts`, assert the query builder excludes `MAT_IN` and `MAT_IN_CANCEL` when no transType is provided.

Expected query behavior:

```ts
qb.andWhere('trans.transType NOT IN (:...arrivalTransTypes)', {
  arrivalTransTypes: ['MAT_IN', 'MAT_IN_CANCEL'],
});
```

- [ ] **Step 2: Backend implementation**

In `getTransactions`:

- if `query.transType` is empty, exclude legacy arrival types defensively.
- if `query.transType` is `MAT_IN` or `MAT_IN_CANCEL`, return empty or reject with BadRequest. Prefer empty only if frontend may hold stale filter values.

- [ ] **Step 3: Frontend filter labels**

Remove these from `TRANS_TYPES`:

```ts
{ value: 'MAT_IN', label: t('inventory.transaction.matIn') },
{ value: 'MAT_IN_CANCEL', label: t('inventory.transaction.matInCancel') },
```

Keep `RECEIVE` but consider label:

```ts
{ value: 'RECEIVE', label: t('inventory.transaction.receive', '입고') }
```

Do not remove locale keys if other pages still use them.

- [ ] **Step 4: Run tests/typecheck**

Run:

```powershell
pnpm --filter @harness/backend test -- inventory-query.service.spec.ts --runInBand
pnpm --dir apps/backend exec tsc --noEmit --pretty false
pnpm --filter @harness/frontend exec tsc --noEmit --pretty false
```

Expected: pass.

---

### Task 9: End-To-End Runtime Verification

**Files:**
- Create or modify: `tools/hanes-mat-arrival-stock-split-runtime-test.mjs`
- Update: `docs/reports/hanes-mat-arrival-stock-split-migration-2026-06-16.md`

- [ ] **Step 1: Write runtime script**

Create `tools/hanes-mat-arrival-stock-split-runtime-test.mjs`.

Flow:

1. create or reuse a test PO with one raw material.
2. confirm PO if needed.
3. call PO-line arrival endpoint.
4. query DB:
   - `MAT_ARRIVAL_STOCKS` increased.
   - `MAT_ARRIVAL_TRANSACTIONS` has `ARRIVAL_IN`.
   - `MAT_STOCKS` does not increase for the new `matUid`.
   - `STOCK_TRANSACTIONS` has no `MAT_IN` for the new `matUid`.
5. perform IQC PASS if required by receiving.
6. call `POST /material/receiving`.
7. query DB:
   - `MAT_ARRIVAL_STOCKS` decreased.
   - `MAT_ARRIVAL_TRANSACTIONS` has `ARRIVAL_OUT`.
   - `MAT_STOCKS` increased.
   - `STOCK_TRANSACTIONS` has `RECEIVE`.
8. call receipt cancel if the API supports it for the created `RECEIVE`.
9. query DB:
   - `MAT_STOCKS` decreased.
   - `MAT_ARRIVAL_STOCKS` restored.
   - `STOCK_TRANSACTIONS` has `RECEIVE_CANCEL`.
   - `MAT_ARRIVAL_TRANSACTIONS` has `ARRIVAL_RESTORE`.

- [ ] **Step 2: Run runtime script**

Run:

```powershell
node tools/hanes-mat-arrival-stock-split-runtime-test.mjs
```

Expected: all steps PASS and a JSON evidence artifact is written.

- [ ] **Step 3: Browser check `/inventory/transaction`**

Use Playwright or existing browser tooling:

1. open `http://localhost:3002/inventory/transaction`
2. verify transaction type dropdown does not contain `원자재 입고`
3. verify grid does not show `MAT_IN`/`원자재 입고`
4. verify newly created `RECEIVE` row appears after receiving

- [ ] **Step 4: API check**

Run:

```powershell
Invoke-RestMethod "http://localhost:3003/api/v1/inventory/transactions?limit=100" -Headers @{ Authorization = "Bearer admin@hanes.com"; "X-Company" = "40"; "X-Plant" = "1000" }
```

Expected: no returned item has `transType = MAT_IN` or `MAT_IN_CANCEL`.

- [ ] **Step 5: Update report**

Append:

- runtime test IDs
- DB before/after counts
- UI screenshot path if captured
- final PASS/FAIL

---

### Task 10: Final Verification And Handoff

**Files:**
- Modify: `.ai-coordination/JOURNAL.md`
- Modify: `.ai-coordination/TASKS.md`
- Modify: `.ai-coordination/LOCKS.md`
- Modify: `.ai-coordination/HANDOFF/codex.md`

- [ ] **Step 1: Run full focused verification**

Run:

```powershell
pnpm --filter @harness/backend test -- arrival-stock.service.spec.ts arrival.service.spec.ts arrival.service.po-line.spec.ts receiving.service.spec.ts receipt-cancel.service.spec.ts inventory-query.service.spec.ts --runInBand
pnpm --dir apps/backend exec tsc --noEmit --pretty false
pnpm --filter @harness/frontend exec tsc --noEmit --pretty false
git diff --check
```

Expected: all pass.

- [ ] **Step 2: Confirm DB invariants**

Run:

```powershell
python C:/Users/hsyou/.codex/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT COUNT(*) CNT FROM STOCK_TRANSACTIONS WHERE TRANS_TYPE IN ('MAT_IN','MAT_IN_CANCEL')"
python C:/Users/hsyou/.codex/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT COUNT(*) CNT FROM MAT_ARRIVAL_STOCKS WHERE QTY < 0 OR AVAILABLE_QTY < 0"
python C:/Users/hsyou/.codex/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "SELECT COUNT(*) CNT FROM MAT_STOCKS WHERE QTY < 0 OR AVAILABLE_QTY < 0"
```

Expected: all counts are zero.

- [ ] **Step 3: Update coordination**

If complete:

- append detailed outcome to `.ai-coordination/JOURNAL.md`
- move task summary to `.ai-coordination/ARCHIVE.md`
- remove active task from `.ai-coordination/TASKS.md`
- release locks in `.ai-coordination/LOCKS.md`
- update `.ai-coordination/HANDOFF/codex.md`

- [ ] **Step 4: Commit only if user asks**

Because `AGENTS.md` says commits are user-requested only, do not commit automatically.

If user asks:

```powershell
git diff --check
git status --short
git add <approved files only>
git diff --cached --name-status
git commit -m "feat: split material arrival stock ledger"
```

Expected: staged files match the approved scope.

---

## Known Risks

- `MAT_ARRIVALS` total differs from `STOCK_TRANSACTIONS.MAT_IN` total in current JSHANES. Migration source of truth is `STOCK_TRANSACTIONS.MAT_IN`; differences must be reported, not silently corrected.
- `receipt-cancel.service.ts` currently references `RECEIPT`, but live data uses `RECEIVE`. This fix is part of the plan and should be tested before runtime verification.
- Concession receive may involve stock already moved to a bad warehouse. Keep a compatibility branch if no arrival stock exists for the concession `matUid`.
- Existing dirty worktree is broad. Stage only files from this plan if a commit is requested.

## Execution Choice

Plan complete. Recommended execution is inline with explicit checkpoints because this work touches DB migration, shared entities, and runtime JSHANES verification. Subagent-driven execution is possible only if the user explicitly requests subagents.
