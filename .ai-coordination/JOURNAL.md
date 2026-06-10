# JOURNAL

## 2026-06-10

### 완료: T-SHIP-ORDER-ITEM-PAYLOAD 출하지시 생성 품목 payload 누락 수정
- 오류: `/shipping/order` 등록에서 `POST /shipping/orders` 본문이 `shipOrderNo/customerId/dueDate/shipDate/remark`만 보내고 `items`를 누락해 백엔드 `CreateShipOrderDto`에서 `items must be an array` 400 발생.
- 원인: 백엔드 생성 계약은 품목 1개 이상인데, 프론트 출하지시 모달에는 품목 검색/수량 입력 UI가 없어 header form만 저장했다.
- 수정: `page.tsx`에 완제품 `PartSearchModal`, 품목 목록, 지시수량/비고 입력, 삭제 버튼, 총 품목/수량 요약을 추가했다.
- 수정: 저장 payload를 `form` 그대로 보내지 않고 `items: [{ itemCode, orderQty, remark }]`를 포함하도록 변경했고, 품목이 없거나 수량이 1 미만이면 등록/수정 버튼을 비활성화했다.
- 테스트: `apps/frontend/src/app/(authenticated)/shipping/order/ship-order-payload.structure.test.mjs` 추가. payload에 `items`가 포함되고 기존 `api.post("/shipping/orders", form)` 회귀가 없음을 확인한다.
- 검증: `node apps/frontend/src/app/(authenticated)/shipping/order/ship-order-payload.structure.test.mjs` 통과.
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit` 통과.
- 검증: `git diff --check -- apps/frontend/src/app/(authenticated)/shipping/order/page.tsx apps/frontend/src/app/(authenticated)/shipping/order/ship-order-payload.structure.test.mjs .ai-coordination/TASKS.md .ai-coordination/LOCKS.md` 통과.
- 실측: JSHANES `USERS`에서 `admin@hanes.com` 활성 ADMIN 확인 후 HTTP `GET /api/auth/me` 성공.
- 실측: HTTP `POST /api/shipping/orders`를 `items=[{ itemCode: HNS01, orderQty: 1 }]` payload로 호출해 임시 `SO-CODEX-260610-173104` 생성 성공(`createdItemCount=1`) 후 DELETE 성공.
- 실측: JSHANES `SHIPMENT_ORDERS`/`SHIPMENT_ORDER_ITEMS`에서 임시 출하지시 잔여 0건 확인.
- 브라우저: localStorage 인증 상태 주입 후 `http://localhost:3002/shipping/order` 렌더링 확인. 등록 모달에서 `출하지시 품목`, `품목을 추가해 주세요.` 표시와 품목 없는 상태의 저장 버튼 비활성화 확인.

### 완료: T-PROD-ISSUE-STOCK-ENDPOINT 제품출고 재고조회 404 수정
- 오류: `GET /api/v1/inventory/product/stock?itemType=SEMI_PRODUCT&includeZero=false`가 404를 반환.
- 원인: `/product/issue` 출고등록 패널 `IssueFormPanel`이 단수 `/inventory/product/stock`을 호출했지만, 백엔드 `InventoryController`는 복수 `@Get('product/stocks')`만 제공한다.
- RED 확인: `issue-endpoint.structure.test.mjs`를 먼저 추가했고 기존 단수 endpoint 때문에 실패함을 확인했다.
- 수정: `IssueFormPanel`의 가용재고 조회 endpoint를 `/inventory/product/stocks`로 변경했다.
- 검증: `node apps/frontend/src/app/(authenticated)/product/issue/components/issue-endpoint.structure.test.mjs` 1/1 통과.
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit` 통과.
- 검증: 실행 중 백엔드에서 복수 route `/api/v1/inventory/product/stocks?...`는 인증 단계까지 도달해 401, 단수 route는 404임을 확인했다.
- 검증: `http://localhost:3002/product/issue` 200, 관련 파일 `git diff --check` 통과.

