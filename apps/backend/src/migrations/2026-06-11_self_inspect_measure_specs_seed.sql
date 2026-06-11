-- 공정생품검사(SELF_INSPECT_ITEMS) 측정형 규격(LSL/USL) 시드
-- 의뢰검사 입력(/quality/request-inspect) 우측 패널에 검사 기준을 표시하려면
-- 검사항목이 ITEM_TYPE='MEASURE' 이고 LSL/USL/UNIT 이 채워져 있어야 한다.
-- 기존 seed-self-inspect-items.sql 은 ITEM_TYPE/UNIT/LSL/USL 을 설정하지 않아
-- 모든 항목이 VISUAL(판정형)로 남아 있다. 측정형 항목만 골라 규격을 부여한다.
--
-- 대상은 자연키(COMPANY, PLANT_CD, PROCESS_CODE, ITEM_NAME)로 식별 → UPDATE라 재실행 안전.
-- 사이트: JSHANES (COMPANY='40', PLANT_CD='1000')
--
-- 값 근거:
--  - 절연 저항 측정: STANDARD '500V 인가 시 1MΩ 이상' → 하한 1MΩ (상한 없음, 높을수록 양호)
--  - 인장강도 시험(Pull test): 압착 인장 최소 하중(예시값 60N, 상한 없음) — 실 규격에 맞게 조정 필요
--  - 도통 검사는 양/부 판정(go/no-go)이라 VISUAL 유지 (규격 없음)

-- 인장강도 시험 (Pull test) — 측정형, 하한 60N
UPDATE SELF_INSPECT_ITEMS
   SET ITEM_TYPE = 'MEASURE', UNIT = 'N', LSL_VALUE = 60, USL_VALUE = NULL, UPDATED_AT = SYSTIMESTAMP
 WHERE COMPANY = '40' AND PLANT_CD = '1000'
   AND PROCESS_CODE = 'PRC-CRIMP' AND ITEM_NAME = '인장강도 시험 (Pull test)';
/

-- 절연 저항 측정 — 측정형, 하한 1MΩ
UPDATE SELF_INSPECT_ITEMS
   SET ITEM_TYPE = 'MEASURE', UNIT = 'MΩ', LSL_VALUE = 1, USL_VALUE = NULL, UPDATED_AT = SYSTIMESTAMP
 WHERE COMPANY = '40' AND PLANT_CD = '1000'
   AND PROCESS_CODE = 'PRC-TEST' AND ITEM_NAME = '절연 저항 측정';
/

COMMIT;
/
