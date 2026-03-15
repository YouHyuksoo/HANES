# 대시보드 Oracle 패키지 전환 설계

## 개요

메인 대시보드의 데이터 조회를 Oracle 패키지(`PKG_DASHBOARD`) 기반으로 전환한다.
프론트엔드는 기존 API 경로(`GET /dashboard/summary`)를 유지하되, 백엔드 내부 구현만 Oracle 패키지 호출로 교체한다.
이 작업은 향후 모든 페이지를 Oracle 패키지로 점진적 전환하기 위한 첫 번째 대상이다.

## 설계 결정 사항

| 항목 | 결정 |
|------|------|
| DB 구조 | 페이지별 개별 Oracle 패키지 |
| 반환 방식 | SYS_REFCURSOR |
| 패키지 내부 구성 | 섹션별 개별 프로시저 (단순 유지) |
| 백엔드 호출 | 공용 OracleService 헬퍼 |
| DB 드라이버 | 별도 oracledb 커넥션 풀 생성 (TypeORM 비공개 API 의존 회피) |
| 전환 전략 | 점진적 전환 (패키지 준비된 페이지부터) |
| 첫 전환 대상 | 메인 대시보드만 |
| 패키지 주석 | 충분한 설명 주석 필수 |
| 컬럼명 매핑 | OracleService에서 UPPER_SNAKE_CASE → camelCase 자동 변환 |

## 아키텍처

```
프론트엔드                    백엔드                         Oracle DB
┌─────────┐  GET /dashboard  ┌──────────────────┐          ┌─────────────────────┐
│Dashboard │  /summary       │ DashboardCtrl    │          │ PKG_DASHBOARD       │
│ page.tsx │ ───────────────→│   .getSummary()  │          │  .SP_EQUIP_STATS    │
└─────────┘                  └────────┬─────────┘          │  .SP_JOB_ORDER_STATS│
                                      │                    │  .SP_MAT_ALERT      │
                              ┌───────▼─────────┐          │  .SP_DEFECT_STATS   │
                              │ DashboardService │          │  .SP_INSPECT_DAILY  │
                              │  (7개 프로시저   │────────→│  .SP_INSPECT_PERIOD │
                              │   병렬 호출)     │          │  .SP_INSPECT_PM     │
                              └───────┬─────────┘          │  .SP_KPI            │
                                      │                    │  .SP_RECENT_PROD    │
                              ┌───────▼─────────┐          └─────────────────────┘
                              │  OracleService   │  ← 공용 헬퍼
                              │  .callProc()     │
                              └─────────────────┘
```

## 1. OracleService 공용 헬퍼

### 파일 위치
`apps/backend/src/common/services/oracle.service.ts`

### 인터페이스
```typescript
@Injectable()
export class OracleService implements OnModuleInit, OnModuleDestroy {
  private pool: oracledb.Pool;

  /**
   * 모듈 초기화 시 별도 oracledb 커넥션 풀 생성
   * - TypeORM 비공개 API에 의존하지 않음
   * - 환경변수에서 DB 접속 정보를 읽어 풀 생성
   */
  async onModuleInit(): Promise<void>

  /**
   * 모듈 종료 시 커넥션 풀 정리
   */
  async onModuleDestroy(): Promise<void>

  /**
   * 프로시저 호출 - SYS_REFCURSOR 1개 반환
   * - 결과 컬럼명을 UPPER_SNAKE_CASE → camelCase로 자동 변환
   * @param packageName 패키지명 (예: 'PKG_DASHBOARD')
   * @param procName 프로시저명 (예: 'SP_EQUIP_STATS')
   * @param inParams IN 파라미터 (선택)
   * @returns 커서 결과 배열 (camelCase 키)
   */
  async callProc<T>(
    packageName: string,
    procName: string,
    inParams?: Record<string, any>,
  ): Promise<T[]>
}
```

### 역할
- 별도 oracledb 커넥션 풀 관리 (생성/종료 lifecycle)
- 커넥션 획득/반환 자동 관리 (`try/finally`)
- IN 파라미터 바인딩, OUT 커서 fetch 자동 처리
- **UPPER_SNAKE_CASE → camelCase 자동 변환** (Oracle 컬럼명 → JS 객체 키)
- 에러 시 커넥션 정리 보장
- 향후 모든 페이지가 이 헬퍼로 프로시저 호출

