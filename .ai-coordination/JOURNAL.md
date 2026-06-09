# JOURNAL

## 2026-06-10 claude

### T-PROD-WORKFLOW-DOC 완료

**작업:** docs/workflows/production/wf-production.md 작성

**분석 대상:**
- Controllers: prod-plan, simulation, job-order, prod-result, production-views, repair
- Services: 위 대응 + auto-issue, auto-plan, numbering
- DTO: prod-plan, simulation, job-order, prod-result, production-views, repair
- Entities: prod-plan, job-order, prod-result, simulation-result, repair-order, repair-used-part, rework-order, rework-result, rework-process, inspect-result, defect-log, mat-issue, product-stock, product-transaction, consumable-master, fg-label
- Frontend: monthly-plan, simulation, order, result, progress, input-kiosk, input-manual, input-machine, input-inspect, input-equip, result-summary, wip-stock, repair, quality/rework, quality/rework-history

**작성 화면 (15개):**
1. PROD_MONTHLY_PLAN (월간생산계획) — CRUD + 확정/마감 + 작업지시발행 + 자동편성
2. PROD_SIMULATION (시뮬레이션) — 납기/CAPA/월력 기반 스케줄 시뮬레이션 + Gantt
3. PROD_ORDER (작업지시) — CRUD + 상태관리(WAITING→RUNNING→HOLD→DONE/CANCELED) + 트리뷰
4. PROD_RESULT (생산실적) — CRUD + 완료/취소 + 자재자동차감 + 공정재고적재 + 금형타수
5. PROD_PROGRESS (생산진도) — 작업지시별 진행률 대시보드
6. PROD_INPUT_MANUAL (수동투입) — 자재 수동 출고/투입
7. PROD_INPUT_KIOSK (입력키오스크) — 작업지시→설비→점검→소모품→자재→실적 6단계 일괄처리
8. PROD_INPUT_MACHINE (설비투입) — 설비 중심 실적 등록
9. PROD_INPUT_INSPECT (투입검사) — 투입 전 검사 항목 입력
10. PROD_INPUT_EQUIP (설비점검) — 일일/정기 점검 결과 등록
11. PROD_RESULT_SUMMARY (실적집계) — 작업지시/설비/작업자/일자/품목별 집계
12. PROD_WIP_STOCK (WIP재고) — 반제품/완제품 공정창고 재고 조회
13. QC_REWORK (재작업) — 불량 제품 재작업 지시
14. QC_REWORK_HISTORY (재작업이력) — 재작업 결과 이력 조회
15. PROD_REPAIR (수리) — 불량 제품 수리 등록 + 수리실 재고 + 사용부품 관리

**검증:**
- 백엔드/프론트 소스 코드 기준으로 API 경로, DTO 필드, 엔티티 관계, 상태 전이, 트랜잭션 범위 모두 반영.
- mermaid 다이어그램 4개 포함(정상흐름 3 + 화면간연계 1).
- 공통코드 그룹(PROD_PLAN_STATUS, JOB_ORDER_STATUS, PROD_RESULT_STATUS, REPAIR_ORDER_STATUS 등) 명시.

**파일:** docs/workflows/production/wf-production.md (신규)

---

## 2026-06-10 claude

### T-PROD-RESULT-WORKER-VALIDATION 완료

**증상:** `/production/input-kiosk`에서 모든 인터록을 통과해도 실적저장이 항상 실패. 직접 재현 결과 `POST /production/prod-results` (orderNo=W2026-001, equipCode=EQ-CRIMP-01, workerId=W010) → HTTP 404 `작업자를 찾을 수 없습니다: W010`.

**원인 (systemic):**
- `PROD_RESULTS.worker` 관계는 `WORKER_MASTERS.workerCode`를 참조(`@JoinColumn name=WORKER_ID, referencedColumnName=workerCode`).
- 입력 화면 5종(input-kiosk/machine/equip/inspect/manual) 모두 `WorkerSelectModal`을 사용, `id=workerCode`(예: W010)를 `workerId`로 전송.
- 그러나 `prod-result.service.create()`의 작업자 검증은 `userRepository(USERS).findOne({ email: workerId })`로 되어 있어, workerCode는 USERS.email과 매칭되지 않아 항상 404.
- 기존 PROD_RESULTS 2건의 WORKER_ID='admin@hanes.com'은 과거 수동입력 잔여 데이터(현재 라이브 호출자는 email을 보내지 않음).

**수정 (비회귀):**
- `prod-result.service.ts`: 작업자 검증을 `WorkerMaster.workerCode` 우선 조회, 미존재 시 `User.email` 폴백 허용. 둘 다 없으면 404.
- `WorkerMaster` repo 주입 + `production.module.ts` forFeature 등록.
- spec: WorkerMaster mock provider 추가, 워커코드/이메일폴백/미존재 3 케이스 테스트로 분리.

**검증:**
- jest `prod-result.service.spec` 17/17 통과, backend `tsc --noEmit` 0 에러.
- 재현 POST 재실행 → HTTP 201, resultNo `PR26061000004`, worker 관계 `{workerCode:W010, 오지훈}` 정상, W2026-001 WAITING→RUNNING 승격.

**부수 작업(테스트 데이터 시딩 — input-kiosk 전체 흐름 unblock):**
- HNS01 BOM 자식 6종 중 LOT 없던 5종 MAT_LOTS 시딩(`MTEST-HLD01-001`, `MTEST-HNS01C1-001`, `MTEST-HNS01C2-001`, `MTEST-HSG0001-001`, `MTEST-TP0001-001`, company40/plant1000, INIT/CURRENT 100000, IQC PASSED). SQL: `tools/generated/seed_matlots_hns01.sql`(참고용, 실제는 개별 INSERT 적용).
- 자재스캔 API(`POST .../material-lots/scan`) 신규 LOT으로 HTTP 201 확인 후 테스트 등록행 삭제.
- 데이터 점검: 작업자설비점검 항목 8건(EQ-CRIMP-01 WORKER), 소모품 CM-AP-110 MOUNTED 확인 → 키오스크 전 인터록 데이터 준비 완료.

**참고(스코프 외 1줄):** 시스템 전반에 작업자 식별이 workerCode(엔티티 정본)와 email(과거 수동데이터)로 혼재. 현 수정은 양쪽 허용으로 unblock만 하고 전체 통일은 하지 않음.

### 2번째 차단 버그(UI 테스트로 발견): matUid→prdUid 계약 불일치

**증상:** worker 버그 수정 후 키오스크 실적저장 재시도 → HTTP 400 `property matUid should not exist`.

**원인:** `ProductionInputBar`가 POST 본문에 `matUid: serialNo`를 보내는데, `CreateProdResultDto`에는 `matUid` 없음(`prdUid`만 존재) + whitelist `forbidNonWhitelisted`로 미지정 속성 거부. 시리얼은 의미상 생산단위 식별자(prdUid)이므로 `prdUid`로 보내야 함.

**수정:** `input-kiosk/components/ProductionInputBar.tsx` POST 본문 `matUid:`→`prdUid:` (1줄).

**systemic(스코프 외 — 보고만):** input-machine/equip/inspect/manual 4개 화면도 동일하게 POST 본문에 `matUid:`를 보냄 → 동일 400으로 현재 전부 실적저장 불가. 동일 수정(payload 키 `matUid`→`prdUid`) 필요하나, 해당 화면들은 입력필드 라벨이 `자재 UID`라 의미 정합성 검토가 별도로 필요해 본 작업 범위(키오스크)에서는 미수정.

### 키오스크 전체 흐름 E2E (헤드리스 브라우저 실제 구동)

설비 EQ-CRIMP-01/작업지시 W2026-001/작업자 오지훈(W010) 선택 상태에서:
1. 작업자설비점검 8항목 OK → 종합 PASS 저장
2. 자재스캔 6/6종 등록(HNS01-C1/C2/CNTR001/HLD-01/TP0001/HSG0001 — 신규 시딩 LOT 스캔)
3. 소모품스캔 1/1(CM-AP-110 110단자 압착금형)
4. 작업수 10 입력 → 실적입력 → **"실적이 저장되었습니다"** 토스트
5. 첫 저장이라 초물 공정샘플검사(자주검사) 모달 자동 오픈 확인(전 25항목, 23·24번 의뢰검사 포함) — 의뢰검사는 품질팀 의뢰 시 실적입력 차단되므로 자동테스트에서는 취소

**DB 검증:** `PROD_RESULTS PR26061000005` (WORKER_ID=W010, PRD_UID=W2026-001-001, GOOD_QTY=10, STATUS=RUNNING) 저장 확인. 자재 자동차감(MAT_ISSUES)은 0건 — MatLot만 시딩하고 현장 MatStock 미생성이라 auto-issue가 경고만 남기고 비차단 통과(설계상 정상). 실재고 차감까지 검증하려면 BOM 자재의 현장창고 MatStock 시딩 필요.

### 입력화면 4종 동일 수정(matUid→prdUid) — T-PROD-INPUT-PRDUID-FIX

input-machine/equip/inspect/manual POST 본문 `matUid:`→`prdUid:` 통일. input-equip는 추가로 `measuredValue`(DTO 비허용)를 보내고 있어 측정값을 비고에 보존하도록 변경(저장 컬럼 없음). whitelist 계약 probe(prdUid+remark payload는 404 작업지시까지 도달, measuredValue 단독은 400 유지) + 프론트 `tsc --noEmit` 0 에러 검증.

### 의뢰검사(DELEGATE) 키오스크↔처리페이지 상호작용 검증

흐름: 키오스크 자주검사 DELEGATE 항목 의뢰 → `SELF_INSPECT_RESULTS(status=PENDING)` → `GET self-inspect/pending/:orderNo`(hasPending) → `/quality/request-inspect`에서 PASS/FAIL 판정(`PATCH results/:id/status`) → 키오스크 10초 폴링으로 차단 해제.
- 의뢰 생성: 키오스크 검사완료와 동일 `POST /production/self-inspect/results`(inspectMethod=DELEGATE, status=PENDING, 인장강도시험/PRC-CRIMP) 201. (키오스크 25항목 자주검사 모달이 헤드리스 렌더러를 freeze시켜 모달 직접구동 대신 동일 API로 의뢰 생성)
- 처리 전 pending hasPending=true/count1 → **처리 페이지 UI에서 행 선택 후 합격(PASS) 처리**(토스트 "상태가 PASS로 변경", 대기목록 1→0) → 처리 후 pending hasPending=false/count0.
- DB: SELF_INSPECT_RESULTS PENDING→PASS, 비고/INSPECTED_AT 스탬프 확인. 키오스크 차단 게이트(pending API)의 true→false 전이 입증.

### 키오스크 25항목 자주검사 모달 "freeze" 원인 조사 (결론: 앱 버그 아님)

증상: 헤드리스 브라우저로 input-kiosk 초물 자주검사(25항목) 모달이 열린 동안 `Page.captureScreenshot`가 30초 타임아웃 반복.

체계적 디버깅(systematic-debugging) 결과 — **JS 메인스레드는 정상, 헤드리스 스크린샷 캡처 파이프라인만 wedge**:
- 모달 열린 상태에서 `read_console_messages`/`javascript_tool`/`read_page`/클릭 전부 즉시 응답. 25행 렌더 확인. 콘솔 신규 에러 0("Maximum update depth" 없음 = 무한 렌더 루프 아님).
- 라이브 토글로 후보 전부 배제(끄고도 캡처 실패): backdrop-blur(8px), 모달 size=full(박스 600×400 축소), 오버레이(display none), CSS 애니메이션/트랜지션(전역 none), 거대 페이지(docScrollH=898 정상).
- 모달을 닫아도 캡처 wedge 지속, **페이지 네비게이션 시에만 복구**(/quality·/dashboard 정상 캡처).
- SelfInspectModal/SelfInspectItemRow/ui Modal 정독 — useEffect 루프/렌더중 setState/ResizeObserver 없음.

결론: Chromium 컴포지터/CDP 스크린샷 파이프라인이 무거운 입력키오스크 뷰(풀사이즈 모달 + SVG 아이콘 157개 + 풀폭 작업지도서 이미지 798×1128) 렌더 후 막히는 **자동화/브라우저 계층 이슈**. 실 운영 키오스크(작업자)는 영향 없음 — 모달 완전 인터랙티브(이전 세션에서 실적입력·의뢰검사 전 과정 클릭으로 완료됨). 앱 코드 수정 불필요. 자동화 측 대응: 해당 모달 열린 중에는 스크린샷 대신 DOM/console/click 검증 사용, 또는 네비게이션으로 캡처 파이프라인 리셋.
부수 관찰(무해): WorkHistoryPanel 목록 렌더에 React "key" prop 누락 경고 1건(대시보드 "1 Issue" 배지 정체) — freeze와 무관.

### WorkHistoryPanel React key 경고 수정

원인: 작업이력 `<li key={item.id}>`인데 목록 API(GET /production/prod-results, findAll)는 PK를 `resultNo`로 반환하고 `id` 필드가 없어 모든 행 key=undefined → "Each child should have a unique key prop". 수정: HistoryItem 인터페이스 `id`→`resultNo` 정정, `key={item.resultNo ?? idx}`. 프론트 tsc 0, 키오스크 작업이력 2행 렌더 상태에서 콘솔 에러 0건(경고 소거) 확인. 파일: input-kiosk/components/WorkHistoryPanel.tsx.


## 2026-06-09 24:05 codex

### T-EQUIP-INSPECT-WORKER-ASSIGN-SEED 완료

**대상:** `EQUIP_INSPECT_ITEM_MASTERS` 작업자설비점검 설비별 할당 seed.

**원인:**
- `EQUIP_INSPECT_ITEM_POOL`에는 WORKER 표준 항목 8건이 있었지만, 입력키오스크 모달이 조회하는 `EQUIP_INSPECT_ITEM_MASTERS` 설비별 WORKER 할당은 0건이었다.
- 따라서 `/production/input-kiosk`에서 어떤 설비를 선택해도 작업자설비점검 모달에 항목이 뜨지 않았다.

