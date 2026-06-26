-- 탭 최대 개수 제약 설정 시드 (SYS_CONFIGS, SYSTEM 그룹)
-- 배경: 기존에는 프론트엔드 tabStore.ts의 MAX_TABS=10이 하드코딩되어 운영 중 조정이 불가능했다.
--       MAX_OPEN_TABS 설정으로 시스템환경설정 화면에서 직접 조정할 수 있게 한다.
-- CONFIG_TYPE=NUMBER. 미설정/비정상값이면 프론트엔드 기본값 10 적용(DEFAULT_MAX_TABS).
-- 자연키 CONFIG_KEY WHERE NOT EXISTS → 재실행 안전. 사이트: JSHANES(40/1000).
INSERT INTO SYS_CONFIGS
  (CONFIG_KEY, CONFIG_GROUP, CONFIG_VALUE, CONFIG_TYPE, LABEL, DESCRIPTION, OPTIONS, SORT_ORDER, IS_ACTIVE, COMPANY, PLANT_CD, CREATED_AT, UPDATED_AT)
SELECT
  'MAX_OPEN_TABS', 'SYSTEM', '10', 'NUMBER', '최대 탭 개수',
  '동시에 열 수 있는 탭의 최대 개수(고정 탭 포함). 한도 도달 시 새 탭 열기가 차단됩니다. 미설정 시 기본 10개.',
  NULL,
  1, 'Y', '40', '1000', SYSTIMESTAMP, SYSTIMESTAMP
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM SYS_CONFIGS WHERE CONFIG_KEY = 'MAX_OPEN_TABS' AND COMPANY = '40' AND PLANT_CD = '1000'
);
/

COMMIT;
/
