/**
 * @file PKG_NUM_RULE.pkb
 * @description 채번 패키지 바디 (Package Body) -- FN_NEXT_NUMBER 함수 구현
 *
 * 초보자 가이드:
 *   - .pkb 파일은 패키지의 실제 로직을 구현합니다.
 *   - 반드시 .pks (패키지 스펙)를 먼저 배포한 후 이 파일을 실행하세요.
 *   - SELECT FOR UPDATE를 사용하여 동시성을 보장합니다.
 *     (여러 세션이 동시에 호출해도 중복 번호가 발생하지 않음)
 *
 * 리셋 로직 설명:
 *   - DAILY   : 날짜(YYYY-MM-DD)가 바뀌면 시퀀스를 1로 리셋
 *   - MONTHLY : 월(YYYY-MM)이 바뀌면 시퀀스를 1로 리셋
 *   - YEARLY  : 연도(YYYY)가 바뀌면 시퀀스를 1로 리셋
 *   - NONE    : 리셋하지 않음 (계속 증가)
 *
 * 패턴 치환 규칙:
 *   {PREFIX} -> NUM_RULE_MASTERS.PREFIX 값
 *   {SUFFIX} -> NUM_RULE_MASTERS.SUFFIX 값
 *   {YYYY}   -> 현재 연도 4자리
 *   {YY}     -> 현재 연도 2자리
 *   {MM}     -> 현재 월 2자리
 *   {DD}     -> 현재 일 2자리
 *   {SEQ}    -> LPAD된 시퀀스 번호 (SEQ_LENGTH만큼 0 패딩)
 *
 * 사용 예시:
 *   -- 단독 호출
 *   SELECT PKG_NUM_RULE.FN_NEXT_NUMBER('JOB_ORDER', 'admin') FROM DUAL;
 *
 *   -- INSERT 시 활용
 *   INSERT INTO "SOME_TABLE" ("ORDER_NO", ...)
 *   VALUES (PKG_NUM_RULE.FN_NEXT_NUMBER('JOB_ORDER'), ...);
 *
 * 대상 테이블: NUM_RULE_MASTERS
 */

