# ARCHIVE

Completed tasks are compacted here to save context. Keep each item to one line.

Format:

```md
- T-000 | YYYY-MM-DD | owner | short result | evidence: JOURNAL heading or commit
```

## Completed

- T-CONSUMABLE-LABEL-TEMPLATE-SELECT-PRINT | 2026-06-17 | codex | `/consumables/label` UID 발행 화면에 라벨디자인마스터 `jig` 템플릿 선택 Select를 추가하고 선택 템플릿 `designData`를 `LabelPrintRenderer` 출력에 적용, 실제 브라우저 UID 발행 인쇄 HTML 치환 검증 및 검증 데이터 정리 완료 | evidence: JOURNAL 2026-06-17 10:43 Codex
- T-EQUIP-INSPECT-ITEM-DEPLOY-IMAGE-URL | 2026-06-17 | codex | `/master/equip-inspect-item` 배포 이미지 깨짐 원인을 `/uploads` URL 정규화 누락과 gitignore된 점검항목 SVG 미배포로 확인하고 화면/공용 컴포넌트 URL helper 적용 및 deploy 시드 이미지 재생성 단계 추가 | evidence: JOURNAL 2026-06-17 10:19 Codex
- T-CONSUMABLE-LABEL-DEPLOY-IMAGE-URL | 2026-06-17 | codex | `/consumables/label` 배포 이미지 깨짐 원인을 `/uploads` URL 정규화 누락과 gitignore된 소모품 SVG 미배포로 확인하고 URL helper와 deploy 시드 이미지 재생성 단계 추가 | evidence: JOURNAL 2026-06-17 10:07 Codex
- T-MATERIAL-FLOW-FE-RUNTIME | 2026-06-17 | codex | 자재관리 등록 메뉴 24/24 프론트 QA PASS 및 자재요청 MR2606170035 -> 출고 -> 자재재고 -> 공정재고/키오스크 흐름 JSHANES DB 정합성 확인 | evidence: JOURNAL 2026-06-17 04:12 Codex
- T-SHIPPING-PACK-EMPTY-BOX-DELETE | 2026-06-17 | codex | `/shipping/pack` 빈 OPEN 박스 삭제 버튼 노출, 행 액션 4개 아이콘 슬롯 고정 정렬, 현재 담는 박스 모달/행 강조 추가 및 실제 생성/삭제 검증 | evidence: JOURNAL 2026-06-17 03:30 Codex
- T-MASTER-LABEL-CUSTOM-SOURCE-FIELDS | 2026-06-17 | codex | `/master/label` 좌측 필드 목록을 고정값이 아닌 디자인별 사용자 정의 `sourceFields`로 저장/추가/수정/삭제 가능하게 전환하고 3002 저장 요청 201 및 임시 템플릿 정리 확인 | evidence: JOURNAL 2026-06-17 02:49 Codex
- T-MASTER-LABEL-BARTENDER-DESIGNER | 2026-06-17 | codex | `/master/label` 상단 탭 제거 후 객체 기반 라벨 디자이너(글자/1D/2D/박스/선/원/이미지, 드래그/앵커 리사이즈, 소스필드 매핑 저장)로 전환하고 `/consumables/label` 실제 UID 발행 인쇄 HTML 치환까지 검증 | evidence: JOURNAL 2026-06-17 02:36 Codex
- T-MASTER-LABEL-DESIGN-ONLY | 2026-06-17 | codex | `/master/label` 모든 카테고리를 디자인 제공 전용으로 전환하고 품목 탭/대상조회/선택출력 제거, 소모품 탭명 적용 | evidence: JOURNAL 2026-06-17 01:59 Codex
- T-EQUIPMENT-PERIODIC-DAILY-FLOW | 2026-06-17 | codex | `/equipment/periodic-inspect`를 `/equipment/daily-inspect`와 같은 대상 설비 목록 + 항목별 입력 흐름으로 통일하고 3002 브라우저 선택 검증 완료 | evidence: JOURNAL 2026-06-17 00:09 Codex
- T-EQUIPMENT-INSPECT-CARDS-REMOVE | 2026-06-17 | codex | `/equipment/inspect-history`, `/equipment/periodic-inspect` 상단 정보카드 제거 및 3002 브라우저 미표시 확인 | evidence: JOURNAL 2026-06-17 00:08 Codex
- T-CONSUMABLE-LIFE-STATUS-SHAPE | 2026-06-16 | codex | `/consumables/life` 런타임 `data.filter is not a function` 수정, life-status API를 카운트 객체가 아닌 행 배열 계약으로 보정하고 API/브라우저 확인 완료 | evidence: JOURNAL 2026-06-16 22:48 Codex
- T-CONSUMABLE-LABEL-RESPONSE-FIX | 2026-06-16 | codex | `/consumables/label` 라벨 대상 조회 응답 이중 래핑을 `ResponseUtil.success`로 수정해 API 37건/브라우저 37행 표시 확인 | evidence: JOURNAL 2026-06-16 22:24 Codex
- T-FRONTEND-DELETE-CONFIRM-GUARD | 2026-06-16 | codex | 삭제 버튼 즉시 실행 지점을 공용 `ConfirmModal` 확인 후 삭제로 전환, 이미지 제거/하위항목 삭제/매핑 삭제 포함, 구조 테스트와 FE tsc 통과 | evidence: JOURNAL 2026-06-16 22:21 Codex
- T-CONSUMABLE-MASTER-USAGE-MAP-FIXED | 2026-06-16 | codex | `/consumables/master` 매핑 UI를 편집 패널 내부가 아닌 상시 우측 고정 섹션으로 분리, 선택 소모품 기준 매핑 조회/등록/토글/삭제 유지, FE/BE tsc와 3002 HTTP 확인 | evidence: JOURNAL 2026-06-16 21:52 Codex
- T-KIOSK-JOBORDER-PERSIST-REFRESH | 2026-06-16 | codex | `/production/input-kiosk` 새로고침 후 선택 작업지시가 사라지던 문제 수정, `harness-kiosk` persist에 `selectedJobOrder` 포함, 구조 테스트/FE tsc 통과 | evidence: JOURNAL 2026-06-16 17:50 Codex
- T-BOM-ITEM-TYPE-LABEL-FIX | 2026-06-16 | codex | `/master/bom` 품목유형 원 코드 노출 수정. BOM은 `ITEM_MASTERS.ITEM_TYPE`을 사용하며 프론트 표시만 `comCode.ITEM_TYPE` 한글 라벨로 통일, 구조 테스트/FE tsc/API/Oracle/브라우저 실측 통과 | evidence: JOURNAL 2026-06-16 17:30 Codex
- T-MAT-ARRIVAL-TRANSACTION-MENU | 2026-06-16 | codex | `MAT_ARRIVAL_TRANSACTION`을 `MATERIAL` 카테고리 sort 45로 등록, menuConfig/i18n/validator/seed/JSHANES 메뉴 DB/권한 동기화, 메뉴 API와 3002 URL 확인 완료 | evidence: JOURNAL 2026-06-16 14:35 Codex
- T-MAT-ARRIVAL-TRANSACTION-PAGE | 2026-06-16 | codex | `/material/arrival-transaction` 입하수불조회 직접 접근 화면 추가, `MAT_ARRIVAL_TRANSACTIONS` 조회 필터(`transType`, `matUid`, `arrivalNo`) 보강, frontend/backend build 및 3002 route 200 확인 | evidence: JOURNAL 2026-06-16 13:55 Codex
- T-MAT-ARRIVAL-STOCK-SPLIT | 2026-06-16 | codex | 입하재고/입고재고 테이블 분리 A안 적용, `MAT_ARRIVAL_STOCKS`/`MAT_ARRIVAL_TRANSACTIONS` 생성 및 기존 `MAT_IN` 57건 이관, JSHANES/빌드/핵심 테스트 검증 완료 | evidence: JOURNAL 2026-06-16 13:10 Codex
- T-MENU-MERGE-MATERIAL | 2026-06-16 | claude | 좌측 메뉴 자재수불관리(MATERIAL)+자재재고관리(INVENTORY) → 자재관리 1개로 통합. menuConfig 병합·i18n 4종 menu.materialMgmt·시드 재생성·Live DB(JSHANES 40/1000) INVENTORY→MATERIAL 이관(16→23항목, 카테고리 삭제), RBAC 영향 없음, 프론트 tsc 통과 | evidence: LOCKS History T-MENU-MERGE-MATERIAL
- T-MULTI-CATEGORY-MENU-PAGE-SCENARIO-QA | 2026-06-16 | codex | 자재재고관리/생산관리/품질관리/검사관리/제품수불관리/설비관리/출하관리 실제 등록 하위 메뉴 50개 상세 QA 완료, 검색 API 계약 2건 보정 후 50/50 PASS | evidence: JOURNAL 2026-06-16 03:00 Codex
- T-MATERIAL-MENU-PAGE-SCENARIO-QA | 2026-06-15 | codex | 좌측 자재수불관리 실제 등록 하위 메뉴 16개 상세 시나리오 QA 완료, 16/16 PASS, 96단계/96스크린샷 목차+페이지별 HTML/JSON 생성 | evidence: JOURNAL 2026-06-16 00:42 Codex
- T-MASTER-REMAINING-PAGE-SCENARIO-QA | 2026-06-15 | codex | 기준정보 잔여 19개 화면 페이지 단위 상세 시나리오 QA 완료, 기존 품목/BOM 포함 기준정보 21개 HTML 보고서와 목차 생성, CRUD 저장 검증 101단계 및 Oracle 잔여 0건 확인 | evidence: JOURNAL 2026-06-15 21:03 Codex
- T-MASTER-BOM-PAGE-SCENARIO-QA | 2026-06-15 | codex | `/master/bom` BOM관리 화면을 페이지 단위 상세 시나리오로 테스트, 조회/검색/폼다운로드/내보내기/신규/중복방어/수정/라우팅패널/삭제/API/DB/재조회 13단계 PASS 및 목차+페이지 HTML 보고서 생성 | evidence: JOURNAL 2026-06-15 20:24 Codex
- T-UI-CRUD-RED-MENU-QA | 2026-06-15 | codex | 좌측 메뉴 노출 화면 96개 실제 브라우저 순회 QA 완료, 최종 96/96 PASS HTML 보고서와 스크린샷 증적 작성 | evidence: JOURNAL 2026-06-15 18:56 Codex
- T-SQL-ACTUAL-GLOBAL | 2026-06-13 | codex | TypeORM 실제 실행 SELECT를 요청 단위로 수집해 모든 `DataGrid.sqlQuery` SQL 모달이 실제 SQL을 우선 표시하도록 전역 적용, COUNT-only 대표 SQL 후순위 처리 및 런타임 API 확인 완료 | evidence: JOURNAL 2026-06-13 22:24 Codex
- T-SQL-SCHEMA-TOGGLE | 2026-06-13 | codex | 공통 SQL 조회문 모달에 `컬럼명세 보기/숨기기` 토글을 추가해 사용자가 요청할 때만 컬럼명세 API 호출 | evidence: JOURNAL 2026-06-13 21:45 Codex
- T-IQC-SQL-DISPLAY | 2026-06-13 | codex | `/material/iqc` SQL 조회문을 백엔드 실제 QueryBuilder SQL/parameters 기반으로 표시 | evidence: JOURNAL 2026-06-13 21:26 Codex
- T-QC-SAMPLE-MENU-LABEL | 2026-06-12 | codex | 품질검사 하위 `QC_SELF_INSPECT_HISTORY` 좌측 메뉴 한글 라벨을 `공정샘풀검사`로 변경, `ko.json` 파싱 검증 통과 | evidence: JOURNAL 2026-06-12 16:17 Codex
- T-MASTER-PART-PAGE-SCENARIO-QA | 2026-06-15 | codex | `/master/part` 품목관리 화면을 페이지 단위 상세 시나리오로 테스트, 조회/검색/신규/수정/삭제/API/DB/재조회 10단계 PASS 및 목차+페이지 HTML 보고서 생성 | evidence: JOURNAL 2026-06-15 19:47 Codex
- T-MENU-QA-DETAIL-REPORT | 2026-06-15 | codex | 좌측 메뉴 QA 최종 PASS HTML을 96개 메뉴별 상세 절차/확인 기준/화면 증적 섹션으로 재생성 | evidence: JOURNAL 2026-06-15 19:08 Codex
- T-MASTER-FE-QA | 2026-06-12 | codex | 기준정보 `/master/*` 프론트엔드 21개 하위 메뉴 실제 접속/검색/추가폼 비파괴 상호작용/캡처 검증, HTML 보고서 작성, 최종 21/21 성공 | evidence: JOURNAL 2026-06-12 12:49 Codex
- T-IQC-SERIAL3-RUNTIME | 2026-06-12 | codex | 수입검사 절차대로 실제 API/JSHANES에서 시리얼 3개 생성, IQC PASS, 검사성적서 업로드, 입고, 재고 반영까지 검증하고 기록 유지 | evidence: JOURNAL 2026-06-12 12:32 Codex
- T-MASTER-CRUD-RUNTIME | 2026-06-12 | codex | 기준정보 화면/API CRUD 101단계 실데이터 점검, payload/cleanup 오류 수정, JSHANES 잔여 0건 확인 및 보고서 작성 | evidence: JOURNAL 2026-06-12 11:49 Codex
- T-EQUIP-INSPECT-HISTORY-BLANK-ROWS | 2026-06-16 | codex | `/equipment/inspect-history` API `{ equip: {} }` 빈 행 응답을 raw alias 명시 매핑으로 수정하고 날짜 표시를 `YYYY-MM-DD`로 정리, API/3002 화면 확인 | evidence: JOURNAL 2026-06-16 23:58 Codex
- T-KIOSK-WI-SEED-HNS02C1ABCD | 2026-06-16 | codex | `/production/input-kiosk` WO2606150060/HNS02C1ABCD 작업지도서 미표시 원인이 WORK_INSTRUCTIONS 데이터 0건임을 확인하고 ATCUT Rev.A 시드 추가, DB/API/브라우저 표시 확인 | evidence: JOURNAL 2026-06-16 23:30 Codex
- T-SYSTEM-LABEL-MENU-RENAME | 2026-06-17 | codex | 시스템관리 하위 `MST_LABEL` 메뉴의 한글 labelKey `menu.master.label`을 `라벨다자인관리`로 변경, JSON 파싱/검색 확인 | evidence: JOURNAL 2026-06-17 01:52 Codex
- T-CONSUMABLE-LABEL-PRINTLOG-PAYLOAD | 2026-06-17 | codex | `/consumables/label` 브라우저 인쇄이력 payload를 `matUids`에서 `uidList`로 수정해 `/material/label-print/log` 400 오류 해소, 실제 브라우저 발행 201 확인 | evidence: JOURNAL 2026-06-17 01:45 Codex
- T-CONSUMABLE-LABEL-IMAGE-PRINTLOG | 2026-06-17 | codex | `/consumables/label` 라벨 발행 그리드에 소모품 사진 컬럼 추가, `LABEL_PRINT_LOGS.PRINTED_AT` null ORA-01400 수정, 실제 API/브라우저 확인 | evidence: JOURNAL 2026-06-17 01:04 Codex
- T-EQUIPMENT-INSPECT-HISTORY-ACTUAL-SQL | 2026-06-17 | codex | `/equipment/inspect-history` SQL 조회문 preview를 실제 `EQUIP_INSPECT_LOGS`/`EQUIP_MASTERS` 기준으로 맞춰 전역 `meta.debugSql` 실제 SQL이 표시되도록 수정, 3002 모달 확인 | evidence: JOURNAL 2026-06-17 00:47 Codex
- T-INTEGRATION-NORMAL-REVERSE | 2026-06-12 | codex | HNS02 정상/역처리 통합 재테스트, 박스 단건 출하 취소 API 추가, 정상 출하/출하 취소/삭제·취소 가능 데이터 검증 및 보고서 작성 | evidence: JOURNAL 2026-06-12 11:25 Codex
- T-INTEGRATION-FLOW-ISSUES-FIX | 2026-06-12 | codex | 최종보고서 등록 문제점 3건 수정, 제품라벨/박스재고/WIP 이동 정상화, JSHANES 재테스트 완료 | evidence: JOURNAL 2026-06-12 11:02 Codex
- T-INTEGRATION-FLOW-REPORT | 2026-06-12 | codex | HNS02 기준 PO부터 출하 처리까지 실제 API/JSHANES DB 통합 테스트 완료, shipBox 시리얼별 제품재고 차감 결함 수정, 보고서 작성 | evidence: JOURNAL 2026-06-12 10:41 Codex
- T-CUSTOMER-INTRO-FLOW-SLIDE | 2026-06-12 | codex | 고객 소개 자료 4페이지에 HANES MES 기능흐름도 추가, PPTX/HTML 24장 검증 완료 | evidence: JOURNAL 2026-06-12 09:45 Codex
- T-KIOSK-AUTOISSUE-BOM-MISMATCH-GUARD | 2026-06-12 | codex | 키오스크 스캔 LOT가 BOM 품목과 불일치하면 실적처리/자동차감 전에 중단하도록 방어 추가 | evidence: JOURNAL 2026-06-12 05:59 Codex
- T-CUSTOMER-INTRO-PPTX-EXPORT | 2026-06-12 | codex | 고객 소개 HTML 23장 기준으로 텍스트/도형 편집 가능한 PPTX 재생성, PowerPoint 렌더 23장 확인 | evidence: JOURNAL 2026-06-12 05:28 Codex
- T-QUALITY-INSPECT-USEMEMO | 2026-06-12 | codex | `/quality/inspect` 외관검사 화면의 누락된 `useMemo` React import를 복원해 런타임 ReferenceError 수정 | evidence: JOURNAL 2026-06-12 04:19 Codex
- T-MASTER-REPORT-SEARCH-DUPLICATE-FIX | 2026-06-15 | codex | 기준정보 잔여 19개 페이지 `HNS02` 검색어 하드코딩 제거 및 공통 중복방어 단계/증적 추가, CRUD 134/134 PASS | evidence: JOURNAL 2026-06-15 23:22 Codex
- T-MASTER-EQUIP-REPORT-EVIDENCE-FIX | 2026-06-15 | codex | `/master/equip` QA 보고서의 STEP 05 캡처/캡션 정합성 보정 및 기준정보 잔여 19개 화면 재생성 PASS | evidence: JOURNAL 2026-06-15 22:31 Codex
- T-INV-TRANSACTION-CARDS | 2026-06-12 | codex | `/inventory/transaction` 재고수불현황 상단 정보카드 3개와 전용 통계 계산 제거 | evidence: JOURNAL 2026-06-12 02:20 Codex
- T-KIOSK-EQUIP-INSPECT-MIGRATION-RERUN | 2026-06-16 | codex | 점검이력 마이그레이션 파일을 oracle_connector.py --execute-file 재실행 가능한 idempotent PL/SQL 블록으로 보정하고 JSHANES 재실행 성공 확인 | evidence: JOURNAL 2026-06-16 16:15 Codex
- T-KIOSK-EQUIP-INSPECT-WORKDAY-ORDER | 2026-06-16 | codex | 설비일일점검을 기존 생산월력/교대패턴 조업일 기준으로, 작업자설비점검을 작업지시별 이력 기준으로 전환하고 JSHANES 스키마 적용 | evidence: JOURNAL 2026-06-16 15:45 Codex
- T-CUSTOMER-INTRO-HTML-DESIGN | 2026-06-12 | codex | 고객 소개 HTML의 카드형 AI 느낌을 줄이고 산업형 색상/공정 보드 레이아웃으로 재정리 | evidence: JOURNAL 2026-06-12 01:35 Codex
- T-CUSTOMER-INTRO-HTML-V2 | 2026-06-12 | codex | 작업지시서 기준 고객 소개 HTML을 22장 가로형 슬라이드로 재구성, PPTX는 후속 단계로 보류 | evidence: JOURNAL 2026-06-12 01:21 Codex
- T-EQUIP-INSPECT-POOL-TYPE | 2026-06-11 | claude | 점검항목 풀(EQUIP_INSPECT_ITEM_POOL)에 EQUIP_TYPE 추가, 점검항목 마스터 페이지를 설비유형 기준 POOL 편집기로 전환, 설비점검 추가 모달이 설비유형으로 풀 조회 | evidence: JOURNAL 2026-06-11 22:* Claude
- T-DATA-CLEAN-HNS02 | 2026-06-11 | codex | JSHANES HNS02 BOM 기준 품목 47개만 유지하고 입하/입고/IQC/입출고/재고/제품/실적/작업지시/검사/시뮬레이션 데이터 클린징 완료 | evidence: JOURNAL 2026-06-11 22:03 Codex
- T-IQC-SAMPLE-REMOVE | 2026-06-11 | codex | IQC 검사구분 SAMPLE 제거, 마스터 SAMPLE은 FULL 정규화, INSPECT_CLASS는 별도 legacy 이력으로 분리 유지 | evidence: JOURNAL 2026-06-11 21:37 Codex
- T-IQC-METHOD-LABELS | 2026-06-11 | codex | IQC FULL/SAMPLE/SKIP 표시를 검사/검사/무검사로 통일하고 IQC 화면 라벨을 검사구분으로 정리, JSHANES 재적용 | evidence: JOURNAL 2026-06-11 21:21 Codex
- T-MAT-LOT-IQC-UID-SEPARATE | 2026-06-11 | codex | JSHANES에서 MAT_LOTS/MAT_STOCKS/STOCK_TRANSACTIONS 시드성 MAT_UID를 MLT-*로 변경해 IQC_LOGS와 LOT 화면 UID 중복 해소 | evidence: JOURNAL 2026-06-11 21:20 Codex
- T-IQC-CODE-ALIGN | 2026-06-11 | codex | IQC 검사방법(FULL/SAMPLE/SKIP)과 검사유형(INITIAL/RETEST)을 전용 공통코드로 분리하고 품목/IQC/이력 화면 매핑 통일 | evidence: JOURNAL 2026-06-11 20:48 Codex
- T-PROCESS-EQUIP-SEED | 2026-06-11 | codex | 공정 21개 기준 설비 36대와 공정-설비 매핑 36건을 JSHANES에 시드, 전 공정 시드 매핑 확인 | evidence: JOURNAL 2026-06-11 20:27 Codex
- T-MENU-SHELF-LIFE-REINSPECT | 2026-06-11 | codex | 유수명자재 재검사 메뉴 validator 누락과 JSHANES 배치/권한 복구, 이동 API 실측 성공 | evidence: JOURNAL 2026-06-11 20:00 Codex
- T-FE-THEME-PRESET | 2026-06-11 | codex | 상단 팔레트 아이콘에서 선택 가능한 Orchid 컬러 테마 preset 추가 및 dev 서버 3004 응답 확인 | evidence: JOURNAL 2026-06-11 19:30 Codex
- T-TAB-LIMIT-10 | 2026-06-11 | codex | 페이지 탭 제한 개수를 10개로 변경하고 타입/구조 테스트 통과 | evidence: JOURNAL 2026-06-11 16:24 Codex
- T-REQINSPECT-LSL-USL | 2026-06-11 | claude | 의뢰검사 입력 우측 패널에 공정생품검사 LSL/USL 검사기준 표시(SELF_INSPECT_RESULTS↔ITEMS JOIN), tsc 통과 | evidence: JOURNAL 2026-06-11 15:30 Claude
- T-CUSTOMER-INTRO-WORK-INSTRUCTION | 2026-06-11 | codex | 고객용 제품 소개 자료 재생성 작업지시 문서 작성 완료 | evidence: JOURNAL 2026-06-11 14:43 Codex
- T-CUSTOMER-INTRO-MENU-SCREEN-DECK | 2026-06-11 | codex | 현재 메뉴 화면 캡처 기반으로 고객용 제품 소개 PPTX/HTML 15장 확장 및 검증 완료 | evidence: JOURNAL 2026-06-11 13:59 Codex
- T-CUSTOMER-INTRO-PRODUCT-DECK | 2026-06-11 | codex | 고객용 제품 소개 자료로 HTML/PPTX 전면 재작성 및 검증 완료 | evidence: JOURNAL 2026-06-11 13:15 Codex
- T-CUSTOMER-INTRO-PPTX | 2026-06-11 | codex | 고객 소개용 HANES MES 가로형 PPTX 문서 생성 및 레이아웃/패키지 검증 완료 | evidence: JOURNAL 2026-06-11 12:56 Codex
- T-CUSTOMER-INTRO-HTML-REV | 2026-06-11 | codex | 고객 소개 HTML 자료를 12장 워크플로우형으로 보강하고 글자 침범/넘침 수정 | evidence: JOURNAL 2026-06-11 12:39 Codex
- T-CUSTOMER-INTRO-HTML | 2026-06-11 | codex | 고객 소개용 HANES MES 가로형 HTML 자료와 실제 화면 캡처 5종 생성 | evidence: JOURNAL 2026-06-11 12:00 Codex
- T-MAT-FLOW-COHERENCE-FIX | 2026-06-16 | codex | 입하/입하재고/입고/출고/공정입고 흐름 점검 후 레거시 입하 API를 입하재고 모델로 보정하고 JSHANES 누락 감사원장 보강, 대사 0건 확인 | evidence: JOURNAL 2026-06-16 13:50 Codex
- T-EQUIP-INSPECT-ITEM-IMAGE-PANEL | 2026-06-16 | codex | `/master/equip-inspect-item` 등록/수정을 우측 패널로 전환하고 항목별 사진 업로드/삭제 및 `IMAGE_URL` 저장을 추가, JSHANES 누락 유형/판정기준/주기 0건으로 보정 | evidence: JOURNAL 2026-06-16 19:00 Codex
- T-EQUIP-INSPECT-ITEM-UNIT-DROPDOWN | 2026-06-16 | codex | `/master/equip-inspect-item` 측정 단위를 입력형에서 `UNIT_TYPE` 공통코드 드롭다운으로 전환하고 JSHANES 단위값 `MM/°C/Ω` 정합화 | evidence: JOURNAL 2026-06-16 20:33 Codex
- T-CONSUMABLE-MASTER-IMAGE-SEED | 2026-06-16 | codex | `/consumables/master` 소모품 37건 전체 SVG 시드 이미지를 생성하고 JSHANES `CONSUMABLE_MASTERS.IMAGE_URL` 37/37 등록 | evidence: JOURNAL 2026-06-16 21:28 Codex
- T-EQUIP-INSPECT-ITEM-IMAGE-SEED | 2026-06-16 | codex | 설비점검항목 50건에 위치 안내 SVG 시드 이미지를 생성하고 JSHANES `IMAGE_URL` 50/50 적용, 3002 화면 렌더링 확인 | evidence: JOURNAL 2026-06-16 19:25 Codex
- T-CONSUMABLE-MASTER-CARDS-REMOVE | 2026-06-16 | codex | `/consumables/master` 상단 정보카드와 카드 전용 집계/import만 제거, 목록/검색/CRUD 흐름 유지, FE tsc 및 3002 HTTP 200 확인 | evidence: JOURNAL 2026-06-16 20:29 Codex
- T-CONSUMABLE-LABEL-CARDS-REMOVE | 2026-06-16 | codex | `/consumables/label` 상단 정보카드와 카드 전용 집계/import만 제거, UID 발행/인쇄 흐름 유지, FE tsc 및 3002 HTTP 200 확인 | evidence: JOURNAL 2026-06-16 20:36 Codex
- T-ITEM-CONSUMABLE-MOVE | 2026-06-16 | codex | JSHANES 품목마스터 `ITEM_TYPE='CONSUMABLE'` 12건을 소모품마스터로 이동하고 품목마스터 잔여 0건, 이동 12건, 백업 12건 확인 | evidence: JOURNAL 2026-06-16 21:12 Codex
- T-CONSUMABLE-MASTER-USAGE-MAP | 2026-06-16 | codex | `/consumables/master` 우측 패널에 `CONSUMABLE_USAGE_MAP` 매핑 섹션과 `/consumables/:id/usage-maps` CRUD API 추가, 타입체크/API/DB 잔여/3002 HTTP 확인 | evidence: JOURNAL 2026-06-16 21:39 Codex
