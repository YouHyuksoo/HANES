-- =====================================================================
-- 2026-06-08  IQC 검사결과 등록: 시료 바코드(시리얼) 컬럼 추가
-- IQC_LOGS.SAMPLE_BARCODE — 검사 시료의 바코드/시리얼(입력·스캔), 여러 개는 콤마 구분
-- 멱등 실행(ORA-01430 이미 존재 시 무시)
-- 대상: JSHANES (company=40 / plant=1000)
-- =====================================================================

BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE "IQC_LOGS" ADD ("SAMPLE_BARCODE" VARCHAR2(500) DEFAULT NULL NULL)';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -1430 THEN RAISE; END IF; -- -1430: column already exists
END;
/
