-- ============================================================================
-- Phase 4: 트랜잭션 테이블 SEQUENCE 생성 + ID 컬럼 NUMBER 전환
-- ============================================================================
-- 트랜잭션 테이블: UUID VARCHAR2(36) → NUMBER + SEQUENCE
-- 마스터 테이블: 사용하지 않는 ID 컬럼 삭제
-- ============================================================================

SET SERVEROUTPUT ON;

-- ============================================================================
-- 4-A. SEQUENCE 생성 (멱등)
-- ============================================================================
CREATE OR REPLACE PROCEDURE safe_create_seq(p_seq_name VARCHAR2, p_table VARCHAR2) IS
  v_cnt NUMBER;
  v_max NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM user_sequences WHERE sequence_name = UPPER(p_seq_name);
  IF v_cnt = 0 THEN
    -- 테이블에 이미 NUMBER ID가 있으면 MAX+1부터 시작
    BEGIN
      EXECUTE IMMEDIATE 'SELECT NVL(MAX(ID),0) FROM ' || p_table INTO v_max;
    EXCEPTION
      WHEN OTHERS THEN v_max := 0;
    END;
    EXECUTE IMMEDIATE 'CREATE SEQUENCE ' || p_seq_name || ' START WITH ' || (v_max + 1) || ' INCREMENT BY 1 NOCACHE NOCYCLE';
    DBMS_OUTPUT.PUT_LINE('OK: Created ' || p_seq_name || ' (start=' || (v_max+1) || ')');
  ELSE
    DBMS_OUTPUT.PUT_LINE('SKIP: ' || p_seq_name || ' already exists');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('ERR: ' || p_seq_name || ' → ' || SQLERRM);
END;
/

