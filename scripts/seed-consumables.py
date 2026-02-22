"""
@file scripts/seed-consumables.py
@description 소모품 마스터 + 설비BOM 시드 데이터 — 하네스 제조 설비 교체/소모성 부품

구조:
  CONSUMABLE_MASTERS (기준 데이터) → 소모품 마스터 페이지
  EQUIP_BOM_ITEMS (설비BOM 품목) → 설비BOM 관리 탭
  EQUIP_BOM_RELS (설비↔BOM 연결) → 설비별 부품 매핑

카테고리:
  MOLD — 금형 (압착 어플리케이터/다이)
  JIG  — 지그 (검사 치구, 조립 치구)
  TOOL — 공구 (블레이드, 혼, 프린트헤드 등)
"""
import oracledb
import uuid
from datetime import datetime, timedelta

conn = oracledb.connect(user='test', password='test123', dsn='10.1.10.35:1527/JSHNSMES')
cur = conn.cursor()

# =============================================
# 1. CONSUMABLE_MASTERS — 소모품 마스터 (기준 데이터)
# =============================================
# (code, name, category, expectedLife, warningCount, unitPrice, vendor, location)
consumables = [
    # === MOLD — 압착 금형 (Crimping Applicator) ===
    ("CM-AP-110", "110단자 압착금형", "MOLD", 1500000, 1200000, 850000, "TE Connectivity", "금형실-A1"),
    ("CM-AP-250", "250단자 압착금형", "MOLD", 1200000, 960000, 920000, "TE Connectivity", "금형실-A2"),
    ("CM-AP-040", "040단자 압착금형", "MOLD", 1000000, 800000, 780000, "JST", "금형실-A3"),
    ("CM-AP-187", "187단자 압착금형", "MOLD", 1500000, 1200000, 880000, "Molex", "금형실-A4"),
    ("CM-AP-090", "090단자 압착금형", "MOLD", 1200000, 960000, 750000, "Sumitomo", "금형실-A5"),
    ("CM-AP-060", "060단자 압착금형", "MOLD", 1000000, 800000, 820000, "Yazaki", "금형실-A6"),

    # === TOOL — 절단/탈피 블레이드 ===
    ("CM-BL-V01", "V블레이드 세트 (절단용)", "TOOL", 3000000, 2400000, 180000, "Komax", "공구실-B1"),
    ("CM-BL-F01", "평블레이드 세트 (절단용)", "TOOL", 2500000, 2000000, 150000, "Komax", "공구실-B2"),
    ("CM-BL-S01", "탈피 블레이드 세트 (V타입)", "TOOL", 2000000, 1600000, 120000, "Schleuniger", "공구실-B3"),
    ("CM-BL-S02", "탈피 블레이드 세트 (로터리)", "TOOL", 1500000, 1200000, 160000, "Schleuniger", "공구실-B4"),
    ("CM-BL-MC1", "다선절단 블레이드 세트", "TOOL", 2000000, 1600000, 280000, "Komax", "공구실-B5"),

    # === TOOL — 초음파 용접 소모품 ===
    ("CM-UW-H01", "초음파 혼 (Sonotrode)", "TOOL", 300000, 240000, 450000, "Schunk", "공구실-C1"),
    ("CM-UW-A01", "초음파 앤빌", "TOOL", 500000, 400000, 280000, "Schunk", "공구실-C2"),

    # === TOOL — 납땜/인두 소모품 ===
    ("CM-ST-T01", "납땜 인두팁 (자동납땜용)", "TOOL", 80000, 64000, 35000, "Apollo Seiko", "공구실-C3"),

    # === TOOL — 라벨프린터/잉크젯 ===
    ("CM-PH-Z01", "써멀 프린트헤드 (Zebra)", "TOOL", None, None, 320000, "Zebra", "공구실-D1"),
    ("CM-PH-B01", "써멀 프린트헤드 (Brady)", "TOOL", None, None, 280000, "Brady", "공구실-D2"),
    ("CM-IJ-N01", "잉크젯 노즐 세트", "TOOL", None, None, 180000, "Hitachi", "공구실-D3"),
    ("CM-IJ-I01", "잉크젯 잉크 카트리지", "TOOL", None, None, 85000, "Hitachi", "공구실-D4"),

    # === JIG — 검사/조립 지그 ===
    ("CM-JG-CT1", "통전검사 치구 A타입", "JIG", 300000, 240000, 520000, "Cirris", "지그실-E1"),
    ("CM-JG-CT2", "통전검사 치구 B타입", "JIG", 300000, 240000, 480000, "Cirris", "지그실-E2"),
    ("CM-JG-HV1", "내전압검사 치구", "JIG", 500000, 400000, 350000, "Chroma", "지그실-E3"),
    ("CM-JG-SL1", "씰삽입 가이드 지그", "JIG", 200000, 160000, 120000, "자체제작", "지그실-E4"),
    ("CM-JG-TW1", "트위스트 고정 지그", "JIG", 500000, 400000, 95000, "자체제작", "지그실-E5"),

    # === TOOL — 공기압축기/집진기 소모품 ===
    ("CM-FL-A01", "에어 필터 엘리먼트", "TOOL", None, None, 45000, "Atlas Copco", "공구실-F1"),
    ("CM-FL-D01", "집진 필터 백", "TOOL", None, None, 28000, "Amano", "공구실-F2"),
]

