# 대시보드 Oracle 패키지 전환 구현 계획

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메인 대시보드의 데이터 조회를 Oracle 패키지(PKG_DASHBOARD) 기반으로 전환하고, 공용 OracleService 헬퍼를 구축한다.

**Architecture:** 별도 oracledb 커넥션 풀을 관리하는 공용 OracleService를 만들고, PKG_DASHBOARD 패키지의 프로시저를 호출하여 대시보드 데이터를 반환한다. 기존 API 경로와 응답 구조를 유지하여 프론트엔드 변경 없이 백엔드 내부만 교체한다.

**Tech Stack:** NestJS, oracledb ^6.7.0 (설치 6.10.0), Oracle PL/SQL, TypeORM (기존 유지)

**Spec:** `docs/superpowers/specs/2026-03-14-dashboard-oracle-package-design.md`

**주의사항:**
- TypeORM 풀(poolMax:10) + OracleService 풀(poolMax:5) = 최대 15 커넥션 사용
- oracledb v6 기본 outFormat은 ARRAY — 반드시 OBJECT로 설정 필요

---

## Chunk 1: OracleService 공용 헬퍼

### Task 1: OracleService 생성

**Files:**
- Create: `apps/backend/src/common/services/oracle.service.ts`
- Create: `apps/backend/src/common/modules/oracle.module.ts`
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 1: OracleService 파일 생성**

`apps/backend/src/common/services/oracle.service.ts` 생성:

