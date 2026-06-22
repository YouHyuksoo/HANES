# HANES Architecture Improvement Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `architecture-analysis-report.md` into a staged implementation path that reduces real production risk first, then improves shared contracts, transaction locality, module depth, and Oracle access boundaries.

**Architecture:** Start with the tenant persistence seam because Oracle `NOT NULL` columns can break user workflows immediately. Then move duplicated frontend/backend data shapes to `@harness/shared`, migrate one transaction-heavy vertical slice to `TransactionService`, split the remaining large material module by capability, and only then consolidate raw Oracle access behind an adapter.

**Tech Stack:** NestJS, TypeORM, Oracle, Jest, Next.js, React, Turborepo, `@harness/shared`.

---

## Current-Code Corrections From The Report

- `QualityModule` is already split into submodules such as `DefectsModule`, `InspectionModule`, `OqcModule`, `ReworkModule`, `SpcModule`, `PpapModule`, `FaiModule`, and `ContinuityInspectModule`. Do not schedule a broad quality-module split unless a later audit finds export or ownership problems.
- `MaterialModule` is still the main large module and should be the primary module-depth target.
- `TransactionService` exists at `apps/backend/src/shared/transaction.service.ts`, but manual `createQueryRunner` calls still appear across material, inventory, and production services.
- `packages/shared` already exists, but the frontend still carries local production/material row types that duplicate shared contracts.
- Raw Oracle access still coexists with TypeORM. Treat that as a later adapter/consolidation task, not the first refactor.

## Phase 0: Tenant Persistence Guardrail

This phase prevents the same `ORA-01400` class seen in warehouse creation from appearing on other pages.

### Task 1: Add Tenant Context To High-Risk Writes

Files:

- Modify `apps/backend/src/modules/master/controllers/transfer-rule.controller.ts`
- Modify `apps/backend/src/modules/master/services/transfer-rule.service.ts`
- Modify `apps/backend/src/modules/inventory/inventory.controller.ts`
- Modify `apps/backend/src/modules/inventory/services/inventory.service.ts`
- Verify or extend `apps/backend/src/modules/inventory/services/warehouse.service.ts`
- Add or extend `apps/backend/src/modules/master/services/transfer-rule.service.spec.ts`
- Add or extend `apps/backend/src/modules/inventory/services/inventory.service.spec.ts`
- Add or extend `apps/backend/src/modules/inventory/services/warehouse.service.spec.ts`

Steps:

- [x] Write a failing test for transfer rule creation: `create(dto, company, plant)` must persist `company` and `plant` into `WAREHOUSE_TRANSFER_RULES`.
- [x] Thread tenant context from the authenticated request/controller into `TransferRuleService.create`.
- [x] Ensure update/list/delete queries for transfer rules include tenant filters where applicable.
- [x] Write failing tests for `InventoryService.createLot`, `receiveStock`, `issueStock`, and `transferStock`: generated `MAT_LOTS`, `MAT_STOCKS`, and `STOCK_TRANSACTIONS` rows must include tenant fields when the table requires them.
- [x] Thread tenant context through inventory controller entry points into inventory service methods.
- [x] Keep backwards-compatible method signatures only where tests or existing callers require them; otherwise make tenant context explicit.
- [x] Verify the already-changed warehouse creation path has a focused test that covers `company` and `plant`.

Verification:

```powershell
pnpm --filter @harness/backend test -- warehouse.service.spec.ts transfer-rule.service.spec.ts inventory.service.spec.ts --runInBand
.\node_modules\.bin\tsc.CMD --noEmit --pretty false -p apps/backend/tsconfig.build.json
```

Commit boundary:

- One commit for tenant propagation and tests.

## Phase 1: Shared Contract Narrow Slice

Do not migrate every duplicated frontend type at once. Start with the production job-order family because it appears in multiple UI surfaces.

### Task 2: Move Job Order UI Shapes To `@harness/shared`

Files:

- Inspect `packages/shared/src/types/production.ts`
- Modify `apps/frontend/src/types/index.ts`
- Modify `apps/frontend/src/components/production/JobOrderSelectModal.tsx`
- Modify `apps/frontend/src/app/(authenticated)/production/order/page.tsx`
- Modify `apps/frontend/src/hooks/material/useIssueRequestData.ts`
- Modify `apps/frontend/src/app/(authenticated)/production/sample-inspect/components/SampleInspectInputModal.tsx`
- Modify `apps/frontend/src/app/(authenticated)/inspection/result/types.ts`

Steps:

- [x] Compare each frontend `JobOrder*` shape against `packages/shared/src/types/production.ts`.
- [x] Add shared extension types only when the UI genuinely needs view-only fields.
- [x] Replace local aliases with shared imports where the shape matches.
- [x] Keep API response mapping close to the fetch/hook layer so UI components do not depend on backend casing drift.
- [x] Add a lightweight type-level test or compile-only guard if the repo already has a pattern for it.

Verification:

```powershell
.\node_modules\.bin\tsc.CMD --noEmit --pretty false -p apps/frontend/tsconfig.json
pnpm --filter @harness/frontend exec eslint apps/frontend/src/components/production/JobOrderSelectModal.tsx apps/frontend/src/hooks/material/useIssueRequestData.ts
```

Commit boundary:

- One commit for shared job-order type adoption.

