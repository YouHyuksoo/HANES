-- 2026-06-23_plant_to_plant_cd.sql
-- 목적: tenant 컬럼명을 PLANT_CD로 통일.
--   마스터 PK가 (COMPANY, PLANT_CD, code) 복합키로 전환되면서, PLANT 컬럼명을 쓰던
--   품질/rework/audit/capa/spc/mold/training 계열 테이블 22개를 PLANT_CD로 RENAME 한다.
--   (RENAME COLUMN은 데이터/제약/인덱스/FK 참조를 보존한다.)
-- 적용: oracle_connector.py --execute-file 또는 SQL*Plus. 멱등(이미 PLANT_CD면 건너뜀).

BEGIN
  FOR r IN (
    SELECT column_value AS t FROM TABLE(sys.odcivarchar2list(
      'AUDIT_FINDINGS','AUDIT_PLANS','CALIBRATION_LOGS','CAPA_REQUESTS','CHANGE_ORDERS',
      'CONTROL_PLAN_ITEMS','CONTROL_PLANS','CUSTOMER_COMPLAINTS','DOCUMENT_MASTERS','FAI_REQUESTS',
      'GAUGE_MASTERS','MOLD_MASTERS','MOLD_USAGE_LOGS','PPAP_SUBMISSIONS','REWORK_INSPECTS',
      'REWORK_ORDERS','REWORK_PROCESSES','REWORK_RESULTS','SPC_CHARTS','SPC_DATA',
      'TRAINING_PLANS','TRAINING_RESULTS'))
  ) LOOP
    BEGIN
      EXECUTE IMMEDIATE 'ALTER TABLE '||r.t||' RENAME COLUMN PLANT TO PLANT_CD';
    EXCEPTION WHEN OTHERS THEN
      -- ORA-00957(중복) 또는 ORA-00904(PLANT 없음): 이미 적용됨 → 무시
      NULL;
    END;
  END LOOP;
END;
/
