-- HV 하네스 SPC 데이터 소스 전환 설정 시드 (SYS_CONFIGS, QUALITY 그룹)
-- 배경: /api/v1/quality/spc/hv/* 는 목업(MOCK) 소스와 실DB(SPC_CHARTS/SPC_DATA) 소스를 시스템 설정으로 명시 전환한다.
--       조용한 폴백 없이 어느 데이터를 보는지 설정값으로 드러내기 위한 키. 미설정이면 백엔드 기본 MOCK.
-- CONFIG_TYPE=SELECT, 허용값 MOCK|DB. 자연키 CONFIG_KEY MERGE(WHEN NOT MATCHED만) → 재실행 안전, 운영자가 바꾼 값은 덮지 않는다.
-- 사이트: JSHANES(40/1000).
MERGE INTO SYS_CONFIGS t
USING (
  SELECT 'SPC_HV_SOURCE' AS CONFIG_KEY, '40' AS COMPANY, '1000' AS PLANT_CD FROM DUAL
) s
ON (t.CONFIG_KEY = s.CONFIG_KEY)
WHEN NOT MATCHED THEN
  INSERT (CONFIG_KEY, CONFIG_GROUP, CONFIG_VALUE, CONFIG_TYPE, LABEL, DESCRIPTION, OPTIONS, SORT_ORDER, IS_ACTIVE, COMPANY, PLANT_CD, CREATED_AT, UPDATED_AT)
  VALUES (
    'SPC_HV_SOURCE', 'QUALITY', 'MOCK', 'SELECT', 'HV SPC 데이터 소스',
    '고전압 하네스 SPC 관리도 화면의 데이터 소스. MOCK=시드 고정 목업(데모), DB=SPC_CHARTS/SPC_DATA 실데이터. 미설정 시 MOCK.',
    '[{"value":"MOCK","label":"목업(데모)"},{"value":"DB","label":"실DB(SPC_CHARTS/SPC_DATA)"}]',
    40, 'Y', s.COMPANY, s.PLANT_CD, SYSTIMESTAMP, SYSTIMESTAMP
  );
/

COMMIT;
/