BEGIN
  -- 트랜잭션 테이블 SEQUENCE 생성
  safe_create_seq('SEQ_STOCK_TRANSACTIONS',   'STOCK_TRANSACTIONS');
  safe_create_seq('SEQ_PRODUCT_TRANSACTIONS', 'PRODUCT_TRANSACTIONS');
  safe_create_seq('SEQ_MAT_ARRIVALS',         'MAT_ARRIVALS');
  safe_create_seq('SEQ_MAT_RECEIVINGS',       'MAT_RECEIVINGS');
  safe_create_seq('SEQ_MAT_ISSUES',           'MAT_ISSUES');
  safe_create_seq('SEQ_MAT_ISSUE_REQUESTS',   'MAT_ISSUE_REQUESTS');
  safe_create_seq('SEQ_MAT_ISSUE_REQ_ITEMS',  'MAT_ISSUE_REQUEST_ITEMS');
  safe_create_seq('SEQ_PROD_RESULTS',         'PROD_RESULTS');
  safe_create_seq('SEQ_IQC_LOGS',             'IQC_LOGS');
  safe_create_seq('SEQ_IQC_GROUPS',           'IQC_GROUPS');
  safe_create_seq('SEQ_IQC_GROUP_ITEMS',      'IQC_GROUP_ITEMS');
  safe_create_seq('SEQ_IQC_ITEM_POOL',        'IQC_ITEM_POOL');
  safe_create_seq('SEQ_IQC_ITEM_MASTERS',     'IQC_ITEM_MASTERS');
  safe_create_seq('SEQ_IQC_PART_LINKS',       'IQC_PART_LINKS');
  safe_create_seq('SEQ_INSPECT_RESULTS',      'INSPECT_RESULTS');
  safe_create_seq('SEQ_DEFECT_LOGS',          'DEFECT_LOGS');
  safe_create_seq('SEQ_INV_ADJ_LOGS',         'INV_ADJ_LOGS');
  safe_create_seq('SEQ_EQUIP_INSPECT_LOGS',   'EQUIP_INSPECT_LOGS');
  safe_create_seq('SEQ_EQUIP_INSPECT_ITEMS',  'EQUIP_INSPECT_ITEM_MASTERS');
  safe_create_seq('SEQ_EQUIP_BOM_RELS',       'EQUIP_BOM_RELS');
  safe_create_seq('SEQ_PM_WORK_ORDERS',       'PM_WORK_ORDERS');
  safe_create_seq('SEQ_PM_PLAN_ITEMS',        'PM_PLAN_ITEMS');
  safe_create_seq('SEQ_PM_WO_RESULTS',        'PM_WO_RESULTS');
  safe_create_seq('SEQ_SHIPMENT_LOGS',        'SHIPMENT_LOGS');
  safe_create_seq('SEQ_SHIPMENT_RETURNS',     'SHIPMENT_RETURNS');
  safe_create_seq('SEQ_SHIPMENT_RETURN_ITEMS','SHIPMENT_RETURN_ITEMS');
  safe_create_seq('SEQ_SHIPMENT_ORDER_ITEMS', 'SHIPMENT_ORDER_ITEMS');
  safe_create_seq('SEQ_CUSTOMER_ORDER_ITEMS', 'CUSTOMER_ORDER_ITEMS');
  safe_create_seq('SEQ_PURCHASE_ORDER_ITEMS', 'PURCHASE_ORDER_ITEMS');
  safe_create_seq('SEQ_OQC_REQUEST_BOXES',    'OQC_REQUEST_BOXES');
  safe_create_seq('SEQ_CONSUMABLE_LOGS',      'CONSUMABLE_LOGS');
  safe_create_seq('SEQ_CONSUMABLE_MOUNT_LOGS','CONSUMABLE_MOUNT_LOGS');
  safe_create_seq('SEQ_REPAIR_LOGS',          'REPAIR_LOGS');
  safe_create_seq('SEQ_TRACE_LOGS',           'TRACE_LOGS');
  safe_create_seq('SEQ_INTER_LOGS',           'INTER_LOGS');
  safe_create_seq('SEQ_CUSTOMS_ENTRIES',      'CUSTOMS_ENTRIES');
  safe_create_seq('SEQ_CUSTOMS_LOTS',         'CUSTOMS_LOTS');
  safe_create_seq('SEQ_CUSTOMS_USAGE_RPTS',   'CUSTOMS_USAGE_REPORTS');
  safe_create_seq('SEQ_SUBCON_DELIVERIES',    'SUBCON_DELIVERIES');
  safe_create_seq('SEQ_SUBCON_RECEIVES',      'SUBCON_RECEIVES');
  safe_create_seq('SEQ_MODEL_SUFFIXES',       'MODEL_SUFFIXES');
  safe_create_seq('SEQ_PROCESS_MAPS',         'PROCESS_MAPS');
  safe_create_seq('SEQ_LABEL_TEMPLATES',      'LABEL_TEMPLATES');
  safe_create_seq('SEQ_LABEL_PRINT_LOGS',     'LABEL_PRINT_LOGS');
  safe_create_seq('SEQ_WORK_INSTRUCTIONS',    'WORK_INSTRUCTIONS');
  safe_create_seq('SEQ_VENDOR_BARCODE_MAP',   'VENDOR_BARCODE_MAPPINGS');
  safe_create_seq('SEQ_WH_TRANSFER_RULES',    'WAREHOUSE_TRANSFER_RULES');
  safe_create_seq('SEQ_ROLE_MENU_PERMS',      'ROLE_MENU_PERMISSIONS');
  safe_create_seq('SEQ_USER_AUTHS',           'USER_AUTHS');
  safe_create_seq('SEQ_ACTIVITY_LOGS',        'ACTIVITY_LOGS');
  safe_create_seq('SEQ_SAMPLE_INSPECT_RESULTS','SAMPLE_INSPECT_RESULTS');
END;
/

DROP PROCEDURE safe_create_seq;

-- ============================================================================
-- 4-B. 트랜잭션 테이블 ID 컬럼: VARCHAR2(36)/RAW(16) → NUMBER
-- ============================================================================
-- Oracle에서는 VARCHAR2→NUMBER 직접 변환 불가 → 새 컬럼 추가 후 교체
-- ============================================================================

CREATE OR REPLACE PROCEDURE convert_id_to_number(p_table VARCHAR2, p_seq_name VARCHAR2) IS
  v_data_type VARCHAR2(50);
  v_pk_name   VARCHAR2(200);
  v_uq_name   VARCHAR2(200);
  v_cnt       NUMBER;
