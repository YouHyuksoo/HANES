-- 2026-09-03 장착 금형 롯트 타수 정정 재계산 (1회성)
-- 배경: 1차 백필(…count_backfill.sql, 16시경)은 그 시점까지의 실적만 더했고, 그 뒤 17:25 배포 전에
--       저장된 실적(WO2609030208 양산 9,990 / WO2609020198 10,000)은 누적되지 않아 10,010으로 남았다.
--       장착 시각(CONSUMABLE_LOGS OUT 로그 = 설비 장착) 이후 취소 제외 실적 전체 × USAGE_PER_UNIT 로 재계산한다.
--       대상은 장착 시 타수 0에서 시작한 두 금형 롯트로 한정(다른 롯트의 기존 타수 보존).
-- 실행: python oracle_connector.py --site JSHANES --execute-file <this file>

UPDATE CONSUMABLE_STOCKS S
   SET S.CURRENT_COUNT = (
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
            AND R.CREATED_AT >= (SELECT MAX(L.CREATED_AT) FROM CONSUMABLE_LOGS L
                                  WHERE L.CON_UID = S.CON_UID AND L.LOG_TYPE = 'OUT')
            AND R.COMPANY = S.COMPANY AND R.PLANT_CD = S.PLANT_CD
       )
 WHERE S.STATUS = 'MOUNTED'
   AND S.CON_UID IN ('C26090300223', 'C26090300224')
/
COMMIT
/
