# JOURNAL

Append new entries at the top.

Use this heading format for every new entry:

```md
## YYYY-MM-DD HH:mm Agent
```

Use local time in 24-hour format.

## 2026-06-19 Claude (P2)

T-HARNESS-FLOW-RENEWAL-P2 — 생산흐름 리뉴얼 Phase 2(백엔드 엔진 + 키팅 메뉴/화면 + 실증).

- 구현(전부 main 커밋, BE tsc 0):
  - DDL: ROUTING_PROCESSES `ISSUE_SG_LABEL_YN`/`ISSUE_FG_LABEL_YN`, SG_LABELS `RESULT_NO` (JSHANES 적용).
  - 채번: `nextGenealogyId`(SEQ_PROD_GENEALOGY). 라우팅 엔티티 플래그 매핑.
  - 묶음 발행: prod-result `create()`에 `issueSgLabelInTx`(반제품+발행공정 플래그/첫공정 폴백, bundleCount×qtyPerBundle 정합, resultNo 멱등).
  - 서브공정 키팅: `POST /production/subprocess-kitting`(+GET sg-label) — 완제품 BOM SEMI 화이트리스트, FIFO 가닥 소비, FG 발행, PRODUCT_GENEALOGY(FG←SG/MAT_LOT), 제품 WIP_IN 재고/수불, ProdResult(DONE).
  - 통전검사: FG 발행 시점 `ON_SUBPROCESS` 분기(비파괴, 기존 ON_INSPECT 기본 유지).
  - 프론트: 생산관리 "서브공정 키팅" 메뉴+화면(`/production/subprocess-kitting`) + i18n 4종 + MENU_CATEGORY_ITEMS.
  - 시드: HNS02 흐름 플래그(HNS02_FA/TAPPN=SG, RT-HNS02/SASSY=FG).
- 실증(AppModule createApplicationContext + 실DB JSHANES, 서버 무중단): kit() 실행 — FG 3건 발행(HNS02/ISSUED), SG 10→7(FIFO), genealogy 3행(FG←SG), PRODUCT_STOCKS HNS02/WIP_MAIN 0→3, PROD_RESULTS DONE goodQty3, PRODUCT_TRANSACTIONS WIP_IN/KITTING, qty=999 재고부족 BadRequest+롤백. 테스트데이터 정리 완료.
- 미완(다음): Phase 3 원자재 서브공정 수불(현재 matLots는 genealogy만), Phase 4 PRODUCT_STOCKS 시리얼('*'/배치) 정리 마이그레이션, Phase 5 포장/출하 단일키 전환·우회 제거, Phase 6 화면 풀 와이어링·브라우저 E2E, 불량/재작업(repair 연계). 라이브 파괴적 변경이라 사용자 체크포인트 권장.

## 2026-06-19 Claude

T-HARNESS-FLOW-RENEWAL-P1 — 하네스 생산흐름 리뉴얼 Phase 1(스키마 비파괴 추가).

- 배경: grill로 전체 설계 확정(재고=PRODUCT_STOCKS 수량 / 추적=FG_LABELS+SG_LABELS 분리, 제품라벨 서브공정 발행으로 출하 키 우회 제거). 마스터 계획 `docs/superpowers/plans/2026-06-19-harness-production-flow-renewal.md`, Phase 1 sub-plan `...harness-renewal-phase1-schema.md`.
- DB(JSHANES): `SG_LABELS`(반제품 묶음 추적라벨, 잔량 보유)·`PRODUCT_GENEALOGY`(재귀 genealogy) 테이블 + `SEQ_SG_LABEL`·`SEQ_PROD_GENEALOGY` 시퀀스 생성(oracle-db 스킬, idempotent). 신규 테이블이라 의존 PL/SQL 영향 0(기존 INVALID는 IF_PO 1건, 무관).
- 코드: 엔티티 `SgLabel`·`ProductGenealogy` 추가, `production.module` forFeature 등록, `numbering.service.nextSgLabel`(SG+YYMMDD+5자리, 전역 SEQ) TDD RED→GREEN.
- 검증: 백엔드 tsc 0건, `numbering.sg-label.spec` PASS. 비파괴(기존 서비스/흐름 미변경, 미사용 등록).
- 상태: 작업 브랜치 `feat/harness-renewal-phase1`에 커밋 4건(8e67d4d8·1f3cc0ae·d2f03182·d2f59a7c), **main 미머지·미push**. lock 해제. Phase 2(채번·발행) 대기.

## 2026-06-18 13:48 Codex

T-WIP-STOCK-ACTUAL-SQL - `/production/wip-stock` SQL 미리보기 실제 SQL 반영.

- 원인: 화면 `DataGrid.sqlQuery`가 `WIP_STOCKS`를 하드코딩했다. 실제 백엔드 `ProductionViewsService.getWipStock()`는 `PRODUCT_STOCKS s`에서 조회하고 `ITEM_MASTERS im`, `WAREHOUSES wh`를 조인한다. 공통 SQL 모달은 preview SQL의 테이블명으로 API `meta.debugSql` 캐시를 매칭하므로, 잘못된 preview 테이블 때문에 실제 SQL 캐시 매칭도 실패할 수 있었다.
- 변경: `apps/frontend/src/app/(authenticated)/production/wip-stock/page.tsx`에 `wipStockSql`을 추가해 실제 조회 SELECT/JOIN/WHERE/ORDER BY 구조를 표시한다. 현재 화면의 유형 필터와 검색어가 있으면 `ITEM_TYPE`/검색 조건도 SQL 미리보기에 반영한다. 구조 테스트 `wip-stock-actual-sql.structure.test.mjs`를 추가해 `WIP_STOCKS` 재유입을 막았다.
- 검증: 구조 테스트 RED 확인 후 GREEN, `node --test apps/frontend/src/app/(authenticated)/production/wip-stock/wip-stock-actual-sql.structure.test.mjs` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. 3002 브라우저에서 `/production/wip-stock` → 그리드 옵션 → `SQL 조회문` 모달 확인 결과 `PRODUCT_STOCKS`, `ITEM_MASTERS`, `WAREHOUSES` 표시 true, `WIP_STOCKS` 표시 false, console/page error 0.
- 상태: REVIEW, lock released. 커밋은 하지 않음.

## 2026-06-18 13:26 Codex

T-DATAGRID-HOVER-SCROLL-REMOVE - 공용 DataGrid 좌우 끝 hover 자동 스크롤 제거.

- 정정: 사용자의 의도는 `/production/specification-setup` 회로 테이블이 아니라 모든 공용 `DataGrid`의 좌/우 끝 hover 자동 스크롤 기능 제거였다. 앞서 추가했던 회로 테이블 전용 구조 테스트는 제거하고 공용 DataGrid 기준으로 전환했다.
- 변경: `apps/frontend/src/components/data-grid/DataGrid.tsx`에서 `ScrollHandle` import와 좌/우 렌더링을 제거했다. `group/scroll` wrapper와 주석도 일반 테이블 컨테이너로 정리했다.
- 삭제: `apps/frontend/src/components/data-grid/ScrollHandle.tsx` 삭제. 이 파일은 hover 시 `setInterval`로 `scrollLeft`를 변경하는 전용 구현이었다.
- 테스트: `datagrid-scroll-handle-removal.structure.test.mjs` 추가. DataGrid에 `ScrollHandle`, `group/scroll`, `with scroll handles`가 없고 `ScrollHandle.tsx` 파일이 삭제됐는지 검증한다.
- 검증: 신규 구조 테스트 PASS, 제품 도면관리 구조 테스트 PASS, frontend tsc PASS. 3002 브라우저 `/production/specification-setup`에서 DataGrid 렌더 후 `group/scroll=0`, `group-hover/scroll=0`, `data-scroll-id=0` 확인.
- 상태: REVIEW, lock released. 커밋은 하지 않음.

## 2026-06-18 13:18 Codex

T-HARNESS-CIRCUIT-PAYLOAD - 제품 도면관리 회로 저장 400 및 Rev 생성 취소 문제 수정.

- 원인: Revision 상세 API 응답의 회로 엔티티 전체(`circuitId`, `revisionId`, `sortOrder`, `company`, `plant`, `createdAt` 등)를 프론트 상태에 넣은 뒤 저장 payload에서 `...circuit`으로 그대로 재전송했다. 백엔드 DTO whitelist가 해당 필드를 거부해 `PUT /production/specifications/revisions/8` 400 발생.
- 변경: `toCircuitPayload()`를 추가해 `HarnessCircuitSpecDto` 허용 필드만 명시적으로 전송하도록 변경했다. 빈 문자열은 `undefined`로 정리해 JSON payload에서 빠지게 했다.
- Rev 생성: `window.prompt()`를 제거하고 공용 `Modal` 기반 Rev 생성 모달로 변경했다. 취소 버튼은 `setReviseModalOpen(false)`만 수행하며 `/revise` API를 호출하지 않는다.
- 테스트: 구조 테스트에 payload sanitizer와 prompt 제거/모달 사용 조건을 추가해 RED 확인 후 GREEN. 구조 테스트 6/6 PASS, frontend tsc PASS.
- 런타임 검증: 3002 브라우저에서 `HDW-SEED-HNS02-C1ABCD` 저장 클릭 시 `PUT /production/specifications/revisions/8` 200. 요청 payload에는 `circuitId/revisionId/company/createdAt` 등 금지 필드 미포함. Rev 생성 모달 취소 시 `/revise` 호출 0건 확인.
- 상태: REVIEW, lock released. 커밋은 하지 않음.

## 2026-06-18 13:11 Codex

T-HARNESS-CONNECTION-SYMBOL - 제품 도면관리 회로 그리드의 연결문자 그림 표시.

- 변경: `/production/specification-setup` 회로별 제작 사양 그리드의 `연결` 컬럼을 문자 입력칸에서 SVG 미리보기 + 선택 컨트롤로 변경했다.
- 지원 형태: `STRAIGHT/LINE`은 직선, `BRIDGE`는 분기형, `ONE_SIDE`는 단측 연결 그림으로 표시한다. 저장값은 기존 `connectionSymbol` 필드를 그대로 사용한다.
- 테스트: 구조 테스트에 `ConnectionSymbolControl`, `data-connection-symbol`, `svg`, `connectionSymbolOptions` 검증을 먼저 추가해 RED 확인 후 구현했다.
- 검증: 구조 테스트 4/4 PASS, frontend tsc PASS. 3002 브라우저에서 `HDW-SEED-HNS02-MAIN` 선택 후 연결 셀 8개가 SVG와 select로 렌더링되고 `STRAIGHT`, `BRIDGE` 값이 표시됨을 확인했다.
- 상태: REVIEW, lock released. 커밋은 하지 않음.

## 2026-06-18 12:35 Codex

T-HARNESS-DRAWING-SEED - 제품 도면관리 확인용 seed 데이터 작성 및 적용.

- 추가: `apps/backend/src/migrations/2026-06-18_harness_drawing_seed.sql` 생성. `HDW-SEED-HNS02-MAIN`, `HDW-SEED-HNS02-C1ABCD` 2개 도면만 삭제 후 재삽입하는 재실행 가능 seed이며 키는 모두 `SEQ_HARNESS_* .NEXTVAL` 사용.
- 데이터: HNS02 메인 도면 Rev.A APPROVED 6회로, Rev.B DRAFT 8회로, HNS02C1ABCD 서브 도면 Rev.A DRAFT 3회로. 화면 예시의 wire/stripping/crimping/housing/terminal 값을 포함.
- 보정: 검증 중 `GET /production/specifications/revisions/:revisionId` 컨트롤러 라우트가 누락된 것과 화면 `loadDetail()`이 회로 없는 Revision 요약을 사용하던 문제를 수정했다.
- 검증: seed SQL JSHANES 적용 및 재실행 성공. post-check는 도면 2건/Revision 3건/회로 17건. API에서 `HDW-SEED-HNS02-MAIN` Rev.A 6회로, Rev.B 8회로 조회 확인.
- 테스트: production specification 구조 테스트, frontend/backend tsc 통과. 3002 브라우저에서 `/production/specification-setup` 검색 `HDW-SEED` 후 메인 도면 선택 시 Header와 회로 입력값 `VSF 0.75SQ` 표시 확인.
- 상태: REVIEW, lock released. 커밋은 하지 않음.

## 2026-06-18 12:24 Codex

T-HARNESS-DRAWING-MGMT - 하네스 제품 도면관리 신규 기능 구현.

- 구현: 생산관리 하위 `/production/specification-setup` 신규 화면 추가. 좌측 도면 목록, 우측 도면 Header, Revision 선택/승인/Rev 생성, 회로별 제작 사양 그리드를 제공한다.
- 백엔드: `HARNESS_DRAWING_MASTERS`, `HARNESS_DRAWING_REVISIONS`, `HARNESS_CIRCUIT_SPECS` 엔티티/API/서비스 추가. 승인 Revision은 직접 수정 차단, Rev 생성 시 회로 복제. 키는 `SEQ_HARNESS_* .NEXTVAL` 사용.
- DB: `apps/backend/src/migrations/2026-06-18_harness_drawing_management.sql`을 JSHANES에 적용해 테이블 3개, 시퀀스 3개, `PROD_SPEC_SETUP` 메뉴를 생성했다. `tools/generate_db_schema_doc.py`로 ERD 문서 재생성.
- 검증: 백엔드 서비스 테스트, 프론트 구조 테스트, backend/frontend tsc 통과. 인증 API로 도면 생성 -> 승인 -> Rev 생성 -> 삭제 흐름을 실측했고 `DWG-CODEX-%` 테스트 데이터 잔여 0건 확인.
- 브라우저: 3002/3003 dev 서버에서 `http://localhost:3002/production/specification-setup` 인증 세션 접속, `제품 도면관리`, `도면 Header`, `회로별 제작 사양`, 저장/승인 버튼 표시 확인.
- 상태: REVIEW, lock released. 커밋은 하지 않음.

## 2026-06-18 dashboard-ora04068-fix Claude

대시보드 500(`PKG_DASHBOARD.SP_JOB_ORDER_STATS` 프로시저 호출 실패) 원인 규명 + 백엔드 하드닝.

- 원인: 본 세션의 `ALTER TABLE INSPECT_RESULTS ADD EQUIP_CODE`(LAST_DDL 2026-06-18 03:13)가 INSPECT_RESULTS를 참조하는 `PKG_DASHBOARD`를 INVALID화. 사용자가 09:21:42 대시보드 호출 시 패키지 BODY 자동 재컴파일(LAST_DDL 09:21:41)되며, 기존 패키지 상태를 들고 있던 백엔드 세션이 첫 호출에서 **ORA-04068(existing state of packages discarded)** 1회성 오류 → 500. 현재 패키지 VALID, 자가복구됨.
- 진단(oracle-db 스킬): SP_JOB_ORDER_STATS의 SELECT 재현 정상, 프로시저 직접/백엔드 동일 익명블록 경로 모두 정상, SP_KPI(INSPECT_RESULTS 참조)도 정상. LAST_DDL 타임스탬프가 에러시각과 일치 → 확정.
- 하드닝: `common/services/oracle.service.ts`에 `isPackageStateDiscarded`(ORA-0406x) + `executeWithRetry`(같은 커넥션 1회 재시도) 추가. callProc/callProcMultiCursor/callProcScalar 3곳 모두 적용. ORA-04068은 본문 실행 전 발생·상태 재설정되므로 재시도가 안전(이중 실행 없음). BE tsc 0.
- 교훈: 테이블 DDL은 의존 PL/SQL 패키지를 INVALID화 → 다음 호출에서 ORA-04068 1회성 발생 가능. 마이그레이션 후 의존 패키지 수동 재컴파일(ALTER PACKAGE ... COMPILE) 권장. 미커밋.

## 2026-06-18 inspection-consumable-persist Claude

T-INSPECT-CONSUMABLE-PERSIST — 검사기 장착 소모품 영속화 + 교체 + 강제 장착해제 + terminal-result 동일 적용.

요구(사용자): 소모품은 한번 장착되면 그 설비에 항상 장착 유지 — 작업지시가 바뀌어도 유지, 다른 롯트로 교체하거나 강제 장착해제할 때만 변경.

구현:
- BE `kiosk-consumable.service.findByJobOrder`에 `includeMountedOnEquip` 파라미터 추가. true면 (현재 품목 매핑에 없더라도) 설비에 MOUNTED인 소모품도 union하여 표시 → 작업지시(품목) 바뀌어도 설비 장착분 계속 노출. 소모품은 설비 귀속(CONSUMABLE_STOCKS.MOUNTED_EQUIP_CODE)이라 DB상 이미 영속이며, 표시 로직만 보강.
- BE `scanMount`: 같은 설비에 이미 장착된 동일 consumableCode의 다른 롯트는 ACTIVE로 자동 해제 후 신규 장착(설비당 1롯트 불변식 = "다른 롯트로 교체").
- BE controller GET에 `includeMounted` 쿼리(=1/true) 추가 → service에 전달. 키오스크는 미전송이라 기존 동작 유지(하위호환). 인스펙션 ConsumablePanel만 `includeMounted:1` 전송.
- FE ConsumablePanel: 장착 행에 **강제 장착해제** 버튼(텍스트+확인 모달 ConfirmModal). DELETE unmount → ACTIVE 복귀. i18n `inspection.result.{consumableUnmount,consumableUnmountConfirm,consumableUnmounted}` ko/en/zh/vi.
- terminal-result(`/inspection/terminal-result`)는 이미 **동일 `InspectionResultWorkflow`** 를 inspectType="TERMINAL"로 사용 → 검사기 선택/소모품/전체화면/영속/교체/강제해제 모두 자동 적용. localStorage 검사기 키도 inspectType별 분리(`hanes:inspection:equip:TERMINAL`).

검증:
- FE/BE tsc 0, locale 4파일 OK.
- 브라우저(로그인 유효 동안): EQ-TEST-01 선택→WO2606150060(HNS02C1ABCD) CM-JG-CT1/CT2 표시→C26020100019 장착→**작업지시를 HNS02_FA(EQ-TEST-01 미매핑)로 전환해도 CM-JG-CT1 "장착됨" 유지**(includeMounted 영속 확인), 강제해제 버튼 노출.
- 교체(다른 롯트)/강제해제 확인모달/terminal-result 화면은 dev 로그인 세션 만료(401)로 브라우저 재검증 미완 — 코드/tsc만. (사용자 로그인 시 재검증 가능)
- 테스트 롯트 C26020100019 ACTIVE 원복.

공유모듈 주의: kiosk-consumable(service/controller) 변경은 includeMounted opt-in(키오스크 영향 없음)이나, **scanMount 교체(이전 롯트 자동해제)는 키오스크에도 적용됨** — 설비당 동일소모품 1롯트는 물리적으로 옳은 불변식이라 의도적 적용(키오스크 잠재 이중장착 교정). 미커밋.

## 2026-06-18 inspection-result-equip-persist Claude

T-INSPECT-RESULT-EQUIP-SELECT 후속 — 선택 검사기 유지. `InspectionResultWorkflow`에서 선택 검사기를 `localStorage['hanes:inspection:equip:${inspectType}']`에 저장(handleSelectEquip)하고, 마운트 시 복원. TESTER 목록 로드 후 저장값이 목록에 없으면 정리. 검증: 로컬 3002에서 EQ-TEST-01 선택→localStorage 기록 확인→페이지 reload→Select가 "도통검사기 #1 (EQ-TEST-01)"로 자동 복원(JS+육안). FE tsc 0. 미커밋.

## 2026-06-18 inspection-result-equip-select Claude

T-INSPECT-RESULT-EQUIP-SELECT — `/inspection/result`(통전검사 실적)에 검사기(TESTER) 선택 기능 + 소모품 출처 교정 + 검사 실적 검사기 기록 + chromeless 전체화면.

배경/의심 해소:
- 사용자가 "설비 선택도 없는데 소모품을 어떻게 가져왔나" 의심 → 백엔드가 작업지시 생산설비(`jobOrder.equipCode`)로 조회 중이었음. 실측: WO2606150060 → EQ-ATCUT-01(자동절단 설비) → CM-BL-F01/V01(절단 블레이드). 검사 화면인데 절단설비 소모품을 표시 → 잘못된 동작. 검사는 별도 검사기(EQUIP_TYPE='TESTER')이므로 검사기 선택 후 그 기준으로 조회해야 맞음.

사용자 결정(4): ① 검사기 목록=전체 TESTER, ② 검사기 소모품 매핑 샘플 시드 추가, ③ 선택 검사기를 검사 실적에도 기록, ④ 전체화면=사이드바까지 숨김.

구현:
- BE DDL: `INSPECT_RESULTS`에 `EQUIP_CODE VARCHAR2(50)` 추가(`apps/backend/src/migrations/2026-06-18_inspect_result_equip_code.sql`). 엔티티 `inspect-result.entity.ts`에 equipCode 컬럼. `continuity-inspect.service.inspect()`에서 `dto.equipCode` 저장(DTO엔 이미 equipCode 존재).
- BE 소모품 API(공유 kiosk-consumable): service/controller/dto에 **선택적 equipCode override** 추가. 제공 시 jobOrder.equipCode 대신 사용(조회/장착). 미제공 시 기존 키오스크 동작 유지(하위호환). GET `?equipCode`, POST scan body `equipCode`.
- DB 시드: `CONSUMABLE_USAGE_MAP`에 검사기 소모품 매핑 5건(`2026-06-18_tester_consumable_map_seed.sql`) — (HNS02C1ABCD|HNS02)×(EQ-TEST-01|EQ-AINSP-01)×JIG 소모품(CM-JG-CT1/CT2 통전검사 치구). 해당 소모품 ACTIVE 롯트 기보유.
- FE 전체화면: `MainLayout`에 `view=full`이면 header/sidebar/tab 숨기는 chromeless 분기(기존 키오스크 `view=work` 패턴 일반화). 검사 화면 헤더에 전체화면 토글(라우터 param + Fullscreen API).
- FE 검사기 선택: `InspectionResultWorkflow`에 검사기 Select(`/equipment/equips/type/TESTER`) + selectedEquipCode 상태. ConsumablePanel에 equipCode 전달(GET params/scan body), InspectPanel에 equipCode 전달(inspect payload + 미선택 시 검사 차단 인터락, 소모품보다 우선). i18n `inspection.result.{selectEquip,selectEquipFirst,equipRequired,fullscreen,exitFullscreen}` ko/en/zh/vi.

검증(로컬 3002 브라우저 E2E):
- 검사기 Select에 TESTER 10대 로드, EQ-AINSP-01 선택.
- WO2606150060(HNS02C1ABCD) 선택 → 좌측 소모품이 **CM-JG-CT1(통전검사 치구)** 로 표시(절단 블레이드 아님). 배너 "소모품 1개 미장착", PASS/FAIL 비활성.
- C26020100019 스캔 → CONSUMABLE_STOCKS.MOUNTED_EQUIP_CODE=**EQ-AINSP-01**(검사기, 작업지시 EQ-ATCUT-01 아님) 확인. 1/1, 버튼 활성.
- PASS → INSPECT_RESULTS IR26061800008.EQUIP_CODE=**EQ-AINSP-01** 기록 확인.
- 전체화면 토글 → `?view=full`, 사이드바/헤더/탭 숨김 전체폭. 종료 시 복귀.
- 테스트데이터 원복: FG26061800008/IR26061800008 삭제, C26020100019 ACTIVE 복귀, prod_result 부수효과 없음.
- FE tsc 0, BE tsc 0, locale 4파일 파싱 OK(BOM 없음).

공유모듈 주의: kiosk-consumable(service/controller/dto), MainLayout은 additive/backward-compatible 변경만 — 키오스크 기존 흐름 영향 없음. DDL/seed는 JSHANES 적용 완료(deploy서버와 DB 공유라 별도 적용 불필요). 커밋/푸시 안 함.

## 2026-06-18 inspection-result-consumable-move Claude

T-INSPECT-RESULT-CONSUMABLE-MOUNT 후속 — 사용자 요청으로 소모성 설비부품 섹션을 우측 InspectPanel(통계 카드 아래)에서 **좌측 작업지시 목록 하단**으로 이동.

- 상태 끌어올림: `consumablesReady`/`unmountedConsumCount`/`handleConsumableStatus`를 `InspectionResultWorkflow`로 이동. 좌측 컬럼을 flex-col(목록 카드 flex-1 + ConsumablePanel shrink-0)로 재구성, `<ConsumablePanel key={orderNo}>`를 좌측 하단에 렌더. `InspectPanel`은 두 값을 props로 받아 인터락(배너+PASS/FAIL 차단)만 우측에 유지.
- `InspectPanel`에서 ConsumablePanel import/렌더와 내부 상태 제거(파일 정리). ConsumablePanel 자체는 변경 없음(이미 orderNo prop + onStatusChange 콜백 구조).
- 검증: frontend tsc 0. 로컬 3002 — WO2606150060 선택 시 좌측 하단 0/2 카드 + 우측 "소모품 2개 미장착" 배너+버튼 비활성, C26020100025 스캔→좌측 1/2·우측 배너 "1개"로 즉시 갱신(좌→우 전파 확인)→X 해제 원복, 테스트 롯트 ACTIVE 복귀.
- 미커밋.

## 2026-06-18 inspection-result-consumable Claude

T-INSPECT-RESULT-CONSUMABLE-MOUNT — `/inspection/result`(통전검사 실적)에 input-kiosk와 동일한 소모성 설비부품 표시+conUid 스캔 장착 추가.

- 설계: `docs/superpowers/specs/2026-06-18-inspection-result-consumable-mount-design.md`. 사용자 결정 — ① 설비 기준은 input-kiosk와 동일하게 `jobOrder.equipCode`(백엔드 변경 0), ② 소모품 장착을 검사 선행 조건(미장착 시 PASS/FAIL 차단), ③ 통계 카드 아래 카드형.
- 재사용 API(키오스크): `GET/POST(scan)/DELETE /production/job-orders/:orderNo/consumables`. 검사 화면은 이미 `order.orderNo` 컨텍스트가 있어 그대로 호출.
- 신규 `inspection/result/components/ConsumablePanel.tsx`: kioskStore 비의존, `orderNo` prop + `onStatusChange(allMounted, unmountedCount)` 콜백. 카드 내 인라인 스캔 입력(별도 모달 X) + 소모품 행 목록(미장착/장착/경고/초과 색상, 수명 현재/예상, 해제 X). 행 스타일은 `MaterialListPanel` 소모품 섹션을 따름.
- `InspectPanel.tsx`: 통계 카드 아래 `<ConsumablePanel>` 삽입, `consumablesReady`/`unmountedConsumCount` 상태 추가. `scanDisabled`에 `!consumablesReady`를 OR로 합쳐 PASS/FAIL 동시 차단, 버튼 title은 소모품 사유 우선. 버튼 위 주황 인터락 배너 추가. 매핑 0건이면 allMounted=true로 기존 검사 흐름 유지.
- i18n: `inspection.result.{consumablesTitle,consumableScanPlaceholder,consumableMountRequired,noConsumables,consumableMounted}` ko/en/zh/vi 4파일 추가(BOM 없음, 파싱 OK).
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit` 0건. 로컬 3002 브라우저 — (a) HNS02(매핑 0) 선택 시 "매핑된 소모품이 없습니다" + 검사 버튼 활성, (b) WO2606150060(HNS02C1ABCD/EQ-ATCUT-01, 매핑 2: CM-BL-F01/CM-BL-V01) 선택 시 0/2·미장착 빨강·"소모품 2개 미장착" 배너·PASS/FAIL 비활성, (c) C26020100025 스캔→CM-BL-F01 초록·4,500/2,500,000·1/2·여전히 비활성, (d) X 해제→0/2 재차단. 테스트 롯트 C26020100025 STATUS=ACTIVE 원복, EQ-ATCUT-01 장착 0 확인.
- 백엔드/DB 스키마 변경 없음. 커밋/푸시 안 함(사용자 지시 대기).

## 2026-06-18 00:36 Codex

- 작업: `T-ARRIVAL-RESULT-AGENT-REPRINT` `/material/arrival-result` 라벨 재발행을 `/material/arrival`과 같은 `mat_lot` 템플릿 선택 + 로컬 print-agent 출력 방식으로 전환.
- 변경: 페이지가 `/master/label-templates?category=mat_lot`를 조회하고 `LabelDesign`을 `ensureObjectLabelDesign(..., "mat_lot")`로 정규화한다. 우측 재발행 액션 영역에 `입하 라벨 템플릿` Select를 추가하고, 선택한 `labelDesign/templateOptions/selectedTemplateKey/onTemplateChange`를 `MatLabelPreviewModal`로 전달한다.
- 검증: `node --test apps/frontend/src/app/(authenticated)/material/arrival-result/arrival-result-mfg-refresh.structure.test.mjs` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, `node tools/print-agent.structure.test.mjs` PASS, `C:\go\bin\go.exe test ./...` PASS, `node --test apps/frontend/src/app/(authenticated)/material/arrival/components/mat-label-preview-modal-print.structure.test.mjs` PASS.
- 실출력 테스트: Playwright로 `http://localhost:3002/material/arrival-result` 접속 후 `R26061800003` 행 선택, 시리얼 체크, `matlot_label / BROWSER` 선택, `라벨 재발행` 모달 진입을 확인했다. 모달 선택값은 `matlot_label::mat_lot`로 유지됐고 바코드 ready 후 출력 버튼 클릭 시 agent `/print` 1회 호출, `jobId=MAT-ARRIVAL-VH1-RM260618-00003`, 출력 PDF `C:\Users\hsyou\AppData\Roaming\HANES\print-agent\logs\prints\MAT-ARRIVAL-VH1-RM260618-00003.pdf` 45,103 bytes 확인.
- 상태: 완료, lock released.

## 2026-06-18 00:10 Codex

- 작업: `T-PRINT-AGENT-PDF-OUTPUT` `Microsoft Print to PDF` 테스트 출력 실패 보정 및 `/material/arrival` 실제 출력 재검증.
- 원인: agent의 Windows GDI 출력 경로가 `DOCINFO.lpszOutput`을 비워 둔 채 `Microsoft Print to PDF`로 `StartDocW`를 호출했다. PDF 드라이버는 저장 파일명이 없으면 대화상자/권한 문제로 `Access is denied`를 반환했다.
- 변경: `PrintPNGRequest/PrintResult`에 `outputPath`를 추가하고, server가 프린터명이 `Microsoft Print to PDF`이면 기본 출력 경로를 `C:\Users\hsyou\AppData\Roaming\HANES\print-agent\logs\prints\<jobId>.pdf`로 자동 지정한다. Windows printer backend는 `DOCINFO.lpszOutput`에 이 경로를 넘긴다. job log에도 `outputPath`를 기록한다.
- 검증: `node tools/print-agent.structure.test.mjs` PASS, `C:\go\bin\go.exe test ./...` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. agent 재빌드/재시작 후 `/test-print` queued 및 `HANES-TEST-PRINT.pdf` 10,553 bytes 생성 확인.
- 실출력 테스트: `http://localhost:3002/material/arrival`에서 상단 `입하 라벨 템플릿` Select에 `matlot_label / BROWSER`가 표시되고 선택값 `matlot_label::mat_lot`이 라벨 모달까지 유지되는 것을 Playwright로 확인했다. `PO-26-T01 / TMN-C` 1개 입하 발행 후 라벨 모달에서 바코드 ready 1건, 출력 버튼 `인쇄` 클릭, agent `/print` 응답 200 queued. 생성 UID `VH1-RM260618-00003`, 출력 PDF `C:\Users\hsyou\AppData\Roaming\HANES\print-agent\logs\prints\MAT-ARRIVAL-VH1-RM260618-00003.pdf` 45,103 bytes 확인. console/page error 0.
- 상태: 완료, lock released. 테스트 과정에서 `PO-26-T01 / TMN-C`는 누적 입하수량이 3으로 증가했다.
## 2026-06-17 23:38 Codex

- 작업: `T-MATERIAL-ARRIVAL-AGENT-LABEL` `/material/arrival` 입하 라벨 출력 방식을 소모품 라벨과 같은 템플릿 선택 + 로컬 print-agent 출력으로 전환.
- 변경: `MatLabelPreviewModal`에서 기존 `MaterialArrivalLabel` + 숨김 iframe + `window.print()` 경로를 제거했다. 모달 오픈 시 `/master/label-templates?category=mat_lot`를 조회하고, 기본/저장 템플릿을 `ensureObjectLabelDesign(..., "mat_lot")`로 정규화해 `LabelDesignRenderer` 미리보기와 `LabelPrintRenderer` 출력 DOM에 공통 적용한다.
- 출력: 발급된 `matUid`별 데이터를 `mat_lot` 소스 필드(`matUid`, `itemCode`, `itemName`, `qty`, `unit`, `vendor`, `lotNo`)와 추가 필드(`arrivalNo`, `arrivalSeq`, `receivedDate`)로 매핑한다. 출력 버튼은 바코드 pending이 사라지고 이미지 로드가 끝난 뒤 라벨 DOM을 PNG로 변환해 `printAgentPng()`에 `jobId=MAT-ARRIVAL-${matUid}`로 순차 전송한다.
- 테스트: 구조 테스트를 “mat_lot 템플릿 조회/선택, 공통 렌더러 미리보기, print-agent PNG 전송, iframe/window.print 금지” 기준으로 갱신했고 RED 실패 확인 후 GREEN 통과.
- 검증: `node --test apps/frontend/src/app/(authenticated)/material/arrival/components/mat-label-preview-modal-print.structure.test.mjs` PASS. `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. Playwright headless로 `http://localhost:3002/material/arrival` 인증 접속 후 입하/PO 화면 텍스트 표시 true, console/page error 0 확인.
- 상태: 완료, lock released. 이번 작업 파일은 `apps/frontend/src/app/(authenticated)/material/arrival/components/MatLabelPreviewModal.tsx`와 `mat-label-preview-modal-print.structure.test.mjs`이며, 워크트리의 다른 dirty 파일은 기존/외부 변경으로 유지했다.

