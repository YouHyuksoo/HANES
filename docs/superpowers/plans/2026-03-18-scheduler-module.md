# 스케줄러 관리 모듈 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 UI에서 크론 주기/재시도 횟수를 설정하고, ERP 인터페이스 동기화/실패 재시도/DB 정리 등의 배경 작업을 자동 실행·모니터링할 수 있는 스케줄러 관리 모듈 구현

**Architecture:** `@nestjs/schedule`의 `SchedulerRegistry`로 런타임 크론잡을 동적 등록/해제. 작업 정의·이력·알림은 Oracle DB 3개 테이블에 저장. 5가지 실행 유형(SERVICE, PROCEDURE, SQL, HTTP, SCRIPT)을 Executor 전략 패턴으로 처리. 프론트엔드는 3탭(작업관리/이력/대시보드) + 헤더 벨 알림.

**Tech Stack:** NestJS 11, @nestjs/schedule, cron-parser, TypeORM, Oracle DB, Next.js, cronstrue, recharts

**Spec:** `docs/superpowers/specs/2026-03-18-scheduler-design.md`

---

## File Map

### Backend — Entities
| File | Action | Responsibility |
|------|--------|---------------|
| `apps/backend/src/entities/scheduler-job.entity.ts` | Create | SCHEDULER_JOBS 엔티티 (PK: COMPANY+PLANT_CD+JOB_CODE) |
| `apps/backend/src/entities/scheduler-log.entity.ts` | Create | SCHEDULER_LOGS 엔티티 (PK: COMPANY+PLANT_CD+LOG_ID) |
| `apps/backend/src/entities/scheduler-notification.entity.ts` | Create | SCHEDULER_NOTIFICATIONS 엔티티 (PK: COMPANY+NOTI_ID) |

### Backend — Module Core
| File | Action | Responsibility |
|------|--------|---------------|
| `apps/backend/src/modules/scheduler/scheduler.module.ts` | Create | 모듈 정의, ScheduleModule import |
| `apps/backend/src/modules/scheduler/dto/scheduler-job.dto.ts` | Create | 작업 CRUD DTO |
| `apps/backend/src/modules/scheduler/dto/scheduler-log.dto.ts` | Create | 이력 조회 필터 DTO |
| `apps/backend/src/modules/scheduler/config/scheduler-security.config.ts` | Create | 보안 화이트리스트 설정 |

### Backend — Guards
| File | Action | Responsibility |
|------|--------|---------------|
| `apps/backend/src/common/guards/roles.guard.ts` | Create | RolesGuard (common에 배치하여 재사용) |
| `apps/backend/src/common/decorators/roles.decorator.ts` | Create | @Roles() 데코레이터 |

### Backend — Services
| File | Action | Responsibility |
|------|--------|---------------|
| `apps/backend/src/modules/scheduler/services/scheduler-job.service.ts` | Create | 작업 CRUD + SchedulerRegistry 연동 |
| `apps/backend/src/modules/scheduler/services/scheduler-log.service.ts` | Create | 이력 기록/조회/대시보드 통계 |
| `apps/backend/src/modules/scheduler/services/scheduler-noti.service.ts` | Create | 알림 생성/조회/읽음처리 |
| `apps/backend/src/modules/scheduler/services/scheduler-runner.service.ts` | Create | 작업 실행 엔진 (타임아웃/재시도/동시실행방지) |

### Backend — Executors
| File | Action | Responsibility |
|------|--------|---------------|
| `apps/backend/src/modules/scheduler/executors/executor.interface.ts` | Create | IJobExecutor + ExecutorResult 인터페이스 |
| `apps/backend/src/modules/scheduler/executors/executor.factory.ts` | Create | EXEC_TYPE → Executor 매핑 |
| `apps/backend/src/modules/scheduler/executors/service.executor.ts` | Create | NestJS 서비스 메서드 호출 |
| `apps/backend/src/modules/scheduler/executors/procedure.executor.ts` | Create | Oracle 프로시저 호출 |
| `apps/backend/src/modules/scheduler/executors/sql.executor.ts` | Create | SQL 실행 (SELECT/DELETE만) |
| `apps/backend/src/modules/scheduler/executors/http.executor.ts` | Create | 외부 HTTP API 호출 |
| `apps/backend/src/modules/scheduler/executors/script.executor.ts` | Create | 외부 스크립트 실행 |

### Backend — Controllers
| File | Action | Responsibility |
|------|--------|---------------|
| `apps/backend/src/modules/scheduler/controllers/scheduler-job.controller.ts` | Create | 작업 CRUD + 수동실행 + 토글 |
| `apps/backend/src/modules/scheduler/controllers/scheduler-log.controller.ts` | Create | 이력 조회 + 대시보드 통계 |
| `apps/backend/src/modules/scheduler/controllers/scheduler-noti.controller.ts` | Create | 알림 조회 + 읽음처리 |

### Backend — Existing Modifications
| File | Action | Responsibility |
|------|--------|---------------|
| `apps/backend/src/app.module.ts` | Modify | SchedulerModule import 추가 |
| `apps/backend/src/modules/interface/services/interface.service.ts` | Modify | scheduledSyncBom(), scheduledBulkRetry() 래퍼 메서드 추가 |

### Frontend
| File | Action | Responsibility |
|------|--------|---------------|
| `apps/frontend/src/app/(authenticated)/system/scheduler/page.tsx` | Create | 메인 페이지 (3탭 컨테이너) |
| `apps/frontend/src/app/(authenticated)/system/scheduler/components/SchedulerJobTab.tsx` | Create | 탭1: 작업 관리 DataGrid |
| `apps/frontend/src/app/(authenticated)/system/scheduler/components/SchedulerJobModal.tsx` | Create | 작업 등록/수정 모달 (동적 폼) |
| `apps/frontend/src/app/(authenticated)/system/scheduler/components/SchedulerLogTab.tsx` | Create | 탭2: 실행 이력 DataGrid |
| `apps/frontend/src/app/(authenticated)/system/scheduler/components/SchedulerDashboardTab.tsx` | Create | 탭3: 대시보드 (StatCard + 차트) |
| `apps/frontend/src/app/(authenticated)/system/scheduler/components/LogDetailModal.tsx` | Create | 에러 상세 모달 |
| `apps/frontend/src/components/shared/NotificationBell.tsx` | Create | 헤더 벨 아이콘 + 드롭다운 |

### Frontend — Existing Modifications
| File | Action | Responsibility |
|------|--------|---------------|
| `packages/shared/src/constants/menu.ts` | Modify | 스케줄러 메뉴 등록 |
| `apps/frontend/src/locales/ko.json` | Modify | 한국어 i18n 키 |
| `apps/frontend/src/locales/en.json` | Modify | 영어 i18n 키 |
| `apps/frontend/src/locales/zh.json` | Modify | 중국어 i18n 키 |
| `apps/frontend/src/locales/vi.json` | Modify | 베트남어 i18n 키 |
| `apps/frontend/src/components/layout/Header.tsx` (or equivalent) | Modify | NotificationBell 삽입 |

### SQL Seeds
| File | Action | Responsibility |
|------|--------|---------------|
| `scripts/migration/seed_scheduler_comcodes.sql` | Create | 공통코드 시드 |
| `scripts/migration/seed_scheduler_jobs.sql` | Create | 기본 작업 3건 시드 |

---

## Chunk 1: 패키지 설치 + 엔티티 + 시드 SQL

### Task 1: 패키지 설치

**Files:**
- Modify: `apps/backend/package.json`
- Modify: `apps/frontend/package.json`

- [ ] **Step 1: backend에 @nestjs/schedule + cron-parser 설치**

