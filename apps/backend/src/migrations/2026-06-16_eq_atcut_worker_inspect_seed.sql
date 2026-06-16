-- =============================================================================
-- 2026-06-16_eq_atcut_worker_inspect_seed.sql
-- 목적: 키오스크 "작업자 설비 자가점검"(WorkerInspectModal) 인터락 검증용으로
--       설비 EQ-ATCUT-01(EQUIP_TYPE=SINGLE_CUT)에 작업자설비점검(WORKER) 항목
--       1개를 최소 배정한다.
--
-- 조회 경로(키오스크): GET /master/equip-inspect-items?equipCode=EQ-ATCUT-01&inspectType=WORKER
--   → EquipInspectService.findAll: EQUIP_INSPECT_ITEM_POOL 을 기준으로
--     EQUIP_INSPECT_ITEM_MASTERS 를 (company+plant+item_code) LEFT JOIN.
--     필터: equipCode, inspectType='WORKER'. (useYn 미지정 시 전체)
--
-- 재사용 항목: EI-WRK-001 "작업 전 설비 주변 정리정돈"
--   (EQUIP_INSPECT_ITEM_MASTERS 기존 행, INSPECT_TYPE=WORKER, USE_YN=Y, EQUIP_TYPE=COMMON)
--   → 다른 설비(EQ-AINSP-01 등)가 이미 동일 항목을 배정한 표준 패턴을 그대로 본뜸.
--
-- ⚠️ ADD-ONLY: 기존 MASTERS/POOL 행을 수정/삭제하지 않는다. POOL 신규 1행만 MERGE INSERT.
-- 멀티테넌시: COMPANY='40', PLANT_CD='1000'.
-- 멱등성: 동일 PK 존재 시 NO-OP (MERGE WHEN NOT MATCHED 만).
-- =============================================================================

MERGE INTO EQUIP_INSPECT_ITEM_POOL t
USING (
  SELECT '40' AS COMPANY, '1000' AS PLANT_CD, 'EQ-ATCUT-01' AS EQUIP_CODE,
         'EI-WRK-001' AS ITEM_CODE, 'WORKER' AS INSPECT_TYPE FROM DUAL
) s
ON (
  t.COMPANY = s.COMPANY AND t.PLANT_CD = s.PLANT_CD AND t.EQUIP_CODE = s.EQUIP_CODE
  AND t.ITEM_CODE = s.ITEM_CODE AND t.INSPECT_TYPE = s.INSPECT_TYPE
)
WHEN NOT MATCHED THEN INSERT (
  COMPANY, PLANT_CD, EQUIP_CODE, ITEM_CODE, INSPECT_TYPE, USE_YN, SORT_SEQ, CREATED_BY, UPDATED_BY
) VALUES (
  s.COMPANY, s.PLANT_CD, s.EQUIP_CODE, s.ITEM_CODE, s.INSPECT_TYPE, 'Y', 1, 'seed', 'seed'
);