consumable_sql = """INSERT INTO CONSUMABLE_MASTERS
(ID, CONSUMABLE_CODE, NAME, CATEGORY, EXPECTED_LIFE, CURRENT_COUNT, WARNING_COUNT,
 STOCK_QTY, SAFETY_STOCK, UNIT_PRICE, VENDOR, LOCATION,
 STATUS, USE_YN, COMPANY, CREATED_AT, UPDATED_AT)
VALUES (:1, :2, :3, :4, :5, 0, :6, :7, :8, :9, :10, :11,
 'NORMAL', 'Y', '40', SYSTIMESTAMP, SYSTIMESTAMP)"""

consumable_ids = {}
for c in consumables:
    uid = str(uuid.uuid4())
    stock = 3 if c[2] == "MOLD" else (5 if c[2] == "JIG" else 8)
    safety = 1 if c[2] == "MOLD" else (2 if c[2] == "JIG" else 3)
    cur.execute(consumable_sql, (uid, c[0], c[1], c[2], c[3], c[4],
                                  stock, safety, c[5], c[6], c[7]))
    consumable_ids[c[0]] = uid

print(f"Inserted {len(consumables)} consumable masters")


# =============================================
# 2. EQUIP_BOM_ITEMS — 설비BOM 품목
# =============================================
# (itemCode, itemName, itemType, spec, maker, unit, unitPrice, replacementCycle, stockQty, safetyStock)
bom_items = [
    # 압착 금형
    ("BOM-AP-110", "110단자 압착금형", "CONSUMABLE", "110형 어플리케이터", "TE Connectivity", "EA", 850000, 180, 3, 1),
    ("BOM-AP-250", "250단자 압착금형", "CONSUMABLE", "250형 어플리케이터", "TE Connectivity", "EA", 920000, 180, 3, 1),
    ("BOM-AP-040", "040단자 압착금형", "CONSUMABLE", "040형 어플리케이터", "JST", "EA", 780000, 150, 3, 1),
    ("BOM-AP-187", "187단자 압착금형", "CONSUMABLE", "187형 어플리케이터", "Molex", "EA", 880000, 180, 3, 1),
    ("BOM-AP-090", "090단자 압착금형", "CONSUMABLE", "090형 어플리케이터", "Sumitomo", "EA", 750000, 150, 3, 1),
    ("BOM-AP-060", "060단자 압착금형", "CONSUMABLE", "060형 어플리케이터", "Yazaki", "EA", 820000, 150, 3, 1),
    # 블레이드
    ("BOM-BL-V01", "V블레이드 세트", "CONSUMABLE", "절단기용 V블레이드", "Komax", "SET", 180000, 90, 5, 2),
    ("BOM-BL-F01", "평블레이드 세트", "CONSUMABLE", "절단기용 평블레이드", "Komax", "SET", 150000, 90, 5, 2),
    ("BOM-BL-S01", "탈피 블레이드 (V타입)", "CONSUMABLE", "Schleuniger V타입", "Schleuniger", "SET", 120000, 60, 5, 2),
    ("BOM-BL-S02", "탈피 블레이드 (로터리)", "CONSUMABLE", "로터리 탈피용", "Schleuniger", "SET", 160000, 60, 5, 2),
    ("BOM-BL-MC1", "다선절단 블레이드", "CONSUMABLE", "MegaStrip용", "Komax", "SET", 280000, 90, 4, 2),
    # 초음파 용접
    ("BOM-UW-H01", "초음파 혼", "CONSUMABLE", "Minic II/MPX용 Sonotrode", "Schunk", "EA", 450000, 120, 2, 1),
    ("BOM-UW-A01", "초음파 앤빌", "CONSUMABLE", "Minic II/MPX용", "Schunk", "EA", 280000, 180, 2, 1),
    # 납땜
    ("BOM-ST-T01", "납땜 인두팁", "CONSUMABLE", "자동납땜기용", "Apollo Seiko", "EA", 35000, 30, 10, 3),
    # 프린터/잉크젯
    ("BOM-PH-Z01", "프린트헤드 (Zebra)", "PART", "ZT411용 써멀헤드", "Zebra", "EA", 320000, 365, 2, 1),
    ("BOM-PH-B01", "프린트헤드 (Brady)", "PART", "BBP33용 써멀헤드", "Brady", "EA", 280000, 365, 1, 1),
    ("BOM-IJ-N01", "잉크젯 노즐", "PART", "UX-D160W용", "Hitachi", "SET", 180000, 180, 2, 1),
    # 검사 지그
    ("BOM-JG-CT1", "통전검사 치구 A", "CONSUMABLE", "Cirris CH2용 핀보드", "Cirris", "EA", 520000, 120, 2, 1),
    ("BOM-JG-CT2", "통전검사 치구 B", "CONSUMABLE", "CableEye용 핀보드", "CableEye", "EA", 480000, 120, 2, 1),
    ("BOM-JG-HV1", "내전압 검사 치구", "CONSUMABLE", "Chroma 19055용", "Chroma", "EA", 350000, 180, 2, 1),
    # 유틸리티
    ("BOM-FL-A01", "에어 필터", "CONSUMABLE", "GA22+용 엘리먼트", "Atlas Copco", "EA", 45000, 90, 5, 2),
    ("BOM-FL-D01", "집진 필터 백", "CONSUMABLE", "PiE-30SDN용", "Amano", "EA", 28000, 60, 8, 3),
]