### 완료: T-INSP-TERMINAL-RESULT 단자검사 결과등록 페이지 추가
- 요청: `/inspection/result`와 동일한 패턴/워크플로우로 단자검사 페이지를 만들고 좌측 메뉴에 추가, 검사유형을 단자검사로 지정.
- RED 확인: `continuity-inspect.service.spec.ts`에 `inspectType: 'TERMINAL'` 저장 테스트를 먼저 추가해 기존 코드가 `CONTINUITY`로 저장하는 실패를 확인했다. 프론트 구조 테스트도 메뉴/라우트/패널 payload 미구현 상태에서 실패를 확인했다.
- 수정: `/inspection/result`의 2패널 작업지시 선택/검사등록 UI를 `InspectionResultWorkflow`로 공통화하고 기존 통전검사는 `inspectType="CONTINUITY"`, 신규 `/inspection/terminal-result`는 `inspectType="TERMINAL"`로 연결했다.
- 수정: `InspectPanel`은 통계/라벨 조회와 PASS/FAIL 등록 payload에 `inspectType`을 전달한다.
- 수정: 백엔드 `ContinuityInspectDto`는 `CONTINUITY|TERMINAL`을 허용하고, `ContinuityInspectService.inspect()`는 요청 검사유형을 `INSPECT_RESULTS.INSPECT_TYPE`에 저장한다.
- 수정: `stats/:orderNo`, `fg-labels/:orderNo`는 `inspectType` query를 받아 통전/단자 결과를 분리 조회한다.
- 메뉴: 프론트 `INSP_TERMINAL_RESULT` leaf와 4개 locale 메뉴/본문 키 추가. 백엔드 menu seed와 validator에도 `INSP_TERMINAL_RESULT` 등록.
- DB seed: `apps/backend/src/migrations/2026-06-10_terminal_inspection_menu_seed.sql` 추가. JSHANES `MENU_CATEGORY_ITEMS`에 `INSPECTION/SORT_ORDER=15`, `ROLE_MENU_PERMISSIONS`에 `MANAGER`/`OPERATOR` 권한을 적용했다.
- 검증: `pnpm --filter @harness/backend test -- continuity-inspect.service.spec.ts --runInBand` 13/13 통과.
- 검증: `node apps/frontend/src/app/(authenticated)/inspection/terminal-result/page.structure.test.mjs` 3/3 통과.
- 검증: `pnpm --filter @harness/backend exec tsc --noEmit`, `pnpm --filter @harness/frontend exec tsc --noEmit` 통과.
- 검증: locale/menu JSON parse `json ok`, scoped `git diff --check` 통과.
- 검증: `http://localhost:3002/inspection/terminal-result` 200, 기존 `http://localhost:3002/inspection/result` 200.
- 검증: `oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-06-10_terminal_inspection_menu_seed.sql` 재실행 성공.
- 검증: JSHANES 조회 결과 `MENU_CATEGORY_ITEMS` 1건(`INSP_TERMINAL_RESULT`, `INSPECTION`, sort 15)과 `ROLE_MENU_PERMISSIONS` 2건(`MANAGER`, `OPERATOR`) 확인.

### 완료: T-PROD-RESULT-WORKER-AVATAR-FIX 생산실적 작업자 아바타 런타임 오류 수정
- 오류: `/production/result` DataGrid 렌더 중 `WorkerAvatar`가 `name.charAt(0)`을 호출했지만 `row.original.workerName`이 `undefined`라 TypeError 발생.
- 원인: 백엔드 `prod-results` 목록은 `relations: ['worker']`를 포함하지만 프론트 화면은 평탄화된 `workerName/workerDept` 필드만 가정했다. 작업자 relation이 없거나 평탄화되지 않은 행은 `workerName`이 비어 있다.
- RED 확인: `workerAvatar.test.mjs`를 먼저 추가했고, `workerAvatar.ts`가 없어 실패함을 확인했다.
- 수정: `workerAvatar.ts`에 `getWorkerDisplayName`/`getWorkerInitial` fallback을 추가하고, `WorkerAvatar`가 `name?: string | null`, `dept?: string | null`을 안전하게 처리하도록 변경했다.
- 수정: `/production/result` fetch 후 `worker.workerName` 또는 `workerId`를 `workerName` fallback으로 평탄화하고, 셀 렌더링도 같은 fallback을 사용한다.
- 검증: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON apps/frontend/src/components/worker/workerAvatar.test.mjs` 통과(2/2).
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit`, 관련 파일 `git diff --check` 통과.
- 검증: `http://localhost:3002/production/result` HTTP 200 확인.

### 완료: T-PROD-PROGRESS-EQUIP-FILTER 작업지시현황 설비 필터 추가
- 요청: `http://localhost:3002/production/progress` 설비필터 조건 추가.
- RED 확인: `job-order.service.spec.ts`에 `equipCode` 조건 테스트를 먼저 추가했고, 기존 코드는 `pr.EQUIP_CODE = :equipCode` 조건이 없어 실패함을 확인했다.
- 수정: `JobOrderQueryDto.equipCode`를 추가하고, `JobOrderService.findAll()`에서 `PROD_RESULTS`의 `ORDER_NO/EQUIP_CODE/COMPANY/PLANT_CD` 존재 조건으로 작업지시를 필터링한다.
- 수정: `/production/progress` 툴바에 `EquipSelect`를 추가하고 선택값을 `/production/job-orders?equipCode=`로 전달한다.
- 검증: `pnpm --filter @harness/backend exec jest src/modules/production/services/job-order.service.spec.ts --runInBand` 통과(36/36).
- 검증: `pnpm --filter @harness/backend exec tsc --noEmit`, `pnpm --filter @harness/frontend exec tsc --noEmit`, 관련 파일 `git diff --check` 통과.
- 검증: `http://localhost:3002/production/progress` HTTP 200 확인. gstack browse 실행 파일은 현재 경로에 없어 브라우저 스냅샷은 미수행.

