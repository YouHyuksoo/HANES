-- =====================================================================
-- 2026-06-21 IQC 템플릿 항목에 검사기준 컬럼 추가
-- 목적: IQC_PART_SPEC_ITEMS 와 동일하게 템플릿 항목도 불량등급/검사수준/
--       AQL/검사유형/샘플방식/고정샘플수를 저장하도록 정합화.
-- 대상: JSHANES (기본 사이트)
-- 멱등: USER_TAB_COLUMNS 로 컬럼 존재 여부 확인 후 ADD.
-- =====================================================================
DECLARE
  PROCEDURE add_col_if_absent(p_col VARCHAR2, p_def VARCHAR2) IS
    v_cnt NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_cnt
      FROM USER_TAB_COLUMNS
     WHERE TABLE_NAME = 'IQC_TEMPLATE_ITEMS'
       AND COLUMN_NAME = p_col;
    IF v_cnt = 0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE IQC_TEMPLATE_ITEMS ADD (' || p_col || ' ' || p_def || ')';
    END IF;
  END;
BEGIN
  add_col_if_absent('DEFECT_GRADE',     'VARCHAR2(10)');
  add_col_if_absent('INSPECTION_LEVEL', 'VARCHAR2(5)');
  add_col_if_absent('AQL',              'NUMBER');
  add_col_if_absent('INSPECTION_TYPE',  'VARCHAR2(12)');
  add_col_if_absent('SAMPLE_METHOD',    'VARCHAR2(8)');
  add_col_if_absent('SAMPLE_QTY',       'NUMBER');
END;
/
