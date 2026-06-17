# 2026-06-16 codex T-KIOSK-WI-SEED-HNS02C1ABCD
- 상태: released
- 범위: `/production/input-kiosk` 작업지도서 표시 원인 확인 및 `WORK_INSTRUCTIONS` 시드 보완
- 파일:
  - `apps/backend/src/migrations/2026-06-16_work_instruction_hns02c1abcd_seed.sql`
  - `.ai-coordination/TASKS.md`
  - `.ai-coordination/LOCKS.md`
  - `.ai-coordination/JOURNAL.md`
  - `.ai-coordination/HANDOFF/codex.md`
- 비고: `WO2606150060` / `HNS02C1ABCD` / `ATCUT` 기준 실DB·API·브라우저 검증 완료 후 lock 해제.

# LOCKS

Before editing, add a lock entry. Mark it released when done.

## Active Locks

```md
- task: T-ARRIVAL-RESULT-AGENT-REPRINT
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/material/arrival-result/page.tsx
    - apps/frontend/src/app/(authenticated)/material/arrival-result/arrival-result-mfg-refresh.structure.test.mjs
    - .ai-coordination/LOCKS.md
    - .ai-coordination/TASKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-18 KST
  last_seen: 2026-06-18 00:36 KST
  expires: 2026-06-18 KST
  status: released
  note: `/material/arrival-result` 라벨 재발행도 `mat_lot` 템플릿 선택 + `MatLabelPreviewModal` agent 출력 방식으로 맞추고 `matlot_label` PDF 출력 확인.

- task: T-PRINT-AGENT-PDF-OUTPUT
  owner: codex
  files:
    - apps/print-agent/internal/printer/printer.go
    - apps/print-agent/internal/printer/printer_windows.go
    - apps/print-agent/internal/server/server.go
    - apps/print-agent/internal/jobs/log.go
    - apps/frontend/src/services/print-agent.ts
    - tools/print-agent.structure.test.mjs
    - .ai-coordination/LOCKS.md
    - .ai-coordination/TASKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-18 KST
  last_seen: 2026-06-18 00:10 KST
  expires: 2026-06-18 KST
  status: released
  note: `Microsoft Print to PDF` 기본 프린터 테스트 출력 실패(`Access is denied`) 보정 완료. PDF 출력 파일 경로 자동 지정 후 `/material/arrival` `matlot_label` 출력 PDF 생성 확인.

- task: T-MATERIAL-ARRIVAL-AGENT-LABEL
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/material/arrival/components/MatLabelPreviewModal.tsx
    - apps/frontend/src/app/(authenticated)/material/arrival/components/mat-label-preview-modal-print.structure.test.mjs
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 23:38 KST
  expires: 2026-06-18 KST
  status: released
  note: `/material/arrival` 입하 라벨 모달을 소모품 라벨과 같은 템플릿 선택 + 로컬 print-agent PNG 출력 방식으로 전환 완료. 구조 테스트/FE tsc/3002 브라우저 로딩 확인.

- task: T-PO-DATE-TIMEZONE-OFFBYONE
  owner: claude
  files:
    - apps/frontend/src/utils/date.ts
    - apps/frontend/src/app/(authenticated)/material/po/components/PoFormPanel.tsx
    - apps/backend/src/modules/material/services/purchase-order.service.ts
    - apps/backend/src/modules/material/services/po-status.service.ts
    - (외 frontend 날짜 입력 기본값 파일 다수 — getTodayLocal 적용)
    - .ai-coordination/LOCKS.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 KST
  expires: 2026-06-18 KST
  status: released
  note: PO 일자 off-by-one(UTC) 수정 완료 — getTodayLocal(FE)/parseDateStart·End(BE) 헬퍼 도입, FE 35파일 날짜 입력 기본값 로컬화 + BE PO create/update/조회필터(po-status·purchase-order) 보정. FE/BE tsc 0건. 실동작(오늘 PO 생성→ORDER_DATE 당일) 검증은 사용자 확인 대기.

- task: T-CONSUMABLE-LABEL-REPRINT
  owner: codex
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
  started: 2026-06-17 KST
  last_seen: 2026-06-17 23:14 KST
  expires: 2026-06-17 KST
  status: released
  note: `/consumables/label` PDF 출력 깨짐 원인은 agent가 아니라 전송 PNG 생성 시 SVG foreignObject 안에서 Tailwind class가 미적용된 것. LabelDesignRenderer 핵심 배치/이미지 스타일 inline 보강 후 전송 PNG 정상 확인.

- task: T-PRINT-AGENT-GO
  owner: codex
  files:
    - apps/print-agent/**
    - apps/frontend/src/services/print-agent.ts
    - tools/print-agent.structure.test.mjs
    - docs/superpowers/plans/2026-06-17-hanes-print-agent.md
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 21:57 KST
  expires: 2026-06-17 KST
  status: released
  note: Go agent 자체 `/settings` 설정관리 페이지와 트레이 `설정` 메뉴 보강 완료. 포트/기본프린터/origin/token/log 설정은 config 파일과 agent UI에서 관리하며, 포트 변경은 restartRequired로 재시작 필요를 표시.

- task: T-CONSUMABLE-STOCK-DEPLOY-QUERY
  owner: codex
  files:
    - apps/frontend/src/hooks/consumables/useStockData.ts
    - apps/frontend/src/hooks/consumables/useStockData.structure.test.mjs
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/ARCHIVE.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-17 15:21 KST
  last_seen: 2026-06-17 15:28 KST
  expires: 2026-06-17 16:21 KST
  status: released
  note: `/consumables/stock` 배포 조회 빈 화면 원인은 `{ success, data: { data: [...] } }` 이중 응답 envelope를 프론트가 배열로 풀지 못한 것이다. `useStockData` 파싱을 보정하고 구조 테스트/FE tsc 통과.

- task: T-CONSUMABLE-LABEL-CLICK-OPEN-PRINT
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/consumables/label/page.tsx
    - apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-issue-feedback.structure.test.mjs
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/ARCHIVE.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-17 14:24 KST
  last_seen: 2026-06-17 14:31 KST
  expires: 2026-06-17 15:24 KST
  status: released
  note: `/consumables/label` UID 발행 출력창을 버튼 클릭 즉시 `window.open`으로 선점하고, API 완료 후 같은 창에 라벨 HTML과 `window.print()`를 주입하도록 보정 완료. 구조 테스트 RED/GREEN, 템플릿/print-log 구조 테스트, FE tsc, 3002 브라우저 popup mock 검증, diff check 통과. commit/push 안 함.

- task: T-CONSUMABLE-LIFE-LARGE-INFO-CARDS
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/consumables/life/page.tsx
    - apps/frontend/src/app/(authenticated)/consumables/life/consumable-life-large-info-cards.structure.test.mjs
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/ARCHIVE.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 KST
  expires: 2026-06-17 KST
  status: released
  note: `/consumables/life` 상단 정보카드를 작은 배지에서 큰 요약 카드로 변경 완료. 구조 테스트/FE tsc/diff check/3002 HTTP 200 확인. Playwright require 불가로 DOM 자동 검증은 생략. commit/push 안 함.

- task: T-CONSUMABLE-LABEL-ONE-LINE-STATUS
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/consumables/label/page.tsx
    - apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-issue-feedback.structure.test.mjs
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/ARCHIVE.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 KST
  expires: 2026-06-17 KST
  status: released
  note: `/consumables/label` UID 발행 상태 UI를 별도 배너 없이 헤더 한 줄 상태로 축소하고 그리드 상단 카테고리 고정 필터 추가 완료. 구조 테스트/FE tsc/diff check 통과. commit/push 안 함.

- task: T-CONSUMABLE-LABEL-HIDDEN-IFRAME-PRINT
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/consumables/label/page.tsx
    - apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-issue-feedback.structure.test.mjs
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/ARCHIVE.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 KST
  expires: 2026-06-17 KST
  status: released
  note: `/consumables/label` UID 발행 출력 UX를 새 탭 대신 숨김 iframe 인쇄로 전환 완료. 3014 mock 브라우저에서 window.open 0회, 숨김 iframe 0x0, iframe print 1회 확인. commit/push 안 함.

- task: T-CONSUMABLE-LABEL-ACTUAL-PRINT
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/consumables/label/page.tsx
    - apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-issue-feedback.structure.test.mjs
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/ARCHIVE.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 KST
  expires: 2026-06-17 KST
  status: released
  note: `/consumables/label` UID 발행 시 실제 인쇄창이 클릭 즉시 열리도록 보정 완료. API 완료 전 window.open 확인, 실제 API 발행 C26061700019 출력 HTML window.print 확인 후 DB cleanup 잔여 0. commit/push 안 함.

- task: T-CONSUMABLE-LABEL-503-FEEDBACK
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/consumables/label/components/useConLabelIssue.ts
    - apps/frontend/src/app/(authenticated)/consumables/label/components/useConLabelIssue.structure.test.mjs
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/ARCHIVE.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 KST
  expires: 2026-06-17 KST
  status: released
  note: `/consumables/label` UID 발행 API 실패 시 AxiosError 콘솔 overlay 대신 서버 메시지를 화면 피드백으로 처리하도록 보정 완료. 503 mock 브라우저 검증, FE tsc, 구조 테스트 통과. commit/push 안 함.

- task: T-CONSUMABLE-LABEL-ISSUE-FEEDBACK
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/consumables/label/page.tsx
    - apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-issue-feedback.structure.test.mjs
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/ARCHIVE.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 KST
  expires: 2026-06-17 KST
  status: released
  note: `/consumables/label` UID 발행 시 발행중/출력중/완료/실패 toast와 화면 배너를 표시하도록 보정 완료. 성공 후 발행 UID를 즉시 지우지 않아 결과 확인 가능. 구조 테스트/FE tsc/mock 브라우저/실제 API+DB 발행 후 cleanup 검증 완료.

- task: T-WI-FILE-URL-RELATIVE-FIX
  owner: claude
  files:
    - apps/frontend/src/app/(authenticated)/production/input-kiosk/components/WorkInstructionView.tsx
    - apps/frontend/src/app/(authenticated)/master/work-instruction/components/WorkInstructionPreviewPanel.tsx
    - .github/workflows/deploy.yml
    - .ai-coordination/LOCKS.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 KST
  expires: 2026-06-17 KST
  status: released
  note: 작업지도서 파일링크 2건 수정 — (1)src 절대URL→상대경로(b5f6fa77 배포완료, URL 정상화) (2)배포 서버 404 원인=uploads gitignore+seed생성단계 누락→deploy.yml에 work-instruction 생성 스크립트 추가(커밋/배포 대기). push는 사용자 지시 대기.

- task: T-PROGRESS-PROCESS-EQUIP-COLUMNS
  owner: claude
  files:
    - apps/frontend/src/app/(authenticated)/production/progress/page.tsx
    - .ai-coordination/LOCKS.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 KST
  expires: 2026-06-17 KST
  status: released
  note: /production/progress 그리드에 공정·설비 컬럼 추가(기존 job-orders API, i18n 재사용) 완료. 로컬 브라우저 검증(공정=MASSY, 설비 미배정 "-"). tsc 0. 백엔드 변경 없음.

- task: T-CONSUMABLE-LABEL-TEMPLATE-SELECT-PRINT
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/consumables/label/page.tsx
    - apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-template-selection.structure.test.mjs
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/ARCHIVE.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 KST
  expires: 2026-06-17 KST
  status: released
  note: `/consumables/label` UID 발행 시 라벨디자인마스터 저장 템플릿을 선택해 출력하도록 보정 완료. 템플릿 Select 추가, 선택 템플릿 designData를 LabelPrintRenderer에 적용, 구조 테스트/FE tsc/3013 브라우저 실제 UID 발행 인쇄 HTML 검증 통과.

- task: T-EQUIP-INSPECT-ITEM-DEPLOY-IMAGE-URL
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/master/equip-inspect-item/page.tsx
    - apps/frontend/src/app/(authenticated)/master/equip-inspect-item/equip-inspect-item-image-url.structure.test.mjs
    - apps/frontend/src/components/shared/InspectItemImage.tsx
    - .github/workflows/deploy.yml
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/ARCHIVE.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 KST
  expires: 2026-06-17 KST
  status: released
  note: `/master/equip-inspect-item` 배포 후 이미지 깨짐 보정 완료. 화면/공용 점검항목 이미지 컴포넌트에서 `/uploads/...` URL을 백엔드 base 기준으로 정규화하고, deploy workflow에서 점검항목 시드 SVG 50개를 재생성하도록 추가. 구조 테스트/FE tsc 통과.

- task: T-CONSUMABLE-LABEL-DEPLOY-IMAGE-URL
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/consumables/label/**
    - apps/frontend/src/app/(authenticated)/master/label/components/LabelDesignRenderer.tsx
    - apps/frontend/src/utils/file-url.ts
    - .github/workflows/deploy.yml
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 KST
  expires: 2026-06-17 KST
  status: released
  note: 배포 후 `/consumables/label` 이미지 링크 깨짐 보정 완료. `/uploads/...` URL을 API base 기준으로 정규화하고, gitignore된 소모품 시드 SVG 37개를 배포 시 재생성하도록 deploy workflow 보강. 구조 테스트/FE tsc 통과.

- task: T-MASTER-LABEL-UNSAVED-GUARD
  owner: claude
  files:
    - apps/frontend/src/app/(authenticated)/master/label/page.tsx
    - apps/frontend/src/app/(authenticated)/master/label/components/TemplateManager.tsx
    - apps/frontend/src/locales/{ko,en,zh,vi}.json
    - .ai-coordination/LOCKS.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 KST
  expires: 2026-06-17 KST
  status: released
  note: master/label 새로저장 취소 버튼 + 미저장 변경 시 템플릿 로드 경고(dirty 가드) 완료. 로컬 브라우저 검증(취소버튼·미저장 경고 모달·취소 시 작업유지). tsc 0. (codex 활발 영역 — 사용자 요청)

- task: T-SHIPPING-PACK-EMPTY-BOX-DELETE
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/shipping/pack/page.tsx
    - apps/frontend/src/app/(authenticated)/shipping/pack/shipping-pack-empty-box-delete.structure.test.mjs
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 KST
  expires: 2026-06-17 KST
  status: released
  note: `/shipping/pack` 빈 박스 삭제 노출, 액션 버튼 4슬롯 고정 정렬, 현재 담는 박스 모달/행 표시 강화. 구조 테스트, frontend tsc, 3002 브라우저, 빈 박스 생성/삭제 API 검증 완료.

- task: T-SHIPPING-PACK-TEXT-ACTIONS
  owner: claude
  files:
    - apps/frontend/src/app/(authenticated)/shipping/pack/page.tsx
    - apps/frontend/src/locales/{ko,en,zh,vi}.json
    - .ai-coordination/LOCKS.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 KST
  expires: 2026-06-17 KST
  status: released
  note: pack 그리드 액션을 아이콘→텍스트 버튼(제품담기/박스마감/박스재오픈/라벨재발행)으로 변경. tsc 0/JSON OK/브라우저 확인 완료.

- task: T-MATERIAL-FLOW-FE-RUNTIME
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/material/hold/page.tsx
    - tools/hanes-material-flow-frontend-runtime-qa.mjs
    - tools/hanes-material-menu-page-scenario-qa.mjs
    - docs/reports/hanes-material-flow-frontend-runtime-qa-2026-06-17/**
    - docs/reports/hanes-material-menu-scenario-qa-2026-06-17/**
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/ARCHIVE.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 KST
  expires: 2026-06-17 KST
  status: released
  note: 자재관리 24개 등록 메뉴 프론트 QA 24/24 PASS. 요청 MR2606170035 -> 출고 -> 자재재고 -> 공정재고/키오스크 플로우 PASS, JSHANES MAT_ISSUE_REQUESTS/MAT_ISSUES/WIP_MAT_TRANSACTIONS/WIP_MAT_STOCKS 정합성 확인.

- task: T-SHIPPING-PACK-SCAN-LABEL-WORKFLOW
  owner: claude
  files:
    - apps/frontend/src/app/(authenticated)/shipping/pack/page.tsx
    - apps/frontend/src/app/(authenticated)/shipping/pack/components/BoxLabelModal.tsx
    - apps/frontend/src/locales/{ko,en,zh,vi}.json
    - .ai-coordination/LOCKS.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 KST
  expires: 2026-06-17 KST
  status: released
  note: 박스생성→제품스캔→포장단위 도달시 자동 마감+박스라벨 자동출력+재발행 워크플로우 UI. 백엔드 변경 없음(기존 box API). frontend tsc 0건, JSON 4파일 검증.

- task: T-MASTER-LABEL-CUSTOM-SOURCE-FIELDS
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/master/label/**
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/ARCHIVE.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 KST
  expires: 2026-06-17 KST
  status: released
  note: 라벨 디자이너 좌측 필드 목록을 디자인별 사용자 정의 `sourceFields`로 저장/추가/수정/삭제 가능하게 전환 완료.

- task: T-KIOSK-WI-IMAGE-SEED
  owner: claude
  files:
    - tools/generate-work-instruction-seed-images.mjs
    - apps/backend/uploads/work-instructions/wi-seed-*.svg
    - apps/backend/src/migrations/2026-06-17_work_instruction_image_seed.sql
    - apps/frontend/src/app/(authenticated)/production/input-kiosk/components/WorkInstructionView.tsx
    - apps/frontend/src/app/(authenticated)/master/work-instruction/components/WorkInstructionPreviewPanel.tsx
    - WORK_INSTRUCTIONS (JSHANES 40/1000)
    - .ai-coordination/LOCKS.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 KST
  expires: 2026-06-17 KST
  status: released
  note: 작업지도서 18개 (품목,공정) 실제 SVG 슬라이드 생성+IMAGE_URL 연결(JSHANES 18건 확인). 뷰어/미리보기 isImageUrl에 svg 추가. 내 FE파일 tsc 에러 0.

- task: T-KIOSK-WI-PDF-PPSX-VIEWER
  owner: claude
  files:
    - apps/frontend/src/app/(authenticated)/production/input-kiosk/components/WorkInstructionView.tsx
    - apps/backend/src/modules/master/controllers/work-instruction.controller.ts
    - .ai-coordination/LOCKS.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 KST
  expires: 2026-06-17 KST
  status: released
  note: 키오스크 작업지도서 뷰어 이미지+PDF 인라인 + PPTX/PPSX Office Online 임베드(폴백 새탭). 업로드 필터 ppsx/pptx 허용(확장자 기반)으로 수정. 변환 없음. BE tsc 0건, 내 FE파일 에러 없음(master/label 에러는 codex WIP).

- task: T-MASTER-LABEL-BARTENDER-DESIGNER
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/master/label/**
    - apps/frontend/src/app/(authenticated)/consumables/label/**
    - apps/frontend/src/locales/ko.json
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/ARCHIVE.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 KST
  expires: 2026-06-17 KST
  status: released
  note: `/master/label` 객체 디자이너와 `/consumables/label` 저장 디자인 출력 연결 완료. 실제 UID 발행 인쇄 HTML 치환 확인 및 테스트 UID/로그/템플릿 정리 완료.

- task: T-MASTER-LABEL-DESIGN-ONLY
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/master/label/page.tsx
    - apps/frontend/src/app/(authenticated)/master/label/types.ts
    - apps/frontend/src/app/(authenticated)/master/label/master-label-design-only.structure.test.mjs
    - apps/frontend/src/locales/ko.json
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/ARCHIVE.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-17 01:55 KST
  last_seen: 2026-06-17 01:59 KST
  expires: 2026-06-17 02:35 KST
  status: released
  note: `/master/label` 모든 카테고리를 대상 조회/선택/인쇄 없이 디자인 제공 전용으로 변경 완료.

- task: T-KIOSK-INSPECT-TIME-DISPLAY
  owner: claude
  files:
    - apps/backend/src/modules/equipment/services/equip-inspect.service.ts
    - apps/backend/src/modules/equipment/services/equip-inspect.service.spec.ts
    - apps/frontend/src/app/(authenticated)/production/input-kiosk/page.tsx
    - apps/frontend/src/app/(authenticated)/production/input-kiosk/components/EquipHeader.tsx
    - .ai-coordination/LOCKS.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 KST
  expires: 2026-06-17 KST
  status: released
  note: 설비일일점검/작업자설비점검 완료 표시 옆에 점검시각(INSPECT_AT) 표시. getInspectionStatus에 inspectedAt 추가. FE/BE tsc 0건 + spec 2건 PASS. (equip-inspect.service.ts에 codex 미커밋 변경 공존 — getInspectionStatus 블록만 수정)

- task: T-KIOSK-WORK-INSTRUCTION-SEED
  owner: claude
  files:
    - apps/backend/src/migrations/2026-06-17_work_instruction_kiosk_seed.sql
    - WORK_INSTRUCTIONS (JSHANES 40/1000)
    - .ai-coordination/LOCKS.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 KST
  expires: 2026-06-17 KST
  status: released
  note: 활성 작업지시 17개 (품목,공정) 조합 작업지도서 시드(codex의 HNS02C1ABCD/ATCUT 보존). JSHANES 실행 완료, WORK_INSTRUCTIONS 활성 20건 확인.

- task: T-SYSTEM-LABEL-MENU-RENAME
  owner: codex
  files:
    - apps/frontend/src/locales/ko.json
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-17 01:50 KST
  last_seen: 2026-06-17 01:52 KST
  expires: 2026-06-17 02:10 KST
  status: released
  note: `MST_LABEL` 메뉴 labelKey `menu.master.label` 한글명을 `라벨다자인관리`로 변경 완료.

- task: T-CONSUMABLE-LABEL-PRINTLOG-PAYLOAD
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/consumables/label/components/useConLabelIssue.ts
    - apps/frontend/src/app/(authenticated)/consumables/label/components/useConLabelIssue.structure.test.mjs
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-17 01:41 KST
  last_seen: 2026-06-17 01:45 KST
  expires: 2026-06-17 02:10 KST
  status: released
  note: `/consumables/label` 인쇄이력 기록 payload의 `matUids`를 DTO 계약 `uidList`로 수정 완료.

- task: T-KIOSK-ROUTING-FLOW-DISPLAY
  owner: claude
  files:
    - apps/frontend/src/app/(authenticated)/production/input-kiosk/components/RoutingFlowBar.tsx
    - apps/frontend/src/app/(authenticated)/production/input-kiosk/page.tsx
    - apps/frontend/src/locales/{ko,en,zh,vi}.json
    - .ai-coordination/LOCKS.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 KST
  expires: 2026-06-17 KST
  status: released
  note: 작업지시 선택 시 제품 라우팅(공정순서) 중앙 상단 스텝퍼 표시. by-item API 사용. frontend tsc 0건.

- task: T-KIOSK-MATERIAL-SCAN-DECOUPLE
  owner: claude
  files:
    - apps/frontend/src/app/(authenticated)/production/input-kiosk/page.tsx
    - apps/frontend/src/app/(authenticated)/production/input-kiosk/components/MaterialListPanel.tsx
    - apps/frontend/src/locales/{ko,en,zh,vi}.json
    - .ai-coordination/LOCKS.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 KST
  expires: 2026-06-17 KST
  status: released
  note: 자재스캔을 선행 점검(설비/작업자점검)과 분리(자재목록 로딩 시 스캔 가능). 작업자추가 버튼→작업자선택 라벨 변경. frontend tsc 0건.

- task: T-CONSUMABLE-LABEL-IMAGE-PRINTLOG
  owner: codex
  files:
    - apps/backend/src/modules/consumables/services/consumable-label.service.ts
    - apps/backend/src/modules/consumables/services/consumable-label.service.spec.ts
    - apps/frontend/src/app/(authenticated)/consumables/label/components/ConLabelColumns.tsx
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-17 01:00 KST
  last_seen: 2026-06-17 01:04 KST
  expires: 2026-06-17 01:40 KST
  status: released
  note: `/consumables/label` 사진 컬럼 추가 및 라벨 발행 로그 `PRINTED_AT` null 오류 수정 완료.

- task: T-JOBORDER-PRIORITY-COLUMN-FILTER
  owner: claude
  files:
    - apps/frontend/src/app/(authenticated)/production/order/page.tsx
    - .ai-coordination/LOCKS.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 KST
  expires: 2026-06-17 KST
  status: released
  note: 작업지시 목록에 우선순위 컬럼 표시 + 설비/공정 토글 필터(클라이언트) 추가. frontend tsc 0건.

- task: T-EQUIPMENT-INSPECT-HISTORY-ACTUAL-SQL
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/equipment/inspect-history/page.tsx
    - apps/frontend/src/app/(authenticated)/equipment/inspect-history/inspect-history-actual-sql.structure.test.mjs
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-17 00:35 KST
  last_seen: 2026-06-17 00:47 KST
  expires: 2026-06-17 01:20 KST
  status: released
  note: `/equipment/inspect-history` SQL 보기의 표시용 SQL을 실제 `EquipInspectService.findAll()` 조회 테이블과 맞춰 전역 실제 SQL 캐시가 매칭되도록 수정 완료.

- task: T-FIX-SWALLOWED-EXCEPTIONS
  owner: claude
  files:
    - apps/backend/src/modules/interface/services/interface.service.ts
    - apps/backend/src/modules/master/services/vendor-barcode-mapping.service.ts
    - apps/backend/src/modules/master/controllers/equip-inspect-item-pool.controller.ts
    - apps/backend/src/modules/consumables/controllers/consumables.controller.ts
    - apps/frontend/src/app/(authenticated)/equipment/daily-inspect/components/InspectEntryPanel.tsx
    - .ai-coordination/LOCKS.md
  started: 2026-06-17 KST
  last_seen: 2026-06-17 KST
  expires: 2026-06-17 KST
  status: released
  note: 예외 삼키기 4건(BOM동기화 status전이/정규식/파일삭제/details파싱) 로깅·정합성 보강. backend tsc 0건.

- task: T-EQUIPMENT-PERIODIC-DAILY-FLOW
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/equipment/periodic-inspect/page.tsx
    - apps/frontend/src/app/(authenticated)/equipment/daily-inspect/components/EquipListPanel.tsx
    - apps/frontend/src/app/(authenticated)/equipment/daily-inspect/components/InspectEntryPanel.tsx
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-17 00:12 KST
  last_seen: 2026-06-17 00:09 KST
  expires: 2026-06-17 01:00 KST
  status: released
  note: `/equipment/periodic-inspect`를 일일점검형 대상 목록 + 항목 입력 흐름으로 통일 완료.

- task: T-EQUIPMENT-INSPECT-CARDS-REMOVE
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/equipment/inspect-history/page.tsx
    - apps/frontend/src/app/(authenticated)/equipment/periodic-inspect/page.tsx
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-17 00:02 KST
  last_seen: 2026-06-17 00:09 KST
  expires: 2026-06-17 00:30 KST
  status: released
  note: `/equipment/inspect-history`, `/equipment/periodic-inspect` 상단 정보카드 제거 완료.

- task: T-EQUIP-INSPECT-HISTORY-BLANK-ROWS
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/equipment/inspect-history/page.tsx
    - apps/backend/src/modules/equipment/services/equip-inspect.service.ts
    - apps/backend/src/modules/equipment/services/equip-inspect.service.spec.ts
    - docs/reports/equipment-inspect-history-grid-2026-06-16-after.png
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-16 23:45 KST
  last_seen: 2026-06-16 23:58 KST
  expires: 2026-06-17 00:30 KST
  status: released
  note: `/equipment/inspect-history` API가 `{ equip: {} }` 빈 행 shape를 반환하는 문제와 날짜 원문 표시를 수정하고 3002 화면 확인.

- task: T-CONSUMABLE-LIFE-STATUS-SHAPE
  owner: codex
  files:
    - apps/backend/src/modules/consumables/services/consumables.service.ts
    - apps/backend/src/modules/consumables/services/consumables.service.spec.ts
    - apps/frontend/src/app/(authenticated)/consumables/life/page.tsx
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-16 22:28 KST
  last_seen: 2026-06-16 22:48 KST
  expires: 2026-06-16 23:00 KST
  status: released
  note: `/consumables/life` 런타임 오류 원인인 life-status 카운트 객체 응답을 행 배열 응답으로 수정하고 실제 3002 화면 렌더링 확인.

- task: T-CONSUMABLE-LABEL-RESPONSE-FIX
  owner: codex
  files:
    - apps/backend/src/modules/consumables/controllers/consumable-label.controller.ts
    - apps/backend/src/modules/consumables/controllers/consumable-label.controller.structure.test.mjs
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-16 22:20 KST
  last_seen: 2026-06-16 22:24 KST
  expires: 2026-06-16 23:00 KST
  status: released
  note: `/consumables/label` 라벨 대상 조회 응답 이중 래핑 수정 및 37건 화면 표시 확인.

- task: T-FRONTEND-DELETE-CONFIRM-GUARD
  owner: codex
  files:
    - apps/frontend/src/components/master/RoutingTab.tsx
    - apps/frontend/src/components/master/ProdLineTab.tsx
    - apps/frontend/src/components/master/ProcessTab.tsx
    - apps/frontend/src/app/(authenticated)/consumables/master/components/ConsumableUsageMapPanel.tsx
    - apps/frontend/src/app/(authenticated)/consumables/master/components/ConsumableFormPanel.tsx
    - apps/frontend/src/app/(authenticated)/system/users/components/UserFormPanel.tsx
    - apps/frontend/src/app/(authenticated)/system/training/components/TrainingResultList.tsx
    - apps/frontend/src/app/(authenticated)/shipping/pallet/page.tsx
    - apps/frontend/src/app/(authenticated)/shipping/pack/page.tsx
    - apps/frontend/src/app/(authenticated)/master/equip-inspect/components/InspectItemPanel.tsx
    - apps/frontend/src/app/(authenticated)/master/equip-inspect-item/page.tsx
    - apps/frontend/src/app/(authenticated)/master/process/page.tsx
    - apps/frontend/src/app/(authenticated)/master/part/components/PartFormPanel.tsx
    - apps/frontend/src/app/(authenticated)/master/label/components/TemplateManager.tsx
    - apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcTemplatePickerModal.tsx
    - apps/frontend/src/app/(authenticated)/master/routing/components/SelfInspectConfigEditor.tsx
    - apps/frontend/src/app/(authenticated)/quality/audit/components/AuditFindingList.tsx
    - apps/frontend/src/app/(authenticated)/quality/control-plan/components/ControlPlanItemList.tsx
    - apps/frontend/src/delete-confirm-guard.structure.test.mjs
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-16 22:10 KST
  last_seen: 2026-06-16 22:21 KST
  expires: 2026-06-16 23:10 KST
  status: released
  note: 삭제 버튼 직접 API 호출 지점을 공용 `ConfirmModal` 확인 후 실행되도록 보강하고 구조 테스트/FE tsc/diff check 통과.

- task: T-CONSUMABLE-MASTER-USAGE-MAP-FIXED
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/consumables/master/page.tsx
    - apps/frontend/src/app/(authenticated)/consumables/master/components/ConsumableFormPanel.tsx
    - apps/frontend/src/app/(authenticated)/consumables/master/components/ConsumableUsageMapPanel.tsx
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-16 21:45 KST
  last_seen: 2026-06-16 21:52 KST
  expires: 2026-06-16 22:30 KST
  status: released
  note: `/consumables/master` 매핑 UI를 등록/수정 패널 내부가 아닌 항상 보이는 우측 고정 섹션으로 분리 완료.

- task: T-CONSUMABLE-MASTER-USAGE-MAP
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/consumables/master/page.tsx
    - apps/frontend/src/app/(authenticated)/consumables/master/components/ConsumableFormPanel.tsx
    - apps/backend/src/modules/consumables/**
    - apps/backend/src/entities/consumable-usage-map.entity.ts
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-16 21:29 KST
  last_seen: 2026-06-16 21:39 KST
  expires: 2026-06-16 22:30 KST
  status: released
  note: `/consumables/master` 우측 패널 내 사용매핑 섹션 추가, API/타입체크/3002 HTTP/JSHANES 잔여 검증 완료.

- task: T-ITEM-CONSUMABLE-MOVE
  owner: codex
  files:
    - apps/backend/src/migrations/2026-06-16_move_item_consumables_to_consumable_master.sql
    - ITEM_MASTERS/CONSUMABLE_MASTERS/BOM_MASTERS/MAT_LOTS/MAT_STOCKS/PROD_PLANS (JSHANES 40/1000)
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-16 21:04 KST
  last_seen: 2026-06-16 21:18 KST
  expires: 2026-06-16 22:00 KST
  status: released
  note: 사용자 확인과 JSHANES post-check 기준으로 소모품 이동 완료 확인.

- task: T-CONSUMABLE-MASTER-IMAGE-SEED
  owner: codex
  files:
    - apps/backend/uploads/consumables/*.svg
    - apps/backend/src/migrations/2026-06-16_consumable_master_image_seed.sql
    - tools/generate-consumable-master-seed-images.mjs
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-16 21:18 KST
  last_seen: 2026-06-16 21:28 KST
  expires: 2026-06-16 22:00 KST
  status: released

- task: T-CONSUMABLE-LABEL-CARDS-REMOVE
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/consumables/label/page.tsx
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-16 20:33 KST
  last_seen: 2026-06-16 20:36 KST
  expires: 2026-06-16 21:10 KST
  status: released

- task: T-CONSUMABLE-MASTER-CARDS-REMOVE
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/consumables/master/page.tsx
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-16 20:26 KST
  last_seen: 2026-06-16 20:29 KST
  expires: 2026-06-16 21:00 KST
  status: released

- task: T-EQUIP-INSPECT-ITEM-UNIT-DROPDOWN
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/master/equip-inspect-item/page.tsx
    - apps/frontend/src/app/(authenticated)/master/equip-inspect-item/equip-inspect-item-panel.structure.test.mjs
    - apps/backend/src/migrations/2026-06-16_equip_inspect_item_unit_type.sql
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-16 20:23 KST
  last_seen: 2026-06-16 20:33 KST
  expires: 2026-06-16 21:00 KST
  status: released

- task: T-EQUIP-INSPECT-ITEM-IMAGE-SEED
  owner: codex
  files:
    - apps/backend/uploads/equip-inspect-items/*.svg
    - apps/backend/src/migrations/2026-06-16_equip_inspect_item_image_seed.sql
    - tools/generate-equip-inspect-item-seed-images.mjs
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-16 19:14 KST
  last_seen: 2026-06-16 19:25 KST
  expires: 2026-06-16 20:30 KST
  status: released

- task: T-WIP-MAT-TRANS-SCREEN
  owner: claude
  files:
    - apps/frontend/src/app/(authenticated)/production/wip-material-stock/page.tsx
    - apps/frontend/src/app/(authenticated)/production/wip-material-trans/** (신규)
    - apps/backend/src/modules/inventory/inventory.controller.ts
    - apps/backend/src/modules/inventory/services/wip-mat-stock.service.ts
    - apps/frontend/src/config/menuConfig.ts
    - apps/frontend/src/locales/{ko,en,zh,vi}.json
    - apps/backend/src/migrations/2026-06-16_wip_material_trans_menu.sql
    - MENU_CATEGORY_ITEMS/ROLE_MENU_PERMISSIONS (JSHANES 40/1000)
    - .ai-coordination/LOCKS.md
  started: 2026-06-16 18:50 KST
  last_seen: 2026-06-16 19:20 KST
  expires: 2026-06-16 20:30 KST
  status: released

- task: T-EQUIP-INSPECT-ITEM-IMAGE-PANEL
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/master/equip-inspect-item/page.tsx
    - apps/frontend/src/app/(authenticated)/master/equip-inspect-item/equip-inspect-item-panel.structure.test.mjs
    - apps/backend/src/entities/equip-inspect-item-master.entity.ts
    - apps/backend/src/modules/master/dto/equip-inspect-item-pool.dto.ts
    - apps/backend/src/modules/master/services/equip-inspect-item-pool.service.ts
    - apps/backend/src/modules/master/services/equip-inspect-item-pool.service.spec.ts
    - apps/backend/src/modules/master/controllers/equip-inspect-item-pool.controller.ts
    - apps/backend/src/modules/master/controllers/equip-inspect-item-pool.controller.spec.ts
    - apps/backend/src/migrations/2026-06-16_equip_inspect_item_image_url.sql
    - apps/backend/src/migrations/2026-06-16_equip_inspect_item_missing_fields.sql
    - packages/shared/src/constants/com-code-values.ts
    - apps/frontend/src/types/equipment.ts
    - docs/reports/db-schema-erd.md
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-16 18:36 KST
  last_seen: 2026-06-16 19:00 KST
  expires: 2026-06-16 20:00 KST
  status: released

- task: T-KIOSK-CONSUMABLE-SCAN-MAPPING
  owner: claude
  files:
    - apps/backend/src/migrations/2026-06-16_consumable_lot_seed.sql
    - apps/frontend/src/app/(authenticated)/production/input-kiosk/components/ConsumableScanModal.tsx
    - apps/frontend/src/app/(authenticated)/production/input-kiosk/components/MaterialListPanel.tsx
    - apps/frontend/src/stores/kioskStore.ts
    - apps/backend/src/modules/production/** (job-consumable-lot 신규, 예정)
    - apps/frontend/src/locales/{ko,en,zh,vi}.json
    - MAT_LOTS (JSHANES 40/1000)
    - .ai-coordination/LOCKS.md
  note: 1~3단계 완료(스캔매핑+사용량누적). prod-result.service.ts는 T-MAT-ISSUE-WIP-STOCK 해제 후 수정. 백엔드 재시작 후 실동작 검증 필요.
  started: 2026-06-16 17:55 KST
  last_seen: 2026-06-16 18:45 KST
  expires: 2026-06-16 19:30 KST
  status: released

- task: T-KIOSK-EQUIP-INSPECT-MIGRATION-RERUN
  owner: codex
  files:
    - apps/backend/src/migrations/2026-06-16_equip_inspect_workday_order.sql
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-16 16:13 KST
  last_seen: 2026-06-16 16:15 KST
  expires: 2026-06-16 16:45 KST
  status: released

- task: T-KIOSK-EQUIP-INSPECT-WORKDAY-ORDER
  owner: codex
  files:
    - apps/backend/src/entities/equip-inspect-log.entity.ts
    - apps/backend/src/modules/equipment/controllers/daily-inspect.controller.ts
    - apps/backend/src/modules/equipment/controllers/daily-inspect.controller.spec.ts
    - apps/backend/src/modules/equipment/dto/equip-inspect.dto.ts
    - apps/backend/src/modules/equipment/services/equip-inspect.service.ts
    - apps/backend/src/modules/equipment/services/equip-inspect.service.spec.ts
    - apps/backend/src/modules/equipment/equipment.module.ts
    - apps/backend/src/migrations/2026-06-16_equip_inspect_workday_order.sql
    - apps/frontend/src/app/(authenticated)/production/input-kiosk/page.tsx
    - apps/frontend/src/app/(authenticated)/production/input-kiosk/components/DailyInspectModal.tsx
    - apps/frontend/src/app/(authenticated)/production/input-kiosk/components/WorkerInspectModal.tsx
    - apps/frontend/src/app/(authenticated)/production/input-kiosk/components/*inspect*.structure.test.mjs
    - docs/superpowers/plans/2026-06-16-equip-inspect-workday-order.md
    - docs/reports/db-schema-erd.md
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-16 15:31 KST
  last_seen: 2026-06-16 15:45 KST
  expires: 2026-06-16 17:30 KST
  status: released

- task: T-KIOSK-JOBORDER-PERSIST-REFRESH
  owner: codex
  files:
    - apps/frontend/src/stores/kioskStore.ts
    - apps/frontend/src/stores/kiosk-store-persist.structure.test.mjs
    - .ai-coordination/LOCKS.md
  started: 2026-06-16 17:40 KST
  last_seen: 2026-06-16 17:50 KST
  expires: 2026-06-16 18:10 KST
  status: released

- task: T-BOM-ITEM-TYPE-LABEL-FIX
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/master/bom/page.tsx
    - apps/frontend/src/app/(authenticated)/master/bom/components/BomTab.tsx
    - apps/frontend/src/app/(authenticated)/master/bom/components/BomFormModal.tsx
    - apps/frontend/src/app/(authenticated)/master/bom/bom-item-type-label.structure.test.mjs
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-16 17:05 KST
  last_seen: 2026-06-16 17:30 KST
  expires: 2026-06-16 17:45 KST
  status: released

- task: T-KIOSK-DAILY-INSPECT-EMPTY-GUIDE
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/production/input-kiosk/components/DailyInspectModal.tsx
    - apps/frontend/src/app/(authenticated)/production/input-kiosk/components/daily-inspect-modal.structure.test.mjs
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-16 16:40 KST
  last_seen: 2026-06-16 16:50 KST
  expires: 2026-06-16 17:20 KST
  status: released

- task: T-MAT-ISSUE-WIP-STOCK
  owner: claude
  files:
    - apps/backend/src/entities/warehouse.entity.ts
    - apps/backend/src/modules/inventory/services/warehouse.service.ts
    - apps/backend/src/modules/material/services/mat-issue.service.ts
    - apps/backend/src/modules/production/services/auto-issue.service.ts
    - apps/backend/src/modules/production/services/prod-result.service.ts
    - apps/backend/src/modules/material/services/issue-request.service.ts
    - apps/backend/src/migrations/2026-06-16_warehouse_equip_code.sql
    - apps/backend/src/migrations/2026-06-16_equip_wip_warehouse_seed.sql
    - apps/frontend/src/app/(authenticated)/material/stock/page.tsx
    - apps/frontend/src/app/(authenticated)/inventory/transaction/page.tsx
    - apps/frontend/src/app/(authenticated)/production/wip-material-stock/** (신규)
    - apps/frontend/src/config/menuConfig.ts
    - apps/frontend/src/locales/{ko,en,zh,vi}.json
    - WAREHOUSES/MAT_STOCKS/STOCK_TRANSACTIONS (JSHANES 40/1000)
    - .ai-coordination/LOCKS.md
  started: 2026-06-16 16:30 KST
  last_seen: 2026-06-16 18:30 KST
  expires: 2026-06-16 19:00 KST
  status: released

- task: T-KIOSK-WORKER-INSPECT-EMPTY-FIX
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/production/input-kiosk/components/WorkerInspectModal.tsx
    - apps/frontend/src/app/(authenticated)/production/input-kiosk/components/EquipHeader.tsx
    - apps/frontend/src/app/(authenticated)/production/input-kiosk/utils/equipOptions.ts
    - apps/frontend/src/stores/kioskStore.ts
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-16 15:20 KST
  last_seen: 2026-06-16 15:45 KST
  expires: 2026-06-16 16:20 KST
  status: released
- task: T-MAT-FLOW-COHERENCE-FIX
  owner: codex
  files:
    - apps/backend/src/modules/material/services/arrival.service.ts
    - apps/backend/src/modules/material/services/arrival.service.spec.ts
    - apps/backend/src/migrations/2026-06-16_repair_mat_flow_audit_gaps.sql
    - apps/frontend/src/app/(authenticated)/material/arrival/components/ManualArrivalModal.tsx
    - apps/frontend/src/app/(authenticated)/material/arrival/components/PoArrivalModal.tsx
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-16 13:39 KST
  last_seen: 2026-06-16 13:50 KST
  expires: 2026-06-16 15:00 KST
  status: released

- task: T-MAT-ARRIVAL-TRANSACTION-MENU
  owner: codex
  files:
    - apps/frontend/src/config/menuConfig.ts
    - apps/frontend/src/locales/{ko,en,zh,vi}.json
    - apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts
    - apps/backend/src/migrations/2026-06-16_add_arrival_transaction_menu.sql
    - MENU_CATEGORY_ITEMS (JSHANES 40/1000)
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-16 14:05 KST
  last_seen: 2026-06-16 14:35 KST
  expires: 2026-06-16 15:30 KST
  status: released

- task: T-MAT-ARRIVAL-TRANSACTION-PAGE
  owner: codex
  files:
    - apps/frontend/src/app/(authenticated)/material/arrival-transaction/page.tsx
    - apps/backend/src/modules/material/dto/arrival.dto.ts
    - apps/backend/src/modules/material/services/arrival.service.ts
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-16 13:40 KST
  last_seen: 2026-06-16 13:55 KST
  expires: 2026-06-16 15:00 KST
  status: released

- task: T-MAT-ARRIVAL-STOCK-SPLIT
  owner: codex
  files:
    - docs/reports/hanes-mat-arrival-stock-split-migration-2026-06-16.md
    - apps/backend/src/migrations/2026-06-16_mat_arrival_stock_split.sql
    - docs/superpowers/plans/2026-06-16-mat-arrival-stock-split.md
    - .ai-coordination/TASKS.md
    - .ai-coordination/LOCKS.md
    - .ai-coordination/JOURNAL.md
    - .ai-coordination/HANDOFF/codex.md
  started: 2026-06-16 11:45 KST
  last_seen: 2026-06-16 13:10 KST
  expires: 2026-06-16 13:30 KST
  status: released

- task: T-DOCS-KNOWLEDGE-WIKI
  owner: claude
  files:
    - wiki/** (신규 디렉토리 — docs/는 읽기 전용으로만 사용)
    - .ai-coordination/LOCKS.md
  started: 2026-06-12 01:32 KST
  last_seen: 2026-06-12 01:32 KST
  expires: 2026-06-12 03:30 KST
  status: stale

```

