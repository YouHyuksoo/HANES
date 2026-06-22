# claude Handoff

## Last Update

2026-06-22 (local)

## Latest

- T-SHIP-ORDER-CANCEL 완료(커밋 d3cf1f63..f77b36fa): `/shipping/return`을 **출하취소** 화면으로 재구성. SDD 8 Task + 최종 리뷰(Critical 0).
  - 좌:통합 출하이력(박스+팔레트, 박스출하 팔레트번호 `*`) / 우:팔레트·박스 상세 / **출하지시 단위 단일 트랜잭션 취소**(팔레트분 reverse→CANCELED+팔레트 detach, 박스분 cancel-ship-box) + SHIPPING_RETURNS 취소이력 자동기록(returnNo=SEQ_SHIP_RETURN, 팔레트+박스 복원수량 항목화 RESTOCK).
  - BE: BOX_MASTERS.SHIP_ORDER_NO/SHIPPED_AT 컬럼(**JSHANES DDL 적용·검증 완료**, 마이그레이션 `apps/backend/src/migrations/2026-06-22_box_ship_order_no_and_return_seq.sql`) + 3개 출하경로(shipBox/shipOrderPallets/markAsShipped) stamp. 취소/역분개 `*InTx` 헬퍼 추출(동작 보존). cancelOrderShipment 트랜잭션 내 **pessimistic-lock으로 shipment 상태/ERP 재검증**(동시성 창 제거). 신규 API: GET /shipping/orders/shipped, GET /shipping/orders/:id/shipped-detail, POST /shipping/orders/:id/cancel-shipment.
  - 검증: BE/FE tsc 0, shipping jest 103/103, 구조 테스트 1/1, i18n 4파일 동기화. **실DB 취소 E2E + pessimistic-lock Oracle FOR UPDATE 실DB 검증 권장**(jest는 QueryRunner mock). 미해결시 lock 옵션만 제거하고 재검증 로직 유지.
  - 잔여 주의: cancelShipBox는 동일 itemCode 다중 라인 시 임의 라인 shippedQty 차감(기존 패턴). getShippedDetail 상세 팔레트는 LOADED/SHIPPED 표시(부분 reverse 후 표시 nuance).
  - **LOCKS 정리 보류**: 본 작업 LOCKS 항목(T-SHIP-ORDER-CANCEL)은 codex가 LOCKS.md를 활성 잠금·미커밋 편집 중이라 제거하지 않음. codex가 LOCKS.md 릴리스 후 제거 필요. JOURNAL.md/TASKS.md도 codex 잠금이라 미기록(상세는 본 핸드오프·ARCHIVE 참조).

- T-BOX-SHIP-CONFIRM 완료(커밋 1038f0e4 i18n · 27793ade page): `/shipping/confirm`을 팔레트 출하 → **박스별출하**로 재구성.
  - 메뉴 라벨 shipping.confirm "출하작업"→"박스별출하"(4언어). 3-컬럼: 좌 CONFIRMED 출하지시 / 중 라인 진행률+출하가능 박스(fulfillment candidateBoxes, **읽기 전용**, 행클릭→시리얼) / 우 박스 시리얼(box-stock serials).
  - 출하·취소는 **기존 고아 컴포넌트 `BoxScanShipModal` 재사용**(ship-box/cancel-ship-box). OrderFulfillmentModal.tsx 삭제, Shipment 목록 패널·cancel/reverse·ShipmentScanModal·/shipping/shipments 제거. **백엔드 변경 0**, 라우트/메뉴코드 SHIP_CONFIRM 유지.
  - SDD 3 Task + 최종 리뷰 머지승인. tsc 0, i18n 누락 0(shipping.confirm/boxScan), 구조 테스트 `box-ship-page.structure.test.mjs`. **브라우저 UI E2E는 사용자 확인 권장**.
  - **후속 주의**: ① 팔레트 출하 Shipment 생명주기 UI(배송완료/역분개/ERP동기화)가 confirm 제거로 거처 없음 → 별도 과제. ② OQC 미사용 시 candidateBoxes 후보 좁아질 수 있음(백엔드 정합화 별도). ③ confirm.* 미사용 잔존 키 정리 권장. 상세 JOURNAL 2026-06-22.

