# 스케줄러 관리 모듈 설계

> 작성일: 2026-03-18
> 상태: 확정 (v2 — 리뷰 반영)

## 1. 개요

HANES MES에 스케줄러 관리 기능을 추가한다. `@nestjs/schedule`의 `SchedulerRegistry`를 활용하여 런타임에 크론잡을 동적으로 등록/해제하며, 모든 설정은 Oracle DB에 저장하고 UI에서 관리한다.

### 핵심 요구사항

- ERP ↔ MES 인터페이스 자동 동기화 (BOM, 품목, 작업지시)
- 실패한 인터페이스 로그 자동 재시도
- DB 백업/데이터 정리 (오래된 로그 삭제 등)
- 모든 주기/횟수는 사용자가 UI에서 설정
- 실행 이력 + 대시보드 + 실패 시 화면 내 알림
- 관리자(ADMIN)만 등록/수정/삭제, 일반 사용자 조회만

### 기술 스택

| 항목 | 선택 | 이유 |
|------|------|------|
| 스케줄러 | `@nestjs/schedule` + `SchedulerRegistry` | NestJS 공식, 단일 서버 환경에 적합, 동적 크론잡 관리 |
| 크론 해석 | `cronstrue` (frontend) | 크론 표현식 → 한글 변환 |
| DB | Oracle (기존) | 프로젝트 표준 |

---

## 2. DB 테이블

### 2.1 SCHEDULER_JOBS (스케줄 작업 정의)

PK: `(COMPANY, PLANT_CD, JOB_CODE)` — 멀티테넌시 복합키

| 컬럼 | 타입 | PK | 설명 |
|------|------|:--:|------|
| COMPANY | VARCHAR2(20) | ● | 멀티테넌시 |
| PLANT_CD | VARCHAR2(20) | ● | 사업장 |
| JOB_CODE | VARCHAR2(50) | ● | 작업코드 (예: `IF_SYNC_BOM`) |
| JOB_NAME | NVARCHAR2(100) | | 작업명 |
| JOB_GROUP | VARCHAR2(20) | | 그룹 — ComCode `SCHED_GROUP` |
| EXEC_TYPE | VARCHAR2(20) | | 실행 유형 — ComCode `SCHED_EXEC_TYPE` |
| EXEC_TARGET | NVARCHAR2(500) | | 실행 대상 (프로시저명, URL, 스크립트 경로 등) |
| EXEC_PARAMS | NVARCHAR2(2000) | | JSON 파라미터 |
| CRON_EXPR | VARCHAR2(50) | | 크론 표현식 |
| IS_ACTIVE | CHAR(1) | | 활성여부 (`Y`/`N`) |
| MAX_RETRY | NUMBER(3) | | 최대 재시도 횟수 |
| TIMEOUT_SEC | NUMBER(5) | | 타임아웃 (초) |
| DESCRIPTION | NVARCHAR2(500) | | 설명 |
| LAST_RUN_AT | TIMESTAMP | | 마지막 실행 시각 |
| LAST_STATUS | VARCHAR2(20) | | 마지막 실행 상태 |
| LAST_ERROR_AT | TIMESTAMP | | 마지막 에러 시각 (대시보드 필터용) |
| NEXT_RUN_AT | TIMESTAMP | | 다음 예정 실행 시각 (스케줄 등록/실행 후 갱신) |
| CREATED_BY | VARCHAR2(50) | | 등록자 |
| CREATED_AT | TIMESTAMP | | 등록일 |
| UPDATED_BY | VARCHAR2(50) | | 수정자 |
| UPDATED_AT | TIMESTAMP | | 수정일 |

### 2.2 SCHEDULER_LOGS (실행 이력)

PK: `(COMPANY, PLANT_CD, LOG_ID)` — 테넌트 스코프

인덱스: `IDX_SCHED_LOGS_SEARCH (COMPANY, PLANT_CD, START_TIME, STATUS)` — 대시보드 집계 성능

