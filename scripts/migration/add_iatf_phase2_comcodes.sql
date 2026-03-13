-- ============================================================
-- IATF 16949 Phase 2+3 ComCode 시드 데이터
-- 대상: SPC, 계측기, 교정, 관리계획서, PPAP, 교육, 문서, 심사, 금형
-- COM_CODES 단일 테이블 (COM_CODE_GROUPS 없음)
-- COMPANY='HANES', PLANT_CD='VINA', CREATED_BY='SYSTEM'
-- ATTR1=영문명, ATTR2=중문명, ATTR3=베트남어명
-- ============================================================

-- 1. SPC_CHART_TYPE (SPC 관리도 유형)
MERGE INTO "COM_CODES" t
USING (
  SELECT 'SPC_CHART_TYPE' AS "GROUP_CODE", 'XBAR_R' AS "DETAIL_CODE", 'X바-R 관리도'  AS "CODE_NAME", 1 AS "SORT_ORDER", 'X-bar R Chart'    AS "ATTR1", 'X均值-R控制图'  AS "ATTR2", 'Biểu đồ X-bar R' AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'SPC_CHART_TYPE', 'XBAR_S', 'X바-S 관리도',  2, 'X-bar S Chart',    'X均值-S控制图',  'Biểu đồ X-bar S' FROM DUAL UNION ALL
  SELECT 'SPC_CHART_TYPE', 'P',      'P 관리도',       3, 'P Chart',          'P控制图',        'Biểu đồ P'       FROM DUAL UNION ALL
  SELECT 'SPC_CHART_TYPE', 'NP',     'NP 관리도',      4, 'NP Chart',         'NP控制图',       'Biểu đồ NP'      FROM DUAL UNION ALL
  SELECT 'SPC_CHART_TYPE', 'C',      'C 관리도',       5, 'C Chart',          'C控制图',        'Biểu đồ C'       FROM DUAL UNION ALL
  SELECT 'SPC_CHART_TYPE', 'U',      'U 관리도',       6, 'U Chart',          'U控制图',        'Biểu đồ U'       FROM DUAL
) s ON (t."COMPANY" = 'HANES' AND t."PLANT_CD" = 'VINA' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "ID", "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  SYS_GUID(), 'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);

-- 2. SPC_STATUS (SPC 상태)
MERGE INTO "COM_CODES" t
USING (
  SELECT 'SPC_STATUS' AS "GROUP_CODE", 'ACTIVE'   AS "DETAIL_CODE", '활성'   AS "CODE_NAME", 1 AS "SORT_ORDER", 'Active'   AS "ATTR1", '活跃'   AS "ATTR2", 'Hoạt động'       AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'SPC_STATUS', 'INACTIVE', '비활성', 2, 'Inactive', '非活跃', 'Không hoạt động' FROM DUAL
) s ON (t."COMPANY" = 'HANES' AND t."PLANT_CD" = 'VINA' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "ID", "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  SYS_GUID(), 'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);

-- 3. GAUGE_TYPE (계측기 유형)
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
  "ID", "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  SYS_GUID(), 'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);

-- 4. GAUGE_STATUS (계측기 상태)
MERGE INTO "COM_CODES" t
USING (
  SELECT 'GAUGE_STATUS' AS "GROUP_CODE", 'ACTIVE'   AS "DETAIL_CODE", '사용중'   AS "CODE_NAME", 1 AS "SORT_ORDER", 'Active'   AS "ATTR1", '使用中' AS "ATTR2", 'Đang sử dụng' AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'GAUGE_STATUS', 'EXPIRED',  '교정만료', 2, 'Expired',  '已过期', 'Đã hết hạn'   FROM DUAL UNION ALL
  SELECT 'GAUGE_STATUS', 'SCRAPPED', '폐기',     3, 'Scrapped', '报废',   'Đã bỏ'        FROM DUAL
) s ON (t."COMPANY" = 'HANES' AND t."PLANT_CD" = 'VINA' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "ID", "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  SYS_GUID(), 'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);

-- 5. CAL_TYPE (교정 유형)
MERGE INTO "COM_CODES" t
USING (
  SELECT 'CAL_TYPE' AS "GROUP_CODE", 'INTERNAL' AS "DETAIL_CODE", '자체교정' AS "CODE_NAME", 1 AS "SORT_ORDER", 'Internal' AS "ATTR1", '内部校准' AS "ATTR2", 'Nội bộ'    AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'CAL_TYPE', 'EXTERNAL', '외부교정', 2, 'External', '外部校准', 'Bên ngoài' FROM DUAL
) s ON (t."COMPANY" = 'HANES' AND t."PLANT_CD" = 'VINA' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "ID", "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  SYS_GUID(), 'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);

-- 6. CAL_RESULT (교정 결과)
MERGE INTO "COM_CODES" t
USING (
  SELECT 'CAL_RESULT' AS "GROUP_CODE", 'PASS'        AS "DETAIL_CODE", '합격'       AS "CODE_NAME", 1 AS "SORT_ORDER", 'Pass'        AS "ATTR1", '合格'       AS "ATTR2", 'Đạt'          AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'CAL_RESULT', 'FAIL',        '불합격',     2, 'Fail',        '不合格',     'Không đạt'    FROM DUAL UNION ALL
  SELECT 'CAL_RESULT', 'CONDITIONAL', '조건부합격', 3, 'Conditional', '有条件合格', 'Có điều kiện' FROM DUAL
) s ON (t."COMPANY" = 'HANES' AND t."PLANT_CD" = 'VINA' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "ID", "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  SYS_GUID(), 'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);

-- 7. CP_PHASE (관리계획서 단계)
MERGE INTO "COM_CODES" t
USING (
  SELECT 'CP_PHASE' AS "GROUP_CODE", 'PROTOTYPE'  AS "DETAIL_CODE", '시작품'   AS "CODE_NAME", 1 AS "SORT_ORDER", 'Prototype'  AS "ATTR1", '样件'   AS "ATTR2", 'Nguyên mẫu'     AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'CP_PHASE', 'PRE_LAUNCH', '양산시작', 2, 'Pre-Launch', '试生产', 'Tiền sản xuất' FROM DUAL UNION ALL
  SELECT 'CP_PHASE', 'PRODUCTION', '양산',     3, 'Production', '量产',   'Sản xuất'      FROM DUAL
) s ON (t."COMPANY" = 'HANES' AND t."PLANT_CD" = 'VINA' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "ID", "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  SYS_GUID(), 'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);

-- 8. CP_STATUS (관리계획서 상태)
MERGE INTO "COM_CODES" t
USING (
  SELECT 'CP_STATUS' AS "GROUP_CODE", 'DRAFT'    AS "DETAIL_CODE", '작성중' AS "CODE_NAME", 1 AS "SORT_ORDER", 'Draft'    AS "ATTR1", '草稿'   AS "ATTR2", 'Bản nháp'      AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'CP_STATUS', 'REVIEW',   '검토중', 2, 'Review',   '审核中', 'Đang xem xét' FROM DUAL UNION ALL
  SELECT 'CP_STATUS', 'APPROVED', '승인됨', 3, 'Approved', '已批准', 'Đã phê duyệt' FROM DUAL UNION ALL
  SELECT 'CP_STATUS', 'OBSOLETE', '폐기',   4, 'Obsolete', '已废弃', 'Lỗi thời'     FROM DUAL
) s ON (t."COMPANY" = 'HANES' AND t."PLANT_CD" = 'VINA' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "ID", "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  SYS_GUID(), 'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);

-- 9. PPAP_REASON (PPAP 사유)
MERGE INTO "COM_CODES" t
USING (
  SELECT 'PPAP_REASON' AS "GROUP_CODE", 'NEW_PART'   AS "DETAIL_CODE", '신규부품' AS "CODE_NAME", 1 AS "SORT_ORDER", 'New Part'       AS "ATTR1", '新零件'   AS "ATTR2", 'Phần mới'          AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'PPAP_REASON', 'ECN',        '설계변경', 2, 'ECN',            '设计变更', 'Thay đổi thiết kế' FROM DUAL UNION ALL
  SELECT 'PPAP_REASON', 'TOOLING',    '금형변경', 3, 'Tooling Change', '模具变更', 'Thay đổi khuôn'    FROM DUAL UNION ALL
  SELECT 'PPAP_REASON', 'CORRECTION', '시정조치', 4, 'Correction',     '纠正措施', 'Khắc phục'         FROM DUAL UNION ALL
  SELECT 'PPAP_REASON', 'OTHER',      '기타',     5, 'Other',          '其他',     'Khác'              FROM DUAL
) s ON (t."COMPANY" = 'HANES' AND t."PLANT_CD" = 'VINA' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "ID", "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  SYS_GUID(), 'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);

-- 10. PPAP_STATUS (PPAP 상태)
MERGE INTO "COM_CODES" t
USING (
  SELECT 'PPAP_STATUS' AS "GROUP_CODE", 'DRAFT'     AS "DETAIL_CODE", '작성중'   AS "CODE_NAME", 1 AS "SORT_ORDER", 'Draft'     AS "ATTR1", '草稿'     AS "ATTR2", 'Bản nháp' AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'PPAP_STATUS', 'SUBMITTED', '제출됨',   2, 'Submitted', '已提交',   'Đã nộp'   FROM DUAL UNION ALL
  SELECT 'PPAP_STATUS', 'APPROVED',  '승인',     3, 'Approved',  '已批准',   'Đã duyệt' FROM DUAL UNION ALL
  SELECT 'PPAP_STATUS', 'REJECTED',  '반려',     4, 'Rejected',  '已拒绝',   'Bị từ chối' FROM DUAL UNION ALL
  SELECT 'PPAP_STATUS', 'INTERIM',   '잠정승인', 5, 'Interim',   '暂时批准', 'Tạm duyệt'  FROM DUAL
) s ON (t."COMPANY" = 'HANES' AND t."PLANT_CD" = 'VINA' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "ID", "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  SYS_GUID(), 'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);

-- 11. TRAINING_TYPE (교육 유형)
MERGE INTO "COM_CODES" t
USING (
  SELECT 'TRAINING_TYPE' AS "GROUP_CODE", 'OJT'       AS "DETAIL_CODE", '현장교육'   AS "CODE_NAME", 1 AS "SORT_ORDER", 'OJT'       AS "ATTR1", '在职培训' AS "ATTR2", 'Đào tạo tại chỗ' AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'TRAINING_TYPE', 'CLASSROOM', '집합교육',   2, 'Classroom', '课堂培训', 'Lớp học'          FROM DUAL UNION ALL
  SELECT 'TRAINING_TYPE', 'ONLINE',    '온라인교육', 3, 'Online',    '在线培训', 'Trực tuyến'       FROM DUAL UNION ALL
  SELECT 'TRAINING_TYPE', 'EXTERNAL',  '외부교육',   4, 'External',  '外部培训', 'Bên ngoài'        FROM DUAL UNION ALL
  SELECT 'TRAINING_TYPE', 'SAFETY',    '안전교육',   5, 'Safety',    '安全培训', 'An toàn'          FROM DUAL
) s ON (t."COMPANY" = 'HANES' AND t."PLANT_CD" = 'VINA' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "ID", "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  SYS_GUID(), 'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);

-- 12. TRAINING_STATUS (교육 상태)
MERGE INTO "COM_CODES" t
USING (
  SELECT 'TRAINING_STATUS' AS "GROUP_CODE", 'PLANNED'     AS "DETAIL_CODE", '예정'   AS "CODE_NAME", 1 AS "SORT_ORDER", 'Planned'     AS "ATTR1", '已计划' AS "ATTR2", 'Đã lên kế hoạch' AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'TRAINING_STATUS', 'IN_PROGRESS', '진행중', 2, 'In Progress', '进行中', 'Đang tiến hành'   FROM DUAL UNION ALL
  SELECT 'TRAINING_STATUS', 'COMPLETED',   '완료',   3, 'Completed',   '已完成', 'Hoàn thành'       FROM DUAL UNION ALL
  SELECT 'TRAINING_STATUS', 'CANCELLED',   '취소',   4, 'Cancelled',   '已取消', 'Đã hủy'           FROM DUAL
) s ON (t."COMPANY" = 'HANES' AND t."PLANT_CD" = 'VINA' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "ID", "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  SYS_GUID(), 'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);

-- 13. DOC_TYPE (문서 유형)
MERGE INTO "COM_CODES" t
USING (
  SELECT 'DOC_TYPE' AS "GROUP_CODE", 'PROCEDURE' AS "DETAIL_CODE", '절차서'     AS "CODE_NAME", 1 AS "SORT_ORDER", 'Procedure'        AS "ATTR1", '程序文件'   AS "ATTR2", 'Quy trình'           AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'DOC_TYPE', 'WI',       '작업표준서', 2, 'Work Instruction', '作业指导书', 'Hướng dẫn công việc' FROM DUAL UNION ALL
  SELECT 'DOC_TYPE', 'FORM',     '양식',       3, 'Form',             '表单',       'Biểu mẫu'           FROM DUAL UNION ALL
  SELECT 'DOC_TYPE', 'SPEC',     '규격서',     4, 'Specification',    '规格书',     'Quy cách'            FROM DUAL UNION ALL
  SELECT 'DOC_TYPE', 'DRAWING',  '도면',       5, 'Drawing',          '图纸',       'Bản vẽ'              FROM DUAL UNION ALL
  SELECT 'DOC_TYPE', 'MANUAL',   '매뉴얼',     6, 'Manual',           '手册',       'Sổ tay'              FROM DUAL
) s ON (t."COMPANY" = 'HANES' AND t."PLANT_CD" = 'VINA' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "ID", "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  SYS_GUID(), 'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);

-- 14. DOC_STATUS (문서 상태)
MERGE INTO "COM_CODES" t
USING (
  SELECT 'DOC_STATUS' AS "GROUP_CODE", 'DRAFT'    AS "DETAIL_CODE", '작성중' AS "CODE_NAME", 1 AS "SORT_ORDER", 'Draft'    AS "ATTR1", '草稿'   AS "ATTR2", 'Bản nháp'      AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'DOC_STATUS', 'REVIEW',   '검토중', 2, 'Review',   '审核中', 'Đang xem xét' FROM DUAL UNION ALL
  SELECT 'DOC_STATUS', 'APPROVED', '승인됨', 3, 'Approved', '已批准', 'Đã phê duyệt' FROM DUAL UNION ALL
  SELECT 'DOC_STATUS', 'OBSOLETE', '폐기',   4, 'Obsolete', '已废弃', 'Lỗi thời'     FROM DUAL
) s ON (t."COMPANY" = 'HANES' AND t."PLANT_CD" = 'VINA' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "ID", "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  SYS_GUID(), 'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);

-- 15. AUDIT_TYPE (심사 유형)
MERGE INTO "COM_CODES" t
USING (
  SELECT 'AUDIT_TYPE' AS "GROUP_CODE", 'SYSTEM'  AS "DETAIL_CODE", '시스템심사'   AS "CODE_NAME", 1 AS "SORT_ORDER", 'System Audit'  AS "ATTR1", '体系审核' AS "ATTR2", 'Đánh giá hệ thống'  AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'AUDIT_TYPE', 'PROCESS', '공정심사',     2, 'Process Audit', '过程审核', 'Đánh giá quy trình' FROM DUAL UNION ALL
  SELECT 'AUDIT_TYPE', 'PRODUCT', '제품심사',     3, 'Product Audit', '产品审核', 'Đánh giá sản phẩm'  FROM DUAL UNION ALL
  SELECT 'AUDIT_TYPE', 'LAYERED', '계층별심사',   4, 'Layered Audit', '分层审核', 'Đánh giá phân tầng' FROM DUAL
) s ON (t."COMPANY" = 'HANES' AND t."PLANT_CD" = 'VINA' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "ID", "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  SYS_GUID(), 'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);

-- 16. AUDIT_STATUS (심사 상태)
MERGE INTO "COM_CODES" t
USING (
  SELECT 'AUDIT_STATUS' AS "GROUP_CODE", 'PLANNED'     AS "DETAIL_CODE", '예정'   AS "CODE_NAME", 1 AS "SORT_ORDER", 'Planned'     AS "ATTR1", '已计划' AS "ATTR2", 'Đã lên kế hoạch' AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'AUDIT_STATUS', 'IN_PROGRESS', '진행중', 2, 'In Progress', '进行中', 'Đang tiến hành'   FROM DUAL UNION ALL
  SELECT 'AUDIT_STATUS', 'COMPLETED',   '완료',   3, 'Completed',   '已完成', 'Hoàn thành'       FROM DUAL UNION ALL
  SELECT 'AUDIT_STATUS', 'CLOSED',      '마감',   4, 'Closed',      '已关闭', 'Đã đóng'          FROM DUAL
) s ON (t."COMPANY" = 'HANES' AND t."PLANT_CD" = 'VINA' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "ID", "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  SYS_GUID(), 'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);

-- 17. AUDIT_RESULT (심사 결과)
MERGE INTO "COM_CODES" t
USING (
  SELECT 'AUDIT_RESULT' AS "GROUP_CODE", 'CONFORMING' AS "DETAIL_CODE", '적합'         AS "CODE_NAME", 1 AS "SORT_ORDER", 'Conforming' AS "ATTR1", '符合'       AS "ATTR2", 'Phù hợp'    AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'AUDIT_RESULT', 'MINOR_NC',  '경부적합',     2, 'Minor NC',  '轻微不符合', 'NC nhỏ'     FROM DUAL UNION ALL
  SELECT 'AUDIT_RESULT', 'MAJOR_NC',  '중부적합',     3, 'Major NC',  '严重不符合', 'NC lớn'     FROM DUAL UNION ALL
  SELECT 'AUDIT_RESULT', 'CRITICAL',  '치명적부적합', 4, 'Critical',  '致命不符合', 'Nghiêm trọng' FROM DUAL
) s ON (t."COMPANY" = 'HANES' AND t."PLANT_CD" = 'VINA' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "ID", "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  SYS_GUID(), 'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);

-- 18. FINDING_CAT (발견사항 분류)
MERGE INTO "COM_CODES" t
USING (
  SELECT 'FINDING_CAT' AS "GROUP_CODE", 'NC_MAJOR'    AS "DETAIL_CODE", '중부적합' AS "CODE_NAME", 1 AS "SORT_ORDER", 'Major NC'    AS "ATTR1", '严重不符合' AS "ATTR2", 'NC lớn'         AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'FINDING_CAT', 'NC_MINOR',    '경부적합', 2, 'Minor NC',    '轻微不符合', 'NC nhỏ'         FROM DUAL UNION ALL
  SELECT 'FINDING_CAT', 'OBSERVATION', '관찰사항', 3, 'Observation', '观察项',     'Quan sát'       FROM DUAL UNION ALL
  SELECT 'FINDING_CAT', 'OFI',         '개선기회', 4, 'OFI',         '改进机会',   'Cơ hội cải tiến' FROM DUAL
) s ON (t."COMPANY" = 'HANES' AND t."PLANT_CD" = 'VINA' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "ID", "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  SYS_GUID(), 'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);

-- 19. MOLD_TYPE (금형 유형)
MERGE INTO "COM_CODES" t
USING (
  SELECT 'MOLD_TYPE' AS "GROUP_CODE", 'INJECTION' AS "DETAIL_CODE", '사출금형'     AS "CODE_NAME", 1 AS "SORT_ORDER", 'Injection Mold' AS "ATTR1", '注塑模' AS "ATTR2", 'Khuôn ép'  AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'MOLD_TYPE', 'PRESS',    '프레스금형',   2, 'Press Die',     '冲压模', 'Khuôn dập' FROM DUAL UNION ALL
  SELECT 'MOLD_TYPE', 'CRIMPING', '크림핑금형',   3, 'Crimping Die',  '压接模', 'Khuôn bấm' FROM DUAL UNION ALL
  SELECT 'MOLD_TYPE', 'OTHER',    '기타',         4, 'Other',         '其他',   'Khác'      FROM DUAL
) s ON (t."COMPANY" = 'HANES' AND t."PLANT_CD" = 'VINA' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "ID", "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  SYS_GUID(), 'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);

-- 20. MOLD_STATUS (금형 상태)
MERGE INTO "COM_CODES" t
USING (
  SELECT 'MOLD_STATUS' AS "GROUP_CODE", 'ACTIVE'      AS "DETAIL_CODE", '사용중' AS "CODE_NAME", 1 AS "SORT_ORDER", 'Active'            AS "ATTR1", '使用中' AS "ATTR2", 'Đang sử dụng'    AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'MOLD_STATUS', 'MAINTENANCE', '보전중', 2, 'Under Maintenance', '维修中', 'Đang bảo trì'     FROM DUAL UNION ALL
  SELECT 'MOLD_STATUS', 'RETIRED',     '퇴역',   3, 'Retired',           '退役',   'Ngừng sử dụng'   FROM DUAL UNION ALL
  SELECT 'MOLD_STATUS', 'SCRAPPED',    '폐기',   4, 'Scrapped',          '报废',   'Đã bỏ'           FROM DUAL
) s ON (t."COMPANY" = 'HANES' AND t."PLANT_CD" = 'VINA' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "ID", "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  SYS_GUID(), 'HANES', 'VINA', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);

COMMIT;
