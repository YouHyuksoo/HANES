-- 2026-09-03 채번 MAX+1 안티패턴 정비 [C그룹] — 품질/시스템 NUM_RULE_MASTERS 규칙 행 등록
-- 배경: docs/standards/numbering-rules.md "구현 시 주의사항 1" — 시퀀스 채번은 DB 기반, MAX+1 금지.
--       마지막 행 조회 후 +1 방식은 동시 요청 시 같은 번호를 발급해 PK 충돌(ORA-00001)을 낸다.
--       선행 작업: 2026-09-03_numbering_max_plus_one_fix.sql (A그룹 재고/거래원장 + B그룹 스코프 락).
--
-- [C그룹] 품질/시스템 13채널 — NumberingService.next(RULE_TYPE)로 전환. 포맷은 기존과 100% 동일 유지.
--   전부 {PREFIX}YYYYMMDD-NNN (3자리, 당일 리셋)이라 MERGE 한 블록으로 등록한다.
--     AUDIT_NO     AUD-  AUDIT_PLANS.AUDIT_NO              납품업체심사번호
--     FAI_NO       FAI-  FAI_REQUESTS.FAI_NO               초물검사번호
--     COMPLAINT_NO CC-   CUSTOMER_COMPLAINTS.COMPLAINT_NO  고객클레임번호
--     ECN_NO       ECN-  CHANGE_ORDERS.CHANGE_NO           4M 변경번호
--     CAPA_CA      CA-   CAPA_REQUESTS.CAPA_NO             CAPA 시정조치번호
--     CAPA_PA      PA-   CAPA_REQUESTS.CAPA_NO             CAPA 예방조치번호
--     SPC_CHART    SPC-  SPC_CHARTS.CHART_NO               관리도번호
--     CALIBRATION  CAL-  CALIBRATION_LOGS.CALIBRATION_NO   교정번호
--     CONTROL_PLAN CP-   CONTROL_PLANS.PLAN_NO             관리계획번호
--     REWORK_NO    RW-   REWORK_ORDERS.REWORK_NO           재작업번호
--     PPAP_NO      PPAP- PPAP_SUBMISSIONS.PPAP_NO          PPAP 제출번호
--     DOC_NO       DOC-  DOCUMENT_MASTERS.DOC_NO           문서번호
--     OQC_REQUEST  OQC-  OQC_REQUESTS.REQUEST_NO           출하검사 요청번호
--   PATTERN에 {PREFIX} 토큰이 없으므로 NumRuleService가 PREFIX를 결과 앞에 그대로 붙인다.
--   → 'AUD-' || '20260903' || '-' || '001' = AUD-20260903-001 (기존 포맷과 동일)
--
-- CAPA는 capaType(CORRECTIVE/PREVENTIVE)에 따라 접두어가 CA-/PA- 2종이므로 채널도 2개로 분리한다.
-- CBM WO(CBM-YYYYMMDD-NNN)는 B그룹에서 등록한 PM_WO 락 행을 재사용하므로 여기서 추가하지 않는다.
--
-- CURRENT_SEQ 는 "오늘 이미 발급된 최대 시퀀스"로 초기화한다(중간 도입 시 기존 번호와의 PK 충돌 방지).
--   - 코드가 SUBSTR(no, -3)에 해당하는 마지막 3자리만 읽으므로 서브쿼리도 동일하게 미러링한다.
--   - LIKE '...-___' 로 길이를 고정하고 REGEXP_LIKE 로 숫자 3자리를 보장한다.
--     (레거시 행에 비숫자 꼬리가 있으면 TO_NUMBER가 ORA-01722로 마이그레이션 전체를 죽인다)
--   - 테넌트 필터는 넣지 않는다: NumRuleService.generateNumber()의 WHERE에 COMPANY/PLANT_CD가
--     없어 카운터가 테넌트 전역 단일이므로, 초기값도 전역 MAX여야 다른 테넌트 기존 번호와 겹치지 않는다.
-- LAST_RESET = SYSDATE 이므로 다음 날 첫 채번에서 1로 리셋된다.
-- 실행: python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file <this file>

