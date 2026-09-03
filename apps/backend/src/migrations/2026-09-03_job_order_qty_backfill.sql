-- 2026-09-03 미완료 작업지시의 GOOD_QTY/DEFECT_QTY 집계 백필 (1회성)
-- 배경: 실적 저장이 JOB_ORDERS 집계를 갱신하지 않아(지시 완료 시에만 채움) 키오스크 상단 진행률이
--       0으로 고정됐다. 코드 수정(refreshJobOrderQtyInTx)으로 이후 실적은 즉시 반영되므로,
--       완료/취소가 아닌 지시만 취소 제외 실적 합계로 맞춘다. DONE 지시는 complete()가 이미 채웠다.
-- 실행: python oracle_connector.py --site JSHANES --execute-file <this file>

UPDATE JOB_ORDERS J
   SET J.GOOD_QTY = (SELECT NVL(SUM(R.GOOD_QTY), 0) FROM PROD_RESULTS R
                      WHERE R.ORDER_NO = J.ORDER_NO AND R.COMPANY = J.COMPANY AND R.PLANT_CD = J.PLANT_CD
                        AND R.STATUS <> 'CANCELED'),
       J.DEFECT_QTY = (SELECT NVL(SUM(R.DEFECT_QTY), 0) FROM PROD_RESULTS R
                        WHERE R.ORDER_NO = J.ORDER_NO AND R.COMPANY = J.COMPANY AND R.PLANT_CD = J.PLANT_CD
                          AND R.STATUS <> 'CANCELED')
 WHERE J.STATUS IN ('WAITING', 'RUNNING', 'HOLD')
   AND EXISTS (SELECT 1 FROM PROD_RESULTS R
                WHERE R.ORDER_NO = J.ORDER_NO AND R.COMPANY = J.COMPANY AND R.PLANT_CD = J.PLANT_CD
                  AND R.STATUS <> 'CANCELED')
/
COMMIT
/
