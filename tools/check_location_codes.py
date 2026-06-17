from oracle_connector import OracleConnector
c = OracleConnector()
r = c.execute("""
  SELECT GROUP_CODE, CODE, CODE_NAME FROM ISYS_BASECODE
  WHERE UPPER(GROUP_CODE) LIKE '%LOCATION%' OR UPPER(GROUP_NAME) LIKE '%LOCATION%'
     OR UPPER(GROUP_CODE) LIKE '%STORE%' OR UPPER(GROUP_NAME) LIKE '%STORE%'
  ORDER BY GROUP_CODE, SEQ
""")
for row in r:
    print(f'{row["GROUP_CODE"]:30s} {row["CODE"]:20s} {row["CODE_NAME"]}')
c.close()
