-- ============================================================================
-- Phase 3-B: PK 패치 (Phase 3에서 실패한 항목들 수정)
-- ============================================================================

-- 1. BOM_MASTERS: PARENT_PART_ID → PARENT_ITEM_CODE, CHILD_PART_ID → CHILD_ITEM_CODE
DECLARE
  v_cnt NUMBER;
BEGIN
  -- PARENT_PART_ID → PARENT_ITEM_CODE
  SELECT COUNT(*) INTO v_cnt FROM user_tab_columns
  WHERE table_name = 'BOM_MASTERS' AND column_name = 'PARENT_PART_ID';
  IF v_cnt > 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE BOM_MASTERS RENAME COLUMN PARENT_PART_ID TO PARENT_ITEM_CODE';
    DBMS_OUTPUT.PUT_LINE('OK: BOM_MASTERS.PARENT_PART_ID → PARENT_ITEM_CODE');
  ELSE
    DBMS_OUTPUT.PUT_LINE('SKIP: BOM_MASTERS.PARENT_PART_ID not found');
  END IF;

  -- CHILD_PART_ID → CHILD_ITEM_CODE
  SELECT COUNT(*) INTO v_cnt FROM user_tab_columns
  WHERE table_name = 'BOM_MASTERS' AND column_name = 'CHILD_PART_ID';
  IF v_cnt > 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE BOM_MASTERS RENAME COLUMN CHILD_PART_ID TO CHILD_ITEM_CODE';
    DBMS_OUTPUT.PUT_LINE('OK: BOM_MASTERS.CHILD_PART_ID → CHILD_ITEM_CODE');
  ELSE
    DBMS_OUTPUT.PUT_LINE('SKIP: BOM_MASTERS.CHILD_PART_ID not found');
  END IF;
END;
/

-- 2. BOM_MASTERS PK 변경: ID → (PARENT_ITEM_CODE, CHILD_ITEM_CODE, REVISION)
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
    DBMS_OUTPUT.PUT_LINE('ERR: BOM_MASTERS PK → ' || SQLERRM);
END;
/

-- 3. MAT_STOCKS, PRODUCT_STOCKS: LOT_ID → LOT_NO
DECLARE
  v_cnt NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM user_tab_columns
  WHERE table_name = 'MAT_STOCKS' AND column_name = 'LOT_ID';
  IF v_cnt > 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE MAT_STOCKS RENAME COLUMN LOT_ID TO LOT_NO';
    DBMS_OUTPUT.PUT_LINE('OK: MAT_STOCKS.LOT_ID → LOT_NO');
  ELSE
    DBMS_OUTPUT.PUT_LINE('SKIP: MAT_STOCKS.LOT_ID not found');
  END IF;

  SELECT COUNT(*) INTO v_cnt FROM user_tab_columns
  WHERE table_name = 'PRODUCT_STOCKS' AND column_name = 'LOT_ID';
  IF v_cnt > 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE PRODUCT_STOCKS RENAME COLUMN LOT_ID TO LOT_NO';
    DBMS_OUTPUT.PUT_LINE('OK: PRODUCT_STOCKS.LOT_ID → LOT_NO');
  ELSE
    DBMS_OUTPUT.PUT_LINE('SKIP: PRODUCT_STOCKS.LOT_ID not found');
  END IF;
END;
/

-- 4. MAT_STOCKS PK 변경: ID → (WAREHOUSE_CODE, ITEM_CODE, LOT_NO)
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

-- 5. PRODUCT_STOCKS PK 변경: ID → (WAREHOUSE_CODE, ITEM_CODE, LOT_NO)
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
    -- UQ 먼저 삭제
    BEGIN
      SELECT constraint_name INTO v_uq_name
      FROM user_constraints
      WHERE table_name = 'PRODUCT_STOCKS' AND constraint_type = 'U' AND ROWNUM = 1;
      EXECUTE IMMEDIATE 'ALTER TABLE PRODUCT_STOCKS DROP CONSTRAINT ' || v_uq_name;
      DBMS_OUTPUT.PUT_LINE('  Dropped UQ: ' || v_uq_name);
    EXCEPTION WHEN NO_DATA_FOUND THEN NULL;
    END;

    EXECUTE IMMEDIATE 'ALTER TABLE PRODUCT_STOCKS DROP CONSTRAINT ' || v_pk_name;
    EXECUTE IMMEDIATE 'ALTER TABLE PRODUCT_STOCKS ADD CONSTRAINT PK_PRODUCT_STOCKS PRIMARY KEY (WAREHOUSE_CODE, ITEM_CODE, LOT_NO)';
    DBMS_OUTPUT.PUT_LINE('OK: PRODUCT_STOCKS PK = (WAREHOUSE_CODE, ITEM_CODE, LOT_NO)');
  ELSE
    DBMS_OUTPUT.PUT_LINE('SKIP: PRODUCT_STOCKS PK already changed');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('ERR: PRODUCT_STOCKS → ' || SQLERRM);
END;
/

-- 6. PM_PLANS: FK 먼저 삭제 후 PK 변경
DECLARE
  v_pk_name VARCHAR2(200);
  v_pk_col  VARCHAR2(200);
