"""
@file run_migration.py
@description Oracle DDL 마이그레이션 실행기 - SQL*Plus 스타일 스크립트를 파싱하여 순차 실행
  - '/' 구분자로 PL/SQL 블록 분리
  - SET SERVEROUTPUT, PROMPT 등 SQL*Plus 명령 필터링
  - DBMS_OUTPUT 캡처 출력
  - 각 블록별 성공/실패 리포트

사용법: python scripts/migration/run_migration.py <sql_file> [--site SITE_NAME] [--dry-run]
"""

import sys
import os
import json
import re
import argparse

# oracle_connector에서 사용하는 설정 파일 경로
CONFIG_PATH = os.path.expanduser("~/.oracle_db_config.json")

def load_site_config(site_name=None):
    """사이트 설정 로드 (oracle_connector.py 호환: profiles 키 사용)"""
    with open(CONFIG_PATH, 'r') as f:
        config = json.load(f)

    if not site_name:
        site_name = config.get('default_profile') or config.get('default_site')

    # profiles 키 우선, sites 키 fallback
    profiles = config.get('profiles', config.get('sites', {}))
    if site_name not in profiles:
        raise ValueError(f"Site '{site_name}' not found. Available: {list(profiles.keys())}")

    return profiles[site_name]

def get_connection(site_config):
    """Oracle DB 연결"""
    import oracledb

    service_key = 'service_name' if 'service_name' in site_config else 'service'
    user_key = 'username' if 'username' in site_config else 'user'
    dsn = f"{site_config['host']}:{site_config['port']}/{site_config[service_key]}"
    conn = oracledb.connect(
        user=site_config[user_key],
        password=site_config['password'],
        dsn=dsn
    )
    return conn

def parse_sql_file(filepath):
    """SQL 파일을 '/' 구분자로 블록 분리, SQL*Plus 명령 제거"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # SQL*Plus 명령 제거
    lines = content.split('\n')
    filtered_lines = []
    for line in lines:
        stripped = line.strip().upper()
        # SQL*Plus 전용 명령 스킵
        if stripped.startswith('SET SERVEROUTPUT'):
            continue
        if stripped.startswith('PROMPT '):
            continue
        filtered_lines.append(line)

    content = '\n'.join(filtered_lines)

    # '/'로 블록 분리 (줄 시작에 단독 '/'만 분리자로 인식)
    blocks = re.split(r'\n/\s*\n', content)

    result = []
    for block in blocks:
        block = block.strip()
        if not block:
            continue
        # 끝에 남은 단독 '/' 제거
        if block.endswith('\n/'):
            block = block[:-2].strip()
        if block == '/':
            continue
        # 주석만 있는 블록 스킵
        non_comment = re.sub(r'--.*$', '', block, flags=re.MULTILINE).strip()
        if not non_comment:
            continue
        result.append(block)

    return result

def execute_block(cursor, block, block_num, dry_run=False):
    """단일 PL/SQL 블록 또는 SQL 문 실행"""
    # 블록 타입 판별
    block_upper = block.strip().upper()

    # COMMIT은 별도 처리
    if block_upper == 'COMMIT' or block_upper == 'COMMIT;':
        if dry_run:
            print(f"  [DRY-RUN] Block {block_num}: COMMIT (skipped)")
            return True
        cursor.connection.commit()
        print(f"  [OK] Block {block_num}: COMMIT")
        return True

    # 블록 미리보기 (첫 줄)
    first_line = block.split('\n')[0][:100]

    if dry_run:
        print(f"  [DRY-RUN] Block {block_num}: {first_line}")
        return True

    try:
        # DBMS_OUTPUT 활성화
        cursor.callproc("DBMS_OUTPUT.ENABLE", [1000000])

        # 실행
        cursor.execute(block)

        # DBMS_OUTPUT 읽기
        output_lines = []
        status_var = cursor.var(int)
        line_var = cursor.var(str, 32767)
        while True:
            cursor.callproc("DBMS_OUTPUT.GET_LINE", [line_var, status_var])
            if status_var.getvalue() != 0:
                break
            output_lines.append(line_var.getvalue())

        print(f"  [OK] Block {block_num}: {first_line}")
        for line in output_lines:
            print(f"       > {line}")

        return True

    except Exception as e:
        err_msg = str(e)
        print(f"  [ERR] Block {block_num}: {first_line}")
        print(f"        Error: {err_msg}")
        return False

def main():
    parser = argparse.ArgumentParser(description='Oracle DDL Migration Runner')
    parser.add_argument('sql_file', help='SQL file to execute')
    parser.add_argument('--site', default=None, help='Oracle site name')
    parser.add_argument('--dry-run', action='store_true', help='Parse only, do not execute')
    parser.add_argument('--continue-on-error', action='store_true', help='Continue even if a block fails')
    args = parser.parse_args()

    if not os.path.exists(args.sql_file):
        print(f"ERROR: File not found: {args.sql_file}")
        sys.exit(1)

    # SQL 파일 파싱
    print(f"=== Parsing: {args.sql_file} ===")
    blocks = parse_sql_file(args.sql_file)
    print(f"Found {len(blocks)} executable blocks\n")

    if args.dry_run:
        print("[DRY-RUN MODE - No DB changes]")
        for i, block in enumerate(blocks, 1):
            first_line = block.split('\n')[0][:120]
            print(f"  Block {i}: {first_line}")
        print(f"\nTotal: {len(blocks)} blocks")
        return

    # DB 연결
    site_config = load_site_config(args.site)
    site_name = args.site or 'default'
    svc = site_config.get('service_name') or site_config.get('service')
    print(f"Connecting to site: {site_name} ({site_config['host']}:{site_config['port']}/{svc})")

    conn = get_connection(site_config)
    cursor = conn.cursor()

    success_count = 0
    fail_count = 0

    try:
        for i, block in enumerate(blocks, 1):
            ok = execute_block(cursor, block, i)
            if ok:
                success_count += 1
            else:
                fail_count += 1
                if not args.continue_on_error:
                    print(f"\n!!! Stopped at block {i} (use --continue-on-error to skip)")
                    break

        # 자동 커밋 (모두 성공한 경우)
        if fail_count == 0:
            conn.commit()
            print(f"\n=== Migration Complete: {success_count} blocks OK ===")
        else:
            conn.rollback()
            print(f"\n=== Migration FAILED: {success_count} OK, {fail_count} FAILED (rolled back) ===")
            sys.exit(1)

    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    main()
