-- =============================================================================
-- 2026-06-16_eq_atcut_daily_inspect_seed.sql
-- 목적: 키오스크 "설비 일일점검"(DailyInspectModal) 인터락 검증용으로
--       설비 EQ-ATCUT-01(EQUIP_TYPE=SINGLE_CUT)에 설비일일점검(DAILY) 항목
--       1개를 최소 배정한다.
--
-- 조회 경로(키오스크 DailyInspectModal):
--   GET /master/equip-inspect-items?equipCode=EQ-ATCUT-01&inspectType=DAILY&limit=100
--   → EquipInspectService.findAll(WORKER와 동일 경로): EQUIP_INSPECT_ITEM_POOL 기준
--     EQUIP_INSPECT_ITEM_MASTERS 를 (company+plant+item_code) LEFT JOIN.
--     필터: equipCode, inspectType='DAILY'.
--
-- 재사용 항목: EI-SCT-002 "커터 날 마모 상태 육안 확인"
--   (EQUIP_INSPECT_ITEM_MASTERS 기존 행, INSPECT_TYPE=DAILY, EQUIP_TYPE=SINGLE_CUT,
--    ITEM_TYPE=VISUAL, USE_YN=Y, LSL/USL 없음)
--   → EQ-ATCUT-01 설비유형(SINGLE_CUT)과 정확히 일치하는 기존 마스터 재사용.
--   → VISUAL 판정형이라 측정범위 없이 OK/NG 선택만으로 인터락 충족.
--
-- ⚠️ ADD-ONLY: 기존 MASTERS/POOL 행을 수정/삭제하지 않는다. POOL 신규 1행만 MERGE INSERT.
-- 멀티테넌시: COMPANY='40', PLANT_CD='1000'.
-- 멱등성: 동일 PK 존재 시 NO-OP (MERGE WHEN NOT MATCHED 만).
-- =============================================================================

MERGE INTO EQUIP_INSPECT_ITEM_POOL t
USING (
  SELECT '40' AS COMPANY, '1000' AS PLANT_CD, 'EQ-ATCUT-01' AS EQUIP_CODE,
         'EI-SCT-002' AS ITEM_CODE, 'DAILY' AS INSPECT_TYPE FROM DUAL
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
