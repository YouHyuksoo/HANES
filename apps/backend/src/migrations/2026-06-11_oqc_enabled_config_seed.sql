-- OQC 사용여부 시스템 설정 (SYS_CONFIGS, QUALITY 그룹, BOOLEAN)
-- 'Y'(기본): OQC 합격(PASS) 박스만 출하 가능 (기존 동작 유지)
-- 'N': OQC 상태 무관하게 모든 마감 박스 출하 가능
-- 출하 게이트 3곳(ship-order.shipBox, shipment.loadPallets, shipment.markAsShipped)에서 isEnabled('OQC_ENABLED')로 분기.
-- 자연키 CONFIG_KEY WHERE NOT EXISTS → 재실행 안전. 사이트: JSHANES(40/1000).
INSERT INTO SYS_CONFIGS
  (CONFIG_KEY, CONFIG_GROUP, CONFIG_VALUE, CONFIG_TYPE, LABEL, DESCRIPTION, OPTIONS, SORT_ORDER, IS_ACTIVE, COMPANY, PLANT_CD, CREATED_AT, UPDATED_AT)
SELECT
  'OQC_ENABLED', 'QUALITY', 'Y', 'BOOLEAN', 'OQC 사용여부',
  'OQC 사용 시 합격(PASS) 박스만 출하 가능, 미사용 시 모든 마감 박스 출하 가능', NULL,
  30, 'Y', '40', '1000', SYSTIMESTAMP, SYSTIMESTAMP
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM SYS_CONFIGS WHERE CONFIG_KEY = 'OQC_ENABLED' AND COMPANY = '40' AND PLANT_CD = '1000'
);
/

COMMIT;
/
