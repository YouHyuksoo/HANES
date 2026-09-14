-- 실제로 쓰이는 공정 3건을 사용중으로 정정한다(1차 라우팅 근거 6건에 이은 2차).
-- 근거: 라우팅에는 없지만 작업지시 또는 사용중 설비에 실제로 배정돼 있다.
--   AINSP     통합검사 — JOB_ORDERS 에서 사용
--   PRC-CRIMP 압착     — 사용중 설비 2대에 배정
--   PRC-TEST  도통검사 — 사용중 설비 2대에 배정
UPDATE PROCESS_MASTERS
   SET USE_YN = 'Y',
       PROCESS_NAME = REPLACE(PROCESS_NAME, '(미사용)', ''),
       UPDATED_AT = SYSTIMESTAMP
 WHERE PROCESS_CODE IN ('AINSP', 'PRC-CRIMP', 'PRC-TEST')
   AND COMPANY = '40'
   AND PLANT_CD = '1000'
/
COMMIT
/
