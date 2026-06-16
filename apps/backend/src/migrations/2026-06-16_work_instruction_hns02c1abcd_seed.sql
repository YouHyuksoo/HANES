-- Seed work instruction for /production/input-kiosk verification.
-- Target: WO2606150060 / HNS02C1ABCD / ATCUT / EQ-ATCUT-01

MERGE INTO WORK_INSTRUCTIONS wi
USING (
  SELECT
    'HNS02C1ABCD' AS ITEM_CODE,
    'ATCUT' AS PROCESS_CODE,
    'A' AS REVISION,
    'HNS02C1ABCD 자동절단 작업지도서' AS TITLE,
    '1. 작업지시 WO2606150060과 품목 HNS02C1ABCD를 확인한다.' || CHR(10) ||
    '2. 자동절단 설비 EQ-ATCUT-01의 자재 투입 상태와 블레이드 장착 상태를 확인한다.' || CHR(10) ||
    '3. 절단 길이, 피복 손상, 단자 연결부 변형 여부를 작업 시작 전 확인한다.' || CHR(10) ||
    '4. 이상 발생 시 즉시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.' AS CONTENT,
    CAST(NULL AS VARCHAR2(500)) AS IMAGE_URL,
    'Y' AS USE_YN,
    '40' AS COMPANY,
    '1000' AS PLANT_CD,
    'codex' AS CREATED_BY,
    'codex' AS UPDATED_BY
  FROM DUAL
) src
ON (
  wi.ITEM_CODE = src.ITEM_CODE
  AND wi.PROCESS_CODE = src.PROCESS_CODE
  AND wi.REVISION = src.REVISION
  AND wi.COMPANY = src.COMPANY
  AND wi.PLANT_CD = src.PLANT_CD
)
WHEN MATCHED THEN UPDATE SET
  wi.TITLE = src.TITLE,
  wi.CONTENT = src.CONTENT,
  wi.IMAGE_URL = src.IMAGE_URL,
  wi.USE_YN = src.USE_YN,
  wi.UPDATED_BY = src.UPDATED_BY,
  wi.UPDATED_AT = CURRENT_TIMESTAMP
WHEN NOT MATCHED THEN INSERT (
  ITEM_CODE,
  PROCESS_CODE,
  REVISION,
  TITLE,
  CONTENT,
  IMAGE_URL,
  USE_YN,
  COMPANY,
  PLANT_CD,
  CREATED_BY,
  UPDATED_BY,
  CREATED_AT,
  UPDATED_AT
) VALUES (
  src.ITEM_CODE,
  src.PROCESS_CODE,
  src.REVISION,
  src.TITLE,
  src.CONTENT,
  src.IMAGE_URL,
  src.USE_YN,
  src.COMPANY,
  src.PLANT_CD,
  src.CREATED_BY,
  src.UPDATED_BY,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