### 완료: T-PROD-ORDER-REMOVE-INFO-CARDS 작업지시 정보카드 제거
- 요청: `http://localhost:3002/production/order` 정보카드 제거.
- 수정: `/production/order` 상단 `StatCard` 4개 grid를 제거하고, 더 이상 쓰지 않는 `stats` 계산과 `StatCard` import를 정리했다.
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit`, 관련 파일 `git diff --check` 통과.
- 검증: `http://localhost:3002/production/order` HTTP 200 확인. gstack browse 실행 파일은 현재 경로에 없어 브라우저 스냅샷은 미수행.

### 차단: T-PROD-MONTHLY-ERP-LABEL 좌측 메뉴 월간생산계획 라벨 변경
- 확인: 좌측 메뉴의 `PROD_MONTHLY_PLAN`은 `apps/frontend/src/config/menuConfig.ts`에서 `menu.production.monthlyPlan` 키를 사용하고, 한글 표시값은 `apps/frontend/src/locales/ko.json`의 `"production.monthlyPlan": "월간생산계획"`이다.
- 차단 사유: 현재 `LOCKS.md`의 `T-MAT-CONCESSION-RECV`가 `apps/frontend/src/locales/*`와 `apps/frontend/src/config/menuConfig.ts`를 active lock으로 보유 중이다.
- 조치: 충돌 프로토콜에 따라 코드 수정 없이 `TASKS.md`에 `BLOCKED`로 기록하고 사용자 확인 대기.

### 완료: T-MAT-HOLD-MATUID-FIX 자재 홀드 요청 matUid 누락 수정
- 원인: `/material/hold` 화면의 보류/해제 모달은 `selectedLot.matUid`를 표시하지만 POST 본문은 `selectedLot.id`를 사용했다. `GET /material/hold` 응답 행에 `id`가 없으면 JSON 직렬화에서 `matUid: undefined`가 빠져 서버에는 `{ reason }`만 도착한다.
- 수정: `apps/frontend/src/app/(authenticated)/material/hold/page.tsx`에서 `HoldLot.id` 의존을 제거하고, 보류/해제 요청 본문을 `{ matUid: selectedLot.matUid, reason }`으로 변경했다.
- 유사 확인: `/inventory/product-hold`는 백엔드 계약이 `stockId`이고 화면도 `selectedStock.id`를 전송하므로 이번 `matUid` 누락 패턴과 다르다.
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit` 통과.
- 검증: `git diff --check -- apps/frontend/src/app/(authenticated)/material/hold/page.tsx .ai-coordination/TASKS.md .ai-coordination/LOCKS.md` 통과.

### 완료: T-ID-PAYLOAD-SCAN id payload 누락 유형 점검 및 수정
- 원인: 여러 화면이 선택 row의 `.id`를 API path/body에 사용하지만, 일부 목록 API는 실제 DB 자연키(`poNo`, `orderNo`, `equipCode`, `vendorCode`, `requestNo`, `transNo`, `palletNo`) 또는 복합키만 반환하고 화면용 `id`를 만들지 않았다. 이 경우 `undefined` path/body가 생성되어 `/material/hold`의 `matUid` 누락과 같은 유형의 실패가 발생할 수 있다.
- 수정: 목록/상세 응답 계약을 안정화했다. `/inventory/product-hold`는 `warehouseCode::itemCode::prdUid`, 고객PO는 `id=orderNo`, 설비는 `id=equipCode`, 구매PO는 `id=poNo`, 외주처는 `id=vendorCode`, 인터페이스 로그는 `id=transDateIso/seq`, OQC는 `id=requestNo`, 자재/제품 수불은 `id=transNo`, 팔레트는 `id=palletNo`를 함께 반환하도록 보강했다.
- 프론트 보강: `/inventory/product-hold` 보류/해제는 선택 row에 `id`가 없으면 요청하지 않도록 방어 조건을 추가했다.
- 함께 확인한 안전 경로: 작업자 선택은 selector가 `id=workerCode`로 정규화하고, 자재/제품 실사 목록은 이미 합성 `stockId`/`id`를 내려준다.
- 검증: `pnpm --filter @harness/backend exec jest src/modules/inventory/services/product-hold.service.spec.ts src/modules/shipping/services/customer-order.service.spec.ts src/modules/equipment/services/equip-master.service.spec.ts src/modules/material/services/purchase-order.service.spec.ts src/modules/outsourcing/services/outsourcing.service.spec.ts src/modules/interface/services/interface.service.spec.ts src/modules/quality/oqc/services/oqc.service.spec.ts src/modules/inventory/services/inventory-query.service.spec.ts src/modules/inventory/services/product-inventory.service.spec.ts src/modules/shipping/services/pallet.service.spec.ts --runInBand` 통과(10 suites, 156 tests).
- 검증: `pnpm --filter @harness/backend exec tsc --noEmit` 통과.
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit` 통과.
- 검증: 관련 파일 `git diff --check` 통과.

