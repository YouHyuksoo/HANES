# HANES MES - Oracle Migration Guide

## 📋 개요

이 문서는 HANES MES 프로젝트를 **Prisma/PostgreSQL**에서 **TypeORM/Oracle**로 마이그레이션하는 방법을 설명합니다.

## ✅ 마이그레이션 완료 사항

### 1. TypeORM 설정 완료
- [x] 58개 엔티티 생성
- [x] DatabaseModule 설정
- [x] Oracle 연결 설정
- [x] GenericCrudService TypeORM 버전

### 2. 서비스 변환 완료
- [x] Master 모듈 (9개 서비스)
- [x] Production 모듈 (3개 서비스)
- [x] Material 모듈 (6개 서비스)
- [x] Quality 모듈 (2개 서비스)
- [x] Shipping 모듈 (9개 서비스)
- [x] Equipment 모듈 (3개 서비스)
- [x] Inventory 모듈 (2개 서비스)
- [x] Customs 모듈 (1개 서비스)
- [x] Outsourcing 모듈 (1개 서비스)
- [x] System 모듈 (1개 서비스)
- [x] Auth 모듈 (1개 서비스)
- [x] User 모듈 (1개 서비스)
- [x] Interface 모듈 (1개 서비스)

### 3. 마이그레이션 스크립트
- [x] Oracle 초기 스키마 SQL
- [x] PostgreSQL → Oracle 데이터 이전 스크립트
- [x] 연결 테스트 스크립트

---

## 🚀 마이그레이션 실행 단계

### 단계 1: 환경 준비

#### 1.1 Oracle Instant Client 설치 (Windows)

```powershell
# 1. Oracle Instant Client 다운로드
# https://www.oracle.com/database/technologies/instant-client/winx64-64-downloads.html
# basic-lite 패키지 다운로드

# 2. 압축 해제
# C:\oracle\instantclient_21_12 에 압축 해제

# 3. 환경 변수 설정 (PowerShell 관리자 권한)
[Environment]::SetEnvironmentVariable("PATH", "C:\oracle\instantclient_21_12;" + $env:PATH, "Machine")
[Environment]::SetEnvironmentVariable("ORACLE_LIB_DIR", "C:\oracle\instantclient_21_12", "Machine")

# 4. 시스템 재시작 또는 새 터미널
```

#### 1.2 의존성 설치

```bash
cd apps/backend

# Prisma 관련 패키지 제거
pnpm uninstall @prisma/client prisma

# TypeORM + Oracle 패키지 설치
pnpm install @nestjs/typeorm@^11.0.0 typeorm@^0.3.20 oracledb@^6.7.0
```

### 단계 2: 환경 변수 설정

`apps/backend/.env` 파일 수정:

```env
# ============================================
# Oracle Database Configuration (TypeORM)
# ============================================
ORACLE_HOST=localhost
ORACLE_PORT=1521
ORACLE_USER=MES_USER
ORACLE_PASSWORD=your_password
ORACLE_SID=ORCL
# ORACLE_SERVICE_NAME=ORCLPDB1

# Oracle Client (optional - for Thick mode)
# ORACLE_CLIENT_LIB=C:\oracle\instantclient_21_12
```

### 단계 3: Oracle DB 연결 테스트

```bash
cd apps/backend
pnpm db:test
```

성공 시:
```
✅ Successfully connected to Oracle database!
✅ Test query result: [ { CURRENT_DATE: ... } ]
✅ All connection tests passed!
```

### 단계 4: Oracle 스키마 생성

SQL*Plus 또는 SQL Developer에서 실행:

```sql
-- SQL*Plus
sqlplus MES_USER/password@localhost:1521/ORCL

-- 마이그레이션 SQL 실행
@apps/backend/src/database/migrations/001-initial-schema.sql
```

또는 TypeORM 자동 동기화 (개발 환경만):

```typescript
// apps/backend/src/database/database.module.ts
// synchronize: true (주의: 프로덕션에서는 사용 금지)
```

### 단계 5: 데이터 마이그레이션

```bash
cd apps/backend
pnpm db:migrate-data
```

