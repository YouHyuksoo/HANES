# Oracle PL/SQL Tier 1 구현 계획 — 채번 함수 + KPI 집계

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Oracle PL/SQL 함수/프로시저로 채번(FN_NEXT_NUMBER)과 대시보드 KPI 집계(FN_DASHBOARD_KPI)를 구현하여 동시성 안전 + 성능 최적화

**Architecture:** Oracle DB에 PL/SQL 패키지(PKG_NUM_RULE, PKG_DASHBOARD)를 생성하고, NestJS 서비스에서 `dataSource.query()`로 호출하는 하이브리드 구조. 채번은 SELECT FOR UPDATE로 동시성 보장, KPI는 8개 쿼리를 2개 함수 호출로 통합.

**Tech Stack:** Oracle PL/SQL, TypeORM (dataSource.query), NestJS

---

## 배경 — 현재 문제점

### 채번 시스템
- `NumRuleMaster` 엔티티가 정의되어 있지만 **완전 미사용**
- 모든 번호가 `Date.now().toString(36) + Math.random()` 임시 생성 (11곳)
- 동시 요청 시 **중복 번호 발생 가능** (밀리초 충돌)
- 채번 대상: arrivalNo, transNo, lotNo, receiveNo, issueNo

### 대시보드 KPI
- 4개 KPI × 오늘/어제 = **8개 독립 쿼리** 실행
- Promise.all()로 병렬이지만, DB 커넥션 8개 동시 점유
- 오늘/어제 비교를 CASE WHEN으로 **1개 쿼리로 통합** 가능

---

## 사전 조건

- Oracle DB에 `NUM_RULE_MASTERS` 테이블이 존재해야 함 (TypeORM synchronize로 생성됨)
- `oracle-db` 스킬로 DDL 실행 가능한 환경

---

## Task 1: Oracle 패키지 PKG_NUM_RULE 생성 (채번)

**Files:**
- Create: `apps/backend/sql/packages/PKG_NUM_RULE.pks` (패키지 스펙)
- Create: `apps/backend/sql/packages/PKG_NUM_RULE.pkb` (패키지 바디)

**Step 1: SQL 디렉토리 구조 생성**

```bash
mkdir -p apps/backend/sql/packages
```

**Step 2: PKG_NUM_RULE 패키지 스펙 작성**

파일: `apps/backend/sql/packages/PKG_NUM_RULE.pks`

```sql
CREATE OR REPLACE PACKAGE PKG_NUM_RULE AS
  /**
   * @package PKG_NUM_RULE
   * @description 채번 패키지 — 시퀀스 기반 번호 자동 생성
   *
   * 초보자 가이드:
   * 1. FN_NEXT_NUMBER: 규칙 유형별 다음 번호 생성 (SELECT FOR UPDATE로 동시성 보장)
   * 2. 리셋 로직: DAILY/MONTHLY/YEARLY/NONE에 따라 시퀀스 자동 초기화
   * 3. 패턴 치환: {PREFIX}{YYYY}{MM}{DD}-{SEQ} → ARR20260224-0001
   */

  -- 다음 번호 생성 (핵심 함수)
  -- p_rule_type: NUM_RULE_MASTERS.RULE_TYPE (예: 'ARRIVAL', 'RECEIVE', 'MAT_ISSUE', 'LOT', 'STOCK_TX')
  -- p_user_id: 감사 로그용 사용자 ID
  -- RETURN: 생성된 번호 문자열 (예: 'ARR20260224-0001')
  FUNCTION FN_NEXT_NUMBER(
    p_rule_type IN VARCHAR2,
    p_user_id   IN VARCHAR2 DEFAULT 'SYSTEM'
  ) RETURN VARCHAR2;

END PKG_NUM_RULE;
/
```

**Step 3: PKG_NUM_RULE 패키지 바디 작성**

파일: `apps/backend/sql/packages/PKG_NUM_RULE.pkb`

