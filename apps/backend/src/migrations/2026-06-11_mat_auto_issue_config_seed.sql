-- BOM 자재 자동차감(백플러시) 설정 시드 (SYS_CONFIGS, PRODUCTION 그룹)
-- 배경: AutoIssueService.execute()는 MAT_AUTO_ISSUE_TIMING 설정과 호출 시점이 일치할 때만 동작.
--       설정 부재 시 항상 skip → 생산실적을 저장해도 자재 재고가 차감되지 않는 단절 발생 (2026-06-11 키오스크 실증).
-- MAT_AUTO_ISSUE_TIMING: OFF(사용안함) | ON_CREATE(실적 등록 시) | ON_COMPLETE(실적 완료 시). 기본 ON_CREATE.
-- MAT_ISSUE_STOCK_CHECK: BLOCK(부족 시 실적 저장 차단) | WARN(가용분만 차감+경고). 기본 WARN — 자재 미입고 상태에서 생산 차단 방지.
-- 자연키 CONFIG_KEY WHERE NOT EXISTS → 재실행 안전. 사이트: JSHANES(40/1000).
INSERT INTO SYS_CONFIGS
  (CONFIG_KEY, CONFIG_GROUP, CONFIG_VALUE, CONFIG_TYPE, LABEL, DESCRIPTION, OPTIONS, SORT_ORDER, IS_ACTIVE, COMPANY, PLANT_CD, CREATED_AT, UPDATED_AT)
SELECT
  'MAT_AUTO_ISSUE_TIMING', 'PRODUCTION', 'ON_CREATE', 'SELECT', '자재 자동차감 시점',
  '생산실적 저장 시 BOM 기준 자재 자동차감(백플러시) 시점. 사용안함 선택 시 자재 재고가 차감되지 않습니다.',
  '[{"value":"OFF","label":"사용안함"},{"value":"ON_CREATE","label":"실적 등록 시"},{"value":"ON_COMPLETE","label":"실적 완료 시"}]',
  4, 'Y', '40', '1000', SYSTIMESTAMP, SYSTIMESTAMP
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM SYS_CONFIGS WHERE CONFIG_KEY = 'MAT_AUTO_ISSUE_TIMING' AND COMPANY = '40' AND PLANT_CD = '1000'
);
/

INSERT INTO SYS_CONFIGS
  (CONFIG_KEY, CONFIG_GROUP, CONFIG_VALUE, CONFIG_TYPE, LABEL, DESCRIPTION, OPTIONS, SORT_ORDER, IS_ACTIVE, COMPANY, PLANT_CD, CREATED_AT, UPDATED_AT)
SELECT
  'MAT_ISSUE_STOCK_CHECK', 'PRODUCTION', 'WARN', 'SELECT', '자동차감 재고부족 정책',
  'BLOCK: 자재 재고 부족 시 실적 저장 차단 / WARN: 가용분만 차감하고 경고 기록',
  '[{"value":"BLOCK","label":"차단"},{"value":"WARN","label":"경고 후 진행"}]',
  5, 'Y', '40', '1000', SYSTIMESTAMP, SYSTIMESTAMP
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM SYS_CONFIGS WHERE CONFIG_KEY = 'MAT_ISSUE_STOCK_CHECK' AND COMPANY = '40' AND PLANT_CD = '1000'
);
/

COMMIT;
/