BEGIN
  -- ID 컬럼 타입 확인
  SELECT data_type INTO v_data_type
  FROM user_tab_columns
  WHERE table_name = UPPER(p_table) AND column_name = 'ID';

  -- 이미 NUMBER인 경우 스킵
  IF v_data_type = 'NUMBER' THEN
    DBMS_OUTPUT.PUT_LINE('SKIP: ' || p_table || '.ID already NUMBER');
    RETURN;
  END IF;

  -- 데이터 건수 확인
  EXECUTE IMMEDIATE 'SELECT COUNT(*) FROM ' || p_table INTO v_cnt;

  -- 1. PK 제약조건 삭제
  BEGIN
    SELECT constraint_name INTO v_pk_name
    FROM user_constraints
    WHERE table_name = UPPER(p_table) AND constraint_type = 'P';
    EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table || ' DROP CONSTRAINT ' || v_pk_name;
  EXCEPTION WHEN NO_DATA_FOUND THEN NULL;
  END;

  -- 2. UQ 제약조건 삭제 (ID가 UQ인 경우)
  FOR r IN (SELECT constraint_name FROM user_constraints
            WHERE table_name = UPPER(p_table) AND constraint_type = 'U') LOOP
    BEGIN
      EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table || ' DROP CONSTRAINT ' || r.constraint_name;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;

  -- 3. 기존 ID 컬럼 삭제
  EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table || ' DROP COLUMN ID';

  -- 4. 새 NUMBER ID 컬럼 추가
  EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table || ' ADD ID NUMBER';

  -- 5. 기존 데이터가 있으면 시퀀스 값 할당
  IF v_cnt > 0 THEN
    EXECUTE IMMEDIATE 'UPDATE ' || p_table || ' SET ID = ' || p_seq_name || '.NEXTVAL WHERE ID IS NULL';
    COMMIT;
  END IF;

  -- 6. NOT NULL 설정
  EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table || ' MODIFY ID NOT NULL';

  -- 7. PK 재생성
  EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table ||
    ' ADD CONSTRAINT PK_' || p_table || ' PRIMARY KEY (ID)';

  DBMS_OUTPUT.PUT_LINE('OK: ' || p_table || '.ID → NUMBER (rows=' || v_cnt || ')');
EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('ERR: ' || p_table || ' → ' || SQLERRM);
END;
/

