# IQC AQL Z1.4 Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement IQC AQL sampling based on item-level AQL values, supplier inspection mode, ISO 2859-1 code letters, and automatic PASS/FAIL judgment.

**Architecture:** Item masters hold inspection level and Critical/Major/Minor AQL values. Supplier masters hold quality grade and inspection mode. A dedicated AQL policy service resolves code letter, sample quantity, and Ac/Re from ISO tables, and IQC save paths persist the calculated basis and server-side judgment.

**Tech Stack:** NestJS, TypeORM, Oracle raw SQL migration, Jest, Next.js React client components, Node structure tests, HANES DataGrid/UI.

---

## File Map

Create:

- `apps/backend/src/entities/aql-code-letter-rule.entity.ts`
- `apps/backend/src/entities/aql-acceptance-rule.entity.ts`
- `apps/backend/src/entities/vendor-inspection-mode-history.entity.ts`
- `apps/backend/src/modules/quality/aql/services/aql-policy.service.ts`
- `apps/backend/src/modules/quality/aql/services/aql-policy.service.spec.ts`
- `apps/backend/src/migrations/2026-06-20_iqc_aql_z14_policy.sql`
- `apps/frontend/src/app/(authenticated)/master/iqc-part-spec/iqc-part-spec-aql-policy.structure.test.mjs`
- `apps/frontend/src/components/material/iqc-modal-aql-policy.structure.test.mjs`

Modify:

- `apps/backend/src/entities/part-master.entity.ts`
- `apps/backend/src/entities/partner-master.entity.ts`
- `apps/backend/src/entities/iqc-log.entity.ts`
- `apps/backend/src/modules/master/dto/part.dto.ts`
- `apps/backend/src/modules/master/services/part.service.ts`
- `apps/backend/src/modules/master/dto/partner.dto.ts`
- `apps/backend/src/modules/master/services/partner.service.ts`
- `apps/backend/src/modules/quality/aql/aql.module.ts`
- `apps/backend/src/modules/quality/aql/controllers/aql.controller.ts`
- `apps/backend/src/modules/material/receiving/receiving.module.ts`
- `apps/backend/src/modules/material/services/iqc-history.service.ts`
- `apps/backend/src/modules/material/services/iqc-history.service.spec.ts`
- `apps/frontend/src/app/(authenticated)/master/iqc-item/types.ts`
- `apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcSpecPanel.tsx`
- `apps/frontend/src/app/(authenticated)/master/part/page.tsx`
- `apps/frontend/src/app/(authenticated)/master/partner/page.tsx`
- `apps/frontend/src/components/material/IqcModal.tsx`
- `apps/frontend/src/hooks/material/useIqcData.ts`
- `docs/reports/db-schema-erd.md`

Do not modify:

- `IQC_LOGS.INSPECT_CLASS` semantics
- Existing `IQC_PART_SPECS.SAMPLE_QTY` physical column
- OQC logic in this phase

## Task 1: Schema And Entity Contract

**Files:**
- Create: `apps/backend/src/migrations/2026-06-20_iqc_aql_z14_policy.sql`
- Create: `apps/backend/src/entities/aql-code-letter-rule.entity.ts`
- Create: `apps/backend/src/entities/aql-acceptance-rule.entity.ts`
- Create: `apps/backend/src/entities/vendor-inspection-mode-history.entity.ts`
- Modify: `apps/backend/src/entities/part-master.entity.ts`
- Modify: `apps/backend/src/entities/partner-master.entity.ts`
- Modify: `apps/backend/src/entities/iqc-log.entity.ts`
- Test: `apps/backend/src/entities/aql-standard.entity.spec.ts`

- [ ] **Step 1: Write failing entity metadata tests**

Add tests asserting:

- `PartMaster` exposes `INSPECTION_LEVEL`, `AQL_CRITICAL`, `AQL_MAJOR`, `AQL_MINOR`
- `PartnerMaster` exposes `QUALITY_GRADE`, `INSPECTION_MODE`
- `IqcLog` exposes AQL basis columns and defect count columns
- AQL code-letter and acceptance rule entities have tenant-aware primary keys

