-- 하네스 공정 작업지도서 시드 (2026-09-04)
-- JSHANES JOB_ORDERS 실사용 품목/공정 조합 기준. 키오스크(input-kiosk) 작업지도서 뷰어 표시용.
-- 이미지: apps/backend/uploads/work-instructions/wi-seed-*.svg

MERGE INTO WORK_INSTRUCTIONS wi
USING (SELECT 'N91H00-X9800-C1-A' AS ITEM_CODE, 'ATCNS' AS PROCESS_CODE, 'A' AS REVISION FROM DUAL) src
ON (wi.ITEM_CODE = src.ITEM_CODE AND wi.PROCESS_CODE = src.PROCESS_CODE AND wi.REVISION = src.REVISION)
WHEN MATCHED THEN UPDATE SET
  wi.TITLE = 'N91H00-X9800-C1-A 자동절단탈피 작업지도서',
  wi.CONTENT = '1. 작업지시와 품목 N91H00-X9800-C1-A 을(를) 확인한다.
2. 자동절단탈피(ATCNS) 공정의 설비 상태와 투입 자재를 확인한다.
3. 전선 규격·색상을 확인하고 절단길이와 탈피길이를 작업표준과 대조한다. 코아 손상, 탈피 불량, 절단면 상태를 육안으로 확인한다.
4. 작업 완료 후 실적을 등록하고 다음 공정으로 자재를 인계한다.
5. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.',
  wi.IMAGE_URL = '/uploads/work-instructions/wi-seed-n91h00-x9800-c1-a-atcns.svg',
  wi.USE_YN = 'Y',
  wi.UPDATED_BY = 'opencode',
  wi.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT
  (ITEM_CODE, PROCESS_CODE, REVISION, TITLE, CONTENT, IMAGE_URL, USE_YN, COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT)
