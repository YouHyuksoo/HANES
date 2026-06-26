-- FG 바코드 발행을 라우팅(조립 키팅, ISSUE_FG_LABEL_YN)으로 일원화하면서
-- 전역 발행시점 설정 FG_BARCODE_ISSUE_TIMING 을 폐기한다.
-- 통전검사는 조립에서 발행된 ISSUED 라벨을 스캔해 판정만 한다.
DELETE FROM SYS_CONFIGS WHERE CONFIG_KEY = 'FG_BARCODE_ISSUE_TIMING';
COMMIT;