CREATE OR REPLACE PACKAGE BODY PKG_NUM_RULE AS

  /**
   * FN_NEXT_NUMBER - 다음 채번 번호를 생성하여 반환
   *
   * 처리 흐름:
   *   1. SELECT FOR UPDATE로 해당 RULE_TYPE 행 잠금
   *   2. RESET_TYPE에 따라 시퀀스 리셋 여부 판단
   *   3. 시퀀스 증가 (리셋이면 1, 아니면 CURRENT_SEQ + 1)
   *   4. NUM_RULE_MASTERS 테이블 UPDATE
   *   5. 패턴 문자열 치환 후 결과 반환
   *
   * @param p_rule_type  채번 규칙 유형 (NUM_RULE_MASTERS.RULE_TYPE)
   * @param p_user_id    수정자 ID (기본값: 'SYSTEM')
   * @return VARCHAR2     생성된 번호 문자열
   */
  FUNCTION FN_NEXT_NUMBER(
    p_rule_type IN VARCHAR2,
    p_user_id   IN VARCHAR2 DEFAULT 'SYSTEM'
  ) RETURN VARCHAR2
  IS
    /* 커서로 읽어올 변수들 */
    v_pattern      VARCHAR2(100);
    v_prefix       VARCHAR2(20);
    v_suffix       VARCHAR2(20);
    v_seq_length   NUMBER;
    v_current_seq  NUMBER;
    v_reset_type   VARCHAR2(20);
    v_last_reset   DATE;

    /* 계산용 변수 */
    v_now          DATE := SYSDATE;
    v_need_reset   BOOLEAN := FALSE;
    v_next_seq     NUMBER;
    v_result       VARCHAR2(200);
    v_seq_str      VARCHAR2(20);
  BEGIN
    /*---------------------------------------------------------------
     * 1단계: SELECT FOR UPDATE로 행 잠금 (동시성 보장 핵심!)
     *   - USE_YN = 'Y'인 활성 규칙만 조회
     *   - DELETED_AT IS NULL로 소프트 삭제된 행 제외
     *   - FOR UPDATE로 다른 세션의 동시 접근을 직렬화
     *---------------------------------------------------------------*/
    BEGIN
      SELECT "PATTERN",
             "PREFIX",
             "SUFFIX",
             "SEQ_LENGTH",
             "CURRENT_SEQ",
             "RESET_TYPE",
             "LAST_RESET"
        INTO v_pattern,
             v_prefix,
             v_suffix,
             v_seq_length,
             v_current_seq,
             v_reset_type,
             v_last_reset
        FROM "NUM_RULE_MASTERS"
       WHERE "RULE_TYPE"   = p_rule_type
         AND "USE_YN"      = 'Y'
         AND "DELETED_AT"  IS NULL
         FOR UPDATE;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(
          -20001,
          'PKG_NUM_RULE.FN_NEXT_NUMBER: RULE_TYPE [' || p_rule_type
          || '] 이(가) 존재하지 않거나 사용 중지 상태입니다.'
        );
    END;

    /*---------------------------------------------------------------
     * 2단계: RESET_TYPE에 따라 리셋 여부 판단
     *   - LAST_RESET이 NULL이면 첫 사용이므로 리셋 불필요 (SEQ + 1)
     *   - DAILY   : TRUNC(LAST_RESET) <> TRUNC(SYSDATE)
     *   - MONTHLY : TO_CHAR(LAST_RESET, 'YYYYMM') <> TO_CHAR(SYSDATE, 'YYYYMM')
     *   - YEARLY  : TO_CHAR(LAST_RESET, 'YYYY') <> TO_CHAR(SYSDATE, 'YYYY')
     *   - NONE    : 리셋하지 않음
     *---------------------------------------------------------------*/
    IF v_last_reset IS NOT NULL THEN
      CASE v_reset_type
        WHEN 'DAILY' THEN
          IF TRUNC(v_last_reset) < TRUNC(v_now) THEN
            v_need_reset := TRUE;
          END IF;

        WHEN 'MONTHLY' THEN
          IF TO_CHAR(v_last_reset, 'YYYYMM') <> TO_CHAR(v_now, 'YYYYMM') THEN
            v_need_reset := TRUE;
          END IF;

        WHEN 'YEARLY' THEN
          IF TO_CHAR(v_last_reset, 'YYYY') <> TO_CHAR(v_now, 'YYYY') THEN
            v_need_reset := TRUE;
          END IF;

        WHEN 'NONE' THEN
          v_need_reset := FALSE;

        ELSE
          /* 알 수 없는 RESET_TYPE은 리셋하지 않음 */
          v_need_reset := FALSE;
      END CASE;
    END IF;

    /*---------------------------------------------------------------
     * 3단계: 시퀀스 계산
     *   - 리셋이 필요하면 1부터 시작
     *   - 아니면 현재 시퀀스 + 1
     *---------------------------------------------------------------*/
    IF v_need_reset THEN
      v_next_seq := 1;
    ELSE
      v_next_seq := v_current_seq + 1;
    END IF;

    /*---------------------------------------------------------------
     * 4단계: NUM_RULE_MASTERS 테이블 UPDATE
     *   - CURRENT_SEQ: 새 시퀀스 값으로 갱신
     *   - LAST_RESET : 현재 시각으로 갱신
     *   - UPDATED_BY : 호출자 ID
     *   - UPDATED_AT : 현재 시각
     *---------------------------------------------------------------*/
    UPDATE "NUM_RULE_MASTERS"
       SET "CURRENT_SEQ" = v_next_seq,
           "LAST_RESET"  = v_now,
           "UPDATED_BY"  = p_user_id,
           "UPDATED_AT"  = SYSTIMESTAMP
     WHERE "RULE_TYPE"   = p_rule_type
       AND "USE_YN"      = 'Y'
       AND "DELETED_AT"  IS NULL;

    /*---------------------------------------------------------------
     * 5단계: 패턴 치환
     *   - {PREFIX} -> PREFIX 컬럼 값 (NULL이면 빈 문자열)
     *   - {SUFFIX} -> SUFFIX 컬럼 값 (NULL이면 빈 문자열)
     *   - {YYYY}   -> 4자리 연도
     *   - {YY}     -> 2자리 연도
     *   - {MM}     -> 2자리 월
     *   - {DD}     -> 2자리 일
     *   - {SEQ}    -> 0-패딩된 시퀀스 (SEQ_LENGTH 자릿수)
     *---------------------------------------------------------------*/
    v_seq_str := LPAD(TO_CHAR(v_next_seq), v_seq_length, '0');

    v_result := v_pattern;
    v_result := REPLACE(v_result, '{PREFIX}', NVL(v_prefix, ''));
    v_result := REPLACE(v_result, '{SUFFIX}', NVL(v_suffix, ''));
    v_result := REPLACE(v_result, '{YYYY}',   TO_CHAR(v_now, 'YYYY'));
    v_result := REPLACE(v_result, '{YY}',     TO_CHAR(v_now, 'YY'));
    v_result := REPLACE(v_result, '{MM}',     TO_CHAR(v_now, 'MM'));
    v_result := REPLACE(v_result, '{DD}',     TO_CHAR(v_now, 'DD'));
    v_result := REPLACE(v_result, '{SEQ}',    v_seq_str);

    /*---------------------------------------------------------------
     * 6단계: PREFIX/SUFFIX 직접 적용 (패턴에 {PREFIX}/{SUFFIX}가 없는 경우)
     *   - 패턴에 {PREFIX}/{SUFFIX} 플레이스홀더가 없으면
     *     결과 앞뒤에 직접 붙여줌
     *   - 이미 치환된 경우에는 중복 적용되지 않도록
     *     원본 패턴에 플레이스홀더가 있었는지 확인
     *---------------------------------------------------------------*/
    IF v_prefix IS NOT NULL AND INSTR(v_pattern, '{PREFIX}') = 0 THEN
      v_result := v_prefix || v_result;
    END IF;

    IF v_suffix IS NOT NULL AND INSTR(v_pattern, '{SUFFIX}') = 0 THEN
      v_result := v_result || v_suffix;
    END IF;

    RETURN v_result;

  EXCEPTION
    WHEN OTHERS THEN
      RAISE_APPLICATION_ERROR(
        -20002,
        'PKG_NUM_RULE.FN_NEXT_NUMBER: 예기치 못한 오류 발생 - '
        || SQLERRM
      );
  END FN_NEXT_NUMBER;

END PKG_NUM_RULE;
/
