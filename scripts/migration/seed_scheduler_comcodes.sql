-- =============================================================================
-- 스케줄러 모듈 공통코드 시드 데이터
-- 그룹: SCHED_GROUP, SCHED_EXEC_TYPE, SCHED_STATUS
-- =============================================================================

-- SCHED_GROUP: 스케줄러 작업 그룹
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_GROUP', 'INTERFACE', '인터페이스', 1, 'Y', 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200');
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_GROUP', 'RETRY', '재시도', 2, 'Y', 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200');
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_GROUP', 'MAINTENANCE', '유지보수', 3, 'Y', 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200');

-- SCHED_EXEC_TYPE: 스케줄러 실행 유형
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_EXEC_TYPE', 'SERVICE', '서비스 호출', 1, 'Y', 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200');
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_EXEC_TYPE', 'PROCEDURE', '프로시저', 2, 'Y', 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200');
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_EXEC_TYPE', 'SQL', 'SQL 실행', 3, 'Y', 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200');
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_EXEC_TYPE', 'HTTP', 'HTTP 호출', 4, 'Y', 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200');
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_EXEC_TYPE', 'SCRIPT', '스크립트', 5, 'Y', 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200');

-- SCHED_STATUS: 스케줄러 실행 상태
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_STATUS', 'SUCCESS', '성공', 1, 'Y', 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200');
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_STATUS', 'FAIL', '실패', 2, 'Y', 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200');
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_STATUS', 'RUNNING', '실행 중', 3, 'Y', 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200');
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_STATUS', 'RETRYING', '재시도 중', 4, 'Y', 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200');
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_STATUS', 'TIMEOUT', '시간 초과', 5, 'Y', 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200');
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_STATUS', 'SKIPPED', '건너뜀', 6, 'Y', 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200');

COMMIT;
