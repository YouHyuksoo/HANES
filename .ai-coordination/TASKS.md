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

## T-MATERIAL-ARRIVAL-QTY-FORMAT 자재입하처리 모달 숫자 천단위 포맷
status: IN_PROGRESS
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
- pending
review:
- needs-review
notes:
- 입력용 수량 필드는 기존 `type="number"` 동작을 유지하고, 읽기 전용 입수량/예상 시리얼 계산식 숫자 표시에 천단위 구분자를 적용한다.

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