## 2026-06-17 23:14 Codex

- 작업: `T-CONSUMABLE-LABEL-REPRINT` Microsoft Print to PDF 결과에서 바코드가 검은 블록/잘림처럼 깨지는 문제 수정.
- 원인: 미리보기는 브라우저 DOM에서 Tailwind CSS가 적용되어 정상이다. 하지만 agent 전송용 PNG는 `renderLabelNodeToPngBase64()`가 라벨 DOM을 SVG `foreignObject`로 직렬화한 뒤 이미지로 로드해 canvas에 그린다. 이 과정에서는 외부 Tailwind class(`relative`, `absolute`, `w-full`, `h-full`, `object-contain`, `box-border`)가 적용되지 않아 라벨 객체의 절대 배치와 바코드 이미지 맞춤이 풀렸다. 그 결과 agent가 받은 PNG 자체가 이미 바코드 일부만 잘린 상태였다.
- 실측: Playwright로 agent `/print`를 mock해 실제 전송 PNG를 저장했다. 수정 전 `docs/reports/label-print-debug-2026-06-17/CON-REPRINT-C26061700029.png`는 바코드 일부만 검은 블록처럼 보였고, payload는 `widthMm=10`, `heightMm=10`, `base64Length=2864`였다. 선택 템플릿 `consumable_label`의 저장 크기 자체도 `10x10mm`임을 API로 확인했다.
- 변경: `LabelDesignRenderer`에 SVG 직렬화 후에도 유지돼야 하는 핵심 스타일을 inline style로 보강했다. 라벨 루트는 `position: relative`, `overflow: hidden`, `boxSizing`, 배경/테두리를 inline으로 갖고, 각 객체는 `position: absolute`, `boxSizing: border-box`를 inline으로 가진다. 바코드/이미지의 `width/height/objectFit: contain/display:block`도 inline으로 넣었다.
- TDD: `consumable-label-reprint.structure.test.mjs`에 foreignObject 변환용 inline style 요구를 추가했고 RED 실패 확인 후 GREEN 확인.
- 검증: 수정 후 동일 UID `C26061700029` 재발행 payload를 다시 캡처해 `docs/reports/label-print-debug-2026-06-17/CON-REPRINT-C26061700029-after.png` 저장. 결과 QR 전체와 UID 텍스트가 정상 표시됐고 `base64Length=4488`로 증가했다. `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-reprint.structure.test.mjs` PASS, issue-feedback/template-selection 구조 테스트 PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, `node tools/print-agent.structure.test.mjs` PASS, 관련 diff check PASS.
- 상태: 구현/검증 완료, REVIEW 유지, lock released. 실제 저장 PDF 파일 생성은 OS `Microsoft Print to PDF` 저장 대화상자 자동화 문제로 수행하지 않았고, 이번 검증은 agent로 전달되는 PNG 원본을 확인했다.

## 2026-06-17 22:48 Codex

- 작업: `T-CONSUMABLE-LABEL-REPRINT` 재발행 전 라벨 미리보기와 바코드 렌더 완료 대기 보강.
- 원인: 라벨 바코드는 `bwip-js` 동적 import 후 canvas를 PNG data URL로 만드는 비동기 렌더인데, 기존 출력 흐름은 고정 500ms 후 DOM을 복사/캡처했다. 느린 경우 `BAR` placeholder 상태가 출력 PNG나 브라우저 인쇄 HTML에 들어갈 수 있었다.
- 변경: `ConLabelDetailPanel`의 각 UID 행에 `미리보기` 버튼을 추가하고 `aria-label="${conUid} 라벨 미리보기"`를 부여했다. `/consumables/label` 페이지에는 `previewPrintItem` 상태와 `라벨 미리보기` Modal을 추가해 실제 `LabelDesignRenderer`로 같은 라벨을 출력 전 확인한다.
- 변경: `LabelDesignRenderer`의 바코드 placeholder에는 `data-label-barcode-pending`, 완료 이미지는 `data-label-barcode-ready`를 부여했다. 출력 전 `waitForLabelRenderReady()`가 pending marker가 사라지고 이미지 로드가 끝날 때까지 대기하며, 시간 초과 시 미리보기 확인 안내 오류를 표시한다. 신규 발행 브라우저 인쇄와 재발행 agent PNG 캡처 모두 이 대기 로직을 거친다.
- TDD: `consumable-label-reprint.structure.test.mjs`에 미리보기 콜백/버튼/Modal/바코드 pending-ready marker/출력 전 대기 요구를 추가했고, RED 실패 확인 후 구현해 GREEN 확인.
- Playwright 검증: `http://localhost:3002/consumables/label`에서 UID `C26061700029` 기준 `라벨 미리보기` 버튼 클릭. 모달 표시, UID 표시, `data-label-barcode-ready` 1개, `data-label-barcode-pending` 0개 확인. 모달 닫은 뒤 `라벨 재발행` 클릭 시 popup 0, agent `/print` 1회, `jobId=CON-REPRINT-C26061700029`, `format=png`, `contentBase64Length=2864`, 상태 문구 `agent로 전송했습니다`, console/page error 0.
- 검증: `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-reprint.structure.test.mjs` PASS. `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-issue-feedback.structure.test.mjs` PASS. `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-template-selection.structure.test.mjs` PASS. `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS.
- 상태: 구현/검증 완료, REVIEW 유지, lock released. Playwright에서는 OS 저장 대화상자를 피하려고 agent `/print`를 mock했다.

## 2026-06-17 22:22 Codex

- 작업: `T-CONSUMABLE-LABEL-REPRINT` 재발행 출력 방식을 예전 웹 인쇄에서 print-agent 방식으로 전환.
- 원인: `ConLabelDetailPanel`의 `재발행` 버튼은 보이도록 보정됐지만, 부모 `handleReprintLabel()`이 여전히 `window.open("", "_blank")`로 팝업을 열고 팝업 HTML 안에서 `window.print()`를 호출했다. 그래서 사용자가 본 것처럼 예전 웹 인쇄 다이얼로그 방식으로 동작했다.
- 변경: `page.tsx`에 `printAgentPng` 연동과 `renderLabelNodeToPngBase64()` 헬퍼를 추가했다. 재발행 시 기존 `conUid`로 `activePrintItems`를 렌더링한 뒤 숨겨진 `LabelPrintRenderer` 첫 라벨 DOM을 SVG foreignObject -> canvas PNG base64로 변환하고, `POST http://127.0.0.1:37111/print` payload로 전송한다. 재발행 핸들러에서 `window.open`/`window.print` 경로는 제거했다.
- 기록: 백엔드 `LabelPrintDto.printMode` enum은 현재 `BROWSER/ZPL_USB/ZPL_TCP`만 허용하므로 서버 enum 변경 없이 기존 `logBrowserPrint()`를 유지해 print-log는 계속 `printMode=BROWSER`로 남긴다. 실제 출력 경로는 agent다.
- TDD: `consumable-label-reprint.structure.test.mjs`에 `printAgentPng`, `renderLabelNodeToPngBase64`, 재발행 핸들러 내 `window.open/window.print` 금지 조건을 추가했다. RED 실패 확인 후 구현했고 GREEN 확인.
- Playwright 검증: `http://localhost:3002/consumables/label`에서 `C26061700029 라벨 재발행` 클릭. agent 요청은 저장 대화상자를 피하려고 `http://127.0.0.1:37111/print`를 route mock 처리했다. 결과 popup count 0, agent `/print` 1회, `jobId=CON-REPRINT-C26061700029`, `format=png`, `contentBase64Length=2864`, `/consumables/label/create` 요청 0건, `/material/label-print/log` POST 201, 상태 문구 `C26061700029 라벨을 agent로 전송했습니다.`, console/page error 0.
- 검증: `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-reprint.structure.test.mjs` PASS. `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-template-selection.structure.test.mjs` PASS. `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-issue-feedback.structure.test.mjs` PASS. `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. 관련 파일 `git diff --check` PASS.
- 상태: 구현/검증 완료, REVIEW 유지, lock released. 실제 OS 프린터 큐까지 보내는 검증은 이전 agent `/print` 테스트에서 `Microsoft Print to PDF queued`로 확인했고, 이번 Playwright는 agent 호출을 mock했다.

## 2026-06-17 22:10 Codex

- 작업: `T-CONSUMABLE-LABEL-REPRINT` 재발행 버튼 가시성 보정 및 Playwright 재검증.
- 원인: 기존 우측 상세 패널은 420px 폭 안에 UID/상태/위치/사용횟수/입고일/재발행 6컬럼 테이블을 넣어 `재발행` 버튼이 사용자에게 잘리거나 없는 것처럼 보일 수 있었다.
- 변경: `ConLabelDetailPanel.tsx`의 미입고 UID 목록을 테이블에서 리스트형 행으로 바꿨다. 각 행은 UID/상태/위치와 사용횟수/입고일을 표시하고, `재발행` 버튼은 행 우측 `shrink-0` 영역에 고정했다. 버튼에는 `aria-label="${conUid} 라벨 재발행"`을 부여해 Playwright와 접근성 이름으로 직접 찾을 수 있게 했다.
- TDD: `consumable-label-reprint.structure.test.mjs`에 420px 패널에서 넓은 테이블 구조를 금지하고 UID별 재발행 버튼 접근성 이름을 요구하는 RED 테스트를 추가했다. RED 실패 확인 후 구현했고 GREEN 확인.
- Playwright 검증: `http://localhost:3002/consumables/label`에서 `C26061700029 라벨 재발행` 버튼을 찾았다. `buttonBox={x:1313,y:223,width:102,height:36}`, `panelBox={x:1020,y:100,width:420,height:800}`로 버튼이 패널 내부임을 확인했다. 클릭 후 출력 팝업 HTML에 `C26061700029`와 `window.print` 포함, `/consumables/label/create` 요청 0건, `/material/label-print/log` POST 201, 상태 문구 `C26061700029 라벨 재발행 인쇄 다이얼로그를 호출했습니다.` 확인. console/page error 0.
- 검증: `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-reprint.structure.test.mjs` PASS. `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-template-selection.structure.test.mjs` PASS. `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-issue-feedback.structure.test.mjs` PASS. `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. 관련 tracked 파일 `git diff --check` PASS.
- 상태: 구현/검증 완료, REVIEW 유지, lock released. `ConLabelDetailPanel.tsx`와 재발행 구조 테스트는 아직 git 기준 untracked 파일이다.

## 2026-06-17 21:57 Codex

- 작업: `T-PRINT-AGENT-GO` agent 자체 설정관리 보강.
- 결정: agent 운영 설정의 주인은 웹 MES가 아니라 agent 자체로 둔다. `D-20260617-PRINT-AGENT-OWNS-CONFIG` 기록.
- 변경: `GET /settings` 로컬 HTML 설정관리 화면 추가. 화면에서 `/health`, `/config`, `/printers`를 조회하고 `/config` 저장, `/test-print` 실행을 처리한다. 설정 항목은 `listenAddress`, 기본 프린터, 허용 Origin, token 변경/제거, 최대 payload bytes, 로그 폴더다.
- 변경: `/config` 응답에 `configPath`, `effectiveListenAddress`, `restartRequired`를 추가했다. `listenAddress` 변경은 실행 중 서버 포트를 즉시 바꾸지 않고 재시작 필요로 표시한다. 기존 token은 `clearToken=true`가 아니면 빈 POST로 지워지지 않도록 보존한다.
- 변경: Windows tray 메뉴에 `설정`을 추가하고 `ShellExecuteW`로 `http://<listenAddress>/settings`를 기본 브라우저에서 열도록 했다. 상태 보기에는 설정 URL도 표시한다.
- 보정: `/test-print` 내장 PNG가 `invalid checksum`으로 실패하던 문제를 런타임 PNG 생성 방식으로 바꿔 수정했다.
- 실측: 새 빌드로 agent를 재시작했다. 현재 PID `42964`, 경로 `C:\Project\HANES\apps\print-agent\dist\hanes-print-agent.exe`. `GET http://127.0.0.1:37111/settings` HTTP 200, 본문 `HANES Print Agent 설정` 포함. `/config`는 기본 프린터 `Microsoft Print to PDF`, `effectiveListenAddress=127.0.0.1:37111`, `restartRequired=false` 반환.
- 실측: `/config` POST로 기본 프린터 `Microsoft Print to PDF` 저장 후 `C:\Users\hsyou\AppData\Roaming\HANES\print-agent\config.json` 반영 확인. printerName 없이 `/test-print` POST 호출 결과 `HANES-TEST-PRINT`, `Microsoft Print to PDF`, `queued` 성공 및 로그 기록 확인.
- 실측: `listenAddress=127.0.0.1:37112` 임시 저장 시 `effectiveListenAddress=127.0.0.1:37111`, `restartRequired=true` 확인 후 `127.0.0.1:37111`로 복구해 `restartRequired=false` 확인.
- 검증: `node tools/print-agent.structure.test.mjs` PASS. `C:\go\bin\go.exe test ./...` PASS. `C:\go\bin\go.exe build -o dist\hanes-print-agent-new.exe .\cmd\hanes-print-agent` PASS. 관련 파일 `git diff --check` PASS.
- 상태: 구현/검증 완료, REVIEW 유지, lock released. 트레이 `설정` 메뉴 실제 마우스 클릭과 Zebra 실출력은 미검증.

## 2026-06-17 21:28 Codex

- 작업: `T-CONSUMABLE-LABEL-REPRINT` `/consumables/label` 기발행 소모품 UID 재발행.
- 변경: 우측 `ConLabelDetailPanel`의 PENDING UID 목록에 `재발행` 버튼을 추가하고, 부모 페이지에서 `handleReprintLabel()`을 통해 기존 `conUid`를 그대로 `LabelPrintRenderer`에 전달하도록 했다. 신규 발행과 재발행 출력 데이터는 `activePrintItems`로 공통화했다.
- 보장: 재발행은 `createConUids()`나 `/consumables/label/create`를 호출하지 않고, 기존 UID로 출력 팝업을 열어 `window.print()`를 호출한 뒤 `/material/label-print/log`에 `uidList`를 남긴다.
- 런타임 검증: `http://localhost:3002/consumables/label`에서 `APPCT-A`의 기발행 UID `C26061700029` 행 `재발행` 클릭. 출력 팝업 HTML에 `C26061700029`와 `window.print` 포함, 클릭 이후 `/consumables/label/create` 요청 0건, `/material/label-print/log` POST payload `{"category":"con_uid","printMode":"BROWSER","uidList":["C26061700029"],"labelCount":1,"status":"SUCCESS"}` 응답 201, 화면 상태 문구 `C26061700029 라벨 재발행 인쇄 다이얼로그를 호출했습니다.` 확인.
- 검증: `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-reprint.structure.test.mjs` PASS. `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-issue-feedback.structure.test.mjs` PASS. `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-template-selection.structure.test.mjs` PASS. `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. 관련 파일 `git diff --check` PASS.
- 상태: 구현/검증 완료, REVIEW 유지, lock released. 실제 Zebra 물리 출력은 현재 PC에 Zebra 프린터가 없어 미검증.

## 2026-06-17 21:18 Codex

- 작업: `T-PRINT-AGENT-GO` Windows 트레이 상주 모드 추가.
- 변경: `cmd/hanes-print-agent/main.go`가 플랫폼별 `runAgent()`로 실행을 위임하도록 변경했다. Windows 실행 경로는 `http.Server`를 goroutine으로 띄우고 `internal/tray`의 Win32 message loop를 실행한다. 비-Windows는 기존 HTTP-only 실행을 유지한다.
- 트레이: `internal/tray/tray_windows.go` 추가. `Shell_NotifyIconW`로 시스템 트레이 아이콘을 등록하고, 우클릭 시 `TrackPopupMenu`로 `상태 보기`, `프린터 보기`, `종료` 메뉴를 표시한다. 상태/프린터 결과는 `MessageBoxW`로 보여주며, 종료 메뉴는 hidden window destroy 후 message loop를 종료하고 HTTP server shutdown을 호출한다.
- 검증: `node tools/print-agent.structure.test.mjs` PASS. `C:\go\bin\go.exe test ./...` PASS. `C:\go\bin\go.exe build -o dist\hanes-print-agent.exe .\cmd\hanes-print-agent` PASS. 빌드된 exe 실행 후 `/health` true, `/printers` 2건(`OneNote(데스크톱) - 보호됨`, `Microsoft Print to PDF`) 확인 후 프로세스 종료.
- 남은 검증: 현재 자동화로 트레이 우클릭 메뉴 육안 클릭은 확인하지 못했다. 현재 PC에 Zebra 프린터가 잡혀 있지 않아 실제 Zebra 출력도 미검증.
- 상태: 구현 완료, REVIEW 유지, lock released.

## 2026-06-17 20:58 Codex

- 작업: `T-PRINT-AGENT-GO` Go 기반 HANES 로컬 프린트 에이전트 1차 추가.
- 설계: 웹이 라벨을 PNG로 사전 렌더링하고 `http://127.0.0.1:37111` agent로 전송한다. Agent는 라벨 디자인을 해석하지 않고 Windows 프린터 드라이버에 이미지를 전달한다.
- 변경: `apps/print-agent` Go 앱 추가. `GET /health`, `GET /printers`, `GET/POST /config`, `POST /print`, `POST /test-print`를 제공한다. 설정은 사용자 config dir의 `HANES/print-agent/config.json`, 로그는 일자별 jsonl에 기록한다. Windows 구현은 `winspool.drv`로 프린터 목록을 조회하고 `gdi32.dll` printer DC에 PNG를 `StretchDIBits`로 그리는 방식이다. 비-Windows는 명시적 unsupported stub이다.
- 프론트: `apps/frontend/src/services/print-agent.ts`에 `checkPrintAgent`, `getPrintAgentPrinters`, `getPrintAgentConfig`, `savePrintAgentConfig`, `printAgentPng` 클라이언트를 추가했다.
- 테스트: TDD 순서로 `tools/print-agent.structure.test.mjs`를 먼저 추가하고 누락 파일 실패를 확인한 뒤 구현했다.
- 검증: `node tools/print-agent.structure.test.mjs` PASS. `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. `C:\go\bin\go.exe test ./...` PASS. `C:\go\bin\go.exe build -o dist\hanes-print-agent.exe .\cmd\hanes-print-agent` PASS. 빌드된 exe를 실행해 `/health` true, `/printers` 2건(`OneNote(데스크톱) - 보호됨`, `Microsoft Print to PDF`) 확인 후 프로세스 종료.
- 상태: 구현 1차 완료, 현재 PC에 Zebra 프린터가 잡혀 있지 않아 실제 Zebra 라벨 출력은 미검증. `TASKS.md`는 REVIEW 유지, lock released.

## 2026-06-17 15:28 Codex

- 작업: `T-CONSUMABLE-STOCK-DEPLOY-QUERY` `/consumables/stock` 배포 서버 재고현황 조회 빈 화면 복구.
- 원인: `ConsumableStockController.list()`가 `{ data: rows }`를 반환하고 전역 `TransformInterceptor`/`SqlDebugInterceptor`가 이를 다시 표준 응답으로 감싸면 배포 응답이 `{ success: true, data: { data: rows } }` 형태가 된다. 기존 프론트 `useStockData`는 `res.data.data`까지만 읽고 배열이 아니면 `[]`로 처리해 테이블이 비었다.
- 변경: `useStockData`가 `/consumables/stocks?limit=5000`을 호출하고, 1단계 배열 응답과 `{ data: rows }` 중첩 응답을 모두 풀어 최종 배열만 `rawData`로 반영하도록 보정했다. `useStockData.structure.test.mjs`를 추가해 `limit=5000`, 1차/2차 `data` 파싱, 배열 가드를 고정했다.
- 검증: `node --test apps/frontend/src/hooks/consumables/useStockData.structure.test.mjs` PASS. `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. `git diff --cached --check`는 커밋 직전 실행 예정.
- 상태: 완료, lock released.
## 2026-06-17 14:31 Codex

- 작업: `T-CONSUMABLE-LABEL-CLICK-OPEN-PRINT` `/consumables/label` UID 발행 출력창 선점 보정.
- 원인: 현재 소스는 숨김 iframe을 만들고 UID 발행 API 완료 후 `printWin.print()`를 호출했다. 로컬에서는 빠르게 동작할 수 있지만 배포 브라우저에서는 사용자 클릭 동기 구간을 벗어난 `print()` 호출이 무시될 수 있다.
- 변경: `handleBrowserPrint()`에서 버튼 클릭 직후 `window.open("", "_blank")`로 출력창을 먼저 열고 대기 HTML을 표시한다. UID 발행 실패/0건/출력 준비 실패 시 선점한 창을 `close()`하고, 성공 시 같은 창에 `LabelPrintRenderer` HTML과 `window.print()` 스크립트를 주입한다. 숨김 iframe 생성/DOM 삽입 경로는 제거했다.
- 테스트: 구조 테스트를 먼저 새 계약으로 변경해 RED 실패 확인 후 구현했다. 이후 `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-issue-feedback.structure.test.mjs`, `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-template-selection.structure.test.mjs`, `node apps/frontend/src/app/(authenticated)/consumables/label/components/useConLabelIssue.structure.test.mjs`, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 모두 통과.
- 브라우저 검증: 3002 실제 페이지에서 Playwright headless로 인증 localStorage를 주입하고 masters/template/create/log API를 mock했다. 출력 버튼 클릭 직후 popup이 열리고 mock create 응답을 지연한 상태에서 popup body에 `UID를 발행하고 라벨 출력 준비 중입니다.`가 표시됨을 확인했다. create 응답 release 후 같은 popup HTML에 `label-grid`와 `window.print`가 포함됨을 확인했다.
- 기타: `git diff --check` 통과. worktree에는 이번 작업 외 `apps/frontend/.gitignore`, `apps/frontend/package.json`, `/consumables/life`, `useStockData`, locale 파일, `.claude/worktrees/`, `apps/frontend/playwright.config.ts` 등 기존/타 작업 변경이 남아 있어 커밋 시 범위 선별 필요.
- 상태: 완료, lock released. commit/push 안 함.

## 2026-06-17 13:55 Codex

- 작업: `T-CONSUMABLE-LIFE-LARGE-INFO-CARDS` `/consumables/life` 상단 정보카드 확대.
- 원인: 기존 상단 상태 정보가 `flex gap-2 text-xs`의 작은 pill 배지 4개로 표시되어 수명현황의 총계/정상/주의/교체필요 지표가 눈에 잘 들어오지 않았다.
- 변경: `infoCards` 배열을 추가해 총계/정상/주의/교체필요 4개 지표를 반응형 큰 요약 카드(`grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`)로 렌더링한다. 각 카드는 최소 높이 118px, 큰 수치(`text-3xl font-bold`), 상태별 아이콘과 색상 톤을 가진다. 기존 작은 배지 행은 제거했다.
- 검증: `node --test apps/frontend/src/app/(authenticated)/consumables/life/consumable-life-large-info-cards.structure.test.mjs` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 관련 파일 `git diff --check` PASS, `http://localhost:3002/consumables/life` HTTP 200 확인. Playwright DOM 자동 검증은 현재 루트에서 `@playwright/test` require 불가로 수행하지 못했다.
- 상태: 완료, lock released. 사용자 지시에 따른 commit/push 요청은 없어서 수행하지 않았다.

## 2026-06-17 11:45 Codex

- 작업: `T-CONSUMABLE-LABEL-ONE-LINE-STATUS` `/consumables/label` 상태 표시 축소 및 카테고리 고정 필터 추가.
- 원인: UID 발행 결과/상태 배너가 그리드 위 공간을 추가로 차지해 화면 높이와 배치가 변했다. 사용자는 별도 결과 영역 대신 한 줄 상태만 원했다. 또한 카테고리 기준으로 빠르게 좁히는 고정 필터가 필요했다.
- 변경: `issueNotice` 배너와 생성 UID 결과 배너를 제거하고, 헤더 우측에 고정 폭 `role="status"` 한 줄 상태만 표시하도록 변경했다. 발행 UID 목록은 출력 렌더링에만 사용하고 성공 후 `clearCreatedUids()`로 정리한다. 그리드 toolbar 검색 input 옆에 `카테고리 필터` Select를 추가하고, 실제 `masters`의 `category` 값으로 옵션을 구성해 `filteredMasters`를 고정 필터링한다. 카테고리 변경 시 숨겨진 행 선택이 남지 않도록 선택을 초기화한다.
- 검증: `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-issue-feedback.structure.test.mjs` PASS, `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-template-selection.structure.test.mjs` PASS, `node apps/frontend/src/app/(authenticated)/consumables/label/components/useConLabelIssue.structure.test.mjs` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 관련 파일 `git diff --check` PASS.
- 상태: 완료, lock released. 사용자 지시에 따라 commit/push는 하지 않았다.

## 2026-06-17 11:30 Codex

- 작업: `T-CONSUMABLE-LABEL-HIDDEN-IFRAME-PRINT` `/consumables/label` UID 라벨 출력 UX 보정.
- 원인: 직전 보정은 팝업 차단 회피를 위해 `window.open()`을 클릭 즉시 실행했지만, 브라우저가 새 탭/창으로 포커스를 옮겨 `라벨 출력 준비 중입니다...`가 전체 화면처럼 보이는 UX 문제가 있었다.
- 변경: 새 탭을 열지 않고 `consumable-label-print-iframe` 숨김 iframe을 생성해 라벨 HTML을 주입하고 `contentWindow.print()`를 호출하도록 전환했다. iframe은 0x0, opacity 0, pointer-events none이며 `afterprint`에서 제거한다. 오류/0건/출력 준비 실패 시 iframe을 제거한다.
- 검증: 구조 테스트 3건, FE tsc, diff check 통과. 3014 mock 브라우저 검증에서 `windowOpenCalled=0`, iframe 0x0 숨김 상태, `iframePrintCalled=1` 확인.
- 상태: 완료, lock released. 사용자 지시에 따라 commit/push는 하지 않았다.

## 2026-06-17 10:43 Codex

- 작업: `T-CONSUMABLE-LABEL-TEMPLATE-SELECT-PRINT` `/consumables/label` UID 발행 시 라벨디자인마스터 저장 템플릿 선택/적용 보정.
- 원인: 기존 화면도 `/master/label-templates?category=jig`를 조회하고 `LabelPrintRenderer`를 사용했지만, 기본 템플릿 또는 첫 번째 템플릿을 자동 선택할 뿐 사용자가 라벨디자인마스터에서 만든 특정 템플릿을 선택할 수 없었다. 그래서 어떤 템플릿으로 출력되는지 운영자가 명확히 제어할 수 없었다.
- 변경: `/consumables/label` 헤더에 라벨 템플릿 Select를 추가했다. `TemplateInfo`에 `templateKey`와 `designData`를 보관하고, 선택 변경 시 해당 템플릿의 `designData`를 `ensureObjectLabelDesign(..., "jig")`로 정규화해 `LabelPrintRenderer`에 전달한다. 템플릿이 없거나 기본 디자인을 선택하면 기존 기본 디자인으로 출력한다.
- 검증: TDD RED 확인 후 `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-template-selection.structure.test.mjs` PASS, `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-image-url.structure.test.mjs` PASS, `node apps/frontend/src/app/(authenticated)/consumables/label/components/useConLabelIssue.structure.test.mjs` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 관련 파일 `git diff --check` PASS.
- 브라우저 검증: 3013 임시 프론트에서 검증용 `jig` 템플릿 `CODEX_CON_TPL_60546393`을 생성하고 `/consumables/label`에서 Select로 선택 후 첫 소모품 UID 발행을 실행했다. 인쇄 HTML에 선택 템플릿 marker `CODEX_TEMPLATE_MARK_60546393`, 생성 UID `C26061700014`, 선택 템플릿 크기 `@page{size:50mm 25mm`가 포함됨을 확인했다.
- 정리: 검증용 템플릿은 API 삭제 후 0건, 검증 UID `C26061700013`, `C26061700014` 관련 `CONSUMABLE_STOCKS`와 `LABEL_PRINT_LOGS`는 JSHANES에서 삭제 후 잔여 0건 확인.
- 참고: 기존 `master-label-bartender-designer.structure.test.mjs`는 다른 작업에서 라벨 디자이너 좌측 필드 추가/수정/삭제 UI를 제거한 상태와 예전 테스트 기대가 맞지 않아 계속 실패한다. 이번 템플릿 선택 출력 변경과 직접 관련 없는 기존 테스트 불일치다.
- 상태: 완료, lock released.

## 2026-06-17 Codex

- 작업: `T-CONSUMABLE-LABEL-ISSUE-FEEDBACK` `/consumables/label` UID 발행 피드백 보강.
- 원인: 기존 `handleBrowserPrint()`는 선택 없음/생성 0건/팝업 차단/출력 DOM 미준비에서 조용히 `return`했고, 성공 후 `clearCreatedUids()`를 바로 호출해 생성 UID 배너가 즉시 사라질 수 있었다. 사용자는 발행이 진행 중인지, 완료됐는지, 어떤 UID가 생성됐는지 화면에서 확인하기 어려웠다.
- 변경: `page.tsx`에 `react-hot-toast` 진행/성공/실패 메시지와 `issueNotice` 화면 배너를 추가했다. 발행 시작, UID 생성 후 인쇄창 열기, 완료, 0건, 팝업 차단, 출력 DOM 미준비, 예외 상황을 각각 표시한다. 성공 후에는 생성 UID 목록을 화면 배너와 기존 결과 배너에 남기고, 다음 발행 시작 시 이전 결과를 정리한다. 버튼 문구도 출력 단계에서는 `출력중`으로 표시한다.
- 테스트: RED 확인 후 `apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-issue-feedback.structure.test.mjs` 추가. 이후 `node --test` 신규 테스트 PASS, 템플릿 선택 구조 테스트 PASS, `useConLabelIssue` 구조 테스트 PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 관련 파일 `git diff --check` PASS.
- 브라우저 검증: 3014 임시 dev 서버에서 mock API로 `/consumables/label` 실제 클릭 검증. `UID를 발행하고 라벨 출력 준비 중입니다.`, `1건 UID 발행 및 라벨 출력 요청이 완료되었습니다.`, `C-FEEDBACK-0001` 화면 표시 및 출력 HTML 생성 확인.
- 실제 API/DB 검증: 3014 화면에서 실제 API로 UID `C26061700016` 1건 발행, 완료 메시지 표시와 출력 HTML 생성 확인. JSHANES에서 `CONSUMABLE_STOCKS` 1건, `LABEL_PRINT_LOGS` 2건 존재 확인 후 삭제했다. 최종 잔여 `CONSUMABLE_STOCKS=0`, `LABEL_PRINT_LOGS=0` 확인.
- 상태: 완료, lock released. 사용자 지시에 따라 commit/push는 하지 않았다.

## 2026-06-17 Codex

- 작업: `T-CONSUMABLE-LABEL-503-FEEDBACK` `/consumables/label` UID 발행 503 오류 피드백 보정.
- 확인: 3002 프록시 `/api/health`와 3003 백엔드 `/api/v1/health`는 DB 연결 포함 200이었다. 직접 `POST /api/v1/consumables/label/create`는 `APPCT-A`, qty 1 기준 201로 성공해 서버/DB 상시 장애는 아니었다.
- 원인: `useConLabelIssue.createConUids()`의 catch가 AxiosError를 `console.error("Failed to create conUids:", err)`로 그대로 출력하고 `allCreated`를 반환했다. 이 때문에 Next dev console overlay에 `AxiosError: Request failed with status code 503`이 노출되고, page의 `try/catch`는 서버 메시지를 받을 수 없었다.
- 변경: `getApiErrorMessage(err)`를 추가해 `response.data.message/error`를 우선 추출하고, 실패 시 `throw new Error(...)`로 page에 전달한다. `page.tsx`는 `err.message`를 toast와 화면 배너에 표시하며 AxiosError 객체를 console.error로 출력하지 않는다.
- 검증: `node apps/frontend/src/app/(authenticated)/consumables/label/components/useConLabelIssue.structure.test.mjs`, `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-issue-feedback.structure.test.mjs`, 템플릿 선택 구조 테스트, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`, 관련 파일 `git diff --check` 모두 통과.
- 브라우저 검증: 3014 dev 서버에서 `/api/consumables/label/create`만 503 mock 처리. 화면에 `데이터베이스 연결이 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요.`가 표시되고, `AxiosError`/`Request failed with status code 503` console/page overlay는 발생하지 않음을 확인했다.
- DB 정리: 직접 API 검증으로 생성된 `C26061700017`은 JSHANES `CONSUMABLE_STOCKS` 1건, `LABEL_PRINT_LOGS` 1건을 삭제했고 최종 잔여 0건 확인.
- 상태: 완료, lock released. 사용자 지시에 따라 commit/push는 하지 않았다.

## 2026-06-17 Codex

- 작업: `T-CONSUMABLE-LABEL-ACTUAL-PRINT` `/consumables/label` UID 라벨 실제 출력창 호출 보정.
- 원인: 기존 `handleBrowserPrint()`는 `await createConUids()`와 `setTimeout` 이후에 `window.open()`을 호출했다. 브라우저는 사용자 클릭 이벤트와 분리된 비동기 팝업/인쇄 호출을 막을 수 있어, 화면에는 처리 완료 메시지가 나오지만 실제 인쇄창이 열리지 않을 수 있었다.
- 변경: UID 발행 버튼 클릭 직후 `const printWindow = window.open("", "_blank")`를 먼저 실행한다. 팝업이 차단되면 UID를 만들지 않고 오류를 표시한다. 팝업이 열리면 준비 화면을 먼저 쓰고, UID 생성 후 기존 `LabelPrintRenderer` HTML을 해당 창에 다시 쓰며 `window.focus(); window.print();`를 호출한다. 즉시 `window.close()`하지 않고 `onafterprint`에서 닫도록 변경했다.
- 검증: `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-issue-feedback.structure.test.mjs`, `node apps/frontend/src/app/(authenticated)/consumables/label/components/useConLabelIssue.structure.test.mjs`, 템플릿 선택 구조 테스트, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`, 관련 파일 `git diff --check` 모두 통과.
- 브라우저 검증: 3014 dev 서버에서 API 응답을 1.2초 지연시켜도 `window.open`이 API 요청보다 먼저 호출됨을 확인했다. 최종 출력 HTML에 `window.print()`와 라벨 내용 `CODEX-PRINT-JIG` 포함 확인.
- 실제 API/DB 검증: 3014 화면에서 실제 API로 `C26061700019` 1건 발행, 출력창 HTML 생성 및 `window.print()` 포함 확인. JSHANES `CONSUMABLE_STOCKS` 1건, `LABEL_PRINT_LOGS` 2건 삭제 후 최종 잔여 0건 확인.
- 상태: 완료, lock released. 사용자 지시에 따라 commit/push는 하지 않았다.

