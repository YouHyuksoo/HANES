"""SYS_CONFIGS 테이블 확인"""
import sys
sys.path.insert(0, 'C:/Users/hsyou/.claude/skills/oracle-db/scripts')
from oracle_connector import load_config, get_profile_config, connect

cfg = load_config()
_, profile = get_profile_config(cfg, 'JSHANES')
conn = connect(profile)
cur = conn.cursor()

cur.execute("SELECT TABLE_NAME FROM ALL_TABLES WHERE TABLE_NAME='SYS_CONFIGS' AND OWNER='MES'")
if cur.fetchone():
    print("SYS_CONFIGS 테이블 존재")
    cur.execute("SELECT CONFIG_KEY, CONFIG_GROUP, CONFIG_VALUE, IS_ACTIVE FROM SYS_CONFIGS ORDER BY CONFIG_GROUP, CONFIG_KEY")
    for r in cur.fetchall():
        print(f"  [{r[1]}] {r[0]:35s} = {r[2]:20s} active={r[3]}")
else:
    print("SYS_CONFIGS 테이블 없음")
    cur.execute("SELECT TABLE_NAME FROM ALL_TABLES WHERE OWNER='MES' AND TABLE_NAME LIKE '%CONFIG%'")
    for r in cur.fetchall():
        print(f"  유사 테이블: {r[0]}")

cur.close()
conn.close()
