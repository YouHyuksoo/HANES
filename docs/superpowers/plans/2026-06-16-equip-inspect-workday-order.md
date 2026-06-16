# Equip Inspect Workday Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 설비일일점검은 기존 생산월력 기준 조업일로, 작업자설비점검은 작업지시별로 완료 이력을 유지한다.

**Architecture:** 기존 `EQUIP_INSPECT_LOGS`를 점검 이력 테이블로 유지하고 `WORK_DATE`, `ORDER_NO`, `INSPECT_AT`, 조업 윈도우 스냅샷 컬럼을 추가한다. 조업일 판정은 설비의 `processCode`로 기존 `WORK_CALENDARS`/`WORK_CALENDAR_DAYS`/`SHIFT_PATTERNS`를 조회하고, 월력 부재 시 08:00 기본값으로 fallback한다.

**Tech Stack:** NestJS, TypeORM, Oracle SQL migration, Next.js React kiosk page, Node structure tests.

---

### Task 1: Backend RED Tests

**Files:**
- Modify: `apps/backend/src/modules/equipment/services/equip-inspect.service.spec.ts`
- Modify: `apps/backend/src/modules/equipment/controllers/daily-inspect.controller.spec.ts`

- [ ] Add a service test proving `resolveOperationalWindow()` maps `2026-06-16 07:59` to work date `2026-06-15` and window `2026-06-15 08:00` to `2026-06-16 08:00` when shift start is `08:00`.
- [ ] Add a service test proving `checkAlreadyInspected()` supports `WORKER + orderNo`.
- [ ] Add a controller test proving `GET /equipment/daily-inspect/check` passes `inspectType` and `orderNo`.
- [ ] Run: `pnpm --filter @harness/backend test -- equip-inspect.service.spec.ts daily-inspect.controller.spec.ts --runInBand`
- [ ] Expected: FAIL because methods/arguments/columns are missing.

### Task 2: Backend Implementation

**Files:**
- Modify: `apps/backend/src/entities/equip-inspect-log.entity.ts`
- Modify: `apps/backend/src/modules/equipment/dto/equip-inspect.dto.ts`
- Modify: `apps/backend/src/modules/equipment/services/equip-inspect.service.ts`
- Modify: `apps/backend/src/modules/equipment/controllers/daily-inspect.controller.ts`
- Modify: `apps/backend/src/modules/equipment/equipment.module.ts`
- Create: `apps/backend/src/migrations/2026-06-16_equip_inspect_workday_order.sql`

- [ ] Add nullable `ORDER_NO`, `WORK_DATE`, `INSPECT_AT`, `OP_WINDOW_START_AT`, `OP_WINDOW_END_AT` to entity/DTO.
- [ ] Inject `WorkCalendar`, `WorkCalendarDay`, and `ShiftPattern` repositories into `EquipInspectService`.
- [ ] Implement operational day resolver:
  - prefer confirmed/active calendar for equipment process and year;
  - fallback to plant common calendar;
  - fallback to `08:00`;
  - if now is before start time, work date is previous day.
- [ ] Change daily check to query `WORK_DATE` and operational window.
- [ ] Change worker check to query `ORDER_NO`.
- [ ] Save `WORK_DATE`, `INSPECT_AT`, and window snapshot on create.
- [ ] Keep old date route compatible for history/detail lookup.
- [ ] Run backend focused tests until green.

### Task 3: Frontend Kiosk Wiring

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/production/input-kiosk/page.tsx`
- Modify: `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/DailyInspectModal.tsx`
- Modify: `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/WorkerInspectModal.tsx`
- Modify: related `*.structure.test.mjs`

- [ ] Stop sending frontend-computed `inspectDate` for daily check/save.
- [ ] Pass `inspectType=DAILY` for daily checks.
- [ ] On selected job order change, call check with `inspectType=WORKER&orderNo=...`.
- [ ] Reset `workerInspectDone` false when the selected job order has no worker inspect history.
- [ ] Worker save must include `orderNo`.
- [ ] Display returned `workDate`/window if available in the already-done view.
- [ ] Run frontend structure tests and `pnpm --filter @harness/frontend exec tsc --noEmit`.

### Task 4: Oracle Migration And Schema Doc

**Files:**
- Create: `apps/backend/src/migrations/2026-06-16_equip_inspect_workday_order.sql`
- Modify: `docs/reports/db-schema-erd.md`

- [ ] Pre-check JSHANES columns with `--describe-table EQUIP_INSPECT_LOGS`.
- [ ] Apply migration via `oracle_connector.py --site JSHANES --execute-file`.
- [ ] Post-check columns and create indexes.
- [ ] Run `python tools/generate_db_schema_doc.py`.

### Task 5: Verification

- [ ] Run backend focused tests.
- [ ] Run backend typecheck/build if focused tests pass.
- [ ] Run frontend structure tests.
- [ ] Run frontend typecheck.
- [ ] Query JSHANES to confirm columns/indexes exist.
- [ ] Update `.ai-coordination/JOURNAL.md`, `.ai-coordination/HANDOFF/codex.md`, archive task, and release lock.