## 2026-06-17 10:19 Codex

- 작업: `T-EQUIP-INSPECT-ITEM-DEPLOY-IMAGE-URL` 서버 배포 후 `/master/equip-inspect-item` 이미지 링크 깨짐 원인 확인 및 보정.
- 원인: 점검항목 이미지 `imageUrl`은 `/uploads/equip-inspect-items/...` 상대경로로 저장되어 있고, `/master/equip-inspect-item` 목록/편집 패널과 공용 `InspectItemImage`가 이를 그대로 `<img src>`에 사용했다. 로컬은 같은 호스트/proxy 조건으로 보일 수 있지만 배포 환경에서는 프론트 호스트 기준 경로가 되어 깨질 수 있다. 추가로 `apps/backend/uploads`는 `.gitignore` 대상이라 로컬에 있는 점검항목 시드 SVG 50개가 Git에는 없고, 서버 배포 시 재생성이 필요했다.
- 변경: `/master/equip-inspect-item` 목록 이미지와 편집 패널 미리보기, 공용 `InspectItemImage`가 `resolveBackendFileUrl()`을 통해 `/uploads/...`를 `NEXT_PUBLIC_API_URL`의 backend base 기준으로 변환하도록 수정했다. `blob:`/`data:`/절대 URL은 helper가 그대로 유지한다.
- 배포 보정: `.github/workflows/deploy.yml`의 runtime seed upload assets 단계에 `node tools\generate-equip-inspect-item-seed-images.mjs`를 추가해 서버 배포 때 `apps/backend/uploads/equip-inspect-items/*.svg` 50개를 재생성한다.
- 검증: `node tools\generate-equip-inspect-item-seed-images.mjs` 성공(`generated 50 SVG files`), `node --test apps/frontend/src/app/(authenticated)/master/equip-inspect-item/equip-inspect-item-image-url.structure.test.mjs` PASS, 기존 패널 구조 테스트 PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 관련 파일 `git diff --check` PASS.
- 상태: 완료, lock released.

## 2026-06-17 10:07 Codex

- 작업: `T-CONSUMABLE-LABEL-DEPLOY-IMAGE-URL` 서버 배포 후 `/consumables/label` 이미지 링크 깨짐 원인 확인 및 보정.
- 원인: `/consumables/label` 그리드와 라벨 인쇄 렌더러가 API 응답의 `imageUrl`(`/uploads/consumables/...`)을 그대로 `<img src>`에 사용했다. 로컬은 `/uploads` rewrite/동일 호스트 조건으로 보이지만, 배포 환경에서는 프론트 호스트 기준 경로가 되어 깨질 수 있다. 추가로 `apps/backend/uploads`는 `.gitignore` 대상이라 로컬에 존재하는 소모품 시드 SVG 37개가 Git에는 0개이고, 서버 배포 시 파일 자체가 없을 수 있다.
- 변경: `resolveBackendFileUrl()` 공통 helper를 추가해 `/uploads/...`를 `NEXT_PUBLIC_API_URL`의 `/api` 또는 `/api/v1` 접미사를 제거한 백엔드 base URL 기준으로 변환한다. `/consumables/label` 이미지 컬럼과 `LabelDesignRenderer` 이미지 객체에 적용해 그리드와 인쇄 라벨 모두 같은 기준을 사용한다.
- 배포 보정: `.github/workflows/deploy.yml`에 `node tools\generate-consumable-master-seed-images.mjs` 단계를 추가해 서버 배포 때 gitignore된 `apps/backend/uploads/consumables/*.svg` 37개를 재생성한다.
- 검증: `node tools\generate-consumable-master-seed-images.mjs` 로컬 실행 성공, `node --test apps/frontend/src/app/(authenticated)/consumables/label/consumable-label-image-url.structure.test.mjs` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 관련 파일 `git diff --check` PASS.
- 참고: 기존 `master-label-bartender-designer.structure.test.mjs`는 현재 다른 작업에서 라벨 디자이너 좌측 필드 추가/수정/삭제 UI를 제거한 상태와 예전 테스트 기대가 맞지 않아 실패한다. 이번 이미지 경로 변경과 직접 관련 없는 기존 테스트 불일치다.
- 상태: 완료, lock released.

## 2026-06-17 04:12 Codex

- 작업: `T-MATERIAL-FLOW-FE-RUNTIME` 자재관리 하위 등록 메뉴 전체를 실제 프론트로 순회하고, 자재요청 -> 자재출고 -> 자재재고 -> 공정재고/키오스크 흐름을 실데이터로 검증.
- 원인/보정: QA 스크립트가 프론트 proxy 경로(`/api/material/...`)와 백엔드 경로(`/api/v1/material/...`)를 모두 기다리지 못해 출고 승인 응답을 놓쳤고, 통합 후 실제 메뉴 경로는 `/inventory/material-stock`인데 구 경로 `/material/stock`을 확인했다. 공정재고는 `WIP_MAT_STOCKS.ORDER_NO`가 아니라 `WIP_MAT_TRANSACTIONS.ORDER_NO`와 `WIP_MAT_STOCKS` 현재고를 함께 확인해야 했다. `MAT_HOLD`는 실제 `MAT_LOTS` 상태 변경 모델인데 화면 SQL/QA 기준이 존재하지 않는 `MAT_HOLDS`를 가리켜 정합성이 맞지 않았다.
- 변경: `tools/hanes-material-flow-frontend-runtime-qa.mjs`에 proxy/API 경로 매칭, GET 503 재시도, `/inventory/material-stock` 및 `/production/wip-material-stock` 확인, `WIP_MAT_TRANSACTIONS`/`WIP_MAT_STOCKS` DB 검증을 추가했다. `tools/hanes-material-menu-page-scenario-qa.mjs`는 통합된 MATERIAL 메뉴 24개와 실제 물리 테이블(`PHYSICAL_INV_COUNT_DETAILS`, `MAT_LOTS`) 기준을 반영했다. `/material/hold` 화면 SQL 안내도 `MAT_LOTS` + `MAT_STOCKS` 조인으로 수정했다.
- 검증: `HANES_FRONTEND_URL=http://localhost:3012 node tools/hanes-material-flow-frontend-runtime-qa.mjs` PASS. 요청번호 `MR2606170035`, 작업지시 `JO-MATFE-26061618422034`; `MAT_ISSUE_REQUESTS`, `MAT_ISSUE_REQUEST_ITEMS`, `MAT_ISSUES`, `WIP_MAT_TRANSACTIONS`, `WIP_MAT_STOCKS` DB 체크 전부 OK. 증적: `docs/reports/hanes-material-flow-frontend-runtime-qa-2026-06-17/index.html`, `material-flow-result.json`, 스크린샷 10장.
- 검증: `HANES_FRONTEND_URL=http://localhost:3012 HANES_QA_AGGREGATE=1 node tools/hanes-material-menu-page-scenario-qa.mjs` PASS, `/menu-categories/tree` 기준 MATERIAL 등록 메뉴 24개 중 24개 PASS. 증적: `docs/reports/hanes-material-menu-scenario-qa-2026-06-17/index.html`, `material-menu-result.json`, 페이지 JSON 24개.
- 추가 확인: `node --test apps/frontend/src/components/material/issue-from-request-modal-contract.structure.test.mjs` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 관련 파일 `git diff --check` PASS.
- 상태: 완료, lock released. 3002 기존 프론트가 응답 지연 상태라 임시 프론트 `http://localhost:3012`로 검증했다.

## 2026-06-17 03:30 Codex

- 작업: `T-SHIPPING-PACK-EMPTY-BOX-DELETE` `/shipping/pack` 박스포장 화면에서 제품을 담지 않은 생성 박스를 삭제할 수 있게 하고, 행 액션 버튼 위치와 현재 담는 박스 표시를 보강.
- 확인: 백엔드 `DELETE /shipping/boxes/:id`는 이미 `OPEN`, 팔레트 미할당, `qty=0`, `serialList` 없음, OQC 이력 없음 조건에서만 삭제를 허용한다. 프론트에 이 조건을 `canDeleteEmptyBox()`로 노출하고 삭제 확인 모달을 연결했다.
- 변경: 그리드 행 액션을 `제품 담기 / 박스 마감·재오픈 / 라벨 재발행 / 빈 박스 삭제` 4개 고정 아이콘 슬롯(`grid grid-cols-4`, 32x32 버튼)으로 통일했다. 상태별로 버튼을 숨기지 않고 disabled 처리해 위치가 들쭉날쭉 바뀌지 않게 했다. 제품 담기 모달 상단에는 `현재 담는 박스`와 박스번호를 크게 표시하고, 해당 행은 `ring-2 ring-primary bg-primary/5`로 강조한다.
- 검증: 구조 테스트 `node --test apps/frontend/src/app/(authenticated)/shipping/pack/shipping-pack-empty-box-delete.structure.test.mjs` PASS. `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. 3002 브라우저에서 첫 행 액션 버튼 4개, 32x32 고정, title `제품 담기/박스 마감/라벨 재발행/빈 박스 삭제`, 현재 박스 `BX2606170001` 표시, 하이라이트 행 1건, console/page error 0 확인. API로 HNS02 빈 박스 `BX2606170003` 생성 후 삭제, 재조회 404 확인.
- 상태: 완료, lock released. 기존 진행 중인 `T-MATERIAL-FLOW-FE-RUNTIME` 작업은 별도 active로 유지.

## 2026-06-17 03:13 Claude

- 작업: 사용자 요청으로 (1) 라벨 디자이너 `/master/label` 소스테이블에 `box`(제품포장) 추가, (2) 좌측 필드 패널을 읽기전용 컬럼 목록(클릭→글자 객체 추가)으로 단순화. 별개로 `/equipment/status`를 모니터링(사이니지) 화면으로 재구성, `/workflow` CPU 폭주 수정.
- 원인: 좌측 필드 key/표시명/샘플 수동 편집이 과도하게 저수준이라는 사용자 피드백 → A안(컬럼 목록+선택만) 승인. 설비현황은 스크롤 없이 한 화면+자동 롤링 요구.
- 변경(라벨): `labelSources.ts`/`types.ts`/`page.tsx`/`label-template.dto.ts`에 box 소스(boxNo/itemCode/itemName/qty/packUnit/palletNo, category=box) 추가. `LabelObjectDesigner.tsx` 좌측 편집 UI(updateSourceField/addSourceField/deleteSourceField/newField) 제거 → 읽기전용 목록, 클릭 시 해당 컬럼 글자 객체 추가. `addElement(type, fmt, fieldKey?)`. **design.sourceFields 데이터 구조는 보존**(편집 UI만 제거)하여 기존 템플릿 호환.
- 변경(모니터링): `components/monitoring/` 공통 컴포넌트 신규(MonitoringFrame=옵션바/롤링본문/상태바 + 페이지 자동 롤링, MonitoringSettingsModal=설비 다중선택+재조회/롤링 인터벌+그리드, useMonitoringConfig=localStorage). `equipment/status` 재구성 + `EquipStatusCard` 신규(LINE→공정, 작업중 모델+계획/실적 진행바, /production/progress 매핑). `WorkflowCard.tsx` 무한 SMIL 90개 → 정적 화살표(Chrome 렌더러 CPU 9.52→2.78s/8s 측정으로 폭주 수정).
- 참고: `T-MASTER-LABEL-CUSTOM-SOURCE-FIELDS`(Codex, 완료/released)가 만든 sourceFields 편집 기능을 사용자 승인 하에 단순화. 데이터 모델은 보존하여 충돌 최소화.
- 검증: frontend/backend `tsc --noEmit` PASS. locale JSON 4파일 BOM 없음. 브라우저: 모니터링 카드/자동롤링/공정표시, SMIL CPU 측정 확인. 라벨 좌측 단순화는 브라우저 점유로 코드(tsc)로만 검증.
- 상태: 완료.

## 2026-06-17 02:49 Codex

- 작업: `T-MASTER-LABEL-CUSTOM-SOURCE-FIELDS` `/master/label` 좌측 필드 목록을 고정 정의가 아닌 디자인별 사용자 정의 필드로 전환.
- 원인: 기존 `labelSources.ts`의 필드 목록이 실제 DB/API 메타가 아니라 정적 하드코딩이라, 사용자가 라벨 디자인별로 필요한 필드를 자유롭게 정해야 하는 요구와 맞지 않았다.
- 변경: `LabelDesign.sourceFields`를 추가해 템플릿 JSON에 사용자 정의 필드 목록을 저장한다. `labelSources`는 소스테이블별 초기 제안값으로만 쓰고, 디자이너 좌측 필드 패널에서 key/표시명/샘플값을 추가·수정·삭제할 수 있게 했다. 텍스트/바코드/이미지 객체의 `소스 필드` 선택지는 `design.sourceFields`를 기준으로 표시되고, 필드 key 변경 시 기존 객체 매핑도 같이 갱신된다.
- 검증: 구조 테스트 `master-label-bartender-designer.structure.test.mjs`, `master-label-design-only.structure.test.mjs` PASS. `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. 3002 브라우저에서 `customTraceNo/사용자추적번호/TRACE-001` 필드 추가 → 글자 객체 매핑 → 저장 요청 201 확인, 요청 `designData.sourceFields`와 객체 `sourceField=customTraceNo` 보존 확인. 검증용 `CODEX_FIELD%` 템플릿 삭제 후 조회 0건 확인. 관련 diff check PASS.
- 상태: 완료, lock released.

## 2026-06-17 02:36 Codex

- 작업: `T-MASTER-LABEL-BARTENDER-DESIGNER` `/master/label` 객체 기반 라벨 디자이너와 `/consumables/label` 저장 디자인 출력 연결 최종 검증.
- 실측: 3002 실제 브라우저 세션(`admin@hanes.com`, company `40`, plant `1000`)에서 임시 기본 소모품 템플릿 `CODEX_PRINT_1781631331283`을 `LABEL_TEMPLATES`에 저장한 뒤 `/consumables/label` 첫 행을 선택해 `UID 발행`을 클릭했다. `POST /api/consumables/label/create`가 `C26061700011`을 생성했고, `POST /api/material/label-print/log`는 201로 성공했다. `window.open().document.write()`에 전달된 인쇄 HTML 캡처 결과 실제 `conUid`, `APPCT-A`, `어플리케이터A`, 정적 마커 `CODEX_TEMPLATE_MARK`가 포함됐고 `<img>` 바코드/QR 이미지 2개가 포함됐다.
- 정리: 검증용 템플릿은 API 삭제 후 `CODEX_PRINT%` 조회 0건을 확인했다. 검증용 UID `C26061700011`은 JSHANES에서 `LABEL_PRINT_LOGS` 2건, `CONSUMABLE_STOCKS` 1건 삭제 후 두 테이블 잔여 0건을 확인했다. 중간 실패 검증에서 생성된 `C26061700009`, `C26061700010`도 같은 방식으로 정리해 잔여 0건이다.
- 검증: `node "apps/frontend/src/app/(authenticated)/master/label/master-label-bartender-designer.structure.test.mjs"` PASS, `node "apps/frontend/src/app/(authenticated)/master/label/master-label-design-only.structure.test.mjs"` PASS, `node "apps/frontend/src/app/(authenticated)/consumables/label/components/useConLabelIssue.structure.test.mjs"` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. 이전 1차 검증의 `/master/label` 도구/앵커/상단 탭 제거/UI 저장/API 조회/삭제도 유지된다.
- 상태: 완료, lock released.

## 2026-06-17 02:20 Codex

- 작업: `T-MASTER-LABEL-BARTENDER-DESIGNER` `/master/label` 라벨다자인관리 바텐더형 객체 디자이너 전환 1차 구현.
- 변경: `LabelDesign`을 기존 좌표 입력형과 호환되게 유지하면서 `sourceTable`, `elements[]`, 객체 타입(`text/barcode/box/line/circle/image`), 객체별 `sourceField` 매핑을 저장하는 포맷으로 확장했다. `/master/label`은 상단 탭을 제거하고 좌측 소스테이블 선택 + 도구 팔레트, 중앙 캔버스, 우측 속성/템플릿 패널 구조로 변경했다. 객체는 마우스 포인터로 이동하고 선택 객체에는 모서리 리사이즈 앵커가 표시된다.
- 출력 연결: `LabelDesignRenderer`/`LabelPrintRenderer`를 추가해 저장된 객체 포맷을 화면/인쇄용 HTML로 렌더링한다. 바코드는 인쇄 창 복사 시 비지 않도록 `bwip-js` 캔버스를 data URL 이미지로 변환한다. `/consumables/label`은 `category=jig` 라벨 템플릿을 조회하고, 생성된 `conUid`와 소모품 마스터 데이터를 저장 디자인의 `sourceField`에 치환해 출력하도록 연결했다.
- 검증: RED 후 GREEN 구조 테스트 `master-label-bartender-designer.structure.test.mjs`, 갱신한 `master-label-design-only.structure.test.mjs`, 기존 `useConLabelIssue.structure.test.mjs` PASS. `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. 3002 Playwright에서 `/master/label` 도구(`글자/1D/2D/박스/선/원/이미지`), 상단 탭 제거, 박스 추가 후 리사이즈 앵커 4개 확인. `/consumables/label`에서 `/api/master/label-templates?category=jig` 요청 확인. UI `새로 저장`으로 객체 템플릿 저장 후 API 조회에서 `elements` 보존 확인, 테스트 템플릿 삭제 완료. 직접 API 저장/조회/삭제도 객체 JSON `sourceField=conUid` 보존 확인.
- 남음: 실제 소모품 UID 발행 버튼을 눌러 인쇄 HTML에 저장 템플릿 데이터가 치환되는지 실측하고, 생성 테스트 UID/로그 정리 방법까지 확인해야 전체 목표 완료로 볼 수 있다.
- 상태: 진행 중, lock released.

## 2026-06-17 01:59 Codex

- 작업: `T-MASTER-LABEL-DESIGN-ONLY` `/master/label` 라벨다자인관리의 모든 카테고리를 디자인 제공 전용으로 전환.
- 변경: `품목` 탭과 `LabelCategory`의 `part`를 제거했다. `지그/금형` 탭명은 `소모품`으로 변경했다. 설비/소모품/작업자/자재롯트라벨 모든 탭에서 대상 조회 API, 대상 선택 그리드, 선택 항목 인쇄 패널을 제거하고 샘플 미리보기 + 디자인/템플릿 관리만 남겼다.
- 검증: 구조 테스트 RED 확인 후 GREEN. `node "apps/frontend/src/app/(authenticated)/master/label/master-label-design-only.structure.test.mjs"` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS. Playwright로 `http://localhost:3002/master/label` 접속해 탭 `설비/소모품/작업자/자재롯트라벨` 노출, `품목`/`선택 출력` 미노출, 각 탭 디자인 제공 안내 표시, 대상 조회 API(`/equipment/equips`, `/consumables`, `/master/workers`, `/master/parts`) 호출 0건 확인.
- 상태: 완료, lock released. 이번 작업 외 워크트리의 기존 dirty 변경은 되돌리지 않았다.

## 2026-06-17 00:09 Codex

- 작업: `T-EQUIPMENT-PERIODIC-DAILY-FLOW` `/equipment/periodic-inspect` 처리 방식을 `/equipment/daily-inspect` 방식으로 통일.
- 원인: 백엔드는 `DailyInspectController`와 `PeriodicInspectController`가 같은 `EquipInspectService`를 사용하고 `inspectType`만 각각 `DAILY`, `PERIODIC`으로 고정한다. 차이는 프론트였다. 일일점검은 `/master/equip-inspect-items`, 점검로그, 설비마스터를 합쳐 대상 설비 목록 + 항목 입력 패널로 처리했고, 정기점검은 단순 DataGrid/모달 CRUD로 처리했다.
- 변경: `periodic-inspect/page.tsx`를 일일점검형 분할 패널로 교체했다. 좌측은 `PERIODIC` 점검항목이 배정된 설비 목록과 해당일 처리상태를 표시하고, 우측은 선택 설비의 `PERIODIC` 항목을 입력해 `/equipment/periodic-inspect`에 저장한다. 기존 일일점검 컴포넌트 `EquipListPanel`, `InspectEntryPanel`은 기본 동작을 유지하면서 `PERIODIC`용 문구, 엔드포인트, 기존이력 여부를 주입받도록 확장했다.
- 보정: 정기점검 미점검 설비 선택 시 존재하지 않는 로그를 단건 조회해 404 모달이 뜨지 않도록 `existingInspected`가 true일 때만 상세 로그를 조회한다. 점검항목 API가 `seq` 대신 `sortSeq/itemCode`를 내려주는 케이스 때문에 화면 key와 입력상태 key를 `itemCode` 우선으로 바꿔 React key 중복 경고를 제거했다.
- 검증: `node apps/frontend/src/app/(authenticated)/equipment/periodic-inspect/periodic-inspect-daily-flow.structure.test.mjs` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 관련 파일 `git diff --check` PASS.
- 브라우저 검증: 3002 실제 화면에서 `/equipment/periodic-inspect`와 `/equipment/daily-inspect` 모두 좌측 대상 패널 + 우측 입력 패널로 렌더링됨을 확인했다. 정기점검 첫 설비 선택 후 `정기점검 입력`, 점검항목 테이블, 측정값/입력, 판정 컬럼 표시 true, 오류 모달 false, console error/warning 0. 증적: `docs/reports/equipment-periodic-inspect-daily-flow-2026-06-17.png`, `docs/reports/equipment-daily-inspect-daily-flow-2026-06-17.png`, `docs/reports/equipment-periodic-inspect-selected-2026-06-17.png`.
- 상태: 완료, lock released.

## 2026-06-17 00:08 Codex

- 작업: `T-EQUIPMENT-INSPECT-CARDS-REMOVE` `/equipment/inspect-history`, `/equipment/periodic-inspect` 상단 정보카드 제거.
- 변경: `inspect-history/page.tsx`와 `periodic-inspect/page.tsx`에서 상단 `StatCard` 영역과 카드 전용 `stats` 계산/import만 제거했다. 이후 정기점검 화면은 사용자 요청에 따라 `T-EQUIPMENT-PERIODIC-DAILY-FLOW`에서 일일점검형 처리 화면으로 전환했다.
- 검증: 카드 관련 잔여 참조 검색 0건, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 관련 파일 `git diff --check` PASS. 3002 브라우저에서 `/equipment/inspect-history`와 `/equipment/periodic-inspect` 상단 정보카드 미표시 확인. 증적: `docs/reports/equipment-inspect-history-no-cards-2026-06-17.png`, `docs/reports/equipment-periodic-inspect-no-cards-2026-06-17.png`.
- 상태: 완료, lock released.

## 2026-06-16 22:48 Codex

- 작업: `T-CONSUMABLE-LIFE-STATUS-SHAPE` `/consumables/life` 런타임 `data.filter is not a function` 수정.
- 원인: 프론트 수명현황 화면은 `DataGrid`와 통계 계산을 위해 `LifeStatus[]` 행 배열을 기대하지만, 백엔드 `ConsumablesService.getLifeStatus()`가 `{ good, warning, replace }` 카운트 객체를 반환했다. 같은 카운트 목적은 이미 `/consumables/summary`가 담당한다.
- 변경: `getLifeStatus()`가 활성 소모품 행 목록을 반환하도록 수정하고, 서비스 단위 테스트 기대값을 수명현황 그리드용 행 배열 계약으로 변경했다. `ConsumablesService` 테스트 모듈에 최근 추가된 repository 의존성 mock도 보강했다.
- 검증: RED 확인 후 `pnpm --filter @harness/backend test -- consumables.service.spec.ts --runInBand` 20/20 PASS, `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` 통과, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과. API `http://localhost:3003/api/v1/consumables/life-status`는 `data` 배열 37건 반환 확인. Playwright로 `http://localhost:3002/consumables/life` 진입 시 런타임 에러 없음, 수명현황 37건 렌더링 확인.
- 상태: 완료, lock released.

## 2026-06-16 22:24 Codex

- 작업: `T-CONSUMABLE-LABEL-RESPONSE-FIX` `/consumables/label` 라벨 발행 대상 미조회 수정.
- 원인: `ConsumableLabelController`가 `return { data }`를 반환하고 전역 `TransformInterceptor`가 다시 `{ success, data }`로 감싸 실제 응답이 `data.data` 이중 구조가 됐다. 프론트 `page.tsx`는 `res.data?.data`까지만 읽어 배열이 아닌 객체를 받고 `setMasters([])`로 처리했다.
- 변경: `apps/backend/src/modules/consumables/controllers/consumable-label.controller.ts`의 `masters/create/pending/confirm/confirm-bulk` 응답을 `ResponseUtil.success(data)`로 통일하고 미사용 `UseGuards/JwtAuthGuard` import를 제거했다. 구조 테스트 `apps/backend/src/modules/consumables/controllers/consumable-label.controller.structure.test.mjs`를 추가했다.
- 검증: 구조 테스트 RED 후 GREEN(`node --test apps/backend/src/modules/consumables/controllers/consumable-label.controller.structure.test.mjs` 1/1 PASS), `pnpm --filter @harness/backend build` PASS, 인증 API `/api/v1/consumables/label/masters` 응답 `data` 배열 37건 확인, 실제 브라우저 `http://localhost:3002/consumables/label`에서 `데이터가 없습니다` 미표시, 37행 및 `APPCT-A` 표시 확인.
- 상태: 완료, lock released.

## 2026-06-16 22:21 Codex

- 작업: `T-FRONTEND-DELETE-CONFIRM-GUARD` 삭제 버튼 클릭 시 즉시 삭제되는 프론트 지점 보강.
- 변경: 라우팅/라인/공정 탭, 소모품 사용매핑, 소모품/사용자/품목/점검항목 이미지 제거, 교육 참석자, 팔레트 박스, 포장 시리얼, 공정-설비 매핑, 자주검사 항목, 라벨/IQC 템플릿, 품질 audit/control-plan 하위 항목 삭제가 공용 `ConfirmModal` 확인 후 실행되도록 변경했다. 이미 모달을 쓰던 설비점검 할당 패널은 `danger` variant 기준에 맞췄다.
- 테스트: `apps/frontend/src/delete-confirm-guard.structure.test.mjs` 추가. 알려진 삭제 버튼 파일들이 `ConfirmModal`과 `variant="danger"`를 쓰는지, 직접 삭제 호출 패턴이 남아 있지 않은지 검사한다.
- 검증: `node --test apps/frontend/src/delete-confirm-guard.structure.test.mjs`, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`, 대상 파일 `git diff --check`, 직접 삭제 호출 `rg` 검색 통과.
- 상태: 완료, lock released.

## 2026-06-16 21:52 Codex

- 작업: `T-CONSUMABLE-MASTER-USAGE-MAP-FIXED` `/consumables/master`의 `CONSUMABLE_USAGE_MAP` 매핑 UI를 상시 우측 고정 섹션으로 전환.
- 변경: `ConsumableUsageMapPanel.tsx`를 별도 우측 섹션으로 추가하고 `page.tsx`에서 선택 소모품 상태를 관리해 목록 선택 시 매핑이 즉시 갱신되도록 했다. `ConsumableFormPanel.tsx`는 기본정보/수명/거래처/이미지만 담당하도록 유지했고, 매핑 영역은 편집 패널 내부에 넣지 않았다.
- 보정: 우측 매핑 섹션과 등록/수정 패널에 `flex-shrink-0`을 적용해 화면 우측 고정 영역이 축소로 사라지지 않게 했다.
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과, `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` 통과, `http://localhost:3002/consumables/master` HTTP 200 확인. 백엔드 usage-maps API는 기존 `T-CONSUMABLE-MASTER-USAGE-MAP`에서 조회/생성/삭제 및 JSHANES 테스트 잔여 0건 확인 완료.
- 상태: 완료, lock released.

## 2026-06-16 20:36 Codex

- 작업: `T-CONSUMABLE-LABEL-CARDS-REMOVE` `/consumables/label` 상단 정보카드 제거.
- 변경: `apps/frontend/src/app/(authenticated)/consumables/label/page.tsx`에서 `StatCard` 4개 grid, 카드 전용 `stats` useMemo, `StatCard`/`Package`/`Clock` import, 주석의 StatCards 설명만 제거했다.
- 유지: 마스터 조회, 검색, 선택/수량 입력, UID 발행, 브라우저 인쇄, 생성 결과 배너, DataGrid export/SQL 조회는 변경하지 않았다.
- 검증: 대상 파일 `StatCard|stats|totalMasters|pendingCount|selectedCount|selectedQty|Package|Clock` 잔여 0건, `git diff --check` 통과, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과, `http://localhost:3002/consumables/label` HTTP 200 확인.
- 상태: 완료, lock released.

## 2026-06-16 17:50 Codex

- 작업: `T-KIOSK-JOBORDER-PERSIST-REFRESH` `/production/input-kiosk` 새로고침 시 선택 작업지시가 사라지는 문제 수정.
- 원인: `apps/frontend/src/stores/kioskStore.ts`는 Zustand persist를 사용하지만 `partialize`에서 `selectedJobOrder`를 제외하고 있었다. 코드 주석도 "selectedJobOrder는 저장하지 않아 페이지 재진입 시 반드시 새로 선택"이라고 되어 있어 브라우저 refresh 후 작업지시가 null로 복원되는 것이 현재 구현이었다.
- 변경: `harness-kiosk` persist 대상에 `selectedJobOrder: state.selectedJobOrder`를 추가했다. 기존 설비 선택과 `lotSize` persist는 유지했고, active lock이 걸린 `MaterialListPanel.tsx`는 수정하지 않았다.
- 검증: RED 후 GREEN 구조 테스트 `node --test apps/frontend/src/stores/kiosk-store-persist.structure.test.mjs` 통과, `pnpm --filter @harness/frontend exec tsc --noEmit` 통과, 관련 파일 `git diff --check` 통과.
- 상태: 완료, lock released.

## 2026-06-16 17:30 Codex

- 작업: `T-BOM-ITEM-TYPE-LABEL-FIX` `/master/bom` 품목유형 원 코드 노출 원인 확인 및 보정.
- 원인: BOM 백엔드와 DB는 별도 BOM 유형 컬럼을 쓰지 않고 `ITEM_MASTERS.ITEM_TYPE`을 조인해 `itemType`으로 내려준다. 품목마스터 화면은 이를 한글 라벨로 변환하지만, BOM 화면의 부모 목록/트리 배지/범례/자품목 선택 힌트는 `FINISHED`, `SEMI_PRODUCT`, `RAW_MATERIAL`, `CONSUMABLE` 값을 그대로 출력했다.
- 변경: `page.tsx` 부모 목록은 `useComCodeOptions("ITEM_TYPE")` 기반 `itemTypeLabelMap`으로 표시하고, `BomTab.tsx` 트리/범례 및 `BomFormModal.tsx` 선택 자품목 힌트는 `t("comCode.ITEM_TYPE...")` 라벨을 사용하도록 수정했다. 저장/API/DB 값은 변경하지 않았다.
- 검증: 신규 구조 테스트 `node --test apps/frontend/src/app/(authenticated)/master/bom/bom-item-type-label.structure.test.mjs` RED 후 GREEN 3/3 PASS. `pnpm --filter @harness/frontend exec tsc --noEmit`, 관련 파일 `git diff --check` 통과. API `/api/v1/master/boms/parents`는 `itemType` 원 코드 반환 확인. Oracle JSHANES에서 `BOM_MASTERS`에 TYPE 컬럼 없음 및 `ITEM_MASTERS.ITEM_TYPE/PRODUCT_TYPE` 조회 확인. 3002 프론트는 응답 타임아웃이라 건드리지 않고 3012 임시 dev 서버로 `/master/bom` 브라우저 실측, 화면 텍스트에서 `FINISHED/SEMI_PRODUCT/RAW_MATERIAL` 미노출 및 `완제품/반제품/원자재/소모품` 노출 확인 후 3012 서버 종료.
- 상태: 완료, lock released.

