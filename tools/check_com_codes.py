"""COM_CODES 테이블 확인"""
import sys
sys.path.insert(0, 'C:/Users/hsyou/.claude/skills/oracle-db/scripts')
from oracle_connector import load_config, get_profile_config, connect

cfg = load_config()
_, profile = get_profile_config(cfg, 'JSHANES')
conn = connect(profile)
cur = conn.cursor()

cur.execute("SELECT TABLE_NAME FROM ALL_TABLES WHERE TABLE_NAME='COM_CODES' AND OWNER='MES'")
if cur.fetchone():
    print("COM_CODES exists")
    cur.execute("SELECT COUNT(*) FROM COM_CODES")
    print(f"Total records: {cur.fetchone()[0]}")
    cur.execute("SELECT DISTINCT GROUP_CODE FROM COM_CODES ORDER BY GROUP_CODE")
    for r in cur.fetchall():
        print(f"  Group: {r[0]}")
else:
    print("COM_CODES does not exist")
    cur.execute("SELECT TABLE_NAME FROM ALL_TAB_COLUMNS WHERE COLUMN_NAME='GROUP_CODE' AND OWNER='MES'")
    for r in cur.fetchall():
        print(f"  GROUP_CODE in: {r[0]}")

cur.close()
conn.close()
