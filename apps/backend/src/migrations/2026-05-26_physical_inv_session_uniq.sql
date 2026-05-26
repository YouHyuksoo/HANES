BEGIN
  /*
   * PHYSICAL_INV_SESSIONS: enforce single IN_PROGRESS row per (COMPANY, PLANT_CD).
   * 동시 두 사용자가 같은 사업장에서 점검을 동시 시작해도 DB 가 두 번째 INSERT 를
   * ORA-00001 으로 거절하도록 한다.
   * physical-inv.service.ts startSession() 의 race-safe 동작은 이 인덱스를 전제로 한다.
   * Safe to rerun: 이미 존재하는 인덱스는 ORA-00955 를 catch 하여 무시한다.
   */
  EXECUTE IMMEDIATE q'[CREATE UNIQUE INDEX UK_PHYSICAL_INV_SESSIONS_IN_PROGRESS ON PHYSICAL_INV_SESSIONS (CASE WHEN "STATUS" = 'IN_PROGRESS' THEN NVL("COMPANY", '') || '||' || NVL("PLANT_CD", '') END)]';
EXCEPTION
  WHEN OTHERS THEN
    -- ORA-00955: name is already used by an existing object → idempotent skip
    -- ORA-00942: PHYSICAL_INV_SESSIONS 테이블 부재 → skip (모듈 미배포 환경)
    IF SQLCODE IN (-955, -942) THEN
      NULL;
    ELSE
      RAISE;
    END IF;
END;
/