```sql
CREATE OR REPLACE PACKAGE BODY PKG_NUM_RULE AS

  FUNCTION FN_NEXT_NUMBER(
    p_rule_type IN VARCHAR2,
    p_user_id   IN VARCHAR2 DEFAULT 'SYSTEM'
  ) RETURN VARCHAR2
  IS
    v_id           VARCHAR2(36);
    v_pattern      VARCHAR2(100);
    v_prefix       VARCHAR2(20);
    v_suffix       VARCHAR2(20);
    v_seq_length   NUMBER;
    v_current_seq  NUMBER;
    v_reset_type   VARCHAR2(20);
    v_last_reset   DATE;
    v_new_seq      NUMBER;
    v_result       VARCHAR2(200);
    v_today        DATE := TRUNC(SYSDATE);
    v_need_reset   CHAR(1) := 'N';
  BEGIN
    -- 1) 규칙 조회 + 행 잠금 (SELECT FOR UPDATE → 동시성 보장 핵심!)
    SELECT "ID", "PATTERN", "PREFIX", "SUFFIX", "SEQ_LENGTH",
           "CURRENT_SEQ", "RESET_TYPE", "LAST_RESET"
      INTO v_id, v_pattern, v_prefix, v_suffix, v_seq_length,
           v_current_seq, v_reset_type, v_last_reset
      FROM "NUM_RULE_MASTERS"
     WHERE "RULE_TYPE" = p_rule_type
       AND "USE_YN" = 'Y'
       AND "DELETED_AT" IS NULL
       FOR UPDATE;  -- 다른 세션은 이 행이 커밋될 때까지 대기

    -- 2) 리셋 판단
    IF v_reset_type = 'DAILY' AND (v_last_reset IS NULL OR TRUNC(v_last_reset) < v_today) THEN
      v_need_reset := 'Y';
    ELSIF v_reset_type = 'MONTHLY' AND (v_last_reset IS NULL OR TRUNC(v_last_reset, 'MM') < TRUNC(v_today, 'MM')) THEN
      v_need_reset := 'Y';
    ELSIF v_reset_type = 'YEARLY' AND (v_last_reset IS NULL OR TRUNC(v_last_reset, 'YYYY') < TRUNC(v_today, 'YYYY')) THEN
      v_need_reset := 'Y';
    END IF;

    -- 3) 시퀀스 계산
    IF v_need_reset = 'Y' THEN
      v_new_seq := 1;
    ELSE
      v_new_seq := v_current_seq + 1;
    END IF;

    -- 4) NUM_RULE_MASTERS 업데이트 (시퀀스 + 리셋 일자)
    UPDATE "NUM_RULE_MASTERS"
       SET "CURRENT_SEQ" = v_new_seq,
           "LAST_RESET"  = v_today,
           "UPDATED_BY"  = p_user_id,
           "UPDATED_AT"  = SYSTIMESTAMP
     WHERE "ID" = v_id;

    -- 5) 패턴 치환하여 최종 번호 생성
    --    지원 토큰: {YYYY}, {MM}, {DD}, {SEQ}
    v_result := v_pattern;
    v_result := REPLACE(v_result, '{YYYY}', TO_CHAR(v_today, 'YYYY'));
    v_result := REPLACE(v_result, '{MM}',   TO_CHAR(v_today, 'MM'));
    v_result := REPLACE(v_result, '{DD}',   TO_CHAR(v_today, 'DD'));
    v_result := REPLACE(v_result, '{SEQ}',  LPAD(TO_CHAR(v_new_seq), v_seq_length, '0'));

    -- 6) PREFIX / SUFFIX 적용
    IF v_prefix IS NOT NULL THEN
      v_result := v_prefix || v_result;
    END IF;
    IF v_suffix IS NOT NULL THEN
      v_result := v_result || v_suffix;
    END IF;

    RETURN v_result;

  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(-20001, 'NUM_RULE not found for type: ' || p_rule_type);
    WHEN OTHERS THEN
      RAISE_APPLICATION_ERROR(-20002, 'FN_NEXT_NUMBER error: ' || SQLERRM);
  END FN_NEXT_NUMBER;

END PKG_NUM_RULE;
/
```

**Step 4: oracle-db 스킬로 패키지 생성 실행**

```
oracle-db 스킬 사용:
1. PKG_NUM_RULE.pks (스펙) 실행
2. PKG_NUM_RULE.pkb (바디) 실행
3. 컴파일 오류 확인: SELECT * FROM USER_ERRORS WHERE NAME = 'PKG_NUM_RULE'
```

**Step 5: 커밋**

```bash
git add apps/backend/sql/packages/PKG_NUM_RULE.pks apps/backend/sql/packages/PKG_NUM_RULE.pkb
git commit -m "feat: Oracle PKG_NUM_RULE 패키지 생성 — SELECT FOR UPDATE 기반 채번 함수"
```

---

## Task 2: 채번 시드 데이터 등록

**Files:**
- Create: `apps/backend/src/seeds/seed-num-rules.ts`

**Step 1: 시드 스크립트 작성**

현재 사용 중인 번호 유형 기반으로 NUM_RULE_MASTERS에 규칙 등록:

| RULE_TYPE | PREFIX | PATTERN | SEQ_LENGTH | RESET_TYPE | 결과 예시 |
|-----------|--------|---------|------------|------------|-----------|
| ARRIVAL | ARR | {YYYY}{MM}{DD}-{SEQ} | 4 | DAILY | ARR20260224-0001 |
| STOCK_TX | TX | {YYYY}{MM}{DD}-{SEQ} | 5 | DAILY | TX20260224-00001 |
| LOT | L | {YYYY}{MM}{DD}-{SEQ} | 4 | DAILY | L20260224-0001 |
| RECEIVE | RCV | {YYYY}{MM}{DD}-{SEQ} | 4 | DAILY | RCV20260224-0001 |
| MAT_ISSUE | ISS | {YYYY}{MM}{DD}-{SEQ} | 4 | DAILY | ISS20260224-0001 |
| CANCEL_TX | CAN | {YYYY}{MM}{DD}-{SEQ} | 4 | DAILY | CAN20260224-0001 |

파일: `apps/backend/src/seeds/seed-num-rules.ts`

```typescript
/**
 * @file src/seeds/seed-num-rules.ts
 * @description 채번 규칙(NUM_RULE_MASTERS) 시드 스크립트
 *
 * 초보자 가이드:
 * 1. PKG_NUM_RULE.FN_NEXT_NUMBER에서 사용할 채번 규칙을 등록
 * 2. UPSERT: RULE_TYPE 기준으로 이미 존재하면 건너뜀
 * 3. 패턴 토큰: {YYYY}=연도, {MM}=월, {DD}=일, {SEQ}=시퀀스
 *
 * 실행: cd apps/backend && npx ts-node src/seeds/seed-num-rules.ts
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

interface NumRuleSeed {
  ruleType: string;
  ruleName: string;
  pattern: string;
  prefix: string | null;
  suffix: string | null;
  seqLength: number;
  resetType: string;
}

const RULES: NumRuleSeed[] = [
  { ruleType: 'ARRIVAL',   ruleName: '입하번호',     pattern: '{YYYY}{MM}{DD}-{SEQ}', prefix: 'ARR', suffix: null, seqLength: 4, resetType: 'DAILY' },
  { ruleType: 'STOCK_TX',  ruleName: '수불번호',     pattern: '{YYYY}{MM}{DD}-{SEQ}', prefix: 'TX',  suffix: null, seqLength: 5, resetType: 'DAILY' },
  { ruleType: 'LOT',       ruleName: 'LOT번호',      pattern: '{YYYY}{MM}{DD}-{SEQ}', prefix: 'L',   suffix: null, seqLength: 4, resetType: 'DAILY' },
  { ruleType: 'RECEIVE',   ruleName: '입고번호',     pattern: '{YYYY}{MM}{DD}-{SEQ}', prefix: 'RCV', suffix: null, seqLength: 4, resetType: 'DAILY' },
  { ruleType: 'MAT_ISSUE', ruleName: '출고번호',     pattern: '{YYYY}{MM}{DD}-{SEQ}', prefix: 'ISS', suffix: null, seqLength: 4, resetType: 'DAILY' },
  { ruleType: 'CANCEL_TX', ruleName: '취소수불번호', pattern: '{YYYY}{MM}{DD}-{SEQ}', prefix: 'CAN', suffix: null, seqLength: 4, resetType: 'DAILY' },
];

async function seedNumRules(): Promise<void> {
  console.log('='.repeat(60));
  console.log('  HARNESS MES - Num Rule Seed');
  console.log('='.repeat(60));

  const dataSource = new DataSource({
    type: 'oracle',
    host: process.env.ORACLE_HOST || 'localhost',
    port: parseInt(process.env.ORACLE_PORT || '1521', 10),
    username: process.env.ORACLE_USER || 'HNSMES',
    password: process.env.ORACLE_PASSWORD || '',
    ...(process.env.ORACLE_SID
      ? { sid: process.env.ORACLE_SID }
      : { serviceName: process.env.ORACLE_SERVICE_NAME || 'JSHNSMES' }),
    synchronize: false,
    logging: false,
    entities: [],
  });

  try {
    await dataSource.initialize();
    console.log('  Connected.\n');

    let inserted = 0;
    let skipped = 0;

    for (const rule of RULES) {
      const existing = await dataSource.query(
        `SELECT "ID" FROM "NUM_RULE_MASTERS" WHERE "RULE_TYPE" = :1 AND "DELETED_AT" IS NULL`,
        [rule.ruleType],
      );

      if (existing.length > 0) {
        console.log(`  [SKIP] ${rule.ruleType}`);
        skipped++;
      } else {
        await dataSource.query(
          `INSERT INTO "NUM_RULE_MASTERS"
           ("ID","RULE_TYPE","RULE_NAME","PATTERN","PREFIX","SUFFIX","SEQ_LENGTH","CURRENT_SEQ","RESET_TYPE","LAST_RESET","USE_YN","CREATED_BY","UPDATED_BY","CREATED_AT","UPDATED_AT")
           VALUES (SYS_GUID(), :1, :2, :3, :4, :5, :6, 0, :7, NULL, 'Y', 'SEED', 'SEED', SYSTIMESTAMP, SYSTIMESTAMP)`,
          [rule.ruleType, rule.ruleName, rule.pattern, rule.prefix, rule.suffix, rule.seqLength, rule.resetType],
        );
        console.log(`  [INSERT] ${rule.ruleType}`);
        inserted++;
      }
    }

    console.log(`\n  Inserted: ${inserted}, Skipped: ${skipped}`);
    console.log('  Done!');
  } catch (error: any) {
    console.error('  Seed failed:', error.message);
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

if (require.main === module) seedNumRules();
export { seedNumRules };
```

