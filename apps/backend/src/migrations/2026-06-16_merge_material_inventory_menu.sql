-- ============================================================================
-- 2026-06-16 좌측 메뉴: 자재수불관리(MATERIAL) + 자재재고관리(INVENTORY) → 자재관리 통합
-- ----------------------------------------------------------------------------
-- - 두 카테고리를 'MATERIAL' 한 개로 병합하고 라벨을 menu.materialMgmt(= 자재관리)로 변경
-- - INVENTORY 카테고리의 메뉴 항목(INV_*, MAT_HOLD)을 MATERIAL로 이관 후 빈 카테고리 삭제
-- - RBAC(ROLE_MENU_PERMISSIONS)는 leaf 메뉴 코드만 저장 → 권한 영향 없음(이관 불필요)
-- - 대상: 모든 tenant(현재 JSHANES COMPANY='40', PLANT_CD='1000')
-- - 메뉴 항목 멤버십은 운영 중 커스터마이징된 상태이므로 menuConfig 시드로 덮어쓰지 않고
--   INVENTORY → MATERIAL 이관만 수행한다.
-- ============================================================================

-- 1) MATERIAL 카테고리 라벨을 '자재관리'(menu.materialMgmt)로 변경
UPDATE MENU_CATEGORIES
   SET LABEL_KEY = 'menu.materialMgmt',
       UPDATED_AT = SYSTIMESTAMP,
       UPDATED_BY = 'system'
 WHERE CATEGORY_CODE = 'MATERIAL'
/

-- 2) INVENTORY 카테고리 메뉴 항목을 MATERIAL로 이관 (기존 MATERIAL 항목 뒤로 정렬: +200)
UPDATE MENU_CATEGORY_ITEMS
   SET CATEGORY_CODE = 'MATERIAL',
       SORT_ORDER = SORT_ORDER + 200,
       UPDATED_AT = SYSTIMESTAMP,
       UPDATED_BY = 'system'
 WHERE CATEGORY_CODE = 'INVENTORY'
/

-- 3) 비워진 INVENTORY 카테고리 삭제
DELETE FROM MENU_CATEGORIES
 WHERE CATEGORY_CODE = 'INVENTORY'
/

COMMIT
/
