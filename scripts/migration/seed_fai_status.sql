MERGE INTO "COM_CODES" t
USING (
  SELECT 'FAI_STATUS' AS "GROUP_CODE", 'REQUESTED'   AS "DETAIL_CODE", '요청'       AS "CODE_NAME", 1 AS "SORT_ORDER", 'Requested'   AS "ATTR1", '已请求'   AS "ATTR2", 'Yêu cầu'       AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'FAI_STATUS', 'SAMPLING',    '샘플채취',   2, 'Sampling',    '取样中',   'Lấy mẫu'        FROM DUAL UNION ALL
  SELECT 'FAI_STATUS', 'INSPECTING',  '검사중',     3, 'Inspecting',  '检查中',   'Đang kiểm tra'   FROM DUAL UNION ALL
  SELECT 'FAI_STATUS', 'PASS',        '합격',       4, 'Pass',        '合格',     'Đạt'             FROM DUAL UNION ALL
  SELECT 'FAI_STATUS', 'FAIL',        '불합격',     5, 'Fail',        '不合格',   'Không đạt'       FROM DUAL UNION ALL
  SELECT 'FAI_STATUS', 'CONDITIONAL', '조건부합격', 6, 'Conditional', '有条件合格', 'Đạt có điều kiện' FROM DUAL
) s ON (t."COMPANY" = 'HANES' AND t."PLANT_CD" = 'VINA' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY"
) VALUES (
  'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM'
)
