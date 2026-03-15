-- ============================================================
-- 통합 채번 규칙 마스터 테이블 + 시퀀스
-- ============================================================

-- SEQ_RULES 테이블
CREATE TABLE SEQ_RULES (
  DOC_TYPE      VARCHAR2(30)  NOT NULL,
  PREFIX        VARCHAR2(10)  NOT NULL,
  SEQ_NAME      VARCHAR2(30)  NOT NULL,
  PAD_LENGTH    NUMBER(2)     DEFAULT 5,
  DATE_FORMAT   VARCHAR2(10)  DEFAULT 'YYMMDD',
  SEPARATOR     VARCHAR2(2)   DEFAULT '',
  DESCRIPTION   VARCHAR2(100),
  USE_YN        VARCHAR2(1)   DEFAULT 'Y',
  COMPANY       VARCHAR2(50)  DEFAULT '40',
  PLANT_CD      VARCHAR2(50)  DEFAULT '1000',
  CREATED_AT    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT PK_SEQ_RULES PRIMARY KEY (DOC_TYPE)
)
