-- 제품 장기보관 기준일수를 90 → 60 으로 조정한다.
-- 적용일 기준 미출하 박스 10건 중 4건(76~78일)이 장기보관으로 판정된다.
UPDATE SYS_CONFIGS
   SET CONFIG_VALUE = '60',
       UPDATED_AT = SYSTIMESTAMP
 WHERE CONFIG_KEY = 'LONG_STOCK_DAYS'
/
COMMIT
/