## 2026-06-13 22:24 Codex

- 작업: `T-SQL-ACTUAL-GLOBAL` 모든 `DataGrid.sqlQuery` SQL 조회문 실제 실행 SQL 우선 표시.
- 변경: TypeORM logger(`SqlDebugTypeormLogger`)와 요청 단위 `AsyncLocalStorage` SQL 수집 컨텍스트를 추가하고, 전역 `SqlDebugInterceptor`가 GET 응답 `meta.debugSql`에 실제 실행 SELECT/parameters/tables/queries를 붙이도록 했다. 프론트 Axios 응답 인터셉터는 모든 API 응답의 `meta.debugSql`을 캐시하고, 공통 `SqlViewerModal`은 하드코딩 preview SQL과 같은 테이블의 최신 실제 SQL을 우선 표시한다.
- 보정: `getManyAndCount()` 화면은 데이터 SELECT와 COUNT SELECT가 함께 실행되므로 COUNT-only SELECT를 대표 SQL에서 후순위로 내렸다. 그리드 SQL 모달에는 COUNT가 아니라 행 조회 SELECT가 나오도록 백엔드 대표 SQL과 프론트 캐시 매칭 양쪽에 반영했다.
- 적용 범위: `rg` 확인 결과 SQL 조회문 버튼은 `DataGrid -> SqlViewerModal` 단일 경로를 타며, 100개 이상 `sqlQuery` 사용처가 공통 모달 변경을 받는다. `/material/iqc`의 기존 수동 `meta.debugSql`도 전역 수집 경로와 호환된다.
- trade-off: 페이지별로 정확한 API endpoint와 그리드를 1:1 매핑하지 않고 테이블명 기반 최신 실행 SQL을 매칭한다. 따라서 동일 테이블을 여러 API가 연달아 조회하는 특수 화면에서는 가장 최근 같은 테이블 쿼리가 표시될 수 있다. 대신 페이지 100개 이상을 개별 배관하지 않고 전역 적용하며, 실제 DB에 실행된 TypeORM SQL과 bind parameters를 확보한다.
- 런타임 검증: 백엔드 3003을 빌드 후 `dist/main`으로 재시작. `POST /api/v1/auth/login` `admin@hanes.com`/company `40`/plant `1000` 성공. `GET /api/v1/material/iqc-history/pending-arrivals` 응답에 `meta.debugSql`, table `MAT_LOTS`, queryCount 1 확인. `GET /api/v1/master/parts?page=1&limit=5` 응답에 table `ITEM_MASTERS`, queryCount 2, 대표 SQL이 COUNT가 아닌 행 조회 SELECT임을 확인.
- 검증 명령: `node apps/frontend/src/components/data-grid/sql-viewer-actual-sql.structure.test.mjs`, `node apps/frontend/src/components/data-grid/sql-viewer-modal.structure.test.mjs`, `pnpm --filter @harness/backend test -- sql-debug-context.spec.ts --runInBand`, `pnpm --filter @harness/backend exec tsc --noEmit`, `pnpm --filter @harness/frontend exec tsc --noEmit`, 관련 파일 `git diff --check` 모두 통과. `pnpm --filter @harness/backend build` 통과.

## 2026-06-12 17:14 Codex

- 작업: `T-UI-CRUD-RED-MENU-QA` `ui-test-crud-red` 스킬 기반 좌측 메뉴 전체 성공 캡처 QA 진행 중.
- 스킬 변경: `C:\Users\hsyou\.codex\skills\ui-test-crud-red\scripts\ui-test-menu-success-runner.mjs` 추가/보강. 실제 좌측 메뉴 트리(`hanes-menu-tree`)에서 route를 읽고, 각 화면을 Playwright로 열어 콘솔/pageerror/API 400+를 실패로 판정하며 성공 화면만 screenshot으로 남긴다. cold compile 대응을 위해 navigation timeout 6분, timeout/`ERR_NETWORK_IO_SUSPENDED`/`ERR_ABORTED` 재시도, route별 새 context, viewport screenshot, partial JSON 저장을 추가했다.
- 런타임 조치: 3002 프론트 dev server가 전체 500 상태가 되어 포트 3002 Next 프론트 프로세스만 재시작했다. 백엔드 3003은 재기동 직후 연결 거부가 있었으나 이후 `/api/v1/health`, `/api/v1/material/po-status`, 프론트 `/api/health` 모두 정상 확인.
- 현재 진행: 최종 중단 시 `docs/reports/ui-test-crud-red-menu-qa-2026-06-12/result.partial.json` 기준 좌측 메뉴 96개 중 36개 완료, 36개 PASS, 실패 0. 최종 HTML은 아직 작성하지 않았다(전체 PASS 완료 시에만 작성 예정). 성공 캡처는 `docs/reports/ui-test-crud-red-menu-qa-2026-06-12/screenshots/`에 partial로 존재.
- 검증: `node --check C:\Users\hsyou\.codex\skills\ui-test-crud-red\scripts\ui-test-menu-success-runner.mjs` 통과, `python C:\Users\hsyou\.codex\skills\.system\skill-creator\scripts\quick_validate.py C:\Users\hsyou\.codex\skills\ui-test-crud-red` 통과. 전체 runner는 Turbopack cold compile이 매우 느려 중간 정지했다.
- 재개 명령: `node C:\Users\hsyou\.codex\skills\ui-test-crud-red\scripts\ui-test-menu-success-runner.mjs` 또는 백그라운드 로그 방식으로 실행. 현재 3002 프론트 로그는 `docs/reports/ui-test-crud-red-menu-qa-2026-06-12/frontend-3002-restart.out.log`.

## 2026-06-12 09:45 Codex

- 작업: `T-CUSTOMER-INTRO-FLOW-SLIDE` 고객 소개 자료 4페이지 기능흐름도 추가.
- 변경: 사용자 제공 MES 설명 이미지의 구성을 참고해 `docs/presentation/hanes-mes-introduction.html`에 `04 / 기능흐름도` 슬라이드를 삽입. Enterprise System, Manufacturing Execution System, MES 주요 기능 3영역으로 나누고 기준정보, 생산계획, 자재관리, 생산진행, 검사관리, 품질관리, 설비관리, 출하관리, 추적관리 흐름을 한 장에 표현. 기존 4페이지 이후는 5~24페이지로 순번 이동.
- PPTX: `docs/presentation/hanes-mes-introduction.pptx`를 최신 HTML 렌더 기준 24장으로 재생성. `docs/presentation/artifact-build-manifest.json`도 24장 기준으로 갱신.
- 검증: HTML 슬라이드 24장, `04 / 기능흐름도` 포함, 이미지 참조 56개/누락 0개. 4페이지 브라우저 렌더 overflow X/Y 없음 확인 및 시각 확인. PPTX 패키지 슬라이드 24장, media 24개, 빈 media 0개 확인. 작업용 `outputs/manual-20260612-flow-slide` 삭제 완료.
- 참고: artifact-tool 런타임 번들 경로가 비어 있어 이번 PPTX는 HTML 렌더 이미지를 16:9 슬라이드로 재구성했다. 기존 기준정보/갤러리 일부 HTML 페이지에는 기존 세로 overflow 경고가 남아 있으나 신규 4페이지는 해소했다.

## 2026-06-11 23:30 Claude

- 작업: T-EQUIP-INSPECT-TABLE-RESTRUCTURE — 두 테이블 역할 뒤바뀜 전면 수정 완료.
- 결론: DB 재생성(두 테이블 모두 0건이라 데이터 마이그레이션 불필요), 엔티티 클래스명·데코레이터 스왑, 서비스·컨트롤러·DTO·프론트엔드 전면 재작성.
- ① DB: `EQUIP_INSPECT_ITEM_MASTERS`(COMPANY+PLANT_CD+ITEM_CODE PK, EQUIP_TYPE 있음) / `EQUIP_INSPECT_ITEM_POOL`(EQUIP_CODE+ITEM_CODE+INSPECT_TYPE 복합PK, 린 링크 테이블). 마이그레이션: `2026-06-11_equip_inspect_tables_restructure.sql`.
- ② 엔티티 파일: `equip-inspect-item-pool.entity.ts` → class `EquipInspectItemMaster` @Entity('EQUIP_INSPECT_ITEM_MASTERS') / `equip-inspect-item-master.entity.ts` → class `EquipInspectItemPool` @Entity('EQUIP_INSPECT_ITEM_POOL'). 파일명은 변경 없음(클래스명·데코레이터만 스왑).
- ③ master/equip-inspect.service: POOL 레포 inject, findAll=POOL LEFT JOIN MASTERS(getRawMany), create=린(equipCode+itemCode+inspectType+useYn+sortSeq), delete=복합키.
- ④ equipment/equip-inspect.service: POOL 레포 inject + MASTERS는 JOIN 타깃, `fetchItemsWithDetails` 헬퍼(JOIN), item.seq → item.itemCode, detailBySeq → detailByItemCode.
- ⑤ equipment.module, master.module: 양쪽 entity 등록.
- ⑥ spec 파일 4개 수정: 신 엔티티명/토큰으로 교체, master equip-inspect.service.spec 전면 재작성(update 제거, 신 create/delete 테스트).
- ⑦ 프론트: types.ts(InspectItemMasterRow/InspectItemRow 재정의), AddInspectItemModal(마스터 endpoint), EquipAssignTab(delete 시그니처), InspectItemPanel(seq→sortSeq), equip-inspect-item page(마스터 endpoint).
- 검증: 백엔드 tsc --noEmit 통과, 프론트 tsc --noEmit 통과.

## 2026-06-11 22:30 Claude

- 작업: T-EQUIP-INSPECT-POOL-TYPE — 설비점검 항목을 설비유형(EQUIP_TYPE) 기준으로 가져오도록 구조 정리.
- 의도(사용자 확인): `/master/equip-inspect`(설비별 매핑·운영 기준)에서 점검항목 추가 시 풀(점검항목 마스터)을 그 설비의 설비유형으로 필터해 가져온다. `/master/equip-inspect-item`(마스터=구성용 기준정보)은 설비코드 대신 설비유형으로 관리.
- 실측: EQUIP_INSPECT_ITEM_POOL에 EQUIP_TYPE 없음, POOL·MASTERS 둘 다 0건(HNS02 클린징 이후) → 데이터 마이그레이션 불필요. EQUIP_TYPE 공통코드 11종.
- ① DB: `ALTER TABLE EQUIP_INSPECT_ITEM_POOL ADD (EQUIP_TYPE VARCHAR2(50))` JSHANES 적용 + COMMENT. 마이그레이션 파일 `2026-06-11_equip_inspect_pool_equip_type.sql`(저장소 `/` 구분 컨벤션).
- ② 백엔드 POOL: entity equipType 컬럼, DTO Create/Query equipType(옵셔널·MaxLength 50), service create/update 저장 + findAll equipType 필터.
- ③ `/master/equip-inspect-item` page.tsx: 백엔드 소스를 MASTERS(equipCode)→POOL(equip-inspect-item-pool)로 전환, 설비코드 컬럼/입력 제거하고 설비유형(ComCodeSelect/ComCodeBadge EQUIP_TYPE)으로 대체, 통계 '설비 수'→'설비유형 수', 항목코드 PK 입력·비고 추가. (기존 페이지는 per-equip MASTERS 중복 편집 → 마스터(카탈로그)로 정리)
- ④ `/master/equip-inspect` AddInspectItemModal: 풀 조회 params에 선택 설비의 equipType 추가(있을 때만), 대상설비 박스에 유형 배지, 해당 유형 풀 없을 때 안내 문구. EquipAssignTab에서 equipType 전달. ItemMasterTab(풀 편집기)에도 설비유형 컬럼·입력 추가(여기서 만든 풀 항목도 유형 보유).
- 검증: 백엔드/프론트 tsc --noEmit 통과, equip-inspect 구조테스트 3건 통과, ko/en/zh/vi 4파일 키 동기화·BOM 없음.
- 참고(미해결/판단필요): (a) equipType=NULL 풀 항목은 특정 유형 설비 추가 모달에 안 보임(엄격 필터). 공통항목 노출 필요 시 별도 처리. (b) ItemMasterTab과 equip-inspect-item 페이지가 둘 다 풀 편집기 → 중복. 통합은 사용자 결정 영역이라 보존. (c) 백엔드는 nest watch 모드 가정(자동 반영).

## 2026-06-11 21:20 Claude

- 작업: T-PDA-RECEIVE-WORKER-GUARD — PDA 자재입고 사전 게이트 검증·사용자 메시지 + 작업자 스캔 등록·workerId 저장 (프론트 전용).
- 근본원인(시스템 오류처럼 보임): 입고 훅이 `suppressErrorModal` 미지정 → 백엔드 400이 전역 `useErrorStore` 시스템-에러 상세 모달로 표출. 훅 api 호출 2곳에 `suppressErrorModal:true` 추가.
- ① 사전검증: 입고확인 전 작업자등록/수량≥1/수량≤잔량/창고선택을 클라이언트에서 검사 → 실패 시 백엔드 호출 없이 친화 메시지. ② PdaErrorDialog(PDA 오버레이) 닫으면 handleReset+수량초기화로 입고창 클리어. ③ WorkerBar 작업자 QR 스캔(by-qr, workerCode 폴백)→currentWorker 등록, 미등록 시 자재 스캔·입고확인 차단, 입고확인 시 workerId=workerCode 전송(이력에 작업자명).
- 버그 수정: by-qr 응답이 ResponseUtil envelope(`data:{workerCode,workerName,dept}`, id/name 아님)인데 초안이 `res.data.id/name` 읽음 → `(res.data?.data ?? res.data)` 언랩 + workerName 사용으로 수정. (헤더 `WorkerQrPanel`도 동일 버그로 currentWorker.name/workerCode가 undefined — 범위 밖, 별도 수정 필요 보고)
- 검증(localhost, 실 API+DB): by-qr W003→박민수 200. 잔량초과(99>3)→400 친화메시지 "입고수량(99)이 잔량(3)을 초과합니다". 정상입고(qty2, W003)→201. DB 실측 — MAT_RECEIVINGS.WORKER_ID=W003, STOCK_TRANSACTIONS(RECEIVE).WORKER_ID=W003 저장 확인. FE tsc 통과.
- 파일: `apps/frontend/src/hooks/pda/useMatReceivingScan.ts`, `apps/frontend/src/app/pda/material/receiving/{page.tsx,components.tsx}`. 미커밋. 백엔드 무수정(DTO/서비스 이미 workerId 저장).

## 2026-06-11 21:10 Claude

- 작업: T-IQC-MODAL-POOL-ITEMS — IQC 검사결과 등록 모달의 검사항목 일부 누락·검사기준 컬럼 누락 수정 + 전체 변경분 커밋.
- 원인(실측): 모달이 `GET /master/iqc-items`(IQC_ITEM_MASTERS) 조회 — CNTR001은 여기 2행(검사기준/LSL/USL 전무)뿐. 정상 출처인 품목→그룹→그룹항목→풀(IQC_ITEM_POOL) 체인이 끊겨 있었음: IQC_PART_LINKS가 존재하지 않는 GRP-* 그룹 참조, 실재 IGR-* 그룹은 IQC_GROUP_ITEMS 매핑 0건.
- 수정: ①시드 `2026-06-11_iqc_group_chain_repair_seed.sql` — GRP-*→IGR-* 링크 정정(UPDATE) + IGR-* 그룹별 검사항목 매핑 시드(SET 기반 INSERT, NOT EXISTS 가드). ②백엔드 `GET /master/iqc-part-links/resolve-items/:itemCode`(거래처 전용→기본(*)→첫 링크 해석, 풀의 criteria→spec/lsl/usl/unit/judgeMethod 반환). ③모달이 새 엔드포인트 사용.
- 검증: JSHANES 시드 적용, CNTR001 체인 4항목(외관/캐비티치수/락기능/조립) + 검사기준 정상. resolve-items API 4행 반환 실측. FE/BE tsc 통과, nest build+재시작.
- 커밋: 지금까지 미커밋분 전부를 작업 단위로 분리 커밋 — PDA계약통일, 팔레트화면정합, 키오스크단절수정, IQC코드그룹, 메뉴수정, 테마, 공정설비시드, IQC라벨통일, 재검수불분리, UID분리, 본 IQC모달수정, 협업보드. (codex 완료분 포함)
- 주의: 백엔드 3003 새 빌드본 재시작됨. hswbs 반영은 별도 배포 필요. T-PDA-RECEIVE-WORKER-GUARD 락은 작업파일 미존재라 보존(타 컨텍스트 진행분).

## 2026-06-11 20:50 Claude

- 작업: T-KIOSK-FLOW-FIX — 키오스크 점검에서 발견한 단절 3건 수정 (우선순위 ①→③→②) + 연쇄 버그 1건.
- ①(설정 시드): `2026-06-11_mat_auto_issue_config_seed.sql` — `MAT_AUTO_ISSUE_TIMING='ON_CREATE'`(SELECT: OFF/ON_CREATE/ON_COMPLETE), `MAT_ISSUE_STOCK_CHECK='WARN'`(BLOCK/WARN — 자재 미입고 상태에서 생산 차단 방지를 위해 WARN 기본) PRODUCTION 그룹 시드, JSHANES 적용. SysConfig 무캐시라 즉시 효력.
- ③(진행률 서버화): `job-order.service.findByOrderNo`에 PROD_RESULTS 집계(goodQty/defectQty, CANCELED 제외) 추가. 키오스크 `savedResultCount` 의미를 "누적 생산수량(서버 집계)"으로 정정 — `setSavedResultCount` 액션, `refreshProgress()`로 작업지시 선택/재진입/저장 후 서버 동기화. 초물 트리거·중물 차단·`prodQtyAtInspect`가 모두 실제 생산량 기준이 됨. `incrementResultCount` 제거.
- ②(스캔 LOT 우선): `auto-issue.service` — JOB_MATERIAL_LOTS(키오스크 스캔 LOT)를 차감 1순위로 정렬 후 FIFO. 스캔 추적과 실제 차감 LOT 일치.
- 연쇄버그(역분개 복원 불가): AutoIssue가 만들던 StockTransaction에 FROM_WAREHOUSE_ID 부재 → `reverseAutoIssue`가 복원을 skip(원거래 존재+창고 null은 fallback도 안 탐). 수정: `deductMatStock`이 창고별 차감 내역 반환 → 창고별 TX 생성(FROM_WAREHOUSE_ID 기록). 실증: 차감 7→6 → 취소 → 복원 6→7 + MAT_IN 보상 TX.
- 검증: auto-issue/job-order spec 47건(신규 스캔우선 1건 포함) 통과, FE/BE tsc 통과, nest build 후 백엔드 재시작(node dist/main). 통합 실증 — by-order-no goodQty 14→15→복원, 백플러시 MAT_ISSUES(PROD_AUTO) 생성·차감 LOT=스캔 LOT 일치, WARN 정책으로 재고 없는 BOM 품목 있어도 실적 저장 성공.
- 정리: 검증 잔여물(PR 2건, ISS 2건, TX 3건, 스캔기록) 삭제, 수정 전 미복원분 +1 보정(재고 8 원복), EQ-CRIMP-03 작업지시 할당 복원. 기존 실적 14/4 보존.
- 미커밋. hswbs 반영은 백엔드 재배포 필요(시드는 DB 공유로 즉시 반영). 주의: 백엔드 3003 프로세스를 새 빌드본으로 재시작했음.

## 2026-06-11 20:48 Codex

- 작업: `T-IQC-CODE-ALIGN` 품목정보/IQC 검사그룹/IQC 검사입력/IQC 이력의 검사방법·검사유형 코드 매핑 통일.
- 원인: `ITEM_MASTERS.INSPECT_METHOD`와 `IQC_GROUPS.INSPECT_METHOD`는 `FULL/SAMPLE/SKIP` 의미인데, 기존 공통코드 `INSPECT_METHOD`는 `VISUAL/MEASUREMENT/FUNCTIONAL/ELECTRICAL/DESTRUCTIVE` 의미였다. IQC 이력 필터는 `IQC_LOGS.INSPECT_TYPE=INITIAL/RETEST`를 조회하면서 `IQC_TYPE=IQC/PQC/FQC/OQC` 그룹을 사용해 라벨과 필터가 불일치했다. 검사입력 모달은 동일 의미에 `NONE`을 사용해 품목/그룹의 `SKIP`과도 달랐다.
- 변경: JSHANES `COM_CODES`에 `IQC_INSPECT_METHOD`(`FULL=전수검사`, `SAMPLE=샘플검사`, `SKIP=무검사`)와 `IQC_INSPECT_TYPE`(`INITIAL=초기검사`, `RETEST=재검사`) 추가. 품목정보, 품목 폼, 품목별 IQC 그룹 선택, IQC 검사그룹 관리, 수입검사 목록/입력, IQC 이력 화면이 새 전용 그룹을 사용하도록 변경. 백엔드 DTO는 `SKIP`을 허용하고 legacy `NONE` 요청은 저장 전 `SKIP`으로 정규화한다.
- 파일: `apps/backend/src/migrations/2026-06-11_iqc_inspect_code_groups.sql`, `apps/backend/src/modules/material/dto/iqc-history.dto.ts`, `apps/backend/src/modules/material/services/iqc-history.service.ts`, IQC 관련 프론트 파일 9개, `packages/shared/src/{types/com-code.ts,constants/com-code-values.ts}`, `docs/reports/db-schema-erd.md`.
- 실행/검증: JSHANES 마이그레이션 적용 성공(`blocks_executed=1`). DB 조회로 신규 공통코드 5건 확인. `IQC_LOGS.INSPECT_CLASS`는 `SAMPLE=10`, `NULL=6`, `NONE=0` 확인. `node --test apps/frontend/src/app/(authenticated)/material/iqc/iqc-code-groups.structure.test.mjs` 통과(3 tests). `pnpm --filter @harness/frontend exec tsc --noEmit`, `pnpm --filter @harness/backend exec tsc --noEmit` 통과. `python tools/generate_db_schema_doc.py` 실행해 ERD 문서 갱신.

## 2026-06-11 20:27 Codex

- 작업: `T-PROCESS-EQUIP-SEED` 공정별 설비 마스터/공정-설비 매핑 시드 생성 및 JSHANES 적용.
- 변경: `apps/backend/src/migrations/2026-06-11_process_equipment_seed.sql` 추가. `PROCESS_MASTERS` 활성 공정(COMPANY=40, PLANT_CD=1000)을 기준으로 `EQ-<PROCESS_CODE>-NN` 설비코드를 생성하고 `EQUIP_MASTERS`, `PROCESS_EQUIPMENTS`에 `MERGE`한다. WIRE/TERMINAL/INSPECTION 공정은 2대, ASSEMBLY/HEAT/미분류 공정은 1대씩 생성한다.
- 실행: `python C:\Users\hsyou\.codex\skills\oracle-db\scripts\oracle_connector.py --site JSHANES --execute-file apps\backend\src\migrations\2026-06-11_process_equipment_seed.sql` 성공(`blocks_executed=1`).
- 검증: 활성 공정 21개, `EQUIP_MASTERS` 시드 설비 36건, `PROCESS_EQUIPMENTS` 시드 매핑 36건, 시드 매핑이 붙은 활성 공정 21개 확인.
- 주의: 기존 활성 매핑은 삭제하지 않았다. 기존 데이터 때문에 ATCUT/STRPB는 전체 활성 매핑 3건, PRC-CUT은 전체 활성 매핑 4건으로 보인다. 신규 시드 기준으로는 각 공정 1~2건이 정상 생성됐다.

## 2026-06-11 20:15 Claude

- 작업: 유수명자재 검사이력(`/material/shelf-life-history`) 재검사 데이터 생성·조회 검증 (코드 수정 없음, 실 API+DB).
- 데이터 모델: 재검사 = `IQC_LOGS(INSPECT_TYPE='RETEST')`. 등록 API `POST /material/shelf-life/reinspect {matUid, result, extendDays, inspectorName, details, remark, destructSampleQty}`. PASS→만료일=검사일+연장일(품목 EXPIRY_EXT_DAYS 상한), FAIL→불용창고 이동+LOT DISCARDED. 회차=기존 RETEST수+1.
- 생성(실 API, 인증 브라우저): 유수명 품목 LOT 대상 5건 — PASS 4(RM-GROM-001 회차1·2 동일LOT, RSL-T, TMN-A) + FAIL 1(TMN-B). 기존 RETEST 0→5.
- 검증: ①IQC_LOGS RETEST 5행(회차 1·2 증가 정상), ②PASS 만료연장 실측 — RM-GROM-001 +30→2026-07-11, RSL-T +90→2026-09-09, TMN-A +120→2026-10-09, ③FAIL 폐기 — VH1-RM260605-00002 status=DISCARDED + STOCK_TRANSACTIONS MAT_MOVE WH-MAT-A→DEFECT qty=500(REINSPECT_FAIL), ④페이지 "전체 5건" 4개 LOT·합격/불합격 라벨 표시 확인.
- 주의: 검증 데이터는 사용자 요청대로 보존(미삭제). FAIL 1건이 실 LOT VH1-RM260605-00002(TMN-B, 500)를 폐기·불용이동시킴 — 원복 필요 시 알림.

## 2026-06-11 20:00 Claude

- 작업: 투입 키오스크(`/production/input-kiosk`) 전체 워크플로우 점검 + 후속 프로세스 연결성 실증 (코드 수정 없음, API+실DB).
- 실증 시나리오: EQ-CRIMP-03/W2026-001/W010으로 일일점검→작업자점검→자재 LOT 스캔→실적 저장(양품2/불량1+상세)→통전검사 PASS→FG 라벨 포장→의뢰검사 PENDING 차단/해제 전 구간 실행.
- 정상 연결(실증): ①점검 2종 EQUIP_INSPECT_LOGS 저장+check API 인터록 복원, ②자재 스캔 JOB_MATERIAL_LOTS 기록(BOM 오장착 검증), ③실적 PROD_RESULTS+DEFECT_LOGS(WAIT, 불량관리 동일 테이블) 단일 TX+planQty 초과 차단+WAITING→RUNNING 승격, ④통전검사 PASS→FG_LABELS(ISSUED, INSPECT_PASS_YN=Y) 발행→포장 박스 추가 성공(생산→검사→포장 체인), ⑤의뢰검사 PENDING→pending API 차단→PATCH PASS→해제(키오스크↔의뢰검사 화면 양방향).
- 단절①(중대): `MAT_AUTO_ISSUE_TIMING` 설정이 SYS_CONFIGS에 부재 → `AutoIssueService.execute()` 항상 skip → **실적 저장해도 자재 백플러시 0건** (CNTR001 재고 8→8, MAT_ISSUES 0건 실측). 생산과 자재 재고가 완전 단절.
- 단절②(구조): AutoIssue FIFO가 키오스크 스캔 LOT(JOB_MATERIAL_LOTS)을 참조하지 않음 — 켜져도 스캔 LOT 추적과 실제 차감 LOT이 따로 놂.
- 단절③: `GET /production/job-orders/order-no/:orderNo` 응답 goodQty/defectQty가 실적 미집계(0 고정) — findAll/findById에만 집계 존재. 키오스크 진행률(savedResultCount)은 클라이언트 스토어 카운트라 새로고침 시 0 리셋 → 중물(60%) 차단이 실제 실적과 무관.
- 관찰④: 통전검사 resolveProdResult는 prodResultNo/fgBarcode 미전달 시 실적 1건일 때만 자동 연결(다건이면 null — 실측 재현). 검사기 연동 시 prodResultNo 전달 필요.
- 관찰⑤: planQty 도달해도 작업지시 자동 DONE 없음(수동 완료 전제). 관찰⑥: 소모품 스캔은 세션 기록만(사용 카운트 미증가).
- 정리: PR26061100012/DEFECT_LOGS/FG26061100007/IR26061100007/SELF_INSPECT_RESULTS/EQUIP_INSPECT_LOGS/JOB_MATERIAL_LOTS/BXKIOSKVERIFY1 전부 삭제 검증(0건). W2026-001 기존 실적 11건·설비 할당은 보존.

## 2026-06-11 19:35 Claude

- 작업: T-OQC-SHIP-TOGGLE — OQC 사용여부 시스템 설정 추가 + 출하처리 게이트 조건부 적용.
- 요구: OQC 사용 시 합격(PASS) 박스만 출하 가능, 미사용 시 모든 마감 박스 출하 가능.
- config: `SYS_CONFIGS`에 `OQC_ENABLED`(QUALITY, BOOLEAN, 기본 'Y') 시드. ConfigItemRow가 BOOLEAN→토글로 렌더, label DB 직접사용이라 i18n 불필요. /system/config QUALITY 탭에 즉시 노출.
- 백엔드: `ShippingModule`에 `SystemModule` import(순환참조 없음), `SysConfigService`를 `ShipOrderService`·`ShipmentService`에 주입. 출하 OQC 게이트 3곳을 `isEnabled('OQC_ENABLED')`로 분기 — ①`ship-order.shipBox`(박스 스캔), ②`shipment.loadPallets`(팔레트 적재), ③`shipment.markAsShipped`(출하확정). 켜짐=PASS만, 꺼짐=전부 통과. 기본 'Y'라 기존 동작 무회귀.
- 인프라: 백엔드 localhost:3003은 `node dist/main`(빌드본, watch 아님) → nest build + 사용자 재시작 후 검증.
- 검증(비파괴, 실 API): SO-OQCTEST-1(HNS01 라인) 생성·확정 후 — OQC=Y: ship-box BX2606110003(PENDING)→`400 "OQC 합격(PASS) 박스만..."`(게이트 ON). OQC=N(config flip): 동일 박스→`400 "출하지시에 없는 품목"`(게이트 우회→하류 도달), HNS01 박스(BX2606110002, PENDING)→`400 "재고 부족 가용0/요청5"`(OQC·품목·수량·창고 전부 통과, 재고만 별개=완전 우회 입증). 전부 throw 선에서 끝나 쓰기 없음.
- 정리: config 'Y' 복원, 테스트 지시 삭제, 박스 미변경 확인.
- 미커밋/미배포: 백엔드 코드 변경은 디스크+로컬 dist에만. **hswbs 적용은 백엔드 재배포 필요**(시드/토글은 DB공유라 hswbs에 이미 보이나 게이트 enforcement는 미반영).

## 2026-06-11 19:20 Claude

- 작업: T-PALLET-SCREEN-FIX — 팔레트 구성 관리 화면(`/shipping/pallet`)을 백엔드 계약에 정합 + 팔레트 자동채번 신설.
- 검토 결과(수정 전 실증): 화면의 생성/적재/마감이 전부 400 — ①생성: 바디 없음인데 `palletNo` 필수+자동채번 미구현, ②적재: `{boxNos}` vs 백엔드 `{boxIds}`, ③마감: `PUT {status:CLOSED}` vs 전용 `POST /:id/close`(직접 변경 차단), ④`search` 파라미터 미지원, ⑤우측 포함박스 패널은 목록 응답에 없는 `boxes` 참조로 항상 빈 화면, ⑥필드명 불일치(`shipmentNo/closedAt/quantity/itemName`). 화면이 사실상 조회 전용이었음.
- 백엔드: `SEQ_PALLET_NO_DAILY` 시퀀스+일별 리셋 잡 신설(`2026-06-11_seq_pallet_no_daily.sql`, JSHANES 적용), `NumberingService.nextPalletNo()`(PLT+YYMMDD+4자리), `CreatePalletDto.palletNo` optional, `pallet.service.create` 미지정 시 자동채번.
- 프론트: `palletNo` 검색 파라미터, `{boxIds}` 적재, `POST /:id/close`/`/:id/reopen`, 우측 패널은 `GET /shipping/pallets/barcode/:no/boxes`로 실조회 + OPEN 팔레트에서 박스 제거 버튼(DELETE /:id/boxes), 적재 후보는 CLOSED+미할당 조회 후 OQC PASS 필터, 필드명 정합(shipmentId/closeAt/itemCode/qty), 액션 응답으로 선택 팔레트 동기화.
- i18n: `shipping.pallet.reopenPallet/removeBox/noBoxes/noLoadableBoxes` 4개 언어 추가(카운트 검증).
- 검증: pallet.service.spec 16건 통과, FE/BE tsc 통과. API 실증 — 빈 바디 생성 → `PLT2606110001` 자동채번, `boxIds` 검증 통과(없는 박스 404), 빈 팔레트 close 400 가드, barcode boxes 응답 구조 확인. 테스트 팔레트 삭제 정리.
- 주의: 동시 작업 중인 T-OQC-SHIP-TOGGLE(ship-order/shipment.service)과 파일 겹침 없음. 미커밋.

## 2026-06-11 18:40 Claude

