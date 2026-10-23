-- 입고 스캔 BL 방식 — 업체LOT 대신 BL 번호를 한 번 찍고 여러 자재를 같은 BL 로 입고한다
-- VENDOR_BARCODE(업체 LOT, LOT 당 1회만 사용)와 별개 컬럼이다. BL_NO 는 여러 입고 행이 공유한다.
-- 대상: JSHANES. 멱등(존재 확인 후 추가).
-- 실행: python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file <this file>
-- 적용 후: ORACLE_SITE=JSHANES python tools/generate_db_schema_doc.py

DECLARE
  n NUMBER;
BEGIN
  SELECT COUNT(*) INTO n FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'MAT_RECEIVINGS' AND COLUMN_NAME = 'BL_NO';
  IF n = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE MAT_RECEIVINGS ADD (BL_NO VARCHAR2(50))';
  END IF;
  EXECUTE IMMEDIATE q'[COMMENT ON COLUMN MAT_RECEIVINGS.BL_NO IS 'BL(선하증권) 번호 — 입고 스캔 BL 방식에서 한 번 찍어 여러 자재에 공유. 업체LOT(VENDOR_BARCODE)와 별개']';
  SELECT COUNT(*) INTO n FROM USER_INDEXES WHERE INDEX_NAME = 'IX_MAT_RECEIVINGS_BL_NO';
  IF n = 0 THEN
    EXECUTE IMMEDIATE 'CREATE INDEX IX_MAT_RECEIVINGS_BL_NO ON MAT_RECEIVINGS (COMPANY, PLANT_CD, BL_NO)';
  END IF;
END;
/