| 컬럼 | 타입 | PK | 설명 |
|------|------|:--:|------|
| COMPANY | VARCHAR2(20) | ● | 멀티테넌시 |
| PLANT_CD | VARCHAR2(20) | ● | 사업장 |
| LOG_ID | NUMBER | ● | 시퀀스 (PKG_SEQ_GENERATOR) |
| JOB_CODE | VARCHAR2(50) | | FK → SCHEDULER_JOBS.JOB_CODE |
| START_TIME | TIMESTAMP | | 시작 시각 |
| END_TIME | TIMESTAMP | | 종료 시각 |
| DURATION_MS | NUMBER(10) | | 소요시간 (ms) |
| STATUS | VARCHAR2(20) | | ComCode `SCHED_STATUS` |
| RESULT_MSG | NVARCHAR2(2000) | | 결과 메시지 |
| ERROR_MSG | NVARCHAR2(4000) | | 에러 상세 |
| RETRY_COUNT | NUMBER(3) | | 재시도 횟수 |
| AFFECTED_ROWS | NUMBER(10) | | 처리 건수 |
| CREATED_AT | TIMESTAMP | | 생성일 |
| UPDATED_AT | TIMESTAMP | | 수정일 (RUNNING→FAIL 변경 시 갱신) |

### 2.3 SCHEDULER_NOTIFICATIONS (알림)

PK: `(COMPANY, NOTI_ID)` — 테넌트 스코프

| 컬럼 | 타입 | PK | 설명 |
|------|------|:--:|------|
| COMPANY | VARCHAR2(20) | ● | 멀티테넌시 |
| NOTI_ID | NUMBER | ● | 시퀀스 |
| JOB_CODE | VARCHAR2(50) | | FK → SCHEDULER_JOBS.JOB_CODE |
| PLANT_CD | VARCHAR2(20) | | 사업장 |
| USER_ID | VARCHAR2(50) | | 알림 대상 사용자 |
| NOTI_TYPE | VARCHAR2(20) | | `FAIL` / `TIMEOUT` / `SUCCESS` |
| MESSAGE | NVARCHAR2(500) | | 알림 내용 |
| IS_READ | CHAR(1) | | 읽음 여부 |
| CREATED_AT | TIMESTAMP | | 생성일 |
| UPDATED_AT | TIMESTAMP | | 수정일 (읽음 처리 시 갱신) |

---

## 3. 공통코드 (COM_CODES)

| 그룹코드 | 코드값 | 코드명 |
|---------|--------|--------|
| SCHED_GROUP | INTERFACE | 인터페이스 |
| SCHED_GROUP | RETRY | 재시도 |
| SCHED_GROUP | MAINTENANCE | DB 유지보수 |
| SCHED_EXEC_TYPE | SERVICE | 내부 서비스 |
| SCHED_EXEC_TYPE | PROCEDURE | Oracle 프로시저 |
| SCHED_EXEC_TYPE | SQL | SQL 실행 |
| SCHED_EXEC_TYPE | HTTP | HTTP API |
| SCHED_EXEC_TYPE | SCRIPT | 외부 스크립트 |
| SCHED_STATUS | SUCCESS | 성공 |
| SCHED_STATUS | FAIL | 실패 |
| SCHED_STATUS | RUNNING | 실행중 |
| SCHED_STATUS | RETRYING | 재시도중 |
| SCHED_STATUS | TIMEOUT | 타임아웃 |
| SCHED_STATUS | SKIPPED | 스킵 |

---

## 4. 백엔드 모듈 아키텍처

### 4.1 디렉토리 구조

```
apps/backend/src/modules/scheduler/
├── scheduler.module.ts
├── controllers/
│   ├── scheduler-job.controller.ts    # 작업 CRUD + 수동실행 + 토글
│   ├── scheduler-log.controller.ts    # 이력 조회 + 대시보드 통계
│   └── scheduler-noti.controller.ts   # 알림 조회 + 읽음처리
├── services/
│   ├── scheduler-job.service.ts       # 작업 관리 + SchedulerRegistry 연동
│   ├── scheduler-log.service.ts       # 이력 기록/조회/통계
│   ├── scheduler-noti.service.ts      # 알림 생성/조회
│   └── scheduler-runner.service.ts    # 작업 실행 엔진 (Executor 디스패치)
├── executors/
│   ├── executor.interface.ts          # IJobExecutor 인터페이스
│   ├── executor.factory.ts            # EXEC_TYPE → Executor 매핑
│   ├── service.executor.ts            # NestJS 서비스 메서드 호출
│   ├── procedure.executor.ts          # Oracle 프로시저/패키지 호출
│   ├── sql.executor.ts                # SQL 직접 실행
│   ├── http.executor.ts               # 외부 HTTP API 호출
│   └── script.executor.ts             # 외부 스크립트/프로그램 실행
├── guards/
│   └── roles.guard.ts                 # RolesGuard + @Roles() 데코레이터
├── dto/
│   ├── scheduler-job.dto.ts
│   └── scheduler-log.dto.ts
└── config/
    └── scheduler-security.config.ts   # 보안 화이트리스트 설정
```

