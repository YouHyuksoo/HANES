# JOURNAL

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
