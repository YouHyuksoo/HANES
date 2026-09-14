-- 불용창고(WH-DEFECT)를 UNUSABLE 유형 기본창고로 전환한다.
-- 설계: docs/specs/2026-09-14-unusable-warehouse-separation-design.md
-- 반드시 scripts/2026-09-14_unusable_warehouse_comcode.sql(공통코드) 을 먼저 적용하고,
-- 백엔드 배포와 같은 창에서 실행한다 (구 코드는 UNUSABLE 을 모른다).
-- 실행 전 조건: WH-DEFECT 재고 0건 (MAT_STOCKS / PRODUCT_STOCKS).
UPDATE WAREHOUSES
   SET WAREHOUSE_TYPE = 'UNUSABLE',
       IS_DEFAULT = 'Y',
       UPDATED_BY = 'unusable-wh',
       UPDATED_AT = SYSTIMESTAMP
 WHERE WAREHOUSE_CODE = 'WH-DEFECT'
   AND COMPANY = '40'
   AND WAREHOUSE_TYPE = 'DEFECT'
/
COMMIT
/
