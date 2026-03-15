# 통합 채번 패키지 (PKG_SEQ_GENERATOR) 구현 계획

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 문서번호/시리얼/바코드 채번을 Oracle 패키지 하나로 통합하고, NestJS 서비스에서 호출하는 구조로 전환

**Architecture:** Oracle 패키지 `PKG_SEQ_GENERATOR`에 채번 규칙 마스터 테이블(`SEQ_RULES`) + 통합 채번 함수(`GET_NO`)를 구현. NestJS의 `UidGeneratorService`를 `SeqGeneratorService`로 리팩터링하여 패키지 호출. 기존 `F_GET_MAT_UID/PRD_UID/CON_UID` 함수는 패키지 래핑으로 하위호환 유지.

**Tech Stack:** Oracle PL/SQL (패키지), NestJS (서비스), TypeORM (엔티티)

---

## 현재 채번 방식 분석

| 대상 | 현재 방식 | 형식 | 위치 |
|------|-----------|------|------|
| 자재 UID | `F_GET_MAT_UID()` | M + YYMMDD + SEQ(5) | Oracle 함수 |
| 제품 UID | `F_GET_PRD_UID()` | P + YYMMDD + SEQ(5) | Oracle 함수 |
| 소모품 UID | `F_GET_CON_UID()` | C + YYMMDD + SEQ(5) | Oracle 함수 |
| 자재불출요청 | `generateRequestNo()` | REQ-YYYYMMDD-NNN | NestJS 서비스 (COUNT 기반) |
| 외주발주 | 인라인 코드 | SCO + YYYYMMDD + NNNN | NestJS 서비스 (COUNT 기반) |
| FG 바코드 | 미구현 | - | - |
| 작업지시 | 미확인 | - | - |

**문제점:** COUNT 기반 채번은 동시성 이슈 + 삭제 시 번호 충돌 가능. Oracle SEQ 기반으로 통합 필요.

---

## Chunk 1: Oracle 패키지 생성

### Task 1: 채번 규칙 마스터 테이블 (SEQ_RULES)

**Files:**
- Create: `scripts/oracle/create_seq_rules.sql`

- [ ] **Step 1: SEQ_RULES 테이블 + 시드 SQL 작성**

