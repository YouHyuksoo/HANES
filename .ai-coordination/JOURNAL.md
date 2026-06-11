# JOURNAL

## 2026-06-11

### 완료: T-TAB-KEEPALIVE-DUPE-PATH-KEY TabKeepAlive 중복 path key 오류
- 사용자 제보: React console error `Encountered two children with the same key, /dashboard` at `TabKeepAlive.tsx:83`.
- 원인: `T-TAB-KEEPALIVE-PERF`의 성능 변경 중 기존 `Set` 기반 렌더 경로 목록이 배열 `openPaths`로 바뀌었다. `tabStore.tabs`에 `/dashboard`가 중복 존재하면 `.map(key={path})`가 같은 key를 두 번 렌더한다.
- 수정: `openPaths`를 `Array.from(new Set(...))`로 만들어 탭 표시 순서를 유지하면서 레지스트리 등록 path 중복을 제거했다. 기존 `React.memo`/LRU 성능 변경은 되돌리지 않았다.
- 테스트: `apps/frontend/src/components/layout/tab-keep-alive-unique-paths.structure.test.mjs`를 RED 확인 후 GREEN 통과.
- 검증: `node apps/frontend/src/components/layout/tab-keep-alive-unique-paths.structure.test.mjs` 통과.
- 검증: `node apps/frontend/src/components/layout/sidebar-menu-navigation.structure.test.mjs` 통과.
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과.
- 검증: `http://localhost:3002/dashboard` HTTP 200 확인, 관련 파일 `git diff --check` 통과.
- 충돌 메모: `apps/frontend/src/components/layout/TabKeepAlive.tsx`는 `T-TAB-KEEPALIVE-PERF` active lock 범위였으나, 사용자 런타임 오류 제보에 따라 해당 변경을 보존한 최소 보정만 수행했다.

### 완료: T-MAT-IQC-MODAL-NO-INITIAL-SCROLL IQC 모달 하단 버튼 초기 표시
- 요청: IQC 검사결과 등록 모달에 여전히 스크롤이 생겨 하단 `시리얼별 등록` 버튼이 처음에 보이지 않으므로 중앙 영역을 줄여도 첫 화면에 버튼이 보이도록 수정.
- 원인: 공통 `Modal` content 영역은 `max-h-[75vh]`인데 `IqcModal` 내부 컨테이너가 `h-[calc(90vh-88px)] min-h-[620px]` 기준이라 content 영역보다 커져 내부 스크롤이 생겼다.
- 수정: 내부 컨테이너를 `h-[calc(75vh-32px)] max-h-[620px]`로 바꿔 공통 Modal의 padding 포함 높이 안에 들어오게 했다. `min-h-[620px]`는 제거했다.
- 수정: 상단 정보 영역 gap/padding을 `gap-1.5 p-1.5`로 줄이고, 하단 버튼 footer의 세로 padding을 `py-1.5`로 줄였다.
- 검증: `node apps/frontend/src/components/material/iqc-modal-compact-scan-layout.structure.test.mjs` 통과(2/2).
- 검증: `node apps/frontend/src/components/material/iqc-modal-serial-flow.structure.test.mjs` 통과(2/2).
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과.
- 검증: `git diff --check -- apps/frontend/src/components/material/IqcModal.tsx apps/frontend/src/components/material/iqc-modal-compact-scan-layout.structure.test.mjs .ai-coordination/TASKS.md .ai-coordination/LOCKS.md` 통과.
- 검증: `http://localhost:3002/material/iqc` HTTP 200 확인(약 4초).