- T-I18N-FULL-SWEEP 진행중(코드 미커밋, **하드코딩 전환 미완**): 전체 `(authenticated)` 화면 i18n 누락 점검.
  - **번역 키 누락은 100% 해결**: 모든 `t()` 정적 키가 ko/en/zh/vi 4파일에 존재(ko 미존재 0, 4언어 불일치 0, 키 수 동일 6641). master 그리드/폴백-only 키, 공통 컬럼 팩토리(`lib/table-utils/column-factories.tsx`의 `part.code`/`equip.code` 등 최상위 키) 누락 보강 포함.
  - **하드코딩 `t()` 전환**: 80개 코드 파일 완료(14개 병렬 에이전트). production/system/material/consumables/equipment/quality/shipping 등. `${}` 폴백은 i18next `{{}}` 보간으로 변환.
  - **미완**: 6개 에이전트가 세션 한도(6am 리셋)로 중단 → 코드에 한글 하드코딩 잔여. 측정 1075라인(과대추정, types.ts 상수·dead코드·멀티라인 t()·주석 다수 포함). 실제 미전환 주로 **master 잔여(labelSources.ts/types.ts)·production 나머지·quality aql/spc·shipping·equipment 일부**.
  - **회귀 없음**: 중단 코드도 `t(key,폴백)` 형태라 tsc 0 통과, 한글 폴백 표시(기능 정상, 다국어만 미적용). locale 4언어 완전 동기화, CRLF 유지, BOM 없음.
  - **인계 절차서: `docs/i18n-hardcoding-migration-guide.md`** — 측정/병렬에이전트/locale삽입(setIfAbsent+CRLF 재직렬화)/폴백복구/검증 스크립트 포함. 다른 AI는 이 문서대로 미완 모듈을 이어서 처리하면 됨.
  - **핵심 함정**: locale은 CRLF(LF 섞임 금지), BOM 금지, `JSON.stringify(,,2)+\n`→CRLF가 원본과 바이트동일(재직렬화 안전), `common.*` 새 키 금지, 4언어 동시.

- T-PROCESS-LINE-TYPE-UI 완료(DB 일부 commit, 코드 미커밋): PROCESS_MASTERS LINE_TYPE 화면 반영.
  - BE: process dto/service `lineType`(+create의 processCategory 누락 동반 수정), equip-master findAll `lineType` 매핑.
  - FE: 공정마스터 화면 라인 컬럼/필터/입력(ComCodeSelect), 설비선택 모달을 라인(저전압/고전압/공통)별 섹션→공정 카드 2단계 그룹. equipOptions normalize에 lineType + undefined필드 정리.
  - DB: COM_CODES LINE_TYPE 3건 commit. 시드 `tools/seed/seed_line_type_comcode.py`.
  - 검증: FE/BE tsc 0, equipOptions 2/2. 브라우저 렌더는 dev 서버 재컴파일 불안정으로 미완 — 사용자 직접 확인 권장. locales codex 점유라 t() defaultValue 폴백.

- T-PROCESS-MASTER-PDF-REORG 완료(DB 반영 commit, 코드 미커밋): THN 제조공정 흐름도 PDF 기준 `PROCESS_MASTERS` 정비.
  - `LINE_TYPE`(LV/HV/CM) 컬럼 비파괴 ADD. 기존 18개 **코드 유지**, 명칭/라인/순서만 정비. 신규 23개(LV17·HV4·CM2) INSERT. PRC-* 4개 비활성. 활성 41개.
  - **PROCESS_CODE 무변경** → 23개 참조 테이블 무손상. 그로멧/부자재삽입은 공용(CM). 엔티티 `lineType` 추가, BE tsc 0.
  - 시드 `tools/seed/seed_process_master_pdf.py`(멱등), 설계 `docs/superpowers/specs/2026-06-20-process-master-pdf-reorg-design.md`. JSHANES commit 완료.
  - **남은 것**: 화면 반영(공정마스터 LINE_TYPE 컬럼/필터, 설비선택 모달 라인별 그룹)은 별도. IF_PO INVALID는 무관(원래 깨짐).

