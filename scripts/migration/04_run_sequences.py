"""
@file 04_run_sequences.py
@description Phase 4: SEQUENCE 생성 + ID VARCHAR2→NUMBER 변환 + 마스터 테이블 old ID 삭제
  - CREATE SEQUENCE는 직접 SQL로 실행 (PL/SQL 내 권한 이슈 회피)
  - convert_id_to_number, safe_drop_old_id는 PL/SQL 프로시저로 실행
"""

import sys
import os
import json

CONFIG_PATH = os.path.expanduser("~/.oracle_db_config.json")

def load_site_config(site_name=None):
    with open(CONFIG_PATH, 'r') as f:
        config = json.load(f)
    if not site_name:
        site_name = config.get('default_profile') or config.get('default_site')
    profiles = config.get('profiles', config.get('sites', {}))
    if site_name not in profiles:
        raise ValueError(f"Site '{site_name}' not found")
    return profiles[site_name]

def get_connection(site_config):
    import oracledb
    svc = site_config.get('service_name') or site_config.get('service')
    dsn = f"{site_config['host']}:{site_config['port']}/{svc}"
    user_key = 'username' if 'username' in site_config else 'user'
    return oracledb.connect(user=site_config[user_key], password=site_config['password'], dsn=dsn)

def get_dbms_output(cursor):
    lines = []
    status_var = cursor.var(int)
    line_var = cursor.var(str, 32767)
    while True:
        cursor.callproc("DBMS_OUTPUT.GET_LINE", [line_var, status_var])
        if status_var.getvalue() != 0:
            break
        lines.append(line_var.getvalue())
    return lines

