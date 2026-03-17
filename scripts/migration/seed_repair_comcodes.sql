-- 수리관리 공통코드 시드
-- REPAIR_RESULT: 수리결과
-- DEFECT_GENUINE: 진성/가성
-- DEFECT_TYPE: 불량유형
-- DEFECT_CAUSE: 불량원인
-- DEFECT_POSITION: 불량위치
-- REPAIR_DISPOSITION: 수리후재처리

MERGE INTO "COM_CODES" t
USING (
  -- REPAIR_RESULT (수리결과)
  SELECT 'REPAIR_RESULT' AS "GROUP_CODE", 'COMPLETED' AS "DETAIL_CODE", '수리완료' AS "CODE_NAME",
         1 AS "SORT_ORDER", 'Repair Completed' AS "ATTR1", '修理完成' AS "ATTR2", 'Sửa chữa hoàn tất' AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'REPAIR_RESULT', 'IMPOSSIBLE', '수리불가', 2, 'Irreparable', '无法修理', 'Không thể sửa' FROM DUAL UNION ALL
  SELECT 'REPAIR_RESULT', 'IN_PROGRESS', '수리중', 3, 'In Progress', '修理中', 'Đang sửa chữa' FROM DUAL UNION ALL

  -- DEFECT_GENUINE (진성/가성)
  SELECT 'DEFECT_GENUINE', 'GENUINE', '진성', 1, 'Genuine', '真性', 'Thật' FROM DUAL UNION ALL
  SELECT 'DEFECT_GENUINE', 'FALSE', '가성', 2, 'False', '假性', 'Giả' FROM DUAL UNION ALL

  -- DEFECT_TYPE (불량유형)
  SELECT 'DEFECT_TYPE', 'MATERIAL', '원자재불량', 1, 'Material Defect', '原材料不良', 'Lỗi nguyên liệu' FROM DUAL UNION ALL
  SELECT 'DEFECT_TYPE', 'WORK', '작업불량', 2, 'Work Defect', '作业不良', 'Lỗi tác nghiệp' FROM DUAL UNION ALL

  -- DEFECT_CAUSE (불량원인)
  SELECT 'DEFECT_CAUSE', 'ETC', '기타', 99, 'Others', '其他', 'Khác' FROM DUAL UNION ALL

  -- DEFECT_POSITION (불량위치)
  SELECT 'DEFECT_POSITION', 'ETC', '기타', 99, 'Others', '其他', 'Khác' FROM DUAL UNION ALL

  -- REPAIR_DISPOSITION (수리후재처리)
  SELECT 'REPAIR_DISPOSITION', 'SCRAP', '폐기', 1, 'Scrap', '报废', 'Phế liệu' FROM DUAL UNION ALL
  SELECT 'REPAIR_DISPOSITION', 'REUSE', '재사용', 2, 'Reuse', '再使用', 'Tái sử dụng' FROM DUAL UNION ALL
  SELECT 'REPAIR_DISPOSITION', 'REINSPECT', '재검후재사용', 3, 'Re-inspect & Reuse', '复检后再使用', 'Tái kiểm tra và sử dụng' FROM DUAL UNION ALL
  SELECT 'REPAIR_DISPOSITION', 'PENDING', '판정대기', 4, 'Pending Decision', '判定待定', 'Chờ phán định' FROM DUAL

) s ON (t."COMPANY" = '40' AND t."PLANT_CD" = '1000' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  '40', '1000', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);
