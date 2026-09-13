-- 활동 이벤트 수집기 — ACTIVITY_LOGS 확장 + SEQ 채번 결함 수정
--
-- 배경:
--   PK가 (ACTIVITY_DATE, SEQ)인데 SEQ 기본값이 1이고 채번 주체가 없다.
--   그래서 같은 날 2번째 insert가 ORA-00001로 실패하고 서비스의 try/catch가 조용히 삼켰다.
--   실측(2026-09-12 JSHANES): ACTIVITY_LOGS 0건, SEQ_ACTIVITY_LOG 시퀀스 없음.
--   → 시퀀스를 만들고 서비스가 NEXTVAL로 채번한다. MAX+1은 쓰지 않는다(AGENTS.md).
--
-- 추가 컬럼:
--   MESSAGE    토스트/에러 메시지 본문. 실패 원인 분석의 핵심 필드.
--   ACTOR_KIND HUMAN | SCENARIO. 시나리오 드라이버가 만든 기록을 사람 조작과 구분한다.
--
-- 응답 본문(result)은 여기 저장하지 않는다.
--   시나리오 체인이 참조하는 생성 결과는 인페이지 링버퍼에서 즉시 읽는다.
--   서버 사본은 감사·실패분석 용도라 message/errorCode/status/path로 충분하고,
--   응답 페이로드를 장기 보관하지 않는 편이 낫다.
--
-- 사이트: JSHANES(40/1000)

BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE ACTIVITY_LOGS ADD (MESSAGE VARCHAR2(2000 CHAR) NULL)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -1430 THEN RAISE; END IF;  -- ORA-01430: 이미 존재하는 컬럼
END;
/

BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE ACTIVITY_LOGS ADD (ACTOR_KIND VARCHAR2(20) DEFAULT ''HUMAN'' NOT NULL)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -1430 THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'CREATE SEQUENCE SEQ_ACTIVITY_LOG START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- ORA-00955: 이미 존재하는 객체
END;
/

COMMENT ON COLUMN ACTIVITY_LOGS.MESSAGE IS '토스트/에러 메시지 본문';
/
COMMENT ON COLUMN ACTIVITY_LOGS.ACTOR_KIND IS '기록 주체 [HUMAN=사람 조작, SCENARIO=시나리오 드라이버]';
/
COMMENT ON COLUMN ACTIVITY_LOGS.ACTIVITY_TYPE IS
  '활동 유형 [LOGIN, PAGE_ACCESS, TOAST_SUCCESS, TOAST_ERROR, API_CALL, API_ERROR, JS_ERROR, SCAN]';
/

COMMIT;
/