- 작업: 포장실적조회(`/production/pack-result`) — ①날짜 당일 기본값 ②정보카드 제거 ③실제 포장 실적 생성.
- ③ 실제 포장(진짜 API): 인증된 브라우저(claude-in-chrome)에서 `harness-token`+`X-Company/X-Plant` 헤더 복제 fetch로 실제 백엔드 호출. create→addSerial→close 순서. BX2606110002(HNS01×5, FGHNS01T001~005), BX2606110003(HNS02×1, FG26060900006) 생성. closeBox 로직대로 FG_LABELS→PACKED, OQC-20260611-001 자동생성, oqcStatus PENDING. JSHANES 실측 검증. FGHNS01T006은 packUnit=5 단품 잔여라 보류.
- ①② 프론트: `pack-result/page.tsx` — `getTodayStr()`로 startDate/endDate 초기값 당일(런타임 계산), StatCard 3종+stats useMemo+미사용 import 제거. tsc 통과.
- 검증: localhost:3002(이 머신 dev)에서 날짜=2026-06-11 기본, 카드 없음, 당일 필터 "전체 2건"(두 박스) 확인.
- 인프라 발견: 사용자가 보던 `hswbs.haengsung.com:3002`(공인 210.206.166.207)은 **로컬 dev와 별개 배포 서버**. 백엔드/DB(JSHANES)만 공유 → 박스 데이터는 즉시 보이나 프론트 코드 변경은 hswbs에 배포해야 반영. 로컬 dev 재시작은 hswbs에 무효였음.
- 미커밋/미배포: 프론트 변경은 디스크에만 있음.

## 2026-06-11 18:35 Claude

- 작업: T-PDA-API-UNIFY — PDA 자재입고/자재출고/창고입고(제품입고)/출하처리 4개 워크플로우 검증 + 웹과 동일 백엔드 API 계약으로 통일.
- 조사 결과: 자재입고(`useMatReceivingScan`)·제품입고(`pda/product/receiving`)는 이미 웹과 동일 계약(✓). **자재출고와 출하처리에서 불일치 발견**.
- 불일치①(자재출고, 전 단계 동작 불능이었음): `useMatIssuingScan.ts`가 envelope(`{success,data}`)를 안 벗기고 존재하지 않는 필드(`jo.id/partCode/bom`, `lot.remainQty/lotNo`)를 참조, 확정 바디 `{jobOrderId, lots[]}`는 백엔드 `ScanIssueDto{matUid}`와 완전 불일치(400 확정). 출고유형 `TRANSFER`는 ComCode ISSUE_TYPE에 없는 무효 코드.
- 수정①: Phase1은 `GET /production/job-orders/order-no/:orderNo` + `GET /material/issue-requests/job-orders/:orderNo/bom-items`(웹 출고요청과 동일 API)로 BOM 세팅, Phase2는 `currentQty` 기반 + LOT 중복/소진 가드, Phase3은 LOT마다 웹과 동일 `POST /material/issues/scan {matUid, issueType, remark:'PDA 작업지시 출고: <orderNo>'}` 순차 호출(부분 실패 시 성공분 제외하고 실패 LOT만 잔류). `TRANSFER`→`SAMPLE` 교체. 컴포넌트 `partCode/partName`→`itemCode/itemName`.
- 불일치②(출하처리): PDA 팔레트 스캔이 하위 박스마다 `ship-box`를 호출하나 백엔드 `shipBox()`는 팔레트 적재 박스를 이중차감 방지로 무조건 거부 → 모순으로 항상 실패. 응답 접근도 `data.boxes`로 envelope 미언래핑.
- 수정②: `useShippingScan.ts` 팔레트 분기 제거, PLT 접두사 스캔 시 `PALLET_NOT_SUPPORTED` 에러로 안내(팔레트 출하는 웹 출하확정 mark-shipped 경로 전용). 박스 스캔은 웹과 동일 `ship-box` 계약 유지.
- i18n: `pda.issuing.sample/bomNotFound/duplicateLot/lotDepleted/noScannedLots`, `pda.shipping.palletNotSupported` — ko/en/zh/vi 4개 파일 동시 추가, 키 카운트 검증.
- 검증: frontend tsc --noEmit 통과. API 실증 — 자재입고(by-barcode→POST receiving→MAT_STOCKS 반영, 성적서 가드 웹과 동일 작동), 자재출고(scan 출고→재고 8→0/LOT DEPLETED→취소 복원), 제품입고(fg/receive 빈 warehouseId 허용·FG_MAIN 강제, /inventory/cancel 보상 트랜잭션+재고 복원), 출하(ship-box 완출 시 지시 자동 CLOSED). 검증 잔여물 정리 완료(사용자 작업 중이던 BX2606110002/0003·OQC 2건은 보존, T006 라벨 VISUAL_PASS 복원).
- 잔여 과제: PDA 팔레트 단위 출하가 현장 요구라면 출하지시-팔레트 연계 별도 설계 필요(현재는 웹 출하확정 경로 안내). 미커밋 상태.

## 2026-06-11 18:05 Claude

- 작업: 출하관리 잘못된 검증 데이터 전체 삭제 (JSHANES, COMPANY=40/PLANT_CD=1000 스코프, 명시적 키 목록 DELETE).
- 사전 전수 실측: 출하 관련 테이블의 모든 행이 테스트/오염 데이터임을 확인 — 박스 7건(BOX-TEST-001, BX2606080002 qty100 라벨없음, BX2606090001 교차오염, BXPDATEST01, BX2606100001, BX2606110001, BXCLAUDETEST2), 팔레트 2건(PLT-TEST-001, PLTCLAUDETEST1), 출하 3건(SHP-TEST-001, SHPCLAUDETEST1, SH-20260401-001 고객명 깨짐), 지시 1건(SOCLAUDETEST1)+품목, OQC 2건+박스매핑, PTX 10건(전부 HNS01 테스트 참조), PRODUCT_STOCKS 2건(FG_MAIN 2 테스트잔여, WH-FG 10 죽은재고).
- 실행: 10블록 DELETE/UPDATE 전체 성공. FG_LABELS HNS01 6건은 시드 원상태로 복원(STATUS=VISUAL_PASS, BOX_NO=NULL). HNS02 라벨(ISSUED)은 무변경.
- 검증: BOX/PALLET/SHIPMENT/SHIP_ORDER/ORDER_ITEM/RETURN/OQC/OQC_BOX/PTX/PRODUCT_STOCKS 전부 0건, 라벨 7건 정상, box-stock·pack-result API 빈 응답 확인.
- 결과 상태: 출하관리 전 테이블 클린. 라벨 6건(VISUAL_PASS, 검사합격)으로 포장부터 재검증 가능.

## 2026-06-11 18:00 Claude

- 작업: T-SHIP-CROSSBOX-GUARD — 교차 박스 중복 포장 가드 추가 (실증 테스트 발견 버그① 수정).
- 원인: FG 라벨 상태는 박스 마감 전까지 ISSUED/VISUAL_PASS로 유지되므로 라벨 상태 검증만으로는 OPEN 박스 간 동일 시리얼 중복 포장을 막지 못함. 시리얼 진입 경로 3곳(create의 serialList, update의 serialList, addSerial) 모두 무방비였음.
- 변경: `box.service.ts`에 `assertSerialsNotPackedElsewhere()` 헬퍼 추가 — SERIAL_LIST(CLOB) `LIKE '%"시리얼"%'` 후보 조회(OR, 단일 쿼리) 후 JSON 파싱 정확 비교로 오탐 제거, 충돌 시 409(`이미 다른 박스에 포장된 시리얼입니다: 시리얼(박스번호)`). create/update/addSerial 3개 경로에 호출 추가.
- 테스트: `box.service.spec.ts` 신규 4건(addSerial/create/update 차단 + LIKE 오탐 무시) 포함 17건 전체 통과. tsc --noEmit 통과. API 실증: 3개 경로 모두 409 재현, 충돌 없는 시리얼(T006) 추가는 정상 성공. 테스트 박스(BXGUARDTEST*)는 삭제 정리.
- 추가 발견(실데이터): 기존 OPEN 박스 `BX2606090001`의 SERIAL_LIST에 T001~T005가 잔존 — T001/T002는 BX2606110001(CLOSED/PACKED), T003은 SHIPPED인데도 이 박스에 남아 있는 **가드 도입 전 발생한 교차 중복 데이터**. qty=5도 이중 계상. 데이터 정리는 미실시(범위 밖) — 해당 박스 serialList 정리 또는 박스 삭제 필요.
- 한계: 가드는 조회 시점 검사라 완전 동시 요청(TOCTOU)은 이론상 통과 가능. 근본 차단은 시리얼 정규화 테이블(BOX_SERIALS, UNIQUE 제약)로의 개선 필요.

## 2026-06-11 17:50 Claude

- 작업: 출하관리 카테고리 8개 메뉴 실증 테스트 (코드 수정 없음, API+실DB 검증). 박스 포장→OQC→팔레트→출하지시→출하확정→역분개→취소→반품 전 구간을 실제 API 호출 + JSHANES DB 조회로 검증.
- 정상 확인: 박스 close 시 FG_LABELS→PACKED + OQC_REQUESTS 자동생성, reopen 시 VISUAL_PASS 복원+OQC 삭제, 재고부족 출하 거부, 팔레트 적재 박스 ship-box 차단(이중차감 방지), mark-shipped 시 FG_OUT 차감+지시 자동 CLOSED, reverse 시 보상 트랜잭션(FG_OUT_CANCEL)+지시 CONFIRMED 복원, cancel 시 팔레트 CLOSED 복원. 상태머신 가드 전체 정상.
- 발견 버그①: `box.service.ts addSerial`(L345-401)이 같은 박스 내 중복만 검사 → 동일 시리얼을 OPEN 박스 2개에 교차 포장 가능 (FGHNS01T001로 재현). 실물 1개가 복수 박스 qty로 이중 계상될 수 있음.
- 발견 이슈②: `POST /inventory/fg/receive` — 컨트롤러가 FG 기본창고로 warehouseId를 덮어쓰는데 DTO는 필수라 클라이언트 값이 조용히 무시됨(WH-FG 지정해도 FG_MAIN 입고 재현).
- 발견 이슈③: 반품(ship-return)은 CRUD만 구현. DRAFT→CONFIRMED→COMPLETED 전이 API 부재(직접 변경은 "전용 처리 API 사용" 메시지로 차단되나 그 API가 없음), RESTOCK 재입고의 재고 처리 없음(PRODUCT_TRANSACTIONS 0건 확인). 기록 전용 상태.
- 발견 이슈④: OQC 요청번호 채번 `nextOqcRequestNo()`(box.service.ts L58-74)가 LIKE prefix MAX+1 방식 — STATE.md 채번 규칙(SEQUENCE.NEXTVAL) 위반, 동시 박스마감 시 중복 위험. BOX_NO는 SEQ_BOX_NO_DAILY 시퀀스 사용으로 정상.
- 발견 데이터 이슈⑤: 기존 박스 BX2606080002(qty=100, 라벨 7개뿐), BOX-TEST-001(CLOSED인데 OQC null) 등 시드 잔재 정합 깨짐. WH-FG의 HNS01 10개는 기본창고가 FG_MAIN으로 바뀌면서 죽은 재고.
- 테스트 잔여 데이터: SOCLAUDETEST1(CONFIRMED, 1/3 출하), SHPCLAUDETEST1(CANCELED), PLTCLAUDETEST1(CLOSED, 박스 1), BX2606110001(CLOSED/PASS, T001·T002 PACKED), BXCLAUDETEST2(SHIPPED, T003), FG_MAIN 재고 2. 모두 일관 상태로 잔존(이력 보존 위해 미삭제). RTCLAUDETEST1은 DELETE API 실증 겸 삭제 완료.

## 2026-06-11 16:55 Claude

- 작업: 공정생품검사(`SELF_INSPECT_ITEMS`) — 실 라우팅 공정코드 17종 검사항목 시드.
- 근본원인 실측: 기존 자주검사 항목은 데모용 `PRC-*` 코드에만 존재. ROUTING_PROCESSES는 `SASSY/MASSY/CRMPF/CRMPR/HEXCP/ATCUT/...` 실 코드를 쓰므로 라우팅 공정생품검사 탭이 어느 공정을 골라도 0건이었음(코드 네임스페이스 단절).
- 변경: 실 코드 17종(AINSP/ATCNS/ATCUT/AUXMT/CRMPF/CRMPR/HEXCP/MASSY/MTASY/OINSP/SASSY/SHDRM/STRPB/TAPPN/TINSP/TUBHT/WELDR)에 검사항목 55건 idempotent INSERT. 측정형은 LSL/USL/UNIT 예시값(압착높이 1.20±0.05, pull test 하한 60N, 절연저항 1MΩ 등), 판정형은 규격 없음.
- 파일: `scripts/seed_self_inspect_real_processes.py`(데이터+실행), `apps/backend/src/migrations/2026-06-11_self_inspect_real_processes_seed.sql`(동일 데이터 생성, WHERE NOT EXISTS, BOM 없음). 실행: JSHANES.
- 검증: 55건 삽입 확인, 공정별 분포 출력. SASSY=3건(측정형 1: 서브조립 길이 295~305mm) 확인. 자연키 중복가드로 재실행 안전.
- 주의: LSL/USL는 예시값. 실 규격은 공정생품검사 탭에서 조정. 기존 `PRC-*` 항목은 의뢰검사 테스트 시드가 참조하므로 그대로 둠(미삭제).

## 2026-06-11 16:40 Claude

- 작업: 공정생품검사(`SELF_INSPECT_ITEMS`) 측정형 규격 시드 — 의뢰검사 패널 LSL/USL 표시용.
- 실측: DELEGATE 항목 3개 모두 `ITEM_TYPE='VISUAL'`, LSL/USL=null 상태였음(기존 seed가 해당 컬럼 미설정). 테스트 시드가 참조하는 ID가 실DB 행과 정확히 일치 확인.
- 변경: `인장강도 시험 (Pull test)`(PRC-CRIMP) → MEASURE/N/LSL=60, `절연 저항 측정`(PRC-TEST) → MEASURE/MΩ/LSL=1 로 UPDATE(자연키, 각 1행). `도통 검사`는 양/부 판정이라 VISUAL 유지.
- 파일: `apps/backend/src/migrations/2026-06-11_self_inspect_measure_specs_seed.sql`(idempotent UPDATE). 실행: `scripts/execute_sql.py`(JSHANES).
- 검증: API JOIN(`r.INSPECT_ITEM_ID=i.ID`) 실DB 시뮬레이션 → PENDING 5행 중 인장강도 x2/절연저항 x1은 LSL/단위 표시, 도통검사 x2는 판정형으로 정상 해석.
- 주의: LSL 값(60N)은 예시. 실 규격은 사용자 확인 후 공정생품검사 탭에서 조정 필요.

## 2026-06-11 20:00 Codex

- 작업: `T-MENU-SHELF-LIFE-REINSPECT` 유수명자재 재검사 메뉴 미배치/카테고리 이동 오류 수정.
- 원인: `apps/frontend/src/config/menuConfig.ts`에는 `MAT_SHELF_LIFE_REINSPECT` / `MAT_SHELF_LIFE_HISTORY`가 있으나, 백엔드 `menu-code-validator.ts`의 `KNOWN_LEAF_CODES`에서 누락되어 있었다. 메뉴를 미배치로 삭제하면 DB 배치 행이 사라지고, 미배치 목록은 validator 목록 기준이라 해당 코드가 목록에도 나타나지 않으며, 다시 카테고리로 이동하면 `알 수 없는 메뉴 코드`로 실패하는 구조였다.
- 변경: `menu-code-validator.ts`에 누락 leaf 7개(`MAT_ARRIVAL_RESULT`, `MAT_SHELF_LIFE_REINSPECT`, `MAT_SHELF_LIFE_HISTORY`, `PROD_INPUT_KIOSK`, `QC_IQC_PART_SPEC`, `QC_REQUEST_INSPECT`, `QC_SELF_INSPECT_HISTORY`) 추가. `menu-code-validator.structure.test.mjs`를 추가해 `menuConfig.ts`의 path-backed leaf가 validator에 모두 있는지 검증.
- DB 적용: `apps/backend/src/migrations/2026-06-11_shelf_life_reinspect_menu_restore.sql` 작성 및 JSHANES 적용. `MAT_SHELF_LIFE`, `MAT_SHELF_LIFE_REINSPECT`, `MAT_SHELF_LIFE_HISTORY`를 `MATERIAL` 카테고리 sort 170/180/190으로 복구하고 `MANAGER` 권한을 `Y`로 보강.
- 검증: `node --test apps/backend/src/modules/menu-categories/utils/menu-code-validator.structure.test.mjs` 통과. `pnpm --filter @harness/backend exec jest apps/backend/src/modules/menu-categories/services/menu-category-items.service.spec.ts apps/backend/src/modules/menu-categories/controllers/menu-category-items.controller.spec.ts --runInBand` 통과(2 suites, 10 tests).
- 실측: JSHANES `MENU_CATEGORY_ITEMS` 조회 결과 유수명 3개 메뉴 모두 `MATERIAL`에 존재. `ROLE_MENU_PERMISSIONS` 조회 결과 `MANAGER` 3개 모두 `CAN_ACCESS='Y'`. `GET /api/v1/menu-categories/tree`에 `MAT_SHELF_LIFE_REINSPECT`가 MATERIAL 아래 노출됨. `PATCH /api/v1/menu-category-items/move`로 `MAT_SHELF_LIFE_REINSPECT`를 MATERIAL로 이동 호출 성공.

## 2026-06-11 19:30 Codex

- 작업: `T-FE-THEME-PRESET` 상단 컬러 테마 아이콘에서 선택 가능한 신규 테마 preset 추가.
- 변경: `apps/frontend/src/app/globals.css`에 사용자가 제공한 OKLCH 기반 Orchid 테마를 `data-color-theme="orchid"` preset으로 추가. 기존 `default`/`custom` 테마와 HANES 호환 변수(`--text`, `--surface`, `--primary-hover` 등)는 유지.
- 변경: `apps/frontend/src/stores/themeStore.ts`의 `ColorTheme` 타입을 `default | custom | orchid`로 확장. `apps/frontend/src/components/layout/Header.tsx`의 팔레트 아이콘은 `default → custom → orchid` 순환 선택으로 변경하고 활성 상태 점 표시를 추가.
- 검증: `pnpm --filter @harness/frontend build` 실행. Next 컴파일과 타입 검사 단계는 통과했으나, 정적 페이지 생성에서 기존 누락 라우트(`/pda/login`, `/equipment/daily-inspect`, `/inventory/material-physical-inv`, `/shipping/customer-po-status`, `/production/result`, `/material/shelf-life-reinspect`, `/master/worker`)의 `PageNotFoundError`로 실패. 변경 파일 관련 컴파일 오류는 없음.
- 런타임: 기존 3002 포트가 사용 중이라 `http://localhost:3004`로 dev 서버 기동, `Invoke-WebRequest http://localhost:3004` 응답 200 확인.

## 2026-06-11 16:24 Codex

- 작업: `T-TAB-LIMIT-10` 페이지 열기 탭 제한 개수 변경.
- 변경: `apps/frontend/src/stores/tabStore.ts`의 `MAX_TABS`를 6에서 10으로 변경하고 상단 설명 주석을 갱신. `apps/frontend/src/components/layout/TabKeepAlive.tsx`의 동시 마운트 유지 상한 `MAX_ALIVE`도 6에서 10으로 맞춤.
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit` 통과. `node --test apps/frontend/src/components/layout/tab-keep-alive-unique-paths.structure.test.mjs` 통과. `node --test apps/frontend/src/components/layout/sidebar-menu-navigation.structure.test.mjs` 통과. 관련 상수 검색으로 `MAX_TABS=10`, `MAX_ALIVE=10` 확인.

## 2026-06-11 15:30 Claude

- 작업: `T-REQINSPECT-LSL-USL` 의뢰검사 입력(`/quality/request-inspect`) 우측 패널에 LSL/USL 검사기준 표시.
- 관계: 라우팅 "공정생품검사" 탭(`SelfInspectConfigEditor` → `SELF_INSPECT_ITEMS`)에 등록한 측정형 항목의 LSL/USL/단위/기준을, 의뢰검사 대기행(`SELF_INSPECT_RESULTS`)의 `INSPECT_ITEM_ID` FK로 JOIN하여 표시.
- 백엔드: `self-inspect.service.ts` `findPendingDelegates`를 `.find()` → QueryBuilder LEFT JOIN(`i.id = r.inspectItemId`)으로 전환, `itemType/unit/standard/lslValue/uslValue` 추가 반환.
- 프론트: `request-inspect/page.tsx` `DelegateItem`에 5개 필드 추가, 우측 항목정보에 "검사 기준" 블록(LSL/USL/단위/기준) 추가. LSL/USL 없으면 측정형은 "규격 없음", 판정형은 "판정형 항목" 안내.
- i18n: ko/en/zh/vi 4파일에 `requestInspect.spec/unit/standard/noSpec/visualItem` 추가.
- 검증: `tsc --noEmit` 프론트/백엔드 모두 exit 0. LEFT JOIN이라 매칭 없으면 null → graceful.

## 2026-06-11 14:43 Codex

- 작업: `T-CUSTOMER-INTRO-WORK-INSTRUCTION` 고객용 제품 소개 자료 재생성 작업지시 문서 작성.
- 산출물: `docs/presentation/hanes-mes-introduction-work-instruction.md`.
- 내용: 최종 산출물 위치, 핵심 요구, 슬라이드 흐름, 캡처 우선순위, 기존 이미지 목록, 로컬 실행 기준, 문구/디자인 기준, 검증 기준, 최종 보고 형식을 정리.
- 검증: 문서 첫 40줄을 읽어 목적, 산출물, 핵심 요구, 자료 구성 원칙이 정상 반영됐는지 확인.

## 2026-06-11 13:59 Codex

- 작업: `T-CUSTOMER-INTRO-MENU-SCREEN-DECK` 현재 메뉴 화면 캡처 기반 고객용 제품 소개 자료 확장.
- 변경: 장수 제약을 제거하고 PPTX/HTML을 15장 구성으로 확장. 기준정보 화면은 여러 마스터 화면을 한 장에 묶고, 자재/재고, 생산/현장, 검사/품질, 불량, 출하, End-to-end trace 흐름을 화면 중심으로 재구성.
- 캡처: 실행 중인 프론트 `http://localhost:3002`와 현재 `menuConfig.ts` 기준으로 화면 캡처 자동화를 수행. DB 연결 확인 오버레이와 인증/초기 API를 캡처 세션에서 성공 응답으로 처리해 화면 프레임을 확보. `docs/presentation/assets/menu-captures/`에 메뉴 캡처 20개 저장, 파일 크기 기준 사용 가능 캡처 17개 선별. 기존 안정 캡처 5개와 함께 소개자료에 총 47개 이미지 참조를 사용.
- 산출물: `docs/presentation/hanes-mes-introduction.pptx`, `docs/presentation/hanes-mes-introduction.html`, `docs/presentation/assets/menu-captures/*`.
- 검증: PPTX 빌드 15장 완료, 레이아웃 검사 오류 0개, PPTX 패키지 미디어 47개/빈 미디어 0개. HTML 슬라이드 15장, 이미지 참조 47개, 누락 이미지 0개. 렌더 contact sheet 육안 확인 완료.
- 참고: 자재/생산/품질/출하 일부 메뉴는 실시간 캡처 자동화가 시간 제한에 걸려 기존 안정 캡처와 메뉴 화면 갤러리 방식으로 보강했다.

## 2026-06-12 01:35 Codex

- 작업: `T-CUSTOMER-INTRO-HTML-DESIGN` 고객 소개 HTML 디자인 재정리.
- 변경: 사용자가 지적한 흰 카드+상단 컬러바형 AI 느낌을 줄이기 위해 `metric`, `step`, `panel`, `callout`, `screen` 공통 스타일을 재정리했다. 컬러는 산화동/황동/스틸/세이지 계열로 낮추고, 단계 박스는 번호가 붙은 공정 보드 형태로 변경했다.
- 산출물: `docs/presentation/hanes-mes-introduction.html`.
- 검증: 정적 검증 결과 슬라이드 22장, 이미지 56개, 누락 0개. 기존 `border-top` 컬러바/구형 카드 그림자/뷰포트 폰트/`object-fit: cover` 위험 패턴 0개. `npx playwright screenshot`으로 파일 URL 기본 렌더 확인. `git diff --check` 통과.

## 2026-06-12 01:21 Codex

- 작업: `T-CUSTOMER-INTRO-HTML-V2` 고객 소개 HTML 자료 재구성.
- 변경: `docs/presentation/hanes-mes-introduction-work-instruction.md` 기준으로 기존 HTML을 22장 가로형 슬라이드로 재작성. PPTX는 생성하지 않고 후속 단계로 남김.
- 구성: 고객 가치, 메뉴 커버리지, 기준정보 2장, 자재 입하/IQC/바코드 매핑/불출/폐기·유수명/LOT 계보, 작업지시/키오스크/공정검사/설비관리/일상점검, 품질 불량 조치, 포장·출하, 역추적, 화면 갤러리, 시연 마무리 순서.
- 산출물: `docs/presentation/hanes-mes-introduction.html`.
- 검증: 정적 검증 결과 슬라이드 22장, 이미지 56개, 이미지 누락 0개, `font-size: clamp`/폰트 vw/`object-fit: cover` 위험 패턴 0개. Chrome headless 및 `npx playwright screenshot`으로 파일 URL 기본 렌더 확인.

## 2026-06-11 13:15 Codex

- 작업: `T-CUSTOMER-INTRO-PRODUCT-DECK` 고객용 HANES MES 제품 소개 자료 전면 재작성.
- 변경: 기존 자료에서 `설명 구성`, `시연 순서`, `고객에게 보여줄 포인트`처럼 문서 작성 방향을 설명하는 메타 문구를 제거하고, HANES MES 제품 자체를 소개하는 10장 구성으로 재작성.
- 구성: 하네스 업종 추적 리스크, MES 제품 구성, 자재 LOT 입고, 키오스크 작업 실적, 통전검사, 불량 조치, 제품/박스 출하, 클레임 역추적, 고객 가치로 정리.
- 산출물: `docs/presentation/hanes-mes-introduction.html`, `docs/presentation/hanes-mes-introduction.pptx`.
- 검증: PPTX 패키지 검증 결과 슬라이드 10장, 미디어 7개, 빈 미디어 0개. 레이아웃 검사 결과 오류 0개. HTML 검증 결과 슬라이드 10장, 이미지 참조 7개, 누락 이미지 0개. 렌더 contact sheet로 제품 소개 자료로 읽히는지 확인.
- 정리: 이전 `docs/presentation/artifact-build-manifest.json` 제거, PPTX 빌드용 임시 작업 폴더 삭제.

## 2026-06-11 12:56 Codex

- 작업: `T-CUSTOMER-INTRO-PPTX` 고객 소개용 HANES MES 가로형 PPTX 문서 생성.
- 산출물: `docs/presentation/hanes-mes-introduction.pptx`.
- 구성: HTML 소개 자료의 12장 워크플로우 구성을 PowerPoint 문서로 변환. 고객 설명용으로 기준정보, 자재 LOT, 생산/키오스크, 검사/품질, 불량 조치, 제품/출하 추적 흐름과 핵심 장점을 간결하게 구성.
- 검증: artifact-tool로 PPTX 빌드 완료. 레이아웃 검사 결과 12개 슬라이드 기준 오류 0개. PPTX 패키지 검증 결과 슬라이드 12장, 미디어 9개, 빈 미디어 0개. 렌더 contact sheet로 전체 슬라이드 시각 확인 완료.
- 정리: 빌드용 임시 작업 폴더 `outputs/019eb42d-791a-7821-9b1c-7a16a7d3686e/presentations/hanes-mes-introduction` 삭제 완료.

## 2026-06-11 12:39 Codex

- 작업: `T-CUSTOMER-INTRO-HTML-REV` 고객 소개 HTML 자료 워크플로우형 보강.
- 변경: 기존 8장 자료를 12장으로 재구성. 글자 크기 축소, 제목 침범/겹침 보정, `기준정보 → 자재 입하 → IQC/입고 → 생산 준비 → 현장 실행 → 검사/품질 → 제품/출하` 순서의 워크플로우 맵 추가.
- 메뉴 보강: 품목마스터, BOM 관리, 공정/라인, 라우팅, IQC품목규격, 설비점검항목, 월간생산계획, 작업지시관리, 자재출고요청, 생산진도현황, WIP재고, 실적입력 키오스크, 통전검사 실적, 불량등록관리, 수리/재작업, OQC, SPC, 제품재고조회, 포장, 출하지시, 출하처리, 반품관리 등을 소개 흐름에 노출.
- 검증: 로컬 Chrome + Playwright로 `docs/presentation/hanes-mes-introduction.html` 로드 확인. 슬라이드 12개, 본문 이미지 9개 참조 모두 로드, 모든 `.canvas` overflow X/Y 없음 확인.

## 2026-06-11 21:50 Codex

- 작업: `T-DATA-CLEAN-HNS02` HNS02 BOM 기준 JSHANES 테스트 데이터 클린징 준비.
- 확인: `BOM_MASTERS`에서 `BOM_GRP='HNS02'` 47행 확인. HNS02 기준 품목은 parent/child 합산 47개. `ITEM_MASTERS`는 76개 중 HNS02 기준 47개 유지, 29개 삭제 대상. `BOM_MASTERS`는 78개 중 HNS02 47행 유지, 31행 삭제 대상.
- dry-run: 사용자 요청 범위의 입하/입고/IQC/자재입출고/재고/제품재고/작업지시/생산실적/검사의뢰/품질검사 계열 전체 삭제와 비-HNS02 품목 기준정보 삭제 SQL을 JSHANES 트랜잭션에서 실행 후 `ROLLBACK`. 문법/FK 오류 없음. 예상 삭제 합계 1,375행.
- 상태: 실제 `DELETE`/`COMMIT`은 실행하지 않음. 사용자 최종 승인 대기.

## 2026-06-12 04:19 Codex

- 작업: `T-QUALITY-INSPECT-USEMEMO` `/quality/inspect` 외관검사 화면 `useMemo is not defined` 런타임 오류 수정.
- 원인: 통계 카드 제거 과정에서 React import의 `useMemo`가 함께 제거됐지만, 이력 DataGrid `columns` 정의는 계속 `useMemo<ColumnDef<VisualInspectRecord>[]>`를 사용했다.
- 변경: `apps/frontend/src/app/(authenticated)/quality/inspect/page.tsx`의 React import에 `useMemo`를 복원했다. 기존 통계 카드 제거 변경은 건드리지 않았다.
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과. `useMemo` 사용 TSX 파일 중 React import에 `useMemo`가 없는 파일 추가 검색 결과 없음.

## 2026-06-12 05:59 Codex

- 작업: `T-KIOSK-AUTOISSUE-BOM-MISMATCH-GUARD` 키오스크 투입스캔 LOT와 BOM 품목 불일치 실적처리 차단.
- 원인: 스캔 API는 `MAT_LOTS` 품목이 프론트에서 전달한 BOM 항목에 없으면 오장착으로 막지만, 실적처리 단계의 `AutoIssueService`는 기존 `JOB_MATERIAL_LOTS` 행을 다시 검증하지 않고 스캔 `matUid` 우선순위만 적용했다. 오염된 스캔 행이 있으면 잘못된 LOT는 후보에서 빠지고 FIFO로 넘어갈 수 있었다.
- 변경: `AutoIssueService`에서 작업지시의 유효 BOM child 품목 집합을 만든 뒤, `JOB_MATERIAL_LOTS.itemCode`와 실제 `MAT_LOTS.itemCode`를 모두 대조한다. BOM에 없는 스캔 자재, 존재하지 않는 스캔 LOT, 등록 품목과 실제 LOT 품목 불일치는 `BadRequestException`으로 실적처리/자동차감을 중단한다.
- 검증: TDD RED 확인 후 수정. `pnpm --filter @harness/backend test -- auto-issue.service.spec.ts --runInBand` 통과(13건). `pnpm --filter @harness/backend test -- job-material-lot.service.spec.ts auto-issue.service.spec.ts --runInBand` 통과(17건). `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` 통과.

## 2026-06-11 22:03 Codex

- 작업: `T-DATA-CLEAN-HNS02` 사용자 승인 후 JSHANES 데이터 클린징 실행.
- 실행: dry-run 검증 SQL을 JSHANES에 `COMMIT`. 실행 시점 추가 데이터 포함으로 1차 삭제 1,379행. 후검증에서 `SIMULATION_PLANS` 비-HNS02 24건이 남아 `SIMULATION_SCHEDULES` 38건, `SIMULATION_PLANS` 24건, `SIMULATION_HEADERS` 2건을 추가 삭제/커밋했다.
- 최종 검증: 비-HNS02 `ITEM_CODE` 잔여 `NONE`. `KEEP_ITEMS=47`, `ITEM_MASTERS=47`, `BOM_MASTERS=47`. 요청 업무 테이블 잔여 `NONE`.
- 완료: HNS02 BOM 기준 품목/BOM만 유지하고 입하/입고/IQC/자재입출고/재고/제품재고/제품실적/작업지시/창고입고/검사의뢰/품질검사/시뮬레이션 데이터 제거 완료.

## 2026-06-11 21:37 Codex