## Phase 2: Transaction Locality

Use `TransactionService` as the transaction implementation seam. Start with one vertical slice so behavior can be characterized before broad edits.

### Task 3: Migrate Inventory Stock Mutation Flow To `TransactionService`

Files:

- Modify `apps/backend/src/modules/inventory/services/inventory.service.ts`
- Inspect related material services under `apps/backend/src/modules/material/services/`
- Extend `apps/backend/src/modules/inventory/services/inventory.service.spec.ts`

Steps:

- [x] Characterize current stock mutation behavior in tests: lot creation, receive, issue, transfer, rollback on stock insufficiency, rollback on transaction insert failure.
- [x] Inject and use `TransactionService.run` for the selected inventory mutation methods.
- [x] Pass transactional manager/repositories through helper methods instead of opening nested query runners.
- [x] Remove only the manual `createQueryRunner` calls covered by the characterization tests.
- [x] Leave unrelated material and production services unchanged until separate slices are scheduled.

Verification:

```powershell
pnpm --filter @harness/backend test -- inventory.service.spec.ts --runInBand
.\node_modules\.bin\tsc.CMD --noEmit --pretty false -p apps/backend/tsconfig.build.json
```

Commit boundary:

- One commit for the inventory transaction slice.

## Phase 3: Material Module Depth

Split `MaterialModule` by capability. Keep public module interfaces stable while moving implementations behind submodules.

### Task 4: Split `MaterialModule` Into Capability Modules

Files:

- Modify `apps/backend/src/modules/material/material.module.ts`
- Add modules under `apps/backend/src/modules/material/` such as:
  - `receiving/receiving.module.ts`
  - `issue/issue.module.ts`
  - `lot/lot.module.ts`
  - `inventory-control/inventory-control.module.ts`
  - `labels/labels.module.ts`
- Move providers/controllers only when their ownership is clear.

Steps:

- [x] Produce a provider/controller map for the current `MaterialModule`.
- [x] Group objects by domain capability: receiving, issue request, lot split/merge, hold/scrap/adjustment, physical inventory, labels.
- [x] Create one submodule at a time and import it from `MaterialModule`.
- [x] Keep entity registration close to the module that owns the write behavior.
- [x] Avoid changing routes during the split unless tests prove a route is already wrong.
- [x] Run compile after each submodule extraction.

Verification:

```powershell
.\node_modules\.bin\tsc.CMD --noEmit --pretty false -p apps/backend/tsconfig.build.json
pnpm --filter @harness/backend test -- --runInBand
```

Commit boundary:

- Prefer one commit per extracted submodule if the diff is large.

## Phase 4: Oracle Adapter Consolidation

Do this after Phases 0-3. Otherwise, DB access changes and transaction changes will overlap too much.

### Task 5: Put Raw Oracle Calls Behind A Narrow Adapter

Files:

- Inspect `apps/backend/src/common/services/oracle.service.ts`
- Inspect modules that inject or call raw Oracle access directly
- Add an adapter under a stable shared/database boundary if none exists

Current caller inventory:

- Query-only procedure callers:
  - `apps/backend/src/modules/dashboard/dashboard.service.ts` uses `PKG_DASHBOARD` cursor procedures for dashboard reads.
  - `apps/backend/src/modules/workflow/workflow.service.ts` uses `PKG_WORKFLOW.SP_WORKFLOW_SUMMARY` for workflow summary reads.
- Legacy procedure caller:
  - `apps/backend/src/modules/scheduler/executors/procedure.executor.ts` executes dynamic scheduler `PKG_NAME.PROC_NAME` targets and may include write-side procedures.
- Raw TypeORM `DataSource.query` and `manager.query` calls remain separate from the Oracle procedure adapter because they participate in TypeORM repository or transaction boundaries.

Steps:

- [x] Build a caller inventory for `OracleService` and raw SQL helpers.
- [x] Classify each caller as reporting/query-only, legacy procedure call, or write path.
- [x] Define a narrow adapter interface for the most common query-only usage first.
- [x] Move one low-risk caller to the adapter.
- [x] Add tests around bind variables and error propagation.
- [x] Keep TypeORM transaction paths separate from raw Oracle adapter paths unless an explicit transaction boundary is designed.

Verification:

```powershell
.\node_modules\.bin\tsc.CMD --noEmit --pretty false -p apps/backend/tsconfig.build.json
pnpm --filter @harness/backend test -- --runInBand
```

Commit boundary:

- One commit for adapter introduction and one low-risk caller migration.

## Final Gates

Run these before considering the roadmap implementation complete:

```powershell
git diff --check
.\node_modules\.bin\tsc.CMD --noEmit --pretty false -p apps/backend/tsconfig.build.json
.\node_modules\.bin\tsc.CMD --noEmit --pretty false -p apps/frontend/tsconfig.json
pnpm --filter @harness/backend test -- --runInBand
```

## Recommended Order

1. Phase 0 tenant persistence guardrail
2. Phase 1 shared job-order type migration
3. Phase 2 inventory transaction slice
4. Phase 3 material module split
5. Phase 4 raw Oracle adapter consolidation

Do not start Phase 4 before Phase 2 stabilizes. The Oracle pool/access boundary is valuable, but changing it while transaction behavior is still inconsistent will make regressions harder to isolate.
