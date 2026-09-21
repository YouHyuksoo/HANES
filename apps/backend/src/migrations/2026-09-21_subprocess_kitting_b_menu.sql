-- 실적입력(서브공정) 키팅 B안(PROD_KITTING_B) 좌측 메뉴 DB 시드
-- 신규 leaf: PROD_KITTING_B / path /production/subprocess-kitting-b / labelKey menu.production.kittingB
-- 직전 PROD_KITTING(CATEGORY=PRODUCTION, SORT_ORDER=50, 2026-09-21 실측) 바로 다음 SORT_ORDER=51에 배치.
--   (다음 항목 PROD_INPUT_ASSEMBLY 는 SORT_ORDER=60 이라 51 은 빈 자리다.)
-- 멀티테넌시 정본: COMPANY=40, PLANT_CD='1000'. 멱등 MERGE(ON = MENU_CODE+COMPANY+PLANT_CD). add-only.
--
-- ROLE_MENU_PERMISSIONS 행은 의도적으로 만들지 않는다.
--   A안 PROD_KITTING 에도 권한 행이 없다(2026-09-21 실측: MENU_CATEGORY_ITEMS 166건 중 49건이 권한 행 없음).
--   B안은 A안과 같은 사용자에게 보여야 비교가 되므로 A안 상태를 그대로 따른다.
--   A안에 권한 행을 부여하게 되면 B안에도 같이 부여한다.
--
-- 배치 시안 검토용 라우트다. 채택/폐기 결정 후 이 메뉴는 정리한다.

MERGE INTO MENU_CATEGORY_ITEMS t
USING (
  SELECT 'PROD_KITTING_B' AS MENU_CODE,
         'PRODUCTION'     AS CATEGORY_CODE,
         51               AS SORT_ORDER,
         '40'             AS COMPANY,
         '1000'           AS PLANT_CD
  FROM dual
) s
ON (t.MENU_CODE = s.MENU_CODE AND t.COMPANY = s.COMPANY AND t.PLANT_CD = s.PLANT_CD)
WHEN NOT MATCHED THEN
  INSERT (MENU_CODE, CATEGORY_CODE, SORT_ORDER, COMPANY, PLANT_CD,
          CREATED_AT, CREATED_BY, UPDATED_AT, UPDATED_BY)
  VALUES (s.MENU_CODE, s.CATEGORY_CODE, s.SORT_ORDER, s.COMPANY, s.PLANT_CD,
          SYSTIMESTAMP, 'system', SYSTIMESTAMP, 'system')
/