## History

- T-KIOSK-JOBORDER-PERSIST-REFRESH (codex, 2026-06-16): `/production/input-kiosk` 브라우저 새로고침 시 선택된 작업지시가 사라지는 문제 수정. 원인은 `harness-kiosk` Zustand persist `partialize`가 `selectedJobOrder`를 제외한 것. `selectedJobOrder`를 persist 대상에 포함하고 구조 테스트/FE tsc 통과. 파일: `apps/frontend/src/stores/{kioskStore.ts,kiosk-store-persist.structure.test.mjs}`.

- T-KIOSK-BOM-CONSUMABLE-IN-EQUIP-SECTION (claude, 2026-06-16): 생산실적 키오스크 좌측 하단 `소모성 설비 부품` 섹션이 설비 장착 소모품(CONSUMABLE_MASTERS, `/equipment/consumables/mounted`)을 보여주던 것을, 작업지시 제품 BOM의 소모품(`ITEM_TYPE='CONSUMABLE'`, 예 HNS02C2ABCDE→CUTBL003 커터날3)을 장착 상태로 표시하도록 전환. 사용자 의도: 설비 구성 소모품과 제품생산 투입 소모품은 별개이며, 키오스크에는 BOM을 원자재(자재리스트)/소모품(소모성 설비부품)으로 분리 표현. MaterialListPanel이 BOM(`/master/boms/parent/{itemCode}`) 응답을 `filterBomMaterials`(원자재)·`filterBomConsumables`(소모품)로 분리하고, 설비 기준 useEffect·설비소모품 수명UI(lifeBar 등) 제거. 하단 섹션은 품목코드/소요수량/품목명 + `장착됨` 표시. i18n 4종 `kiosk.material.mounted` add-only. frontend tsc 통과. 파일: `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/MaterialListPanel.tsx`, `apps/frontend/src/locales/{ko,en,zh,vi}.json`.
- T-BOM-ITEM-TYPE-LABEL-FIX (codex, 2026-06-16): `/master/bom` 품목유형 표시가 `FINISHED/SEMI_PRODUCT/RAW_MATERIAL/CONSUMABLE` 원 코드로 보이던 문제 수정. BOM API/DB는 `ITEM_MASTERS.ITEM_TYPE` 같은 컬럼을 쓰며, 프론트 부모 목록/트리/범례/자품목 선택 힌트에서 `comCode.ITEM_TYPE` 한글 라벨로 변환. 구조 테스트, frontend tsc, API/Oracle/브라우저 3012 실측 통과. 파일: `apps/frontend/src/app/(authenticated)/master/bom/{page.tsx,bom-item-type-label.structure.test.mjs,components/BomTab.tsx,components/BomFormModal.tsx}`.
- T-CLEANUP-VNHNS-STRAGGLERS (claude, 2026-06-16): 폐기 플랜트 VNHNS 잔재 데이터 제거. /quality/change-control가 정본 1000 스코프라 CHANGE_ORDERS 6건(전부 PLANT=VNHNS)이 안 보이던 것이 발단. 전수 조사 결과 IATF 신규 모듈 4개 테이블에만 VNHNS 잔재 존재(CALIBRATION_LOGS 12, GAUGE_MASTERS 10, MOLD_USAGE_LOGS 10, CHANGE_ORDERS 6 = 38행), FK 제약 없음 확인 후 DELETE. 해당 4테이블은 1000 데이터가 원래 0이라 삭제 후 빈 테이블(보존 대상 없음). VNHNS 0 확정. 파일: `apps/backend/src/migrations/2026-06-16_cleanup_vnhns_stragglers.sql`.
- T-KIOSK-BOM-CONSUMABLE-FILTER (claude, 2026-06-16): 생산실적 키오스크 자재리스트에 소모품(ITEM_TYPE='CONSUMABLE')이 투입자재처럼 노출되던 버그 수정. 원인은 BOM 자재리스트/자재 스캔이 `/master/boms/parent/{code}` 응답을 품목유형 구분 없이 그대로 사용한 것(예: HNS02C2ABCDE BOM에 CUTBL003=CONSUMABLE이 SEQ2로 등재). BOM API 응답의 `childPart.itemType` 기준으로 CONSUMABLE을 거르는 공통 함수 `filterBomMaterials()`를 MaterialListPanel에 추가하고, BOM을 로드하는 두 지점(MaterialListPanel, MaterialScanModal)에 적용. 서버 scanAndRegister는 클라가 보낸 bomItems로만 매칭하므로 클라 필터로 표시·롯트스캔·인터락 모두 일관 정리됨. frontend tsc 통과. 파일: `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/{MaterialListPanel,MaterialScanModal}.tsx`.
- T-COMCODE-I18N-DEADKEY-CLEANUP (claude, 2026-06-16): T-COMCODE-SEMANTIC-FIX DB 정정의 후속으로, 표시 미사용 i18n dead 키 3종을 4개 locale에서 제거. `comCode.ARRIVAL_PO_TYPE`(PO만)·`comCode.ARRIVAL_RESULT_STATUS`(DONE만)는 그룹째 삭제, `comCode.RECEIVE_STATUS.DONE`만 제거(나머지 4코드 보존). 각 locale -3키, JSON 유효성 검증. 파일: `apps/frontend/src/locales/{ko,en,zh,vi}.json`, `tools/cleanup-comcode-i18n-deadkeys.mjs`.
- T-MENU-MERGE-MATERIAL (claude, 2026-06-16): 좌측 메뉴 `자재수불관리(MATERIAL)` + `자재재고관리(INVENTORY)` 2개 카테고리를 `자재관리`(MATERIAL, 라벨 `menu.materialMgmt`) 하나로 통합. menuConfig.ts 두 블록 병합(INVENTORY 7개 leaf를 MATERIAL 뒤로, Warehouse import 제거), i18n 4종에 `menu.materialMgmt` add-only(자재관리/Material Management/物料管理/Quản lý vật tư), 시드 재생성(gen-menu-category-seed.js, 카테고리 20→19). RBAC(ROLE_MENU_PERMISSIONS)는 leaf 코드만 저장 → 권한 영향 없음. Live DB(JSHANES 40/1000)는 운영 커스터마이징 보존 위해 menuConfig 덮어쓰기 대신 INVENTORY→MATERIAL 이관 마이그레이션만 적용(MATERIAL 16→23개 항목, INVENTORY 카테고리 삭제, 고아 0). 프론트 tsc 통과. 파일: `apps/frontend/src/config/menuConfig.ts`, `apps/frontend/src/locales/{ko,en,zh,vi}.json`, `scripts/2026-05-18_seed_menu_categories.sql`, `apps/backend/src/migrations/2026-06-16_merge_material_inventory_menu.sql`.
- T-COMCODE-SEMANTIC-FIX (claude, 2026-06-16): 의미 확인 2건 정리. 코드 실측 결과 직전 추가한 3개 코드가 전부 잘못된 컬럼 매핑(false positive)으로 확인되어 DB COM_CODES에서 제거: `ARRIVAL_PO_TYPE.PO`(배지는 poType=RM/CM, ARRIVAL_TYPE와 혼동), `ARRIVAL_RESULT_STATUS.DONE`·`RECEIVE_STATUS.DONE`(배지는 파생/IQC흐름 상태만 표시, 영속 DONE 미노출). 그룹이 원래 정확한 집합으로 복원(RM,CM / ARRIVED,IQC_PROGRESS,IQC_DONE,RECEIVED,CANCELED / PENDING,IQC_IN_PROGRESS,PASSED,FAILED), 배지값 100% 커버 확인. 잔여: 동일 3개 i18n dead 키(무해, 표시 미사용)는 locales 파일 타 lock(T-MENU-MERGE-MATERIAL) 해제 후 제거 예정. 변경: JSHANES COM_CODES 3행 DELETE.
- T-COMCODE-I18N-LABELS (claude, 2026-06-16): T-COMCODE-ALIGNMENT-FULL 신규/추가 공통코드의 ko/en/zh/vi 라벨을 4개 locale `comCode` 블록에 add-only 딥머지(기존 키 보존). 25개 신규 그룹 전체 코드 + 유형A 6개 신규 코드, 각 locale +84키(총 336). 머지 도구 `tools/merge-comcode-i18n.mjs` 추가, JSON 유효성·라벨 4종 검증. 파일: `apps/frontend/src/locales/{ko,en,zh,vi}.json`, `tools/merge-comcode-i18n.mjs`.
- T-COMCODE-ALIGNMENT-FULL (claude, 2026-06-16): 공통코드↔실데이터 전수 점검(병렬 에이전트 2개) 후 전면 정합화. 유형A(기존 그룹 값 누락) 6건 값추가(EQUIP_STATUS+INTERLOCK, ISSUE_STATUS+APPROVED, PARTNER_TYPE+MFG, RECEIVE_STATUS+DONE, ARRIVAL_RESULT_STATUS+DONE, ARRIVAL_PO_TYPE+PO), 유형B/D(그룹 부재) 25개 그룹 신설(CHANGE/CAL/PROD_PLAN/MOLD_TYPE/CONSUMABLE_OPER·LIFE/PRODUCT_HOLD/CAPA/COMPLAINT/DOC/CP/OQC/SHIP_ORDER/INSPECT_CHECK/INSPECT_JUDGE 등), 유형C(프론트 groupCode 오타) 2건 수정(CON_CATEGORY→CONSUMABLE_CATEGORY, JOB_STATUS→JOB_ORDER_STATUS). MERGE 시드(40/1000), 12개 컬럼 그룹밖값 0 + 프론트 tsc 검증. 잔여: 신규 그룹 en/zh/vi i18n 라벨(현재 한글 fallback). 파일: `apps/backend/src/migrations/2026-06-16_comcode_alignment_full.sql`, `apps/frontend/src/components/consumables/BarcodeScanPanel.tsx`, `apps/frontend/src/app/(authenticated)/inspection/result/components/InspectionResultWorkflow.tsx`.
- T-MAT-ARRIVAL-STOCK-SPLIT (codex, 2026-06-16): Task 1 dry-run에서 `NEGATIVE_PENDING` 23건 및 `MAT_STOCKS` 차감 불가 1건 발견으로 BLOCKED 전환, lock 해제. 파일: `docs/reports/hanes-mat-arrival-stock-split-migration-2026-06-16.md`.
- T-MAT-ARRIVAL-STOCK-SPLIT (codex, 2026-06-16): 사용자 보정 승인 후 A안 적용 완료. `MAT_ARRIVAL_STOCKS`, `MAT_ARRIVAL_TRANSACTIONS` 생성 및 `STOCK_TRANSACTIONS.MAT_IN/MAT_IN_CANCEL` 57건 백업/이관/삭제, 현재 입하재고 35건/6,020 생성. 백엔드/프론트 빌드와 핵심 단위 테스트 통과 후 lock 해제.
- T-PROCESS-CATEGORY-COMCODE (claude, 2026-06-16): 공정대분류 드롭다운 하드코딩(ASSY/INSP/CUTTING/WELDING/PACKING)↔실데이터(WIRE/TERMINAL/ASSEMBLY/INSPECTION/HEAT) 불일치 해소. PROCESS_CATEGORY 공통코드 그룹 신설(전선/단자/조립/검사/열처리), process page.tsx·ProcessList.tsx를 `useComCodeOptions("PROCESS_CATEGORY")`로 전환하고 목록 배지를 ComCodeBadge로 통일, shared 코드그룹 enum/values 추가. JSHANES 시드+드롭다운 API 5종 확인, 수정모달 공정유형(압착)·공정대분류(단자) 정상 선택 브라우저 검증, shared/frontend tsc 통과. 파일: `apps/backend/src/migrations/2026-06-16_process_category_comcode.sql`, `apps/frontend/src/app/(authenticated)/master/process/{page.tsx,components/ProcessList.tsx}`, `packages/shared/src/{types/com-code.ts,constants/com-code-values.ts}`.
- T-PROCESS-CATEGORY-FILL (claude, 2026-06-16): `/master/process` 공정대분류(PROCESS_CATEGORY) NULL 2건(CRMPB→TERMINAL, MTASY→ASSEMBLY) 형제 공정 관례대로 보완. 수정 모달 공정유형 드롭다운 정상 표시(압착) 브라우저 확인. 별도 보고: 공정대분류 모달 드롭다운이 하드코딩(ASSY/INSP/CUTTING/WELDING/PACKING)이라 실데이터(WIRE/TERMINAL/ASSEMBLY/INSPECTION/HEAT)와 불일치 — 추후 정렬 필요. 파일: `apps/backend/src/migrations/2026-06-16_process_category_fill.sql`.
- T-PROCESS-TYPE-CODE-REMAP (claude, 2026-06-16): `/master/process` 공정유형이 공통코드 그룹에 없는 `PRODUCTION`(20건)으로 저장돼 배지 raw 표시·수정 드롭다운 선택 불가하던 문제 해결. PROCESS_TYPE 공통코드에 누락 4종(STRIPPING 탈피/WELDING 융착/HEAT 열처리/SHIELD 편조제거) 추가, PROCESS_MASTERS 22개 공정을 실제 유형으로 재분류(절단3·탈피2·압착5·융착1·편조제거1·열처리1·조립5·검사4). JSHANES 적용·드롭다운 API 9종/매핑 0누락 검증, 공유상수 `PROCESS_TYPE_VALUES` 동기화, shared tsc 통과. 파일: `apps/backend/src/migrations/2026-06-16_process_type_codes_remap.sql`, `packages/shared/src/constants/com-code-values.ts`.
- T-MULTI-CATEGORY-MENU-PAGE-SCENARIO-QA (codex, 2026-06-16): 좌측 등록 메뉴 중 자재재고관리/생산관리/품질관리/검사관리/제품수불관리/설비관리/출하관리 50개 하위 메뉴 상세 QA 완료, 생산실적/박스 검색 API 계약 보정 후 50/50 PASS로 lock 해제. 파일: `tools/hanes-registered-categories-page-scenario-qa.mjs`, `apps/backend/src/modules/production/{dto/prod-result.dto.ts,services/prod-result.service.ts}`, `apps/backend/src/modules/shipping/{dto/box.dto.ts,services/box.service.ts}`, `docs/reports/hanes-registered-categories-scenario-qa-2026-06-16/**`.

