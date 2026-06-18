-- 2026-06-18 통전검사 실적에 검사 설비(검사기) 기록용 EQUIP_CODE 컬럼 추가
-- 검사 화면에서 선택한 검사기(EQUIP_TYPE='TESTER')를 검사 결과에 저장한다.
-- 재실행 시 이미 존재하면 ORA-01430(컬럼 중복) 발생 — 무시 가능.
ALTER TABLE INSPECT_RESULTS ADD (EQUIP_CODE VARCHAR2(50));
/
COMMENT ON COLUMN INSPECT_RESULTS.EQUIP_CODE IS '검사 설비(검사기) 코드 - 검사 화면에서 선택한 TESTER 설비';
/
