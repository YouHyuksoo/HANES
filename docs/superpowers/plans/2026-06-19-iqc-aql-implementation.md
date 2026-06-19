# IQC AQL 기준관리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** IQC 수동 시료수 입력을 제거하고 AQL 기준표 기반으로 시료수/Ac/Re를 자동 산출해 IQC 이력에 판정 근거를 남긴다.

**Architecture:** AQL 기준은 `quality/aql` 전용 모듈과 `/quality/aql` 화면에서 관리한다. 품목별 IQC 기준은 `AQL_CODE`만 참조하고, IQC 저장 시 서버가 LOT 수량 기준으로 AQL rule을 재산출해 `IQC_LOGS`에 저장한다.

**Tech Stack:** NestJS, TypeORM, Oracle raw SQL migration, Next.js React client components, existing HANES DataGrid/UI components, Node structure tests, Jest.

---

## File Map

Create:

- `apps/backend/src/entities/aql-standard.entity.ts`
- `apps/backend/src/entities/aql-sampling-rule.entity.ts`
- `apps/backend/src/modules/quality/aql/aql.module.ts`
- `apps/backend/src/modules/quality/aql/controllers/aql.controller.ts`
- `apps/backend/src/modules/quality/aql/services/aql.service.ts`
- `apps/backend/src/modules/quality/aql/services/aql.service.spec.ts`
- `apps/backend/src/modules/quality/aql/dto/aql.dto.ts`
- `apps/backend/src/migrations/2026-06-19_iqc_aql_standards.sql`
- `apps/frontend/src/app/(authenticated)/quality/aql/page.tsx`
- `apps/frontend/src/app/(authenticated)/quality/aql/iqc-aql.structure.test.mjs`

Modify:

- `apps/backend/src/entities/iqc-part-spec.entity.ts`
- `apps/backend/src/entities/iqc-log.entity.ts`
- `apps/backend/src/modules/quality/quality.module.ts`
- `apps/backend/src/modules/master/master.module.ts`
- `apps/backend/src/modules/master/dto/iqc-part-spec.dto.ts`
- `apps/backend/src/modules/master/services/iqc-part-spec.service.ts`
- `apps/backend/src/modules/master/services/iqc-part-spec.service.spec.ts`
- `apps/backend/src/modules/material/dto/iqc-history.dto.ts`
- `apps/backend/src/modules/material/services/iqc-history.service.ts`
- `apps/backend/src/modules/material/services/iqc-history.service.spec.ts`
- `apps/frontend/src/config/menuConfig.ts`
- `apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts`
- `apps/frontend/src/components/layout/pageRegistry.generated.ts`
- `apps/frontend/src/locales/ko.json`
- `apps/frontend/src/locales/en.json`
- `apps/frontend/src/locales/zh.json`
- `apps/frontend/src/locales/vi.json`
- `apps/frontend/src/app/(authenticated)/master/iqc-item/types.ts`
- `apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcSpecPanel.tsx`
- `apps/frontend/src/components/material/IqcModal.tsx`
- `apps/frontend/src/hooks/material/useIqcData.ts`
- `docs/reports/db-schema-erd.md`

Do not modify:

- `IQC_LOGS.INSPECT_CLASS` semantics
- OQC screens/services in this phase
- Physical removal of `IQC_PART_SPECS.SAMPLE_QTY`

## Task 1: Backend AQL schema and entities

**Files:**
- Create: `apps/backend/src/entities/aql-standard.entity.ts`
- Create: `apps/backend/src/entities/aql-sampling-rule.entity.ts`
- Create: `apps/backend/src/migrations/2026-06-19_iqc_aql_standards.sql`
- Modify: `apps/backend/src/entities/iqc-part-spec.entity.ts`
- Modify: `apps/backend/src/entities/iqc-log.entity.ts`

- [ ] **Step 1: Write failing entity metadata tests**

Add or extend focused entity tests to assert:

- `AqlStandard` primary columns are `COMPANY`, `PLANT_CD`, `AQL_CODE`
- `AqlSamplingRule` primary columns are `COMPANY`, `PLANT_CD`, `AQL_CODE`, `LOT_QTY_FROM`
- `IqcPartSpec` exposes `AQL_CODE`
- `IqcLog` exposes `AQL_CODE`, `AQL_SAMPLE_SIZE`, `AQL_ACCEPT_QTY`, `AQL_REJECT_QTY`

