"""SHIPPED 상태 FG 라벨을 PACKED로 출하취소"""
import sys
sys.path.insert(0, 'C:/Users/hsyou/.claude/skills/oracle-db/scripts')
from oracle_connector import load_config, get_profile_config, connect

cfg = load_config()
_, profile = get_profile_config(cfg, 'JSHANES')
conn = connect(profile)
cur = conn.cursor()

cur.execute("SELECT COUNT(*) AS CNT FROM FG_LABELS WHERE STATUS = 'SHIPPED'")
r = cur.fetchone()
print(f'SHIPPED 상태 라벨: {r[0]}건')

cur.execute("UPDATE FG_LABELS SET STATUS = 'PACKED' WHERE STATUS = 'SHIPPED'")
conn.commit()
print(f'출하취소 완료: {cur.rowcount}건 업데이트')

cur.execute("SELECT COUNT(*) AS CNT FROM FG_LABELS WHERE STATUS = 'PACKED'")
r2 = cur.fetchone()
print(f'현재 PACKED 상태 라벨: {r2[0]}건')

cur.close()
conn.close()