### 컬럼명 자동 변환 예시
```
Oracle 반환: { NORMAL_CNT: 5, MAINT_CNT: 2 }
JS 변환 후:  { normalCnt: 5, maintCnt: 2 }
```

## 2. PKG_DASHBOARD Oracle 패키지

### 패키지 명세
```sql
/*******************************************************************************
 * PKG_DASHBOARD - 대시보드 현황 조회 패키지
 *
 * 목적: 메인 대시보드에 표시되는 설비/작업지시/자재/불량/점검 현황 데이터를
 *       Oracle DB 레벨에서 집계하여 반환한다.
 *
 * 사용처: NestJS DashboardService → OracleService.callProc() 경유 호출
 * API:    GET /dashboard/summary
 *
 * 작성자: HANES MES
 * 작성일: 2026-03-14
 * 변경이력:
 *   2026-03-14  최초 작성
 ******************************************************************************/
CREATE OR REPLACE PACKAGE PKG_DASHBOARD AS

  /*--------------------------------------------------------------------------
   * SP_EQUIP_STATS - 설비 가동 현황
   *
   * 목적: 사용 중인 설비(USE_YN='Y')의 상태별 카운트를 반환
   * 반환: NORMAL_CNT(가동), MAINT_CNT(정비중), STOP_CNT(정지), TOTAL_CNT(전체)
   * 참조 테이블: EQUIP_MASTER
   *--------------------------------------------------------------------------*/
  PROCEDURE SP_EQUIP_STATS(o_cursor OUT SYS_REFCURSOR);

  /*--------------------------------------------------------------------------
   * SP_JOB_ORDER_STATS - 오늘 작업지시 현황
   *
   * 목적: 지정일 기준 작업지시의 상태별 카운트를 반환
   * 파라미터: p_target_date - 조회 기준일 (기본값: TRUNC(SYSDATE))
   * 반환: WAIT_CNT(대기), RUNNING_CNT(진행), DONE_CNT(완료), TOTAL_CNT(전체)
   * 참조 테이블: JOB_ORDERS
   * 비고: WAITING/WAIT → WAIT, START/RUNNING → RUNNING, DONE/COMPLETED → DONE
   *--------------------------------------------------------------------------*/
  PROCEDURE SP_JOB_ORDER_STATS(
    p_target_date IN DATE DEFAULT TRUNC(SYSDATE),
    o_cursor      OUT SYS_REFCURSOR
  );

  /*--------------------------------------------------------------------------
   * SP_MAT_ALERT - 자재 알림 현황
   *
   * 목적: 안전재고 미달 자재 + 유효기한 임박/초과 로트 카운트를 반환
   * 반환: LOW_STOCK_CNT, NEAR_EXPIRY_CNT(7일 이내), EXPIRED_CNT, TOTAL_CNT
   * 참조 테이블: MAT_STOCKS, PART_MASTER, MAT_LOTS
   *--------------------------------------------------------------------------*/
  PROCEDURE SP_MAT_ALERT(o_cursor OUT SYS_REFCURSOR);

  /*--------------------------------------------------------------------------
   * SP_DEFECT_STATS - 불량 현황
   *
   * 목적: 전체 불량의 처리 상태별 카운트를 반환
   * 반환: WAIT_CNT(미처리), REPAIR_CNT(수리), REWORK_CNT(재작업),
   *       DONE_CNT(완료), TOTAL_CNT(전체)
   * 참조 테이블: DEFECT_LOGS
   *--------------------------------------------------------------------------*/
  PROCEDURE SP_DEFECT_STATS(o_cursor OUT SYS_REFCURSOR);

  /*--------------------------------------------------------------------------
   * SP_INSPECT_DAILY - 일상점검 현황
   *
   * 목적: 지정일 기준 일상점검 대상 설비별 점검 결과를 반환
   * 파라미터: p_target_date - 조회 기준일 (기본값: TRUNC(SYSDATE))
   * 반환(요약 행): TOTAL_CNT, COMPLETED_CNT, PASS_CNT, FAIL_CNT
   * 반환(설비 행): EQUIP_CODE, EQUIP_NAME, RESULT, INSPECTOR_NAME, LINE_CODE
   * 참조 테이블: EQUIP_INSPECT_ITEM_MASTER, EQUIP_INSPECT_LOGS, EQUIP_MASTER
   *--------------------------------------------------------------------------*/
  PROCEDURE SP_INSPECT_DAILY(
    p_target_date IN DATE DEFAULT TRUNC(SYSDATE),
    o_summary     OUT SYS_REFCURSOR,
    o_items       OUT SYS_REFCURSOR
  );

  /*--------------------------------------------------------------------------
   * SP_INSPECT_PERIODIC - 정기점검 현황
   *
   * 목적/파라미터/반환: SP_INSPECT_DAILY와 동일 (INSPECT_TYPE='PERIODIC')
   *--------------------------------------------------------------------------*/
  PROCEDURE SP_INSPECT_PERIODIC(
    p_target_date IN DATE DEFAULT TRUNC(SYSDATE),
    o_summary     OUT SYS_REFCURSOR,
    o_items       OUT SYS_REFCURSOR
  );

  /*--------------------------------------------------------------------------
   * SP_INSPECT_PM - 예방보전(PM) 현황
   *
   * 목적: 지정일 기준 PM 워크오더 대상 설비별 점검 결과를 반환
   * 파라미터: p_target_date - 조회 기준일 (기본값: TRUNC(SYSDATE))
   * 반환(요약 행): TOTAL_CNT, COMPLETED_CNT, PASS_CNT, FAIL_CNT
   * 반환(설비 행): EQUIP_CODE, EQUIP_NAME, RESULT, INSPECTOR_NAME, LINE_CODE
   * 참조 테이블: PM_WORK_ORDERS, EQUIP_MASTER
   *--------------------------------------------------------------------------*/
  PROCEDURE SP_INSPECT_PM(
    p_target_date IN DATE DEFAULT TRUNC(SYSDATE),
    o_summary     OUT SYS_REFCURSOR,
    o_items       OUT SYS_REFCURSOR
  );

  /*--------------------------------------------------------------------------
   * SP_KPI - KPI 데이터 (생산량/재고/합격률/불량)
   *
   * 목적: 오늘/어제 기준 4대 KPI 값 + 전일 대비 변화율을 반환
   * 반환: TODAY_PROD, YESTERDAY_PROD, PROD_CHANGE,
   *       INVENTORY_TOTAL, INV_CHANGE,
   *       PASS_RATE, RATE_CHANGE,
   *       DEFECT_CNT, DEFECT_CHANGE
   * 참조 테이블: JOB_ORDERS, MAT_STOCKS, INSPECT_RESULTS, DEFECT_LOGS
   *--------------------------------------------------------------------------*/
  PROCEDURE SP_KPI(o_cursor OUT SYS_REFCURSOR);

  /*--------------------------------------------------------------------------
   * SP_RECENT_PRODUCTIONS - 최근 작업지시 10건
   *
   * 목적: 최근 생성된 작업지시 10건의 품목/라인/진행률을 반환
   * 반환: ORDER_NO, ITEM_NAME, LINE_CODE, PLAN_QTY, ACTUAL_QTY,
   *       PROGRESS, STATUS
   * 참조 테이블: JOB_ORDERS, PART_MASTER
   *--------------------------------------------------------------------------*/
  PROCEDURE SP_RECENT_PRODUCTIONS(o_cursor OUT SYS_REFCURSOR);

END PKG_DASHBOARD;
```