진행 상황:
```
📦 Migrating table: part_masters
--------------------------------------------------
   Source records: 15432
   Progress: 15432/15432
   ✅ Completed: 15432 rows in 5.23s
```

### 단계 6: 애플리케이션 실행

```bash
# 백엔드
cd apps/backend
pnpm dev

# 프론트엔드
cd apps/frontend
pnpm dev
```

---

## 📊 마이그레이션 검증

### 데이터 검증 쿼리

```sql
-- 1. 테이블별 레코드 수 확인
SELECT 
  table_name, 
  num_rows 
FROM user_tables 
ORDER BY table_name;

-- 2. 품목 마스터 샘플 확인
SELECT * FROM part_masters WHERE ROWNUM <= 5;

-- 3. 작업지시 상태별 집계
SELECT status, COUNT(*) FROM job_orders GROUP BY status;

-- 4. 재고 총계
SELECT SUM(qty) as total_stock FROM stocks;
```

### API 테스트

```bash
# 로그인 테스트
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@harness.com","password":"admin123"}'

# 품목 목록 조회
curl http://localhost:4000/api/v1/master/parts?page=1&limit=10

# 작업지시 조회
curl http://localhost:4000/api/v1/production/job-orders
```

---

## ⚠️ 주의사항

### 1. 대소문자 처리

Oracle은 기본적으로 대문자를 사용합니다:

```typescript
// TypeORM에서는 column name 매핑으로 처리됨
@Column({ name: 'PART_CODE' })
partCode: string;
```

### 2. JSON 데이터

PostgreSQL `JSON` → Oracle `CLOB`:

```typescript
@Column({ type: 'clob', nullable: true })
commConfig: string;  // JSON.stringify/parse 필요
```

### 3. 날짜/시간

```typescript
// PostgreSQL: Timestamptz(6)
// Oracle: TIMESTAMP WITH TIME ZONE
@Column({ type: 'timestamp with time zone' })
createdAt: Date;
```

### 4. Decimal/Numeric

```typescript
// PostgreSQL: Decimal(10,4)
// Oracle: NUMBER(10,4)
@Column({ type: 'decimal', precision: 10, scale: 4 })
qtyPer: number;
```

### 5. 시퀀스 (Sequence)

Oracle은 `AUTO_INCREMENT`가 없습니다:

```typescript
@PrimaryGeneratedColumn('increment')  // TypeORM이 자동 처리
id: number;

// 또는 시퀀스 직접 사용
@Column({ default: () => 'PART_MASTER_SEQ.NEXTVAL' })
```

---

## 🔧 문제 해결

### ORA-12541: TNS:no listener
```bash
# Oracle Listener 확인
lsnrctl status
lsnrctl start
```

### ORA-12514: TNS:listener does not currently know of service
```bash
# 서비스명 확인
sqlplus / as sysdba
SELECT name FROM v$database;
SELECT pdb_name FROM dba_pdbs;
```

### ORA-01017: invalid username/password
```sql
-- 사용자 확인
sqlplus / as sysdba
ALTER USER MES_USER IDENTIFIED BY new_password;
```

### Unicode/한글 깨짐
```sql
-- 문자셋 확인
SELECT parameter, value FROM nls_database_parameters 
WHERE parameter IN ('NLS_CHARACTERSET', 'NLS_NCHAR_CHARACTERSET');

-- 권장: AL32UTF8
```

---

## 📝 롤백 계획

문제 발생 시 롤백:

```bash
# 1. Git으로 이전 버전 복원
git log --oneline
git checkout <commit-hash>

# 2. PostgreSQL 환경 변수 복원
# .env 파일에서 DATABASE_URL 주석 해제
# ORACLE_* 변수 주석 처리

# 3. 의존성 재설치
pnpm install
npx prisma generate

# 4. 애플리케이션 재시작
```

---

## 📞 지원

문제 발생 시:
1. Oracle 로그 확인: `$ORACLE_BASE/diag/tnslsnr/...`
2. TypeORM 로그 확인: `logging: true` 설정
3. 네트워크 연결 확인: `tnsping ORCL`

---

**작성일**: 2026-02-17  
**버전**: 1.0  
**담당자**: 개발팀
