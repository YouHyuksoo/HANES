-- 기준정보·트랜잭션 불변식 검증 정기 실행 잡 (2026-09-03, 현장 개선요청 2차분 후속)
-- 매일 06:30 MasterValidationService.scheduledRun(company, plantCd) 실행.
-- ERROR 위반이 있으면 잡이 FAILED로 기록되고 관리자 알림을 탄다. 결과 상세는 SCHEDULER_LOGS.RESULT_MSG.
MERGE INTO SCHEDULER_JOBS t
USING (SELECT '40' AS COMPANY, '1000' AS PLANT_CD, 'MST_VALIDATION_DAILY' AS JOB_CODE FROM DUAL) s
   ON (t.COMPANY = s.COMPANY AND t.PLANT_CD = s.PLANT_CD AND t.JOB_CODE = s.JOB_CODE)
WHEN NOT MATCHED THEN
  INSERT (COMPANY, PLANT_CD, JOB_CODE, JOB_NAME, JOB_GROUP, EXEC_TYPE, EXEC_TARGET, EXEC_PARAMS,
          CRON_EXPR, IS_ACTIVE, MAX_RETRY, TIMEOUT_SEC, DESCRIPTION, CREATED_BY)
  VALUES ('40', '1000', 'MST_VALIDATION_DAILY', '기준정보·트랜잭션 불변식 검증(일간)', 'MAINTENANCE', 'SERVICE',
          'MasterValidationService.scheduledRun', NULL,
          '0 30 6 * * *', 'Y', 0, 600,
          '기준정보 검증 규칙 전체 + 트랜잭션 불변식(작업지시 집계=실적 합계, 생산출고=공정재고 적재, 공정재고 잔량=원장, 출고요청 상태=배분, DB 메뉴코드=검증기)을 매일 실행. ERROR 위반 시 FAILED.',
          'SYSTEM')
/
COMMIT
/
