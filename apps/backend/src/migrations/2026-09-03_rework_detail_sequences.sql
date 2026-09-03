-- 재작업 공정실적/재검사 상세의 COUNT+1 복합키 채번을 전역 시퀀스로 대체한다.
DECLARE
  PROCEDURE ensure_sequence(p_name VARCHAR2, p_table VARCHAR2) IS
    v_exists NUMBER;
    v_start NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_exists FROM USER_SEQUENCES WHERE SEQUENCE_NAME = p_name;
    IF v_exists = 0 THEN
      EXECUTE IMMEDIATE 'SELECT NVL(MAX(SEQ), 0) + 1 FROM ' || p_table INTO v_start;
      EXECUTE IMMEDIATE 'CREATE SEQUENCE ' || p_name || ' START WITH ' || v_start ||
                        ' INCREMENT BY 1 NOCYCLE NOCACHE';
    END IF;
  END;
BEGIN
  ensure_sequence('SEQ_REWORK_RESULT', 'REWORK_RESULTS');
  ensure_sequence('SEQ_REWORK_INSPECT', 'REWORK_INSPECTS');
END;
/