```sql
-- 채번 규칙 마스터 테이블
CREATE TABLE SEQ_RULES (
  DOC_TYPE      VARCHAR2(30)  NOT NULL,  -- 문서유형 PK
  PREFIX        VARCHAR2(10)  NOT NULL,  -- 접두어
  SEQ_NAME      VARCHAR2(30)  NOT NULL,  -- Oracle 시퀀스명
  PAD_LENGTH    NUMBER(2)     DEFAULT 5, -- 시퀀스 자릿수
  DATE_FORMAT   VARCHAR2(10)  DEFAULT 'YYMMDD', -- 날짜 포맷 (NULL이면 날짜 없음)
  SEPARATOR     VARCHAR2(2)   DEFAULT '', -- 접두어-날짜-시퀀스 구분자
  DESCRIPTION   VARCHAR2(100),
  USE_YN        VARCHAR2(1)   DEFAULT 'Y',
  COMPANY       VARCHAR2(50)  DEFAULT '40',
  PLANT_CD      VARCHAR2(50)  DEFAULT '1000',
  CREATED_AT    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT PK_SEQ_RULES PRIMARY KEY (DOC_TYPE)
);

-- 시퀀스 생성 (기존 것은 재사용)
CREATE SEQUENCE SEQ_FG_BARCODE START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_JOB_ORDER START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_OQC_REQ START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_MAT_REQ START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_ARRIVAL START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_SHIPMENT START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_SUBCON START WITH 1 INCREMENT BY 1 NOCACHE;

-- 규칙 시드
INSERT INTO SEQ_RULES (DOC_TYPE, PREFIX, SEQ_NAME, PAD_LENGTH, DATE_FORMAT, DESCRIPTION) VALUES ('MAT_UID',     'M',  'MAT_UID_SEQ',      5, 'YYMMDD', '자재 시리얼');
INSERT INTO SEQ_RULES (DOC_TYPE, PREFIX, SEQ_NAME, PAD_LENGTH, DATE_FORMAT, DESCRIPTION) VALUES ('PRD_UID',     'P',  'PRD_UID_SEQ',      5, 'YYMMDD', '제품 시리얼');
INSERT INTO SEQ_RULES (DOC_TYPE, PREFIX, SEQ_NAME, PAD_LENGTH, DATE_FORMAT, DESCRIPTION) VALUES ('CON_UID',     'C',  'CON_UID_SEQ',      5, 'YYMMDD', '소모품 시리얼');
INSERT INTO SEQ_RULES (DOC_TYPE, PREFIX, SEQ_NAME, PAD_LENGTH, DATE_FORMAT, DESCRIPTION) VALUES ('FG_BARCODE',  'FG', 'SEQ_FG_BARCODE',   5, 'YYMMDD', '완제품 바코드');
INSERT INTO SEQ_RULES (DOC_TYPE, PREFIX, SEQ_NAME, PAD_LENGTH, DATE_FORMAT, DESCRIPTION) VALUES ('JOB_ORDER',   'WO', 'SEQ_JOB_ORDER',    4, 'YYMMDD', '작업지시');
INSERT INTO SEQ_RULES (DOC_TYPE, PREFIX, SEQ_NAME, PAD_LENGTH, DATE_FORMAT, DESCRIPTION) VALUES ('OQC_REQ',     'OQ', 'SEQ_OQC_REQ',      4, 'YYMMDD', 'OQC 요청');
INSERT INTO SEQ_RULES (DOC_TYPE, PREFIX, SEQ_NAME, PAD_LENGTH, DATE_FORMAT, DESCRIPTION) VALUES ('MAT_REQ',     'MR', 'SEQ_MAT_REQ',      4, 'YYMMDD', '자재불출요청');
INSERT INTO SEQ_RULES (DOC_TYPE, PREFIX, SEQ_NAME, PAD_LENGTH, DATE_FORMAT, DESCRIPTION) VALUES ('ARRIVAL',     'AR', 'SEQ_ARRIVAL',      4, 'YYMMDD', '입하번호');
INSERT INTO SEQ_RULES (DOC_TYPE, PREFIX, SEQ_NAME, PAD_LENGTH, DATE_FORMAT, DESCRIPTION) VALUES ('SHIPMENT',    'SH', 'SEQ_SHIPMENT',     4, 'YYMMDD', '출하번호');
INSERT INTO SEQ_RULES (DOC_TYPE, PREFIX, SEQ_NAME, PAD_LENGTH, DATE_FORMAT, DESCRIPTION) VALUES ('SUBCON',      'SC', 'SEQ_SUBCON',       4, 'YYMMDD', '외주발주');

COMMIT;
```

- [ ] **Step 2: JSHANES DB에 실행** (oracle-db 스킬, --site JSHANES)
- [ ] **Step 3: 데이터 확인** — `SELECT * FROM SEQ_RULES ORDER BY DOC_TYPE`

### Task 2: PKG_SEQ_GENERATOR 패키지 생성

**Files:**
- Create: `scripts/oracle/pkg_seq_generator.sql`

- [ ] **Step 1: 패키지 스펙 + 바디 SQL 작성**

```sql
CREATE OR REPLACE PACKAGE PKG_SEQ_GENERATOR AS
  /*
   * 통합 채번 패키지
   * - GET_NO: 문서유형별 번호 채번
   * - SEQ_RULES 테이블에서 규칙 조회 → 시퀀스 + 접두어 + 날짜 조합
   */
  FUNCTION GET_NO(p_doc_type VARCHAR2) RETURN VARCHAR2;
END PKG_SEQ_GENERATOR;
/

CREATE OR REPLACE PACKAGE BODY PKG_SEQ_GENERATOR AS

  FUNCTION GET_NO(p_doc_type VARCHAR2) RETURN VARCHAR2 IS
    v_prefix      VARCHAR2(10);
    v_seq_name    VARCHAR2(30);
    v_pad_length  NUMBER(2);
    v_date_fmt    VARCHAR2(10);
    v_separator   VARCHAR2(2);
    v_seq         NUMBER;
    v_result      VARCHAR2(50);
  BEGIN
    -- 1. 규칙 조회
    SELECT PREFIX, SEQ_NAME, PAD_LENGTH, DATE_FORMAT, NVL(SEPARATOR, '')
      INTO v_prefix, v_seq_name, v_pad_length, v_date_fmt, v_separator
      FROM SEQ_RULES
     WHERE DOC_TYPE = p_doc_type
       AND USE_YN = 'Y';

    -- 2. 시퀀스 채번 (동적 SQL)
    EXECUTE IMMEDIATE 'SELECT ' || v_seq_name || '.NEXTVAL FROM DUAL' INTO v_seq;

    -- 3. 번호 조합: PREFIX + SEPARATOR + DATE + SEPARATOR + SEQ
    IF v_date_fmt IS NOT NULL THEN
      v_result := v_prefix || v_separator || TO_CHAR(SYSDATE, v_date_fmt) || v_separator || LPAD(v_seq, v_pad_length, '0');
    ELSE
      v_result := v_prefix || v_separator || LPAD(v_seq, v_pad_length, '0');
    END IF;

    RETURN v_result;

  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(-20001, 'SEQ_RULES에 등록되지 않은 문서유형: ' || p_doc_type);
  END GET_NO;

END PKG_SEQ_GENERATOR;
/
```

