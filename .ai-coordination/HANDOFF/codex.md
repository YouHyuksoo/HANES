# codex Handoff

## Last Update

2026-06-09 20:05

## Latest

- `T-MAT-RECEIVE-SCAN` 완료. `/material/receive`는 입고대기 그리드 선택 입고를 제거하고, `입고처리` 버튼으로 여는 스캔 모달에서만 입고 처리한다.
- 스캔 모달은 거래처 바코드 → 자체부착 바코드(`matUid`) 순환 Enter 입력을 받아 매핑을 누적하고, 입고대기 대상/성적서 차단/창고 누락/중복을 검사한다. 입고 수량은 잔량 전체다.
- `MAT_RECEIVINGS.VENDOR_BARCODE` 컬럼을 추가해 거래처 바코드 원본을 입고 행에 저장한다. JSHANES 적용 완료, `docs/reports/db-schema-erd.md` 재생성 완료.
- 검증: JSHANES 컬럼 확인, receiving 서비스 Jest 11건, 백엔드 tsc, 프론트 tsc, `/material/receive` HTTP 200 통과. gstack browse/Playwright 실행 바이너리 부재로 인증 후 실제 모달 클릭 검증은 미수행.
- `T-INPUT-KIOSK-EQUIP-LIST` 완료. `/production/input-kiosk` 설비선택 모달에 기본 설비목록이 전달되도록 `/equipment/equips` 응답 정규화 유틸을 추가하고 페이지 로딩에 적용했다.
- 검증: 정규화 node:test 2건 통과, 프론트 tsc 통과, `localhost:3002/production/input-kiosk` HTTP 200 확인. 인증 없는 브라우저는 `/login` 리다이렉트라 실제 모달 DOM 클릭 검증은 미수행.
- `T-INPUT-KIOSK-REMOVE-MASTER-SAMPLE` 완료. `/production/input-kiosk` 헤더 Row2에서 마스터샘플 판정 카드를 제거했고, `kiosk.header.masterSample/masterSampleNotTarget` 번역 키도 제거했다.
- 검증: 프론트 tsc 통과, 입력키오스크/kiosk locale 참조 검색 0건, `localhost:3002/production/input-kiosk` HTTP 200 확인. 인증 없는 브라우저는 `/login` 리다이렉트라 실제 화면 DOM 검증은 미수행.
- `T-MAT-RECEIVE-REMOVE-INFO-CARDS` 완료. `/material/receive` 상단 정보카드 4개를 제거했고, 더 이상 쓰지 않는 `/material/receiving/stats` 조회와 `StatCard` 관련 import/state도 정리했다.
- 검증: 프론트 tsc 통과, `localhost:3002/material/receive` HTTP 200, `page.tsx` 내 `StatCard`/`receiving/stats` 잔여 참조 없음.
- 기존 dirty 변경인 자재입고 payload `warehouseId: warehouseCode`는 보존했다.
- `T-SHIP-BOX-STOCK-MENU` 완료. `/shipping/box-stock`이 좌측 메뉴에 안 보인 원인은 `MENU_CATEGORY_ITEMS` 배치 누락이다.
- `SHIP_BOX_STOCK`을 menu validator/seed에 등록했고, JSHANES `MENU_CATEGORY_ITEMS`의 SHIPPING 하위에 `SORT_ORDER=25`로 추가했다.
- MANAGER 역할에도 `ROLE_MENU_PERMISSIONS` `SHIP_BOX_STOCK=Y`를 추가했다.
- 검증: DB 조회, 재실행 SQL `scripts/migration/2026-06-09_seed_ship_box_stock_menu.sql`, 백/프론트 tsc 통과. 기존 브라우저 탭은 `hanes-menu-tree` sessionStorage 때문에 새로고침이 필요할 수 있다.
- `T-SHIP-PACK-REMOVE-INFO-CARDS` 완료. `/shipping/pack` 상단 정보카드 4개를 제거했고 목록 카드가 바로 보인다.
- 기존 `/shipping/pack` 시리얼 스캔 Enter 자동등록/즉시취소 변경은 보존했다.
- 검증: 프론트 tsc 통과. 헤드리스 브라우저 CDP mock으로 `/shipping/pack` 정보카드 grid count `0`, 박스 목록 행 표시 확인.
- `T-SHIP-BOX-STOCK` 완료. 출하관리 하위에 `/shipping/box-stock` 박스입고재고 조회 화면을 추가했다.
- 화면은 `/shipping/boxes` 박스 목록을 기준으로 하며, 행 선택 시 `/shipping/boxes/:id/items`로 `FG_LABELS` 개별제품 상세를 조회한다.
- 표시 항목: 박스번호/품목/수량/상태/팔레트/OQC/마감일시, 개별제품 시리얼/작업지시/FG상태/검사/발행일시.
- 검증: 백엔드 tsc, 프론트 tsc 통과. 기존 dev 서버 `localhost:3002`에서 `/shipping/box-stock` HTTP 200 확인. Playwright CLI 부재로 스크린샷 검증은 미수행.
- `T-SHIP-ORDER-REMOVE-INFO-CARDS` 완료. `/shipping/order` 상단 정보카드 4개를 제거했고 목록 카드가 바로 보인다.
- 기존 미커밋 변경인 `/shipping/orders` API 경로 수정은 그대로 보존했다.
- `T-SHIP-PACK-SCAN-ENTER-CANCEL` 완료. `/shipping/pack` 시리얼 입력은 스캐너 Enter/CR/LF로 즉시 등록되고, 방금 등록한 시리얼은 모달 상단 `취소`로 즉시 삭제할 수 있다.
- 등록/삭제 뒤 시리얼 입력 포커스는 계속 유지된다.
- 검증: 프론트 tsc 통과. 헤드리스 브라우저 CDP mock으로 `/shipping/pack` 자동등록/즉시취소와 `/shipping/order` 정보카드 미표시 확인.
- `T-SHIP-PACK-SERIAL-FOCUS` 완료. `/shipping/pack` 시리얼 추가 모달은 열림 직후 시리얼 입력박스에 자동 포커스되고, Enter로 시리얼 추가 후에도 입력박스 포커스를 유지한다.
- 시리얼 추가 모달 크기는 `2xl`로 확대했다.
- 검증: 프론트 tsc 통과. 백엔드 3001 미실행으로 실 API 대신 헤드리스 브라우저 CDP mock으로 `/shipping/pack` 실제 컴포넌트 렌더링 후 `focusedOnOpen=true`, `focusedAfterEnter=true`, `serialAddedVisible=true` 확인.
- `T-QUALITY-REWORK-DEFECT-RELATION` 완료. `/quality/reworks` 500 원인은 `ReworkOrder`에 없는 `defectLog` TypeORM relation을 join/load한 것이다.
- `REWORK_ORDERS.DEFECT_LOG_ID`는 `"occurAt|seq"` 문자열이고 `DEFECT_LOGS`는 `OCCUR_TIME + SEQ` 복합 PK라 현재 엔티티 관계로 직접 매핑되어 있지 않다.
- `ReworkService.findAll()`의 `leftJoinAndSelect('r.defectLog', 'dl')`와 `findById()`의 `relations: ['defectLog']`를 제거했다.
- 검증: `rework.service.spec.ts` 11건, 백엔드 tsc 통과. 실 API `GET /api/v1/quality/reworks?limit=5000`은 `success: true`, 0건 반환.
- `T-MAT-REQ-DETAIL` 완료. `/material/request` 출고요청 목록에서 행 클릭 또는 상세보기 아이콘으로 요청 상세 모달을 볼 수 있다.
- 상세 모달은 요청 헤더, 상태/요청자/승인 정보, 요청·출고·잔여 수량 합계, 품목별 요청·출고·잔여·현재고·BOM소요·기불출·현장재고를 표시한다.
- 백엔드 목록 응답의 `orderNo`, `totalRequestQty`, `totalIssuedQty` fallback도 반영해 목록/상세 표시가 맞게 나오도록 했다.
- 검증: 프론트 tsc 통과, API `MR2606080003` 상세 품목 확인, 브라우저 `/material/request` 상세 모달 6개 품목 표시 확인.
- `T-INPUT-KIOSK-CONSUMABLE-COUNT` 완료. 입력키오스크 소모품 패널에서 `item.maxCount.toLocaleString()`이 `undefined`로 터지던 원인을 수정했다.
- 원인은 mounted consumable API가 수명 한도를 `expectedLife`로 반환하는데 프론트는 `maxCount`를 기대하던 계약 불일치다.
- `MaterialListPanel`과 `ConsumableScanModal` 모두 `maxCount ?? expectedLife` 정규화와 숫자 fallback을 적용했다.
- 검증: JSHANES/API 실응답 확인, `pnpm --filter @harness/frontend build` 통과, 헤드리스 브라우저에서 `EQ-CUT-01` 소모품 패널/모달 카운트 정상 표시 및 해당 TypeError 없음.
- `T-MAT-REQ-BOM-AUTO` 완료. `/material/request`에서 작업지시 선택 시 BOM 직하위 원자재를 자동 산출해 요청 품목으로 채운다.
- 산식은 `BOM 소요량 - 기불출량 - 현장재고`이고, 이전 출고량은 `MAT_ISSUES -> MAT_LOTS`, 현장재고는 `MAT_STOCKS -> WAREHOUSES(FLOOR)` 기준이다.
- 새 API: `GET /material/issue-requests/job-orders/:orderNo/bom-items`.
- 요청 상세 저장 시 `bomReqQty`, `prevIssueQty`, `floorStockQty`도 저장한다.
- 생성 직후 404 결함도 수정했다. 원인은 트랜잭션 안에서 외부 repository로 상세 재조회해 Oracle 미커밋 행을 못 보는 구조였고, 커밋 후 재조회로 변경했다.
- 검증: backend issue-request 스펙 14건, backend build, frontend build 통과. 브라우저에서 `W2026-001 - HNS01` 선택 시 원자재 4건 자동 표시 확인. API/DB로 `MR2606080002` 생성 및 상세 4건 저장 확인.
- `T-MAT-ARRIVAL-LABEL-FORMAT` 완료. 입하시 발행 라벨을 사용자 첨부 이미지 기준 80mm x 40mm 형식으로 변경했다.
- 새 공용 컴포넌트 `apps/frontend/src/components/material/MaterialArrivalLabel.tsx`가 입하 직후 라벨 모달과 `/material/receive-label` 브라우저 인쇄에서 공통 사용된다.
- 라벨은 좌측 QR(data URL image), `품목코드 / 수량 단위`, 제조사, `IN`, `SERIAL`, `LOT`, 우측 `MP/CM`, `검사필 도장날인`, 하단 품명으로 구성된다.
- 실제 발행 중 발견한 라벨 발행 저장 결함도 수정했다: `MAT_LOTS.currentQty/origin/iqcStatus/status` 누락, `LABEL_PRINT_LOGS.company/plant/printedAt/seq` 누락, 브라우저 로그 payload `matUids`→`uidList`.
- 검증: 프론트/백엔드 tsc 통과. 헤드리스로 APPCT-A 5장 실제 발행, create/log API 201, 인쇄 HTML 라벨 5개와 QR 이미지 5개 확인. 검증용 사용자 `codex-label-verify@harness.com`은 삭제했다.
- `T-ROUTING-PROCESS-TYPE-SOURCE` 완료. `/master/routing` 공정추가 모달에서 공정유형 선택/저장을 제거했고, 공정 마스터 `processType`을 표시만 한다.
- 브라우저 확인: `MTASY` 선택 시 공정명 `자재장착`, 공정유형 `조립` 표시. 저장은 수행하지 않았다.
- 사용자 요청으로 `RECV-TEST-260608` 3건을 실제 입고 처리했다. 입고번호는 `RCV20260608-0002`, 수불번호는 `TX20260608-00014~00016`.
- 입고대기 API에서 해당 LOT 3건은 더 이상 반환되지 않고, `MAT_RECEIVINGS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS` 반영을 확인했다.
- `T-MAT-RECEIVE-TESTDATA` 완료. `/material/receive`에서 `RECV-TEST-260608`로 검색하면 입고 테스트 가능한 3건이 보인다.
- 생성 LOT: `RECV-TEST-260608-00003`(`CBL-A`, 12, 성적서 첨부), `RECV-TEST-260608-00004`(`CNTR001`, 8, 성적서 첨부), `RECV-TEST-260608-00005`(`APPCT-A`, 5, 성적서 불필요). 입하번호는 `RCVT26060800003`, 창고는 `WH-MAT-A`.
- `T-MAT-CYCLE-E2E-FIX` 완료.
- `T-MAT-CYCLE-E2E-QA`에서 찾은 결함을 수정했다: 자재입고 `warehouseCode`/`warehouseId` 계약 불일치, IQC 성적서 업로드 UI 부재, 날짜 표시/필터 문제, 수동출고 체크박스 row id 누락, 자재재고 `matUid` 검색 누락.
- 추가로 IQC 이력 기본 날짜 필터가 `toDate=2026-06-08`을 00:00:00까지만 포함해 오늘 이력을 숨기던 결함을 발견하고 수정했다.
- 검증: 관련 백엔드 스펙 53건, 프론트/백엔드 tsc 통과. 헤드리스 브라우저에서 재고 LOT 검색, 수동출고 1행 선택, IQC 이력 오늘 1건/성적서 첨부/재업로드 아이콘 표시 확인.
- 테스트 데이터 기준: `PO-260608-013`, `R26060800001`, `VH1-RM260608-00004`, `RCV20260608-0001`, `ISS20260608-0001`.

