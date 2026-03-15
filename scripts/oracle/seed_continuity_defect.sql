MERGE INTO "COM_CODES" t
USING (
  SELECT 'CONTINUITY_DEFECT' AS "GROUP_CODE", 'OPEN'       AS "DETAIL_CODE", '단선(OPEN)'     AS "CODE_NAME", 1 AS "SORT_ORDER", 'Open Circuit'    AS "ATTR1", '断路'       AS "ATTR2", 'Hở mạch'         AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'CONTINUITY_DEFECT', 'SHORT',      '단락(SHORT)',    2, 'Short Circuit',   '短路',       'Ngắn mạch'        FROM DUAL UNION ALL
  SELECT 'CONTINUITY_DEFECT', 'MISWIRE',    '오배선',         3, 'Miswire',         '错接线',     'Nối sai'           FROM DUAL UNION ALL
  SELECT 'CONTINUITY_DEFECT', 'HIGH_R',     '저항과다',       4, 'High Resistance', '电阻过大',   'Điện trở cao'      FROM DUAL UNION ALL
  SELECT 'CONTINUITY_DEFECT', 'INSULATION', '절연불량',       5, 'Insulation Fail', '绝缘不良',   'Lỗi cách điện'     FROM DUAL UNION ALL
  SELECT 'CONTINUITY_DEFECT', 'INTERMIT',   '간헐불량',       6, 'Intermittent',    '间歇性不良', 'Lỗi gián đoạn'     FROM DUAL UNION ALL
  SELECT 'CONTINUITY_DEFECT', 'OTHER',      '기타',          99, 'Other',           '其他',       'Khác'              FROM DUAL
) s ON (t."COMPANY" = '40' AND t."PLANT_CD" = '1000' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  '40', '1000', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
)