### 프로시저별 반환 컬럼

| 프로시저 | 반환 컬럼 |
|---------|----------|
| SP_EQUIP_STATS | `NORMAL_CNT, MAINT_CNT, STOP_CNT, TOTAL_CNT` |
| SP_JOB_ORDER_STATS | `WAIT_CNT, RUNNING_CNT, DONE_CNT, TOTAL_CNT` |
| SP_MAT_ALERT | `LOW_STOCK_CNT, NEAR_EXPIRY_CNT, EXPIRED_CNT, TOTAL_CNT` |
| SP_DEFECT_STATS | `WAIT_CNT, REPAIR_CNT, REWORK_CNT, DONE_CNT, TOTAL_CNT` |
| SP_INSPECT_* (summary) | `TOTAL_CNT, COMPLETED_CNT, PASS_CNT, FAIL_CNT` |
| SP_INSPECT_* (items) | `EQUIP_CODE, EQUIP_NAME, RESULT, INSPECTOR_NAME, LINE_CODE` |
| SP_KPI | `TODAY_PROD, YESTERDAY_PROD, PROD_CHANGE, INVENTORY_TOTAL, INV_CHANGE, PASS_RATE, RATE_CHANGE, DEFECT_CNT, DEFECT_CHANGE` |
| SP_RECENT_PRODUCTIONS | `ORDER_NO, ITEM_NAME, LINE_CODE, PLAN_QTY, ACTUAL_QTY, PROGRESS, STATUS` |

