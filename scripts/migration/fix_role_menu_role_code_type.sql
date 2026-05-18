--==============================================================
-- fix_role_menu_role_code_type.sql
-- ROLE_MENU_PERMISSIONS.ROLE_CODE 컬럼 타입 수정 (NUMBER -> VARCHAR2(50))
--
-- 배경:
--   alter_schema_to_entity.sql:653 에서 ROLE_ID -> ROLE_CODE 로
--   RENAME COLUMN 만 수행하여 컬럼 타입이 NUMBER 그대로 남음.
--   엔티티(role-menu-permission.entity.ts)는 VARCHAR2(50) 으로
--   매핑하지만 synchronize:false 라 DB 가 자동 변경되지 않음.
--   결과: GET /roles/MANAGER/permissions 호출 시 'MANAGER' 문자열을
--         NUMBER 컬럼과 비교하다 ORA-01722 발생.
--
-- 현재 DB 상태 (2026-05-18 2차 시도 직전):
--   - 데이터 건수: 0
--   - PRIMARY KEY: PK_ROLE_MENU_PERMISSIONS (ROLE_CODE NUMBER, MENU_CODE)
--   - UNIQUE: 없음 (1차 시도에서 drop됨)
--   - FK: 없음
--   - ROLE_CODE: NUMBER(22) NOT NULL  ← fix 대상
--   - ROLES.CODE: VARCHAR2(50)  ← FK 참조 타입
--
-- 주의: MODIFY 시 NOT NULL을 다시 지정하면 ORA-01442 발생 (이미 NOT NULL).
--      VARCHAR2(50) 만 지정하면 NOT NULL 속성 유지된 채 타입만 변경됨.
--
-- 실행:
--   python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py \
--     --site JSHANES --execute-file scripts/migration/fix_role_menu_role_code_type.sql
--==============================================================

-- 1) PK 제거 (NUMBER 기반 PK 제거)
ALTER TABLE ROLE_MENU_PERMISSIONS DROP CONSTRAINT PK_ROLE_MENU_PERMISSIONS;
/

-- 2) ROLE_CODE 컬럼 타입 변경 (NUMBER -> VARCHAR2(50), NOT NULL 유지)
ALTER TABLE ROLE_MENU_PERMISSIONS MODIFY (ROLE_CODE VARCHAR2(50));
/

-- 3) PK 재생성 (VARCHAR2 기반)
ALTER TABLE ROLE_MENU_PERMISSIONS
  ADD CONSTRAINT PK_ROLE_MENU_PERMISSIONS PRIMARY KEY (ROLE_CODE, MENU_CODE);
/

-- 4) FK 생성 (ROLES.CODE 참조, ON DELETE CASCADE)
ALTER TABLE ROLE_MENU_PERMISSIONS
  ADD CONSTRAINT FK_ROLE_MENU_ROLE
  FOREIGN KEY (ROLE_CODE) REFERENCES ROLES (CODE) ON DELETE CASCADE;
/

-- 5) 사후 검증
SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH, NULLABLE
FROM   USER_TAB_COLUMNS
WHERE  TABLE_NAME = 'ROLE_MENU_PERMISSIONS'
AND    COLUMN_NAME = 'ROLE_CODE';
/