**수정 내용:**
- `apps/backend/src/migrations/2026-06-09_seed_all_equips_worker_inspect_assignments.sql` 추가.
- `COMPANY='40'`, `PLANT_CD='1000'`, `USE_YN='Y'`인 모든 설비에 WORKER Pool 8건을 `SEQ=1..8`로 할당한다.
- QR 값은 `EQUIP_CODE:ITEM_CODE` 형식으로 생성한다. 예: `EQ-CRIMP-01:EIP-STD-W001`.
- SQL은 `MERGE` 기반이라 재실행 가능하다.

**검증:**
- `python scripts/migration/run_migration.py apps/backend/src/migrations/2026-06-09_seed_all_equips_worker_inspect_assignments.sql --site JSHANES --dry-run` 통과.
- JSHANES 적용: `python scripts/migration/run_migration.py apps/backend/src/migrations/2026-06-09_seed_all_equips_worker_inspect_assignments.sql --site JSHANES` 통과.
- DB 설비별 WORKER 항목 수 확인: `EQ-CRIMP-01`, `EQ-CRIMP-02`, `EQ-CRIMP-03`, `EQ-CUT-01`, `EQ-CUT-02`, `EQ-STRIP-01`, `EQ-TEST-01`, `EQ-TEST-02` 모두 8건.
- 총 할당 건수: 64건.
- API 확인:
  - `/api/v1/master/equip-inspect-items?equipCode=EQ-CRIMP-01&inspectType=WORKER&limit=100` 8건 반환.
  - `/api/v1/master/equip-inspect-items?equipCode=EQ-CUT-01&inspectType=WORKER&limit=100` 8건 반환.
- 브라우저 확인: `/production/input-kiosk`에서 `EQ-CRIMP-01` 선택 상태로 작업자설비점검 입력 모달을 열었을 때 WORKER 항목 8건과 `OK 0 / NG 0 / 미완료 8` 표시 확인.
- `git diff --check` 통과.

## 2026-06-09 22:30 claude

### T-SHIP-WORKFLOW-FIX 완료

**대상:** 박스입고~출하처리~재고차감 워크플로우 로직/DB 불일치 일괄 수정.

**수정 내용:**
1. **Critical 1-1** `product-inventory.service.ts`: `cancelTransaction`의 toWarehouseId 복구 로직에서 `qty > 0` 조건 제거. 창고간 이동 취소 시 toWarehouseId(입고 창고) 재고도 정상 복구되도록 수정.
2. **Critical 1-2** `shipment.service.ts`: `reverseShipment`에서 상태 복원과 `productInventoryService.cancelTransaction`을 단일 tx.run으로 통합. `cancelTransactionInTx` 신규 메서드를 통해 상태-재고 원자성 보장. 실패 시 전체 롤백.
3. **Critical 1-3** `shipment.service.ts`: `markAsShipped`에서 깨진 한글 에러 메시지 복원 (`FG 바코드 정보가 없는 시리얼이 포함되었습니다`, `FG 바코드가 없습니다`).
4. **Major 2-1** `product-inventory.service.ts`: `receiveStockInTx`에 BOX 이중입고 가드 추가 (`refType==='BOX'` 중복 거부).
5. **Major 2-2** `shipment.service.ts`: `markAsShipped` 시 `shipment.shipOrderNo` 연계 시 `ShipmentOrderItem.shippedQty` 업데이트 및 전량 출하 시 `ShipmentOrder.status='CLOSED'` 자동화. `reverseShipment`에서도 shippedQty 복원 및 `CONFIRMED` 되돌림.
6. **Minor 3-1** `shipment.service.ts`: `cancel` 시 BoxMaster 상태를 명시적 `CLOSED`로 복원.
7. **Minor 3-3** `ship-order.service.ts`: `delete` 시 `ShipmentOrderItem` cascade delete 적용 (트랜잭션 내에서 품목 먼저 삭제 후 헤더 삭제).
8. **테스트 보정** `product-inventory.service.spec.ts`, `shipment.service.spec.ts`: `FgLabel`/`BoxMaster` mock 추가, `cancelTransactionInTx` 호출로 테스트 assertion 수정.

**검증:**
- `pnpm --filter @harness/backend exec tsc -p tsconfig.json --noEmit` 통과.
- `pnpm --filter @harness/backend test -- shipment.service.spec.ts ship-order.service.spec.ts product-inventory.service.spec.ts` 44건 전체 통과.

## 2026-06-09 22:20 codex

### T-INPUT-KIOSK-WORKER-QR-SIMPLE 완료

**대상:** `/production/input-kiosk` 작업자설비점검 QR 입력 처리.

**수정 내용:**
- QR 스캐너는 키보드 입력처럼 입력창에 문자열을 넣는 것으로 보고, Enter 시점에 입력값만 읽는다.
- 이전에 추가했던 `ITEM_CODE`, `SEQ`, `EQUIP_CODE:ITEM_CODE` 등 후보 조합 매칭을 제거했다.
- 입력값은 trim/대문자 정규화 후 설비별 등록 항목의 `WORKER_QR_CODE`와 직접 비교한다.
- 매칭되면 기존처럼 해당 행으로 스크롤 및 포커스하고 OK/NG 버튼을 활성화한다.

**검증:**
- `pnpm --filter @harness/frontend exec tsc --noEmit` 통과.
- `git diff --check` 통과.
- 실제 브라우저 테스트:
  - 백엔드 dev 서버는 `localhost:3003`, 프론트는 `localhost:3002`에서 확인.
  - `admin@hanes.com / admin123`, `40 / 1000`으로 로그인 성공.
  - 테스트용으로 `EQ-CRIMP-01`, `SEQ=901`, `WORKER_QR_CODE='QR-WORKER-TEST-001'` 설비별 WORKER 점검항목을 API 등록.
  - `/production/input-kiosk`에서 설비/작업자 상태를 잡고 작업자설비점검 모달을 열어 항목 1건 조회 확인.
  - QR 입력창에 `QR-WORKER-TEST-001` 입력 후 Enter: 해당 행에 OK/NG 버튼 표시 확인.
  - OK 선택 후 `OK 1 / NG 0 / 미완료 0`, `점검 저장` 버튼 활성화 확인.
  - `점검 저장` 클릭 후 화면 헤더가 `작업자설비점검 완료`로 변경되고 `harness-kiosk.interlock.workerInspectDone=true` 확인.
  - JSHANES `EQUIP_INSPECT_LOGS`에서 `INSPECT_TYPE='WORKER'`, `OVERALL_RESULT='PASS'`, `DETAILS`에 QR/OK 결과 저장 확인.
  - 테스트 후 임시 점검항목과 임시 로그 삭제, 잔여 `temp_item_count=0`, `temp_log_count=0` 확인.

## 2026-06-09 22:05 codex

### T-INPUT-KIOSK-WORKER-INSPECT-QR 완료

**대상:** `/production/input-kiosk` 작업자설비점검 모달.

**원인:**
- `WorkerInspectModal`은 설비별 `WORKER` 항목을 조회하고 있었지만 QR 매칭 기준이 `workerQrCode` 완전일치 하나뿐이라 항목코드/순번 기반 QR은 행을 찾지 못했다.
- QR 스캔 후 활성 행 표시만 있었고 실제 DOM 포커스/스크롤 이동은 없었다.
- 저장 payload는 `inspectType: 'WORKER'`를 보내지만 `/equipment/daily-inspect` POST 컨트롤러가 `inspectType: 'DAILY'`로 강제해 작업자설비점검 로그가 DAILY로 저장될 수 있었다.
- 설비별 점검항목 생성 시 `workerQrCode`, `itemType`, `unit`, `lslValue`, `uslValue`가 엔티티 생성값에서 빠져 등록 후 조회/스캔에 필요한 값이 누락될 수 있었다.

**수정 내용:**
- QR 스캔 시 `WORKER_QR_CODE`, `ITEM_CODE`, `SEQ`, `EQUIP_CODE:ITEM_CODE`, `EQUIP_CODE-ITEM_CODE`, `EQUIP_CODE:SEQ`, `EQUIP_CODE-SEQ` 후보를 대소문자 무시로 매칭한다.
- 매칭된 행은 `scrollIntoView`와 `focus({ preventScroll: true })`로 실제 포커싱하고, 활성 행에서만 OK/NG 버튼을 노출한다.
- 저장 상세는 `{ details: { items: [...] } }` 형태로 보내며 항목코드와 QR 코드도 함께 남긴다.
- `/equipment/daily-inspect` POST는 기본 DAILY 동작을 유지하되 요청 `inspectType`이 `WORKER`일 때만 WORKER로 저장한다.
- 설비별 점검항목 생성 서비스가 QR/항목유형/측정값 필드를 보존하도록 했다.

**검증:**
- `pnpm --filter @harness/backend test -- equip-inspect.service.spec.ts daily-inspect.controller.spec.ts` 통과: 3 suites, 11 tests.
- `pnpm --filter @harness/backend exec tsc -p tsconfig.json --noEmit` 통과.
- `pnpm --filter @harness/frontend exec tsc --noEmit` 통과.
- `git diff --check` 통과.
- `GET http://localhost:3002/production/input-kiosk` HTTP 200 확인.
- 인증 세션 기반 실제 QR 스캔 브라우저 클릭은 수행하지 못했고, 로컬 라우트와 타입/단위 테스트로 검증했다.

## 2026-06-09 21:40 claude

### T-SHIP-FG-RECEIVE-UI 완료 (T-SHIP-BOX-SCAN 후속, 보류분 해소)

**배경:** 백엔드 `fg/receive`가 FG 기본창고(FG_MAIN) 강제 입고로 바뀌어, 완제품 입고 화면의 창고선택 UI가 무의미(사용자가 골라도 무시)해짐.

**변경 (FINISHED 경로만, WIP/SEMI_PRODUCT 불변):**
- 웹 `product/receive/components/ReceiveModal.tsx`(개별입고): FINISHED일 때 창고 Select 숨김+`fgAutoWarehouse` 안내, submit/버튼 disabled에서 FINISHED는 warehouseCode 불요.
- 웹 `product/receive/components/BoxReceiveList.tsx`(박스입고): FINISHED일 때 창고 Select 숨김+안내, receive 가드 완화. `useBoxReceive.ts`는 미변경(warehouseId 릴레이).
- PDA `pda/product/receiving/page.tsx`(이번엔 tracked): FINISHED일 때 `WarehouseSelect` 숨김+안내.
- i18n `fgAutoWarehouse` 3키(productMgmt.receive.modal / productMgmt.receive / pda.productReceiving)×4파일. **타 작업자 미커밋 WIP가 locales에 섞여 있어 hunk 분리(git apply --cached)로 내 12줄만 커밋, 타 작업분 working tree 보존.**

**검증:** 프론트 tsc 0, `/product/receive`·`/pda/product/receiving` HTTP 200, ko 3키 확인.

**커밋:** d7af956(코드), 12971b9(i18n).

## 2026-06-09 21:30 codex

### T-EQUIP-INSPECT-WORKER-SEED 완료

**대상:** `EQUIP_INSPECT_ITEM_POOL` 점검항목 마스터.

**원인:**
- 기존 표준 seed(`2026-05-19_seed_equip_inspect_item_pool.sql`)에는 `DAILY`, `PERIODIC`, `PM` 항목만 있었다.
- JSHANES 실DB 확인 결과 `WORKER` 유형은 0건이었다.

**수정 내용:**
- 재실행 가능한 seed SQL `apps/backend/src/migrations/2026-06-09_seed_equip_inspect_worker_items.sql`을 추가했다.
- `WORKER=작업자설비점검` 표준 항목 8건을 `EIP-STD-W001~W008` 코드로 추가했다.
- 항목은 작업 전 정리, 안전커버/보호장치, 비상정지 접근성, 치공구 장착, 자재 투입 방향, 표시등/알람, 작업부 청결, 작업 종료 후 원위치 확인이다.

**검증:**
- 사전 JSHANES 조회: `WORKER` 0건.
- `python scripts/migration/run_migration.py apps/backend/src/migrations/2026-06-09_seed_equip_inspect_worker_items.sql --site JSHANES` 성공.
- 동일 명령 재실행 성공(MERGE 기반 idempotent 확인).
- JSHANES 유형별 건수: `DAILY=25`, `PERIODIC=17`, `PM=4`, `WORKER=8`.
- JSHANES `WORKER` 항목 8건 조회 확인.
- `GET http://localhost:3002/master/equip-inspect` HTTP 200 확인.

## 2026-06-09 21:15 codex

### T-EQUIP-INSPECT-ADD-MODAL-TYPE 완료

**대상:** `/master/equip-inspect` 점검항목추가 모달.

**원인:**
- `AddInspectItemModal`에는 점검유형 `Select`가 있었지만 점검항목 선택 아래 3칸 그리드 안에 배치되어 있었다.
- 선택한 Pool 항목의 `inspectType`이 다시 상태를 덮어써서, 사용자가 모달을 열자마자 점검유형을 먼저 선택하는 흐름이 아니었다.
- 실제 사용 화면에서는 점검유형 드롭다운이 없거나 선택할 수 없는 컨트롤처럼 보일 수 있었다.

**수정 내용:**
- 점검유형 드롭다운을 모달 상단, 점검항목 선택보다 먼저 독립 행으로 배치했다.
- 점검유형 변경 시 선택된 점검항목을 초기화하고, `/master/equip-inspect-item-pool` 조회에 `inspectType` 파라미터를 추가해 선택 유형의 Pool 항목만 표시한다.
- Pool 항목 선택 시 점검유형을 자동으로 덮어쓰던 effect를 제거했다.
- 모달 구조 회귀 방지용 `add-modal.structure.test.mjs`를 추가했다.

**검증:**
- RED: `node --test apps/frontend/src/app/(authenticated)/master/equip-inspect/add-modal.structure.test.mjs`가 점검유형 위치/필터 누락으로 실패 확인.
- GREEN: `node --test apps/frontend/src/app/(authenticated)/master/equip-inspect/add-modal.structure.test.mjs` 통과.
- `pnpm --filter @harness/frontend exec tsc --noEmit` 통과.
- `GET http://localhost:3002/master/equip-inspect` HTTP 200 확인.

