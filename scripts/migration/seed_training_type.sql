MERGE INTO "COM_CODES" t
USING (
  SELECT 'TRAINING_TYPE' AS "GROUP_CODE", 'OJT'       AS "DETAIL_CODE", '현장교육'   AS "CODE_NAME", 1 AS "SORT_ORDER", 'OJT'       AS "ATTR1", '在职培训' AS "ATTR2", 'Đào tạo tại chỗ' AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'TRAINING_TYPE', 'CLASSROOM', '집합교육',   2, 'Classroom', '课堂培训', 'Lớp học'          FROM DUAL UNION ALL
  SELECT 'TRAINING_TYPE', 'ONLINE',    '온라인교육', 3, 'Online',    '在线培训', 'Trực tuyến'       FROM DUAL UNION ALL
  SELECT 'TRAINING_TYPE', 'EXTERNAL',  '외부교육',   4, 'External',  '外部培训', 'Bên ngoài'        FROM DUAL UNION ALL
  SELECT 'TRAINING_TYPE', 'SAFETY',    '안전교육',   5, 'Safety',    '安全培训', 'An toàn'          FROM DUAL
) s ON (t."COMPANY" = 'HANES' AND t."PLANT_CD" = 'VINA' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY"
) VALUES (
  'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM'
)
