-- Seed standard equipment inspection item pool rows for HANES local/demo tenant.
-- Target tenant: COMPANY = 40, PLANT_CD = 1000.
-- Safe to rerun: rows are keyed by COMPANY + PLANT_CD + ITEM_CODE.

MERGE INTO EQUIP_INSPECT_ITEM_POOL target
USING (
  SELECT '40' COMPANY, '1000' PLANT_CD, 'EIP-STD-D001' ITEM_CODE, '안전커버 체결 상태' ITEM_NAME, 'DAILY' INSPECT_TYPE, '커버 체결 및 파손 없음' CRITERIA, 'DAILY' CYCLE, 'Y' USE_YN, '일상 안전 점검' REMARK FROM DUAL UNION ALL
  SELECT '40', '1000', 'EIP-STD-D002', '비상정지 버튼 동작', 'DAILY', '비상정지 버튼 정상 동작', 'DAILY', 'Y', '일상 안전 점검' FROM DUAL UNION ALL
  SELECT '40', '1000', 'EIP-STD-D003', '에어압력 확인', 'DAILY', '설비 기준 압력 범위 유지', 'DAILY', 'Y', '일상 설비 조건' FROM DUAL UNION ALL
  SELECT '40', '1000', 'EIP-STD-D004', '윤활 상태 확인', 'DAILY', '윤활 부족 및 누유 없음', 'DAILY', 'Y', '일상 설비 조건' FROM DUAL UNION ALL
  SELECT '40', '1000', 'EIP-STD-D005', '센서 동작 확인', 'DAILY', '감지 센서 오동작 없음', 'DAILY', 'Y', '일상 기능 점검' FROM DUAL UNION ALL
  SELECT '40', '1000', 'EIP-STD-D006', '작업부 이물질 청소', 'DAILY', '작업부 이물질 및 분진 제거', 'DAILY', 'Y', '일상 청소 점검' FROM DUAL UNION ALL
  SELECT '40', '1000', 'EIP-STD-D007', '전원 및 표시등 상태', 'DAILY', '전원부 및 상태 표시등 정상', 'DAILY', 'Y', '일상 전기 점검' FROM DUAL UNION ALL
  SELECT '40', '1000', 'EIP-STD-D008', '치공구 장착 상태', 'DAILY', '치공구 유격 및 장착 불량 없음', 'DAILY', 'Y', '일상 생산 준비' FROM DUAL UNION ALL
  SELECT '40', '1000', 'EIP-STD-P001', '모터 진동 측정', 'PERIODIC', '기준 진동값 이내', 'MONTHLY', 'Y', '정기 구동부 점검' FROM DUAL UNION ALL
  SELECT '40', '1000', 'EIP-STD-P002', '베어링 온도 확인', 'PERIODIC', '운전 중 온도 기준 이내', 'MONTHLY', 'Y', '정기 구동부 점검' FROM DUAL UNION ALL
  SELECT '40', '1000', 'EIP-STD-P003', '절연저항 측정', 'PERIODIC', '절연저항 기준값 이상', 'QUARTERLY', 'Y', '정기 전기 점검' FROM DUAL UNION ALL
  SELECT '40', '1000', 'EIP-STD-P004', '접지 상태 확인', 'PERIODIC', '접지 저항 기준 이내', 'QUARTERLY', 'Y', '정기 전기 점검' FROM DUAL UNION ALL
  SELECT '40', '1000', 'EIP-STD-P005', '벨트 장력 확인', 'PERIODIC', '장력 기준 범위 유지 및 마모 없음', 'MONTHLY', 'Y', '정기 구동부 점검' FROM DUAL UNION ALL
  SELECT '40', '1000', 'EIP-STD-P006', '실린더 누유 확인', 'PERIODIC', '공압/유압 실린더 누유 없음', 'MONTHLY', 'Y', '정기 구동부 점검' FROM DUAL UNION ALL
  SELECT '40', '1000', 'EIP-STD-P007', '제어반 내부 점검', 'PERIODIC', '단자 풀림, 발열, 이물 없음', 'QUARTERLY', 'Y', '정기 전장 점검' FROM DUAL UNION ALL
  SELECT '40', '1000', 'EIP-STD-P008', '기준 시편 검사', 'PERIODIC', '기준 시편 검사 결과 합격', 'MONTHLY', 'Y', '정기 검사기 점검' FROM DUAL UNION ALL
  SELECT '40', '1000', 'EIP-STD-M001', '소모품 교체 상태', 'PM', '소모품 교체주기 준수', 'MONTHLY', 'Y', '예방보전' FROM DUAL UNION ALL
  SELECT '40', '1000', 'EIP-STD-M002', '구동부 분해 청소', 'PM', '구동부 분해 청소 및 재조립 완료', 'QUARTERLY', 'Y', '예방보전' FROM DUAL UNION ALL
  SELECT '40', '1000', 'EIP-STD-M003', '정밀도 교정', 'PM', '교정 결과 기준 이내', 'SEMI_ANNUAL', 'Y', '예방보전' FROM DUAL UNION ALL
  SELECT '40', '1000', 'EIP-STD-M004', '노후 배선 점검', 'PM', '피복 손상 및 단선 위험 없음', 'ANNUAL', 'Y', '예방보전'
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
