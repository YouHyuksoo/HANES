-- 설비 점검항목 풀(EQUIP_INSPECT_ITEM_POOL)에 판정형/측정형(IQC 방식) 컬럼 추가
-- 배경: 설비점검 항목을 IQC처럼 판정형(VISUAL)/측정형(MEASURE)으로 구분하고,
--       측정형일 때 단위·상한(USL)·하한(LSL) 규격을 입력받기 위함.
-- 동일 컬럼이 EQUIP_INSPECT_ITEM_MASTERS에는 이미 존재(ITEM_TYPE/UNIT/LSL_VALUE/USL_VALUE).
-- ITEM_TYPE은 DEFAULT 'VISUAL' NOT NULL → 기존 행은 자동으로 'VISUAL'(판정형)로 채워짐(별도 백필 불필요).
ALTER TABLE EQUIP_INSPECT_ITEM_POOL ADD (
  ITEM_TYPE VARCHAR2(20) DEFAULT 'VISUAL' NOT NULL,
  UNIT      VARCHAR2(20),
  LSL_VALUE NUMBER,
  USL_VALUE NUMBER
)
/
COMMIT
/
