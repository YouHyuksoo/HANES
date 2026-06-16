MERGE INTO COM_CODES t
USING (
  SELECT 'UNIT_TYPE' AS GROUP_CODE,
         '°C' AS DETAIL_CODE,
         '섭씨' AS CODE_NAME,
         '측정 단위 - 섭씨 온도' AS CODE_DESC,
         14 AS SORT_ORDER,
         'Y' AS USE_YN,
         'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' AS ATTR1,
         'Celsius' AS ATTR3,
         '40' AS COMPANY,
         '1000' AS PLANT_CD
    FROM DUAL
  UNION ALL
  SELECT 'UNIT_TYPE' AS GROUP_CODE,
         'Ω' AS DETAIL_CODE,
         '옴' AS CODE_NAME,
         '측정 단위 - 전기 저항' AS CODE_DESC,
         15 AS SORT_ORDER,
         'Y' AS USE_YN,
         'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' AS ATTR1,
         'Ohm' AS ATTR3,
         '40' AS COMPANY,
         '1000' AS PLANT_CD
    FROM DUAL
) s
ON (
  t.COMPANY = s.COMPANY
  AND t.PLANT_CD = s.PLANT_CD
  AND t.GROUP_CODE = s.GROUP_CODE
  AND t.DETAIL_CODE = s.DETAIL_CODE
)
WHEN MATCHED THEN UPDATE SET
  t.CODE_NAME = s.CODE_NAME,
  t.CODE_DESC = s.CODE_DESC,
  t.SORT_ORDER = s.SORT_ORDER,
  t.USE_YN = s.USE_YN,
  t.ATTR1 = s.ATTR1,
  t.ATTR3 = s.ATTR3,
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
  s.USE_YN,
  s.ATTR1,
  NULL,
  s.ATTR3,
  s.COMPANY,
  s.PLANT_CD,
  'codex',
  'codex',
  SYSTIMESTAMP,
  SYSTIMESTAMP
);
/

UPDATE EQUIP_INSPECT_ITEM_MASTERS
   SET UNIT = 'MM',
       UPDATED_BY = 'codex',
       UPDATED_AT = SYSTIMESTAMP
 WHERE COMPANY = '40'
   AND PLANT_CD = '1000'
   AND LOWER(UNIT) = 'mm';
/

COMMIT;
/