**Step 2: 시드 실행**

```bash
cd apps/backend && npx ts-node src/seeds/seed-num-rules.ts
```

**Step 3: 커밋**

```bash
git add apps/backend/src/seeds/seed-num-rules.ts
git commit -m "feat: 채번 규칙 시드 데이터 6종 등록"
```

---

## Task 3: NestJS NumRuleService 구현 — PL/SQL 호출 래퍼

**Files:**
- Create: `apps/backend/src/modules/num-rule/num-rule.service.ts`
- Create: `apps/backend/src/modules/num-rule/num-rule.module.ts`
- Modify: `apps/backend/src/app.module.ts`

**Step 1: NumRuleService 작성**

파일: `apps/backend/src/modules/num-rule/num-rule.service.ts`

```typescript
/**
 * @file src/modules/num-rule/num-rule.service.ts
 * @description 채번 서비스 — Oracle PKG_NUM_RULE.FN_NEXT_NUMBER 호출 래퍼
 *
 * 초보자 가이드:
 * 1. **nextNumber()**: PL/SQL 함수를 호출하여 다음 번호 생성
 * 2. **트랜잭션 안전**: Oracle SELECT FOR UPDATE가 동시성 보장
 * 3. **자동 리셋**: 일별/월별/연별 시퀀스 자동 초기화 (PL/SQL 내부 처리)
 * 4. **사용법**: 각 서비스에서 DI로 주입하여 this.numRuleService.nextNumber('ARRIVAL') 호출
 */

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class NumRuleService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * 다음 채번 번호 생성
   * @param ruleType NUM_RULE_MASTERS.RULE_TYPE (예: 'ARRIVAL', 'RECEIVE', 'LOT')
   * @param userId 감사 로그용 사용자 ID (기본: 'SYSTEM')
   * @returns 생성된 번호 문자열 (예: 'ARR20260224-0001')
   */
  async nextNumber(ruleType: string, userId: string = 'SYSTEM'): Promise<string> {
    try {
      const result = await this.dataSource.query(
        `SELECT PKG_NUM_RULE.FN_NEXT_NUMBER(:1, :2) AS "NUM" FROM DUAL`,
        [ruleType, userId],
      );
      return result[0]?.NUM;
    } catch (error: any) {
      // ORA-20001: 규칙 미존재, ORA-20002: 기타 오류
      const msg = error.message || '';
      if (msg.includes('ORA-20001')) {
        throw new InternalServerErrorException(`채번 규칙 미등록: ${ruleType}`);
      }
      throw new InternalServerErrorException(`채번 실패 [${ruleType}]: ${msg}`);
    }
  }

  /**
   * 트랜잭션 내에서 채번 (QueryRunner 사용 시)
   * — 호출자의 트랜잭션에 참여하여 롤백 시 시퀀스도 복원되지 않음 (의도된 동작: 결번 허용)
   */
  async nextNumberInTx(
    queryRunner: import('typeorm').QueryRunner,
    ruleType: string,
    userId: string = 'SYSTEM',
  ): Promise<string> {
    try {
      const result = await queryRunner.query(
        `SELECT PKG_NUM_RULE.FN_NEXT_NUMBER(:1, :2) AS "NUM" FROM DUAL`,
        [ruleType, userId],
      );
      return result[0]?.NUM;
    } catch (error: any) {
      const msg = error.message || '';
      if (msg.includes('ORA-20001')) {
        throw new InternalServerErrorException(`채번 규칙 미등록: ${ruleType}`);
      }
      throw new InternalServerErrorException(`채번 실패 [${ruleType}]: ${msg}`);
    }
  }
}
```

