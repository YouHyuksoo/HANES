# 모니터링 보드 4종 추가 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax.

**Goal:** 좌측 메뉴 모니터링 섹션에 현장 TV용 생산현황 보드 + 품질/재고/작업지시 칸반 보드 4종을 추가한다.

**Architecture:** 백엔드는 신규 `monitoring` 모듈에 읽기전용 집계 API 3본(생산/품질/재고, 칸반은 생산 API 재사용). 모든 집계는 DB GROUP BY (N+1·메모리 집계 금지). 프론트는 기존 `components/monitoring`의 `useMonitoringConfig`(localStorage 인터벌) 재사용 + 보드 공통 `BoardChrome`(옵션바·상태바·전체화면) 신설, 데이터 갱신은 react-query `refetchInterval`.

**Tech Stack:** NestJS + TypeORM QueryBuilder(Oracle), Next.js + react-query(useApiQuery) + recharts, i18n 4개 언어(ko/en/zh/vi).

**Spec:** grill-me 인터뷰로 확정 (본 문서 "확정 설계" 절이 스펙 역할).

## 확정 설계 (grill-me 결과)

- 보드 4종: ① TV 생산현황 ② 품질 ③ 재고 ④ 작업지시 칸반(읽기전용)
- TV 생산현황: 작업지시 단위, 오늘 지시일(planDate=오늘) 전체(CANCELED 제외).
  구성 = 현재시각+KPI 카드(총계획/총실적/달성률/불량/진행중 건수) + 작업지시 테이블(자동 페이지 순환, RUNNING 우선) + 시간대별 실적 바차트
- 접근: 로그인 유지 + 화면 내 전체화면(TV 모드) 토글. 테마는 앱 테마 따라감
- 갱신 인터벌: 화면 내 설정(localStorage, 기본 30초) — `useMonitoringConfig` 재사용
- 품질: 불량률 KPI + 공정별 불량률 + 불량유형 TOP N(DEFECT_LOGS) + 수리 현황(REPAIR_ORDERS) + 최근 7일 불량률 추이
- 재고: 유형별 KPI(자재/반제품/완제품) + 안전재고 미달 경고(ITEM_MASTERS.safetyStock) + 창고별 분포 + 금일 입출고(STOCK_TRANSACTIONS)
- 백엔드: 신규 monitoring 모듈, 멀티테넌시 @Company/@Plant 스코프

## Global Constraints

- pnpm만 사용, 검증은 `pnpm.cmd --filter @harness/backend|@harness/frontend exec tsc --noEmit --pretty false`
- SQL 안티패턴 금지(N+1, 메모리 집계), `as any` 금지, `catch (error: unknown)`
- 날짜 "오늘"은 서버 로컬 기준 TRUNC(SYSDATE) 계열 — toISOString UTC 금지 규칙 준수
- 메뉴 추가는 4곳 동시: `menuConfig.ts` + `seeds/menu-config.json` + `menu-code-validator.ts` + DB MERGE(oracle-db 스킬로 즉시 적용)
- i18n은 ko/en/zh/vi 4개 파일 동시, JSON BOM 금지
- main 직접 커밋, git add는 파일 단위

---

### Task 1: 백엔드 monitoring 모듈 + 생산현황 보드 API

**Files:**
- Create: `apps/backend/src/modules/monitoring/monitoring.module.ts`
- Create: `apps/backend/src/modules/monitoring/controllers/monitoring-board.controller.ts`
- Create: `apps/backend/src/modules/monitoring/services/production-board.service.ts`
- Modify: `apps/backend/src/app.module.ts` (MonitoringModule 등록)

**Interfaces (Produces):**
- `GET /monitoring/boards/production` → `{ kpi: { planQty, goodQty, defectQty, achieveRate, runningCount, totalCount }, orders: ProductionBoardOrder[], hourly: { hour: string, goodQty: number, defectQty: number }[] }`
- `ProductionBoardOrder = { orderNo, itemCode, itemName, processCode, equipCode, status, planQty, goodQty, defectQty, achieveRate }`
- orders 쿼리: JOB_ORDERS `planDate = TRUNC(SYSDATE)` AND `status != 'CANCELED'` + ITEM_MASTERS LEFT JOIN(itemName), 정렬 RUNNING→HOLD→WAITING→DONE, priority ASC
- hourly 쿼리: PROD_RESULTS 오늘(CREATED_AT >= TRUNC(SYSDATE)) GROUP BY TO_CHAR(CREATED_AT,'HH24')

- [ ] 서비스/컨트롤러/모듈 작성, app.module 등록
- [ ] backend tsc 통과 확인
- [ ] 커밋 `feat(monitoring): 생산현황 보드 집계 API`