- [ ] **Step 2: JSHANES DB에 배포** (`deploy_package.py --site JSHANES`)
- [ ] **Step 3: 컴파일 상태 확인** — VALID 확인
- [ ] **Step 4: 테스트 실행**

```sql
SELECT PKG_SEQ_GENERATOR.GET_NO('MAT_UID') AS MAT FROM DUAL;
SELECT PKG_SEQ_GENERATOR.GET_NO('FG_BARCODE') AS FG FROM DUAL;
SELECT PKG_SEQ_GENERATOR.GET_NO('JOB_ORDER') AS WO FROM DUAL;
```

### Task 3: 기존 함수 래핑 (하위호환)

**Files:**
- Create: `scripts/oracle/wrap_legacy_functions.sql`

- [ ] **Step 1: 기존 함수를 패키지 호출로 교체**

```sql
CREATE OR REPLACE FUNCTION F_GET_MAT_UID RETURN VARCHAR2 IS
BEGIN
  RETURN PKG_SEQ_GENERATOR.GET_NO('MAT_UID');
END;
/

CREATE OR REPLACE FUNCTION F_GET_PRD_UID RETURN VARCHAR2 IS
BEGIN
  RETURN PKG_SEQ_GENERATOR.GET_NO('PRD_UID');
END;
/

CREATE OR REPLACE FUNCTION F_GET_CON_UID RETURN VARCHAR2 IS
BEGIN
  RETURN PKG_SEQ_GENERATOR.GET_NO('CON_UID');
END;
/
```

- [ ] **Step 2: 배포** (각각 `deploy_plsql.py`)
- [ ] **Step 3: 기존 기능 검증** — 기존 F_GET_MAT_UID 호출이 동일하게 작동 확인

---

## Chunk 2: NestJS 서비스 리팩터링

### Task 4: SeqGeneratorService 생성

**Files:**
- Create: `apps/backend/src/shared/seq-generator.service.ts`
- Modify: `apps/backend/src/shared/uid-generator.service.ts` (패키지 호출로 전환)

- [ ] **Step 1: SeqGeneratorService 작성**

```typescript
/**
 * @file seq-generator.service.ts
 * @description 통합 채번 서비스 - Oracle PKG_SEQ_GENERATOR.GET_NO() 호출
 *
 * 초보자 가이드:
 * 1. getNo(docType): 문서유형별 번호 채번 (MAT_UID, FG_BARCODE, JOB_ORDER 등)
 * 2. Oracle 패키지가 SEQ_RULES 테이블에서 규칙 조회 → 시퀀스 + 접두어 + 날짜 조합
 * 3. 트랜잭션 내 호출 시 QueryRunner 전달
 */
import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

@Injectable()
export class SeqGeneratorService {
  constructor(private readonly dataSource: DataSource) {}

  /** 통합 채번: PKG_SEQ_GENERATOR.GET_NO 호출 */
  async getNo(docType: string, qr?: QueryRunner): Promise<string> {
    const manager = qr?.manager ?? this.dataSource.manager;
    const result = await manager.query(
      `SELECT PKG_SEQ_GENERATOR.GET_NO(:1) AS "no" FROM DUAL`,
      [docType],
    );
    return result[0].no;
  }

  // 하위호환 편의 메서드
  async nextMatUid(qr?: QueryRunner): Promise<string> { return this.getNo('MAT_UID', qr); }
  async nextPrdUid(qr?: QueryRunner): Promise<string> { return this.getNo('PRD_UID', qr); }
  async nextConUid(qr?: QueryRunner): Promise<string> { return this.getNo('CON_UID', qr); }
  async nextFgBarcode(qr?: QueryRunner): Promise<string> { return this.getNo('FG_BARCODE', qr); }
  async nextJobOrderNo(qr?: QueryRunner): Promise<string> { return this.getNo('JOB_ORDER', qr); }
  async nextOqcReqNo(qr?: QueryRunner): Promise<string> { return this.getNo('OQC_REQ', qr); }
  async nextMatReqNo(qr?: QueryRunner): Promise<string> { return this.getNo('MAT_REQ', qr); }
  async nextArrivalNo(qr?: QueryRunner): Promise<string> { return this.getNo('ARRIVAL', qr); }
  async nextShipmentNo(qr?: QueryRunner): Promise<string> { return this.getNo('SHIPMENT', qr); }
  async nextSubconNo(qr?: QueryRunner): Promise<string> { return this.getNo('SUBCON', qr); }
}
```

