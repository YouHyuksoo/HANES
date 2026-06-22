DECLARE
  FUNCTION constraint_exists(p_name IN VARCHAR2) RETURN BOOLEAN IS
    v_count NUMBER := 0;
  BEGIN
    SELECT COUNT(*)
      INTO v_count
      FROM USER_CONSTRAINTS
     WHERE CONSTRAINT_NAME = UPPER(p_name);
    RETURN v_count > 0;
  END;

  FUNCTION constraint_columns(p_name IN VARCHAR2) RETURN VARCHAR2 IS
    v_columns VARCHAR2(4000);
  BEGIN
    SELECT LISTAGG(COLUMN_NAME, ',') WITHIN GROUP (ORDER BY POSITION)
      INTO v_columns
      FROM USER_CONS_COLUMNS
     WHERE CONSTRAINT_NAME = UPPER(p_name);
    RETURN v_columns;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RETURN NULL;
  END;

  PROCEDURE drop_constraint_if_exists(p_table_name IN VARCHAR2, p_constraint_name IN VARCHAR2) IS
  BEGIN
    IF constraint_exists(p_constraint_name) THEN
      EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table_name || ' DROP CONSTRAINT ' || p_constraint_name;
    END IF;
  END;

  PROCEDURE ensure_primary_key(
    p_table_name IN VARCHAR2,
    p_constraint_name IN VARCHAR2,
    p_expected_columns IN VARCHAR2
  ) IS
  BEGIN
    IF constraint_exists(p_constraint_name) AND constraint_columns(p_constraint_name) = p_expected_columns THEN
      RETURN;
    END IF;

    drop_constraint_if_exists(p_table_name, p_constraint_name);
    EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table_name || ' ADD CONSTRAINT ' || p_constraint_name ||
      ' PRIMARY KEY (' || p_expected_columns || ') ENABLE VALIDATE';
  END;

  PROCEDURE add_fk_if_missing(
    p_table_name IN VARCHAR2,
    p_constraint_name IN VARCHAR2,
    p_child_columns IN VARCHAR2,
    p_parent_table IN VARCHAR2,
    p_parent_columns IN VARCHAR2
  ) IS
  BEGIN
    IF NOT constraint_exists(p_constraint_name) THEN
      EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table_name || ' ADD CONSTRAINT ' || p_constraint_name ||
        ' FOREIGN KEY (' || p_child_columns || ') REFERENCES ' || p_parent_table ||
        ' (' || p_parent_columns || ') ENABLE VALIDATE';
    END IF;
  END;
