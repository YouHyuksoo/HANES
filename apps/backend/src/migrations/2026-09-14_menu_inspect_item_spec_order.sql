-- 검사실측스펙(QC_INSPECT_ITEM_SPEC) 메뉴 순서 정정
--
-- 신규 메뉴가 QC_INSPECT_AID 와 같은 SORT_ORDER 6 으로 들어갔다.
-- 동순위일 때 서버는 menuCode ASC 로 푼다(menu-category-items.service.ts:40).
-- 'QC_INSPECT_AID' < 'QC_INSPECT_ITEM_SPEC' 이라 검사구가 앞에 나오는데,
-- menuConfig.ts 의 의도는 터미널압착스펙 → 검사실측스펙 → 검사구 순서다.
--
-- 뒤 항목이 10 부터라 AID 를 7 로 한 칸 미는 것으로 충돌 없이 의도한 순서가 된다.
--   5 QC_TERMINAL_CRIMP_SPEC → 6 QC_INSPECT_ITEM_SPEC → 7 QC_INSPECT_AID → 10 QC_IQC
UPDATE MENU_CATEGORY_ITEMS
   SET SORT_ORDER = 7, UPDATED_AT = SYSTIMESTAMP, UPDATED_BY = 'migration'
 WHERE COMPANY = '40' AND PLANT_CD = '1000'
   AND CATEGORY_CODE = 'QUALITY' AND MENU_CODE = 'QC_INSPECT_AID'
   AND SORT_ORDER = 6
