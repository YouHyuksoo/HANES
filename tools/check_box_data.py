"""박스 데이터 확인"""
import sys
sys.path.insert(0, 'C:/Users/hsyou/.claude/skills/oracle-db/scripts')
from oracle_connector import load_config, get_profile_config, connect

cfg = load_config()
_, profile = get_profile_config(cfg, 'JSHANES')
conn = connect(profile)
cur = conn.cursor()

cur.execute("SELECT BOX_NO, STATUS, COUNT(*) FROM FG_LABELS WHERE BOX_NO = 'BX2606190002' GROUP BY BOX_NO, STATUS")
for r in cur.fetchall():
    print(f'BOX={r[0]}, STATUS={r[1]}, CNT={r[2]}')

cur.execute("SELECT TABLE_NAME FROM ALL_TAB_COLUMNS WHERE COLUMN_NAME='BOX_NO' AND OWNER='MES'")
tables = cur.fetchall()
print(f'\nBOX_NO 컬럼이 있는 테이블:')
for t in tables:
    print(f'  {t[0]}')

cur.close()
conn.close()