**Step 2: NumRuleModule 작성**

파일: `apps/backend/src/modules/num-rule/num-rule.module.ts`

```typescript
/**
 * @file src/modules/num-rule/num-rule.module.ts
 * @description 채번 모듈 — PKG_NUM_RULE 기반 번호 생성 서비스 제공
 *
 * 초보자 가이드:
 * 1. NumRuleService를 export하여 다른 모듈에서 DI 가능
 * 2. 사용 시: imports에 NumRuleModule 추가 → constructor에서 NumRuleService 주입
 */

import { Module } from '@nestjs/common';
import { NumRuleService } from './num-rule.service';

@Module({
  providers: [NumRuleService],
  exports: [NumRuleService],
})
export class NumRuleModule {}
```

**Step 3: app.module.ts에 NumRuleModule 등록**

파일: `apps/backend/src/app.module.ts`

```typescript
// 기존 import 목록에 추가
import { NumRuleModule } from './modules/num-rule/num-rule.module';

// imports 배열에 추가 (DashboardModule 근처)
NumRuleModule,
```

**Step 4: 커밋**

```bash
git add apps/backend/src/modules/num-rule/ apps/backend/src/app.module.ts
git commit -m "feat: NumRuleService — PKG_NUM_RULE 호출 래퍼 구현"
```

---

## Task 4: 기존 서비스 채번 교체 — arrival, receiving, mat-issue

**Files:**
- Modify: `apps/backend/src/modules/material/material.module.ts` (NumRuleModule import 추가)
- Modify: `apps/backend/src/modules/material/services/arrival.service.ts` (11곳 중 5곳 교체)
- Modify: `apps/backend/src/modules/material/services/receiving.service.ts` (2곳 교체)
- Modify: `apps/backend/src/modules/material/services/mat-issue.service.ts` (3곳 교체)

**Step 1: material.module.ts에 NumRuleModule import**

```typescript
import { NumRuleModule } from '../num-rule/num-rule.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([...]),
    NumRuleModule,  // 추가
  ],
  ...
})
```

**Step 2: arrival.service.ts 교체**

constructor에 `NumRuleService` 주입 추가:
```typescript
import { NumRuleService } from '../../num-rule/num-rule.service';

constructor(
  // ... 기존 주입들 ...
  private readonly numRuleService: NumRuleService,
) {}
```

기존 임시 채번을 PL/SQL 호출로 교체:

```typescript
// 변경 전 (Line ~172):
// const arrivalNo = `ARR-${Date.now().toString(36).toUpperCase()}-${Math.random()...}`;
// 변경 후:
const arrivalNo = await this.numRuleService.nextNumberInTx(queryRunner, 'ARRIVAL', userId);

// 변경 전 (Line ~175, 루프 내):
// const transNo = `ARR-${Date.now().toString(36).toUpperCase()}-${Math.random()...}`;
// 변경 후:
const transNo = await this.numRuleService.nextNumberInTx(queryRunner, 'STOCK_TX', userId);

// 변경 전 (Line ~176, LOT):
// const lotNo = item.lotNo || `L${new Date()...}`;
// 변경 후:
const lotNo = item.lotNo || await this.numRuleService.nextNumberInTx(queryRunner, 'LOT', userId);
```

입하 취소 메서드에서도 동일 교체 (Line ~277-279).

**Step 3: receiving.service.ts 교체**

constructor에 `NumRuleService` 주입 추가.

```typescript
// 변경 전 (Line ~168):
// const receiveNo = `RCV-${Date.now()...}`;
// 변경 후:
const receiveNo = await this.numRuleService.nextNumberInTx(queryRunner, 'RECEIVE', userId);

// 변경 전 (Line ~171, 루프 내):
// const transNo = `RCV-${Date.now()...}`;
// 변경 후:
const transNo = await this.numRuleService.nextNumberInTx(queryRunner, 'STOCK_TX', userId);
```

**Step 4: mat-issue.service.ts 교체**

constructor에 `NumRuleService` 주입 추가.

```typescript
// 변경 전 (Line ~118):
// const issueNo = `ISS-${Date.now()...}`;
// 변경 후:
const issueNo = await this.numRuleService.nextNumberInTx(queryRunner, 'MAT_ISSUE', userId);

// 변경 전 (Line ~156, 루프 내):
// const transNo = `ISS-${Date.now()...}`;
// 변경 후:
const transNo = await this.numRuleService.nextNumberInTx(queryRunner, 'STOCK_TX', userId);

// 변경 전 (Line ~278, 취소):
// const cancelTransNo = `CAN-${Date.now()...}`;
// 변경 후:
const cancelTransNo = await this.numRuleService.nextNumberInTx(queryRunner, 'CANCEL_TX', userId);
```

