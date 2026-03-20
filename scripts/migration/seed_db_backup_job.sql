-- =============================================================================
-- 파일: seed_db_backup_job.sql
-- 설명: DB 백업 스케줄러 잡 시드 데이터
--
-- 대상 테이블: SCHEDULER_JOBS
-- 작업 내용  : 매일 02:00 Oracle TEST 스키마 전체 백업 (DDL + INSERT SQL → zip)
--             IS_ACTIVE='N' 상태로 삽입되므로 운영 전 수동 활성화 필요
--
-- 사용법:
--   sqlplus JSHANES/비밀번호@접속문자열 @seed_db_backup_job.sql
--
-- 멱등성: MERGE 구문 사용 — 중복 실행 시 업데이트로 처리됨
-- =============================================================================

MERGE INTO SCHEDULER_JOBS tgt
USING (
  SELECT
    '40'                                                             AS COMPANY,
    'VNHNS'                                                          AS PLANT_CD,
    'DB_BACKUP_SCHEMA'                                               AS JOB_CODE,
    N'Oracle 스키마 백업'                                            AS JOB_NAME,
    'MAINTENANCE'                                                    AS JOB_GROUP,
    'SERVICE'                                                        AS EXEC_TYPE,
    'DbBackupService.runBackup'                                      AS EXEC_TARGET,
    N'{"backupDir":"./backups","retentionDays":7}'                   AS EXEC_PARAMS,
    '0 0 2 * * *'                                                    AS CRON_EXPR,
    'N'                                                              AS IS_ACTIVE,
    1                                                                AS MAX_RETRY,
    1800                                                             AS TIMEOUT_SEC,
    N'매일 02:00 TEST 스키마 전체 백업 (DDL + INSERT SQL → zip)'    AS DESCRIPTION,
    'SYSTEM'                                                         AS CREATED_BY,
    'SYSTEM'                                                         AS UPDATED_BY
  FROM DUAL
) src
ON (
  tgt.COMPANY  = src.COMPANY  AND
  tgt.PLANT_CD = src.PLANT_CD AND
  tgt.JOB_CODE = src.JOB_CODE
)
WHEN MATCHED THEN UPDATE SET
  tgt.JOB_NAME    = src.JOB_NAME,
  tgt.JOB_GROUP   = src.JOB_GROUP,
  tgt.EXEC_TYPE   = src.EXEC_TYPE,
  tgt.EXEC_TARGET = src.EXEC_TARGET,
  tgt.EXEC_PARAMS = src.EXEC_PARAMS,
  tgt.CRON_EXPR   = src.CRON_EXPR,
  tgt.MAX_RETRY   = src.MAX_RETRY,
  tgt.TIMEOUT_SEC = src.TIMEOUT_SEC,
  tgt.DESCRIPTION = src.DESCRIPTION,
  tgt.UPDATED_BY  = src.UPDATED_BY,
  tgt.UPDATED_AT  = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT (
  COMPANY, PLANT_CD, JOB_CODE,
  JOB_NAME, JOB_GROUP, EXEC_TYPE,
  EXEC_TARGET, EXEC_PARAMS, CRON_EXPR,
  IS_ACTIVE, MAX_RETRY, TIMEOUT_SEC,
  DESCRIPTION,
  CREATED_BY, CREATED_AT,
  UPDATED_BY, UPDATED_AT
) VALUES (
  src.COMPANY, src.PLANT_CD, src.JOB_CODE,
  src.JOB_NAME, src.JOB_GROUP, src.EXEC_TYPE,
  src.EXEC_TARGET, src.EXEC_PARAMS, src.CRON_EXPR,
  src.IS_ACTIVE, src.MAX_RETRY, src.TIMEOUT_SEC,
  src.DESCRIPTION,
  src.CREATED_BY, SYSTIMESTAMP,
  src.UPDATED_BY, SYSTIMESTAMP
);

COMMIT;
