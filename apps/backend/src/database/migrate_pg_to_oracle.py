#!/usr/bin/env python3
"""
PostgreSQL (Prisma) → Oracle (MYDBPDB) 데이터 마이그레이션 스크립트
"""

import json
import os
import sys
from datetime import datetime
from typing import List, Dict, Any

# psycopg2가 없으면 설치 안내
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("❌ psycopg2가 설치되어 있지 않습니다.")
    print("   설치 명령: pip install psycopg2-binary")
    sys.exit(1)

try:
    import oracledb
except ImportError:
    print("❌ oracledb가 설치되어 있지 않습니다.")
    print("   설치 명령: pip install oracledb")
    sys.exit(1)

# 연결 설정
POSTGRES_CONFIG = {
    'host': 'YOUR_POOLER_HOST',
    'port': 6543,
    'database': 'postgres',
    'user': 'postgres.YOUR_PROJECT_REF',
    'password': 'Sexpotdbgurtn'
}

ORACLE_CONFIG = {
    'user': 'HNSMES',
    'password': 'your-oracle-password',
    'dsn': 'localhost:1521/XEPDB'
}

# 마이그레이션할 테이블 목록 (순서 중요 - FK 의존성 고려)
TABLE_ORDER = [
    # 마스터 데이터
    'com_codes',
    'company_masters',
    'department_masters',
    'partner_masters',
    'num_rule_masters',
    'plants',
    'prod_line_masters',
    'process_masters',
    'vendor_masters',
    'worker_masters',
    'part_masters',
    'equip_masters',
    'consumable_masters',
    'label_templates',
    'comm_configs',
    
    # BOM
    'bom_masters',
    'process_maps',
    'work_instructions',
    'iqc_item_masters',
    'equip_inspect_item_masters',
    
    # 사용자
    'users',
    'user_auths',
    
    # 창고/LOT
    'warehouses',
    'lots',
    'mat_lots',
    'stocks',
    'mat_stocks',
    
    # 구매/외주
    'purchase_orders',
    'purchase_order_items',
    'subcon_orders',
    'subcon_deliveries',
    'subcon_receives',
    
    # 작업/생산
    'job_orders',
    'prod_results',
    'inspect_results',
    'defect_logs',
    'repair_logs',
    
    # 자재/재고
    'stock_transactions',
    'mat_issues',
    'consumable_logs',
    'inv_adj_logs',
    
    # 출하
    'box_masters',
    'pallet_masters',
    'shipment_logs',
    'shipment_orders',
    'shipment_order_items',
    'shipment_returns',
    'shipment_return_items',
    'customer_orders',
    'customer_order_items',
    
    # 추적
    'trace_logs',
    'inter_logs',
    
    # 보세
    'customs_entries',
    'customs_lots',
    'customs_usage_reports',
    
    # 기타
    'equip_inspect_logs',
    'warehouse_transfer_rules',
]

BATCH_SIZE = 500

