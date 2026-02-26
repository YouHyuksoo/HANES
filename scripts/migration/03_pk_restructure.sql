-- ============================================================================
-- Phase 3: PK 재구조화 (UUID PK → 자연키 PK / SEQUENCE PK)
-- ============================================================================
-- 위험도 높음: PK 변경은 되돌리기 어려우므로 반드시 백업 후 실행
-- ============================================================================

SET SERVEROUTPUT ON;

-- 헬퍼: PK를 자연키로 변경 (마스터 테이블용)
CREATE OR REPLACE PROCEDURE swap_pk_to_natural(
  p_table VARCHAR2, p_natural_col VARCHAR2
) IS
  v_pk_name VARCHAR2(200);
  v_uq_name VARCHAR2(200);
  v_pk_col  VARCHAR2(200);
BEGIN
  -- 현재 PK 컬럼 확인
  BEGIN
    SELECT uc.constraint_name, ucc.column_name
    INTO v_pk_name, v_pk_col
    FROM user_constraints uc
    JOIN user_cons_columns ucc ON uc.constraint_name = ucc.constraint_name
    WHERE uc.table_name = UPPER(p_table) AND uc.constraint_type = 'P'
    AND ROWNUM = 1;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      DBMS_OUTPUT.PUT_LINE('SKIP: ' || p_table || ' has no PK');
      RETURN;
  END;

  -- 이미 자연키가 PK인 경우 스킵
  IF v_pk_col = UPPER(p_natural_col) THEN
    DBMS_OUTPUT.PUT_LINE('SKIP: ' || p_table || ' PK already = ' || p_natural_col);
    RETURN;
  END IF;

  -- 기존 UNIQUE 제약조건 삭제 (자연키 컬럼의 UQ)
  BEGIN
    SELECT uc.constraint_name INTO v_uq_name
    FROM user_constraints uc
    JOIN user_cons_columns ucc ON uc.constraint_name = ucc.constraint_name
    WHERE uc.table_name = UPPER(p_table) AND uc.constraint_type = 'U'
    AND ucc.column_name = UPPER(p_natural_col) AND ROWNUM = 1;

    EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table || ' DROP CONSTRAINT ' || v_uq_name;
    DBMS_OUTPUT.PUT_LINE('  Dropped UQ: ' || v_uq_name);
  EXCEPTION
    WHEN NO_DATA_FOUND THEN NULL;
  END;

  -- 기존 PK 삭제
  EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table || ' DROP CONSTRAINT ' || v_pk_name;
  DBMS_OUTPUT.PUT_LINE('  Dropped PK: ' || v_pk_name);

  -- 새 PK 추가 (자연키 컬럼)
  EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table ||
    ' ADD CONSTRAINT PK_' || p_table || ' PRIMARY KEY (' || p_natural_col || ')';
  DBMS_OUTPUT.PUT_LINE('OK: ' || p_table || ' PK = ' || p_natural_col);

EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('ERR: ' || p_table || ' → ' || SQLERRM);
END;
/

-- ============================================================================
-- 3-A. 마스터 테이블: UUID PK → 자연키 PK
-- ============================================================================
BEGIN
  DBMS_OUTPUT.PUT_LINE('--- Master Tables: UUID → Natural Key ---');
  -- 기본 마스터
  swap_pk_to_natural('ITEM_MASTERS',     'ITEM_CODE');     -- 구 PART_MASTERS
  swap_pk_to_natural('WAREHOUSES',       'WAREHOUSE_CODE');
  swap_pk_to_natural('EQUIP_MASTERS',    'EQUIP_CODE');
  swap_pk_to_natural('PROCESS_MASTERS',  'PROCESS_CODE');
  swap_pk_to_natural('WORKER_MASTERS',   'WORKER_CODE');
  swap_pk_to_natural('DEPARTMENT_MASTERS','DEPT_CODE');
  swap_pk_to_natural('PARTNER_MASTERS',  'PARTNER_CODE');
  swap_pk_to_natural('PROD_LINE_MASTERS','LINE_CODE');
  swap_pk_to_natural('CONSUMABLE_MASTERS','CONSUMABLE_CODE');

  -- 문서/주문 마스터
  swap_pk_to_natural('PURCHASE_ORDERS',  'PO_NO');
  swap_pk_to_natural('CUSTOMER_ORDERS',  'ORDER_NO');
  swap_pk_to_natural('JOB_ORDERS',       'ORDER_NO');
  swap_pk_to_natural('SHIPMENT_ORDERS',  'SHIP_ORDER_NO');
  swap_pk_to_natural('SUBCON_ORDERS',    'ORDER_NO');

  -- 기타 자연키 마스터
  swap_pk_to_natural('MAT_LOTS',         'LOT_NO');
  swap_pk_to_natural('BOX_MASTERS',      'BOX_NO');
  swap_pk_to_natural('PALLET_MASTERS',   'PALLET_NO');
  swap_pk_to_natural('OQC_REQUESTS',     'REQUEST_NO');
  swap_pk_to_natural('PM_PLANS',         'PLAN_CODE');
  swap_pk_to_natural('EQUIP_BOM_ITEMS',  'BOM_ITEM_CODE');
  swap_pk_to_natural('NUM_RULE_MASTERS', 'RULE_TYPE');
  swap_pk_to_natural('SYS_CONFIGS',      'CONFIG_KEY');
  swap_pk_to_natural('USERS',            'EMAIL');
