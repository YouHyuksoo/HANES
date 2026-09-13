-- THN 관리계획서 설비 일상점검(B51/C50~C53/F50/H50/D50/I50) 누락분
-- 제품 육안(전수)은 제외. MERGE 멱등. JSHANES 40/1000

MERGE INTO EQUIP_INSPECT_ITEM_MASTERS t
USING (
  -- B51 실드선 절단
  SELECT 'EI-B51-01' C, '공기 압력(실드절단)' N, 'DAILY' IT, 'SINGLE_CUT' ET, 'MEASURE' TY,
         '설비 AIR 0.4~0.6 MPa. 압력계 지침이 범위 내일 것.' R, 'DAILY' CY, 'MPa' U, 0.4 LSL, 0.6 USL FROM dual UNION ALL
  SELECT 'EI-B51-02', '조작버튼 상태', 'DAILY', 'SINGLE_CUT', 'VISUAL',
         '조작버튼이 정상 작동할 것.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-B51-03', '절단치구 상태(SQ=100)', 'DAILY', 'SINGLE_CUT', 'VISUAL',
         '스트립 작업시 돌기 없이 절단면이 어긋나지 않을 것.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-B51-04', '스트립성', 'DAILY', 'SINGLE_CUT', 'VISUAL',
         '스트립이 정상적으로 될 것.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-B51-05', '센서 작동(초록→빨강)', 'DAILY', 'SINGLE_CUT', 'VISUAL',
         '전선을 센서작동부에 넣어서 초록→빨강 점등 확인할 것.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-B51-06', '절단치구 수명(200만타)', 'DAILY', 'SINGLE_CUT', 'VISUAL',
         '키핑 블록(3.5, 15SQ) 200만타. 기준도수 도달 시 교체. 치구 수명관리 P/F.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  -- C50 육각압착 준비대
  SELECT 'EI-C50-01', '판조선 교체기 전원', 'DAILY', 'COMMON', 'VISUAL',
         '전원 스위치/램프가 점등할 것.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-C50-02', '판조선 교체기 카운터', 'DAILY', 'COMMON', 'VISUAL',
         '작업속도 3, 회전수 7 셋팅 시 표시값 7±1.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-C50-03', '발판 스위치', 'DAILY', 'COMMON', 'VISUAL',
         '발판 스위치 누른 후 장비가 작동할 것.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-C50-04', '롤링핀 집게 개폐', 'DAILY', 'COMMON', 'VISUAL',
         '롤링핀 집게 개/폐가 정상 작동할 것.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  -- C51/C52 압착기
  SELECT 'EI-C52-01', '에어 압력(압착기)', 'DAILY', 'AUTO_CRIMP', 'MEASURE',
         '2T 서브/30T PRESS AIR 0.4~0.6 MPa.', 'DAILY', 'MPa', 0.4, 0.6 FROM dual UNION ALL
  SELECT 'EI-C52-02', '유압(10T 80~100 / 30T 140~160)', 'DAILY', 'AUTO_CRIMP', 'MEASURE',
         '10T PRESS 80~100 kgf/cm2, 30T PRESS 140~160 kgf/cm2.', 'DAILY', 'kgf/cm2', 80, 160 FROM dual UNION ALL
  SELECT 'EI-C52-03', 'APP''L DISK CENTER', 'DAILY', 'AUTO_CRIMP', 'VISUAL',
         '상카와 디스크 CENTER 일치. 디스크 회전 시 단차감이 없을 것.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-C52-04', '동작 버튼(스트립·쉘·압착)', 'DAILY', 'AUTO_CRIMP', 'VISUAL',
         '세이프티 전원 및 스트립/쉘/압착 버튼이 정상 작동할 것.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-C52-05', '안전 센서 부저', 'DAILY', 'AUTO_CRIMP', 'VISUAL',
         '전선을 센서작동부에 넣어서 부저음 확인할 것.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-C52-06', '오일량(유면계 30~70mm)', 'DAILY', 'AUTO_CRIMP', 'VISUAL',
         '파이프/유면계 오일량이 정상. 하한 30mm 이상 70mm 이하.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-C52-07', 'APP''L 고정·유격', 'DAILY', 'AUTO_CRIMP', 'VISUAL',
         '체결볼트 고정 후 베이스판 APP''L 좌우 유격이 없을 것.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-C52-08', '압착센서 작동', 'DAILY', 'AUTO_CRIMP', 'VISUAL',
         '표준하이트 APP''L 이상 변경 시 압착센서가 정상 작동할 것.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-C52-09', '상카 슬라이드 유격', 'DAILY', 'AUTO_CRIMP', 'VISUAL',
         '상카 슬라이드 좌우 유격이 없을 것.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-C52-10', '모터부 발열(압착기)', 'DAILY', 'AUTO_CRIMP', 'MEASURE',
         '모터부 온도가 50℃를 넘지 않을 것.', 'DAILY', 'C', NULL, 50 FROM dual UNION ALL
  SELECT 'EI-C52-11', '치구 수명(10만/20만타)', 'DAILY', 'AUTO_CRIMP', 'VISUAL',
         '측각/JOINT 10만타, 일반압착 20만타. 전산 치구수명 경고 확인.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-C52-12', '컨트롤박스 내부(압착기)', 'DAILY', 'AUTO_CRIMP', 'VISUAL',
         '먼지·칩 이물질이 없을 것.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  -- C53 열수축/튜브가열
  SELECT 'EI-C53-01', '벨트·히터 상태', 'DAILY', 'OTHER', 'VISUAL',
         '벨트자국이 없고 열선 간격이 균일할 것.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-C53-02', '기어·구리스', 'DAILY', 'OTHER', 'VISUAL',
         '히터 활줄부에 구리스가 도포되어 있을 것.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-C53-03', '냉각 에어분사', 'DAILY', 'OTHER', 'VISUAL',
         '후단 센서 통과 후 냉각 에어분사가 정상 작동할 것.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-C53-04', '자동차단(500±20℃)', 'DAILY', 'OTHER', 'MEASURE',
         '500±20℃ 작업 시 자동차단장치가 열리고 편차 초과 시 닫힐 것.', 'DAILY', 'C', 480, 520 FROM dual UNION ALL
  SELECT 'EI-C53-05', '가열스위치·타이머·START', 'DAILY', 'OTHER', 'VISUAL',
         '가열스위치, 가열타이머, START 버튼이 정상 작동할 것.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-C53-06', '실작업 온도·속도(벨트식)', 'DAILY', 'OTHER', 'MEASURE',
         '실작업 온도 135±10℃, 셋팅 RPM 120, 이송 17초 3회 이내.', 'DAILY', 'C', 125, 145 FROM dual UNION ALL
  -- F50/H50 조립
  SELECT 'EI-H50-01', '조립지그 POLE 상태', 'DAILY', 'HOUSING', 'VISUAL',
         'POLE 유동/파손/변형/누락 없을 것. 방향·피어수가 분기와 일치할 것.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-H50-02', '형상가이드·컨베어 고정', 'DAILY', 'HOUSING', 'VISUAL',
         '형상가이드 유동/파손 없고 컨베어 조립지그 고정이 양호할 것.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-H50-03', '초음파 에어압력', 'DAILY', 'HOUSING', 'MEASURE',
         '작업대 AIR 0.4~0.6 MPa (4~6 kgf/cm2).', 'DAILY', 'MPa', 0.4, 0.6 FROM dual UNION ALL
  SELECT 'EI-H50-04', '초음파 조작·프로그램·기구부', 'DAILY', 'HOUSING', 'VISUAL',
         'MANUAL 버튼, 프로그램 실행, 커넥터 고정블록 이물·걸림이 없을 것.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-H51-01', '테이핑기 전원·발판·기어', 'DAILY', 'HOUSING', 'VISUAL',
         '전원 ON/OFF 정상, 발판 스위치 작동, 이송 GEAR 구리스 도포(흘러내림 없음).', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-H57-01', '너트런너·엔코더·POKAYOKE', 'DAILY', 'HOUSING', 'VISUAL',
         '너트런너 스위치/전원 정상, 데이터 자동저장, 정상품번 스캔 시 작업가능·비정상 시 알람.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  -- D50 반제품 검사대
  SELECT 'EI-D50-01', '마이크로메다 정도', 'DAILY', 'INSPECTION', 'MEASURE',
         '마이크로보드 점검 ±0.005mm 이내. 1회/일.', 'DAILY', 'mm', -0.005, 0.005 FROM dual UNION ALL
  SELECT 'EI-D50-02', '내전압 마스터 부저', 'DAILY', 'INSPECTION', 'VISUAL',
         '불량 마스터 삽입 시 주황+부저, 양품 마스터 삽입 시 녹색+부저.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  -- I50 회로/리크/내전압
  SELECT 'EI-I50-01', '회로검사기 점등·마스터', 'DAILY', 'TESTER', 'VISUAL',
         '회로검사기 점등. 마스터 샘플 시 센서부 녹색 LED 정상점등.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-I50-02', '라벨 프린터 출력', 'DAILY', 'TESTER', 'VISUAL',
         '라벨 프린터 출력상태가 양호할 것.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-I50-03', '기밀성 검사기(0.3bar)', 'DAILY', 'TESTER', 'MEASURE',
         '마스터 검사 정상. 2초 이상 인가 시 0.3 bar 이상 합격.', 'DAILY', 'bar', 0.3, NULL FROM dual UNION ALL
  SELECT 'EI-I50-04', '내전압 검사기 점등', 'DAILY', 'TESTER', 'VISUAL',
         '내전압검사기가 점등할 것. DC 3.00kV / 2s / 2.0mA.', 'DAILY', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-I50-05', '검사판 PIN 상태', 'DAILY', 'TESTER', 'VISUAL',
         '변형·이완 PIN 없고 이물질 없을 것. 판이 평평할 것.', 'DAILY', NULL, NULL, NULL FROM dual
) s
ON (t.COMPANY = '40' AND t.PLANT_CD = '1000' AND t.ITEM_CODE = s.C)
WHEN MATCHED THEN UPDATE SET
  t.ITEM_NAME = s.N, t.INSPECT_TYPE = s.IT, t.EQUIP_TYPE = s.ET, t.ITEM_TYPE = s.TY,
  t.CRITERIA = s.R, t.CYCLE = s.CY, t.UNIT = s.U, t.LSL_VALUE = s.LSL, t.USL_VALUE = s.USL,
  t.USE_YN = 'Y', t.REMARK = 'THN 관리계획서 설비 일상점검',
  t.UPDATED_BY = 'thn-equip-seed', t.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT (
  COMPANY, PLANT_CD, ITEM_CODE, ITEM_NAME, INSPECT_TYPE, EQUIP_TYPE, ITEM_TYPE,
  CRITERIA, CYCLE, UNIT, LSL_VALUE, USL_VALUE, USE_YN, REMARK,
  CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT
) VALUES (
  '40', '1000', s.C, s.N, s.IT, s.ET, s.TY, s.R, s.CY, s.U, s.LSL, s.USL, 'Y',
  'THN 관리계획서 설비 일상점검', 'thn-equip-seed', 'thn-equip-seed', SYSTIMESTAMP, SYSTIMESTAMP
)
/

