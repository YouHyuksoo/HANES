"""박스 테이블 확인"""
import sys
sys.path.insert(0, 'C:/Users/hsyou/.claude/skills/oracle-db/scripts')
from oracle_connector import load_config, get_profile_config, connect

cfg = load_config()
_, profile = get_profile_config(cfg, 'JSHANES')
conn = connect(profile)
cur = conn.cursor()

cur.execute("SELECT TABLE_NAME FROM ALL_TABLES WHERE OWNER='MES' AND TABLE_NAME LIKE '%BOX%'")
print("BOX 관련 테이블:")
for r in cur.fetchall():
    print(f"  {r[0]}")

cur.close()
conn.close()