```bash
cd /c/Project/HANES && pnpm --filter @harness/backend add @nestjs/schedule cron-parser
```

- [ ] **Step 2: frontend에 cronstrue, recharts 설치**

```bash
cd /c/Project/HANES && pnpm --filter @harness/frontend add cronstrue recharts
```

- [ ] **Step 3: 설치 확인**

```bash
cd /c/Project/HANES && pnpm ls --filter @harness/backend @nestjs/schedule && pnpm ls --filter @harness/frontend cronstrue recharts
```

---

### Task 2: 엔티티 — SchedulerJob

**Files:**
- Create: `apps/backend/src/entities/scheduler-job.entity.ts`

- [ ] **Step 1: 엔티티 작성**

```typescript
/**
 * @file scheduler-job.entity.ts
 * @description 스케줄러 작업 정의 엔티티. 크론 주기, 실행 유형, 보안 설정 등을 관리한다.
 *   - PK: (COMPANY, PLANT_CD, JOB_CODE) 복합키 — 멀티테넌시
 *   - EXEC_TYPE: SERVICE | PROCEDURE | SQL | HTTP | SCRIPT
 *   - 초보자 가이드: 이 엔티티는 "어떤 작업을 언제 실행할지" 정의한다.
 *     스케줄러 서비스가 서버 시작 시 IS_ACTIVE='Y'인 작업을 로드하여 CronJob을 등록한다.
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'SCHEDULER_JOBS' })
export class SchedulerJob {
  /** 회사 코드 (멀티테넌시) */
  @PrimaryColumn({ name: 'COMPANY', type: 'varchar2', length: 20 })
  company: string;

  /** 사업장 코드 */
  @PrimaryColumn({ name: 'PLANT_CD', type: 'varchar2', length: 20 })
  plantCd: string;

  /** 작업코드 (예: IF_SYNC_BOM) */
  @PrimaryColumn({ name: 'JOB_CODE', type: 'varchar2', length: 50 })
  jobCode: string;

  /** 작업명 */
  @Column({ name: 'JOB_NAME', type: 'nvarchar2', length: 100 })
  jobName: string;

  /** 작업 그룹 — ComCode SCHED_GROUP */
  @Column({ name: 'JOB_GROUP', type: 'varchar2', length: 20 })
  jobGroup: string;

  /** 실행 유형 — ComCode SCHED_EXEC_TYPE */
  @Column({ name: 'EXEC_TYPE', type: 'varchar2', length: 20 })
  execType: string;

  /** 실행 대상 (프로시저명, URL, 스크립트 경로 등) */
  @Column({ name: 'EXEC_TARGET', type: 'nvarchar2', length: 500 })
  execTarget: string;

  /** JSON 파라미터 */
  @Column({ name: 'EXEC_PARAMS', type: 'nvarchar2', length: 2000, nullable: true })
  execParams: string | null;

  /** 크론 표현식 */
  @Column({ name: 'CRON_EXPR', type: 'varchar2', length: 50 })
  cronExpr: string;

  /** 활성여부 (Y/N) */
  @Column({ name: 'IS_ACTIVE', type: 'char', length: 1, default: 'N' })
  isActive: string;

  /** 최대 재시도 횟수 */
  @Column({ name: 'MAX_RETRY', type: 'number', default: 0 })
  maxRetry: number;

  /** 타임아웃 (초) */
  @Column({ name: 'TIMEOUT_SEC', type: 'number', default: 300 })
  timeoutSec: number;

  /** 설명 */
  @Column({ name: 'DESCRIPTION', type: 'nvarchar2', length: 500, nullable: true })
  description: string | null;

  /** 마지막 실행 시각 */
  @Column({ name: 'LAST_RUN_AT', type: 'timestamp', nullable: true })
  lastRunAt: Date | null;

  /** 마지막 실행 상태 */
  @Column({ name: 'LAST_STATUS', type: 'varchar2', length: 20, nullable: true })
  lastStatus: string | null;

  /** 마지막 에러 시각 */
  @Column({ name: 'LAST_ERROR_AT', type: 'timestamp', nullable: true })
  lastErrorAt: Date | null;

  /** 다음 예정 실행 시각 */
  @Column({ name: 'NEXT_RUN_AT', type: 'timestamp', nullable: true })
  nextRunAt: Date | null;

  @Column({ name: 'CREATED_BY', type: 'varchar2', length: 50, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @Column({ name: 'UPDATED_BY', type: 'varchar2', length: 50, nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
```

- [ ] **Step 2: 빌드 확인**

```bash
cd /c/Project/HANES && pnpm --filter @harness/backend build 2>&1 | tail -5
```
Expected: 에러 없음

---

### Task 3: 엔티티 — SchedulerLog

**Files:**
- Create: `apps/backend/src/entities/scheduler-log.entity.ts`

- [ ] **Step 1: 엔티티 작성**

```typescript
/**
 * @file scheduler-log.entity.ts
 * @description 스케줄러 실행 이력 엔티티. 각 작업 실행의 시작/종료/상태/에러를 기록한다.
 *   - PK: (COMPANY, PLANT_CD, LOG_ID) — 테넌트 스코프 + 시퀀스
 *   - FK: (COMPANY, PLANT_CD, JOB_CODE) → SCHEDULER_JOBS
 *   - 초보자 가이드: 크론잡이 실행될 때마다 이 테이블에 한 행이 생성된다.
 *     STATUS는 RUNNING → SUCCESS/FAIL/TIMEOUT 순으로 변경된다.
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SchedulerJob } from './scheduler-job.entity';

@Entity({ name: 'SCHEDULER_LOGS' })
@Index('IDX_SCHED_LOGS_SEARCH', ['company', 'plantCd', 'startTime', 'status'])
export class SchedulerLog {
  /** 회사 코드 */
  @PrimaryColumn({ name: 'COMPANY', type: 'varchar2', length: 20 })
  company: string;

  /** 사업장 코드 */
  @PrimaryColumn({ name: 'PLANT_CD', type: 'varchar2', length: 20 })
  plantCd: string;

  /** 로그 ID (PKG_SEQ_GENERATOR) */
  @PrimaryColumn({ name: 'LOG_ID', type: 'number' })
  logId: number;

  /** 작업코드 */
  @Column({ name: 'JOB_CODE', type: 'varchar2', length: 50 })
  jobCode: string;

  @ManyToOne(() => SchedulerJob)
  @JoinColumn([
    { name: 'COMPANY', referencedColumnName: 'company' },
    { name: 'PLANT_CD', referencedColumnName: 'plantCd' },
    { name: 'JOB_CODE', referencedColumnName: 'jobCode' },
  ])
  job: SchedulerJob;

  /** 시작 시각 */
  @Column({ name: 'START_TIME', type: 'timestamp' })
  startTime: Date;

  /** 종료 시각 */
  @Column({ name: 'END_TIME', type: 'timestamp', nullable: true })
  endTime: Date | null;

  /** 소요시간 (ms) */
  @Column({ name: 'DURATION_MS', type: 'number', nullable: true })
  durationMs: number | null;

  /** 상태 — ComCode SCHED_STATUS */
  @Column({ name: 'STATUS', type: 'varchar2', length: 20 })
  status: string;

  /** 결과 메시지 */
  @Column({ name: 'RESULT_MSG', type: 'nvarchar2', length: 2000, nullable: true })
  resultMsg: string | null;

  /** 에러 상세 */
  @Column({ name: 'ERROR_MSG', type: 'nvarchar2', length: 4000, nullable: true })
  errorMsg: string | null;

  /** 재시도 횟수 */
  @Column({ name: 'RETRY_COUNT', type: 'number', default: 0 })
  retryCount: number;

  /** 처리 건수 */
  @Column({ name: 'AFFECTED_ROWS', type: 'number', nullable: true })
  affectedRows: number | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
```