BEGIN
  DBMS_OUTPUT.PUT_LINE('--- Converting ID columns to NUMBER ---');

  -- 재고 트랜잭션
  convert_id_to_number('STOCK_TRANSACTIONS',    'SEQ_STOCK_TRANSACTIONS');
  convert_id_to_number('PRODUCT_TRANSACTIONS',  'SEQ_PRODUCT_TRANSACTIONS');

  -- 원자재 트랜잭션
  convert_id_to_number('MAT_ARRIVALS',          'SEQ_MAT_ARRIVALS');
  convert_id_to_number('MAT_RECEIVINGS',        'SEQ_MAT_RECEIVINGS');
  convert_id_to_number('MAT_ISSUES',            'SEQ_MAT_ISSUES');
  convert_id_to_number('MAT_ISSUE_REQUESTS',    'SEQ_MAT_ISSUE_REQUESTS');
  convert_id_to_number('MAT_ISSUE_REQUEST_ITEMS','SEQ_MAT_ISSUE_REQ_ITEMS');

  -- 생산/품질
  convert_id_to_number('PROD_RESULTS',          'SEQ_PROD_RESULTS');
  convert_id_to_number('INSPECT_RESULTS',       'SEQ_INSPECT_RESULTS');
  convert_id_to_number('DEFECT_LOGS',           'SEQ_DEFECT_LOGS');
  convert_id_to_number('IQC_LOGS',              'SEQ_IQC_LOGS');
  convert_id_to_number('IQC_GROUPS',            'SEQ_IQC_GROUPS');
  convert_id_to_number('IQC_GROUP_ITEMS',       'SEQ_IQC_GROUP_ITEMS');
  convert_id_to_number('IQC_ITEM_POOL',         'SEQ_IQC_ITEM_POOL');
  convert_id_to_number('IQC_ITEM_MASTERS',      'SEQ_IQC_ITEM_MASTERS');
  convert_id_to_number('IQC_PART_LINKS',        'SEQ_IQC_PART_LINKS');
  convert_id_to_number('INV_ADJ_LOGS',          'SEQ_INV_ADJ_LOGS');

  -- 설비
  convert_id_to_number('EQUIP_INSPECT_LOGS',    'SEQ_EQUIP_INSPECT_LOGS');
  convert_id_to_number('EQUIP_INSPECT_ITEM_MASTERS','SEQ_EQUIP_INSPECT_ITEMS');
  convert_id_to_number('EQUIP_BOM_RELS',        'SEQ_EQUIP_BOM_RELS');
  convert_id_to_number('PM_WORK_ORDERS',        'SEQ_PM_WORK_ORDERS');
  convert_id_to_number('PM_PLAN_ITEMS',         'SEQ_PM_PLAN_ITEMS');
  convert_id_to_number('PM_WO_RESULTS',         'SEQ_PM_WO_RESULTS');
  convert_id_to_number('CONSUMABLE_LOGS',       'SEQ_CONSUMABLE_LOGS');
  convert_id_to_number('CONSUMABLE_MOUNT_LOGS', 'SEQ_CONSUMABLE_MOUNT_LOGS');
  convert_id_to_number('REPAIR_LOGS',           'SEQ_REPAIR_LOGS');

  -- 출하
  convert_id_to_number('SHIPMENT_LOGS',         'SEQ_SHIPMENT_LOGS');
  convert_id_to_number('SHIPMENT_RETURNS',      'SEQ_SHIPMENT_RETURNS');
  convert_id_to_number('SHIPMENT_RETURN_ITEMS', 'SEQ_SHIPMENT_RETURN_ITEMS');
  convert_id_to_number('SHIPMENT_ORDER_ITEMS',  'SEQ_SHIPMENT_ORDER_ITEMS');
  convert_id_to_number('CUSTOMER_ORDER_ITEMS',  'SEQ_CUSTOMER_ORDER_ITEMS');
  convert_id_to_number('PURCHASE_ORDER_ITEMS',  'SEQ_PURCHASE_ORDER_ITEMS');
  convert_id_to_number('OQC_REQUEST_BOXES',     'SEQ_OQC_REQUEST_BOXES');

  -- 이력/추적
  convert_id_to_number('TRACE_LOGS',            'SEQ_TRACE_LOGS');
  convert_id_to_number('INTER_LOGS',            'SEQ_INTER_LOGS');
  convert_id_to_number('LABEL_PRINT_LOGS',      'SEQ_LABEL_PRINT_LOGS');
  convert_id_to_number('ACTIVITY_LOGS',         'SEQ_ACTIVITY_LOGS');

  -- 외주
  convert_id_to_number('SUBCON_DELIVERIES',     'SEQ_SUBCON_DELIVERIES');
  convert_id_to_number('SUBCON_RECEIVES',       'SEQ_SUBCON_RECEIVES');

  -- 관세/보세
  convert_id_to_number('CUSTOMS_ENTRIES',       'SEQ_CUSTOMS_ENTRIES');
  convert_id_to_number('CUSTOMS_LOTS',          'SEQ_CUSTOMS_LOTS');
  convert_id_to_number('CUSTOMS_USAGE_REPORTS', 'SEQ_CUSTOMS_USAGE_RPTS');

  -- 기타
  convert_id_to_number('LABEL_TEMPLATES',       'SEQ_LABEL_TEMPLATES');
  convert_id_to_number('WORK_INSTRUCTIONS',     'SEQ_WORK_INSTRUCTIONS');
  convert_id_to_number('VENDOR_BARCODE_MAPPINGS','SEQ_VENDOR_BARCODE_MAP');
  convert_id_to_number('WAREHOUSE_TRANSFER_RULES','SEQ_WH_TRANSFER_RULES');
  convert_id_to_number('MODEL_SUFFIXES',        'SEQ_MODEL_SUFFIXES');
  convert_id_to_number('PROCESS_MAPS',          'SEQ_PROCESS_MAPS');
  convert_id_to_number('ROLE_MENU_PERMISSIONS', 'SEQ_ROLE_MENU_PERMS');
  convert_id_to_number('USER_AUTHS',            'SEQ_USER_AUTHS');
  convert_id_to_number('SAMPLE_INSPECT_RESULTS','SEQ_SAMPLE_INSPECT_RESULTS');
END;
/

DROP PROCEDURE convert_id_to_number;