Run:

```powershell
pnpm --filter @harness/backend test -- aql-standard.entity.spec.ts iqc-part-spec.entity.spec.ts --runInBand
```

Expected: FAIL because AQL entities and columns do not exist.

- [ ] **Step 2: Implement entities and migration**

Migration requirements:

- Create `AQL_STANDARDS`
- Create `AQL_SAMPLING_RULES`
- Add nullable `AQL_CODE` to `IQC_PART_SPECS`
- Add nullable `AQL_CODE`, `AQL_SAMPLE_SIZE`, `AQL_ACCEPT_QTY`, `AQL_REJECT_QTY` to `IQC_LOGS`
- Keep `IQC_PART_SPECS.SAMPLE_QTY`
- Use idempotent PL/SQL blocks compatible with `oracle_connector.py --execute-file`
- Do not use `MAX()+1` or generated numeric IDs

- [ ] **Step 3: Run entity tests**

Run:

```powershell
pnpm --filter @harness/backend test -- aql-standard.entity.spec.ts iqc-part-spec.entity.spec.ts --runInBand
```

Expected: PASS.

## Task 2: AQL service and API

**Files:**
- Create: `apps/backend/src/modules/quality/aql/aql.module.ts`
- Create: `apps/backend/src/modules/quality/aql/controllers/aql.controller.ts`
- Create: `apps/backend/src/modules/quality/aql/services/aql.service.ts`
- Create: `apps/backend/src/modules/quality/aql/services/aql.service.spec.ts`
- Create: `apps/backend/src/modules/quality/aql/dto/aql.dto.ts`
- Modify: `apps/backend/src/modules/quality/quality.module.ts`

- [ ] **Step 1: Write failing service tests**

Test cases:

- Resolves `lotQty=25` to the rule where `LOT_QTY_FROM <= 25 <= LOT_QTY_TO`
- Rejects overlapping ranges for one AQL code
- Ignores inactive AQL standards for resolve
- Returns a clear null or exception when no matching range exists

Run:

```powershell
pnpm --filter @harness/backend test -- aql.service.spec.ts --runInBand
```

Expected: FAIL because service does not exist.

- [ ] **Step 2: Implement service and controller**

Endpoints:

- `GET /quality/aql`
- `GET /quality/aql/:aqlCode`
- `POST /quality/aql`
- `PUT /quality/aql/:aqlCode`
- `DELETE /quality/aql/:aqlCode`
- `GET /quality/aql/resolve?itemCode=...&lotQty=...`

Rules:

- All queries are tenant-scoped by `company` and `plant`
- Delete should soft-disable or fail if referenced by active IQC part specs; prefer `USE_YN='N'` in first implementation
- Resolve reads `IQC_PART_SPECS.AQL_CODE` for `itemCode`, then finds matching `AQL_SAMPLING_RULES`

- [ ] **Step 3: Run backend AQL tests**

Run:

```powershell
pnpm --filter @harness/backend test -- aql.service.spec.ts --runInBand
pnpm --filter @harness/backend exec tsc --noEmit --pretty false
```

Expected: PASS.

## Task 3: IQC part spec AQL reference

**Files:**
- Modify: `apps/backend/src/modules/master/master.module.ts`
- Modify: `apps/backend/src/modules/master/dto/iqc-part-spec.dto.ts`
- Modify: `apps/backend/src/modules/master/services/iqc-part-spec.service.ts`
- Modify: `apps/backend/src/modules/master/services/iqc-part-spec.service.spec.ts`
- Modify: `apps/backend/src/entities/iqc-part-spec.entity.ts`

- [ ] **Step 1: Write failing service tests**

Test cases:

- Upsert accepts `aqlCode` without requiring a meaningful `sampleQty`
- New rows keep `SAMPLE_QTY` at compatibility default but return/use `aqlCode`
- Existing rows update `aqlCode`

Run:

```powershell
pnpm --filter @harness/backend test -- iqc-part-spec.service.spec.ts --runInBand
```

Expected: FAIL because `aqlCode` is not handled.

