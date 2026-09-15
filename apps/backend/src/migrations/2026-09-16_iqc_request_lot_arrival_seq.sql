-- IQC 검사의뢰 LOT 구성 라인에 입하 행 순번(ARRIVAL_SEQ)을 추가한다.
--
-- 배경: MAT_ARRIVALS의 PK는 복합키 (ARRIVAL_NO, SEQ)다. ARRIVAL_NO 단독으로는 입하 행이 유일하지 않다.
--       예) JSHANES 품목 1SH21A7A09의 PENDING 입하 60행이 전부 ARRIVAL_NO='R26090900001', SEQ 1~60.
--       기존 IQC_REQUEST_LOT_LINES는 ARRIVAL_NO만 보관해 어떤 입하 행을 담았는지 특정할 수 없었고,
--       IqcRequestLotService.create()의 행 수 대조가 항상 실패해 의뢰 확정 자체가 불가능했다.
--
-- 적용: 2026-09-16 JSHANES 적용 완료 (적용 전 IQC_REQUEST_LOTS 0건 / IQC_REQUEST_LOT_LINES 0건 확인).
--       기존 데이터가 없으므로 DEFAULT 1 NOT NULL로 추가했다.
-- 실행: oracle-db --site JSHANES --query 로 아래 문장을 한 건씩 실행한다.
--       connector가 PL/SQL 익명 블록을 파싱하지 못해 --execute-file 대신 단일 DDL로 나눠 적용했다.

ALTER TABLE IQC_REQUEST_LOT_LINES ADD (ARRIVAL_SEQ NUMBER DEFAULT 1 NOT NULL)
/
COMMENT ON COLUMN IQC_REQUEST_LOT_LINES.ARRIVAL_SEQ IS '구성 입하 행 순번(MAT_ARRIVALS.SEQ). ARRIVAL_NO 단독으로는 입하 행이 유일하지 않다.'
/
DROP INDEX IX_IQC_REQ_LOT_ARR
/
CREATE INDEX IX_IQC_REQ_LOT_ARR ON IQC_REQUEST_LOT_LINES (COMPANY, PLANT_CD, ARRIVAL_NO, ARRIVAL_SEQ, ITEM_CODE)
/
COMMIT
/