- T-KIOSK-EQUIP-MODAL-GROUP 완료(코드 미커밋): `/production/input-kiosk` 설비선택 모달을 공정별 그룹화 + 확대.
  - `EquipSelectModal.tsx`만 수정. Modal `size="full"`(90vw), 공정별 그룹(`useMemo`, 공정명순/미지정 맨뒤) + `columns-2~5` 멀티컬럼 카드. 스캔+검색 한 줄 압축.
  - `equips`는 이미 `processCode`/`processName` 보유(`/equipment/equips` findAll PROCESS_MASTERS 조인). 신규 라벨은 `t(noProcess, {defaultValue})` 폴백 — **locales는 codex(T-SHIP-ORDER-PRINT) active 점유라 미수정**.
  - 검증: FE tsc 0, 3002 브라우저 실측(22공정/48설비 5컬럼 거의 한 화면, 스크롤 최소). input-kiosk 일시 500은 codex의 3002 재시작 직후 컴파일 지연(stash 검증으로 무관 확정).

- T-QUALITY-AQL-COMCODE-DROPDOWN 완료(DB 시드 commit, 코드 미커밋): `/quality/aql` 기준관리의 코드성 입력 3종을 공통코드 드롭다운으로 전환.
  - 검사수준→`AQL_INSP_LEVEL`(신규 7종), AQL값→`AQL_VALUE`(신규 26종), 사용여부→`USE_YN`(기존) 모두 `ComCodeSelect includeAll={false}`.
  - JSHANES(40/1000) `COM_CODES` 33건 시드 commit. 빌더 `tools/seed/seed_aql_comcodes.py`(멱등, dry-run/`--commit`).
  - **AQL_VALUE DETAIL_CODE는 JS canonical(`1.0`→`"1"`, `0.040`→`"0.04"`)** — 프론트 `String(aqlValue)` 매칭용. CODE_NAME만 ISO 표준 표기. 기존 데이터(II/1.0/2.5/4.0) 매칭 확인.
  - i18n 4파일 `comCode.AQL_INSP_LEVEL.*` 7키 추가. AQL값은 숫자라 codeName 폴백.
  - 검증: FE tsc 0, 구조 테스트 5/5, locale JSON parse OK. 브라우저 E2E 미수행(사용자 확인 권장).

- T-HNS02-STOCK100-SEED 완료(DB 반영 commit, 코드 미커밋): JSHANES(40/1000) HNS02 완제품 제품재고 **100개**를 BOM 7단계 완전 정합 시드로 생성.
  - 기존 HNS02 작업지시 55건 + MAT_ISSUE_REQUESTS 25/REQUEST_ITEMS 34 정리 → 작업지시 17건(품번당 1, DONE, PARENT_ID 트리) 재구성. **codex의 WO2606150066 참조 데이터는 사용자 명시 승인하에 삭제됨** — codex 키오스크/소모품 REVIEW 작업 재검증 시 해당 작업지시 없음 주의.
  - 생성: PO1/라인18, 원자재18종(입하·IQC·입고·LOT·재고·MAT_IN), 생산실적17, 자재소비(MAT_ISSUES18·MAT_OUT18), SG라벨 20(5묶음 CONSUMED), 반제품 WIP 수불(net0), FG라벨 100(PACKED), 제품재고 HNS02 FG_MAIN **100**, FG_IN, 검사 200(AINSP+OINSP PASS), genealogy FG←SG 100.
  - 잔량 0(반제품 WIP·시드 원자재), 수불 균형(STOCK_TX 합0), 공유 원자재 MAT_LOTS 112 보존, 출하 무변화. 독립 연결 재검증 PASS.
  - 빌더 `tools/seed/seed_hns02_stock100.py`(BOM 재귀전개→정리→INSERT→검증, dry-run 기본 / `--commit`, 멱등). spec `docs/superpowers/specs/2026-06-19-hns02-product-stock-100-seed-design.md`. 채번 시드마커(POH-/ARH-/WOH-/FGH...), MAT_UID=VH1-RM260619.

