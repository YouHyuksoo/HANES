-- THN B50 자동절단탈피기 작업전 일상점검 → EQUIP_INSPECT_ITEM_MASTERS + ATCNS 설비 풀
-- 기존 SINGLE_CUT: 공기압(EI-CMN-005), 커터날(EI-SCT-002), 절단/탈피길이(제품특성)는 유지
-- 빠진 설비일상 1~12만 추가. MERGE 멱등. JSHANES 40/1000

MERGE INTO EQUIP_INSPECT_ITEM_MASTERS t
USING (
  SELECT 'EI-B50-01' C, '공기 압력(설비·공급기)' N, 'MEASURE' T,
         '설비 AIR 0.5±0.7 MPa, 전선공급기 0.4~0.5 MPa. 압력계 지침이 범위 내일 것.' R, 'MPa' U, 0.4 LSL, 1.2 USL FROM dual UNION ALL
  SELECT 'EI-B50-02', '탈날 상태', 'VISUAL',
         '이물질이 없고 탈날 마모가 없을 것.', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-B50-03', '조작키·터치패드·비상정지', 'VISUAL',
         '조작키 및 터치패드, 비상정지 버튼이 정상 작동할 것.', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-B50-04', '공급기 피딩롤러 상태', 'VISUAL',
         '롤러부가 정상 작동할 것. 이상 소음이 없을 것.', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-B50-05', '모터 이상소음', 'VISUAL',
         '모터 이상음이 아닌 정상음일 것. 소음이 없을 것.', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-B50-06', '마킹기 잉크 상태(VideoJet)', 'VISUAL',
         '모니터 잉크량(오른쪽)·희석제(왼쪽)가 0%가 아닐 것. 0%이면 보전 호출.', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-B50-07', '전선 통과부(가이드·스트리퍼)', 'VISUAL',
         '가이드 마모·파손이 없고 스트리퍼/쉐이핑이 정상 작동할 것.', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-B50-08', '펌프류 결압', 'MEASURE',
         '벨트 마모가 없고 15초 측정값이 관리범위 내(100~250)일 것.', NULL, 100, 250 FROM dual UNION ALL
  SELECT 'EI-B50-09', 'CONTROL BOX 내부', 'VISUAL',
         '먼지·CHIP 등 이물질 혼입이 없을 것.', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-B50-10', '장비본체 FAN 작동', 'VISUAL',
         'FAN이 정상 회전할 것. 이상 시 보전 호출.', NULL, NULL, NULL FROM dual UNION ALL
  SELECT 'EI-B50-11', '모터부 발열', 'MEASURE',
         '설비 가동 1시간 후 모터부 온도가 50℃를 넘지 않을 것. 열화상 카메라 측정.', 'C', NULL, 50 FROM dual UNION ALL
  SELECT 'EI-B50-12', '탈날 수명(타수)', 'VISUAL',
         '기준도수 도달 시 교체. 측정탈날 20만타, V탈날 200만타. ERP 치구수명관리 확인.', NULL, NULL, NULL FROM dual
) s
ON (t.COMPANY = '40' AND t.PLANT_CD = '1000' AND t.ITEM_CODE = s.C)
WHEN MATCHED THEN UPDATE SET
  t.ITEM_NAME = s.N,
  t.INSPECT_TYPE = 'DAILY',
  t.EQUIP_TYPE = 'SINGLE_CUT',
  t.ITEM_TYPE = s.T,
  t.CRITERIA = s.R,
  t.CYCLE = 'DAILY',
  t.UNIT = s.U,
  t.LSL_VALUE = s.LSL,
  t.USL_VALUE = s.USL,
  t.USE_YN = 'Y',
  t.REMARK = 'THN B50 자동절단탈피기 작업전 일상점검',
  t.UPDATED_BY = 'thn-b50-seed',
  t.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT (
  COMPANY, PLANT_CD, ITEM_CODE, ITEM_NAME, INSPECT_TYPE, EQUIP_TYPE, ITEM_TYPE,
  CRITERIA, CYCLE, UNIT, LSL_VALUE, USL_VALUE, USE_YN, REMARK,
  CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT
) VALUES (
  '40', '1000', s.C, s.N, 'DAILY', 'SINGLE_CUT', s.T,
  s.R, 'DAILY', s.U, s.LSL, s.USL, 'Y', 'THN B50 자동절단탈피기 작업전 일상점검',
  'thn-b50-seed', 'thn-b50-seed', SYSTIMESTAMP, SYSTIMESTAMP
)
/

MERGE INTO EQUIP_INSPECT_ITEM_POOL t
USING (
  SELECT e.EQUIP_CODE, s.ITEM_CODE, s.SORT_SEQ
  FROM EQUIP_MASTERS e
  CROSS JOIN (
    SELECT 'EI-B50-01' ITEM_CODE, 10 SORT_SEQ FROM dual UNION ALL
    SELECT 'EI-B50-02', 20 FROM dual UNION ALL
    SELECT 'EI-B50-03', 30 FROM dual UNION ALL
    SELECT 'EI-B50-04', 40 FROM dual UNION ALL
    SELECT 'EI-B50-05', 50 FROM dual UNION ALL
    SELECT 'EI-B50-06', 60 FROM dual UNION ALL
    SELECT 'EI-B50-07', 70 FROM dual UNION ALL
    SELECT 'EI-B50-08', 80 FROM dual UNION ALL
    SELECT 'EI-B50-09', 90 FROM dual UNION ALL
    SELECT 'EI-B50-10', 100 FROM dual UNION ALL
    SELECT 'EI-B50-11', 110 FROM dual UNION ALL
    SELECT 'EI-B50-12', 120 FROM dual
  ) s
  WHERE e.COMPANY = '40' AND e.PLANT_CD = '1000'
    AND e.EQUIP_CODE IN ('EQ-ATCNS-01','EQ-ATCNS-02','EQ-ATCNS-HV-01')
) x
ON (t.COMPANY = '40' AND t.PLANT_CD = '1000' AND t.EQUIP_CODE = x.EQUIP_CODE
    AND t.ITEM_CODE = x.ITEM_CODE AND t.INSPECT_TYPE = 'DAILY')
WHEN MATCHED THEN UPDATE SET
  t.USE_YN = 'Y',
  t.SORT_SEQ = x.SORT_SEQ,
  t.UPDATED_BY = 'thn-b50-seed',
  t.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT (
  COMPANY, PLANT_CD, EQUIP_CODE, ITEM_CODE, INSPECT_TYPE, USE_YN, SORT_SEQ,
  CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT
) VALUES (
  '40', '1000', x.EQUIP_CODE, x.ITEM_CODE, 'DAILY', 'Y', x.SORT_SEQ,
  'thn-b50-seed', 'thn-b50-seed', SYSTIMESTAMP, SYSTIMESTAMP
)
/

COMMIT
/
