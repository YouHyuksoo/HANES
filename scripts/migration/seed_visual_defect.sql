-- VISUAL_DEFECT (외관검사 불량유형) 항목 등록
MERGE INTO "COM_CODES" t
USING (
  SELECT 'VISUAL_DEFECT' AS "GROUP_CODE", 'SCRATCH'   AS "DETAIL_CODE", '스크래치'   AS "CODE_NAME", 1 AS "SORT_ORDER", 'Scratch'           AS "ATTR1", '划痕'       AS "ATTR2", 'Trầy xước'          AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'VISUAL_DEFECT', 'DISCOLOR',  '변색',       2, 'Discoloration',  '变色',       'Đổi màu'            FROM DUAL UNION ALL
  SELECT 'VISUAL_DEFECT', 'DENT',      '찍힘',       3, 'Dent',           '凹痕',       'Lõm'                FROM DUAL UNION ALL
  SELECT 'VISUAL_DEFECT', 'FOREIGN',   '이물질',     4, 'Foreign Matter', '异物',       'Tạp chất'           FROM DUAL UNION ALL
  SELECT 'VISUAL_DEFECT', 'CRACK',     '크랙',       5, 'Crack',          '裂纹',       'Nứt'                FROM DUAL UNION ALL
  SELECT 'VISUAL_DEFECT', 'BURR',      '버(Burr)',   6, 'Burr',           '毛刺',       'Ba vớ'              FROM DUAL UNION ALL
  SELECT 'VISUAL_DEFECT', 'DIMENSION', '치수불량',   7, 'Dimension',      '尺寸不良',   'Kích thước lỗi'     FROM DUAL UNION ALL
  SELECT 'VISUAL_DEFECT', 'OTHER',     '기타',      99, 'Other',          '其他',       'Khác'               FROM DUAL
) s ON (t."COMPANY" = '40' AND t."PLANT_CD" = '1000' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  '40', '1000', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
)