### 완료: T-MAT-IQC-MODAL-COMPACT-SCAN IQC 검사결과 모달 스캔 상단 배치
- 요청: `/material/iqc` IQC 검사결과 등록 모달에서 바코드 스캔 입력을 상단 공간으로 올리고, 하단 시리얼/검사항목 판정 영역이 한 화면에 더 잘 보이도록 구성.
- RED 확인: `iqc-modal-compact-scan-layout.structure.test.mjs`를 먼저 추가했고, 기존 `2xl` 모달/하단 보조 입력 블록/큰 상단 정보 카드 때문에 실패함을 확인했다.
- 수정: `IqcModal`을 `size="full"`로 확장하고, 입하정보·스캔 입력·검사자·비고·검사분류·샘플수량·성적서 버튼을 상단 조밀 그리드로 통합했다.
- 수정: 하단 판정 카드는 `flex` 기반으로 남은 높이를 채우게 하고, 시리얼 목록과 검사항목 표의 행 높이/폰트/버튼/아이콘을 compact 처리했다. 별도 하단 보조 입력/취소 블록은 제거했다.
- 검증: `node apps/frontend/src/components/material/iqc-modal-compact-scan-layout.structure.test.mjs` 통과(2/2).
- 검증: `node apps/frontend/src/components/material/iqc-modal-serial-flow.structure.test.mjs` 통과(2/2).
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과.
- 검증: `git diff --check -- apps/frontend/src/components/material/IqcModal.tsx apps/frontend/src/components/material/iqc-modal-compact-scan-layout.structure.test.mjs` 통과.
- 검증: `http://localhost:3002/material/iqc`는 인증 영역 응답 지연 상태에서 72초 후 HTTP 200 확인. 같은 시점 `/material/po`, `/dashboard`도 15초 타임아웃이라 IQC 단독 회귀가 아니라 dev 서버/keep-alive 성능 이슈로 판단.

### 완료: T-MAT-PO-PANEL-COMPACT-ROWS PO 우측 패널 품목 행 밀도 축소
- 요청: `/material/po` 우측 패널 공간 확보를 위해 품목 행의 컬럼 높이와 폰트를 줄임.
- 수정: 품목 행 내부 필드에만 `CompactItemInput`을 추가해 라벨을 `text-[10px]`, 입력을 `h-7 text-xs`로 렌더링한다. 상단 PO 헤더 입력은 기존 공통 `Input` 유지.
- 수정: 품목 카드 padding을 `p-3`에서 `p-2`, radius를 `rounded-lg`에서 `rounded-md`로 줄이고, 품목명/코드 글꼴과 필드 간격을 더 촘촘하게 조정했다.
- 수정: 기존 높이 테스트는 목록 간격 축소(`space-y-1.5`)를 반영하도록 갱신했다.
- 검증: `node "apps/frontend/src/app/(authenticated)/material/po/components/po-form-panel-density.structure.test.mjs"` RED 확인 후 GREEN 통과.
- 검증: 기존 `po-part-bulk-add.structure.test.mjs`, `po-form-panel-layout.structure.test.mjs` 통과.
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과.
- 검증: `http://localhost:3002/material/po` HTTP 200 확인, 관련 파일 `git diff --check` 통과.

### 완료: T-MAT-PO-PART-BULK-ADD PO 품목검색 모달 다중선택 추가
- 요청: `/material/po` 우측 패널의 품목추가 모달을 더 크게 하고, 품목을 한 개씩 추가하는 대신 선택 품목을 일괄 추가할 수 있게 개선.
- 수정: 공통 `PartSearchModal`에 opt-in `multiSelect`/`onSelectMany` props를 추가했다. 기본값은 단건 선택이라 기존 사용처는 행 클릭 즉시 선택/닫기 동작을 유지한다.
- 수정: 다중선택 모드에서는 모달 크기를 `xl`에서 `2xl`로 키우고, 그리드 높이를 400px에서 560px로 늘렸다. 선택 체크박스 컬럼, 현재 조회 목록 전체선택, footer의 선택 건수와 `선택 품목 추가` 버튼을 추가했다.
- 수정: PO 패널은 `multiSelect`를 켜고 `handlePartSelectMany`로 선택 품목들을 한 번에 라인으로 추가한다. 이미 패널에 있는 품목코드는 중복 추가하지 않는다.
- 검증: `node "apps/frontend/src/app/(authenticated)/material/po/components/po-part-bulk-add.structure.test.mjs"` RED 확인 후 GREEN 통과.
- 검증: 기존 `po-form-panel-layout.structure.test.mjs` 통과.
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과.
- 검증: `http://localhost:3002/material/po` HTTP 200 확인, 관련 파일 `git diff --check` 통과.