bom_sql = """INSERT INTO EQUIP_BOM_ITEMS
(ID, ITEM_CODE, ITEM_NAME, ITEM_TYPE, SPEC, MAKER, UNIT, UNIT_PRICE,
 REPLACEMENT_CYCLE, STOCK_QTY, SAFETY_STOCK, USE_YN, COMPANY, CREATED_AT, UPDATED_AT)
VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, 'Y', '40', SYSTIMESTAMP, SYSTIMESTAMP)"""

bom_ids = {}
for b in bom_items:
    uid = str(uuid.uuid4())
    cur.execute(bom_sql, (uid, b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8], b[9]))
    bom_ids[b[0]] = uid

print(f"Inserted {len(bom_items)} BOM items")


# =============================================
# 3. 설비 ID 가져오기
# =============================================
cur.execute("SELECT ID, EQUIP_CODE FROM EQUIP_MASTERS WHERE DELETED_AT IS NULL")
equip_ids = {r[1]: r[0] for r in cur.fetchall()}


# =============================================
# 4. EQUIP_BOM_RELS — 설비↔BOM 연결
# =============================================
# (equipCode, bomItemCode, qty, remark)
rels = [
    # === 절단기 → 블레이드 ===
    ("CS-001", "BOM-BL-V01", 1, "메인 절단 블레이드"),
    ("CS-002", "BOM-BL-V01", 1, "메인 절단 블레이드"),
    ("CS-003", "BOM-BL-F01", 1, "Alpha 550용 평블레이드"),
    ("CS-004", "BOM-BL-S01", 1, "UniStrip용 탈피 블레이드"),
    ("MC-001", "BOM-BL-MC1", 1, "MegaStrip 다선절단 블레이드"),
    ("MC-002", "BOM-BL-MC1", 1, "MegaStrip 다선절단 블레이드"),

    # === 반자동 탈피기 → 탈피 블레이드 ===
    ("MS-001", "BOM-BL-S02", 1, "EcoStrip 로터리 블레이드"),
    ("MS-002", "BOM-BL-S02", 1, "EcoStrip 로터리 블레이드"),

    # === 전자동 압착기 → 압착 금형 (주요 단자 타입 1~2개씩) ===
    ("AC-001", "BOM-AP-110", 1, "110단자 금형"),
    ("AC-001", "BOM-AP-250", 1, "250단자 금형"),
    ("AC-002", "BOM-AP-040", 1, "040단자 금형"),
    ("AC-002", "BOM-AP-187", 1, "187단자 금형"),
    ("AC-003", "BOM-AP-090", 1, "090단자 금형"),
    ("AC-003", "BOM-AP-060", 1, "060단자 금형"),
    ("AC-004", "BOM-AP-110", 1, "110단자 금형"),
    ("AC-004", "BOM-AP-040", 1, "040단자 금형"),

    # === 반자동 압착기 → 압착 금형 ===
    ("SA-001", "BOM-AP-250", 1, "250단자 금형"),
    ("SA-002", "BOM-AP-187", 1, "187단자 금형"),

    # === 수동 압착 프레스 → 압착 금형 ===
    ("MP-001", "BOM-AP-110", 1, "110단자 금형"),
    ("MP-002", "BOM-AP-250", 1, "250단자 금형"),
    ("MP-003", "BOM-AP-040", 1, "040단자 금형"),
    ("MP-004", "BOM-AP-090", 1, "090단자 금형"),

    # === 초음파 용접기 → 혼/앤빌 ===
    ("UW-001", "BOM-UW-H01", 1, "초음파 혼 (Schunk Minic II)"),
    ("UW-001", "BOM-UW-A01", 1, "초음파 앤빌"),
    ("UW-002", "BOM-UW-H01", 1, "초음파 혼 (Telsonic MPX)"),
    ("UW-002", "BOM-UW-A01", 1, "초음파 앤빌"),

    # === 납땜기 → 인두팁 ===
    ("SL-001", "BOM-ST-T01", 2, "납땜 인두팁 (메인+보조)"),

    # === 통전검사기 → 검사 치구 ===
    ("CT-001", "BOM-JG-CT1", 1, "Cirris CH2 통전검사 치구"),
    ("CT-002", "BOM-JG-CT1", 1, "Cirris CH2 통전검사 치구"),
    ("CT-003", "BOM-JG-CT1", 1, "Cirris CH2 통전검사 치구"),
    ("CT-004", "BOM-JG-CT2", 1, "CableEye 통전검사 치구"),

    # === 내전압검사기 → 검사 치구 ===
    ("HV-001", "BOM-JG-HV1", 1, "Chroma 내전압 검사 치구"),
    ("HV-002", "BOM-JG-HV1", 1, "Chroma 내전압 검사 치구"),

    # === 라벨프린터 → 프린트헤드 ===
    ("LP-001", "BOM-PH-Z01", 1, "Zebra ZT411 프린트헤드"),
    ("LP-002", "BOM-PH-Z01", 1, "Zebra ZT411 프린트헤드"),
    ("LP-003", "BOM-PH-B01", 1, "Brady BBP33 프린트헤드"),

    # === 잉크젯 마커 → 노즐 ===
    ("IJ-001", "BOM-IJ-N01", 1, "잉크젯 노즐 세트"),

    # === 공기압축기 → 에어필터 ===
    ("UT-001", "BOM-FL-A01", 1, "에어 필터 엘리먼트"),

    # === 집진기 → 집진필터 ===
    ("UT-002", "BOM-FL-D01", 4, "집진 필터 백 (4매)"),
]

