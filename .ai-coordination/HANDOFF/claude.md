# claude Handoff

## Last Update

2026-06-28 (local) — 출고요청 개선 우선순위 9개 전부 완료(커밋 8cfaef22·4acbabfb·35c25279, 미푸시)

## Latest

- T-ISSUE-REQ 출고요청 개선 9개 우선순위 **전부 완료**(커밋 3개, 미푸시). 설계 출처 `docs/reports/unfinished-work/2026-06-28-issue-request-and-itemmaster-rename.md`(grill-me). DB 무변경. 검증: BE jest 53/53(issue-request 22+mat-stock 31), FE/BE tsc 0, 구조테스트 6/6, locale JSON 4파일.
  - **#3+#9+#5(커밋 8cfaef22)**: 포장단위(MIN_PACK_QTY) 올림 출고 + [요청수량][포장단위][실출고수량] 3값. issueFromRequest 초과차단을 roundUpToPack(올림 잔여) 기준으로 완화. buildBomRequestItems/flattenItems 응답에 minPackQty. (상세는 이전 핸드오프 항목)
  - **#4(커밋 4acbabfb)**: 부분출고 PARTIAL 상태. issueFromRequest 완료판정 allCompleted?COMPLETED:PARTIAL, 출고 가능 조건 APPROVED/PARTIAL. FE IssueRequestStatus+배지 PARTIAL(주황). STATUS varchar2(20) 제약없어 DB 무변경.
  - **#6 LOT FIFO(커밋 35c25279)**: `mat-stock.findAvailable`을 입고일(RECV_DATE) 오름차순(null 뒤) 정렬 → 선입선출 LOT 우선. recvDate 응답 포함. **공유 API라 QueryBuilder 전면재작성 대신 기존 repository.find+메모리 구조 유지+정렬만 추가**(기존 spec 3건 보존). IssueFromRequestModal limit 100이라 실질 FIFO. 단 품목당 가용 LOT>100인 극단에선 updatedAt 상위 100 내 FIFO(페이지네이션은 기존부터 메모리필터로 부정확, 악화 아님).
  - **#2 중복요청 가드(35c25279)**: issue-request.create에 assertNoDuplicateActiveRequest — 동일 orderNo의 미완료(REQUESTED/APPROVED/PARTIAL) 요청에 같은 itemCode 있으면 차단. COMPLETED/REJECTED는 재요청 허용. orderNo 없는 수동요청 제외.
  - **#1 품목 직접입력(35c25279)**: RequestModal엔 이미 검색+추가 있었음. 갭은 메인 작성패널 WorkOrderRequestPanel create 모드 → 거기에 searchStockItems 검색+addManualItem 직접추가. StockItem/PartSearchResponse에 minPackQty 추가해 직접추가 품목도 3값 표시. page.tsx가 searchStockItems 전달.
  - **#7 재고 가시성(35c25279)**: IssueFromRequestModal LOT 옵션 label에 입고일(📅)·FIFO 우선(⭐) 표시 + 선택 LOT 가용<출고수량이면 사전 경고(AlertTriangle). AvailableStock에 recvDate.
  - **#8 공정효과(35c25279)**: processCode 지정 출고가 공정재고(장착 대기, ADR 0002)로 적재됨을 WorkOrderRequestPanel create 모드·IssueFromRequestModal에 Info 배너로 안내. RequestDetail에 processCode.
  - **남은 것**: 브라우저 E2E 미수행(APPROVED 요청+minPackQty>0+다LOT 시드 필요). 별개 추적: jest `wip-mat-stock.service.spec.ts findByEquip` 선재 실패(리네임 무관, mock groupBy 미정의)는 미해결.
  - **LOCKS**: 본 세션 락 T-ISSUE-REQ-PACK-QTY 제거 완료(순변경 없어 LOCKS.md 커밋엔 미반영).

