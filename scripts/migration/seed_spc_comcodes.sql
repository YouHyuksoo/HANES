-- SPC 공통코드 시드
-- SPC_CHART_TYPE: SPC 관리도 유형
-- SPC_STATUS: SPC 관리도 상태

MERGE INTO "COM_CODES" t
USING (
  -- SPC_CHART_TYPE (관리도 유형)
  SELECT 'SPC_CHART_TYPE' AS "GROUP_CODE", 'XBAR_R' AS "DETAIL_CODE", 'Xbar-R 관리도' AS "CODE_NAME",
         1 AS "SORT_ORDER", 'Xbar-R Chart' AS "ATTR1", 'Xbar-R 管理图' AS "ATTR2", 'Biểu đồ Xbar-R' AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'SPC_CHART_TYPE', 'XBAR_S', 'Xbar-S 관리도', 2, 'Xbar-S Chart', 'Xbar-S 管理图', 'Biểu đồ Xbar-S' FROM DUAL UNION ALL
  SELECT 'SPC_CHART_TYPE', 'P', 'P 관리도', 3, 'P Chart', 'P 管理图', 'Biểu đồ P' FROM DUAL UNION ALL
  SELECT 'SPC_CHART_TYPE', 'NP', 'NP 관리도', 4, 'NP Chart', 'NP 管理图', 'Biểu đồ NP' FROM DUAL UNION ALL
  SELECT 'SPC_CHART_TYPE', 'C', 'C 관리도', 5, 'C Chart', 'C 管理图', 'Biểu đồ C' FROM DUAL UNION ALL
  SELECT 'SPC_CHART_TYPE', 'U', 'U 관리도', 6, 'U Chart', 'U 管理图', 'Biểu đồ U' FROM DUAL UNION ALL

  -- SPC_STATUS (관리도 상태)
  SELECT 'SPC_STATUS', 'ACTIVE', '활성', 1, 'Active', '活跃', 'Hoạt động' FROM DUAL UNION ALL
  SELECT 'SPC_STATUS', 'INACTIVE', '비활성', 2, 'Inactive', '非活跃', 'Không hoạt động' FROM DUAL

) s ON (t."COMPANY" = '40' AND t."PLANT_CD" = '1000' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  '40', '1000', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);