END;
/

-- ============================================================================
-- 3-B. ROLES 테이블: NUMBER PK → CODE 자연키 PK
-- ============================================================================
BEGIN
  swap_pk_to_natural('ROLES', 'CODE');
END;
/

-- ============================================================================
-- 3-C. 복합 PK 테이블
-- ============================================================================

-- BOM_MASTERS: ID → (PARENT_ITEM_CODE, CHILD_ITEM_CODE, REVISION)
DECLARE
  v_pk_name VARCHAR2(200);
  v_pk_col  VARCHAR2(200);
BEGIN
  SELECT uc.constraint_name, ucc.column_name
  INTO v_pk_name, v_pk_col
  FROM user_constraints uc
  JOIN user_cons_columns ucc ON uc.constraint_name = ucc.constraint_name
  WHERE uc.table_name = 'BOM_MASTERS' AND uc.constraint_type = 'P'
  AND ROWNUM = 1;

  IF v_pk_col = 'ID' THEN
    EXECUTE IMMEDIATE 'ALTER TABLE BOM_MASTERS DROP CONSTRAINT ' || v_pk_name;
    EXECUTE IMMEDIATE 'ALTER TABLE BOM_MASTERS ADD CONSTRAINT PK_BOM_MASTERS PRIMARY KEY (PARENT_ITEM_CODE, CHILD_ITEM_CODE, REVISION)';
    DBMS_OUTPUT.PUT_LINE('OK: BOM_MASTERS PK = (PARENT_ITEM_CODE, CHILD_ITEM_CODE, REVISION)');
  ELSE
    DBMS_OUTPUT.PUT_LINE('SKIP: BOM_MASTERS PK already changed');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('ERR: BOM_MASTERS → ' || SQLERRM);
END;
/

-- COM_CODES: ID → (GROUP_CODE, DETAIL_CODE)
DECLARE
  v_pk_name VARCHAR2(200);
  v_pk_col  VARCHAR2(200);
BEGIN
  SELECT uc.constraint_name, ucc.column_name
  INTO v_pk_name, v_pk_col
  FROM user_constraints uc
  JOIN user_cons_columns ucc ON uc.constraint_name = ucc.constraint_name
  WHERE uc.table_name = 'COM_CODES' AND uc.constraint_type = 'P'
  AND ROWNUM = 1;

  IF v_pk_col = 'ID' THEN
    EXECUTE IMMEDIATE 'ALTER TABLE COM_CODES DROP CONSTRAINT ' || v_pk_name;
    EXECUTE IMMEDIATE 'ALTER TABLE COM_CODES ADD CONSTRAINT PK_COM_CODES PRIMARY KEY (GROUP_CODE, DETAIL_CODE)';
    DBMS_OUTPUT.PUT_LINE('OK: COM_CODES PK = (GROUP_CODE, DETAIL_CODE)');
  ELSE
    DBMS_OUTPUT.PUT_LINE('SKIP: COM_CODES PK already changed');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('ERR: COM_CODES → ' || SQLERRM);
END;
/

-- COMPANY_MASTERS: ID → (COMPANY_CODE, PLANT_CD)
DECLARE
  v_pk_name VARCHAR2(200);
  v_pk_col  VARCHAR2(200);
BEGIN
  SELECT uc.constraint_name, ucc.column_name
  INTO v_pk_name, v_pk_col
  FROM user_constraints uc
  JOIN user_cons_columns ucc ON uc.constraint_name = ucc.constraint_name
  WHERE uc.table_name = 'COMPANY_MASTERS' AND uc.constraint_type = 'P'
  AND ROWNUM = 1;

  IF v_pk_col = 'ID' THEN
    EXECUTE IMMEDIATE 'ALTER TABLE COMPANY_MASTERS DROP CONSTRAINT ' || v_pk_name;
    EXECUTE IMMEDIATE 'ALTER TABLE COMPANY_MASTERS ADD CONSTRAINT PK_COMPANY_MASTERS PRIMARY KEY (COMPANY_CODE, PLANT_CD)';
    DBMS_OUTPUT.PUT_LINE('OK: COMPANY_MASTERS PK = (COMPANY_CODE, PLANT_CD)');
  ELSE
    DBMS_OUTPUT.PUT_LINE('SKIP: COMPANY_MASTERS PK already changed');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('ERR: COMPANY_MASTERS → ' || SQLERRM);
END;
/

-- COMM_CONFIGS: ID → CONFIG_NAME
BEGIN
  swap_pk_to_natural('COMM_CONFIGS', 'CONFIG_NAME');
END;
/