### 4.2 엔티티

```
apps/backend/src/entities/
├── scheduler-job.entity.ts
├── scheduler-log.entity.ts
└── scheduler-notification.entity.ts
```

### 4.3 권한 제어: RolesGuard + @Roles()

현재 프로젝트에 RolesGuard가 없으므로 스케줄러 모듈에서 신규 생성:

```typescript
// guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  // JWT 토큰의 role 필드를 검사하여 ADMIN 여부 판단
}

// decorators/roles.decorator.ts
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
```

향후 다른 모듈에서도 재사용 가능하도록 `common/guards/`로 이동 고려.

### 4.4 핵심 흐름

```
서버 시작 (OnModuleInit)
  ├→ RUNNING/RETRYING 상태 로그 → FAIL로 변경 (비정상 종료 감지)
  └→ DB에서 IS_ACTIVE='Y' 작업 로드
     └→ SchedulerRegistry에 CronJob 등록 + NEXT_RUN_AT 갱신

UI에서 작업 수정
  └→ DB 업데이트
     └→ SchedulerRegistry에서 기존 잡 삭제 → 새 잡 등록 + NEXT_RUN_AT 갱신

CronJob 트리거
  └→ SchedulerRunner.execute(jobCode)
     ├→ 동시 실행 방지: 같은 JOB_CODE가 RUNNING/RETRYING이면 SKIPPED 기록
     ├→ SCHEDULER_LOGS에 RUNNING 기록
     ├→ ExecutorFactory.get(execType) → executor.execute(job)
     ├→ 성공 → STATUS='SUCCESS', AFFECTED_ROWS 기록, NEXT_RUN_AT 갱신
     └→ 실패 → STATUS='RETRYING', setTimeout으로 지수 백오프 재시도
              → 재시도 중에도 다음 크론 트리거는 SKIPPED 처리
              → 최종 실패 → STATUS='FAIL', SCHEDULER_NOTIFICATIONS 생성
```

**재시도 vs 다음 크론 트리거 상호작용:**
- 재시도는 `setTimeout`으로 별도 실행 (1분, 2분, 4분 지수 백오프)
- 재시도 중 상태는 `RETRYING` (RUNNING과 구분)
- 다음 크론 트리거 시 RUNNING 또는 RETRYING이면 → SKIPPED
- 즉, 재시도가 끝나기 전까지 다음 주기 실행은 건너뜀

### 4.5 Executor 인터페이스

```typescript
export interface IJobExecutor {
  execute(job: SchedulerJob): Promise<ExecutorResult>;
}

export interface ExecutorResult {
  success: boolean;
  affectedRows?: number;
  message?: string;
}
```

### 4.6 실행 유형별 상세

| EXEC_TYPE | EXEC_TARGET 예시 | EXEC_PARAMS 예시 | 실행 방식 |
|-----------|-----------------|-----------------|----------|
| `SERVICE` | `InterfaceService.scheduledSyncBom` | `{}` | `ModuleRef`로 서비스 인스턴스 → 메서드 호출 |
| `PROCEDURE` | `PKG_IF.P_SYNC_BOM` | `{"p_company":"JS"}` | `OracleService.callProc()` |
| `SQL` | SELECT/DELETE SQL문 | `{"retention_days":90}` | `DataSource.query()` |
| `HTTP` | `POST https://erp.com/api/sync` | `{"headers":{...},"body":{...}}` | `axios` 호출 |
| `SCRIPT` | `backup-db.bat` | `{"args":["--full"]}` | `child_process.execFile()` |

**SERVICE executor 래퍼 메서드 패턴:**

기존 InterfaceService 메서드는 파라미터(DTO, 배열 등)를 요구한다. 스케줄러에서 호출하려면 **파라미터 없는 래퍼 메서드**를 만들어야 한다:

```typescript
// InterfaceService에 추가
/** 스케줄러용: 내부에서 동기화 대상을 조회 후 syncBom() 호출 */
async scheduledSyncBom(): Promise<{ affectedRows: number }> {
  const pendingItems = await this.findPendingBomSync();
  const results = await this.syncBom(pendingItems);
  return { affectedRows: results.length };
}

/** 스케줄러용: 실패 로그를 자동 조회 후 bulkRetry() 호출 */
async scheduledBulkRetry(): Promise<{ affectedRows: number }> {
  const failedLogs = await this.getFailedLogs();
  const keys = failedLogs.map(l => ({ transDate: l.transDate, seq: l.seq }));
  const results = await this.bulkRetry(keys);
  return { affectedRows: results.length };
}
```