- T-ISSUE-REQ-PACK-QTY 완료(커밋 8cfaef22, 미푸시): `/material/request` 출고요청에 포장단위(MIN_PACK_QTY) 올림 출고 + 3값 표시. 설계 출처 `docs/reports/unfinished-work/2026-06-28-issue-request-and-itemmaster-rename.md`(grill-me 확정). 사용자 선택 범위=**핵심만(포장단위 올림+3값)**, 나머지 우선순위(#2 중복가드/#4 PARTIAL/#1·#6·#7·#8)는 미착수.
  - **수량 모델**: 요청=낱개 필요량(현행 buildBomRequestItems 유지) / 실출고=`ceil(요청÷minPackQty)×minPackQty` 올림 / 잔량=공정재고 재공(반납 안 함).
  - **핵심 정합**: 올림 출고는 요청수량(낱개)보다 커질 수 있어 기존 `issueFromRequest` 초과차단(`issueQty>remaining`)과 충돌 → 차단 기준을 `roundUpToPack(remainingQty, minPackQty)`(올림 잔여)로 완화. issueFromRequest 루프에서 `itemMasterRepository.findOne`으로 minPackQty 조회. 완료판정(COMPLETED)은 `issuedQty>=requestQty`라 올림 출고 시 자연 충족.
  - **BE**(issue-request.service.ts): `roundUpToPack` private 헬퍼, `flattenItems`/`buildBomRequestItems` 응답에 `minPackQty: toNumber(part?.minPackQty)`. **DB 무변경**(ITEM_MASTERS.MIN_PACK_QTY 기존 컬럼 read-only, default 0이면 올림 효과 없음=하위호환). mat-issue.createInTx는 미변경(재고차감만, 올림값 그대로 처리).
  - **FE**: useIssueRequestData `RequestItem.minPackQty`+loadBomRequestItems 매핑. WorkOrderRequestPanel 작성그리드에 포장단위/실출고수량(calcIssueQty) 컬럼. IssueFromRequestModal `packRemainQty`(올림 잔여)로 issueQty 기본값·입력 max 설정 + 포장단위 컬럼. i18n `material.request.{minPackQty,issueQtyLabel}` 4파일.
  - **검증**: BE jest `issue-request.service.spec.ts` 18/18(신규 3: minPackQty 응답·BOM 산출·올림 허용+경계차단), FE/BE tsc 0, 구조테스트 `issue-request-pack-qty.structure.test.mjs` + 기존 contract 3/3, locale JSON 4파일 유효. **브라우저 E2E 미수행**(APPROVED 요청+minPackQty>0 품목 시드 필요 → 사용자 확인 시 진행).
  - **남은 우선순위(미착수)**: #2 중복출고 가드, #4 부분출고 PARTIAL 상태(현재 COMPLETED만), #1 품목직접입력, #6 LOT FIFO, #7 재고가시성, #8 공정효과표시. 이어서 하려면 같은 설계 기록 참조.

- T-WORKFLOW-GUIDE-HUB(`/workflow` 처음 사용자용 업무 가이드 허브 재설계) 완료 — **브랜치 `feature/workflow-guide-hub` 원격 푸시 완료**(main 미병합). 설계 `docs/superpowers/specs/2026-06-24-workflow-guide-hub-design.md`, 계획 `docs/superpowers/plans/2026-06-24-workflow-guide-hub.md`. SDD 7 Task + 최종 통합리뷰(opus, Ready to merge, Critical/Important 0).
  - **구조**: 좌측 레인그룹 단계목록(`WorkflowSidebar`) + 중앙 가이드본문(`WorkflowGuide`: 왜/언제/주의점 + 입력·산출 + 화면바로가기 + help md 인라인 + 선·후행) + 상단 [가이드]/[흐름도] 탭. 두 탭이 `selectedNodeId` 공유, 흐름도 노드클릭→가이드탭 점프(`selectFromFlow`).
  - **데이터**: `config/workflowMap.ts`에 optional 가이드필드(why/when/cautions/order/helpRefs) + 헬퍼 4종(getNodesByLane/getVisibleNodeIds/getPreviousNodes/getNextNodes). 주 흐름 22단계 한국어 본문 작성(추적·역처리 3노드는 골격).
  - **재사용**: `WorkflowHelpInline`이 `useHelpDoc`+`MarkdownRenderer`+`findMenuCodeByPath`로 단계별 help md를 접힌 아코디언 인라인 렌더(helpRefs 우선, 없으면 routes→메뉴코드 자동도출+dedup, notFound 숨김). 흐름도는 기존 React Flow 맵을 `WorkflowFlow`로 분리(동작 동일).
  - **i18n**: locale 4파일이 타 세션(T-TRACE-FULL/T-KIOSK-SG-LABEL-PRINT 등) active 락이라 **JSON 미수정** — 라벨만 `t("workflowGuide.*", "한국어fallback")`. 한국어 폴백 리터럴 보존으로 구조테스트 통과. 키는 락 해제 후 별도 추가 필요.
  - **검증**: 통합 HEAD 기준 구조테스트 `workflow-business-map.structure.test.mjs` **7/7 PASS**, 프론트 tsc **0**. 피처 커밋 7개 `a391e3d6 a88f0359 3ea8edb9 ea9806bb ef0f1ac4 bcfc3f4d c9203115`.
  - **Minor(전부 defer, 사용자판단)**: getNodesByLane 혼합정렬키(`order ?? x`, 현재 trace-reversal만 order결측이라 무해—향후 order보유 레인에 order없는 노드 추가 시 정렬 꼬임 주의); 빈/로딩 상태 한국어 4문자열 미i18n; stepSuffix 숫자+접미사 연결(언어별 어순 미대응); 구조테스트 edge.kind 정규식 `\w+.kind`로 일반화. PR 미생성(푸시만).
  - **LOCKS 정리**: 본 세션 락 `T-WORKFLOW-GUIDE-HUB` 제거함. locale 등 타 세션 미커밋 변경 혼입 회피 위해 협업 보드는 워킹트리만 갱신(미커밋), 직전 claude 세션 관례 동일.

- T-KIOSK-SG-LABEL-PRINT(키오스크 SG 라벨 발행공정 자동 출력) 완료: 키오스크 실적저장 시 라우팅 `ISSUE_SG_LABEL_YN='Y'` 발행공정이면 백엔드가 발행한 `SG_LABELS`를 **HANES Print Agent(Go, PNG, `printAgentPng`)로 모달 없이 자동 출력**.
  - **흐름**: `ProductionInputBar` 실적저장 성공 → `onResultSaved(resultNo)` 상위 전달 → `page.tsx` `handleResultSaved` → `SgLabelPrintHost.printByResultNo` → `GET /production/subprocess-kitting/sg-labels-by-result/:resultNo`(발행분 0건이면 무동작) → 오프스크린 `LabelPrintRenderer` 렌더 → `printLabelNodesViaAgent`(신규 `services/label-print.ts`, MatLabelPreviewModal 검증로직 추출: SVG foreignObject→canvas→PNG base64→`printAgentPng`). **백엔드 SG 발행(`issueSgLabelInTx`)은 기존 동작 그대로**, 출력만 추가.
  - **SG 라벨 디자인 출처**: 사용자 선택대로 `master/label`에 **'sg'(반제품 SG) 카테고리 신규**(하드코딩 인라인 대신 기존 확장형 라벨템플릿 체계에 편입). BE dto `LABEL_TEMPLATE_CATEGORIES`에 `'sg'` 추가, FE `types.ts`(LabelCategory/LabelSourceTable/`SG_LABEL_DEFAULT_DESIGN` 70×40mm + createDefaultLabelDesign 분기), `labelSources.ts`(sg_label 소스/필드), `page.tsx`(sourceCategoryMap), `LabelObjectDesigner.tsx`(소스 라벨). 키오스크 호스트는 `GET /master/label-templates?category=sg`로 템플릿 로드(없으면 `createDefaultLabelDesign("sg")` 폴백).
  - i18n: `master.label.srcSgLabel` + `kiosk.sgLabel.{prepareFailed,printSent,printError}` ko/en/zh/vi 4파일 surgical 편집(BOM 없음·JSON 유효 검증). 검증: FE+BE tsc **0/0**, 신규 구조테스트 `kiosk-sg-label-print.structure.test.mjs` **pass**, 기존 pallet-category 테스트 **pass**.
  - **번들**: 백엔드 기본 bundleCount=1 → 실적 1건당 SG 라벨 1장(키오스크는 bundleCount 미전송). 번들 UI 미추가(기본값 수용).
  - **systemic check(비범위 보고)**: `production/subprocess-kitting` 페이지는 발행된 SG를 **표시만** 하고 에이전트 출력 미연동. 이번 요청은 키오스크 한정이라 미확장 — 동일 패턴 적용 필요 시 사용자 확인 후 진행 권장.
  - **LOCKS/JOURNAL/ARCHIVE/TASKS 미기록**: 세션 시작 시점 git status상 codex가 `LOCKS.md`/`JOURNAL.md`/`ARCHIVE.md`/`TASKS.md`를 active 잠금·미커밋 편집 중 → 직전 claude 세션 관례대로 충돌 회피(내 LOCKS 항목 `T-KIOSK-SG-LABEL-PRINT` 제거 및 JOURNAL/ARCHIVE 기록 보류, 상세는 본 핸드오프). codex가 LOCKS.md 릴리스 후 해당 잠금 제거 필요.

- T-ASSEMBLY(조립 실적입력 재설계) 완료(커밋 4657f328,8342ce45,410d70a0,3991fb63,84a0e336,8fba9994): `/production/input-assembly`를 **고정 스캔 2영역 + 2단계 커밋**으로 전면 재설계. 계획 `docs/superpowers/plans/2026-06-23-input-assembly-redesign.md`, SDD 5 Task + 최종 통합리뷰(Critical/Important 0).
  - **흐름**: ① 반제품(SG) 세트 스캔(준비, 미커밋·리셋가능) → ② **조립 실행=FG 바코드 채번+라벨 1장 발행**(`POST /production/subprocess-kitting/issue-label {orderNo,equipCode}`, FgLabel status='ISSUED', 매핑/소비 없음) → ③ **실물 FG 라벨 스캔=확정**(`POST .../confirm {fgBarcode,orderNo,equipCode,processCode,sgBarcodes}`): genealogy(FG→SG, FG→MAT_LOT) + SG 1소비 + 설비 WIP 자재 BOM(qtyPer) 차감 + ProdResult(goodQty:1 DONE) + FG WIP 재고, **단일 트랜잭션**.
  - **자재=설비 단위 장착**(WIP_MAT_STOCKS, 작업지시 무관, DB 저장, 명시 해제 전까지 유지, 보충 스캔). 신규 `POST/GET /production/equip-material/{mount,mounted,unmount}`(EquipMaterialService, WipMatStockService 재사용, unmount 복원량은 restoreInTx 반환 기준).
  - **오투입 가드 양측 동일**: SG itemCode가 완제품 BOM의 SEMI_PRODUCT child가 아니면 거부(프론트 사전검증+백엔드 confirm 재검증). FG 라벨 중복확정은 genealogy 존재로 차단(별도 status 미추가).
  - FE: page 전면재작성 + 신규 `EquipMaterialMountPanel`(좌)·`SgScanPanel`(우)·`AssemblyActionBar`(하단). 상단 고정바=작업지시(FINISHED 필터)+공정+설비(필수). 확정 후 sgList·issuedFg만 리셋(작업지시/공정/설비 유지). React19 `import type { JSX }`.
  - i18n: `production.equipMaterial`(13)+`production.inputAssembly`(13) 신규 + scanSection 라벨갱신, ko/en/zh/vi 4파일. **주의: locale JSON에 기존 중복키(mount 2회 등) 존재 → JSON.parse 재직렬화 시 데이터소실. surgical 문자열편집(CRLF 보존)만 사용**(스크립트 scratchpad/apply_i18n_assembly.js).
  - 검증: 프론트+백엔드 tsc 0. **브라우저 E2E는 미수행**(FINISHED 작업지시+BOM(SEMI/RAW)+SG재고+설비 MAT_LOT 등 시드 다량 필요 → 사용자 요청 시 진행). 추적 화면 FG 매핑 표시 확인도 시드 후 권장.
  - **follow-up(defer, 기존 kit과 동일)**: I-1 confirm 루프 내 nextGenealogyId N+1(numbering 일괄채번 구조변경 필요); I-2 작업지시 status 미검증(itemType=FINISHED만). 비범위: 키오스크 자재모델 전환.
  - **LOCKS/JOURNAL/ARCHIVE/TASKS 미기록**: codex/kimi가 해당 파일 active 미커밋 편집 중이라 충돌 회피(상세는 본 핸드오프). T-ASSEMBLY 잠금은 애초 미등록(해제 대상 없음). locale 4파일은 T-TRACE-FULL/T-SHIP-ORDER-CANCEL(claude) 잠금 하였으나 **순수 additive(신규 namespace + 자기 소유 키만)**라 무충돌, 세션 시작 시 locale clean 상태였어 미커밋 작업 미손상.

- T-SHIP-ORDER-CANCEL 완료(커밋 d3cf1f63..f77b36fa): `/shipping/return`을 **출하취소** 화면으로 재구성. SDD 8 Task + 최종 리뷰(Critical 0).
  - 좌:통합 출하이력(박스+팔레트, 박스출하 팔레트번호 `*`) / 우:팔레트·박스 상세 / **출하지시 단위 단일 트랜잭션 취소**(팔레트분 reverse→CANCELED+팔레트 detach, 박스분 cancel-ship-box) + SHIPPING_RETURNS 취소이력 자동기록(returnNo=SEQ_SHIP_RETURN, 팔레트+박스 복원수량 항목화 RESTOCK).
  - BE: BOX_MASTERS.SHIP_ORDER_NO/SHIPPED_AT 컬럼(**JSHANES DDL 적용·검증 완료**, 마이그레이션 `apps/backend/src/migrations/2026-06-22_box_ship_order_no_and_return_seq.sql`) + 3개 출하경로(shipBox/shipOrderPallets/markAsShipped) stamp. 취소/역분개 `*InTx` 헬퍼 추출(동작 보존). cancelOrderShipment 트랜잭션 내 **pessimistic-lock으로 shipment 상태/ERP 재검증**(동시성 창 제거). 신규 API: GET /shipping/orders/shipped, GET /shipping/orders/:id/shipped-detail, POST /shipping/orders/:id/cancel-shipment.
  - 검증: BE/FE tsc 0, shipping jest 103/103, 구조 테스트 1/1, i18n 4파일 동기화. **실DB 취소 E2E + pessimistic-lock Oracle FOR UPDATE 실DB 검증 권장**(jest는 QueryRunner mock). 미해결시 lock 옵션만 제거하고 재검증 로직 유지.
  - 잔여 주의: cancelShipBox는 동일 itemCode 다중 라인 시 임의 라인 shippedQty 차감(기존 패턴). getShippedDetail 상세 팔레트는 LOADED/SHIPPED 표시(부분 reverse 후 표시 nuance).
  - **LOCKS 정리 보류**: 본 작업 LOCKS 항목(T-SHIP-ORDER-CANCEL)은 codex가 LOCKS.md를 활성 잠금·미커밋 편집 중이라 제거하지 않음. codex가 LOCKS.md 릴리스 후 제거 필요. JOURNAL.md/TASKS.md도 codex 잠금이라 미기록(상세는 본 핸드오프·ARCHIVE 참조).

- T-BOX-SHIP-CONFIRM 완료(커밋 1038f0e4 i18n · 27793ade page): `/shipping/confirm`을 팔레트 출하 → **박스별출하**로 재구성.
  - 메뉴 라벨 shipping.confirm "출하작업"→"박스별출하"(4언어). 3-컬럼: 좌 CONFIRMED 출하지시 / 중 라인 진행률+출하가능 박스(fulfillment candidateBoxes, **읽기 전용**, 행클릭→시리얼) / 우 박스 시리얼(box-stock serials).
  - 출하·취소는 **기존 고아 컴포넌트 `BoxScanShipModal` 재사용**(ship-box/cancel-ship-box). OrderFulfillmentModal.tsx 삭제, Shipment 목록 패널·cancel/reverse·ShipmentScanModal·/shipping/shipments 제거. **백엔드 변경 0**, 라우트/메뉴코드 SHIP_CONFIRM 유지.
  - SDD 3 Task + 최종 리뷰 머지승인. tsc 0, i18n 누락 0(shipping.confirm/boxScan), 구조 테스트 `box-ship-page.structure.test.mjs`. **브라우저 UI E2E는 사용자 확인 권장**.
  - **후속 주의**: ① 팔레트 출하 Shipment 생명주기 UI(배송완료/역분개/ERP동기화)가 confirm 제거로 거처 없음 → 별도 과제. ② OQC 미사용 시 candidateBoxes 후보 좁아질 수 있음(백엔드 정합화 별도). ③ confirm.* 미사용 잔존 키 정리 권장. 상세 JOURNAL 2026-06-22.

- T-I18N-FULL-SWEEP 진행중(코드 미커밋, **하드코딩 전환 미완**): 전체 `(authenticated)` 화면 i18n 누락 점검.
  - **번역 키 누락은 100% 해결**: 모든 `t()` 정적 키가 ko/en/zh/vi 4파일에 존재(ko 미존재 0, 4언어 불일치 0, 키 수 동일 6641). master 그리드/폴백-only 키, 공통 컬럼 팩토리(`lib/table-utils/column-factories.tsx`의 `part.code`/`equip.code` 등 최상위 키) 누락 보강 포함.
  - **하드코딩 `t()` 전환**: 80개 코드 파일 완료(14개 병렬 에이전트). production/system/material/consumables/equipment/quality/shipping 등. `${}` 폴백은 i18next `{{}}` 보간으로 변환.
  - **미완**: 6개 에이전트가 세션 한도(6am 리셋)로 중단 → 코드에 한글 하드코딩 잔여. 측정 1075라인(과대추정, types.ts 상수·dead코드·멀티라인 t()·주석 다수 포함). 실제 미전환 주로 **master 잔여(labelSources.ts/types.ts)·production 나머지·quality aql/spc·shipping·equipment 일부**.
  - **회귀 없음**: 중단 코드도 `t(key,폴백)` 형태라 tsc 0 통과, 한글 폴백 표시(기능 정상, 다국어만 미적용). locale 4언어 완전 동기화, CRLF 유지, BOM 없음.
  - **인계 절차서: `docs/i18n-hardcoding-migration-guide.md`** — 측정/병렬에이전트/locale삽입(setIfAbsent+CRLF 재직렬화)/폴백복구/검증 스크립트 포함. 다른 AI는 이 문서대로 미완 모듈을 이어서 처리하면 됨.
  - **핵심 함정**: locale은 CRLF(LF 섞임 금지), BOM 금지, `JSON.stringify(,,2)+\n`→CRLF가 원본과 바이트동일(재직렬화 안전), `common.*` 새 키 금지, 4언어 동시.

- T-PROCESS-LINE-TYPE-UI 완료(DB 일부 commit, 코드 미커밋): PROCESS_MASTERS LINE_TYPE 화면 반영.
  - BE: process dto/service `lineType`(+create의 processCategory 누락 동반 수정), equip-master findAll `lineType` 매핑.
  - FE: 공정마스터 화면 라인 컬럼/필터/입력(ComCodeSelect), 설비선택 모달을 라인(저전압/고전압/공통)별 섹션→공정 카드 2단계 그룹. equipOptions normalize에 lineType + undefined필드 정리.
  - DB: COM_CODES LINE_TYPE 3건 commit. 시드 `tools/seed/seed_line_type_comcode.py`.
  - 검증: FE/BE tsc 0, equipOptions 2/2. 브라우저 렌더는 dev 서버 재컴파일 불안정으로 미완 — 사용자 직접 확인 권장. locales codex 점유라 t() defaultValue 폴백.

- T-PROCESS-MASTER-PDF-REORG 완료(DB 반영 commit, 코드 미커밋): THN 제조공정 흐름도 PDF 기준 `PROCESS_MASTERS` 정비.
  - `LINE_TYPE`(LV/HV/CM) 컬럼 비파괴 ADD. 기존 18개 **코드 유지**, 명칭/라인/순서만 정비. 신규 23개(LV17·HV4·CM2) INSERT. PRC-* 4개 비활성. 활성 41개.
  - **PROCESS_CODE 무변경** → 23개 참조 테이블 무손상. 그로멧/부자재삽입은 공용(CM). 엔티티 `lineType` 추가, BE tsc 0.
  - 시드 `tools/seed/seed_process_master_pdf.py`(멱등), 설계 `docs/superpowers/specs/2026-06-20-process-master-pdf-reorg-design.md`. JSHANES commit 완료.
  - **남은 것**: 화면 반영(공정마스터 LINE_TYPE 컬럼/필터, 설비선택 모달 라인별 그룹)은 별도. IF_PO INVALID는 무관(원래 깨짐).

- T-KIOSK-EQUIP-MODAL-GROUP 완료(코드 미커밋): `/production/input-kiosk` 설비선택 모달을 공정별 그룹화 + 확대.
  - `EquipSelectModal.tsx`만 수정. Modal `size="full"`(90vw), 공정별 그룹(`useMemo`, 공정명순/미지정 맨뒤) + `columns-2~5` 멀티컬럼 카드. 스캔+검색 한 줄 압축.
  - `equips`는 이미 `processCode`/`processName` 보유(`/equipment/equips` findAll PROCESS_MASTERS 조인). 신규 라벨은 `t(noProcess, {defaultValue})` 폴백 — **locales는 codex(T-SHIP-ORDER-PRINT) active 점유라 미수정**.
  - 검증: FE tsc 0, 3002 브라우저 실측(22공정/48설비 5컬럼 거의 한 화면, 스크롤 최소). input-kiosk 일시 500은 codex의 3002 재시작 직후 컴파일 지연(stash 검증으로 무관 확정).

- T-QUALITY-AQL-COMCODE-DROPDOWN 완료(DB 시드 commit, 코드 미커밋): `/quality/aql` 기준관리의 코드성 입력 3종을 공통코드 드롭다운으로 전환.
  - 검사수준→`AQL_INSP_LEVEL`(신규 7종), AQL값→`AQL_VALUE`(신규 26종), 사용여부→`USE_YN`(기존) 모두 `ComCodeSelect includeAll={false}`.
  - JSHANES(40/1000) `COM_CODES` 33건 시드 commit. 빌더 `tools/seed/seed_aql_comcodes.py`(멱등, dry-run/`--commit`).
  - **AQL_VALUE DETAIL_CODE는 JS canonical(`1.0`→`"1"`, `0.040`→`"0.04"`)** — 프론트 `String(aqlValue)` 매칭용. CODE_NAME만 ISO 표준 표기. 기존 데이터(II/1.0/2.5/4.0) 매칭 확인.
  - i18n 4파일 `comCode.AQL_INSP_LEVEL.*` 7키 추가. AQL값은 숫자라 codeName 폴백.
  - 검증: FE tsc 0, 구조 테스트 5/5, locale JSON parse OK. 브라우저 E2E 미수행(사용자 확인 권장).

- T-HNS02-STOCK100-SEED 완료(DB 반영 commit, 코드 미커밋): JSHANES(40/1000) HNS02 완제품 제품재고 **100개**를 BOM 7단계 완전 정합 시드로 생성.
  - 기존 HNS02 작업지시 55건 + MAT_ISSUE_REQUESTS 25/REQUEST_ITEMS 34 정리 → 작업지시 17건(품번당 1, DONE, PARENT_ID 트리) 재구성. **codex의 WO2606150066 참조 데이터는 사용자 명시 승인하에 삭제됨** — codex 키오스크/소모품 REVIEW 작업 재검증 시 해당 작업지시 없음 주의.
  - 생성: PO1/라인18, 원자재18종(입하·IQC·입고·LOT·재고·MAT_IN), 생산실적17, 자재소비(MAT_ISSUES18·MAT_OUT18), SG라벨 20(5묶음 CONSUMED), 반제품 WIP 수불(net0), FG라벨 100(PACKED), 제품재고 HNS02 FG_MAIN **100**, FG_IN, 검사 200(AINSP+OINSP PASS), genealogy FG←SG 100.
  - 잔량 0(반제품 WIP·시드 원자재), 수불 균형(STOCK_TX 합0), 공유 원자재 MAT_LOTS 112 보존, 출하 무변화. 독립 연결 재검증 PASS.
  - 빌더 `tools/seed/seed_hns02_stock100.py`(BOM 재귀전개→정리→INSERT→검증, dry-run 기본 / `--commit`, 멱등). spec `docs/superpowers/specs/2026-06-19-hns02-product-stock-100-seed-design.md`. 채번 시드마커(POH-/ARH-/WOH-/FGH...), MAT_UID=VH1-RM260619.

- T-INSPECT-RESULT-EQUIP-SELECT 완료(미커밋): `/inspection/result`에 검사기(TESTER) 선택 + 소모품 출처 교정 + 검사 실적 검사기 기록 + chromeless 전체화면.
  - **검사기 선택**: 헤더에 `/equipment/equips/type/TESTER` Select. 선택 equipCode를 ConsumablePanel(소모품 조회/장착)+InspectPanel(inspect payload)에 전달. 미선택 시 검사 차단(인터락, 소모품보다 우선). **선택 검사기는 localStorage(`hanes:inspection:equip:${inspectType}`)에 스테이션 단위 저장 → 새로고침/전체화면 토글 후 자동 복원. 목록에 없는 저장값은 정리.**
  - **소모품 출처 교정**: 기존엔 작업지시 생산설비(jobOrder.equipCode)로 조회 → 검사화면에 절단설비 소모품이 떴음. 이제 **선택 검사기 기준**. 공유 `kiosk-consumable`(service/controller/dto)에 **선택적 equipCode override** 추가(미제공 시 키오스크 기존 동작 유지=하위호환).
  - **검사 실적 기록**: `INSPECT_RESULTS.EQUIP_CODE` 컬럼 추가(DDL, 엔티티, inspect() 저장). DTO엔 이미 equipCode 존재.
  - **시드**: CONSUMABLE_USAGE_MAP에 검사기 소모품 매핑 5건(JIG 치구). JSHANES 적용(deploy서버와 DB공유).
  - **전체화면**: MainLayout에 `view=full` chromeless 분기(키오스크 view=work 패턴 일반화). 검사화면 헤더 토글 버튼.
  - 마이그레이션: `apps/backend/src/migrations/2026-06-18_inspect_result_equip_code.sql`, `..._tester_consumable_map_seed.sql`. **deploy.yml 미반영(필요시 추가) — 단 JSHANES=deploy DB 공유라 이미 적용됨.**
  - 검증: FE/BE tsc 0. 브라우저 E2E(검사기선택→CM-JG-CT1 치구→스캔 EQ-AINSP-01 장착→PASS시 IR.EQUIP_CODE 기록→전체화면 사이드바숨김), 테스트데이터 원복 완료.
  - **선택 검사기 유지**: localStorage `hanes:inspection:equip:${inspectType}` 저장/복원(새로고침·전체화면 토글 후 유지). 브라우저 검증 완료.
  - **소모품 영속/교체/강제해제**(T-INSPECT-CONSUMABLE-PERSIST): 소모품은 설비 귀속 장착(CONSUMABLE_STOCKS.MOUNTED_EQUIP_CODE)이라 작업지시 바뀌어도 유지. findByJobOrder `includeMountedOnEquip`(인스펙션만 includeMounted=1)로 설비 장착분 union 표시. scanMount는 동일소모품 이전 롯트 자동해제(교체, **키오스크에도 적용**). ConsumablePanel에 강제 장착해제(확인모달). 작업지시 전환 영속은 브라우저 검증 완료, 교체/강제해제/terminal-result는 세션만료(401)로 브라우저 재검증 미완(코드/tsc만).
  - **terminal-result(`/inspection/terminal-result`)**: 동일 `InspectionResultWorkflow`(inspectType=TERMINAL) 공유라 위 모든 개선 자동 적용. 별도 코드 불필요.

- T-INSPECT-RESULT-CONSUMABLE-MOUNT 완료(미커밋): `/inspection/result`(통전검사 실적)에 input-kiosk와 동일한 소모성 설비부품 표시+conUid 스캔 장착 추가.
  - 신규 `inspection/result/components/ConsumablePanel.tsx`(kioskStore 비의존, `orderNo` prop + `onStatusChange` 콜백, 인라인 스캔 입력).
  - **배치: 좌측 작업지시 목록 하단**(후속 이동). 장착 상태는 `InspectionResultWorkflow`로 끌어올려 `InspectPanel`(우측)에 props 전달 → 미장착 시 PASS/FAIL 인터락(버튼 비활성+주황 배너)은 우측 버튼 옆 유지.
  - 재사용 키오스크 API 3종(`GET/POST scan/DELETE /production/job-orders/:orderNo/consumables`). **백엔드/DB 스키마 변경 0.** 매핑 0건이면 검사 흐름 그대로.
  - i18n `inspection.result.*` 5키 ko/en/zh/vi 추가. 설계: `docs/superpowers/specs/2026-06-18-inspection-result-consumable-mount-design.md`.
  - 검증: frontend tsc 0. 로컬 3002 브라우저 — 매핑0(HNS02) 검사가능 / 매핑2(WO2606150060) 0/2 인터락차단 / C26020100025 스캔→1/2 / X해제→재차단, 테스트 롯트 ACTIVE 원복.

- T-WIP-MAT-TRANS-SCREEN 완료(커밋 915b9c8b, 메뉴시드 6c34b8f3): 공정재고 조회/수불 화면 보강.
  - 공정재고 화면(`/production/wip-material-stock`) 상단 정보카드(StatCard) 제거.
  - **공정수불 화면 신설**(`/production/wip-material-trans`): `WIP_MAT_TRANSACTIONS` 거래이력 조회. API `GET /inventory/wip-mat-transactions`(`WipMatStockService.findTransactions`, EQUIP_MASTERS/ITEM_MASTERS 조인, 날짜·설비·거래유형·검색 필터, 기본 당일). 컬럼: 일시/거래유형(배지)/설비/품목/LOT/수량(±)/참조/비고.
  - 메뉴 2개 DB 시드 완료(JSHANES): `PROD_WIP_MAT_STOCK`(공정재고, sort75)·`PROD_WIP_MAT_TRANS`(공정수불, sort76), 생산관리 카테고리. ROLE_MENU_PERMISSIONS MANAGER/OPERATOR 권한 시드. menuConfig.ts + menu-code-validator.ts 반영.
  - i18n: `inventory.transaction.wipIn`이 기존 "반제품 입고"로 점유돼 충돌 → 공정수불 라벨은 `production.wipMaterialTrans.*` 별도키, `inventory.transaction`엔 `wipMatIn`/`wipMatInCancel` add-only.
  - 검증: backend/frontend tsc 0, jest 11/11. **실DB E2E 화면 검증 완료** — 공정입고(+500)→생산소비(-500)→생산소비취소(+500)→공정입고취소(-500) 거래이력이 공정수불 화면에 정상 표시. 검증 데이터는 잔량 0 원복(거래원장 이력 보존).

- T-MAT-ISSUE-WIP-STOCK 완료(커밋됨): 자재출고를 "출고=소비"에서 **2단계 WIP**(창고→설비 공정재고 이동 + 생산실적 완료 시 소비)로 전환. 공정재고는 **설비(EQUIP_CODE) 단위 별도 테이블**.
  - 신규: `WIP_MAT_STOCKS`(PK COMPANY/PLANT_CD/EQUIP_CODE/ITEM_CODE/MAT_UID), `WIP_MAT_TRANSACTIONS`(전용 거래원장), `SEQ_WIP_TX` 채번(WTX{YYMMDD}-NNNNN). JSHANES 적용 완료. 엔티티 `wip-mat-stock.entity.ts`/`wip-mat-transaction.entity.ts`, 서비스 `WipMatStockService`(addStockInTx/deductStockInTx/restoreInTx/findByEquip).
  - 흐름: 출고=원자재 MAT_STOCKS 차감+STOCK_TRANSACTIONS `WIP_MOVE` / WIP_MAT_STOCKS 가산+WIP_MAT_TRANSACTIONS `WIP_IN`. 소비(생산실적 완료, auto-issue)=WIP_MAT_STOCKS 차감 `PROD_CONSUME`. 취소 모두 대칭(`WIP_MOVE_CANCEL`/`WIP_IN_CANCEL`/`PROD_CONSUME_CANCEL`). auto-issue 이중차감 방지(원자재 미접근), 설비 미배정 시 MAT_OUT fallback.
  - 거래유형 공통코드 `WIP_MOVE`/`WIP_MOVE_CANCEL` 신규(기존 TRANSFER=창고이동과 구분). i18n 4종 라벨.
  - 화면: `production/wip-material-stock`(설비별 공정재고 조회) + API `GET /inventory/wip-mat-stocks`. 자재재고 화면은 원자재 전용 복귀. **메뉴 DB 시드는 보류(codex 메뉴 작업 충돌 회피) — 추후 MENU_CATEGORY_ITEMS 반영 필요.**
  - 롤백: 창고경유(WAREHOUSES.EQUIP_CODE는 잔류 허용, getOrCreateEquipWipWarehouse 헬퍼·WIP창고46행 시드 제거).
  - 검증: backend/frontend tsc 0, 핵심 jest 63 passed, **JSHANES 실DB E2E(출고이동→이동취소) 4테이블 정합 확인**(WO2606150066/EQ-ATCNS-01/CBL-A). 생산실적 소비는 단위테스트 커버+화면 검증 권장(키오스크 흐름).
  - 설계/계획: `docs/superpowers/specs/2026-06-16-wip-mat-stock-separate-table-design.md`, `docs/superpowers/plans/2026-06-16-wip-mat-stock-separate-table-plan.md`. 잔재: WIP_MAT_STOCKS에 EQ-ATCNS-01/CBL-A qty=0 1행(취소 이력, 무해). 폐기 시드파일 `2026-06-16_equip_wip_warehouse_seed.sql` 잔류(적용분 롤백됨).

- T-MENU-MERGE-MATERIAL 완료(미커밋): 좌측 메뉴 `자재수불관리(MATERIAL)`+`자재재고관리(INVENTORY)` 2개를 `자재관리`(MATERIAL, 라벨 `menu.materialMgmt`) 하나로 통합.
  - menuConfig.ts: INVENTORY 블록 제거, MATERIAL 블록에 INVENTORY 7개 leaf 병합 + labelKey→menu.materialMgmt, Warehouse import 제거.
  - i18n 4종 `menu.materialMgmt` add-only(자재관리/Material Management/物料管理/Quản lý vật tư). 시드 재생성(카테고리 20→19).
  - Live DB(JSHANES 40/1000): 운영 커스터마이징 보존 위해 시드 덮어쓰기 대신 마이그레이션만 적용 — INVENTORY 항목 MATERIAL로 이관(+200), MATERIAL 16→23항목, INVENTORY 카테고리 삭제, 고아 0. `apps/backend/src/migrations/2026-06-16_merge_material_inventory_menu.sql`.
  - RBAC(ROLE_MENU_PERMISSIONS)는 leaf 코드만 저장 → 권한 영향 없음. 프론트 tsc 통과.
  - 참고: 사이드바 런타임 소스는 DB `/menu-categories/tree`(menuConfig는 leaf 매핑+폴백). 화면 반영은 새로고침 시.

- T-EQUIP-INSPECT-TABLE-RESTRUCTURE 완료: 두 테이블 역할이 뒤바뀐 설계 오류를 전면 교정.
  - `EQUIP_INSPECT_ITEM_MASTERS` = 설비유형별 기준 템플릿 (PK: COMPANY+PLANT_CD+ITEM_CODE, EQUIP_TYPE 보유)
  - `EQUIP_INSPECT_ITEM_POOL` = 설비+항목 연결 테이블 (PK: COMPANY+PLANT_CD+EQUIP_CODE+ITEM_CODE+INSPECT_TYPE, 린)
  - 엔티티 파일명은 그대로, 클래스명/데코레이터만 스왑 (파일 `equip-inspect-item-pool.entity.ts` → class `EquipInspectItemMaster`, 반대도 동일)
  - equipment 모듈 서비스: POOL inject + MASTERS JOIN(`fetchItemsWithDetails` 헬퍼), item.seq → item.itemCode
  - 백엔드·프론트 tsc --noEmit 통과. 미커밋.

- T-KIOSK-FLOW-FIX: 키오스크 단절 3건+연쇄버그 수정 완료. 백엔드 재시작 완료(로컬 3003). 미커밋.

## Completed

- T-PALLET-SCREEN-FIX, T-PDA-API-UNIFY, T-SHIP-CROSSBOX-GUARD, T-PDA-RECEIVE-WORKER-GUARD 등 다수 완료.

## In Progress / Watch

- 없음. LOCKS 비어 있음.
- 주의: 탭 비영속(localStorage `harness-tabs` 미사용). 알림 벨은 Header에서 주석 처리됨.
- 엔티티 파일명과 클래스명이 반대로 매핑된 상태 유지 중 — 이후 파일명 정리 필요하면 별도 작업.

## Next AI Should

1. Read `AGENTS.md`.
2. Read `.ai-coordination/README.md`, `STATE.md`, `TASKS.md`, `DECISIONS.md`, and `LOCKS.md`.
3. Read `PROTOCOL.md` for conflicts, stale locks, broad changes, DB changes, or review handoff.
4. Claim files in `LOCKS.md` before editing.
5. Keep `TASKS.md` active-work-only.
6. Update `JOURNAL.md` and its own handoff file before stopping.
