# Core Integrity Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent duplicate numbering, cross-tenant numbering updates, and concurrent inventory lost updates.

**Architecture:** Enforce forbidden-pattern rules at the architecture-test seam, use one global Oracle sequence per converted number type, and mutate stock with atomic conditional SQL. `SEQ_RULES` is formatting metadata only; `NUM_RULE_MASTERS.CURRENT_SEQ` is not used by converted channels. Apply DB constraints only after read-only pre-checks.

**Tech Stack:** NestJS, TypeORM, Oracle, Jest, pnpm

---

### Task 1: Numbering policy gate

**Files:**
- Create: `apps/backend/src/architecture/numbering-policy.spec.ts`

- [x] Write a failing architecture test for runtime `MAX+1`, last-row increment, newly added daily reset, cycling sequences, and repository `count + 1`.
- [x] Run the focused test and confirm the current violations.
- [x] Freeze existing historical violations as an exact-file baseline allowlist: initial `START WITH` calculation and already-applied daily reset/CYCLE migrations may remain read-only, but any new file or any non-baselined occurrence fails. Runtime source is never allowlisted.
- [x] Re-run the focused test.

### Task 2: Numbering implementation

**Files:**
- Modify: `apps/backend/src/shared/numbering.service.ts`
- Test: `apps/backend/src/shared/numbering.service.spec.ts`

- [x] Add failing routing and no-runtime-`MAX+1` tests.
- [x] Replace scoped `MAX+1`, `count + 1`, and mutable `CURRENT_SEQ` channels with global Oracle sequences.
- [x] Preserve existing external number formats through explicit prefix, date, and padding mappings.
- [x] Run focused tests.

Legacy `NUM_RULE_MASTERS` runtime callers were fully retired. The five active legacy-format channels use dedicated global sequences; unused mutable-counter service/module code was removed.

### Task 3: Atomic material stock mutation

**Files:**
- Modify: `apps/backend/src/modules/inventory/services/inventory.service.ts`
- Test: `apps/backend/src/modules/inventory/services/inventory.service.spec.ts`

- [x] Add a failing test asserting conditional arithmetic UPDATE and affected-row handling.
- [x] Implement conditional arithmetic subtraction inside the existing transaction.
- [x] Implement atomic UPDATE-first addition; if no row exists, INSERT and retry UPDATE on ORA-00001.
- [x] Preserve `AVAILABLE_QTY = QTY - RESERVED_QTY`.
- [x] Run focused tests.

### Task 4: Atomic product stock mutation

**Files:**
- Modify: `apps/backend/src/modules/inventory/services/product-inventory.service.ts`
- Test: `apps/backend/src/modules/inventory/services/product-inventory.service.spec.ts`

- [x] Add a failing test asserting conditional arithmetic UPDATE and affected-row handling.
- [x] Implement conditional arithmetic subtraction inside the existing transaction.
- [x] Implement atomic UPDATE-first addition; if no row exists, INSERT and retry UPDATE on ORA-00001.
- [x] Preserve `AVAILABLE_QTY = QTY - RESERVED_QTY`.
- [x] Run focused tests.

### Task 5: Oracle constraints and verification

**Files:**
- Create: `apps/backend/src/migrations/2026-09-03_core_integrity_hardening.sql`
- Regenerate: `docs/database/schema-erd.md`

- [x] Query JSHANES for negative quantities, invariant mismatches, missing rules, sequence state, and duplicate keys.
- [x] Treat existing `2026-09-03_numbering_max_plus_one_fix.sql` and `2026-09-03_numbering_c_group_rules.sql` as read-only audit input; do not rewrite potentially applied migrations.
- [x] Add idempotent `NOCYCLE` sequences and `SEQ_RULES` rows without seeding new mutable counters.
- [x] Add named CHECK constraints to `MAT_STOCKS` and `PRODUCT_STOCKS` only when every pre-check count is zero.
- [x] Apply each DDL stage separately through the JSHANES Oracle connector and verify each object.
- [x] Keep migrations rerun-safe through object-existence checks.
- [x] Run a JSHANES live-data concurrency scenario using an isolated company/plant/warehouse/item key, verify one success/one rejection/final quantity 3, then clean up.
- [x] Run post-check queries and regenerate the ERD.
- [x] Run focused tests, architecture tests, full backend Jest, and backend typecheck.

### Task 6: Coordination handoff

**Files:**
- Modify: `.ai-coordination/JOURNAL.md`
- Create: `.ai-coordination/HANDOFF/codex-integrity.md`
- Modify: `.ai-coordination/TASKS.md`
- Modify: `.ai-coordination/LOCKS.md`
- Modify: `.ai-coordination/REVIEW_QUEUE.md`

- [x] Record changed files, verification evidence, DB state, operator evidence, and audited modules.
- [x] Move review-ready work to `REVIEW_QUEUE.md` and archive the implementation task.
- [x] Release locks.
