-- ============================================================
-- @file scripts/migration/create_physical_inv_sessions.sql
-- @description 재고실사 세션 테이블 생성 — InventoryFreezeGuard가 참조
--
-- 사용법:
--   Oracle SQL Developer 또는 Python 스크립트로 실행
--   예) python scripts/migration/run_migration.py create_physical_inv_sessions.sql
--
-- 목적:
--   재고실사(MATERIAL/PRODUCT) 진행 중 상태를 추적합니다.
--   status = 'IN_PROGRESS' 레코드가 존재하면 InventoryFreezeGuard가
--   자재 트랜잭션(입고/출고/보정/분할/병합/폐기)을 차단합니다.
-- ============================================================

-- SEQUENCE 생성 (Oracle 자동증분 PK용)
CREATE SEQUENCE SEQ_PHYSICAL_INV_SESSIONS
  START WITH 1
  INCREMENT BY 1
  NOCACHE
  NOCYCLE;

-- 테이블 생성
CREATE TABLE PHYSICAL_INV_SESSIONS (
  ID              NUMBER        NOT NULL,           -- PK (SEQUENCE)
  INV_TYPE        VARCHAR2(20)  NOT NULL,           -- 실사유형: MATERIAL | PRODUCT
  STATUS          VARCHAR2(20)  DEFAULT 'IN_PROGRESS' NOT NULL, -- IN_PROGRESS | COMPLETED | CANCELLED
  WAREHOUSE_CODE  VARCHAR2(50)  NULL,               -- 특정 창고만 차단 (NULL = 전체)
  COMPANY         VARCHAR2(50)  NULL,               -- 회사 코드
  PLANT_CD        VARCHAR2(50)  NULL,               -- 사업장 코드
  STARTED_BY      VARCHAR2(50)  NULL,               -- 개시자
  COMPLETED_BY    VARCHAR2(50)  NULL,               -- 완료자
  COMPLETED_AT    TIMESTAMP     NULL,               -- 완료 일시
  REMARK          VARCHAR2(500) NULL,               -- 비고
  CREATED_AT      TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
  UPDATED_AT      TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT PK_PHYSICAL_INV_SESSIONS PRIMARY KEY (ID),
  CONSTRAINT CHK_INV_TYPE CHECK (INV_TYPE IN ('MATERIAL', 'PRODUCT')),
  CONSTRAINT CHK_INV_STATUS CHECK (STATUS IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED'))
);

-- INDEX: InventoryFreezeGuard 조회 성능 최적화
CREATE INDEX IDX_PHYS_INV_SESS_STATUS ON PHYSICAL_INV_SESSIONS (STATUS);
CREATE INDEX IDX_PHYS_INV_SESS_COMPANY_PLANT ON PHYSICAL_INV_SESSIONS (COMPANY, PLANT_CD, STATUS);

-- TRIGGER: UPDATED_AT 자동 업데이트
CREATE OR REPLACE TRIGGER TRG_PHYSICAL_INV_SESSIONS_UPD
  BEFORE UPDATE ON PHYSICAL_INV_SESSIONS
  FOR EACH ROW
BEGIN
  :NEW.UPDATED_AT := SYSTIMESTAMP;
END;
/

-- TRIGGER: ID 자동 채번
CREATE OR REPLACE TRIGGER TRG_PHYSICAL_INV_SESSIONS_INS
  BEFORE INSERT ON PHYSICAL_INV_SESSIONS
  FOR EACH ROW
BEGIN
  IF :NEW.ID IS NULL THEN
    :NEW.ID := SEQ_PHYSICAL_INV_SESSIONS.NEXTVAL;
  END IF;
END;
/

COMMIT;