class PostgresToOracleMigrator:
    def __init__(self):
        self.pg_conn = None
        self.oracle_conn = None
        self.stats = {}

    def initialize(self):
        print('[INFO] Connecting to databases...\n')
        
        # PostgreSQL 연결
        self.pg_conn = psycopg2.connect(**POSTGRES_CONFIG)
        print('[OK] PostgreSQL connected')
        
        # Oracle 연결
        self.oracle_conn = oracledb.connect(**ORACLE_CONFIG)
        print('[OK] Oracle MYDBPDB connected\n')

    def get_postgres_data(self, table_name: str) -> List[Dict]:
        """PostgreSQL에서 데이터 조회"""
        with self.pg_conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'SELECT * FROM "{table_name}" ORDER BY id')
            return cur.fetchall()

    def get_oracle_columns(self, table_name: str) -> List[str]:
        """Oracle 테이블 컬럼 목록 조회"""
        with self.oracle_conn.cursor() as cur:
            cur.execute("""
                SELECT COLUMN_NAME 
                FROM USER_TAB_COLUMNS 
                WHERE TABLE_NAME = :1
                ORDER BY COLUMN_ID
            """, [table_name.upper()])
            return [row[0] for row in cur.fetchall()]

    def convert_value(self, value: Any, col_type: str = None) -> Any:
        """값 변환 (PostgreSQL → Oracle)"""
        if value is None:
            return None
        
        if isinstance(value, datetime):
            return value
        elif isinstance(value, dict) or isinstance(value, list):
            # JSON → CLOB (문자열)
            return json.dumps(value, ensure_ascii=False)
        elif isinstance(value, bool):
            # boolean → NUMBER(1)
            return 1 if value else 0
        elif isinstance(value, memoryview):
            # bytea → BLOB
            return value.tobytes()
        
        return value

    def insert_batch(self, table_name: str, rows: List[Dict], oracle_columns: List[str]):
        """배치 삽입"""
        if not rows or not oracle_columns:
            return

        upper_table = table_name.upper()
        
        # INSERT 문 생성
        placeholders = ', '.join([f':{i+1}' for i in range(len(oracle_columns))])
        sql = f'INSERT INTO {upper_table} ({', '.join(oracle_columns)}) VALUES ({placeholders})'
        
        with self.oracle_conn.cursor() as cur:
            for row in rows:
                # PostgreSQL 컬럼명 (snake_case) → Oracle 컬럼명 (UPPER_CASE) 매핑
                values = []
                for col in oracle_columns:
                    # PostgreSQL 컬럼명으로 변환
                    pg_col = col.lower()
                    value = row.get(pg_col)
                    values.append(self.convert_value(value))
                
                try:
                    cur.execute(sql, values)
                except Exception as e:
                    print(f"      [WARNING] Row insert error: {e}")
                    raise
            
            self.oracle_conn.commit()

    def migrate_table(self, table_name: str):
        """단일 테이블 마이그레이션"""
        print(f'\n[MIGRATING] {table_name}')
        print('-' * 60)
        
        start_time = datetime.now()
        migrated = 0
        errors = 0

        try:
            # PostgreSQL 데이터 조회
            source_rows = self.get_postgres_data(table_name)
            source_count = len(source_rows)
            print(f'   Source records: {source_count}')

            if source_count == 0:
                print('   [SKIP] No data')
                self.stats[table_name] = {'source': 0, 'target': 0, 'errors': 0}
                return

            # Oracle 컬럼 확인
            oracle_columns = self.get_oracle_columns(table_name)
            if not oracle_columns:
                print(f'   [ERROR] Table does not exist in Oracle')
                self.stats[table_name] = {'source': source_count, 'target': 0, 'errors': source_count}
                return

            # 배치 처리
            for i in range(0, len(source_rows), BATCH_SIZE):
                batch = source_rows[i:i + BATCH_SIZE]
                
                try:
                    self.insert_batch(table_name, batch, oracle_columns)
                    migrated += len(batch)
                    print(f'   Progress: {migrated}/{source_count}', end='\r')
                except Exception as e:
                    print(f'\n   ❌ Batch error: {e}')
                    errors += len(batch)

            duration = (datetime.now() - start_time).total_seconds()
            print(f'\n   [DONE] Completed: {migrated} rows in {duration:.2f}s')
            
            self.stats[table_name] = {
                'source': source_count,
                'target': migrated,
                'errors': errors
            }

        except Exception as e:
            print(f'   [ERROR] Failed: {e}')
            self.stats[table_name] = {'source': 0, 'target': 0, 'errors': 1}

    def migrate_all(self):
        """전체 마이그레이션"""
        print('\n[START] PostgreSQL → Oracle migration...\n')
        print('=' * 60)

        total_start = datetime.now()

        for table_name in TABLE_ORDER:
            self.migrate_table(table_name)

        total_duration = (datetime.now() - total_start).total_seconds()
        self.print_stats(total_duration)

    def print_stats(self, duration: float):
        """통계 출력"""
        print('\n\n' + '=' * 60)
        print('Migration Statistics')
        print('=' * 60)
        print(f'\nTotal Duration: {duration:.2f}s\n')
        
        print(f'{"Table Name":<26} | {"Source":>6} | {"Target":>6} | {"Errors":>6} | Status')
        print('-' * 70)
        
        total_source = 0
        total_target = 0
        total_errors = 0

        for table_name, stat in self.stats.items():
            total_source += stat['source']
            total_target += stat['target']
            total_errors += stat['errors']
            
            status = 'OK' if stat['errors'] == 0 and stat['source'] == stat['target'] else \
                     'WARN' if stat['errors'] > 0 else 'SKIP'
            
            print(f'{table_name:<26} | {stat["source"]:>6} | {stat["target"]:>6} | {stat["errors"]:>6} | {status}')
        
        print('-' * 70)
        print(f'{"TOTAL":<26} | {total_source:>6} | {total_target:>6} | {total_errors:>6} |')
        print('\n' + '=' * 60)
        
        if total_errors == 0:
            print('[SUCCESS] Migration completed successfully!')
        else:
            print(f'[WARNING] Migration completed with {total_errors} errors')
        print('=' * 60 + '\n')

    def close(self):
        """연결 종료"""
        if self.pg_conn:
            self.pg_conn.close()
        if self.oracle_conn:
            self.oracle_conn.close()
        print('[INFO] Connections closed')


def main():
    migrator = PostgresToOracleMigrator()
    
    try:
        migrator.initialize()
        migrator.migrate_all()
    except Exception as e:
        print(f'\n[ERROR] Migration failed: {e}')
        sys.exit(1)
    finally:
        migrator.close()


if __name__ == '__main__':
    main()
