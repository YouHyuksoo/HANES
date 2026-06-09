DECLARE
  v_arrival_no MAT_ARRIVALS.ARRIVAL_NO%TYPE;
  v_seq MAT_ARRIVALS.SEQ%TYPE;
  v_mat_uid MAT_LOTS.MAT_UID%TYPE;

  PROCEDURE add_receivable_lot(
    p_item_code IN MAT_LOTS.ITEM_CODE%TYPE,
    p_qty IN NUMBER,
    p_cert_required IN VARCHAR2
  ) IS
  BEGIN
    v_seq := SEQ_MAT_ARRIVALS.NEXTVAL;
    v_mat_uid := 'RECV-TEST-260608-' || LPAD(MAT_UID_SEQ.NEXTVAL, 5, '0');

    INSERT INTO MAT_ARRIVALS (
      ARRIVAL_NO, SEQ, VENDOR_ID, VENDOR_NAME, ITEM_CODE, QTY, WAREHOUSE_CODE,
      ARRIVAL_DATE, ARRIVAL_TYPE, STATUS, IQC_STATUS, REMARK,
      COMPANY, PLANT_CD, CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT
    ) VALUES (
      v_arrival_no, v_seq, 'V-TEST', '입고테스트거래처', p_item_code, p_qty, 'WH-MAT-A',
      SYSTIMESTAMP, 'MANUAL', 'DONE', 'PASS', '자재입고 화면 테스트 데이터',
      '40', '1000', 'codex', 'codex', SYSTIMESTAMP, SYSTIMESTAMP
    );

    INSERT INTO MAT_LOTS (
      MAT_UID, ITEM_CODE, INIT_QTY, CURRENT_QTY, RECV_DATE, ORIGIN, VENDOR,
      IQC_STATUS, STATUS, COMPANY, PLANT_CD, CREATED_BY, UPDATED_BY,
      CREATED_AT, UPDATED_AT, MANUFACTURE_DATE, ARRIVAL_NO, ARRIVAL_SEQ,
      MFG_PARTNER_CODE
    ) VALUES (
      v_mat_uid, p_item_code, p_qty, p_qty, SYSDATE, 'RECEIVE_TEST', '입고테스트거래처',
      'PASS', 'NORMAL', '40', '1000', 'codex', 'codex',
      SYSTIMESTAMP, SYSTIMESTAMP, TRUNC(SYSDATE), v_arrival_no, v_seq,
      'M-TEST'
    );

    INSERT INTO IQC_LOGS (
      INSPECT_DATE, SEQ, ARRIVAL_NO, MAT_UID, ITEM_CODE, INSPECT_TYPE, RESULT,
      DETAILS, INSPECTOR_NAME, REMARK, COMPANY, PLANT_CD, CREATED_BY, UPDATED_BY,
      CREATED_AT, UPDATED_AT, STATUS, INSPECT_CLASS, DESTRUCT_SAMPLE_QTY, CERT_FILE_PATH
    ) VALUES (
      SYSTIMESTAMP, SEQ_IQC_LOGS.NEXTVAL, v_arrival_no, NULL, p_item_code, 'INITIAL', 'PASS',
      '[{"inspectItem":"입고 테스트 샘플 검사","measuredValue":"PASS","judge":"PASS"}]',
      'codex', '자재입고 화면 테스트용 PASS 데이터', '40', '1000', 'codex', 'codex',
      SYSTIMESTAMP, SYSTIMESTAMP, 'DONE', 'SAMPLE', 0,
      CASE WHEN p_cert_required = 'Y'
        THEN 'C:\Project\HANES\apps\backend\uploads\iqc-certs\receive-test-cert.txt'
        ELSE NULL
      END
    );
  END;
BEGIN
  v_arrival_no := 'RCVT260608' || LPAD(SEQ_ARRIVAL_NO_DAILY.NEXTVAL, 5, '0');

  add_receivable_lot('CBL-A', 12, 'Y');
  add_receivable_lot('CNTR001', 8, 'Y');
  add_receivable_lot('APPCT-A', 5, 'N');

  COMMIT;
END;
/