- T-MATERIAL-MENU-PAGE-SCENARIO-QA (codex, 2026-06-15): 좌측 `자재수불관리` 실제 등록 하위 메뉴 16개를 `/api/v1/menu-categories/tree` 기준으로 상세 시나리오 QA, 페이지별 HTML/JSON/스크린샷 및 목차 생성 후 16/16 PASS로 lock 해제. 파일: `tools/hanes-material-menu-page-scenario-qa.mjs`, `docs/reports/hanes-material-menu-scenario-qa-2026-06-15/**`.

- T-JOBORDER-EQUIP-EMPTY-HINT (claude, 2026-06-15): 작업지시 생성/수정 폼에서 선택한 공정에 매핑된 설비가 없을 때(예: CRMPB 양단압착) 설비 드롭다운 아래 안내 문구 표시. `JobOrderFormPanel`에 `useEquipOptions(processCode)`로 빈 설비 감지 + i18n `production.order.noEquipForProcess`(ko/en/zh/vi) 추가. 프론트 tsc·JSON 파싱 통과 후 lock 해제. 파일: `apps/frontend/src/app/(authenticated)/production/order/components/JobOrderFormPanel.tsx`, `apps/frontend/src/locales/{ko,en,zh,vi}.json`.

- T-MASTER-REPORT-SEARCH-DUPLICATE-FIX (codex, 2026-06-15): 기준정보 잔여 19개 페이지 `HNS02` 검색어 하드코딩 제거 및 공통 중복방어 단계/증적 추가, CRUD 134/134 PASS 후 lock 해제. 파일: `tools/hanes-master-crud-runtime-test.mjs`, `tools/hanes-master-remaining-page-scenario-qa.mjs`, `apps/backend/src/modules/master/services/{process,iqc-item,label-template,work-instruction,equip-bom}.service.ts`, 해당 spec, `docs/reports/hanes-page-scenario-qa-2026-06-15/**`.

