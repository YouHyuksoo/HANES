#!/usr/bin/env python3
"""PROD_INPUT_ASSEMBLY 메뉴 등록 마이그레이션"""
import sys
sys.path.insert(0, 'C:/Users/hsyou/.claude/skills/oracle-db/scripts')
from oracle_connector import load_config, get_profile_config, connect

cfg = load_config()
_, profile = get_profile_config(cfg, 'JSHANES')
conn = connect(profile)
cur = conn.cursor()

# 1) MENU_CATEGORY_ITEMS 등록 (MERGE)
cur.execute("""
MERGE INTO MENU_CATEGORY_ITEMS t
USING (
  SELECT 'PROD_INPUT_ASSEMBLY' AS MENU_CODE,
         'PRODUCTION'          AS CATEGORY_CODE,
         37                    AS SORT_ORDER,
         '40'                  AS COMPANY,
         '1000'                AS PLANT_CD
  FROM dual
) s
ON (t.MENU_CODE = s.MENU_CODE AND t.COMPANY = s.COMPANY AND t.PLANT_CD = s.PLANT_CD)
WHEN NOT MATCHED THEN
  INSERT (MENU_CODE, CATEGORY_CODE, SORT_ORDER, COMPANY, PLANT_CD,
          CREATED_AT, CREATED_BY, UPDATED_AT, UPDATED_BY)
  VALUES (s.MENU_CODE, s.CATEGORY_CODE, s.SORT_ORDER, s.COMPANY, s.PLANT_CD,
          SYSTIMESTAMP, 'system', SYSTIMESTAMP, 'system')
""")
print(f"MENU_CATEGORY_ITEMS: {cur.rowcount}행 처리")

# 2) ROLE_MENU_PERMISSIONS 등록 (MANAGER + OPERATOR)
for role in ('MANAGER', 'OPERATOR'):
    cur.execute("""
MERGE INTO ROLE_MENU_PERMISSIONS t
USING (
  SELECT :role AS ROLE_CODE, 'PROD_INPUT_ASSEMBLY' AS MENU_CODE,
         '40' AS COMPANY, '1000' AS PLANT_CD FROM dual
) s
ON (t.ROLE_CODE = s.ROLE_CODE AND t.MENU_CODE = s.MENU_CODE
    AND t.COMPANY = s.COMPANY AND t.PLANT_CD = s.PLANT_CD)
WHEN NOT MATCHED THEN
  INSERT (ROLE_CODE, MENU_CODE, CAN_ACCESS, CREATED_AT, UPDATED_AT, COMPANY, PLANT_CD)
  VALUES (s.ROLE_CODE, s.MENU_CODE, 'Y', SYSTIMESTAMP, SYSTIMESTAMP, s.COMPANY, s.PLANT_CD)
""", role=role)
    print(f"ROLE_MENU_PERMISSIONS [{role}]: {cur.rowcount}행 처리")

conn.commit()
print("✓ 완료 — 재로그인 또는 페이지 새로고침 후 메뉴 확인")
cur.close()
conn.close()
