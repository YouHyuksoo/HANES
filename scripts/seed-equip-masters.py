"""
@file scripts/seed-equip-masters.py
@description EQUIP_MASTERS 시드 데이터 — 하네스 제조공장 실제 설비 구성

라인 구성 (PROD_LINE_MASTERS 기준):
  P2003 (#0200) 절단 라인     — 전자동 절단탈피기, 다선절단기
  P2001 (#0100) 자동압착 라인  — 전자동 압착기, 트위스팅기
  P2002 (#0150) 수동압착 라인  — 수동 프레스, 반자동 압착기
  P2009 (#0151) 수동탈피 라인  — 수동/반자동 탈피기
  P2008 (#0202) SUB 조립 라인  — 서브 조립보드, 초음파 용접기
  P2004 (#0300) 본조립 라인    — 메인 조립보드, 테이핑기, 회전테이블
  P2005 (#0400) 통전검사 라인  — 통전검사기, 내전압검사기, 인장시험기
  P2010 (#0800) GP12검사 라인  — 압착단면분석기, 외관검사 카메라
  P2006 (#0500) 포장 라인     — 라벨프린터, 잉크젯마커, 포장기
  NONE         공용설비       — 공기압축기, 집진기
"""
import oracledb
import uuid

conn = oracledb.connect(user='test', password='test123', dsn='10.1.10.35:1527/JSHNSMES')
cur = conn.cursor()

