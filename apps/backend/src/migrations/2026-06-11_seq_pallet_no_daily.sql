BEGIN
  /*
   * 2026-06-11: 팔레트번호 일별 시퀀스
   * 형식: PLT + YYMMDD + 4자리(SEQ_PALLET_NO_DAILY) — 하이픈 없음 (박스 BX 채번과 동일 패턴)
   * 예) PLT2606110001
   * 일별 리셋은 DBMS_SCHEDULER 잡(아래 블록)에서 매일 00:00 KST 처리.
   */
  EXECUTE IMMEDIATE q'[CREATE SEQUENCE SEQ_PALLET_NO_DAILY
    START WITH 1 INCREMENT BY 1 MAXVALUE 9999 NOCYCLE NOCACHE ORDER]';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE = -955 THEN NULL; -- ORA-00955: name already used
    ELSE RAISE;
    END IF;
END;
/

BEGIN
  BEGIN
    DBMS_SCHEDULER.DROP_JOB('JOB_RESET_PALLET_NO_DAILY', force => TRUE);
  EXCEPTION
    WHEN OTHERS THEN NULL;
  END;
  DBMS_SCHEDULER.CREATE_JOB(
    job_name        => 'JOB_RESET_PALLET_NO_DAILY',
    job_type        => 'PLSQL_BLOCK',
    job_action      => q'[BEGIN EXECUTE IMMEDIATE 'ALTER SEQUENCE SEQ_PALLET_NO_DAILY RESTART START WITH 1'; END;]',
    start_date      => TRUNC(SYSDATE) + 1,
    repeat_interval => 'FREQ=DAILY; BYHOUR=0; BYMINUTE=0; BYSECOND=0',
    enabled         => TRUE,
    comments        => 'Daily reset for pallet number sequence (PLT + YYMMDD + 4 digits)'
  );
END;
/
