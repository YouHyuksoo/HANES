-- ============================================================
-- 폼 등록 패널/모달에서 텍스트 입력 → ComCode 선택 전환용 시드
-- SCRAP_REASON (폐기 사유), INSPECT_METHOD (검사 방법), BOM_SIDE (BOM 사이드)
-- ============================================================

-- SCRAP_REASON (폐기 사유)
MERGE INTO "COM_CODES" t
USING (
  SELECT 'SCRAP_REASON' AS "GROUP_CODE", 'DAMAGE'    AS "DETAIL_CODE", '파손/손상'  AS "CODE_NAME", 1 AS "SORT_ORDER", 'Damage'          AS "ATTR1", '损坏'       AS "ATTR2", 'Hư hỏng'        AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'SCRAP_REASON', 'EXPIRY',     '유효기한 초과', 2, 'Expired',         '过期',       'Hết hạn'         FROM DUAL UNION ALL
  SELECT 'SCRAP_REASON', 'QUALITY',    '품질불량',      3, 'Quality Defect',  '质量不良',   'Lỗi chất lượng'  FROM DUAL UNION ALL
  SELECT 'SCRAP_REASON', 'SURPLUS',    '과잉재고',      4, 'Surplus',         '过剩库存',   'Dư thừa'         FROM DUAL UNION ALL
  SELECT 'SCRAP_REASON', 'OBSOLETE',   '단종/폐번',     5, 'Obsolete',        '停产',       'Ngừng sản xuất'  FROM DUAL UNION ALL
  SELECT 'SCRAP_REASON', 'ETC',        '기타',          6, 'Other',           '其他',       'Khác'            FROM DUAL
) s ON (t."COMPANY" = '40' AND t."PLANT_CD" = '1000' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  '40', '1000', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);

-- INSPECT_METHOD (검사 방법)
MERGE INTO "COM_CODES" t
USING (
  SELECT 'INSPECT_METHOD' AS "GROUP_CODE", 'VISUAL'      AS "DETAIL_CODE", '육안검사'   AS "CODE_NAME", 1 AS "SORT_ORDER", 'Visual'       AS "ATTR1", '目视检查'   AS "ATTR2", 'Kiểm tra bằng mắt'  AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'INSPECT_METHOD', 'MEASUREMENT', '계측검사',     2, 'Measurement',  '测量检查',   'Đo lường'             FROM DUAL UNION ALL
  SELECT 'INSPECT_METHOD', 'FUNCTIONAL',  '기능검사',     3, 'Functional',   '功能检查',   'Kiểm tra chức năng'   FROM DUAL UNION ALL
  SELECT 'INSPECT_METHOD', 'ELECTRICAL',  '전기검사',     4, 'Electrical',   '电气检查',   'Kiểm tra điện'        FROM DUAL UNION ALL
  SELECT 'INSPECT_METHOD', 'DESTRUCTIVE', '파괴검사',     5, 'Destructive',  '破坏检查',   'Kiểm tra phá hủy'    FROM DUAL
) s ON (t."COMPANY" = '40' AND t."PLANT_CD" = '1000' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  '40', '1000', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);

-- BOM_SIDE (BOM 사이드)
MERGE INTO "COM_CODES" t
USING (
  SELECT 'BOM_SIDE' AS "GROUP_CODE", 'N' AS "DETAIL_CODE", 'N/A'  AS "CODE_NAME", 1 AS "SORT_ORDER", 'N/A'   AS "ATTR1", 'N/A'  AS "ATTR2", 'N/A'   AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'BOM_SIDE', 'L', '좌(Left)',  2, 'Left',  '左',  'Trái' FROM DUAL UNION ALL
  SELECT 'BOM_SIDE', 'R', '우(Right)', 3, 'Right', '右',  'Phải' FROM DUAL
) s ON (t."COMPANY" = '40' AND t."PLANT_CD" = '1000' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  '40', '1000', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);

COMMIT;
