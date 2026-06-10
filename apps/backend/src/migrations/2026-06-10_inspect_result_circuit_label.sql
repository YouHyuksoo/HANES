-- 회로라벨 컬럼 추가 (INSPECT_RESULTS)
-- 통전검사 스캔 모드에서 합격(PASS) 시 설비가 자동 출력한 회로라벨 바코드를
-- 검사 대상 제품(FG 바코드)과 매핑하여 저장한다. nullable(기존 행 안전).
ALTER TABLE INSPECT_RESULTS ADD (CIRCUIT_LABEL VARCHAR2(200));

COMMENT ON COLUMN INSPECT_RESULTS.CIRCUIT_LABEL IS '회로라벨: 설비 출력 바코드, 스캔 모드 PASS 시 매핑';