SERVICE executor는 반환값에서 `affectedRows`를 읽어 로그에 기록.

### 4.7 보안 조치

| 유형 | 보안 | 상세 |
|------|------|------|
| SQL | SELECT/DELETE만 허용 | `BEGIN`, `DROP`, `TRUNCATE`, `ALTER`, `CREATE`, `GRANT`, `EXECUTE` 키워드 차단. 정규식: `/^\s*(SELECT|DELETE)\s/i` 만 통과 |
| SCRIPT | 설정파일 기반 등록제 | 환경변수 `SCHEDULER_ALLOWED_SCRIPTS`에 허용 스크립트 목록 등록 (전체 경로). `.bat`/`.sh` 확장자만 허용. 심링크 해석 후 경로 검증 |
| HTTP | 호스트명 allowlist | 환경변수 `SCHEDULER_ALLOWED_HOSTS`에 허용 호스트 목록 (예: `erp.company.com,api.internal.com`). IP 직접 입력 차단, DNS rebinding 방지를 위해 요청 직전 resolve한 IP도 내부망 검증 |
| PROCEDURE | Oracle 계정 권한 | Oracle HNSMES 계정의 GRANT 권한으로 자연 제어 |
| SERVICE | 화이트리스트 | `scheduler-security.config.ts`에 호출 가능 서비스/메서드 목록 정의. 등록 시 유효성 검증 |

### 4.8 API 엔드포인트