### 완료: T-I18N-MOJIBAKE-FIX locale 깨진 값(?) 복원
- 4개 locale 전체를 `?` 연속/단어 내 `?` 패턴으로 스캔 — 실제 깨진 값은 6건(나머지는 정상 의문문): ko/zh/vi `master.part.itemCode`("????"/"M? h?ng"), ko/zh/vi `master.bom.childItem`("??"/"V?t t?").
- 복원(en 기준 의미 정합): itemCode → 품목코드/品目代码/Mã hàng, childItem(en "Material") → 자재/物料/Vật tư.
- 검증: 4파일 JSON 유효·BOM 없음·값 확인. en.json은 깨진 값 없음.

### 완료: T-PART-PRODUCT-TYPE-COMCODE 품목관리 제품유형을 코드마스터 기반으로 전환
- 증상: `/master/part` 제품유형 드롭다운·컬럼 값이 코드마스터에 없음(명칭/설명 불일치, 코드 검색 불가).
- 원인: COM_CODES에 PRODUCT_TYPE 그룹 자체가 부재. 화면은 프론트 하드코딩 상수(`PRODUCT_TYPE_VALUES` 16종) + i18n(`master.part.productTypeOptions.*`)으로만 동작 — 코드마스터와 완전히 분리되어 있었음(실DB·all-active API로 그룹 부재 확인).
- 수정(DB): `2026-06-11_product_type_com_codes.sql` — PRODUCT_TYPE 그룹 16코드 멱등 MERGE 시드, JSHANES(40/1000) 적용·16건 확인. 실데이터 productType 값 12종 모두 시드 범위 내(불일치 0).
- 수정(프론트): part page/FormPanel/FormModal의 드롭다운·컬럼 라벨을 `useComCodeOptions/useComCodeMap("PRODUCT_TYPE")` 기반으로 전환, `PRODUCT_TYPE_VALUES` 상수 제거(types.ts). CLAUDE.md "코드값은 useComCode 계열" 규칙 정합.
- 수정(i18n): `master.part.productTypeOptions.*` → `comCode.PRODUCT_TYPE.*`로 이전(4개 언어 번역 보존), `comCodeGroup.PRODUCT_TYPE` 추가. 구 키 제거.
- 검증: JSHANES SELECT 16건, all-active API PRODUCT_TYPE 16건, 4개 locale JSON 유효·BOM 없음·구키 잔존 0, 프론트 tsc 0.
- 참고(범위 외): 백엔드 DTO `IsIn(PRODUCT_TYPE_VALUES)`(@harness/shared)는 유지 — 코드마스터에 신규 제품유형을 추가하면 shared 상수도 같이 갱신 필요. ko/zh/vi의 `master.part.itemCode` 값이 기존부터 "????" 등으로 깨져 있음(별건).

### 완료: T-COMCODE-GROUP-I18N /master/code 좌측 그룹 설명 다국어 보강
- 증상: 공통코드 관리 좌측 패널의 그룹 설명이 일부는 한글, 일부는 영문(그룹코드 그대로)으로 표시.
- 원인: `GroupList`는 이미 `t('comCodeGroup.<그룹코드>', { defaultValue: groupCode })` 구조 — 번역 키가 없는 그룹만 코드 폴백으로 영문 노출. DB 117개 그룹 중 43개 키가 4개 locale 파일에 누락(ADJ_REASON, AUDIT_*, FAI_*, SPC_*, REWORK_*, TRAINING_* 등). 코드 변경 불필요, 데이터(키) 보강만.
- 수정: ko/en/zh/vi 4개 파일 `comCodeGroup` 섹션에 43키 추가(기존 키 무변경, 추가만).
- 검증: 4파일 JSON 파싱 OK·BOM 없음·DB 그룹 대비 누락 0건(스크립트 대조).
- 참고: 신규 코드그룹 생성 시에도 4개 locale에 `comCodeGroup.<코드>` 키를 함께 추가해야 함(누락 시 코드 폴백 표시).