# SEQUENCE 목록: (시퀀스명, 테이블명)
SEQUENCES = [
    ('SEQ_STOCK_TRANSACTIONS',   'STOCK_TRANSACTIONS'),
    ('SEQ_PRODUCT_TRANSACTIONS', 'PRODUCT_TRANSACTIONS'),
    ('SEQ_MAT_ARRIVALS',         'MAT_ARRIVALS'),
    ('SEQ_MAT_RECEIVINGS',       'MAT_RECEIVINGS'),
    ('SEQ_MAT_ISSUES',           'MAT_ISSUES'),
    ('SEQ_MAT_ISSUE_REQUESTS',   'MAT_ISSUE_REQUESTS'),
    ('SEQ_MAT_ISSUE_REQ_ITEMS',  'MAT_ISSUE_REQUEST_ITEMS'),
    ('SEQ_PROD_RESULTS',         'PROD_RESULTS'),
    ('SEQ_IQC_LOGS',             'IQC_LOGS'),
    ('SEQ_IQC_GROUPS',           'IQC_GROUPS'),
    ('SEQ_IQC_GROUP_ITEMS',      'IQC_GROUP_ITEMS'),
    ('SEQ_IQC_ITEM_POOL',        'IQC_ITEM_POOL'),
    ('SEQ_IQC_ITEM_MASTERS',     'IQC_ITEM_MASTERS'),
    ('SEQ_IQC_PART_LINKS',       'IQC_PART_LINKS'),
    ('SEQ_INSPECT_RESULTS',      'INSPECT_RESULTS'),
    ('SEQ_DEFECT_LOGS',          'DEFECT_LOGS'),
    ('SEQ_INV_ADJ_LOGS',         'INV_ADJ_LOGS'),
    ('SEQ_EQUIP_INSPECT_LOGS',   'EQUIP_INSPECT_LOGS'),
    ('SEQ_EQUIP_INSPECT_ITEMS',  'EQUIP_INSPECT_ITEM_MASTERS'),
    ('SEQ_EQUIP_BOM_RELS',       'EQUIP_BOM_RELS'),
    ('SEQ_PM_WORK_ORDERS',       'PM_WORK_ORDERS'),
    ('SEQ_PM_PLAN_ITEMS',        'PM_PLAN_ITEMS'),
    ('SEQ_PM_WO_RESULTS',        'PM_WO_RESULTS'),
    ('SEQ_SHIPMENT_LOGS',        'SHIPMENT_LOGS'),
    ('SEQ_SHIPMENT_RETURNS',     'SHIPMENT_RETURNS'),
    ('SEQ_SHIPMENT_RETURN_ITEMS','SHIPMENT_RETURN_ITEMS'),
    ('SEQ_SHIPMENT_ORDER_ITEMS', 'SHIPMENT_ORDER_ITEMS'),
    ('SEQ_CUSTOMER_ORDER_ITEMS', 'CUSTOMER_ORDER_ITEMS'),
    ('SEQ_PURCHASE_ORDER_ITEMS', 'PURCHASE_ORDER_ITEMS'),
    ('SEQ_OQC_REQUEST_BOXES',    'OQC_REQUEST_BOXES'),
    ('SEQ_CONSUMABLE_LOGS',      'CONSUMABLE_LOGS'),
    ('SEQ_CONSUMABLE_MOUNT_LOGS','CONSUMABLE_MOUNT_LOGS'),
    ('SEQ_REPAIR_LOGS',          'REPAIR_LOGS'),
    ('SEQ_TRACE_LOGS',           'TRACE_LOGS'),
    ('SEQ_INTER_LOGS',           'INTER_LOGS'),
    ('SEQ_CUSTOMS_ENTRIES',      'CUSTOMS_ENTRIES'),
    ('SEQ_CUSTOMS_LOTS',         'CUSTOMS_LOTS'),
    ('SEQ_CUSTOMS_USAGE_RPTS',   'CUSTOMS_USAGE_REPORTS'),
    ('SEQ_SUBCON_DELIVERIES',    'SUBCON_DELIVERIES'),
    ('SEQ_SUBCON_RECEIVES',      'SUBCON_RECEIVES'),
    ('SEQ_MODEL_SUFFIXES',       'MODEL_SUFFIXES'),
    ('SEQ_PROCESS_MAPS',         'PROCESS_MAPS'),
    ('SEQ_LABEL_TEMPLATES',      'LABEL_TEMPLATES'),
    ('SEQ_LABEL_PRINT_LOGS',     'LABEL_PRINT_LOGS'),
    ('SEQ_WORK_INSTRUCTIONS',    'WORK_INSTRUCTIONS'),
    ('SEQ_VENDOR_BARCODE_MAP',   'VENDOR_BARCODE_MAPPINGS'),
    ('SEQ_WH_TRANSFER_RULES',    'WAREHOUSE_TRANSFER_RULES'),
    ('SEQ_ROLE_MENU_PERMS',      'ROLE_MENU_PERMISSIONS'),
    ('SEQ_USER_AUTHS',           'USER_AUTHS'),
    ('SEQ_ACTIVITY_LOGS',        'ACTIVITY_LOGS'),
    ('SEQ_SAMPLE_INSPECT_RESULTS','SAMPLE_INSPECT_RESULTS'),
]

