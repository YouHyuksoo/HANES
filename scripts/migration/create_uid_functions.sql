-- ================================================================
-- UID 채번 시퀀스 및 Function 생성
-- matUid (자재시리얼), prdUid (제품시리얼)
-- ================================================================

-- 시퀀스 생성
CREATE SEQUENCE MAT_UID_SEQ START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE PRD_UID_SEQ START WITH 1 INCREMENT BY 1 NOCACHE;

-- F_GET_MAT_UID: 자재시리얼 채번 (예: M25022700001)
CREATE OR REPLACE FUNCTION F_GET_MAT_UID RETURN VARCHAR2 IS
  v_seq NUMBER;
  v_prefix VARCHAR2(10);
BEGIN
  v_prefix := 'M' || TO_CHAR(SYSDATE, 'YYMMDD');
  SELECT MAT_UID_SEQ.NEXTVAL INTO v_seq FROM DUAL;
  RETURN v_prefix || LPAD(v_seq, 5, '0');
END;
/

-- F_GET_PRD_UID: 제품시리얼 채번 (예: P25022700001)
CREATE OR REPLACE FUNCTION F_GET_PRD_UID RETURN VARCHAR2 IS
  v_seq NUMBER;
  v_prefix VARCHAR2(10);
BEGIN
  v_prefix := 'P' || TO_CHAR(SYSDATE, 'YYMMDD');
  SELECT PRD_UID_SEQ.NEXTVAL INTO v_seq FROM DUAL;
  RETURN v_prefix || LPAD(v_seq, 5, '0');
END;
/
