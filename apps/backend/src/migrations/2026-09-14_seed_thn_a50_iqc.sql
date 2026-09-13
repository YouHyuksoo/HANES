-- THN 관리계획서 A50 입고검사 기준 → IQC_ITEM_POOL + IQC_TEMPLATES
-- 대상: JSHANES company=40 plant=1000. MERGE 멱등.
-- 실행: python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file <this file>

MERGE INTO IQC_ITEM_POOL t
USING (
  SELECT 'THN-A50-G01' C, '품번·품명·수량 대조' N, 'VISUAL' J,
         '거래명세서와 품번/품명/수량이 일치할 것. PDA 스캔 후 ERP 등록.' R, '40' CO, '1000' PL FROM dual UNION ALL
  SELECT 'THN-A50-G02', '자재표시·입고확정', 'VISUAL',
         '거래명세서 수입검사 확인 후 입고 확정. PDA, 입고시 ERP 등록.', '40', '1000' FROM dual UNION ALL
  SELECT 'THN-A50-W01', 'WIRE 외관 및 색상', 'VISUAL',
         '규격서 색상과 일치. 흠·찍힘·인쇄 크기/색상 이상 없을 것.', '40', '1000' FROM dual UNION ALL
  SELECT 'THN-A50-W02', 'WIRE 인쇄', 'VISUAL',
         '절연체 표면에 재질, SQ, COLOR표시가 선명할 것.', '40', '1000' FROM dual UNION ALL
  SELECT 'THN-A50-W03', 'WIRE 도체상태', 'VISUAL',
         '심선 끊김·도체 변색 없고 소선 단선 없이 규격별 소선수 일치.', '40', '1000' FROM dual UNION ALL
  SELECT 'THN-A50-W04', 'WIRE 권선심', 'VISUAL',
         '절연 피복 처짐이 없이 권선 기능 손상 없을 것.', '40', '1000' FROM dual UNION ALL
  SELECT 'THN-A50-H01', 'HOUSING HINGE 상대 부품누락', 'VISUAL',
         'HINGE 타입만. 직결 체결 결함 없고 가이드/WELD LINE 구성품 누락 없을 것.', '40', '1000' FROM dual UNION ALL
  SELECT 'THN-A50-H02', 'HOUSING 변형/파손/LANCE/성형', 'VISUAL',
         '기능상 유해한 수축·변형·과다 BURR·이물질·성형불량 없을 것.', '40', '1000' FROM dual UNION ALL
  SELECT 'THN-A50-T01', 'T/W L 단자 이동', 'VISUAL',
         '부품서 표기 단자 바렐 사이즈와 일치.', '40', '1000' FROM dual UNION ALL
  SELECT 'THN-A50-T02', 'T/W L 단자외관', 'VISUAL',
         '유해한 흠, 녹, 변색, 크랙, 변형 없고 이물질 혼입 없을 것.', '40', '1000' FROM dual UNION ALL
  SELECT 'THN-A50-T03', 'T/W L 권선상태', 'VISUAL',
         '역 감김·힘 파손 없고 단자직후 밀착. 역감김·풀림 없을 것.', '40', '1000' FROM dual UNION ALL
  SELECT 'THN-A50-T04', 'T/W L 캐리어 변형', 'VISUAL',
         '단자릴 2매 이상 캐리어에 흠이 없고 T/W L 감김이 양호할 것.', '40', '1000' FROM dual UNION ALL
  SELECT 'THN-A50-S01', 'SEAL 표면', 'VISUAL',
         '유해한 기포, BURR, 흠, 찢어짐, 변색이 없을 것.', '40', '1000' FROM dual UNION ALL
  SELECT 'THN-A50-S02', 'SEAL 이물·색상', 'VISUAL',
         '부품서 표기 규격 색상과 일치할 것.', '40', '1000' FROM dual UNION ALL
  SELECT 'THN-A50-C01', 'W/CABLE 표면/변형/성형', 'VISUAL',
         '기포·WELD LINE·변색 등 유해 결함 없고 기능상 수축·변형·버 없을 것.', '40', '1000' FROM dual UNION ALL
  SELECT 'THN-A50-P01', 'TAPE 접착제', 'VISUAL',
         '접착력 저하 없을 것. 접착제가 다른 면으로 이동하지 않고 권선 불량 없을 것.', '40', '1000' FROM dual UNION ALL
  SELECT 'THN-A50-P02', 'TAPE 절단부 및 롤 감김', 'VISUAL',
         '절단과 표면이 깨끗하고 유해한 흠 없을 것. 권선 불량 없이 균일 감김.', '40', '1000' FROM dual UNION ALL
  SELECT 'THN-A50-U01', 'C/TUBE 표면·변형·권선', 'VISUAL',
         '기포·변색·흠 없이 균일. 롤 간격 균일, 튜브 양면 균등, 수축 없을 것.', '40', '1000' FROM dual UNION ALL
  SELECT 'THN-A50-V01', 'VOC·유해물질 성적서', 'VISUAL',
         'MS301-02 4대 중금속 및 브롬계 난연제 성적서 자재별 최소 연1회(1회/6개월).', '40', '1000' FROM dual UNION ALL
  SELECT 'THN-A50-V02', '내재/VOCs 체크리스트', 'VISUAL',
         'MS300-57/34/55 내재·VOCs 관리 체크리스트 최소 연1회(1회/12개월).', '40', '1000' FROM dual
) s
ON (t.COMPANY = s.CO AND t.PLANT_CD = s.PL AND t.INSP_ITEM_CODE = s.C)
WHEN MATCHED THEN UPDATE SET
  t.INSP_ITEM_NAME = s.N,
  t.JUDGE_METHOD = s.J,
  t.CRITERIA = s.R,
  t.USE_YN = 'Y',
  t.REMARK = 'THN A50 관리계획서',
  t.UPDATED_BY = 'thn-a50-seed',
  t.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT (
  INSP_ITEM_CODE, INSP_ITEM_NAME, JUDGE_METHOD, CRITERIA, REVISION, USE_YN, REMARK,
  COMPANY, PLANT_CD, CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT
) VALUES (
  s.C, s.N, s.J, s.R, 1, 'Y', 'THN A50 관리계획서',
  s.CO, s.PL, 'thn-a50-seed', 'thn-a50-seed', SYSTIMESTAMP, SYSTIMESTAMP
)
/