- T-MASTER-EQUIP-REPORT-EVIDENCE-FIX (codex, 2026-06-15): `/master/equip` QA 보고서 STEP 05 증적이 이전 검색 필터 화면으로 남는 문제를 보정하고 기준정보 잔여 19개 화면 보고서를 재생성 후 lock 해제. 파일: `tools/hanes-master-remaining-page-scenario-qa.mjs`, `docs/reports/hanes-page-scenario-qa-2026-06-15/**`.

- T-MASTER-REMAINING-PAGE-SCENARIO-QA (codex, 2026-06-15): 기준정보 잔여 19개 화면을 페이지 단위 상세 시나리오로 테스트해 모두 PASS 처리, 기존 품목/BOM 포함 기준정보 21개 페이지 목차+개별 HTML 보고서 생성 후 lock 해제. 파일: `tools/hanes-master-remaining-page-scenario-qa.mjs`, `docs/reports/hanes-page-scenario-qa-2026-06-15/**`.

- T-MASTER-BOM-PAGE-SCENARIO-QA (codex, 2026-06-15): `/master/bom` BOM관리 화면을 페이지 단위 상세 시나리오로 테스트해 조회/검색/폼다운로드/엑셀업로드모달/내보내기/신규/중복방어/수정/라우팅패널/삭제/API/DB/재조회 13단계 PASS 및 목차+페이지 HTML 보고서 생성 후 lock 해제. 파일: `tools/hanes-master-bom-page-scenario-qa.mjs`, `docs/reports/hanes-page-scenario-qa-2026-06-15/**`.

