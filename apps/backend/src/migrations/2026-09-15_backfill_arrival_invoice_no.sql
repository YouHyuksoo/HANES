-- 기존 입하 데이터의 INVOICE_NO 백필 (2026-09-15)
--
-- 배경: IQC005 PO 라인 입하가 INVOICE_NO 를 빈 값으로 저장해 왔다. 그 결과
--       추적성 조회의 원자재 검색 키가 비어 조회가 0건으로 끝났다.
-- 한계: 실제 업체 송장번호는 시스템 어디에도 남아 있지 않다(입하 헤더 0건,
--       분할/병합 원본 LOT 0건). 따라서 과거분은 입하번호 기반 임시값으로 채운다.
--       'INV-' || ARRIVAL_NO 형식이며 업체가 발행한 실제 송장번호가 아니다.
--       앞으로 입하하는 건은 입하 화면에서 실제 송장번호를 입력받는다.
-- 대상: MAT_LOTS 397건 / MAT_ARRIVALS 383건 (INVOICE_NO IS NULL 인 행만)

UPDATE MAT_LOTS
   SET INVOICE_NO = 'INV-' || ARRIVAL_NO,
       UPDATED_AT = SYSTIMESTAMP
 WHERE INVOICE_NO IS NULL
   AND ARRIVAL_NO IS NOT NULL
/

UPDATE MAT_ARRIVALS
   SET INVOICE_NO = 'INV-' || ARRIVAL_NO,
       UPDATED_AT = SYSTIMESTAMP
 WHERE INVOICE_NO IS NULL
   AND ARRIVAL_NO IS NOT NULL
/

COMMIT
/
