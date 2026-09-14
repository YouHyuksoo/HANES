-- 장기재고 설정 2건을 제품재고 장기보관 제어 기준으로 확정한다.
-- 기산점은 FG_LABELS.ISSUED_AT(제품라벨 발행 = 생산 시점).
-- PRODUCT_TRANSACTIONS.FG_IN 은 데이터가 사실상 없어 기산점으로 쓰지 않는다.
UPDATE SYS_CONFIGS
   SET IS_ACTIVE = 'Y',
       LABEL = '제품 장기보관 체크',
       DESCRIPTION = '제품재고 장기보관 경고 표시 여부',
       UPDATED_AT = SYSTIMESTAMP
 WHERE CONFIG_KEY = 'LONG_STOCK_CHECK'
/
UPDATE SYS_CONFIGS
   SET IS_ACTIVE = 'Y',
       LABEL = '제품 장기보관 기준일수',
       DESCRIPTION = '제품라벨 발행일(FG_LABELS.ISSUED_AT)부터 이 일수를 넘기면 장기보관으로 판정한다',
       UPDATED_AT = SYSTIMESTAMP
 WHERE CONFIG_KEY = 'LONG_STOCK_DAYS'
/
COMMIT
/
