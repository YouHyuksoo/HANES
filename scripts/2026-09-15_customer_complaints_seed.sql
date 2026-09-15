-- ============================================================================
-- 고객클레임 시드 데이터 — COMPANY 40 / PLANT_CD 1000 (JSHANES)
--
-- 목적: 품질관리 > 고객클레임 화면의 목록·필터·통계·8D 진행 단계를 실제 데이터로 확인.
--
-- 설계 메모:
-- 1. 번호는 하드코딩하지 않고 PKG_SEQ_GENERATOR.GET_NO('COMPLAINT_NO') 로 받는다
--    (규칙: CC-YYYYMMDD-NNN). 운영 중 접수되는 번호와 충돌하지 않게 하려는 것.
-- 2. 접수일은 실제처럼 흩어 놓되, **미해결 2건만 당일**로 둔다.
--    목록 기본 필터가 당일이라(프로젝트 규칙) 화면을 열면 지금 조치가 필요한 건이 먼저 보이고,
--    종결된 과거 건은 기간을 넓히면 나온다. 종결 건까지 당일로 몰면 데이터가 거짓말이 된다.
-- 3. 고객사·품목은 실DB 실측값을 쓴다(THN_고객사 / KS_CUSTOM01, 완제품 3종).
-- 4. 상태 5종(RECEIVED/INVESTIGATING/RESPONDING/RESOLVED/CLOSED),
--    유형 3종(QUALITY/DELIVERY/DAMAGE), 긴급도 4종을 골고루 덮는다.
-- 5. 8D 단계별로 채워지는 칸이 다르다 — 접수 단계는 조사/원인이 비어 있고,
--    종결 건은 봉쇄·시정·예방까지 차 있다. 화면에서 단계 진행이 눈에 보이게 하려는 것.
-- 6. 정리는 CREATED_BY='cc-seed' 한 조건으로 끝난다(하단 롤백 SQL 참고).
--
-- 실행:
--   python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py \
--     --site JSHANES --execute-file scripts/2026-09-15_customer_complaints_seed.sql
-- ============================================================================

DECLARE
  v_exists NUMBER;

  /* 공통 항목을 매번 나열하지 않기 위한 로컬 프로시저 */
  PROCEDURE ins(
    p_customer_code  VARCHAR2,
    p_customer_name  VARCHAR2,
    p_days_ago       NUMBER,     -- 접수일 = 오늘 - p_days_ago
    p_item_code      VARCHAR2,
    p_lot_no         VARCHAR2,
    p_defect_qty     NUMBER,
    p_type           VARCHAR2,
    p_urgency        VARCHAR2,
    p_status         VARCHAR2,
    p_description    VARCHAR2,
    p_investigation  VARCHAR2,
    p_root_cause     VARCHAR2,
    p_containment    VARCHAR2,
    p_corrective     VARCHAR2,
    p_preventive     VARCHAR2,
    p_response_days  NUMBER,     -- 회신일 = 접수일 + n (NULL 이면 미회신)
    p_responsible    VARCHAR2,
    p_cost           NUMBER
  ) IS
    v_no   VARCHAR2(50);
    v_date DATE := TRUNC(SYSDATE) - p_days_ago;
  BEGIN
    v_no := PKG_SEQ_GENERATOR.GET_NO('COMPLAINT_NO');

    INSERT INTO CUSTOMER_COMPLAINTS (
      COMPLAINT_NO, CUSTOMER_CODE, CUSTOMER_NAME, COMPLAINT_DATE,
      ITEM_CODE, LOT_NO, DEFECT_QTY, COMPLAINT_TYPE, DESCRIPTION,
      URGENCY, STATUS, INVESTIGATION, ROOT_CAUSE,
      CONTAINMENT_ACTION, CORRECTIVE_ACTION, PREVENTIVE_ACTION,
      RESPONSE_DATE, RESPONSIBLE_CODE, COST_AMOUNT, RESOLVED_AT,
      COMPANY, PLANT_CD, CREATED_BY, UPDATED_BY
    ) VALUES (
      v_no, p_customer_code, p_customer_name, v_date,
      p_item_code, p_lot_no, p_defect_qty, p_type, p_description,
      p_urgency, p_status, p_investigation, p_root_cause,
      p_containment, p_corrective, p_preventive,
      CASE WHEN p_response_days IS NULL THEN NULL ELSE v_date + p_response_days END,
      p_responsible, p_cost,
      CASE WHEN p_status IN ('RESOLVED', 'CLOSED')
           THEN CAST(v_date + NVL(p_response_days, 0) AS TIMESTAMP) + INTERVAL '14' HOUR END,
      '40', '1000', 'cc-seed', 'cc-seed'
    );
  END ins;