VALUES
  (src.ITEM_CODE, src.PROCESS_CODE, src.REVISION, 'N91H00-X9800-C1-A 자동절단탈피 작업지도서', '1. 작업지시와 품목 N91H00-X9800-C1-A 을(를) 확인한다.
2. 자동절단탈피(ATCNS) 공정의 설비 상태와 투입 자재를 확인한다.
3. 전선 규격·색상을 확인하고 절단길이와 탈피길이를 작업표준과 대조한다. 코아 손상, 탈피 불량, 절단면 상태를 육안으로 확인한다.
4. 작업 완료 후 실적을 등록하고 다음 공정으로 자재를 인계한다.
5. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.', '/uploads/work-instructions/wi-seed-n91h00-x9800-c1-a-atcns.svg', 'Y', '40', '1000', 'opencode', SYSTIMESTAMP, SYSTIMESTAMP);
/

MERGE INTO WORK_INSTRUCTIONS wi
USING (SELECT 'N91H00-X9800-S-A' AS ITEM_CODE, 'CRMPB' AS PROCESS_CODE, 'A' AS REVISION FROM DUAL) src
ON (wi.ITEM_CODE = src.ITEM_CODE AND wi.PROCESS_CODE = src.PROCESS_CODE AND wi.REVISION = src.REVISION)
WHEN MATCHED THEN UPDATE SET
  wi.TITLE = 'N91H00-X9800-S-A 양단압착 작업지도서',
  wi.CONTENT = '1. 작업지시와 품목 N91H00-X9800-S-A 을(를) 확인한다.
2. 양단압착(CRMPB) 공정의 설비 상태와 투입 자재를 확인한다.
3. 단자 품번과 전선 규격을 확인하고 압착높이(CH/ICH)를 측정한다. 벨라인 위치, 코아 돌출, 압착 외관을 확인한다.
4. 작업 완료 후 실적을 등록하고 다음 공정으로 자재를 인계한다.
5. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.',
  wi.IMAGE_URL = '/uploads/work-instructions/wi-seed-n91h00-x9800-s-a-crmpb.svg',
  wi.USE_YN = 'Y',
  wi.UPDATED_BY = 'opencode',
  wi.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT
  (ITEM_CODE, PROCESS_CODE, REVISION, TITLE, CONTENT, IMAGE_URL, USE_YN, COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT)
VALUES
  (src.ITEM_CODE, src.PROCESS_CODE, src.REVISION, 'N91H00-X9800-S-A 양단압착 작업지도서', '1. 작업지시와 품목 N91H00-X9800-S-A 을(를) 확인한다.
2. 양단압착(CRMPB) 공정의 설비 상태와 투입 자재를 확인한다.
3. 단자 품번과 전선 규격을 확인하고 압착높이(CH/ICH)를 측정한다. 벨라인 위치, 코아 돌출, 압착 외관을 확인한다.
4. 작업 완료 후 실적을 등록하고 다음 공정으로 자재를 인계한다.
5. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.', '/uploads/work-instructions/wi-seed-n91h00-x9800-s-a-crmpb.svg', 'Y', '40', '1000', 'opencode', SYSTIMESTAMP, SYSTIMESTAMP);
/

MERGE INTO WORK_INSTRUCTIONS wi
USING (SELECT 'MAG_EAD65942601-AGN001' AS ITEM_CODE, 'GCRMP' AS PROCESS_CODE, 'A' AS REVISION FROM DUAL) src
ON (wi.ITEM_CODE = src.ITEM_CODE AND wi.PROCESS_CODE = src.PROCESS_CODE AND wi.REVISION = src.REVISION)
WHEN MATCHED THEN UPDATE SET
  wi.TITLE = 'MAG_EAD65942601-AGN001 일반압착 작업지도서',
  wi.CONTENT = '1. 작업지시와 품목 MAG_EAD65942601-AGN001 을(를) 확인한다.
2. 일반압착(GCRMP) 공정의 설비 상태와 투입 자재를 확인한다.
3. 단자와 전선의 규격 조합을 확인하고 압착기 금형을 점검한다. 압착 후 인장강도 시편과 외관(돌출·버·손상)을 확인한다.
4. 작업 완료 후 실적을 등록하고 다음 공정으로 자재를 인계한다.
5. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.',
  wi.IMAGE_URL = '/uploads/work-instructions/wi-seed-mag_ead65942601-agn001-gcrmp.svg',
  wi.USE_YN = 'Y',
  wi.UPDATED_BY = 'opencode',
  wi.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT
  (ITEM_CODE, PROCESS_CODE, REVISION, TITLE, CONTENT, IMAGE_URL, USE_YN, COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT)
VALUES
  (src.ITEM_CODE, src.PROCESS_CODE, src.REVISION, 'MAG_EAD65942601-AGN001 일반압착 작업지도서', '1. 작업지시와 품목 MAG_EAD65942601-AGN001 을(를) 확인한다.
2. 일반압착(GCRMP) 공정의 설비 상태와 투입 자재를 확인한다.
3. 단자와 전선의 규격 조합을 확인하고 압착기 금형을 점검한다. 압착 후 인장강도 시편과 외관(돌출·버·손상)을 확인한다.
4. 작업 완료 후 실적을 등록하고 다음 공정으로 자재를 인계한다.
5. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.', '/uploads/work-instructions/wi-seed-mag_ead65942601-agn001-gcrmp.svg', 'Y', '40', '1000', 'opencode', SYSTIMESTAMP, SYSTIMESTAMP);
/

MERGE INTO WORK_INSTRUCTIONS wi
USING (SELECT 'N91H00-X9800-S' AS ITEM_CODE, 'TUBHT' AS PROCESS_CODE, 'A' AS REVISION FROM DUAL) src
ON (wi.ITEM_CODE = src.ITEM_CODE AND wi.PROCESS_CODE = src.PROCESS_CODE AND wi.REVISION = src.REVISION)
WHEN MATCHED THEN UPDATE SET
  wi.TITLE = 'N91H00-X9800-S 열수축 작업지도서',
  wi.CONTENT = '1. 작업지시와 품목 N91H00-X9800-S 을(를) 확인한다.
2. 열수축(TUBHT) 공정의 설비 상태와 투입 자재를 확인한다.
3. 열수축튜브 규격과 삽입 위치를 확인한다. 열풍기 온도를 설정하고 튜브가 균일하게 수축됐는지, 눌림·변색·공극이 없는지 확인한다.
4. 작업 완료 후 실적을 등록하고 다음 공정으로 자재를 인계한다.
5. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.',
  wi.IMAGE_URL = '/uploads/work-instructions/wi-seed-n91h00-x9800-s-tubht.svg',
  wi.USE_YN = 'Y',
  wi.UPDATED_BY = 'opencode',
  wi.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT
  (ITEM_CODE, PROCESS_CODE, REVISION, TITLE, CONTENT, IMAGE_URL, USE_YN, COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT)
VALUES
  (src.ITEM_CODE, src.PROCESS_CODE, src.REVISION, 'N91H00-X9800-S 열수축 작업지도서', '1. 작업지시와 품목 N91H00-X9800-S 을(를) 확인한다.
2. 열수축(TUBHT) 공정의 설비 상태와 투입 자재를 확인한다.
3. 열수축튜브 규격과 삽입 위치를 확인한다. 열풍기 온도를 설정하고 튜브가 균일하게 수축됐는지, 눌림·변색·공극이 없는지 확인한다.
4. 작업 완료 후 실적을 등록하고 다음 공정으로 자재를 인계한다.
5. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.', '/uploads/work-instructions/wi-seed-n91h00-x9800-s-tubht.svg', 'Y', '40', '1000', 'opencode', SYSTIMESTAMP, SYSTIMESTAMP);
/

MERGE INTO WORK_INSTRUCTIONS wi
USING (SELECT 'N91H00-X9800-C1' AS ITEM_CODE, 'SHDCT' AS PROCESS_CODE, 'A' AS REVISION FROM DUAL) src
ON (wi.ITEM_CODE = src.ITEM_CODE AND wi.PROCESS_CODE = src.PROCESS_CODE AND wi.REVISION = src.REVISION)
WHEN MATCHED THEN UPDATE SET
  wi.TITLE = 'N91H00-X9800-C1 실드절단 작업지도서',
  wi.CONTENT = '1. 작업지시와 품목 N91H00-X9800-C1 을(를) 확인한다.
2. 실드절단(SHDCT) 공정의 설비 상태와 투입 자재를 확인한다.
3. 실드 케이블 절단 길이를 확인하고 편조 실드를 균일하게 절단한다. 내부 절연피복 손상 여부와 실드 돌출 길이를 확인한다.
4. 작업 완료 후 실적을 등록하고 다음 공정으로 자재를 인계한다.
5. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.',
  wi.IMAGE_URL = '/uploads/work-instructions/wi-seed-n91h00-x9800-c1-shdct.svg',
  wi.USE_YN = 'Y',
  wi.UPDATED_BY = 'opencode',
  wi.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT
  (ITEM_CODE, PROCESS_CODE, REVISION, TITLE, CONTENT, IMAGE_URL, USE_YN, COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT)
VALUES
  (src.ITEM_CODE, src.PROCESS_CODE, src.REVISION, 'N91H00-X9800-C1 실드절단 작업지도서', '1. 작업지시와 품목 N91H00-X9800-C1 을(를) 확인한다.
2. 실드절단(SHDCT) 공정의 설비 상태와 투입 자재를 확인한다.
3. 실드 케이블 절단 길이를 확인하고 편조 실드를 균일하게 절단한다. 내부 절연피복 손상 여부와 실드 돌출 길이를 확인한다.
4. 작업 완료 후 실적을 등록하고 다음 공정으로 자재를 인계한다.
5. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.', '/uploads/work-instructions/wi-seed-n91h00-x9800-c1-shdct.svg', 'Y', '40', '1000', 'opencode', SYSTIMESTAMP, SYSTIMESTAMP);
/

MERGE INTO WORK_INSTRUCTIONS wi
USING (SELECT 'N91H00-X9800-S-AB' AS ITEM_CODE, 'HEXCP' AS PROCESS_CODE, 'A' AS REVISION FROM DUAL) src
ON (wi.ITEM_CODE = src.ITEM_CODE AND wi.PROCESS_CODE = src.PROCESS_CODE AND wi.REVISION = src.REVISION)
WHEN MATCHED THEN UPDATE SET
  wi.TITLE = 'N91H00-X9800-S-AB 육각압착 작업지도서',
  wi.CONTENT = '1. 작업지시와 품목 N91H00-X9800-S-AB 을(를) 확인한다.
2. 육각압착(HEXCP) 공정의 설비 상태와 투입 자재를 확인한다.
3. 육각 금형 규격과 단자 방향을 확인한다. 압착 후 육각 단면 형상, 균열·버 여부와 압착 높이를 확인한다.
4. 작업 완료 후 실적을 등록하고 다음 공정으로 자재를 인계한다.
5. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.',
  wi.IMAGE_URL = '/uploads/work-instructions/wi-seed-n91h00-x9800-s-ab-hexcp.svg',
  wi.USE_YN = 'Y',
  wi.UPDATED_BY = 'opencode',
  wi.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT
  (ITEM_CODE, PROCESS_CODE, REVISION, TITLE, CONTENT, IMAGE_URL, USE_YN, COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT)
VALUES
  (src.ITEM_CODE, src.PROCESS_CODE, src.REVISION, 'N91H00-X9800-S-AB 육각압착 작업지도서', '1. 작업지시와 품목 N91H00-X9800-S-AB 을(를) 확인한다.
2. 육각압착(HEXCP) 공정의 설비 상태와 투입 자재를 확인한다.
3. 육각 금형 규격과 단자 방향을 확인한다. 압착 후 육각 단면 형상, 균열·버 여부와 압착 높이를 확인한다.
4. 작업 완료 후 실적을 등록하고 다음 공정으로 자재를 인계한다.
5. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.', '/uploads/work-instructions/wi-seed-n91h00-x9800-s-ab-hexcp.svg', 'Y', '40', '1000', 'opencode', SYSTIMESTAMP, SYSTIMESTAMP);
/

MERGE INTO WORK_INSTRUCTIONS wi
USING (SELECT 'N91H00-X9800-S-ABC' AS ITEM_CODE, 'HEXPR' AS PROCESS_CODE, 'A' AS REVISION FROM DUAL) src
ON (wi.ITEM_CODE = src.ITEM_CODE AND wi.PROCESS_CODE = src.PROCESS_CODE AND wi.REVISION = src.REVISION)
WHEN MATCHED THEN UPDATE SET
  wi.TITLE = 'N91H00-X9800-S-ABC 압착준비(육각) 작업지도서',
  wi.CONTENT = '1. 작업지시와 품목 N91H00-X9800-S-ABC 을(를) 확인한다.
2. 압착준비(육각)(HEXPR) 공정의 설비 상태와 투입 자재를 확인한다.
3. 단자·전선·실드 부속을 작업지시 수량만큼 준비한다. 전선 탈피 상태와 단자 품번을 확인하고 지그에 정확히 세팅한다.
4. 작업 완료 후 실적을 등록하고 다음 공정으로 자재를 인계한다.
5. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.',
  wi.IMAGE_URL = '/uploads/work-instructions/wi-seed-n91h00-x9800-s-abc-hexpr.svg',
  wi.USE_YN = 'Y',
  wi.UPDATED_BY = 'opencode',
  wi.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT
  (ITEM_CODE, PROCESS_CODE, REVISION, TITLE, CONTENT, IMAGE_URL, USE_YN, COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT)
VALUES
  (src.ITEM_CODE, src.PROCESS_CODE, src.REVISION, 'N91H00-X9800-S-ABC 압착준비(육각) 작업지도서', '1. 작업지시와 품목 N91H00-X9800-S-ABC 을(를) 확인한다.
2. 압착준비(육각)(HEXPR) 공정의 설비 상태와 투입 자재를 확인한다.
3. 단자·전선·실드 부속을 작업지시 수량만큼 준비한다. 전선 탈피 상태와 단자 품번을 확인하고 지그에 정확히 세팅한다.
4. 작업 완료 후 실적을 등록하고 다음 공정으로 자재를 인계한다.
5. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.', '/uploads/work-instructions/wi-seed-n91h00-x9800-s-abc-hexpr.svg', 'Y', '40', '1000', 'opencode', SYSTIMESTAMP, SYSTIMESTAMP);
/

MERGE INTO WORK_INSTRUCTIONS wi
USING (SELECT 'N91H00-X9800' AS ITEM_CODE, 'MASSY' AS PROCESS_CODE, 'A' AS REVISION FROM DUAL) src
ON (wi.ITEM_CODE = src.ITEM_CODE AND wi.PROCESS_CODE = src.PROCESS_CODE AND wi.REVISION = src.REVISION)
WHEN MATCHED THEN UPDATE SET
  wi.TITLE = 'N91H00-X9800 조립 작업지도서',
  wi.CONTENT = '1. 작업지시와 품목 N91H00-X9800 을(를) 확인한다.
2. 조립(MASSY) 공정의 설비 상태와 투입 자재를 확인한다.
3. 하우징에 단자를 지정 회로 위치로 삽입하고 록 체결음을 확인한다. TPA/CPA 체결, 단자 이탈, 오삽 여부를 확인한다.
4. 작업 완료 후 실적을 등록하고 다음 공정으로 자재를 인계한다.
5. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.',
  wi.IMAGE_URL = '/uploads/work-instructions/wi-seed-n91h00-x9800-massy.svg',
  wi.USE_YN = 'Y',
  wi.UPDATED_BY = 'opencode',
  wi.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT
  (ITEM_CODE, PROCESS_CODE, REVISION, TITLE, CONTENT, IMAGE_URL, USE_YN, COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT)
VALUES
  (src.ITEM_CODE, src.PROCESS_CODE, src.REVISION, 'N91H00-X9800 조립 작업지도서', '1. 작업지시와 품목 N91H00-X9800 을(를) 확인한다.
2. 조립(MASSY) 공정의 설비 상태와 투입 자재를 확인한다.
3. 하우징에 단자를 지정 회로 위치로 삽입하고 록 체결음을 확인한다. TPA/CPA 체결, 단자 이탈, 오삽 여부를 확인한다.
4. 작업 완료 후 실적을 등록하고 다음 공정으로 자재를 인계한다.
5. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.', '/uploads/work-instructions/wi-seed-n91h00-x9800-massy.svg', 'Y', '40', '1000', 'opencode', SYSTIMESTAMP, SYSTIMESTAMP);
/

MERGE INTO WORK_INSTRUCTIONS wi
USING (SELECT 'MAG_EAD65942601' AS ITEM_CODE, 'MASSY' AS PROCESS_CODE, 'A' AS REVISION FROM DUAL) src
ON (wi.ITEM_CODE = src.ITEM_CODE AND wi.PROCESS_CODE = src.PROCESS_CODE AND wi.REVISION = src.REVISION)
WHEN MATCHED THEN UPDATE SET
  wi.TITLE = 'MAG_EAD65942601 조립 작업지도서',
  wi.CONTENT = '1. 작업지시와 품목 MAG_EAD65942601 을(를) 확인한다.
2. 조립(MASSY) 공정의 설비 상태와 투입 자재를 확인한다.
3. 하우징에 단자를 지정 회로 위치로 삽입하고 록 체결음을 확인한다. TPA/CPA 체결, 단자 이탈, 오삽 여부를 확인한다.
4. 작업 완료 후 실적을 등록하고 다음 공정으로 자재를 인계한다.
5. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.',
  wi.IMAGE_URL = '/uploads/work-instructions/wi-seed-mag_ead65942601-massy.svg',
  wi.USE_YN = 'Y',
  wi.UPDATED_BY = 'opencode',
  wi.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT
  (ITEM_CODE, PROCESS_CODE, REVISION, TITLE, CONTENT, IMAGE_URL, USE_YN, COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT)
VALUES
  (src.ITEM_CODE, src.PROCESS_CODE, src.REVISION, 'MAG_EAD65942601 조립 작업지도서', '1. 작업지시와 품목 MAG_EAD65942601 을(를) 확인한다.
2. 조립(MASSY) 공정의 설비 상태와 투입 자재를 확인한다.
3. 하우징에 단자를 지정 회로 위치로 삽입하고 록 체결음을 확인한다. TPA/CPA 체결, 단자 이탈, 오삽 여부를 확인한다.
4. 작업 완료 후 실적을 등록하고 다음 공정으로 자재를 인계한다.
5. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.', '/uploads/work-instructions/wi-seed-mag_ead65942601-massy.svg', 'Y', '40', '1000', 'opencode', SYSTIMESTAMP, SYSTIMESTAMP);
/

MERGE INTO WORK_INSTRUCTIONS wi
USING (SELECT 'N91H00-X9800-C2' AS ITEM_CODE, 'SHDCT' AS PROCESS_CODE, 'A' AS REVISION FROM DUAL) src
ON (wi.ITEM_CODE = src.ITEM_CODE AND wi.PROCESS_CODE = src.PROCESS_CODE AND wi.REVISION = src.REVISION)
WHEN MATCHED THEN UPDATE SET
  wi.TITLE = 'N91H00-X9800-C2 실드절단 작업지도서',
  wi.CONTENT = '1. 작업지시와 품목 N91H00-X9800-C2 을(를) 확인한다.
2. 실드절단(SHDCT) 공정의 설비 상태와 투입 자재를 확인한다.
3. 실드 케이블 절단 길이를 확인하고 편조 실드를 균일하게 절단한다. 내부 절연피복 손상 여부와 실드 돌출 길이를 확인한다.
4. 작업 완료 후 실적을 등록하고 다음 공정으로 자재를 인계한다.
5. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.',
  wi.IMAGE_URL = '/uploads/work-instructions/wi-seed-n91h00-x9800-c2-shdct.svg',
  wi.USE_YN = 'Y',
  wi.UPDATED_BY = 'opencode',
  wi.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT
  (ITEM_CODE, PROCESS_CODE, REVISION, TITLE, CONTENT, IMAGE_URL, USE_YN, COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT)
VALUES
  (src.ITEM_CODE, src.PROCESS_CODE, src.REVISION, 'N91H00-X9800-C2 실드절단 작업지도서', '1. 작업지시와 품목 N91H00-X9800-C2 을(를) 확인한다.
2. 실드절단(SHDCT) 공정의 설비 상태와 투입 자재를 확인한다.
3. 실드 케이블 절단 길이를 확인하고 편조 실드를 균일하게 절단한다. 내부 절연피복 손상 여부와 실드 돌출 길이를 확인한다.
4. 작업 완료 후 실적을 등록하고 다음 공정으로 자재를 인계한다.
5. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.', '/uploads/work-instructions/wi-seed-n91h00-x9800-c2-shdct.svg', 'Y', '40', '1000', 'opencode', SYSTIMESTAMP, SYSTIMESTAMP);
/

MERGE INTO WORK_INSTRUCTIONS wi
USING (SELECT 'N91H00-X9800-R' AS ITEM_CODE, 'CONAS' AS PROCESS_CODE, 'A' AS REVISION FROM DUAL) src
ON (wi.ITEM_CODE = src.ITEM_CODE AND wi.PROCESS_CODE = src.PROCESS_CODE AND wi.REVISION = src.REVISION)
WHEN MATCHED THEN UPDATE SET
  wi.TITLE = 'N91H00-X9800-R 커넥터체결 작업지도서',
  wi.CONTENT = '1. 작업지시와 품목 N91H00-X9800-R 을(를) 확인한다.
2. 커넥터체결(CONAS) 공정의 설비 상태와 투입 자재를 확인한다.
3. 커넥터 품번과 체결 방향을 확인하고 규정 토크로 체결한다. 체결 후 유격, 오조립, 하우징 파손 여부를 확인한다.
4. 작업 완료 후 실적을 등록하고 다음 공정으로 자재를 인계한다.
5. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.',
  wi.IMAGE_URL = '/uploads/work-instructions/wi-seed-n91h00-x9800-r-conas.svg',
  wi.USE_YN = 'Y',
  wi.UPDATED_BY = 'opencode',
  wi.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT
  (ITEM_CODE, PROCESS_CODE, REVISION, TITLE, CONTENT, IMAGE_URL, USE_YN, COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT)
VALUES
  (src.ITEM_CODE, src.PROCESS_CODE, src.REVISION, 'N91H00-X9800-R 커넥터체결 작업지도서', '1. 작업지시와 품목 N91H00-X9800-R 을(를) 확인한다.
2. 커넥터체결(CONAS) 공정의 설비 상태와 투입 자재를 확인한다.
3. 커넥터 품번과 체결 방향을 확인하고 규정 토크로 체결한다. 체결 후 유격, 오조립, 하우징 파손 여부를 확인한다.
4. 작업 완료 후 실적을 등록하고 다음 공정으로 자재를 인계한다.
5. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.', '/uploads/work-instructions/wi-seed-n91h00-x9800-r-conas.svg', 'Y', '40', '1000', 'opencode', SYSTIMESTAMP, SYSTIMESTAMP);
/

COMMIT;
/
