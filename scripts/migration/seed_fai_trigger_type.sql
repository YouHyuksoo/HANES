MERGE INTO "COM_CODES" t
USING (
  SELECT 'FAI_TRIGGER_TYPE' AS "GROUP_CODE", 'NEW_PART'       AS "DETAIL_CODE", '신규품목'   AS "CODE_NAME", 1 AS "SORT_ORDER", 'New Part'       AS "ATTR1", '新品目' AS "ATTR2", 'Sản phẩm mới'    AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'FAI_TRIGGER_TYPE', 'ECN',            '설계변경',   2, 'ECN',            '设计变更', 'Thay đổi thiết kế' FROM DUAL UNION ALL
  SELECT 'FAI_TRIGGER_TYPE', 'PROCESS_CHANGE', '공정변경',   3, 'Process Change', '工艺变更', 'Thay đổi quy trình' FROM DUAL UNION ALL
  SELECT 'FAI_TRIGGER_TYPE', 'LONG_STOP',      '장기중단',   4, 'Long Stop',      '长期停产', 'Ngừng lâu dài'     FROM DUAL
) s ON (t."COMPANY" = 'HANES' AND t."PLANT_CD" = 'VINA' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY"
) VALUES (
  'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM'
)