---

### Task 4: 엔티티 — SchedulerNotification

**Files:**
- Create: `apps/backend/src/entities/scheduler-notification.entity.ts`

- [ ] **Step 1: 엔티티 작성**

```typescript
/**
 * @file scheduler-notification.entity.ts
 * @description 스케줄러 알림 엔티티. 작업 실패/타임아웃 시 ADMIN 사용자에게 알림을 생성한다.
 *   - PK: (COMPANY, NOTI_ID) — 테넌트 스코프
 *   - 초보자 가이드: 스케줄러 작업이 최종 실패하면 이 테이블에 알림이 생성되고,
 *     프론트엔드 헤더의 벨 아이콘에서 읽지 않은 알림 건수가 표시된다.
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'SCHEDULER_NOTIFICATIONS' })
export class SchedulerNotification {
  /** 회사 코드 */
  @PrimaryColumn({ name: 'COMPANY', type: 'varchar2', length: 20 })
  company: string;

  /** 알림 ID (PKG_SEQ_GENERATOR) */
  @PrimaryColumn({ name: 'NOTI_ID', type: 'number' })
  notiId: number;

  /** 작업코드 */
  @Column({ name: 'JOB_CODE', type: 'varchar2', length: 50 })
  jobCode: string;

  /** 사업장 */
  @Column({ name: 'PLANT_CD', type: 'varchar2', length: 20 })
  plantCd: string;

  /** 알림 대상 사용자 */
  @Column({ name: 'USER_ID', type: 'varchar2', length: 50 })
  userId: string;

  /** 알림 유형 (FAIL / TIMEOUT / SUCCESS) */
  @Column({ name: 'NOTI_TYPE', type: 'varchar2', length: 20 })
  notiType: string;

  /** 알림 내용 */
  @Column({ name: 'MESSAGE', type: 'nvarchar2', length: 500 })
  message: string;

  /** 읽음 여부 (Y/N) */
  @Column({ name: 'IS_READ', type: 'char', length: 1, default: 'N' })
  isRead: string;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
```

---

### Task 5: 시드 SQL

**Files:**
- Create: `scripts/migration/seed_scheduler_comcodes.sql`
- Create: `scripts/migration/seed_scheduler_jobs.sql`

- [ ] **Step 1: 공통코드 시드 SQL 작성**

```sql
-- seed_scheduler_comcodes.sql
-- 스케줄러 공통코드 시드

-- SCHED_GROUP (작업 그룹)
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_GROUP', 'INTERFACE', '인터페이스', 1, 'Y', 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200');
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_GROUP', 'RETRY', '재시도', 2, 'Y', 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200');
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_GROUP', 'MAINTENANCE', 'DB 유지보수', 3, 'Y', 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200');

-- SCHED_EXEC_TYPE (실행 유형)
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_EXEC_TYPE', 'SERVICE', '내부 서비스', 1, 'Y', 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200');
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_EXEC_TYPE', 'PROCEDURE', 'Oracle 프로시저', 2, 'Y', 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200');
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_EXEC_TYPE', 'SQL', 'SQL 실행', 3, 'Y', 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200');
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_EXEC_TYPE', 'HTTP', 'HTTP API', 4, 'Y', 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200');
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_EXEC_TYPE', 'SCRIPT', '외부 스크립트', 5, 'Y', 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200');

-- SCHED_STATUS (실행 상태)
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_STATUS', 'SUCCESS', '성공', 1, 'Y', 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200');
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_STATUS', 'FAIL', '실패', 2, 'Y', 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200');
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_STATUS', 'RUNNING', '실행중', 3, 'Y', 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200');
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_STATUS', 'RETRYING', '재시도중', 4, 'Y', 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200');
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_STATUS', 'TIMEOUT', '타임아웃', 5, 'Y', 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200');
INSERT INTO COM_CODES (COMPANY, GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, IS_ACTIVE, ATTR1)
VALUES ('JS', 'SCHED_STATUS', 'SKIPPED', '스킵', 6, 'Y', 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200');

COMMIT;
```

- [ ] **Step 2: 기본 작업 시드 SQL 작성**

```sql
-- seed_scheduler_jobs.sql
-- 기본 스케줄러 작업 3건 (IS_ACTIVE='N' — 관리자가 UI에서 활성화)

INSERT INTO SCHEDULER_JOBS (COMPANY, PLANT_CD, JOB_CODE, JOB_NAME, JOB_GROUP, EXEC_TYPE, EXEC_TARGET, EXEC_PARAMS, CRON_EXPR, IS_ACTIVE, MAX_RETRY, TIMEOUT_SEC, DESCRIPTION, CREATED_BY, CREATED_AT, UPDATED_BY, UPDATED_AT)
VALUES ('JS', 'JS01', 'IF_SYNC_BOM', 'BOM 동기화', 'INTERFACE', 'SERVICE', 'InterfaceService.scheduledSyncBom', NULL, '0 */10 * * * *', 'N', 3, 300, 'ERP에서 BOM 변경분을 MES로 동기화', 'system', SYSTIMESTAMP, 'system', SYSTIMESTAMP);

INSERT INTO SCHEDULER_JOBS (COMPANY, PLANT_CD, JOB_CODE, JOB_NAME, JOB_GROUP, EXEC_TYPE, EXEC_TARGET, EXEC_PARAMS, CRON_EXPR, IS_ACTIVE, MAX_RETRY, TIMEOUT_SEC, DESCRIPTION, CREATED_BY, CREATED_AT, UPDATED_BY, UPDATED_AT)
VALUES ('JS', 'JS01', 'IF_RETRY_FAIL', '실패건 재시도', 'RETRY', 'SERVICE', 'InterfaceService.scheduledBulkRetry', NULL, '0 */15 * * * *', 'N', 3, 300, '실패한 인터페이스 로그를 자동으로 재시도', 'system', SYSTIMESTAMP, 'system', SYSTIMESTAMP);

INSERT INTO SCHEDULER_JOBS (COMPANY, PLANT_CD, JOB_CODE, JOB_NAME, JOB_GROUP, EXEC_TYPE, EXEC_TARGET, EXEC_PARAMS, CRON_EXPR, IS_ACTIVE, MAX_RETRY, TIMEOUT_SEC, DESCRIPTION, CREATED_BY, CREATED_AT, UPDATED_BY, UPDATED_AT)
VALUES ('JS', 'JS01', 'DB_CLEANUP_LOGS', '오래된 로그 정리', 'MAINTENANCE', 'SQL', 'DELETE FROM INTER_LOGS WHERE TRANS_DATE < SYSDATE - :retention_days', '{"retention_days": 90}', '0 0 2 * * *', 'N', 1, 600, '90일 이상 지난 인터페이스 로그를 자동 삭제', 'system', SYSTIMESTAMP, 'system', SYSTIMESTAMP);

COMMIT;
```

- [ ] **Step 3: 커밋**

```bash
git add apps/backend/src/entities/scheduler-job.entity.ts apps/backend/src/entities/scheduler-log.entity.ts apps/backend/src/entities/scheduler-notification.entity.ts scripts/migration/seed_scheduler_comcodes.sql scripts/migration/seed_scheduler_jobs.sql
git commit -m "feat(scheduler): add entities and seed SQL for scheduler module"
```

---

## Chunk 2: 백엔드 핵심 — Guards + Config + DTO + Executors

### Task 6: RolesGuard + @Roles 데코레이터

