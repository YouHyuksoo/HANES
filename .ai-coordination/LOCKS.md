# LOCKS

## Active Locks

## T-COLUMN-EXTRACT-BATCH5 production/shipping/product/inspection 인라인 DataGrid 컬럼 분리
status: active
owner: claude
role: implementer
started: 2026-06-29 06:45 KST
last_seen: 2026-06-29 06:45 KST
expires: 2026-06-29 10:45 KST
files:
- apps/frontend/src/app/(authenticated)/inspection/integrated/
- apps/frontend/src/app/(authenticated)/inspection/protocol/
- apps/frontend/src/app/(authenticated)/product/issue/
- apps/frontend/src/app/(authenticated)/product/issue-cancel/
- apps/frontend/src/app/(authenticated)/product/receipt-cancel/
- apps/frontend/src/app/(authenticated)/product/receive/
- apps/frontend/src/app/(authenticated)/production/input-equip/
- apps/frontend/src/app/(authenticated)/production/input-inspect/
- apps/frontend/src/app/(authenticated)/production/order/
- apps/frontend/src/app/(authenticated)/production/repair/
- apps/frontend/src/app/(authenticated)/production/result/
- apps/frontend/src/app/(authenticated)/production/sample-inspect/
- apps/frontend/src/app/(authenticated)/production/specification-setup/
- apps/frontend/src/app/(authenticated)/production/wip-material-stock/
- apps/frontend/src/app/(authenticated)/production/wip-material-trans/
- apps/frontend/src/app/(authenticated)/shipping/box-stock/
- apps/frontend/src/app/(authenticated)/shipping/confirm/
- apps/frontend/src/app/(authenticated)/shipping/customer-po/
- apps/frontend/src/app/(authenticated)/shipping/customer-po-status/
- apps/frontend/src/app/(authenticated)/shipping/history/
- apps/frontend/src/app/(authenticated)/shipping/order/
- apps/frontend/src/app/(authenticated)/shipping/pack/
- apps/frontend/src/app/(authenticated)/shipping/pallet/
- apps/frontend/src/app/(authenticated)/shipping/pallet-ship/
note: T-COLUMN-EXTRACT 5차(잔여 일괄). 각 page.tsx 인라인 columns를 *Columns.tsx 팩토리로 분리(동작 불변, page폴더 한정). 폴더 단위 lock=해당 page.tsx + 신규 *Columns.tsx/*-columns.structure.test.mjs만. 타 active lock(claude shipping/return, production kiosk/assembly/subprocess 등)과 미겹침 확인하고 선택.

## T-COLUMN-EXTRACT-BATCH4 material/* 인라인 DataGrid 컬럼 분리
status: active
owner: claude
role: implementer
started: 2026-06-29 06:42 KST
last_seen: 2026-06-29 06:42 KST
expires: 2026-06-29 10:42 KST
files:
- apps/frontend/src/app/(authenticated)/material/adjustment/
- apps/frontend/src/app/(authenticated)/material/arrival-result/
- apps/frontend/src/app/(authenticated)/material/arrival-stock/
- apps/frontend/src/app/(authenticated)/material/arrival-transaction/
- apps/frontend/src/app/(authenticated)/material/concession/
- apps/frontend/src/app/(authenticated)/material/hold/
- apps/frontend/src/app/(authenticated)/material/iqc-history/
- apps/frontend/src/app/(authenticated)/material/lot/
- apps/frontend/src/app/(authenticated)/material/lot-merge/
- apps/frontend/src/app/(authenticated)/material/lot-split/
- apps/frontend/src/app/(authenticated)/material/misc-receipt/
- apps/frontend/src/app/(authenticated)/material/physical-inv/
- apps/frontend/src/app/(authenticated)/material/physical-inv-history/
- apps/frontend/src/app/(authenticated)/material/po/
- apps/frontend/src/app/(authenticated)/material/po-status/
- apps/frontend/src/app/(authenticated)/material/receipt-cancel/
- apps/frontend/src/app/(authenticated)/material/shelf-life/
- apps/frontend/src/app/(authenticated)/material/shelf-life-history/
- apps/frontend/src/app/(authenticated)/material/shelf-life-reinspect/
- apps/frontend/src/app/(authenticated)/material/stock/
note: T-COLUMN-EXTRACT 4차. material/* 인라인 columns를 *Columns.tsx 팩토리로 분리(동작 불변, page폴더 한정). codex T-ARCH(material/scrap)·claude(material/receive 등)와 미겹침. 폴더 단위 lock=해당 page.tsx + 신규 *Columns.tsx/*-columns.structure.test.mjs만.

## T-COLUMN-EXTRACT-BATCH3 quality/* 인라인 DataGrid 컬럼 분리
status: active
owner: claude
role: implementer
started: 2026-06-29 06:35 KST
last_seen: 2026-06-29 06:35 KST
expires: 2026-06-29 10:35 KST
files:
- apps/frontend/src/app/(authenticated)/quality/aql/
- apps/frontend/src/app/(authenticated)/quality/audit/
- apps/frontend/src/app/(authenticated)/quality/capa/
- apps/frontend/src/app/(authenticated)/quality/change-control/
- apps/frontend/src/app/(authenticated)/quality/complaint/
- apps/frontend/src/app/(authenticated)/quality/control-plan/
- apps/frontend/src/app/(authenticated)/quality/defect-code/
- apps/frontend/src/app/(authenticated)/quality/fai/
- apps/frontend/src/app/(authenticated)/quality/msa/
- apps/frontend/src/app/(authenticated)/quality/oqc/
- apps/frontend/src/app/(authenticated)/quality/oqc-history/
- apps/frontend/src/app/(authenticated)/quality/ppap/
- apps/frontend/src/app/(authenticated)/quality/request-inspect/
- apps/frontend/src/app/(authenticated)/quality/rework/
- apps/frontend/src/app/(authenticated)/quality/rework-history/
- apps/frontend/src/app/(authenticated)/quality/self-inspect-history/
- apps/frontend/src/app/(authenticated)/quality/spc/
note: T-COLUMN-EXTRACT 3차. quality/* 인라인 columns를 *Columns.tsx 팩토리로 분리(동작 불변, page폴더 한정). quality/defect(hermes), quality/rework-inspect(codex T-ARCH)는 제외. 폴더 단위 lock=해당 page.tsx + 신규 *Columns.tsx/*-columns.structure.test.mjs만.

## T-COLUMN-EXTRACT-BATCH2 inventory/consumables/customs/system 인라인 DataGrid 컬럼 분리
status: active
owner: claude
role: implementer
started: 2026-06-29 06:20 KST
last_seen: 2026-06-29 06:20 KST
expires: 2026-06-29 10:20 KST
files:
- apps/frontend/src/app/(authenticated)/inventory/material-physical-inv/
- apps/frontend/src/app/(authenticated)/inventory/material-physical-inv-apply/
- apps/frontend/src/app/(authenticated)/inventory/material-physical-inv-history/
- apps/frontend/src/app/(authenticated)/inventory/material-stock/
- apps/frontend/src/app/(authenticated)/inventory/product-hold/
- apps/frontend/src/app/(authenticated)/inventory/product-physical-inv/
- apps/frontend/src/app/(authenticated)/inventory/product-physical-inv-history/
- apps/frontend/src/app/(authenticated)/inventory/stock/
- apps/frontend/src/app/(authenticated)/inventory/transaction/
- apps/frontend/src/app/(authenticated)/consumables/life/
- apps/frontend/src/app/(authenticated)/consumables/master/
- apps/frontend/src/app/(authenticated)/consumables/mount/
- apps/frontend/src/app/(authenticated)/customs/entry/
- apps/frontend/src/app/(authenticated)/customs/usage/
- apps/frontend/src/app/(authenticated)/system/users/
- apps/frontend/src/app/(authenticated)/system/document/
- apps/frontend/src/app/(authenticated)/system/training/
- apps/frontend/src/app/(authenticated)/system/comm-config/
note: T-MASTER-COLUMN-EXTRACT 후속 배치. 각 page.tsx 인라인 columns를 *Columns.tsx 팩토리로 분리(동작 불변, page폴더 한정). 폴더 단위 lock=해당 page.tsx + 신규 *Columns.tsx/*-columns.structure.test.mjs만. codex T-ARCH(scrap/progress/rework-inspect/pack-result/mold/department)·hermes(quality/defect)·codex T-ALL-MENU-QA(customs/stock·outsourcing/receive 등)와 미겹침 확인하고 선택.

## T-MASTER-COLUMN-EXTRACT 기준정보 DataGrid 컬럼 분리 + 공정CAPA 업무규칙 공통화
status: active
owner: claude
role: implementer
started: 2026-06-29 06:08 KST
last_seen: 2026-06-29 06:08 KST
expires: 2026-06-29 10:08 KST
files:
- apps/frontend/src/app/(authenticated)/master/worker/page.tsx
- apps/frontend/src/app/(authenticated)/master/worker/workerColumns.tsx
- apps/frontend/src/app/(authenticated)/master/worker/worker-columns.structure.test.mjs
- apps/frontend/src/app/(authenticated)/master/company/page.tsx
- apps/frontend/src/app/(authenticated)/master/company/companyColumns.tsx
- apps/frontend/src/app/(authenticated)/master/company/company-columns.structure.test.mjs
- apps/frontend/src/app/(authenticated)/master/gauge/page.tsx
- apps/frontend/src/app/(authenticated)/master/gauge/gaugeColumns.tsx
- apps/frontend/src/app/(authenticated)/master/gauge/gauge-columns.structure.test.mjs
- apps/frontend/src/app/(authenticated)/master/partner/page.tsx
- apps/frontend/src/app/(authenticated)/master/partner/partnerColumns.tsx
- apps/frontend/src/app/(authenticated)/master/partner/partner-columns.structure.test.mjs
- apps/frontend/src/app/(authenticated)/master/process-capa/page.tsx
- apps/frontend/src/app/(authenticated)/master/process-capa/processCapaColumns.tsx
- apps/frontend/src/app/(authenticated)/master/process-capa/process-capa-columns.structure.test.mjs
- apps/frontend/src/app/(authenticated)/master/process-capa/process-capa-rules.structure.test.mjs
- apps/frontend/src/app/(authenticated)/master/process-capa/components/CapaFormPanel.tsx
- apps/frontend/src/app/(authenticated)/master/vendor-barcode/page.tsx
- apps/frontend/src/app/(authenticated)/master/vendor-barcode/vendorBarcodeColumns.tsx
- apps/frontend/src/app/(authenticated)/master/vendor-barcode/vendor-barcode-columns.structure.test.mjs
- apps/frontend/src/app/(authenticated)/master/work-instruction/page.tsx
- apps/frontend/src/app/(authenticated)/master/work-instruction/workInstructionColumns.tsx
- apps/frontend/src/app/(authenticated)/master/work-instruction/work-instruction-columns.structure.test.mjs
- apps/frontend/src/app/(authenticated)/master/equip-inspect-item/page.tsx
- apps/frontend/src/app/(authenticated)/master/equip-inspect-item/equipInspectItemColumns.tsx
- apps/frontend/src/app/(authenticated)/master/equip-inspect-item/equip-inspect-item-columns.structure.test.mjs
- apps/frontend/src/app/(authenticated)/master/equip-inspect-item/equip-inspect-item-panel.structure.test.mjs
- apps/frontend/src/app/(authenticated)/master/equip-inspect-item/equip-inspect-item-image-url.structure.test.mjs
- packages/shared/src/utils/process-capa-rules.ts
- packages/shared/src/utils/index.ts
- apps/backend/src/modules/master/services/process-capa.service.ts
note: 인라인 DataGrid columns를 page별 *Columns.tsx 팩토리로 분리(동작 불변). process-capa는 FE/BE 중복 CAPA 산식(stdUph 원시값·dailyCapa)을 @harness/shared로 승격(반올림·폴백은 호출부 유지 → 동작 보존). 겹침: master page.tsx들은 claude T-MASTER-UNSAVED-GUARD lock과 파일 중복(같은 owner, 컬럼 분리는 가산적 변경). codex T-ARCH-PAGE-RULE-REFORM과 동일 주제이나 codex는 system/department 담당(master/* 미수정). 사용자 승인 받아 진행.

## T-MASTER-UNSAVED-GUARD 기준정보 우측패널 행전환 일관화 + 저장안된변경 방어
status: active
owner: claude
role: implementer
files:
- apps/frontend/src/hooks/useUnsavedGuard.ts
- apps/frontend/src/app/(authenticated)/master/part/page.tsx
- apps/frontend/src/app/(authenticated)/master/part/components/PartFormPanel.tsx
- apps/frontend/src/app/(authenticated)/master/partner/page.tsx
- apps/frontend/src/app/(authenticated)/master/partner/components/PartnerFormPanel.tsx
- apps/frontend/src/app/(authenticated)/master/work-instruction/page.tsx
- apps/frontend/src/app/(authenticated)/master/work-instruction/components/WorkInstructionFormPanel.tsx
- apps/frontend/src/app/(authenticated)/master/company/page.tsx
- apps/frontend/src/app/(authenticated)/master/company/components/CompanyForm.tsx
- apps/frontend/src/app/(authenticated)/master/worker/page.tsx
- apps/frontend/src/app/(authenticated)/master/worker/components/WorkerFormPanel.tsx
- apps/frontend/src/app/(authenticated)/master/vendor-barcode/page.tsx
- apps/frontend/src/app/(authenticated)/master/vendor-barcode/components/VendorBarcodeFormPanel.tsx
- apps/frontend/src/app/(authenticated)/master/equip/components/EquipMasterTab.tsx
- apps/frontend/src/app/(authenticated)/master/gauge/page.tsx
- apps/frontend/src/app/(authenticated)/master/equip-inspect-item/page.tsx
- apps/frontend/src/components/master/ProdLineTab.tsx
- apps/frontend/src/app/(authenticated)/master/code/page.tsx
- apps/frontend/src/app/(authenticated)/master/code/components/CodeFormPanel.tsx
- apps/frontend/src/app/(authenticated)/master/code/components/CodeDetailGrid.tsx
- apps/frontend/src/app/(authenticated)/master/process/page.tsx
- apps/frontend/src/app/(authenticated)/master/warehouse/components/WarehouseForm.tsx
- apps/frontend/src/app/(authenticated)/master/warehouse/components/WarehouseList.tsx
- apps/frontend/src/app/(authenticated)/master/warehouse/components/LocationList.tsx
- apps/frontend/src/app/(authenticated)/master/warehouse/components/TransferRuleList.tsx
- apps/frontend/src/app/(authenticated)/master/master-required-fields.structure.test.mjs
- apps/frontend/src/locales/ko.json
- apps/frontend/src/locales/en.json
- apps/frontend/src/locales/zh.json
- apps/frontend/src/locales/vi.json
note: (1) 그리드 행클릭 시 패널 재마운트(key) 대신 데이터만 교체(equip 패턴 표준화) + 공통 useUnsavedGuard로 작성중 유실 방어(행전환/신규/닫기 가드, 확인모달). (2) 모달형 등록/수정 화면(prod-line/code/process/warehouse 3탭)을 우측 인라인 패널로 전환. code는 CodeFormModal 삭제→CodeFormPanel 신규. work-calendar는 캘린더 UI라 모달 유지. locales는 common.unsavedTitle/Message/discardAndContinue 3키만 추가.

## T-CHECKOUT-LOCALHOST-QA localhost checkout 흐름 브라우저 QA
status: active
owner: codex
role: operator
started: 2026-06-26 22:32 KST
last_seen: 2026-06-26 22:32 KST
expires: 2026-06-27 00:32 KST
files:
- .ai-coordination/TASKS.md
- .ai-coordination/LOCKS.md
- .ai-coordination/JOURNAL.md
- .ai-coordination/HANDOFF/codex.md
note: localhost checkout/출고 관련 흐름을 브라우저로 검증한다. 앱 소스 파일은 수정하지 않는다.

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
