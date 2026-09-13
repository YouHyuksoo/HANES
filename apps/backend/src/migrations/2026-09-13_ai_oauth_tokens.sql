-- AI OAuth 토큰 저장 (OpenAI ChatGPT 계정 연결)
--
-- 배경:
--   OpenAI 는 API 키 외에 OAuth(Authorization Code + PKCE)로도 붙을 수 있다.
--   auth.openai.com 에서 발급한 access_token 의 aud 가 https://api.openai.com/v1 이라
--   그대로 Bearer 로 쓴다. Codex CLI / Hermes 가 같은 방식으로 동작한다(2026-09-13 실측).
--
-- 왜 SYS_CONFIGS 가 아닌가:
--   토큰이 1800자 내외로 길고, 설정 화면에 값이 그대로 노출되면 안 된다.
--   만료·갱신 시각을 별도 컬럼으로 다뤄야 자동 재발급 판단이 깔끔하다.
--
-- PKCE 의 code_verifier 는 저장하지 않는다(수 분짜리 1회용). 서버 메모리에 둔다.
-- 사이트: JSHANES(40/1000)

BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE AI_OAUTH_TOKENS (
      PROVIDER       VARCHAR2(30)   NOT NULL,
      COMPANY        VARCHAR2(50)   NOT NULL,
      PLANT_CD       VARCHAR2(50)   NOT NULL,
      ACCESS_TOKEN   CLOB           NOT NULL,
      REFRESH_TOKEN  CLOB,
      ID_TOKEN       CLOB,
      ACCOUNT_ID     VARCHAR2(100),
      ACCOUNT_EMAIL  VARCHAR2(255),
      EXPIRES_AT     TIMESTAMP,
      LAST_REFRESH   TIMESTAMP,
      CREATED_BY     VARCHAR2(100),
      UPDATED_BY     VARCHAR2(100),
      CREATED_AT     TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
      UPDATED_AT     TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
      CONSTRAINT PK_AI_OAUTH_TOKENS PRIMARY KEY (PROVIDER, COMPANY, PLANT_CD)
    )';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- ORA-00955: 이미 존재
END;
/

COMMENT ON TABLE  AI_OAUTH_TOKENS IS 'AI provider OAuth 토큰 (회사/사업장 단위 1건)';
/
COMMENT ON COLUMN AI_OAUTH_TOKENS.PROVIDER IS 'AI provider [openai-oauth]';
/
COMMENT ON COLUMN AI_OAUTH_TOKENS.ACCESS_TOKEN IS 'API 호출용 Bearer 토큰 (aud=https://api.openai.com/v1)';
/
COMMENT ON COLUMN AI_OAUTH_TOKENS.REFRESH_TOKEN IS '만료 시 재발급용. 없으면 재로그인 필요';
/
COMMENT ON COLUMN AI_OAUTH_TOKENS.EXPIRES_AT IS 'access_token 만료 시각. 임박하면 자동 갱신한다';
/
COMMENT ON COLUMN AI_OAUTH_TOKENS.ACCOUNT_EMAIL IS '연결된 계정 (화면 표시용)';
/

COMMIT;
/