- [ ] **Step 2: Implement DTO and service update**

Requirements:

- Add optional `aqlCode`
- Make `sampleQty` optional for compatibility
- Keep existing response shape but include `aqlCode`
- Do not remove `sampleQty` from entity yet

- [ ] **Step 3: Run tests**

Run:

```powershell
pnpm --filter @harness/backend test -- iqc-part-spec.service.spec.ts --runInBand
pnpm --filter @harness/backend exec tsc --noEmit --pretty false
```

Expected: PASS.

## Task 4: IQC save path applies AQL server-side

**Files:**
- Modify: `apps/backend/src/modules/material/dto/iqc-history.dto.ts`
- Modify: `apps/backend/src/modules/material/services/iqc-history.service.ts`
- Modify: `apps/backend/src/modules/material/services/iqc-history.service.spec.ts`
- Modify: `apps/backend/src/entities/iqc-log.entity.ts`

- [ ] **Step 1: Write failing IQC history tests**

Test cases:

- When item has AQL code and lot quantity matches a rule, create stores `aqlCode`, `aqlSampleSize`, `aqlAcceptQty`, `aqlRejectQty`
- `destructSampleQty` is set from `aqlSampleSize`
- Client-sent `sampleQty` is ignored for the AQL-governed IQC path
- Missing AQL standard blocks IQC save with a clear error
- Missing LOT range blocks IQC save with a clear error

Run:

```powershell
pnpm --filter @harness/backend test -- iqc-history.service.spec.ts --runInBand
```

Expected: FAIL because AQL is not applied.

- [ ] **Step 2: Implement server-side AQL resolution**

Requirements:

- Inject or import `AqlService` into the material module path used by `IqcHistoryService`
- Resolve LOT quantity from trusted server data, not a client-only value
- Persist AQL metadata to `IQC_LOGS`
- Preserve existing serial inspection payload behavior
- Preserve `INSPECT_CLASS` as legacy/history field only

- [ ] **Step 3: Run backend tests**

Run:

```powershell
pnpm --filter @harness/backend test -- iqc-history.service.spec.ts aql.service.spec.ts iqc-part-spec.service.spec.ts --runInBand
pnpm --filter @harness/backend exec tsc --noEmit --pretty false
```

Expected: PASS.

## Task 5: AQL management frontend page and menu

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/quality/aql/page.tsx`
- Create: `apps/frontend/src/app/(authenticated)/quality/aql/iqc-aql.structure.test.mjs`
- Modify: `apps/frontend/src/config/menuConfig.ts`
- Modify: `apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts`
- Modify: `apps/frontend/src/components/layout/pageRegistry.generated.ts`
- Modify: `apps/frontend/src/locales/ko.json`
- Modify: `apps/frontend/src/locales/en.json`
- Modify: `apps/frontend/src/locales/zh.json`
- Modify: `apps/frontend/src/locales/vi.json`

- [ ] **Step 1: Write failing structure test**

Assert:

- `QC_AQL` exists in `menuConfig.ts`
- `QC_AQL` exists in `KNOWN_LEAF_CODES`
- `/quality/aql` exists in `pageRegistry.generated.ts`
- `quality/aql/page.tsx` calls `/quality/aql`
- Page exposes rule fields `lotQtyFrom`, `lotQtyTo`, `sampleSize`, `acceptQty`, `rejectQty`

Run:

```powershell
node --test 'apps/frontend/src/app/(authenticated)/quality/aql/iqc-aql.structure.test.mjs'
```

Expected: FAIL.

- [ ] **Step 2: Implement page**

UI shape:

- Header with refresh and save actions
- Left DataGrid for AQL standards
- Right panel or section for range rules
- Add/edit/delete rule rows inline
- Validate range overlap before save in UI, but backend remains source of truth

- [ ] **Step 3: Run frontend tests**

Run:

```powershell
node --test 'apps/frontend/src/app/(authenticated)/quality/aql/iqc-aql.structure.test.mjs'
pnpm --filter @harness/frontend exec tsc --noEmit --pretty false
```

Expected: PASS.

## Task 6: Remove manual sample quantity from IQC UI

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/master/iqc-item/types.ts`
- Modify: `apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcSpecPanel.tsx`
- Modify: `apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcTemplatePickerModal.tsx`
- Modify: `apps/frontend/src/components/material/IqcModal.tsx`
- Modify: `apps/frontend/src/hooks/material/useIqcData.ts`
- Extend: `apps/frontend/src/app/(authenticated)/quality/aql/iqc-aql.structure.test.mjs`

