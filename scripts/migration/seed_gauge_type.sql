MERGE INTO "COM_CODES" t
USING (
  SELECT 'GAUGE_TYPE' AS "GROUP_CODE", 'CALIPER'      AS "DETAIL_CODE", '캘리퍼스'     AS "CODE_NAME", 1 AS "SORT_ORDER", 'Caliper'      AS "ATTR1", '卡尺'   AS "ATTR2", 'Thước kẹp'   AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'GAUGE_TYPE', 'MICROMETER',   '마이크로미터', 2, 'Micrometer',   '千分尺', 'Panme'        FROM DUAL UNION ALL
  SELECT 'GAUGE_TYPE', 'DIAL_GAUGE',   '다이얼게이지', 3, 'Dial Gauge',   '百分表', 'Đồng hồ so'  FROM DUAL UNION ALL
  SELECT 'GAUGE_TYPE', 'HEIGHT_GAUGE', '하이트게이지', 4, 'Height Gauge', '高度规', 'Thước đo cao' FROM DUAL UNION ALL
  SELECT 'GAUGE_TYPE', 'PIN_GAUGE',    '핀게이지',     5, 'Pin Gauge',    '针规',   'Dưỡng chốt'  FROM DUAL UNION ALL
  SELECT 'GAUGE_TYPE', 'RING_GAUGE',   '링게이지',     6, 'Ring Gauge',   '环规',   'Dưỡng vòng'  FROM DUAL UNION ALL
  SELECT 'GAUGE_TYPE', 'FORCE_GAUGE',  '포스게이지',   7, 'Force Gauge',  '测力计', 'Lực kế'      FROM DUAL UNION ALL
  SELECT 'GAUGE_TYPE', 'OTHER',        '기타',         8, 'Other',        '其他',   'Khác'        FROM DUAL
) s ON (t."COMPANY" = 'HANES' AND t."PLANT_CD" = 'VINA' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY"
) VALUES (
  'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM'
)
