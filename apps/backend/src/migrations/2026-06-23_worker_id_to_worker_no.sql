DECLARE
  v_index_count NUMBER := 0;

  PROCEDURE rename_worker_column(p_table_name IN VARCHAR2) IS
    v_worker_id_count NUMBER := 0;
    v_worker_no_count NUMBER := 0;
  BEGIN
    SELECT COUNT(*)
      INTO v_worker_id_count
      FROM USER_TAB_COLUMNS
     WHERE TABLE_NAME = p_table_name
       AND COLUMN_NAME = 'WORKER_ID';

    SELECT COUNT(*)
      INTO v_worker_no_count
      FROM USER_TAB_COLUMNS
     WHERE TABLE_NAME = p_table_name
       AND COLUMN_NAME = 'WORKER_NO';

    IF v_worker_id_count = 1 AND v_worker_no_count = 0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table_name || ' RENAME COLUMN WORKER_ID TO WORKER_NO';
    END IF;

    SELECT COUNT(*)
      INTO v_worker_no_count
      FROM USER_TAB_COLUMNS
     WHERE TABLE_NAME = p_table_name
       AND COLUMN_NAME = 'WORKER_NO';

    IF v_worker_no_count = 1 THEN
      EXECUTE IMMEDIATE 'COMMENT ON COLUMN ' || p_table_name || q'[.WORKER_NO IS '작업자번호/코드 (WORKER_MASTERS.WORKER_CODE 참조)']';
    END IF;
  END;
BEGIN
  rename_worker_column('CONSUMABLE_LOGS');
  rename_worker_column('CONSUMABLE_MOUNT_LOGS');
  rename_worker_column('CUSTOMS_USAGE_REPORTS');
  rename_worker_column('FG_LABELS');
  rename_worker_column('LABEL_PRINT_LOGS');
  rename_worker_column('MAT_ARRIVALS');
  rename_worker_column('MAT_ARRIVAL_TRANSACTIONS');
  rename_worker_column('MAT_ISSUES');
  rename_worker_column('MAT_RECEIVINGS');
  rename_worker_column('PRODUCT_TRANSACTIONS');
  rename_worker_column('PROD_RESULTS');
  rename_worker_column('REPAIR_LOGS');
  rename_worker_column('REPAIR_ORDERS');
  rename_worker_column('SG_LABELS');
  rename_worker_column('STOCK_TRANSACTIONS');
  rename_worker_column('STOCK_TRANSACTIONS_BAK_20260616');
  rename_worker_column('SUBCON_DELIVERIES');
  rename_worker_column('SUBCON_RECEIVES');
  rename_worker_column('TRACE_LOGS');
  rename_worker_column('WIP_MAT_TRANSACTIONS');

  SELECT COUNT(*)
    INTO v_index_count
    FROM USER_INDEXES
   WHERE INDEX_NAME = 'IDX_REPAIR_ORDERS_WORKER';

  IF v_index_count = 1 THEN
    EXECUTE IMMEDIATE 'ALTER INDEX IDX_REPAIR_ORDERS_WORKER RENAME TO IDX_REPAIR_ORDERS_WORKER_NO';
  END IF;
END;
/