MERGE INTO IQC_TEMPLATES t
USING (
  SELECT 'THN-A50-WIRE' ID, 'THN A50 전선(WIRE) 입고검사' NM FROM dual UNION ALL
  SELECT 'THN-A50-HOUSING', 'THN A50 하우징 입고검사' FROM dual UNION ALL
  SELECT 'THN-A50-TWL', 'THN A50 T/W L 단자 입고검사' FROM dual UNION ALL
  SELECT 'THN-A50-SEAL', 'THN A50 SEAL/슬리브 입고검사' FROM dual UNION ALL
  SELECT 'THN-A50-WCABLE', 'THN A50 W/CABLE 입고검사' FROM dual UNION ALL
  SELECT 'THN-A50-TAPE', 'THN A50 TAPE 입고검사' FROM dual UNION ALL
  SELECT 'THN-A50-CTUBE', 'THN A50 C/TUBE 입고검사' FROM dual UNION ALL
  SELECT 'THN-A50-COMMON', 'THN A50 공통(대조·표시·VOC)' FROM dual
) s
ON (t.COMPANY = '40' AND t.PLANT_CD = '1000' AND t.TEMPLATE_ID = s.ID)
WHEN MATCHED THEN UPDATE SET
  t.TEMPLATE_NAME = s.NM, t.USE_YN = 'Y', t.UPDATED_BY = 'thn-a50-seed', t.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT (
  COMPANY, PLANT_CD, TEMPLATE_ID, TEMPLATE_NAME, SAMPLE_QTY, IS_DEST, USE_YN,
  CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT
) VALUES (
  '40', '1000', s.ID, s.NM, 1, 'N', 'Y',
  'thn-a50-seed', 'thn-a50-seed', SYSTIMESTAMP, SYSTIMESTAMP
)
/

