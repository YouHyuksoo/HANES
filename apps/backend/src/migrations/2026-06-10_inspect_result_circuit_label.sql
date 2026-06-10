-- 회로라벨 컬럼 추가 (INSPECT_RESULTS)
-- 통전검사 스캔 모드에서 합격(PASS) 시 설비가 자동 출력한 회로라벨 바코드를
-- 검사 대상 제품(FG 바코드)과 매핑하여 저장한다. nullable(기존 행 안전).
ALTER TABLE INSPECT_RESULTS ADD (CIRCUIT_LABEL VARCHAR2(200));

COMMENT ON COLUMN INSPECT_RESULTS.CIRCUIT_LABEL IS '회로라벨: 설비 출력 바코드, 스캔 모드 PASS 시 매핑';

-- 회로라벨 중복 매핑 하드 차단 (테넌트별 유일, NULL 허용).
-- 함수기반 부분 UNIQUE 인덱스: CIRCUIT_LABEL이 NULL이면 세 표현식이 모두 NULL이 되어
-- Oracle이 "전체 NULL 키"로 보고 인덱스에서 제외 → FAIL/ON_INSPECT 등 NULL 회로라벨 행은
-- 개수 제한 없이 허용. 실제 값이 있는 회로라벨만 동일 COMPANY/PLANT_CD 내에서 유일성 강제.
-- (서비스의 company/plant 스코프 중복검사와 동일 의미. 단순 복합 UNIQUE는 NULL 행끼리
--  ORA-01452로 충돌하므로 사용 불가.)
CREATE UNIQUE INDEX UQ_INSPECT_RESULT_CIRCUIT ON INSPECT_RESULTS (
  CASE WHEN CIRCUIT_LABEL IS NULL THEN NULL ELSE COMPANY END,
  CASE WHEN CIRCUIT_LABEL IS NULL THEN NULL ELSE PLANT_CD END,
  CIRCUIT_LABEL
);