rel_sql = """INSERT INTO EQUIP_BOM_RELS
(ID, EQUIP_ID, BOM_ITEM_ID, QUANTITY, INSTALL_DATE, REMARK,
 USE_YN, COMPANY, CREATED_AT, UPDATED_AT)
VALUES (:1, :2, :3, :4, TO_DATE(:5, 'YYYY-MM-DD'), :6,
 'Y', '40', SYSTIMESTAMP, SYSTIMESTAMP)"""

rel_count = 0
skipped = []
for r in rels:
    equip_id = equip_ids.get(r[0])
    bom_id = bom_ids.get(r[1])
    if not equip_id or not bom_id:
        skipped.append(f"{r[0]}-{r[1]}")
        continue
    uid = str(uuid.uuid4())
    cur.execute(rel_sql, (uid, equip_id, bom_id, r[2], "2024-01-01", r[3]))
    rel_count += 1

print(f"Inserted {rel_count} BOM relations")
if skipped:
    print(f"Skipped: {skipped}")

conn.commit()

# =============================================
# Summary
# =============================================
cur.execute("SELECT CATEGORY, COUNT(*) FROM CONSUMABLE_MASTERS WHERE DELETED_AT IS NULL GROUP BY CATEGORY ORDER BY CATEGORY")
print("\n=== CONSUMABLE_MASTERS 카테고리별 ===")
for r in cur.fetchall():
    print(f"  {r[0]:6s}: {r[1]}건")

cur.execute("SELECT ITEM_TYPE, COUNT(*) FROM EQUIP_BOM_ITEMS WHERE DELETED_AT IS NULL GROUP BY ITEM_TYPE")
print("\n=== EQUIP_BOM_ITEMS 타입별 ===")
for r in cur.fetchall():
    print(f"  {r[0]:12s}: {r[1]}건")

cur.execute("""
    SELECT e.EQUIP_CODE, e.EQUIP_NAME, COUNT(r.ID) cnt
    FROM EQUIP_MASTERS e
    JOIN EQUIP_BOM_RELS r ON r.EQUIP_ID = e.ID AND r.DELETED_AT IS NULL
    WHERE e.DELETED_AT IS NULL
    GROUP BY e.EQUIP_CODE, e.EQUIP_NAME
    ORDER BY e.EQUIP_CODE
""")
print("\n=== 설비별 BOM 연결 수 ===")
for r in cur.fetchall():
    print(f"  {r[0]:8s} {r[1]:22s} → {r[2]}건")

cur.close()
conn.close()
print("\nDone!")
