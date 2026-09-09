-- 고객 감사지적 갭 보완 sys-config 4키 (T-CUSTOMER-AUDIT-GAPS, 설계 docs/specs/2026-09-09-customer-audit-gap-closure-design.md)
-- 멱등 MERGE. 멀티테넌시 정본 COMPANY='40', PLANT_CD='1000'.
-- SORT_ORDER는 2026-09-09 실측 그룹 최대값 다음: PRODUCTION 5→6, MATERIAL 13→14/15, QUALITY 40→41.

MERGE INTO SYS_CONFIGS t
USING (
  SELECT 'PRODUCTION' AS CONFIG_GROUP, 'EQUIP_INSPECT_INTERLOCK' AS CONFIG_KEY, 'Y' AS CONFIG_VALUE, 'BOOLEAN' AS CONFIG_TYPE,
         '설비점검 미완료 실적 차단' AS LABEL,
         '설비 일상점검(DAILY)/작업자점검(WORKER) 항목이 배정된 설비는 해당 점검을 완료해야 생산실적을 등록할 수 있습니다 (Y=차단, N=허용). 서버 게이트이며 키오스크 외 모든 실적 API에 적용됩니다.' AS DESCRIPTION,
         NULL AS OPTIONS, 6 AS SORT_ORDER, '40' AS COMPANY, '1000' AS PLANT_CD
  FROM dual
  UNION ALL
  SELECT 'MATERIAL', 'FIFO_ACTION', 'BLOCK', 'SELECT',
         '선입선출 위반 시 처리',
         '같은 품목·창고에 더 오래된 출고가능 LOT가 있는데 다른 LOT를 출고할 때의 처리 (BLOCK=출고 거부, WARN=경고 후 진행). FIFO_ENABLED=Y일 때만 적용, 기준일은 FIFO_CRITERIA.',
         '[{"value":"BLOCK","label":"차단"},{"value":"WARN","label":"경고 후 진행"}]', 14, '40', '1000'
  FROM dual
  UNION ALL
  SELECT 'MATERIAL', 'EXPIRED_ISSUE_BLOCK', 'Y', 'BOOLEAN',
         '유효기간 만료 LOT 출고 차단',
         'EXPIRE_DATE가 오늘보다 이전인 자재 LOT의 출고를 거부합니다 (Y=차단, N=허용).',
         NULL, 15, '40', '1000'
  FROM dual
  UNION ALL
  SELECT 'QUALITY', 'MEASURE_RECEIVE_ENABLED', 'N', 'BOOLEAN',
         '계측기 측정값 수신 사용',
         'POST /quality/measurements 로 압착고·인장력 등 계측기 수치를 받아 SPC 관리도에 적재하는 기능을 켭니다 (Y=사용, N=거부). 게이지 프로토콜(EQUIP_PROTOCOLS.VALUE_INDEX)과 SPC 관리도가 등록된 뒤 켜십시오.',
         NULL, 41, '40', '1000'
  FROM dual
) s
ON (t.CONFIG_KEY = s.CONFIG_KEY AND t.COMPANY = s.COMPANY AND t.PLANT_CD = s.PLANT_CD)
WHEN NOT MATCHED THEN
  INSERT (CONFIG_GROUP, CONFIG_KEY, CONFIG_VALUE, CONFIG_TYPE, LABEL, DESCRIPTION, OPTIONS, SORT_ORDER, IS_ACTIVE, COMPANY, PLANT_CD, CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT)
  VALUES (s.CONFIG_GROUP, s.CONFIG_KEY, s.CONFIG_VALUE, s.CONFIG_TYPE, s.LABEL, s.DESCRIPTION, s.OPTIONS, s.SORT_ORDER, 'Y', s.COMPANY, s.PLANT_CD, 'system', 'system', SYSTIMESTAMP, SYSTIMESTAMP)
/
