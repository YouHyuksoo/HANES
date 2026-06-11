BEGIN
  MERGE INTO COM_CODES t
  USING (
    SELECT 'IQC_INSPECT_METHOD' AS GROUP_CODE, 'FULL' AS DETAIL_CODE, '검사' AS CODE_NAME,
           'IQC 검사구분: 검사 대상' AS CODE_DESC, 1 AS SORT_ORDER,
           'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' AS ATTR1
    FROM DUAL
    UNION ALL
    SELECT 'IQC_INSPECT_METHOD', 'SKIP', '무검사',
           'IQC 검사구분: 검사 생략', 2,
           'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    FROM DUAL
    UNION ALL
    SELECT 'IQC_INSPECT_TYPE', 'INITIAL', '초기검사',
           'IQC 검사유형: 최초 수입검사', 1,
           'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    FROM DUAL
    UNION ALL
    SELECT 'IQC_INSPECT_TYPE', 'RETEST', '재검사',
           'IQC 검사유형: 유수명 등 재검사', 2,
           'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    FROM DUAL
  ) s
  ON (
    t.COMPANY = '40'
    AND t.PLANT_CD = '1000'
    AND t.GROUP_CODE = s.GROUP_CODE
    AND t.DETAIL_CODE = s.DETAIL_CODE
  )
  WHEN MATCHED THEN UPDATE SET
    t.CODE_NAME = s.CODE_NAME,
    t.CODE_DESC = s.CODE_DESC,
    t.SORT_ORDER = s.SORT_ORDER,
    t.USE_YN = 'Y',
    t.ATTR1 = s.ATTR1,
    t.UPDATED_BY = 'codex',
    t.UPDATED_AT = SYSTIMESTAMP
  WHEN NOT MATCHED THEN INSERT (
    GROUP_CODE,
    DETAIL_CODE,
    PARENT_CODE,
    CODE_NAME,
    CODE_DESC,
    SORT_ORDER,
    USE_YN,
    ATTR1,
    ATTR2,
    ATTR3,
    COMPANY,
    PLANT_CD,
    CREATED_BY,
    UPDATED_BY,
    CREATED_AT,
    UPDATED_AT
  ) VALUES (
    s.GROUP_CODE,
    s.DETAIL_CODE,
    NULL,
    s.CODE_NAME,
    s.CODE_DESC,
    s.SORT_ORDER,
    'Y',
    s.ATTR1,
    NULL,
    NULL,
    '40',
    '1000',
    'codex',
    'codex',
    SYSTIMESTAMP,
    SYSTIMESTAMP
  );

  UPDATE COM_CODES
     SET USE_YN = 'N',
         UPDATED_BY = 'codex',
         UPDATED_AT = SYSTIMESTAMP
   WHERE COMPANY = '40'
     AND PLANT_CD = '1000'
     AND GROUP_CODE = 'IQC_INSPECT_METHOD'
     AND DETAIL_CODE = 'SAMPLE';

  UPDATE ITEM_MASTERS
     SET INSPECT_METHOD = 'FULL',
         UPDATED_BY = 'codex',
         UPDATED_AT = SYSTIMESTAMP
   WHERE COMPANY = '40'
     AND PLANT_CD = '1000'
     AND INSPECT_METHOD = 'SAMPLE';

  UPDATE IQC_GROUPS
     SET INSPECT_METHOD = 'FULL',
         SAMPLE_QTY = NULL,
         UPDATED_BY = 'codex',
         UPDATED_AT = SYSTIMESTAMP
   WHERE COMPANY = '40'
     AND PLANT_CD = '1000'
     AND INSPECT_METHOD = 'SAMPLE';

  COMMIT;
END;
/