- T-INSPECT-RESULT-EQUIP-SELECT 완료(미커밋): `/inspection/result`에 검사기(TESTER) 선택 + 소모품 출처 교정 + 검사 실적 검사기 기록 + chromeless 전체화면.
  - **검사기 선택**: 헤더에 `/equipment/equips/type/TESTER` Select. 선택 equipCode를 ConsumablePanel(소모품 조회/장착)+InspectPanel(inspect payload)에 전달. 미선택 시 검사 차단(인터락, 소모품보다 우선). **선택 검사기는 localStorage(`hanes:inspection:equip:${inspectType}`)에 스테이션 단위 저장 → 새로고침/전체화면 토글 후 자동 복원. 목록에 없는 저장값은 정리.**
  - **소모품 출처 교정**: 기존엔 작업지시 생산설비(jobOrder.equipCode)로 조회 → 검사화면에 절단설비 소모품이 떴음. 이제 **선택 검사기 기준**. 공유 `kiosk-consumable`(service/controller/dto)에 **선택적 equipCode override** 추가(미제공 시 키오스크 기존 동작 유지=하위호환).
  - **검사 실적 기록**: `INSPECT_RESULTS.EQUIP_CODE` 컬럼 추가(DDL, 엔티티, inspect() 저장). DTO엔 이미 equipCode 존재.
  - **시드**: CONSUMABLE_USAGE_MAP에 검사기 소모품 매핑 5건(JIG 치구). JSHANES 적용(deploy서버와 DB공유).
  - **전체화면**: MainLayout에 `view=full` chromeless 분기(키오스크 view=work 패턴 일반화). 검사화면 헤더 토글 버튼.
  - 마이그레이션: `apps/backend/src/migrations/2026-06-18_inspect_result_equip_code.sql`, `..._tester_consumable_map_seed.sql`. **deploy.yml 미반영(필요시 추가) — 단 JSHANES=deploy DB 공유라 이미 적용됨.**
  - 검증: FE/BE tsc 0. 브라우저 E2E(검사기선택→CM-JG-CT1 치구→스캔 EQ-AINSP-01 장착→PASS시 IR.EQUIP_CODE 기록→전체화면 사이드바숨김), 테스트데이터 원복 완료.
  - **선택 검사기 유지**: localStorage `hanes:inspection:equip:${inspectType}` 저장/복원(새로고침·전체화면 토글 후 유지). 브라우저 검증 완료.
  - **소모품 영속/교체/강제해제**(T-INSPECT-CONSUMABLE-PERSIST): 소모품은 설비 귀속 장착(CONSUMABLE_STOCKS.MOUNTED_EQUIP_CODE)이라 작업지시 바뀌어도 유지. findByJobOrder `includeMountedOnEquip`(인스펙션만 includeMounted=1)로 설비 장착분 union 표시. scanMount는 동일소모품 이전 롯트 자동해제(교체, **키오스크에도 적용**). ConsumablePanel에 강제 장착해제(확인모달). 작업지시 전환 영속은 브라우저 검증 완료, 교체/강제해제/terminal-result는 세션만료(401)로 브라우저 재검증 미완(코드/tsc만).
  - **terminal-result(`/inspection/terminal-result`)**: 동일 `InspectionResultWorkflow`(inspectType=TERMINAL) 공유라 위 모든 개선 자동 적용. 별도 코드 불필요.

- T-INSPECT-RESULT-CONSUMABLE-MOUNT 완료(미커밋): `/inspection/result`(통전검사 실적)에 input-kiosk와 동일한 소모성 설비부품 표시+conUid 스캔 장착 추가.
  - 신규 `inspection/result/components/ConsumablePanel.tsx`(kioskStore 비의존, `orderNo` prop + `onStatusChange` 콜백, 인라인 스캔 입력).
  - **배치: 좌측 작업지시 목록 하단**(후속 이동). 장착 상태는 `InspectionResultWorkflow`로 끌어올려 `InspectPanel`(우측)에 props 전달 → 미장착 시 PASS/FAIL 인터락(버튼 비활성+주황 배너)은 우측 버튼 옆 유지.
  - 재사용 키오스크 API 3종(`GET/POST scan/DELETE /production/job-orders/:orderNo/consumables`). **백엔드/DB 스키마 변경 0.** 매핑 0건이면 검사 흐름 그대로.
  - i18n `inspection.result.*` 5키 ko/en/zh/vi 추가. 설계: `docs/superpowers/specs/2026-06-18-inspection-result-consumable-mount-design.md`.
  - 검증: frontend tsc 0. 로컬 3002 브라우저 — 매핑0(HNS02) 검사가능 / 매핑2(WO2606150060) 0/2 인터락차단 / C26020100025 스캔→1/2 / X해제→재차단, 테스트 롯트 ACTIVE 원복.

