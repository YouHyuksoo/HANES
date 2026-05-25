"""테넌트 스코프 audit — 40/1000이 아닌 데이터를 가진 테이블 탐지"""
import json, os, oracledb

with open(os.path.expanduser("~/.oracle_db_config.json")) as f:
    config = json.load(f)
site = config["profiles"]["JSHANES"]
conn = oracledb.connect(
    user=site["user"], password=site["password"],
    dsn=f"{site['host']}:{site['port']}/{site['service_name']}",
)
cur = conn.cursor()
cur.execute(
    """SELECT a.table_name FROM
       (SELECT table_name FROM user_tab_columns WHERE column_name='PLANT_CD') a
       JOIN (SELECT table_name FROM user_tab_columns WHERE column_name='COMPANY') b
       ON a.table_name=b.table_name ORDER BY a.table_name"""
)
tables = [r[0] for r in cur.fetchall()]

suspects = []
empty = 0
clean = 0
for t in tables:
    cur.execute(f"SELECT company, plant_cd, COUNT(*) FROM {t} GROUP BY company, plant_cd")
    rows = cur.fetchall()
    total = sum(r[2] for r in rows)
    if total == 0:
        empty += 1
        continue
    bad = [r for r in rows if not (r[0] == '40' and r[1] == '1000')]
    if bad:
        suspects.append((t, total, rows))
    else:
        clean += 1

print(f"=== 대상 {len(tables)}개 | 빈테이블 {empty} | 정상(40/1000만) {clean} | 의심 {len(suspects)} ===\n")
for t, total, rows in suspects:
    dist = ", ".join(f"[{c}/{p}]={n}" for c, p, n in rows)
    print(f"{t} (total={total}): {dist}")
