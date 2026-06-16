# claude Handoff

## Last Update

2026-06-16 (local)

## Latest

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