### 완료: T-SHIP-WORKFLOW-API-QA 출하 workflow API 점검
- 범위: `shipping/pack` 박스 포장, `/inventory/fg/receive` 제품 박스 입고, `/shipping/box-stock` 박스입고재고, `/shipping/orders/:id/ship-box` 출하지시 기반 단건 출하, `/shipping/shipments/:id/mark-shipped` 팔레트 출하.
- 확인 결과: 현재 코드 기준 박스 입고는 `PRODUCT_STOCKS.PRD_UID='*'` 집계 재고와 `FG_LABELS.BOX_NO` 스탬프로 재고를 표현한다. 단건 출하와 팔레트 출하는 같은 집계 재고 단위로 차감하고, FG 라벨 상태를 `SHIPPED`로 바꿔 `/shipping/box-stock` 조회에서 빠지는 계약이다.
- 보강: `ship-order.service.spec.ts` 정상 출하 테스트가 FG 라벨 `SHIPPED` 전환까지 검증하도록 보강했다. `box.service.spec.ts`는 `NumberingService` provider 누락으로 실패하던 테스트 구성을 보정했다.
- 검증: `pnpm --filter @harness/backend exec tsc --noEmit` 통과.
- 검증: `pnpm --filter @harness/backend exec jest src/modules/shipping/services/box.service.spec.ts src/modules/inventory/services/product-inventory.service.spec.ts src/modules/shipping/services/ship-order.service.spec.ts src/modules/shipping/services/shipment.service.spec.ts --runInBand` 4 suites / 57 tests 통과.
- 검증: `git diff --check -- apps/backend/src/modules/shipping/services/ship-order.service.ts apps/backend/src/modules/shipping/services/shipment.service.ts apps/backend/src/modules/shipping/services/box.service.spec.ts apps/backend/src/modules/shipping/services/ship-order.service.spec.ts apps/backend/src/modules/shipping/services/shipment.service.spec.ts .ai-coordination/TASKS.md .ai-coordination/LOCKS.md` 통과.
- 미실행: 실제 JSHANES HTTP API 호출은 현재 PC에서 `10.1.10.35:1527` TCP 3초 타임아웃, `oracle_connector.py --site JSHANES` DPY-6005 timeout, `localhost:3003` 미기동/기동 미완료로 수행하지 못했다.

### 완료: workflow 문서 전체 구조화
- 입하→IQC→입고→재고→출고요청→출고처리 워크플로우 점검
- 엔티티-DB 불일치 6건, 상태값-공통코드 불일치 8건 발견/수정
- COM_CODES 마이그레이션 적용 (JUDGE_YN, INSPECT_TYPE)
- 엔티티 4건 수정 (mat-arrival, iqc-log, mat-issue, mat-lot)
- docs/ 불필요 파일 10개 삭제
- docs/reports/db-schema-erd.md 갱신
- domain-workflows.md 전면 갱신 (209→321행)
- 표준 템플릿 docs/workflows/_template.md 작성
- workflow 문서 9개 전체 작성 완료:
  - material/wf-material-receipt.md (입하/입고/LOT 9화면)
  - material/wf-material-issue.md (출고/재고/조정 10화면)
  - production/wf-production.md (생산 15화면)
  - quality/wf-quality.md (품질 19화면)
  - shipping/wf-shipping.md (출하 8화면)
  - equipment/wf-equipment.md (설비 11화면)
  - master/wf-master.md (기준정보 15화면)
  - system/wf-system.md (시스템 11화면)
  - system/wf-others.md (기타 16+화면 요약)
- domain-workflows.md → 메인 인덱스 전환 완료

### 다음 세션 작업 제안
- workflow 문서 품질 검토 (각 subagent 생성 결과 확인)
- 실제 테스트로 문서와 구현 간 불일치 재확인
