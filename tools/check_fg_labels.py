import oracledb
conn = oracledb.connect(user='MES', password='MES', dsn='10.1.10.35:1527/JSHNSMES')
cur = conn.cursor()
cur.execute("SELECT COLUMN_NAME, DATA_TYPE, NULLABLE FROM ALL_TAB_COLUMNS WHERE TABLE_NAME='FG_LABELS' AND OWNER='MES' ORDER BY COLUMN_ID")
cols = cur.fetchall()
for c in cols:
    print(f'{c[0]:30s} {c[1]:20s} {c[2]}')
cur.close()
conn.close()
