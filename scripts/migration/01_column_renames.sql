-- ============================================================================
-- Phase 1: FK 컬럼 리네임 + PART_MASTERS 컬럼 리네임
-- ============================================================================
-- 안전: ALTER TABLE RENAME COLUMN은 데이터 손실 없음
-- 멱등성: 이미 변경된 경우 ORA-00957 에러 → PL/SQL로 무시 처리
-- ============================================================================

-- 헬퍼 프로시저: 컬럼 리네임 (이미 변경된 경우 무시)
CREATE OR REPLACE PROCEDURE safe_rename_column(
  p_table VARCHAR2, p_old_col VARCHAR2, p_new_col VARCHAR2
) IS
  v_cnt NUMBER;
BEGIN
  -- 이전 컬럼이 존재하는지 확인
  SELECT COUNT(*) INTO v_cnt
  FROM user_tab_columns
  WHERE table_name = UPPER(p_table) AND column_name = UPPER(p_old_col);

  IF v_cnt > 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table || ' RENAME COLUMN ' || p_old_col || ' TO ' || p_new_col;
    DBMS_OUTPUT.PUT_LINE('OK: ' || p_table || '.' || p_old_col || ' → ' || p_new_col);
  ELSE
    DBMS_OUTPUT.PUT_LINE('SKIP: ' || p_table || '.' || p_old_col || ' (not found or already renamed)');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('ERR: ' || p_table || '.' || p_old_col || ' → ' || SQLERRM);
END;
/

SET SERVEROUTPUT ON;

-- ============================================================================
-- 1-A. PART_MASTERS 테이블 자체 컬럼 리네임
-- ============================================================================
BEGIN
  safe_rename_column('PART_MASTERS', 'PART_CODE', 'ITEM_CODE');
  safe_rename_column('PART_MASTERS', 'PART_NAME', 'ITEM_NAME');
  safe_rename_column('PART_MASTERS', 'PART_TYPE', 'ITEM_TYPE');
END;
/

-- ============================================================================
-- 1-B. PART_ID → ITEM_CODE (품목 FK 리네임, ~22개 테이블)
-- ============================================================================
BEGIN
  -- 재고
  safe_rename_column('MAT_STOCKS',     'PART_ID', 'ITEM_CODE');
  safe_rename_column('STOCKS',         'PART_ID', 'ITEM_CODE');
  safe_rename_column('PRODUCT_STOCKS', 'PART_ID', 'ITEM_CODE');

  -- 트랜잭션
  safe_rename_column('STOCK_TRANSACTIONS',    'PART_ID', 'ITEM_CODE');
  safe_rename_column('PRODUCT_TRANSACTIONS',  'PART_ID', 'ITEM_CODE');
  safe_rename_column('MAT_ARRIVALS',          'PART_ID', 'ITEM_CODE');
  safe_rename_column('MAT_RECEIVINGS',        'PART_ID', 'ITEM_CODE');
  safe_rename_column('MAT_ISSUES',            'PART_ID', 'ITEM_CODE');
  safe_rename_column('INV_ADJ_LOGS',          'PART_ID', 'ITEM_CODE');

  -- 작업지시/생산
  safe_rename_column('JOB_ORDERS',            'PART_ID', 'ITEM_CODE');
  safe_rename_column('PROD_RESULTS',          'PART_ID', 'ITEM_CODE');
  safe_rename_column('LOTS',                  'PART_ID', 'ITEM_CODE');
  safe_rename_column('MAT_LOTS',              'PART_ID', 'ITEM_CODE');

  -- 발주/출하
  safe_rename_column('PURCHASE_ORDER_ITEMS',  'PART_ID', 'ITEM_CODE');
  safe_rename_column('CUSTOMER_ORDER_ITEMS',  'PART_ID', 'ITEM_CODE');
  safe_rename_column('SHIPMENT_ORDER_ITEMS',  'PART_ID', 'ITEM_CODE');
  safe_rename_column('SHIPMENT_RETURN_ITEMS', 'PART_ID', 'ITEM_CODE');

  -- 품질
  safe_rename_column('IQC_LOGS',              'PART_ID', 'ITEM_CODE');
  safe_rename_column('IQC_ITEM_MASTERS',      'PART_ID', 'ITEM_CODE');
  safe_rename_column('IQC_PART_LINKS',        'PART_ID', 'ITEM_CODE');
  safe_rename_column('OQC_REQUESTS',          'PART_ID', 'ITEM_CODE');

  -- 기타
  safe_rename_column('BOX_MASTERS',           'PART_ID', 'ITEM_CODE');
  safe_rename_column('PROCESS_MAPS',          'PART_ID', 'ITEM_CODE');
  safe_rename_column('WORK_INSTRUCTIONS',     'PART_ID', 'ITEM_CODE');
  safe_rename_column('MAT_ISSUE_REQUEST_ITEMS','PART_ID','ITEM_CODE');