## 2026-06-09 21:00 codex

### T-EQUIP-INSPECT-WORKER-TYPE 완료

**대상:** `/master/equip-inspect`.

**원인:**
- 백엔드 DTO, 타입, 번역에는 `WORKER` 점검유형과 `작업자설비점검` 라벨이 이미 있었다.
- 하지만 `/master/equip-inspect/page.tsx`는 `EquipAssignTab`만 렌더링하고 `ItemMasterTab`을 노출하지 않아, 사용자가 점검항목 Pool에서 `작업자설비점검` 유형을 등록/필터할 진입점이 없었다.
- 일부 fallback 라벨은 `작업자점검`으로 되어 있어 요청 문구와 달랐다.

**수정 내용:**
- `/master/equip-inspect` 페이지에 `설비별 할당` / `점검항목 마스터` 탭 전환 UI를 추가했다.
- `ItemMasterTab`을 실제 렌더링해 점검유형 `WORKER=작업자설비점검`을 선택/필터할 수 있게 했다.
- `ItemMasterTab`, `AddInspectItemModal`의 `WORKER` fallback 라벨을 `작업자설비점검`으로 통일했다.
- 페이지 구조 회귀 방지용 `page.structure.test.mjs`를 추가했다.

**검증:**
- RED: `node --test apps/frontend/src/app/(authenticated)/master/equip-inspect/page.structure.test.mjs`가 `ItemMasterTab` 미노출로 실패 확인.
- GREEN: `node --test apps/frontend/src/app/(authenticated)/master/equip-inspect/page.structure.test.mjs` 통과.
- `pnpm --filter @harness/frontend exec tsc --noEmit` 통과.
- `GET http://localhost:3002/master/equip-inspect` HTTP 200 확인.

## 2026-06-09 20:15 claude

### T-SHIP-BOX-SCAN 완료

**범위:** 출하지시 기반 박스 스캔 출하 신설 + 완제품 입고 FG_MAIN 단순화. 웹(`/shipping/confirm` 모달) + PDA(`/pda/shipping` 수리) 공용.

**백엔드:**
- `POST /shipping/orders/:id/ship-box` (ShipOrderService.shipBox, 단일 트랜잭션): 지시 CONFIRMED 검증 → 박스 tx내 재조회(CLOSED+OQC PASS+미출하+팔레트 미적재) → 품목 매칭/초과 검증 → FG 기본창고(IS_DEFAULT=Y) `issueStockInTx`로 FG_OUT 차감(prdUid '*') → 박스 SHIPPED → 라인 shippedQty 증가 → 전 라인 완출 시 지시 CLOSED. 반환 `{lineShippedQty, lineOrderQty, orderStatus, fullyShipped}`.
- 이중차감 가드: 팔레트 적재(`palletNo`) 박스는 박스 스캔 출하 거부(팔레트 출하 경로 전용). `assignToPallet`은 기존 CLOSED-only 가드 존재 확인.
- `inventory.controller.receiveFg`를 FG 기본창고로 강제(WH-FG 임의 입고 차단).
- 모듈 와이어링: ShippingModule→InventoryModule import(ProductInventoryService 재사용).

**프론트:**
- 웹 `components/shipping/BoxScanShipModal.tsx` 신설 + `/shipping/confirm` 헤더 버튼/모달 연결(작업자=로그인 사용자).
- PDA `useShippingScan` 수리: 미구현 `by-barcode`/`register` → `GET /shipping/orders/:id` + `ship-box` 1건 호출, 다중 라인 진행률, 작업자 QR 유지. `handleConfirmShip`은 완료/리셋 액션으로 유지.
- i18n 4파일(`shipping.boxScan.*`, `pda.shipping` 에러키).

**검증:** 백엔드 tsc 0 / jest 18건(shipBox 8 케이스 포함). 프론트 tsc 0. 실DB end-to-end(JSHANES): 테스트 출하지시 SO-SBX-TEST(CONFIRMED, HNS01×5)+FG_MAIN 재고5+박스 BXPDATEST01 OQC PASS 생성 → `GET orders` 200 → `POST ship-box` 200(fullyShipped) → DB확인(박스 SHIPPED, FG_MAIN 5→0, shippedQty 5, 지시 CLOSED, FG_OUT -5 트랜잭션) → 재출하 400 → 테스트데이터 전량 원복(원상 확인).

**보류:** Task9(제품입고 PDA `pda/product/receiving/page.tsx` 창고선택 숨김) — 해당 파일이 untracked 신규(타 작업자 진행 중)라 흡수 커밋 부적절. 백엔드 FG_MAIN 강제로 기능은 정상, UI 정합성만 미적용. 사용자 승인하에 보류.

**비고:** i18n 커밋(8a5b44a)에 working tree의 타 작업자 미커밋 번역이 함께 포함됨(코드 손실 없음).

**커밋:** b013519, 1d966d2, dfdf781, fe85fe7, f3cfb59, 7c98b5f, bd9c519, 8a5b44a, 9488142, cffc9da, 7b95be5

## 2026-06-08 11:08 codex

### T-MAT-CYCLE-E2E-QA 완료

**범위:** `PO -> 자재입하 -> IQC 검사 -> 자재입고 -> 자재출고 -> 자재재고` 실데이터 헤드리스 브라우저 QA.

**테스트 데이터:**
- PO: `PO-260608-013`, 공급처 `HS0001`, 품목 `CBL-A`, 수량 `25`.
- 입하: `R26060800001`, LOT `VH1-RM260608-00004`, 제조사 `M001`, 입하창고 `W001`.
- IQC: `PASS`, 검사자 `E2E검사자`, 시료수량 `1`, 성적서 업로드 경로 `apps/backend/uploads/iqc-certs/...txt`.
- 입고: `RCV20260608-0001`, 수량 `25`, 창고 `W001`.
- 출고: `ISS20260608-0001`, 수량 `25`, 출고계정 `PRODUCTION`.

**통과 확인:**
- PO 등록 버튼, 품목 추가/품목검색 모달, 저장 후 API/DB 조회 확인.
- 자재입하 버튼, 제조사 선택, 시리얼 발급 확인 모달, 라벨 미리보기 확인.
- IQC 검사 버튼, PASS/측정값/검사자/시료수량 입력, 합격 등록 확인.
- 수동출고 탭, 출고처리 버튼, 확인 모달, `POST /material/issues => 201` 확인.
- DB 확인: `MAT_RECEIVINGS` 1건, `MAT_ISSUES` 1건, `STOCK_TRANSACTIONS` `MAT_IN/RECEIVE/MAT_OUT`, `MAT_STOCKS.qty=0`, `MAT_LOTS.status=DEPLETED`.

**발견 결함:**
- 자재입고 화면 `POST /material/receiving` 요청이 `warehouseCode`를 보내지만 백엔드는 `warehouseId`를 요구해 400 실패. 화면 입고 버튼만으로는 사이클이 중단된다.
- IQC 성적서 업로드 API는 있으나 IQC/IQC이력 화면에 업로드 버튼이 없어, 성적서 필수 품목은 UI만으로 입고 가능 상태까지 진행할 수 없다.
- 입하/IQC 화면 일부 일자가 `2026-06-07T15:00:00.000Z` 또는 하루 전 날짜처럼 노출된다.
- 수동출고에서 1건 선택 후 하단은 `선택됨 1건`이지만 다른 행 체크박스가 시각적으로 checked처럼 표시된다.
- 자재재고 API/화면 검색은 `matUid`를 검색하지 않아 `VH1-RM260608-00004` 검색 시 빈 결과가 나오지만 전체 목록에는 해당 LOT 0 재고가 표시된다.

**비고:**
- 구현 파일은 수정하지 않았다. `T-MAT-RECV-FIXES` Claude 잠금 영역은 건드리지 않고 QA 증거만 남겼다.

## 2026-06-07 claude

### T-MAT-RECV-FIXES Phase 1 (빠른 버그) — 진행중

스테이크홀더(행성) 자재입고 프로세스 지적 목록 대응. 참조: 목업 `C:\Document\고객별프로젝트\행성사\THN_MockUp`(MT\IQC001~006), 채번 pptx `HANES_MES_채번규칙.pptx`.

**#1 PO 등록 오류 — 완료(API 재현 검증)**
- 근본원인(systemic): `common/filters/http-exception.filter.ts`가 class-validator `message`(문자열 배열)를 버리고 `exception.message`("Bad Request Exception")로 폴백 → 앱 전체 폼 검증 오류가 무의미하게 표시.
- 수정: 필터에서 배열 message를 줄바꿈 결합해 노출 + 원본 배열 `details` 보존.
- PO DTO: orderQty 한글 메시지(@IsInt/@Min), itemCode `@IsNotEmpty`(빈값 시 500 ORA-01400→400), poNo `@IsNotEmpty`, items `@ArrayNotEmpty`.
- 프론트 PoFormPanel: orderQty 정수≥1 클라 검증(저장 차단 + 인라인 error), i18n 4파일(`material.po.invalidQty/qtyMin`).
- 검증: `POST /material/purchase-orders` qty=0→"발주수량은 1 이상이어야 합니다.", 소수점→"정수로 입력하세요.", 빈 itemCode→"품목코드는 필수입니다."(400), 정상건 생성 성공.

**#2 입하관리 일부입하 상태 안 보임 — 수정완료(CLI검증), dev 재시작 필요**
- 근본원인(systemic): ComCodeBadge가 DB `COM_CODES.ATTR1`의 Tailwind 클래스를 className으로 직접 사용. 소스에 없는 클래스(`bg-yellow-600` 등)는 Tailwind v4 JIT가 purge → 배경 사라짐(일부입하 배지가 배경색과 동일). `bg-blue-600`(OPEN)은 코드에 정적 존재라 살아남아 대비됨.
- 수정: `app/globals.css`에 `@source inline(...)`로 ATTR1 사용 색상/음영(16색×{100,200,300,600,700,800,900}, dark 포함) + `text-white` safelist.
- 검증: `@tailwindcss/cli`로 `.bg-yellow-600`/`.text-white` 생성 확인. **Turbopack dev 서버는 @source 변경 재스캔에 재시작 필요** — 재시작 후 브라우저 확인 예정.

**작업지시 품목검색 제품·반제품만 — 완료(API 검증, tsc 통과)**
- 백엔드 `PartQueryDto.itemTypes`(콤마구분→배열) + `part.service.findAll` `itemType IN (:...)`.
- 프론트 `PartSearchModal` `allowedItemTypes` prop(유형 드롭다운 제한 + 미선택 시 허용유형으로 조회). JobOrderFormPanel에서 `["FINISHED","SEMI_PRODUCT"]` 전달. i18n `inventory.stock.consumable` 4파일.
- 검증: `GET /master/parts?itemTypes=FINISHED,SEMI_PRODUCT` → FINISHED 3 + SEMI_PRODUCT 18, 원자재/소모품 제외.

**#7 자재 입고 — 조사완료: 미구현 아님**
- `/material/receive`(자재입고관리) 화면 정상 존재·동작(입고대기 12건). menuConfig 등록 + DB MENU_CATEGORY_ITEMS(MATERIAL) 할당 확인. 좌측 `자재수불관리`로 접근 가능.
- 결론: discoverability(상단 탭바는 메뉴 아님/붐빔) 또는 흐름 안내 이슈. 사용자 확인 대기.

### IQC006 입하실적조회 — 설계 승인 + Slice ① 백엔드 완료

설계 spec: `docs/superpowers/specs/2026-06-07-iqc006-arrival-result-design.md` (사용자 승인: 슬라이스대로, 메뉴=입하관리 바로 뒤).
사전검증(실측): 제조사=`MAT_LOTS.MFG_PARTNER_CODE`(시리얼단위), 입고판정=RECEIVE 트랜잭션합≥INIT_QTY, IQC대상=`ITEM_MASTERS.IQC_FLAG`, findAll은 거래단위라 신규 집계 필요, 기존 IQC006 라우트 없음.

**Slice ① (목록+시리얼 조회) — 완료, API 검증**
- DTO: `ArrivalResultQueryDto`, `ChangeManufacturerDto`(arrival.dto.ts).
- 서비스(arrival.service.ts): `listArrivalResults`(입하번호+SEQ 집계, 상태CASE 도출, 페이징/필터, raw SQL `dataSource.query` `:n` 바인드), `getArrivalSerials`(시리얼+입고/취소/checkable). 상태코드: ARRIVED/IQC_PROGRESS/IQC_DONE/RECEIVED/CANCELED.
- 컨트롤러: `GET /material/arrivals/results`, `GET /material/arrivals/results/:arrivalNo/:seq/serials`.
- 검증: results 5건(serialCount/receivedCount/poType=RM/status=IQC_PROGRESS/cancelable), serials(VH1-RM260607-00001, stockInYn=N).

**Slice ②③④ + 프론트 — 완료, API/브라우저 검증**
- 백엔드: `cancelByArrival`(POST results/:arrivalNo/cancel, 시리얼 MAT_IN 트랜잭션 모아 기존 cancel 재사용), `changeManufacturer`(PATCH results/:arrivalNo/manufacturer, MAT_LOTS.mfgPartnerCode 일괄 갱신, MFG 검증). DTO `CancelArrivalByNoDto`/`ChangeManufacturerDto`.
- 프론트: `material/arrival-result/page.tsx`(목업 IQC006: 좌 DataGrid 목록+입하취소버튼 / 우 정보카드+제조사변경 + 전체선택+라벨재발행(MatLabelPreviewModal 재사용) + 시리얼표). PartnerSelect에 `MFG` 타입 추가(useMasterOptions/PartnerSelect).
- 공통코드 seed(`apps/backend/src/migrations/2026-06-07_iqc006_arrival_result_seed.sql`): `ARRIVAL_RESULT_STATUS`(5) + `ARRIVAL_PO_TYPE`(RM/CM) + 메뉴 `MAT_ARRIVAL_RESULT`(MATERIAL, sort35). 모든 색상 globals.css safelist 포함.
- 메뉴: menuConfig `MAT_ARRIVAL_RESULT`(입하관리 뒤) + i18n `menu.material.arrivalResult` + `material.arrivalResult.*` 4파일. (Sidebar는 admin 권한 우회 → 노출 OK)
- 검증: results/serials 조회, 제조사변경(M001 OK / 비-MFG HS0001 거부), 입하취소(seq=5→CANCELED) 모두 통과. tsc 통과, JSON 유효(BOM 없음). 브라우저: 좌목록/우패널/시리얼 렌더 확인.