-- ============================================================================
-- 4-C. 마스터 테이블의 불필요한 UUID ID 컬럼 삭제
-- ============================================================================
CREATE OR REPLACE PROCEDURE safe_drop_old_id(p_table VARCHAR2) IS
  v_cnt NUMBER;
  v_pk_col VARCHAR2(200);
BEGIN
  -- ID 컬럼 존재 확인
  SELECT COUNT(*) INTO v_cnt
  FROM user_tab_columns
  WHERE table_name = UPPER(p_table) AND column_name = 'ID';

  IF v_cnt = 0 THEN
    DBMS_OUTPUT.PUT_LINE('SKIP: ' || p_table || '.ID not found');
    RETURN;
  END IF;

  -- PK가 ID가 아닌지 확인 (이미 자연키 PK로 변경된 경우만 삭제)
  BEGIN
    SELECT ucc.column_name INTO v_pk_col
    FROM user_constraints uc
    JOIN user_cons_columns ucc ON uc.constraint_name = ucc.constraint_name
    WHERE uc.table_name = UPPER(p_table) AND uc.constraint_type = 'P'
    AND ROWNUM = 1;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      DBMS_OUTPUT.PUT_LINE('SKIP: ' || p_table || ' has no PK');
      RETURN;
  END;

  IF v_pk_col = 'ID' THEN
    DBMS_OUTPUT.PUT_LINE('SKIP: ' || p_table || '.ID is still PK');
    RETURN;
  END IF;

  EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table || ' DROP COLUMN ID';
  DBMS_OUTPUT.PUT_LINE('OK: Dropped ' || p_table || '.ID (old UUID)');
EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('ERR: ' || p_table || ' → ' || SQLERRM);
END;
/

BEGIN
  DBMS_OUTPUT.PUT_LINE('--- Dropping old UUID ID columns from master tables ---');
  safe_drop_old_id('ITEM_MASTERS');
  safe_drop_old_id('WAREHOUSES');
  safe_drop_old_id('EQUIP_MASTERS');
  safe_drop_old_id('PROCESS_MASTERS');
  safe_drop_old_id('WORKER_MASTERS');
  safe_drop_old_id('DEPARTMENT_MASTERS');
  safe_drop_old_id('PARTNER_MASTERS');
  safe_drop_old_id('PROD_LINE_MASTERS');
  safe_drop_old_id('CONSUMABLE_MASTERS');
  safe_drop_old_id('PURCHASE_ORDERS');
  safe_drop_old_id('CUSTOMER_ORDERS');
  safe_drop_old_id('JOB_ORDERS');
  safe_drop_old_id('SHIPMENT_ORDERS');
  safe_drop_old_id('SUBCON_ORDERS');
  safe_drop_old_id('MAT_LOTS');
  safe_drop_old_id('BOX_MASTERS');
  safe_drop_old_id('PALLET_MASTERS');
  safe_drop_old_id('OQC_REQUESTS');
  safe_drop_old_id('PM_PLANS');
  safe_drop_old_id('EQUIP_BOM_ITEMS');
  safe_drop_old_id('NUM_RULE_MASTERS');
  safe_drop_old_id('SYS_CONFIGS');
  safe_drop_old_id('USERS');
  safe_drop_old_id('ROLES');
  safe_drop_old_id('COMM_CONFIGS');
  safe_drop_old_id('COM_CODES');
  safe_drop_old_id('COMPANY_MASTERS');
  safe_drop_old_id('BOM_MASTERS');
  safe_drop_old_id('MAT_STOCKS');
  safe_drop_old_id('PRODUCT_STOCKS');
  safe_drop_old_id('WAREHOUSE_LOCATIONS');
  safe_drop_old_id('LOTS');
  safe_drop_old_id('STOCKS');
  safe_drop_old_id('PLANTS');
END;
/

DROP PROCEDURE safe_drop_old_id;

COMMIT;

PROMPT '=== Phase 4 Complete: Sequences created, IDs converted ===';
PROMPT '=== MIGRATION COMPLETE ===';
PROMPT '';
PROMPT 'Next steps:';
PROMPT '  1. pnpm --filter backend build 로 백엔드 빌드 확인';
PROMPT '  2. TypeORM synchronize: true 로 서버 시작 → 누락 컬럼 자동 추가';
PROMPT '  3. 기능 테스트';
