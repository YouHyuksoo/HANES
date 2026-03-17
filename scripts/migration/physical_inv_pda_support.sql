-- ============================================================
-- 자재재고실사 PDA 연동 DDL
-- 1) PHYSICAL_INV_SESSIONS에 COUNT_MONTH 컬럼 추가
-- 2) PHYSICAL_INV_COUNT_DETAILS 테이블 신규 생성
-- ============================================================

-- 1. COUNT_MONTH 컬럼 추가 (기준년월, YYYY-MM)
ALTER TABLE PHYSICAL_INV_SESSIONS ADD (COUNT_MONTH VARCHAR2(7));

-- 기존 데이터 기본값 처리 (SESSION_DATE 기준)
UPDATE PHYSICAL_INV_SESSIONS
   SET COUNT_MONTH = TO_CHAR(SESSION_DATE, 'YYYY-MM')
 WHERE COUNT_MONTH IS NULL;

COMMIT;
