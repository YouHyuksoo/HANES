-- Seed standard worker equipment inspection item pool rows for HANES local/demo tenant.
-- Target tenant: COMPANY = 40, PLANT_CD = 1000.
-- Safe to rerun: rows are keyed by COMPANY + PLANT_CD + ITEM_CODE.

MERGE INTO EQUIP_INSPECT_ITEM_POOL target
USING (
  SELECT '40' COMPANY, '1000' PLANT_CD, 'EIP-STD-W001' ITEM_CODE, '작업 전 설비 주변 정리' ITEM_NAME, 'WORKER' INSPECT_TYPE, '작업 공간에 이물, 공구 방치, 케이블 걸림 위험 없음' CRITERIA, 'DAILY' CYCLE, 'Y' USE_YN, '작업자설비점검' REMARK FROM DUAL UNION ALL
  SELECT '40', '1000', 'EIP-STD-W002', '안전커버 및 보호장치 확인', 'WORKER', '안전커버 체결 상태 정상, 보호장치 임의 해제 없음', 'DAILY', 'Y', '작업자설비점검' FROM DUAL UNION ALL
  SELECT '40', '1000', 'EIP-STD-W003', '비상정지 버튼 접근성 확인', 'WORKER', '비상정지 버튼 위치 식별 가능, 접근 방해물 없음', 'DAILY', 'Y', '작업자설비점검' FROM DUAL UNION ALL
  SELECT '40', '1000', 'EIP-STD-W004', '치공구 장착 및 풀림 확인', 'WORKER', '작업 치공구 장착 상태 양호, 유격 및 풀림 없음', 'DAILY', 'Y', '작업자설비점검' FROM DUAL UNION ALL
  SELECT '40', '1000', 'EIP-STD-W005', '자재 투입 방향 확인', 'WORKER', '자재 방향, 품번, 투입 위치가 작업지시와 일치', 'DAILY', 'Y', '작업자설비점검' FROM DUAL UNION ALL
  SELECT '40', '1000', 'EIP-STD-W006', '설비 표시등 및 알람 확인', 'WORKER', '운전 전 이상 알람 없음, 표시등 상태 정상', 'DAILY', 'Y', '작업자설비점검' FROM DUAL UNION ALL
  SELECT '40', '1000', 'EIP-STD-W007', '작업부 청결 상태 확인', 'WORKER', '작업부에 분진, 절분, 오염물 없음', 'DAILY', 'Y', '작업자설비점검' FROM DUAL UNION ALL
  SELECT '40', '1000', 'EIP-STD-W008', '작업 종료 후 원위치 확인', 'WORKER', '치공구, 자재, 설비 상태가 지정 위치와 종료 기준에 맞음', 'DAILY', 'Y', '작업자설비점검' FROM DUAL
) src
ON (
  target.COMPANY = src.COMPANY
  AND target.PLANT_CD = src.PLANT_CD
  AND target.ITEM_CODE = src.ITEM_CODE
)
WHEN MATCHED THEN UPDATE SET
  target.ITEM_NAME = src.ITEM_NAME,
  target.INSPECT_TYPE = src.INSPECT_TYPE,
  target.CRITERIA = src.CRITERIA,
  target.CYCLE = src.CYCLE,
  target.USE_YN = src.USE_YN,
  target.REMARK = src.REMARK,
  target.UPDATED_BY = 'seed',
  target.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT (
  COMPANY, PLANT_CD, ITEM_CODE, ITEM_NAME, INSPECT_TYPE, CRITERIA, CYCLE, USE_YN, REMARK, CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT
) VALUES (
  src.COMPANY, src.PLANT_CD, src.ITEM_CODE, src.ITEM_NAME, src.INSPECT_TYPE, src.CRITERIA, src.CYCLE, src.USE_YN, src.REMARK, 'seed', 'seed', SYSTIMESTAMP, SYSTIMESTAMP
);

COMMIT;
