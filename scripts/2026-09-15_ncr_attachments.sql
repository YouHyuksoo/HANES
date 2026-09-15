-- ============================================================================
-- 부적합 보고서(NCR) 첨부파일 — 문서·이미지
--
-- 설계 메모:
-- 1. NCR_REPORTS.IMAGE_URL 단일 컬럼으로는 "문서 및 이미지 여러 건"을 담을 수 없어
--    별도 테이블로 분리한다. IMAGE_URL 은 이 테이블로 대체되며 더 이상 쓰지 않는다.
-- 2. PK 는 (COMPANY, PLANT_CD, NCR_NO, SEQ). SEQ 는 DEFAULT 를 두지 않는다 —
--    TypeORM 이 복합 PK 컬럼의 DEFAULT 를 INSERT 에 채우지 않아 ORA-01400 이 난 전례가 있다
--    (LABEL_PRINT_LOGS). 서비스가 트랜잭션 안에서 count+1 로 명시 계산한다.
-- 3. 실제 파일은 uploads/ncr-attachments 에 저장하고 여기에는 경로만 남긴다
--    (work-instruction / iqc-cert 와 같은 방식).
--
-- 실행:
--   python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py \
--     --site JSHANES --execute-file scripts/2026-09-15_ncr_attachments.sql
-- ============================================================================

CREATE TABLE NCR_ATTACHMENTS (
  COMPANY      VARCHAR2(20)  DEFAULT '40'   NOT NULL,
  PLANT_CD     VARCHAR2(20)  DEFAULT '1000' NOT NULL,
  NCR_NO       VARCHAR2(50)                 NOT NULL,
  SEQ          NUMBER(5)                    NOT NULL,
  FILE_NAME    VARCHAR2(255)                NOT NULL,
  FILE_PATH    VARCHAR2(500)                NOT NULL,
  FILE_SIZE    NUMBER(12),
  MIME_TYPE    VARCHAR2(100),
  KIND         VARCHAR2(20)  DEFAULT 'DOC'  NOT NULL,
  REMARK       VARCHAR2(500),
  CREATED_BY   VARCHAR2(50),
  UPDATED_BY   VARCHAR2(50),
  CREATED_AT   TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  UPDATED_AT   TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT PK_NCR_ATTACHMENTS PRIMARY KEY (COMPANY, PLANT_CD, NCR_NO, SEQ),
  CONSTRAINT CK_NCR_ATTACH_KIND CHECK (KIND IN ('IMAGE', 'DOC'))
)
/

CREATE INDEX IX_NCR_ATTACH_NCR ON NCR_ATTACHMENTS (COMPANY, PLANT_CD, NCR_NO)
/

COMMENT ON TABLE NCR_ATTACHMENTS IS '부적합 보고서 첨부파일 — 현상 사진, 측정 성적서, 고객 클레임 문서 등'
/
COMMENT ON COLUMN NCR_ATTACHMENTS.SEQ IS '보고서 내 순번 — 서비스가 count+1 로 명시 채번(복합 PK 라 DEFAULT 금지)'
/
COMMENT ON COLUMN NCR_ATTACHMENTS.FILE_NAME IS '업로드 당시 원본 파일명 — 화면 표시와 다운로드 이름에 쓴다'
/
COMMENT ON COLUMN NCR_ATTACHMENTS.FILE_PATH IS 'uploads 기준 저장 경로 — 정적 서빙 URL 은 /uploads/ncr-attachments/<파일명>'
/
COMMENT ON COLUMN NCR_ATTACHMENTS.KIND IS 'IMAGE=인쇄 양식에 사진으로 싣는다 / DOC=목록에 링크로만 노출'
/

COMMENT ON COLUMN NCR_REPORTS.IMAGE_URL IS '(사용중지) NCR_ATTACHMENTS 로 대체됨 — 신규 등록에서 채우지 않는다'
/
