# claude Handoff

## Last Update
2026-06-10

---

## ✅ 완료: 2026-06-10 자재 도메인 일괄 개선 (커밋 5건: bf4599c·826f845·d36a558·ec4dc1a + 이전 c445c2c)

사용자 연속 요청 12건 처리. 모두 tsc 0·관련 jest 통과. **codex 동시작업(hold/inventory/shipping/equipment) 파일은 미접촉**.

### 신규/변경
- **특채처리(신규)** `/material/concession`: `MAT_LOTS.SPECIAL_ACCEPT_YN`(Y/N) 추가(JSHANES 적용). 불합격(FAIL) 입하+품목 그룹 특채처리/취소. **특채 LOT은 입고대상 포함→불용창고(재고 잔존지)에서 출고→양품창고 입고**(검사성적서 면제 `findReceivable`+`createBulkReceive` 양쪽). 컨트롤러/서비스 `material/concession`, 메뉴 `QC_CONCESSION`(MATERIAL/55)+권한+validator+i18n4. advisor 검증 반영.
- **자재입고 창고선택** `/material/receive`: 공통 `WarehouseSelect`(RAW, **기본창고 자동선택**) 추가. `useWarehouseOptions` defaultCode 노출 + `autoSelectDefault` prop. **W001을 RAW 기본창고로 지정(JSHANES)**.
- **입고이력** `/material/receive-history`: 공급처(lot.vendor)·제조사(MFG파트너명)·**양산/MRO 구분(CONSUMABLE=MRO)** 컬럼 + 공급사 필터. `receiving.findAll` PartnerMaster enrich.
- **출고요청 원자재한정** `/material/request`: `isRawMaterial`에 CONSUMABLE 제외, 수동검색 `itemType=RAW_MATERIAL`.
- **출고관리 분리** `/material/issue`(양산 PRODUCTION 전용, 수동출고탭/ManualIssueTab 삭제, 출고계정+스캔 한줄) + **기타출고(신규)** `/material/issue-other`(양산 외 계정 선택, 메뉴 `MAT_ISSUE_OTHER` MATERIAL/95). `BarcodeScanTab` 재사용화(fixedIssueType/excludeIssueTypes). ISSUE_TYPE: 양산=`PRODUCTION`.
- **IQC 그리드** `/material/iqc`: 검사 컬럼 맨 앞 + "IQC 검사" 문구.
- **자재병합 입하번호 게이트** `/material/lot-merge`: 병합 조건 **동일 origin→동일 arrivalNo**(merge()+spec jest9/9, 프론트 스캔 선검증, 컬럼 origin→입하번호, i18n `arrivalMismatchScan`).
- **PDA 입고 통일**(버그수정): PDA가 `{arrivalId,...}` 보내 백엔드 `items[]`와 불일치→입고 실패였음. PDA도 **시리얼(matUid) 스캔→공통 `items[]` 입고**로 재작성. 신규 `GET /material/receiving/receivable/by-barcode/:matUid`. 공통 WarehouseSelect. **⚠ PDA 단말 실스캔 검증 필요**.

### 변경 없음(이미 구현 확인)
- **자재분할** `/material/lot-split`: 요청(출고→반품 새 matUid 2개 재고생성→라벨 2장)은 **기존 LOT_SPLIT_OUT/IN + MatLabelPreviewModal(serials 2건)로 이미 충족**. 코드 변경 불필요.

### 주의/메모
- 메뉴는 DB `MENU_CATEGORY_ITEMS`(CATEGORY_CODE) 기준 렌더 + 프론트 menuConfig가 path/label 매핑. 신규 메뉴는 둘 다 + `ROLE_MENU_PERMISSIONS` + validator 필요. CREATED_BY NOT NULL('system').
- 미커밋(코디네이션): `.ai-coordination/LOCKS.md` 내 T-MAT-CONCESSION-RECV 항목(codex 동시편집 중이라 보류). 멀티라인 커밋은 임시파일+`-F`(메모리 참조).

---

## ✅ 완료: 출하지시 기반 박스 스캔 출하 (T-SHIP-BOX-SCAN, 2026-06-09, 커밋됨)