### 완료: T-MAT-PO-ITEMLIST-FLEX-HEIGHT PO 우측 품목추가 섹션 높이 고정 해제
- 요청: `/material/po` 우측 패널에서 품목추가 섹션이 고해상도 모니터에서도 고정 높이로 보여 하단 공백이 생김.
- 확인: `PoFormPanel.tsx`의 품목 목록 컨테이너가 `space-y-2 max-h-[320px] overflow-y-auto`로 되어 있어 남는 세로 공간을 사용하지 못한다.
- 진행 조건: `T-MAT-RECV-FIXES`가 같은 파일을 active task에 포함하고 있었으나, 사용자 승인 후 충돌을 넘겨 수정했다.
- 수정: 본문을 `flex flex-col` + `overflow-hidden` 구조로 바꾸고 품목 섹션을 `flex-1 min-h-0 flex flex-col`로 전환했다.
- 수정: 품목 목록의 `max-h-[320px]`를 제거하고 `flex-1 min-h-0 overflow-y-auto`로 변경해 고해상도에서 남는 패널 높이를 사용하게 했다.
- 검증: `node "apps/frontend/src/app/(authenticated)/material/po/components/po-form-panel-layout.structure.test.mjs"` RED 확인 후 GREEN 통과.
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과.
- 검증: `http://localhost:3002/material/po` HTTP 200 확인, 관련 파일 `git diff --check` 통과.

## 2026-06-10

### 완료: T-DATAGRID-FILTER-AUTOCOMPLETE-OFF 그리드 컬럼 필터 자동완성 비활성화
- 요청: 그리드 컬럼 검색 입력에서 브라우저가 이전 입력값을 다시 보여주는 기능을 끄고 싶다는 사용자 요청.
- 판단: 전역 `Input` 기본값을 바꾸면 로그인/스캔/일반 입력폼까지 영향이 커서 DataGrid 컬럼 필터 입력에 한정했다.
- 수정: `ColumnFilterInput` 텍스트 필터와 `TextFilterPopup` 검색 input에 `autoComplete="off"`, `autoCorrect="off"`, `spellCheck={false}`를 추가했다.
- 수정: `NumberFilterPopup` 조건값 input 2개와 `DateFilterPopup` from/to input 2개에도 `autoComplete="off"`를 추가했다.
- 검증: `node apps/frontend/src/components/data-grid/datagrid-filter-autocomplete.structure.test.mjs` RED 확인 후 GREEN 통과.
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과.
- 검증: 관련 파일 `git diff --check` 통과.

### 완료: T-MAT-LABEL-PRINT-IFRAME-MFG 라벨 인쇄 무반응(팝업 차단) iframe 전환 + lot 라벨 제조사
- (A) 인쇄 무반응: T-MAT-LABEL-REPRINT-MULTIPAGE의 window.open 새 창 인쇄가 팝업 차단 시 `if (!win) return`으로 조용히 무반응(사용자 재현). CSP 미설정 확인 → 팝업 차단이 유력 원인. 수정=팝업과 무관한 숨김 iframe(doc.write→contentWindow.print, afterprint 시 제거) 인쇄로 교체. 구조테스트를 iframe 기대값으로 갱신(RED→GREEN, window.open 금지 assert 포함).
- (B) lot-split/lot-merge 라벨 제조사: 백엔드 목록/by-barcode 응답이 `...lot` 평탄화로 `mfgPartnerCode`를 이미 포함(실API 확인: lot-split 목록 mfgPartnerCode=M-TEST) → 백엔드 무변경. 프론트 두 페이지에 `usePartnerOptions("MFG")` + resolveMfgPartnerName(코드→이름, 미해석 시 코드 표시) 추가, 분할=원본 LOT·병합=첫 스캔 LOT의 제조사를 `mfgPartnerLabel`로 전달.
- 검증: 구조테스트 1/1, 프론트 tsc 0, GET /material/lot-split 실API mfgPartnerCode 확인.
- 참고: receive-label/consumables의 window.open 인쇄도 팝업 차단 환경에선 같은 무반응 가능 — 증상 보고 시 동일 iframe 패턴 적용 후보.

