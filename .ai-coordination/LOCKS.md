# LOCKS

Before editing, add a lock entry. Remove or mark it released when done.

## Active Locks

- T-PROD-ISSUE-STOCK-ENDPOINT (codex, 2026-06-10): 제품출고 재고조회 API 경로 404 수정.
  파일: apps/frontend/src/app/(authenticated)/product/issue/components/IssueFormPanel.tsx, apps/frontend/src/app/(authenticated)/product/issue/components/issue-endpoint.structure.test.mjs
  상태: IN_PROGRESS
  notes: 프론트가 `/inventory/product/stock` 단수 호출, 백엔드는 `/inventory/product/stocks` 복수 route.

- T-KIOSK-DEFECT-DOUBLE-COUNT (claude, 2026-06-10): 입력키오스크 불량입력 defectQty 이중 카운트 수정 + quality/defect 화면 전면 정합화.
  파일: apps/backend/src/modules/production/dto/prod-result.dto.ts, apps/backend/src/modules/production/services/prod-result.service.ts(+spec), apps/frontend/src/app/(authenticated)/production/input-kiosk/components/ProductionInputBar.tsx, apps/backend/src/modules/quality/defects/{dto/defect-log.dto.ts,services/defect-log.service.ts(+spec),defects.module.ts}, apps/frontend/src/app/(authenticated)/quality/defect/page.tsx, apps/frontend/src/locales/*
  상태: REVIEW
  notes: (A)kiosk 이중카운트=prod-results 집계 defectQty + 별도 /quality/defect-logs(증가 부작용) → 2배. 수정=불량 상세를 prod-result 생성 트랜잭션에 포함(CreateProdResultDto.defects, occurAt+seq1..N), defectQty 상세합계 1회 산정, 별도 호출 제거. (B)quality/defect 전면 정합화: 등록은 제품바코드 스캔 우선→생산실적 자동해석[prdUid 직접매칭 → FG_LABELS.fgBarcode→orderNo→최신 생산실적 폴백(FG_BARCODE_ISSUE_TIMING=ON_INSPECT라 prdUid≠fgBarcode 확인) → workOrderNo → prodResultNo], 상태 DEFECT_LOG_STATUS(WAIT/REPAIR/REWORK/SCRAP/DONE)+PATCH+복합식별자(occurAtISO|seq), 목록 생산실적 보강(작업지시/작업자/설비, N+1 batch), 에러 toast. standalone create 증가로직 유지. RED→GREEN, defect-log spec 37 + prod-result 18, 백 tsc 0, 프론트 tsc 0(내 파일). 실측: GET /quality/defect-logs 200+enrichment 확인, PATCH 상태변경 복합식별자 URL 라운드트립(WAIT→REPAIR→WAIT 원복) 확인. 등록 POST는 자재차감 부수효과로 미실행(단위검증+해석 데이터모델 실측 대체).

- T-INV-STOCK-TABS (claude, 2026-06-10): 재고/생산계획 조회화면 일괄 개선.
  파일: apps/frontend/src/app/(authenticated)/inventory/{material-stock,transaction,material-physical-inv,material-physical-inv-apply}/*, apps/frontend/src/app/(authenticated)/production/monthly-plan/*, apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts, apps/backend/src/seeds/menu-config.json, apps/frontend/src/config/menuConfig.ts, apps/backend/src/migrations/2026-06-10_mat_physical_inv_apply_menu_seed.sql, apps/frontend/src/locales/*
  상태: REVIEW
  notes: (1)material-stock 정보카드 제거+시리얼별상세/품목별그룹합계 2탭 (2)transaction 취소기능 제거+시리얼 검색추가(client-side contains, 백엔드 무변경—SQL 컬럼함수검색 금지 규칙 준수) (3)실사 등록/반영 페이지 분리+신규 메뉴 INV_MAT_PHYSICAL_INV_APPLY(JSHANES 시드 sort35/MANAGER) (4)monthly-plan 양식다운로드+ERP인터페이스(준비중) 버튼. 백/프론트 tsc·focused jest 통과.

- T-MAT-CONCESSION-RECV (claude, 2026-06-10): 특채처리 신규화면 + 자재입고 창고선택/PDA 통일.
  파일: apps/backend/src/entities/mat-lot.entity.ts, apps/backend/src/modules/material/{receiving/*,controllers/concession*,services/concession*,dto/concession*,services/receiving.service.ts}, apps/frontend/src/app/(authenticated)/material/{concession,receive}/*, apps/frontend/src/config/menuConfig.ts, apps/frontend/src/locales/*, apps/backend/src/migrations/2026-06-10_mat_lot_special_accept.sql
  상태: IN_PROGRESS
  notes: MAT_LOTS.SPECIAL_ACCEPT_YN 추가(특채여부). 특채 LOT은 불용창고→양품창고 입고. 입고 창고선택+기본창고. inventory 모듈은 read-only(/inventory/warehouses).

- T-WORKFLOW-DOCS (claude, 2026-06-10): 전체 도메인 workflow 문서 9종 작성 완료.
  파일: docs/workflows/{material,production,quality,shipping,equipment,master,system}/*.md
  상태: COMPLETED

- T-MAT-RECV-FIXES (claude, 2026-06-07): 자재입고 프로세스 이슈 일괄 수정.
  완료(검증): #1 PO오류(http-exception.filter/purchase-order.dto/PoFormPanel), #2 배지(globals.css safelist), 작업지시 품목필터(part.dto/part.service/PartSearchModal/JobOrderFormPanel), IQC006 입하실적조회 전체(arrival.controller/service/dto, material/arrival-result/*, menuConfig, PartnerSelect/useMasterOptions, 2026-06-07_iqc006_arrival_result_seed.sql, locales 4).
  잔여(미착수): 라인→공정설비 지정.

## History

- T-PROD-RECEIVE-REMOVE-SELECTED (claude, 2026-06-10): 제품입고 `/product/receive` 선택입고(Method A, BoxReceiveList) 제거. 좌측 체크선택 일괄입고 패널 삭제→이력 그리드 전체폭, useReceiveCandidates 제거(BoxScanModal은 receiveBoxes/ReceiveCandidate만 사용), 사용처 없어진 boxList.title/count/empty 4개 언어 정리. 스캔입고/개별입고 무변경. 프론트 tsc 0·JSON 4파일 유효·잔여참조 0 확인 후 lock 해제.

- T-PROD-RESULT-WORKER-AVATAR-FIX (codex, 2026-06-10): `/production/result`에서 작업자명 없는 행이 `WorkerAvatar name.charAt(0)`로 런타임 오류를 내던 문제 수정. 공통 아바타 fallback 유틸 추가, 생산실적 행의 `worker` relation/`workerId` fallback 평탄화. RED 확인 후 node:test 2건, 프론트 tsc, HTTP 200, diff check 통과 후 lock 해제.

- T-PROD-PROGRESS-EQUIP-FILTER (codex, 2026-06-10): `/production/progress`에 설비 필터 추가. 화면 `EquipSelect` → `/production/job-orders?equipCode=` 전달, 백엔드는 `PROD_RESULTS` 존재 조건으로 작업지시 필터링. RED 확인 후 focused Jest 36건·백/프론트 tsc·HTTP 200·diff check 통과 후 lock 해제.

- T-PROD-ORDER-REMOVE-INFO-CARDS (codex, 2026-06-10): `/production/order` 상단 정보카드 4개 제거. `StatCard` import와 stats 계산 정리. 프론트 tsc·HTTP 200·diff check 통과 후 lock 해제.

- T-ID-PAYLOAD-SCAN (codex, 2026-06-10): `/material/hold`와 같은 `.id` payload 누락 유형을 전수 점검해 제품보류, 고객PO, 설비, PO입하, 외주처, 인터페이스 로그, OQC, 자재/제품 수불, 팔레트 목록 응답에 화면용 `id`를 보강. focused Jest 156건, backend/frontend tsc, diff check 통과 후 lock 해제.

- T-MAT-HOLD-MATUID-FIX (codex, 2026-06-10): `/material/hold` 보류/해제 POST 본문이 `selectedLot.id`를 사용해 `matUid`가 누락되던 결함 수정. `selectedLot.matUid` 전송으로 변경, 프론트 tsc·diff check 통과 후 lock 해제.

- T-SHIP-WORKFLOW-API-QA (codex, 2026-06-10): 박스포장→제품입고재고→출하지시→출하처리 API 흐름 점검. 현재 코드 기준 집계 재고(`prdUid='*'`)와 FG 라벨 상태 흐름 일치 확인, 테스트 보강, focused Jest 57건·backend tsc·diff check 통과. JSHANES/HTTP는 10.1.10.35:1527 타임아웃으로 미실행 후 lock 해제.

- T-MASTER-API-DEEP-QA-FIX (codex, 2026-06-10): 기준정보 API 미통과 3건 수정 완료. 회사/사업장 생성 tenant 저장 누락과 IQC 검사그룹 수정/삭제 자식행 처리 결함 보정. focused Jest 26건, backend tsc, 실제 HTTP 11건, JSHANES 잔여 0 확인 후 lock 해제.

- T-PROD-WORKFLOW-DOC (claude, 2026-06-10): 생산관리 workflow 문서 작성 완료. docs/workflows/production/wf-production.md 15개 화면(월간계획, 시뮬레이션, 작업지시, 생산실적, 진도, 수동투입, 입력키오스크, 설비투입, 투입검사, 설비점검, 실적집계, WIP재고, 재작업, 재작업이력, 수리) 포함. 실제 구현 기준으로 API/DTO/엔티티/프론트 반영.

- T-MASTER-API-DEEP-QA (codex, 2026-06-10): 기준정보 API 세부 재검증. 조회/보조 GET 49건 통과, CRUD/업로드/JSHANES 잔여 0 확인. 미통과 결함 3건(회사 생성 500, 사업장 생성 500, IQC 검사그룹 수정 500) 확인 후 lock 해제.

- T-PROD-INPUT-PRDUID-FIX (claude, 2026-06-10): 생산실적 입력화면 4종(input-machine/equip/inspect/manual) POST 본문 matUid→prdUid 수정(키오스크와 동일). input-equip는 measuredValue도 비허용 → 측정값을 비고에 보존하도록 변경(저장 컬럼 없음). whitelist 계약 probe(404 작업지시 도달) + 프론트 tsc 0 확인 후 lock 해제.

- T-PROD-RESULT-WORKER-VALIDATION (claude, 2026-06-10): 생산실적 생성 작업자 검증을 USERS.email→WorkerMaster.workerCode 우선(+email 폴백)으로 비회귀 수정. 입력화면들이 보내는 workerCode(W010)로 항상 404 차단되던 키오스크 실적저장 해소. jest 17/17·backend tsc 0·재현 POST 201 확인, 부수로 HNS01 BOM 누락 5종 MAT_LOTS 시딩 후 lock 해제.

- T-MASTER-API-QA (codex, 2026-06-10): 기준정보 API 전체 HTTP 검증. 조회 GET 39건+상세/보조 GET 34건 200, 임시코드 핵심 CRUD 통과, JSHANES 임시 데이터 잔여 0건 확인 후 lock 해제.

- T-INPUT-KIOSK-WORKER-CODE-BUTTONS (codex, 2026-06-10): 작업자설비점검 모달에 점검항목코드와 QR 값을 표시하고 OK/NG 버튼을 QR 스캔 전에도 상시 표시. 항목 렌더 완료 후 QR 입력 포커스 재보정. 프론트 tsc, git diff check, 브라우저 확인 후 lock 해제.

- T-INPUT-KIOSK-WORKER-QR-FOCUS (codex, 2026-06-10): 작업자설비점검 모달 QR 입력창 자동 포커스/포커스 유지, 설비일일점검 완료 상세 표시, 모든 사용 설비 DAILY 표준항목 할당 seed 추가 및 JSHANES 적용. 프론트 tsc, backend focused Jest, git diff check, 브라우저 QR 포커스/완료상세 검증 후 lock 해제.

- T-DOCS-CLEANUP (claude, 2026-06-10): docs/ 아래 불필요/오래된 문서 정리. tenant gap reports 7개(2026-04-12 생성, 내용 outdated), docs/tools/*.js scripts 3개(미사용) 삭제. docs/readme.md 참조 목록 갱신.

- T-EQUIP-INSPECT-WORKER-ASSIGN-SEED (codex, 2026-06-09): 모든 사용 설비 8대에 WORKER 표준 점검항목 8건씩 총 64건 할당 seed 추가 및 JSHANES 적용. 설비별 API와 입력키오스크 모달 표시 확인 후 lock 해제.

- T-INPUT-KIOSK-WORKER-QR-SIMPLE (codex, 2026-06-09): `/production/input-kiosk` 작업자설비점검 QR 입력 처리를 스캐너 키보드 입력값 기준으로 단순화. 입력값과 `WORKER_QR_CODE` 직접 비교, 프론트 tsc/diff check 통과 후 lock 해제.

- T-INPUT-KIOSK-WORKER-INSPECT-QR (codex, 2026-06-09): `/production/input-kiosk` 작업자설비점검 QR 스캔 행 포커싱/OK-NG 저장 흐름 수정. WORKER 저장 타입 보존, QR 후보 매칭, 설비별 항목 QR 필드 보존. backend focused Jest, 백/프론트 tsc, diff check, HTTP 200 확인 후 lock 해제.

- T-EQUIP-INSPECT-WORKER-SEED (codex, 2026-06-09): `EQUIP_INSPECT_ITEM_POOL` 작업자설비점검 표준 seed 8건 추가. JSHANES 적용·재실행, 유형별 건수/항목 조회, `/master/equip-inspect` HTTP 200 확인 후 lock 해제.

- T-EQUIP-INSPECT-ADD-MODAL-TYPE (codex, 2026-06-09): `/master/equip-inspect` 점검항목추가 모달 상단에 점검유형 드롭다운을 선노출하고 선택 유형으로 Pool 항목을 필터링. node:test, 프론트 tsc, 라우트 HTTP 200 확인 후 lock 해제.

- T-EQUIP-INSPECT-WORKER-TYPE (codex, 2026-06-09): `/master/equip-inspect`에 점검항목 마스터 탭을 실제 노출해 `WORKER=작업자설비점검` 유형 등록/필터 접근 가능하게 보정. node:test, 프론트 tsc, 라우트 HTTP 200 확인 후 lock 해제.

- T-EQUIP-INSPECT-ADD-TYPE (codex, 2026-06-09): `/master/equip-inspect` 점검항목 추가 모달에서 점검유형 Select 선택 가능하게 변경. 생성 API가 Pool 기본값보다 요청 `inspectType`을 우선 반영하도록 수정. 백/프론트 tsc와 라우트 HTTP 200 확인 후 lock 해제.

- T-ITEM-MARKING-TEXT (codex, 2026-06-09): `ITEM_MASTERS.MARKING_TEXT VARCHAR2(100)` 추가, JSHANES 적용, 품목마스터 엔티티/DTO/서비스/프론트 목록·폼 반영, ERD 갱신, 백/프론트 tsc와 라우트 HTTP 200 확인 후 lock 해제.

- T-MAT-RECEIVE-SCAN (codex, 2026-06-09): `/material/receive`를 거래처 바코드/자체부착 바코드 순환 스캔 입고 전용으로 변경. `MAT_RECEIVINGS.VENDOR_BARCODE` JSHANES 적용, ERD 갱신, receiving 테스트/백·프론트 tsc/라우트 HTTP 200 확인 후 lock 해제.

- T-INPUT-KIOSK-EQUIP-LIST (codex, 2026-06-09): `/production/input-kiosk` 설비선택 모달 기본목록 표시 보정. `/equipment/equips` paged/items 응답을 설비 선택 배열로 정규화. node:test, 프론트 tsc, 라우트 HTTP 200 확인 후 lock 해제.

- T-INPUT-KIOSK-REMOVE-MASTER-SAMPLE (codex, 2026-06-09): `/production/input-kiosk` 헤더의 마스터샘플 판정 카드와 kiosk 전용 번역 키 제거. 프론트 tsc, 참조 검색, 라우트 HTTP 200 확인 후 lock 해제.

- T-MAT-RECEIVE-REMOVE-INFO-CARDS (codex, 2026-06-09): `/material/receive` 상단 정보카드 4개 제거. 통계 조회 API 호출과 관련 import/state 정리. 프론트 tsc와 라우트 HTTP 200 확인 후 lock 해제.

- T-SHIP-BOX-STOCK-STATUS-UI (codex, 2026-06-09): `/shipping/box-stock` 상태 드롭다운과 상태별 통계 제거. 재고 조회 목적에 맞게 박스 수/총 수량/품목 수/선택 박스수량 통계로 변경. 프론트 tsc와 라우트 HTTP 200 확인 후 lock 해제.

- T-SHIP-BOX-STOCK-MENU (codex, 2026-06-09): `SHIP_BOX_STOCK` 메뉴 노출 보정. validator/seed 등록, JSHANES `MENU_CATEGORY_ITEMS` SHIPPING sort 25 배치, `ROLE_MENU_PERMISSIONS` MANAGER 권한 추가. DB 조회와 tsc 검증 후 lock 해제.

- T-SHIP-PACK-REMOVE-INFO-CARDS (codex, 2026-06-09): `/shipping/pack` 상단 정보카드 4개 제거. 기존 시리얼 스캔/즉시취소 변경 보존. 프론트 tsc와 헤드리스 브라우저 mock 확인 후 lock 해제.

- T-SHIP-BOX-STOCK (codex, 2026-06-09): 출하관리 `/shipping/box-stock` 박스입고재고 조회 화면 추가. `/shipping/boxes/:id/items`로 박스 내 `FG_LABELS` 개별제품 상세 조회. 백엔드/프론트 tsc와 라우트 HTTP 200 확인 후 lock 해제.

- T-SHIP-ORDER-REMOVE-INFO-CARDS (codex, 2026-06-09): `/shipping/order` 상단 정보카드 4개 제거. 기존 `/shipping/orders` API 경로 변경은 보존. 프론트 tsc와 헤드리스 브라우저 mock 확인 후 lock 해제.

- T-SHIP-PACK-SCAN-ENTER-CANCEL (codex, 2026-06-09): `/shipping/pack` 시리얼 입력에서 스캐너 Enter/CR/LF 자동등록과 방금 등록 시리얼 즉시취소 UI 추가. 프론트 tsc와 헤드리스 브라우저 mock 확인 후 lock 해제.

- T-SHIP-PACK-SERIAL-FOCUS (codex, 2026-06-09): `/shipping/pack` 시리얼 추가 모달에 열림/스캔 후 입력 포커스 유지 적용, 모달 크기 `2xl`로 확대. 프론트 tsc와 헤드리스 브라우저 mock 검증 후 lock 해제.

- T-QUALITY-REWORK-DEFECT-RELATION (codex, 2026-06-08): `/quality/reworks` 500 원인인 존재하지 않는 `defectLog` TypeORM relation join/load 제거. 회귀 테스트·백엔드 tsc·실 API 확인 후 lock 해제.

- T-MAT-REQ-DETAIL (codex, 2026-06-08): `/material/request` 출고요청 목록에 행 클릭/상세보기 버튼 기반 상세 모달 추가. 요청 헤더, 상태, 수량 합계, 품목별 BOM소요/기불출/현장재고 표시. 프론트 tsc·브라우저 확인 후 lock 해제.

- T-INPUT-KIOSK-CONSUMABLE-COUNT (codex, 2026-06-08): 입력키오스크 소모품 수명 카운트 API 응답의 `expectedLife`를 `maxCount`로 정규화하고 숫자 fallback을 적용해 `toLocaleString()` runtime 오류 수정. 프론트 build·API·브라우저 확인 후 lock 해제.

- T-MAT-REQ-BOM-AUTO (codex, 2026-06-08): 자재출고요청 작업지시 선택 시 BOM 직하위 원자재 기준 자동 요청품목 생성/저장 완료. 테스트·빌드·API/DB 검증 후 lock 해제.

- T-MAT-ARRIVAL-LABEL-FORMAT (codex, 2026-06-08): 입하시 발행 라벨을 80mm x 40mm 형식으로 변경. 좌측 QR, 품번/수량/단위, 제조사, IN/SERIAL/LOT, 품명, 우측 검사필 도장 영역 적용. 라벨 발행 저장 결함(currentQty, 로그 tenant/PK, uidList payload) 수정. 프론트/백엔드 tsc 및 헤드리스 실제 발행 5장 확인 통과.

- T-ROUTING-PROCESS-TYPE-SOURCE (codex, 2026-06-08): 라우팅 공정 추가 모달에서 공정유형 선택/저장 제거. 공정유형은 공정 마스터 값으로 표시만 한다. 프론트 tsc 및 브라우저 모달 확인 통과.

- T-IQC006-GROUP (claude, 2026-06-08): IQC006 입하실적조회 좌측을 입하번호+PO+품번 그룹 단위로 집계(시리얼당 1행 펼침 → 그룹1행+우측 시리얼). listArrivalResults GROUP BY 재작성, count/status 식 그룹키+origin필터 유지, getArrivalSerials/cancel/manufacturer를 seq→itemCode 그룹키로 이전(컨트롤러 경로/DTO 포함). 실DB 검증: R26060700001 10행→1행(입하수량2000/시리얼10), 상태 분포 정상(RECEIVED 입고건 cancelable=false). tsc 백/프론트 통과. 파일: arrival.service/controller/dto, arrival-result/page.tsx.

- T-IQC-SAMPLE-BARCODE (claude, 2026-06-08): IQC 검사결과 등록에 시료 바코드(입력/스캔) 필드 추가. IqcLog.sampleBarcode + IQC_LOGS.SAMPLE_BARCODE 컬럼(2026-06-08_iqc_log_sample_barcode.sql, 실DB 적용), CreateArrivalIqcResultDto.sampleBarcode, createArrivalResult 저장, IqcModal 입력필드(ScanLine), useIqcData 전달, i18n 4파일. tsc 통과. end-to-end는 pending 입하 0건이라 미검증(코드·DB·타입 일관 확인).

- T-MAT-RECEIVE-TESTDATA (codex, 2026-06-08): 자재입고 화면 테스트 대상 실DB 데이터 3건 생성 완료. `RECV-TEST-260608-00003/00004/00005`, 입하번호 `RCVT26060800003`, 창고 `WH-MAT-A`.

- T-MAT-CYCLE-E2E-FIX (codex, 2026-06-08): PO-입하-IQC-입고-출고-재고 QA 결함 수정 완료. 자재입고 warehouseCode/warehouseId 호환, IQC 성적서 업로드 UI, 날짜 표시/필터, 수동출고 row id, 재고 matUid 검색을 보정하고 lock 해제.

- T-MAT-CYCLE-E2E-QA (codex, 2026-06-08): PO-입하-IQC-입고-출고-재고 실데이터 헤드리스 브라우저 QA 완료. 구현 파일 수정 없음. 결함 5건 기록: IQC 성적서 업로드 UI 부재, 자재입고 warehouseCode/warehouseId 계약 불일치, 입고/입하 일자 UTC 표시, 수동출고 체크박스 시각 상태 불일치, 자재재고 검색 matUid 미포함.

- T-LOT-SPLIT-MERGE (claude, 2026-06-08): #4·5·6 자재분할/병합 재설계 구현·검증 완료. 분할=원본 폐기(SPLIT)→신규 2조각 발번(#4 currentQty 누락 해소), 병합=원 시리얼 폐기(MERGED)→통합 1개 발번(바코드 스캔). 입고완료 게이팅(RECEIVE+LOT_SPLIT_IN+LOT_MERGE_IN, 재가공 허용). 채번 NumberingService(nextMatSerial/STOCK_TX). 회귀수정: IQC006 카운트 origin 필터(분할/병합 파생 제외), MAT_LOT_STATUS 공통코드 SPLIT/MERGED 추가. tsc(백/프론트)·jest 16건·API 풀사이클·실DB 검증 통과, 테스트 데이터 원상복구. 파일: lot-split/lot-merge service+dto, lot-merge.controller, arrival.service, lot-split/lot-merge page.tsx, locales 4, 2026-06-08_mat_lot_status_split_merged.sql.

- T-AUDIT-COLUMN-DEFAULT-FIX (claude, 2026-06-04): 감사 컬럼(CREATED_AT/UPDATED_AT) NOT NULL & DEFAULT 누락 33개 테이블/64개 컬럼에 `DEFAULT SYSTIMESTAMP` 일괄 보정(`apps/backend/src/migrations/2026-06-04_fix_audit_column_defaults.sql`). `scripts/gen-live-schema.py`로 `create-hanes-schema.sql`을 실DB 실측 재생성(148 테이블). JSHANES 적용·검증 완료.

- T-BOM-LABEL-CLARIFY (codex, 2026-06-02): BOM 화면 컬럼 라벨을 `유형`→`품목유형`, `공정`→`투입공정`으로 명확화하고 i18n 4개 파일 반영 완료.

- T-ITEM-TYPE-COMCODE-UNIFY (codex, 2026-06-02): `ITEM_MASTERS.ITEM_TYPE` 공통코드 기준을 `ITEM_TYPE`으로 통일하고 JSHANES 컬럼 주석, `PART_TYPE` 활성 코드, 런타임 화면/Swagger/shared 상수, schema SQL/생성 스크립트/ERD 문서 정리 완료.

- T-BOM-PRODUCT-TYPE-SEMANTIC-FIX (codex, 2026-06-02): `PRODUCT_TYPE`을 `2011/2012/2013/2014` 단계 코드에서 `HARNESS/SUB_ASSY/WIRE/TERMINAL/...` 품목군 코드로 재정의하고 JSHANES 데이터, DTO 검증, 프론트 옵션, 재실행 SQL 정정 완료.

- T-BOM-PRODUCT-TYPE-CLEANUP (codex, 2026-06-02): JSHANES `ITEM_MASTERS.PRODUCT_TYPE`를 화면 제품유형 코드 `2011/2012/2013/2014`로 정렬하고 백엔드 DTO 검증 상수 추가 완료.

- T-BOM-PROD-SHEET-SEED (codex, 2026-06-02): `bom-from-production-sheet.html` 기준으로 JSHANES `40/1000`의 BOM/품목/공정/라우팅 기준정보를 삭제 후 재생성 완료. SQL: `tools/generated/bom-from-production-sheet-seed.sql`.

- T-MASTER-ALL-DB-KEY-AUDIT (codex, 2026-05-30): 기준정보 전체 DB 키/테이블명 정합성 정리 완료. `bom`, `label`, `iqc-item`, `part` IQC 설정, `vendor-barcode`, `work-instruction`, SQL 표시 테이블명 정리, 프론트 tsc 및 핵심 API 조회 통과.

- T-MASTER-DB-KEY-CLEANUP (codex, 2026-05-30): 기준정보 회사/사업장 화면의 임의 `id` 의존 제거. `COMPANY_MASTERS` 복합키 기준 호출로 정리, 프론트 tsc 통과.

- T-DB-TYPEORM-SCHEMA-AUDIT (codex, 2026-05-30): MYDBPDB/HNSMES 기준 TypeORM-vs-Oracle 스키마 비교 완료. 마이그레이션 적용, 엔티티 정렬, ERD/감사 문서 갱신, `compare_typeorm_oracle_schema.py` issues 0, 백엔드 tsc 통과.

- T-IQC-ARRIVAL-UNIT (claude, 2026-05-29): IQC 검사 단위를 개별 시리얼 전수검사 → 입하번호+품목 단위 샘플검사로 재설계. 백엔드 GET pending-arrivals / POST arrival 신설, cancel 입하단위 분기 보강, 프론트 목록·모달 전환, i18n 4파일. 백엔드·프론트 빌드 통과.

- T-SQL-QUERY-PROPS (claude, 2026-05-28): DataGrid sqlQuery prop 26개 페이지 일괄 추가 완료
