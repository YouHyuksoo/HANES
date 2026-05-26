BEGIN
  /*
   * 2026-05-26: IQC005 Phase A — PO 라인 상태/사용구분 공통코드 시드
   * COM_CODES (groupCode, detailCode) 복합 PK. attr1 = Tailwind 색상 클래스.
   * ComCodeBadge가 i18n `comCode.{groupCode}.{code}` 우선, 없으면 codeName 폴백.
   * 메모리 feedback_no_pastel_colors: 진한 톤 배경 + 흰 텍스트로 통일.
   */
  MERGE INTO COM_CODES c
  USING (
    -- PO_LINE_STATUS
    SELECT 'PO_LINE_STATUS' AS GROUP_CODE, 'OPEN'    AS DETAIL_CODE, '미입하' AS CODE_NAME, 'bg-blue-600 text-white' AS ATTR1, 1 AS SORT_ORDER FROM DUAL UNION ALL
    SELECT 'PO_LINE_STATUS', 'PARTIAL', '일부입하', 'bg-yellow-600 text-white', 2 FROM DUAL UNION ALL
    SELECT 'PO_LINE_STATUS', 'CLOSE',   'CLOSE',   'bg-gray-600 text-white',   3 FROM DUAL UNION ALL
    -- PO_USE_TYPE
    SELECT 'PO_USE_TYPE', 'PROD',   '양산',   'bg-sky-600 text-white',    1 FROM DUAL UNION ALL
    SELECT 'PO_USE_TYPE', 'DEV',    '개발',   'bg-amber-700 text-white',  2 FROM DUAL UNION ALL
    SELECT 'PO_USE_TYPE', 'SAMPLE', '샘플',   'bg-violet-600 text-white', 3 FROM DUAL
  ) s ON (c.GROUP_CODE = s.GROUP_CODE AND c.DETAIL_CODE = s.DETAIL_CODE)
  WHEN MATCHED THEN UPDATE SET
    CODE_NAME = s.CODE_NAME,
    ATTR1 = s.ATTR1,
    SORT_ORDER = s.SORT_ORDER,
    USE_YN = 'Y'
  WHEN NOT MATCHED THEN INSERT
    (GROUP_CODE, DETAIL_CODE, CODE_NAME, ATTR1, SORT_ORDER, USE_YN,
     COMPANY, PLANT_CD, CREATED_BY)
  VALUES
    (s.GROUP_CODE, s.DETAIL_CODE, s.CODE_NAME, s.ATTR1, s.SORT_ORDER, 'Y',
     '40', '1000', 'SYSTEM');

  COMMIT;
END;
/
