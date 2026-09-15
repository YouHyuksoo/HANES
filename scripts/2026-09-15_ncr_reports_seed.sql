-- ============================================================================
-- 부적합 보고서(NCR) 시드 데이터 — COMPANY 40 / PLANT_CD 1000 (JSHANES)
--
-- 목적: 화면(품질관리 > 부적합 보고서)의 목록·필터·통계·A4 출력을 실제 데이터로 확인.
--
-- 설계 메모:
-- 1. 번호는 하드코딩하지 않고 PKG_SEQ_GENERATOR.GET_NO('NCR_NO') 로 받는다.
--    운영 중 발행되는 번호와 절대 충돌하지 않게 하려는 것.
-- 2. 발행일은 전부 당일(SYSTIMESTAMP 기준)이다. 번호의 YYMMDD 와 발행일이 어긋나지
--    않게 하려는 것이고, 목록 기본 필터(발행일 구간 = 당일)에서 전건이 바로 보인다.
-- 3. 품목/공급업체/작업지시/입하번호는 실DB 실측값을 쓴다(가공 코드 금지).
-- 4. 상태 3종(OPEN / IN_PROGRESS / CLOSED), 대상구분 4종, 발견단계 5종, 결함구분 3종을
--    골고루 덮어 필터와 통계 카드가 전부 검증되게 배치했다.
-- 5. 정리는 CREATED_BY='ncr-seed' 한 조건으로 끝난다(하단 롤백 SQL 참고).
--
-- 실행:
--   python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py \
--     --site JSHANES --execute-file scripts/2026-09-15_ncr_reports_seed.sql
-- ============================================================================

DECLARE
  v_exists NUMBER;

  /* 공통 항목을 매번 나열하지 않기 위한 로컬 프로시저 */
  PROCEDURE ins(
    p_target_type   VARCHAR2,
    p_found_stage   VARCHAR2,
    p_source_type   VARCHAR2,
    p_source_id     VARCHAR2,
    p_item_code     VARCHAR2,
    p_lot_no        VARCHAR2,
    p_serial_no     VARCHAR2,
    p_order_no      VARCHAR2,
    p_vendor_code   VARCHAR2,
    p_inspect_qty   NUMBER,
    p_defect_qty    NUMBER,
    p_defect_code   VARCHAR2,
    p_defect_grade  VARCHAR2,
    p_description   VARCHAR2,
    p_issue_dept    VARCHAR2,
    p_due_days      NUMBER,
    p_disposition   VARCHAR2,
    p_disp_detail   VARCHAR2,
    p_resp_code     VARCHAR2,
    p_cause_cat     VARCHAR2,
    p_root_cause    VARCHAR2,
    p_prevent       VARCHAR2,
    p_status        VARCHAR2,
    p_approver      VARCHAR2,
    p_issue_hour    NUMBER  -- 당일 발행 시각(0~23). 실행 시각에 의존하지 않게 절대 지정한다.
  ) IS
    v_ncr VARCHAR2(50);
  BEGIN
    v_ncr := PKG_SEQ_GENERATOR.GET_NO('NCR_NO');

    INSERT INTO NCR_REPORTS (
      NCR_NO, COMPANY, PLANT_CD,
      ISSUED_AT, DUE_DATE, ISSUE_DEPT, WRITER_CODE, WRITTEN_AT,
      TARGET_TYPE, FOUND_STAGE, SOURCE_TYPE, SOURCE_ID,
      ITEM_CODE, LOT_NO, SERIAL_NO, ORDER_NO, VENDOR_CODE,
      INSPECT_QTY, DEFECT_QTY,
      DEFECT_CODE, DEFECT_GRADE, DESCRIPTION,
      DISPOSITION, DISPOSITION_DETAIL, DUE_ACTION_DATE, RESPONSIBLE_CODE, RESPONDED_AT,
      CAUSE_CATEGORY, ROOT_CAUSE, PREVENTIVE_ACTION,
      APPROVER_CODE, APPROVED_AT, STATUS, CLOSED_AT, CLOSED_BY,
      REMARK, CREATED_BY, UPDATED_BY
    ) VALUES (
      v_ncr, '40', '1000',
      TRUNC(SYSDATE) + NUMTODSINTERVAL(p_issue_hour, 'HOUR'),
      TRUNC(SYSDATE) + p_due_days,
      p_issue_dept, 'admin', TRUNC(SYSDATE) + NUMTODSINTERVAL(p_issue_hour, 'HOUR'),
      p_target_type, p_found_stage, p_source_type, p_source_id,
      p_item_code, p_lot_no, p_serial_no, p_order_no, p_vendor_code,
      p_inspect_qty, p_defect_qty,
      p_defect_code, p_defect_grade, p_description,
      p_disposition, p_disp_detail,
      CASE WHEN p_disposition IS NULL THEN NULL ELSE TRUNC(SYSDATE) + p_due_days + 3 END,
      p_resp_code,
      CASE WHEN p_disposition IS NULL THEN NULL
           ELSE TRUNC(SYSDATE) + NUMTODSINTERVAL(p_issue_hour + 1, 'HOUR') END,
      p_cause_cat, p_root_cause, p_prevent,
      p_approver,
      CASE WHEN p_approver IS NULL THEN NULL
           ELSE TRUNC(SYSDATE) + NUMTODSINTERVAL(p_issue_hour + 2, 'HOUR') END,
      p_status,
      CASE WHEN p_status = 'CLOSED'
           THEN TRUNC(SYSDATE) + NUMTODSINTERVAL(p_issue_hour + 2, 'HOUR') END,
      CASE WHEN p_status = 'CLOSED' THEN 'admin' END,
      '시드 데이터', 'ncr-seed', 'ncr-seed'
    );
  END ins;

