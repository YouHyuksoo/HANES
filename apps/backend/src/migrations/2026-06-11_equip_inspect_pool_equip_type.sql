-- 점검항목 풀(EQUIP_INSPECT_ITEM_POOL)에 설비유형 컬럼 추가
-- 목적: 점검항목 마스터를 설비유형(EQUIP_TYPE)으로 분류 → 설비점검항목 추가 시 설비유형으로 풀 조회
-- EQUIP_TYPE 값은 COM_CODES GROUP_CODE='EQUIP_TYPE' 코드체계를 따른다(nullable).
ALTER TABLE EQUIP_INSPECT_ITEM_POOL ADD (
  EQUIP_TYPE VARCHAR2(50)
)
/
COMMENT ON COLUMN EQUIP_INSPECT_ITEM_POOL.EQUIP_TYPE IS '설비유형 (COM_CODES EQUIP_TYPE). 설비점검항목 추가 시 이 값으로 풀 조회'
/
COMMIT
/
