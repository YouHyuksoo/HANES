-- 2026-09-11 라벨 템플릿 barcode-main sourceField 복구 (요청사항 02: 입하 라벨 QR=SAMPLE)
-- 대상: COMPANY=40 / PLANT_CD=1000 기본 템플릿 5종. barcode-main 요소에 sourceField 키 자체가 없어
-- 렌더러가 빈 값을 "SAMPLE" 로 인코딩하던 것을 소스 테이블 식별자로 채운다.
-- 사전 확인(2026-09-11): 5건 모두 elements[0]=barcode-main 에 "sourceField" 없음.
-- 적용 완료(2026-09-11, oracle_connector --execute-file). 사후 확인: 5건 모두 "sourceField":"<식별자>" 삽입됨.
-- WHERE 가드: barcode-main 요소 안에 sourceField 가 없는 행만 갱신(재실행 안전).
UPDATE LABEL_TEMPLATES
   SET DESIGN_DATA = REGEXP_REPLACE(DESIGN_DATA, '("id":"barcode-main"[^}]*"sourceTable":"mat_lot")', '\1,"sourceField":"matUid"', 1, 1),
       UPDATED_AT = SYSTIMESTAMP, UPDATED_BY = 'claude-fix-02'
 WHERE COMPANY = '40' AND PLANT_CD = '1000' AND TEMPLATE_NAME = 'matlot_label'
   AND DBMS_LOB.INSTR(DESIGN_DATA, '"sourceField"', DBMS_LOB.INSTR(DESIGN_DATA, '"id":"barcode-main"')) > DBMS_LOB.INSTR(DESIGN_DATA, '"id":"text-code"')
/
UPDATE LABEL_TEMPLATES
   SET DESIGN_DATA = REGEXP_REPLACE(DESIGN_DATA, '("id":"barcode-main"[^}]*"sourceTable":"box")', '\1,"sourceField":"boxNo"', 1, 1),
       UPDATED_AT = SYSTIMESTAMP, UPDATED_BY = 'claude-fix-02'
 WHERE COMPANY = '40' AND PLANT_CD = '1000' AND TEMPLATE_NAME = 'box_label'
   AND DBMS_LOB.INSTR(DESIGN_DATA, '"sourceField"', DBMS_LOB.INSTR(DESIGN_DATA, '"id":"barcode-main"')) > DBMS_LOB.INSTR(DESIGN_DATA, '"id":"text-code"')
/
UPDATE LABEL_TEMPLATES
   SET DESIGN_DATA = REGEXP_REPLACE(DESIGN_DATA, '("id":"barcode-main"[^}]*"sourceTable":"pallet")', '\1,"sourceField":"palletNo"', 1, 1),
       UPDATED_AT = SYSTIMESTAMP, UPDATED_BY = 'claude-fix-02'
 WHERE COMPANY = '40' AND PLANT_CD = '1000' AND TEMPLATE_NAME = 'pallet_barcode'
   AND DBMS_LOB.INSTR(DESIGN_DATA, '"sourceField"', DBMS_LOB.INSTR(DESIGN_DATA, '"id":"barcode-main"')) > DBMS_LOB.INSTR(DESIGN_DATA, '"id":"text-code"')
/
UPDATE LABEL_TEMPLATES
   SET DESIGN_DATA = REGEXP_REPLACE(DESIGN_DATA, '("id":"barcode-main"[^}]*"sourceTable":"sg_label")', '\1,"sourceField":"sgBarcode"', 1, 1),
       UPDATED_AT = SYSTIMESTAMP, UPDATED_BY = 'claude-fix-02'
 WHERE COMPANY = '40' AND PLANT_CD = '1000' AND TEMPLATE_NAME = 'sfg_barcode'
   AND DBMS_LOB.INSTR(DESIGN_DATA, '"sourceField"', DBMS_LOB.INSTR(DESIGN_DATA, '"id":"barcode-main"')) > DBMS_LOB.INSTR(DESIGN_DATA, '"id":"text-code"')
/
UPDATE LABEL_TEMPLATES
   SET DESIGN_DATA = REGEXP_REPLACE(DESIGN_DATA, '("id":"barcode-main"[^}]*"sourceTable":"worker")', '\1,"sourceField":"workerCode"', 1, 1),
       UPDATED_AT = SYSTIMESTAMP, UPDATED_BY = 'claude-fix-02'
 WHERE COMPANY = '40' AND PLANT_CD = '1000' AND TEMPLATE_NAME = 'worker_label'
   AND DBMS_LOB.INSTR(DESIGN_DATA, '"sourceField"', DBMS_LOB.INSTR(DESIGN_DATA, '"id":"barcode-main"')) > DBMS_LOB.INSTR(DESIGN_DATA, '"id":"text-code"')
/
COMMIT
/