- T-JOBORDER-EQUIP-UPDATE-FIX (claude, 2026-06-15): 작업지시 수정 시 설비(equipCode)·공정(processCode)이 저장되지 않던 버그 수정. `JobOrderService.update()`가 두 필드를 updateData에 반영하도록 추가하고 `JOB_ORDER_SELECT` 응답에도 포함. 생성 경로는 정상(API 실측 확인), 누락은 update 경로 한정이었음. JSHANES 실데이터로 create+update 검증 후 테스트 데이터 정리, 백엔드 tsc 통과, lock 해제. 파일: `apps/backend/src/modules/production/services/job-order.service.ts`.

- T-MASTER-PART-PAGE-SCENARIO-QA (codex, 2026-06-15): `/master/part` 품목관리 화면을 페이지 단위 상세 시나리오로 테스트해 조회/검색/신규/수정/삭제/API/DB/재조회 10단계 PASS 및 목차+페이지 HTML 보고서 생성 후 lock 해제. 파일: `tools/hanes-master-part-page-scenario-qa.mjs`, `docs/reports/hanes-page-scenario-qa-2026-06-15/**`.
- T-MENU-QA-DETAIL-REPORT (codex, 2026-06-15): 좌측 메뉴 QA 최종 PASS HTML을 96개 메뉴별 상세 절차/확인 기준/화면 증적 섹션으로 재생성하고 생성 스크립트 추가 후 lock 해제. 파일: `docs/reports/ui-test-crud-red-menu-qa-2026-06-15.html`, `tools/generate-menu-qa-detailed-report.mjs`.
- T-JOBORDER-AUTOEXPLODE-DEFAULT (claude, 2026-06-15): `/production/order` 작업지시 BOM 자동전개를 기본 ON으로 변경(백엔드 `autoCreateChildren !== false`, 프론트 체크박스 기본 checked). 더불어 생산계획 발행(`prod-plan.service.createChildOrdersFromPlanRecursive`)의 동일한 `depth>=5` 깊이 버그도 순환참조 가드+깊이 백스톱 50으로 동일 수정. 백엔드/프론트 tsc 통과 후 lock 해제. 파일: `apps/backend/src/modules/production/services/{job-order.service.ts,prod-plan.service.ts}`, `apps/frontend/src/app/(authenticated)/production/order/components/JobOrderFormPanel.tsx`.
- T-UI-CRUD-RED-MENU-QA (codex, 2026-06-15): 좌측 메뉴 노출 화면 96개 실제 브라우저 순회 QA 및 최종 PASS HTML 보고서 작성 후 lock 해제. 파일: `C:\Users\hsyou\.codex\skills\ui-test-crud-red\scripts\ui-test-menu-success-runner.mjs`, `docs/reports/ui-test-crud-red-menu-qa-2026-06-15*`, `apps/backend/src/modules/production/services/production-views.service.ts`, `apps/backend/src/modules/production/services/production-views.service.spec.ts`, `apps/frontend/src/app/(authenticated)/system/config/page.tsx`.
- T-JOBORDER-BOM-FULL-EXPLODE (claude, 2026-06-15): 작업지시 BOM 자동전개의 `depth>=5` 깊이 제한을 제거해 하위 레벨 관계없이 전 계층 반제품 작업지시를 생성하도록 변경. 무한루프는 BOM 순환참조 가드(조상 경로 추적)+깊이 백스톱 50으로 차단. HNS02(8단계) 기준 기존 누락분(`HNS02-SCA_1/_2`, `HNS02C1ABC/ABCD`, `HNS02C2ABC/ABCD/ABCDE` 등) 해소. 백엔드 tsc 통과 후 lock 해제. 파일: `apps/backend/src/modules/production/services/job-order.service.ts`.
- T-SQL-ACTUAL-GLOBAL (codex, 2026-06-13): TypeORM logger/request SQL context/global interceptor와 프론트 Axios SQL cache를 추가해 모든 `DataGrid.sqlQuery` 모달이 실제 실행 SQL을 우선 표시하도록 변경 후 lock 해제. 파일: `apps/backend/src/common/sql-debug/**`, `apps/backend/src/common/interceptors/sql-debug.interceptor.ts`, `apps/backend/src/database/database.module.ts`, `apps/backend/src/main.ts`, `apps/frontend/src/services/api.ts`, `apps/frontend/src/components/data-grid/SqlViewerModal.tsx`, `apps/frontend/src/components/data-grid/sql-viewer-actual-sql.structure.test.mjs`.
- T-SQL-SCHEMA-TOGGLE (codex, 2026-06-13): 공통 SQL 조회문 모달에 `컬럼명세 보기/숨기기` 토글을 추가해 모든 `DataGrid.sqlQuery` 사용 페이지에 적용 후 lock 해제. 파일: `apps/frontend/src/components/data-grid/SqlViewerModal.tsx`, `apps/frontend/src/components/data-grid/sql-viewer-modal.structure.test.mjs`.
- T-IQC-SQL-DISPLAY (codex, 2026-06-13): `/material/iqc` SQL 조회문을 백엔드 실제 QueryBuilder SQL/parameters 기반으로 표시하도록 변경 후 lock 해제. 파일: `apps/backend/src/modules/material/{controllers/iqc-history.controller.ts,services/iqc-history.service.ts,services/iqc-history.service.spec.ts}`, `apps/frontend/src/app/(authenticated)/material/iqc/page.tsx`, `apps/frontend/src/hooks/material/useIqcData.ts`, `apps/frontend/src/components/material/IqcTable.tsx`.
- T-QC-SAMPLE-MENU-LABEL (codex, 2026-06-12): 품질검사 하위 `QC_SELF_INSPECT_HISTORY` 좌측 메뉴 한글 라벨을 `공정샘풀검사`로 변경하고 `ko.json` 파싱 검증 후 lock 해제. 파일: `apps/frontend/src/locales/ko.json`.
- T-MASTER-FE-QA (codex, 2026-06-12): 기준정보 `/master/*` 프론트엔드 21개 하위 메뉴를 Playwright로 실제 접속/검색/추가폼 비파괴 상호작용/캡처 검증 완료. 최종 실행 21/21 성공, 캡처 60개, HTML 보고서 작성 후 lock 해제. 파일: `tools/hanes-master-frontend-qa.mjs`, `docs/reports/hanes-master-frontend-qa-2026-06-12.html`, `docs/reports/hanes-master-frontend-qa-2026-06-12/result.json`.
- T-IQC-SERIAL3-RUNTIME (codex, 2026-06-12): 수입검사 절차대로 실제 API/JSHANES에서 시리얼 3개 생성, IQC PASS, 검사성적서 업로드, 입고, 재고 반영까지 검증하고 기록을 남긴 뒤 lock 해제. 파일: `tools/hanes-iqc-serial3-runtime-test.mjs`, `docs/reports/hanes-iqc-serial3-runtime-test-2026-06-12.md`, `docs/reports/hanes-iqc-serial3-runtime-test-26061203191605.json`.
- T-MASTER-CRUD-RUNTIME (codex, 2026-06-12): 기준정보 화면/API CRUD 101단계 실데이터 점검 완료. `tools/hanes-master-crud-runtime-test.mjs` 추가, 최종 실행 `26061202474131` 기준 API 101/101 성공, cleanup 30/30 성공, JSHANES 32개 관련 테이블 잔여 0건 확인 후 lock 해제. 파일: `docs/reports/hanes-master-crud-runtime-test-2026-06-12.md`, `docs/reports/hanes-master-crud-runtime-test-26061202474131.json`, `tools/hanes-master-crud-runtime-test.mjs`.
- T-INTEGRATION-NORMAL-REVERSE (codex, 2026-06-12): HNS02 정상/역처리 통합 재테스트 완료. 박스 단건 출하 취소 API 추가, 정상 출하/출하 취소/삭제 가능 데이터 삭제/작업지시·생산실적·자재출고 취소를 JSHANES 실데이터로 검증하고 보고서 작성 후 lock 해제. 파일: `docs/reports/hanes-integration-normal-reverse-test-2026-06-12.md`, `tools/hns02-normal-reverse-runtime-test.mjs`, `apps/backend/src/modules/shipping/{controllers/ship-order.controller.ts,services/ship-order.service.ts,services/ship-order.service.spec.ts}`.
- T-INTEGRATION-FLOW-ISSUES-FIX (codex, 2026-06-12): 최종보고서 등록 문제점 3건(제품라벨/FG_LABELS, 제품라벨 sourceId 계약, WIP 잔량)을 수정하고 `JO-FIX-105908` 재테스트로 정상 처리 확인 후 lock 해제. 파일: `docs/reports/hanes-integration-flow-test-2026-06-12.md`, `apps/backend/src/modules/production/{dto/product-label.dto.ts,services/product-label.service.ts,services/product-label.service.spec.ts}`, `apps/backend/src/modules/inventory/{inventory.controller.ts,services/product-inventory.service.ts,services/product-inventory.service.spec.ts}`, `apps/backend/src/modules/shipping/services/{box.service.ts,box.service.spec.ts}`.
- T-INTEGRATION-FLOW-REPORT (codex, 2026-06-12): HNS02 기준 PO→입하→IQC→PDA 입고→재고→작업지시→자재요청/출고→생산실적→제품입고→제품포장→OQC→출하지시→출하 처리 통합 테스트 보고서 작성 및 shipBox 시리얼별 제품재고 차감 결함 수정 후 lock 해제. 파일: `docs/reports/hanes-integration-flow-test-2026-06-12.md`, `apps/backend/src/modules/shipping/services/ship-order.service.ts`, `apps/backend/src/modules/shipping/services/ship-order.service.spec.ts`.
- T-CUSTOMER-INTRO-FLOW-SLIDE (codex, 2026-06-12): 고객 소개 자료 4페이지에 HANES MES 기능흐름도 추가 후 lock 해제. 파일: `docs/presentation/hanes-mes-introduction.html`, `docs/presentation/hanes-mes-introduction.pptx`, `docs/presentation/artifact-build-manifest.json`.
- T-KIOSK-AUTOISSUE-BOM-MISMATCH-GUARD (codex, 2026-06-12): 키오스크 스캔 LOT가 BOM 품목과 불일치하면 실적처리/자동차감 전 중단하도록 방어 추가 후 lock 해제. 파일: `apps/backend/src/modules/production/services/auto-issue.service.ts`, `apps/backend/src/modules/production/services/auto-issue.service.spec.ts`.