BEGIN
  -- 재실행 안전장치: 이미 들어가 있으면 번호만 축내므로 아예 넣지 않는다
  SELECT COUNT(*) INTO v_exists FROM CUSTOMER_COMPLAINTS WHERE CREATED_BY = 'cc-seed';
  IF v_exists > 0 THEN
    DBMS_OUTPUT.PUT_LINE('시드 ' || v_exists || '건이 이미 존재하여 건너뜁니다.');
    RETURN;
  END IF;

  /* ── 1. 당일 / 접수 / 긴급 — 아직 아무것도 조사 안 된 상태 ──────────────
     NCR 시드의 재공품 오결선 클레임(NCR-260915-008)과 같은 사건을 고객 쪽에서 본 기록. */
  ins(
    'THN_고객사', 'THN_고객사', 0,
    'N91H00-X9800-C2', 'LOT-260913-005', 1,
    'QUALITY', 'CRITICAL', 'RECEIVED',
    '고객 조립 라인에서 오결선 발견. CN3 커넥터 2번/6번 회로가 서로 바뀌어 장착 중 도통 검사 실패. 라인 일시 정지.',
    NULL, NULL, NULL, NULL, NULL,
    NULL, 'QA-LEE', NULL
  );

  /* ── 2. 당일 / 조사중 / 높음 — 조사는 시작했고 원인은 아직 ────────────── */
  ins(
    'THN_고객사', 'THN_고객사', 0,
    'N91H00-X9800', 'LOT-260914-002', 3,
    'QUALITY', 'HIGH', 'INVESTIGATING',
    '납품 완제품 중 3EA 에서 커넥터 락(lock) 미체결. 고객 검사 공정에서 적발.',
    '동일 로트 잔량 전수 확인 중. 사내 최종검사 기록과 작업자 이력 대조 진행.',
    NULL,
    '고객 보유 재고 전량 선별 요청, 사내 동일 로트 출하 보류.',
    NULL, NULL,
    NULL, 'QA-LEE', NULL
  );

  /* ── 3. 6일 전 / 대응중 / 보통 — 원인까지 나오고 대책 회신 준비 ────────── */
  ins(
    'THN_고객사', 'THN_고객사', 6,
    'MAG_EAD65942601', 'LOT-260907-011', 12,
    'QUALITY', 'MEDIUM', 'RESPONDING',
    '하네스 외피 테이핑 들뜸 12EA. 조립 시 간섭은 없으나 외관 불만.',
    '테이핑 공정 작업 표준과 실제 작업 영상 비교. 테이프 장력 설정값이 표준(12N)보다 낮은 8N 으로 운용되고 있었음.',
    '테이핑 장비 장력 설정이 이전 모델 값으로 남아 있었고, 모델 교체 시 확인 항목에 빠져 있었다.',
    '고객 보유분 전량 재테이핑 지원, 사내 재고 선별 완료.',
    '테이핑 장력을 표준값으로 재설정하고 초·중·종물 확인 항목에 추가.',
    NULL,
    3, 'PROD-KIM', 180000
  );

  /* ── 4. 12일 전 / 해결 / 높음 — 납기 클레임 ───────────────────────────── */
  ins(
    'KS_CUSTOM01', 'KS_고객사01', 12,
    'N91H00-X9800', NULL, 0,
    'DELIVERY', 'HIGH', 'RESOLVED',
    '주간 확정 오더 대비 200EA 납품 지연(2일). 고객 라인 가동 계획에 영향.',
    '원자재(NBC3-5L) 수입검사 불합격으로 투입이 밀린 것이 직접 원인. 대체 로트 확보에 2일 소요.',
    '단일 공급처 의존 + 안전재고 미설정으로 IQC 불합격 1건이 곧바로 납기 지연이 되는 구조.',
    '긴급 항공 분납으로 부족분 우선 납품.',
    '해당 품목 안전재고를 2일분으로 설정.',
    '단일 공급처 품목을 전수 조사해 안전재고 기준을 재산정한다.',
    2, 'QA-LEE', 450000
  );

  /* ── 5. 20일 전 / 종결 / 긴급 — 8D 전 단계가 채워진 대표 사례 ─────────── */
  ins(
    'THN_고객사', 'THN_고객사', 20,
    'MAG_EAD65942601', 'LOT-260826-003', 5,
    'QUALITY', 'CRITICAL', 'CLOSED',
    '고객 최종 검사에서 단락 5EA 검출. 필드 유출 우려로 전량 선별 요구.',
    '반품품 5EA 해체 분석. 전량 동일 위치(타이 밴드 체결부) 피복 눌림 확인. 동일 작업조 생산분에 집중.',
    '타이 밴드 체결 토크 상한이 작업표준에 없어 작업자 판단으로 과체결됐다.',
    '고객 보유 재고 및 사내 재고 전수 통전검사. 유출분 회수 완료.',
    '작업표준에 체결 토크 상한(3.0N·m) 명기, 토크 드라이버 도입.',
    '체결 토크가 들어가는 전 공정의 작업표준을 점검해 상한값 누락 여부를 확인한다.',
    5, 'QA-MGR', 1250000
  );

  /* ── 6. 27일 전 / 종결 / 낮음 — 파손(포장) ────────────────────────────── */
  ins(
    'KS_CUSTOM01', 'KS_고객사01', 27,
    'N91H00-X9800-R', 'LOT-260819-008', 2,
    'DAMAGE', 'LOW', 'CLOSED',
    '입고 시 박스 모서리 파손으로 제품 2EA 커넥터 하우징 깨짐.',
    '운송사 인수인계 사진 확인 결과 출하 시점에는 정상. 적재 단수 초과로 하단 박스가 눌린 것으로 판단.',
    '출하 적재 표준에 최대 단수 규정이 없었다.',
    '파손 2EA 즉시 대체품 발송.',
    '출하 적재 최대 5단 규정을 표준에 추가하고 운송사에 통보.',
    '포장 사양서에 적재 단수와 완충재 기준을 함께 명기한다.',
    4, 'PROD-KIM', 85000
  );

  COMMIT;
END;
/

-- ── 확인 ────────────────────────────────────────────────────────────────
SELECT COMPLAINT_NO, TO_CHAR(COMPLAINT_DATE, 'YYYY-MM-DD') 접수일, CUSTOMER_NAME,
       COMPLAINT_TYPE, URGENCY, STATUS, DEFECT_QTY, COST_AMOUNT
FROM CUSTOMER_COMPLAINTS
WHERE CREATED_BY = 'cc-seed'
ORDER BY COMPLAINT_DATE DESC, COMPLAINT_NO
/

-- ── 롤백(필요 시) ───────────────────────────────────────────────────────
-- DELETE FROM CUSTOMER_COMPLAINTS WHERE CREATED_BY = 'cc-seed';
-- COMMIT;
