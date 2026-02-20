"""
@file migrate_oracle.py
@description MYDBPDB → JSHANES Oracle DB 마이그레이션 스크립트
             DDL 추출 → 테이블 생성 → 데이터 복사 → 시퀀스/인덱스 생성
"""

import oracledb
import json
import sys
import os
from datetime import datetime, date
from decimal import Decimal

CONFIG_PATH = os.path.expanduser("~/.oracle_db_config.json")

def load_config():
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)

def get_connection(site_name):
    config = load_config()
    # profiles 또는 sites 키 지원
    sites = config.get("profiles", config.get("sites", {}))
    site = sites.get(site_name)
    if not site:
        raise ValueError(f"Site '{site_name}' not found. Available: {list(sites.keys())}")

    service = site.get("service_name", site.get("service"))
    sid = site.get("sid")
    dsn = oracledb.makedsn(site["host"], site["port"], service_name=service, sid=sid)

    mode = oracledb.AUTH_MODE_DEFAULT
    if site.get("mode") == "SYSDBA":
        mode = oracledb.AUTH_MODE_SYSDBA

    conn = oracledb.connect(user=site["user"], password=site["password"], dsn=dsn, mode=mode)
    return conn

def get_tables(conn):
    """사용자 테이블 목록 조회"""
    cur = conn.cursor()
    cur.execute("SELECT table_name FROM user_tables ORDER BY table_name")
    return [row[0] for row in cur.fetchall()]

def get_table_ddl(conn, table_name):
    """DBMS_METADATA로 테이블 DDL 추출"""
    cur = conn.cursor()
    cur.execute("""
        SELECT DBMS_METADATA.GET_DDL('TABLE', :tname) FROM DUAL
    """, {"tname": table_name})
    row = cur.fetchone()
    if row:
        clob = row[0]
        if hasattr(clob, 'read'):
            return clob.read()
        return str(clob)
    return None

def clean_ddl(ddl, source_schema, target_schema):
    """DDL 정리: 스키마 변경, 테이블스페이스 제거 등"""
    import re

    # 소스 스키마를 타겟 스키마로 변경
    ddl = ddl.replace(f'"{source_schema}".', f'"{target_schema}".')

    # TABLESPACE 절 제거
    ddl = re.sub(r'\s+TABLESPACE\s+"[^"]*"', '', ddl)

    # SEGMENT CREATION 절 제거
    ddl = re.sub(r'\s+SEGMENT\s+CREATION\s+\w+', '', ddl)

    # PCTFREE, PCTUSED 등 스토리지 옵션 제거
    ddl = re.sub(r'\s+PCTFREE\s+\d+', '', ddl)
    ddl = re.sub(r'\s+PCTUSED\s+\d+', '', ddl)
    ddl = re.sub(r'\s+INITRANS\s+\d+', '', ddl)
    ddl = re.sub(r'\s+MAXTRANS\s+\d+', '', ddl)

    # STORAGE 절 제거 (여러 줄)
    ddl = re.sub(r'\s+STORAGE\s*\([^)]*\)', '', ddl)

    # LOGGING/NOLOGGING 제거
    ddl = re.sub(r'\s+LOGGING', '', ddl)
    ddl = re.sub(r'\s+NOLOGGING', '', ddl)

    # NOCOMPRESS 제거
    ddl = re.sub(r'\s+NOCOMPRESS', '', ddl)

    # NOCACHE 제거
    ddl = re.sub(r'\s+NOCACHE', '', ddl)

    # NOPARALLEL 제거
    ddl = re.sub(r'\s+NOPARALLEL', '', ddl)

    # MONITORING 제거
    ddl = re.sub(r'\s+MONITORING', '', ddl)

    # USING INDEX ... 뒤의 스토리지 옵션 제거 (인덱스 자체는 유지)
    ddl = re.sub(r'(USING\s+INDEX\s+)PCTFREE[^)]*?(?=\))', r'\1', ddl)
    ddl = re.sub(r'USING\s+INDEX\s+ENABLE', 'ENABLE', ddl)

    # 연속 공백 정리
    ddl = re.sub(r'\n\s*\n\s*\n', '\n\n', ddl)

    return ddl.strip()

