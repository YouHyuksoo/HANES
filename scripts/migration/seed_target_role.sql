MERGE INTO "COM_CODES" t
USING (
  SELECT 'TARGET_ROLE' AS "GROUP_CODE", 'PRODUCTION'  AS "DETAIL_CODE", '생산직'     AS "CODE_NAME", 1 AS "SORT_ORDER", 'Production'  AS "ATTR1", '生产人员' AS "ATTR2", 'Sản xuất'      AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'TARGET_ROLE', 'QUALITY',     '품질관리',   2, 'Quality',     '质量管理', 'Chất lượng'     FROM DUAL UNION ALL
  SELECT 'TARGET_ROLE', 'MAINTENANCE', '설비보전',   3, 'Maintenance', '设备维护', 'Bảo trì'        FROM DUAL UNION ALL
  SELECT 'TARGET_ROLE', 'MANAGEMENT',  '관리직',     4, 'Management',  '管理人员', 'Quản lý'        FROM DUAL UNION ALL
  SELECT 'TARGET_ROLE', 'SAFETY',      '안전담당',   5, 'Safety',      '安全人员', 'An toàn'        FROM DUAL UNION ALL
  SELECT 'TARGET_ROLE', 'ALL',         '전체',       6, 'All',         '全部',     'Tất cả'         FROM DUAL
) s ON (t."COMPANY" = 'HANES' AND t."PLANT_CD" = 'VINA' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY"
) VALUES (
  'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM'
)