| Method | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/scheduler/jobs` | 작업 목록 조회 | ALL |
| POST | `/scheduler/jobs` | 작업 등록 | ADMIN |
| PUT | `/scheduler/jobs/:jobCode` | 작업 수정 | ADMIN |
| DELETE | `/scheduler/jobs/:jobCode` | 작업 삭제 | ADMIN |
| POST | `/scheduler/jobs/:jobCode/run` | 수동 즉시 실행 | ADMIN |
| PATCH | `/scheduler/jobs/:jobCode/toggle` | 활성/비활성 토글 | ADMIN |
| GET | `/scheduler/logs` | 실행 이력 조회 | ALL |
| GET | `/scheduler/logs/summary` | 대시보드 통계 | ALL |
| GET | `/scheduler/notifications` | 내 알림 목록 | ALL |
| PATCH | `/scheduler/notifications/:id/read` | 알림 읽음 처리 | ALL |
| PATCH | `/scheduler/notifications/read-all` | 모두 읽음 처리 | ALL |

---

## 5. 에러 처리

| 상황 | 처리 |
|------|------|
| Executor 실행 실패 | STATUS='RETRYING', setTimeout으로 지수 백오프 재시도 (1분, 2분, 4분) |
| 재시도 중 다음 크론 트리거 | RETRYING 상태이므로 SKIPPED 처리 — 재시도 완료 후 다음 주기부터 정상 |
| 최대 재시도 초과 | STATUS=FAIL, 알림 생성, IS_ACTIVE 유지 (다음 크론 정상 실행) |
| 타임아웃 초과 | 강제 중단, STATUS=TIMEOUT, 알림 생성 |
| 서버 재시작 | OnModuleInit에서 RUNNING/RETRYING → FAIL 변경 후 활성 작업 재등록 |
| 동시 실행 방지 | 같은 JOB_CODE가 RUNNING/RETRYING이면 스킵, SKIPPED 기록 |
| DB 연결 실패 | 작업 스킵, 다음 주기 재시도 (스케줄러 자체는 유지) |

---

## 6. 프론트엔드 UI

### 6.1 메뉴 위치

`시스템 관리 > 스케줄러 관리` (route: `/system/scheduler`)

### 6.2 페이지 구성 (3탭)

**탭 1: 작업 관리**
- DataGrid: 작업코드, 작업명, 그룹, 실행유형, 크론표현식, 활성(토글), 마지막실행, 다음실행, 상태
- 상태 컬럼: ComCodeBadge
- 액션: 등록, 수정, 삭제, 즉시실행, 활성/비활성 토글

**등록/수정 모달 (lg 사이즈)**
- 기본: 작업코드, 작업명, 그룹(셀렉트)
- 실행설정: 실행유형(셀렉트) → 유형별 동적 폼
  - SERVICE: 서비스.메서드 셀렉트 (화이트리스트 기반)
  - PROCEDURE: 패키지.프로시저 입력 + JSON 파라미터
  - SQL: SQL 텍스트에어리어 (SELECT/DELETE만) + JSON 파라미터
  - HTTP: 메서드(셀렉트) + URL (allowlist 호스트만) + 헤더JSON + Body JSON
  - SCRIPT: 등록된 스크립트 셀렉트 (설정파일 기반) + 실행 인자
- 스케줄: 크론표현식 + 한글해석(cronstrue 실시간) + 최대재시도 + 타임아웃 + 설명

**탭 2: 실행 이력**
- 필터: 기간, 작업(셀렉트), 상태(셀렉트)
- DataGrid: No, 작업명, 실행유형, 시작시각, 종료시각, 소요시간, 상태, 처리건수, 재시도
- 실패 행 클릭 → 에러 상세 모달

**탭 3: 대시보드**
- StatCard 4개: 오늘 실행, 성공, 실패, 성공률
- 차트: 7일간 실행 추이 (Line), 작업별 성공/실패 비율 (Bar)
- 최근 실패 로그 5건

### 6.3 헤더 알림 (벨 아이콘)

- 기존 헤더에 벨 아이콘 + 읽지 않은 건수 뱃지
- 드롭다운: 알림 목록 (작업명, 시각, 유형)
- 클릭 시 읽음 처리
- "모두 읽음" 버튼
- **폴링 방식**: 60초 간격으로 읽지 않은 알림 건수 조회 (향후 SSE/WebSocket 확장 가능)

---

## 7. 기존 모듈 연동

| 시드 작업 | 연동 대상 | EXEC_TYPE | 비고 |
|----------|----------|-----------|------|
| IF_SYNC_BOM | `InterfaceService.scheduledSyncBom()` | SERVICE | 신규 래퍼 메서드 |
| IF_RETRY_FAIL | `InterfaceService.scheduledBulkRetry()` | SERVICE | 신규 래퍼 메서드 |
| DB_CLEANUP_LOGS | `DELETE FROM INTER_LOGS WHERE TRANS_DATE < SYSDATE - :retention_days` | SQL | 직접 SQL |

InterfaceService에 스케줄러용 래퍼 메서드 2개 추가. 기존 메서드는 변경 없음.

## 8. 초기 시드 데이터

기본 작업 3건 (`IS_ACTIVE='N'`으로 시드, 관리자가 확인 후 활성화):

| COMPANY | PLANT_CD | JOB_CODE | JOB_NAME | JOB_GROUP | EXEC_TYPE | CRON_EXPR | MAX_RETRY |
|---------|----------|----------|----------|-----------|-----------|-----------|-----------|
| JS | JS01 | IF_SYNC_BOM | BOM 동기화 | INTERFACE | SERVICE | `0 */10 * * * *` | 3 |
| JS | JS01 | IF_RETRY_FAIL | 실패건 재시도 | RETRY | SERVICE | `0 */15 * * * *` | 3 |
| JS | JS01 | DB_CLEANUP_LOGS | 오래된 로그 정리 | MAINTENANCE | SQL | `0 0 2 * * *` | 1 |

## 9. 신규 패키지

| 패키지 | 위치 | 용도 |
|--------|------|------|
| `@nestjs/schedule` | backend | 크론잡 동적 등록/관리 |
| `cronstrue` | frontend | 크론 표현식 → 한글 변환 |

## 10. i18n 키 (ko, en, zh, vi)

`scheduler` 네임스페이스로 추가:
- scheduler.title, scheduler.jobs, scheduler.logs, scheduler.dashboard
- scheduler.jobCode, scheduler.jobName, scheduler.jobGroup
- scheduler.execType, scheduler.execTarget, scheduler.execParams
- scheduler.cronExpr, scheduler.isActive, scheduler.maxRetry, scheduler.timeoutSec
- scheduler.nextRunAt, scheduler.lastRunAt, scheduler.lastErrorAt
- scheduler.status.success, scheduler.status.fail, scheduler.status.running, scheduler.status.retrying, scheduler.status.timeout, scheduler.status.skipped
- scheduler.execType.service, scheduler.execType.procedure, scheduler.execType.sql, scheduler.execType.http, scheduler.execType.script
- scheduler.notification, scheduler.markAllRead, scheduler.noUnread