**Step 5: 커밋**

```bash
git add apps/backend/src/modules/material/
git commit -m "refactor: 자재 서비스 채번을 PKG_NUM_RULE.FN_NEXT_NUMBER로 교체"
```

---

## Task 5: Oracle 패키지 PKG_DASHBOARD 생성 (KPI 집계)

**Files:**
- Create: `apps/backend/sql/packages/PKG_DASHBOARD.pks`
- Create: `apps/backend/sql/packages/PKG_DASHBOARD.pkb`

**Step 1: PKG_DASHBOARD 패키지 스펙 작성**

파일: `apps/backend/sql/packages/PKG_DASHBOARD.pks`

```sql
CREATE OR REPLACE PACKAGE PKG_DASHBOARD AS
  /**
   * @package PKG_DASHBOARD
   * @description 대시보드 KPI 집계 패키지
   *
   * 초보자 가이드:
   * 1. FN_KPI_JSON: 4가지 KPI를 단일 호출로 JSON 문자열 반환
   *    - todayProduction: 오늘 양품 합계 + 전일 대비 변화율
   *    - inventoryStatus: 현재 총 재고 + 변화율
   *    - qualityPassRate: 오늘 합격률 + 전일 대비 변화율
   *    - interlockCount: 오늘 불량 건수 + 전일 대비 변화율
   * 2. 기존 8개 쿼리 → 4개 쿼리로 통합 (오늘/어제 CASE WHEN)
   */

  -- KPI 4종을 JSON 문자열로 반환
  FUNCTION FN_KPI_JSON RETURN CLOB;

END PKG_DASHBOARD;
/
```

**Step 2: PKG_DASHBOARD 패키지 바디 작성**

파일: `apps/backend/sql/packages/PKG_DASHBOARD.pkb`