BEGIN
  -- Drop child FKs that reference the old single-column PKs or the temporary composite UKs.
  drop_constraint_if_exists('CONSUMABLE_LOGS', 'FK_CONSUMABLE_L_CONSUMABLE_C');
  drop_constraint_if_exists('CONSUMABLE_STOCKS', 'FK_CONSUMABLE_S_CONSUMABLE_C');
  drop_constraint_if_exists('CONSUMABLE_LOGS', 'FK_CONSUMABLE_L_EQUIP_CODE');
  drop_constraint_if_exists('BOX_MASTERS', 'FK_BOX_MASTERS_ITEM_CODE');
  drop_constraint_if_exists('PROD_PLANS', 'FK_PROD_PLANS_ITEM');
  drop_constraint_if_exists('CONSUMABLE_LOGS', 'FK_CONSUMABLE_L_VENDOR_CODE');
  drop_constraint_if_exists('HARNESS_DRAWING_REVISIONS', 'FK_HARNESS_REV_MASTER');

  -- Remove duplicate tenant UKs once the same column set becomes the actual PK.
  drop_constraint_if_exists('CONSUMABLE_MASTERS', 'UK_CONSUMABLE_M_CONSUMABLE_C');
  drop_constraint_if_exists('EQUIP_MASTERS', 'UK_EQUIP_MASTER_EQUIP_CODE');
  drop_constraint_if_exists('ITEM_MASTERS', 'UK_ITEM_MASTERS_ITEM_CODE');
  drop_constraint_if_exists('VENDOR_MASTERS', 'UK_VENDOR_MASTE_VENDOR_CODE');

  ensure_primary_key('BOM_MASTERS', 'PK_BOM_MASTERS', 'COMPANY,PLANT_CD,PARENT_ITEM_CODE,CHILD_ITEM_CODE,REVISION');
  ensure_primary_key('BOX_MASTERS', 'PK_BOX_MASTERS', 'COMPANY,PLANT_CD,BOX_NO');
  ensure_primary_key('COMPANY_MASTERS', 'PK_COMPANY_MASTERS', 'COMPANY,PLANT_CD,COMPANY_CODE');
  ensure_primary_key('CONSUMABLE_MASTERS', 'PK_CONSUMABLE_MASTERS', 'COMPANY,PLANT_CD,CONSUMABLE_CODE');
  ensure_primary_key('DEPARTMENT_MASTERS', 'PK_DEPARTMENT_MASTERS', 'COMPANY,PLANT_CD,DEPT_CODE');
  ensure_primary_key('EQUIP_MASTERS', 'PK_EQUIP_MASTERS', 'COMPANY,PLANT_CD,EQUIP_CODE');
  ensure_primary_key('HARNESS_DRAWING_MASTERS', 'PK_HARNESS_DRAWING_MASTERS', 'COMPANY,PLANT_CD,DRAWING_ID');
  ensure_primary_key('ITEM_MASTERS', 'PK_ITEM_MASTERS', 'COMPANY,PLANT_CD,ITEM_CODE');
  ensure_primary_key('NUM_RULE_MASTERS', 'PK_NUM_RULE_MASTERS', 'COMPANY,PLANT_CD,RULE_TYPE');
  ensure_primary_key('PALLET_MASTERS', 'PK_PALLET_MASTERS', 'COMPANY,PLANT_CD,PALLET_NO');
  ensure_primary_key('PARTNER_MASTERS', 'PK_PARTNER_MASTERS', 'COMPANY,PLANT_CD,PARTNER_CODE');
  ensure_primary_key('PROCESS_MASTERS', 'PK_PROCESS_MASTERS', 'COMPANY,PLANT_CD,PROCESS_CODE');
  ensure_primary_key('PROD_LINE_MASTERS', 'PK_PROD_LINE_MASTERS', 'COMPANY,PLANT_CD,LINE_CODE');
  ensure_primary_key('VENDOR_MASTERS', 'PK_VENDOR_MASTERS', 'COMPANY,PLANT_CD,VENDOR_CODE');
  ensure_primary_key('WORKER_MASTERS', 'PK_WORKER_MASTERS', 'COMPANY,PLANT_CD,WORKER_CODE');

  add_fk_if_missing('CONSUMABLE_LOGS', 'FK_CONSUMABLE_L_CONSUMABLE_C',
    'COMPANY,PLANT_CD,CONSUMABLE_CODE', 'CONSUMABLE_MASTERS', 'COMPANY,PLANT_CD,CONSUMABLE_CODE');
  add_fk_if_missing('CONSUMABLE_STOCKS', 'FK_CONSUMABLE_S_CONSUMABLE_C',
    'COMPANY,PLANT_CD,CONSUMABLE_CODE', 'CONSUMABLE_MASTERS', 'COMPANY,PLANT_CD,CONSUMABLE_CODE');
  add_fk_if_missing('CONSUMABLE_LOGS', 'FK_CONSUMABLE_L_EQUIP_CODE',
    'COMPANY,PLANT_CD,EQUIP_CODE', 'EQUIP_MASTERS', 'COMPANY,PLANT_CD,EQUIP_CODE');
  add_fk_if_missing('BOX_MASTERS', 'FK_BOX_MASTERS_ITEM_CODE',
    'COMPANY,PLANT_CD,ITEM_CODE', 'ITEM_MASTERS', 'COMPANY,PLANT_CD,ITEM_CODE');
  add_fk_if_missing('PROD_PLANS', 'FK_PROD_PLANS_ITEM',
    'COMPANY,PLANT_CD,ITEM_CODE', 'ITEM_MASTERS', 'COMPANY,PLANT_CD,ITEM_CODE');
  add_fk_if_missing('CONSUMABLE_LOGS', 'FK_CONSUMABLE_L_VENDOR_CODE',
    'COMPANY,PLANT_CD,VENDOR_CODE', 'VENDOR_MASTERS', 'COMPANY,PLANT_CD,VENDOR_CODE');
  add_fk_if_missing('HARNESS_DRAWING_REVISIONS', 'FK_HARNESS_REV_MASTER',
    'COMPANY,PLANT_CD,DRAWING_ID', 'HARNESS_DRAWING_MASTERS', 'COMPANY,PLANT_CD,DRAWING_ID');
END;
/