### 완료: T-MAT-LABEL-REPRINT-MFG 라벨 재발행 시 제조사 누락 수정
- 증상: `/material/arrival-result` 라벨 재발행 라벨의 제조사 줄이 `-`로 인쇄됨.
- 원인: `MatLabelPreviewModal` 호출 시 `mfgPartnerLabel` prop 누락(arrival 페이지는 전달, arrival-result만 누락).
- 수정: `selected.mfgPartnerName`(null이면 `resolveMfgPartnerName(mfgPartnerCode)` 폴백) 전달.
- 범위 외 보고: lot-merge/lot-split 라벨도 `mfgPartnerLabel` 미전달이나 해당 화면 lot 데이터에 제조사 필드 자체가 없어 백엔드 보강 필요 — 별도 요청 시 처리.
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit` 에러 0건.

### 완료: T-MAT-LABEL-STAMP-REMOVE 자재라벨 우측 하단 원형(검사필 도장 영역) 제거
- 요청: 라벨 우측 하단 원형 이미지를 제거.
- 수정: `MaterialArrivalLabel.tsx`의 빈 원형 div(right 4.6mm/top 14.6mm, 22.2mm 원, T-MAT-ARRIVAL-LABEL-FORMAT에서 추가된 검사필 도장 영역) 삭제. 공유 컴포넌트라 arrival/arrival-result/lot-merge/lot-split/receive-label 라벨 전부 반영.
- 범위 외 미변경: 하단 품명 영역의 `right: 29mm`(원형 회피용 여백)는 요청 범위가 아니라 유지 — 품명 표시 폭을 넓히려면 별도 요청 필요.
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit` 에러 0건.