MERGE INTO IQC_TEMPLATE_ITEMS t
USING (
  SELECT 'THN-A50-WIRE' TID, 1 SEQ, 'THN-A50-G01' C, '거래명세서와 품번/품명/수량이 일치할 것.' JC, 'MAJOR' G, 'FULL' IT FROM dual UNION ALL
  SELECT 'THN-A50-WIRE', 2, 'THN-A50-W01', '규격서 색상과 일치. 흠·찍힘·인쇄 이상 없을 것.', 'MAJOR', 'AQL' FROM dual UNION ALL
  SELECT 'THN-A50-WIRE', 3, 'THN-A50-W02', '절연체 표면에 재질, SQ, COLOR표시가 선명할 것.', 'MAJOR', 'AQL' FROM dual UNION ALL
  SELECT 'THN-A50-WIRE', 4, 'THN-A50-W03', '심선 끊김·도체 변색 없고 규격별 소선수 일치.', 'CRITICAL', 'AQL' FROM dual UNION ALL
  SELECT 'THN-A50-WIRE', 5, 'THN-A50-W04', '절연 피복 처짐 없이 권선 기능 손상 없을 것.', 'MAJOR', 'AQL' FROM dual UNION ALL
  SELECT 'THN-A50-HOUSING', 1, 'THN-A50-G01', '거래명세서와 품번/품명/수량이 일치할 것.', 'MAJOR', 'FULL' FROM dual UNION ALL
  SELECT 'THN-A50-HOUSING', 2, 'THN-A50-H01', 'HINGE 타입 구성품 누락 없고 직결 체결 결함 없을 것.', 'CRITICAL', 'AQL' FROM dual UNION ALL
  SELECT 'THN-A50-HOUSING', 3, 'THN-A50-H02', '수축·변형·과다 BURR·이물질·성형불량 없을 것.', 'MAJOR', 'AQL' FROM dual UNION ALL
  SELECT 'THN-A50-TWL', 1, 'THN-A50-G01', '거래명세서와 품번/품명/수량이 일치할 것.', 'MAJOR', 'FULL' FROM dual UNION ALL
  SELECT 'THN-A50-TWL', 2, 'THN-A50-T01', '부품서 표기 단자 바렐 사이즈와 일치.', 'CRITICAL', 'AQL' FROM dual UNION ALL
  SELECT 'THN-A50-TWL', 3, 'THN-A50-T02', '흠, 녹, 변색, 크랙, 변형, 이물질 혼입 없을 것.', 'MAJOR', 'AQL' FROM dual UNION ALL
  SELECT 'THN-A50-TWL', 4, 'THN-A50-T03', '역 감김·풀림 없고 단자직후 밀착.', 'MAJOR', 'AQL' FROM dual UNION ALL
  SELECT 'THN-A50-TWL', 5, 'THN-A50-T04', '캐리어 흠 없고 T/W L 감김이 양호할 것.', 'MINOR', 'AQL' FROM dual UNION ALL
  SELECT 'THN-A50-SEAL', 1, 'THN-A50-G01', '거래명세서와 품번/품명/수량이 일치할 것.', 'MAJOR', 'FULL' FROM dual UNION ALL
  SELECT 'THN-A50-SEAL', 2, 'THN-A50-S01', '기포, BURR, 흠, 찢어짐, 변색이 없을 것.', 'MAJOR', 'AQL' FROM dual UNION ALL
  SELECT 'THN-A50-SEAL', 3, 'THN-A50-S02', '부품서 표기 규격 색상과 일치할 것.', 'MAJOR', 'AQL' FROM dual UNION ALL
  SELECT 'THN-A50-WCABLE', 1, 'THN-A50-G01', '거래명세서와 품번/품명/수량이 일치할 것.', 'MAJOR', 'FULL' FROM dual UNION ALL
  SELECT 'THN-A50-WCABLE', 2, 'THN-A50-C01', '기포·WELD LINE·변색 없고 수축·변형·버 없을 것.', 'MAJOR', 'AQL' FROM dual UNION ALL
  SELECT 'THN-A50-TAPE', 1, 'THN-A50-G01', '거래명세서와 품번/품명/수량이 일치할 것.', 'MAJOR', 'FULL' FROM dual UNION ALL
  SELECT 'THN-A50-TAPE', 2, 'THN-A50-P01', '접착력 저하·접착제 이동·권선 불량 없을 것.', 'MAJOR', 'AQL' FROM dual UNION ALL
  SELECT 'THN-A50-TAPE', 3, 'THN-A50-P02', '절단/표면 깨끗, 롤 감김 균일.', 'MINOR', 'AQL' FROM dual UNION ALL
  SELECT 'THN-A50-CTUBE', 1, 'THN-A50-G01', '거래명세서와 품번/품명/수량이 일치할 것.', 'MAJOR', 'FULL' FROM dual UNION ALL
  SELECT 'THN-A50-CTUBE', 2, 'THN-A50-U01', '기포·변색·흠 없이 균일, 수축 없을 것.', 'MAJOR', 'AQL' FROM dual UNION ALL
  SELECT 'THN-A50-COMMON', 1, 'THN-A50-G01', '거래명세서와 품번/품명/수량이 일치할 것.', 'MAJOR', 'FULL' FROM dual UNION ALL
  SELECT 'THN-A50-COMMON', 2, 'THN-A50-G02', '수입검사 확인 후 입고 확정, ERP 등록.', 'MAJOR', 'FULL' FROM dual UNION ALL
  SELECT 'THN-A50-COMMON', 3, 'THN-A50-V01', '유해물질 성적서 자재별 최소 연1회(1회/6개월).', 'CRITICAL', 'AQL' FROM dual UNION ALL
  SELECT 'THN-A50-COMMON', 4, 'THN-A50-V02', '내재/VOCs 체크리스트 최소 연1회(1회/12개월).', 'MAJOR', 'AQL' FROM dual
) s
ON (t.COMPANY = '40' AND t.PLANT_CD = '1000' AND t.TEMPLATE_ID = s.TID AND t.SEQ = s.SEQ)
WHEN MATCHED THEN UPDATE SET
  t.INSP_ITEM_CODE = s.C,
  t.JUDGE_CRITERIA = s.JC,
  t.DEFECT_GRADE = s.G,
  t.INSPECTION_TYPE = s.IT,
  t.SAMPLE_METHOD = CASE WHEN s.IT = 'FULL' THEN 'FIXED' ELSE 'AQL' END,
  t.USE_YN = 'Y',
  t.UPDATED_BY = 'thn-a50-seed',
  t.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT (
  COMPANY, PLANT_CD, TEMPLATE_ID, SEQ, INSP_ITEM_CODE, JUDGE_CRITERIA,
  DEFECT_GRADE, INSPECTION_TYPE, SAMPLE_METHOD, USE_YN,
  CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT
) VALUES (
  '40', '1000', s.TID, s.SEQ, s.C, s.JC, s.G, s.IT,
  CASE WHEN s.IT = 'FULL' THEN 'FIXED' ELSE 'AQL' END, 'Y',
  'thn-a50-seed', 'thn-a50-seed', SYSTIMESTAMP, SYSTIMESTAMP
)
/

COMMIT
/