# ID를 NUMBER로 변환할 트랜잭션 테이블
CONVERT_TABLES = [
    ('STOCK_TRANSACTIONS',    'SEQ_STOCK_TRANSACTIONS'),
    ('PRODUCT_TRANSACTIONS',  'SEQ_PRODUCT_TRANSACTIONS'),
    ('MAT_ARRIVALS',          'SEQ_MAT_ARRIVALS'),
    ('MAT_RECEIVINGS',        'SEQ_MAT_RECEIVINGS'),
    ('MAT_ISSUES',            'SEQ_MAT_ISSUES'),
    ('MAT_ISSUE_REQUESTS',    'SEQ_MAT_ISSUE_REQUESTS'),
    ('MAT_ISSUE_REQUEST_ITEMS','SEQ_MAT_ISSUE_REQ_ITEMS'),
    ('PROD_RESULTS',          'SEQ_PROD_RESULTS'),
    ('INSPECT_RESULTS',       'SEQ_INSPECT_RESULTS'),
    ('DEFECT_LOGS',           'SEQ_DEFECT_LOGS'),
    ('IQC_LOGS',              'SEQ_IQC_LOGS'),
    ('IQC_GROUPS',            'SEQ_IQC_GROUPS'),
    ('IQC_GROUP_ITEMS',       'SEQ_IQC_GROUP_ITEMS'),
    ('IQC_ITEM_POOL',         'SEQ_IQC_ITEM_POOL'),
    ('IQC_ITEM_MASTERS',      'SEQ_IQC_ITEM_MASTERS'),
    ('IQC_PART_LINKS',        'SEQ_IQC_PART_LINKS'),
    ('INV_ADJ_LOGS',          'SEQ_INV_ADJ_LOGS'),
    ('EQUIP_INSPECT_LOGS',    'SEQ_EQUIP_INSPECT_LOGS'),
    ('EQUIP_INSPECT_ITEM_MASTERS','SEQ_EQUIP_INSPECT_ITEMS'),
    ('EQUIP_BOM_RELS',        'SEQ_EQUIP_BOM_RELS'),
    ('PM_WORK_ORDERS',        'SEQ_PM_WORK_ORDERS'),
    ('PM_PLAN_ITEMS',         'SEQ_PM_PLAN_ITEMS'),
    ('PM_WO_RESULTS',         'SEQ_PM_WO_RESULTS'),
    ('CONSUMABLE_LOGS',       'SEQ_CONSUMABLE_LOGS'),
    ('CONSUMABLE_MOUNT_LOGS', 'SEQ_CONSUMABLE_MOUNT_LOGS'),
    ('REPAIR_LOGS',           'SEQ_REPAIR_LOGS'),
    ('SHIPMENT_LOGS',         'SEQ_SHIPMENT_LOGS'),
    ('SHIPMENT_RETURNS',      'SEQ_SHIPMENT_RETURNS'),
    ('SHIPMENT_RETURN_ITEMS', 'SEQ_SHIPMENT_RETURN_ITEMS'),
    ('SHIPMENT_ORDER_ITEMS',  'SEQ_SHIPMENT_ORDER_ITEMS'),
    ('CUSTOMER_ORDER_ITEMS',  'SEQ_CUSTOMER_ORDER_ITEMS'),
    ('PURCHASE_ORDER_ITEMS',  'SEQ_PURCHASE_ORDER_ITEMS'),
    ('OQC_REQUEST_BOXES',     'SEQ_OQC_REQUEST_BOXES'),
    ('TRACE_LOGS',            'SEQ_TRACE_LOGS'),
    ('INTER_LOGS',            'SEQ_INTER_LOGS'),
    ('LABEL_PRINT_LOGS',      'SEQ_LABEL_PRINT_LOGS'),
    ('ACTIVITY_LOGS',         'SEQ_ACTIVITY_LOGS'),
    ('SUBCON_DELIVERIES',     'SEQ_SUBCON_DELIVERIES'),
    ('SUBCON_RECEIVES',       'SEQ_SUBCON_RECEIVES'),
    ('CUSTOMS_ENTRIES',       'SEQ_CUSTOMS_ENTRIES'),
    ('CUSTOMS_LOTS',          'SEQ_CUSTOMS_LOTS'),
    ('CUSTOMS_USAGE_REPORTS', 'SEQ_CUSTOMS_USAGE_RPTS'),
    ('LABEL_TEMPLATES',       'SEQ_LABEL_TEMPLATES'),
    ('WORK_INSTRUCTIONS',     'SEQ_WORK_INSTRUCTIONS'),
    ('VENDOR_BARCODE_MAPPINGS','SEQ_VENDOR_BARCODE_MAP'),
    ('WAREHOUSE_TRANSFER_RULES','SEQ_WH_TRANSFER_RULES'),
    ('MODEL_SUFFIXES',        'SEQ_MODEL_SUFFIXES'),
    ('PROCESS_MAPS',          'SEQ_PROCESS_MAPS'),
    ('ROLE_MENU_PERMISSIONS', 'SEQ_ROLE_MENU_PERMS'),
    ('USER_AUTHS',            'SEQ_USER_AUTHS'),
    ('SAMPLE_INSPECT_RESULTS','SEQ_SAMPLE_INSPECT_RESULTS'),
]

