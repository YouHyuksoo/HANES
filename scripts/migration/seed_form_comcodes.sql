-- ============================================================
-- 폼 등록 패널/모달에서 텍스트 입력 → ComCode 선택 전환용 시드
-- SCRAP_REASON, INSPECT_METHOD, BOM_SIDE, SAMPLE_SIZE, SAMPLE_FREQ, CONTROL_METHOD
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

-- SAMPLE_SIZE (시료 크기)
MERGE INTO "COM_CODES" t
USING (
  SELECT 'SAMPLE_SIZE' AS "GROUP_CODE", 'N1'  AS "DETAIL_CODE", 'n=1'  AS "CODE_NAME", 1 AS "SORT_ORDER", 'n=1'  AS "ATTR1", 'n=1'  AS "ATTR2", 'n=1'  AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'SAMPLE_SIZE', 'N3',  'n=3',  2, 'n=3',  'n=3',  'n=3'  FROM DUAL UNION ALL
  SELECT 'SAMPLE_SIZE', 'N5',  'n=5',  3, 'n=5',  'n=5',  'n=5'  FROM DUAL UNION ALL
  SELECT 'SAMPLE_SIZE', 'N10', 'n=10', 4, 'n=10', 'n=10', 'n=10' FROM DUAL UNION ALL
  SELECT 'SAMPLE_SIZE', 'N30', 'n=30', 5, 'n=30', 'n=30', 'n=30' FROM DUAL UNION ALL
  SELECT 'SAMPLE_SIZE', 'ALL', '전수',  6, '100%', '全数',  'Toàn bộ' FROM DUAL
) s ON (t."COMPANY" = '40' AND t."PLANT_CD" = '1000' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  '40', '1000', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);

-- SAMPLE_FREQ (시료 빈도)
MERGE INTO "COM_CODES" t
USING (
  SELECT 'SAMPLE_FREQ' AS "GROUP_CODE", 'EVERY_LOT'  AS "DETAIL_CODE", '매 LOT'  AS "CODE_NAME", 1 AS "SORT_ORDER", 'Every Lot'  AS "ATTR1", '每批'     AS "ATTR2", 'Mỗi lô'    AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'SAMPLE_FREQ', 'HOURLY',     '시간당',   2, 'Hourly',     '每小时',   'Mỗi giờ'    FROM DUAL UNION ALL
  SELECT 'SAMPLE_FREQ', 'PER_SHIFT',  '교대당',   3, 'Per Shift',  '每班',     'Mỗi ca'     FROM DUAL UNION ALL
  SELECT 'SAMPLE_FREQ', 'DAILY',      '일일',     4, 'Daily',      '每日',     'Hàng ngày'  FROM DUAL UNION ALL
  SELECT 'SAMPLE_FREQ', 'WEEKLY',     '주간',     5, 'Weekly',     '每周',     'Hàng tuần'  FROM DUAL UNION ALL
  SELECT 'SAMPLE_FREQ', 'MONTHLY',    '월간',     6, 'Monthly',    '每月',     'Hàng tháng' FROM DUAL UNION ALL
  SELECT 'SAMPLE_FREQ', 'CONTINUOUS', '연속',     7, 'Continuous',  '连续',     'Liên tục'   FROM DUAL
) s ON (t."COMPANY" = '40' AND t."PLANT_CD" = '1000' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  '40', '1000', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);

-- CONTROL_METHOD (관리 방법)
MERGE INTO "COM_CODES" t
USING (
  SELECT 'CONTROL_METHOD' AS "GROUP_CODE", 'SPC'           AS "DETAIL_CODE", 'SPC 관리도'  AS "CODE_NAME", 1 AS "SORT_ORDER", 'SPC Chart'        AS "ATTR1", 'SPC控制图'      AS "ATTR2", 'Biểu đồ SPC'          AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'CONTROL_METHOD', 'CHECK_SHEET',  '체크시트',      2, 'Check Sheet',      '检查表',         'Phiếu kiểm tra'        FROM DUAL UNION ALL
  SELECT 'CONTROL_METHOD', 'VISUAL',       '육안검사',      3, 'Visual Inspection', '目视检查',       'Kiểm tra bằng mắt'    FROM DUAL UNION ALL
  SELECT 'CONTROL_METHOD', 'GAUGE',        '계측기록',      4, 'Gauge Record',      '量具记录',       'Ghi đo lường'          FROM DUAL UNION ALL
  SELECT 'CONTROL_METHOD', 'POKA_YOKE',    '포카요케',      5, 'Poka-Yoke',         '防错',           'Poka-Yoke'             FROM DUAL UNION ALL
  SELECT 'CONTROL_METHOD', 'FIRST_ARTICLE','초품검사',      6, 'First Article',     '首件检查',       'Kiểm tra mẫu đầu'     FROM DUAL UNION ALL
  SELECT 'CONTROL_METHOD', 'AUTO_INSPECT', '자동검사',      7, 'Auto Inspection',   '自动检查',       'Kiểm tra tự động'      FROM DUAL
) s ON (t."COMPANY" = '40' AND t."PLANT_CD" = '1000' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  '40', '1000', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);

-- VISUAL_DEFECT (외관검사 불량유형)
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
);

COMMIT;