### 완료: T-MAT-LABEL-REPRINT-MULTIPAGE 라벨 재발행 인쇄 1장만 출력되는 문제 수정
- 증상: `/material/arrival-result` 라벨 재발행 미리보기에서 라벨 N장(예: 10장)이 보이지만, 출력 버튼을 누르면 프린터 미리보기에 1장만 나오고 나머지는 인쇄 불가.
- 원인: `MatLabelPreviewModal`이 모달 DOM을 그대로 `window.print()`로 인쇄했다. `@media print` visibility 트릭과 page-break CSS가 있어도, Modal 조상의 레이아웃 제약 — `body{overflow:hidden}`(Modal useEffect), `position:fixed inset-0` 래퍼(Modal.tsx:88), `overflow-y-auto max-h-[75vh]` 콘텐츠 div(Modal.tsx:126) — 는 visibility로 제거되지 않아 인쇄 내용이 첫 페이지(라벨 1장)로 클리핑됐다. 기존 주석(line 61)의 display:block 수정은 인쇄 영역 자체만 고쳤고 조상 클리핑은 남아 있었다.
- 수정: `receive-label`/`consumables/label`에서 이미 검증된 새 창 인쇄 패턴으로 전환. `printRef`로 라벨 영역 innerHTML을 새 창에 복사하고 `@page{size:80mm 40mm}` + `page-break-inside:avoid` CSS로 시리얼당 1페이지 인쇄. styled-jsx `@media print` 블록 제거.
- 영향 범위: `MatLabelPreviewModal`은 공유 컴포넌트라 arrival, arrival-result, lot-merge, lot-split 4개 화면의 라벨 인쇄가 모두 수정됨.
- RED 확인: `mat-label-preview-modal-print.structure.test.mjs`를 먼저 추가, 기존 코드에 `window.open`/`printRef`가 없어 실패 확인.
- 검증: `node --test .../mat-label-preview-modal-print.structure.test.mjs` 통과(1/1).
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit` 에러 0건.
- 참고(범위 외): `JobOrderPrintModal`(A4 1장), `InspectItemLabelModal`(라벨 1장)도 모달 내 window.print 패턴이나 단일 페이지 인쇄라 현재 증상은 없음.

### 완료: T-MAT-ARRIVAL-RESULT-MFG-INSTANT 입하실적조회 제조사 변경 즉시 반영
- 증상: `/material/arrival-result` 우측 패널에서 제조사를 변경해도 저장 직후 우측 제조사 표시가 바뀌지 않고, 새로고침해야 변경 사항이 보였다.
- 원인: `saveMfg()`가 제조사 변경 PATCH 성공 후 `loadSerials(selected)`만 호출했다. `loadSerials()`는 기존 `selected` row를 다시 설정하고 시리얼 목록만 재조회하므로, 제조사명/코드를 가진 좌측 `rows`와 우측 `selected` 상태는 이전 값으로 남았다.
- 수정: `usePartnerOptions("MFG")`로 선택 코드의 표시명을 해석하고, PATCH 성공 직후 `selected`와 `rows`의 해당 입하번호+품번 row를 `mfgPartnerCode/mfgPartnerName`으로 즉시 갱신한다. 시리얼 목록은 제조사 표시와 무관하므로 기존 `loadSerials(selected)` 재호출은 제거했다.
- RED 확인: `arrival-result-mfg-refresh.structure.test.mjs`를 먼저 추가했고, 기존 코드에는 `usePartnerOptions("MFG")`, `resolveMfgPartnerName`, `setSelected(updatedSelected)`, `setRows(prev => prev.map(...))`가 없어 실패함을 확인했다.
- 검증: `node "apps/frontend/src/app/(authenticated)/material/arrival-result/arrival-result-mfg-refresh.structure.test.mjs"` 통과(1/1).
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과.
- 검증: API로 `R26061000003/MAT_CABLE1`의 제조사를 테스트 후 원래 `M004/대성하이텍`으로 원복했고, `GET /material/arrivals/results?arrivalNo=R26061000003`에서 `mfgPartnerCode=M004`, `mfgPartnerName=대성하이텍` 확인.
- 미완료 검증: CDP 브라우저 UI 검증은 로그인 플로우에서 타임아웃되어 완료하지 못했다. 타임아웃 후 디버그 Chrome은 정리했다.

### 완료: T-LAYOUT-MENU-CLICK-NAV 사이드바 메뉴 클릭 라우팅 보강
- 증상: 사이드바 메뉴를 클릭하면 탭 항목은 생기지만 실제 페이지가 열리지 않고 기존 화면에 남을 수 있다.
- 재현: headless Chrome CDP에서 `/dashboard` 로그인 상태를 주입한 뒤 `수입검사(IQC)` 메뉴 클릭을 재현했다. 실패 조건에서는 `harness-tabs.activeTabId=QC_IQC`로 바뀌었지만 `location.pathname=/dashboard`에 남아 대시보드가 계속 표시됐다.
- 원인: `SidebarMenu`가 탭 추가/활성화는 직접 수행하지만 실제 라우팅은 `Link` 기본 동작에만 맡겼다. 기본 링크 이동이 실행되지 않으면 keep-alive는 현재 `pathname` 기준으로 기존 페이지를 계속 보여준다.
- 수정: `SidebarMenu.handleMenuClick()`에서 `addTab()` 직후 `router.push(menuItem.path)`를 명시적으로 호출해 탭 상태와 URL 라우팅을 같은 클릭 핸들러에서 동기화했다.
- RED 확인: `sidebar-menu-navigation.structure.test.mjs`를 먼저 추가했고, 기존 `SidebarMenu`에는 `useRouter`/`router.push(menuItem.path)`가 없어 실패함을 확인했다.
- 검증: `node apps/frontend/src/components/layout/sidebar-menu-navigation.structure.test.mjs` 통과(1/1).
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과.
- 검증: CDP 브라우저에서 같은 `element.click()` 조건으로 `/dashboard` → `/material/iqc` 이동, `harness-tabs.activeTabId=QC_IQC`, 화면 본문 `수입검사 결과를 관리합니다.` 표시, 콘솔 오류 0건 확인.

### 완료: T-MAT-IQC-SERIAL-SCAN-PANEL IQC 시리얼 스캔별 검사항목 판정 UI
- 요청: `/material/iqc` 검사결과 등록 모달에서 전체 시리얼을 한 번에 표시/판정하는 구성이 아니라, 시리얼을 스캔하면 왼쪽에 스캔한 시리얼 목록이 쌓이고 선택한 시리얼의 검사항목 판정 결과가 오른쪽에 표시되어야 한다.
- 수정: `IqcModal`을 스캐너 입력 우선 구조로 재구성했다. 검사대기 시리얼과 스캔값을 매칭하고, 스캔된 시리얼만 좌측 목록에 추가하며, 선택 시리얼의 검사항목별 측정값/PASS/FAIL 판정을 우측 패널에서 관리한다.
- 저장: 제출 시 `details`에 `{ type: "SERIAL_INSPECTION", serials: [...] }` 형태로 시리얼별 수량, 최종 판정, 검사항목 측정값/판정/규격을 JSON 저장하도록 전송한다. `sampleBarcode`에는 스캔한 시리얼 목록을 전달한다.
- 보존: 검사분류, 샘플 시료수량, 검사성적서 업로드, 검사자/비고 입력 흐름은 유지했다. `apps/frontend/src/locales/*`는 다른 active lock 범위라 수정하지 않고 `t()` 기본 문구로 처리했다.
- RED 확인: `iqc-modal-serial-flow.structure.test.mjs`를 먼저 추가했고, 기존 모달에는 `serialScanInputRef`, `scannedSerials`, `selectedSerial`, `serialInspectionMap`, `handleSerialScan`, `serialInspectionPayload`가 없어 실패함을 확인했다.
- 검증: `node apps/frontend/src/components/material/iqc-modal-serial-flow.structure.test.mjs` 통과(2/2).
- 검증: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과.
- 검증: `http://localhost:3002/material/iqc` HTTP 200 확인.

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

### 완료: T-MASTER-CODE-I18N-SEARCH 공통코드 좌측 다국어 검색 보정
- 요청: `http://localhost:3002/master/code` 좌측 검색 조건이 현재 다국어 상태를 반영해 해당 언어 값으로 검색되어야 한다.
- 원인: 좌측 `GroupList`는 그룹코드와 `comCodeGroup.*` 번역명만 검색했다. 그룹 안의 실제 공통코드 표시값(`comCode.GROUP.CODE` 번역, DB `CODE_NAME/ATTR1/ATTR2/ATTR3`)은 검색 대상이 아니어서 언어 전환 후 상태명/코드명으로 그룹을 찾을 수 없었다.
- 수정: `ComCodeService.findAllGroups()`가 `detailCodes`와 언어별 검색 텍스트를 함께 반환하도록 보강했다.
- 수정: `GroupList`는 현재 `i18n.language`를 정규화해 `comCode.GROUP.CODE` 번역값과 DB 언어별 검색 텍스트를 좌측 검색 대상에 포함한다. 기존 그룹코드/그룹명 검색은 유지했다.
- 제한: `apps/frontend/src/locales/*`는 다른 active lock 범위라 수정하지 않았다.
- RED 확인: `com-code.service.spec.ts`에 언어별 그룹 검색 텍스트 계약 테스트를 먼저 추가했고, 기존 응답에는 `searchText`가 없어 실패함을 확인했다.
- 검증: `pnpm --filter @harness/backend test -- com-code.service.spec.ts` 통과(19/19).
- 검증: `pnpm --filter @harness/backend exec tsc --noEmit --pretty false` 통과.
- 검증: `git diff --check` 통과.
- 미완료 검증: `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`는 기존 dirty 파일 `/master/part`의 `PRODUCT_TYPE_OPTIONS` 누락 오류로 실패했다.
- 미완료 검증: 현재 `localhost:3002/master/code` dev 서버 응답이 60초 안에 완료되지 않아 화면 HTTP 확인은 수행하지 못했다. `localhost:3002/api/master/com-codes/groups`는 인증 401까지 도달했다.

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