- T-CUSTOMER-INTRO-PPTX-EXPORT (codex, 2026-06-12): 고객 소개 HTML 23장 기준 편집 가능한 PPTX 재생성 완료 후 lock 해제. 파일: `docs/presentation/hanes-mes-introduction.pptx`.

- T-QUALITY-INSPECT-USEMEMO (codex, 2026-06-12): `/quality/inspect` 화면 `useMemo is not defined` 런타임 오류 수정 완료 후 lock 해제. 파일: `apps/frontend/src/app/(authenticated)/quality/inspect/page.tsx`.

- T-INV-TRANSACTION-CARDS (codex, 2026-06-12): `/inventory/transaction` 상단 정보카드 3개 제거 완료 후 lock 해제. 파일: `apps/frontend/src/app/(authenticated)/inventory/transaction/page.tsx`.

- T-CUSTOMER-INTRO-HTML-DESIGN (codex, 2026-06-12): 고객 소개 HTML의 카드형 AI 느낌을 줄이고 산업형 색상/공정 보드 레이아웃으로 재정리 완료 후 lock 해제. 파일: `docs/presentation/hanes-mes-introduction.html`.

- T-CUSTOMER-INTRO-HTML-V2 (codex, 2026-06-12): 작업지시서 기준 고객 소개 HTML을 22장 가로형 슬라이드로 재구성 완료 후 lock 해제. 파일: `docs/presentation/hanes-mes-introduction.html`.

