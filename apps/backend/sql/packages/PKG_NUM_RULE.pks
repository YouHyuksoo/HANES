/**
 * @file PKG_NUM_RULE.pks
 * @description 채번 패키지 스펙 (Package Specification)
 *
 * 초보자 가이드:
 *   - .pks 파일은 패키지의 "인터페이스"를 정의합니다 (어떤 함수/프로시저가 있는지).
 *   - 실제 로직은 .pkb (패키지 바디) 파일에 구현됩니다.
 *   - 배포 순서: .pks 먼저 실행 -> .pkb 실행
 *   - 이 파일만 실행하면 패키지 "껍데기"만 생성되므로 반드시 .pkb도 함께 배포하세요.
 *
 * 사용 예시 (SQL):
 *   SELECT PKG_NUM_RULE.FN_NEXT_NUMBER('JOB_ORDER', 'admin') FROM DUAL;
 *   -- 결과: 'JO20260224-0001' (패턴에 따라 다름)
 *
 * 대상 테이블: NUM_RULE_MASTERS
 */

CREATE OR REPLACE PACKAGE PKG_NUM_RULE AS
  /**
   * @package PKG_NUM_RULE
   * @description 채번 패키지 -- 시퀀스 기반 번호 자동 생성
   *
   * 초보자 가이드:
   *   1. FN_NEXT_NUMBER: 규칙 유형별 다음 번호 생성 (SELECT FOR UPDATE로 동시성 보장)
   *   2. 리셋 로직: DAILY/MONTHLY/YEARLY/NONE에 따라 시퀀스 자동 초기화
   *   3. 패턴 치환: {PREFIX}{YYYY}{MM}{DD}-{SEQ} -> ARR20260224-0001
   *
   * 에러 코드:
   *   -20001: 해당 RULE_TYPE이 존재하지 않거나 사용 중지(USE_YN='N')
   *   -20002: 기타 예상치 못한 오류
   */

  /**
   * FN_NEXT_NUMBER - 다음 채번 번호를 생성하여 반환
   *
   * @param p_rule_type  채번 규칙 유형 (NUM_RULE_MASTERS.RULE_TYPE)
   * @param p_user_id    수정자 ID (기본값: 'SYSTEM')
   * @return VARCHAR2     생성된 번호 문자열 (예: 'JO20260224-0001')
   *
   * 동시성 보장:
   *   SELECT ... FOR UPDATE로 행을 잠그므로 동시 호출 시에도
   *   중복 번호가 발생하지 않습니다. 트랜잭션 COMMIT 시 잠금 해제.
   */
  FUNCTION FN_NEXT_NUMBER(
    p_rule_type IN VARCHAR2,
    p_user_id   IN VARCHAR2 DEFAULT 'SYSTEM'
  ) RETURN VARCHAR2;

END PKG_NUM_RULE;
/
