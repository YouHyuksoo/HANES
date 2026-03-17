-- =============================================================================
-- 스케줄러 기본 작업 시드 데이터 (IS_ACTIVE='N' — 비활성 상태)
-- =============================================================================

-- 1. BOM 동기화 (10분마다)
INSERT INTO SCHEDULER_JOBS (
  COMPANY, PLANT_CD, JOB_CODE, JOB_NAME, JOB_GROUP, EXEC_TYPE,
  EXEC_TARGET, EXEC_PARAMS, CRON_EXPR, IS_ACTIVE,
  MAX_RETRY, TIMEOUT_SEC, DESCRIPTION,
  CREATED_BY, CREATED_AT, UPDATED_BY, UPDATED_AT
) VALUES (
  'JS', 'JS01', 'IF_SYNC_BOM', 'BOM 동기화', 'INTERFACE', 'SERVICE',
  'InterfaceService.scheduledSyncBom', NULL, '0 */10 * * * *', 'N',
  3, 300, 'ERP BOM 데이터를 MES로 동기화하는 인터페이스 작업',
  'SYSTEM', SYSTIMESTAMP, 'SYSTEM', SYSTIMESTAMP
);

-- 2. 실패건 재시도 (15분마다)
INSERT INTO SCHEDULER_JOBS (
  COMPANY, PLANT_CD, JOB_CODE, JOB_NAME, JOB_GROUP, EXEC_TYPE,
  EXEC_TARGET, EXEC_PARAMS, CRON_EXPR, IS_ACTIVE,
  MAX_RETRY, TIMEOUT_SEC, DESCRIPTION,
  CREATED_BY, CREATED_AT, UPDATED_BY, UPDATED_AT
) VALUES (
  'JS', 'JS01', 'IF_RETRY_FAIL', '실패건 재시도', 'RETRY', 'SERVICE',
  'InterfaceService.scheduledBulkRetry', NULL, '0 */15 * * * *', 'N',
  3, 300, '인터페이스 실패 건을 자동으로 재시도하는 작업',
  'SYSTEM', SYSTIMESTAMP, 'SYSTEM', SYSTIMESTAMP
);

-- 3. 오래된 로그 정리 (매일 새벽 2시)
INSERT INTO SCHEDULER_JOBS (
  COMPANY, PLANT_CD, JOB_CODE, JOB_NAME, JOB_GROUP, EXEC_TYPE,
  EXEC_TARGET, EXEC_PARAMS, CRON_EXPR, IS_ACTIVE,
  MAX_RETRY, TIMEOUT_SEC, DESCRIPTION,
  CREATED_BY, CREATED_AT, UPDATED_BY, UPDATED_AT
) VALUES (
  'JS', 'JS01', 'DB_CLEANUP_LOGS', '오래된 로그 정리', 'MAINTENANCE', 'SQL',
  'DELETE FROM INTER_LOGS WHERE TRANS_DATE < SYSDATE - :retention_days',
  '{"retention_days":90}', '0 0 2 * * *', 'N',
  1, 600, '보관 기간이 지난 인터페이스 로그를 자동 삭제하는 작업',
  'SYSTEM', SYSTIMESTAMP, 'SYSTEM', SYSTIMESTAMP
);

COMMIT;
