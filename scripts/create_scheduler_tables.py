"""
SCHEDULER 테이블 생성 스크립트
"""

import oracledb
import json
import sys
import os

CONFIG_PATH = os.path.expanduser("~/.oracle_db_config.json")

def load_config():
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)

def get_connection(site_name):
    config = load_config()
    sites = config.get("profiles", config.get("sites", {}))
    site = sites.get(site_name)
    if not site:
        raise ValueError(f"Site '{site_name}' not found.")

    service = site.get("service_name", site.get("service"))
    sid = site.get("sid")
    dsn = oracledb.makedsn(site["host"], site["port"], service_name=service, sid=sid)

    mode = oracledb.AUTH_MODE_DEFAULT
    if site.get("mode") == "SYSDBA":
        mode = oracledb.AUTH_MODE_SYSDBA

    conn = oracledb.connect(user=site["user"], password=site["password"], dsn=dsn, mode=mode)
    return conn

def execute_sql(conn, sql, description=""):
    """SQL 실행"""
    cur = conn.cursor()
    try:
        cur.execute(sql)
        conn.commit()
        print(f"[OK] {description}")
    except oracledb.Error as e:
        error_obj, = e.args
        if error_obj.code == 955:  # ORA-00955: 이름이 이미 사용 중
            print(f"[SKIP] {description} - 이미 존재함")
        else:
            print(f"[ERROR] {description}: {e}")
            raise
    finally:
        cur.close()

def create_tables(site_name):
    conn = get_connection(site_name)
    
    try:
        # SCHEDULER_JOBS 테이블
        execute_sql(conn, """
            CREATE TABLE SCHEDULER_JOBS (
                COMPANY VARCHAR2(20) NOT NULL,
                PLANT_CD VARCHAR2(20) NOT NULL,
                JOB_CODE VARCHAR2(50) NOT NULL,
                JOB_NAME NVARCHAR2(100) NOT NULL,
                JOB_GROUP VARCHAR2(20) NOT NULL,
                EXEC_TYPE VARCHAR2(20) NOT NULL,
                EXEC_TARGET NVARCHAR2(500) NOT NULL,
                EXEC_PARAMS NVARCHAR2(2000),
                CRON_EXPR VARCHAR2(50) NOT NULL,
                IS_ACTIVE CHAR(1) DEFAULT 'N' NOT NULL,
                MAX_RETRY NUMBER DEFAULT 0 NOT NULL,
                TIMEOUT_SEC NUMBER DEFAULT 300 NOT NULL,
                DESCRIPTION NVARCHAR2(500),
                LAST_RUN_AT TIMESTAMP,
                LAST_STATUS VARCHAR2(20),
                LAST_ERROR_AT TIMESTAMP,
                NEXT_RUN_AT TIMESTAMP,
                CREATED_BY VARCHAR2(50),
                CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                UPDATED_BY VARCHAR2(50),
                UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                CONSTRAINT PK_SCHEDULER_JOBS PRIMARY KEY (COMPANY, PLANT_CD, JOB_CODE)
            )
        """, "SCHEDULER_JOBS 테이블 생성")

        # SCHEDULER_LOGS 테이블
        execute_sql(conn, """
            CREATE TABLE SCHEDULER_LOGS (
                ID VARCHAR2(50) NOT NULL PRIMARY KEY,
                COMPANY VARCHAR2(20),
                PLANT_CD VARCHAR2(20),
                JOB_CODE VARCHAR2(50) NOT NULL,
                JOB_GROUP VARCHAR2(20),
                EXEC_TYPE VARCHAR2(20),
                EXEC_TARGET NVARCHAR2(500),
                STARTED_AT TIMESTAMP NOT NULL,
                ENDED_AT TIMESTAMP,
                STATUS VARCHAR2(20) NOT NULL,
                RESULT_MSG NVARCHAR2(2000),
                ERROR_MSG NVARCHAR2(2000),
                DURATION_MS NUMBER,
                RETRY_COUNT NUMBER DEFAULT 0,
                CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
            )
        """, "SCHEDULER_LOGS 테이블 생성")

        # SCHEDULER_NOTIFICATIONS 테이블
        execute_sql(conn, """
            CREATE TABLE SCHEDULER_NOTIFICATIONS (
                ID VARCHAR2(50) NOT NULL PRIMARY KEY,
                COMPANY VARCHAR2(20),
                PLANT_CD VARCHAR2(20),
                JOB_CODE VARCHAR2(50) NOT NULL,
                NOTI_TYPE VARCHAR2(20) NOT NULL,
                NOTI_TITLE NVARCHAR2(200) NOT NULL,
                NOTI_MESSAGE NVARCHAR2(1000),
                IS_READ CHAR(1) DEFAULT 'N' NOT NULL,
                READ_AT TIMESTAMP,
                CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
            )
        """, "SCHEDULER_NOTIFICATIONS 테이블 생성")

        # 인덱스 생성
        execute_sql(conn, """
            CREATE INDEX IDX_SCHEDULER_LOGS_JOB ON SCHEDULER_LOGS(JOB_CODE, STARTED_AT)
        """, "IDX_SCHEDULER_LOGS_JOB 인덱스 생성")

        execute_sql(conn, """
            CREATE INDEX IDX_SCHEDULER_LOGS_STATUS ON SCHEDULER_LOGS(STATUS)
        """, "IDX_SCHEDULER_LOGS_STATUS 인덱스 생성")

        execute_sql(conn, """
            CREATE INDEX IDX_SCHEDULER_NOTI_UNREAD ON SCHEDULER_NOTIFICATIONS(IS_READ, CREATED_AT)
        """, "IDX_SCHEDULER_NOTI_UNREAD 인덱스 생성")

        print("\n[SUCCESS] 모든 테이블 생성 완료!")
        
    finally:
        conn.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python create_scheduler_tables.py <site_name>")
        print("Example: python create_scheduler_tables.py JSHANES")
        sys.exit(1)
    
    site_name = sys.argv[1]
    create_tables(site_name)