**Files:**
- Create: `apps/backend/src/common/guards/roles.guard.ts`
- Create: `apps/backend/src/common/decorators/roles.decorator.ts`

- [ ] **Step 1: @Roles 데코레이터 작성**

```typescript
/**
 * @file roles.decorator.ts
 * @description 컨트롤러 메서드에 필요한 역할(role)을 지정하는 데코레이터.
 *   RolesGuard와 함께 사용하여 ADMIN 등 권한 제어를 수행한다.
 *   - 초보자 가이드: @Roles('ADMIN')을 컨트롤러 메서드 위에 붙이면
 *     해당 API는 ADMIN 역할 사용자만 접근 가능하다.
 */
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

- [ ] **Step 2: RolesGuard 작성**

```typescript
/**
 * @file roles.guard.ts
 * @description JWT 토큰의 role 필드를 검사하여 접근 권한을 제어하는 가드.
 *   @Roles() 데코레이터가 없는 엔드포인트는 모든 인증된 사용자 접근 가능.
 *   - 초보자 가이드: 컨트롤러에 @UseGuards(RolesGuard)와 @Roles('ADMIN')을 함께 사용.
 *     JwtAuthGuard 뒤에 배치해야 req.user가 존재한다.
 */
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.role) {
      return false;
    }
    return requiredRoles.includes(user.role);
  }
}
```

---

### Task 7: 보안 설정 파일

**Files:**
- Create: `apps/backend/src/modules/scheduler/config/scheduler-security.config.ts`

- [ ] **Step 1: 화이트리스트 설정 작성**

```typescript
/**
 * @file scheduler-security.config.ts
 * @description 스케줄러 실행 유형별 보안 화이트리스트 설정.
 *   - SERVICE: 호출 가능한 서비스.메서드 목록
 *   - SQL: 허용 SQL 패턴 (SELECT/DELETE만)
 *   - HTTP: 허용 호스트 목록 (환경변수)
 *   - SCRIPT: 허용 스크립트 목록 (환경변수)
 *   - 초보자 가이드: 새로운 서비스 메서드를 스케줄러에서 호출하려면
 *     ALLOWED_SERVICE_METHODS에 추가해야 한다.
 */

/** SERVICE executor에서 호출 가능한 서비스.메서드 목록 */
export const ALLOWED_SERVICE_METHODS: string[] = [
  'InterfaceService.scheduledSyncBom',
  'InterfaceService.scheduledBulkRetry',
];

/**
 * SERVICE executor용 서비스 클래스 매핑.
 * ModuleRef.get()은 문자열이 아닌 클래스 참조가 필요하므로 매핑 테이블을 유지한다.
 * 새 서비스를 스케줄러에서 호출하려면 여기에도 등록해야 한다.
 */
import { Type } from '@nestjs/common';
import { InterfaceService } from '../../interface/services/interface.service';

export const SERVICE_CLASS_MAP: Record<string, Type> = {
  InterfaceService: InterfaceService as Type,
};

/** SQL executor에서 허용하는 SQL 시작 패턴 */
export const SQL_ALLOWED_PATTERN = /^\s*(SELECT|DELETE)\s/i;

/** SQL executor에서 차단하는 키워드 */
export const SQL_BLOCKED_KEYWORDS = [
  'BEGIN', 'DROP', 'TRUNCATE', 'ALTER', 'CREATE', 'GRANT', 'EXECUTE', 'MERGE',
];

/**
 * HTTP executor 허용 호스트 목록.
 * 환경변수 SCHEDULER_ALLOWED_HOSTS (쉼표 구분)로 설정.
 */
export function getAllowedHosts(): string[] {
  const envHosts = process.env.SCHEDULER_ALLOWED_HOSTS ?? '';
  return envHosts.split(',').map(h => h.trim()).filter(Boolean);
}

/**
 * SCRIPT executor 허용 스크립트 목록.
 * 환경변수 SCHEDULER_ALLOWED_SCRIPTS (쉼표 구분)로 설정.
 */
export function getAllowedScripts(): string[] {
  const envScripts = process.env.SCHEDULER_ALLOWED_SCRIPTS ?? '';
  return envScripts.split(',').map(s => s.trim()).filter(Boolean);
}

