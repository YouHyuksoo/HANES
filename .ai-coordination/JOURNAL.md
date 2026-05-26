# JOURNAL

Append new entries at the top.

## 2026-05-26 Claude (T-008)

- 2차 코드 리뷰의 15건 잠재 버그 중 13건 처리. iqc-template는 T-007 잠금 해제 후 함께 처리.
- 코드 변경:
  - `scheduler/executors/sql.executor.ts`: extractNamedBinds 가 sanitized SQL 사용하도록 변경(DELETE 가드 리터럴 우회 차단), positional 바인드는 SQL 의 `:N` 순서대로 배열 구성(`toPositionalArray`)으로 Object.values 순서 의존 제거, 위치+이름 바인드 혼용 금지, q-quote paired delimiter (`q'[…]'` 등) strip 추가.
  - `equipment/services/consumable.service.ts createLog`: findById 를 tx 안으로 이동(race 차단), SCRAP 마스터 갱신은 트랜잭션에서 읽은 row 의 tenant 로 강제 한정(undefined tenant 시 cross-tenant flip 차단), post-commit worker 조회 실패는 try/catch 로 응답 보호.
  - `material/services/physical-inv.service.ts startSession`: tx.run 으로 감싸고 ORA-00001 catch 후 BadRequestException 변환 + 새 partial unique index 마이그(`2026-05-26_physical_inv_session_uniq.sql`)로 단일 IN_PROGRESS 불변식을 DB 레벨 강제.
  - `interface/services/interface.service.ts retryLog`: retryCount 증가식을 `NVL("RETRY_COUNT", 0) + 1` 로 변경(legacy NULL+1=NULL 회귀 차단), UPDATE affected=0 시 InternalServerErrorException 으로 transDate 정밀도 mismatch 명시.
  - `master/services/iqc-template.service.ts nextTemplateId`: SEQ_IQC_TEMPLATES 가 9999 초과 시 명확한 InternalServerErrorException 으로 차단(T#### 자릿수 overflow 회귀 방지).
  - `system/services/training.service.ts getResults`: WORKER_MASTERS 조회를 tenant 1차 + 누락분 글로벌 2차로 fallback(전배/타 사업장 worker photoUrl/dept 누락 회귀 차단), 1000건 한도 회피용 chunk 처리.
  - `main.ts`: `process.env.TZ ?? 'Asia/Seoul'` 강제 — JS Date 자정 의미가 컨테이너 TZ 에 따라 변동되던 transDate 일자 미스버킷팅 차단.
- 마이그/문서:
  - `migrations/2026-05-26_create_log_sequences.sql`: IQC_TEMPLATES 블록에 USER_TABLES 가드 추가(테이블 부재 환경에서 ORA-00942 로 마이그 중단되던 회귀 차단). cutover race 운영 노트 헤더 추가.
  - `migrations/2026-05-26_physical_inv_session_uniq.sql`: 신규 — PHYSICAL_INV_SESSIONS partial unique index.
  - `migrations/README.md`: 신규 — 적용 절차/순서/cutover race 가이드.
- 회귀 테스트: sql.executor 12 + equipment consumable 5 + interface 29 + physical-inv 33 + 기타 = 168 suites / 1671 tests 전부 PASS. `pnpm exec tsc --noEmit` 0 error.

## 2026-05-26 Kimi

- T-009: User requested building a cyberpunk-themed AI Command Center dashboard to visualize .ai-coordination/ state.
- Design process: Visual Companion brainstorm with 3 style options (Cyberpunk/Fantasy/SF) → user chose Cyberpunk. Layout options (Command Center/Matrix Grid/Hologram Deck) → user chose Hologram Deck. Feature scope: all 6 panels selected.
- Files created:
  - `apps/frontend/src/app/ai-command/page.tsx` — Server Component, reads .ai-coordination/ files via fs/promises, renders 6-panel HUD layout
  - `apps/frontend/src/app/ai-command/lib/parser.ts` — Markdown parsers for TASKS.md, LOCKS.md, DECISIONS.md, JOURNAL.md
  - `apps/frontend/src/components/ai-command/AgentStatusPanel.tsx` — Live agent cards with neon borders, status pulses, current task sync
  - `apps/frontend/src/components/ai-command/QuestBoardPanel.tsx` — Color-coded task board (TODO/IN_PROGRESS/REVIEW/BLOCKED)
  - `apps/frontend/src/components/ai-command/ActivityLogPanel.tsx` — Terminal-style scrolling log from JOURNAL.md
  - `apps/frontend/src/components/ai-command/FileLockRadar.tsx` — Radar visualization + list of active file locks
  - `apps/frontend/src/components/ai-command/DecisionTreePanel.tsx` — Decision cards with status badges and connector lines
  - `apps/frontend/src/components/ai-command/SystemMetricsPanel.tsx` — Big-number HUD with sparkline bars
- Added cyberpunk CSS animations to `globals.css`: neon-pulse, scanline, hologram-flicker, radar-sweep, status-pulse, blink-cursor
- Visual style: dark background #050508, neon cyan/magenta/green/orange palette, monospace fonts, scanline overlay, grid background
- Verification: `pnpm exec tsc --noEmit` exit code 0 (no errors). Page SSR HTML confirmed to contain all 6 panel components. Route: `http://localhost:3002/ai-command`

## 2026-05-26 Codex

- T-007: User reported `http://localhost:3002/master/bom` left product/semi-product filter did not work.
- Root cause: BOM parent API returns current DB `ITEM_TYPE` values `FG` and `CM`, while BOM page filter buttons use `FINISHED` and `SEMI_PRODUCT` from `PART_TYPE` common codes; exact client-side equality left product/semi-product filters unmatched.
- Changed `apps/frontend/src/app/(authenticated)/master/bom/page.tsx` to match item type aliases (`FG`/`FINISHED`, `CM`/`SEMI_PRODUCT`/`WIP`, `RM`/`RAW_MATERIAL`/`RAW`) and reset selected parent to the visible filtered list.
- Changed `apps/frontend/src/app/(authenticated)/master/bom/components/BomTab.tsx` so `FG`, `CM`, `WIP`, `RM`, and `RAW` render with the correct type styling.
- Verification: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` passed. `localhost:3002/master/bom` responded 200. Browser automation was not available because Playwright is not installed in the node_repl environment.

## 2026-05-26 Codex

- T-006: User requested IQC item-management seed based on `ITEM_MASTERS` and full reset of receiving, stock, and issue data.
- Created `apps/backend/src/migrations/2026-05-26_seed_iqc_and_reset_inventory_flow.sql`.
- Executed via `python C:/Users/hsyou/.codex/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-05-26_seed_iqc_and_reset_inventory_flow.sql`.
- Post-check: `IQC_ITEM_POOL=15`, `IQC_PART_SPECS=16`, `IQC_PART_SPEC_ITEMS=48`, `IQC_ITEM_MASTERS=48`, `IQC_LOGS=0`; IQC orphan check returned 0.
- Reset post-check: `MAT_ARRIVALS`, `MAT_RECEIVINGS`, `MAT_LOTS`, `MAT_STOCKS`, `MAT_ISSUES`, `MAT_ISSUE_REQUESTS`, `MAT_ISSUE_REQUEST_ITEMS`, `STOCK_TRANSACTIONS`, `PRODUCT_STOCKS`, `PRODUCT_TRANSACTIONS`, and `SUBCON_RECEIVES` are all 0 rows.

## 2026-05-26 Codex

- T-005: User requested deleting current `ITEM_MASTERS` and BOM data on JSHANES, then reseeding harness-oriented item master data with about 10 models and required components.
- Plan: inspect table names, columns, constraints, and row counts first; create a repeatable SQL seed under `apps/backend/src/migrations/`; execute through oracle-db connector only after ordering deletes by dependency.
- Pre-check: `ITEM_MASTERS=21480`, `BOM_MASTERS=30`, `PROD_PLANS=0`; `PROD_PLANS` is the only FK reference found against `ITEM_MASTERS`.
- Created `apps/backend/src/migrations/2026-05-26_reset_hanes_item_bom_seed.sql`.
- Executed via `python C:/Users/hsyou/.codex/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-05-26_reset_hanes_item_bom_seed.sql`.
- Post-check: `ITEM_MASTERS=36`, `BOM_MASTERS=92`; item split is `FG=10`, `CM=10`, `RM=16`; BOM orphan check returned 0.

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