- [ ] **Step 2: SharedModule에 SeqGeneratorService 등록**

`apps/backend/src/shared/shared.module.ts`에 provider + export 추가.

- [ ] **Step 3: UidGeneratorService를 SeqGeneratorService로 교체**

기존 `UidGeneratorService`를 사용하는 곳을 `SeqGeneratorService`로 변경:
- `apps/backend/src/modules/material/services/receive-label.service.ts` — `nextMatUid`
- `apps/backend/src/modules/production/services/product-label.service.ts` — `nextPrdUid`
- `apps/backend/src/modules/consumables/services/consumable-label.service.ts` — `nextConUid`

각 파일에서 import + constructor 주입을 `UidGeneratorService` → `SeqGeneratorService`로 변경.
메서드명은 동일 (`nextMatUid`, `nextPrdUid`, `nextConUid`)이므로 호출부 수정 불필요.

- [ ] **Step 4: COUNT 기반 채번 제거**

`apps/backend/src/modules/material/services/issue-request.service.ts`:
- `generateRequestNo()` 메서드 삭제
- `SeqGeneratorService.nextMatReqNo(queryRunner)` 호출로 교체

`apps/backend/src/modules/outsourcing/services/outsourcing.service.ts`:
- 인라인 `SCO${today}${String(count+1).padStart(4,'0')}` 코드 삭제
- `SeqGeneratorService.nextSubconNo(queryRunner)` 호출로 교체

- [ ] **Step 5: 커밋**

---

## Chunk 3: SEQ_RULES 엔티티 + 관리 API (선택)

### Task 5: SEQ_RULES 엔티티

**Files:**
- Create: `apps/backend/src/entities/seq-rule.entity.ts`

- [ ] **Step 1: 엔티티 작성**

```typescript
@Entity({ name: 'SEQ_RULES' })
export class SeqRule {
  @PrimaryColumn({ name: 'DOC_TYPE', length: 30 })
  docType: string;

  @Column({ name: 'PREFIX', length: 10 })
  prefix: string;

  @Column({ name: 'SEQ_NAME', length: 30 })
  seqName: string;

  @Column({ name: 'PAD_LENGTH', type: 'int', default: 5 })
  padLength: number;

  @Column({ name: 'DATE_FORMAT', length: 10, nullable: true })
  dateFormat: string | null;

  @Column({ name: 'SEPARATOR', length: 2, default: '' })
  separator: string;

  @Column({ name: 'DESCRIPTION', length: 100, nullable: true })
  description: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  // company, plant, createdAt ...
}
```

향후 시스템 설정 화면에서 채번 규칙을 관리할 수 있도록 엔티티만 준비.

---

## 구현 순서 요약

| 순서 | Task | 설명 | 의존성 |
|:----:|:----:|------|--------|
| 1 | Task 1 | SEQ_RULES 테이블 + 시퀀스 생성 (Oracle) | 없음 |
| 2 | Task 2 | PKG_SEQ_GENERATOR 패키지 생성 (Oracle) | Task 1 |
| 3 | Task 3 | 기존 함수 래핑 (하위호환) | Task 2 |
| 4 | Task 4 | NestJS SeqGeneratorService + 기존 코드 리팩터링 | Task 2 |
| 5 | Task 5 | SEQ_RULES 엔티티 (선택) | Task 1 |
