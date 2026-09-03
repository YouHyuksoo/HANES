# Core Integrity Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent duplicate numbering, cross-tenant numbering updates, and concurrent inventory lost updates.

**Architecture:** Enforce forbidden-pattern rules at the architecture-test seam, use one global Oracle sequence per converted number type, and mutate stock with atomic conditional SQL. `SEQ_RULES` is formatting metadata only; `NUM_RULE_MASTERS.CURRENT_SEQ` is not used by converted channels. Apply DB constraints only after read-only pre-checks.

**Tech Stack:** NestJS, TypeORM, Oracle, Jest, pnpm

---

### Task 1: Numbering policy gate

**Files:**
- Create: `apps/backend/src/architecture/numbering-policy.spec.ts`

- [ ] Write a failing architecture test for runtime `MAX+1`, last-row increment, newly added daily reset, and cycling sequences.
- [ ] Run the focused test and confirm the current violations.
- [ ] Freeze existing historical violations as an exact-file baseline allowlist: initial `START WITH` calculation and already-applied daily reset/CYCLE migrations may remain read-only, but any new file or any non-baselined occurrence fails. Runtime source is never allowlisted.
- [ ] Re-run the focused test.

### Task 2: Numbering implementation

**Files:**
- Modify: `apps/backend/src/shared/numbering.service.ts`
- Test: `apps/backend/src/shared/numbering.service.spec.ts`

- [ ] Add failing routing and no-runtime-`MAX+1` tests.
- [ ] Replace scoped `MAX+1` methods and newly converted `RULE_TYPES` with `SEQ_RULES`-mapped global sequence channels.
- [ ] Preserve existing external number formats through explicit `PREFIX`, `DATE_FORMAT`, `SEPARATOR`, and padding mappings.
- [ ] Run focused tests.

Legacy `NUM_RULE_MASTERS` callers are inventoried but not contract-changed in this slice because their many callers do not currently provide tenant context. No new caller may be added; a follow-up migration can retire the legacy table after each format is mapped.

### Task 3: Atomic material stock mutation

**Files:**
- Modify: `apps/backend/src/modules/inventory/services/inventory.service.ts`
- Test: `apps/backend/src/modules/inventory/services/inventory.service.spec.ts`

- [ ] Add a failing test asserting conditional arithmetic UPDATE and affected-row handling.
- [ ] Implement conditional arithmetic subtraction inside the existing transaction.
- [ ] Implement atomic UPDATE-first addition; if no row exists, INSERT and retry UPDATE on ORA-00001.
- [ ] Preserve `AVAILABLE_QTY = QTY - RESERVED_QTY`.
- [ ] Run focused tests.

### Task 4: Atomic product stock mutation

**Files:**
- Modify: `apps/backend/src/modules/inventory/services/product-inventory.service.ts`
- Test: `apps/backend/src/modules/inventory/services/product-inventory.service.spec.ts`

- [ ] Add a failing test asserting conditional arithmetic UPDATE and affected-row handling.
- [ ] Implement conditional arithmetic subtraction inside the existing transaction.
- [ ] Implement atomic UPDATE-first addition; if no row exists, INSERT and retry UPDATE on ORA-00001.
- [ ] Preserve `AVAILABLE_QTY = QTY - RESERVED_QTY`.
- [ ] Run focused tests.

### Task 5: Oracle constraints and verification

**Files:**
- Create: `apps/backend/src/migrations/2026-09-03_core_integrity_hardening.sql`
- Regenerate: `docs/database/schema-erd.md`

- [ ] Query JSHANES for negative quantities, invariant mismatches, missing rules, sequence state, and duplicate keys.
- [ ] Treat existing `2026-09-03_numbering_max_plus_one_fix.sql` and `2026-09-03_numbering_c_group_rules.sql` as read-only audit input; do not rewrite potentially applied migrations.
- [ ] Add all idempotent `NOCYCLE` sequences and `SEQ_RULES` rows for the converted types only in `2026-09-03_core_integrity_hardening.sql`, using `/`-separated blocks; do not seed `NUM_RULE_MASTERS` for these channels.
- [ ] Add named CHECK constraints to `MAT_STOCKS` and `PRODUCT_STOCKS` only when every pre-check count is zero.
- [ ] Apply each DDL stage separately through the JSHANES Oracle connector; after each stage verify the exact object and stop on failure because Oracle DDL implicitly commits.
- [ ] Record rerun-safe object checks and manual recovery SQL for any partially applied stage.
- [ ] Run a JSHANES live-data concurrency scenario using an isolated company/plant/warehouse/item key: concurrent requests, success/failure counts, final quantity, then cleanup.
- [ ] Run post-check queries and regenerate the ERD.
- [ ] Run focused tests, architecture tests, and backend typecheck.

### Task 6: Coordination handoff

**Files:**
- Modify: `.ai-coordination/JOURNAL.md`
- Create: `.ai-coordination/HANDOFF/codex-integrity.md`
- Modify: `.ai-coordination/TASKS.md`
- Modify: `.ai-coordination/LOCKS.md`
- Modify: `.ai-coordination/REVIEW_QUEUE.md`

- [ ] Record changed files, verification evidence, DB state, operator evidence, reviewer result, and remaining audited modules.
- [ ] Move review-ready work to `REVIEW_QUEUE.md` or archive completed work.
- [ ] Release locks.
