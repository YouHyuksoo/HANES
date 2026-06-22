#!/usr/bin/env python3
"""SHIP_PALLET_SHIP 메뉴 등록 마이그레이션"""
import sys
sys.path.insert(0, 'C:/Users/hsyou/.claude/skills/oracle-db/scripts')
from oracle_connector import load_config, get_profile_config, connect

cfg = load_config()
_, profile = get_profile_config(cfg, 'JSHANES')
conn = connect(profile)
cur = conn.cursor()

SQL = """
INSERT ALL
  WHEN menu_missing = 1 THEN
    INTO MENU_CATEGORY_ITEMS (MENU_CODE, CATEGORY_CODE, SORT_ORDER, COMPANY, PLANT_CD, CREATED_BY, UPDATED_BY)
    VALUES ('SHIP_PALLET_SHIP', 'SHIPPING', 80, '40', '1000', 'system', 'system')
  WHEN manager_missing = 1 THEN
    INTO ROLE_MENU_PERMISSIONS (ROLE_CODE, MENU_CODE, CAN_ACCESS, COMPANY, PLANT_CD)
    VALUES ('MANAGER', 'SHIP_PALLET_SHIP', 'Y', '40', '1000')
  WHEN operator_missing = 1 THEN
    INTO ROLE_MENU_PERMISSIONS (ROLE_CODE, MENU_CODE, CAN_ACCESS, COMPANY, PLANT_CD)
    VALUES ('OPERATOR', 'SHIP_PALLET_SHIP', 'Y', '40', '1000')
  WHEN viewer_missing = 1 THEN
    INTO ROLE_MENU_PERMISSIONS (ROLE_CODE, MENU_CODE, CAN_ACCESS, COMPANY, PLANT_CD)
    VALUES ('VIEWER', 'SHIP_PALLET_SHIP', 'Y', '40', '1000')
SELECT
  CASE WHEN NOT EXISTS (
    SELECT 1 FROM MENU_CATEGORY_ITEMS
    WHERE MENU_CODE = 'SHIP_PALLET_SHIP' AND COMPANY = '40' AND PLANT_CD = '1000'
  ) THEN 1 ELSE 0 END AS menu_missing,
  CASE WHEN NOT EXISTS (
    SELECT 1 FROM ROLE_MENU_PERMISSIONS
    WHERE ROLE_CODE = 'MANAGER' AND MENU_CODE = 'SHIP_PALLET_SHIP' AND COMPANY = '40' AND PLANT_CD = '1000'
  ) THEN 1 ELSE 0 END AS manager_missing,
  CASE WHEN NOT EXISTS (
    SELECT 1 FROM ROLE_MENU_PERMISSIONS
    WHERE ROLE_CODE = 'OPERATOR' AND MENU_CODE = 'SHIP_PALLET_SHIP' AND COMPANY = '40' AND PLANT_CD = '1000'
  ) THEN 1 ELSE 0 END AS operator_missing,
  CASE WHEN NOT EXISTS (
    SELECT 1 FROM ROLE_MENU_PERMISSIONS
    WHERE ROLE_CODE = 'VIEWER' AND MENU_CODE = 'SHIP_PALLET_SHIP' AND COMPANY = '40' AND PLANT_CD = '1000'
  ) THEN 1 ELSE 0 END AS viewer_missing
FROM DUAL
"""

cur.execute(SQL)
conn.commit()
print("[OK] SHIP_PALLET_SHIP menu seed applied.")
cur.close()
conn.close()
