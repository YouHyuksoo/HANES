"""SYS_CONFIG 테이블 구조 확인"""
import sys, json
sys.path.insert(0, 'C:/Users/hsyou/.claude/skills/oracle-db/scripts')
from oracle_connector import load_config, get_profile_config, connect

cfg = load_config()
_, profile = get_profile_config(cfg, 'JSHANES')
conn = connect(profile)
cur = conn.cursor()

cur.execute("SELECT COLUMN_NAME, DATA_TYPE, NULLABLE FROM ALL_TAB_COLUMNS WHERE TABLE_NAME='SYS_CONFIG' AND OWNER='MES' ORDER BY COLUMN_ID")
print("SYS_CONFIG 컬럼:")
for r in cur.fetchall():
    print(f"  {r[0]:25s} {r[1]:20s} {r[2]}")

cur.execute("SELECT CONFIG_KEY, CONFIG_VALUE, IS_ACTIVE FROM SYS_CONFIG WHERE CONFIG_GROUP = 'INSPECTION'")
print("\n기존 INSPECTION 그룹 설정:")
for r in cur.fetchall():
    print(f"  {r[0]:30s} = {r[1]:20s} active={r[2]}")

cur.close()
conn.close()