- T-EQUIP-INSPECT-POOL-TYPE (claude, 2026-06-11): 점검항목 풀에 EQUIP_TYPE 추가, equip-inspect-item 마스터 페이지를 설비유형 기준 POOL 편집기로 전환, equip-inspect 추가 모달이 설비유형으로 풀 조회하도록 수정 완료 후 lock 해제. JSHANES 컬럼 적용·typecheck·구조테스트 통과. 파일: `apps/backend/src/migrations/2026-06-11_equip_inspect_pool_equip_type.sql`, `apps/backend/src/entities/equip-inspect-item-pool.entity.ts`, `apps/backend/src/modules/master/dto/equip-inspect-item-pool.dto.ts`, `apps/backend/src/modules/master/services/equip-inspect-item-pool.service.ts`, `apps/frontend/src/app/(authenticated)/master/equip-inspect-item/page.tsx`, `apps/frontend/src/app/(authenticated)/master/equip-inspect/{types.ts,components/AddInspectItemModal.tsx,components/EquipAssignTab.tsx,components/ItemMasterTab.tsx}`, `apps/frontend/src/locales/{ko,en,zh,vi}.json`.

- T-ROUTING-TREE-OVERFLOW (claude, 2026-06-11): 라우팅 BOM 트리가 우측 패널 침범하는 레이아웃 버그 수정(grid 자식 min-w-0 + 트리 overflow-auto) 완료 후 lock 해제. 파일: `apps/frontend/src/app/(authenticated)/master/routing/{page.tsx,components/RoutingGroupManager.tsx}`.

