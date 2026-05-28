-- PO_STATUS 공통코드 색상(ATTR1) 업데이트 + 누락 코드 추가
-- ATTR1: Tailwind 배지 색상 클래스
MERGE INTO COM_CODES T
USING (
    SELECT 'PO_STATUS' GRP, 'DRAFT'     CD, '임시저장' NM, 1 SO, 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'    A1 FROM DUAL UNION ALL
    SELECT 'PO_STATUS',     'CONFIRMED', '확정',     2,    'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'       FROM DUAL UNION ALL
    SELECT 'PO_STATUS',     'PARTIAL',   '부분입고', 3,    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' FROM DUAL UNION ALL
    SELECT 'PO_STATUS',     'RECEIVED',  '입고완료', 4,    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'    FROM DUAL UNION ALL
    SELECT 'PO_STATUS',     'CLOSED',    '마감',     5,    'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' FROM DUAL
) E ON (T.GROUP_CODE = E.GRP AND T.DETAIL_CODE = E.CD AND T.COMPANY = '40' AND T.PLANT_CD = '1000')
WHEN NOT MATCHED THEN
    INSERT (GROUP_CODE, DETAIL_CODE, CODE_NAME, SORT_ORDER, ATTR1, USE_YN, COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT)
    VALUES (E.GRP, E.CD, E.NM, E.SO, E.A1, 'Y', '40', '1000', 'SYSTEM', SYSTIMESTAMP, SYSTIMESTAMP)
WHEN MATCHED THEN
    UPDATE SET T.CODE_NAME = E.NM, T.SORT_ORDER = E.SO, T.ATTR1 = E.A1, T.UPDATED_AT = SYSTIMESTAMP
/
COMMIT
/