-- MAT_STOCKS: ID → (WAREHOUSE_CODE, ITEM_CODE, LOT_NO)
DECLARE
  v_pk_name VARCHAR2(200);
  v_pk_col  VARCHAR2(200);
BEGIN
  SELECT uc.constraint_name, ucc.column_name
  INTO v_pk_name, v_pk_col
  FROM user_constraints uc
  JOIN user_cons_columns ucc ON uc.constraint_name = ucc.constraint_name
  WHERE uc.table_name = 'MAT_STOCKS' AND uc.constraint_type = 'P'
  AND ROWNUM = 1;

  IF v_pk_col = 'ID' THEN
    EXECUTE IMMEDIATE 'ALTER TABLE MAT_STOCKS DROP CONSTRAINT ' || v_pk_name;
    EXECUTE IMMEDIATE 'ALTER TABLE MAT_STOCKS ADD CONSTRAINT PK_MAT_STOCKS PRIMARY KEY (WAREHOUSE_CODE, ITEM_CODE, LOT_NO)';
    DBMS_OUTPUT.PUT_LINE('OK: MAT_STOCKS PK = (WAREHOUSE_CODE, ITEM_CODE, LOT_NO)');
  ELSE
    DBMS_OUTPUT.PUT_LINE('SKIP: MAT_STOCKS PK already changed');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('ERR: MAT_STOCKS → ' || SQLERRM);
END;
/

-- PRODUCT_STOCKS: ID → (WAREHOUSE_CODE, ITEM_CODE, LOT_NO)
DECLARE
  v_pk_name VARCHAR2(200);
  v_pk_col  VARCHAR2(200);
  v_uq_name VARCHAR2(200);
BEGIN
  SELECT uc.constraint_name, ucc.column_name
  INTO v_pk_name, v_pk_col
  FROM user_constraints uc
  JOIN user_cons_columns ucc ON uc.constraint_name = ucc.constraint_name
  WHERE uc.table_name = 'PRODUCT_STOCKS' AND uc.constraint_type = 'P'
  AND ROWNUM = 1;

  IF v_pk_col = 'ID' THEN
    -- 기존 UQ 제약조건 삭제
    BEGIN
      SELECT constraint_name INTO v_uq_name
      FROM user_constraints
      WHERE table_name = 'PRODUCT_STOCKS' AND constraint_type = 'U' AND ROWNUM = 1;
      EXECUTE IMMEDIATE 'ALTER TABLE PRODUCT_STOCKS DROP CONSTRAINT ' || v_uq_name;
    EXCEPTION WHEN NO_DATA_FOUND THEN NULL;
    END;

    EXECUTE IMMEDIATE 'ALTER TABLE PRODUCT_STOCKS DROP CONSTRAINT ' || v_pk_name;
    EXECUTE IMMEDIATE 'ALTER TABLE PRODUCT_STOCKS ADD CONSTRAINT PK_PRODUCT_STOCKS_NEW PRIMARY KEY (WAREHOUSE_CODE, ITEM_CODE, LOT_NO)';
    DBMS_OUTPUT.PUT_LINE('OK: PRODUCT_STOCKS PK = (WAREHOUSE_CODE, ITEM_CODE, LOT_NO)');
  ELSE
    DBMS_OUTPUT.PUT_LINE('SKIP: PRODUCT_STOCKS PK already changed');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('ERR: PRODUCT_STOCKS → ' || SQLERRM);
END;
/

-- WAREHOUSE_LOCATIONS: ID → (WAREHOUSE_CODE, LOCATION_CODE)
DECLARE
  v_pk_name VARCHAR2(200);
  v_pk_col  VARCHAR2(200);
BEGIN
  SELECT uc.constraint_name, ucc.column_name
  INTO v_pk_name, v_pk_col
  FROM user_constraints uc
  JOIN user_cons_columns ucc ON uc.constraint_name = ucc.constraint_name
  WHERE uc.table_name = 'WAREHOUSE_LOCATIONS' AND uc.constraint_type = 'P'
  AND ROWNUM = 1;

  IF v_pk_col = 'ID' THEN
    EXECUTE IMMEDIATE 'ALTER TABLE WAREHOUSE_LOCATIONS DROP CONSTRAINT ' || v_pk_name;
    EXECUTE IMMEDIATE 'ALTER TABLE WAREHOUSE_LOCATIONS ADD CONSTRAINT PK_WAREHOUSE_LOCATIONS PRIMARY KEY (WAREHOUSE_CODE, LOCATION_CODE)';
    DBMS_OUTPUT.PUT_LINE('OK: WAREHOUSE_LOCATIONS PK = (WAREHOUSE_CODE, LOCATION_CODE)');
  ELSE
    DBMS_OUTPUT.PUT_LINE('SKIP: WAREHOUSE_LOCATIONS PK already changed');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('ERR: WAREHOUSE_LOCATIONS → ' || SQLERRM);
END;
/

-- 헬퍼 프로시저 삭제
DROP PROCEDURE swap_pk_to_natural;

PROMPT '=== Phase 3 Complete: PK restructure done ===';
