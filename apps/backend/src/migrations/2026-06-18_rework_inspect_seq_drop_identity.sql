-- 2026-06-18 재작업 재검사(REWORK_INSPECTS) SEQ 컬럼 identity 제거
--
-- 배경:
--   ReworkInspect 엔티티와 ReworkService.createInspect 는 SEQ 를
--   "해당 재작업주문의 검사 건수 + 1" 로 수동 채번한다(복합 PK = REWORK_ORDER_ID + SEQ).
--   그러나 DB 의 SEQ 컬럼이 GENERATED ALWAYS AS IDENTITY 로 생성돼 있어
--   수동 INSERT 시 ORA-32795(generated always ID 열에 삽입 불가)로 재검사 등록이 항상 실패했다.
--   → 코드/엔티티가 수동 seq 를 전제하므로 DB 쪽 identity 를 제거해 정합을 맞춘다.
--
-- 적용 사이트: JSHANES(JSHNSMES) 에는 적용 완료. 타 환경(운영 등)에 동일 적용 필요.

ALTER TABLE REWORK_INSPECTS MODIFY SEQ DROP IDENTITY;
