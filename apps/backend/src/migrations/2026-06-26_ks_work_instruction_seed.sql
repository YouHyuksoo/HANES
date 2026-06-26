-- KS 라인 작업지도서 시드 (generate-ks-work-instruction-seed.mjs 생성)
-- 키오스크 작업지도서 누락 보정: KS_L1_ACOMP_N91H00-X9800 / KS_L2_SHLDCABLE 라우팅 전 공정

MERGE INTO WORK_INSTRUCTIONS wi
USING (SELECT 'KS_L1_ACOMP_N91H00-X9800' AS ITEM_CODE, 'KS_ASPRP' AS PROCESS_CODE, 'A' AS REVISION FROM DUAL) src
ON (wi.ITEM_CODE = src.ITEM_CODE AND wi.PROCESS_CODE = src.PROCESS_CODE AND wi.REVISION = src.REVISION)
WHEN MATCHED THEN UPDATE SET
  wi.TITLE = 'KS_L1_ACOMP_N91H00-X9800 조립자재준비 작업지도서',
  wi.CONTENT = '1. 작업지시와 품목 KS_L1_ACOMP_N91H00-X9800 을(를) 확인한다.
2. 조립자재준비(KS_ASPRP) 공정의 설비 상태와 투입 자재를 확인한다.
3. 작업표준에 따라 조립자재준비 을(를) 수행하고 규격·외관을 확인한다.
4. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.',
  wi.IMAGE_URL = '/uploads/work-instructions/wi-seed-ks_l1_acomp_n91h00_x9800-ks_asprp.svg',
  wi.USE_YN = 'Y',
  wi.UPDATED_BY = 'claude',
  wi.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT
  (ITEM_CODE, PROCESS_CODE, REVISION, TITLE, CONTENT, IMAGE_URL, USE_YN, COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT)
