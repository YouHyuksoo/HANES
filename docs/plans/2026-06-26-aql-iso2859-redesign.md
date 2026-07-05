# AQL ISO 2859 Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild HANES IQC AQL management around the ISO 2859 flow: lot quantity plus inspection level resolves a code letter, code letter resolves standard sample size, and code letter plus AQL value resolves Ac/Re.

**Architecture:** Keep `AQL_STANDARDS` as the AQL value master and `IQC_AQL_POLICIES` as the Major/Minor policy master. Replace direct `AQL_SAMPLING_RULES` service usage with `AQL_CODE_LETTER_RULES`, `AQL_CODE_LETTER_SAMPLES`, and `AQL_ACCEPTANCE_RULES`; resolve responses expose `standardSampleSize`, `actualInspectQty`, `codeLetter`, `acceptQty`, and `rejectQty`.

**Tech Stack:** NestJS, TypeORM, Oracle raw SQL migrations, Next.js React, node structure tests, Jest.

---

### Task 1: Backend ISO Tables And Resolve Contract

**Files:**
- Create: `apps/backend/src/entities/aql-code-letter-rule.entity.ts`
- Create: `apps/backend/src/entities/aql-code-letter-sample.entity.ts`
- Create: `apps/backend/src/entities/aql-acceptance-rule.entity.ts`
- Modify: `apps/backend/src/modules/quality/aql/services/aql.service.ts`
- Test: `apps/backend/src/modules/quality/aql/services/aql.service.spec.ts`

- [ ] Write failing tests for `LOT 350 + II + AQL 1.0 -> H / standard 50 / actual 50 / Ac1/Re2`.
- [ ] Write failing tests for `LOT 8 + S-1 + AQL 0.015 -> standard 80 / actual 8`.
- [ ] Implement new repositories and ISO resolve helper.
- [ ] Remove `sampleSize <= lotQtyTo` validation and cap-only semantics.

### Task 2: Migration And Seed Data

**Files:**
- Create: `apps/backend/src/migrations/2026-06-26_iqc_aql_iso2859_redesign.sql`
- Modify: `docs/reports/db-schema-erd.md`

- [ ] Create new ISO tables with tenant composite PKs.
- [ ] Seed current operating standards for `I/0.01`, `II/1.0`, `II/2.5`, `II/4.0`, `S-1/0.015`.
- [ ] Disable or drop old direct sampling table dependency.
- [ ] Run JSHANES pre/post checks and regenerate ERD.

### Task 3: Frontend AQL Page

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/quality/aql/page.tsx`
- Modify: `apps/frontend/src/app/(authenticated)/quality/aql/components/AqlFieldHelp.tsx`
- Test: `apps/frontend/src/app/(authenticated)/quality/aql/iqc-aql.structure.test.mjs`

- [ ] Replace LOT별 Ac/Re editing with ISO table views/inputs for code-letter sampling and acceptance rules.
- [ ] Show policy preview from the new resolve path.
- [ ] Show 표준 샘플수량 and 실제 검사수량 separately.

### Task 4: Verification

- [ ] Run backend AQL Jest tests.
- [ ] Run frontend structure tests.
- [ ] Run backend and frontend `tsc --noEmit`.
- [ ] Apply migration to JSHANES and verify expected rows.
- [ ] Run `git diff --check`.