Run:

```powershell
pnpm --filter @harness/backend test -- aql-standard.entity.spec.ts --runInBand
```

Expected: FAIL because new columns/entities do not exist.

- [ ] **Step 2: Implement entities and migration**

Migration must:

- Add nullable item AQL columns to `ITEM_MASTERS`
- Add nullable supplier quality columns to `PARTNER_MASTERS`
- Create `AQL_CODE_LETTER_RULES`
- Create `AQL_ACCEPTANCE_RULES`
- Create `VENDOR_INSPECTION_MODE_HISTORY`
- Add AQL basis and defect count columns to `IQC_LOGS`
- Seed ISO 2859-1 general levels I/II/III and special S-1~S-4 code-letter rules
- Seed acceptance rules for `NORMAL`, `TIGHTENED`, `REDUCED` for existing AQL values used in COM_CODES
- Use idempotent Oracle PL/SQL blocks
- Do not use `MAX()+1`

- [ ] **Step 3: Verify entity tests pass**

Run:

```powershell
pnpm --filter @harness/backend test -- aql-standard.entity.spec.ts --runInBand
```

Expected: PASS.

## Task 2: AQL Policy Resolve Engine

**Files:**
- Create: `apps/backend/src/modules/quality/aql/services/aql-policy.service.ts`
- Create: `apps/backend/src/modules/quality/aql/services/aql-policy.service.spec.ts`
- Modify: `apps/backend/src/modules/quality/aql/aql.module.ts`
- Modify: `apps/backend/src/modules/quality/aql/controllers/aql.controller.ts`

- [ ] **Step 1: Write failing policy service tests**

Test cases:

- Resolves code letter from `inspectionLevel + lotQty`
- Resolves Major/Minor Ac/Re by `inspectionMode + codeLetter + AQL value`
- Returns the maximum sample quantity across defect classes
- Critical defect rule is marked as immediate fail when `defectCritical > 0`
- Throws clear errors when code-letter or acceptance rule is missing

Run:

```powershell
pnpm --filter @harness/backend test -- aql-policy.service.spec.ts --runInBand
```

Expected: FAIL because service does not exist.

- [ ] **Step 2: Implement `AqlPolicyService`**

Public methods:

- `resolvePolicy(input: { itemCode; vendorCode; lotQty; company; plant })`
- `judge(input: { policy; defectCritical; defectMajor; defectMinor })`

Rules:

- Read item AQL values from `ITEM_MASTERS`
- Read supplier inspection mode from `PARTNER_MASTERS`
- Critical count > 0 returns FAIL immediately
- Major/Minor use Re threshold for FAIL and Ac threshold for PASS
- If count is between Ac and Re due malformed table, return FAIL with explicit reason

- [ ] **Step 3: Add resolve API**

Endpoint:

```text
GET /quality/aql/resolve?itemCode=...&vendorCode=...&lotQty=...
```

The response includes:

- itemCode
- vendorCode
- inspectionLevel
- inspectionMode
- codeLetter
- sampleQty
- critical/major/minor AQL and Ac/Re basis

- [ ] **Step 4: Verify backend tests**

Run:

```powershell
pnpm --filter @harness/backend test -- aql-policy.service.spec.ts --runInBand
pnpm --filter @harness/backend exec tsc --noEmit --pretty false
```

Expected: PASS.

## Task 3: Master UI And API Fields

**Files:**
- Modify: `apps/backend/src/modules/master/dto/part.dto.ts`
- Modify: `apps/backend/src/modules/master/services/part.service.ts`
- Modify: `apps/backend/src/modules/master/dto/partner.dto.ts`
- Modify: `apps/backend/src/modules/master/services/partner.service.ts`
- Modify: `apps/frontend/src/app/(authenticated)/master/part/page.tsx`
- Modify: `apps/frontend/src/app/(authenticated)/master/partner/page.tsx`
- Modify: `apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcSpecPanel.tsx`
- Test: `apps/frontend/src/app/(authenticated)/master/iqc-part-spec/iqc-part-spec-aql-policy.structure.test.mjs`

