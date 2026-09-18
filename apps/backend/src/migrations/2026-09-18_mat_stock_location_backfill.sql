-- 기존 자재재고 보관위치(MAT_STOCKS.LOCATION_CODE) 백필
--
-- 배경: 입고 로직은 품목 고정위치(ITEM_MASTERS.STORAGE_LOCATION)를 자동 적용하지만,
--       그 값이 비어 있던 동안 쌓인 재고 270건의 위치가 NULL 로 남아 있다.
--       "별다른 지정이 없으면 품목 고정위치에 보관한다"는 원칙대로 소급 적용한다.
-- 대상: W001(원자재창고) 재고. 품목 고정위치가 그 창고의 로케이션인 경우만 채운다.
--       기존 'E2E-A01'(테스트 흔적, WAREHOUSE_LOCATIONS 에 없는 코드) 18건도 덮어쓴다.
-- 제외: DEFECT 창고 17건 — 품목 고정위치가 W001 랙이라 창고가 어긋난다(별도 결정 필요).
-- 실행: python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file <this file>
-- 되돌리기: UPDATE MAT_STOCKS SET LOCATION_CODE = NULL WHERE WAREHOUSE_CODE = 'W001';

UPDATE MAT_STOCKS s
   SET s.LOCATION_CODE = (
         SELECT i.STORAGE_LOCATION
           FROM ITEM_MASTERS i
          WHERE i.ITEM_CODE = s.ITEM_CODE
            AND i.COMPANY = s.COMPANY
            AND i.PLANT_CD = s.PLANT_CD
       ),
       s.UPDATED_AT = SYSTIMESTAMP
 WHERE s.WAREHOUSE_CODE = 'W001'
   AND EXISTS (
         -- 품목 고정위치가 이 재고의 창고에 실제로 등록된 랙일 때만 채운다.
         SELECT 1
           FROM ITEM_MASTERS i
           JOIN WAREHOUSE_LOCATIONS l
             ON l.LOCATION_CODE = i.STORAGE_LOCATION
            AND l.WAREHOUSE_CODE = s.WAREHOUSE_CODE
            AND l.COMPANY = s.COMPANY
            AND l.PLANT_CD = s.PLANT_CD
          WHERE i.ITEM_CODE = s.ITEM_CODE
            AND i.COMPANY = s.COMPANY
            AND i.PLANT_CD = s.PLANT_CD
       )
/

COMMIT
/