END;
/

-- ============================================================================
-- 1-C. PART_TYPE → ITEM_TYPE (다른 테이블의 품목유형 컬럼)
-- ============================================================================
BEGIN
  safe_rename_column('LOTS',                  'PART_TYPE', 'ITEM_TYPE');
  safe_rename_column('PRODUCT_STOCKS',        'PART_TYPE', 'ITEM_TYPE');
  safe_rename_column('PRODUCT_TRANSACTIONS',  'PART_TYPE', 'ITEM_TYPE');
END;
/

-- ============================================================================
-- 1-D. PART_CODE/PART_NAME → ITEM_CODE/ITEM_NAME (다른 테이블)
-- ============================================================================
BEGIN
  -- CUSTOMS_LOTS
  safe_rename_column('CUSTOMS_LOTS',          'PART_CODE', 'ITEM_CODE');

  -- SUBCON_ORDERS
  safe_rename_column('SUBCON_ORDERS',         'PART_CODE', 'ITEM_CODE');
  safe_rename_column('SUBCON_ORDERS',         'PART_NAME', 'ITEM_NAME');

  -- VENDOR_BARCODE_MAPPINGS (PART_ID는 RAW 타입이므로 별도 처리)
  safe_rename_column('VENDOR_BARCODE_MAPPINGS','PART_CODE','ITEM_CODE');
  safe_rename_column('VENDOR_BARCODE_MAPPINGS','PART_NAME','ITEM_NAME');
  safe_rename_column('VENDOR_BARCODE_MAPPINGS','PART_ID',  'ITEM_ID');
END;
/

-- ============================================================================
-- 1-E. WAREHOUSE_ID → WAREHOUSE_CODE
-- ============================================================================
BEGIN
  safe_rename_column('STOCKS',              'WAREHOUSE_ID', 'WAREHOUSE_CODE');
  safe_rename_column('WAREHOUSE_LOCATIONS', 'WAREHOUSE_ID', 'WAREHOUSE_CODE');
END;
/

-- ============================================================================
-- 1-F. EQUIP_ID → EQUIP_CODE
-- ============================================================================
BEGIN
  safe_rename_column('EQUIP_BOM_RELS',              'EQUIP_ID', 'EQUIP_CODE');
  safe_rename_column('EQUIP_INSPECT_ITEM_MASTERS',  'EQUIP_ID', 'EQUIP_CODE');
  safe_rename_column('EQUIP_INSPECT_LOGS',          'EQUIP_ID', 'EQUIP_CODE');
  safe_rename_column('PM_PLANS',                    'EQUIP_ID', 'EQUIP_CODE');
  safe_rename_column('PM_WORK_ORDERS',              'EQUIP_ID', 'EQUIP_CODE');
  safe_rename_column('PROD_RESULTS',                'EQUIP_ID', 'EQUIP_CODE');
  safe_rename_column('TRACE_LOGS',                  'EQUIP_ID', 'EQUIP_CODE');
  safe_rename_column('CONSUMABLE_MOUNT_LOGS',       'EQUIP_ID', 'EQUIP_CODE');