BEGIN
  -- FK 삭제: PM_PLAN_ITEMS.PM_PLAN_ID → PM_PLANS
  BEGIN
    EXECUTE IMMEDIATE 'ALTER TABLE PM_PLAN_ITEMS DROP CONSTRAINT FK_PM_PLAN_ITEMS_PLAN';
    DBMS_OUTPUT.PUT_LINE('  Dropped FK: FK_PM_PLAN_ITEMS_PLAN');
  EXCEPTION WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('  FK already dropped or not found');
  END;

  SELECT uc.constraint_name, ucc.column_name
  INTO v_pk_name, v_pk_col
  FROM user_constraints uc
  JOIN user_cons_columns ucc ON uc.constraint_name = ucc.constraint_name
  WHERE uc.table_name = 'PM_PLANS' AND uc.constraint_type = 'P'
  AND ROWNUM = 1;

  IF v_pk_col = 'ID' THEN
    -- UQ 삭제
    DECLARE
      v_uq_name VARCHAR2(200);
    BEGIN
      SELECT uc.constraint_name INTO v_uq_name
      FROM user_constraints uc
      JOIN user_cons_columns ucc ON uc.constraint_name = ucc.constraint_name
      WHERE uc.table_name = 'PM_PLANS' AND uc.constraint_type = 'U'
      AND ucc.column_name = 'PLAN_CODE' AND ROWNUM = 1;
      EXECUTE IMMEDIATE 'ALTER TABLE PM_PLANS DROP CONSTRAINT ' || v_uq_name;
      DBMS_OUTPUT.PUT_LINE('  Dropped UQ: ' || v_uq_name);
    EXCEPTION WHEN NO_DATA_FOUND THEN NULL;
    END;

    EXECUTE IMMEDIATE 'ALTER TABLE PM_PLANS DROP CONSTRAINT ' || v_pk_name;
    EXECUTE IMMEDIATE 'ALTER TABLE PM_PLANS ADD CONSTRAINT PK_PM_PLANS PRIMARY KEY (PLAN_CODE)';
    DBMS_OUTPUT.PUT_LINE('OK: PM_PLANS PK = PLAN_CODE');
  ELSE
    DBMS_OUTPUT.PUT_LINE('SKIP: PM_PLANS PK already changed');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('ERR: PM_PLANS → ' || SQLERRM);
END;
/

-- 7. ROLES: FK 먼저 삭제 후 PK 변경
DECLARE
  v_pk_name VARCHAR2(200);
  v_pk_col  VARCHAR2(200);
BEGIN
  -- FK 삭제: ROLE_MENU_PERMISSIONS.ROLE_ID → ROLES
  BEGIN
    EXECUTE IMMEDIATE 'ALTER TABLE ROLE_MENU_PERMISSIONS DROP CONSTRAINT FK_ROLE_MENU_ROLE';
    DBMS_OUTPUT.PUT_LINE('  Dropped FK: FK_ROLE_MENU_ROLE');
  EXCEPTION WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('  FK already dropped or not found');
  END;

  SELECT uc.constraint_name, ucc.column_name
  INTO v_pk_name, v_pk_col
  FROM user_constraints uc
  JOIN user_cons_columns ucc ON uc.constraint_name = ucc.constraint_name
  WHERE uc.table_name = 'ROLES' AND uc.constraint_type = 'P'
  AND ROWNUM = 1;

  IF v_pk_col = 'ID' THEN
    EXECUTE IMMEDIATE 'ALTER TABLE ROLES DROP CONSTRAINT ' || v_pk_name;
    EXECUTE IMMEDIATE 'ALTER TABLE ROLES ADD CONSTRAINT PK_ROLES PRIMARY KEY (CODE)';
    DBMS_OUTPUT.PUT_LINE('OK: ROLES PK = CODE');
  ELSE
    DBMS_OUTPUT.PUT_LINE('SKIP: ROLES PK already changed');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('ERR: ROLES → ' || SQLERRM);
END;
/

-- 8. EQUIP_BOM_ITEMS PK 변경
DECLARE
  v_pk_name VARCHAR2(200);
  v_pk_col  VARCHAR2(200);
  v_uq_name VARCHAR2(200);
BEGIN
  SELECT uc.constraint_name, ucc.column_name
  INTO v_pk_name, v_pk_col
  FROM user_constraints uc
  JOIN user_cons_columns ucc ON uc.constraint_name = ucc.constraint_name
  WHERE uc.table_name = 'EQUIP_BOM_ITEMS' AND uc.constraint_type = 'P'
  AND ROWNUM = 1;

  IF v_pk_col = 'ID' THEN
    -- UQ 삭제
    BEGIN
      SELECT constraint_name INTO v_uq_name
      FROM user_constraints
      WHERE table_name = 'EQUIP_BOM_ITEMS' AND constraint_type = 'U' AND ROWNUM = 1;
      EXECUTE IMMEDIATE 'ALTER TABLE EQUIP_BOM_ITEMS DROP CONSTRAINT ' || v_uq_name;
      DBMS_OUTPUT.PUT_LINE('  Dropped UQ: ' || v_uq_name);
    EXCEPTION WHEN NO_DATA_FOUND THEN NULL;
    END;

    EXECUTE IMMEDIATE 'ALTER TABLE EQUIP_BOM_ITEMS DROP CONSTRAINT ' || v_pk_name;
    EXECUTE IMMEDIATE 'ALTER TABLE EQUIP_BOM_ITEMS ADD CONSTRAINT PK_EQUIP_BOM_ITEMS PRIMARY KEY (BOM_ITEM_CODE)';
    DBMS_OUTPUT.PUT_LINE('OK: EQUIP_BOM_ITEMS PK = BOM_ITEM_CODE');
  ELSE
    DBMS_OUTPUT.PUT_LINE('SKIP: EQUIP_BOM_ITEMS PK already changed');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('ERR: EQUIP_BOM_ITEMS → ' || SQLERRM);
END;
/