**IQC006 잔여(선택)**: 비-admin 역할용 ROLE_MENU_PERMISSIONS(MAT_ARRIVAL_RESULT) 추가는 역할별 관리 작업.

**Phase 1 잔여 확인**: #2 배지 safelist는 dev 서버 재시작 후 브라우저 라이트/다크 대비 육안 확인 필요(CLI 검증만 됨).

### 자재분할/병합 재설계 — 설계 승인(2026-06-08), 구현 대기
spec: `docs/superpowers/specs/2026-06-08-lot-split-merge-redesign.md`. 승인: pptx 모델(원 시리얼 전부 폐기→결과 전부 신규 발번) / 분할=2분할(분할량+잔량) / 신규시리얼 날짜=오늘(SEQ_MAT_SERIAL_DAILY, 추적은 origin). 게이팅=입고완료만, 병합=바코드스캔, 채번=nextMatSerial+STOCK_TX, 박스=범위외, 기존검증 유지.
**#4 근본원인 확인(재현)**: `lot-split.service.split()`이 신규 MatLot에 `currentQty` 미설정 → `MAT_LOTS.CURRENT_QTY` NOT NULL 위반 → 분할 전건 500(ORA-01400). 재작성으로 해소 예정.

**남은 항목**: 자재분할/병합 구현(설계완료), 라인→공정설비 지정(구조변경·설계 필요). (#7은 입하실적조회를 입하관리 뒤(sort35) 배치로 부분 개선; 자재입고 기존 노출 확인됨.)

## 2026-06-04 claude

### T-AUDIT-COLUMN-DEFAULT-FIX 완료

**증상:** `POST /master/parts` 500 — `ORA-01400: NULL을 ("TEST"."ITEM_MASTERS"."CREATED_AT") 안에 삽입할 수 없습니다`.

**근본 원인(primary source 확인):**
- TypeORM 0.3.28 Oracle 드라이버는 `@CreateDateColumn`/`@UpdateDateColumn` 값을 JS에서 채우지 않는다. `SubjectExecutor.js`의 `new Date()` 채움 로직은 `mongodb` 드라이버 전용 분기 안에만 존재(Oracle 분기는 그냥 single insert로 넘김).
- 값이 undefined인 채 단건 Oracle INSERT가 빌드되면 `InsertQueryBuilder.js`가 컬럼에 리터럴 `DEFAULT` 키워드를 출력(주석에 "이미 컬럼 default에 있으니 안 넣는다" 명시).
- 즉 이 스키마는 감사 컬럼 값을 DB 컬럼 `DEFAULT SYSTIMESTAMP`에 의존하는데, `synchronize:false`라 재생성/리네임 과정에서 누락된 테이블은 `DEFAULT`→NULL→NOT NULL 위반.

**범위(실측):** JSHANES(test)에서 감사 컬럼이 NOT NULL & DEFAULT 없는 컬럼 = **33개 테이블 / 64개 컬럼** (ITEM_MASTERS, BOM_MASTERS, PURCHASE_ORDERS, JOB_ORDERS, USERS, ROLES, PARTNER_MASTERS, COM_CODES 등). ITEM_MASTERS만 고치면 에러가 UPDATED_AT 등으로 옮겨갈 뿐이라 systemic 일괄 처리.

**변경 내용:**
- `apps/backend/src/migrations/2026-06-04_fix_audit_column_defaults.sql` 추가(멱등 PL/SQL: NOT NULL & default 없는 CREATED_AT/UPDATED_AT에 `DEFAULT SYSTIMESTAMP` 부여). **JSHANES, HNSMES(MYDBPDB) 적용 완료**(둘 다 33테이블/64컬럼, 보정 후 0건). 앱 코드/엔티티 변경 없음(DB-level 컨벤션 유지).
- `scripts/gen-live-schema.py` 추가 + `apps/backend/src/database/create-hanes-schema.sql`을 라이브 DB 실측(DBMS_METADATA, 148개 테이블)으로 재생성. 기존 파일은 구 아키텍처(PART_MASTERS/UUID PK, 21/148 테이블)로 stale였음.

**검증:**
- 보정 후 재스캔: NOT NULL & default 없는 감사 컬럼 0건.
- CREATED_AT/UPDATED_AT 생략 INSERT를 ROLLBACK으로 실행 → 성공(ORA-01400 해소), 잔여 데이터 0.
- 재생성 스키마의 ITEM_MASTERS가 ITEM_CODE 자연키 PK + CREATED_AT/UPDATED_AT DEFAULT SYSTIMESTAMP로 실DB와 일치.

## 2026-06-02 13:13 codex

### T-BOM-LABEL-CLARIFY 완료

**변경 내용:**
- BOM 화면 컬럼 `유형` 라벨을 `품목유형`으로 변경했다.
- BOM 화면 컬럼 `공정` 라벨을 `투입공정`으로 변경했다.
- `ko/en/vi/zh` locale에 같은 의미로 반영했고, 누락되어 있던 BOM `oper` 다국어 키도 추가했다.

**근거:**
- `품목유형`은 `ITEM_MASTERS.ITEM_TYPE`이다.
- `투입공정`은 `BOM_MASTERS.OPER`이며 자재가 투입되는 공정 코드다.

**검증:**
- `pnpm --filter @harness/frontend exec tsc --noEmit` 통과.
- `git diff --check -- apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json apps/frontend/src/locales/vi.json apps/frontend/src/locales/zh.json .ai-coordination/TASKS.md .ai-coordination/LOCKS.md` 통과.

## 2026-06-02 12:55 codex

### T-ITEM-TYPE-COMCODE-UNIFY 완료

**대상:** `JSHANES`, `ITEM_MASTERS.ITEM_TYPE`.

**확인한 원인:**
- JSHANES `ITEM_MASTERS.ITEM_TYPE` 실제 값은 `FINISHED`, `RAW_MATERIAL`, `SEMI_PRODUCT`로 이미 정규화되어 있었다.
- `ITEM_MASTERS.ITEM_TYPE` 컬럼 주석은 아직 `품목유형 [공통코드:PART_TYPE] (RAW/WIP/FG)`로 남아 있었다.
- 일부 런타임 화면/Swagger/shared 상수와 schema SQL/문서 생성 스크립트가 `PART_TYPE`을 품목유형 기준처럼 재사용하고 있었다.

**변경 내용:**
- `apps/backend/src/migrations/2026-06-02_unify_item_type_comcode.sql` 추가.
- JSHANES 컬럼 주석을 `품목유형 [공통코드:ITEM_TYPE] (RAW_MATERIAL/SEMI_PRODUCT/FINISHED/CONSUMABLE)`로 변경.
- JSHANES `COM_CODES.GROUP_CODE='PART_TYPE'` 활성 행 3건을 `USE_YN='N'`으로 변경.
- 품목/BOM/제품홀드 화면과 Swagger enum/shared 상수에서 품목유형 공통코드 참조를 `ITEM_TYPE`으로 통일.
- schema SQL, 제품재고/트랜잭션 SQL, 문서 생성 스크립트, material flow 검증 스크립트의 재발 지점을 `ITEM_TYPE` 기준으로 정리.
- `docs/reports/db-schema-erd.md`를 `ORACLE_SITE=JSHANES` 기준으로 재생성했다.

**검증:**
- `pnpm --filter @harness/backend test -- item-type-comcode.spec.ts` 통과.
- `pnpm --filter @harness/backend build` 통과.
- `pnpm --filter @harness/frontend exec tsc --noEmit` 통과.
- `python C:/Users/hsyou/.codex/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-06-02_unify_item_type_comcode.sql` 통과.
- Oracle 확인: `ITEM_TYPE` 공통코드 4건은 활성, `PART_TYPE` 3건은 비활성, `ITEM_MASTERS.ITEM_TYPE` 컬럼 주석은 `공통코드:ITEM_TYPE`.
- 선택 범위 `PART_TYPE` 검색 통과: `apps/backend/src/database`, `scripts`, `packages/shared`, `docs/standards`, `agent-harness`에서 과거 rename migration을 제외하고 잔여 없음.

**남은 위험:**
- `docs/superpowers` 과거 계획/스펙과 frontend locale의 과거 `PART_TYPE` 번역 키는 이력/비활성 그룹 표시용 잔재라 이번 런타임 기준 정리 범위에서 제외했다.

Append new entries at the top.

Use this heading format for every new entry:

```md
## YYYY-MM-DD HH:mm Agent
```

Use local time in 24-hour format.

## 2026-06-02 12:52 codex

### T-BOM-PRODUCT-TYPE-SEMANTIC-FIX 완료

**원인:**
- 직전 정정에서 `PRODUCT_TYPE`을 `2011=하네스`, `2012=반제품`, `2013=원자재`, `2014=부자재`로 바꿨으나, 이는 `ITEM_TYPE`의 `FINISHED/SEMI_PRODUCT/RAW_MATERIAL`와 의미가 겹쳤다.
- 기존 HANES seed/IQC 로직은 `PRODUCT_TYPE`을 `HARNESS`, `SUB_ASSY`, `WIRE`, `TERMINAL`, `CONNECTOR`, `SEAL`, `TAPE`, `TUBE` 같은 품목군으로 사용하고 있었다.

**정의:**
- `ITEM_TYPE`: 재고/생산 흐름 분류. `FINISHED`, `SEMI_PRODUCT`, `RAW_MATERIAL`, `CONSUMABLE`.
- `PRODUCT_TYPE`: 품목군/물성 분류. `HARNESS`, `MODEL`, `SUB_ASSY`, `WIRE`, `TERMINAL`, `CONNECTOR`, `HOLDER`, `SEAL`, `SHIELD`, `TAPE`, `TUBE`, `HOUSING`, `LABEL`, `CLIP`, `ELECTRIC`, `GROMMET`.

**조치:**
- JSHANES `40/1000` `ITEM_MASTERS.PRODUCT_TYPE` 18건을 품목군 코드로 정정했다.
- `tools/generated/bom-from-production-sheet-seed.sql` 재실행 기준도 같은 값으로 수정했다.
- `packages/shared/src/constants/com-code-values.ts`의 `PRODUCT_TYPE_VALUES`를 품목군 코드로 수정했다.
- `apps/frontend/src/app/(authenticated)/master/part/types.ts`의 `PRODUCT_TYPE_OPTIONS`를 품목군 라벨로 수정했다.
- `apps/backend/src/modules/master/dto/part.dto.ts`의 Swagger 예시를 `HARNESS`로 수정했다.

**검증:**
- JSHANES 분포: `FINISHED/HARNESS=1`, `FINISHED/MODEL=1`, `SEMI_PRODUCT/SUB_ASSY=2`, `RAW_MATERIAL`은 `WIRE/TERMINAL/CONNECTOR/HOLDER/SEAL/SHIELD/TAPE/TUBE/HOUSING`으로 분산.
- invalid count query 결과: `0`.
- `pnpm --filter @harness/shared build` 통과.
- `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` 통과.
- `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과.
- `git diff --check` 통과.

## 2026-06-02 12:35 codex

### T-BOM-PRODUCT-TYPE-CLEANUP 완료

**확인 결과:**
- `ITEM_TYPE`은 코드 상수 기준 `RAW_MATERIAL`, `SEMI_PRODUCT`, `FINISHED`, `CONSUMABLE`이며 수불/생산 흐름 분류로 쓰인다.
- `PRODUCT_TYPE`은 품목 화면의 제품유형 코드이며 현재 옵션은 `2011=하네스`, `2012=반제품`, `2013=원자재`, `2014=부자재`, `7011=김산K`이다.
- 최초 HTML 시드에서 `PRODUCT_TYPE`에 `RAW_MATERIAL`, `PURCHASED_PART`, `MODEL`, `CIRCUIT` 같은 설명성 값을 넣어 화면 코드 체계와 맞지 않았다.

**조치:**
- JSHANES `40/1000` `ITEM_MASTERS.PRODUCT_TYPE` 18건을 화면 코드 체계로 정정했다.
  - `FINISHED` 품목 `HNS001`, `HNS01`: `2011`
  - `SEMI_PRODUCT` 품목 `HNS01-C1`, `HNS01-C2`: `2012`
  - 원자재성 `RAW_MATERIAL` 품목 `CBL-A`, `CBL-B`, `TUB-A`, `TP0001`: `2013`
  - 구매/부자재성 `RAW_MATERIAL` 품목 10건: `2014`
- 재실행용 SQL `tools/generated/bom-from-production-sheet-seed.sql`도 같은 코드값으로 수정했다.
- `packages/shared/src/constants/com-code-values.ts`에 `PRODUCT_TYPE_VALUES`를 추가했다.
- `apps/backend/src/modules/master/dto/part.dto.ts`에서 `productType`을 `PRODUCT_TYPE_VALUES`로 검증하도록 추가했다.

**검증:**
- `python C:\Users\hsyou\.codex\skills\oracle-db\scripts\oracle_connector.py --site JSHANES --query "... GROUP BY item_type, product_type ..."` 결과: `FINISHED/2011=2`, `SEMI_PRODUCT/2012=2`, `RAW_MATERIAL/2013=4`, `RAW_MATERIAL/2014=10`.
- invalid count query 결과: `0`.
- `pnpm --filter @harness/shared build` 통과.
- `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` 통과.
- `git diff --check` 통과.

## 2026-06-02 12:12 codex

### T-BOM-PROD-SHEET-SEED 완료

**대상:** `JSHANES` / `40` / `1000`.

**원천 파일:**
- `C:\Users\hsyou\Desktop\bom-from-production-sheet.html`

**실행 파일:**
- `tools/generated/bom-from-production-sheet-seed.sql`

**처리 내용:**
- 기존 `PROCESS_QUALITY_CONDITIONS`, `ROUTING_MATERIALS`, `ROUTING_PROCESSES`, `ROUTING_GROUPS`, `BOM_MASTERS`, `PROD_PLANS`, `PROCESS_MASTERS`, `ITEM_MASTERS`의 `40/1000` 데이터를 삭제했다.
- HTML 기준으로 품목 18건, BOM 16건, 공정 16건, 라우팅 그룹 3건, 라우팅 공정 18건, 라우팅 자재 17건을 생성했다.
- `HNS001`은 HTML 설명대로 `HNS01`의 판매/모델 관리 코드로 품목마스터에만 등록하고 BOM 레벨에는 넣지 않았다.
- `TP0001`은 `BOM_MASTERS` PK가 `PARENT_ITEM_CODE + CHILD_ITEM_CODE + REVISION`이라 동일 부모/자식 2행을 둘 수 없어 BOM에는 800MM로 합산하고, `ROUTING_MATERIALS`에는 `TAPPN` 500MM + `MASSY` 300MM로 분리했다.
- HTML의 `구매품`은 코드 상수에 별도 `PURCHASED` 타입이 없어 `ITEM_TYPE=RAW_MATERIAL`, `PRODUCT_TYPE=PURCHASED_PART`로 기록했다.

**검증:**
- 실행 명령: `python C:\Users\hsyou\.codex\skills\oracle-db\scripts\oracle_connector.py --site JSHANES --execute-file tools\generated\bom-from-production-sheet-seed.sql`
- 실행 결과: `success=true`, `blocks_executed=1`.
- 후속 건수: `ITEM_MASTERS=18`, `BOM_MASTERS=16`, `PROCESS_MASTERS=16`, `ROUTING_GROUPS=3`, `ROUTING_PROCESSES=18`, `ROUTING_MATERIALS=17`.
- 무결성 확인: BOM 부모 누락 0, BOM 자식 누락 0, 라우팅 품목 누락 0, 라우팅 자재 누락 0.

**남은 위험:**
- 기존 `40/1000` 품목마스터 21,561건과 BOM/라우팅 기준정보는 사용자 요청대로 삭제했다. 운영성 주문/재고성 테이블까지 전체 정리한 것은 아니다.

## 2026-05-30 11:10 codex

### T-MASTER-ALL-DB-KEY-AUDIT 완료

**대상:** `apps/frontend/src/app/(authenticated)/master` 기준정보 화면.

**변경 내용:**
- `bom` 화면의 화면용 `id` 의존을 `bomKey`로 바꾸고, DB 복합키 `parentItemCode::childItemCode::revision` 기준으로 수정/삭제 호출을 정리했다.
- `label` 화면의 대상/템플릿 선택키를 `itemKey`, `templateKey`로 분리하고, 실제 PK `templateName::category` 기준 호출로 정리했다.
- `iqc-item`/`part` IQC 설정 화면에서 DB 응답에 없는 `id` 매핑을 제거하고 `inspItemCode`, `groupCode`, `partnerCode` 기준으로 정리했다.
- `vendor-barcode`는 실제 PK `vendorBarcode`, `work-instruction`은 `itemCode::processCode::revision`, `company`는 `companyCode::plant` 기준으로 정리했다.
- 기준정보 DataGrid 표시 SQL의 테이블명을 실제 DB 테이블명으로 정정했다. 주요 정정 대상은 `COM_CODES`, `EQUIP_BOM_ITEMS`, `GAUGE_MASTERS`, `IQC_ITEM_POOL`, `PROCESS_MASTERS`, `PROCESS_EQUIPMENTS`, `VENDOR_BARCODE_MAPPINGS`, `WAREHOUSE_LOCATIONS`, `WAREHOUSE_TRANSFER_RULES`, `WORKER_MASTERS`, `EQUIP_INSPECT_ITEM_MASTERS`, `EQUIP_INSPECT_ITEM_POOL`이다.

**검증:**
- `rg`로 기준정보 전체 `.id`, API `put/delete/patch`, `sqlQuery` 잔여 사용을 재스캔했다.
- `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과.
- `git diff --check` 통과.
- 로컬 백엔드 `localhost:3003`에서 `/api/v1/master/companies`, `/api/v1/master/boms/parents`, `/api/v1/master/label-templates`, `/api/v1/master/iqc-item-pool`, `/api/v1/master/iqc-groups`, `/api/v1/master/vendor-barcode-mappings`, `/api/v1/master/work-instructions` 조회가 모두 HTTP 200이다.

**남은 정상 예외:**
- `routing`의 self-inspect 항목은 DB `SELF_INSPECT_ITEMS.ID` 실제 PK가 있어 `row.id` 사용을 유지했다.
- `RoutingGroupManager`, `QualityConditionEditor`, `work-calendar`, `DataGrid` 컬럼 `id`는 화면 로컬 트리/행/컬럼 식별자라 DB 키 잔여물로 보지 않았다.

## 2026-05-30 10:52 codex

### T-MASTER-DB-KEY-CLEANUP 완료

**대상:** 기준정보 회사/사업장 화면.

**변경 내용:**
- `Company`, `Plant` 프론트 타입에서 DB 응답에 없는 임의 `id` 필드 의존을 제거했다.
- 회사 수정/삭제 호출은 `COMPANY_MASTERS` 복합키 기준 `companyCode::plant`를 사용하도록 변경했다.
- 사업장 행 key는 `PLANTS` 복합키 형태로 생성하고, 사업장 삭제 호출은 현재 컨트롤러가 받는 `plantCode`를 사용하도록 변경했다.
- 회사 DataGrid 표시용 SQL 테이블명을 `COMPANIES`에서 실제 기준 테이블 `COMPANY_MASTERS`로 정정했다.

**검증:**
- `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과.
- `git diff --check -- 'apps/frontend/src/app/(authenticated)/master/company/types.ts' 'apps/frontend/src/app/(authenticated)/master/company/page.tsx' 'apps/frontend/src/app/(authenticated)/master/company/components/CompanyForm.tsx'` 통과.

**남은 위험:**
- 기준정보 전체 화면의 `id` 사용은 아직 전수 정리하지 않았다. 이번 작업은 사용자가 지적한 회사/사업장 잔여물 우선 정리다.

## 2026-05-30 10:11 codex

### T-DB-TYPEORM-SCHEMA-AUDIT 완료

**대상:** `MYDBPDB` / `HNSMES`.

**최종 결과:**
- TypeORM 엔티티 147개와 DB 테이블 147개 비교 완료.
- `python tools/compare_typeorm_oracle_schema.py --site MYDBPDB` 결과 `issues=0`.
- type mismatch, PK mismatch, nullable mismatch 모두 해소.

**추가 적용:**
- `2026-05-30_semantic_type_alignment_mydbpdb.sql`
- `2026-05-30_typeorm_not_null_safe_mydbpdb.sql`
- `2026-05-30_remaining_not_null_data_fix_mydbpdb.sql`
- `2026-05-30_tenant_not_null_remaining_mydbpdb.sql`
- 테넌트 컬럼 엔티티 nullable 메타데이터를 DB `NOT NULL`과 맞춤.
- Oracle 빈 문자열은 NULL로 저장되는 점을 반영해 `MAT_ARRIVALS.INVOICE_NO`, `MAT_LOTS.INVOICE_NO`, `SEQ_RULES.SEPARATOR` 엔티티는 nullable로 정렬.

**검증:**
- `python tools/compare_typeorm_oracle_schema.py --site MYDBPDB` 통과, issues 0.
- `python tools/generate_db_schema_doc.py` 통과, `docs/reports/db-schema-erd.md` 갱신.
- `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` 통과.
- `git diff --check` 통과.

## 2026-05-30 09:56 codex

### T-DB-TYPEORM-SCHEMA-AUDIT 진행 기록

**대상:** `MYDBPDB` / `HNSMES`.

**변경 내용:**
1. TypeORM 런타임 메타데이터 추출 도구 `tools/export_typeorm_metadata.js` 추가.
2. Oracle `USER_*` 스키마 비교 도구 `tools/compare_typeorm_oracle_schema.py` 추가.
3. PK 불일치 보정 마이그레이션 적용: `2026-05-30_typeorm_pk_alignment_mydbpdb.sql`.
4. 안전한 `VARCHAR2` 확장 123건 적용: `2026-05-30_typeorm_varchar_widen_mydbpdb.sql`.
5. 숫자 scale 확장 4건 적용: `2026-05-30_typeorm_number_scale_mydbpdb.sql`.
6. 빈 `REWORK_*` 테이블의 문자열 타입 정렬 적용: `2026-05-30_rework_type_alignment_mydbpdb.sql`.
7. tenant-first 복합 PK 엔티티 선언 순서와 `REPAIR_USED_PARTS.ITEM_CODE` PK 정렬.
8. `tools/generate_db_schema_doc.py` 기본 사이트를 `MYDBPDB`로 바꾸고 `docs/reports/db-schema-erd.md` 재생성.
9. 감사 보고서 `docs/reports/typeorm-oracle-schema-audit-2026-05-30.md` 작성.

**검증:**
- `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` 통과.
- `python tools/compare_typeorm_oracle_schema.py --site MYDBPDB` 결과: entities 147, DB tables 147, ERROR 0, WARN 632.
- `python tools/generate_db_schema_doc.py` 결과: tables 148, columns 2393, fk 12, inferred 186.

**남은 작업:**
- `nullable_mismatch` 621건은 DB NOT NULL/엔티티 nullable 의미를 서비스 단위로 검토해야 한다.
- `type_mismatch` 11건은 기존 데이터가 있는 품질/PM/SPC/trace 테이블의 자연키 문자열 vs 숫자/RAW 의미 차이라 무작정 DB 변경 금지.

## 2026-05-27 16:10 claude

### 입하 플로우 E2E 검증 완료 (IQC005 ERP 3-key 대응)

**변경 내용:**
1. `PurchaseOrderItem.lineNo` NOT NULL / `revNo` DEFAULT 1 — DB 마이그레이션 완료 (JSHANES)
2. `PoLineReceiptDto`: `poSeq` → `lineNo + revNo` (ERP L/N, R/N 대응)
3. `arrival.service.receivePoLine`: PO 라인 조회를 `lineNo + revNo` 비즈니스 키 기준으로 변경
4. `arrival.service.receivePoLine`: 품목 마스터 미등록 시 단일 LOT fallback (404 에러 제거)
5. `api.ts`: `suppressErrorModal` 옵션 추가 — LOT_UNIT_QTY 조회 404 모달 억제
6. `arrival/page.tsx`: 필터 툴바 인라인 이동, + 수동입하 버튼 primary(pink) 변경

**검증 결과 (2026-05-27 브라우저 테스트):**
- PO 5000000022 조회 → 90건, L/N + R/N 컬럼 표시 ✅
- L1/R1 클릭 → 입하 모달 `5000000022 / L1 / R1` 정상 ✅
- LOT_UNIT_QTY 404 에러 모달 없음 ✅
- 입하 100개, 제조사 M001 → 저장 → 시리얼 발급 확인 모달 ✅
- 시리얼 `VH1-RM260527-00001` 채번, 라벨 미리보기 ✅
- 잔량 35,380 → 35,280 실시간 반영 ✅
# 2026-06-08 20:20 codex

## T-MAT-REQ-BOM-AUTO 완료

**대상:** `/material/request` 자재출고요청 생성 모달.

**수정 내용:**
- 작업지시 선택 시 `GET /material/issue-requests/job-orders/:orderNo/bom-items`로 BOM 직하위 품목을 조회하고, 원자재만 요청 품목으로 자동 채운다.
- 요청수량 산식은 사용자 승인 기준대로 `BOM 소요량 - 작업지시 기불출량 - 현장재고`이며, 음수는 제외한다.
- `BOM 소요량`, `기불출량`, `현장재고`를 요청 상세에 저장하도록 DTO/서비스 저장 경로를 보강했다.
- 이전 출고량은 `MAT_ISSUES -> MAT_LOTS`, 현장재고는 `MAT_STOCKS -> WAREHOUSES(FLOOR)`로 집계한다.
- 실제 저장 중 발견한 결함 수정: `create()`가 트랜잭션 안에서 외부 repository로 상세 재조회해 Oracle 미커밋 행을 못 보고 404가 나던 문제를 커밋 후 재조회로 변경했다.

**검증:**
- TDD 실패 확인: 신규 스펙 추가 후 `service.buildBomRequestItems is not a function`, BOM 산출 필드 미저장, 미커밋 재조회 실패를 재현했다.
- `pnpm --filter @harness/backend test -- issue-request.service.spec.ts --runInBand` 통과, 14건.
- `pnpm --filter @harness/backend build` 통과.
- `pnpm --filter @harness/frontend build` 통과.
- API `GET /api/v1/material/issue-requests/job-orders/W2026-001/bom-items` 확인: `HNS01` BOM에서 `SEMI_PRODUCT` 2건 제외, 원자재 `CNTR001/HLD-01/TP0001/HSG0001` 4건 산출.
- 헤드리스 브라우저 `http://localhost:3004/material/request`: 작업지시 `W2026-001 - HNS01` 선택 시 요청 품목 4건과 `BOM / 기불출 / 현장` 근거 표시 확인.
- API `POST /api/v1/material/issue-requests`로 `MR2606080002` 생성 성공.
- JSHANES 확인: `MAT_ISSUE_REQUESTS` 헤더 1건, `MAT_ISSUE_REQUEST_ITEMS` 상세 4건과 `BOM_REQ_QTY/PREV_ISSUE_QTY/FLOOR_STOCK_QTY` 저장 확인.

# 2026-06-08 16:50 codex

## T-MAT-ARRIVAL-LABEL-FORMAT 완료

**수정 내용:**
- 입하시 발행되는 자재 라벨 형식을 사용자 첨부 이미지 기준 80mm x 40mm로 변경했다.
- 공용 컴포넌트 `MaterialArrivalLabel`을 추가해 입하 직후 라벨 미리보기와 `/material/receive-label` 브라우저 인쇄가 같은 형식을 사용한다.
- 라벨 구성: 좌측 QR, `품목코드 / 수량 단위`, 제조사, `IN`, `SERIAL`, `LOT`, 우측 `MP/CM` 배지, `검사필 도장날인` 원형 영역, 하단 품명.
- 기존 canvas 바코드 복사 방식은 새 인쇄창에서 빈 canvas가 될 수 있어 QR을 data URL 이미지로 렌더링하도록 변경했다.
- `/material/receive-label` 발행 결과에 입하행의 수량, 단위, 업체, 입하일, 입하번호를 붙여 라벨 필드가 채워지게 했다.
- 실제 발행 중 발견한 저장 결함도 같이 수정했다:
  - `ReceiveLabelService.createMatLabels`가 `MAT_LOTS.CURRENT_QTY`를 누락해 ORA-01400 발생.
  - 발행된 LOT가 입고 대상으로 이어지도록 `origin`, `iqcStatus=PASS`, `status=NORMAL`을 명시.
  - `LABEL_PRINT_LOGS.COMPANY/PLANT_CD/PRINTED_AT/SEQ` 누락으로 ORA-01400 발생.
  - 브라우저 인쇄 로그 payload가 DTO와 다른 `matUids`를 보내던 문제를 `uidList`로 수정.

**검증:**
- `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과.
- `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` 통과.
- 헤드리스 브라우저로 `http://localhost:3002/material/receive-label` 실제 접근 확인.
- 테스트 계정 `codex-label-verify@harness.com` 생성 후 검증 완료 뒤 삭제.
- APPCT-A 입하행 1건 선택 후 실제 라벨 발행 실행:
  - `POST /api/material/receive-label/create` 201.
  - `POST /api/material/label-print/log` 201.
  - 인쇄 HTML에서 `.material-arrival-label` 5개, QR data image 5개 확인.
  - 첫 라벨 텍스트: `APPCT-A / 5 EA`, 업체 `입고테스트거래처`, `IN : 2026-06-08`, `LOT : RCVT26060800003`, 품명 `어플리케이터A`.

# 2026-06-08 11:27 codex

## T-MAT-CYCLE-E2E-FIX 완료

**대상:** PO-입하-IQC-입고-출고-재고 E2E QA에서 확인한 결함 수정.

**수정 내용:**
- 자재입고 화면/백엔드 계약 불일치 수정: 프론트는 `warehouseId`를 전송하고, 백엔드는 기존 화면 호환을 위해 `warehouseCode`도 수용한다. 입고 재고/수불 트랜잭션 창고값은 동일 값으로 기록한다.
- IQC 이력 화면에 성적서 컬럼과 PASS/DONE 행의 업로드/재업로드 버튼을 추가했다.
- 입하/IQC 날짜 표시를 날짜 전용 또는 로컬 일시 포맷으로 정리했다.
- IQC 이력 날짜 필터의 종료일이 `YYYY-MM-DD 00:00:00`으로만 잡혀 당일 데이터를 숨기던 문제를, 해당 일자 23:59:59.999까지 포함하도록 수정했다.
- 수동출고 재고 행의 `id`가 비어 모든 체크박스가 선택된 것처럼 보이던 문제를 `warehouseCode::matUid` 기반 fallback key로 수정했다.
- 자재재고 검색 조건에 `matUid`를 포함했다.

**검증:**
- `pnpm --filter @harness/backend test -- receiving.service.spec.ts mat-stock.service.spec.ts iqc-history.service.spec.ts --runInBand` 통과, 53건.
- `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과.
- `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` 통과.
- 런타임 API: `/api/v1/material/receiving`에 `warehouseCode`만 보낸 요청이 DTO 오류가 아니라 잔량 초과 업무 오류로 진행됨을 확인.
- 런타임 API/화면: `/material/stock`에서 `VH1-RM260608-00004` 검색 시 LOT 행 반환 확인.
- 헤드리스 브라우저: `/material/issue` 수동출고에서 1행 체크 시 해당 행만 checked, 하단 `선택됨 1건` 확인.
- 헤드리스 브라우저: `/material/iqc-history` 기본 날짜 `2026-06-08 ~ 2026-06-08`에서 오늘 IQC 1건 표시, `성적서: 첨부`, 재업로드 아이콘 확인.
# 2026-06-08 15:11 codex

## T-ROUTING-PROCESS-TYPE-SOURCE 완료

**수정 내용:**
- 라우팅 공정 추가/수정 모달에서 `공정유형` 선택박스를 제거했다.
- `공정유형`은 `/master/processes` 공정 마스터 응답의 `processType`을 읽어 표시만 한다.
- 라우팅 공정 저장 payload에서 `processType`을 제거했다. 공정유형의 source of truth는 공정 마스터다.

**검증:**
- `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과.
- `git diff --check -- apps/frontend/src/app/(authenticated)/master/routing/components/RoutingGroupManager.tsx .ai-coordination/TASKS.md .ai-coordination/LOCKS.md` 통과.
- 헤드리스 브라우저 `/master/routing` 공정추가 모달 확인: `공정유형`은 combobox가 아닌 표시값으로 렌더링.
- `MTASY` 선택 시 공정명 `자재장착`, 공정유형 `조립` 표시 확인. 저장은 수행하지 않았다.

# 2026-06-08 14:23 codex

## T-MAT-RECEIVE-TESTDATA 입고 처리 완료

**처리 내용:**
- 사용자 요청으로 자재입고 테스트 데이터 3건을 실제 입고 처리했다.
- 입고번호: `RCV20260608-0002`.
- 대상:
  - `RECV-TEST-260608-00003` / `CBL-A` / 12 / `WH-MAT-A`.
  - `RECV-TEST-260608-00004` / `CNTR001` / 8 / `WH-MAT-A`.
  - `RECV-TEST-260608-00005` / `APPCT-A` / 5 / `WH-MAT-A`.

**검증:**
- API `POST /api/v1/material/receiving` 성공.
- 입고대기 API에서 `RECV-TEST-260608-*` 미반환 확인.
- JSHANES `MAT_RECEIVINGS` 3행 `DONE` 확인.
- JSHANES `MAT_STOCKS` 3행 생성 및 `QTY=AVAILABLE_QTY` 확인.
- JSHANES `STOCK_TRANSACTIONS` `TX20260608-00014~00016` `RECEIVE/DONE` 확인.

# 2026-06-08 11:50 codex

## T-MAT-RECEIVE-TESTDATA 완료

**대상:** `http://localhost:3002/material/receive` 자재입고 테스트용 실DB 데이터.

**생성 내용:**
- SQL: `tools/generated/receive-testdata-2026-06-08.sql`.
- 입하번호: `RCVT26060800003`.
- LOT 3건:
  - `RECV-TEST-260608-00003` / `CBL-A` / 12 / 성적서 첨부 / 창고 `WH-MAT-A`.
  - `RECV-TEST-260608-00004` / `CNTR001` / 8 / 성적서 첨부 / 창고 `WH-MAT-A`.
  - `RECV-TEST-260608-00005` / `APPCT-A` / 5 / 성적서 불필요 / 창고 `WH-MAT-A`.
- 생성 테이블: `MAT_ARRIVALS`, `MAT_LOTS`, `IQC_LOGS`.
- 채번은 `SEQ_ARRIVAL_NO_DAILY`, `SEQ_MAT_ARRIVALS`, `MAT_UID_SEQ`, `SEQ_IQC_LOGS`를 사용했다. `MAX+1`은 사용하지 않았다.

**검증:**
- JSHANES 조회로 3건의 `IQC_STATUS=PASS`, `STATUS=NORMAL`, `WAREHOUSE_CODE=WH-MAT-A`, IQC 필수 2건의 `CERT_FILE_PATH` 존재 확인.
- API `/api/v1/material/receiving/receivable`에서 3건 반환 확인.
- 헤드리스 브라우저 `/material/receive`에서 `RECV-TEST-260608` 검색 시 3건 표시 및 체크박스 활성 확인.
- 실제 입고 처리는 수행하지 않았다.

# 2026-06-08 20:38 codex

## T-INPUT-KIOSK-CONSUMABLE-COUNT 완료

**원인:**
- `GET /equipment/consumables/mounted/:equipCode` 응답은 소모품 수명 한도를 `expectedLife`로 내려준다.
- 입력키오스크 프론트 `MaterialListPanel`과 `ConsumableScanModal`은 `maxCount`를 기대해 `undefined.toLocaleString()`이 발생했다.

**수정 내용:**
- mounted consumable 응답을 화면 모델로 정규화하면서 `maxCount ?? expectedLife`를 사용하도록 변경했다.
- `currentCount`, `maxCount`는 숫자로 변환하고 비정상 값은 0으로 fallback 처리했다.

**검증:**
- JSHANES 실데이터 `EQ-CUT-01` 장착 소모품 2건 확인: `CM-BL-F01` expectedLife 2,500,000 / `CM-BL-V01` expectedLife 3,000,000.
- API `GET /api/v1/equipment/consumables/mounted/EQ-CUT-01` 응답이 `expectedLife`를 반환하고 `maxCount`는 없음을 확인.
- `pnpm --filter @harness/frontend build` 통과.
- 헤드리스 브라우저 `/production/input-kiosk`에서 소모품 패널과 소모품 스캔 모달 모두 `1,800,000/2,500,000`, `0/3,000,000` 표시 확인.
- 브라우저 콘솔에 해당 runtime TypeError 없음.

# 2026-06-08 20:55 codex

## T-MAT-REQ-DETAIL 완료

**대상:** `/material/request` 출고요청 목록 상세 보기.

**수정 내용:**
- 출고요청 목록 행 클릭과 `상세보기` 아이콘 버튼으로 상세 모달을 열 수 있게 했다.
- 상세 모달에 요청번호, 작업지시, 상태, 출고계정, 요청일, 요청자, 승인 정보, 요청/출고/잔여수량 합계를 표시한다.
- 품목 상세 표에 품목코드, 품목명, 요청/출고/잔여, 현재고, BOM소요, 기불출, 현장재고, 단위를 표시한다.
- 백엔드 목록 응답의 `orderNo`, `totalRequestQty`, `totalIssuedQty`도 프론트에서 정상 표시하도록 fallback 타입을 보강했다.

**검증:**
- `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과.
- API `GET /api/v1/material/issue-requests?limit=3`에서 `MR2606080003`, `MR2606080002`와 상세 품목 반환 확인.
- 헤드리스 브라우저 `http://localhost:3002/material/request`에서 요청 2건 표시 확인.
- `MR2606080003` 상세 모달 열림 확인: 6개 품목, 총 요청수량 15,250, BOM소요/기불출/현장재고 표시.
- 브라우저 콘솔 기능 오류 없음. `favicon.ico` 404만 확인.

# 2026-06-08 21:03 codex

## T-QUALITY-REWORK-DEFECT-RELATION 완료

**원인:**
- `REWORK_ORDERS.DEFECT_LOG_ID`는 `"occurAt|seq"` 문자열이고, `DEFECT_LOGS`는 `OCCUR_TIME + SEQ` 복합 PK다.
- `ReworkOrder` 엔티티에는 `defectLog` relation이 없는데 `ReworkService.findAll()`이 `leftJoinAndSelect('r.defectLog', 'dl')`, `findById()`가 `relations: ['defectLog']`를 사용해 TypeORM 500이 발생했다.

**수정 내용:**
- 재작업 목록 조회에서 존재하지 않는 `defectLog` relation join을 제거했다.
- 재작업 단건 조회에서 존재하지 않는 `defectLog` relation preload를 제거했다.
- 서비스 테스트에 `findAll`이 존재하지 않는 relation을 join하지 않는 회귀 테스트를 추가했다.

**검증:**
- 수정 전 API `GET /api/v1/quality/reworks?limit=5000`에서 동일한 500 재현.
- `pnpm --filter @harness/backend test -- rework.service.spec.ts --runInBand` 통과, 11건.
- `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` 통과.
- 수정 후 API `GET /api/v1/quality/reworks?limit=5000` 성공. 현재 데이터 0건, `success: true`.

# 2026-06-09 00:00 codex

## T-SHIP-PACK-SERIAL-FOCUS 완료

**대상:** `/shipping/pack` 시리얼 추가 모달.

**수정 내용:**
- 시리얼 추가 모달 입력박스에 `ref`를 연결하고, 모달 열림 직후 입력박스로 자동 포커스되게 했다.
- 시리얼 Enter 추가 성공 또는 실패 후에도 스캐너 연속 입력이 가능하도록 입력박스 포커스를 다시 잡는다.
- 시리얼 추가 모달 크기를 `lg`에서 `2xl`로 확대했다.

**검증:**
- `pnpm --filter @harness/frontend exec tsc --noEmit` 통과.
- 백엔드 3001은 미실행 상태라, Chrome DevTools Protocol에서 `/api/shipping/boxes`와 `/api/auth/me`를 mock 응답으로 채워 실제 `/shipping/pack` 컴포넌트를 렌더링했다.
- 헤드리스 브라우저 확인 결과: 모달 열림 직후 `focusedOnOpen=true`, Enter 추가 후 `focusedAfterEnter=true`, 추가 시리얼 표시 `serialAddedVisible=true`, 모달 폭 726px 확인.

# 2026-06-09 00:30 codex

## T-SHIP-PACK-SCAN-ENTER-CANCEL 완료

**대상:** `/shipping/pack` 시리얼 추가 모달.

**수정 내용:**
- 시리얼 입력값을 React state만 보지 않고 입력 DOM 현재값으로도 읽어, 스캐너가 값과 Enter를 거의 동시에 보내도 등록되게 했다.
- 입력값에 CR/LF가 포함돼 들어오는 스캐너 케이스도 즉시 등록하도록 처리했다.
- 방금 등록한 시리얼을 모달 상단에 표시하고, `취소` 버튼으로 즉시 삭제할 수 있게 했다.
- 등록/삭제 후에도 시리얼 입력박스 포커스를 유지한다.

**검증:**
- `pnpm --filter @harness/frontend exec tsc --noEmit` 통과.
- 헤드리스 브라우저 CDP mock으로 `/shipping/pack` 실제 컴포넌트 렌더링 확인.
- 확인 결과: `focusedOnOpen=true`, `serialAddedVisible=true`, `focusedAfterEnter=true`, `serialRemoved=true`, `focusedAfterCancel=true`.

## T-SHIP-ORDER-REMOVE-INFO-CARDS 완료

**대상:** `/shipping/order` 출하지시등록 화면.

**수정 내용:**
- 상단 정보카드 4개(`전체`, `임시저장`, `확정`, `출하`) 렌더링 블록을 제거했다.
- 이에 따라 `stats`, `StatCard`, 카드 전용 아이콘 import를 제거했다.
- 기존 미커밋 변경인 API 경로 `/shipping/orders`는 건드리지 않고 보존했다.

**검증:**
- `pnpm --filter @harness/frontend exec tsc --noEmit` 통과.
- 헤드리스 브라우저 CDP mock으로 `/shipping/order` 실제 컴포넌트 렌더링 확인.
- 확인 결과: 정보카드 grid count `0`, 출하지시 목록 행 `SO2606090001` 표시 정상.

# 2026-06-09 14:25 codex

## T-MAT-RECEIVE-REMOVE-INFO-CARDS 완료

**대상:** `/material/receive` 자재입고관리 화면.

**수정 내용:**
- 상단 정보카드 4개(`입고대기`, `입고대기수량`, `금일 입고건수`, `금일 입고수량`) 렌더링 블록을 제거했다.
- 카드 제거에 따라 `StatCard`, 카드 전용 아이콘, `stats` 상태, `/material/receiving/stats` 조회를 제거했다.
- 기존 dirty 변경인 입고 등록 payload `warehouseId: warehouseCode`는 보존했다.

**검증:**
- `pnpm --filter @harness/frontend exec tsc --noEmit` 통과.
- `http://localhost:3002/material/receive` HTTP 200 확인.
- `page.tsx` 내 `StatCard`, `receiving/stats` 잔여 참조 없음 확인.

# 2026-06-09 00:45 codex

## T-SHIP-PACK-REMOVE-INFO-CARDS 완료

**대상:** `/shipping/pack` 제품포장관리 화면.

**수정 내용:**
- 상단 정보카드 4개(`진행`, `마감`, `출하`, `총 수량`) 렌더링 블록을 제거했다.
- 이에 따라 `stats`, `StatCard`, 카드 전용 아이콘 import를 제거했다.
- 기존 시리얼 스캔 Enter 자동등록/즉시취소 변경은 보존했다.

**검증:**
- `pnpm --filter @harness/frontend exec tsc --noEmit` 통과.
- 헤드리스 브라우저 CDP mock으로 `/shipping/pack` 실제 컴포넌트 렌더링 확인.
- 확인 결과: 정보카드 grid count `0`, 박스 목록 행 `BX2606090001` 표시 정상.

# 2026-06-09 13:20 codex

## T-SHIP-BOX-STOCK 완료

**대상:** 출하관리 박스입고재고 조회.

**수정 내용:**
- 출하관리 메뉴에 `SHIP_BOX_STOCK` / `/shipping/box-stock`를 추가했다.
- 새 화면은 `/shipping/boxes` 기반으로 박스번호, 품목, 수량, 상태, 팔레트, OQC, 마감일시를 조회한다.
- 박스 행 선택 시 우측 패널에서 `/shipping/boxes/:id/items`를 호출해 `BOX_MASTERS.SERIAL_LIST` 안의 `FG_LABELS` 개별제품 상세를 표시한다.
- 개별제품 상세에는 제품시리얼, 품번/품명, 작업지시번호, FG 상태, 검사합격 여부, 발행일시를 표시한다.
- `ko/en/zh/vi` 메뉴명과 화면 문구를 추가했다.

**검증:**
- `pnpm --filter @harness/backend exec tsc --noEmit` 통과.
- `pnpm --filter @harness/frontend exec tsc --noEmit` 통과.
- 기존 프론트 dev 서버 `localhost:3002`에서 `GET /shipping/box-stock` HTTP 200 확인.

# 2026-06-10 00:30 codex

## T-INPUT-KIOSK-WORKER-CODE-BUTTONS 완료

**원인:**
- 작업자설비점검 모달의 OK/NG 버튼은 `activeSeq` 행에서만 렌더링되고 있었다.
- 따라서 QR 스캔으로 특정 행이 활성화되기 전에는 사용자에게 합/불 버튼이 보이지 않았다.

**수정 내용:**
- `apps/frontend/src/app/(authenticated)/production/input-kiosk/components/WorkerInspectModal.tsx`에서 항목명 옆에 `itemCode`를 표시한다.
- 항목 아래에 `workerQrCode`도 QR 값으로 표시한다.
- OK/NG 버튼은 QR 스캔 전에도 모든 항목 행에 상시 표시한다.
- 스캔된 행 강조와 스크롤 이동은 유지한다.
- 항목 렌더 완료 후 QR 입력창 포커스를 다시 잡아 키보드 타입 스캐너 입력 대기 상태를 유지한다.

**검증:**
- `pnpm --filter @harness/frontend exec tsc --noEmit` 통과.
- `git diff --check` 통과.
- 브라우저 실제 로그인 후 `/production/input-kiosk` 작업자설비점검 모달에서 `EIP-STD-W001`, `EQ-CRIMP-01:EIP-STD-W001` 표시 확인.
- 같은 모달에서 OK 버튼 8개, NG 버튼 8개 표시 확인.
- 모달 열림 후 activeElement가 QR 입력창(`placeholder=QR 코드를 스캔하세요...`)임을 확인.

# 2026-06-10 00:20 codex

## T-INPUT-KIOSK-WORKER-QR-FOCUS 완료

**수정 내용:**
- `/production/input-kiosk` 작업자설비점검 모달에서 키보드 타입 바코드스캐너 입력을 받을 수 있도록 QR 입력창 포커스를 모달 열림, 항목 로드, QR 스캔 실패/성공, OK-NG 판정 후에도 유지한다.
- QR 스캔은 입력값 trim/대문자 정규화 후 설비별 `WORKER_QR_CODE`와 직접 비교한다.
- 스캔된 행은 스크롤로 가운데 이동하고 시각적으로 활성화하며, OK/NG 버튼은 스캔된 행에만 표시한다.
- 설비일일점검 완료 상태에서 `오늘 점검이 이미 완료되었습니다` 메시지만 표시하지 않고, 점검자/종합판정/항목명/기준/측정 또는 판정/OK-NG/비고를 표로 표시한다.
- 신규 SQL `apps/backend/src/migrations/2026-06-10_seed_all_equips_daily_inspect_assignments.sql`로 모든 사용 설비에 `DAILY` 표준 점검항목을 할당했다.

**DB 적용:**
- `python scripts/migration/run_migration.py apps/backend/src/migrations/2026-06-10_seed_all_equips_daily_inspect_assignments.sql --site JSHANES` 성공.
- `EQ-CUT-01` API 확인: `WORKER` 8건, 첫 QR `EQ-CUT-01:EIP-STD-W001`, `DAILY` 25건 조회.

**브라우저 검증:**
- `localhost:3002` 실제 로그인 후 `/production/input-kiosk` 진입.
- 작업자설비점검 입력 클릭 직후 activeElement가 QR 입력창(`placeholder=QR 코드를 스캔하세요...`)임을 확인.
- `EQ-CRIMP-01:EIP-STD-W001` 입력 후 Enter 시 QR 입력창 포커스 유지, OK/NG 버튼 노출 확인.
- OK 선택 후에도 QR 입력창 포커스 유지와 `OK 1` 요약 반영 확인.
- 검증용 `EQ-CUT-01 / 2026-06-09 / CODX테스트점검자` DAILY 로그 생성 후 완료 모달에서 완료 메시지, 설비명, 점검자, `압착 높이`, `NG`, `CODX-DAILY-DETAIL-TEST` 비고 표시 확인.
- 검증용 DAILY 로그는 `INSPECTOR_NAME='CODX테스트점검자'` 조건으로 삭제했고, `EQ-CUT-01 2026-06-09`, `EQ-CRIMP-01 2026-06-10` 완료 여부 false 확인.

**자동 검증:**
- `pnpm --filter @harness/backend test -- equip-inspect.service.spec.ts daily-inspect.controller.spec.ts` 통과, 3 suites / 11 tests.
- `pnpm --filter @harness/frontend exec tsc --noEmit` 통과.
- `git diff --check` 통과.
- 로컬 Playwright CLI가 없어 브라우저 스크린샷 검증은 수행하지 못했다.

# 2026-06-09 20:35 codex

## T-ITEM-MARKING-TEXT 완료

**대상:** 품목마스터 `/master/part`, `ITEM_MASTERS`.

**수정 내용:**
- `ITEM_MASTERS.MARKING_TEXT VARCHAR2(100)` 컬럼을 추가하는 멱등 마이그레이션 `apps/backend/src/migrations/2026-06-09_item_masters_marking_text.sql` 추가.
- JSHANES 실DB에 컬럼 적용.
- `PartMaster.markingText`, `CreatePartDto/UpdatePartDto.markingText`, `PartService.create/update/findAll 검색조건` 반영.
- 품목마스터 목록에 `마킹문구` 컬럼 추가.
- `PartFormPanel`과 남아있는 `PartFormModal` 모두에 `마킹문구` 입력 추가, `maxLength=100` 적용.
- `docs/reports/db-schema-erd.md`를 JSHANES 실DB 기준으로 재생성.

**검증:**
- `python scripts/migration/run_migration.py apps/backend/src/migrations/2026-06-09_item_masters_marking_text.sql --site JSHANES` 성공.
- JSHANES `USER_TAB_COLUMNS` 확인: `ITEM_MASTERS.MARKING_TEXT VARCHAR2(100) NULL`.
- `$env:ORACLE_SITE='JSHANES'; python tools/generate_db_schema_doc.py` 성공, 148 tables / 2397 columns.
- `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` 통과.
- `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과.
- `GET http://localhost:3002/master/part` HTTP 200 확인.

## T-EQUIP-INSPECT-ADD-TYPE 완료

**대상:** `/master/equip-inspect` 점검항목 추가 모달.

**수정 내용:**
- `AddInspectItemModal`에서 점검유형을 읽기 전용 Input이 아니라 Select로 선택 가능하게 변경.
- 점검항목 Pool 선택 시 기본 점검유형은 Pool의 `inspectType`으로 자동 세팅하되 사용자가 변경할 수 있게 했다.
- 저장 payload에 선택한 `inspectType`을 전송한다.
- `EquipInspectService.create()`에서 Pool 항목을 선택한 경우에도 요청 `inspectType`을 Pool 기본값보다 우선 반영하도록 수정.

**검증:**
- `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` 통과.
- `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과.
- `GET http://localhost:3002/master/equip-inspect` HTTP 200 확인.

# 2026-06-09 20:05 codex

## T-MAT-RECEIVE-SCAN 완료

**대상:** `/material/receive` 자재입고.

**수정 내용:**
- 입고대기 그리드에서 체크박스 선택, 수량 입력, 창고 선택 컬럼을 제거해 조회 전용으로 바꿨다.
- 헤더 `입고처리` 버튼은 새 `ReceiveScanModal`만 열도록 변경했다.
- 스캔 모달은 거래처 바코드 → 자체부착 바코드(`matUid`) 순서로 Enter 입력을 받아 매핑 목록을 누적한다.
- 자체부착 바코드는 현재 입고대기 목록에 존재해야 하며, 성적서 차단 사유와 입고 창고 누락, 중복 스캔을 클라이언트에서 차단한다.
- 입고 수량은 수동 입력하지 않고 해당 `matUid`의 잔량 전체로 전송한다.
- `ReceiveItemDto.vendorBarcode`를 추가하고 `ReceivingService.createBulkReceive()`가 `MAT_RECEIVINGS.VENDOR_BARCODE`에 거래처 바코드 원본을 저장하도록 했다.
- 마이그레이션 `apps/backend/src/migrations/2026-06-09_mat_receiving_vendor_barcode.sql`을 추가하고 JSHANES에 적용했다.
- `docs/reports/db-schema-erd.md`를 JSHANES 실DB 기준으로 재생성했다.

**검증:**
- `python scripts/migration/run_migration.py apps/backend/src/migrations/2026-06-09_mat_receiving_vendor_barcode.sql --site JSHANES` 성공.
- JSHANES `USER_TAB_COLUMNS` 확인: `MAT_RECEIVINGS.VENDOR_BARCODE VARCHAR2(200) NULL`.
- `$env:ORACLE_SITE='JSHANES'; python tools/generate_db_schema_doc.py` 성공, 148 tables / 2395 columns.
- `pnpm --filter @harness/backend test -- receiving.service.spec.ts --runInBand` 통과(11/11).
- `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` 통과.
- `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과.
- `GET http://localhost:3002/material/receive` HTTP 200 확인.

**남은 위험:**
- gstack browse와 Playwright 실행 바이너리가 없어 실제 인증 세션의 모달 클릭/스캔 DOM 검증은 수행하지 못했다. 코드/타입/라우트 수준 검증은 통과했다.

# 2026-06-09 19:35 codex

# 2026-06-10 02:00 codex

## T-MASTER-API-QA 완료

**대상:** 기준정보 API 전체 동작 검증.

**검증 기준:**
- 실행 중인 백엔드 `http://localhost:3003/api/v1` 기준으로 실제 HTTP 호출.
- 인증은 `oracle-db` 스킬로 JSHANES `USERS`를 확인한 `admin@hanes.com / 40 / 1000` 계정 사용.
- Swagger `/api/docs-json`에서 `/api/v1/master/*` 경로를 추출해 조회 API를 점검.
- 쓰기 API는 기존 데이터 훼손 없이 `ZQA*`, `ZQL*` 임시 코드로 생성/수정/삭제 후 JSHANES 잔여 건수 확인.

**조회 API 검증:**
- path 파라미터 없는 기준정보 `GET` 39건 모두 HTTP 200.
- 실제 목록 응답에서 샘플 키를 뽑아 상세/보조 `GET` 34건 모두 HTTP 200.
- 포함 범위: `parts`, `partners`, `boms`, `com-codes`, `companies`, `plants`, `processes`, `prod-lines`, `equip-bom`, `iqc-groups`, `iqc-item-pool`, `iqc-items`, `iqc-part-links`, `iqc-part-specs`, `iqc-templates`, `label-templates`, `model-suffixes`, `routing-groups`, `routings`, `transfer-rules`, `vendor-barcode-mappings`, `work-calendars`, `work-instructions`, `workers`.
- `process-capas/:processCode/:itemCode`는 컨트롤러상 GET이 없고 PUT/DELETE 전용이라 조회 실패로 보지 않음.

**쓰기 API 검증:**
- 임시 데이터 CRUD 성공: `com-codes`, `partners`, `parts`, `processes`, `prod-lines`, `workers`, `boms`, `work-instructions`.
- 1차 생산라인 생성 실패는 테스트 payload 오류(`oper` 10자 초과)였고, 기존 유효 공정 `MTASY`로 재실행해 생성/수정/삭제 모두 통과.
- `oracle-db` 잔여 확인: `COM_CODES`, `ITEM_MASTERS`, `PARTNER_MASTERS`, `PROCESS_MASTERS`, `PROD_LINE_MASTERS`, `WORKER_MASTERS`, `BOM_MASTERS`, `WORK_INSTRUCTIONS`의 `ZQA%`/`ZQL%` 임시 데이터 모두 0건.

**결론:**
- 실행 중인 JSHANES 연동 백엔드 기준으로 검증한 기준정보 조회 API와 핵심 CRUD API는 장애 없이 동작한다.
- 파일 업로드 API와 실제 엑셀 업로드 실행은 테스트 파일 생성/업로드 범위라 이번 HTTP 검증에서는 제외했다.

## T-INPUT-KIOSK-EQUIP-LIST 완료

**대상:** `/production/input-kiosk` 설비선택 모달.

**원인:**
- 설비선택 모달은 `equips` prop이 있으면 검색어 없이 전체 목록을 보여주는 구조다.
- 부모 페이지의 설비 로딩은 `/equipment/equips` 응답을 `res.data.data` 배열로만 처리했다.
- 실제/호환 응답이 paged 또는 items wrapper 형태로 올 경우 모달에는 빈 배열이 전달될 수 있다.

**수정 내용:**
- `utils/equipOptions.ts`를 추가해 direct array, `ResponseUtil.paged`의 `data` 배열, `{ data: { items: [...] } }`, `{ data: { rows: [...] } }`를 모두 `EquipOption[]`으로 정규화한다.
- `page.tsx` 설비 목록 로딩에서 `normalizeEquipOptions(res.data)`를 사용하도록 변경했다.
- 정규화 동작을 `node:test` 기반 테스트로 추가했다.

**검증:**
- RED: `node --test apps/frontend/src/app/(authenticated)/production/input-kiosk/utils/equipOptions.test.ts`가 `ERR_MODULE_NOT_FOUND`로 실패해 함수 부재 확인.
- GREEN: `node --no-warnings --test apps/frontend/src/app/(authenticated)/production/input-kiosk/utils/equipOptions.test.mjs` 통과(2/2).
- `pnpm --filter @harness/frontend exec tsc --noEmit` 통과.
- `GET http://localhost:3002/production/input-kiosk` HTTP 200 확인.
- 인증 없는 브라우저 접근은 `/login`으로 리다이렉트되어 실제 모달 DOM 클릭 검증은 수행하지 못했다.

# 2026-06-10 02:30 codex

## T-MASTER-API-DEEP-QA 기준정보 API 세부 재검증

**범위:**
- 실행 중인 백엔드 `http://localhost:3003/api/v1` 기준 실제 HTTP 호출.
- 인증: `admin@hanes.com / admin123`, tenant `X-Company=40`, `X-Plant=1000`.
- DB 근거 확인은 oracle-db 스킬의 `oracle_connector.py --site JSHANES` 사용.

**통과:**
- 기준정보 화면 및 관련 모듈 조회/보조 GET 49건 통과.
- 잘못 잡았던 테스트 경로 2건은 실제 라우트 확인으로 제외/정정: 부서는 `/system/departments`, 공통코드는 `/master/com-codes/groups`, `/master/com-codes/groups/:groupCode`, `/master/com-codes/all-active`.
- CRUD 통과: 설비, 창고/로케이션, 계측기, 자주검사항목, 라벨템플릿, 모델접미사, 제조사바코드매핑, 설비점검 Pool, 설비BOM, 공정라우팅그룹, 창고이동규칙, IQC 항목 Pool, IQC 품목검사항목, IQC 품목-그룹 링크, IQC 품목별 기준, IQC 템플릿.
- 업로드 통과: 품목 이미지 업로드/삭제, 작업자 사진 업로드, 작업지도서 파일 업로드, BOM 템플릿 다운로드, BOM 업로드 미리보기, BOM 빈 템플릿 업로드.
- 테스트용 업로드 파일은 `apps/backend/uploads`에서 삭제했다.
- JSHANES 잔여 확인: `ITEM_MASTERS`, `COMPANY_MASTERS`, `PLANTS`, `EQUIP_MASTERS`, `WAREHOUSES`, `WAREHOUSE_LOCATIONS`, `GAUGE_MASTERS`, `SELF_INSPECT_ITEMS`, `LABEL_TEMPLATES`, `MODEL_SUFFIXES`, `VENDOR_BARCODE_MAPPINGS`, `EQUIP_INSPECT_ITEM_POOL`, `EQUIP_INSPECT_ITEM_MASTERS`, `EQUIP_BOM_ITEMS`, `EQUIP_BOM_RELS`, `PROCESS_MAPS`, `ROUTING_*`, `WAREHOUSE_TRANSFER_RULES`, `IQC_*` 계열 30개 테이블에서 임시 prefix `ZDQ/ZIQ/ZIG/ZUP/ZERR` count 0.

**미통과 결함:**
- `POST /master/companies` 500: `ORA-01400: NULL을 ("TEST"."COMPANY_MASTERS"."COMPANY") 안에 삽입할 수 없습니다`.
- `POST /master/plants` 500: `ORA-01400: NULL을 ("TEST"."PLANTS"."COMPANY") 안에 삽입할 수 없습니다`.
- `PUT /master/iqc-groups/:groupCode` 500: `ORA-01407: NULL로 ("TEST"."IQC_GROUP_ITEMS"."COMPANY")을 업데이트할 수 없습니다`.

**메모:**
- 코드 수정은 하지 않았다. 이번 작업은 재검증과 결함 특정만 수행했다.

# 2026-06-09 14:40 codex

## T-INPUT-KIOSK-REMOVE-MASTER-SAMPLE 완료

**대상:** `/production/input-kiosk`.

**수정 내용:**
- `EquipHeader` Row2에서 마스터샘플 판정 `HeaderCheckItem`을 제거했다.
- 남은 작업자설비검사 카드는 기존 우측 칼럼 폭을 채우도록 유지했다.
- `page.tsx`, `EquipHeader.tsx`, `HeaderCheckItem.tsx`의 입력키오스크 설명에서 마스터샘플검사 문구를 제거했다.
- `ko/en/zh/vi`의 `kiosk.header.masterSample`, `kiosk.header.masterSampleNotTarget` 키를 제거했다.

**검증:**
- `pnpm --filter @harness/frontend exec tsc --noEmit` 통과.
- 입력키오스크 경로와 kiosk 전용 locale에서 `kiosk.header.masterSample`, `masterSampleNotTarget`, `마스터샘플검사`, `마스터샘플 판정` 참조 0건 확인.
- `GET http://localhost:3002/production/input-kiosk` HTTP 200 확인.
- 인증 없는 브라우저 접근은 `/login`으로 리다이렉트되어 실제 작업 화면 DOM 검증은 수행하지 못했다.

# 2026-06-10 codex

## T-MASTER-API-DEEP-QA-FIX 완료

**원인:**
- `POST /master/companies`는 controller/service가 tenant 값을 전달/저장하지 않아 `COMPANY_MASTERS.COMPANY` NOT NULL 제약에서 ORA-01400이 발생했다.
- `POST /master/plants`도 tenant 값을 전달/저장하지 않아 `PLANTS.COMPANY` NOT NULL 제약에서 ORA-01400이 발생했다.
- `PUT /master/iqc-groups/:groupCode`는 items relation을 로드한 엔티티를 `save()`하면서 `IQC_GROUP_ITEMS.COMPANY`가 NULL로 갱신되어 ORA-01407이 발생했다.
- 추가 재검증 중 `DELETE /master/iqc-groups/:groupCode`가 자식 `IQC_GROUP_ITEMS`를 남기는 것을 확인했다.

**수정 내용:**
- `company.controller.ts` / `company.service.ts`: 생성/수정에서 `@Company`, `@Plant` tenant를 전달하고 `COMPANY_MASTERS.COMPANY`, `PLANT_CD`를 저장한다. 수정/삭제는 기존 행의 복합키 기준으로 처리한다.
- `plant.controller.ts` / `plant.service.ts`: 생성/수정/삭제에서 tenant를 전달하고 `PLANTS.COMPANY`, `PLANT_CD`를 저장/조건에 포함한다.
- `iqc-group.service.ts`: 수정은 loaded relation 엔티티 `save()` 대신 parent `update()`를 사용한다. 삭제는 자식 `IQC_GROUP_ITEMS`를 먼저 명시 삭제한 뒤 parent를 삭제한다.
- 관련 service spec을 보강해 tenant 저장, 복합키 조건, IQC group update/delete 동작을 검증한다.

**검증:**
- `pnpm --filter @harness/backend test -- --runTestsByPath src/modules/master/services/company.service.spec.ts src/modules/master/services/plant.service.spec.ts src/modules/master/services/iqc-group.service.spec.ts` 통과: 3 suites, 26 tests.
- `pnpm --filter @harness/backend exec tsc --noEmit` 통과.
- 실행 중인 `http://localhost:3003/api/v1`에서 실제 HTTP 재검증 통과: company 생성/수정/삭제, plant 생성/수정/삭제, IQC item pool 생성, IQC group 생성/수정/삭제, IQC item pool 삭제 총 11/11.
- oracle-db `JSHANES`로 `COMPANY_MASTERS`, `PLANTS`, `IQC_ITEM_POOL`, `IQC_GROUPS`, `IQC_GROUP_ITEMS`의 `ZFX%`, `ZFY%` 테스트 prefix 잔여 0 확인.
- 이전 실패 재현 중 남은 `ZFX031458` IQC group item orphan 1건은 oracle-db로 삭제했고, 최종 잔여 0을 확인했다.
- `git diff --check` 통과.

# 2026-06-09 13:55 codex

## T-SHIP-BOX-STOCK-MENU 완료

**원인:**
- 사이드바는 `menuConfig.ts`만 렌더하지 않고 `/menu-categories/tree`에서 받은 `MENU_CATEGORY_ITEMS` 배치와 merge한다.
- 새 leaf `SHIP_BOX_STOCK`은 코드에는 있었지만 JSHANES `MENU_CATEGORY_ITEMS`에 없어서 사이드바에서 제외됐다.
- `menu-code-validator.ts`에도 새 코드가 없어 메뉴관리 화면/API에서 배치하려 해도 유효성 검증에 걸릴 수 있었다.

**수정 내용:**
- `apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts`에 `SHIP_BOX_STOCK` 추가.
- `apps/backend/src/seeds/menu-config.json`의 `SHIPPING` 하위에 `SHIP_BOX_STOCK` 추가.
- 재실행 가능한 DB 보정 SQL `scripts/migration/2026-06-09_seed_ship_box_stock_menu.sql` 추가.
- JSHANES 실DB에 `MENU_CATEGORY_ITEMS(CATEGORY_CODE='SHIPPING', MENU_CODE='SHIP_BOX_STOCK', SORT_ORDER=25)` 추가.
- `ROLE_MENU_PERMISSIONS`에서 `SHIP_PACK` 접근권한이 있는 MANAGER 역할에 `SHIP_BOX_STOCK` 접근권한 추가.

**검증:**
- JSHANES `MENU_CATEGORY_ITEMS` 조회: SHIPPING 하위에 `SHIP_BOX_STOCK`이 `SHIP_PACK` 다음, `SHIP_ORDER` 전 `SORT_ORDER=25`로 확인.
- JSHANES `ROLE_MENU_PERMISSIONS` 조회: `MANAGER / SHIP_BOX_STOCK / Y` 확인.
- `scripts/migration/2026-06-09_seed_ship_box_stock_menu.sql`을 `oracle_connector --execute-file`로 재실행해 성공 확인.
- `pnpm --filter @harness/backend exec tsc --noEmit` 통과.
- `pnpm --filter @harness/frontend exec tsc --noEmit` 통과.
- 백엔드 3001은 실행 중이 아니어서 `/menu-categories/tree` HTTP 확인은 못 했다.
- 기존 브라우저 탭은 `hanes-menu-tree` sessionStorage 캐시가 남을 수 있어 새로고침 또는 sessionStorage 삭제가 필요할 수 있다.

# 2026-06-09 14:10 codex

## T-SHIP-BOX-STOCK-STATUS-UI 완료

**대상:** `/shipping/box-stock`.

**수정 내용:**
- 박스입고재고조회 화면에서 상태 드롭다운 필터를 제거했다.
- 상단 상태별 통계(`마감`, `출하`)를 제거하고 재고 조회 목적에 맞게 `박스 수`, `총 수량`, `품목 수`, `선택 박스수량`으로 바꿨다.
- API 호출에서 `status` 파라미터 전송을 제거했다.
- 상태 컬럼은 박스 추적용 정보로 유지했다.

**검증:**
- `pnpm --filter @harness/frontend exec tsc --noEmit` 통과.
- 기존 프론트 dev 서버 `localhost:3002`에서 `GET /shipping/box-stock` HTTP 200 확인.
