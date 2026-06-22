DECLARE
  FUNCTION column_exists(p_table_name VARCHAR2, p_column_name VARCHAR2) RETURN BOOLEAN IS
    v_count NUMBER;
  BEGIN
    SELECT COUNT(*)
      INTO v_count
      FROM USER_TAB_COLUMNS
     WHERE TABLE_NAME = UPPER(p_table_name)
       AND COLUMN_NAME = UPPER(p_column_name);
    RETURN v_count > 0;
  END;

  FUNCTION index_exists(p_index_name VARCHAR2) RETURN BOOLEAN IS
    v_count NUMBER;
  BEGIN
    SELECT COUNT(*)
      INTO v_count
      FROM USER_INDEXES
     WHERE INDEX_NAME = UPPER(p_index_name);
    RETURN v_count > 0;
  END;

  PROCEDURE rename_vendor_column(p_table_name VARCHAR2) IS
  BEGIN
    IF column_exists(p_table_name, 'VENDOR_ID') AND NOT column_exists(p_table_name, 'VENDOR_CODE') THEN
      EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table_name || ' RENAME COLUMN VENDOR_ID TO VENDOR_CODE';
    ELSIF column_exists(p_table_name, 'VENDOR_ID') AND column_exists(p_table_name, 'VENDOR_CODE') THEN
      RAISE_APPLICATION_ERROR(-20001, p_table_name || ' has both VENDOR_ID and VENDOR_CODE columns.');
    END IF;
  END;
BEGIN
  rename_vendor_column('MAT_ARRIVALS');
  rename_vendor_column('SUBCON_ORDERS');
  rename_vendor_column('WAREHOUSES');

  IF index_exists('IDX_MAT_ARRIVALS_VENDOR_ID') AND NOT index_exists('IDX_MAT_ARRIVALS_VENDOR_CODE') THEN
    EXECUTE IMMEDIATE 'ALTER INDEX IDX_MAT_ARRIVALS_VENDOR_ID RENAME TO IDX_MAT_ARRIVALS_VENDOR_CODE';
  ELSIF NOT index_exists('IDX_MAT_ARRIVALS_VENDOR_ID') AND NOT index_exists('IDX_MAT_ARRIVALS_VENDOR_CODE') THEN
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_MAT_ARRIVALS_VENDOR_CODE ON MAT_ARRIVALS (VENDOR_CODE)';
  END IF;

  IF column_exists('MAT_ARRIVALS', 'VENDOR_CODE') THEN
    EXECUTE IMMEDIATE q'[COMMENT ON COLUMN MAT_ARRIVALS.VENDOR_CODE IS '공급업체코드 (VENDOR_MASTERS.VENDOR_CODE)']';
  END IF;

  IF column_exists('SUBCON_ORDERS', 'VENDOR_CODE') THEN
    EXECUTE IMMEDIATE q'[COMMENT ON COLUMN SUBCON_ORDERS.VENDOR_CODE IS '외주업체코드 (VENDOR_MASTERS.VENDOR_CODE)']';
  END IF;

  IF column_exists('WAREHOUSES', 'VENDOR_CODE') THEN
    EXECUTE IMMEDIATE q'[COMMENT ON COLUMN WAREHOUSES.VENDOR_CODE IS '공급업체코드 (외주창고용)']';
  END IF;
END;
/
