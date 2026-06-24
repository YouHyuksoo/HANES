# LOCKS

## Active Locks

## T-MASTER-PART-PAGE-STANDARD 품목마스터 페이지 표준 문서화
status: stale
owner: codex
role: implementer
started: 2026-06-23 15:34 KST
last_seen: 2026-06-23 15:34 KST
expires: 2026-06-23 19:34 KST
files:
- docs/standards/master-part-page-standard.md
- docs/standards/ui-screen-patterns.md
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
note: `/master/part` 화면을 표준 레이아웃/컨트롤 규칙의 기준 문서로 정리한다.

## T-ALL-MENU-QA 전체 메뉴 기능 QA 리포트
status: stale
owner: codex
role: implementer/operator
started: 2026-06-23 02:20 KST
last_seen: 2026-06-23 11:04 KST
expires: 2026-06-23 15:04 KST
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
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
note: 전체 메뉴 인벤토리/스모크/기능목록 리포트를 생성하고 실패 메뉴를 후속 수정 대상으로 분류한다. 다른 active lock 파일은 수정하지 않는다.

## T-DEFECT-REGISTER-PANEL 불량관리 수동등록 모달→우측 슬라이드 패널 전환
status: active
owner: claude
role: implementer
files:
- apps/frontend/src/app/(authenticated)/quality/defect/page.tsx
- apps/frontend/src/app/(authenticated)/quality/defect/components/DefectFormPanel.tsx
- package.json
- scripts/kill-dev.ps1
note: locales(ko/en/zh/vi)는 codex 잠금 중이라 미수정. 신규 라벨은 t(key, fallback)로 처리. package.json은 dev 좀비 정리 스크립트(kill /T 트리 종료) 추가 목적.

## T-RECEIVE-LOCATION 자재입고 스캔 모달 적재위치(자동/수동) 추가
status: active
owner: claude
role: implementer
files:
- apps/frontend/src/app/(authenticated)/material/receive/components/ReceiveScanModal.tsx
- apps/backend/src/modules/material/dto/receiving.dto.ts
- apps/backend/src/modules/material/services/receiving.service.ts
note: DB 변경 없음(MAT_STOCKS.LOCATION_CODE/ITEM_MASTERS.STORAGE_LOCATION 기존 컬럼 활용). 자동=품목마스터 storageLocation, 수동=작업자 선택/스캔. part-master는 codex 잠금이라 읽기만(필드명 확인).


## T-SHIP-ORDER-CANCEL 출하반품 화면을 출하취소로 재구성
status: active
owner: claude
role: implementer
files:
- apps/backend/src/migrations/2026-06-22_box_ship_order_no_and_return_seq.sql
- apps/backend/src/entities/box-master.entity.ts
- apps/backend/src/shared/numbering.service.ts
- apps/backend/src/modules/shipping/services/ship-order.service.ts
- apps/backend/src/modules/shipping/services/shipment.service.ts
- apps/backend/src/modules/shipping/controllers/ship-order.controller.ts
- apps/backend/src/modules/shipping/dto/cancel-shipment.dto.ts
- apps/frontend/src/app/(authenticated)/shipping/return/page.tsx
- apps/frontend/src/app/(authenticated)/shipping/return/ship-cancel-page.structure.test.mjs
- apps/frontend/src/locales/ko.json
- apps/frontend/src/locales/en.json
- apps/frontend/src/locales/zh.json
- apps/frontend/src/locales/vi.json
note: /shipping/return을 출하취소로 재구성. BOX_MASTERS.SHIP_ORDER_NO/SHIPPED_AT 컬럼 추가(JSHANES DDL)+stamp, 취소/역분개 in-tx 헬퍼 추출, 출하지시 단위 단일 트랜잭션 취소+SHIPPING_RETURNS 취소이력. 계획: docs/superpowers/plans/2026-06-22-ship-order-cancel.md