/** SCRIPT executor 허용 확장자 */
export const SCRIPT_ALLOWED_EXTENSIONS = ['.bat', '.sh'];
```

---

### Task 8: DTO

**Files:**
- Create: `apps/backend/src/modules/scheduler/dto/scheduler-job.dto.ts`
- Create: `apps/backend/src/modules/scheduler/dto/scheduler-log.dto.ts`

- [ ] **Step 1: Job DTO 작성**

```typescript
/**
 * @file scheduler-job.dto.ts
 * @description 스케줄러 작업 CRUD용 DTO. 등록/수정/필터 DTO를 포함한다.
 *   - 초보자 가이드: CreateSchedulerJobDto는 작업 등록 시, UpdateSchedulerJobDto는 수정 시,
 *     SchedulerJobFilterDto는 목록 조회 시 사용한다.
 */
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsIn, IsInt, Min, MaxLength,
  IsNotEmpty, Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSchedulerJobDto {
  @ApiProperty({ description: '작업코드', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[A-Z0-9_]+$/, { message: '작업코드는 영문 대문자, 숫자, 언더스코어만 허용' })
  jobCode: string;

  @ApiProperty({ description: '작업명', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  jobName: string;

  @ApiProperty({ description: '작업 그룹 (ComCode SCHED_GROUP)' })
  @IsString()
  @IsNotEmpty()
  jobGroup: string;

  @ApiProperty({ description: '실행 유형', enum: ['SERVICE', 'PROCEDURE', 'SQL', 'HTTP', 'SCRIPT'] })
  @IsIn(['SERVICE', 'PROCEDURE', 'SQL', 'HTTP', 'SCRIPT'])
  execType: string;

  @ApiProperty({ description: '실행 대상', maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  execTarget: string;

  @ApiPropertyOptional({ description: 'JSON 파라미터', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  execParams?: string;

  @ApiProperty({ description: '크론 표현식', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  cronExpr: string;

  @ApiPropertyOptional({ description: '최대 재시도 횟수', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxRetry?: number;

  @ApiPropertyOptional({ description: '타임아웃 (초)', default: 300 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  timeoutSec?: number;

  @ApiPropertyOptional({ description: '설명', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateSchedulerJobDto extends PartialType(CreateSchedulerJobDto) {}

export class SchedulerJobFilterDto {
  @ApiPropertyOptional({ description: '페이지', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @ApiPropertyOptional({ description: '작업 그룹 필터' })
  @IsOptional()
  @IsString()
  jobGroup?: string;

  @ApiPropertyOptional({ description: '실행 유형 필터' })
  @IsOptional()
  @IsString()
  execType?: string;

  @ApiPropertyOptional({ description: '활성 여부 필터' })
  @IsOptional()
  @IsIn(['Y', 'N'])
  isActive?: string;

  @ApiPropertyOptional({ description: '통합 검색어' })
  @IsOptional()
  @IsString()
  search?: string;
}
```

- [ ] **Step 2: Log DTO 작성**

```typescript
/**
 * @file scheduler-log.dto.ts
 * @description 스케줄러 실행 이력 조회용 DTO.
 *   - 초보자 가이드: SchedulerLogFilterDto는 이력 목록 조회 시 필터로 사용한다.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class SchedulerLogFilterDto {
  @ApiPropertyOptional({ description: '페이지', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @ApiPropertyOptional({ description: '작업코드 필터' })
  @IsOptional()
  @IsString()
  jobCode?: string;

  @ApiPropertyOptional({ description: '상태 필터' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '시작일' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '종료일' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
```

---

### Task 9: Executor 인터페이스 + 팩토리

**Files:**
- Create: `apps/backend/src/modules/scheduler/executors/executor.interface.ts`
- Create: `apps/backend/src/modules/scheduler/executors/executor.factory.ts`

- [ ] **Step 1: 인터페이스 작성**

```typescript
/**
 * @file executor.interface.ts
 * @description 스케줄러 작업 실행기의 공통 인터페이스.
 *   모든 Executor는 이 인터페이스를 구현하여 ExecutorFactory에 등록된다.
 *   - 초보자 가이드: 새로운 실행 유형을 추가하려면
 *     1) IJobExecutor 구현체 생성 2) ExecutorFactory에 등록
 */
import { SchedulerJob } from '../../../entities/scheduler-job.entity';

export interface ExecutorResult {
  /** 성공 여부 */
  success: boolean;
  /** 처리 건수 */
  affectedRows?: number;
  /** 결과 메시지 */
  message?: string;
}

export interface IJobExecutor {
  /** 작업 실행 */
  execute(job: SchedulerJob): Promise<ExecutorResult>;
}
```

- [ ] **Step 2: 팩토리 작성**

```typescript
/**
 * @file executor.factory.ts
 * @description EXEC_TYPE에 따라 적절한 Executor를 반환하는 팩토리.
 *   - 초보자 가이드: 스케줄러 러너가 이 팩토리를 통해 실행 유형별 Executor를 가져온다.
 */
import { Injectable, BadRequestException } from '@nestjs/common';
import { IJobExecutor } from './executor.interface';
import { ServiceExecutor } from './service.executor';
import { ProcedureExecutor } from './procedure.executor';
import { SqlExecutor } from './sql.executor';
import { HttpExecutor } from './http.executor';
import { ScriptExecutor } from './script.executor';

@Injectable()
export class ExecutorFactory {
  private readonly executors: Map<string, IJobExecutor>;

  constructor(
    private readonly serviceExecutor: ServiceExecutor,
    private readonly procedureExecutor: ProcedureExecutor,
    private readonly sqlExecutor: SqlExecutor,
    private readonly httpExecutor: HttpExecutor,
    private readonly scriptExecutor: ScriptExecutor,
  ) {
    this.executors = new Map<string, IJobExecutor>([
      ['SERVICE', this.serviceExecutor],
      ['PROCEDURE', this.procedureExecutor],
      ['SQL', this.sqlExecutor],
      ['HTTP', this.httpExecutor],
      ['SCRIPT', this.scriptExecutor],
    ]);
  }

  get(execType: string): IJobExecutor {
    const executor = this.executors.get(execType);
    if (!executor) {
      throw new BadRequestException(`지원하지 않는 실행 유형: ${execType}`);
    }
    return executor;
  }
}
```

---

### Task 10: 5개 Executor 구현

**Files:**
- Create: `apps/backend/src/modules/scheduler/executors/service.executor.ts`
- Create: `apps/backend/src/modules/scheduler/executors/procedure.executor.ts`
- Create: `apps/backend/src/modules/scheduler/executors/sql.executor.ts`
- Create: `apps/backend/src/modules/scheduler/executors/http.executor.ts`
- Create: `apps/backend/src/modules/scheduler/executors/script.executor.ts`

- [ ] **Step 1: ServiceExecutor 작성**

ModuleRef를 사용하여 NestJS 서비스 인스턴스를 가져오고 메서드를 호출한다.
화이트리스트(`ALLOWED_SERVICE_METHODS`)에 등록된 메서드만 실행 허용.

```typescript
/**
 * @file service.executor.ts
 * @description NestJS 내부 서비스 메서드를 호출하는 Executor.
 *   EXEC_TARGET: "ServiceName.methodName" 형식.
 *   ALLOWED_SERVICE_METHODS 화이트리스트에 등록된 메서드만 실행 가능.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { IJobExecutor, ExecutorResult } from './executor.interface';
import { SchedulerJob } from '../../../entities/scheduler-job.entity';
import { ALLOWED_SERVICE_METHODS, SERVICE_CLASS_MAP } from '../config/scheduler-security.config';

@Injectable()
export class ServiceExecutor implements IJobExecutor {
  private readonly logger = new Logger(ServiceExecutor.name);

  constructor(private readonly moduleRef: ModuleRef) {}

  async execute(job: SchedulerJob): Promise<ExecutorResult> {
    const { execTarget, execParams } = job;

    if (!ALLOWED_SERVICE_METHODS.includes(execTarget)) {
      return { success: false, message: `허용되지 않은 서비스 메서드: ${execTarget}` };
    }

    const [serviceName, methodName] = execTarget.split('.');
    if (!serviceName || !methodName) {
      return { success: false, message: `잘못된 EXEC_TARGET 형식: ${execTarget} (ServiceName.methodName 필요)` };
    }

    const serviceClass = SERVICE_CLASS_MAP[serviceName];
    if (!serviceClass) {
      return { success: false, message: `등록되지 않은 서비스: ${serviceName} (scheduler-security.config.ts에 등록 필요)` };
    }

    const service = this.moduleRef.get(serviceClass, { strict: false });
    if (!service || typeof service[methodName] !== 'function') {
      return { success: false, message: `서비스 또는 메서드를 찾을 수 없음: ${execTarget}` };
    }

    const params = execParams ? JSON.parse(execParams) : {};
    this.logger.log(`SERVICE 실행: ${execTarget}`);
    const result = await service[methodName](params);

    return {
      success: true,
      affectedRows: result?.affectedRows ?? 0,
      message: result?.message ?? `${execTarget} 실행 완료`,
    };
  }
}
```

- [ ] **Step 2: ProcedureExecutor 작성**

```typescript
/**
 * @file procedure.executor.ts
 * @description Oracle 프로시저/패키지를 호출하는 Executor.
 *   EXEC_TARGET: "PKG_NAME.PROC_NAME" 형식.
 *   기존 OracleService.callProc()를 활용한다.
 */
import { Injectable, Logger } from '@nestjs/common';
import { IJobExecutor, ExecutorResult } from './executor.interface';
import { SchedulerJob } from '../../../entities/scheduler-job.entity';
import { OracleService } from '../../../common/services/oracle.service';

@Injectable()
export class ProcedureExecutor implements IJobExecutor {
  private readonly logger = new Logger(ProcedureExecutor.name);

  constructor(private readonly oracleService: OracleService) {}

  async execute(job: SchedulerJob): Promise<ExecutorResult> {
    const { execTarget, execParams } = job;
    const [pkgName, procName] = execTarget.split('.');
    if (!pkgName || !procName) {
      return { success: false, message: `잘못된 EXEC_TARGET 형식: ${execTarget} (PKG.PROC 필요)` };
    }

    const params = execParams ? JSON.parse(execParams) : {};
    this.logger.log(`PROCEDURE 실행: ${pkgName}.${procName}`);
    const rows = await this.oracleService.callProc(pkgName, procName, params);

    return {
      success: true,
      affectedRows: Array.isArray(rows) ? rows.length : 0,
      message: `${pkgName}.${procName} 실행 완료`,
    };
  }
}
```

- [ ] **Step 3: SqlExecutor 작성**

```typescript
/**
 * @file sql.executor.ts
 * @description SQL을 직접 실행하는 Executor. SELECT/DELETE만 허용.
 *   DROP, TRUNCATE, ALTER 등 위험 키워드는 차단.
 */
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { IJobExecutor, ExecutorResult } from './executor.interface';
import { SchedulerJob } from '../../../entities/scheduler-job.entity';
import { SQL_ALLOWED_PATTERN, SQL_BLOCKED_KEYWORDS } from '../config/scheduler-security.config';

@Injectable()
export class SqlExecutor implements IJobExecutor {
  private readonly logger = new Logger(SqlExecutor.name);

  constructor(private readonly dataSource: DataSource) {}

  async execute(job: SchedulerJob): Promise<ExecutorResult> {
    const { execTarget, execParams } = job;

    if (!SQL_ALLOWED_PATTERN.test(execTarget)) {
      return { success: false, message: 'SQL은 SELECT 또는 DELETE로 시작해야 합니다' };
    }

    const upperSql = execTarget.toUpperCase();
    for (const keyword of SQL_BLOCKED_KEYWORDS) {
      if (upperSql.includes(keyword)) {
        return { success: false, message: `차단된 SQL 키워드: ${keyword}` };
      }
    }

    const params = execParams ? JSON.parse(execParams) : {};

    this.logger.log(`SQL 실행: ${execTarget.substring(0, 100)}...`);
    // Oracle은 :name 바인드 사용 — params 객체를 그대로 전달
    const result = await this.dataSource.query(execTarget, params);
    const affectedRows = Array.isArray(result) ? result.length : (result?.rowsAffected ?? 0);

    return {
      success: true,
      affectedRows,
      message: `SQL 실행 완료 (${affectedRows}건 처리)`,
    };
  }
}
```

- [ ] **Step 4: HttpExecutor 작성**

```typescript
/**
 * @file http.executor.ts
 * @description 외부 HTTP API를 호출하는 Executor.
 *   EXEC_TARGET: "METHOD URL" 형식 (예: "POST https://erp.com/api/sync").
 *   SCHEDULER_ALLOWED_HOSTS 환경변수에 등록된 호스트만 허용.
 */
import { Injectable, Logger } from '@nestjs/common';
import { IJobExecutor, ExecutorResult } from './executor.interface';
import { SchedulerJob } from '../../../entities/scheduler-job.entity';
import { getAllowedHosts } from '../config/scheduler-security.config';

@Injectable()
export class HttpExecutor implements IJobExecutor {
  private readonly logger = new Logger(HttpExecutor.name);

  async execute(job: SchedulerJob): Promise<ExecutorResult> {
    const { execTarget, execParams } = job;
    const spaceIdx = execTarget.indexOf(' ');
    if (spaceIdx === -1) {
      return { success: false, message: `잘못된 EXEC_TARGET 형식: "METHOD URL" 필요` };
    }

    const method = execTarget.substring(0, spaceIdx).toUpperCase();
    const url = execTarget.substring(spaceIdx + 1).trim();

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return { success: false, message: `유효하지 않은 URL: ${url}` };
    }

    if (/^\d+\.\d+\.\d+\.\d+$/.test(parsedUrl.hostname)) {
      return { success: false, message: 'IP 직접 입력은 허용되지 않습니다. 호스트명을 사용하세요.' };
    }

    const allowedHosts = getAllowedHosts();
    if (allowedHosts.length > 0 && !allowedHosts.includes(parsedUrl.hostname)) {
      return { success: false, message: `허용되지 않은 호스트: ${parsedUrl.hostname}` };
    }

    const params = execParams ? JSON.parse(execParams) : {};
    const { headers = {}, body = {} } = params;

    this.logger.log(`HTTP 실행: ${method} ${url}`);
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: ['GET', 'HEAD'].includes(method) ? undefined : JSON.stringify(body),
    });

    const responseText = await response.text();
    if (!response.ok) {
      return { success: false, message: `HTTP ${response.status}: ${responseText.substring(0, 500)}` };
    }

    return {
      success: true,
      message: `HTTP ${response.status} OK`,
    };
  }
}
```

- [ ] **Step 5: ScriptExecutor 작성**

```typescript
/**
 * @file script.executor.ts
 * @description 외부 스크립트/프로그램을 실행하는 Executor.
 *   SCHEDULER_ALLOWED_SCRIPTS 환경변수에 등록된 스크립트만 허용.
 *   .bat / .sh 확장자만 허용. 심링크 해석 후 경로 검증.
 */
import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { IJobExecutor, ExecutorResult } from './executor.interface';
import { SchedulerJob } from '../../../entities/scheduler-job.entity';
import {
  getAllowedScripts,
  SCRIPT_ALLOWED_EXTENSIONS,
} from '../config/scheduler-security.config';

const execFileAsync = promisify(execFile);

@Injectable()
export class ScriptExecutor implements IJobExecutor {
  private readonly logger = new Logger(ScriptExecutor.name);

  async execute(job: SchedulerJob): Promise<ExecutorResult> {
    const { execTarget, execParams, timeoutSec } = job;
    const ext = path.extname(execTarget).toLowerCase();

    if (!SCRIPT_ALLOWED_EXTENSIONS.includes(ext)) {
      return { success: false, message: `허용되지 않은 확장자: ${ext} (.bat/.sh만 허용)` };
    }

    let realPath: string;
    try {
      realPath = fs.realpathSync(execTarget);
    } catch {
      return { success: false, message: `스크립트 파일을 찾을 수 없음: ${execTarget}` };
    }

    const allowedScripts = getAllowedScripts();
    if (allowedScripts.length > 0 && !allowedScripts.includes(realPath)) {
      return { success: false, message: `허용되지 않은 스크립트: ${realPath}` };
    }

    const params = execParams ? JSON.parse(execParams) : {};
    const args: string[] = params.args ?? [];

    this.logger.log(`SCRIPT 실행: ${realPath} ${args.join(' ')}`);
    const { stdout, stderr } = await execFileAsync(realPath, args, {
      timeout: (timeoutSec ?? 300) * 1000,
    });

    if (stderr) {
      this.logger.warn(`SCRIPT stderr: ${stderr.substring(0, 500)}`);
    }

    return {
      success: true,
      message: stdout.substring(0, 1000) || 'Script 실행 완료',
    };
  }
}
```

- [ ] **Step 6: 커밋**

```bash
git add apps/backend/src/common/guards/roles.guard.ts apps/backend/src/common/decorators/roles.decorator.ts apps/backend/src/modules/scheduler/config/ apps/backend/src/modules/scheduler/dto/ apps/backend/src/modules/scheduler/executors/
git commit -m "feat(scheduler): add guards, DTOs, security config, and 5 executors"
```

---

## Chunk 3: 백엔드 서비스 + 컨트롤러 + 모듈 등록

### Task 11: SchedulerLogService

**Files:**
- Create: `apps/backend/src/modules/scheduler/services/scheduler-log.service.ts`

- [ ] **Step 1: 이력 서비스 작성**

이력 기록(create), 상태 업데이트, 조회(필터/페이지네이션), 대시보드 통계(오늘 성공/실패/성공률, 7일 추이, 작업별 비율, 최근 실패 5건), 서버 시작 시 RUNNING/RETRYING → FAIL 복구.

핵심 메서드:
- `createLog(data)` — RUNNING 상태로 생성, LOG_ID 채번
- `updateLog(pk, updates)` — 상태/종료시각/에러 업데이트
- `findAll(filter, company, plant)` — 필터+페이지네이션
- `getSummary(company, plant)` — 대시보드 통계
- `recoverStaleRunning(company, plant)` — RUNNING/RETRYING → FAIL

---

### Task 12: SchedulerNotiService

**Files:**
- Create: `apps/backend/src/modules/scheduler/services/scheduler-noti.service.ts`

- [ ] **Step 1: 알림 서비스 작성**

핵심 메서드:
- `createNotification(data)` — NOTI_ID 채번, 알림 생성
- `findByUser(userId, company)` — 사용자별 알림 목록
- `getUnreadCount(userId, company)` — 읽지 않은 건수
- `markAsRead(company, notiId)` — 읽음 처리
- `markAllAsRead(userId, company)` — 모두 읽음

---

### Task 13: SchedulerRunnerService

**Files:**
- Create: `apps/backend/src/modules/scheduler/services/scheduler-runner.service.ts`

- [ ] **Step 1: 실행 엔진 서비스 작성**

핵심 흐름:
1. `execute(job)` 호출
2. 동시 실행 방지: RUNNING/RETRYING 체크 → SKIPPED
3. SCHEDULER_LOGS에 RUNNING 기록
4. `ExecutorFactory.get(execType).execute(job)` 호출 (타임아웃 적용)
5. 성공 → SUCCESS 기록, LAST_RUN_AT/NEXT_RUN_AT 갱신
6. 실패 → RETRY_COUNT < MAX_RETRY면 RETRYING + setTimeout 재시도
7. 최종 실패 → FAIL 기록, 알림 생성

타임아웃은 `Promise.race([executor, timeoutPromise])` 패턴.
재시도는 `setTimeout(retryFn, delay)` (1분, 2분, 4분 지수 백오프).

---

### Task 14: SchedulerJobService

**Files:**
- Create: `apps/backend/src/modules/scheduler/services/scheduler-job.service.ts`

- [ ] **Step 1: 작업 관리 서비스 작성**

핵심 메서드:
- `onModuleInit()` — 서버 시작 시:
  1. `logService.recoverStaleRunning()` 호출
  2. DB에서 IS_ACTIVE='Y' 작업 로드
  3. `SchedulerRegistry.addCronJob()` 으로 등록
  4. 각 작업의 NEXT_RUN_AT 갱신
- `findAll(filter, company, plant)` — 작업 목록 조회
- `create(dto, company, plant, userId)` — 작업 등록 + 활성이면 CronJob 등록
- `update(jobCode, dto, company, plant, userId)` — 작업 수정 + CronJob 재등록
- `remove(jobCode, company, plant)` — 작업 삭제 + CronJob 제거
- `toggle(jobCode, company, plant, userId)` — 활성/비활성 토글
- `runNow(jobCode, company, plant)` — 수동 즉시 실행
- `registerCronJob(job)` — SchedulerRegistry에 CronJob 등록 (private)
- `unregisterCronJob(key)` — SchedulerRegistry에서 CronJob 제거 (private)
- `computeNextRun(cronExpr)` — 다음 실행 시각 계산 (`cron-parser` 라이브러리 사용)

CronJob 키: `${company}_${plantCd}_${jobCode}`

---

### Task 15: 컨트롤러 3개

**Files:**
- Create: `apps/backend/src/modules/scheduler/controllers/scheduler-job.controller.ts`
- Create: `apps/backend/src/modules/scheduler/controllers/scheduler-log.controller.ts`
- Create: `apps/backend/src/modules/scheduler/controllers/scheduler-noti.controller.ts`

- [ ] **Step 1: SchedulerJobController 작성**

경로: `scheduler/jobs`. JwtAuthGuard + RolesGuard 적용.
- GET `/` — findAll (ALL)
- POST `/` — create (@Roles('ADMIN'))
- PUT `/:jobCode` — update (@Roles('ADMIN'))
- DELETE `/:jobCode` — remove (@Roles('ADMIN'))
- POST `/:jobCode/run` — runNow (@Roles('ADMIN'))
- PATCH `/:jobCode/toggle` — toggle (@Roles('ADMIN'))

- [ ] **Step 2: SchedulerLogController 작성**

경로: `scheduler/logs`. JwtAuthGuard 적용.
- GET `/` — findAll (ALL)
- GET `/summary` — getSummary (ALL)

- [ ] **Step 3: SchedulerNotiController 작성**

경로: `scheduler/notifications`. JwtAuthGuard 적용.
- GET `/` — findByUser (ALL, req.user.id 기반)
- GET `/unread-count` — getUnreadCount (ALL)
- PATCH `/:notiId/read` — markAsRead (ALL)
- PATCH `/read-all` — markAllAsRead (ALL)

---

### Task 16: 모듈 정의 + AppModule 등록

**Files:**
- Create: `apps/backend/src/modules/scheduler/scheduler.module.ts`
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 1: scheduler.module.ts 작성**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerJob } from '../../entities/scheduler-job.entity';
import { SchedulerLog } from '../../entities/scheduler-log.entity';
import { SchedulerNotification } from '../../entities/scheduler-notification.entity';
// ... import controllers, services, executors
```

ScheduleModule.forRoot()를 imports에 추가.
TypeOrmModule.forFeature([SchedulerJob, SchedulerLog, SchedulerNotification]).
모든 서비스, 컨트롤러, Executor를 등록.
InterfaceModule을 imports하여 InterfaceService 접근.

- [ ] **Step 2: app.module.ts에 SchedulerModule 추가**

기존 모듈 import 목록에 `SchedulerModule` 추가.

---

### Task 17: InterfaceService 래퍼 메서드

**Files:**
- Modify: `apps/backend/src/modules/interface/services/interface.service.ts`

- [ ] **Step 1: scheduledSyncBom() 래퍼 메서드 추가**

기존 `syncBom()` 메서드를 감싸서 파라미터 없이 호출 가능하게 만든다.
내부에서 동기화 대상을 자동 조회.

- [ ] **Step 2: scheduledBulkRetry() 래퍼 메서드 추가**

기존 `getFailedLogs()` + `bulkRetry()` 를 감싸서 파라미터 없이 호출 가능하게 만든다.

- [ ] **Step 3: 빌드 확인**

```bash
cd /c/Project/HANES && pnpm --filter @harness/backend build 2>&1 | tail -5
```

- [ ] **Step 4: 커밋**

```bash
git add apps/backend/src/modules/scheduler/ apps/backend/src/app.module.ts apps/backend/src/modules/interface/services/interface.service.ts
git commit -m "feat(scheduler): add services, controllers, module, and interface wrappers"
```

---

## Chunk 4: 프론트엔드 — 메뉴 + i18n + 페이지

### Task 18: 메뉴 등록 + i18n

**Files:**
- Modify: `packages/shared/src/constants/menu.ts`
- Modify: `apps/frontend/src/locales/ko.json`
- Modify: `apps/frontend/src/locales/en.json`
- Modify: `apps/frontend/src/locales/zh.json`
- Modify: `apps/frontend/src/locales/vi.json`

- [ ] **Step 1: menu.ts에 스케줄러 메뉴 추가**

`system` 그룹 하위에:
```typescript
{ key: 'system-scheduler', label: '스케줄러 관리', icon: 'Clock', path: '/system/scheduler' }
```

- [ ] **Step 2: 4개 i18n 파일에 scheduler 키 추가**

ko.json:
```json
"scheduler": {
  "title": "스케줄러 관리",
  "jobs": "작업 관리",
  "logs": "실행 이력",
  "dashboard": "대시보드",
  "jobCode": "작업코드",
  "jobName": "작업명",
  "jobGroup": "작업그룹",
  "execType": "실행유형",
  "execTarget": "실행대상",
  "execParams": "실행파라미터",
  "cronExpr": "크론표현식",
  "cronDesc": "실행주기",
  "isActive": "활성",
  "maxRetry": "최대재시도",
  "timeoutSec": "타임아웃(초)",
  "description": "설명",
  "lastRunAt": "마지막실행",
  "nextRunAt": "다음실행",
  "lastErrorAt": "마지막에러",
  "runNow": "즉시실행",
  "toggle": "활성토글",
  "startTime": "시작시각",
  "endTime": "종료시각",
  "duration": "소요시간",
  "affectedRows": "처리건수",
  "retryCount": "재시도",
  "resultMsg": "결과메시지",
  "errorMsg": "에러상세",
  "todayTotal": "오늘 실행",
  "todaySuccess": "성공",
  "todayFail": "실패",
  "successRate": "성공률",
  "trendChart": "7일간 실행 추이",
  "ratioChart": "작업별 성공/실패",
  "recentFails": "최근 실패",
  "notification": "알림",
  "markAllRead": "모두 읽음",
  "noUnread": "읽지 않은 알림 없음",
  "confirmDelete": "이 작업을 삭제하시겠습니까?",
  "confirmRun": "이 작업을 즉시 실행하시겠습니까?"
}
```

en/zh/vi도 동일 구조로 번역 추가.

---

### Task 19: 메인 페이지 (3탭 컨테이너)

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/system/scheduler/page.tsx`

- [ ] **Step 1: 3탭 컨테이너 페이지 작성**

```typescript
"use client";
/**
 * @file page.tsx
 * @description 스케줄러 관리 메인 페이지. 3개 탭(작업관리/실행이력/대시보드)으로 구성.
 */
```

탭 컴포넌트 사용, 각 탭은 lazy import로 분리:
- SchedulerJobTab
- SchedulerLogTab
- SchedulerDashboardTab

---

### Task 20: 작업 관리 탭 (SchedulerJobTab)

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/system/scheduler/components/SchedulerJobTab.tsx`

- [ ] **Step 1: DataGrid + 필터 + 액션 버튼**

- DataGrid 컬럼: jobCode, jobName, jobGroup(ComCodeBadge), execType(ComCodeBadge), cronExpr, isActive(토글), lastRunAt, nextRunAt, lastStatus(ComCodeBadge)
- 필터: 그룹 셀렉트, 실행유형 셀렉트
- 버튼: 등록(ADMIN), 즉시실행(ADMIN), 삭제(ADMIN)
- 활성 토글: ADMIN만 클릭 가능
- 행 클릭 → 수정 모달

---

### Task 21: 작업 등록/수정 모달 (SchedulerJobModal)

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/system/scheduler/components/SchedulerJobModal.tsx`

- [ ] **Step 1: 동적 폼 모달 작성 (lg 사이즈)**

- 기본 필드: jobCode(등록 시만 편집), jobName, jobGroup(셀렉트)
- 실행유형 셀렉트 → 유형별 동적 폼 전환:
  - SERVICE: 셀렉트 (화이트리스트 메서드 목록)
  - PROCEDURE: 텍스트 입력 (PKG.PROC) + JSON 에디터
  - SQL: 텍스트에어리어 + JSON 에디터
  - HTTP: 메서드 셀렉트 + URL 입력 + 헤더 JSON + Body JSON
  - SCRIPT: 텍스트 입력 + 인자 입력
- 크론 표현식 입력 + cronstrue 실시간 한글 해석 표시
- maxRetry, timeoutSec, description

---

### Task 22: 실행 이력 탭 (SchedulerLogTab)

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/system/scheduler/components/SchedulerLogTab.tsx`
- Create: `apps/frontend/src/app/(authenticated)/system/scheduler/components/LogDetailModal.tsx`

- [ ] **Step 1: 이력 DataGrid + 필터**

- 필터: 기간(DatePicker), 작업(셀렉트), 상태(셀렉트)
- DataGrid: logId, jobCode(작업명), execType, startTime, endTime, durationMs, status(ComCodeBadge), affectedRows, retryCount
- 실패 행 클릭 → LogDetailModal (에러 메시지 상세)

- [ ] **Step 2: LogDetailModal 작성**

에러 메시지를 읽기 전용으로 표시하는 모달(md 사이즈).

---

### Task 23: 대시보드 탭 (SchedulerDashboardTab)

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/system/scheduler/components/SchedulerDashboardTab.tsx`

- [ ] **Step 1: StatCard 4개 + 차트 2개 + 최근 실패 목록**

- StatCard: 오늘 실행, 성공, 실패, 성공률
- 7일 추이 LineChart (recharts)
- 작업별 성공/실패 BarChart (recharts)
- 최근 실패 로그 5건 (간단한 테이블)
- API: GET `/scheduler/logs/summary`

---

### Task 24: 커밋

- [ ] **Step 1: 프론트엔드 파일 커밋**

```bash
git add packages/shared/src/constants/menu.ts apps/frontend/src/locales/ apps/frontend/src/app/\(authenticated\)/system/scheduler/
git commit -m "feat(scheduler): add frontend pages - job management, logs, dashboard"
```

---

## Chunk 5: 헤더 알림 벨 + 최종 통합

### Task 25: NotificationBell 컴포넌트

**Files:**
- Create: `apps/frontend/src/components/shared/NotificationBell.tsx`

- [ ] **Step 1: 벨 아이콘 + 드롭다운 작성**

- 60초 폴링으로 읽지 않은 건수 조회 (GET `/scheduler/notifications/unread-count`)
- 벨 클릭 → 드롭다운 (최근 알림 목록)
- 각 알림 클릭 → 읽음 처리 (PATCH `/scheduler/notifications/:id/read`)
- "모두 읽음" 버튼 (PATCH `/scheduler/notifications/read-all`)
- 알림 유형별 아이콘/색상 (FAIL=빨강, TIMEOUT=주황)

---

### Task 26: Header에 NotificationBell 삽입

**Files:**
- Modify: `apps/frontend/src/components/layout/Header.tsx` (또는 해당 헤더 파일)

- [ ] **Step 1: 기존 헤더에 NotificationBell 삽입**

기존 벨 아이콘 placeholder가 있다면 교체, 없다면 사용자명 왼쪽에 추가.

---

### Task 27: 최종 빌드 검증

- [ ] **Step 1: 전체 빌드**

```bash
cd /c/Project/HANES && pnpm build 2>&1 | tail -20
```
Expected: 에러 0건

- [ ] **Step 2: i18n 키 검증**

새로 추가한 scheduler 키가 ko/en/zh/vi 4개 파일에 모두 존재하는지 확인.

```bash
cd /c/Project/HANES && grep -l '"scheduler"' apps/frontend/src/locales/*.json
```
Expected: ko.json, en.json, zh.json, vi.json 4개

- [ ] **Step 3: 최종 커밋**

```bash
git add apps/frontend/src/components/shared/NotificationBell.tsx apps/frontend/src/components/layout/Header.tsx
git commit -m "feat(scheduler): add notification bell to header with 60s polling"
```

---

## Task Dependencies

```
Task 1 (패키지 설치)
  └→ Task 2-4 (엔티티) ─ 병렬 가능
  └→ Task 5 (시드 SQL) ─ 엔티티 확인 후
  └→ Task 6-10 (Guards + Config + DTO + Executors) ─ 병렬 가능
      └→ Task 11-13 (Log/Noti/Runner 서비스) ─ 순차 (Runner가 Log+Noti 의존)
          └→ Task 14 (Job 서비스) ─ Runner 의존
              └→ Task 15 (컨트롤러) ─ 모든 서비스 의존
                  └→ Task 16 (모듈 등록)
                      └→ Task 17 (InterfaceService 래퍼)
  └→ Task 18 (메뉴 + i18n) ─ 독립
  └→ Task 19-23 (프론트엔드 페이지) ─ Task 18 이후, 컴포넌트 간 독립
      └→ Task 24 (프론트엔드 커밋)
  └→ Task 25-26 (알림 벨) ─ Task 19 이후
      └→ Task 27 (최종 검증)
```
