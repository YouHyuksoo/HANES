"""PALLET_MASTERS.SHIPPED_TIME 컬럼 추가"""
import sys
sys.path.insert(0, 'C:/Users/hsyou/.claude/skills/oracle-db/scripts')
from oracle_connector import load_config, get_profile_config, connect

cfg = load_config()
_, profile = get_profile_config(cfg, 'JSHANES')
conn = connect(profile)
cur = conn.cursor()

# 컬럼 존재 여부 확인
cur.execute("SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE TABLE_NAME='PALLET_MASTERS' AND COLUMN_NAME='SHIPPED_TIME' AND OWNER='MES'")
if cur.fetchone():
    print("SHIPPED_TIME 컬럼 이미 존재")
else:
    cur.execute("ALTER TABLE PALLET_MASTERS ADD SHIPPED_TIME TIMESTAMP")
    cur.execute("COMMENT ON COLUMN PALLET_MASTERS.SHIPPED_TIME IS '출하 확정 시각 (LOADED→SHIPPED 전환 시 기록)'")
    print("SHIPPED_TIME 컬럼 추가 완료")

conn.commit()
cur.close()
conn.close()