### Task 2: 품질 보드 API

**Files:**
- Create: `apps/backend/src/modules/monitoring/services/quality-board.service.ts`
- Modify: controller/module

**Interfaces (Produces):**
- `GET /monitoring/boards/quality` → `{ kpi: { totalQty, defectQty, defectRate }, byProcess: { processCode, totalQty, defectQty, defectRate }[], topDefects: { defectCode, defectName, qty }[], repair: { received, inRepair, completedToday }, dailyTrend: { date, totalQty, defectQty, defectRate }[] }`
- byProcess/kpi: PROD_RESULTS 오늘 GROUP BY PROCESS_CODE
- topDefects: DEFECT_LOGS 오늘 GROUP BY DEFECT_CODE, SUM(QTY) DESC FETCH FIRST 10
- repair: REPAIR_ORDERS status RECEIVED/IN_REPAIR 건수 + 오늘 COMPLETED 건수
- dailyTrend: PROD_RESULTS 최근 7일 GROUP BY TRUNC(CREATED_AT)

- [ ] 서비스 작성 + 컨트롤러 엔드포인트 추가
- [ ] backend tsc 통과, 커밋

### Task 3: 재고 보드 API

**Files:**
- Create: `apps/backend/src/modules/monitoring/services/inventory-board.service.ts`
- Modify: controller/module

**Interfaces (Produces):**
- `GET /monitoring/boards/inventory` → `{ kpi: { materialQty, materialItems, semiQty, semiItems, finishedQty, finishedItems }, shortages: { itemCode, itemName, qty, safetyStock, shortage }[], byWarehouse: { warehouseCode, stockKind: 'MATERIAL'|'PRODUCT', itemCount, qty }[], todayInOut: { inCount, inQty, outCount, outQty } }`
- shortages: MAT_STOCKS GROUP BY ITEM_CODE JOIN ITEM_MASTERS(safetyStock>0) HAVING SUM(QTY) < safetyStock
- todayInOut: STOCK_TRANSACTIONS TRANS_DATE >= TRUNC(SYSDATE), 입고/출고 유형은 TRANS_TYPE 실측값으로 분류(구현 시 확인)

- [ ] 서비스 작성 + 엔드포인트 추가, tsc, 커밋

### Task 4: 프론트 공통 BoardChrome + TV 생산현황 보드 화면

**Files:**
- Create: `apps/frontend/src/components/monitoring/BoardChrome.tsx` (옵션바+상태바+TV 전체화면 토글, MonitoringFrame 스타일 준용)
- Create: `apps/frontend/src/app/(authenticated)/monitoring/production-board/page.tsx` + `components/` (KPI 카드, 지시 테이블(자동 페이지 순환), 시간대 차트)
- Modify: `apps/frontend/src/components/monitoring/index.ts`

**Interfaces (Consumes):** Task 1 API. `useMonitoringConfig("monitoring:prod-board")`의 refetchSec/rollingSec.

- [ ] BoardChrome 작성 (fixed inset-0 TV 모드 + requestFullscreen)
- [ ] production-board 페이지 작성 (KPI/테이블/recharts 바차트/시계)
- [ ] frontend tsc 통과, 커밋

### Task 5: 품질/재고/칸반 보드 화면

**Files:**
- Create: `monitoring/quality-board/page.tsx`, `monitoring/inventory-board/page.tsx`, `monitoring/job-order-board/page.tsx` (+각 components)

**Interfaces (Consumes):** Task 2·3 API, 칸반은 Task 1 orders를 status별 그룹핑(WAITING/RUNNING/HOLD/DONE 4컬럼).

- [ ] 3개 페이지 작성, tsc, 커밋

### Task 6: 메뉴 등록(4곳) + i18n + DB 반영

**Files:**
- Modify: `apps/frontend/src/config/menuConfig.ts` (MONITORING children에 MON_PROD_BOARD/MON_QUALITY_BOARD/MON_INV_BOARD/MON_JOB_BOARD)
- Modify: `apps/backend/src/seeds/menu-config.json`
- Modify: `apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts`
- Modify: `apps/frontend/src/locales/{ko,en,zh,vi}.json` (menu 라벨 + monitoring.board.* 문자열)
- DB: 메뉴 MERGE SQL 작성 후 oracle-db 스킬로 JSHANES 즉시 적용

- [ ] 4곳 코드 등록 + i18n 4개 파일
- [ ] DB MERGE 실행 + pre/post 확인
- [ ] tsc(front/back) 통과, 커밋
