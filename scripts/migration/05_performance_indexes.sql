-- =============================================================================
-- 성능 최적화 인덱스 (2026-04-04)
-- Codex 리뷰 기반 — 인덱스 킬러 패턴 및 자주 사용되는 조회 조건용
-- =============================================================================

-- 1. BOM 부모 검색용 — UPPER(ITEM_NAME), UPPER(PART_NO) 함수 기반 인덱스
CREATE INDEX IDX_ITEM_MASTERS_NAME_UPPER ON ITEM_MASTERS(UPPER(ITEM_NAME));
CREATE INDEX IDX_ITEM_MASTERS_PARTNO_UPPER ON ITEM_MASTERS(UPPER(PART_NO));

-- 2. 설비점검 목록 조회용 — company/plant/inspectDate 보조 인덱스
CREATE INDEX IDX_EQUIP_INSPECT_LOGS_TENANT_DATE ON EQUIP_INSPECT_LOGS(COMPANY, PLANT_CD, INSPECT_DATE);

-- 3. 자재입고 목록용 — company/plant/status 복합 인덱스
CREATE INDEX IDX_MAT_RECEIVINGS_TENANT_STATUS ON MAT_RECEIVINGS(COMPANY, PLANT_CD, STATUS);

-- 4. 재고 트랜잭션 집계용 — transType + status + transDate 복합 인덱스
CREATE INDEX IDX_STOCK_TX_TYPE_STATUS_DATE ON STOCK_TRANSACTIONS(TRANS_TYPE, STATUS, CREATED_AT);

-- 5. 생산실적 기간 집계용 — START_TIME 인덱스
CREATE INDEX IDX_PROD_RESULTS_START_TIME ON PROD_RESULTS(START_TIME);

-- 6. 설비점검 검색용 — LOWER(INSPECTOR_NAME) 함수 기반 인덱스
CREATE INDEX IDX_EQUIP_INSPECT_LOGS_INSPECTOR_LOWER ON EQUIP_INSPECT_LOGS(LOWER(INSPECTOR_NAME));
