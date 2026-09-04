-- =====================================================================
-- 2026-09-04  자재 LOT 상태 정본 어휘 보강: MAT_LOT_STATUS 에 DISCARDED(폐기) 추가
-- 유효기간 재검사 불합격(shelf-life-reinspect) 시 불용창고 이동 + MAT_LOTS.STATUS='DISCARDED' 로 기록되는데
-- 공통코드에 없어 LOT 목록/보류 화면의 StatusBadge 가 원문 코드로만 표시됐다.
-- 소진(DEPLETED)과 달리 불용창고에 재고가 남는 종결 상태라 별도 코드가 맞다.
-- 색상은 globals.css @source inline safelist 범위 내(폐기성 상태 = 회색조, 다른 종결 상태와 톤 맞춤)
-- 멱등 실행(존재 시 갱신)
-- 대상: JSHANES (company=40 / plant=1000)
-- =====================================================================

MERGE INTO COM_CODES t
USING (
  SELECT 'MAT_LOT_STATUS' AS GROUP_CODE, 'DISCARDED' AS DETAIL_CODE, '폐기' AS CODE_NAME,
         '유효기간 재검사 불합격으로 불용창고 이동·폐기된 LOT (종결)' AS CODE_DESC,
         6 AS SORT_ORDER, 'Y' AS USE_YN,
         'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' AS ATTR1,
         '40' AS COMPANY, '1000' AS PLANT_CD FROM DUAL
) s
ON (t.GROUP_CODE = s.GROUP_CODE AND t.DETAIL_CODE = s.DETAIL_CODE AND t.COMPANY = s.COMPANY AND t.PLANT_CD = s.PLANT_CD)
WHEN MATCHED THEN UPDATE SET t.CODE_NAME = s.CODE_NAME, t.CODE_DESC = s.CODE_DESC, t.SORT_ORDER = s.SORT_ORDER, t.USE_YN = s.USE_YN, t.ATTR1 = s.ATTR1
WHEN NOT MATCHED THEN
  INSERT (GROUP_CODE, DETAIL_CODE, CODE_NAME, CODE_DESC, SORT_ORDER, USE_YN, ATTR1, COMPANY, PLANT_CD, CREATED_BY)
  VALUES (s.GROUP_CODE, s.DETAIL_CODE, s.CODE_NAME, s.CODE_DESC, s.SORT_ORDER, s.USE_YN, s.ATTR1, s.COMPANY, s.PLANT_CD, 'SYSTEM');
/

COMMIT;
/
