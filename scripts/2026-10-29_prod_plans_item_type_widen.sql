-- PROD_PLANS.ITEM_TYPE 길이 확장 (VARCHAR2(10) -> VARCHAR2(20))
-- 사유: 품목 유형 값 SEMI_PRODUCT(12자)·RAW_MATERIAL(12자)가 10자를 넘어 반제품 생산계획 등록과 수주 가져오기가 ORA-12899(500)로 실패한다.
-- 적용 대상: HANES 운영/개발 DB (사용자가 대상과 시점을 정해 직접 적용한다 — 이 파일은 적용하지 않은 상태로 커밋됨).
-- 사전 확인: SELECT DATA_LENGTH, CHAR_LENGTH FROM USER_TAB_COLUMNS WHERE TABLE_NAME='PROD_PLANS' AND COLUMN_NAME='ITEM_TYPE';
-- 사후 확인: 같은 조회의 CHAR_LENGTH 가 20 이어야 한다.
ALTER TABLE PROD_PLANS MODIFY (ITEM_TYPE VARCHAR2(20 CHAR));
