"""
Oracle SQL 실행 스크립트
"""

import oracledb
import json
import sys
import os

# Oracle 접속 원본은 ~/.infra/servers.json 하나뿐 (inventory_lib 경유). 레거시 ~/.oracle_db_config.json 은 읽지 않는다.
sys.path.insert(0, os.path.join(os.path.expanduser("~"), ".infra"))
import inventory_lib  # noqa: E402
CONFIG_PATH = inventory_lib.inventory_path()  # ~/.infra/servers.json (읽기는 inventory_lib 로만)

def load_config():
    return inventory_lib.legacy_oracle_config()

def get_connection(site_name):
    config = load_config()
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

def execute_sql(site_name, sql):
    """SQL 실행"""
    conn = get_connection(site_name)
    try:
        cur = conn.cursor()
        cur.execute(sql)
        conn.commit()
        print(f"[OK] SQL 실행 성공: {sql[:100]}...")
    except Exception as e:
        print(f"[ERROR] 오류: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

def check_column_exists(site_name, table_name, column_name):
    """컬럼 존재 여부 확인"""
    conn = get_connection(site_name)
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT COUNT(*) FROM user_tab_columns 
            WHERE table_name = :table_name AND column_name = :column_name
        """, {"table_name": table_name.upper(), "column_name": column_name.upper()})
        count = cur.fetchone()[0]
        return count > 0
    finally:
        conn.close()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python execute_sql.py <site_name> <sql>")
        sys.exit(1)
    
    site_name = sys.argv[1]
    sql = sys.argv[2]
    
    execute_sql(site_name, sql)
