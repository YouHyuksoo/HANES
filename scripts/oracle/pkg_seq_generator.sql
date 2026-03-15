CREATE OR REPLACE PACKAGE PKG_SEQ_GENERATOR AS
  /* ================================================================
   * PKG_SEQ_GENERATOR - 통합 채번 패키지
   * 작성자  : 지성솔루션컨설팅
   * 작성일  : 2026-03-16
   * ================================================================
   * [AI 분석] 기능 설명:
   *   SEQ_RULES 마스터 테이블에서 문서유형별 채번 규칙을 조회하고
   *   Oracle 시퀀스 + 접두어 + 날짜를 조합하여 고유 번호를 생성한다.
   * ================================================================
   * 사용 예시:
   *   SELECT PKG_SEQ_GENERATOR.GET_NO('FG_BARCODE') FROM DUAL;
   *   -- 결과: FG260316-00001
   * ================================================================ */
  FUNCTION GET_NO(p_doc_type VARCHAR2) RETURN VARCHAR2;
END PKG_SEQ_GENERATOR;
/

CREATE OR REPLACE PACKAGE BODY PKG_SEQ_GENERATOR AS

  FUNCTION GET_NO(p_doc_type VARCHAR2) RETURN VARCHAR2 IS
    v_prefix      VARCHAR2(10);
    v_seq_name    VARCHAR2(30);
    v_pad_length  NUMBER(2);
    v_date_fmt    VARCHAR2(10);
    v_separator   VARCHAR2(2);
    v_seq         NUMBER;
    v_result      VARCHAR2(50);
  BEGIN
    -- [AI Step 1] 규칙 조회
    SELECT PREFIX, SEQ_NAME, PAD_LENGTH, DATE_FORMAT, NVL(SEPARATOR, '')
      INTO v_prefix, v_seq_name, v_pad_length, v_date_fmt, v_separator
      FROM SEQ_RULES
     WHERE DOC_TYPE = p_doc_type
       AND USE_YN = 'Y';

    -- [AI Step 2] 시퀀스 채번 (동적 SQL)
    EXECUTE IMMEDIATE 'SELECT ' || v_seq_name || '.NEXTVAL FROM DUAL' INTO v_seq;

    -- [AI Step 3] 번호 조합
    IF v_date_fmt IS NOT NULL THEN
      v_result := v_prefix || v_separator || TO_CHAR(SYSDATE, v_date_fmt) || v_separator || LPAD(v_seq, v_pad_length, '0');
    ELSE
      v_result := v_prefix || v_separator || LPAD(v_seq, v_pad_length, '0');
    END IF;

    RETURN v_result;

  EXCEPTION
    -- [AI] 등록되지 않은 문서유형 예외
    WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(-20001, 'SEQ_RULES에 등록되지 않은 문서유형: ' || p_doc_type);
  END GET_NO;

END PKG_SEQ_GENERATOR;
/