def get_table_columns(conn, table_name):
    """테이블 컬럼 목록 조회"""
    cur = conn.cursor()
    cur.execute("""
        SELECT column_name, data_type
        FROM user_tab_columns
        WHERE table_name = :tname
        ORDER BY column_id
    """, {"tname": table_name})
    return cur.fetchall()

def get_table_row_count(conn, table_name):
    """테이블 행 수 조회"""
    cur = conn.cursor()
    cur.execute(f'SELECT COUNT(*) FROM "{table_name}"')
    return cur.fetchone()[0]

def copy_data(src_conn, dst_conn, table_name, columns, batch_size=500):
    """소스에서 대상으로 데이터 복사"""
    col_names = [f'"{c[0]}"' for c in columns]
    col_list = ", ".join(col_names)
    bind_list = ", ".join([f":{i+1}" for i in range(len(columns))])

    src_cur = src_conn.cursor()
    dst_cur = dst_conn.cursor()

    src_cur.execute(f'SELECT {col_list} FROM "{table_name}"')

    total = 0
    while True:
        rows = src_cur.fetchmany(batch_size)
        if not rows:
            break

        # 데이터 타입 변환
        cleaned_rows = []
        for row in rows:
            cleaned = []
            for val in row:
                if hasattr(val, 'read'):  # CLOB/BLOB
                    cleaned.append(val.read())
                else:
                    cleaned.append(val)
            cleaned_rows.append(cleaned)

        dst_cur.executemany(
            f'INSERT INTO "{table_name}" ({col_list}) VALUES ({bind_list})',
            cleaned_rows
        )
        total += len(rows)

    dst_conn.commit()
    return total

def get_sequences(conn):
    """시퀀스 목록 조회"""
    cur = conn.cursor()
    cur.execute("""
        SELECT sequence_name, min_value, max_value, increment_by,
               cache_size, cycle_flag, last_number
        FROM user_sequences
    """)
    return cur.fetchall()

def get_custom_indexes(conn):
    """커스텀 인덱스 DDL 조회"""
    cur = conn.cursor()
    cur.execute("""
        SELECT index_name FROM user_indexes
        WHERE index_type = 'NORMAL'
        AND index_name NOT LIKE 'SYS_%'
        AND index_name NOT IN (
            SELECT constraint_name FROM user_constraints
            WHERE constraint_type IN ('P','U')
        )
    """)
    indexes = []
    for row in cur.fetchall():
        idx_name = row[0]
        cur2 = conn.cursor()
        cur2.execute("""
            SELECT DBMS_METADATA.GET_DDL('INDEX', :iname) FROM DUAL
        """, {"iname": idx_name})
        ddl_row = cur2.fetchone()
        if ddl_row:
            ddl = ddl_row[0]
            if hasattr(ddl, 'read'):
                ddl = ddl.read()
            indexes.append((idx_name, str(ddl)))
    return indexes