spec `docs/superpowers/specs/2026-06-09-shipping-box-scan-design.md`, plan `docs/superpowers/plans/2026-06-09-shipping-box-scan.md`.

### 핵심 (실DB end-to-end 검증 완료)
- **백엔드** `POST /shipping/orders/:id/ship-box` (`ShipOrderService.shipBox`, 단일 트랜잭션): 지시 CONFIRMED → 박스 tx내 재조회(CLOSED+OQC PASS+미출하+**팔레트 미적재**) → 품목 매칭/초과 검증 → FG 기본창고(`warehouseType='FG' && isDefault='Y'` = FG_MAIN) `issueStockInTx` FG_OUT 차감(`prdUid '*'`, refType `SHIP_ORDER`) → 박스 SHIPPED → 라인 `shippedQty` 증가 → 전 라인 완출 시 지시 CLOSED. 반환 `{lineShippedQty, lineOrderQty, orderStatus, fullyShipped}`.
- **이중차감 가드**: `palletNo` 있는 박스는 박스 스캔 출하 거부(팔레트 출하 경로 전용). box.service `assignToPallet`은 CLOSED-only 가드 기존 존재.
- **입고 단순화**: `inventory.controller.receiveFg`를 FG 기본창고로 강제(WH-FG 임의 입고 차단). 모듈: ShippingModule→InventoryModule import.
- **웹** `components/shipping/BoxScanShipModal.tsx` + `/shipping/confirm` 헤더 버튼(작업자=로그인 사용자). **PDA** `useShippingScan` 수리: 미구현 `by-barcode`/`register` → `GET /shipping/orders/:id` + `ship-box` 1건 호출(작업자 QR 유지, 다중 라인 진행률). i18n 4파일(`shipping.boxScan.*`, `pda.shipping` 에러키).
- 검증: 백엔드 jest 18건·tsc 0, 프론트 tsc 0, 실DB(SO-SBX-TEST/BXPDATEST01/FG_MAIN×5) GET→ship-box→DB확인(박스 SHIPPED·FG_MAIN 5→0·shippedQty 5·지시 CLOSED·FG_OUT -5)→재출하 400→**전량 원복**.

### 후속·주의
- **Task9 완료(T-SHIP-FG-RECEIVE-UI, commit d7af956·12971b9)**: 웹 ReceiveModal·BoxReceiveList·PDA product/receiving에서 완제품(FINISHED) 창고선택 숨김+FG 자동입고 안내(WIP 불변). i18n fgAutoWarehouse 3키. PDA 파일은 그 사이 tracked로 전환되어 정상 커밋.
- i18n 커밋 `8a5b44a`에 working tree의 타 작업자 미커밋 번역이 함께 포함됨(코드 손실 없음). 이후 i18n 커밋(cffc9da·12971b9)은 hunk 분리로 타 작업분 미흡수.

---

## ✅ 완료: IQC006 그룹 집계 + IQC 시료바코드 (2026-06-08, 미커밋)

### T-IQC006-GROUP — 입하실적조회 그룹화
- 문제: `MAT_ARRIVALS`가 시리얼당 1행(SEQ)이라 한 입하의 시리얼 N개가 좌측 N줄로 펼쳐짐. 목업은 입하번호+PO+품번 1행 + 우측 시리얼 묶음.
- `arrival.service.listArrivalResults`: GROUP BY (ARRIVAL_NO, PO_NO, ITEM_CODE) 집계. 입하수량=SUM, 시리얼수=COUNT, 대표상태 CASE(전량취소→CANCELED / 입고완료 / IQC완료 / IQC진행 / 입하완료).
- `SERIAL_COUNT_EXPR`/`RECEIVED_COUNT_EXPR`: SEQ→ITEM_CODE 그룹키, **origin 필터(분할/병합 파생 제외) 유지**.
- `getArrivalSerials`·`cancelByArrival`·`changeManufacturer`: seq→itemCode 그룹키로 이전. 컨트롤러 경로 `results/:arrivalNo/serials?itemCode=`, DTO seq→itemCode. cancel은 그룹 미입고·미취소 전량 1트랜잭션.
- 검증(실DB): R26060700001 10행→1행(입하수량2000/시리얼10), 우측 시리얼 10건, 전체 18그룹, 상태분포 정상(RECEIVED 입고건 cancelable=false). tsc 백/프론트 통과.

