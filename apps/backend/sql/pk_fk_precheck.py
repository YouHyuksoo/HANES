"""신규 PK/FK 적용 전 안전성 검증: PK 컬럼 NULL 여부 + FK 데이터 정합성"""
import json, os, oracledb

PK_DEFS = {
    'IQC_GROUPS': ['COMPANY', 'PLANT_CD', 'GROUP_CODE'],
    'IQC_GROUP_ITEMS': ['COMPANY', 'PLANT_CD', 'GROUP_ID', 'INSP_ITEM_ID'],
    'IQC_ITEM_MASTERS': ['COMPANY', 'PLANT_CD', 'ITEM_CODE', 'SEQ'],
    'IQC_ITEM_POOL': ['COMPANY', 'PLANT_CD', 'INSP_ITEM_CODE'],
    'IQC_PART_LINKS': ['COMPANY', 'PLANT_CD', 'ITEM_CODE', 'PARTNER_ID'],
    'MAT_STOCKS': ['COMPANY', 'PLANT_CD', 'WAREHOUSE_CODE', 'ITEM_CODE', 'MAT_UID'],
    'PRODUCT_STOCKS': ['COMPANY', 'PLANT_CD', 'WAREHOUSE_CODE', 'ITEM_CODE', 'PRD_UID'],
    'MENU_CATEGORIES': ['COMPANY', 'PLANT_CD', 'CATEGORY_CODE'],
    'MENU_CATEGORY_ITEMS': ['COMPANY', 'PLANT_CD', 'MENU_CODE'],
    'PDA_ROLE': ['COMPANY', 'PLANT_CD', 'CODE'],
    'PROCESS_QUALITY_CONDITIONS': ['COMPANY', 'PLANT_CD', 'ROUTING_CODE', 'SEQ', 'CONDITION_SEQ'],
    'ROLES': ['COMPANY', 'PLANT_CD', 'CODE'],
    'ROUTING_GROUPS': ['COMPANY', 'PLANT_CD', 'ROUTING_CODE'],
    'ROUTING_MATERIALS': ['COMPANY', 'PLANT_CD', 'ROUTING_CODE', 'SEQ', 'CHILD_ITEM_CODE'],
    'ROUTING_PROCESSES': ['COMPANY', 'PLANT_CD', 'ROUTING_CODE', 'SEQ'],
    'WAREHOUSES': ['COMPANY', 'PLANT_CD', 'WAREHOUSE_CODE'],
    'WAREHOUSE_LOCATIONS': ['COMPANY', 'PLANT_CD', 'WAREHOUSE_CODE', 'LOCATION_CODE'],
    'WAREHOUSE_TRANSFER_RULES': ['COMPANY', 'PLANT_CD', 'FROM_WAREHOUSE_ID', 'TO_WAREHOUSE_ID'],
}

# child, childCols, parent, parentCols
FK_DEFS = [
    ('ROLE_MENU_PERMISSIONS', ['COMPANY', 'PLANT_CD', 'ROLE_CODE'], 'ROLES', ['COMPANY', 'PLANT_CD', 'CODE']),
    ('MENU_CATEGORY_ITEMS', ['COMPANY', 'PLANT_CD', 'CATEGORY_CODE'], 'MENU_CATEGORIES', ['COMPANY', 'PLANT_CD', 'CATEGORY_CODE']),
    ('IQC_PART_SPEC_ITEMS', ['COMPANY', 'PLANT_CD', 'INSP_ITEM_CODE'], 'IQC_ITEM_POOL', ['COMPANY', 'PLANT_CD', 'INSP_ITEM_CODE']),
]

with open(os.path.expanduser("~/.oracle_db_config.json")) as f:
    config = json.load(f)
site = config["profiles"]["JSHANES"]
conn = oracledb.connect(user=site["user"], password=site["password"],
                        dsn=f"{site['host']}:{site['port']}/{site['service_name']}")
cur = conn.cursor()

print("=== PK NULL 체크 (NULL 있으면 PK 불가) ===")
pk_bad = 0
for t, cols in PK_DEFS.items():
    null_cond = " OR ".join(f"{c} IS NULL" for c in cols)
    cur.execute(f"SELECT COUNT(*) FROM {t} WHERE {null_cond}")
    n = cur.fetchone()[0]
    cur.execute(f"SELECT COUNT(*) FROM {t}")
    total = cur.fetchone()[0]
    flag = "  <<< NULL!" if n else ""
    if n:
        pk_bad += 1
    print(f"  {t:30} total={total:6} null_in_pk={n}{flag}")

print("\n=== FK 정합 체크 (자식 코드가 부모에 없으면 FK 불가) ===")
fk_bad = 0
for child, ccols, parent, pcols in FK_DEFS:
    cur.execute(f"SELECT COUNT(*) FROM {child}")
    ctotal = cur.fetchone()[0]
    join = " AND ".join(f"c.{cc}=p.{pc}" for cc, pc in zip(ccols, pcols))
    cnull = " OR ".join(f"c.{cc} IS NULL" for cc in ccols)
    cur.execute(
        f"""SELECT COUNT(*) FROM {child} c WHERE NOT ({cnull})
            AND NOT EXISTS (SELECT 1 FROM {parent} p WHERE {join})"""
    )
    orphan = cur.fetchone()[0]
    flag = "  <<< ORPHAN!" if orphan else ""
    if orphan:
        fk_bad += 1
    print(f"  {child} -> {parent}: total={ctotal} orphan={orphan}{flag}")

print(f"\n{'='*40}")
print(f"PK 위험 {pk_bad}개, FK 위험 {fk_bad}개")
print("모두 0이면 안전하게 적용 가능" if pk_bad + fk_bad == 0 else "위험 항목 해결 필요")
