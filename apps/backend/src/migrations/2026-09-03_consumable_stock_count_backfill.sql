-- 2026-09-03 장착 소모품 롯트 타수 백필 (1회성)
-- 배경: 키오스크 실적(create, 즉시 DONE)에 타수 누적이 없어 장착 이후 실적이 쌓여도 CURRENT_COUNT=0 이었다.
--       코드 수정으로 이후 실적은 누적되므로, 장착 시점(CONSUMABLE_STOCKS.UPDATED_AT ≈ 장착 시각) 이후
--       실적 수량 × USAGE_PER_UNIT 을 한 번 더해 준다. 실행 전 SELECT 로 증가량을 확인했다.
-- 실행: python oracle_connector.py --site JSHANES --execute-file <this file>

UPDATE CONSUMABLE_STOCKS S
   SET S.CURRENT_COUNT = S.CURRENT_COUNT + (
         SELECT NVL(SUM((R.GOOD_QTY + R.DEFECT_QTY) * M.USAGE_PER_UNIT), 0)
           FROM PROD_RESULTS R
           JOIN JOB_ORDERS J
             ON J.ORDER_NO = R.ORDER_NO AND J.COMPANY = R.COMPANY AND J.PLANT_CD = R.PLANT_CD
           JOIN CONSUMABLE_USAGE_MAP M
             ON M.PRODUCT_ITEM_CODE = J.ITEM_CODE AND M.EQUIP_CODE = R.EQUIP_CODE
            AND M.CONSUMABLE_CODE = S.CONSUMABLE_CODE
            AND M.COMPANY = R.COMPANY AND M.PLANT_CD = R.PLANT_CD AND M.USE_YN = 'Y'
          WHERE R.EQUIP_CODE = S.MOUNTED_EQUIP_CODE
            AND R.STATUS <> 'CANCELED'
            AND R.CREATED_AT >= S.UPDATED_AT
            AND R.COMPANY = S.COMPANY AND R.PLANT_CD = S.PLANT_CD
       )
 WHERE S.STATUS = 'MOUNTED'
/
COMMIT
/