### T-IQC-SAMPLE-BARCODE — IQC 검사결과 등록 시료바코드
- `IQC_LOGS.SAMPLE_BARCODE` VARCHAR2(500) 컬럼 추가(`2026-06-08_iqc_log_sample_barcode.sql`, 실DB 적용). IqcLog 엔티티 + `CreateArrivalIqcResultDto.sampleBarcode` + `createArrivalResult` 저장.
- 프론트 `IqcModal`에 시료바코드 입력 필드(ScanLine, G4 위) — 일반 input이라 바코드 스캐너 입력·수기 입력 모두 가능. `useIqcData` 전달. i18n 4파일.
- tsc 통과. **end-to-end는 pending 입하 0건이라 미검증** — 새 입하 IQC 등록 시 브라우저 확인 필요.

---

## ✅ 완료: 자재분할/병합 재설계 (T-LOT-SPLIT-MERGE, 2026-06-08)

spec: `docs/superpowers/specs/2026-06-08-lot-split-merge-redesign.md`. 사용자 결정 반영(재가공 허용 + 검증데이터 원상복구).

### 구현 (검증 완료)
- **분할** `lot-split.service.ts`: `findSplittableLots`에 입고완료 게이팅. `split()`=원본 전량 OUT→`SPLIT`(재고0, currentQty=0) + 신규 2조각(splitQty/잔량) `nextMatSerial`(오늘날짜) 발번, origin/arrival/expire 등 계승, **currentQty=조각수량(#4 ORA-01400 해소)**, 수불 LOT_SPLIT_OUT/IN(`next('STOCK_TX')`). 기존검증(예약·출고이력·HOLD·isSplittable) 유지. `newLotNo` DTO 제거.
- **병합** `lot-merge.service.ts`: `findMergeableLots` 게이팅 + `merge()`=동일 itemCode·origin 검증, 원시리얼 전부 OUT→`MERGED` + 신규 통합1개 발번(합산수량). `GET /material/lot-merge/by-barcode/:matUid`(바코드 단건 검증) 추가. `targetLotId` DTO 제거.
- **게이팅(사용자 결정=재가공 허용)**: 입고완료 = `SUM(QTY) WHERE TRANS_TYPE IN ('RECEIVE','LOT_SPLIT_IN','LOT_MERGE_IN') >= initQty`. 분할/병합 결과물도 재분할·재병합 가능.
- **프론트**: lot-split(id→matUid 버그수정, 분할결과 2건 라벨), lot-merge(**바코드 스캔 누적 UI**, 라벨). MatLabelPreviewModal 재사용. i18n 4파일.
- **회귀수정**: ① IQC006 카운트(`arrival.service` SERIAL/RECEIVED_COUNT_EXPR + getArrivalSerials)에 `(ORIGIN=MAT_UID OR ORIGIN IS NULL)` 필터 — 분할/병합 파생 시리얼이 입하라인 카운트 부풀리던 버그 해소. ② `MAT_LOT_STATUS` 공통코드에 SPLIT/MERGED 추가(`2026-06-08_mat_lot_status_split_merged.sql`, 회색조 safelist 색상).

### 검증
- tsc(백/프론트) 0건, jest 16건 통과(spec 재작성).
- API 풀사이클(실DB JSHANES): 입고전 차단 / RECEIVE 시드→분할목록 노출 / 분할(신규2·원본SPLIT·currentQty·수불) / 바코드조회 / 병합(통합1·원본MERGED) / 재가공 게이팅 / IQC006 부풀림 해소(seq=1 serialCount 4→1) 확인. 검증 테스트데이터 **원상복구 완료**.

### 잔여/주의 (다음 세션 점검 후보)
- mat-lot **LOT 이력 조회**(mat-lot.service findAll, status 옵셔널)는 SPLIT/MERGED도 표시됨(재고0, 이력성격이라 의도). 필요시 기본필터 검토.
- hold.service:113 `status==='DEPLETED'` 단독 차단 — SPLIT/MERGED HOLD 시도 가능(재고0이라 무해, 우선순위 낮음).

---

## 이번 세션 — T-MAT-RECV-FIXES (자재입고 프로세스 이슈, 행성 지적)

스테이크홀더(행성) 지적 목록 기반. 참조: 목업 `C:\Document\고객별프로젝트\행성사\THN_MockUp`(MT\IQC001~006), 채번 `HANES_MES_채번규칙.pptx`. 상세는 `JOURNAL.md` 2026-06-07, 설계는 `docs/superpowers/specs/2026-06-07-iqc006-arrival-result-design.md`.

### 완료 (검증됨)
- **#1 PO 등록 오류**: 근본원인=예외필터가 class-validator 배열 메시지 버림(앱전체 systemic). `http-exception.filter.ts` 배열 노출 + PO DTO 한글메시지/NotEmpty + 프론트 수량검증. API 재현으로 검증.
- **작업지시 품목 제품·반제품만**: `PartQueryDto.itemTypes` 다중 + `part.service` IN절 + `PartSearchModal.allowedItemTypes` + JobOrderFormPanel `["FINISHED","SEMI_PRODUCT"]`. API 검증.
- **#7 자재입고**: `/material/receive` 정상 동작 확인(미구현 아님). 사용자 결정=메뉴/흐름 개선(미착수).
- **#2 일부입하 배지**: DB attr1 Tailwind JIT purge → `app/globals.css` `@source inline` safelist. **브라우저 라이브 확인 완료**(일부입하 주황 배지 정상).
- **IQC006 입하실적조회 전체(Slice ①~④ + 프론트 + 메뉴 + i18n)**: API/브라우저 검증 완료. 신규 페이지 `/material/arrival-result`. (위 JOURNAL 상세)

---

## 다음 작업 (우선순위)

1. **#4·5·6 자재분할/병합 재설계 — 설계 승인 완료, 구현 대기**: 설계 spec `docs/superpowers/specs/2026-06-08-lot-split-merge-redesign.md` (사용자 승인: pptx 모델대로 / 분할=2분할 / 신규시리얼=오늘날짜). 핵심: 원 시리얼 전부 폐기→결과 전부 신규 발번(nextMatSerial), 입고완료 게이팅, 병합 바코드스캔, STOCK_TX 채번, 기존 검증 유지, 박스 범위외. **#4 분할 안 됨 실제 원인 확인=신규 MatLot insert가 currentQty 누락→MAT_LOTS.CURRENT_QTY NOT NULL 위반(500). 재작성 시 해소.** 영향: lot-split/lot-merge service+page, i18n 4파일.
2. **라인→공정별 작업설비 지정** (사용자: 이번 라운드 포함): 구조변경(라우팅/데이터모델). 별도 설계 필요.
3. (선택) #7 추가 개선: 비-admin 역할 ROLE_MENU_PERMISSIONS에 MAT_ARRIVAL_RESULT 추가(역할 관리), 자재수불 메뉴 순서 미세 정렬.

---

## 환경/검증 메모
- 백엔드 3003 (prefix `api/v1`), 프론트 3002, Oracle `JSHANES`(company=40/plant=1000).
- API 검증 인증: `Authorization: Bearer admin@hanes.com` + `X-Company:40` + `X-Plant:1000`.
- dev 서버 실행 중 `pnpm build` 금지. 타입체크 `pnpm --filter @harness/frontend exec tsc --noEmit`.
- `@source inline` 등 globals.css 변경은 Turbopack 재시작 필요.
- 활성 LOCK: T-MAT-RECV-FIXES (claude). 작업 계속 시 LOCKS.md 확인.

---

## 이전 세션 이월 (미완, 유효)
- ERD 문서 갱신(`python tools/generate_db_schema_doc.py`), T-015 ERP PO Interface(IF_PO), notifications unread-count 간헐 500.
- Phase B 생산/품질(초중종물, 직접/의뢰검사), Phase C 영업(인계→출하지시→출하), Phase D 수리.