- T-DATA-CLEAN-HNS02 (codex, 2026-06-11): JSHANES HNS02 BOM 기준 데이터 클린징 실행 완료 후 lock 해제. HNS02 기준 `ITEM_MASTERS`/`BOM_MASTERS` 47건만 유지, 요청 업무 데이터 및 비-HNS02 `ITEM_CODE` 잔여 0건 확인. 범위: JSHANES DB 데이터, `.ai-coordination/*`.
- T-IQC-SAMPLE-REMOVE (codex, 2026-06-11): IQC 검사구분에서 SAMPLE 제거, 기존 마스터 SAMPLE은 FULL로 정규화 완료 후 lock 해제. `IQC_LOGS.INSPECT_CLASS`는 별개/legacy 이력 컬럼으로 보고 기존 값은 변경하지 않음. 파일: `apps/backend/src/migrations/2026-06-11_iqc_inspect_code_groups.sql`, `apps/backend/src/modules/master/{dto/iqc-group.dto.ts,services/iqc-group.service.ts,services/iqc-group.service.spec.ts}`, `apps/backend/src/modules/material/{dto/iqc-history.dto.ts,services/iqc-history.service.ts}`, `apps/backend/src/entities/{iqc-log.entity.ts,iqc-group.entity.ts,part-master.entity.ts}`, `apps/frontend/src/components/material/{IqcModal.tsx,IqcTable.tsx}`, `apps/frontend/src/hooks/material/useIqcData.ts`, `apps/frontend/src/app/(authenticated)/master/{part,iqc-item}/**`, `apps/frontend/src/locales/{ko,en,zh,vi}.json`, `packages/shared/src/constants/com-code-values.ts`.
- T-PDA-RECEIVE-WORKER-GUARD (claude, 2026-06-11): PDA 자재입고 사전 게이트 검증·사용자 메시지 모달 + 작업자 스캔 등록·workerId 저장 완료 후 lock 해제. 파일: `apps/frontend/src/hooks/pda/useMatReceivingScan.ts`, `apps/frontend/src/app/pda/material/receiving/{page.tsx,components.tsx}`.

- T-IQC-MODAL-POOL-ITEMS (claude, 2026-06-11): IQC 검사결과 모달이 풀 검사항목 전체+검사기준 표시하도록 수정 완료 후 lock 해제. 파일: `apps/backend/src/modules/master/{controllers/iqc-part-link.controller.ts,services/iqc-part-link.service.ts}`, `apps/backend/src/migrations/2026-06-11_iqc_group_chain_repair_seed.sql`, `apps/frontend/src/components/material/IqcModal.tsx`.
- T-REINSPECT-MOVE-LEDGER (claude, 2026-06-11): 유수명 재검 불합격 수불 양품출고/불용입고 2건 분리 완료 후 lock 해제. 파일: `apps/backend/src/modules/material/services/shelf-life-reinspect.service.{ts,spec.ts}`, `apps/frontend/src/app/(authenticated)/inventory/transaction/page.tsx`.
- T-IQC-METHOD-LABELS (codex, 2026-06-11): IQC 검사구분 라벨을 검사/무검사로 통일 완료 후 lock 해제. 파일: `apps/backend/src/migrations/2026-06-11_iqc_inspect_code_groups.sql`, `apps/frontend/src/locales/{ko,en,zh,vi}.json`, `apps/frontend/src/components/material/IqcModal.tsx`, `apps/frontend/src/components/material/IqcTable.tsx`, `apps/frontend/src/app/(authenticated)/master/part/page.tsx`, `apps/frontend/src/app/(authenticated)/master/part/components/PartFormPanel.tsx`, `apps/frontend/src/app/(authenticated)/master/iqc-item/components/{IqcGroupTab.tsx,IqcGroupModal.tsx,IqcLinkModal.tsx,IqcLinkTab.tsx,IqcDetailPanel.tsx}`, `apps/frontend/src/app/(authenticated)/material/iqc/page.tsx`, `apps/frontend/src/app/(authenticated)/inspection/history/page.tsx`, `packages/shared/src/{types/com-code.ts,constants/com-code-values.ts}`.
- T-MAT-LOT-IQC-UID-SEPARATE (codex, 2026-06-11): MAT_LOTS 시드 LOT와 IQC_LOGS UID 중복 해소 완료 후 lock 해제. 파일: `apps/backend/src/migrations/2026-06-11_mat_lot_iqc_uid_separate.sql`.
- T-IQC-CODE-ALIGN (codex, 2026-06-11): IQC 검사방법/검사유형 공통코드 분리 및 화면 매핑 통일 완료 후 lock 해제. 파일: `apps/backend/src/migrations/2026-06-11_iqc_inspect_code_groups.sql`, `apps/backend/src/modules/material/dto/iqc-history.dto.ts`, `apps/backend/src/modules/material/services/iqc-history.service.ts`, `apps/frontend/src/app/(authenticated)/master/part/page.tsx`, `apps/frontend/src/app/(authenticated)/master/part/components/PartFormPanel.tsx`, `apps/frontend/src/app/(authenticated)/master/part/components/IqcSettingModal.tsx`, `apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcGroupTab.tsx`, `apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcGroupModal.tsx`, `apps/frontend/src/app/(authenticated)/material/iqc/page.tsx`, `apps/frontend/src/components/material/IqcTable.tsx`, `apps/frontend/src/components/material/IqcModal.tsx`, `apps/frontend/src/app/(authenticated)/material/iqc-history/page.tsx`, `apps/frontend/src/app/(authenticated)/material/iqc/iqc-code-groups.structure.test.mjs`, `packages/shared/src/types/com-code.ts`, `packages/shared/src/constants/com-code-values.ts`, `docs/reports/db-schema-erd.md`.
- T-PROCESS-EQUIP-SEED (codex, 2026-06-11): 공정별 설비 마스터/공정-설비 매핑 시드 데이터 생성 및 JSHANES 적용 완료 후 lock 해제. 파일: `apps/backend/src/migrations/2026-06-11_process_equipment_seed.sql`.
- T-KIOSK-FLOW-FIX (claude, 2026-06-11): 키오스크 단절 수정(백플러시 시드, by-order-no 집계, 진행률 서버화, 스캔 LOT 우선, 역분개 fromWarehouseId) 완료 후 lock 해제. 파일: `apps/backend/src/migrations/2026-06-11_mat_auto_issue_config_seed.sql`, `apps/backend/src/modules/production/services/{job-order.service.ts,auto-issue.service.ts,auto-issue.service.spec.ts}`, `apps/frontend/src/app/(authenticated)/production/input-kiosk/page.tsx`, `apps/frontend/src/stores/kioskStore.ts`.

- T-MENU-SHELF-LIFE-REINSPECT (codex, 2026-06-11): 유수명자재 재검사 메뉴 미배치/카테고리 이동 오류 수정 완료 후 lock 해제. 파일: `apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts`, `apps/backend/src/modules/menu-categories/utils/menu-code-validator.structure.test.mjs`, `apps/backend/src/migrations/2026-06-11_shelf_life_reinspect_menu_restore.sql`.
- T-FE-THEME-PRESET (codex, 2026-06-11): 상단 컬러 테마 아이콘에서 선택 가능한 Orchid preset 추가 완료 후 lock 해제. 파일: `apps/frontend/src/app/globals.css`, `apps/frontend/src/stores/themeStore.ts`, `apps/frontend/src/components/layout/Header.tsx`.
- T-OQC-SHIP-TOGGLE (claude, 2026-06-11): OQC 사용여부 설정 추가 + 출하 3개 게이트 조건부 적용 완료 후 lock 해제. 파일: `apps/backend/src/modules/shipping/shipping.module.ts`, `apps/backend/src/modules/shipping/services/{ship-order.service.ts,shipment.service.ts}`, `apps/backend/src/migrations/2026-06-11_oqc_enabled_config_seed.sql`.

- T-PALLET-SCREEN-FIX (claude, 2026-06-11): 팔레트 화면-백엔드 계약 정합 + 팔레트 자동채번 완료 후 lock 해제. 파일: `apps/frontend/src/app/(authenticated)/shipping/pallet/page.tsx`, `apps/backend/src/shared/numbering.service.ts`, `apps/backend/src/modules/shipping/{dto/pallet.dto.ts,services/pallet.service.ts,services/pallet.service.spec.ts}`, `apps/backend/src/migrations/2026-06-11_seq_pallet_no_daily.sql`, `locales/{ko,en,zh,vi}.json`.
- T-PDA-API-UNIFY (claude, 2026-06-11): PDA 자재출고/출하 훅 웹 동일 계약 통일 완료 후 lock 해제. 파일: `apps/frontend/src/hooks/pda/useMatIssuingScan.ts`, `useShippingScan.ts`, `useShippingScan.types.ts`, `app/pda/material/issuing/*`, `app/pda/shipping/*`, `locales/{ko,en,zh,vi}.json`.
- T-SHIP-CROSSBOX-GUARD (claude, 2026-06-11): 교차 박스 중복 포장 가드 추가 완료 후 lock 해제. 파일: `apps/backend/src/modules/shipping/services/box.service.ts`, `apps/backend/src/modules/shipping/services/box.service.spec.ts`.
- T-TAB-LIMIT-10 (codex, 2026-06-11): 페이지 탭 제한 개수를 10개로 변경 완료 후 lock 해제. 파일: `apps/frontend/src/stores/tabStore.ts`, `apps/frontend/src/components/layout/TabKeepAlive.tsx`.
- T-CUSTOMER-INTRO-WORK-INSTRUCTION (codex, 2026-06-11): 고객용 제품 소개 자료 재생성 작업지시 문서 작성 완료 후 lock 해제. 파일: `docs/presentation/hanes-mes-introduction-work-instruction.md`.
- T-CUSTOMER-INTRO-MENU-SCREEN-DECK (codex, 2026-06-11): 현재 메뉴 화면 캡처 기반으로 고객용 제품 소개 PPTX/HTML을 15장으로 확장 완료 후 lock 해제. 파일: `docs/presentation/hanes-mes-introduction.html`, `docs/presentation/hanes-mes-introduction.pptx`, `docs/presentation/assets/menu-captures/*`.
- T-CUSTOMER-INTRO-PRODUCT-DECK (codex, 2026-06-11): 고객용 제품 소개 자료로 HTML/PPTX 전면 재작성 완료 후 lock 해제. 파일: `docs/presentation/hanes-mes-introduction.html`, `docs/presentation/hanes-mes-introduction.pptx`.
- T-CUSTOMER-INTRO-PPTX (codex, 2026-06-11): 고객 소개용 가로형 PPTX 문서 생성, 레이아웃 검사 및 패키지 검증 완료 후 lock 해제. 파일: `docs/presentation/hanes-mes-introduction.pptx`.
- T-CUSTOMER-INTRO-HTML-REV (codex, 2026-06-11): 고객 소개 HTML 자료를 12장 워크플로우형으로 재구성하고 글자 크기/넘침 보정 완료 후 lock 해제. 파일: `docs/presentation/hanes-mes-introduction.html`.
- T-CUSTOMER-INTRO-HTML (codex, 2026-06-11): 고객 소개용 HTML 자료 생성 완료 후 lock 해제. 파일: `docs/presentation/hanes-mes-introduction.html`, `docs/presentation/assets/*`.
