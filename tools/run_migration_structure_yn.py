"""FG_LABELS.STRUCTURE_YN 마이그레이션 실행"""
import sys
sys.path.insert(0, 'C:/Users/hsyou/.claude/skills/oracle-db/scripts')
from oracle_connector import load_config, get_profile_config, connect

cfg = load_config()
_, profile = get_profile_config(cfg, 'JSHANES')
conn = connect(profile)
cur = conn.cursor()

# 컬럼 존재 여부 확인
cur.execute("SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE TABLE_NAME='FG_LABELS' AND COLUMN_NAME='STRUCTURE_YN' AND OWNER='MES'")
if cur.fetchone():
    print("STRUCTURE_YN 컬럼 이미 존재")
else:
    cur.execute("ALTER TABLE FG_LABELS ADD STRUCTURE_YN VARCHAR2(1)")
    print("STRUCTURE_YN 컬럼 추가 완료")

cur.execute("SELECT COUNT(*) FROM FG_LABELS WHERE STATUS IN ('STRUCTURE_PASS', 'STRUCTURE_FAIL')")
r = cur.fetchone()
print(f'STRUCTURE_PASS/FAIL 상태 레코드: {r[0]}건')

# 데이터 마이그레이션
cur.execute("""
  UPDATE FG_LABELS
  SET STRUCTURE_YN = CASE
    WHEN STATUS = 'STRUCTURE_PASS' THEN 'Y'
    WHEN STATUS = 'STRUCTURE_FAIL' THEN 'N'
  END
  WHERE STATUS IN ('STRUCTURE_PASS', 'STRUCTURE_FAIL')
""")
print(f'STRUCTURE_YN 업데이트: {cur.rowcount}건')

# STATUS 복원 (BOX_NO 없으면 ISSUED, 있으면 VISUAL_PASS)
cur.execute("UPDATE FG_LABELS SET STATUS = 'ISSUED' WHERE STATUS IN ('STRUCTURE_PASS', 'STRUCTURE_FAIL') AND BOX_NO IS NULL")
print(f'STATUS→ISSUED 복원: {cur.rowcount}건')

cur.execute("UPDATE FG_LABELS SET STATUS = 'VISUAL_PASS' WHERE STATUS IN ('STRUCTURE_PASS', 'STRUCTURE_FAIL') AND BOX_NO IS NOT NULL")
print(f'STATUS→VISUAL_PASS 복원: {cur.rowcount}건')

conn.commit()

# 최종 상태 확인
cur.execute("SELECT STATUS, COUNT(*) FROM FG_LABELS GROUP BY STATUS ORDER BY STATUS")
print('\n=== STATUS 분포 ===')
for r in cur.fetchall():
    print(f'  {r[0]:20s} {r[1]}건')

cur.execute("SELECT STRUCTURE_YN, COUNT(*) FROM FG_LABELS WHERE STRUCTURE_YN IS NOT NULL GROUP BY STRUCTURE_YN")
print('\n=== STRUCTURE_YN 분포 ===')
for r in cur.fetchall():
    print(f'  STRUCTURE_YN={r[0]}: {r[1]}건')

cur.close()
conn.close()