BEGIN
  -- 재실행 안전장치: 이미 시드가 들어가 있으면 번호만 축내고 끝나므로 아예 넣지 않는다.
  SELECT COUNT(*) INTO v_exists FROM NCR_REPORTS WHERE CREATED_BY = 'ncr-seed';
  IF v_exists > 0 THEN
    DBMS_OUTPUT.PUT_LINE('시드 ' || v_exists || '건이 이미 존재하여 건너뜁니다.');
    RETURN;
  END IF;

  /* ── 1. 원자재 / 수입검사 / OPEN ────────────────────────────────────────
     실제 IQC 불합격 건(R26091200004, NBC3-5L_FAIL)을 출처로 연결한다.       */
  ins(
    'RAW_MATERIAL', 'IQC', 'IQC_LOG', 'R26091200004',
    'NBC3-5L_FAIL', 'LOT-260912-004', NULL, NULL, 'THN_무상사급',
    200, 12,
    'DIMENSION', 'MAJOR',
    '수입검사 시료 200EA 중 12EA 에서 단자 압착폭이 도면 공차(2.10±0.05mm) 상한을 벗어남. 최대 2.21mm 실측.',
    '품질보증팀', 3,
    NULL, NULL, NULL,
    NULL, NULL, NULL,
    'OPEN', NULL, 8
  );

  /* ── 2. 원자재 / 수입검사 / IN_PROGRESS — 반품 처리 ──────────────────── */
  ins(
    'RAW_MATERIAL', 'IQC', 'IQC_LOG', 'R26091200003',
    'HKEAN1W002FA_FAIL', 'LOT-260912-003', NULL, NULL, 'THN_무상사급',
    500, 37,
    'FOREIGN', 'MAJOR',
    '전선 피복 표면에 백색 이물질 부착. 500EA 중 37EA 확인. 세척 시 일부 제거되나 잔흔 남음.',
    '품질보증팀', 5,
    'RETURN', '전량 공급업체 반품 후 재입고. 세척 공정 개선 확인서 첨부 요구.', 'QA-LEE',
    'MACHINE', '공급업체 압출 라인 냉각수 필터 교체 주기 초과로 이물 유입.', NULL,
    'IN_PROGRESS', NULL, 9
  );

  /* ── 3. 반제품 / 공정검사 / IN_PROGRESS — 재작업 ────────────────────── */
  ins(
    'SEMI_PRODUCT', 'PROCESS', NULL, NULL,
    'MAG_EAD65942601-ABL001', 'LOT-260915-011', NULL, 'WO2609130411', NULL,
    120, 4,
    'HIGH_R', 'MAJOR',
    '서브 조립 통전검사에서 CN2 커넥터 5번 회로 접촉저항 기준(50mΩ) 초과. 4EA 실측 78~92mΩ.',
    '생산기술팀', 2,
    'REWORK', '해당 4EA 단자 재압착 후 통전 재검사. 압착 치공구 점검 병행.', 'PROD-KIM',
    'MACHINE', '압착 다이스 마모로 압착 높이가 하한에 근접, 접촉 면압 부족.', NULL,
    'IN_PROGRESS', NULL, 10
  );

  /* ── 4. 완제품 / 최종검사 / CLOSED — 폐기 ──────────────────────────── */
  ins(
    'FINISHED', 'FINAL', NULL, NULL,
    'N91H00-X9800', 'LOT-260914-002', 'SN-260914-00087', 'WO2609130410', NULL,
    80, 2,
    'SHORT', 'CRITICAL',
    '최종 통전검사에서 CN1-3번과 CN1-4번 회로 간 단락 검출. 2EA. 조립 중 피복 손상 추정.',
    '품질보증팀', 1,
    'SCRAP', '단락 2EA 폐기. 동일 로트 전수 재검사 실시(추가 불량 없음).', 'QA-LEE',
    'MAN', '조립 작업 중 타이 밴드 과체결로 피복이 눌려 도체 간 접촉 발생.',
    '타이 밴드 체결 토크 상한을 작업표준에 명기하고, 해당 공정 작업자 재교육 실시.',
    'CLOSED', 'QA-MGR', 11
  );

  /* ── 5. 완제품 / 출하검사 / CLOSED — 특채 ──────────────────────────── */
  ins(
    'FINISHED', 'OQC', NULL, NULL,
    'MAG_EAD65942601', 'LOT-260914-007', NULL, NULL, NULL,
    300, 6,
    'SCRATCH', 'MINOR',
    '출하검사 외관에서 커넥터 하우징 측면 경미한 스크래치 6EA. 기능/치수 영향 없음.',
    '품질보증팀', 2,
    'CONCESSION', '고객 승인 하 특채 출하. 기능 영향 없음을 시험성적서로 입증.', 'QA-LEE',
    'METHOD', '완제품 적재 시 간지 미삽입으로 하우징끼리 접촉.',
    '완제품 적재 표준에 간지 삽입을 필수 항목으로 추가.',
    'CLOSED', 'QA-MGR', 13
  );

  /* ── 6. 재공품 / 고객클레임 / OPEN ─────────────────────────────────── */
  ins(
    'WIP', 'CUSTOMER', NULL, NULL,
    'N91H00-X9800-C2', 'LOT-260913-005', 'SN-260913-00412', 'WO2609130411', NULL,
    1, 1,
    'MISWIRE', 'CRITICAL',
    '고객 라인 장착 중 오결선 클레임 접수. CN3 커넥터 2번/6번 회로가 서로 뒤바뀜. 1EA.',
    '품질보증팀', 1,
    NULL, NULL, NULL,
    NULL, NULL, NULL,
    'OPEN', NULL, 14
  );

  COMMIT;
END;
/

-- ── 확인 ────────────────────────────────────────────────────────────────
SELECT NCR_NO, TARGET_TYPE, FOUND_STAGE, ITEM_CODE, DEFECT_GRADE,
       DISPOSITION, STATUS, TO_CHAR(ISSUED_AT, 'YYYY-MM-DD HH24:MI') ISSUED
FROM NCR_REPORTS
WHERE CREATED_BY = 'ncr-seed'
ORDER BY NCR_NO
/

-- ── 롤백(필요 시) ───────────────────────────────────────────────────────
-- DELETE FROM NCR_REPORTS WHERE CREATED_BY = 'ncr-seed';
-- COMMIT;