### 주석 규칙
- 패키지 헤더에 목적, 작성자, 작성일, 변경이력 주석
- 각 프로시저에 목적, 파라미터, 반환값, 참조 테이블 주석
- SQL 내부 복잡한 로직에 인라인 주석

## 3. 백엔드 모듈 구조

### 파일 구조
```
apps/backend/src/
├── common/
│   └── services/
│       └── oracle.service.ts          ← 공용 헬퍼 (신규)
│
├── modules/
│   └── dashboard/
│       ├── dashboard.module.ts        ← 모듈 (수정: OracleService 임포트)
│       ├── dashboard.controller.ts    ← 기존 경로 유지, 내부만 교체 (수정)
│       └── dashboard.service.ts       ← 프로시저 병렬 호출로 교체 (수정)
```

### API 경로 (기존 유지)

| 경로 | 변경 사항 |
|------|----------|
| `GET /dashboard/summary?date=YYYY-MM-DD` | 내부만 Oracle 패키지 호출로 교체 |
| `GET /dashboard/kpi` | 내부만 Oracle 패키지 호출로 교체 |
| `GET /dashboard/recent-productions` | 내부만 Oracle 패키지 호출로 교체 |

### API 응답 구조 (기존과 동일하게 유지)
```typescript
// GET /dashboard/summary — 프론트엔드 기존 인터페이스와 동일
{
  equip:    { normal, maint, stop, total },
  job:      { wait, running, done, total },
  mat:      { lowStock, nearExpiry, expired },
  defect:   { wait, repair, rework, done, total },
  daily:    { total, completed, pass, fail, items: [{ equipCode, equipName, result, inspectorName, lineCode }] },
  periodic: { total, completed, pass, fail, items: [...] },
  pm:       { total, completed, pass, fail, items: [...] }
}

// GET /dashboard/kpi
{
  todayProduction:  { value, change },
  inventoryStatus:  { value, change },
  qualityPassRate:  { value, change },
  interlockCount:   { value, change }
}

// GET /dashboard/recent-productions
[{ orderNo, itemName, line, planQty, actualQty, progress, status }]
```

## 4. 프론트엔드 변경

### 변경 없음
- API 경로와 응답 구조가 기존과 동일하므로 **프론트엔드 코드 변경이 필요 없다**
- `dashboard/page.tsx` — 그대로 유지
- `InspectSummaryCard.tsx` — 그대로 유지

## 5. 기존 대비 변경 요약

| 항목 | 기존 | 변경 |
|------|------|------|
| 프론트엔드 | 변경 없음 | 변경 없음 |
| 백엔드 서비스 | TypeORM QueryBuilder + JS 집계 | OracleService → PKG 프로시저 호출 |
| 백엔드 API 경로 | `/dashboard/summary`, `/kpi`, `/recent-productions` | 동일 (유지) |
| 집계 로직 위치 | NestJS 서비스 분산 | PKG_DASHBOARD 집중 |
| 유지보수 | 백엔드 TypeORM 쿼리 수정 | 패키지 프로시저만 수정 |

## 6. 에러 처리

- 백엔드에서 `Promise.all`로 프로시저 병렬 호출 (현재와 동일한 패턴)
- 프로시저 실패 시 전체 API 에러 반환 (현재와 동일한 동작)
- OracleService에서 ORA 에러 로깅 후 NestJS 예외로 변환

## 7. 향후 확장 패턴

이 설계는 첫 번째 전환 대상이며, 향후 다른 페이지도 동일 패턴으로 전환한다:
- `PKG_INTERFACE` — 인터페이스 대시보드
- `PKG_EQUIPMENT` — 설비 관리
- `PKG_PRODUCTION` — 생산 관리
- 기타 페이지별 패키지

모든 패키지는 `OracleService.callProc()`를 통해 호출하며, 점진적으로 TypeORM 쿼리빌더를 대체한다.