END;
/

-- ============================================================================
-- 1-G. JOB_ORDER_ID → ORDER_NO
-- ============================================================================
BEGIN
  safe_rename_column('CUSTOMS_USAGE_REPORTS', 'JOB_ORDER_ID', 'ORDER_NO');
  safe_rename_column('LOTS',                  'JOB_ORDER_ID', 'ORDER_NO');
  safe_rename_column('MAT_ISSUES',            'JOB_ORDER_ID', 'ORDER_NO');
  safe_rename_column('MAT_ISSUE_REQUESTS',    'JOB_ORDER_ID', 'ORDER_NO');
  safe_rename_column('PRODUCT_STOCKS',        'JOB_ORDER_ID', 'ORDER_NO');
  safe_rename_column('PRODUCT_TRANSACTIONS',  'JOB_ORDER_ID', 'ORDER_NO');
  safe_rename_column('PROD_RESULTS',          'JOB_ORDER_ID', 'ORDER_NO');
END;
/

-- ============================================================================
-- 1-H. LOT_ID → LOT_NO (lotId FK 리네임)
-- ============================================================================
BEGIN
  safe_rename_column('INV_ADJ_LOGS',         'LOT_ID', 'LOT_NO');
  safe_rename_column('IQC_LOGS',             'LOT_ID', 'LOT_NO');
  safe_rename_column('MAT_ISSUES',           'LOT_ID', 'LOT_NO');
  safe_rename_column('STOCKS',               'LOT_ID', 'LOT_NO');
  safe_rename_column('STOCK_TRANSACTIONS',   'LOT_ID', 'LOT_NO');
  safe_rename_column('TRACE_LOGS',           'LOT_ID', 'LOT_NO');
  -- MAT_ARRIVALS, MAT_RECEIVINGS, MAT_STOCKS, PRODUCT_STOCKS, PRODUCT_TRANSACTIONS는
  -- 이미 LOT_NO 컬럼이 있거나 LOT_ID가 별도 의미를 가질 수 있음 → 확인 필요
END;
/

-- ============================================================================
-- 1-I. BOM_MASTERS 컬럼 리네임 (복합 PK)
-- ============================================================================
BEGIN
  safe_rename_column('BOM_MASTERS', 'PARENT_PART_CODE', 'PARENT_ITEM_CODE');
  safe_rename_column('BOM_MASTERS', 'CHILD_PART_CODE',  'CHILD_ITEM_CODE');
END;
/

-- ============================================================================
-- 1-J. EQUIP_BOM_ITEMS의 ITEM_CODE → BOM_ITEM_CODE (충돌 해소)
-- ============================================================================
BEGIN
  safe_rename_column('EQUIP_BOM_ITEMS', 'ITEM_CODE', 'BOM_ITEM_CODE');
  safe_rename_column('EQUIP_BOM_ITEMS', 'ITEM_NAME', 'BOM_ITEM_NAME');
  -- EQUIP_BOM_RELS의 FK도 변경
  safe_rename_column('EQUIP_BOM_RELS',  'BOM_ITEM_ID', 'BOM_ITEM_CODE');
END;
/

-- ============================================================================
-- 1-K. IQC_ITEM_POOL의 ITEM_CODE → INSP_ITEM_CODE (충돌 해소)
-- ============================================================================
BEGIN
  safe_rename_column('IQC_ITEM_POOL', 'ITEM_CODE', 'INSP_ITEM_CODE');
  safe_rename_column('IQC_ITEM_POOL', 'ITEM_NAME', 'INSP_ITEM_NAME');
END;
/

-- 헬퍼 프로시저 삭제
DROP PROCEDURE safe_rename_column;

COMMIT;

PROMPT '=== Phase 1 Complete: Column renames done ===';
