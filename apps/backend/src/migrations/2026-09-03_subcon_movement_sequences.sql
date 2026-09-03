-- 외주 출고/입고 COUNT+1 채번을 전역 Oracle SEQUENCE로 대체한다.
DECLARE
  PROCEDURE ensure_sequence(p_name VARCHAR2, p_table VARCHAR2, p_column VARCHAR2) IS
    v_exists NUMBER;
    v_start NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_exists FROM USER_SEQUENCES WHERE SEQUENCE_NAME = p_name;
    IF v_exists = 0 THEN
      EXECUTE IMMEDIATE 'SELECT NVL(MAX(TO_NUMBER(SUBSTR(' || p_column || ', -4))), 0) + 1 FROM ' ||
                        p_table || ' WHERE REGEXP_LIKE(' || p_column || ', ''^[A-Z]{3}[0-9]{12}$'')' INTO v_start;
      EXECUTE IMMEDIATE 'CREATE SEQUENCE ' || p_name || ' START WITH ' || v_start ||
                        ' INCREMENT BY 1 NOCYCLE NOCACHE';
    END IF;
  END;
BEGIN
  ensure_sequence('SEQ_SUBCON_DELIVERY', 'SUBCON_DELIVERIES', 'DELIVERY_NO');
  ensure_sequence('SEQ_SUBCON_RECEIVE', 'SUBCON_RECEIVES', 'RECEIVE_NO');
END;
/