- T-WIP-MAT-TRANS-SCREEN 완료(커밋 915b9c8b, 메뉴시드 6c34b8f3): 공정재고 조회/수불 화면 보강.
  - 공정재고 화면(`/production/wip-material-stock`) 상단 정보카드(StatCard) 제거.
  - **공정수불 화면 신설**(`/production/wip-material-trans`): `WIP_MAT_TRANSACTIONS` 거래이력 조회. API `GET /inventory/wip-mat-transactions`(`WipMatStockService.findTransactions`, EQUIP_MASTERS/ITEM_MASTERS 조인, 날짜·설비·거래유형·검색 필터, 기본 당일). 컬럼: 일시/거래유형(배지)/설비/품목/LOT/수량(±)/참조/비고.
  - 메뉴 2개 DB 시드 완료(JSHANES): `PROD_WIP_MAT_STOCK`(공정재고, sort75)·`PROD_WIP_MAT_TRANS`(공정수불, sort76), 생산관리 카테고리. ROLE_MENU_PERMISSIONS MANAGER/OPERATOR 권한 시드. menuConfig.ts + menu-code-validator.ts 반영.
  - i18n: `inventory.transaction.wipIn`이 기존 "반제품 입고"로 점유돼 충돌 → 공정수불 라벨은 `production.wipMaterialTrans.*` 별도키, `inventory.transaction`엔 `wipMatIn`/`wipMatInCancel` add-only.
  - 검증: backend/frontend tsc 0, jest 11/11. **실DB E2E 화면 검증 완료** — 공정입고(+500)→생산소비(-500)→생산소비취소(+500)→공정입고취소(-500) 거래이력이 공정수불 화면에 정상 표시. 검증 데이터는 잔량 0 원복(거래원장 이력 보존).

- T-MAT-ISSUE-WIP-STOCK 완료(커밋됨): 자재출고를 "출고=소비"에서 **2단계 WIP**(창고→설비 공정재고 이동 + 생산실적 완료 시 소비)로 전환. 공정재고는 **설비(EQUIP_CODE) 단위 별도 테이블**.
  - 신규: `WIP_MAT_STOCKS`(PK COMPANY/PLANT_CD/EQUIP_CODE/ITEM_CODE/MAT_UID), `WIP_MAT_TRANSACTIONS`(전용 거래원장), `SEQ_WIP_TX` 채번(WTX{YYMMDD}-NNNNN). JSHANES 적용 완료. 엔티티 `wip-mat-stock.entity.ts`/`wip-mat-transaction.entity.ts`, 서비스 `WipMatStockService`(addStockInTx/deductStockInTx/restoreInTx/findByEquip).
  - 흐름: 출고=원자재 MAT_STOCKS 차감+STOCK_TRANSACTIONS `WIP_MOVE` / WIP_MAT_STOCKS 가산+WIP_MAT_TRANSACTIONS `WIP_IN`. 소비(생산실적 완료, auto-issue)=WIP_MAT_STOCKS 차감 `PROD_CONSUME`. 취소 모두 대칭(`WIP_MOVE_CANCEL`/`WIP_IN_CANCEL`/`PROD_CONSUME_CANCEL`). auto-issue 이중차감 방지(원자재 미접근), 설비 미배정 시 MAT_OUT fallback.
  - 거래유형 공통코드 `WIP_MOVE`/`WIP_MOVE_CANCEL` 신규(기존 TRANSFER=창고이동과 구분). i18n 4종 라벨.
  - 화면: `production/wip-material-stock`(설비별 공정재고 조회) + API `GET /inventory/wip-mat-stocks`. 자재재고 화면은 원자재 전용 복귀. **메뉴 DB 시드는 보류(codex 메뉴 작업 충돌 회피) — 추후 MENU_CATEGORY_ITEMS 반영 필요.**
  - 롤백: 창고경유(WAREHOUSES.EQUIP_CODE는 잔류 허용, getOrCreateEquipWipWarehouse 헬퍼·WIP창고46행 시드 제거).
  - 검증: backend/frontend tsc 0, 핵심 jest 63 passed, **JSHANES 실DB E2E(출고이동→이동취소) 4테이블 정합 확인**(WO2606150066/EQ-ATCNS-01/CBL-A). 생산실적 소비는 단위테스트 커버+화면 검증 권장(키오스크 흐름).
  - 설계/계획: `docs/superpowers/specs/2026-06-16-wip-mat-stock-separate-table-design.md`, `docs/superpowers/plans/2026-06-16-wip-mat-stock-separate-table-plan.md`. 잔재: WIP_MAT_STOCKS에 EQ-ATCNS-01/CBL-A qty=0 1행(취소 이력, 무해). 폐기 시드파일 `2026-06-16_equip_wip_warehouse_seed.sql` 잔류(적용분 롤백됨).

