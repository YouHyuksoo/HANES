-- 활동 이벤트 수집 설정 (SYS_CONFIGS, SYSTEM 그룹)
--
-- 실측(2026-09-12 JSHANES): 두 키 모두 없었다. isEnabled 는 값이 'Y' 일 때만 true 이므로
-- 키가 없으면 에러 3종만 저장되고 나머지는 전송조차 되지 않는다. 명시적으로 심는다.
--
-- ENABLE_ACTIVITY_LOG      전체 마스터. 단 에러 3종(TOAST_ERROR/API_ERROR/JS_ERROR)은
--                          이 값과 무관하게 항상 저장한다(프론트·백엔드 양쪽 동일 규칙).
-- ACTIVITY_LOG_COLLECT_ALL 성공 토스트·API 호출·스캔까지 저장할지. 평상시 수집량을 억제하려고 기본 N.
--                          시나리오 실행을 분석하려면 Y 로 올린다.
--
-- 사이트: JSHANES(40/1000)

INSERT INTO SYS_CONFIGS
  (CONFIG_KEY, CONFIG_GROUP, CONFIG_VALUE, CONFIG_TYPE, LABEL, DESCRIPTION, OPTIONS, SORT_ORDER, IS_ACTIVE, COMPANY, PLANT_CD, CREATED_AT, UPDATED_AT)
SELECT 'ENABLE_ACTIVITY_LOG', 'SYSTEM', 'Y', 'BOOLEAN', '활동 로그 수집',
  '사용자 활동(페이지 접속·토스트·API)을 ACTIVITY_LOGS 에 저장합니다. 에러 기록은 이 설정과 무관하게 항상 저장됩니다. Y=수집, N=중지',
  NULL, 80, 'Y', '40', '1000', SYSTIMESTAMP, SYSTIMESTAMP
FROM DUAL WHERE NOT EXISTS (
  SELECT 1 FROM SYS_CONFIGS WHERE CONFIG_KEY = 'ENABLE_ACTIVITY_LOG' AND COMPANY = '40' AND PLANT_CD = '1000');
/

INSERT INTO SYS_CONFIGS
  (CONFIG_KEY, CONFIG_GROUP, CONFIG_VALUE, CONFIG_TYPE, LABEL, DESCRIPTION, OPTIONS, SORT_ORDER, IS_ACTIVE, COMPANY, PLANT_CD, CREATED_AT, UPDATED_AT)
SELECT 'ACTIVITY_LOG_COLLECT_ALL', 'SYSTEM', 'N', 'BOOLEAN', '활동 로그 전수 수집',
  '성공 토스트·API 호출·바코드 스캔까지 저장합니다. 기록량이 크게 늘어나므로 분석이 필요할 때만 켭니다. Y=전수, N=에러와 페이지접속만',
  NULL, 81, 'Y', '40', '1000', SYSTIMESTAMP, SYSTIMESTAMP
FROM DUAL WHERE NOT EXISTS (
  SELECT 1 FROM SYS_CONFIGS WHERE CONFIG_KEY = 'ACTIVITY_LOG_COLLECT_ALL' AND COMPANY = '40' AND PLANT_CD = '1000');
/

COMMIT;
/