```sql
CREATE OR REPLACE PACKAGE BODY PKG_DASHBOARD AS

  FUNCTION FN_KPI_JSON RETURN CLOB
  IS
    -- 생산량
    v_prod_today     NUMBER := 0;
    v_prod_yesterday NUMBER := 0;
    v_prod_change    NUMBER := 0;

    -- 재고
    v_inv_total      NUMBER := 0;

    -- 품질
    v_qc_today_total NUMBER := 0;
    v_qc_today_pass  NUMBER := 0;
    v_qc_yest_total  NUMBER := 0;
    v_qc_yest_pass   NUMBER := 0;
    v_qc_today_rate  NUMBER := 100;
    v_qc_yest_rate   NUMBER := 100;
    v_qc_change      NUMBER := 0;

    -- 불량
    v_def_today      NUMBER := 0;
    v_def_yesterday  NUMBER := 0;
    v_def_change     NUMBER := 0;

    v_json CLOB;
  BEGIN
    -- 1) 생산량: 오늘 + 어제를 1개 쿼리로
    SELECT NVL(SUM(CASE WHEN TRUNC("PLAN_DATE") = TRUNC(SYSDATE)     THEN "GOOD_QTY" ELSE 0 END), 0),
           NVL(SUM(CASE WHEN TRUNC("PLAN_DATE") = TRUNC(SYSDATE) - 1 THEN "GOOD_QTY" ELSE 0 END), 0)
      INTO v_prod_today, v_prod_yesterday
      FROM "JOB_ORDERS"
     WHERE TRUNC("PLAN_DATE") >= TRUNC(SYSDATE) - 1
       AND "DELETED_AT" IS NULL;

    IF v_prod_yesterday > 0 THEN
      v_prod_change := ROUND((v_prod_today - v_prod_yesterday) / v_prod_yesterday * 100);
    END IF;

    -- 2) 재고: 단일 쿼리
    SELECT NVL(SUM("QTY"), 0)
      INTO v_inv_total
      FROM "MAT_STOCKS";

    -- 3) 품질 합격률: 오늘 + 어제를 1개 쿼리로
    SELECT NVL(SUM(CASE WHEN TRUNC("INSPECT_TIME") = TRUNC(SYSDATE) THEN 1 ELSE 0 END), 0),
           NVL(SUM(CASE WHEN TRUNC("INSPECT_TIME") = TRUNC(SYSDATE) AND "PASS_YN" = 'Y' THEN 1 ELSE 0 END), 0),
           NVL(SUM(CASE WHEN TRUNC("INSPECT_TIME") = TRUNC(SYSDATE) - 1 THEN 1 ELSE 0 END), 0),
           NVL(SUM(CASE WHEN TRUNC("INSPECT_TIME") = TRUNC(SYSDATE) - 1 AND "PASS_YN" = 'Y' THEN 1 ELSE 0 END), 0)
      INTO v_qc_today_total, v_qc_today_pass, v_qc_yest_total, v_qc_yest_pass
      FROM "INSPECT_RESULTS"
     WHERE TRUNC("INSPECT_TIME") >= TRUNC(SYSDATE) - 1;

    IF v_qc_today_total > 0 THEN
      v_qc_today_rate := ROUND(v_qc_today_pass / v_qc_today_total * 100, 1);
    END IF;
    IF v_qc_yest_total > 0 THEN
      v_qc_yest_rate := ROUND(v_qc_yest_pass / v_qc_yest_total * 100, 1);
    END IF;
    v_qc_change := ROUND((v_qc_today_rate - v_qc_yest_rate) * 10) / 10;

    -- 4) 불량 건수: 오늘 + 어제를 1개 쿼리로
    SELECT NVL(SUM(CASE WHEN TRUNC("OCCUR_TIME") = TRUNC(SYSDATE)     THEN 1 ELSE 0 END), 0),
           NVL(SUM(CASE WHEN TRUNC("OCCUR_TIME") = TRUNC(SYSDATE) - 1 THEN 1 ELSE 0 END), 0)
      INTO v_def_today, v_def_yesterday
      FROM "DEFECT_LOGS"
     WHERE TRUNC("OCCUR_TIME") >= TRUNC(SYSDATE) - 1;

    IF v_def_yesterday > 0 THEN
      v_def_change := ROUND((v_def_today - v_def_yesterday) / v_def_yesterday * 100);
    END IF;

    -- 5) JSON 문자열 조립
    v_json := '{'
      || '"todayProduction":{"value":' || v_prod_today || ',"change":' || v_prod_change || '}'
      || ',"inventoryStatus":{"value":' || v_inv_total || ',"change":0}'
      || ',"qualityPassRate":{"value":"' || TO_CHAR(v_qc_today_rate, 'FM990.0') || '","change":' || v_qc_change || '}'
      || ',"interlockCount":{"value":' || v_def_today || ',"change":' || v_def_change || '}'
      || '}';

    RETURN v_json;

  EXCEPTION
    WHEN OTHERS THEN
      RAISE_APPLICATION_ERROR(-20010, 'FN_KPI_JSON error: ' || SQLERRM);
  END FN_KPI_JSON;

END PKG_DASHBOARD;
/
```

**Step 3: oracle-db 스킬로 패키지 생성 실행**

```
oracle-db 스킬 사용:
1. PKG_DASHBOARD.pks (스펙) 실행
2. PKG_DASHBOARD.pkb (바디) 실행
3. 컴파일 오류 확인: SELECT * FROM USER_ERRORS WHERE NAME = 'PKG_DASHBOARD'
```

**Step 4: 커밋**

```bash
git add apps/backend/sql/packages/PKG_DASHBOARD.pks apps/backend/sql/packages/PKG_DASHBOARD.pkb
git commit -m "feat: Oracle PKG_DASHBOARD 패키지 — 4개 KPI를 단일 JSON 함수로 통합"
```

---

## Task 6: DashboardService 리팩토링 — PL/SQL 함수 호출

**Files:**
- Modify: `apps/backend/src/modules/dashboard/dashboard.service.ts`

**Step 1: getKpi() 메서드를 PKG_DASHBOARD.FN_KPI_JSON 호출로 교체**

파일: `apps/backend/src/modules/dashboard/dashboard.service.ts`

기존 8개 private 메서드(getTodayProduction, getInventoryStatus, getQualityPassRate, getInterlockCount)를 **단일 PL/SQL 함수 호출**로 교체:

```typescript
/**
 * @file src/modules/dashboard/dashboard.service.ts
 * @description 대시보드 서비스 — PKG_DASHBOARD.FN_KPI_JSON 기반 KPI 집계
 *
 * 초보자 가이드:
 * 1. **getKpi()**: Oracle PL/SQL 함수 1회 호출로 4가지 KPI 한 번에 조회
 *    - 기존: 8개 개별 쿼리 → 개선: 1개 함수 호출 (내부 4개 쿼리)
 * 2. **getRecentProductions()**: 최근 작업지시 10건 (기존 유지 — ORM이 적합)
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JobOrder } from '../../entities/job-order.entity';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(JobOrder)
    private readonly jobOrderRepo: Repository<JobOrder>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * KPI 데이터 조회 — PKG_DASHBOARD.FN_KPI_JSON 단일 호출
   * 반환: { todayProduction, inventoryStatus, qualityPassRate, interlockCount }
   */
  async getKpi() {
    try {
      const result = await this.dataSource.query(
        `SELECT PKG_DASHBOARD.FN_KPI_JSON() AS "KPI" FROM DUAL`,
      );

      const json = result[0]?.KPI;
      if (!json) {
        return this.getDefaultKpi();
      }

      return JSON.parse(json);
    } catch (error: any) {
      this.logger.error(`KPI 조회 실패: ${error.message}`);
      // PL/SQL 오류 시 기본값 반환 (대시보드는 에러로 깨지면 안 됨)
      return this.getDefaultKpi();
    }
  }

  /** 기본 KPI (오류 시 폴백) */
  private getDefaultKpi() {
    return {
      todayProduction: { value: 0, change: 0 },
      inventoryStatus: { value: 0, change: 0 },
      qualityPassRate: { value: '100.0', change: 0 },
      interlockCount: { value: 0, change: 0 },
    };
  }

  /**
   * 최근 작업지시 10건 조회 (기존 유지 — ORM LEFT JOIN이 적합)
   */
  async getRecentProductions() {
    const orders = await this.jobOrderRepo
      .createQueryBuilder('jo')
      .leftJoinAndSelect('jo.part', 'part')
      .orderBy('jo.createdAt', 'DESC')
      .take(10)
      .getMany();

    return orders.map((o) => ({
      id: o.id,
      orderNo: o.orderNo,
      partName: o.part?.partName ?? '-',
      line: o.lineCode ?? '-',
      planQty: o.planQty,
      actualQty: o.goodQty,
      progress: o.planQty > 0 ? Math.round((o.goodQty / o.planQty) * 1000) / 10 : 0,
      status: o.status === 'WAITING' ? 'WAIT' : o.status,
    }));
  }
}
```

**Step 2: dashboard.module.ts에서 불필요 엔티티 import 제거**

KPI 조회가 PL/SQL로 이동했으므로 MatStock, InspectResult, DefectLog는 DashboardModule에서 불필요:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { JobOrder } from '../../entities/job-order.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([JobOrder]),  // recentProductions용만 유지
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
```

**Step 3: 프론트엔드 영향 확인**

KPI API 응답 형태가 동일하므로 프론트엔드 변경 불필요:
```json
{
  "todayProduction": { "value": 1200, "change": 15 },
  "inventoryStatus": { "value": 54000, "change": 0 },
  "qualityPassRate": { "value": "98.5", "change": 1.2 },
  "interlockCount": { "value": 3, "change": -25 }
}
```

**Step 4: 커밋**

```bash
git add apps/backend/src/modules/dashboard/
git commit -m "refactor: 대시보드 KPI를 PKG_DASHBOARD.FN_KPI_JSON 단일 호출로 최적화 (8쿼리→1호출)"
```

---

## 검증 체크리스트

### 채번 검증
- [ ] oracle-db 스킬로 `SELECT PKG_NUM_RULE.FN_NEXT_NUMBER('ARRIVAL') FROM DUAL` 실행 → 번호 반환 확인
- [ ] 같은 쿼리 2회 연속 실행 → 시퀀스 증가 확인 (0001, 0002)
- [ ] 다음 날 실행 → 리셋되어 다시 0001부터 확인
- [ ] 입하/입고/출고 프로세스 실행 → 새 채번 형식으로 번호 생성 확인

### KPI 검증
- [ ] oracle-db 스킬로 `SELECT PKG_DASHBOARD.FN_KPI_JSON() FROM DUAL` 실행 → JSON 반환 확인
- [ ] 대시보드 페이지 접속 → KPI 카드 4개 정상 표시 확인
- [ ] 프론트엔드 응답 형태 동일 확인

---

## 성능 비교 요약

| 항목 | Before | After |
|------|--------|-------|
| **채번** | Date.now()+Math.random() (중복 위험) | Oracle SELECT FOR UPDATE (원자성 보장) |
| **채번 동시성** | 없음 (경합 시 중복) | DB 행 잠금 (완벽 보장) |
| **KPI 쿼리 수** | 8개 (커넥션 8개 점유) | 1개 함수 호출 (커넥션 1개) |
| **KPI DB 내부** | 8개 full scan | 4개 쿼리 (CASE WHEN 통합) |
| **KPI 네트워크** | 8 라운드트립 | 1 라운드트립 |