- T-MENU-MERGE-MATERIAL 완료(미커밋): 좌측 메뉴 `자재수불관리(MATERIAL)`+`자재재고관리(INVENTORY)` 2개를 `자재관리`(MATERIAL, 라벨 `menu.materialMgmt`) 하나로 통합.
  - menuConfig.ts: INVENTORY 블록 제거, MATERIAL 블록에 INVENTORY 7개 leaf 병합 + labelKey→menu.materialMgmt, Warehouse import 제거.
  - i18n 4종 `menu.materialMgmt` add-only(자재관리/Material Management/物料管理/Quản lý vật tư). 시드 재생성(카테고리 20→19).
  - Live DB(JSHANES 40/1000): 운영 커스터마이징 보존 위해 시드 덮어쓰기 대신 마이그레이션만 적용 — INVENTORY 항목 MATERIAL로 이관(+200), MATERIAL 16→23항목, INVENTORY 카테고리 삭제, 고아 0. `apps/backend/src/migrations/2026-06-16_merge_material_inventory_menu.sql`.
  - RBAC(ROLE_MENU_PERMISSIONS)는 leaf 코드만 저장 → 권한 영향 없음. 프론트 tsc 통과.
  - 참고: 사이드바 런타임 소스는 DB `/menu-categories/tree`(menuConfig는 leaf 매핑+폴백). 화면 반영은 새로고침 시.

- T-EQUIP-INSPECT-TABLE-RESTRUCTURE 완료: 두 테이블 역할이 뒤바뀐 설계 오류를 전면 교정.
  - `EQUIP_INSPECT_ITEM_MASTERS` = 설비유형별 기준 템플릿 (PK: COMPANY+PLANT_CD+ITEM_CODE, EQUIP_TYPE 보유)
  - `EQUIP_INSPECT_ITEM_POOL` = 설비+항목 연결 테이블 (PK: COMPANY+PLANT_CD+EQUIP_CODE+ITEM_CODE+INSPECT_TYPE, 린)
  - 엔티티 파일명은 그대로, 클래스명/데코레이터만 스왑 (파일 `equip-inspect-item-pool.entity.ts` → class `EquipInspectItemMaster`, 반대도 동일)
  - equipment 모듈 서비스: POOL inject + MASTERS JOIN(`fetchItemsWithDetails` 헬퍼), item.seq → item.itemCode
  - 백엔드·프론트 tsc --noEmit 통과. 미커밋.

- T-KIOSK-FLOW-FIX: 키오스크 단절 3건+연쇄버그 수정 완료. 백엔드 재시작 완료(로컬 3003). 미커밋.

## Completed

- T-PALLET-SCREEN-FIX, T-PDA-API-UNIFY, T-SHIP-CROSSBOX-GUARD, T-PDA-RECEIVE-WORKER-GUARD 등 다수 완료.

## In Progress / Watch

- 없음. LOCKS 비어 있음.
- 주의: 탭 비영속(localStorage `harness-tabs` 미사용). 알림 벨은 Header에서 주석 처리됨.
- 엔티티 파일명과 클래스명이 반대로 매핑된 상태 유지 중 — 이후 파일명 정리 필요하면 별도 작업.

## Next AI Should

1. Read `AGENTS.md`.
2. Read `.ai-coordination/README.md`, `STATE.md`, `TASKS.md`, `DECISIONS.md`, and `LOCKS.md`.
3. Read `PROTOCOL.md` for conflicts, stale locks, broad changes, DB changes, or review handoff.
4. Claim files in `LOCKS.md` before editing.
5. Keep `TASKS.md` active-work-only.
6. Update `JOURNAL.md` and its own handoff file before stopping.
