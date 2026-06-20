# TASKS

This file is active-work-only. Keep only `TODO`, `IN_PROGRESS`, and `BLOCKED` tasks here.

When a task reaches `DONE`:

1. Append detailed outcome and verification to `JOURNAL.md`.
2. Add one compact line to `ARCHIVE.md`.
3. Remove the task body from this file.

## Task Format

```md
## T-000 Short title
status: TODO | IN_PROGRESS | REVIEW | BLOCKED
owner: agent-name
role: implementer | reviewer | operator
scope:
- path/or/module
files:
- path/to/file
verification:
- command or manual check
review:
- reviewer or needs-review
notes:
- important context
```

## Active Tasks

## T-MENU-OPEN-DELAY 메뉴 클릭 후 화면 열림 지연 원인 진단
status: REVIEW
owner: codex
role: implementer
scope:
- 메뉴 클릭 후 30초 이상 지연되는 경로의 실제 병목 확인
files:
- apps/frontend/src/components/layout/**
- apps/frontend/src/config/menuConfig.ts
- apps/frontend/scripts/gen-page-registry.mjs
- apps/frontend/src/components/layout/pageRegistry.generated.ts
- apps/backend/src/modules/menu-categories/**
- apps/frontend/src/components/layout/tab-keep-alive-unique-paths.structure.test.mjs
- apps/frontend/src/components/layout/tabPageState.ts
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
verification:
- 원인 확인: `.next/trace`에서 `/system/menu-categories` RSC 요청 89~109초, `/inspection/terminal-result` compile 68초, authenticated page loader 다수 동시 준비 확인.
- PASS: `node --test apps/frontend/src/components/layout/tab-keep-alive-unique-paths.structure.test.mjs apps/frontend/src/components/layout/sidebar-menu-navigation.structure.test.mjs`
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: 수정 후 3002 HTTP 반복 측정 `/dashboard` 514ms, `/master/part` 281ms, `/production/wip-stock` 212ms, `/system/menu-categories` 258ms.
- PASS: Playwright headless mock에서 `/master/part` 본문 검색 입력 `CODX_STATE_KEEP` 입력 후 `/dashboard` 이동, `/master/part` 재진입 시 값 복원 확인.
- PASS: Playwright headless mock에서 `/master/part` 우측 등록 패널 입력 `CODX_PANEL_KEEP` 입력 후 대시보드 탭 이동, 품목 탭 재진입 시 패널/입력값 보존 확인.
- PASS: 최종 3002 HTTP 측정 `/dashboard` 1030ms, `/master/part` 860ms, `/production/wip-stock` 331ms, `/system/menu-categories` 462ms.
- FAIL 확인: App Router `children` 캐시 방식은 실제 브라우저에서 `/master/part` 품목 추가 패널 입력 `CODX_REAL_KEEP` 후 대시보드 이동/품목 탭 복귀 시 패널이 초기화되어 값이 사라졌다.
- PASS: `getPageComponent(path)` lazy registry + 실제 page component keep-alive 적용 후 동일 3002 Playwright 로그인 세션에서 `/master/part` 품목 추가 패널 입력 `CODX_REAL_KEEP` 보존 확인.
- PASS: lazy registry 적용 후 최종 3002 HTTP 반복 측정 `/dashboard` 521ms, `/master/part` 330ms, `/production/wip-stock` 523ms, `/system/menu-categories` 266ms.
review:
- needs-review
notes:
- 원인: `TabKeepAlive`가 `pageRegistry.generated.ts`를 import해 Next dev 서버가 메뉴 클릭 시 authenticated page 전체를 on-demand compile 대상으로 잡았다.
- 변경: top-level `pageRegistry` 객체는 제거하고 `getPageComponent(path)`가 호출된 경로만 `dynamic()` 생성하도록 `pageRegistry.generated.ts`를 lazy factory로 재생성했다.
- 보정: `TabKeepAlive`는 방문한 실제 page component만 경로별 최대 `MAX_TABS`개 hidden mount로 유지해 열린 탭의 React state를 보존한다. DOM 입력값/선택값/스크롤 `sessionStorage` 저장은 추가 복원 보조로 유지한다.

## T-ROUTING-LABEL-ISSUE-UI 라우팅 공정 SG/FG 라벨 발행 설정 UI 추가
status: REVIEW
owner: codex
role: implementer
scope:
- `/master/routing` 공정순서에서 `ISSUE_SG_LABEL_YN`, `ISSUE_FG_LABEL_YN` 설정/표시
files:
- apps/backend/src/modules/master/dto/routing-group.dto.ts
- apps/backend/src/modules/master/services/routing-group.service.ts
- apps/backend/src/modules/master/services/routing-group.service.spec.ts
- apps/frontend/src/app/(authenticated)/master/routing/types.ts
- apps/frontend/src/app/(authenticated)/master/routing/components/RoutingGroupManager.tsx
- apps/frontend/src/app/(authenticated)/master/routing/routing-label-issue-flags.structure.test.mjs
- apps/frontend/src/locales/ko.json
- apps/frontend/src/locales/en.json
- apps/frontend/src/locales/zh.json
- apps/frontend/src/locales/vi.json
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/master/routing/routing-label-issue-flags.structure.test.mjs"`가 플래그 type/UI/DTO/service/locale 부재로 6건 실패 확인.
- GREEN: 동일 구조 테스트 6/6 PASS.
- PASS: `pnpm --filter @harness/backend test -- routing-group.service.spec.ts -t "label issue flags" --runInBand` 2/2 PASS.
- PASS: `pnpm --filter @harness/backend test -- routing-group.service.spec.ts --runInBand` 28/28 PASS.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: `pnpm --filter @harness/backend exec tsc --noEmit --pretty false`.
- PASS: 3012 브라우저 실측에서 `/master/routing` 공정 수정 모달 `라벨발행`, `SG 라벨 발행`, `FG 라벨 발행` 체크박스 표시 확인. 그리드 `라벨발행` 컬럼과 기존 `FG` 배지 표시 확인.
- PASS: 3012 API roundtrip으로 임시 라우팅 그룹/공정 생성 후 `issueSgLabelYn='Y'`, `issueFgLabelYn='N'` 저장, update 후 `issueSgLabelYn='N'`, `issueFgLabelYn='Y'` 조회 확인. 검증 데이터 삭제 후 JSHANES `ROUTING_CODE LIKE 'CODX_LABEL_%'` 잔여 0 확인.
- PASS: 대상 파일 `git diff --check`.
review:
- needs-review
notes:
- 현재 `ROUTING_PROCESSES` 엔티티에는 컬럼이 있으나 `/master/routing` UI와 DTO/서비스 저장 경로에 빠져 운영자가 설정할 수 없다.
- 3002 프론트는 HTTP 요청이 30초 타임아웃되어 3012 dev 서버에서 런타임 검증했다.

## T-WIP-FG-LABEL-SOURCE-SPLIT 재공 상세 라벨 SG/FG 분리 조회
status: REVIEW
owner: codex
role: implementer
scope:
- `/production/wip-stock`, `/production/fg-stock` 상세 라벨정보를 품목 유형별로 `SG_LABELS`/`FG_LABELS` 분리 조회
files:
- apps/backend/src/modules/production/services/production-views.service.ts
- apps/backend/src/modules/production/controllers/production-views.controller.ts
- apps/frontend/src/app/(authenticated)/production/wip-stock/WipStockView.tsx
- apps/frontend/src/app/(authenticated)/production/wip-stock/wip-stock-label-detail.structure.test.mjs
- apps/frontend/src/app/(authenticated)/production/wip-stock/wip-stock-actual-sql.structure.test.mjs
- apps/frontend/src/app/(authenticated)/production/fg-stock/fg-stock-type-filter.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/production/wip-stock/wip-stock-label-detail.structure.test.mjs"`가 기존 `/fg-labels` 단일 조회와 `FG_LABELS` 전용 서비스로 실패 확인.
- GREEN: wip label detail, fg type filter, wip split, wip SQL, menu locale 구조 테스트 9건 PASS.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: `pnpm --filter @harness/backend exec tsc --noEmit --pretty false`.
- PASS: 3002 브라우저 fetch 실측. `SEMI_PRODUCT/HNS02C2ABCDE`는 `/api/production/wip-stock/labels?...itemType=SEMI_PRODUCT`에서 `SG_LABELS` SQL과 `labelType=SG` 1건 반환. `FINISHED` 요청은 `FG_LABELS` SQL 사용 확인.
- PASS: 3002 `/production/wip-stock` 우측 패널에 `라벨바코드`, `잔량` 컬럼 표시 및 console/page error 0 확인.
review:
- needs-review
notes:
- `SEMI_PRODUCT` 상세는 `SG_LABELS`, `FINISHED` 상세는 `FG_LABELS`가 source of truth다.

## T-WIP-STOCK-LABEL-DETAIL-PANEL 반제품재공조회 라벨 상세 패널 표시
status: REVIEW
owner: codex
role: implementer
scope:
- `/production/wip-stock`에서 좌측 품목 선택 시 우측 상세 라벨정보 패널 표시
files:
- apps/frontend/src/app/(authenticated)/production/wip-stock/WipStockView.tsx
- apps/frontend/src/app/(authenticated)/production/wip-stock/wip-stock-label-detail.structure.test.mjs
- apps/frontend/src/locales/ko.json
- apps/frontend/src/locales/en.json
- apps/frontend/src/locales/zh.json
- apps/frontend/src/locales/vi.json
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/production/wip-stock/wip-stock-label-detail.structure.test.mjs"`가 `showFgPanel` 조건과 일반 라벨 패널 문구 부재로 실패 확인.
- GREEN: wip label detail, fg type filter, wip split, wip SQL, menu locale 구조 테스트 8건 PASS.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: 3002 `/production/wip-stock` HTTP 200.
- PASS: Playwright에서 반제품재공조회 우측 `상세 라벨정보` 패널 표시, 반제품 행 `HNS02C2ABCDE` 클릭 시 `/api/production/wip-stock/fg-labels?itemCode=HNS02C2ABCDE` 호출, console/page error 0 확인.
- PASS: 대상 파일 `git diff --check`.
review:
- needs-review
notes:
- 백엔드 `/production/wip-stock/fg-labels`는 `itemCode` 기준 `FG_LABELS`를 조회하므로 반제품 품목도 라벨이 있으면 반환 가능하다.
- 현재 JSHANES `HNS02C2ABCDE` 반제품 재고는 1건이고, 연결 라벨 상세는 0건이라 패널은 `데이터가 없습니다.`로 표시된다.

## T-FG-STOCK-CARD-REMOVE-TYPE-FILTER 제품재공조회 정보카드 제거 및 유형 필터 추가
status: REVIEW
owner: codex
role: implementer
scope:
- `/production/fg-stock` 상단 정보카드 제거
- 좌측 품목 그리드 툴바에 유형 필터 추가
files:
- apps/frontend/src/app/(authenticated)/production/wip-stock/WipStockView.tsx
- apps/frontend/src/app/(authenticated)/production/fg-stock/page.tsx
- apps/frontend/src/app/(authenticated)/production/fg-stock/fg-stock-type-filter.structure.test.mjs
- apps/frontend/src/app/(authenticated)/production/wip-stock/wip-stock-menu-split.structure.test.mjs
- apps/frontend/src/app/(authenticated)/production/wip-stock/wip-stock-actual-sql.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/production/fg-stock/fg-stock-type-filter.structure.test.mjs"`가 `enableTypeFilter` 부재와 `StatCard` 잔존으로 실패 확인.
- GREEN: `node --test "apps/frontend/src/app/(authenticated)/production/fg-stock/fg-stock-type-filter.structure.test.mjs" "apps/frontend/src/app/(authenticated)/production/wip-stock/wip-stock-menu-split.structure.test.mjs" "apps/frontend/src/app/(authenticated)/production/wip-stock/wip-stock-actual-sql.structure.test.mjs"` PASS.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: 3002 `/production/fg-stock` HTTP 200.
- PASS: Playwright DOM에서 `품목 수`/`총 재고` 정보카드 0건, 유형 옵션 `전체/완제품/반제품`, API 요청 `itemType=FINISHED` 후 `SEMI_PRODUCT`, console/page error 0 확인.
- PASS: 대상 파일 `git diff --check`.
review:
- needs-review
notes:
- 기본 조회 유형은 `FINISHED`로 유지하고, `fg-stock` 화면에서만 유형 Select를 노출한다.

## T-WIP-MAT-LABEL-RAW-PROCESS 원자재 공정재고/수불 메뉴명 변경
status: REVIEW
owner: codex
role: implementer
scope:
- `/production/wip-material-stock`, `/production/wip-material-trans` 한국어 메뉴명과 화면 제목 변경
files:
- apps/frontend/src/locales/ko.json
- apps/frontend/src/app/(authenticated)/production/wip-material-stock/wip-material-menu-label.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/production/wip-material-stock/wip-material-menu-label.structure.test.mjs"`가 기존 `공정재고` 값으로 실패 확인.
- GREEN: `node --test "apps/frontend/src/app/(authenticated)/production/wip-material-stock/wip-material-menu-label.structure.test.mjs" apps/frontend/src/config/menu-locale-coverage.structure.test.mjs` PASS.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: 3002 HTTP `/production/wip-material-stock`, `/production/wip-material-trans` 200.
- PASS: Playwright DOM에서 제목 `원자재공정재고`, `원자재공정수불`, console/page error 0 확인.
- PASS: 대상 파일 `git diff --check`.
review:
- needs-review
notes:
- 메뉴 키/라우트/DB 메뉴 코드는 유지하고 한국어 표시 문구만 변경한다.

## T-PROD-WIP-FG-STOCK-MENU-SPLIT 반제품/제품 재공조회 메뉴 분리
status: REVIEW
owner: codex
role: implementer
scope:
- `/production/wip-stock` 합산 화면을 반제품재공조회와 제품재공조회로 메뉴/라우트 분리
files:
- apps/frontend/src/app/(authenticated)/production/wip-stock/**
- apps/frontend/src/app/(authenticated)/production/fg-stock/**
- apps/frontend/src/config/menuConfig.ts
- apps/frontend/src/components/layout/pageRegistry.generated.ts
- apps/frontend/src/locales/{ko,en,zh,vi}.json
- apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts
- apps/backend/src/migrations/2026-06-20_split_wip_fg_stock_menus.sql
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/production/wip-stock/wip-stock-menu-split.structure.test.mjs"`가 신규 공유 컴포넌트/제품 라우트/메뉴 부재로 실패 확인.
- GREEN: wip-stock split/SQL, menu locale, menu-code-validator 구조 테스트 5건 PASS.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: JSHANES 메뉴 마이그레이션 적용 및 재실행 성공, `PROD_WIP_STOCK` 70 / `PROD_FG_STOCK` 71 확인, `PROD_FG_STOCK` MANAGER/OPERATOR 권한 확인.
- PASS: 3002 브라우저에서 `/production/wip-stock` 제목 `반제품재공조회`, `/production/fg-stock` 제목 `제품재공조회`, API 요청 `itemType=SEMI_PRODUCT`/`FINISHED`, console/page error 0 확인.
- PASS: 대상 파일 `git diff --check`.
review:
- needs-review
notes:
- 기존 `/production/wip-stock`는 `SEMI_PRODUCT`, 신규 `/production/fg-stock`는 `FINISHED` 고정 조회로 둔다.

## T-IQC-PART-SPEC-AQL-SUMMARY 품목별 IQC 항목관리 AQL 요약 표시
status: REVIEW
owner: codex
role: implementer
scope:
- `/master/iqc-part-spec`에서 선택 품목의 IQC AQL 기준을 검사 항목과 함께 표시
files:
- apps/frontend/src/app/(authenticated)/master/iqc-part-spec/page.tsx
- apps/frontend/src/app/(authenticated)/master/iqc-part-spec/iqc-part-spec-aql-summary.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/master/iqc-part-spec/iqc-part-spec-aql-summary.structure.test.mjs"`가 AQL 요약 필드 부재로 실패 확인.
- GREEN: `node --test "apps/frontend/src/app/(authenticated)/master/iqc-part-spec/iqc-part-spec-aql-summary.structure.test.mjs" "apps/frontend/src/app/(authenticated)/master/iqc-part-spec/iqc-part-spec-layout.structure.test.mjs"` PASS.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: `Invoke-WebRequest -UseBasicParsing http://localhost:3002/master/iqc-part-spec -TimeoutSec 30` 200.
- PASS: 대상 파일 `git diff --check`.
review:
- needs-review
notes:
- 품목 선택 후 검사수준, 기본시료수, Critical/Major/Minor AQL, 샘플수량/Ac/Re 기준을 한 화면에서 확인 가능하게 한다.
- 사용자가 `/master/iqc-part-spec`에 AQL 관련 내용도 같이 표시되어야 하는 것 아니냐고 지적했다.
- Ac/Re는 LOT 수량이 필요하므로 화면에서 `LOT 수량 미리보기` 입력값 기준으로 `/quality/aql/resolve-iqc`를 호출해 표시한다.

## T-IQC-PART-SPEC-LEFT-PANEL 품목별 IQC 항목관리 좌측 패널 축소
status: REVIEW
owner: codex
role: implementer
scope:
- `/master/iqc-part-spec` 좌측 품목 목록 패널 폭을 줄이고 우측 규격 관리 영역을 넓힘
files:
- apps/frontend/src/app/(authenticated)/master/iqc-part-spec/page.tsx
- apps/frontend/src/app/(authenticated)/master/iqc-part-spec/iqc-part-spec-layout.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/master/iqc-part-spec/iqc-part-spec-layout.structure.test.mjs"`가 기존 `col-span-4/8` 레이아웃으로 실패 확인.
- GREEN: `node --test "apps/frontend/src/app/(authenticated)/master/iqc-part-spec/iqc-part-spec-layout.structure.test.mjs"` PASS.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: `Invoke-WebRequest -UseBasicParsing http://localhost:3002/master/iqc-part-spec -TimeoutSec 30` 200.
- PASS: 대상 파일 `git diff --check`.
review:
- needs-review
notes:
- 기존 `col-span-4/8` 레이아웃을 좌측 3, 우측 9 비율로 조정한다.

## T-IQC-DEFECT-CODE-SEVERITY-AQL IQC 불량코드 등급별 AQL 판정
status: REVIEW
owner: codex
role: implementer
scope:
- IQC 판정 시 불량코드가 가진 `CRITICAL`/`MAJOR`/`MINOR` 등급으로 불량수량을 집계
- Critical은 1건 이상 즉시 FAIL, Major/Minor는 각각 독립 Ac/Re 판정
- `/material/iqc` 모달에서 등급별 수량 직접입력 대신 불량코드+수량 입력으로 전환
files:
- apps/backend/src/modules/quality/aql/services/aql.service.ts
- apps/backend/src/modules/quality/aql/services/aql.service.spec.ts
- apps/backend/src/entities/com-code.entity.ts
- apps/backend/src/modules/master/dto/com-code.dto.ts
- apps/backend/src/modules/master/services/com-code.service.ts
- apps/backend/src/modules/material/dto/iqc-history.dto.ts
- apps/backend/src/modules/material/services/iqc-history.service.ts
- apps/backend/src/migrations/2026-06-20_iqc_defect_code_grade.sql
- apps/frontend/src/components/material/IqcModal.tsx
- apps/frontend/src/hooks/material/useIqcData.ts
- apps/frontend/src/hooks/useComCode.ts
- apps/frontend/src/components/material/iqc-modal-serial-flow.structure.test.mjs
- docs/reports/db-schema-erd.md
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: backend AQL focused test에서 불량코드 입력이 등급별 수량으로 집계되지 않고 Critical 즉시 FAIL도 동작하지 않는 것 확인.
- RED: IQC modal structure test에서 불량코드 행 상태/공통코드 조회/payload 계약 부재 확인.
- GREEN: `pnpm --filter @harness/backend test -- aql.service.spec.ts iqc-history.service.spec.ts --runInBand` PASS, 26/26.
- GREEN: `node --test apps/frontend/src/components/material/iqc-modal-serial-flow.structure.test.mjs` PASS, 3/3.
- `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` PASS.
- `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS.
- JSHANES 마이그레이션 적용 PASS: `COM_CODES.DEFECT_GRADE` 추가, `DEFECT_TYPE` 12건 등급 백필, 체크 제약 2건 확인.
- `ORACLE_SITE=JSHANES python tools/generate_db_schema_doc.py` PASS, 162 tables/2698 columns.
- 관련 파일 `git diff --check` PASS.
review:
- needs-review
notes:
- 불량코드 등급은 `COM_CODES.GROUP_CODE='DEFECT_TYPE'`, `DEFECT_GRADE IN ('CRITICAL','MAJOR','MINOR')` 기준으로 사용한다.
- 등급이 없거나 허용값이 아니면 IQC 판정을 중단한다.

## T-MASTER-PART-IQC-CODE-SELECT 품목마스터 검사 기준 선택식 전환
status: REVIEW
owner: codex
role: implementer
scope:
- `/master/part` 품목 등록/수정 화면의 코드성 검사 항목을 공통코드/기준정보 선택 방식으로 전환
- 기본시료수는 수량 기준값이므로 소수점 직접 입력을 허용
- 입력방식보다 공통코드 또는 기준정보 선택을 우선하는 개발 표준 명시 및 기억 메모 반영
files:
- apps/frontend/src/app/(authenticated)/master/part/components/PartFormPanel.tsx
- apps/frontend/src/app/(authenticated)/master/part/components/PartFormModal.tsx
- apps/frontend/src/app/(authenticated)/master/part/part-label-terms.structure.test.mjs
- apps/backend/src/modules/master/dto/part.dto.ts
- docs/standards/implementation-rules.md
- AGENTS.md
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- PASS: `node --test "apps/frontend/src/app/(authenticated)/master/part/part-label-terms.structure.test.mjs"`
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: `pnpm --filter @harness/backend exec tsc --noEmit --pretty false`
review:
- needs-review
notes:
- 검사수준과 AQL 값은 기존 공통코드 `AQL_INSP_LEVEL`, `AQL_VALUE`를 사용한다.
- 기본시료수는 코드성 값이 아니라 검사 수량 기준값이므로 소수점 직접 입력을 허용한다.
- 개발 표준 문서와 사용자 기억 메모에 "코드성/기준정보성 값은 자유입력보다 공통코드 또는 기준정보 선택 우선" 원칙을 기록했다.

## T-BOX-STOCK-PACKED-VS-RECEIVED 박스포장 재고와 창고재고 구분
status: REVIEW
owner: codex
role: implementer
scope:
- 박스포장 시 `FG_LABELS.BOX_NO`는 유지
- 제품입고 전 포장대기 재고와 제품입고 후 창고재고를 `/shipping/box-stock`에서 구분 표시
files:
- apps/backend/src/modules/shipping/services/box.service.ts
- apps/backend/src/modules/shipping/services/box.service.spec.ts
- apps/backend/src/modules/inventory/services/product-inventory.service.ts
- apps/backend/src/modules/inventory/services/product-inventory.service.spec.ts
- apps/backend/src/modules/shipping/controllers/box-stock.controller.ts
- apps/frontend/src/app/(authenticated)/shipping/box-stock/page.tsx
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `pnpm --filter @harness/backend test -- box.service.spec.ts -t "findStockByBox separates" --runInBand`가 `PRODUCT_TRANSACTIONS` 조인 부재로 실패 확인.
- GREEN: `pnpm --filter @harness/backend test -- box.service.spec.ts -t "findStockByBox separates" --runInBand` PASS.
- RED/GREEN: `pnpm --filter @harness/backend test -- product-inventory.service.spec.ts -t "keeps FG label boxNo" --runInBand`.
- PASS: `pnpm --filter @harness/backend test -- product-inventory.service.spec.ts box.service.spec.ts --runInBand` 36/36.
- RED/GREEN: `node --test "apps/frontend/src/app/(authenticated)/shipping/box-stock/box-stock-inventory-state.structure.test.mjs"`.
- PASS: `node --test "apps/frontend/src/app/(authenticated)/shipping/box-stock/box-stock-no-info-cards.structure.test.mjs"`.
- PASS: ko/en/zh/vi locale JSON parse.
- PASS: `pnpm --filter @harness/backend exec tsc --noEmit --pretty false`.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: JSHANES SQL로 `FG_LABELS` + `PRODUCT_TRANSACTIONS(refType=BOX, WIP_OUT/FG_IN)` 조회 정상 실행. 현재 미출하 박스 라벨은 0건.
- 참고: `http://localhost:3003/api/v1/shipping/box-stock` 직접 호출은 인증 누락으로 401.
- PASS: `git diff --check` 대상 파일 통과.
review:
- needs-review
notes:
- `BOX_NO IS NOT NULL`은 포장 식별 조건이지 창고입고 조건이 아니다.
- 창고입고 여부는 `PRODUCT_TRANSACTIONS`의 박스 `WIP_OUT`/`FG_IN` 입고 이동 이력으로 판정한다.
- 입고취소는 `FG_LABELS.BOX_NO`를 지우지 않고 수불 전표 취소와 재고 역분개만 수행한다.

## T-IQC-AQL-Z14-POLICY 품목별 AQL/업체 검사강도 정석 설계
status: REVIEW
owner: codex
role: implementer
scope:
- 품목별 Critical/Major/Minor AQL과 업체별 검사강도 기반 IQC AQL 정책 설계
- ISO 2859-1 / ANSI ASQ Z1.4 자동 샘플수량/Ac/Re 산출 계획
- 품목/업체 마스터 필드, AQL 자동산출, IQC 서버 판정 구현
files:
- docs/superpowers/specs/2026-06-20-iqc-aql-z14-policy-design.md
- docs/superpowers/specs/2026-06-19-iqc-aql-design.md
- docs/superpowers/plans/2026-06-20-iqc-aql-z14-policy-implementation.md
- apps/backend/src/entities/part-master.entity.ts
- apps/backend/src/entities/partner-master.entity.ts
- apps/backend/src/entities/iqc-log.entity.ts
- apps/backend/src/entities/aql-*.entity.ts
- apps/backend/src/modules/quality/aql/**
- apps/backend/src/modules/material/**
- apps/backend/src/modules/master/**
- apps/backend/src/migrations/2026-06-20_iqc_aql_z14_policy.sql
- apps/frontend/src/app/(authenticated)/master/part/**
- apps/frontend/src/components/material/IqcModal.tsx
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- PASS: `docs/superpowers/specs/2026-06-20-iqc-aql-z14-policy-design.md` 작성.
- PASS: 기존 `docs/superpowers/specs/2026-06-19-iqc-aql-design.md` superseded 표시.
- PASS: `docs/superpowers/plans/2026-06-20-iqc-aql-z14-policy-implementation.md` 작성.
- PASS: 대상 문서/협업 파일 `git diff --check` 통과.
- PASS: `pnpm --filter @harness/backend test -- aql.service.spec.ts iqc-history.service.spec.ts --runInBand`.
- PASS: `pnpm --filter @harness/backend exec tsc --noEmit --pretty false`.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: `node --test apps/frontend/src/components/material/iqc-modal-serial-flow.structure.test.mjs apps/frontend/src/components/material/iqc-modal-compact-scan-layout.structure.test.mjs "apps/frontend/src/app/(authenticated)/master/part/part-label-terms.structure.test.mjs"`.
- PASS: JSHANES `2026-06-20_iqc_aql_z14_policy.sql` 적용 성공.
- PASS: JSHANES post-check `ITEM=4`, `PARTNER=2`, `IQC_LOGS=15`, `HISTORY_TABLE=1`, `CODE_LETTER_ROWS=45`.
- PASS: `ORACLE_SITE=JSHANES python tools/generate_db_schema_doc.py`로 `docs/reports/db-schema-erd.md` 갱신.
- PASS: 대상 변경 파일 `git diff --check` 통과.
review:
- needs-review
notes:
- 사용자가 2안 정석 구조를 선택했다.
- 기존 2026-06-19 AQL 설계는 superseded 처리하고, 새 설계/계획을 기준으로 구현한다.
- 2026-06-20 12:56까지 설계/계획 문서화 완료. 이후 같은 작업 ID로 구현 진행.
- 품목 AQL 기준, 업체 검사강도, IQC 서버 AQL 판정, Critical 즉시 FAIL, 업체 검사모드 자동전환 이력을 구현했다.

## T-TOAST-BOTTOM-LEFT 토스트 이벤트 메시지 좌하단 이동
status: REVIEW
owner: codex
role: implementer
scope:
- 전역 toast 이벤트 메시지 위치를 우상단에서 좌하단으로 이동
files:
- apps/frontend/src/app/providers.tsx
- apps/frontend/src/app/toaster-position.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test apps/frontend/src/app/toaster-position.structure.test.mjs` 기존 `top-right` 설정으로 실패 확인.
- GREEN: `node --test apps/frontend/src/app/toaster-position.structure.test.mjs` PASS.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
review:
- needs-review
notes:
- `react-hot-toast` 공통 `Toaster` 위치 계약을 `bottom-left`로 고정한다.

## T-MATERIAL-PO-STATUS-RECEIVED-GREEN PO현황 입고완료 색상 보정
status: REVIEW
owner: codex
role: implementer
scope:
- `/material/po-status` 입고완료 상태 배지 색상 보정
files:
- apps/frontend/src/app/(authenticated)/material/po-status/page.tsx
- apps/frontend/src/app/(authenticated)/material/po-status/po-status-received-green.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/material/po-status/po-status-received-green.structure.test.mjs"` 초록 전용 클래스/우선 적용 누락으로 실패 확인.
- GREEN: `node --test "apps/frontend/src/app/(authenticated)/material/po-status/po-status-received-green.structure.test.mjs"` PASS.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: 3002 Playwright `/material/po-status` 좌측 그리드에서 `입고율 100%` 행들이 `입고완료` 초록 배지와 초록 진행바로 표시됨. console/page error 0.
- PASS: `git diff --check`.
review:
- needs-review
notes:
- `PO_STATUS.RECEIVED` 또는 좌측 그리드 `receiveRate >= 100`이면 `/material/po-status`에서 `입고완료` 초록 상태 배지로 표시한다.

## T-MASTER-PART-LABEL-TERMS 품목정보 용어 변경
status: REVIEW
owner: codex
role: implementer
scope:
- `/master/part` 품목정보 화면 표시 용어 변경
files:
- apps/frontend/src/app/(authenticated)/master/part/page.tsx
- apps/frontend/src/app/(authenticated)/master/part/components/PartFormPanel.tsx
- apps/frontend/src/app/(authenticated)/master/part/components/PartFormModal.tsx
- apps/frontend/src/app/(authenticated)/master/part/components/PartFieldHelp.tsx
- apps/frontend/src/app/(authenticated)/master/part/part-label-terms.structure.test.mjs
- apps/frontend/src/locales/ko.json
- tools/hanes-master-part-page-scenario-qa.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/master/part/part-label-terms.structure.test.mjs"` 기존 용어/섹션 문구/도움말 누락/택타임 잔존으로 실패 확인.
- GREEN: `node --test "apps/frontend/src/app/(authenticated)/master/part/part-label-terms.structure.test.mjs"` PASS.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: `Invoke-WebRequest -UseBasicParsing http://localhost:3002/master/part -TimeoutSec 30` 200.
- PASS: 3002 Playwright DOM 검증. `품목 추가` 후 도움말 27개, `BOX_QTY/MIN_PACK_QTY/LOT_UNIT_QTY/STORAGE_LOCATION` DB 컬럼 title 표시, 10~100 후보값, `거래처 / 수량관리`/`택타임` 미표시 확인.
- PASS: `git diff --check`.
review:
- needs-review
notes:
- `박스입수량` -> `박스장입수량`, `최소포장단위` -> `최소불출단위수량(자재)`, `묶음단위수량` -> `묶음단위수량(생산공정품)`.
- `거래처 / 수량관리` 섹션 문구는 화면에서 제거한다.
- 입력 컬럼 제목 옆 `?` 도움말에 설명과 `ITEM_MASTERS` DB 컬럼명을 표시한다.
- `택타임`은 화면 사용처가 없어 `/master/part` 관리 UI와 QA 입력 시나리오에서 제거한다.

## T-SHIP-ORDER-SQL-PREVIEW 출하지시등록 SQL 미리보기 보정
status: REVIEW
owner: codex
role: implementer
scope:
- `/shipping/order` DataGrid SQL 미리보기 실제 조회 구조 반영
files:
- apps/frontend/src/app/(authenticated)/shipping/order/page.tsx
- apps/frontend/src/app/(authenticated)/shipping/order/ship-order-sql-preview.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-sql-preview.structure.test.mjs"` `SHIPPING_ORDERS` 오기와 조인 누락으로 실패 확인.
- GREEN: `node --test "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-sql-preview.structure.test.mjs"` PASS.
- PASS: `node --test "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-print.structure.test.mjs"` PASS.
- PASS: `node "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-payload.structure.test.mjs"` PASS.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: `http://localhost:3014/shipping/order` 200 및 Next compile PASS.
- PASS: `git diff --check`.
review:
- needs-review
notes:
- 실제 `/shipping/orders` 조회는 `SHIPMENT_ORDERS` 헤더 조회 후 `SHIPMENT_ORDER_ITEMS`, `ITEM_MASTERS`, `PARTNER_MASTERS`를 보강한다.
- 화면 SQL 미리보기는 `SHIPMENT_ORDERS so` + 품목/품목명/고객명 LEFT JOIN 및 company/plant 조건을 표시한다.

## T-SHIP-ORDER-PRINT 출하지시서 출력 기능
status: REVIEW
owner: codex
role: implementer
scope:
- `/shipping/order` 등록된 출하지시서 브라우저 출력
files:
- apps/frontend/src/app/(authenticated)/shipping/order/page.tsx
- apps/frontend/src/app/(authenticated)/shipping/order/ship-order-print.structure.test.mjs
- apps/frontend/src/locales/ko.json
- apps/frontend/src/locales/en.json
- apps/frontend/src/locales/zh.json
- apps/frontend/src/locales/vi.json
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-print.structure.test.mjs"` QR/출력 영역 누락으로 실패 확인.
- GREEN: `node --test "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-print.structure.test.mjs"` PASS.
- PASS: ko/en/zh/vi locale JSON parse.
- PASS: `git diff --check`.
- PASS: `http://localhost:3014/shipping/order` 200 및 Next dev compile PASS. 3002는 HTTP timeout이라 기존 서버는 건드리지 않고 3014를 별도 기동했다.
- 참고: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`는 기존 진행 중 변경 `apps/frontend/src/app/(authenticated)/shipping/confirm/page.tsx:318`의 `selectedRowId` `string | null` 타입 오류로 실패했다.
review:
- needs-review
notes:
- 출하지시번호는 출력물 상단에 텍스트와 2D QR 바코드로 함께 표시한다.
- 리스트 행 출력 버튼은 `window.print()`를 호출하고, print media에서는 `ship-order-print-root`만 표시한다.

## T-SHIP-CONFIRM-ORDER-PANEL 출하확정 좌측 출하지시 패널
status: REVIEW
owner: codex
role: implementer
scope:
- `/shipping/confirm` 좌측 미출하 출하지시 그리드 패널 추가
files:
- apps/frontend/src/app/(authenticated)/shipping/confirm/page.tsx
- apps/frontend/src/app/(authenticated)/shipping/confirm/shipping-confirm-order-panel.structure.test.mjs
- apps/frontend/src/components/shipping/BoxScanShipModal.tsx
- apps/frontend/src/components/shipping/box-scan-ship-modal-initial-order.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/shipping/confirm/shipping-confirm-order-panel.structure.test.mjs"` 좌측 패널/출하지시 조회 연결 누락으로 실패 확인.
- RED: `node --test apps/frontend/src/components/shipping/box-scan-ship-modal-initial-order.structure.test.mjs` 모달 초기 출하지시번호 prop 누락으로 실패 확인.
- GREEN: `node --test "apps/frontend/src/app/(authenticated)/shipping/confirm/shipping-confirm-order-panel.structure.test.mjs"` PASS.
- GREEN: `node --test apps/frontend/src/components/shipping/box-scan-ship-modal-initial-order.structure.test.mjs` PASS.
- PASS: `node --test apps/frontend/src/components/shipping/box-scan-ship-modal-order-no.structure.test.mjs`.
- PASS: `node --test "apps/frontend/src/app/(authenticated)/shipping/confirm/shipping-confirm-no-info-cards.structure.test.mjs"`.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: `pnpm --filter @harness/frontend build`.
- PASS: 3003 API `/api/v1/shipping/orders?status=CONFIRMED&limit=5000`에서 미출하 후보 `SO-RV-26061202215660`, `SO-OK-2606120221` 확인.
- PASS: 3002 `/shipping/confirm` Playwright 확인. 좌측 `미출하 출하지시` 패널과 `SO-RV-26061202215660` 표시, 행 클릭 시 박스스캔 모달 자동 로딩, 고객사/박스 바코드 입력 표시, 출하지시번호 수동 입력 프롬프트 미표시, console error 0.
- PASS: `git diff --check`.
review:
- needs-review
notes:
- `CONFIRMED` 출하지시 중 잔여수량이 있는 지시를 좌측 패널에 표시하고, 선택 시 박스스캔 모달에 출하지시번호를 자동 전달한다.
- 상단 `박스 스캔 출하` 버튼은 기존처럼 수동 출하지시번호 입력 흐름을 유지한다.

## T-SHIP-CONFIRM-CARD-REMOVE 출하확정 정보카드 제거
status: REVIEW
owner: codex
role: implementer
scope:
- `/shipping/confirm` 카드형 정보 영역 제거
files:
- apps/frontend/src/app/(authenticated)/shipping/confirm/page.tsx
- apps/frontend/src/app/(authenticated)/shipping/confirm/shipping-confirm-no-info-cards.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/shipping/confirm/shipping-confirm-no-info-cards.structure.test.mjs"` `StatCard` 렌더링 존재로 실패 확인.
- GREEN: `node --test "apps/frontend/src/app/(authenticated)/shipping/confirm/shipping-confirm-no-info-cards.structure.test.mjs"` PASS.
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`.
- PASS: `git diff --check`.
- 참고: `localhost:3002`는 node PID `55728`이 listen 중이나 `Invoke-WebRequest`가 30초 타임아웃되어 브라우저/HTTP 확인은 완료하지 못했다.
review:
- needs-review
notes:
- 조회/출하/스캔/모달 기능은 유지하고 상단 상태 요약 정보카드만 제거한다.

## T-SHIP-CONFIRM-BOXSCAN-ORDERNO 박스스캔출하 모달 출하지시번호 표시
status: REVIEW
owner: codex
role: implementer
scope:
- `/shipping/confirm` 박스스캔출하 모달에 조회된 출하지시번호 표시
files:
- apps/frontend/src/components/shipping/BoxScanShipModal.tsx
- apps/frontend/src/components/shipping/box-scan-ship-modal-order-no.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test apps/frontend/src/components/shipping/box-scan-ship-modal-order-no.structure.test.mjs` 표시 누락으로 실패
- GREEN: `node --test apps/frontend/src/components/shipping/box-scan-ship-modal-order-no.structure.test.mjs`
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: `Invoke-WebRequest -UseBasicParsing http://localhost:3002/shipping/confirm` 200
- PASS: Playwright 3002 `/shipping/confirm` 박스스캔출하 모달에서 `SO-RV-26061202215660` 조회 후 번호/고객사/박스입력 표시, console error 0
- PASS: `git diff --check`
review:
- needs-review
notes:
- 주문 조회 후 박스 스캔 전에 현재 출하지시번호를 별도 요약 영역으로 보여준다.

## T-SHIP-BOX-STOCK-CARD-REMOVE 박스재고조회 정보카드 제거
status: REVIEW
owner: codex
role: implementer
scope:
- `/shipping/box-stock` 카드형 정보 영역 제거
files:
- apps/frontend/src/app/(authenticated)/shipping/box-stock/page.tsx
- apps/frontend/src/app/(authenticated)/shipping/box-stock/box-stock-no-info-cards.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test "apps/frontend/src/app/(authenticated)/shipping/box-stock/box-stock-no-info-cards.structure.test.mjs"` 카드 프레임 존재로 실패
- GREEN: `node --test "apps/frontend/src/app/(authenticated)/shipping/box-stock/box-stock-no-info-cards.structure.test.mjs"`
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: `Invoke-WebRequest -UseBasicParsing http://localhost:3002/shipping/box-stock` 200
- PASS: Playwright 3002 `/shipping/box-stock` title 표시, 카드형 wrapper 0, console error 0
- PASS: `git diff --check`
review:
- needs-review
notes:
- 조회/상세 그리드 기능은 유지하고 `Card/CardContent` 프레임만 제거했다.

## T-MENU-LOCALE-MISSING 메뉴 번역 누락 보정
status: REVIEW
owner: codex
role: implementer
scope:
- `menuConfig` labelKey 기준 ko/en/zh/vi locale 누락 보정
files:
- apps/frontend/src/config/menuConfig.ts
- apps/frontend/src/locales/ko.json
- apps/frontend/src/locales/en.json
- apps/frontend/src/locales/zh.json
- apps/frontend/src/locales/vi.json
- apps/frontend/src/config/menu-locale-coverage.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED: `node --test apps/frontend/src/config/menu-locale-coverage.structure.test.mjs` 실패 확인. 실제 누락은 `en/zh/vi: menu.material.shelfLifeHistory`.
- GREEN: `node --test apps/frontend/src/config/menu-locale-coverage.structure.test.mjs` PASS.
- `node -e "const fs=require('fs'); for (const l of ['ko','en','zh','vi']) JSON.parse(fs.readFileSync('apps/frontend/src/locales/'+l+'.json','utf8')); console.log('locale json ok');"` PASS.
review:
- needs-review
notes:
- `menuConfig` labelKey와 i18next의 점 포함 locale 키 구조를 기준으로 누락 검증 테스트를 추가했다.
- `menu.material.shelfLifeHistory`를 en/zh/vi menu locale에 추가했다. 기존 dirty locale 변경은 유지했다.

## T-SHIP-OQC-GATE-OFF OQC 출하 게이트 비활성화
status: REVIEW
owner: codex
role: operator
scope:
- JSHANES `40/1000` `SYS_CONFIGS.OQC_ENABLED` 비활성화
files:
- JSHANES DB data: `SYS_CONFIGS.OQC_ENABLED`
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
verification:
- pre-check PASS: JSHANES `SYS_CONFIGS.OQC_ENABLED=Y`
- API PASS: `PATCH /api/system/configs/OQC_ENABLED` `{ configValue: "N" }` 성공
- post-check PASS: DB `CONFIG_VALUE=N`, `/api/system/configs/active` map `OQC_ENABLED=N`
review:
- needs-review
notes:
- 코드 변경 없이 출하 게이트 설정만 껐다. 실제 출하 처리는 수행하지 않았다.

## T-SHIP-SO999-APPROVE SO-20260619-999 출하 가능 상태 보정
status: REVIEW
owner: codex
role: operator
scope:
- JSHANES `40/1000` SO-20260619-999 출하지시 상태 확인 및 승인 상태 보정
files:
- JSHANES DB data: `SO-20260619-999`
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
verification:
- pre-check PASS: `SO-20260619-999`는 `DRAFT`, 품목 `HNS02` 10개, 출하수량 0
- API PASS: `PUT /api/shipping/orders/SO-20260619-999/confirm` 성공, 상태 `CONFIRMED`
- OQC PASS: `POST /api/quality/oqc/OQC-20260619-001/execute`로 `BX2606190002` `PASS`
- post-check PASS: `SO CONFIRMED`, `BX2606190002 CLOSED/PASS`, `FG_MAIN HNS02 AVAILABLE_QTY=10`
review:
- needs-review
notes:
- 실제 출하 처리는 수행하지 않았고, 출하 스캔 가능 조건만 맞췄다.

## T-SHIP-ORDER-AUTO-NO 출하지시번호 자동 채번
status: REVIEW
owner: codex
role: implementer
scope:
- `/shipping/order` 출하지시 등록 시 번호 수동입력 제거 및 서버 자동 채번
files:
- apps/frontend/src/app/(authenticated)/shipping/order/page.tsx
- apps/frontend/src/app/(authenticated)/shipping/order/ship-order-payload.structure.test.mjs
- apps/backend/src/modules/shipping/dto/ship-order.dto.ts
- apps/backend/src/modules/shipping/services/ship-order.service.ts
- apps/backend/src/modules/shipping/services/ship-order.service.spec.ts
verification:
- RED: `pnpm --filter @harness/backend test -- ship-order.service.spec.ts -t "generate shipOrderNo" --runInBand`
- RED: `node --test "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-payload.structure.test.mjs"`
- GREEN: `pnpm --filter @harness/backend test -- ship-order.service.spec.ts --runInBand`
- GREEN: `node --test "apps/frontend/src/app/(authenticated)/shipping/order/ship-order-payload.structure.test.mjs"`
- PASS: `pnpm --filter @harness/backend exec tsc --noEmit --pretty false`
- PASS: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`
- PASS: `POST /api/v1/shipping/orders` without `shipOrderNo` generated `SH2606190001`, then deleted and DB residue 0 confirmed
- PASS: `http://localhost:3002/shipping/order` Playwright registration modal shows `출하지시번호=자동생성`, disabled true, console errors 0
- PASS: `git diff --check`
review:
- needs-review
notes:
- 기존 `NumberingService.nextShipmentNo()`를 사용해 서버에서 출하지시번호를 생성한다. 신규 등록 화면은 번호를 전송하지 않고 비활성 `자동생성` 필드만 표시한다.

## T-IQC-HISTORY-CERT-TIMESTAMP IQC 이력 성적서 업로드 timestamp 매칭
status: REVIEW
owner: codex
role: implementer
scope:
- `/material/iqc-history` 검사성적서 업로드 404 원인 수정
files:
- apps/backend/src/modules/material/services/iqc-history.service.ts
- apps/backend/src/modules/material/services/iqc-history.service.spec.ts
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- JSHANES 확인: 에러 ISO `2026-06-19T07:56:27.354Z`는 DB `IQC_LOGS.INSPECT_DATE=2026-06-19 16:56:27.354`, `SEQ=1` 행과 대응
- RED 확인: 기존 구현은 `findOne(Date)` 실패 시 404를 던짐
- pnpm --filter @harness/backend test -- iqc-history.service.spec.ts -t "성적서 업로드" PASS
- pnpm --filter @harness/backend exec tsc --noEmit --pretty false PASS
review:
- needs-review
notes:
- 화면은 `2026-06-19T07:56:27.354Z`를 보내지만 JSHANES `IQC_LOGS.INSPECT_DATE`는 `2026-06-19 16:56:27.354` 로컬 TIMESTAMP로 저장되어 exact Date PK 비교가 실패했다.
- 업로드는 기존 `findOne(Date)` 실패 시 ISO를 KST Oracle timestamp 문자열로 변환해 QueryBuilder fallback 조회/업데이트를 수행한다.

## T-IQC-HISTORY-ARRIVALNO-COLUMN IQC 이력 그리드 입하번호 표시
status: REVIEW
owner: codex
role: implementer
scope:
- `/material/iqc-history` 그리드 입하번호 컬럼 추가
files:
- apps/frontend/src/app/(authenticated)/material/iqc-history/page.tsx
- apps/frontend/src/app/(authenticated)/material/iqc-history/iqc-history-lot-no.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED 확인: `node --test apps/frontend/src/app/(authenticated)/material/iqc-history/iqc-history-lot-no.structure.test.mjs`에서 입하번호 컬럼 누락 실패 확인
- node --test apps/frontend/src/app/(authenticated)/material/iqc-history/iqc-history-lot-no.structure.test.mjs PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
- 브라우저 PASS: 3002 `/material/iqc-history` 그리드 헤더 `입하번호`, 행 값 `R26061900002` 표시
review:
- needs-review
notes:
- 백엔드 응답과 타입에는 `arrivalNo`가 이미 있으며, 목록 그리드 표시만 누락되어 있다.

## T-ISSUE-REQUEST-BARCODE-VALIDATION 출고요청 바코드 출고 품목 검증
status: REVIEW
owner: codex
role: implementer
scope:
- 출고요청 기반 바코드 출고 시 요청 품목과 스캔 LOT 품목 일치 검증
files:
- apps/backend/src/modules/material/services/issue-request.service.ts
- apps/backend/src/modules/material/services/issue-request.service.spec.ts
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED 확인: 기존 `issueFromRequest`는 요청항목 ITEM-A에 ITEM-B LOT를 보내도 정상 완료됨
- pnpm --filter @harness/backend test -- issue-request.service.spec.ts PASS
- pnpm --filter @harness/backend exec tsc --noEmit --pretty false PASS
- JSHANES `40/1000` 출고요청 상태: COMPLETED 8건, APPROVED/REQUESTED 0건
- JSHANES 완료 요청 기준 요청품목과 출고 LOT 품목 불일치 0건
review:
- needs-review
notes:
- 웹 요청출고 API는 실제 출고 생성 전에 요청항목 `ITEM_CODE`와 스캔 `MAT_UID`의 LOT `ITEM_CODE`를 대조하도록 보정했다.
- PDA `/material/issues/scan` 흐름은 출고요청번호를 소비하지 않는 별도 작업지시/BOM 기반 전량출고 흐름이다.

## T-HNS02-260619-SEED-CLEANUP HNS02 260619 시드 데이터 정리
status: REVIEW
owner: codex
role: operator
scope:
- JSHANES `40/1000` HNS02 260619 시드성 데이터 정리
files:
- tools/seed/cleanup_hns02_260619_seed.py
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- dry-run PASS: 삭제 후보 679건, after-in-tx 시드 마커 잔여 0
- commit PASS: 삭제 679건 적용
- post-check PASS: LOT-입고/LOT-수불 품목 불일치 0, 재고 invariant 0, 미완료 출고요청 0
review:
- needs-review
notes:
- `tools/seed/cleanup_hns02_260619_seed.py --commit`으로 JSHANES `40/1000`에 반영했다.

## T-IQC-AQL-MENU AQL 기준관리 메뉴 진입점 추가
status: REVIEW
owner: codex
role: implementer
scope:
- 품질관리 하위 `AQL 기준관리` 메뉴/라우트 진입점 추가
files:
- apps/frontend/src/config/menuConfig.ts
- apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts
- apps/frontend/src/components/layout/pageRegistry.generated.ts
- apps/frontend/src/locales/ko.json
- apps/frontend/src/locales/en.json
- apps/frontend/src/locales/zh.json
- apps/frontend/src/locales/vi.json
- apps/frontend/src/app/(authenticated)/quality/aql/page.tsx
- apps/frontend/src/app/(authenticated)/quality/aql/aql-menu.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- RED 확인: `node --test apps/frontend/src/app/(authenticated)/quality/aql/aql-menu.structure.test.mjs` 4건 실패 확인
- node --test apps/frontend/src/app/(authenticated)/quality/aql/aql-menu.structure.test.mjs PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
review:
- needs-review
notes:
- AQL CRUD/API/DB 구현은 하지 않고, 메뉴 클릭 시 라우트가 깨지지 않는 기본 진입점만 추가한다.

## T-IQC-HISTORY-LOTNO-FALLBACK IQC 이력 LOT No. 시료바코드 표시
status: REVIEW
owner: codex
role: implementer
scope:
- `/material/iqc-history` 입하단위 IQC 이력의 LOT No. 표시 보정
files:
- apps/frontend/src/app/(authenticated)/material/iqc-history/page.tsx
- apps/frontend/src/app/(authenticated)/material/iqc-history/iqc-history-lot-no.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- JSHANES PASS: `R26061900002` 이력은 `IQC_LOGS.MAT_UID IS NULL`, `SAMPLE_BARCODE='VH1-RM260619-00011'` 확인
- API PASS: `/api/material/iqc-history?limit=5&inspectType=INITIAL&fromDate=2026-06-19&toDate=2026-06-19` 첫 행 `matUid=null`, `sampleBarcode='VH1-RM260619-00011'`
- node --test apps/frontend/src/app/(authenticated)/material/iqc-history/iqc-history-lot-no.structure.test.mjs PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
- 브라우저 PASS: 3002 `/material/iqc-history` 첫 행 `R26061900002 / CBL-B` LOT No.에 `VH1-RM260619-00011` 표시
- git diff --check 대상 파일 PASS
review:
- needs-review
notes:
- 입하단위 IQC 이력은 `IQC_LOGS.MAT_UID`가 `NULL`이고 실제 스캔 시료 LOT는 `SAMPLE_BARCODE`에 저장된다. 목록 LOT No.는 `matUid || sampleBarcode`로 표시한다.

## T-IQC-AQL-PLAN IQC 우선 AQL 기준관리 설계/계획
status: REVIEW
owner: codex
role: implementer
scope:
- IQC 우선 AQL 기준관리 도입 설계와 구현 계획 문서화
files:
- docs/superpowers/specs/2026-06-19-iqc-aql-design.md
- docs/superpowers/plans/2026-06-19-iqc-aql-implementation.md
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- 설계 문서 생성 확인: docs/superpowers/specs/2026-06-19-iqc-aql-design.md
- 구현 계획 문서 생성 확인: docs/superpowers/plans/2026-06-19-iqc-aql-implementation.md
- 문서 핵심 조건 확인: `SAMPLE_QTY` 미사용/물리삭제 보류, `QC_AQL`, `AQL_SAMPLE_SIZE`, `INSPECT_CLASS` 불변 명시
- git diff --check -- docs/superpowers/specs/2026-06-19-iqc-aql-design.md docs/superpowers/plans/2026-06-19-iqc-aql-implementation.md .ai-coordination/TASKS.md .ai-coordination/LOCKS.md PASS
review:
- needs-review
notes:
- 기존 `IQC_PART_SPECS.SAMPLE_QTY`는 1차에서 화면/로직 미사용 처리하고 물리 삭제는 안정화 후 2차로 분리한다.
- 구현 코드는 수정하지 않았다. 사용자 리뷰 후 실행 단계로 전환한다.

## T-MATERIAL-ARRIVAL-QTY-FORMAT 자재입하처리 모달 숫자 천단위 포맷
status: REVIEW
owner: codex
role: implementer
scope:
- `/material/arrival` 자재입하처리 모달의 입수량 등 숫자 표시 포맷 보정
files:
- apps/frontend/src/app/(authenticated)/material/arrival/components/PoLineReceiptModal.tsx
- apps/frontend/src/app/(authenticated)/material/arrival/components/po-line-receipt-number-format.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- 구조 테스트 RED 확인 PASS: `formatQuantity` 부재 및 `String(lotUnitQty)`/raw `lotUnitQty ?? '-'` 표시로 실패 확인
- node --test apps/frontend/src/app/(authenticated)/material/arrival/components/po-line-receipt-number-format.structure.test.mjs PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
review:
- needs-review
notes:
- 입력용 입하수량 필드는 기존 `type="number"` 동작을 유지하고, 읽기 전용 입수량/예상 시리얼 계산식/예상 시리얼수 숫자 표시에 천단위 구분자를 적용했다.

## T-KIOSK-MOUNTED-RELOAD 키오스크 장착 자재/소모품 DB 재조회
status: REVIEW
owner: codex
role: implementer
scope:
- `/production/input-kiosk` 재진입 시 DB 저장 장착 상태 재조회
files:
- apps/frontend/src/app/(authenticated)/production/input-kiosk/components/MaterialListPanel.tsx
- apps/frontend/src/app/(authenticated)/production/input-kiosk/components/ConsumableScanModal.tsx
- apps/frontend/src/app/(authenticated)/production/input-kiosk/components/kiosk-mounted-reload.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- 구조 테스트 RED 확인 PASS: 키오스크 소모품 호출이 `selectedEquip`/`equipCode`/`includeMounted` 없이 실패함
- node --test apps/frontend/src/app/(authenticated)/production/input-kiosk/components/kiosk-mounted-reload.structure.test.mjs PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
- JSHANES DB PASS: `WO2606150066/HNS02C2ABCDE/EQ-ATCNS-01`, `CONSUMABLE_USAGE_MAP` 2건, `CONSUMABLE_STOCKS` MOUNTED 2건 확인
- API PASS: `GET /production/job-orders/WO2606150066/consumables?equipCode=EQ-ATCNS-01&includeMounted=1`이 `CT26061600001`, `CT26061600002` 반환
- 브라우저 PASS: 3002 `/production/input-kiosk` 진입 시 같은 API 호출 및 두 mountedConUid 화면 표시
review:
- needs-review
notes:
- localStorage에 저장하지 않고 `JOB_MATERIAL_LOTS` 및 `CONSUMABLE_STOCKS` 기준으로 재조회한다.
- 키오스크 소모품 API 호출은 현재 화면 선택 설비 `equipCode`와 `includeMounted=1`을 함께 전달해야 한다.
- 현재 JSHANES `JOB_MATERIAL_LOTS`는 0건이라 자재 쪽은 저장 데이터 표시 샘플이 없었지만, 기존 조회 경로와 구조 테스트로 DB 재조회 계약을 고정했다.

## T-WIP-STOCK-ACTUAL-SQL 반제품/제품재고 SQL 미리보기 실제 쿼리 반영
status: REVIEW
owner: codex
role: implementer
scope:
- `/production/wip-stock` DataGrid SQL 조회문을 실제 백엔드 조회 SQL 기준으로 보정
files:
- apps/frontend/src/app/(authenticated)/production/wip-stock/page.tsx
- apps/frontend/src/app/(authenticated)/production/wip-stock/wip-stock-actual-sql.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- 구조 테스트 RED 확인 PASS: 기존 `WIP_STOCKS` 하드코딩으로 실패 확인
- node --test apps/frontend/src/app/(authenticated)/production/wip-stock/wip-stock-actual-sql.structure.test.mjs PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
- 브라우저 PASS: 3002 `/production/wip-stock` SQL 조회문 모달에서 `PRODUCT_STOCKS`/`ITEM_MASTERS`/`WAREHOUSES` 표시, `WIP_STOCKS` 미표시
review:
- needs-review
notes:
- 실제 API `GET /production/wip-stock`는 `PRODUCT_STOCKS s`에서 조회하고 `ITEM_MASTERS im`, `WAREHOUSES wh`를 조인한다. 화면 fallback SQL의 `WIP_STOCKS` 하드코딩을 제거한다.
- 화면 검색어와 유형 필터 값에 따라 SQL 미리보기의 `itemType`/검색 조건이 함께 반영된다.

## T-DATAGRID-HOVER-SCROLL-REMOVE DataGrid 좌우 hover 스크롤 제거
status: REVIEW
owner: codex
role: implementer
scope:
- 공용 DataGrid 좌우 끝 hover 자동 스크롤 영역 제거
files:
- apps/frontend/src/components/data-grid/DataGrid.tsx
- apps/frontend/src/components/data-grid/ScrollHandle.tsx
- apps/frontend/src/components/data-grid/datagrid-scroll-handle-removal.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- 구조 테스트 RED 확인 PASS: DataGrid ScrollHandle import/render 및 파일 존재로 실패 확인
- node --test apps/frontend/src/components/data-grid/datagrid-scroll-handle-removal.structure.test.mjs PASS
- node --test apps/frontend/src/app/(authenticated)/production/specification-setup/page.structure.test.mjs PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
- 브라우저 PASS: /production/specification-setup DataGrid 렌더 상태에서 group/scroll 0, group-hover/scroll 0, data-scroll-id 0
review:
- needs-review
notes:
- 모든 DataGrid에서 좌/우 끝 마우스 hover 자동 스크롤 영역을 제거한다. 일반 스크롤 컨테이너 자체는 유지한다.

## T-HARNESS-CIRCUIT-PAYLOAD 회로 저장 payload 정리
status: REVIEW
owner: codex
role: implementer
scope:
- 제품 도면관리 회로 저장 400 오류 수정
files:
- apps/frontend/src/app/(authenticated)/production/specification-setup/page.tsx
- apps/frontend/src/app/(authenticated)/production/specification-setup/page.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- 구조 테스트 RED 확인 PASS: 회로 payload sanitizer 부재 및 window.prompt 사용으로 실패 확인
- node --test apps/frontend/src/app/(authenticated)/production/specification-setup/page.structure.test.mjs PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
- API PASS: PUT /production/specifications/revisions/8 DTO 필드만 전송 시 200
- 브라우저 PASS: 저장 클릭 시 PUT /production/specifications/revisions/8 200, postData에 circuitId/revisionId/company/createdAt 미포함
- 브라우저 PASS: Rev 생성 모달 취소 시 /revise 호출 0건
review:
- needs-review
notes:
- 상세 조회 엔티티 필드가 회로 저장 DTO로 재전송되지 않도록 허용 필드만 payload에 담는다.
- `Rev 생성`은 브라우저 prompt/alert 계열이 아니라 화면 모달로 확인하고, 취소 시 API를 호출하지 않는다.

## T-HARNESS-CONNECTION-SYMBOL 연결문자 그림 표시
status: REVIEW
owner: codex
role: implementer
scope:
- 제품 도면관리 회로 그리드 연결 컬럼 표시 개선
files:
- apps/frontend/src/app/(authenticated)/production/specification-setup/page.tsx
- apps/frontend/src/app/(authenticated)/production/specification-setup/page.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- 구조 테스트 RED 확인 PASS: 연결 그림 컴포넌트 부재로 실패 확인
- node --test apps/frontend/src/app/(authenticated)/production/specification-setup/page.structure.test.mjs PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
- 브라우저 PASS: /production/specification-setup에서 HDW-SEED-HNS02-MAIN 선택 후 data-connection-symbol 8개, svg 8개, select 8개 렌더링 확인
review:
- needs-review
notes:
- `connectionSymbol` 저장값은 유지하고 화면에는 선/분기/단측 SVG 미리보기로 표시한다.

## T-HARNESS-DRAWING-SEED 하네스 도면관리 시드 데이터
status: REVIEW
owner: codex
role: operator
scope:
- 하네스 제품 도면관리 JSHANES 시드 데이터
files:
- apps/backend/src/modules/production/controllers/production-specification.controller.ts
- apps/backend/src/migrations/2026-06-18_harness_drawing_seed.sql
- apps/frontend/src/app/(authenticated)/production/specification-setup/page.tsx
- apps/frontend/src/app/(authenticated)/production/specification-setup/page.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- JSHANES pre-check 도면관리 0건 확인
- apps/backend/src/migrations/2026-06-18_harness_drawing_seed.sql JSHANES 적용 PASS
- seed SQL 재실행 PASS: 중복 없이 도면 2건, Revision 3건, 회로 17건 유지
- API PASS: HDW-SEED-HNS02-MAIN Rev.A 6회로, Rev.B 8회로 조회
- node --test apps/frontend/src/app/(authenticated)/production/specification-setup/page.structure.test.mjs PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
- pnpm --filter @harness/backend exec tsc --noEmit --pretty false PASS
- 브라우저 PASS: /production/specification-setup 검색/선택 후 회로 입력값 VSF 0.75SQ 표시
review:
- needs-review
notes:
- 기존 품목 `HNS02`, `HNS02C1ABCD` 기준으로 재실행 가능한 seed를 적재한다.
- 검증 중 누락 확인된 Revision 상세 GET 라우트와 화면 회로 상세 로딩을 함께 보정한다.

## T-HARNESS-DRAWING-MGMT 하네스 제품 도면관리 신규 기능
status: REVIEW
owner: codex
role: implementer
scope:
- 생산 도면관리 신규 화면/API/DB
files:
- apps/backend/src/entities/harness-drawing-*.entity.ts
- apps/backend/src/modules/production/controllers/production-specification.controller.ts
- apps/backend/src/modules/production/services/production-specification.service.ts
- apps/backend/src/modules/production/dto/production-specification.dto.ts
- apps/backend/src/modules/production/production.module.ts
- apps/backend/src/migrations/2026-06-18_harness_drawing_management.sql
- apps/frontend/src/app/(authenticated)/production/specification-setup/**
- apps/frontend/src/config/menuConfig.ts
- apps/frontend/src/components/layout/pageRegistry.generated.ts
- apps/frontend/src/locales/{ko,en,zh,vi}.json
- apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts
- docs/reports/db-schema-erd.md
- docs/superpowers/plans/2026-06-18-harness-drawing-management.md
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- pnpm --filter @harness/backend exec jest apps/backend/src/modules/production/services/production-specification.service.spec.ts --runInBand PASS
- node --test apps/frontend/src/app/(authenticated)/production/specification-setup/page.structure.test.mjs PASS
- pnpm --filter @harness/backend exec tsc --noEmit --pretty false PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
- JSHANES 마이그레이션 적용 PASS: HARNESS_DRAWING_MASTERS/REVISIONS/CIRCUIT_SPECS, SEQ_HARNESS_* 3개, PROD_SPEC_SETUP 메뉴 확인
- python tools/generate_db_schema_doc.py PASS
- API 실흐름 PASS: 도면 생성 -> 승인 -> Rev 생성 -> 삭제, 테스트 데이터 잔여 0건
- 브라우저 PASS: http://localhost:3002/production/specification-setup 인증 세션에서 제목/Header/회로 그리드/저장/승인 버튼 표시
review:
- needs-review
notes:
- 신규 기능으로 기존 작업지도서/문서관리 확장이 아니라 하네스 도면 전용 Master/Revision/Circuit 구조로 구현한다.
- 생성 ID는 Oracle SEQUENCE.NEXTVAL만 사용한다.

## T-CONSUMABLE-LABEL-REPRINT 기존 소모품 라벨 재발행 테스트
status: REVIEW
owner: codex
role: implementer
scope:
- apps/frontend/src/app/(authenticated)/consumables/label
files:
- apps/frontend/src/app/(authenticated)/consumables/label/page.tsx
- apps/frontend/src/app/(authenticated)/consumables/label/components/ConLabelDetailPanel.tsx
- apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-reprint.structure.test.mjs
- apps/frontend/src/app/(authenticated)/master/label/components/LabelDesignRenderer.tsx
- apps/print-agent/**
- tools/print-agent.structure.test.mjs
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-reprint.structure.test.mjs PASS
- node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-issue-feedback.structure.test.mjs PASS
- node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-template-selection.structure.test.mjs PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
- http://localhost:3002/consumables/label 브라우저 재발행 테스트 PASS: UID C26061700029 재발행, 출력 팝업 UID/window.print 포함, 신규 /consumables/label/create 미호출, /material/label-print/log 201
- 좁은 우측 패널에서 재발행 버튼 상시 노출 Playwright 재검증 PASS: buttonBox가 420px panelBox 내부, UID 접근성 이름으로 클릭 가능
- 재발행 출력 방식 agent 전환 Playwright PASS: popup 0, agent /print 1회, jobId CON-REPRINT-C26061700029, 신규 채번 0건, print-log 201
- 재발행 전 미리보기 및 바코드 렌더 준비 대기 Playwright PASS: UID C26061700029, 미리보기 모달 ready barcode 1, pending 0, popup 0, agent /print 1회
- PDF 프린터 출력 결과 바코드 깨짐 원인 분리 및 수정 PASS: 전송 PNG before는 Tailwind class 미적용으로 barcode crop, after는 QR 전체/UID 정상
review:
- needs-review
notes:
- 기존 PENDING conUid를 새로 채번하지 않고 같은 UID로 재출력하고 print log만 추가한다.
- 420px 우측 패널의 넓은 테이블 구조에서는 재발행 버튼이 사용자에게 안 보일 수 있어 리스트형 행으로 보정 완료.
- 재발행 버튼은 브라우저 print dialog가 아니라 로컬 print-agent `/print`로 PNG를 전송한다.
- 출력 전 `미리보기`에서 같은 라벨 렌더링 결과를 확인할 수 있게 하고, 바코드 비동기 생성이 끝나기 전에는 agent PNG 캡처를 진행하지 않는다.
- 미리보기 정상/PDF 깨짐의 원인은 SVG foreignObject PNG 변환 시 Tailwind class가 적용되지 않아 absolute/object-contain 등 핵심 스타일이 빠진 것이다. `LabelDesignRenderer` 출력 필수 스타일은 inline style로 유지해야 한다.

## T-PRINT-AGENT-GO Go 기반 로컬 프린트 에이전트 추가
status: REVIEW
owner: codex
role: implementer
scope:
- apps/print-agent (Windows 로컬 프린트 에이전트)
- apps/frontend/src/services (프론트 연동용 클라이언트)
files:
- apps/print-agent/**
- apps/frontend/src/services/print-agent.ts
- tools/print-agent.structure.test.mjs
- docs/superpowers/plans/2026-06-17-hanes-print-agent.md
verification:
- node tools/print-agent.structure.test.mjs PASS
- C:\go\bin\go.exe test ./... PASS
- go build dist\hanes-print-agent.exe PASS
- tray 실행 경로 agent /health, /printers PASS
- agent 자체 `/settings` 설정관리 페이지 HTTP 200 PASS
- `/config` 기본 프린터 저장 및 config.json 반영 PASS
- `/test-print`가 저장된 기본 프린터 `Microsoft Print to PDF`로 queued PASS
- listenAddress 임시 변경 시 restartRequired=true, 복구 시 false PASS
- C:\go\bin\go.exe build -o dist\hanes-print-agent-new.exe .\cmd\hanes-print-agent PASS
review:
- needs-review
notes:
- 웹에서 사전 렌더링한 PNG를 localhost agent로 보내고, agent는 Windows 프린터 드라이버로 조용히 출력하는 1차 범위.
- Windows 트레이 상주, 상태 보기, 설정, 프린터 보기, 종료 메뉴 구현 완료. agent 자체 `/settings` 설정관리와 config 파일 저장 검증 완료. 트레이 설정 메뉴의 실제 클릭 육안 검증과 Zebra 실출력 검증은 남음.

## T-PDA-PALLET-SHIP PDA 팔레트 단위 출하 지원
status: TODO
owner: unassigned
role: implementer
scope:
- apps/backend/src/modules/shipping (출하지시-팔레트 연계 설계)
- apps/frontend/src/hooks/pda/useShippingScan.ts
files:
- apps/frontend/src/hooks/pda/useShippingScan.ts (TODO 마커 위치)
verification:
- PDA 팔레트 스캔 → 출하 → 재고 단일 차감 확인 (이중 차감 금지)
review:
- needs-review
notes:
- 결정 D-20260611-PDA-SHIPPING-BOX-ONLY 참조. 현재 PDA는 박스 단위만 지원, 팔레트 스캔은 PALLET_NOT_SUPPORTED 안내.
- 백엔드 shipBox()는 팔레트 적재 박스를 이중 차감 방지로 거부 — 우회 금지. shipment 자동 생성 또는 ship-pallet 전용 엔드포인트 설계 필요.

## T-IQC-AQL-CRUD AQL 기준관리 CRUD/API/DB 구현
status: REVIEW
owner: codex
role: implementer/operator
scope:
- `/quality/aql` 기준관리 등록/수정/삭제와 LOT 범위 rule 관리
files:
- apps/backend/src/entities/aql-standard.entity.ts
- apps/backend/src/entities/aql-sampling-rule.entity.ts
- apps/backend/src/modules/quality/aql/**
- apps/backend/src/modules/quality/quality.module.ts
- apps/backend/src/migrations/2026-06-19_iqc_aql_standards.sql
- apps/frontend/src/app/(authenticated)/quality/aql/**
- docs/reports/db-schema-erd.md
verification:
- RED 확인: backend AQL entity/service spec가 신규 모듈 부재로 실패
- RED 확인: frontend `/quality/aql` 구조 테스트가 placeholder page로 실패
- pnpm --filter @harness/backend test -- aql-standard.entity.spec.ts aql.service.spec.ts --runInBand PASS
- node --test "apps/frontend/src/app/(authenticated)/quality/aql/iqc-aql.structure.test.mjs" PASS
- pnpm --filter @harness/backend exec tsc --noEmit --pretty false PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
- JSHANES 마이그레이션 적용 PASS: `AQL_STANDARDS`, `AQL_SAMPLING_RULES` 생성 및 재실행 idempotent PASS
- ORACLE_SITE=JSHANES python tools/generate_db_schema_doc.py PASS, ERD 문서 AQL 테이블 반영 확인
- API PASS: 목록/등록/상세/resolve/수정/삭제 soft-disable 확인, 검증 데이터 물리 삭제 후 잔여 0
- 브라우저 PASS: 3002 `/quality/aql` 제목/저장/추가/rule 입력 UI 표시 및 console/page error 0
review:
- needs-review
notes:
- 이번 범위는 AQL 기준관리 CRUD까지로 제한한다. IQC 품목별 기준 연결과 IQC 검사 적용은 후속 단계로 분리한다.
- 테스트 기준코드 `AQL-CODEX-260619`는 API 검증 후 `AQL_SAMPLING_RULES`, `AQL_STANDARDS`에서 물리 삭제했다.

## T-EQUIP-INSPECT-WORKER-PK-COLLISION 작업자설비점검 PK 충돌 보정
status: REVIEW
owner: codex
role: implementer
scope:
- `/equipment/daily-inspect` WORKER 저장 시 `EQUIP_INSPECT_LOGS` 물리 PK 충돌 방지
files:
- apps/backend/src/modules/equipment/services/equip-inspect.service.ts
- apps/backend/src/modules/equipment/services/equip-inspect.service.spec.ts
verification:
- JSHANES pre-check: `EQ-ATCNS-01`/`WORKER`/2026-06-19 00:00:00 충돌 로그 확인.
- JSHANES cleanup: `WO2606190100`, `WO2606190118` 충돌 로그 각 1건 삭제, 최종 잔여 0건.
- RED: `pnpm --filter @harness/backend test -- equip-inspect.service.spec.ts -t "stores WORKER inspectDate"` 실패 확인.
- GREEN: 동일 focused test PASS.
- `pnpm --filter @harness/backend test -- equip-inspect.service.spec.ts` PASS.
- `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` PASS.
- `git diff --check -- apps/backend/src/modules/equipment/services/equip-inspect.service.ts apps/backend/src/modules/equipment/services/equip-inspect.service.spec.ts .ai-coordination/TASKS.md .ai-coordination/LOCKS.md` PASS.
review:
- needs-review
notes:
- 원인: WORKER 이력의 `INSPECT_DATE`가 날짜 00:00:00으로 저장되어 같은 장비/유형/일자에서 작업지시가 달라도 기존 PK와 충돌.
- 변경: WORKER 저장만 명시 SQL `TO_DATE(:3, 'YYYY-MM-DD HH24:MI:SS')`로 실제 점검시각을 물리 PK에 보존한다. DAILY 저장 경로는 유지.

## T-MASTER-REQUIRED-MARKS 기준정보 필수컬럼 별표 표시
status: REVIEW
owner: codex
role: implementer
scope:
- 기준정보 하위 메뉴 폼의 DB/저장 필수 컬럼 라벨 `*` 표시 일관화
files:
- apps/frontend/src/components/ui/Select.tsx
- apps/frontend/src/app/(authenticated)/master/**
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- 구조 테스트 RED 확인 PASS: `Select` 별표 미표시 및 기준정보 폼 required 누락으로 실패 확인
- node --test apps/frontend/src/app/(authenticated)/master/master-required-fields.structure.test.mjs PASS
- pnpm --filter @harness/frontend exec tsc --noEmit --pretty false PASS
review:
- needs-review
notes:
- 품목관리처럼 공통 Input/Select의 required prop을 사용해 필수 라벨 별표를 표시한다.
- `Select`도 `Input`과 동일하게 `required` 라벨 별표와 native required 속성을 처리한다.
- 작업지도서 폼의 수동 `*` 라벨은 자동 별표와 중복되지 않도록 제거했다.
