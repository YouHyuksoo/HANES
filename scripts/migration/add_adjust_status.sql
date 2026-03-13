-- ============================================================
-- 재고보정 승인 워크플로우 컬럼 추가
-- 대상 테이블: INV_ADJ_LOGS
-- 작성일: 2026-03-13
-- ============================================================

-- ADJUST_STATUS 컬럼 추가 (기존 레코드 기본값 'APPROVED')
ALTER TABLE INV_ADJ_LOGS ADD ADJUST_STATUS VARCHAR2(20) DEFAULT 'APPROVED';

COMMENT ON COLUMN INV_ADJ_LOGS.ADJUST_STATUS IS '보정승인상태(PENDING/APPROVED/REJECTED)';

-- 기존 레코드 일괄 업데이트 (NULL 방지)
UPDATE INV_ADJ_LOGS SET ADJUST_STATUS = 'APPROVED' WHERE ADJUST_STATUS IS NULL;

COMMIT;
