DECLARE
  v_count NUMBER;
  -- 소모품 출고를 창고에서 공정대기, 설비장착 흐름으로 분리한다.
  -- 기존 데이터는 수정하지 않고 신규 출고와 장착부터 PROCESS_CODE를 기록한다.

  PROCEDURE add_column_if_missing(
    p_table_name  IN VARCHAR2,
    p_column_name IN VARCHAR2,
    p_ddl         IN VARCHAR2
  ) IS
  BEGIN
    SELECT COUNT(*)
      INTO v_count
      FROM USER_TAB_COLUMNS
     WHERE TABLE_NAME = UPPER(p_table_name)
       AND COLUMN_NAME = UPPER(p_column_name);

    IF v_count = 0 THEN
      EXECUTE IMMEDIATE p_ddl;
    END IF;
  END;

  PROCEDURE add_index_if_missing(
    p_index_name IN VARCHAR2,
    p_ddl        IN VARCHAR2
  ) IS
  BEGIN
    SELECT COUNT(*)
      INTO v_count
      FROM USER_INDEXES
     WHERE INDEX_NAME = UPPER(p_index_name);

    IF v_count = 0 THEN
      EXECUTE IMMEDIATE p_ddl;
    END IF;
  END;
BEGIN
  add_column_if_missing(
    'CONSUMABLE_STOCKS',
    'PROCESS_CODE',
    'ALTER TABLE CONSUMABLE_STOCKS ADD (PROCESS_CODE VARCHAR2(50))'
  );

  add_column_if_missing(
    'CONSUMABLE_LOGS',
    'PROCESS_CODE',
    'ALTER TABLE CONSUMABLE_LOGS ADD (PROCESS_CODE VARCHAR2(50))'
  );

  add_index_if_missing(
    'IX_CONSUMABLE_STOCKS_PROC',
    'CREATE INDEX IX_CONSUMABLE_STOCKS_PROC ON CONSUMABLE_STOCKS (COMPANY, PLANT_CD, PROCESS_CODE, STATUS)'
  );

  add_index_if_missing(
    'IX_CONSUMABLE_LOGS_PROC',
    'CREATE INDEX IX_CONSUMABLE_LOGS_PROC ON CONSUMABLE_LOGS (COMPANY, PLANT_CD, PROCESS_CODE, LOG_TYPE)'
  );

  EXECUTE IMMEDIATE q'[COMMENT ON COLUMN CONSUMABLE_STOCKS.PROCESS_CODE IS '소모품이 출고되어 대기 중인 공정 코드. STATUS=PROC_WAIT 또는 MOUNTED에서 사용']';
  EXECUTE IMMEDIATE q'[COMMENT ON COLUMN CONSUMABLE_LOGS.PROCESS_CODE IS '소모품 입출고와 장착 관련 이력의 공정 코드']';
END;
/