- [ ] **Step 1: Write failing frontend structure test**

Assert:

- `/master/iqc-part-spec` keeps `기본 시료수`
- `/master/iqc-part-spec` shows `검사수준`, `Critical AQL`, `Major AQL`, `Minor AQL`
- It does not expose editable Ac/Re fields
- Partner master exposes `qualityGrade` and `inspectionMode`

Run:

```powershell
node --test "apps/frontend/src/app/(authenticated)/master/iqc-part-spec/iqc-part-spec-aql-policy.structure.test.mjs"
```

Expected: FAIL.

- [ ] **Step 2: Implement DTO/service persistence**

Backends must round-trip:

- `inspectionLevel`
- `aqlCritical`
- `aqlMajor`
- `aqlMinor`
- `qualityGrade`
- `inspectionMode`

- [ ] **Step 3: Implement UI fields**

Use compact operational controls:

- `ComCodeSelect` for inspection level
- `ComCodeSelect` or fixed select for inspection mode
- Numeric inputs for AQL values
- Keep `기본 시료수` visually separate from AQL auto `샘플수량`

- [ ] **Step 4: Verify**

Run:

```powershell
node --test "apps/frontend/src/app/(authenticated)/master/iqc-part-spec/iqc-part-spec-aql-policy.structure.test.mjs"
pnpm --filter @harness/backend exec tsc --noEmit --pretty false
pnpm --filter @harness/frontend exec tsc --noEmit --pretty false
```

Expected: PASS.

## Task 4: IQC Save Path Server Judgment

**Files:**
- Modify: `apps/backend/src/modules/material/receiving/receiving.module.ts`
- Modify: `apps/backend/src/modules/material/services/iqc-history.service.ts`
- Modify: `apps/backend/src/modules/material/services/iqc-history.service.spec.ts`
- Modify: `apps/frontend/src/hooks/material/useIqcData.ts`
- Modify: `apps/frontend/src/components/material/IqcModal.tsx`
- Test: `apps/frontend/src/components/material/iqc-modal-aql-policy.structure.test.mjs`

- [ ] **Step 1: Write failing backend tests**

Test cases:

- IQC arrival save calls `AqlPolicyService.resolvePolicy`
- Server ignores client PASS when Critical defect count > 0 and stores FAIL
- Server stores code letter, sample quantity, Ac/Re basis, defect counts, and judge reason
- Major/Minor Re threshold causes FAIL
- PASS stores basis and defect counts

Run:

```powershell
pnpm --filter @harness/backend test -- iqc-history.service.spec.ts --runInBand
```

Expected: FAIL.

- [ ] **Step 2: Write failing frontend structure test**

Assert:

- Modal calls `/quality/aql/resolve`
- Modal displays `sampleQty`, `codeLetter`, `acceptQty`, `rejectQty`
- Modal has `defectCritical`, `defectMajor`, `defectMinor` inputs
- `useIqcData.ts` sends defect counts, not user-entered Ac/Re

Run:

```powershell
node --test apps/frontend/src/components/material/iqc-modal-aql-policy.structure.test.mjs
```

Expected: FAIL.

- [ ] **Step 3: Implement backend judgment**

Add AQL policy service to receiving module imports/providers.

In `createArrivalResult`:

- Compute lotQty from trusted `MatLot` rows
- Resolve AQL policy by item/vendor/lotQty
- Judge by defect counts
- Override result with server judgment
- Save AQL basis and defect counts
- Preserve existing lot status update, fail move, and destructive sample handling

- [ ] **Step 4: Implement frontend display**

In modal:

- Resolve policy when opened and selected item is available
- Display read-only sampling basis
- Add defect count inputs
- Disable submit if policy cannot be resolved
- Remove any manual AQL sample quantity input from judgment path

- [ ] **Step 5: Verify**

Run:

```powershell
pnpm --filter @harness/backend test -- iqc-history.service.spec.ts aql-policy.service.spec.ts --runInBand
node --test apps/frontend/src/components/material/iqc-modal-aql-policy.structure.test.mjs
pnpm --filter @harness/backend exec tsc --noEmit --pretty false
pnpm --filter @harness/frontend exec tsc --noEmit --pretty false
```

