# claude Handoff

## Last Update

2026-06-16 (local)

## Latest

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
