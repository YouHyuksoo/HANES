# TASKS

This file is active-work-only. Keep only `TODO`, `IN_PROGRESS`, and `BLOCKED` tasks here.
Move implementation-complete review work to `REVIEW_QUEUE.md`; do not keep `REVIEW` tasks here.

When a task reaches `REVIEW` or `DONE`:

1. For `REVIEW`, move the full task body to `REVIEW_QUEUE.md`.
2. For `DONE`, append detailed outcome and verification to `JOURNAL.md`.
3. For `DONE`, add one compact line to `ARCHIVE.md`.
4. Remove the task body from this file.

## Task Format

```md
## T-000 Short title
status: TODO | IN_PROGRESS | BLOCKED
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

## T-MASTER-COLUMN-EXTRACT 기준정보 DataGrid 컬럼 분리 + 공정CAPA 업무규칙 공통화
status: IN_PROGRESS
owner: claude
role: implementer
scope:
- master/{worker,company,gauge,partner,process-capa,vendor-barcode,work-instruction,equip-inspect-item} 인라인 columns → *Columns.tsx 팩토리 분리(동작 불변)
- process-capa FE/BE 중복 CAPA 산식 → packages/shared/src/utils/process-capa-rules.ts 승격
files:
- (LOCKS.md T-MASTER-COLUMN-EXTRACT 항목 참조)
verification:
- pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false (완료: 0 errors)
- pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false (진행 예정)
- node --test 각 *-columns.structure.test.mjs (완료: 21 pass)
review:
- needs-review
notes:
- part(레퍼런스)·worker 패턴 기준. 컬럼 분리는 7개 페이지 병렬 에이전트 + worker 직접.
- process-capa 승격 시 stdUph 반올림(FE 정수/BE 소수2자리)·dailyCapa 폴백(BE |0/|85)은 호출부 유지로 동작 보존.
- 발견: process-capa stdUph 반올림 FE/BE 불일치(잠재 버그) — 별도 보고, 이번엔 동작 보존 우선.
- 겹침: master page.tsx들이 claude T-MASTER-UNSAVED-GUARD lock과 파일 중복(동일 owner). codex T-ARCH-PAGE-RULE-REFORM은 system/department 담당(master/* 미수정).

## T-CHECKOUT-LOCALHOST-QA localhost checkout 흐름 브라우저 QA
status: IN_PROGRESS
owner: codex
role: operator
scope:
- localhost에서 checkout/출고 관련 흐름을 브라우저로 검증
files:
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- pending: in-app Browser localhost QA
review:
- 사용자 확인
notes:
- 앱 소스는 수정하지 않고 실행 중 localhost 화면과 네트워크/콘솔 상태를 확인한다.

## T-MASTER-PART-PAGE-STANDARD 품목마스터 페이지 표준 문서화
status: IN_PROGRESS
owner: codex
role: implementer
scope:
- docs/standards/master-part-page-standard.md
- docs/standards/ui-screen-patterns.md
files:
- docs/standards/master-part-page-standard.md
- docs/standards/ui-screen-patterns.md
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
verification:
- `playwright-cli`로 `http://localhost:3002/master/part` 실제 화면 확인
- `git diff --check`
review:
- needs-review
notes:
- `/master/part`를 유지보수 기준 화면으로 삼아 목록/배지/상단 액션/우측 패널 규칙을 문서화한다.

## T-ALL-MENU-QA 전체 메뉴 기능 QA 리포트
status: IN_PROGRESS
owner: codex
role: implementer/operator
scope:
- 모든 등록 메뉴의 route/API/콘솔 오류/화면 기능 목록 수집
- 실패 메뉴를 수정-재테스트 대상으로 분류하고 최종 HTML/JSON 리포트 작성
files:
- tools/hanes-all-menu-page-scenario-qa.mjs
- tools/hanes-all-menu-report-aggregate.mjs
- apps/frontend/src/hooks/useZebraPrinter.ts
- apps/frontend/src/app/(authenticated)/material/receive-label/components/PrintActionBar.tsx
- apps/frontend/src/app/(authenticated)/material/receive-label/receive-label-zebra-lazy.structure.test.mjs
- apps/frontend/src/app/(authenticated)/material/receive-history/page.tsx
- apps/frontend/src/app/(authenticated)/sales/customer-po-status/page.tsx
- apps/frontend/src/app/(authenticated)/customs/stock/page.tsx
- apps/frontend/src/app/(authenticated)/outsourcing/receive/page.tsx
- apps/backend/src/modules/shipping/controllers/customer-order.controller.ts
- apps/backend/src/modules/shipping/services/customer-order.service.ts
- apps/backend/src/modules/customs/controllers/customs.controller.ts
- apps/backend/src/modules/customs/services/customs.service.ts
- apps/backend/src/modules/outsourcing/controllers/outsourcing.controller.ts
- apps/backend/src/modules/outsourcing/services/outsourcing.service.ts
- docs/reports/hanes-all-menu-scenario-qa-*/
verification:
- 전체 메뉴 러너 실행, 결과 JSON/HTML 링크 검증, 실패별 재테스트 증거
review:
- needs-review
notes:
- 다른 AI active lock 파일은 수정하지 않는다. CRUD/업무처리 전체 실행은 메뉴 별 세부 러너로 확장한다.
- `/shipping/return`은 `T-SHIP-ORDER-CANCEL` active lock 범위라 직접 수정하지 않는다.

## T-QUALITY-DEFECT-FILTER-ONE-LINE 불량관리 필터 한 줄 배치
status: IN_PROGRESS
owner: hermes
role: implementer
scope:
- `/quality/defect` 필터 영역 레이아웃 조정
files:
- apps/frontend/src/app/(authenticated)/quality/defect/page.tsx
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/hermes.md
verification:
- `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false`
- 브라우저에서 `http://localhost:3002/quality/defect` 필터 한 줄 배치 확인
review:
- needs-review
notes:
- 사용자 요청: 필터 항목이 두 줄로 보여 공간 낭비가 크므로 한 줄로 처리한다.

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