VALUES
  (src.ITEM_CODE, src.PROCESS_CODE, src.REVISION, 'KS_L1_ACOMP_N91H00-X9800 조립자재준비 작업지도서', '1. 작업지시와 품목 KS_L1_ACOMP_N91H00-X9800 을(를) 확인한다.
2. 조립자재준비(KS_ASPRP) 공정의 설비 상태와 투입 자재를 확인한다.
3. 작업표준에 따라 조립자재준비 을(를) 수행하고 규격·외관을 확인한다.
4. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.', '/uploads/work-instructions/wi-seed-ks_l1_acomp_n91h00_x9800-ks_asprp.svg', 'Y', '40', '1000', 'claude', SYSTIMESTAMP, SYSTIMESTAMP);
/

MERGE INTO WORK_INSTRUCTIONS wi
USING (SELECT 'KS_L1_ACOMP_N91H00-X9800' AS ITEM_CODE, 'KS_CONAS' AS PROCESS_CODE, 'A' AS REVISION FROM DUAL) src
ON (wi.ITEM_CODE = src.ITEM_CODE AND wi.PROCESS_CODE = src.PROCESS_CODE AND wi.REVISION = src.REVISION)
WHEN MATCHED THEN UPDATE SET
  wi.TITLE = 'KS_L1_ACOMP_N91H00-X9800 커넥터체결 작업지도서',
  wi.CONTENT = '1. 작업지시와 품목 KS_L1_ACOMP_N91H00-X9800 을(를) 확인한다.
2. 커넥터체결(KS_CONAS) 공정의 설비 상태와 투입 자재를 확인한다.
3. 작업표준에 따라 커넥터체결 을(를) 수행하고 규격·외관을 확인한다.
4. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.',
  wi.IMAGE_URL = '/uploads/work-instructions/wi-seed-ks_l1_acomp_n91h00_x9800-ks_conas.svg',
  wi.USE_YN = 'Y',
  wi.UPDATED_BY = 'claude',
  wi.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT
  (ITEM_CODE, PROCESS_CODE, REVISION, TITLE, CONTENT, IMAGE_URL, USE_YN, COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT)
VALUES
  (src.ITEM_CODE, src.PROCESS_CODE, src.REVISION, 'KS_L1_ACOMP_N91H00-X9800 커넥터체결 작업지도서', '1. 작업지시와 품목 KS_L1_ACOMP_N91H00-X9800 을(를) 확인한다.
2. 커넥터체결(KS_CONAS) 공정의 설비 상태와 투입 자재를 확인한다.
3. 작업표준에 따라 커넥터체결 을(를) 수행하고 규격·외관을 확인한다.
4. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.', '/uploads/work-instructions/wi-seed-ks_l1_acomp_n91h00_x9800-ks_conas.svg', 'Y', '40', '1000', 'claude', SYSTIMESTAMP, SYSTIMESTAMP);
/

MERGE INTO WORK_INSTRUCTIONS wi
USING (SELECT 'KS_L1_ACOMP_N91H00-X9800' AS ITEM_CODE, 'KS_EXTAS' AS PROCESS_CODE, 'A' AS REVISION FROM DUAL) src
ON (wi.ITEM_CODE = src.ITEM_CODE AND wi.PROCESS_CODE = src.PROCESS_CODE AND wi.REVISION = src.REVISION)
WHEN MATCHED THEN UPDATE SET
  wi.TITLE = 'KS_L1_ACOMP_N91H00-X9800 외장재조립 작업지도서',
  wi.CONTENT = '1. 작업지시와 품목 KS_L1_ACOMP_N91H00-X9800 을(를) 확인한다.
2. 외장재조립(KS_EXTAS) 공정의 설비 상태와 투입 자재를 확인한다.
3. 작업표준에 따라 외장재조립 을(를) 수행하고 규격·외관을 확인한다.
4. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.',
  wi.IMAGE_URL = '/uploads/work-instructions/wi-seed-ks_l1_acomp_n91h00_x9800-ks_extas.svg',
  wi.USE_YN = 'Y',
  wi.UPDATED_BY = 'claude',
  wi.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT
  (ITEM_CODE, PROCESS_CODE, REVISION, TITLE, CONTENT, IMAGE_URL, USE_YN, COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT)
VALUES
  (src.ITEM_CODE, src.PROCESS_CODE, src.REVISION, 'KS_L1_ACOMP_N91H00-X9800 외장재조립 작업지도서', '1. 작업지시와 품목 KS_L1_ACOMP_N91H00-X9800 을(를) 확인한다.
2. 외장재조립(KS_EXTAS) 공정의 설비 상태와 투입 자재를 확인한다.
3. 작업표준에 따라 외장재조립 을(를) 수행하고 규격·외관을 확인한다.
4. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.', '/uploads/work-instructions/wi-seed-ks_l1_acomp_n91h00_x9800-ks_extas.svg', 'Y', '40', '1000', 'claude', SYSTIMESTAMP, SYSTIMESTAMP);
/

MERGE INTO WORK_INSTRUCTIONS wi
USING (SELECT 'KS_L1_ACOMP_N91H00-X9800' AS ITEM_CODE, 'KS_CIRCK' AS PROCESS_CODE, 'A' AS REVISION FROM DUAL) src
ON (wi.ITEM_CODE = src.ITEM_CODE AND wi.PROCESS_CODE = src.PROCESS_CODE AND wi.REVISION = src.REVISION)
WHEN MATCHED THEN UPDATE SET
  wi.TITLE = 'KS_L1_ACOMP_N91H00-X9800 통합회로검사 작업지도서',
  wi.CONTENT = '1. 작업지시와 품목 KS_L1_ACOMP_N91H00-X9800 을(를) 확인한다.
2. 통합회로검사(KS_CIRCK) 공정의 설비 상태와 투입 자재를 확인한다.
3. 작업표준에 따라 통합회로검사 을(를) 수행하고 규격·외관을 확인한다.
4. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.',
  wi.IMAGE_URL = '/uploads/work-instructions/wi-seed-ks_l1_acomp_n91h00_x9800-ks_circk.svg',
  wi.USE_YN = 'Y',
  wi.UPDATED_BY = 'claude',
  wi.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT
  (ITEM_CODE, PROCESS_CODE, REVISION, TITLE, CONTENT, IMAGE_URL, USE_YN, COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT)
VALUES
  (src.ITEM_CODE, src.PROCESS_CODE, src.REVISION, 'KS_L1_ACOMP_N91H00-X9800 통합회로검사 작업지도서', '1. 작업지시와 품목 KS_L1_ACOMP_N91H00-X9800 을(를) 확인한다.
2. 통합회로검사(KS_CIRCK) 공정의 설비 상태와 투입 자재를 확인한다.
3. 작업표준에 따라 통합회로검사 을(를) 수행하고 규격·외관을 확인한다.
4. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.', '/uploads/work-instructions/wi-seed-ks_l1_acomp_n91h00_x9800-ks_circk.svg', 'Y', '40', '1000', 'claude', SYSTIMESTAMP, SYSTIMESTAMP);
/

MERGE INTO WORK_INSTRUCTIONS wi
USING (SELECT 'KS_L2_SHLDCABLE' AS ITEM_CODE, 'KS_CUTST' AS PROCESS_CODE, 'A' AS REVISION FROM DUAL) src
ON (wi.ITEM_CODE = src.ITEM_CODE AND wi.PROCESS_CODE = src.PROCESS_CODE AND wi.REVISION = src.REVISION)
WHEN MATCHED THEN UPDATE SET
  wi.TITLE = 'KS_L2_SHLDCABLE 전선절단탈피 작업지도서',
  wi.CONTENT = '1. 작업지시와 품목 KS_L2_SHLDCABLE 을(를) 확인한다.
2. 전선절단탈피(KS_CUTST) 공정의 설비 상태와 투입 자재를 확인한다.
3. 작업표준에 따라 전선절단탈피 을(를) 수행하고 규격·외관을 확인한다.
4. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.',
  wi.IMAGE_URL = '/uploads/work-instructions/wi-seed-ks_l2_shldcable-ks_cutst.svg',
  wi.USE_YN = 'Y',
  wi.UPDATED_BY = 'claude',
  wi.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT
  (ITEM_CODE, PROCESS_CODE, REVISION, TITLE, CONTENT, IMAGE_URL, USE_YN, COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT)
VALUES
  (src.ITEM_CODE, src.PROCESS_CODE, src.REVISION, 'KS_L2_SHLDCABLE 전선절단탈피 작업지도서', '1. 작업지시와 품목 KS_L2_SHLDCABLE 을(를) 확인한다.
2. 전선절단탈피(KS_CUTST) 공정의 설비 상태와 투입 자재를 확인한다.
3. 작업표준에 따라 전선절단탈피 을(를) 수행하고 규격·외관을 확인한다.
4. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.', '/uploads/work-instructions/wi-seed-ks_l2_shldcable-ks_cutst.svg', 'Y', '40', '1000', 'claude', SYSTIMESTAMP, SYSTIMESTAMP);
/

MERGE INTO WORK_INSTRUCTIONS wi
USING (SELECT 'KS_L2_SHLDCABLE' AS ITEM_CODE, 'KS_SHDCT' AS PROCESS_CODE, 'A' AS REVISION FROM DUAL) src
ON (wi.ITEM_CODE = src.ITEM_CODE AND wi.PROCESS_CODE = src.PROCESS_CODE AND wi.REVISION = src.REVISION)
WHEN MATCHED THEN UPDATE SET
  wi.TITLE = 'KS_L2_SHLDCABLE 차폐선절단 작업지도서',
  wi.CONTENT = '1. 작업지시와 품목 KS_L2_SHLDCABLE 을(를) 확인한다.
2. 차폐선절단(KS_SHDCT) 공정의 설비 상태와 투입 자재를 확인한다.
3. 작업표준에 따라 차폐선절단 을(를) 수행하고 규격·외관을 확인한다.
4. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.',
  wi.IMAGE_URL = '/uploads/work-instructions/wi-seed-ks_l2_shldcable-ks_shdct.svg',
  wi.USE_YN = 'Y',
  wi.UPDATED_BY = 'claude',
  wi.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT
  (ITEM_CODE, PROCESS_CODE, REVISION, TITLE, CONTENT, IMAGE_URL, USE_YN, COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT)
VALUES
  (src.ITEM_CODE, src.PROCESS_CODE, src.REVISION, 'KS_L2_SHLDCABLE 차폐선절단 작업지도서', '1. 작업지시와 품목 KS_L2_SHLDCABLE 을(를) 확인한다.
2. 차폐선절단(KS_SHDCT) 공정의 설비 상태와 투입 자재를 확인한다.
3. 작업표준에 따라 차폐선절단 을(를) 수행하고 규격·외관을 확인한다.
4. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.', '/uploads/work-instructions/wi-seed-ks_l2_shldcable-ks_shdct.svg', 'Y', '40', '1000', 'claude', SYSTIMESTAMP, SYSTIMESTAMP);
/

MERGE INTO WORK_INSTRUCTIONS wi
USING (SELECT 'KS_L2_SHLDCABLE' AS ITEM_CODE, 'KS_CRPRP' AS PROCESS_CODE, 'A' AS REVISION FROM DUAL) src
ON (wi.ITEM_CODE = src.ITEM_CODE AND wi.PROCESS_CODE = src.PROCESS_CODE AND wi.REVISION = src.REVISION)
WHEN MATCHED THEN UPDATE SET
  wi.TITLE = 'KS_L2_SHLDCABLE 압착준비 작업지도서',
  wi.CONTENT = '1. 작업지시와 품목 KS_L2_SHLDCABLE 을(를) 확인한다.
2. 압착준비(KS_CRPRP) 공정의 설비 상태와 투입 자재를 확인한다.
3. 작업표준에 따라 압착준비 을(를) 수행하고 규격·외관을 확인한다.
4. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.',
  wi.IMAGE_URL = '/uploads/work-instructions/wi-seed-ks_l2_shldcable-ks_crprp.svg',
  wi.USE_YN = 'Y',
  wi.UPDATED_BY = 'claude',
  wi.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT
  (ITEM_CODE, PROCESS_CODE, REVISION, TITLE, CONTENT, IMAGE_URL, USE_YN, COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT)
VALUES
  (src.ITEM_CODE, src.PROCESS_CODE, src.REVISION, 'KS_L2_SHLDCABLE 압착준비 작업지도서', '1. 작업지시와 품목 KS_L2_SHLDCABLE 을(를) 확인한다.
2. 압착준비(KS_CRPRP) 공정의 설비 상태와 투입 자재를 확인한다.
3. 작업표준에 따라 압착준비 을(를) 수행하고 규격·외관을 확인한다.
4. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.', '/uploads/work-instructions/wi-seed-ks_l2_shldcable-ks_crprp.svg', 'Y', '40', '1000', 'claude', SYSTIMESTAMP, SYSTIMESTAMP);
/

MERGE INTO WORK_INSTRUCTIONS wi
USING (SELECT 'KS_L2_SHLDCABLE' AS ITEM_CODE, 'KS_HEXCP' AS PROCESS_CODE, 'A' AS REVISION FROM DUAL) src
ON (wi.ITEM_CODE = src.ITEM_CODE AND wi.PROCESS_CODE = src.PROCESS_CODE AND wi.REVISION = src.REVISION)
WHEN MATCHED THEN UPDATE SET
  wi.TITLE = 'KS_L2_SHLDCABLE 육각압착 작업지도서',
  wi.CONTENT = '1. 작업지시와 품목 KS_L2_SHLDCABLE 을(를) 확인한다.
2. 육각압착(KS_HEXCP) 공정의 설비 상태와 투입 자재를 확인한다.
3. 작업표준에 따라 육각압착 을(를) 수행하고 규격·외관을 확인한다.
4. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.',
  wi.IMAGE_URL = '/uploads/work-instructions/wi-seed-ks_l2_shldcable-ks_hexcp.svg',
  wi.USE_YN = 'Y',
  wi.UPDATED_BY = 'claude',
  wi.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT
  (ITEM_CODE, PROCESS_CODE, REVISION, TITLE, CONTENT, IMAGE_URL, USE_YN, COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT)
VALUES
  (src.ITEM_CODE, src.PROCESS_CODE, src.REVISION, 'KS_L2_SHLDCABLE 육각압착 작업지도서', '1. 작업지시와 품목 KS_L2_SHLDCABLE 을(를) 확인한다.
2. 육각압착(KS_HEXCP) 공정의 설비 상태와 투입 자재를 확인한다.
3. 작업표준에 따라 육각압착 을(를) 수행하고 규격·외관을 확인한다.
4. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.', '/uploads/work-instructions/wi-seed-ks_l2_shldcable-ks_hexcp.svg', 'Y', '40', '1000', 'claude', SYSTIMESTAMP, SYSTIMESTAMP);
/

MERGE INTO WORK_INSTRUCTIONS wi
USING (SELECT 'KS_L2_SHLDCABLE' AS ITEM_CODE, 'KS_GCRMP' AS PROCESS_CODE, 'A' AS REVISION FROM DUAL) src
ON (wi.ITEM_CODE = src.ITEM_CODE AND wi.PROCESS_CODE = src.PROCESS_CODE AND wi.REVISION = src.REVISION)
WHEN MATCHED THEN UPDATE SET
  wi.TITLE = 'KS_L2_SHLDCABLE 일반압착 작업지도서',
  wi.CONTENT = '1. 작업지시와 품목 KS_L2_SHLDCABLE 을(를) 확인한다.
2. 일반압착(KS_GCRMP) 공정의 설비 상태와 투입 자재를 확인한다.
3. 작업표준에 따라 일반압착 을(를) 수행하고 규격·외관을 확인한다.
4. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.',
  wi.IMAGE_URL = '/uploads/work-instructions/wi-seed-ks_l2_shldcable-ks_gcrmp.svg',
  wi.USE_YN = 'Y',
  wi.UPDATED_BY = 'claude',
  wi.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT
  (ITEM_CODE, PROCESS_CODE, REVISION, TITLE, CONTENT, IMAGE_URL, USE_YN, COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT)
VALUES
  (src.ITEM_CODE, src.PROCESS_CODE, src.REVISION, 'KS_L2_SHLDCABLE 일반압착 작업지도서', '1. 작업지시와 품목 KS_L2_SHLDCABLE 을(를) 확인한다.
2. 일반압착(KS_GCRMP) 공정의 설비 상태와 투입 자재를 확인한다.
3. 작업표준에 따라 일반압착 을(를) 수행하고 규격·외관을 확인한다.
4. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.', '/uploads/work-instructions/wi-seed-ks_l2_shldcable-ks_gcrmp.svg', 'Y', '40', '1000', 'claude', SYSTIMESTAMP, SYSTIMESTAMP);
/

MERGE INTO WORK_INSTRUCTIONS wi
USING (SELECT 'KS_L2_SHLDCABLE' AS ITEM_CODE, 'KS_TUBIN' AS PROCESS_CODE, 'A' AS REVISION FROM DUAL) src
ON (wi.ITEM_CODE = src.ITEM_CODE AND wi.PROCESS_CODE = src.PROCESS_CODE AND wi.REVISION = src.REVISION)
WHEN MATCHED THEN UPDATE SET
  wi.TITLE = 'KS_L2_SHLDCABLE 열수축튜브삽입 작업지도서',
  wi.CONTENT = '1. 작업지시와 품목 KS_L2_SHLDCABLE 을(를) 확인한다.
2. 열수축튜브삽입(KS_TUBIN) 공정의 설비 상태와 투입 자재를 확인한다.
3. 작업표준에 따라 열수축튜브삽입 을(를) 수행하고 규격·외관을 확인한다.
4. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.',
  wi.IMAGE_URL = '/uploads/work-instructions/wi-seed-ks_l2_shldcable-ks_tubin.svg',
  wi.USE_YN = 'Y',
  wi.UPDATED_BY = 'claude',
  wi.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT
  (ITEM_CODE, PROCESS_CODE, REVISION, TITLE, CONTENT, IMAGE_URL, USE_YN, COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT)
VALUES
  (src.ITEM_CODE, src.PROCESS_CODE, src.REVISION, 'KS_L2_SHLDCABLE 열수축튜브삽입 작업지도서', '1. 작업지시와 품목 KS_L2_SHLDCABLE 을(를) 확인한다.
2. 열수축튜브삽입(KS_TUBIN) 공정의 설비 상태와 투입 자재를 확인한다.
3. 작업표준에 따라 열수축튜브삽입 을(를) 수행하고 규격·외관을 확인한다.
4. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.', '/uploads/work-instructions/wi-seed-ks_l2_shldcable-ks_tubin.svg', 'Y', '40', '1000', 'claude', SYSTIMESTAMP, SYSTIMESTAMP);
/

MERGE INTO WORK_INSTRUCTIONS wi
USING (SELECT 'KS_L2_SHLDCABLE' AS ITEM_CODE, 'KS_TUBHT' AS PROCESS_CODE, 'A' AS REVISION FROM DUAL) src
ON (wi.ITEM_CODE = src.ITEM_CODE AND wi.PROCESS_CODE = src.PROCESS_CODE AND wi.REVISION = src.REVISION)
WHEN MATCHED THEN UPDATE SET
  wi.TITLE = 'KS_L2_SHLDCABLE 열수축접착 작업지도서',
  wi.CONTENT = '1. 작업지시와 품목 KS_L2_SHLDCABLE 을(를) 확인한다.
2. 열수축접착(KS_TUBHT) 공정의 설비 상태와 투입 자재를 확인한다.
3. 작업표준에 따라 열수축접착 을(를) 수행하고 규격·외관을 확인한다.
4. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.',
  wi.IMAGE_URL = '/uploads/work-instructions/wi-seed-ks_l2_shldcable-ks_tubht.svg',
  wi.USE_YN = 'Y',
  wi.UPDATED_BY = 'claude',
  wi.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT
  (ITEM_CODE, PROCESS_CODE, REVISION, TITLE, CONTENT, IMAGE_URL, USE_YN, COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT)
VALUES
  (src.ITEM_CODE, src.PROCESS_CODE, src.REVISION, 'KS_L2_SHLDCABLE 열수축접착 작업지도서', '1. 작업지시와 품목 KS_L2_SHLDCABLE 을(를) 확인한다.
2. 열수축접착(KS_TUBHT) 공정의 설비 상태와 투입 자재를 확인한다.
3. 작업표준에 따라 열수축접착 을(를) 수행하고 규격·외관을 확인한다.
4. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.', '/uploads/work-instructions/wi-seed-ks_l2_shldcable-ks_tubht.svg', 'Y', '40', '1000', 'claude', SYSTIMESTAMP, SYSTIMESTAMP);
/

MERGE INTO WORK_INSTRUCTIONS wi
USING (SELECT 'KS_L2_SHLDCABLE' AS ITEM_CODE, 'KS_SEMIN' AS PROCESS_CODE, 'A' AS REVISION FROM DUAL) src
ON (wi.ITEM_CODE = src.ITEM_CODE AND wi.PROCESS_CODE = src.PROCESS_CODE AND wi.REVISION = src.REVISION)
WHEN MATCHED THEN UPDATE SET
  wi.TITLE = 'KS_L2_SHLDCABLE 반제품검사 작업지도서',
  wi.CONTENT = '1. 작업지시와 품목 KS_L2_SHLDCABLE 을(를) 확인한다.
2. 반제품검사(KS_SEMIN) 공정의 설비 상태와 투입 자재를 확인한다.
3. 작업표준에 따라 반제품검사 을(를) 수행하고 규격·외관을 확인한다.
4. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.',
  wi.IMAGE_URL = '/uploads/work-instructions/wi-seed-ks_l2_shldcable-ks_semin.svg',
  wi.USE_YN = 'Y',
  wi.UPDATED_BY = 'claude',
  wi.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT
  (ITEM_CODE, PROCESS_CODE, REVISION, TITLE, CONTENT, IMAGE_URL, USE_YN, COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT)
VALUES
  (src.ITEM_CODE, src.PROCESS_CODE, src.REVISION, 'KS_L2_SHLDCABLE 반제품검사 작업지도서', '1. 작업지시와 품목 KS_L2_SHLDCABLE 을(를) 확인한다.
2. 반제품검사(KS_SEMIN) 공정의 설비 상태와 투입 자재를 확인한다.
3. 작업표준에 따라 반제품검사 을(를) 수행하고 규격·외관을 확인한다.
4. 이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.', '/uploads/work-instructions/wi-seed-ks_l2_shldcable-ks_semin.svg', 'Y', '40', '1000', 'claude', SYSTIMESTAMP, SYSTIMESTAMP);
/

COMMIT;
/
