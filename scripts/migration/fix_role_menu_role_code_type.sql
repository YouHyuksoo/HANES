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
-- 안전성:
--   alter_schema_to_entity.sql:93 에서 TRUNCATE 된 이후 시드가
--   새 스키마로 재실행된 적 없으므로 테이블은 비어있을 것.
--   (precheck 단계의 SELECT 가 0 을 반환해야 함)
--
-- 실행:
--   python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py \
--     --site JSHANES --execute-file scripts/migration/fix_role_menu_role_code_type.sql
--
-- 참고:
--   FK_ROLE_MENU_ROLE 은 03b_pk_patch.sql:195 에서 DROP 되었음.
--   이 스크립트가 같은 이름으로 재생성하지만 참조 대상은 ROLES.ID(NUMBER) 가
--   아닌 ROLES.CODE(VARCHAR2(50)) 로 바뀐 새 FK 임.
--==============================================================

-- 1) 사전 진단 1: 현재 ROLE_CODE 컬럼 타입 확인
SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH, NULLABLE
FROM   USER_TAB_COLUMNS
WHERE  TABLE_NAME = 'ROLE_MENU_PERMISSIONS'
ORDER  BY COLUMN_ID;
/

-- 2) 사전 진단 2: 데이터 존재 여부 (0 이어야 안전)
SELECT COUNT(*) AS ROW_COUNT FROM ROLE_MENU_PERMISSIONS;
/

-- 3) 사전 진단 3: ROLES.CODE 가 PK 인지 확인 (FK 재생성 전 필수)
SELECT c.COLUMN_NAME, k.CONSTRAINT_TYPE
FROM   USER_CONS_COLUMNS c
JOIN   USER_CONSTRAINTS  k ON k.CONSTRAINT_NAME = c.CONSTRAINT_NAME
WHERE  k.TABLE_NAME = 'ROLES'
AND    k.CONSTRAINT_TYPE = 'P';
/

-- 4) PK 제거 (RENAME 이후 추가된 복합 PK)
ALTER TABLE ROLE_MENU_PERMISSIONS DROP PRIMARY KEY;
/

-- 5) ROLE_CODE 컬럼 타입 변경 (NUMBER -> VARCHAR2(50))
--    빈 테이블이거나 모든 값이 NULL 일 때만 직접 MODIFY 가능.
ALTER TABLE ROLE_MENU_PERMISSIONS MODIFY (ROLE_CODE VARCHAR2(50) NOT NULL);
/

-- 6) PK 재생성
ALTER TABLE ROLE_MENU_PERMISSIONS
  ADD CONSTRAINT PK_ROLE_MENU_PERMISSIONS PRIMARY KEY (ROLE_CODE, MENU_CODE);
/

-- 7) FK 재생성 (ROLES.CODE 참조, ON DELETE CASCADE)
ALTER TABLE ROLE_MENU_PERMISSIONS
  ADD CONSTRAINT FK_ROLE_MENU_ROLE
  FOREIGN KEY (ROLE_CODE) REFERENCES ROLES (CODE) ON DELETE CASCADE;
/

-- 8) 사후 검증: ROLE_CODE 가 VARCHAR2(50) 인지 확인
SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH
FROM   USER_TAB_COLUMNS
WHERE  TABLE_NAME = 'ROLE_MENU_PERMISSIONS'
AND    COLUMN_NAME = 'ROLE_CODE';
/
