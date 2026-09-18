-- 불량품창고(DEFECT) 재고 보관위치 일괄 지정
--
-- 배경: 2026-09-18_mat_stock_location_backfill.sql 은 W001 재고만 채웠다.
--       DEFECT 창고 재고는 품목 고정위치가 W001 랙이라 창고-위치가 어긋나 제외했었다.
-- 기준: 불량품창고 기본 랙 DEF-01(불량품 1번)로 일괄 지정한다.
--       개별 위치가 다르면 PDA 창고랙 지정(PDA_MAT_RACK_ASSIGN)으로 덮어쓴다.
-- 멱등: 위치가 비어 있는 행만 채운다.
-- 실행: python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file <this file>
-- 되돌리기: UPDATE MAT_STOCKS SET LOCATION_CODE = NULL WHERE WAREHOUSE_CODE = 'DEFECT';

UPDATE MAT_STOCKS s
   SET s.LOCATION_CODE = 'DEF-01', s.UPDATED_AT = SYSTIMESTAMP
 WHERE s.WAREHOUSE_CODE = 'DEFECT'
   AND s.LOCATION_CODE IS NULL
   AND EXISTS (
         -- 기준정보에 실제 등록된 랙일 때만 채운다(창고-위치 정합성 유지).
         SELECT 1
           FROM WAREHOUSE_LOCATIONS l
          WHERE l.WAREHOUSE_CODE = s.WAREHOUSE_CODE
            AND l.LOCATION_CODE = 'DEF-01'
            AND l.COMPANY = s.COMPANY
            AND l.PLANT_CD = s.PLANT_CD
       )
/

COMMIT
/