- [ ] **Step 1: Extend failing structure test**

Assert:

- `IqcSpecPanel.tsx` no longer renders editable `sampleQty` input
- `IqcSpecPanel.tsx` renders `aqlCode` Select or equivalent selection control
- `IqcModal.tsx` no longer has manual `sampleQty` state/input
- `IqcModal.tsx` calls AQL resolve endpoint and displays `sampleSize`, `acceptQty`, `rejectQty`
- `useIqcData.ts` does not send user-entered `sampleQty`

Run:

```powershell
node --test 'apps/frontend/src/app/(authenticated)/quality/aql/iqc-aql.structure.test.mjs'
```

Expected: FAIL.

- [ ] **Step 2: Implement UI changes**

Requirements:

- IQC part spec saves `aqlCode`
- Template picker does not reapply `sampleQty`
- IQC modal displays AQL basis
- Save is disabled if AQL cannot be resolved
- Existing scanned serial workflow remains unchanged

- [ ] **Step 3: Run frontend tests**

Run:

```powershell
node --test 'apps/frontend/src/app/(authenticated)/quality/aql/iqc-aql.structure.test.mjs'
node --test 'apps/frontend/src/components/material/iqc-modal-serial-flow.structure.test.mjs'
node --test 'apps/frontend/src/components/material/iqc-modal-compact-scan-layout.structure.test.mjs'
pnpm --filter @harness/frontend exec tsc --noEmit --pretty false
```

Expected: PASS.

## Task 7: Oracle migration, ERD, and runtime verification

**Files:**
- Modify: `docs/reports/db-schema-erd.md`
- Use: `apps/backend/src/migrations/2026-06-19_iqc_aql_standards.sql`

- [ ] **Step 1: Apply migration to JSHANES**

Run:

```powershell
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-06-19_iqc_aql_standards.sql
```

Expected: success, blocks executed.

- [ ] **Step 2: Post-check schema**

Run SQL through the Oracle connector:

```sql
SELECT table_name FROM user_tables WHERE table_name IN ('AQL_STANDARDS', 'AQL_SAMPLING_RULES');
SELECT column_name FROM user_tab_columns WHERE table_name = 'IQC_PART_SPECS' AND column_name = 'AQL_CODE';
SELECT column_name FROM user_tab_columns WHERE table_name = 'IQC_LOGS' AND column_name LIKE 'AQL%';
```

Expected:

- 2 AQL tables
- `IQC_PART_SPECS.AQL_CODE`
- `IQC_LOGS.AQL_CODE`, `AQL_SAMPLE_SIZE`, `AQL_ACCEPT_QTY`, `AQL_REJECT_QTY`

- [ ] **Step 3: Regenerate ERD**

Run:

```powershell
python tools/generate_db_schema_doc.py
```

Expected: `docs/reports/db-schema-erd.md` updated with AQL tables and columns.

- [ ] **Step 4: Browser/API verification**

Verify:

- `/quality/aql` loads and saves a sample AQL standard
- `/master/iqc-part-spec` can assign that AQL standard to a raw material
- `/material/iqc` displays AQL sample size/Ac/Re
- Saving IQC creates `IQC_LOGS` row with AQL metadata

- [ ] **Step 5: Final full checks**

Run:

```powershell
pnpm --filter @harness/backend exec tsc --noEmit --pretty false
pnpm --filter @harness/frontend exec tsc --noEmit --pretty false
```

Expected: PASS.

## Commit Plan

Commit only after user approval.

Recommended commits:

1. `feat: add iqc aql backend standards`
2. `feat: add iqc aql management page`
3. `feat: apply aql sampling to iqc`

Before every commit:

```powershell
git status --short
git diff --cached --name-status
git diff --cached --check
```

Do not include unrelated dirty files such as `.claude/worktrees/` or existing changes to `apps/backend/src/modules/material/services/iqc-history.service.ts` unless they are intentionally part of the implementation task.
