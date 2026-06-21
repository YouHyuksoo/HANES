"""STRUCTURE_DEFECT 설정을 SYS_CONFIGS에 등록"""
import sys, json
sys.path.insert(0, 'C:/Users/hsyou/.claude/skills/oracle-db/scripts')
from oracle_connector import load_config, get_profile_config, connect

cfg = load_config()
_, profile = get_profile_config(cfg, 'JSHANES')
conn = connect(profile)
cur = conn.cursor()

# 구조검사 불량항목 설정 (JSON)
defect_items = [
    {"code": "DIM", "name": "DIM'S"},
    {"code": "MISSING_PART", "name": "부재자 누락"},
]

cur.execute(
    "INSERT INTO SYS_CONFIGS (CONFIG_KEY, CONFIG_GROUP, CONFIG_VALUE, CONFIG_TYPE, LABEL, DESCRIPTION, SORT_ORDER, COMPANY, PLANT_CD) "
    "VALUES (:1, :2, :3, :4, :5, :6, :7, '40', '1000')",
    ['STRUCTURE_DEFECT_ITEMS', 'INSPECTION', json.dumps(defect_items, ensure_ascii=False),
     'JSON', '구조검사 불량항목', '구조검사에서 체크할 불량항목 리스트 (JSON 배열)', 3]
)
conn.commit()
print(f"STRUCTURE_DEFECT_ITEMS 등록: {json.dumps(defect_items, ensure_ascii=False)}")

cur.close()
conn.close()
