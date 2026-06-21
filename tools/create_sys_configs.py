"""SYS_CONFIGS 테이블 생성 + 검사 bypass 설정"""
import sys
sys.path.insert(0, 'C:/Users/hsyou/.claude/skills/oracle-db/scripts')
from oracle_connector import load_config, get_profile_config, connect

cfg = load_config()
_, profile = get_profile_config(cfg, 'JSHANES')
conn = connect(profile)
cur = conn.cursor()

print("SYS_CONFIGS 테이블 확인")

# 검사 bypass 설정 등록
configs = [
    ('STRUCTURE_INSP_BYPASS', 'INSPECTION', 'N', 'BOOLEAN', '구조검사 bypass', '구조검사를 생략합니다 (Y=생략, N=사용)', 1),
    ('VISUAL_INSP_BYPASS', 'INSPECTION', 'N', 'BOOLEAN', '외관검사 bypass', '외관검사를 생략합니다 (Y=생략, N=사용)', 2),
]

for key, grp, val, typ, label, desc, sort in configs:
    cur.execute("SELECT COUNT(*) FROM SYS_CONFIGS WHERE CONFIG_KEY = :1", [key])
    if cur.fetchone()[0] == 0:
        cur.execute(
            "INSERT INTO SYS_CONFIGS (CONFIG_KEY, CONFIG_GROUP, CONFIG_VALUE, CONFIG_TYPE, LABEL, DESCRIPTION, SORT_ORDER, COMPANY, PLANT_CD) "
            "VALUES (:1, :2, :3, :4, :5, :6, :7, '40', '1000')",
            [key, grp, val, typ, label, desc, sort]
        )
        print(f"  등록: {key} = {val}")
    else:
        print(f"  이미 존재: {key}")

conn.commit()
print("완료")
cur.close()
conn.close()
