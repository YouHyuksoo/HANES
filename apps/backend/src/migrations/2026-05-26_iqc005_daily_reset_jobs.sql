BEGIN
  /*
   * 2026-05-26: IQC005 Phase A — 자정 시퀀스 리셋 (Oracle 12.2+ ALTER SEQUENCE RESTART)
   * SEQ_MAT_SERIAL_DAILY, SEQ_ARRIVAL_NO_DAILY 두 시퀀스를 매일 00:00 KST에 1부터 재시작.
   */
  BEGIN
    DBMS_SCHEDULER.DROP_JOB('JOB_RESET_MAT_SERIAL_DAILY', force => TRUE);
  EXCEPTION
    WHEN OTHERS THEN NULL;
  END;
  DBMS_SCHEDULER.CREATE_JOB(
    job_name        => 'JOB_RESET_MAT_SERIAL_DAILY',
    job_type        => 'PLSQL_BLOCK',
    job_action      => q'[BEGIN EXECUTE IMMEDIATE 'ALTER SEQUENCE SEQ_MAT_SERIAL_DAILY RESTART START WITH 1'; END;]',
    start_date      => TRUNC(SYSDATE) + 1,
    repeat_interval => 'FREQ=DAILY; BYHOUR=0; BYMINUTE=0; BYSECOND=0',
    enabled         => TRUE,
    comments        => 'IQC005 Phase A - daily reset for material serial sequence'
  );

  BEGIN
    DBMS_SCHEDULER.DROP_JOB('JOB_RESET_ARRIVAL_NO_DAILY', force => TRUE);
  EXCEPTION
    WHEN OTHERS THEN NULL;
  END;
  DBMS_SCHEDULER.CREATE_JOB(
    job_name        => 'JOB_RESET_ARRIVAL_NO_DAILY',
    job_type        => 'PLSQL_BLOCK',
    job_action      => q'[BEGIN EXECUTE IMMEDIATE 'ALTER SEQUENCE SEQ_ARRIVAL_NO_DAILY RESTART START WITH 1'; END;]',
    start_date      => TRUNC(SYSDATE) + 1,
    repeat_interval => 'FREQ=DAILY; BYHOUR=0; BYMINUTE=0; BYSECOND=0',
    enabled         => TRUE,
    comments        => 'IQC005 Phase A - daily reset for arrival number sequence'
  );
END;
/