# 마스터 테이블 old ID 삭제 대상
DROP_ID_TABLES = [
    'ITEM_MASTERS', 'WAREHOUSES', 'EQUIP_MASTERS', 'PROCESS_MASTERS',
    'WORKER_MASTERS', 'DEPARTMENT_MASTERS', 'PARTNER_MASTERS',
    'PROD_LINE_MASTERS', 'CONSUMABLE_MASTERS',
    'PURCHASE_ORDERS', 'CUSTOMER_ORDERS', 'JOB_ORDERS',
    'SHIPMENT_ORDERS', 'SUBCON_ORDERS',
    'MAT_LOTS', 'BOX_MASTERS', 'PALLET_MASTERS', 'OQC_REQUESTS',
    'PM_PLANS', 'EQUIP_BOM_ITEMS', 'NUM_RULE_MASTERS',
    'SYS_CONFIGS', 'USERS', 'ROLES', 'COMM_CONFIGS',
    'COM_CODES', 'COMPANY_MASTERS', 'BOM_MASTERS',
    'MAT_STOCKS', 'PRODUCT_STOCKS', 'WAREHOUSE_LOCATIONS',
    'LOTS', 'STOCKS', 'PLANTS',
]


def main():
    site_name = sys.argv[1] if len(sys.argv) > 1 else None
    site_config = load_site_config(site_name)
    svc = site_config.get('service_name') or site_config.get('service')
    print(f"Connecting to: {site_config['host']}:{site_config['port']}/{svc}")

    conn = get_connection(site_config)
    cursor = conn.cursor()

    # =========================================================================
    # Phase 4-A: CREATE SEQUENCE (직접 SQL)
    # =========================================================================
    print("\n=== Phase 4-A: Creating Sequences ===")
    seq_ok = 0
    seq_skip = 0
    seq_err = 0

    # 기존 시퀀스 목록 조회
    cursor.execute("SELECT sequence_name FROM user_sequences")
    existing_seqs = {row[0] for row in cursor.fetchall()}

    for seq_name, table_name in SEQUENCES:
        if seq_name.upper() in existing_seqs:
            print(f"  SKIP: {seq_name} (already exists)")
            seq_skip += 1
            continue

        try:
            # MAX(ID) 조회 (가능한 경우)
            max_id = 0
            try:
                cursor.execute(f"SELECT NVL(MAX(ID), 0) FROM {table_name}")
                result = cursor.fetchone()
                if result and result[0] and str(result[0]).isdigit():
                    max_id = int(result[0])
            except:
                pass

            start_val = max_id + 1
            cursor.execute(f"CREATE SEQUENCE {seq_name} START WITH {start_val} INCREMENT BY 1 NOCACHE NOCYCLE")
            print(f"  OK: {seq_name} (start={start_val})")
            seq_ok += 1
        except Exception as e:
            print(f"  ERR: {seq_name} → {e}")
            seq_err += 1

    print(f"  Sequences: {seq_ok} created, {seq_skip} skipped, {seq_err} errors")

    # =========================================================================
    # Phase 4-B: ID VARCHAR2/RAW → NUMBER 변환 (PL/SQL 프로시저)
    # =========================================================================
    print("\n=== Phase 4-B: Converting ID columns to NUMBER ===")
    conv_ok = 0
    conv_skip = 0
    conv_err = 0

    for table_name, seq_name in CONVERT_TABLES:
        try:
            cursor.callproc("DBMS_OUTPUT.ENABLE", [1000000])

            # ID 컬럼 타입 확인
            cursor.execute(
                "SELECT data_type FROM user_tab_columns WHERE table_name = :t AND column_name = 'ID'",
                {'t': table_name}
            )
            row = cursor.fetchone()
            if not row:
                print(f"  SKIP: {table_name} (no ID column)")
                conv_skip += 1
                continue

            data_type = row[0]
            if data_type == 'NUMBER':
                print(f"  SKIP: {table_name}.ID already NUMBER")
                conv_skip += 1
                continue

            # 데이터 건수 확인
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            row_count = cursor.fetchone()[0]

            # PK 삭제
            cursor.execute(
                "SELECT constraint_name FROM user_constraints WHERE table_name = :t AND constraint_type = 'P'",
                {'t': table_name}
            )
            pk_row = cursor.fetchone()
            if pk_row:
                try:
                    cursor.execute(f'ALTER TABLE {table_name} DROP CONSTRAINT "{pk_row[0]}"')
                except:
                    try:
                        cursor.execute(f'ALTER TABLE {table_name} DROP CONSTRAINT {pk_row[0]}')
                    except:
                        pass

            # UQ 삭제
            cursor.execute(
                "SELECT constraint_name FROM user_constraints WHERE table_name = :t AND constraint_type = 'U'",
                {'t': table_name}
            )
            for uq_row in cursor.fetchall():
                try:
                    cursor.execute(f'ALTER TABLE {table_name} DROP CONSTRAINT "{uq_row[0]}"')
                except:
                    try:
                        cursor.execute(f'ALTER TABLE {table_name} DROP CONSTRAINT {uq_row[0]}')
                    except:
                        pass

            # ID 컬럼 삭제 → 새로 추가
            cursor.execute(f"ALTER TABLE {table_name} DROP COLUMN ID")
            cursor.execute(f"ALTER TABLE {table_name} ADD ID NUMBER")

            # 기존 데이터 시퀀스값 할당
            if row_count > 0:
                cursor.execute(f"UPDATE {table_name} SET ID = {seq_name}.NEXTVAL WHERE ID IS NULL")
                conn.commit()

            # NOT NULL + PK
            cursor.execute(f"ALTER TABLE {table_name} MODIFY ID NOT NULL")
            cursor.execute(f"ALTER TABLE {table_name} ADD CONSTRAINT PK_{table_name} PRIMARY KEY (ID)")

            print(f"  OK: {table_name}.ID → NUMBER (rows={row_count})")
            conv_ok += 1

        except Exception as e:
            print(f"  ERR: {table_name} → {e}")
            conv_err += 1

    print(f"  Converted: {conv_ok} OK, {conv_skip} skipped, {conv_err} errors")

    # =========================================================================
    # Phase 4-C: 마스터 테이블 old UUID ID 컬럼 삭제
    # =========================================================================
    print("\n=== Phase 4-C: Dropping old UUID ID columns ===")
    drop_ok = 0
    drop_skip = 0
    drop_err = 0

    for table_name in DROP_ID_TABLES:
        try:
            # ID 컬럼 존재 확인
            cursor.execute(
                "SELECT data_type FROM user_tab_columns WHERE table_name = :t AND column_name = 'ID'",
                {'t': table_name}
            )
            row = cursor.fetchone()
            if not row:
                print(f"  SKIP: {table_name} (no ID column)")
                drop_skip += 1
                continue

            # PK가 ID가 아닌지 확인
            cursor.execute(
                """SELECT ucc.column_name FROM user_constraints uc
                   JOIN user_cons_columns ucc ON uc.constraint_name = ucc.constraint_name
                   WHERE uc.table_name = :t AND uc.constraint_type = 'P' AND ROWNUM = 1""",
                {'t': table_name}
            )
            pk_row = cursor.fetchone()
            if pk_row and pk_row[0] == 'ID':
                print(f"  SKIP: {table_name}.ID is still PK")
                drop_skip += 1
                continue

            cursor.execute(f"ALTER TABLE {table_name} DROP COLUMN ID")
            print(f"  OK: Dropped {table_name}.ID (old UUID)")
            drop_ok += 1

        except Exception as e:
            print(f"  ERR: {table_name} → {e}")
            drop_err += 1

    print(f"  Dropped: {drop_ok} OK, {drop_skip} skipped, {drop_err} errors")

    conn.commit()
    cursor.close()
    conn.close()

    print("\n=== Phase 4 Complete ===")


if __name__ == '__main__':
    main()