```typescript
/**
 * @file apps/backend/src/common/services/oracle.service.ts
 * @description Oracle 패키지/프로시저 호출 공용 헬퍼 서비스
 *
 * 초보자 가이드:
 * 1. 별도 oracledb 커넥션 풀을 관리하며, 모듈 초기화/종료 시 자동 생성/정리
 * 2. callProc()로 패키지.프로시저를 호출하면 SYS_REFCURSOR 결과를 JS 배열로 반환
 * 3. Oracle 컬럼명(UPPER_SNAKE_CASE)을 camelCase로 자동 변환
 * 4. oracledb.outFormat = OUT_FORMAT_OBJECT 설정으로 결과를 객체로 수신
 *
 * 사용 예시:
 *   const rows = await oracleService.callProc<EquipStats>(
 *     'PKG_DASHBOARD', 'SP_EQUIP_STATS'
 *   );
 */

import {
  Injectable, Logger, OnModuleInit, OnModuleDestroy,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as oracledb from 'oracledb';

@Injectable()
export class OracleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OracleService.name);
  private pool: oracledb.Pool;

  constructor(private readonly configService: ConfigService) {}

  /** 모듈 초기화 시 별도 oracledb 커넥션 풀 생성 */
  async onModuleInit(): Promise<void> {
    // 결과를 객체({COLUMN: value})로 반환하도록 전역 설정
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

    // connectString 구성 — SID / SERVICE_NAME 분기 (DatabaseModule과 동일)
    const host = this.configService.get<string>('ORACLE_HOST', 'localhost');
    const port = this.configService.get<number>('ORACLE_PORT', 1521);
    const sid = this.configService.get<string>('ORACLE_SID');
    const serviceName = this.configService.get<string>('ORACLE_SERVICE_NAME');

    let connectString: string;
    if (sid) {
      // SID 접속: TNS Descriptor 형식 사용
      connectString =
        `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${host})(PORT=${port}))` +
        `(CONNECT_DATA=(SID=${sid})))`;
    } else {
      // SERVICE_NAME 접속: EZConnect 형식
      connectString = `${host}:${port}/${serviceName || 'JSHNSMES'}`;
    }

    this.pool = await oracledb.createPool({
      user: this.configService.get<string>('ORACLE_USER'),
      password: this.configService.get<string>('ORACLE_PASSWORD'),
      connectString,
      poolMin: 1,
      poolMax: 5,
      poolIncrement: 1,
    });
    this.logger.log(`OracleService 커넥션 풀 생성 완료 (${host}:${port})`);
  }

  /** 모듈 종료 시 커넥션 풀 정리 */
  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.close(0);
      this.logger.log('OracleService 커넥션 풀 종료');
    }
  }

  /**
   * Oracle 패키지 프로시저 호출 - SYS_REFCURSOR 1개 반환
   *
   * @param packageName 패키지명 (예: 'PKG_DASHBOARD')
   * @param procName 프로시저명 (예: 'SP_EQUIP_STATS')
   * @param inParams IN 파라미터 (선택, 예: { p_target_date: new Date() })
   * @returns 커서 결과 배열 (camelCase 키)
   */
  async callProc<T = Record<string, any>>(
    packageName: string,
    procName: string,
    inParams?: Record<string, any>,
  ): Promise<T[]> {
    let conn: oracledb.Connection | undefined;
    try {
      conn = await this.pool.getConnection();

      // IN 파라미터 + OUT 커서 바인딩 구성
      const bindVars: Record<string, oracledb.BindParameter> = {};
      const paramNames: string[] = [];

      if (inParams) {
        for (const [key, value] of Object.entries(inParams)) {
          bindVars[key] = { dir: oracledb.BIND_IN, val: value };
          paramNames.push(`:${key}`);
        }
      }

      bindVars['o_cursor'] = { dir: oracledb.BIND_OUT, type: oracledb.CURSOR };
      paramNames.push(':o_cursor');

      const sql = `BEGIN ${packageName}.${procName}(${paramNames.join(', ')}); END;`;
      const result = await conn.execute(sql, bindVars);

      // SYS_REFCURSOR fetch
      const cursor = result.outBinds['o_cursor'] as oracledb.ResultSet<any>;
      const rows = await cursor.getRows();
      await cursor.close();

      // UPPER_SNAKE_CASE → camelCase 변환
      return rows.map((row) => this.toCamelCase(row)) as T[];
    } catch (err) {
      this.logger.error(
        `프로시저 호출 실패: ${packageName}.${procName}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new InternalServerErrorException(
        `Oracle 프로시저 호출 실패: ${packageName}.${procName}`,
      );
    } finally {
      if (conn) await conn.close();
    }
  }

  /**
   * Oracle 패키지 프로시저 호출 - 다중 SYS_REFCURSOR 반환
   *
   * @param packageName 패키지명
   * @param procName 프로시저명
   * @param cursorNames OUT 커서 파라미터명 배열 (예: ['o_summary', 'o_items'])
   * @param inParams IN 파라미터 (선택)
   * @returns 커서명별 결과 맵 (camelCase 키)
   */
  async callProcMultiCursor<T = Record<string, any>>(
    packageName: string,
    procName: string,
    cursorNames: string[],
    inParams?: Record<string, any>,
  ): Promise<Record<string, T[]>> {
    let conn: oracledb.Connection | undefined;
    try {
      conn = await this.pool.getConnection();

      const bindVars: Record<string, oracledb.BindParameter> = {};
      const paramNames: string[] = [];

      if (inParams) {
        for (const [key, value] of Object.entries(inParams)) {
          bindVars[key] = { dir: oracledb.BIND_IN, val: value };
          paramNames.push(`:${key}`);
        }
      }

      for (const name of cursorNames) {
        bindVars[name] = { dir: oracledb.BIND_OUT, type: oracledb.CURSOR };
        paramNames.push(`:${name}`);
      }

      const sql = `BEGIN ${packageName}.${procName}(${paramNames.join(', ')}); END;`;
      const result = await conn.execute(sql, bindVars);

      const output: Record<string, T[]> = {};
      for (const name of cursorNames) {
        const cursor = result.outBinds[name] as oracledb.ResultSet<any>;
        const rows = await cursor.getRows();
        await cursor.close();
        output[name] = rows.map((row) => this.toCamelCase(row)) as T[];
      }

      return output;
    } catch (err) {
      this.logger.error(
        `프로시저 호출 실패: ${packageName}.${procName}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new InternalServerErrorException(
        `Oracle 프로시저 호출 실패: ${packageName}.${procName}`,
      );
    } finally {
      if (conn) await conn.close();
    }
  }

  /**
   * UPPER_SNAKE_CASE 키를 camelCase로 변환
   * 예: { NORMAL_CNT: 5 } → { normalCnt: 5 }
   */
  private toCamelCase(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key
        .toLowerCase()
        .replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      result[camelKey] = value;
    }
    return result;
  }
}
```

- [ ] **Step 2: OracleModule 생성 (글로벌 모듈)**

`apps/backend/src/common/modules/oracle.module.ts` 생성 (디렉토리도 함께 생성):

```typescript
/**
 * @file apps/backend/src/common/modules/oracle.module.ts
 * @description OracleService를 글로벌로 제공하는 모듈
 *
 * 초보자 가이드:
 * 1. AppModule에 한 번만 import하면 모든 모듈에서 OracleService 사용 가능
 * 2. ConfigModule이 먼저 로드되어야 환경변수를 읽을 수 있음
 */

import { Global, Module } from '@nestjs/common';
import { OracleService } from '../services/oracle.service';

@Global()
@Module({
  providers: [OracleService],
  exports: [OracleService],
})
export class OracleModule {}
```

- [ ] **Step 3: AppModule에 OracleModule 등록**

**파일:** `apps/backend/src/app.module.ts`

imports 배열에서 `DatabaseModule` 바로 아래에 `OracleModule` 추가:
```typescript
import { OracleModule } from './common/modules/oracle.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    OracleModule,  // ← 추가
    // ... 기존 모듈들
  ],
})
```

- [ ] **Step 4: 빌드 확인**

Run: `cd apps/backend && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/src/common/services/oracle.service.ts \
       apps/backend/src/common/modules/oracle.module.ts \
       apps/backend/src/app.module.ts
git commit -m "feat: OracleService 공용 헬퍼 + OracleModule 글로벌 모듈 추가"
```

---

## Chunk 2: PKG_DASHBOARD Oracle 패키지

### Task 2: PKG_DASHBOARD 패키지 SQL 파일

**Files:**
- Create: `scripts/oracle/PKG_DASHBOARD.sql`

- [ ] **Step 1: oracle-db 스킬로 관련 테이블 스키마 조회**

실제 컬럼명 확인이 필수. 다음 테이블을 조회:
- EQUIP_MASTER (STATUS, USE_YN 등)
- JOB_ORDERS (PLAN_DATE, STATUS, GOOD_QTY 등)
- MAT_STOCKS (ITEM_CODE, QTY 등)
- PART_MASTER (ITEM_CODE, SAFETY_STOCK 등)
- MAT_LOTS (EXPIRE_DATE, STATUS 등)
- DEFECT_LOGS (STATUS 등)
- EQUIP_INSPECT_ITEM_MASTER (EQUIP_CODE, INSPECT_TYPE, USE_YN 등)
- EQUIP_INSPECT_LOGS (EQUIP_CODE, INSPECT_TYPE, INSPECT_DATE, OVERALL_RESULT, INSPECTOR_NAME 등)
- PM_WORK_ORDERS (EQUIP_CODE, SCHEDULED_DATE, STATUS, OVERALL_RESULT 등)
- INSPECT_RESULTS (INSPECT_TIME, PASS_YN 등)

- [ ] **Step 2: PKG_DASHBOARD.sql 작성**

`scripts/oracle/PKG_DASHBOARD.sql` 생성 (디렉토리도 함께 생성).
패키지 SPEC + BODY를 하나의 파일에 작성.

기존 `dashboard.service.ts`의 TypeORM 쿼리 로직을 PL/SQL로 이식:

| 프로시저 | 이식 대상 메서드 | 핵심 로직 |
|---------|----------------|----------|
| SP_EQUIP_STATS | getEquipSummary() | `EQUIP_MASTER WHERE USE_YN='Y' GROUP BY STATUS` |
| SP_JOB_ORDER_STATS | getJobSummary(date) | `JOB_ORDERS WHERE TRUNC(PLAN_DATE)=p_target_date GROUP BY STATUS` + 상태 매핑(WAITING→WAIT, START→RUNNING, COMPLETED→DONE) |
| SP_MAT_ALERT | getMatSummary() | `MAT_STOCKS JOIN PART_MASTER` (lowStock) + `MAT_LOTS` (nearExpiry 7일, expired) |
| SP_DEFECT_STATS | getDefectSummary() | `DEFECT_LOGS GROUP BY STATUS` + TOTAL_CNT 포함 |
| SP_INSPECT_DAILY | getInspectSummary(date, 'DAILY') | o_summary: 대상/완료/합격/불합격 카운트, o_items: 설비별 RESULT/INSPECTOR_NAME/LINE_CODE |
| SP_INSPECT_PERIODIC | getInspectSummary(date, 'PERIODIC') | 동일 로직, INSPECT_TYPE='PERIODIC' |
| SP_INSPECT_PM | getPmSummary(date) | `PM_WORK_ORDERS LEFT JOIN EQUIP_MASTER`, COMPLETED→결과 매핑 |
| SP_KPI | getTodayProduction()+getInventoryStatus()+getQualityPassRate()+getInterlockCount() | 4대 KPI를 단일 행으로 반환 |
| SP_RECENT_PRODUCTIONS | getRecentProductions() | `JOB_ORDERS JOIN PART_MASTER ORDER BY CREATED_AT DESC FETCH FIRST 10`, LINE_CODE를 LINE으로 alias, progress 계산, WAITING→WAIT 매핑 |

주석 규칙:
- 패키지 헤더: 목적, 작성자, 작성일, 변경이력
- 각 프로시저: 목적, 파라미터, 반환값, 참조 테이블
- SQL 내부: 복잡한 로직에 인라인 주석

**SP_RECENT_PRODUCTIONS 특별 주의:** 프론트엔드가 `line` 키를 기대하므로, SELECT에서 `LINE_CODE AS LINE`으로 alias 처리. `progress` 계산도 PL/SQL에서 수행: `CASE WHEN PLAN_QTY > 0 THEN ROUND(GOOD_QTY / PLAN_QTY * 1000) / 10 ELSE 0 END`.

- [ ] **Step 3: Oracle DB에 패키지 배포**

`oracle-db` 스킬을 사용하여 PKG_DASHBOARD 패키지를 Oracle DB에 배포.
Expected: `Package created.`, `Package body created.`

- [ ] **Step 4: 패키지 동작 확인**

oracle-db 스킬로 간단한 테스트 쿼리 실행:
```sql
DECLARE
  v_cursor SYS_REFCURSOR;
  v_normal NUMBER;
  v_maint  NUMBER;
  v_stop   NUMBER;
  v_total  NUMBER;
BEGIN
  PKG_DASHBOARD.SP_EQUIP_STATS(v_cursor);
  FETCH v_cursor INTO v_normal, v_maint, v_stop, v_total;
  DBMS_OUTPUT.PUT_LINE('NORMAL=' || v_normal || ' MAINT=' || v_maint || ' STOP=' || v_stop || ' TOTAL=' || v_total);
  CLOSE v_cursor;
END;
```

- [ ] **Step 5: 커밋**

```bash
git add scripts/oracle/PKG_DASHBOARD.sql
git commit -m "feat: PKG_DASHBOARD Oracle 패키지 생성 — 대시보드 현황 조회"
```

---

## Chunk 3: DashboardService 리팩토링

### Task 3: DashboardService를 OracleService 기반으로 교체

**Files:**
- Modify: `apps/backend/src/modules/dashboard/dashboard.service.ts`
- Modify: `apps/backend/src/modules/dashboard/dashboard.module.ts`

- [ ] **Step 1: dashboard.module.ts 수정**

TypeORM 엔티티 import를 제거하고 OracleService만 사용하도록 변경.

```typescript
/**
 * @file apps/backend/src/modules/dashboard/dashboard.module.ts
 * @description 대시보드 모듈 — OracleService를 통해 PKG_DASHBOARD 패키지 호출
 *
 * 초보자 가이드:
 * 1. OracleModule이 @Global()이므로 별도 import 불필요
 * 2. TypeORM 엔티티 import 제거 — 모든 데이터 조회는 Oracle 패키지 경유
 */
import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
```

- [ ] **Step 2: dashboard.service.ts 전체 교체**

기존 TypeORM QueryBuilder 로직을 OracleService.callProc() 호출로 교체.
**기존 API 응답 구조를 정확히 유지**하여 프론트엔드 변경 없이 동작해야 한다.

```typescript
/**
 * @file apps/backend/src/modules/dashboard/dashboard.service.ts
 * @description 대시보드 서비스 — PKG_DASHBOARD Oracle 패키지 호출
 *
 * 초보자 가이드:
 * 1. OracleService.callProc()로 PKG_DASHBOARD 패키지의 프로시저를 호출
 * 2. callProcMultiCursor()로 다중 커서(요약+아이템) 반환 프로시저 호출
 * 3. 기존 API 응답 구조를 그대로 유지하여 프론트엔드 변경 없음
 *
 * 패키지 프로시저 목록:
 * - SP_EQUIP_STATS: 설비 상태별 카운트
 * - SP_JOB_ORDER_STATS: 작업지시 상태별 카운트
 * - SP_MAT_ALERT: 자재 알림 (안전재고/유효기한)
 * - SP_DEFECT_STATS: 불량 상태별 카운트
 * - SP_INSPECT_DAILY: 일상점검 요약 + 설비별 결과
 * - SP_INSPECT_PERIODIC: 정기점검 요약 + 설비별 결과
 * - SP_INSPECT_PM: 예방보전 요약 + 설비별 결과
 * - SP_KPI: KPI 4대 지표
 * - SP_RECENT_PRODUCTIONS: 최근 작업지시 10건
 */
import { Injectable } from '@nestjs/common';
import { OracleService } from '../../common/services/oracle.service';

const PKG = 'PKG_DASHBOARD';

@Injectable()
export class DashboardService {
  constructor(private readonly oracle: OracleService) {}

  /**
   * 대시보드 요약 데이터 (현황판 전용)
   * 기존 API 응답 구조 유지: { equip, job, mat, defect, daily, periodic, pm }
   */
  async getSummary(dateStr: string) {
    const targetDate = new Date(dateStr);

    const [equip, job, mat, defect, daily, periodic, pm] = await Promise.all([
      this.getEquipStats(),
      this.getJobOrderStats(targetDate),
      this.getMatAlert(),
      this.getDefectStats(),
      this.getInspectData('SP_INSPECT_DAILY', targetDate),
      this.getInspectData('SP_INSPECT_PERIODIC', targetDate),
      this.getInspectData('SP_INSPECT_PM', targetDate),
    ]);

    return { equip, job, mat, defect, daily, periodic, pm };
  }

  /** KPI 데이터 (생산량/재고/합격률/불량) */
  async getKpi() {
    const rows = await this.oracle.callProc<any>(PKG, 'SP_KPI');
    const r = rows[0] || {};
    return {
      todayProduction: { value: r.todayProd ?? 0, change: r.prodChange ?? 0 },
      inventoryStatus: { value: r.inventoryTotal ?? 0, change: r.invChange ?? 0 },
      qualityPassRate: { value: r.passRate ?? '100.0', change: r.rateChange ?? 0 },
      interlockCount: { value: r.defectCnt ?? 0, change: r.defectChange ?? 0 },
    };
  }

  /**
   * 최근 작업지시 10건
   * SP_RECENT_PRODUCTIONS에서 LINE_CODE→LINE alias, progress 계산,
   * WAITING→WAIT 상태 매핑을 PL/SQL에서 처리하므로 그대로 반환
   */
  async getRecentProductions() {
    return this.oracle.callProc<any>(PKG, 'SP_RECENT_PRODUCTIONS');
  }

  private async getEquipStats() {
    const rows = await this.oracle.callProc<any>(PKG, 'SP_EQUIP_STATS');
    const r = rows[0] || {};
    return {
      normal: r.normalCnt ?? 0,
      maint: r.maintCnt ?? 0,
      stop: r.stopCnt ?? 0,
      total: r.totalCnt ?? 0,
    };
  }

  private async getJobOrderStats(date: Date) {
    const rows = await this.oracle.callProc<any>(PKG, 'SP_JOB_ORDER_STATS', {
      p_target_date: date,
    });
    const r = rows[0] || {};
    return {
      wait: r.waitCnt ?? 0,
      running: r.runningCnt ?? 0,
      done: r.doneCnt ?? 0,
      total: r.totalCnt ?? 0,
    };
  }

  private async getMatAlert() {
    const rows = await this.oracle.callProc<any>(PKG, 'SP_MAT_ALERT');
    const r = rows[0] || {};
    return {
      lowStock: r.lowStockCnt ?? 0,
      nearExpiry: r.nearExpiryCnt ?? 0,
      expired: r.expiredCnt ?? 0,
    };
  }

  private async getDefectStats() {
    const rows = await this.oracle.callProc<any>(PKG, 'SP_DEFECT_STATS');
    const r = rows[0] || {};
    return {
      wait: r.waitCnt ?? 0,
      repair: r.repairCnt ?? 0,
      rework: r.reworkCnt ?? 0,
      done: r.doneCnt ?? 0,
      total: r.totalCnt ?? 0,
    };
  }

  /**
   * 점검 데이터 조회 (일상/정기/PM 공통)
   * 다중 커서: o_summary (요약 1행) + o_items (설비별 행)
   */
  private async getInspectData(procName: string, date: Date) {
    const result = await this.oracle.callProcMultiCursor<any>(
      PKG,
      procName,
      ['o_summary', 'o_items'],
      { p_target_date: date },
    );

    const summary = result.o_summary[0] || {};
    const items = result.o_items || [];

    return {
      total: summary.totalCnt ?? 0,
      completed: summary.completedCnt ?? 0,
      pass: summary.passCnt ?? 0,
      fail: summary.failCnt ?? 0,
      items: items.map((item: any) => ({
        equipCode: item.equipCode ?? '',
        equipName: item.equipName ?? '',
        result: item.result ?? null,
        inspectorName: item.inspectorName ?? null,
        lineCode: item.lineCode ?? null,
      })),
    };
  }
}
```

- [ ] **Step 3: 빌드 확인**

Run: `cd apps/backend && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: dev 서버에서 동작 확인**

1. 백엔드 dev 서버 실행
2. 브라우저에서 대시보드 페이지 접속
3. 개발자 도구 Network 탭에서 `/api/v1/dashboard/summary` 응답 확인
4. 기존과 동일한 데이터가 반환되는지 확인
5. `/api/v1/dashboard/kpi`, `/api/v1/dashboard/recent-productions`도 확인

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/src/modules/dashboard/dashboard.module.ts \
       apps/backend/src/modules/dashboard/dashboard.service.ts
git commit -m "feat: DashboardService를 PKG_DASHBOARD Oracle 패키지 호출로 전환"
```

---

## 최종 파일 목록

| 작업 | 파일 | 변경 |
|------|------|------|
| 신규 | `apps/backend/src/common/services/oracle.service.ts` | 공용 프로시저 호출 헬퍼 |
| 신규 | `apps/backend/src/common/modules/oracle.module.ts` | 글로벌 모듈 |
| 신규 | `scripts/oracle/PKG_DASHBOARD.sql` | Oracle 패키지 (SPEC + BODY) |
| 수정 | `apps/backend/src/app.module.ts` | OracleModule import 추가 |
| 수정 | `apps/backend/src/modules/dashboard/dashboard.module.ts` | TypeORM 엔티티 제거 |
| 수정 | `apps/backend/src/modules/dashboard/dashboard.service.ts` | OracleService 기반으로 전체 교체 |
| 변경 없음 | `apps/backend/src/modules/dashboard/dashboard.controller.ts` | API 경로 유지 |
| 변경 없음 | `apps/frontend/src/app/(authenticated)/dashboard/page.tsx` | 프론트 변경 없음 |
