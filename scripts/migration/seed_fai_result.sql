MERGE INTO "COM_CODES" t
USING (
  SELECT 'FAI_RESULT' AS "GROUP_CODE", 'PASS'        AS "DETAIL_CODE", '합격'       AS "CODE_NAME", 1 AS "SORT_ORDER", 'Pass'        AS "ATTR1", '合格'       AS "ATTR2", 'Đạt'              AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'FAI_RESULT', 'FAIL',        '불합격',     2, 'Fail',        '不合格',   'Không đạt'        FROM DUAL UNION ALL
  SELECT 'FAI_RESULT', 'CONDITIONAL', '조건부',     3, 'Conditional', '有条件',   'Có điều kiện'     FROM DUAL
) s ON (t."COMPANY" = 'HANES' AND t."PLANT_CD" = 'VINA' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY"
) VALUES (
  'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM'
)
