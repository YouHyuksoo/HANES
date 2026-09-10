-- 동일 조업일/작업지시에서 NG 후 OK 재점검을 이력으로 보존한다.
-- 실행: python C:/Users/hsyou/.agents/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-09-10_equip_inspect_history.sql
-- 적용 전 USER_INDEXES에서 두 인덱스 존재를 확인한다.
DROP INDEX UX_EQUIP_INSPECT_DAILY_WORK
/
DROP INDEX UX_EQUIP_INSPECT_WORKER_ORDER
/