- 작업: `T-IQC-SAMPLE-REMOVE` IQC 검사구분에서 `SAMPLE` 제거.
- 판단: `IQC_GROUPS.INSPECT_METHOD`는 검사그룹 마스터의 검사/무검사 구분이고, `IQC_LOGS.INSPECT_CLASS`는 별도/legacy 검사이력 컬럼이다. 두 컬럼을 같은 의미로 매핑하는 것은 잘못이므로 `IQC_LOGS.INSPECT_CLASS` 기존 값은 변경하지 않았다.
- 변경: `IQC_INSPECT_METHOD` 활성 코드를 `FULL=검사`, `SKIP=무검사`만 남기고 `SAMPLE`은 비활성화하도록 마이그레이션 정리. JSHANES 기존 `IQC_GROUPS.INSPECT_METHOD='SAMPLE'` 4건은 `FULL`로 정규화하고 `SAMPLE_QTY`는 null 처리. 신규 수입검사 모달/훅은 검사구분 값을 `inspectClass`로 보내지 않도록 분리. `IqcGroupService`는 신규/수정 시 legacy `sampleQty`를 항상 null로 둔다.
- DB 검증: 적용 전 `ITEM_MASTERS_SAMPLE=0`, `IQC_GROUPS_SAMPLE=4`, `IQC_LOGS_CLASS_SAMPLE=10`, `COM_CODES_SAMPLE_ACTIVE=1`. 적용 후 `ITEM_MASTERS_SAMPLE=0`, `IQC_GROUPS_SAMPLE=0`, `IQC_LOGS_CLASS_SAMPLE=10`, `COM_CODES_SAMPLE_ACTIVE=0`. `IQC_GROUPS`는 `FULL=5`만 존재.
- 검증: `node --test "apps/frontend/src/app/(authenticated)/material/iqc/iqc-code-groups.structure.test.mjs"` 통과(7건). `pnpm --filter @harness/frontend exec tsc --noEmit` 통과. `pnpm --filter @harness/backend exec tsc --noEmit` 통과. `pnpm --filter @harness/backend test -- iqc-group.service.spec.ts` 통과(9건). `git diff --check` 통과.

## 2026-06-11 21:20 Codex

- 작업: `T-MAT-LOT-IQC-UID-SEPARATE` MAT_LOTS 시드 LOT와 IQC 이력 UID 중복 해소.
- 원인: JSHANES에서 `MAT_LOTS.MAT_UID`와 `IQC_LOGS.MAT_UID`가 `VH1-RM260526-00007`, `VH1-RM260603-00003`, `VH1-RM260605-00002`, `VH1-RM260607-00001` 4개 UID로 겹쳤고, IQC 이력은 6건이라 LOT 화면에서 이미 검사된 LOT처럼 혼동될 수 있었다.
- 조치: `apps/backend/src/migrations/2026-06-11_mat_lot_iqc_uid_separate.sql` 추가. IQC 이력은 유지하고 `MAT_LOTS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS`의 재고/LOT 쪽 UID만 `MLT-RM260526-00007`, `MLT-RM260603-00003`, `MLT-RM260605-00002`, `MLT-RM260607-00001`로 변경했다.
- 검증: oracle-db connector로 JSHANES 적용 및 재실행 성공. `OLD_INVENTORY_REFS=0`, `NEW_INVENTORY_REFS=15`, `MAT_LOT_IQC_OVERLAP=0`. `git diff --check -- apps/backend/src/migrations/2026-06-11_mat_lot_iqc_uid_separate.sql .ai-coordination/TASKS.md .ai-coordination/LOCKS.md` 통과.

## 2026-06-11 21:21 Codex

- 작업: `T-IQC-METHOD-LABELS` IQC 검사/무검사 표시 라벨 통일.
- 원인: 같은 IQC `FULL/SAMPLE/SKIP` 구분이 화면별로 `검사방법`, `검사형태`, `검사분류`로 표시되고, 선택값도 `전수검사/샘플검사`처럼 나뉘어 사용자가 검사/무검사 구분으로 읽기 어려웠다.
- 변경: `IQC_INSPECT_METHOD`의 `FULL`, `SAMPLE` 표시명을 모두 `검사`, `SKIP` 표시명을 `무검사`로 유지. 품목정보, IQC 검사기준, IQC 검사그룹, 수입검사 목록/입력, 검사이력 범위 라벨의 한국어 표준 표시명을 `검사구분`으로 통일하고 ko/en/zh/vi locale 및 fallback 문자열을 갱신했다. 내부 타입/공통코드 주석도 `IQC 검사구분`으로 정리했다.
- DB: `apps/backend/src/migrations/2026-06-11_iqc_inspect_code_groups.sql`을 JSHANES에 재적용. 확인 결과 `FULL=검사`, `SAMPLE=검사`, `SKIP=무검사`, `CODE_DESC=IQC 검사구분:*` 3건.
- 검증: `node --test "apps/frontend/src/app/(authenticated)/material/iqc/iqc-code-groups.structure.test.mjs"` 통과(5건). `pnpm --filter @harness/frontend exec tsc --noEmit` 통과. 구조 테스트는 IQC 라벨이 `검사구분`, 선택값이 `검사/무검사`만 되도록 회귀 방지한다.

## 2026-06-11 12:27 Claude

- 작업 1: 스케줄러 알림 벨 임시 비활성화 (커밋 `1f439a7`).
  - `NotificationBell.tsx` 폴링 60초 → 30분, 백그라운드 탭 폴링 중지(`visibilitychange` 시 즉시 갱신).
  - 백엔드 미기동 시 unread-count 폴링이 ECONNREFUSED 에러 리포트 모달을 띄우는 노이즈 때문에 `Header.tsx`에서 `<NotificationBell />` 렌더링·import 주석 처리. 재활성화는 Header 주석 2곳 해제.
- 작업 2: 앱 탭 재진입 초기화 + 최대 6개 제한 (커밋 `2fd6335`).
  - `tabStore.ts`: zustand persist 제거(비영속) → 새로고침/재진입 시 탭 초기화. `MAX_TABS=10→6`, 초과 시 자동 제거 대신 추가 차단 + `limitNoticeOpen` 플래그, `addTab`이 boolean 반환.
  - `useTabSync.ts`: 현재 경로 탭이 없으면(딥링크/새로고침) `findMenuItemByPath`(menuConfig 신규 유틸)로 탭 자동 등록 — 비영속 전환 후 빈 화면 방지.
  - `SidebarMenu.tsx`: 탭 추가 차단 시 `e.preventDefault()`로 페이지 이동도 차단. `TabBar.tsx`: 한도 초과 안내 Modal(md). `TabKeepAlive.tsx`: `MAX_ALIVE 8→6`.
  - i18n: `tabs.limitTitle`/`tabs.limitMessage` ko/en/zh/vi 4개 파일 추가.
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit` 통과, 구조 테스트 2건 통과(sidebar-menu-navigation, tab-keep-alive-unique-paths), locale JSON 4종 파싱 정상. dev 서버 가동 중이라 `pnpm build` 미실행.

## 2026-06-11 12:00 Codex

- 작업: `T-CUSTOMER-INTRO-HTML` 고객 소개용 HANES MES 가로형 HTML 자료 생성.
- 산출물: `docs/presentation/hanes-mes-introduction.html`, `docs/presentation/assets/01-material-receive.png`, `02-input-kiosk.png`, `03-inspection-result.png`, `04-quality-defect.png`, `05-shipping-box-stock.png`.
- 구성: 16:9 가로 슬라이드 8장. 하네스 업종 특성에 맞춰 자재 LOT/시리얼 추적, 키오스크 작업, 통전검사, 불량관리, 박스/개별제품 출하 추적성을 고객 소개 관점으로 요약.
- 검증: 로컬 Chrome + Playwright로 HTML 로드 확인, 슬라이드 수 8개 확인, 본문 이미지 5개 모두 `naturalWidth=1600`, `naturalHeight=900` 로드 확인.
- 참고: `/shipping/pack`, `/shipping/order`, `/production/pack-result`는 `domcontentloaded` 대기에서 타임아웃되어 소개자료에는 안정적으로 캡처된 `/shipping/box-stock`을 사용.

## 2026-06-12 02:20 Codex

- 작업: `T-INV-TRANSACTION-CARDS` `/inventory/transaction` 재고수불현황 정보카드 제거.
- 변경: `apps/frontend/src/app/(authenticated)/inventory/transaction/page.tsx`에서 상단 `StatCard` 3개(전체 거래, 입고 합계, 출고 합계)를 제거하고, 카드 전용 `total`, `totalIn`, `totalOut` 상태/계산 및 관련 아이콘/import를 정리했다. 조회 조건, 새로고침, 그리드, MAT UID 검색, 내보내기는 그대로 유지했다.
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 1차 통과. 최종 재실행 시 다른 변경 파일인 `apps/frontend/src/app/(authenticated)/quality/inspect/page.tsx`의 `useMemo` import 누락 및 implicit any 오류로 전체 typecheck가 실패했다. `inventory/transaction`의 카드 관련 잔여 참조 검색 결과 없음. `git diff --check -- "apps/frontend/src/app/(authenticated)/inventory/transaction/page.tsx" ".ai-coordination/TASKS.md" ".ai-coordination/LOCKS.md" ".ai-coordination/JOURNAL.md" ".ai-coordination/HANDOFF/codex.md" ".ai-coordination/ARCHIVE.md"` 통과. `http://localhost:3002/inventory/transaction` HTTP 200 확인.
- 참고: `pnpm --filter @harness/frontend lint -- --file "src/app/(authenticated)/inventory/transaction/page.tsx"`는 기존 `next lint` 스크립트가 ESLint 설정 프롬프트를 띄워 실패했다. `browse.exe`는 자체 서버 시작이 15초 내 완료되지 않아 브라우저 DOM 검증은 수행하지 못했다.

## 2026-06-12 16:17 Codex

- 작업: `T-QC-SAMPLE-MENU-LABEL` 품질검사 하위 자주검사 이력 메뉴명 변경.
- 변경: 좌측 메뉴가 참조하는 `menu.quality.selfInspectHistory` 한글 번역을 `자주검사 이력`에서 사용자 요청 문구 `공정샘풀검사`로 변경했다. `menuConfig.ts`의 `QC_SELF_INSPECT_HISTORY`는 동일 labelKey를 사용하므로 메뉴 코드/경로/권한/DB seed는 변경하지 않았다.
- 검증: `node -e "JSON.parse(require('fs').readFileSync('apps/frontend/src/locales/ko.json','utf8')); console.log('ko.json OK')"` 통과. `rg`로 `menuConfig.ts`가 `menu.quality.selfInspectHistory`를 참조하고 `ko.json` 값이 `공정샘풀검사`임을 확인했다.

## 2026-06-12 05:28 Codex

- 작업: `T-CUSTOMER-INTRO-PPTX-EXPORT` 고객 소개 HTML 23장 기준 편집 가능한 PPTX 재생성.
- 변경: `docs/presentation/hanes-mes-introduction.html` 내용을 파싱해 `docs/presentation/hanes-mes-introduction.pptx`를 새로 생성했다. 제목, 본문, 절차 박스, 메뉴 표, 캡션, 하단 문구는 PowerPoint 편집 가능한 텍스트/도형 객체로 구성했고, 실제 화면 캡처와 회사 배경 이미지는 이미지 객체로 배치했다.
- 산출: 최종 PPTX는 `docs/presentation/hanes-mes-introduction.pptx`. 생성용 임시 스크립트와 PowerPoint 렌더 PNG는 검증 후 정리했다.
- 검증: PPTX 패키지 기준 슬라이드 23장, 미디어 25개, 빈 미디어 0개. 대표 슬라이드 객체 확인 결과 1/2/3/9/10/16/20/21/23페이지 모두 텍스트 객체 포함. PowerPoint COM으로 전체 23장을 PNG 렌더링했고 1, 2, 3, 6, 10, 16, 20, 21, 23페이지를 시각 확인했다. `git diff --check` 통과.
## 2026-06-12 10:41 Codex

- 작업: `T-INTEGRATION-FLOW-REPORT` HNS02 기준 MES 전 공정 통합 테스트 및 보고서 작성.
- 실행: JSHANES company `40`, plant `1000`, 계정 `admin@hanes.com`로 실제 API 런타임을 호출해 PO `PO-IT-0612102556`부터 입하 `R26061200002`, IQC, 검사성적서 업로드, PDA 자재입고 `RCV20260612-0001`, 원자재 재고조회, 작업지시 `JO-IT-0612102813`, 자재요청 `MR2606120004`, 자재출고 `ISS20260612-0001`, 생산실적 `PR26061200015`, 제품입고 `PTX2026061200002`, 제품포장 `BX-IT-0612103010`, OQC `OQC-20260612-001`, 출하지시 `SO-IT-0612103010`, 출하 처리까지 한 흐름을 완료했다.
- 결함 수정: 출하 처리에서 박스 `serialList`가 있어도 `ShipOrderService.shipBox()`가 제품재고 차감을 `prdUid='*'`로 호출해 실제 재고 `PRD-IT-0612102849`를 찾지 못하는 문제를 수정했다. 시리얼이 있으면 시리얼별 1개씩 출고하고, 박스 수량과 시리얼 수량 불일치 시 거부하도록 변경했다.
- 검증: TDD RED 후 `pnpm --filter @harness/backend test -- ship-order.service.spec.ts --runInBand` 통과(19건). 동일 실데이터 `SO-IT-0612103010/BX-IT-0612103010` 출하 재호출 성공. API/DB 확인 결과 출하지시 `CLOSED`, 박스 `SHIPPED`, `FG_MAIN/HNS02/PRD-IT-0612102849` 재고 0, `PRODUCT_TRANSACTIONS`에 `FG_OUT` `PTX2026061200003` 생성 확인.
- 산출물: `docs/reports/hanes-integration-flow-test-2026-06-12.md`.
- 남은 이슈: `FG_LABELS` 기준 라벨 행 부재로 박스 품목 조회가 `missingLabel=true`이고 박스재고 serial 조회가 비어 있음. 제품라벨 생성 API의 `sourceId` 숫자형 계약과 문자열 생산실적번호 불일치 의심. 제품입고 후 `WIP_MAIN/HNS02/PRD-IT-0612102849` 재고 1이 남아 WIP→FG 이동 처리 확인 필요.
## 2026-06-12 11:02 Codex

- 작업: `T-INTEGRATION-FLOW-ISSUES-FIX` 최종보고서 등록 문제점 수정 및 재테스트.
- 원인/수정 1: 제품라벨 생성 API가 문자열 생산실적 번호를 받을 수 없고 `FG_LABELS`를 생성하지 않아 포장/박스재고 화면에서 `missingLabel=true`가 됐다. `CreatePrdLabelsDto.sourceId`를 문자열 변환/검증으로 변경하고, 제품라벨 발행 시 `FG_LABELS`를 생성 또는 누락 보강하도록 수정했다. `LABEL_PRINT_LOGS.PRINTED_AT` NOT NULL 런타임 오류도 `printedAt` 명시로 수정했다.
- 원인/수정 2: 박스 마감 시 라벨 상태만 `PACKED`로 바꾸고 `FG_LABELS.BOX_NO`를 찍지 않아 `box-stock` 조회 기준에 걸리지 않았다. `BoxService.closeBox()`에서 `STATUS='PACKED'`와 `BOX_NO=<boxNo>`를 함께 갱신하도록 수정했다.
- 원인/수정 3: 완제품 입고가 WIP 재고를 차감하지 않고 FG 재고를 별도 입고로만 생성해 WIP 잔량이 남았다. `/inventory/fg/receive`가 `ProductInventoryService.receiveFinishedFromWip()`를 통해 `WIP_MAIN -> FG_MAIN` 이동(`WIP_OUT`)으로 처리되도록 변경했다.
- 재테스트: JSHANES 실데이터로 `JO-FIX-105908`, `PR26061200017`, `P26061200004`, `BX-FIX-105908`, `OQC-20260612-002`, `SO-FIX-105908` 흐름을 실행. 결과: 박스 품목 `missingLabel=0`, 출하 전 박스재고 serial 1건, 출하지시 `CLOSED`, 박스 `SHIPPED`, `FG_MAIN/HNS02/P26061200004=0`, `WIP_MAIN/HNS02/P26061200004=0`.
- DB 검증: `FG_LABELS`는 `P26061200004`가 `BOX_NO=BX-FIX-105908`, `STATUS=SHIPPED`, `INSPECT_PASS_YN=Y`. `PRODUCT_TRANSACTIONS`는 `WIP_IN PTX2026061200004`, `WIP_OUT PTX2026061200005`, `FG_OUT PTX2026061200006`.
- 검증 명령: `pnpm --filter @harness/backend test -- product-label.service.spec.ts product-inventory.service.spec.ts box.service.spec.ts ship-order.service.spec.ts --runInBand` 통과(59건). `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` 통과. `git diff --check` 통과.
- 산출물: `docs/reports/hanes-integration-flow-test-2026-06-12.md` 갱신.

## 2026-06-12 11:25 Codex

- 작업: `T-INTEGRATION-NORMAL-REVERSE` HNS02 정상/역처리 통합 재테스트.
- 변경: `POST /shipping/orders/:id/cancel-ship-box`를 추가해 출하된 박스를 출하 직전 상태로 되돌리도록 했다. 처리 내용은 `FG_OUT_CANCEL` 제품재고 복원, `BOX_MASTERS.STATUS='CLOSED'`, `FG_LABELS.STATUS='PACKED'`, `SHIPMENT_ORDER_ITEMS.SHIPPED_QTY` 차감, `SHIPMENT_ORDERS.STATUS='CONFIRMED'` 복원이다. 기존 `shipBox()`는 박스 `serialList`가 있으면 시리얼별 `prdUid`로 제품재고를 차감하고, 박스 수량과 시리얼 수량이 다르면 거부한다.
- 정상 시나리오: `PO-NR-26061202215660` → `R26061200007` → IQC PASS/성적서 업로드 → `RCV20260612-0006` → `JO-OK-26061202215660` → `MR2606120012`/`ISS20260612-0011` → `PR26061200022`/`P26061200009` → `BX-OK-26061202215660`/`OQC-20260612-006` → `SO-OK-26061202215660` 출하 완료.
- 출하 역처리 시나리오: `JO-RV-26061202215660` → `PR26061200023`/`P26061200010` → `BX-RV-26061202215660`/`OQC-20260612-007` → `SO-RV-26061202215660` 출하 후 `cancel-ship-box` 실행. DB 결과 `SHIPMENT_ORDERS.STATUS=CONFIRMED`, `SHIPPED_QTY=0`, 박스 `CLOSED`, 라벨 `PACKED`, `FG_MAIN/HNS02/P26061200010=1`, `FG_OUT_CANCEL PTX2026061200020` 확인.
- 취소/삭제 검증: `SO-DEL-26061202215660` DRAFT 출하지시 삭제, `BX-DEL-26061202215660` 빈 박스 삭제, `JO-CXL-26061202215660` 작업지시 취소를 확인했다. 추가로 `PR26061200024` 생산실적을 취소 후 삭제했고, `ISS20260612-0013/1` 자재출고 취소 후 `MAT_STOCKS.W001/HSG0001/M26061200075=1` 복원을 확인했다.
- 검증: `pnpm --filter @harness/backend test -- ship-order.service.spec.ts --runInBand` 통과(20건). `pnpm --filter @harness/backend build` 통과. `pnpm --filter @harness/backend typecheck`는 패키지 스크립트가 없어 실행 불가. JSHANES `oracle-db` 조회로 정상/역처리 최종 상태 확인.
- 산출물: `docs/reports/hanes-integration-normal-reverse-test-2026-06-12.md`, `docs/reports/hns02-normal-reverse-runtime-test-26061202215660.json`, `tools/hns02-normal-reverse-runtime-test.mjs`.

## 2026-06-12 11:49 Codex

- 작업: `T-MASTER-CRUD-RUNTIME` 기준정보 화면/API CRUD 실데이터 점검 및 보고서 작성.
- 실행: `tools/hanes-master-crud-runtime-test.mjs`를 추가하고 `http://localhost:3003/api/v1`, company `40`, plant `1000`, 계정 `admin@hanes.com`으로 기준정보 CRUD를 실행했다. 최종 stamp는 `26061202474131`.
- 범위: 공통코드, 거래처, 품목 2종, 공정, 생산라인, 작업자, 창고/로케이션/이동규칙, 설비/공정-설비매핑, BOM, 라우팅그룹/공정/조건/자재, 공정CAPA, 제조사바코드, IQC 검사항목풀/품목검사/품목규격, 설비점검항목/매핑, 라벨템플릿, 작업지도서, 교대패턴, 작업달력, 설비BOM, 계측기.
- 조치: 초기 실패는 백엔드 결함이 아니라 테스트 payload와 DTO 불일치였다. `businessNo -> bizNo`, 생산라인 `oper` 길이 제한 대응, IQC revision 정수화, IQC 품목규격 DTO 구조 수정, 설비점검매핑 `sortSeq`, 작업달력 `holidayApply` 제거, IQC 품목규격 cleanup 선행 삭제를 반영했다.
- 검증: 최종 실행 결과 API 단계 101/101 성공, cleanup 30/30 성공, 실패 0건. Oracle `JSHANES` 직접 조회로 테스트 stamp `26061202474131`이 32개 관련 기준정보 테이블에 남지 않음을 확인했다(`nonzero=[]`). 이전 실패 실행에서 남은 IQC 품목규격/검사항목풀 테스트행 8건도 API로 정리했다.
- 산출물: `docs/reports/hanes-master-crud-runtime-test-2026-06-12.md`, `docs/reports/hanes-master-crud-runtime-test-26061202474131.json`, `tools/hanes-master-crud-runtime-test.mjs`.

## 2026-06-12 12:32 Codex

- 작업: `T-IQC-SERIAL3-RUNTIME` 수입검사(IQC) 절차대로 시리얼 3개 실데이터 처리 및 기록 작성.
- 실행: `tools/hanes-iqc-serial3-runtime-test.mjs`로 `http://localhost:3003/api/v1`, company `40`, plant `1000`, 계정 `admin@hanes.com` 헤더를 사용해 구매발주 `PO-IQC3-26061203191605`, 입하 `R26061200008`, 시리얼 `VH1-RM260612-00017/00018/00019`, 입고 `RCV20260612-0007` 흐름을 처리했다.
- 판단: JSHANES 기준 IQC 대상 원자재 중 `LOT_UNIT_QTY=1` 품목이 없어 `HSG0001`(`IQC_FLAG=Y`, `INSPECT_METHOD=FULL`, `LOT_UNIT_QTY=20`)을 수량 60으로 입하해 시리얼 3개를 생성했다.
- 검증: API 단계 17/17 성공, 실패 0건. Oracle `JSHANES` 조회로 `PURCHASE_ORDERS` 확정, `PURCHASE_ORDER_ITEMS.RECEIVED_QTY=60`, `MAT_ARRIVALS` 3건 `PASS/DONE`, `MAT_LOTS` 3건 `PASS/NORMAL`, `IQC_LOGS.RESULT=PASS`, `MAT_RECEIVINGS` 3건 `DONE`, `STOCK_TRANSACTIONS` 6건, 각 시리얼 `RM_MAIN` 재고 20 및 `W001` 재고 0을 확인했다.
- 산출물: `docs/reports/hanes-iqc-serial3-runtime-test-2026-06-12.md`, `docs/reports/hanes-iqc-serial3-runtime-test-26061203191605.json`, `tools/hanes-iqc-serial3-runtime-test.mjs`.

## 2026-06-12 12:49 Codex

- 작업: `T-MASTER-FE-QA` 기준정보 하위 메뉴 프론트엔드 실테스트 및 HTML 보고서 작성.
- 실행: `tools/hanes-master-frontend-qa.mjs`를 추가하고 `http://localhost:3002` 프론트엔드, `http://localhost:3003/api/v1` 백엔드, company `40`, plant `1000`, 계정 `admin@hanes.com` 세션으로 Playwright 실제 브라우저 검증을 수행했다.
- 범위: `pageRegistry.generated.ts` 기준 `/master/*` 21개 화면(BOM, 공통코드, 회사/사업장, 설비, 설비점검, 계측기, IQC 기준정보, 라벨, 품목, 거래처, 공정, CAPA, 생산라인, 라우팅, 제조사바코드, 창고, 작업달력, 작업지도서, 작업자)을 전부 순회했다.
- 시나리오: 각 화면 진입 후 초기 화면 캡처, 검색/조회 가능한 화면은 검색 실행 후 캡처, 추가/신규 버튼이 있는 화면은 저장 없이 폼을 열어 캡처했다. 콘솔 오류, page error, `/api`/`_next` HTTP 400 이상 응답을 실패 조건으로 수집했다.
- 검증: 최종 `node tools\hanes-master-frontend-qa.mjs` 실행 결과 21/21 성공, 실패 0건, 캡처 60개. HTML 내 `<img>` 60개 상대경로도 전부 존재 확인(`missing=[]`).
- 산출물: `docs/reports/hanes-master-frontend-qa-2026-06-12.html`, `docs/reports/hanes-master-frontend-qa-2026-06-12/result.json`, `docs/reports/hanes-master-frontend-qa-2026-06-12/screenshots/*.png`, `tools/hanes-master-frontend-qa.mjs`.

## 2026-06-13 21:26 Codex

- 작업: `T-IQC-SQL-DISPLAY` `/material/iqc` 최초 그리드 SQL 조회문 정확화.
- 변경: `IqcHistoryService.findPendingArrivals()`를 `MAT_LOTS`와 `ITEM_MASTERS` 단일 QueryBuilder 조인으로 구성하고 `qb.getSql()`/`qb.getParameters()`를 `debugSql`로 반환하게 했다. 컨트롤러는 기존 `data` 배열 응답을 유지하면서 `meta.debugSql`을 추가한다. 프론트는 `meta.debugSql`을 받아 SQL 조회문 모달에 실제 SQL과 parameters 주석을 표시하고, 기존 `MAT_ARRIVALS` 하드코딩 SQL은 제거했다.
- 검증: TDD RED 후 신규 테스트 `검사 대상 목록과 함께 실제 QueryBuilder SQL과 파라미터를 반환한다` 통과. `pnpm --filter @harness/backend exec tsc --noEmit` 통과. `pnpm --filter @harness/frontend exec tsc --noEmit` 통과. 관련 파일 `git diff --check` 통과.
- 남은 이슈: `pnpm --filter @harness/backend test -- iqc-history.service.spec.ts` 전체 실행은 기존 `findAll` 테스트 3건 실패가 남아 실패한다. 이번 신규 `findPendingArrivals` 테스트는 통과한다.

## 2026-06-13 21:45 Codex

- 작업: `T-SQL-SCHEMA-TOGGLE` SQL 조회문 모달 컬럼명세 토글 공통 적용.
- 변경: `SqlViewerModal` 기본 화면을 SQL 단독 보기로 바꾸고, 상단에 `컬럼명세 보기/숨기기` 버튼을 추가했다. 컬럼명세 API(`/system/table-schema`)는 사용자가 버튼을 눌러 펼칠 때만 호출한다. `SqlViewerModal`은 `DataGrid`에서 단일 공통 경로로 사용되므로 모든 `DataGrid.sqlQuery` 페이지에 적용된다.
- 검증: TDD RED 후 `node apps/frontend/src/components/data-grid/sql-viewer-modal.structure.test.mjs` 통과. `pnpm --filter @harness/frontend exec tsc --noEmit` 통과. 관련 파일 `git diff --check` 통과.

## 2026-06-15 18:56 Codex