# (equipCode, equipName, equipType, modelName, maker, lineCode, ipAddress, port, commType, installDate, status)
equipments = [
    # =============================================
    # P2003 — 절단 라인 (Cut & Strip)
    # =============================================
    ("CS-001", "전자동 절단탈피기 1호", "SINGLE_CUT", "Alpha 530", "Komax", "P2003", "192.168.10.11", 5001, "TCP", "2023-03-15", "NORMAL"),
    ("CS-002", "전자동 절단탈피기 2호", "SINGLE_CUT", "Alpha 530", "Komax", "P2003", "192.168.10.12", 5001, "TCP", "2023-03-15", "NORMAL"),
    ("CS-003", "전자동 절단탈피기 3호", "SINGLE_CUT", "Alpha 550", "Komax", "P2003", "192.168.10.13", 5001, "TCP", "2024-01-10", "NORMAL"),
    ("CS-004", "탈피기 1호", "SINGLE_CUT", "UniStrip 2300", "Schleuniger", "P2003", "192.168.10.14", 5001, "TCP", "2023-06-20", "NORMAL"),
    ("MC-001", "다선절단기 1호", "MULTI_CUT", "MegaStrip 9680", "Komax", "P2003", "192.168.10.15", 5001, "TCP", "2023-09-01", "NORMAL"),
    ("MC-002", "다선절단기 2호", "MULTI_CUT", "MegaStrip 9680", "Komax", "P2003", "192.168.10.16", 5001, "TCP", "2024-06-15", "NORMAL"),

    # =============================================
    # P2001 — 자동압착 라인 (Auto Crimping)
    # =============================================
    ("AC-001", "전자동 압착기 1호", "AUTO_CRIMP", "Zeta 640", "Komax", "P2001", "192.168.10.21", 5001, "TCP", "2023-03-15", "NORMAL"),
    ("AC-002", "전자동 압착기 2호", "AUTO_CRIMP", "Zeta 640", "Komax", "P2001", "192.168.10.22", 5001, "TCP", "2023-03-15", "NORMAL"),
    ("AC-003", "전자동 압착기 3호", "AUTO_CRIMP", "Zeta 650", "Komax", "P2001", "192.168.10.23", 5001, "TCP", "2024-02-01", "NORMAL"),
    ("AC-004", "전자동 압착기 4호", "AUTO_CRIMP", "CrimpCenter 36S", "Schleuniger", "P2001", "192.168.10.24", 5001, "TCP", "2024-05-20", "NORMAL"),
    ("TW-001", "트위스팅기 1호", "TWIST", "BT 722", "Komax", "P2001", "192.168.10.25", 5001, "TCP", "2023-06-01", "NORMAL"),
    ("TW-002", "트위스팅기 2호", "TWIST", "BT 722", "Komax", "P2001", "192.168.10.26", 5001, "TCP", "2024-01-15", "NORMAL"),
    ("SI-001", "씰삽입기 1호", "AUTO_CRIMP", "Zeta 640 Seal", "Komax", "P2001", "192.168.10.27", 5001, "TCP", "2023-09-10", "NORMAL"),

    # =============================================
    # P2002 — 수동압착 라인 (Manual Crimping)
    # =============================================
    ("MP-001", "수동 압착프레스 1호", "AUTO_CRIMP", "AP-K2N", "JST", "P2002", None, None, "NONE", "2022-06-01", "NORMAL"),
    ("MP-002", "수동 압착프레스 2호", "AUTO_CRIMP", "AP-K2N", "JST", "P2002", None, None, "NONE", "2022-06-01", "NORMAL"),
    ("MP-003", "수동 압착프레스 3호", "AUTO_CRIMP", "TM-100", "Molex", "P2002", None, None, "NONE", "2023-01-15", "NORMAL"),
    ("MP-004", "수동 압착프레스 4호", "AUTO_CRIMP", "TM-100", "Molex", "P2002", None, None, "NONE", "2023-01-15", "NORMAL"),
    ("SA-001", "반자동 압착기 1호", "AUTO_CRIMP", "CERTI-CRIMP II", "TE Connectivity", "P2002", "192.168.10.31", 502, "TCP", "2023-08-01", "NORMAL"),
    ("SA-002", "반자동 압착기 2호", "AUTO_CRIMP", "CERTI-CRIMP II", "TE Connectivity", "P2002", "192.168.10.32", 502, "TCP", "2024-03-10", "NORMAL"),

    # =============================================
    # P2009 — 수동탈피 라인 (Manual Stripping)
    # =============================================
    ("MS-001", "반자동 탈피기 1호", "SINGLE_CUT", "EcoStrip 9380", "Schleuniger", "P2009", "192.168.10.41", 5001, "SERIAL", "2023-04-01", "NORMAL"),
    ("MS-002", "반자동 탈피기 2호", "SINGLE_CUT", "EcoStrip 9380", "Schleuniger", "P2009", "192.168.10.42", 5001, "SERIAL", "2023-04-01", "NORMAL"),
    ("MS-003", "수동 탈피기 1호", "SINGLE_CUT", "WS-212", "Eraser", "P2009", None, None, "NONE", "2022-09-01", "NORMAL"),

    # =============================================
    # P2008 — SUB 조립 라인 (Sub Assembly)
    # =============================================
    ("SB-001", "서브 조립보드 1호", "HOUSING", "SB-1200", "자체제작", "P2008", None, None, "NONE", "2023-03-01", "NORMAL"),
    ("SB-002", "서브 조립보드 2호", "HOUSING", "SB-1200", "자체제작", "P2008", None, None, "NONE", "2023-03-01", "NORMAL"),
    ("SB-003", "서브 조립보드 3호", "HOUSING", "SB-1200", "자체제작", "P2008", None, None, "NONE", "2024-01-20", "NORMAL"),
    ("UW-001", "초음파 용접기 1호", "SOLDER", "Minic II", "Schunk", "P2008", "192.168.10.51", 5001, "TCP", "2023-06-15", "NORMAL"),
    ("UW-002", "초음파 용접기 2호", "SOLDER", "MPX", "Telsonic", "P2008", "192.168.10.52", 5001, "TCP", "2024-07-01", "NORMAL"),
    ("SL-001", "자동 납땜기 1호", "SOLDER", "SL-500", "Apollo Seiko", "P2008", "192.168.10.53", 5001, "TCP", "2023-09-01", "MAINT"),

    # =============================================
    # P2004 — 본조립 라인 (Main Assembly)
    # =============================================
    ("AB-001", "메인 조립보드 1호", "HOUSING", "AB-2400", "자체제작", "P2004", None, None, "NONE", "2023-03-01", "NORMAL"),
    ("AB-002", "메인 조립보드 2호", "HOUSING", "AB-2400", "자체제작", "P2004", None, None, "NONE", "2023-03-01", "NORMAL"),
    ("AB-003", "메인 조립보드 3호", "HOUSING", "AB-2400", "자체제작", "P2004", None, None, "NONE", "2023-06-01", "NORMAL"),
    ("AB-004", "메인 조립보드 4호", "HOUSING", "AB-3000", "자체제작", "P2004", None, None, "NONE", "2024-04-01", "NORMAL"),
    ("TP-001", "테이핑기 1호", "OTHER", "Rotary Taping", "Ondal", "P2004", None, None, "NONE", "2023-03-01", "NORMAL"),
    ("TP-002", "테이핑기 2호", "OTHER", "Rotary Taping", "Ondal", "P2004", None, None, "NONE", "2023-06-01", "NORMAL"),
    ("RT-001", "회전테이블 1호", "OTHER", "RT-1800", "Ondal", "P2004", "192.168.10.61", 5001, "TCP", "2023-09-01", "NORMAL"),

    # =============================================
    # P2005 — 통전검사 라인 (Electrical Test)
    # =============================================
    ("CT-001", "통전검사기 1호", "TESTER", "CH2", "Cirris", "P2005", "192.168.10.71", 5001, "TCP", "2023-03-15", "NORMAL"),
    ("CT-002", "통전검사기 2호", "TESTER", "CH2", "Cirris", "P2005", "192.168.10.72", 5001, "TCP", "2023-03-15", "NORMAL"),
    ("CT-003", "통전검사기 3호", "TESTER", "CH2", "Cirris", "P2005", "192.168.10.73", 5001, "TCP", "2024-02-01", "NORMAL"),
    ("CT-004", "통전검사기 4호", "TESTER", "Easy-Wire Pro", "CableEye", "P2005", "192.168.10.74", 5001, "TCP", "2024-06-01", "NORMAL"),
    ("HV-001", "내전압검사기 1호", "TESTER", "19055-C", "Chroma", "P2005", "192.168.10.75", 5001, "TCP", "2023-03-15", "NORMAL"),
    ("HV-002", "내전압검사기 2호", "TESTER", "19055-C", "Chroma", "P2005", "192.168.10.76", 5001, "TCP", "2024-02-01", "NORMAL"),
    ("PF-001", "인장시험기 1호", "TESTER", "ZTS-500N", "Imada", "P2005", "192.168.10.77", 5001, "SERIAL", "2023-04-01", "NORMAL"),

    # =============================================
    # P2010 — GP12 검사 (Quality Gate)
    # =============================================
    ("XS-001", "압착단면 분석기", "INSPECTION", "VHX-7000", "Keyence", "P2010", "192.168.10.81", 5001, "TCP", "2023-06-01", "NORMAL"),
    ("VI-001", "외관검사 카메라 1호", "INSPECTION", "IV2-G500CA", "Keyence", "P2010", "192.168.10.82", 5001, "TCP", "2024-01-15", "NORMAL"),
    ("VI-002", "외관검사 카메라 2호", "INSPECTION", "IV2-G500CA", "Keyence", "P2010", "192.168.10.83", 5001, "TCP", "2024-01-15", "NORMAL"),
    ("CH-001", "크림프하이트 측정기", "INSPECTION", "CH-5000", "Mitutoyo", "P2010", "192.168.10.84", 5001, "SERIAL", "2023-03-15", "NORMAL"),

    # =============================================
    # P2006 — 포장 라인 (Packing)
    # =============================================
    ("LP-001", "라벨프린터 1호", "LABEL_PRINTER", "ZT411-300dpi", "Zebra", "P2006", "192.168.10.91", 9100, "TCP", "2023-03-01", "NORMAL"),
    ("LP-002", "라벨프린터 2호", "LABEL_PRINTER", "ZT411-300dpi", "Zebra", "P2006", "192.168.10.92", 9100, "TCP", "2023-03-01", "NORMAL"),
    ("LP-003", "라벨프린터 3호", "LABEL_PRINTER", "BBP33", "Brady", "P2006", "192.168.10.93", 9100, "TCP", "2024-03-01", "NORMAL"),
    ("IJ-001", "잉크젯 마커", "LABEL_PRINTER", "UX-D160W", "Hitachi", "P2006", "192.168.10.94", 5001, "TCP", "2023-09-01", "NORMAL"),
    ("PK-001", "수축포장기 1호", "PACKING", "SW-600", "Hanwha", "P2006", None, None, "NONE", "2023-03-01", "NORMAL"),
    ("PK-002", "박스실러 1호", "PACKING", "CT-50", "3M", "P2006", None, None, "NONE", "2023-03-01", "NORMAL"),

    # =============================================
    # NONE — 공용 설비 (Utility)
    # =============================================
    ("UT-001", "공기압축기", "OTHER", "GA22+", "Atlas Copco", "NONE", "192.168.10.101", 502, "TCP", "2022-12-01", "NORMAL"),
    ("UT-002", "집진기 1호", "OTHER", "PiE-30SDN", "Amano", "NONE", "192.168.10.102", 502, "TCP", "2023-01-15", "NORMAL"),
    ("UT-003", "납연 흡연장치", "OTHER", "FE-300", "Hakko", "NONE", None, None, "NONE", "2023-03-01", "NORMAL"),
]

