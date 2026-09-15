-- 라벨 재발행 API 검증으로 남은 기록 제거 (사용자 지시, 2026-09-15)
--
-- 배경: 재발행 화면·API 를 만든 뒤 실제로 기록이 남는지 확인하려고 SG/FG 각 1건을 태웠다.
--       실물을 인쇄한 것이 아니므로 인쇄 이력으로 남겨두지 않는다.
--       (이 검증에서 LABEL_PRINT_LOGS 복합 PK 누락 버그를 찾아 함께 고쳤다.)
--
-- 실행 전 값(복구용 기록):
--   LABEL_PRINT_LOGS: PRINT_MODE='REPRINT' 2행
--     10:58:47 seq=1 SG SG260914-00882 cnt=1 by=MAG_WK01
--     10:59:25 seq=1 FG FG26091300678 cnt=1 by=MAG_WK01
--   FG_LABELS FG26091300678: REPRINT_COUNT=1 (검증 전 0)

UPDATE FG_LABELS
   SET REPRINT_COUNT = 0,
       UPDATED_BY = 'verify-cleanup',
       UPDATED_AT = SYSTIMESTAMP
 WHERE FG_BARCODE = 'FG26091300678'
   AND COMPANY = '40'
   AND REPRINT_COUNT = 1
/

-- UID_LIST 는 CLOB 이라 IN/= 로 직접 비교할 수 없다(ORA-00932). DBMS_LOB.SUBSTR 로 문자열화해 비교한다.
DELETE FROM LABEL_PRINT_LOGS
 WHERE PRINT_MODE = 'REPRINT'
   AND WORKER_CODE = 'MAG_WK01'
   AND DBMS_LOB.SUBSTR(UID_LIST, 200, 1) IN ('SG260914-00882', 'FG26091300678')
/

COMMIT
/