## Completed

- BOM 화면 컬럼 라벨을 `유형`에서 `품목유형`, `공정`에서 `투입공정`으로 명확화했다.
- `ko/en/vi/zh` locale에 반영했고 프론트 `tsc --noEmit` 통과했다.
- `ITEM_MASTERS.ITEM_TYPE` 품목유형 기준을 `ITEM_TYPE` 공통코드로 통일했다.
- JSHANES 컬럼 주석은 `공통코드:ITEM_TYPE`, `COM_CODES.PART_TYPE` 활성 행은 `N`으로 정리했다.
- 런타임 화면/Swagger/shared 상수와 schema SQL/생성 스크립트/ERD 문서의 품목유형 `PART_TYPE` 혼용을 정리했다.
- 검증: focused Jest, backend build, frontend `tsc --noEmit`, JSHANES migration execute-file, Oracle post-query 통과.
- `PRODUCT_TYPE`을 `2011/2012/2013/2014` 단계 코드에서 `HARNESS/SUB_ASSY/WIRE/TERMINAL/...` 품목군 코드로 재정의했다.
- 현재 기준: `ITEM_TYPE`은 재고/생산 흐름 분류, `PRODUCT_TYPE`은 품목군/물성 분류다.
- JSHANES `40/1000` 품목 18건, 재실행 SQL, 공유 상수, 프론트 옵션, 백엔드 DTO 예시를 모두 같은 기준으로 정정했다.
- `ITEM_TYPE`/`PRODUCT_TYPE` 구분을 검증하고 정정했다. `ITEM_TYPE`은 수불/생산 분류, `PRODUCT_TYPE`은 품목 화면 제품유형 코드로 분리한다.
- JSHANES `40/1000`의 `PRODUCT_TYPE`은 `2011=하네스`, `2012=반제품`, `2013=원자재`, `2014=부자재`로 정렬됐다.
- `PRODUCT_TYPE_VALUES` 공용 상수를 추가하고, 품목 DTO에서 `productType`을 해당 값으로 검증하도록 했다.
- `C:\Users\hsyou\Desktop\bom-from-production-sheet.html` 기준으로 JSHANES `40/1000`의 BOM/품목/공정/라우팅 기준정보를 재생성했다.
- 실행 SQL은 `tools/generated/bom-from-production-sheet-seed.sql`이다.
- 최종 건수는 `ITEM_MASTERS=18`, `BOM_MASTERS=16`, `PROCESS_MASTERS=16`, `ROUTING_GROUPS=3`, `ROUTING_PROCESSES=18`, `ROUTING_MATERIALS=17`이다.
- `TP0001`은 BOM PK 제약 때문에 `BOM_MASTERS`에는 800MM 합산, `ROUTING_MATERIALS`에는 500MM/300MM 분리로 반영했다.
- 기준정보 전체에서 DB 응답에 없는 임의 `id` 잔여를 정리했다.
- `bom`, `label`, `iqc-item`, `part` IQC 설정, `vendor-barcode`, `work-instruction`, `company`는 실제 DB PK 또는 복합키 기준으로 수정/삭제/선택키를 맞췄다.
- 기준정보 DataGrid 표시 SQL 테이블명을 실제 DB 테이블명으로 정정했다.
- 프론트 타입체크, diff 공백 검사, 핵심 기준정보 API 조회 7건이 통과했다.
- 기준정보 회사/사업장 화면에서 DB 응답에 없는 임의 `id` 의존을 제거했다.
- 회사 수정/삭제 호출은 `COMPANY_MASTERS` 복합키인 `companyCode::plant` 기준으로 정리했다.
- 회사 DataGrid 표시용 SQL 테이블명을 실제 테이블 `COMPANY_MASTERS`로 정정했다.
- `MYDBPDB` / `HNSMES` 기준 TypeORM-vs-Oracle 비교 도구를 추가했다.
- PK/type/nullable mismatch를 모두 정리했고 최종 비교 결과는 issues 0이다.
- 적용한 마이그레이션과 엔티티 수정 내역은 `docs/reports/typeorm-oracle-schema-audit-2026-05-30.md`와 `JOURNAL.md`에 기록했다.
- `docs/reports/db-schema-erd.md`를 `MYDBPDB/HNSMES` 기준으로 갱신했다.

## Next

- codex active lock은 없다.
- `MR2606080002`는 이번 작업에서 실제 생성한 출고요청 테스트 데이터다. 사용자가 정리 요청하면 삭제 또는 취소 정책에 맞춰 처리한다.
- 이번 기준정보 재생성은 운영성 주문/재고성 테이블 전체 삭제가 아니라 BOM/품목/공정/라우팅 중심 삭제/재생성이다.
- `routing` self-inspect의 `id`는 DB 실제 PK라 유지했다. `RoutingGroupManager`, `QualityConditionEditor`, `work-calendar`, DataGrid 컬럼 `id`는 화면 로컬 식별자라 유지했다.
- 커밋은 사용자 요청이 있을 때만 수행한다.