sql = """INSERT INTO EQUIP_MASTERS
(ID, EQUIP_CODE, EQUIP_NAME, EQUIP_TYPE, MODEL_NAME, MAKER,
 LINE_CODE, IP_ADDRESS, PORT, COMM_TYPE, INSTALL_DATE,
 STATUS, USE_YN, COMPANY, CREATED_AT, UPDATED_AT)
VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10,
 TO_DATE(:11, 'YYYY-MM-DD'), :12, 'Y', '40', SYSTIMESTAMP, SYSTIMESTAMP)"""

count = 0
for eq in equipments:
    uid = str(uuid.uuid4())
    cur.execute(sql, (uid, eq[0], eq[1], eq[2], eq[3], eq[4],
                      eq[5], eq[6], eq[7], eq[8], eq[9], eq[10]))
    count += 1

conn.commit()
print(f"Inserted {count} equipments successfully")

# Stats
cur.execute("""
    SELECT LINE_CODE, COUNT(*) cnt
    FROM EQUIP_MASTERS
    WHERE DELETED_AT IS NULL
    GROUP BY LINE_CODE
    ORDER BY LINE_CODE
""")
print("\nLine distribution:")
for row in cur.fetchall():
    print(f"  {row[0]:8s}: {row[1]} units")

cur.execute("SELECT COUNT(*) FROM EQUIP_MASTERS WHERE DELETED_AT IS NULL")
print(f"\nTotal active: {cur.fetchone()[0]}")

cur.close()
conn.close()