Expected: PASS.

## Task 5: Supplier Inspection Mode Auto Transition

**Files:**
- Modify: `apps/backend/src/modules/quality/aql/services/aql-policy.service.ts`
- Modify: `apps/backend/src/modules/quality/aql/services/aql-policy.service.spec.ts`
- Modify: `apps/backend/src/modules/master/services/partner.service.ts`
- Modify: `apps/backend/src/entities/vendor-inspection-mode-history.entity.ts`

- [ ] **Step 1: Write failing transition tests**

Test cases:

- `NORMAL -> TIGHTENED` when recent 5 lots include at least 2 FAIL
- `NORMAL -> TIGHTENED` when consecutive FAIL count is 2
- `NORMAL -> REDUCED` after 10 consecutive PASS with no major/critical defect
- `TIGHTENED -> NORMAL` after 5 consecutive PASS
- `REDUCED -> NORMAL` when FAIL occurs
- Transition saves `VENDOR_INSPECTION_MODE_HISTORY`

Run:

```powershell
pnpm --filter @harness/backend test -- aql-policy.service.spec.ts --runInBand
```

Expected: FAIL.

- [ ] **Step 2: Implement transition evaluator**

Add method:

```ts
evaluateVendorInspectionMode(vendorCode, company, plant)
```

Use tenant-scoped IQC history ordered by inspect date.

- [ ] **Step 3: Call evaluator after IQC save**

After saving an IQC LOT result, evaluate the supplier mode and update `PARTNER_MASTERS.INSPECTION_MODE` if rule matches.

- [ ] **Step 4: Verify**

Run:

```powershell
pnpm --filter @harness/backend test -- aql-policy.service.spec.ts iqc-history.service.spec.ts --runInBand
pnpm --filter @harness/backend exec tsc --noEmit --pretty false
```

Expected: PASS.

## Task 6: Oracle Migration, ERD, And Runtime Verification

**Files:**
- Modify: `docs/reports/db-schema-erd.md`
- Use: `apps/backend/src/migrations/2026-06-20_iqc_aql_z14_policy.sql`

- [ ] **Step 1: Apply migration to JSHANES**

Run:

```powershell
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-06-20_iqc_aql_z14_policy.sql
```

Expected: success.

- [ ] **Step 2: Verify schema**

Run SQL:

```sql
SELECT column_name FROM user_tab_columns WHERE table_name = 'ITEM_MASTERS' AND column_name IN ('INSPECTION_LEVEL','AQL_CRITICAL','AQL_MAJOR','AQL_MINOR');
SELECT column_name FROM user_tab_columns WHERE table_name = 'PARTNER_MASTERS' AND column_name IN ('QUALITY_GRADE','INSPECTION_MODE');
SELECT table_name FROM user_tables WHERE table_name IN ('AQL_CODE_LETTER_RULES','AQL_ACCEPTANCE_RULES','VENDOR_INSPECTION_MODE_HISTORY');
SELECT column_name FROM user_tab_columns WHERE table_name = 'IQC_LOGS' AND column_name LIKE 'AQL_%';
```

Expected: all columns/tables exist.

- [ ] **Step 3: Regenerate ERD**

Run:

```powershell
python tools/generate_db_schema_doc.py
```

Expected: ERD updated.

- [ ] **Step 4: Browser/API runtime check**

Verify on `http://localhost:3002`:

- `/master/iqc-part-spec` stores item AQL fields
- supplier master stores inspection mode
- `/quality/aql/resolve?itemCode=...&vendorCode=...&lotQty=...` returns code letter/sample/Ac/Re
- `/material/iqc` displays calculated basis and stores server judgment

- [ ] **Step 5: Final checks**

Run:

```powershell
pnpm --filter @harness/backend exec tsc --noEmit --pretty false
pnpm --filter @harness/frontend exec tsc --noEmit --pretty false
git diff --check
```

Expected: PASS.

