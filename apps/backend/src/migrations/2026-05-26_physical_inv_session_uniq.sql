-- PHYSICAL_INV_SESSIONS: enforce single IN_PROGRESS row per (COMPANY, PLANT_CD).
-- 동시 두 사용자가 같은 사업장에서 점검을 동시 시작해도 DB 가 두 번째 INSERT 를 ORA-00001 으로 거절하도록 한다.
-- physical-inv.service.ts startSession() 의 race-safe 동작은 이 인덱스를 전제로 한다.
-- Safe to rerun: 인덱스가 이미 존재하면 ORA-00955 가 발생하므로 USER_INDEXES 가드를 둔다.

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM USER_TABLES WHERE TABLE_NAME = 'PHYSICAL_INV_SESSIONS';
  IF v_count = 0 THEN
    DBMS_OUTPUT.PUT_LINE('PHYSICAL_INV_SESSIONS 테이블이 없어 partial unique index 생성을 건너뜁니다.');
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_count FROM USER_INDEXES WHERE INDEX_NAME = 'UK_PHYSICAL_INV_SESSIONS_IN_PROGRESS';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'CREATE UNIQUE INDEX UK_PHYSICAL_INV_SESSIONS_IN_PROGRESS
      ON PHYSICAL_INV_SESSIONS (
        CASE
          WHEN "STATUS" = ''IN_PROGRESS''
          THEN NVL("COMPANY", '''') || ''||'' || NVL("PLANT", '''')
        END
      )';
  END IF;
END;
/
