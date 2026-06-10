-- 특채여부 컬럼 추가 (MAT_LOTS)
-- IQC 불합격(FAIL) LOT을 특별채택(특채)하여 양품으로 입고 가능하게 표시
-- 'Y'=특채 승인, 'N'=일반 (기본)
ALTER TABLE MAT_LOTS ADD (SPECIAL_ACCEPT_YN VARCHAR2(1) DEFAULT 'N' NOT NULL);

COMMENT ON COLUMN MAT_LOTS.SPECIAL_ACCEPT_YN IS '특채여부: Y=특별채택(불합격 자재 양품입고 허용), N=일반';