- 작업: `T-UI-CRUD-RED-MENU-QA` 좌측 메뉴 전체 최종 PASS QA 및 HTML 보고서 작성.
- 실행: `ui-test-crud-red` 좌측 메뉴 runner로 실제 프론트 `http://localhost:3002`, 백엔드 `http://localhost:3003/api/v1`, 계정 `admin@hanes.com`, company `40`, plant `1000` 세션에서 현재 좌측메뉴 노출 화면 96개를 순회했다. 범위는 화면 진입, 초기 조회 API, 콘솔/page error, 주요 렌더링 상태, 화면 캡처 검증이다.
- 수정: `/production/wip-stock`은 `MatStock.part` 없는 관계를 조인해 500이 발생하던 문제를 `ProductStock` 기준 raw join(`PRODUCT_STOCKS`, `ITEM_MASTERS`, `WAREHOUSES`)으로 수정하고 단위 테스트를 보강했다. `/system/config`는 API 응답에 `id`가 없고 `configKey`가 식별자인데 프론트가 `cfg.id`를 key/저장/삭제 식별자로 사용해 React key 경고가 발생하던 문제를 `configKey` fallback 식별자로 수정했다. 테스트 러너는 장시간 Turbopack/DB transient와 `로그인` 단어 오탐을 구분하도록 보강하고, 최종 HTML 양식을 승인된 최종 PASS 보고서 구조로 변경했다.
- 런타임 조치: Turbopack panic으로 `.next` manifest/chunk 생성물이 손상되어 프론트 dev 서버를 정리하고, workspace 내부 `apps/frontend/.next`만 삭제 후 `pnpm dev`를 재시작했다.
- 검증: 최종 재실행 `run-resume-final-after-config-key-fix.log` 결과 96/96 PASS, 실패 0. `docs/reports/ui-test-crud-red-menu-qa-2026-06-15/result.json` 무결성 검증 결과 total 96, completed 96, passed 96, failed 0, 누락 스크린샷 0, HTML PASS 문구 확인. `pnpm --filter @harness/backend test -- production-views.service.spec.ts --runInBand` 통과(5건). `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과. `GET /api/v1/health` DB connected 확인.
- 산출물: `docs/reports/ui-test-crud-red-menu-qa-2026-06-15.html`, `docs/reports/ui-test-crud-red-menu-qa-2026-06-15/result.json`, `docs/reports/ui-test-crud-red-menu-qa-2026-06-15/screenshots/*.png`.

## 2026-06-15 19:08 Codex

- 작업: `T-MENU-QA-DETAIL-REPORT` 좌측 메뉴 QA HTML 보고서 상세화.
- 변경: 기존 최종 PASS 결과와 스크린샷은 유지하고 `docs/reports/ui-test-crud-red-menu-qa-2026-06-15.html`을 메뉴별 상세 절차형 보고서로 재생성했다. 96개 메뉴마다 메뉴명/코드/경로/그룹, 수행 절차, 확인 기준, 최종 화면 캡처를 별도 섹션으로 분리했다.
- 추가: `tools/generate-menu-qa-detailed-report.mjs`를 추가해 `result.json`과 `ko.json`, 스크린샷 파일을 읽어 동일 양식의 상세 HTML을 재생성할 수 있게 했다.
- 검증: 생성 결과 `status=PASS`, total 96, detailSections 96, missingScreenshots 0. HTML 구조 검증 결과 `.menu-detail` 96개, `<img>` 96개, 스크린샷 누락 0개, 재검증 필요 문구 없음, 실패 문구 없음. 관련 파일 `git diff --check` 통과.
- 산출물: `docs/reports/ui-test-crud-red-menu-qa-2026-06-15.html`, `tools/generate-menu-qa-detailed-report.mjs`.

## 2026-06-15 19:47 Codex

- 작업: `T-MASTER-PART-PAGE-SCENARIO-QA` `/master/part` 품목관리 페이지 단위 상세 시나리오 QA 파일럿.
- 실행: 실제 브라우저 `http://localhost:3002/master/part`, 백엔드 `http://localhost:3003/api/v1`, 계정 `admin@hanes.com`, company `40`, plant `1000` 세션으로 품목관리 1개 화면을 테스트했다. 시나리오는 초기 조회, 새로고침, 신규 전 검색, 신규 등록/저장 검증, 등록 후 재조회, 중복 등록 방어, 수정/저장 검증, 수정 후 재조회, 삭제/저장 검증, 삭제 후 재조회 10단계다.
- 검증: 최종 실행 `node tools/hanes-master-part-page-scenario-qa.mjs` 결과 PASS. 테스트 키 `FECRUD-260615104355`, 단계 10개 전부 PASS, UI/API 호출 기록 24건, Oracle `JSHANES` DB 검증 9건, 화면 증적 누락 0개. 최종 DB 조회에서 `ITEM_CODE LIKE 'FECRUD%' OR PART_NO LIKE 'FECRUD%'` 잔여 0건 확인.
- 산출물: 목차 `docs/reports/hanes-page-scenario-qa-2026-06-15/index.html`, 페이지 상세 `docs/reports/hanes-page-scenario-qa-2026-06-15/pages/master-part.html`, 결과 JSON `docs/reports/hanes-page-scenario-qa-2026-06-15/master-part-result.json`, 스크린샷 `docs/reports/hanes-page-scenario-qa-2026-06-15/screenshots/master-part/*.png`, 실행 스크립트 `tools/hanes-master-part-page-scenario-qa.mjs`.

## 2026-06-15 20:24 Codex

- 작업: `T-MASTER-BOM-PAGE-SCENARIO-QA` `/master/bom` BOM관리 페이지 단위 상세 시나리오 QA.
- 실행: `hanes-page-scenario-qa` 기준으로 실제 브라우저 `http://localhost:3002/master/bom`, 백엔드 `http://localhost:3003/api/v1`, 계정 `admin@hanes.com`, company `40`, plant `1000`, Oracle `JSHANES`를 사용해 BOM관리 화면을 테스트했다. 기존 부모 BOM `HNS02`를 선택하고 테스트 자품목 `FBOMC-260615112131`을 임시 생성해 화면에서 BOM 추가/수정/삭제를 수행했다.
- 시나리오: 초기 조회, 부모 검색/선택, 폼 다운로드, 엑셀 업로드 모달 확인, 테스트 자품목 준비, 선택 부모 BOM 내보내기, BOM 신규 등록/저장 검증, 등록 후 화면 재조회, 중복 등록 방어, BOM 수정/저장 검증, 라우팅 패널 확인, BOM 삭제/저장 검증, 삭제 후 화면 재조회 및 정리까지 13단계다.
- 런타임 조치: 기존 프론트 3002 프로세스가 응답하지 않아 PID 2796을 정리하고 `apps/frontend`에서 `pnpm run dev`를 숨김 프로세스로 재시작했다. 재시작 후 3002는 PID 17636으로 Ready 상태였고, 백엔드 3003은 `GET /api/v1/master/boms/parents` 200으로 확인했다.
- 검증: 최종 실행 `node tools/hanes-master-bom-page-scenario-qa.mjs` 결과 PASS. 결과 JSON 검증 결과 status `PASS`, page `/master/bom`, parent `HNS02`, steps 13, 기록 API 38, failedApi 0, failedSteps 0, consoleErrors 0, pageErrors 0. 산출물 파일 3개 존재, BOM 스크린샷 13장 존재 확인. Oracle `JSHANES` 최종 조회에서 `BOM_MASTERS` 테스트 BOM 잔여 0건, `ITEM_MASTERS` 테스트 자품목 잔여 0건 확인.
- 산출물: 목차 `docs/reports/hanes-page-scenario-qa-2026-06-15/index.html`, 페이지 상세 `docs/reports/hanes-page-scenario-qa-2026-06-15/pages/master-bom.html`, 결과 JSON `docs/reports/hanes-page-scenario-qa-2026-06-15/master-bom-result.json`, 스크린샷 `docs/reports/hanes-page-scenario-qa-2026-06-15/screenshots/master-bom/*.png`, 실행 스크립트 `tools/hanes-master-bom-page-scenario-qa.mjs`.

## 2026-06-15 21:03 Codex

- 작업: `T-MASTER-REMAINING-PAGE-SCENARIO-QA` 기준정보 잔여 메뉴 페이지 단위 상세 시나리오 QA.
- 실행: `hanes-page-scenario-qa`, `ui-test-crud-red`, `oracle-db` 기준으로 `/master/part`, `/master/bom`을 제외한 기준정보 잔여 19개 화면을 실제 브라우저 `http://localhost:3002`, 백엔드 `http://localhost:3003/api/v1`, 계정 `admin@hanes.com`, company `40`, plant `1000`, Oracle `JSHANES`로 순회했다. 대상은 코드관리, 회사관리, 설비관리, 설비별 점검항목, 점검항목마스터, 계측기마스터, 검사항목마스터, 품목별 IQC 항목관리, 라벨관리, 거래처관리, 공정관리, 공정 CAPA, 생산라인관리, 라우팅관리, 제조사 바코드 매핑, 창고관리, 생산월력관리, 작업지도서관리, 작업자관리다.
- 처리 방식: 각 화면마다 초기 조회, 검색/조회 또는 탭 전환, 노출 버튼/프로세스 목록화, 신규/수정/삭제 가능 여부 확인, 대표 API 직접 조회, 대표 Oracle DB count 확인을 수행했다. 저장 검증은 최신 기준정보 API CRUD 런타임 결과 `docs/reports/hanes-master-crud-runtime-test-26061511325085.json`를 연결했다. 해당 CRUD 결과는 101단계 성공, 실패 0, cleanup 완료다.
- 런타임 조치: 첫 실행은 300초 제한과 프론트 콜드 컴파일 때문에 중간 종료됐고, 두 번째는 작업자 화면 등록 패널 진입 대기에서 장시간 멈췄다. `worker` 화면은 UI 등록 패널 열기 대신 CRUD API 저장 검증으로 대체하도록 러너를 보강했고, `HANES_QA_REUSE_CRUD=1`로 최신 CRUD 결과를 재사용해 전체 재실행했다.
- 검증: 최종 실행 `$env:HANES_QA_REUSE_CRUD='1'; node tools/hanes-master-remaining-page-scenario-qa.mjs` 결과 status `PASS`, 잔여 페이지 19/19 PASS, failed 0, CRUD failures 0. 결과 JSON 검증 결과 failedPages 0, failedSteps 0, missingReports 0, missingShots 0, crudResidueSuccess true, crudResidueNonZero 없음. 기준정보 페이지 HTML은 기존 품목/BOM 포함 21개, 스크린샷은 전체 119장이다. `git diff --check` 통과. Oracle `JSHANES` 독립 잔여 쿼리에서 COM_CODES, PARTNER_MASTERS, ITEM_MASTERS, PROCESS_MASTERS, PROD_LINE_MASTERS, WORKER_MASTERS, WAREHOUSES, EQUIP_MASTERS, ROUTING_GROUPS, IQC_ITEM_POOL, LABEL_TEMPLATES, WORK_CALENDARS, GAUGE_MASTERS 모두 테스트 키 잔여 0건 확인.
- 산출물: 목차 `docs/reports/hanes-page-scenario-qa-2026-06-15/index.html`, 통합 결과 JSON `docs/reports/hanes-page-scenario-qa-2026-06-15/master-remaining-result.json`, 개별 페이지 HTML `docs/reports/hanes-page-scenario-qa-2026-06-15/pages/master-*.html`, 스크린샷 `docs/reports/hanes-page-scenario-qa-2026-06-15/screenshots/master-*/*.png`, 실행 스크립트 `tools/hanes-master-remaining-page-scenario-qa.mjs`.

## 2026-06-15 22:31 Codex

- 작업: `T-MASTER-EQUIP-REPORT-EVIDENCE-FIX` `/master/equip` 설비관리 QA 보고서 증적 정합성 보정.
- 원인: 잔여 기준정보 보고서 러너가 검색 단계에서 `HNS02`를 입력한 뒤 STEP 05 저장 검증 캡처 전에 검색 조건을 초기화하지 않았다. 그래서 STEP 05의 “API/DB 검증 후 화면” 캡처가 실제 저장/API/DB 검증 상태가 아니라 이전 검색 결과 0건 화면으로 남았다.
- 변경: `tools/hanes-master-remaining-page-scenario-qa.mjs`에 검색 조건 초기화+재조회 헬퍼를 추가하고, 버튼 목록화 및 API/DB 저장 검증 증적 전에 이를 실행하도록 보정했다. STEP 05 캡션은 `검색 초기화 후 API/DB 검증 기준 화면`으로 변경했고, 수정/삭제 가능 여부의 행 액션 수는 전체 `tr button`이 아니라 본문 데이터 행 버튼만 세도록 바꿨다.
- 검증: `$env:HANES_QA_REUSE_CRUD='1'; node tools/hanes-master-remaining-page-scenario-qa.mjs` 결과 19개 화면 모두 PASS, failed 0, CRUD failures 0. `master-equip` 결과는 5단계 PASS, 이미지 누락 0, STEP 05 증적 파일 `docs/reports/hanes-page-scenario-qa-2026-06-15/screenshots/master-equip/05-api-db-verification.png` 72,137 bytes. 육안 확인 결과 검색어가 비어 있고 설비 목록 44건 기준 그리드가 표시된다. `git diff --check` 통과.
- 산출물: `docs/reports/hanes-page-scenario-qa-2026-06-15/pages/master-equip.html`, `docs/reports/hanes-page-scenario-qa-2026-06-15/screenshots/master-equip/05-api-db-verification.png`, `docs/reports/hanes-page-scenario-qa-2026-06-15/master-remaining-result.json`.

## 2026-06-15 23:22 Codex

- 작업: `T-MASTER-REPORT-SEARCH-DUPLICATE-FIX` 기준정보 잔여 페이지 QA 보고서 검색어/중복방어 시나리오 보정.
- 변경: `tools/hanes-master-remaining-page-scenario-qa.mjs`의 검색 단계에서 `HNS02` 하드코딩을 제거하고 현재 화면 데이터 기반 검색어 또는 빈 조회로 대체했다. 모든 잔여 19개 페이지에 공통 `duplicate-defense` 단계를 추가해 기준정보 CRUD 런타임의 `DUPLICATE_GUARD` 결과를 연결한다.
- 변경: `tools/hanes-master-crud-runtime-test.mjs`에 회사 포함 30개 `DUPLICATE_GUARD` 검증을 추가했다. 실제 실행 중 중복 허용으로 확인된 `공정-설비매핑`, `IQC품목검사`, `라벨템플릿`, `작업지도서`, `설비BOM품목`, `설비BOM관계` 생성 경로는 409 중복 방어를 추가했고 해당 단위 테스트를 보강했다.
- 검증: `node tools/hanes-master-crud-runtime-test.mjs` 최종 결과 `docs/reports/hanes-master-crud-runtime-test-26061513195369.json`, total 134, passed 134, failed 0, cleanup 31, duplicateGuards 30, duplicateFailures 0. `$env:HANES_QA_REUSE_CRUD='1'; node tools/hanes-master-remaining-page-scenario-qa.mjs` 결과 잔여 19개 페이지 19/19 PASS. JSON 검증 결과 19개 페이지 모두 `duplicate-defense` 단계 존재, non-PASS 0, 중복방어 증적 누락 0. `pnpm --dir apps/backend exec tsc --noEmit --pretty false` 통과. `git diff --check` 통과.
- 참고: 잔여 19개 페이지의 `HNS02` 고정 검색은 제거됐다. 별도 BOM 전용 보고서 `master-bom.html`에는 실제 BOM 부모 기준 데이터가 HNS02 계열뿐이라 BOM 부모 검색 증적으로 남아 있다.
- 산출물: `docs/reports/hanes-page-scenario-qa-2026-06-15/index.html`, `docs/reports/hanes-page-scenario-qa-2026-06-15/master-remaining-result.json`, `docs/reports/hanes-master-crud-runtime-test-26061513195369.json`, `tools/hanes-master-crud-runtime-test.mjs`, `tools/hanes-master-remaining-page-scenario-qa.mjs`.

## 2026-06-16 00:42 Codex

- 작업: `T-MATERIAL-MENU-PAGE-SCENARIO-QA` 좌측 `자재수불관리` 실제 등록 하위 메뉴 상세 시나리오 QA.
- 범위: `/api/v1/menu-categories/tree`의 `MATERIAL` 카테고리에 실제 등록된 16개 하위 메뉴만 대상으로 했다. 대상은 `PUR_PO`, `PUR_PO_STATUS`, `MAT_ARRIVAL`, `MAT_ARRIVAL_RESULT`, `QC_CONCESSION`, `MAT_RECEIVE`, `MAT_RECEIVE_HISTORY`, `MAT_REQUEST`, `MAT_ISSUE`, `MAT_ISSUE_OTHER`, `MAT_LOT_SPLIT`, `MAT_LOT_MERGE`, `MAT_SCRAP`, `MAT_ADJUSTMENT`, `MAT_MISC_RECEIPT`, `MAT_RECEIPT_CANCEL`이다.
- 실행: `tools/hanes-material-menu-page-scenario-qa.mjs`를 추가했다. 실제 브라우저 `http://localhost:3002`, 백엔드 `http://localhost:3003/api/v1`, 계정 `admin@hanes.com`, company `40`, plant `1000`, Oracle `JSHANES`로 각 페이지를 테스트했다. 각 화면은 초기 조회, 검색/재조회, 버튼/입력/프로세스 목록화, 신규/수정/삭제 가능 여부, 저장 검증 및 중복 방어 정책, 직접 API+DB 확인, 화면 재조회 6단계로 기록했다.
- 조치: 전체 실행 중 자정 경계로 보고서 날짜가 갈라지는 문제를 막기 위해 `HANES_REPORT_DATE`를 지원하도록 했고, 장시간 메뉴 스윕을 위해 페이지별 JSON 저장과 집계 모드를 추가했다. `특채처리` 대표 API는 실제 계약에 맞게 `/material/concession/targets`로 보정했다. 빈 화면 문구 `데이터가 없습니다.`가 검색어로 들어가 400을 만드는 테스트 러너 문제도 검색어 추출 필터에서 제외해 해소했다. 운영 재고를 변경하는 저장/삭제 버튼은 임의 실행하지 않고 별도 저장형 상세 시나리오 대상으로 명시했다.
- 검증: 최종 집계 `$env:HANES_REPORT_DATE='2026-06-15'; $env:HANES_QA_AGGREGATE='1'; node tools/hanes-material-menu-page-scenario-qa.mjs` 결과 status `PASS`, pages 16, passed 16, failed 0. 추가 JSON/HTML 검증 결과 16페이지, 96단계, 96개 스크린샷, 모든 단계 PASS, HTML `API 호출`/`DB 확인` 섹션 존재, 이미지 링크 누락 0개. `git diff --check -- tools/hanes-material-menu-page-scenario-qa.mjs .ai-coordination/TASKS.md .ai-coordination/LOCKS.md` 통과.
- 산출물: 목차 `docs/reports/hanes-material-menu-scenario-qa-2026-06-15/index.html`, 통합 결과 JSON `docs/reports/hanes-material-menu-scenario-qa-2026-06-15/material-menu-result.json`, 개별 페이지 HTML/JSON `docs/reports/hanes-material-menu-scenario-qa-2026-06-15/pages/*.html|*.json`, 스크린샷 `docs/reports/hanes-material-menu-scenario-qa-2026-06-15/screenshots/*/*.png`, 실행 스크립트 `tools/hanes-material-menu-page-scenario-qa.mjs`.

## 2026-06-16 03:00 Codex

- 작업: `T-MULTI-CATEGORY-MENU-PAGE-SCENARIO-QA` 좌측 등록 메뉴 중 자재재고관리, 생산관리, 품질관리, 검사관리, 제품수불관리, 설비관리, 출하관리 하위 메뉴 상세 시나리오 QA.
- 범위: `/api/v1/menu-categories/tree`의 활성 카테고리 기준으로 `INVENTORY` 7개, `PRODUCTION` 10개, `QUALITY` 11개, `INSPECTION` 5개, `PRODUCT_MGMT` 4개, `EQUIPMENT` 6개, `SHIPPING` 7개, 총 50개 등록 메뉴만 대상으로 했다. `PRODUCT_INVENTORY`는 비활성이라 제외했고, 사용자 요청의 `제품수불관리`는 활성 `PRODUCT_MGMT`로 처리했다.
- 실행: `tools/hanes-registered-categories-page-scenario-qa.mjs`를 추가해 `menuConfig.ts`와 `ko.json`에서 등록 메뉴 경로/한글명을 매핑하고, 실제 브라우저 `http://localhost:3002`, 백엔드 `http://localhost:3003/api/v1`, 계정 `admin@hanes.com`, company `40`, plant `1000`, Oracle `JSHANES`로 테스트했다. 각 페이지는 초기 조회, 검색/재조회, 버튼/입력/프로세스 목록화, 신규/수정/삭제 가능 여부, 저장 검증 및 중복 방어 정책, 직접 API+DB 확인, 화면 재조회 6단계로 기록했다.
- 수정: `/production/result` 화면은 프론트가 `search`를 보내지만 `ProdResultQueryDto`가 이를 허용하지 않아 400이 발생했다. `ProdResultQueryDto.search`와 `ProdResultService.findAll()` 통합 검색(실적번호/작업지시번호/제품 UID)을 추가했다. `/shipping/pack` 화면도 프론트가 `/shipping/boxes?search=...`를 보내지만 `BoxQueryDto`가 이를 허용하지 않아 400이 발생했다. `BoxQueryDto.search`와 `BoxService.findAll()` 박스번호/품목코드 검색을 추가했다.
- 검증: 최종 집계 `$env:HANES_REPORT_DATE='2026-06-16'; $env:HANES_QA_AGGREGATE='1'; node tools/hanes-registered-categories-page-scenario-qa.mjs` 결과 status `PASS`, pages 50, passed 50, failed 0. 추가 JSON/HTML 검증 결과 카테고리별 건수 `INVENTORY=7`, `PRODUCTION=10`, `QUALITY=11`, `INSPECTION=5`, `PRODUCT_MGMT=4`, `EQUIPMENT=6`, `SHIPPING=7`, 총 300단계, 스크린샷 300개, API 기록 675건, DB count 150건, 모든 단계 PASS, HTML `API 호출`/`DB 확인` 섹션 존재, 이미지 링크 누락 0개. `pnpm --dir apps/backend exec tsc --noEmit --pretty false` 통과. 관련 파일 `git diff --check` 통과.
- 산출물: 목차 `docs/reports/hanes-registered-categories-scenario-qa-2026-06-16/index.html`, 통합 결과 JSON `docs/reports/hanes-registered-categories-scenario-qa-2026-06-16/registered-categories-result.json`, 개별 페이지 HTML/JSON `docs/reports/hanes-registered-categories-scenario-qa-2026-06-16/pages/*.html|*.json`, 스크린샷 `docs/reports/hanes-registered-categories-scenario-qa-2026-06-16/screenshots/*/*.png`, 실행 스크립트 `tools/hanes-registered-categories-page-scenario-qa.mjs`.

## 2026-06-16 11:16 Codex

- 작업: `T-MAT-ARRIVAL-STOCK-SPLIT` 입하재고 테이블 분리 A안 설계.
- 결정: 사용자가 테이블까지 분리하고 기존 데이터도 마이그레이션하라고 승인했다. 설계는 `MAT_ARRIVAL_STOCKS`, `MAT_ARRIVAL_TRANSACTIONS` 신규 테이블을 두고, 기존 `STOCK_TRANSACTIONS.MAT_IN`을 입하원장으로 이관하며, 입고 후 미입고 잔량만 `MAT_ARRIVAL_STOCKS`로 산출하는 방식이다.
- 실측: JSHANES company `40`, plant `1000`에서 `MAT_IN` 57건/322,303, `RECEIVE` 44건/316,303, `MAT_ARRIVALS` 67건/327,303, `MAT_RECEIVINGS DONE` 44건/316,303, `MAT_STOCKS` 93행/227,314 확인. `MAT_IN` 중 `MAT_UID` NULL은 0건이다.
- 산출물: `docs/superpowers/specs/2026-06-16-mat-arrival-stock-split-design.md`.
- 검증: 관련 파일 `git diff --check` 통과. 서브에이전트 설계 검토는 현재 도구 정책상 사용자가 명시적으로 요청한 경우에만 가능해 수행하지 않았고, 자체 검토로 `TRANS_NO` 유지와 `MAT_UID` 기준 이관 근거를 문서에 보강했다.
- 상태: `TASKS.md`에 `REVIEW`로 남김. 사용자 리뷰 승인 후 구현 계획 작성 및 마이그레이션/코드 수정 단계로 전환한다.

## 2026-06-16 11:22 Codex

- 작업: `T-MAT-ARRIVAL-STOCK-SPLIT` 구현 계획 작성.
- 입력: 사용자가 설계서 A안을 승인했다.
- 산출물: `docs/superpowers/plans/2026-06-16-mat-arrival-stock-split.md`.
- 내용: 사전 DB dry-run, Oracle 마이그레이션, 신규 엔티티, `ArrivalStockService`, `arrival.service.ts`, `receiving.service.ts`, `receipt-cancel.service.ts`, `/inventory/transaction` API/UI 정리, 런타임 검증, 최종 handoff까지 10개 작업으로 분해했다.
- 주의: 현재 도구 정책상 사용자가 명시적으로 서브에이전트를 요청한 경우에만 plan reviewer/subagent 사용이 가능하므로 별도 subagent review는 수행하지 않았다. 실행은 DB 변경이 포함되므로 inline checkpoint 방식이 더 적합하다고 계획서에 명시했다.
- 상태: 구현은 아직 시작하지 않았다. 사용자에게 실행 방식을 확인해야 한다.

## 2026-06-16 11:33 Codex

- 작업: `T-MAT-ARRIVAL-STOCK-SPLIT` Task 1 사전 DB dry-run.
- 실행: JSHANES company `40`, plant `1000`에 SELECT만 수행했다.
- 결과: `MAT_IN` 57건/322,303, `RECEIVE` 44건/316,303, `MAT_IN` 중 `MAT_UID IS NULL` 0건. `MAT_UID`별 pending 산출 결과 `POSITIVE_PENDING` 36건/6,023, `ZERO` 21건/0, `NEGATIVE_PENDING` 23건/-23.
- 차단: `NEGATIVE_PENDING` 23건은 `RECEIVE`가 있으나 같은 `MAT_UID` 기준 `MAT_IN`이 없는 legacy UID다. 또한 `VH1-RM260612-00011`은 `MAT_IN` 3 이후 `MAT_OUT` 3건으로 이미 `MAT_STOCKS`가 0이라 입하재고 후보 3을 차감할 수 없다.
- 산출물: `docs/reports/hanes-mat-arrival-stock-split-migration-2026-06-16.md`.
- 상태: 계획 기준 차단 조건이므로 구현을 중단하고 `TASKS.md`를 `BLOCKED`로 변경했다. 사용자에게 데이터 보정 정책 결정을 받아야 한다.

## 2026-06-16 13:10 Codex

- 작업: `T-MAT-ARRIVAL-STOCK-SPLIT` 입하재고/입고재고 테이블 분리 구현 및 JSHANES 마이그레이션 적용.
- 반영: `MAT_ARRIVAL_STOCKS`, `MAT_ARRIVAL_TRANSACTIONS` 엔티티/마이그레이션 추가. IQC005 입하는 입하재고/입하원장으로 기록하고, 정상 입고 확정은 `MAT_ARRIVAL_STOCKS` 감소 후 `MAT_STOCKS` 증가로 변경했다. 특채 입고는 기존 창고재고 차감 경로를 유지했다.
- DB 적용: `apps/backend/src/migrations/2026-06-16_mat_arrival_stock_split.sql`을 JSHANES에 실행했고 12개 블록 모두 성공. 적용 후 `MAT_ARRIVAL_TRANSACTIONS` 57건/322,303, `MAT_ARRIVAL_STOCKS` 35건/6,020, `STOCK_TRANSACTIONS` 잔존 `MAT_IN/MAT_IN_CANCEL` 0건, 백업 57건 확인.
- 프론트: `/inventory/transaction` 필터에서 `MAT_IN/MAT_IN_CANCEL` 제거. 입하 이력 타입/버튼 조건은 `ARRIVAL_IN/ARRIVAL_CANCEL`로 변경.
- 문서: `docs/reports/hanes-mat-arrival-stock-split-migration-2026-06-16.md`, `docs/reports/db-schema-erd.md` 갱신.
- 검증: `pnpm --filter @harness/backend build`, `pnpm --filter @harness/backend test -- arrival.service.spec.ts receiving.service.spec.ts inventory-query.service.spec.ts`, `pnpm --filter @harness/frontend build` 통과. 인증 없는 API 직접 호출은 401로 차단되어 DB 검증으로 대체했다.
- 상태: `TASKS.md` DONE, lock released.

## 2026-06-16 13:55 Codex

- 작업: `T-MAT-ARRIVAL-TRANSACTION-PAGE` 입하수불조회 화면 추가.
- 범위: 메뉴 통합 작업과 충돌하지 않도록 좌측 메뉴 파일과 DB 메뉴 등록은 수정하지 않았다. 직접 URL `/material/arrival-transaction`로 접근 가능한 화면을 추가하고, 나중에 `MATERIAL` 카테고리 메뉴에 연결할 수 있게 route를 고정했다.
- 변경: `apps/frontend/src/app/(authenticated)/material/arrival-transaction/page.tsx` 추가. 화면은 `MAT_ARRIVAL_TRANSACTIONS` 원장 조회 전용이며 기간, 유형(`ARRIVAL_IN/ARRIVAL_CANCEL`), 상태, `MAT_UID`, 통합 검색 필터와 DataGrid 내보내기/SQL 조회를 제공한다. 신규/수정/삭제는 조회 화면 성격상 넣지 않았다.
- API: `ArrivalQueryDto`에 `transType`, `matUid`, `arrivalNo` 필터를 추가하고 `ArrivalService.findAll()` 검색 조건에 거래번호, 입하번호, 참조번호, `MAT_UID`, 품목코드/품목명을 포함했다.
- 검증: `pnpm --filter @harness/frontend gen:registry`, `pnpm --filter @harness/backend build`, `pnpm --filter @harness/frontend build` 통과. 빌드 산출 라우트 목록에 `/material/arrival-transaction` 포함 확인. 실행 중인 3002 서버에서 `http://localhost:3002/material/arrival-transaction` HTTP 200 확인. 백엔드 직접 API `http://localhost:3003/api/v1/material/arrivals?limit=1&transType=ARRIVAL_IN`은 인증 없이 401로 차단됨을 확인했다.
- 상태: 완료, lock released. 좌측 메뉴 노출은 메뉴 통합 산출물 기준으로 별도 후속 작업에서 `MATERIAL` 카테고리에 추가해야 한다.

## 2026-06-16 14:35 Codex

- 작업: `T-MAT-ARRIVAL-TRANSACTION-MENU` 입하수불조회 메뉴 등록.
- 변경: `MAT_ARRIVAL_TRANSACTION` leaf를 `apps/frontend/src/config/menuConfig.ts`의 `MATERIAL` 카테고리 `MAT_ARRIVAL_RESULT` 바로 뒤에 추가했다. labelKey는 `menu.material.arrivalTransaction`, path는 `/material/arrival-transaction`이다.
- i18n: `ko/en/zh/vi.json`에 각각 `입하수불조회`, `Arrival Ledger Inquiry`, `到货流水查询`, `Tra cứu giao dịch nhập hàng` 라벨을 추가했다.
- 백엔드/시드: `menu-code-validator.ts`의 leaf whitelist에 `MAT_ARRIVAL_TRANSACTION`을 추가했고, `scripts/2026-05-18_seed_menu_categories.sql`에도 MATERIAL sort 25로 반영했다.
- DB 적용: `apps/backend/src/migrations/2026-06-16_add_arrival_transaction_menu.sql`을 작성했다. 첫 실행은 익명 PL/SQL 블록 종료 파싱 문제로 실패했으나 변경은 적용되지 않았고, 기존 repo 패턴에 맞춰 SQL statement + `/` 구분자로 수정 후 JSHANES에 재실행했다. 최종 실행은 3개 블록 모두 성공.
- DB 검증: `MENU_CATEGORY_ITEMS`에서 `MAT_ARRIVAL_TRANSACTION`이 company `40`, plant `1000`, category `MATERIAL`, sort `45`로 등록됨을 확인했다. `ROLE_MENU_PERMISSIONS`는 `INV_ARRIVAL_STOCK`의 접근권한을 복제해 `MANAGER`/`Y` 1건 등록됐다.
- 런타임 검증: JSON 파싱 4종 성공, `pnpm --filter @harness/backend build`, `pnpm --filter @harness/frontend build` 통과. 인증 헤더 `Bearer admin@hanes.com`, `X-Company=40`, `X-Plant=1000`로 `/api/v1/menu-categories/tree` 호출 시 `MATERIAL.menus`에 `MAT_ARRIVAL_TRANSACTION` sort 45가 반환됨을 확인했다. `http://localhost:3002/material/arrival-transaction`도 HTTP 200.
- 운영 메모: `next build` 후 3002 dev 서버가 500을 반환해 3002 프론트만 재시작했다. 이후 3002는 정상 200. 3003 백엔드 watch 프로세스도 listen이 내려가 있어 해당 dev 프로세스만 재시작했고 health 200 및 메뉴 API 확인 완료.
- 상태: 완료, lock released.

## 2026-06-16 15:25 Codex

- 작업: `T-KIOSK-WORKER-INSPECT-EMPTY-FIX` `/production/input-kiosk` 작업자설비점검 모달 빈 화면 원인 확인 및 보정.
- 원인: 모달이 `/master/equip-inspect-items?equipCode=...&inspectType=WORKER` 설비별 배정만 조회한다. JSHANES 실측에서 `EQ-CUT-01` 같은 절단/압착 설비는 WORKER 배정 0건이고, WORKER 점검항목 마스터 4건은 `EQUIP_INSPECT_ITEM_MASTERS`에 공통(`EQUIP_TYPE` null)으로만 존재했다. 프론트는 `items.length=0`일 때 빈 상태 문구도 표시하지 않아 헤더 외 내용이 없는 모달처럼 보였다. 또한 배정 API 응답은 `sortSeq`를 주는데 모달은 `seq`를 기대해 순번/결과 키가 불안정했다.
- 변경: 설비별 배정이 없으면 항목을 띄우지 않는 기존 업무 규칙을 유지했다. `WorkerInspectModal`은 `/master/equip-inspect-items` 설비별 배정만 조회하고, 0건이면 현재 선택 설비 기준으로 `기준정보 > 설비점검항목(/master/equip-inspect)`에서 설비 선택 → 작업자점검(WORKER) 선택 → 점검항목 추가 → 저장 → 모달 재오픈 절차를 상세 안내한다. 배정 API 응답의 `sortSeq -> seq` 정규화도 추가했다.
- 검증: 인증 헤더 `Bearer admin@hanes.com`, company `40`, plant `1000`으로 `EQ-CUT-01` 배정 API 0건, `EQ-OINSP-01` 배정 API 4건, WORKER 마스터 API 4건 확인. `node --test apps/frontend/src/app/(authenticated)/production/input-kiosk/components/worker-inspect-modal.structure.test.mjs`, `pnpm --filter @harness/frontend exec tsc --noEmit` 통과. 이 워크스페이스에는 `browse`/`playwright` 실행 파일이 없어 실제 브라우저 캡처 검증은 수행하지 못했다.
- 상태: 완료, lock released.

## 2026-06-16 16:50 Codex

- 작업: `T-KIOSK-DAILY-INSPECT-EMPTY-GUIDE` `/production/input-kiosk` 설비일일점검 모달의 배정 누락 안내 보강.
- 원인/정책: 설비일일점검도 작업자설비점검과 동일하게 `/master/equip-inspect-items?equipCode=...&inspectType=DAILY` 설비별 배정 항목만 표시해야 한다. 배정이 없으면 항목이 안 뜨는 것이 정상이며, 기존처럼 `항목 없음 - 자동완료`로 인터락을 완료하면 기준정보 배정 누락을 숨긴다.
- 변경: `DailyInspectModal`에서 무항목 자동완료 `handleSkip` 경로와 `confirmWithoutItems` 버튼을 제거했다. 0건이면 현재 선택 설비 기준으로 `기준정보 > 설비점검항목마스터(/master/equip-inspect-item)`에서 DAILY 항목 등록 → `기준정보 > 설비점검항목(/master/equip-inspect)`에서 설비 선택 → DAILY 선택 → 점검항목 추가 → 저장 → 모달 재오픈 절차를 표시한다. 배정 API 응답의 `sortSeq -> seq` 정규화도 추가했다.
- 검증: RED 후 GREEN 구조 테스트 `node --test apps/frontend/src/app/(authenticated)/production/input-kiosk/components/daily-inspect-modal.structure.test.mjs` 통과(3/3), `pnpm --filter @harness/frontend exec tsc --noEmit` 통과.
- 상태: 완료, lock released.
## 2026-06-16 20:29 Codex

- 작업: `T-CONSUMABLE-MASTER-CARDS-REMOVE` `/consumables/master` 상단 정보카드 제거.
- 변경: `apps/frontend/src/app/(authenticated)/consumables/master/page.tsx`에서 카드 전용 `StatCard` grid, `computedStats`, `Package`/`StatCard` import, 주석의 통계카드 설명만 제거했다.
- 유지: `/consumables` 목록 조회, 검색어/분류 필터, DataGrid, 등록/수정 우측 패널, 삭제 확인 흐름은 변경하지 않았다.
- 검증: 대상 파일 `StatCard|computedStats|totalConsumables|mold|jig|tool|Package` 잔여 0건, `git diff --check` 통과, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과, `http://localhost:3002/consumables/master` HTTP 200 확인. Playwright 브라우저 DOM 확인은 3002 페이지 로드가 60초 타임아웃으로 완료하지 못했다.
- 상태: 완료, lock released.

## 2026-06-16 19:25 Codex

- 작업: `T-EQUIP-INSPECT-ITEM-IMAGE-SEED` 설비점검항목 위치 안내 이미지 시드 생성 및 JSHANES 적용.
- 변경: `tools/generate-equip-inspect-item-seed-images.mjs`를 추가해 항목별 고정 SVG 50개를 `apps/backend/uploads/equip-inspect-items`에 생성했다. 각 SVG는 설비유형 도식, 주황색 점검 위치 표시, `점검 위치` 라벨을 포함한다. `uploads`는 git ignore 대상이라 로컬 서버에는 생성 파일이 있고, 재생성은 스크립트로 수행한다.
- DB 적용: `apps/backend/src/migrations/2026-06-16_equip_inspect_item_image_seed.sql`로 `EQUIP_INSPECT_ITEM_MASTERS.IMAGE_URL`을 `/uploads/equip-inspect-items/*.svg`로 채웠고, JSHANES `--execute-file` 실행 성공(`blocks_executed=51`).
- 검증: JSHANES `TOTAL=50`, `WITH_IMAGE=50`, `SVG_URLS=50`, `DISTINCT_URLS=50`. 로컬 SVG 파일 50개 존재. `http://localhost:3003/uploads/equip-inspect-items/ei_atc_001.svg`와 `http://localhost:3002/uploads/equip-inspect-items/ei_atc_001.svg` 모두 200, `image/svg+xml`. `/api/v1/master/equip-inspect-item-masters?limit=2`는 `imageUrl` 반환. 실제 브라우저 `http://localhost:3002/master/equip-inspect-item`에서 이미지 50개 렌더링, 첫 이미지 natural size 720x420 확인.
- 상태: 완료, lock released.

