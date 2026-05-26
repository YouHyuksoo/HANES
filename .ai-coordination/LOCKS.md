# LOCKS

Before editing, add a lock entry. Remove or mark it released when done.

## Active Locks

```md
- owner:
  task:
  status: active | released | stale
  files:
  started:
  last_seen:
  expires:
  notes:
```

- owner: claude
  task: T-011 IQC005 자재 입하관리 정렬 — Phase A
  status: released
  files:
    - apps/backend/src/migrations/2026-05-26_iqc005_*.sql (5건 적용)
    - apps/backend/src/entities/{mat-lot,purchase-order,purchase-order-item}.entity.ts
    - apps/backend/src/shared/numbering.service.ts (+ spec)
    - apps/backend/src/modules/material/services/arrival.service.ts (+ module)
    - apps/backend/src/modules/material/controllers/arrival.controller.ts
    - apps/backend/src/modules/material/dto/arrival.dto.ts
    - apps/frontend/src/app/(authenticated)/material/arrival/**
    - apps/frontend/src/components/shared/MfgPartnerSelect.tsx
    - apps/frontend/src/locales/{ko,en,zh,vi}.json
  started: 2026-05-26T15:50:00+09:00
  last_seen: 2026-05-26T17:30:00+09:00
  released: 2026-05-26T17:30:00+09:00
  notes: |
    Phase A 구현 완료. 빌드 0 error, 백엔드 spec 59/59 PASS.
    PURCHASE_ORDER_ITEMS 행 0건 → 사용자 PO 등록 후 UI 시나리오 검증 필요.
    Phase B(IQC006) / C(라벨 백엔드) / D(분할/병합)은 별도 task.

## History

- owner: claude
  task: T-010 Apply T-008 SQL migrations to JSHANES
  status: released
  role: operator
  files:
    - Oracle JSHANES — UK_PHYSICAL_INV_SESSIONS_IN_PROGRESS (created, UNIQUE/VALID)
    - apps/backend/src/migrations/2026-05-26_physical_inv_session_uniq.sql (rewritten — column PLANT→PLANT_CD, BEGIN/EXCEPTION pattern with idempotent ORA-00955/-942 catch, header comment relocated into BEGIN to bypass oracle_connector regex limitation)
  started: 2026-05-26T13:50:00+09:00
  last_seen: 2026-05-26T14:05:00+09:00
  expires: 2026-05-26T14:50:00+09:00
  notes: |
    Applied UK_PHYSICAL_INV_SESSIONS_IN_PROGRESS partial unique index on JSHANES.
    Pre-check: all 10 log sequences already exist (Codex T-005/T-006). create_log_sequences.sql rerun unnecessary on this environment.
    Migration sql had to be rewritten — original column name was PLANT but actual schema uses PLANT_CD; RETURN inside anonymous PL/SQL is invalid; and oracle_connector's execute_file regex doesn't recognize PL/SQL blocks whose file starts with a comment block (silently strips trailing ; on the PL/SQL end, causing PLS-00103). Final form puts the comment inside BEGIN.
    Post-check: USER_INDEXES.STATUS = VALID, UNIQUENESS = UNIQUE, expression = `CASE "STATUS" WHEN 'IN_PROGRESS' THEN NVL("COMPANY",'')||'||'||NVL("PLANT_CD",'') END`. Idempotent rerun verified.

- owner: claude
  task: T-008 Fix 13 potential bugs from second-pass code review
  status: released
  files:
    - apps/backend/src/main.ts
    - apps/backend/src/migrations/2026-05-26_create_log_sequences.sql
    - apps/backend/src/migrations/2026-05-26_physical_inv_session_uniq.sql (new)
    - apps/backend/src/migrations/README.md (new)
    - apps/backend/src/modules/equipment/services/consumable.service{.ts,.spec.ts}
    - apps/backend/src/modules/interface/services/interface.service{.ts,.spec.ts}
    - apps/backend/src/modules/master/services/iqc-template.service.ts
    - apps/backend/src/modules/material/services/physical-inv.service{.ts,.spec.ts}
    - apps/backend/src/modules/scheduler/executors/sql.executor{.ts,.spec.ts}
    - apps/backend/src/modules/system/services/training.service.ts
  started: 2026-05-26T13:20:00+09:00
  last_seen: 2026-05-26T13:40:00+09:00
  expires: 2026-05-26T15:20:00+09:00
  notes: 13 of 15 findings handled in code + iqc-template (#11) added after T-007 released. tsc 0 error, 168 suites/1671 tests PASS. Migration cutover race (#6) and missing-migration ops risk (#8) addressed via README + sql header notes; not fixable in code alone.

- owner: codex
  task: T-007 Fix BOM item type filter
  status: released
  files:
    - apps/frontend/src/app/(authenticated)/master/bom/page.tsx
    - apps/frontend/src/app/(authenticated)/master/bom/components/BomTab.tsx
    - .ai-coordination/*
  started: 2026-05-26T13:10:00+09:00
  last_seen: 2026-05-26T13:20:00+09:00
  expires: 2026-05-26T15:10:00+09:00
  notes: Fixed BOM left item type filter by matching FINISHED/SEMI_PRODUCT filters against FG/CM DB aliases; frontend tsc passed.

- owner: codex
  task: T-006 Seed IQC specs and reset inventory flow data
  status: released
  files:
    - apps/backend/src/migrations/2026-05-26_seed_iqc_and_reset_inventory_flow.sql
    - .ai-coordination/*
    - Oracle JSHANES IQC/inventory flow tables
  started: 2026-05-26T12:55:31+09:00
  last_seen: 2026-05-26T13:05:00+09:00
  expires: 2026-05-26T14:55:31+09:00
  notes: Seeded IQC specs from ITEM_MASTERS and reset receiving/stock/issue flow data; post-check IQC_PART_SPECS=16, IQC_PART_SPEC_ITEMS=48, flow tables=0.

- owner: codex
  task: T-005 Reset item and BOM seed data
  status: released
  files:
    - apps/backend/src/migrations/2026-05-26_reset_hanes_item_bom_seed.sql
    - .ai-coordination/*
    - Oracle JSHANES item/BOM master tables
  started: 2026-05-26T12:33:36+09:00
  last_seen: 2026-05-26T12:45:00+09:00
  expires: 2026-05-26T14:33:36+09:00
  notes: Deleted/reseeded ITEM_MASTERS and BOM_MASTERS on JSHANES; post-check ITEM_MASTERS=36, BOM_MASTERS=92, orphan BOM=0.

- owner: codex
  task: T-004 Commit current worktree
  status: released
  files:
    - repository commit/staging state
    - .ai-coordination/*
  started: 2026-05-26T12:28:50+09:00
  last_seen: 2026-05-26T12:28:50+09:00
  expires: 2026-05-26T13:28:50+09:00
  notes: User requested commit; split functional changes from coordination/tooling changes per CLAUDE.md.

- owner: codex
  task: T-001 AI coordination rules
  status: released
  files:
    - AGENTS.md
    - .ai-coordination/*
  started: 2026-05-26
  notes: Created shared coordination rules.