MERGE INTO NUM_RULE_MASTERS T
USING (
  SELECT 'AUDIT_NO' RULE_TYPE, '납품업체심사번호' RULE_NAME, 'AUD-' PREFIX,
         (SELECT NVL(MAX(TO_NUMBER(SUBSTR(AUDIT_NO, -3))), 0) FROM AUDIT_PLANS
           WHERE AUDIT_NO LIKE 'AUD-' || TO_CHAR(SYSDATE, 'YYYYMMDD') || '-___'
             AND REGEXP_LIKE(AUDIT_NO, '-[0-9]{3}$')) CUR_SEQ FROM DUAL
  UNION ALL
  SELECT 'FAI_NO', '초물검사번호', 'FAI-',
         (SELECT NVL(MAX(TO_NUMBER(SUBSTR(FAI_NO, -3))), 0) FROM FAI_REQUESTS
           WHERE FAI_NO LIKE 'FAI-' || TO_CHAR(SYSDATE, 'YYYYMMDD') || '-___'
             AND REGEXP_LIKE(FAI_NO, '-[0-9]{3}$')) FROM DUAL
  UNION ALL
  SELECT 'COMPLAINT_NO', '고객클레임번호', 'CC-',
         (SELECT NVL(MAX(TO_NUMBER(SUBSTR(COMPLAINT_NO, -3))), 0) FROM CUSTOMER_COMPLAINTS
           WHERE COMPLAINT_NO LIKE 'CC-' || TO_CHAR(SYSDATE, 'YYYYMMDD') || '-___'
             AND REGEXP_LIKE(COMPLAINT_NO, '-[0-9]{3}$')) FROM DUAL
  UNION ALL
  SELECT 'ECN_NO', '4M 변경번호', 'ECN-',
         (SELECT NVL(MAX(TO_NUMBER(SUBSTR(CHANGE_NO, -3))), 0) FROM CHANGE_ORDERS
           WHERE CHANGE_NO LIKE 'ECN-' || TO_CHAR(SYSDATE, 'YYYYMMDD') || '-___'
             AND REGEXP_LIKE(CHANGE_NO, '-[0-9]{3}$')) FROM DUAL
  UNION ALL
  SELECT 'CAPA_CA', 'CAPA 시정조치번호', 'CA-',
         (SELECT NVL(MAX(TO_NUMBER(SUBSTR(CAPA_NO, -3))), 0) FROM CAPA_REQUESTS
           WHERE CAPA_NO LIKE 'CA-' || TO_CHAR(SYSDATE, 'YYYYMMDD') || '-___'
             AND REGEXP_LIKE(CAPA_NO, '-[0-9]{3}$')) FROM DUAL
  UNION ALL
  SELECT 'CAPA_PA', 'CAPA 예방조치번호', 'PA-',
         (SELECT NVL(MAX(TO_NUMBER(SUBSTR(CAPA_NO, -3))), 0) FROM CAPA_REQUESTS
           WHERE CAPA_NO LIKE 'PA-' || TO_CHAR(SYSDATE, 'YYYYMMDD') || '-___'
             AND REGEXP_LIKE(CAPA_NO, '-[0-9]{3}$')) FROM DUAL
  UNION ALL
  SELECT 'SPC_CHART', '관리도번호', 'SPC-',
         (SELECT NVL(MAX(TO_NUMBER(SUBSTR(CHART_NO, -3))), 0) FROM SPC_CHARTS
           WHERE CHART_NO LIKE 'SPC-' || TO_CHAR(SYSDATE, 'YYYYMMDD') || '-___'
             AND REGEXP_LIKE(CHART_NO, '-[0-9]{3}$')) FROM DUAL
  UNION ALL
  SELECT 'CALIBRATION', '교정번호', 'CAL-',
         (SELECT NVL(MAX(TO_NUMBER(SUBSTR(CALIBRATION_NO, -3))), 0) FROM CALIBRATION_LOGS
           WHERE CALIBRATION_NO LIKE 'CAL-' || TO_CHAR(SYSDATE, 'YYYYMMDD') || '-___'
             AND REGEXP_LIKE(CALIBRATION_NO, '-[0-9]{3}$')) FROM DUAL
  UNION ALL
  SELECT 'CONTROL_PLAN', '관리계획번호', 'CP-',
         (SELECT NVL(MAX(TO_NUMBER(SUBSTR(PLAN_NO, -3))), 0) FROM CONTROL_PLANS
           WHERE PLAN_NO LIKE 'CP-' || TO_CHAR(SYSDATE, 'YYYYMMDD') || '-___'
             AND REGEXP_LIKE(PLAN_NO, '-[0-9]{3}$')) FROM DUAL
  UNION ALL
  SELECT 'REWORK_NO', '재작업번호', 'RW-',
         (SELECT NVL(MAX(TO_NUMBER(SUBSTR(REWORK_NO, -3))), 0) FROM REWORK_ORDERS
           WHERE REWORK_NO LIKE 'RW-' || TO_CHAR(SYSDATE, 'YYYYMMDD') || '-___'
             AND REGEXP_LIKE(REWORK_NO, '-[0-9]{3}$')) FROM DUAL
  UNION ALL
  SELECT 'PPAP_NO', 'PPAP 제출번호', 'PPAP-',
         (SELECT NVL(MAX(TO_NUMBER(SUBSTR(PPAP_NO, -3))), 0) FROM PPAP_SUBMISSIONS
           WHERE PPAP_NO LIKE 'PPAP-' || TO_CHAR(SYSDATE, 'YYYYMMDD') || '-___'
             AND REGEXP_LIKE(PPAP_NO, '-[0-9]{3}$')) FROM DUAL
  UNION ALL
  SELECT 'DOC_NO', '문서번호', 'DOC-',
         (SELECT NVL(MAX(TO_NUMBER(SUBSTR(DOC_NO, -3))), 0) FROM DOCUMENT_MASTERS
           WHERE DOC_NO LIKE 'DOC-' || TO_CHAR(SYSDATE, 'YYYYMMDD') || '-___'
             AND REGEXP_LIKE(DOC_NO, '-[0-9]{3}$')) FROM DUAL
  UNION ALL
  SELECT 'OQC_REQUEST', '출하검사 요청번호', 'OQC-',
         (SELECT NVL(MAX(TO_NUMBER(SUBSTR(REQUEST_NO, -3))), 0) FROM OQC_REQUESTS
           WHERE REQUEST_NO LIKE 'OQC-' || TO_CHAR(SYSDATE, 'YYYYMMDD') || '-___'
             AND REGEXP_LIKE(REQUEST_NO, '-[0-9]{3}$')) FROM DUAL
) S
ON (T.RULE_TYPE = S.RULE_TYPE)
WHEN NOT MATCHED THEN INSERT (
  RULE_TYPE, RULE_NAME, PATTERN, PREFIX, SEQ_LENGTH, CURRENT_SEQ,
  RESET_TYPE, LAST_RESET, USE_YN, COMPANY, PLANT_CD, CREATED_BY, UPDATED_BY
) VALUES (
  S.RULE_TYPE, S.RULE_NAME, '{YYYY}{MM}{DD}-{SEQ}', S.PREFIX, 3, S.CUR_SEQ,
  'DAILY', SYSDATE, 'Y', '40', '1000', 'SYSTEM', 'SYSTEM'
)
/

-- [실행 후 검증] 13행이 나와야 한다.
-- SELECT RULE_TYPE, PREFIX, PATTERN, SEQ_LENGTH, CURRENT_SEQ, RESET_TYPE, USE_YN
--   FROM NUM_RULE_MASTERS
--  WHERE RULE_TYPE IN ('AUDIT_NO','FAI_NO','COMPLAINT_NO','ECN_NO','CAPA_CA','CAPA_PA',
--                      'SPC_CHART','CALIBRATION','CONTROL_PLAN','REWORK_NO','PPAP_NO',
--                      'DOC_NO','OQC_REQUEST')
--  ORDER BY RULE_TYPE;

COMMIT
/