## T-TRACE-FULL 추적성 종합 조회 신규 구축
status: active
owner: claude
role: implementer
files:
- apps/backend/src/modules/quality/inspection/dto/product-traceability.dto.ts
- apps/backend/src/modules/quality/inspection/services/product-traceability.service.ts
- apps/backend/src/modules/quality/inspection/controllers/trace.controller.ts
- apps/frontend/src/app/(authenticated)/quality/trace/page.tsx
- apps/frontend/src/app/(authenticated)/quality/trace/types.ts
- apps/frontend/src/app/(authenticated)/quality/trace/components/MaterialSection.tsx
- apps/frontend/src/app/(authenticated)/quality/trace/components/SemiProductSection.tsx
- apps/frontend/src/locales/ko.json
- apps/frontend/src/locales/en.json
- apps/frontend/src/locales/zh.json
- apps/frontend/src/locales/vi.json
note: 제품 시리얼 기준 섹션형 종합 추적(제품→반제품 SG→원자재 PO/IQC). 신규 ProductTraceabilityService, 기존 trace.service.ts는 보존. quality/inspection 모듈 파일(forFeature 엔티티 추가)도 수정 예정. 계획: docs/superpowers/plans/2026-06-23-product-traceability.md

## T-KIOSK-SG-LABEL-PRINT 키오스크 SG 라벨 발행공정 자동 출력(Print Agent)
status: active
owner: claude
role: implementer
files:
- apps/backend/src/modules/master/dto/label-template.dto.ts
- apps/frontend/src/app/(authenticated)/master/label/types.ts
- apps/frontend/src/app/(authenticated)/master/label/labelSources.ts
- apps/frontend/src/app/(authenticated)/master/label/page.tsx
- apps/frontend/src/app/(authenticated)/master/label/components/LabelObjectDesigner.tsx
- apps/frontend/src/services/label-print.ts
- apps/frontend/src/app/(authenticated)/production/input-kiosk/components/SgLabelPrintHost.tsx
- apps/frontend/src/app/(authenticated)/production/input-kiosk/components/ProductionInputBar.tsx
- apps/frontend/src/app/(authenticated)/production/input-kiosk/page.tsx
- apps/frontend/src/locales/ko.json
- apps/frontend/src/locales/en.json
- apps/frontend/src/locales/zh.json
- apps/frontend/src/locales/vi.json
note: master/label에 'sg'(반제품 SG) 라벨 카테고리 신규 + 키오스크 실적저장 시 라우팅 ISSUE_SG_LABEL_YN='Y' 공정이면 발행된 SG_LABELS를 HANES Print Agent(PNG, printAgentPng)로 모달 없이 자동 출력. 백엔드 SG 발행(issueSgLabelInTx)은 기존 동작 그대로. locales는 본 세션 Phase1에서 수정 중인 자기 파일 이어서 편집.

## T-SUBKIT-SCAN-REDESIGN 서브공정 키팅 2영역 스캔 재설계(input-assembly 거울상)
status: active
owner: claude
role: implementer
files:
- apps/backend/src/modules/production/dto/subprocess-kitting.dto.ts
- apps/backend/src/modules/production/services/subprocess-kitting.service.ts
- apps/backend/src/modules/production/services/production-specification.service.ts
- apps/backend/src/modules/production/controllers/subprocess-kitting.controller.ts
- apps/frontend/src/app/(authenticated)/production/subprocess-kitting/page.tsx
- apps/frontend/src/app/(authenticated)/production/subprocess-kitting/components/InputSgScanPanel.tsx
- apps/frontend/src/app/(authenticated)/production/subprocess-kitting/components/SubKitActionBar.tsx
- apps/frontend/src/app/(authenticated)/production/subprocess-kitting/page.structure.test.mjs
- apps/frontend/src/app/(authenticated)/production/input-kiosk/components/SgLabelPrintHost.tsx
note: 이전공정 SG 스캔→소비→회로별 새 SG 발행(ISSUED)→실물 스캔 확정(SG←SG genealogy). issueSgLabel/confirmSubKit 신규(confirmAssembly 대칭). 회로목록은 production-specification.service에 findCircuitsByItemCode 추가. locales(ko/en/zh/vi)는 타 세션 미커밋 변경 공존 → 부분 스테이징. 계획: ~/.claude/plans/binary-toasting-karp.md

## 운영 규칙

- `LOCKS.md`에는 현재 수정 중이거나 인계 판단이 필요한 `active`/`stale` 잠금만 둔다.
- 작업 완료 시 `JOURNAL.md`와 `ARCHIVE.md` 또는 `HANDOFF/<agent-name>.md`에 결과를 남긴 뒤, 해당 lock 항목은 이 파일에서 제거한다.
- 완료 이력을 `status: released`로 이 파일에 누적하지 않는다.
