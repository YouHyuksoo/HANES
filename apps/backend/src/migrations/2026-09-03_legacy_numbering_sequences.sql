-- NUM_RULE_MASTERS.CURRENT_SEQ 행 카운터를 전역 Oracle SEQUENCE로 대체한다.
-- 기존 번호 형식은 유지하고, 시작값은 현재 카운터 다음 값으로 잡는다.
DECLARE
  PROCEDURE ensure_sequence(p_name VARCHAR2, p_rule_type VARCHAR2) IS
    v_exists NUMBER;
    v_start NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_exists FROM USER_SEQUENCES WHERE SEQUENCE_NAME = p_name;
    IF v_exists = 0 THEN
      SELECT NVL(MAX(CURRENT_SEQ), 0) + 1 INTO v_start
        FROM NUM_RULE_MASTERS WHERE RULE_TYPE = p_rule_type AND USE_YN = 'Y';
      EXECUTE IMMEDIATE 'CREATE SEQUENCE ' || p_name || ' START WITH ' || v_start ||
                        ' INCREMENT BY 1 NOCYCLE NOCACHE';
    END IF;
  END;
BEGIN
  ensure_sequence('SEQ_LEGACY_ARRIVAL', 'ARRIVAL');
  ensure_sequence('SEQ_LEGACY_MAT_ISSUE', 'MAT_ISSUE');
  ensure_sequence('SEQ_LEGACY_STOCK_TX', 'STOCK_TX');
  ensure_sequence('SEQ_LEGACY_CANCEL_TX', 'CANCEL_TX');
  ensure_sequence('SEQ_LEGACY_RECEIVE', 'RECEIVE');
END;
/
