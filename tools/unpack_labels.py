"""PACKED 상태 FG 라벨 포장 해체 → VISUAL_PASS로 복원"""
import sys
sys.path.insert(0, 'C:/Users/hsyou/.claude/skills/oracle-db/scripts')
from oracle_connector import load_config, get_profile_config, connect

cfg = load_config()
_, profile = get_profile_config(cfg, 'JSHANES')
conn = connect(profile)
cur = conn.cursor()

# 현재 PACKED 상태 라벨 + 박스 정보 확인
cur.execute("""
  SELECT f.FG_BARCODE, f.BOX_NO, f.STATUS, f.ITEM_CODE
  FROM FG_LABELS f
  WHERE f.STATUS = 'PACKED'
  ORDER BY f.FG_BARCODE
""")
rows = cur.fetchall()
print(f'PACKED 상태 라벨: {len(rows)}건')
for r in rows:
    print(f'  {r[0]:20s} BOX={str(r[1]):15s} ITEM={r[3]}')

# 박스 할당 해제 + VISUAL_PASS 복원
cur.execute("UPDATE FG_LABELS SET STATUS = 'VISUAL_PASS', BOX_NO = NULL WHERE STATUS = 'PACKED'")
conn.commit()
print(f'포장 해체 완료: {cur.rowcount}건 (PACKED → VISUAL_PASS, BOX_NO=NULL)')

cur.close()
conn.close()