def main():
    source_site = "MYDBPDB"
    target_site = "JSHANES"

    print("=" * 60)
    print(f"  Oracle Migration: {source_site} → {target_site}")
    print("=" * 60)

    # 1. 연결
    print("\n[1/5] 데이터베이스 연결 중...")
    src_conn = get_connection(source_site)
    dst_conn = get_connection(target_site)

    src_user = src_conn.username.upper()
    dst_user = dst_conn.username.upper()
    print(f"  소스: {src_user}@{source_site}")
    print(f"  대상: {dst_user}@{target_site}")

    # 2. 테이블 DDL 추출 및 생성
    print("\n[2/5] 테이블 생성 중...")
    tables = get_tables(src_conn)
    print(f"  대상 테이블 수: {len(tables)}")

    created = 0
    skipped = 0
    failed = []

    for tname in tables:
        try:
            ddl = get_table_ddl(src_conn, tname)
            if not ddl:
                failed.append((tname, "DDL 추출 실패"))
                continue

            ddl = clean_ddl(ddl, src_user, dst_user)

            try:
                dst_cur = dst_conn.cursor()
                dst_cur.execute(ddl)
                dst_conn.commit()
                created += 1
                print(f"  ✓ {tname}")
            except oracledb.DatabaseError as e:
                err = str(e)
                if "ORA-00955" in err:  # 이미 존재
                    skipped += 1
                    print(f"  - {tname} (이미 존재)")
                else:
                    failed.append((tname, err.split('\n')[0]))
                    print(f"  ✗ {tname}: {err.split(chr(10))[0]}")
        except Exception as e:
            failed.append((tname, str(e)[:80]))
            print(f"  ✗ {tname}: {str(e)[:80]}")

    print(f"\n  결과: 생성 {created}, 기존 {skipped}, 실패 {len(failed)}")

    # 3. 데이터 복사
    print("\n[3/5] 데이터 복사 중...")

    # 대상 DB의 테이블 목록 다시 조회
    dst_tables = get_tables(dst_conn)

    data_copied = 0
    for tname in tables:
        if tname not in dst_tables:
            continue

        try:
            row_count = get_table_row_count(src_conn, tname)
            if row_count == 0:
                continue

            columns = get_table_columns(src_conn, tname)
            copied = copy_data(src_conn, dst_conn, tname, columns)
            data_copied += 1
            print(f"  ✓ {tname}: {copied} rows")
        except Exception as e:
            print(f"  ✗ {tname}: {str(e)[:80]}")

    print(f"\n  데이터 복사된 테이블 수: {data_copied}")

    # 4. 시퀀스 생성
    print("\n[4/5] 시퀀스 생성 중...")
    sequences = get_sequences(src_conn)

    for seq in sequences:
        seq_name, min_val, max_val, inc_by, cache, cycle, last_num = seq
        cycle_str = "CYCLE" if cycle == "Y" else "NOCYCLE"
        cache_str = f"CACHE {cache}" if cache > 0 else "NOCACHE"

        create_sql = f"""
            CREATE SEQUENCE "{seq_name}"
            START WITH {last_num}
            INCREMENT BY {inc_by}
            MINVALUE {min_val}
            MAXVALUE {max_val}
            {cache_str}
            {cycle_str}
        """
        try:
            dst_cur = dst_conn.cursor()
            dst_cur.execute(create_sql)
            dst_conn.commit()
            print(f"  ✓ {seq_name} (START WITH {last_num})")
        except oracledb.DatabaseError as e:
            if "ORA-00955" in str(e):
                print(f"  - {seq_name} (이미 존재)")
            else:
                print(f"  ✗ {seq_name}: {str(e).split(chr(10))[0]}")

    # 5. 커스텀 인덱스 생성
    print("\n[5/5] 커스텀 인덱스 생성 중...")
    indexes = get_custom_indexes(src_conn)

    for idx_name, idx_ddl in indexes:
        idx_ddl = clean_ddl(idx_ddl, src_user, dst_user)
        try:
            dst_cur = dst_conn.cursor()
            dst_cur.execute(idx_ddl)
            dst_conn.commit()
            print(f"  ✓ {idx_name}")
        except oracledb.DatabaseError as e:
            if "ORA-00955" in str(e) or "ORA-01408" in str(e):
                print(f"  - {idx_name} (이미 존재)")
            else:
                print(f"  ✗ {idx_name}: {str(e).split(chr(10))[0]}")

    # 결과 요약
    print("\n" + "=" * 60)
    print("  마이그레이션 완료!")
    print("=" * 60)

    # 대상 DB 최종 테이블 수 확인
    final_tables = get_tables(dst_conn)
    print(f"  JSHANES 테이블 수: {len(final_tables)}")

    if failed:
        print(f"\n  ⚠ 실패 목록:")
        for tname, err in failed:
            print(f"    - {tname}: {err}")

    src_conn.close()
    dst_conn.close()

if __name__ == "__main__":
    main()
