MERGE INTO "COM_CODES" t
USING (
  SELECT 'PPAP_REASON' AS "GROUP_CODE", 'NEW_PART'   AS "DETAIL_CODE", '신규부품' AS "CODE_NAME", 1 AS "SORT_ORDER", 'New Part'       AS "ATTR1", '新零件'   AS "ATTR2", 'Phần mới'          AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'PPAP_REASON', 'ECN',        '설계변경', 2, 'ECN',            '设计变更', 'Thay đổi thiết kế' FROM DUAL UNION ALL
  SELECT 'PPAP_REASON', 'TOOLING',    '금형변경', 3, 'Tooling Change', '模具变更', 'Thay đổi khuôn'    FROM DUAL UNION ALL
  SELECT 'PPAP_REASON', 'CORRECTION', '시정조치', 4, 'Correction',     '纠正措施', 'Khắc phục'         FROM DUAL UNION ALL
  SELECT 'PPAP_REASON', 'OTHER',      '기타',     5, 'Other',          '其他',     'Khác'              FROM DUAL
) s ON (t."COMPANY" = 'HANES' AND t."PLANT_CD" = 'VINA' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
)
