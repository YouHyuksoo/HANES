DECLARE
  v_worker_count NUMBER := 0;
BEGIN
  -- Backfill legacy special-accept lots that were approved before worker capture became mandatory.
  -- The current ConcessionService already requires SPECIAL_ACCEPT_WORKER_CODE for new approvals.
  SELECT COUNT(*)
    INTO v_worker_count
    FROM WORKER_MASTERS
   WHERE COMPANY = '40'
     AND PLANT_CD = '1000'
     AND WORKER_CODE = 'KS_WK_QC'
     AND USE_YN = 'Y';

  IF v_worker_count > 0 THEN
    UPDATE MAT_LOTS
       SET SPECIAL_ACCEPT_WORKER_CODE = 'KS_WK_QC',
           UPDATED_BY = COALESCE(UPDATED_BY, 'codex'),
           UPDATED_AT = SYSTIMESTAMP
     WHERE COMPANY = '40'
       AND PLANT_CD = '1000'
       AND SPECIAL_ACCEPT_YN = 'Y'
       AND IQC_STATUS = 'FAIL'
       AND SPECIAL_ACCEPT_WORKER_CODE IS NULL;
  END IF;

  COMMIT;
END;
/