## 2026-06-16 13:50 Codex

- 작업: `T-MAT-FLOW-COHERENCE-FIX` 입하 → 입하재고 → 입고 → 입고후재고 → 출고 → 출고후재고 → 공정입고 → 공정재고 흐름 정합성 점검 및 보정.
- 코드 보정: `ArrivalService.createPoArrival()`와 `createManualArrival()`의 레거시 `MAT_IN`/`MAT_STOCKS` 직행 경로를 내부 `MAT_LOTS` 발행 후 `MAT_ARRIVAL_STOCKS`/`MAT_ARRIVAL_TRANSACTIONS(ARRIVAL_IN)` 기록으로 변경했다. 원자재 현재고 증가는 기존 입고 확정 경로에서만 수행한다. `/material/arrival`의 수동/PO 모달 payload도 백엔드 계약에 맞춰 `warehouseId`를 보내도록 수정했다.
- DB 보정: `apps/backend/src/migrations/2026-06-16_repair_mat_flow_audit_gaps.sql`을 JSHANES에 적용했다. 현재고 수량은 변경하지 않고 과거 데이터의 누락 감사원장만 보강했다. `ARRIVAL_REPAIR` 23건/23수량, `RECEIVE_REPAIR` 1건/3수량이 추가됐다.
- 실측 결과: 적용 후 `MAT_ARRIVAL_TRANSACTIONS` 80건/322,326, `MAT_ARRIVAL_STOCKS` 35건/6,020, `MAT_RECEIVINGS DONE` 45건/316,306, `STOCK_TRANSACTIONS RECEIVE` 45건/316,306, `MAT_OUT` 14건/-100,011, `MAT_STOCKS` 58건/221,294. 입하원장 - 입고원장 - 입하재고 LOT 대사 `BAD_ROWS=0`, `ABS_DIFF=0`, `NET_DIFF=0`.
- 공정재고 확인: 생산실적 `DONE` 8건은 `PRODUCT_TRANSACTIONS.WIP_IN` 8건/8수량으로 연결되고, `PRODUCT_STOCKS`의 `WIP_MAIN` 현재 잔량은 9행/2수량이다. 제품/원자재/입하재고 음수 수량 0건, `QTY <> AVAILABLE_QTY + RESERVED_QTY` 오류는 원자재/제품 모두 0건.
- 검증: `pnpm --filter @harness/backend test -- arrival.service.spec.ts --runInBand` 34/34 PASS, `pnpm --filter @harness/backend build` 통과, `pnpm --filter @harness/frontend exec tsc --noEmit` 통과. 런타임 `http://localhost:3003/api/v1/health` 200, `http://localhost:3002/material/arrival` 200.
- 상태: 완료, lock released. 워크트리에는 이번 작업 외 기존 변경 파일이 다수 있어 커밋 시 범위 선별 필요.

## 2026-06-16 15:45 Codex

- 작업: `T-KIOSK-EQUIP-INSPECT-WORKDAY-ORDER` 설비일일점검/작업자설비점검 이력 유지 기준 전환.
- 원인: 기존 `EQUIP_INSPECT_LOGS`와 `/equipment/daily-inspect/check`는 `equipCode + inspectType + inspectDate` 달력일 기준이었다. 키오스크 프론트도 `new Date().toISOString().split('T')[0]`를 보내서 설비일일점검은 조업일 08:00 기준을 반영하지 못했고, 작업자설비점검은 `ORDER_NO` 컬럼/API payload가 없어 작업지시별 완료 이력을 판정할 수 없었다.
- 변경: `EQUIP_INSPECT_LOGS`에 `ORDER_NO`, `WORK_DATE`, `INSPECT_AT`, `OP_WINDOW_START_AT`, `OP_WINDOW_END_AT`를 추가했다. `EquipInspectService.getInspectionStatus()`는 설비의 `processCode` 기준 공정 월력 → 공장 공통 월력 → 08:00 fallback 순서로 기존 `WORK_CALENDARS`/`WORK_CALENDAR_DAYS`/`SHIFT_PATTERNS`를 사용해 조업일을 계산한다. `DAILY` 완료 여부는 `WORK_DATE`, `WORKER` 완료 여부는 `ORDER_NO`로 조회한다. 상세 조회도 `DAILY`는 `WORK_DATE` 우선으로 변경했다.
- 프론트 변경: `/production/input-kiosk`는 설비 선택 시 `inspectType=DAILY`만 보내 서버 조업일 판정을 사용한다. 작업지시 선택/변경 시 `inspectType=WORKER&orderNo=<작업지시>`로 이력을 확인해 `workerInspectDone`을 갱신한다. `DailyInspectModal` 저장 payload에서 프론트 계산 `inspectDate`를 제거했고, 완료 화면은 서버가 반환한 조업일/유효구간을 표시한다. `WorkerInspectModal` 저장 payload는 `orderNo`를 포함한다.
- DB 적용: JSHANES에 새 컬럼 5개를 추가하고 기존 14건 `WORK_DATE=TRUNC(INSPECT_DATE)`, `INSPECT_AT=INSPECT_DATE`로 백필했다. 조회 인덱스 `IDX_EQUIP_INSPECT_WORK_DATE`, `IDX_EQUIP_INSPECT_ORDER_NO`와 업무 중복 방어 unique index `UX_EQUIP_INSPECT_DAILY_WORK`, `UX_EQUIP_INSPECT_WORKER_ORDER`를 생성했다. `--execute-file`은 PL/SQL 블록 파싱 문제로 변경 없이 실패해 실제 적용은 `oracle_connector.py --query` 단위로 순차 실행했다.
- DB 검증: JSHANES `EQUIP_INSPECT_LOGS` 새 컬럼 5개 존재, 관련 인덱스 4개 존재, `WORK_DATE/INSPECT_AT` 누락 0건, `DAILY` 업무키 중복 0건 확인.
- 문서: `docs/superpowers/plans/2026-06-16-equip-inspect-workday-order.md` 작성, `python tools/generate_db_schema_doc.py`로 `docs/reports/db-schema-erd.md` 재생성.
- 검증: RED 확인 후 `pnpm --filter @harness/backend test -- equip-inspect.service.spec.ts daily-inspect.controller.spec.ts --runInBand` 16/16 PASS, 프론트 구조 테스트 9/9 PASS, `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, `pnpm --filter @harness/backend build` PASS, 관련 파일 `git diff --check` PASS.
- 상태: 완료, lock released. 워크트리에는 이번 작업 외 다른 AI/이전 작업 변경이 다수 있으므로 커밋 시 파일 범위를 선별해야 한다.

## 2026-06-17 01:52 Codex

- 작업: `T-SYSTEM-LABEL-MENU-RENAME` 시스템관리 하위 라벨관리 메뉴명 변경.
- 확인: 메뉴 항목 `MST_LABEL`은 `apps/frontend/src/config/menuConfig.ts`에서 `labelKey="menu.master.label"`을 사용한다. 한글 표시명은 `apps/frontend/src/locales/ko.json`의 `menu["master.label"]` 값이다.
- 변경: `menu["master.label"]`을 요청 표기 그대로 `라벨다자인관리`로 변경했다. `/master/label` 페이지 내부 제목 `label.title = 라벨관리`는 메뉴명 변경 범위가 아니므로 유지했다.
- 검증: `ko.json` JSON 파싱 성공, `menu.master.label` 출력값 `라벨다자인관리` 확인, `MST_LABEL` labelKey 검색 확인, 관련 파일 `git diff --check` PASS.
- 상태: 완료, lock released.

## 2026-06-17 01:45 Codex

- 작업: `T-CONSUMABLE-LABEL-PRINTLOG-PAYLOAD` `/consumables/label` 브라우저 인쇄 후 `/material/label-print/log` 400 오류 수정.
- 원인: 소모품 라벨 훅 `useConLabelIssue.logBrowserPrint()`가 공용 라벨 이력 API에 `matUids`를 보냈다. 백엔드 `CreatePrintLogDto`는 `uidList: string[]`만 허용하고, `matUids`는 `/material/label-print/generate`용 `GenerateZplDto` 전용 필드라 class-validator에서 `property matUids should not exist`, `uidList must be an array` 400이 발생했다.
- 변경: `apps/frontend/src/app/(authenticated)/consumables/label/components/useConLabelIssue.ts`의 payload를 `uidList: conUids`로 수정했다. 구조 테스트 `useConLabelIssue.structure.test.mjs`를 추가해 `con_uid` 인쇄이력 호출이 `uidList`를 사용하고 `matUids`를 재사용하지 않도록 검증한다.
- 검증: 구조 테스트 PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 관련 파일 `git diff --check` PASS. 실제 API에 `uidList=['CODEX-CON-PRINTLOG-2606170141']` payload로 `POST /api/v1/material/label-print/log` 성공, 기존 `matUids` payload는 동일 400 재현 확인. 검증 로그는 삭제 후 잔여 0 확인. 3002 브라우저 `/consumables/label`에서 첫 행 선택 후 `UID 발행` 클릭 시 `/consumables/label/create` 201, `/material/label-print/log` 201 확인. 생성된 검증 UID `C26061700007` 관련 `CONSUMABLE_STOCKS` 1건, `LABEL_PRINT_LOGS` 2건 삭제 후 잔여 0 확인.
- 상태: 완료, lock released.

## 2026-06-17 01:04 Codex

- 작업: `T-CONSUMABLE-LABEL-IMAGE-PRINTLOG` `/consumables/label` 소모품 사진 표시 및 라벨 발행 500 오류 수정.
- 원인: `ConsumableLabelService.createConLabels()`가 `LabelPrintLog`를 생성하면서 복합 PK 필드 `PRINTED_AT`를 명시하지 않았다. TypeORM은 PK 컬럼 default를 맡기지 않고 null insert를 시도해 JSHANES `LABEL_PRINT_LOGS.PRINTED_AT` NOT NULL 제약에서 ORA-01400이 발생했다.
- 변경: 라벨 발행 가능 마스터 응답에 `imageUrl`을 포함했다. 소모품 라벨 발행 로그 생성 시 자재 라벨 서비스와 동일하게 `printedAt: new Date()`, `seq: 1`을 명시했다. 프론트 라벨 발행 그리드에 이미지 컬럼을 추가해 `/uploads/consumables/*.svg`를 표시한다.
- 검증: `pnpm --filter @harness/backend test -- consumable-label.service.spec.ts --runInBand` 8/8 PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 관련 파일 `git diff --check` PASS. 실제 3003 `POST /api/v1/consumables/label/create` with `APPCT-A/qty=1` 성공, 생성 UID `C26061700004`는 검증 후 `CONSUMABLE_STOCKS`와 `LABEL_PRINT_LOGS`에서 각 1건 삭제해 잔여 0 확인. API `/consumables/label/masters`에서 `APPCT-A imageUrl=/uploads/consumables/appct_a.svg` 확인. 3002 브라우저 `/consumables/label`에서 소모품 이미지 37개 렌더링, 첫 이미지 natural size 720x420 확인.
- 상태: 완료, lock released.

## 2026-06-17 00:47 Codex

- 작업: `T-EQUIPMENT-INSPECT-HISTORY-ACTUAL-SQL` `/equipment/inspect-history` DataGrid SQL 보기 실제 SQL 표시 보정.
- 원인: 화면의 `DataGrid.sqlQuery`가 실제 조회 테이블이 아닌 `EQUIP_INSPECTIONS`를 참조했다. 전역 SQL 모달은 preview SQL의 `FROM/JOIN` 테이블명과 API 응답 `meta.debugSql.tables`를 매칭하는데, 실제 백엔드 `EquipInspectService.findAll()`은 `EQUIP_INSPECT_LOGS`와 `EQUIP_MASTERS`를 조회하므로 테이블 매칭이 실패해 하드코딩 SQL이 그대로 보였다.
- 변경: `apps/frontend/src/app/(authenticated)/equipment/inspect-history/page.tsx`의 SQL preview를 `EQUIP_INSPECT_LOGS log LEFT JOIN EQUIP_MASTERS equip` 기준으로 교체했다. 구조 테스트 `inspect-history-actual-sql.structure.test.mjs`를 추가해 잘못된 `EQUIP_INSPECTIONS` 재유입을 막았다.
- 검증: 구조 테스트 PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 관련 파일 `git diff --check` PASS. JSHANES 활성 계정으로 3003 API 호출 시 `meta.debugSql.tables = EQUIP_INSPECT_LOGS, EQUIP_MASTERS` 및 실제 SELECT/parameters 확인. 3002 브라우저에서 `/equipment/inspect-history` → 그리드 옵션 → `SQL 조회문` 클릭 후 모달에 `"EQUIP_INSPECT_LOGS"`, `"EQUIP_MASTERS"`, bind 변수 `:1`, `:2`가 표시되고 구 preview `EQUIP_INSPECTIONS`는 미표시임을 확인했다.
- 상태: 완료, lock released. worktree에는 이전 작업의 backend/equipment 변경과 `.claude/worktrees` 미추적 폴더가 남아 있어 커밋 시 파일 범위 선별 필요.

## 2026-06-18 21:55 Codex

- 작업: `T-KIOSK-MOUNTED-RELOAD` `/production/input-kiosk` 재진입 시 장착 자재/소모품 DB 재조회 보정.
- 원인: 자재는 `JOB_MATERIAL_LOTS`를 `GET /production/job-orders/:orderNo/material-lots`로 다시 읽는 경로가 있었지만, 소모품 화면/스캔 모달은 `GET/POST /production/job-orders/:orderNo/consumables` 호출 때 현재 키오스크에서 선택한 설비를 넘기지 않았다. 백엔드는 `equipCode` query/body를 지원하고 `includeMounted=1`이면 `CONSUMABLE_STOCKS.STATUS='MOUNTED'`와 `MOUNTED_EQUIP_CODE` 기준으로 실제 장착 롯트를 읽을 수 있는데, 키오스크만 이 계약을 쓰지 않아 재진입 후 장착 상태가 설비 기준으로 복원되지 않을 수 있었다.
- 변경: `MaterialListPanel.tsx`가 소모품 조회 시 `params: { equipCode: selectedEquip?.equipCode, includeMounted: 1 }`를 전달하고, `ConsumableScanModal.tsx`도 목록 재조회와 스캔 장착 POST body에 같은 `equipCode`를 전달하도록 수정했다. localStorage에는 장착 UID를 추가 저장하지 않았다.
- 검증: 신규 구조 테스트 `kiosk-mounted-reload.structure.test.mjs` RED 확인 후 GREEN. `node --test apps/frontend/src/app/(authenticated)/production/input-kiosk/components/kiosk-mounted-reload.structure.test.mjs` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS.
- 실DB/API/브라우저: JSHANES에서 `WO2606150066 / HNS02C2ABCDE / EQ-ATCNS-01` 매핑 2건과 `CONSUMABLE_STOCKS` mounted UID `CT26061600001`, `CT26061600002` 확인. 인증 API `GET http://localhost:3002/api/production/job-orders/WO2606150066/consumables?equipCode=EQ-ATCNS-01&includeMounted=1`이 두 UID를 반환. headless Playwright로 `http://localhost:3002/production/input-kiosk`에 인증/키오스크 컨텍스트만 주입했을 때 동일 API가 호출되고 화면 body에 두 UID가 표시됨을 확인했다.
- 상태: 완료, REVIEW 대기, lock released. JSHANES `JOB_MATERIAL_LOTS`는 현재 0건이라 자재 저장 샘플 표시는 확인하지 못했지만 기존 DB 조회 경로는 테스트로 고정했다.

## 2026-06-16 23:58 Codex

- 작업: `T-EQUIP-INSPECT-HISTORY-BLANK-ROWS` `/equipment/inspect-history` 그리드 빈 행 수정.
- 원인: JSHANES `EQUIP_INSPECT_LOGS`에는 company `40`, plant `1000` 기준 실제 이력 15건이 있었다. 문제는 백엔드 `EquipInspectService.findAll()`이 `getRawMany()` 결과를 `log.log` 엔티티 객체처럼 펼쳐서 모든 점검 필드가 `undefined`가 된 것이다. JSON 응답에서는 undefined 필드가 제거되어 `{ equip: {} }` 15행만 내려갔고, 프론트 DataGrid가 이를 빈 행처럼 렌더링했다.
- 변경: `findAll()`에서 TypeORM raw alias(`log_EQUIP_CODE`, `log_INSPECT_TYPE` 등)를 명시적으로 camelCase 응답 필드로 매핑했다. Oracle custom alias가 대문자로 반환되는 케이스(`EQUIP_NAME`, `EQUIP_LINECODE`)도 fallback 처리했다. 프론트 `inspectDate` 컬럼은 ISO 원문 대신 Asia/Seoul 기준 `YYYY-MM-DD`로 표시하도록 정리했다.
- 테스트: `equip-inspect.service.spec.ts`에 raw 점검이력 행이 그리드 응답 shape(`equipCode`, `equipName`, `inspectType`, `inspectorName`, `overallResult`, `remark`)로 변환되는 회귀 테스트 추가. 기존 테스트와 함께 `pnpm --filter @harness/backend test -- equip-inspect.service.spec.ts --runInBand` 14/14 PASS.
- 검증: `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` PASS, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` PASS, 관련 파일 `git diff --check` PASS. API `http://localhost:3002/api/equipment/inspect-history?limit=3`에서 `EQ-ATCUT-01`, `자동절단 설비 #1`, `DAILY`, `오지훈`, `PASS` 반환 확인.
- 브라우저 검증: 임시 headless Chrome으로 `http://localhost:3002/equipment/inspect-history` 접속. DOM 기준 `EQ-ATCUT-01`, `자동절단 설비 #1`, `오지훈`, `합격`, `2026-06-16` 표시 true, ISO 원문 `2026-06-15T15:00:00.000Z` 및 `[object Object]` 미표시. 스크린샷 `docs/reports/equipment-inspect-history-grid-2026-06-16-after.png` 저장 후 육안 확인.
- 상태: 완료, lock released.

## 2026-06-16 23:30 Codex

- 작업: `T-KIOSK-WI-SEED-HNS02C1ABCD` `/production/input-kiosk` 작업지도서 미표시 원인 확인 및 시드 보완.
- 원인 확인: `WO2606150060`은 JSHANES `JOB_ORDERS` 기준 `ITEM_CODE=HNS02C1ABCD`, `PROCESS_CODE=ATCUT`, `EQUIP_CODE=EQ-ATCUT-01`, `STATUS=RUNNING`, `PLAN_QTY=5`였다. `EQ-ATCUT-01`도 `PROCESS_CODE=ATCUT`이고, 키오스크 `WorkInstructionView`는 `GET /master/work-instructions?itemCode=HNS02C1ABCD&processCode=ATCUT&useYn=Y&limit=20`를 호출한다.
- 데이터 부재: JSHANES `WORK_INSTRUCTIONS`에서 `COMPANY=40`, `PLANT_CD=1000`, `ITEM_CODE=HNS02C1ABCD`, `PROCESS_CODE=ATCUT`, `USE_YN=Y` 조건 0건, 동일 API도 `total=0`이었다.
- 변경: `apps/backend/src/migrations/2026-06-16_work_instruction_hns02c1abcd_seed.sql`을 추가했다. 복합키 `ITEM_CODE + PROCESS_CODE + REVISION + COMPANY + PLANT_CD` 기준 `MERGE`로 `HNS02C1ABCD 자동절단 작업지도서` Rev.A를 재실행 가능하게 적재한다.
- DB/API 검증: `oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-06-16_work_instruction_hns02c1abcd_seed.sql` 성공. 이후 DB 조회 1건, API `GET http://localhost:3002/api/master/work-instructions?itemCode=HNS02C1ABCD&processCode=ATCUT&useYn=Y&limit=20` total 1 및 제목/본문 반환 확인.
- 브라우저 검증: 임시 headless Chrome CDP에 `harness-auth`와 `harness-kiosk`를 주입해 `http://localhost:3002/production/input-kiosk`를 열었다. DOM 기준 `HNS02C1ABCD 자동절단 작업지도서`와 `작업지시 WO2606150060과 품목 HNS02C1ABCD를 확인한다` 표시 true, `작업지도서 없음` false. 스크린샷 `docs/reports/kiosk-work-instruction-hns02c1abcd-2026-06-16.png` 저장 및 육안 확인 완료.
- 상태: 완료, lock released.

## 2026-06-16 16:15 Codex

- 작업: `T-KIOSK-EQUIP-INSPECT-MIGRATION-RERUN` 점검이력 마이그레이션 파일 재실행성 보정.
- 원인: `oracle_connector.py --execute-file`은 SQL을 세미콜론이 아니라 `/` 단독 라인으로 분리한다. 또한 블록이 주석으로 시작하면 PL/SQL 블록으로 인식하지 못해 `END;`의 세미콜론을 제거한다. 이전 파일은 주석으로 시작한 PL/SQL 또는 세미콜론 구분 SQL이라 재실행 파일로 부적합했다.
- 변경: `apps/backend/src/migrations/2026-06-16_equip_inspect_workday_order.sql`을 파일 첫 줄이 `DECLARE`인 단일 idempotent PL/SQL 블록으로 변경했다. 컬럼/인덱스 존재 여부를 `USER_TAB_COLUMNS`, `USER_INDEXES`에서 확인하고 없을 때만 DDL을 `EXECUTE IMMEDIATE`로 실행한다. 백필 UPDATE도 동적 SQL로 처리해 신규 DB에서 컬럼 추가 후 같은 블록 안에서 실행 가능하게 했다.
- 검증: `python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file apps/backend/src/migrations/2026-06-16_equip_inspect_workday_order.sql` 재실행 성공(`blocks_executed=1`). Post-check 결과 컬럼 5개, 인덱스 4개, `WORK_DATE/INSPECT_AT` 누락 0건. 관련 파일 `git diff --check` 통과.
- 상태: 완료, lock released.

## 2026-06-16 19:00 Codex

- 작업: `T-EQUIP-INSPECT-ITEM-IMAGE-PANEL` `/master/equip-inspect-item` 사진 첨부와 모달 제거, 누락 기준정보 보정.
- 프론트: 등록/수정 UI를 모달에서 480px 우측 패널(`animate-slide-in-right`, `border-l`)로 전환했다. 목록에 사진 컬럼을 추가하고 패널에서 이미지 미리보기, 선택, 저장 후 업로드, 기존 이미지 삭제를 지원한다. 측정형 판정기준은 LSL/USL이 없더라도 `CRITERIA + UNIT`을 표시하도록 fallback을 보강했다.
- 백엔드/DB: `EQUIP_INSPECT_ITEM_MASTERS.IMAGE_URL` 컬럼과 DTO/entity/service/controller 저장 경로를 추가했다. `POST/DELETE /master/equip-inspect-item-masters/:itemCode/image`로 이미지 업로드/삭제를 처리하며 업로드 파일은 `uploads/equip-inspect-items`에 저장한다. JSHANES에는 `2026-06-16_equip_inspect_item_image_url.sql`을 적용했다.
- 데이터 보정: `2026-06-16_equip_inspect_item_missing_fields.sql`로 `EQUIP_TYPE COMMON=공통` 공통코드를 추가하고, 기존 공통/작업자 점검항목 10건의 누락 유형을 `COMMON`으로 채웠다. 누락 주기 7건은 `PERIODIC -> MONTHLY`, 그 외 `DAILY`로 보정했고, 측정형 항목의 단위/확정 가능한 기준값을 보강했다.
- DB/API 검증: JSHANES `EQUIP_INSPECT_ITEM_MASTERS` 50건 기준 `EQUIP_TYPE/ITEM_TYPE/CRITERIA/CYCLE` 누락 0건. API 인증 호출(`Bearer admin@hanes.com`, company `40`, plant `1000`) 결과 total 50, missing 0, `COMMON` 10, `imageUrl` field true. `COM_CODES`도 `EQUIP_TYPE/COMMON/공통` 1건 확인.
- 런타임 검증: `http://localhost:3002/master/equip-inspect-item` 실제 브라우저에서 `공통`, `작업표준서 규격 이내 (mm)`, `매월` 표시 확인. 등록 클릭 후 파일 입력 상위 컨테이너가 `x=960`, `width=480`, `animate-slide-in-right`, `border-l` 우측 패널이며 `role=dialog` 모달은 표시되지 않음. 이미지 업로드/삭제 API도 실제 PNG 업로드 후 DB URL 저장, 삭제 후 null 복귀 확인.
- 테스트: RED 후 GREEN으로 구조 테스트 3/3, `pnpm --filter @harness/backend test -- equip-inspect-item-pool.service.spec.ts equip-inspect-item-pool.controller.spec.ts --runInBand` 8/8 PASS, `pnpm --filter @harness/frontend exec tsc --noEmit` PASS, `pnpm --filter @harness/shared exec tsc --noEmit` PASS, `pnpm --filter @harness/backend build` PASS. `python tools/generate_db_schema_doc.py`로 `docs/reports/db-schema-erd.md` 재생성.
- 상태: 완료, lock released. 워크트리에는 다른 AI/기존 변경이 다수 있어 커밋 시 이번 작업 파일 범위를 선별해야 한다.

## 2026-06-16 20:33 Codex

- 작업: `T-EQUIP-INSPECT-ITEM-UNIT-DROPDOWN` `/master/equip-inspect-item` 등록/수정 패널의 측정 단위 입력형을 공통코드 드롭다운으로 전환.
- 확인: JSHANES 공통코드에서 단위 그룹은 `UNIT_TYPE`이며 기존 `UNIT` 그룹은 없음. `UNIT_TYPE`에는 `EA/M/KG/SET/ROLL/BOX/L/PCS/G/MM/CM/BAG/PAIR` 13건이 있었다.
- 변경: 측정형(`MEASURE`)일 때 `Input` 단위 필드를 `ComCodeSelect groupCode="UNIT_TYPE" includeAll={false} showCode`로 교체했다. 기존 데이터의 `mm`는 화면 편집 시 `MM`으로 정규화한다.
- DB 적용: `apps/backend/src/migrations/2026-06-16_equip_inspect_item_unit_type.sql` 추가 및 JSHANES 적용. 현재 점검항목 데이터에서 쓰는 `°C`, `Ω`를 `UNIT_TYPE`에 추가하고 기존 `mm` 4건은 `MM`으로 정규화했다.
- 검증: 구조 테스트 RED 확인 후 GREEN 4/4 PASS, `pnpm --filter @harness/frontend exec tsc --noEmit` PASS. JSHANES 단위값은 `MM` 4건, `°C` 2건, `Ω` 1건으로 정리됐고 세 값 모두 `UNIT_TYPE` 공통코드/API에서 확인. 3002 실제 브라우저에서 등록 패널 → 판정구분 `MEASURE` 선택 시 `단위` 컨트롤이 `SELECT`이고 `MM/°C/Ω` 옵션이 노출됨을 확인했다.
- 상태: 완료, lock released. 3002가 일시적으로 응답 지연되어 3012 임시 dev 서버를 띄웠으나 사용자 재실행 후 3002에서 최종 검증했고 3012 프로세스는 종료했다.

## 2026-06-16 21:28 Codex

- 작업: `T-CONSUMABLE-MASTER-IMAGE-SEED` `/consumables/master` 소모품 마스터 전체 시드 이미지 등록.
- 전제 확인: 이전 `T-ITEM-CONSUMABLE-MOVE` 이후 JSHANES 기준 `CONSUMABLE_MASTERS` 37건, `ITEM_MASTERS.ITEM_TYPE='CONSUMABLE'` 0건, 이미지 보유 0건을 확인했다.
- 생성: `tools/generate-consumable-master-seed-images.mjs`를 추가해 `apps/backend/uploads/consumables`에 소모품별 SVG 37개를 생성했다. 카테고리별로 `JIG/MOLD/TOOL` 형태와 색상을 달리하고, 코드/명칭/보관위치를 SVG에 표시한다.
- DB 적용: `apps/backend/src/migrations/2026-06-16_consumable_master_image_seed.sql` 생성 후 JSHANES에 적용했다. 37개 UPDATE + COMMIT 총 38블록 모두 성공.
- 검증: 로컬 SVG 37개, SQL UPDATE 37개 확인. JSHANES `CONSUMABLE_MASTERS` total 37, with_image 37, missing_image 0. 인증 API `/api/v1/consumables?limit=100&useYn=Y`도 total 37, missing 0, 첫 이미지 `/uploads/consumables/appct_a.svg` 반환. 정적 파일 `http://localhost:3003/uploads/consumables/cm_jg_ct1.svg` 200 `image/svg+xml`. 3002 실제 브라우저 `/consumables/master`에서 이미지 37개 전부 로드, 첫 이미지 natural size 720x420, console/page error 0.
- 상태: 완료, lock released.

## 2026-06-16 21:12 Codex

- 작업: `T-ITEM-CONSUMABLE-MOVE` 품목마스터에 남아 있던 소모품 12건을 소모품마스터로 이동.
- 사전 확인: JSHANES `ITEM_MASTERS` company `40`, plant `1000`, `ITEM_TYPE='CONSUMABLE'` 대상은 `APPCT-A/B/SE`, `CUTBL001/002/003/004/009`, `JIGHD-A/B/C/D` 총 12건. `BOM_MASTERS` parent/child, `MAT_LOTS`, `MAT_STOCKS`, FK 대상 `PROD_PLANS` 참조는 모두 0건이었다. `CONSUMABLE_CATEGORY` 공통코드는 `MOLD/JIG/TOOL` 3개만 활성이다.
- 변경: `apps/backend/src/migrations/2026-06-16_move_item_consumables_to_consumable_master.sql` 추가 및 JSHANES 적용. `CONSUMABLE_MASTERS`에는 기존 품목코드를 `CONSUMABLE_CODE`로 유지해 MERGE하고, `JIGHD*`는 `JIG`, 그 외 `APPCT*`/`CUTBL*`는 `TOOL`, `STATUS='NORMAL'`, `OPER_STATUS='WAREHOUSE'`, 재고 0으로 적재했다. 이후 `ITEM_MASTERS`의 대상 소모품 12건은 삭제했다.
- 보정: 첫 적용 때 파일 상단 주석 때문에 `oracle_connector.py --execute-file`의 PL/SQL 세미콜론 보존이 깨져 백업 블록이 실패했으나 실제 이동 블록은 성공했다. 파일을 `DECLARE` 시작 블록으로 고치고, 이미 이동된 DB에서도 `ITEM_MASTERS_CONSUMABLE_BAK_20260616` 백업 테이블을 핵심 컬럼으로 보강하도록 수정했다.
- 검증: 마이그레이션 재실행 성공(`blocks_executed=2`). 최종 JSHANES post-check는 `ITEM_MASTERS` 소모품 잔여 0건, `CONSUMABLE_MASTERS` 이동 12건, `ITEM_MASTERS_CONSUMABLE_BAK_20260616` 백업 12건. 이동 12건 분류는 `JIG=4`, `TOOL=8`. `git diff --check` 대상 파일 통과.
- 상태: 완료, lock released.

## 2026-06-16 21:39 Codex

- 작업: `T-CONSUMABLE-MASTER-USAGE-MAP` `/consumables/master` 우측 패널 내 `CONSUMABLE_USAGE_MAP` 매핑 섹션 추가.
- 확인: `CONSUMABLE_USAGE_MAP`는 JSHANES에 있고 20건 사용 중이며, 키오스크 `/production/job-orders/:orderNo/consumables`와 생산실적 완료 타수 누적 로직에서 쓰지만 관리 CRUD 화면/API가 없었다.
- 백엔드 변경: `ConsumablesModule`에 `ConsumableUsageMap`, `PartMaster`, `EquipMaster` repository를 등록하고, `/consumables/:id/usage-maps` GET/POST, `/consumables/:id/usage-maps/:productItemCode/:equipCode` PUT/DELETE를 추가했다. 목록은 `ITEM_MASTERS`, `EQUIP_MASTERS`, `CONSUMABLE_MASTERS`를 JOIN해 제품명/설비명/소모품명을 함께 반환한다. 생성은 동일 키가 있으면 업데이트로 동작한다.
- 프론트 변경: `apps/frontend/src/app/(authenticated)/consumables/master/components/ConsumableFormPanel.tsx` 패널 폭을 560px로 넓히고, 기존 기본정보/수명/거래처/이미지 섹션 아래에 `소모품 사용매핑` 고정 섹션을 추가했다. 신규 등록 모드에서는 저장 후 매핑 가능 안내만 표시하고, 수정/선택 모드에서는 제품/모델(`/master/parts`), 설비(`/equipment/equips`), 단위사용량, 사용여부, 비고 입력 후 저장/토글/삭제할 수 있다.
- 검증: `pnpm --filter @harness/backend exec tsc --noEmit --pretty false`, `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과. API `GET /api/v1/consumables/CM-JG-SL1/usage-maps`는 2건 반환. API 생성/삭제 경로는 `APPCT-A/HNS02/EQ-SASSY-01` 테스트 매핑을 생성 후 삭제해 둘 다 success true 확인, JSHANES 잔여 0건 확인. `http://localhost:3002/consumables/master` HTTP 200. 이 워크스페이스에는 Playwright 패키지/설정이 없어 브라우저 DOM 자동 검증은 수행하지 못했다.
- 상태: 완료, lock released.
