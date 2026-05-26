# JOURNAL

Append new entries at the top.

## 2026-05-26 Codex

- T-005: User requested deleting current `ITEM_MASTERS` and BOM data on JSHANES, then reseeding harness-oriented item master data with about 10 models and required components.
- Plan: inspect table names, columns, constraints, and row counts first; create a repeatable SQL seed under `apps/backend/src/migrations/`; execute through oracle-db connector only after ordering deletes by dependency.

## 2026-05-26 Claude

- 사용자가 위임한 작업: backend 잠재 버그 + Oracle 시퀀스 전환 검증 + AI 협업 보드 통합.
- 잠재 버그 처리(코드 변경, Codex `c79b4c6`/`59e29a1`로 커밋됨):
  - `scheduler/executors/sql.executor.ts`: 문자열 리터럴·코멘트 strip + `:01`/`:1` Number dedup 충돌 차단, 회귀 spec 3건 추가.
  - `scheduler/services/db-backup.service.ts`: TypeORM 객체 바인드 캐스트 제거, 위치 바인드 배열 `[objType, schema, schema, objType]`로 복귀.
  - `interface/services/interface.service.ts`: 시퀀스 도입 후 무용한 `LOCK TABLE INTER_LOGS EXCLUSIVE` 제거, `retryLog` retryCount 원자적 증가(`createQueryBuilder().set({ retryCount: () => '"RETRY_COUNT" + 1' })`).
  - `equipment/services/consumable.service.ts`: `createLog`를 `tx.run`으로 감싸 SCRAP 분기 partial commit 차단.
  - `master/services/bom.service.spec.ts`: `findHierarchy` bind 헬퍼 회귀 방지(PLANT_CD 컬럼명, 바인드 순차성, effectiveDate 4회 사용) 3건 추가.
- 시퀀스 전환 검증: `interface.service` / `erp-material.service` / `consumable-label.service` / `consumables.service` / `equipment/consumable.service` / `equipment/mold.service` 6곳 `SEQ_*.NEXTVAL` 적용 확인. 마이그레이션 `2026-05-26_create_log_sequences.sql` 존재 확인.
- 사이드 spec 정리(JwtAuthGuard APP_GUARD 전환 영향): `jwt-auth.guard.spec.ts` Reflector·컨텍스트 보강, `equip-bom.service.spec.ts` 기본값에 맞춰 `objectContaining`로 완화, `menu-categories.guard.spec.ts` 및 `production-controller.guard-tenant.spec.ts`는 컨트롤러-레벨 가드 메타데이터 검증을 "별도 가드 미부착" + "@Public 부재" 검증으로 재작성, `mold.controller.spec.ts` / `product-hold.controller.spec.ts` / `product-physical-inv.controller.spec.ts`는 `.overrideGuard()` 대신 `APP_GUARD` provider로 `MockJwtAuthGuard` 주입.
- AI 협업 보드 통합:
  - `~/.claude/skills/ai-coordination/` 스킬 생성. Codex와 동일 `init_coordination.py` / `check_coordination.py` 동봉. Claude Code의 available skills 목록에 `ai-coordination` 자동 인식 확인.
  - HANES `CLAUDE.md` 최상단에 협업 보드 포인터 섹션 추가(Codex `fa6c786`에 포함됨).
- 검증: `pnpm exec tsc --noEmit` 0 error, `pnpm exec jest` 168 suites / 1663 tests PASS, `python ~/.claude/skills/ai-coordination/scripts/check_coordination.py --repo /c/Project/HANES` OK.
- 워크트리 상태: Codex가 `59e29a1` / `c79b4c6` / `fa6c786` 3개 커밋으로 분리하여 모두 반영. 이 JOURNAL 갱신만 별도 협업 보드 커밋으로 남김.

## 2026-05-26 Codex

- T-004: User requested committing the current worktree.
- Plan: run `git diff --check`, then split backend functional/test changes from coordination/tooling changes.
- Scope observed before commit: backend guard/equipment/interface/inventory/master/menu/production files, `AGENTS.md`, `CLAUDE.md`, `.ai-coordination/`, `.antigravitycli/`.
- Verification: `git diff --check` passed.
- Verification: `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` passed.
- Verification: focused backend Jest command passed, 10 suites and 156 tests.
- Commit: `c79b4c6 fix: harden tenant-aware backend operations`.

## 2026-05-26 Codex

- Added deeper multi-agent process: role split, review state, stale lock handling, conflict protocol, and context budgets.
- Added `PROTOCOL.md` as an on-demand file for complex coordination cases so normal startup context stays small.
- Updated startup prompt to tell other agents when to read `PROTOCOL.md`.

## 2026-05-26 Codex

- Added context-saving lifecycle for shared AI tasks.
- Rule: `TASKS.md` keeps only active work; completed tasks move to `ARCHIVE.md` as one-line summaries.
- Rule: detailed completion evidence stays in `JOURNAL.md`; new sessions should not read `ARCHIVE.md` unless they need a specific past task.

## 2026-05-26 Codex

- Created `.ai-coordination/` shared workflow files.
- Added AI collaboration rules to `AGENTS.md`.
- Added onboarding prompt for other AI sessions in `.ai-coordination/README.md`.