MERGE INTO EQUIP_INSPECT_ITEM_POOL t
USING (
  SELECT e.EQUIP_CODE, x.ITEM_CODE, x.SORT_SEQ
  FROM EQUIP_MASTERS e
  JOIN (
    SELECT 'SHDCT' G, 'EI-B51-01' ITEM_CODE, 10 SORT_SEQ FROM dual UNION ALL
    SELECT 'SHDCT', 'EI-B51-02', 20 FROM dual UNION ALL
    SELECT 'SHDCT', 'EI-B51-03', 30 FROM dual UNION ALL
    SELECT 'SHDCT', 'EI-B51-04', 40 FROM dual UNION ALL
    SELECT 'SHDCT', 'EI-B51-05', 50 FROM dual UNION ALL
    SELECT 'SHDCT', 'EI-B51-06', 60 FROM dual UNION ALL
    SELECT 'HEXPR', 'EI-C50-01', 10 FROM dual UNION ALL
    SELECT 'HEXPR', 'EI-C50-02', 20 FROM dual UNION ALL
    SELECT 'HEXPR', 'EI-C50-03', 30 FROM dual UNION ALL
    SELECT 'HEXPR', 'EI-C50-04', 40 FROM dual UNION ALL
    SELECT 'CRIMP', 'EI-C52-01', 10 FROM dual UNION ALL
    SELECT 'CRIMP', 'EI-C52-02', 20 FROM dual UNION ALL
    SELECT 'CRIMP', 'EI-C52-03', 30 FROM dual UNION ALL
    SELECT 'CRIMP', 'EI-C52-04', 40 FROM dual UNION ALL
    SELECT 'CRIMP', 'EI-C52-05', 50 FROM dual UNION ALL
    SELECT 'CRIMP', 'EI-C52-06', 60 FROM dual UNION ALL
    SELECT 'CRIMP', 'EI-C52-07', 70 FROM dual UNION ALL
    SELECT 'CRIMP', 'EI-C52-08', 80 FROM dual UNION ALL
    SELECT 'CRIMP', 'EI-C52-09', 90 FROM dual UNION ALL
    SELECT 'CRIMP', 'EI-C52-10', 100 FROM dual UNION ALL
    SELECT 'CRIMP', 'EI-C52-11', 110 FROM dual UNION ALL
    SELECT 'CRIMP', 'EI-C52-12', 120 FROM dual UNION ALL
    SELECT 'TUBHT', 'EI-C53-01', 10 FROM dual UNION ALL
    SELECT 'TUBHT', 'EI-C53-02', 20 FROM dual UNION ALL
    SELECT 'TUBHT', 'EI-C53-03', 30 FROM dual UNION ALL
    SELECT 'TUBHT', 'EI-C53-04', 40 FROM dual UNION ALL
    SELECT 'TUBHT', 'EI-C53-05', 50 FROM dual UNION ALL
    SELECT 'TUBHT', 'EI-C53-06', 60 FROM dual UNION ALL
    SELECT 'ASSY', 'EI-H50-01', 10 FROM dual UNION ALL
    SELECT 'ASSY', 'EI-H50-02', 20 FROM dual UNION ALL
    SELECT 'ASSY', 'EI-H50-03', 30 FROM dual UNION ALL
    SELECT 'ASSY', 'EI-H50-04', 40 FROM dual UNION ALL
    SELECT 'ASSY', 'EI-H51-01', 50 FROM dual UNION ALL
    SELECT 'ASSY', 'EI-H57-01', 60 FROM dual UNION ALL
    SELECT 'SGINS', 'EI-D50-01', 10 FROM dual UNION ALL
    SELECT 'SGINS', 'EI-D50-02', 20 FROM dual UNION ALL
    SELECT 'TEST', 'EI-I50-01', 10 FROM dual UNION ALL
    SELECT 'TEST', 'EI-I50-02', 20 FROM dual UNION ALL
    SELECT 'TEST', 'EI-I50-03', 30 FROM dual UNION ALL
    SELECT 'TEST', 'EI-I50-04', 40 FROM dual UNION ALL
    SELECT 'TEST', 'EI-I50-05', 50 FROM dual
  ) x ON (
    (x.G = 'SHDCT' AND e.EQUIP_CODE LIKE 'EQ-SHDCT%')
    OR (x.G = 'HEXPR' AND e.EQUIP_CODE = 'EQ-HEXPR-01')
    OR (x.G = 'CRIMP' AND (e.EQUIP_CODE LIKE 'EQ-CRMPB%' OR e.EQUIP_CODE LIKE 'EQ-HEXCP%' OR e.EQUIP_CODE LIKE 'EQ-PRC-CRIMP%' OR e.EQUIP_CODE = 'MAG_EQ_GCRMP'))
    OR (x.G = 'TUBHT' AND e.EQUIP_CODE LIKE 'EQ-TUBHT%')
    OR (x.G = 'ASSY' AND (e.EQUIP_CODE LIKE 'EQ-MASSY%' OR e.EQUIP_CODE LIKE 'MAG_EQ_MASSY%'))
    OR (x.G = 'SGINS' AND e.EQUIP_CODE = 'EQ-SGINS-01')
    OR (x.G = 'TEST' AND (e.EQUIP_CODE LIKE 'EQ-TEST%' OR e.EQUIP_CODE LIKE 'EQ-OINSP%'))
  )
  WHERE e.COMPANY = '40' AND e.PLANT_CD = '1000' AND NVL(e.USE_YN,'Y') = 'Y'
) s
ON (t.COMPANY = '40' AND t.PLANT_CD = '1000' AND t.EQUIP_CODE = s.EQUIP_CODE
    AND t.ITEM_CODE = s.ITEM_CODE AND t.INSPECT_TYPE = 'DAILY')
WHEN MATCHED THEN UPDATE SET
  t.USE_YN = 'Y', t.SORT_SEQ = s.SORT_SEQ, t.UPDATED_BY = 'thn-equip-seed', t.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT (
  COMPANY, PLANT_CD, EQUIP_CODE, ITEM_CODE, INSPECT_TYPE, USE_YN, SORT_SEQ,
  CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT
) VALUES (
  '40', '1000', s.EQUIP_CODE, s.ITEM_CODE, 'DAILY', 'Y', s.SORT_SEQ,
  'thn-equip-seed', 'thn-equip-seed', SYSTIMESTAMP, SYSTIMESTAMP
)
/

COMMIT
/
