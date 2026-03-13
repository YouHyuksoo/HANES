MERGE INTO "COM_CODES" t
USING (
  SELECT 'AUDIT_TYPE' AS "GROUP_CODE", 'SYSTEM'  AS "DETAIL_CODE", '시스템심사'  AS "CODE_NAME", 1 AS "SORT_ORDER", 'System Audit'  AS "ATTR1", '体系审核'   AS "ATTR2", 'Đánh giá hệ thống'  AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'AUDIT_TYPE', 'PROCESS', '공정심사',  2, 'Process Audit', '过程审核', 'Đánh giá quy trình' FROM DUAL UNION ALL
  SELECT 'AUDIT_TYPE', 'PRODUCT', '제품심사',  3, 'Product Audit', '产品审核', 'Đánh giá sản phẩm'  FROM DUAL UNION ALL
  SELECT 'AUDIT_TYPE', 'LAYERED', '계층별심사', 4, 'Layered Audit', '分层审核', 'Đánh giá phân tầng' FROM DUAL
) s ON (t."COMPANY" = 'HANES' AND t."PLANT_CD" = 'VINA' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
)
