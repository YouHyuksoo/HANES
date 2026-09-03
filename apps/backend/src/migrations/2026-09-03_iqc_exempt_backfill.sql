-- 2026-09-03 IQC 면제 품목 기존 PENDING 데이터 백필
-- 이슈 05 "IQC 면제 품목 입고 불가" 방안 A(입하 시 자동 PASS)의 기존 데이터 정리.
-- 면제 판정: ITEM_MASTERS.IQC_FLAG != 'Y' OR INSPECT_METHOD IN ('SKIP','NONE')
--   (@harness/shared isIqcExempt와 동일 기준. IQC_LOGS는 생성하지 않음 — 입하취소 가드가 IQC_LOGS 최신 result를 보므로)
-- 실행: python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file <this file>

-- [실행 전 검증] 대상 건수 확인
-- SELECT COUNT(*) AS LOT_TARGET
--   FROM MAT_LOTS L
--  WHERE L.IQC_STATUS = 'PENDING'
--    AND EXISTS (
--          SELECT 1 FROM ITEM_MASTERS M
--           WHERE M.ITEM_CODE = L.ITEM_CODE
--             AND M.COMPANY = L.COMPANY
--             AND M.PLANT_CD = L.PLANT_CD
--             AND (NVL(M.IQC_FLAG, 'Y') != 'Y' OR UPPER(TRIM(M.INSPECT_METHOD)) IN ('SKIP', 'NONE'))
--        );
-- SELECT COUNT(*) AS ARRIVAL_TARGET
--   FROM MAT_ARRIVALS A
--  WHERE A.IQC_STATUS = 'PENDING'
--    AND EXISTS (
--          SELECT 1 FROM ITEM_MASTERS M
--           WHERE M.ITEM_CODE = A.ITEM_CODE
--             AND M.COMPANY = A.COMPANY
--             AND M.PLANT_CD = A.PLANT_CD
--             AND (NVL(M.IQC_FLAG, 'Y') != 'Y' OR UPPER(TRIM(M.INSPECT_METHOD)) IN ('SKIP', 'NONE'))
--        );

UPDATE MAT_LOTS L
   SET L.IQC_STATUS = 'PASS'
 WHERE L.IQC_STATUS = 'PENDING'
   AND EXISTS (
         SELECT 1 FROM ITEM_MASTERS M
          WHERE M.ITEM_CODE = L.ITEM_CODE
            AND M.COMPANY = L.COMPANY
            AND M.PLANT_CD = L.PLANT_CD
            AND (NVL(M.IQC_FLAG, 'Y') != 'Y' OR UPPER(TRIM(M.INSPECT_METHOD)) IN ('SKIP', 'NONE'))
       )
/

UPDATE MAT_ARRIVALS A
   SET A.IQC_STATUS = 'PASS'
 WHERE A.IQC_STATUS = 'PENDING'
   AND EXISTS (
         SELECT 1 FROM ITEM_MASTERS M
          WHERE M.ITEM_CODE = A.ITEM_CODE
            AND M.COMPANY = A.COMPANY
            AND M.PLANT_CD = A.PLANT_CD
            AND (NVL(M.IQC_FLAG, 'Y') != 'Y' OR UPPER(TRIM(M.INSPECT_METHOD)) IN ('SKIP', 'NONE'))
       )
/

COMMIT
/

-- [실행 후 검증] 잔여 PENDING 중 면제 품목이 0건이어야 함 (위 pre 쿼리 재실행 → 둘 다 0 기대)
