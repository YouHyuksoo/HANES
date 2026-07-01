import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const modal = readFileSync('apps/frontend/src/components/material/IssueFromRequestModal.tsx', 'utf8');
const panel = readFileSync('apps/frontend/src/components/material/WorkOrderRequestPanel.tsx', 'utf8');
const hook = readFileSync('apps/frontend/src/hooks/material/useIssueRequestData.ts', 'utf8');
const page = readFileSync('apps/frontend/src/app/(authenticated)/material/request/page.tsx', 'utf8');
const partSearchModal = readFileSync('apps/frontend/src/components/shared/PartSearchModal.tsx', 'utf8');
const requestTable = readFileSync('apps/frontend/src/components/material/RequestTable.tsx', 'utf8');
const issueRequestTab = readFileSync('apps/frontend/src/components/material/IssueRequestTab.tsx', 'utf8');
const issueRequestsHook = readFileSync('apps/frontend/src/hooks/material/useIssueRequests.ts', 'utf8');
const issuePage = readFileSync('apps/frontend/src/app/(authenticated)/material/issue/page.tsx', 'utf8');
const issueOtherPage = readFileSync('apps/frontend/src/app/(authenticated)/material/issue-other/page.tsx', 'utf8');
const issueRequestDto = readFileSync('apps/backend/src/modules/material/dto/issue-request.dto.ts', 'utf8');
const issueRequestService = readFileSync('apps/backend/src/modules/material/services/issue-request.service.ts', 'utf8');
const menuConfig = readFileSync('apps/frontend/src/config/menuConfig.ts', 'utf8');
const pageRegistry = readFileSync('apps/frontend/src/components/layout/pageRegistry.generated.ts', 'utf8');
const menuCodeValidator = readFileSync('apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts', 'utf8');
const menuSeed = readFileSync('apps/backend/src/seeds/menu-config.json', 'utf8');

test('실출고 모달은 포장단위 올림 잔여까지 출고를 허용한다', () => {
  assert.match(modal, /roundUpToPack/, '실출고수량은 포장단위 올림으로 계산해야 한다');
  assert.match(modal, /packRemainQty/, '최대 출고 허용 수량은 포장단위 올림 잔여여야 한다');
  assert.match(modal, /max=\{item\.packRemainQty\}/, '출고수량 입력 상한은 낱개 잔여가 아닌 포장단위 올림 잔여여야 한다');
  assert.match(modal, /issueQty:\s*packRemainQty/, '기본 출고수량은 포장단위 올림 잔여여야 한다');
  assert.match(modal, /minPackQty/, '포장단위 컬럼을 표시해야 한다');
});

test('출고요청 작성 그리드는 요청/포장단위/실출고 3값을 표시한다', () => {
  assert.match(panel, /calcIssueQty/, '실출고수량 = ceil(요청/포장단위)*포장단위');
  assert.match(panel, /material\.request\.minPackQty/, '포장단위 컬럼 헤더를 표시해야 한다');
  assert.match(panel, /material\.request\.issueQtyLabel/, '실출고수량 컬럼 헤더를 표시해야 한다');
});

test('#1 작성 패널에서 BOM 외 품목을 직접 검색해 추가할 수 있다', () => {
  assert.match(panel, /searchStockItems/, 'BOM 외 품목 검색 prop을 받아야 한다');
  assert.match(panel, /addManualItem/, '검색 품목을 직접 추가하는 핸들러가 있어야 한다');
});

test('#7 실출고 모달은 LOT 입고일(FIFO)과 가용부족 경고를 표시한다', () => {
  assert.match(modal, /fmtRecvDate/, 'LOT 입고일을 표시해야 한다');
  assert.match(modal, /shortage/, '선택 LOT 가용재고 부족 경고가 있어야 한다');
});

test('#8 공정 지정 출고는 공정재고 적재 안내를 표시한다', () => {
  assert.match(panel, /processStockNotice/, '작성 패널에 공정재고 적재 안내가 있어야 한다');
  assert.match(modal, /processStockNotice/, '실출고 모달에 공정재고 적재 안내가 있어야 한다');
});

test('/material/request 좌측 작업지시 목록은 완제품/반제품 품목유형 배지를 표시한다', () => {
  assert.match(panel, /getJobOrderItemTypeMeta/, '작업지시 품목유형 표시 메타를 계산해야 한다');
  assert.match(panel, /order\.part\?\.itemType/, '작업지시 품목유형은 part.itemType 기준이어야 한다');
  assert.match(panel, /production\.order\.itemTypeFG/, '완제품 라벨을 표시해야 한다');
  assert.match(panel, /production\.order\.itemTypeWIP/, '반제품 라벨을 표시해야 한다');
});

test('/material/request 작업지시 목록 기본 필터는 대기이고 완제품/반제품 필터를 제공한다', () => {
  assert.match(hook, /const\s+\[woStatus,\s*setWoStatus\]\s*=\s*useState\('WAITING'\)/, '작업지시 상태 기본값은 WAITING이어야 한다');
  assert.match(hook, /const\s+\[woItemType,\s*setWoItemType\]\s*=\s*useState\(''\)/, '작업지시 품목유형 필터 상태가 있어야 한다');
  assert.match(hook, /matchesItemType\s*=\s*!woItemType\s*\|\|\s*row\.part\?\.itemType\s*===\s*woItemType/, '작업지시 품목유형 필터를 적용해야 한다');
  assert.match(panel, /woItemType:\s*string/, '패널은 품목유형 필터 값을 받아야 한다');
  assert.match(panel, /onWoItemTypeChange/, '패널은 품목유형 필터 변경 핸들러를 받아야 한다');
  assert.match(panel, /value:\s*'FINISHED'[\s\S]*production\.order\.itemTypeFG/, '완제품 필터 옵션이 있어야 한다');
  assert.match(panel, /value:\s*'SEMI_PRODUCT'[\s\S]*production\.order\.itemTypeWIP/, '반제품 필터 옵션이 있어야 한다');
  assert.match(page, /woItemType=\{woItemType\}/, '페이지는 품목유형 필터 값을 패널에 전달해야 한다');
  assert.match(page, /onWoItemTypeChange=\{setWoItemType\}/, '페이지는 품목유형 필터 변경 핸들러를 패널에 전달해야 한다');
});

test('/material/request 완제품/반제품 필터는 상위 매칭 시 다른 유형의 하위를 그대로 보존하지 않는다', () => {
  assert.doesNotMatch(hook, /matchesSelf\s*\?\s*cloneJobOrderTree\(children\)/, '상위 완제품이 매칭되어도 반제품 children 전체를 그대로 복사하면 안 된다');
  assert.match(hook, /includeAncestors:\s*!woItemType/, '품목유형 필터가 있을 때는 다른 유형의 상위 row를 context로 섞지 않아야 한다');
});

test('/material/request 작업지시 목록은 완제품-반제품 관계를 트리 레벨로 표시한다', () => {
  assert.match(hook, /\/production\/job-orders\/tree/, '작업지시 관계 조회는 tree API를 사용해야 한다');
  assert.match(hook, /filterJobOrderTree/, '트리 관계를 유지한 채 필터링해야 한다');
  assert.match(hook, /flattenJobOrderTree/, '화면 표시를 위해 트리를 depth 포함 목록으로 평탄화해야 한다');
  assert.match(panel, /_depth\?:\s*number/, '좌측 목록 row는 depth 값을 받아야 한다');
  assert.match(panel, /order\._depth\s*\?\?\s*0/, '각 작업지시 row는 depth 기준으로 렌더링해야 한다');
  assert.match(panel, /paddingLeft:\s*`\$\{depth \* 16\}px`/, '하위 반제품 작업지시는 들여쓰기해야 한다');
});

test('/material/request 작업지시 목록은 작업지시일자를 표시한다', () => {
  assert.match(panel, /formatJobOrderPlanDate/, '작업지시일자는 표시용 날짜로 포맷해야 한다');
  assert.match(panel, /order\.planDate/, '작업지시일자는 planDate 기준이어야 한다');
  assert.match(panel, /production\.order\.orderDate/, '작업지시 목록에 지시일자 라벨을 표시해야 한다');
  assert.match(panel, /CalendarDays/, '날짜 정보는 목록 메타 정보로 구분되어야 한다');
});

test('/material/request 상위 완제품 작업지시는 접기/펼치기를 지원한다', () => {
  assert.match(panel, /collapsedOrderNos/, '상위 작업지시 접힘 상태를 관리해야 한다');
  assert.match(panel, /visibleJobOrders/, '접힌 상위 작업지시의 하위 항목은 목록에서 숨겨야 한다');
  assert.match(panel, /toggleOrderCollapse/, '작업지시별 접기/펼치기 핸들러가 있어야 한다');
  assert.match(panel, /order\.children\?\.length/, '하위 작업지시 존재 여부는 children 기준이어야 한다');
  assert.match(panel, /ChevronDown/, '펼쳐진 상위 작업지시는 접기 아이콘을 표시해야 한다');
  assert.match(panel, /ChevronRight/, '접힌 상위 작업지시는 펼치기 아이콘을 표시해야 한다');
  assert.match(panel, /event\.stopPropagation\(\)/, '접기/펼치기 클릭은 작업지시 선택으로 전파되면 안 된다');
});

test('/material/request 작업지시 출고요청 화면은 수동 출고요청 생성을 포함하지 않는다', () => {
  assert.doesNotMatch(page, /RequestModal/, '수동 출고요청은 RequestModal을 import하거나 렌더링하면 안 된다');
  assert.doesNotMatch(page, /isModalOpen/, '수동 출고요청을 모달 open state로 관리하면 안 된다');
  assert.doesNotMatch(page, /manualRequestVersion/, '수동요청은 기존 상세 패널에 신호를 전달하는 방식이면 안 된다');
  assert.doesNotMatch(page, /isManualPanelOpen/, '작업지시 출고요청 화면은 수동요청 패널 open state를 가지면 안 된다');
  assert.doesNotMatch(page, /ManualIssueRequestPanel/, '작업지시 출고요청 화면은 수동요청 패널을 렌더링하면 안 된다');
  assert.doesNotMatch(page, /material\.request\.manualRequest/, '작업지시 출고요청 화면 헤더에 수동요청 버튼이 있으면 안 된다');
  assert.match(page, /className="flex h-full animate-fade-in"/, '페이지 루트는 우측 패널을 붙일 수 있는 가로 flex 레이아웃이어야 한다');
  assert.match(page, /className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4"/, '본문 영역은 우측 패널과 sibling 구조여야 한다');

  const manualPanel = readFileSync('apps/frontend/src/components/material/ManualIssueRequestPanel.tsx', 'utf8');
  assert.match(manualPanel, /w-\[480px\] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl/, '수동요청 패널은 기준정보 우측 패널과 같은 폭/경계/그림자 구조여야 한다');
  assert.match(manualPanel, /animate-slide-in-right/, '수동요청 패널은 우측 슬라이드 진입 애니메이션을 사용해야 한다');
  assert.match(manualPanel, /px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0/, '수동요청 패널 버튼은 다른 우측 패널처럼 헤더 오른쪽에 있어야 한다');
  assert.match(manualPanel, /<h2 className="text-sm font-bold text-text">/, '수동요청 패널 제목 스타일은 다른 우측 패널과 같아야 한다');
  assert.match(manualPanel, /<Button size="sm" variant="secondary" onClick=\{handleClose\}>/, '취소 버튼은 헤더 액션 영역에 있어야 한다');
  assert.match(manualPanel, /<Button size="sm" onClick=\{handleSubmit\} disabled=\{!canSubmit\}>/, '등록 버튼은 헤더 액션 영역에 있어야 한다');
  assert.match(manualPanel, /flex-1 overflow-y-auto px-5 py-3 space-y-4/, '본문은 헤더 아래 스크롤 영역이어야 한다');
  assert.doesNotMatch(manualPanel, /border-t border-border p-3 flex justify-end gap-2/, '취소/등록 버튼을 패널 바닥 footer에 두면 안 된다');
  assert.match(manualPanel, /PartSearchModal/, '수동요청 패널은 공통 품목 선택창을 사용해야 한다');
  assert.match(manualPanel, /partSearchOpen/, '품목 선택창 open state가 있어야 한다');
  assert.match(manualPanel, /onClick=\{\(\) => setPartSearchOpen\(true\)\}/, '품목 검색 버튼은 선택창을 열어야 한다');
  assert.match(manualPanel, /itemType="RAW_MATERIAL"/, '출고요청 수동 품목 선택창은 원자재만 조회해야 한다');
  assert.match(manualPanel, /modalSize="2xl"/, '수동요청 품목 검색창은 좁은 기본 폭이 아니라 2xl 폭으로 열어야 한다');
  assert.match(partSearchModal, /modalSize\?:\s*'xl' \| '2xl'/, '품목 검색 모달은 호출처별 폭 지정을 지원해야 한다');
  assert.match(partSearchModal, /size=\{multiSelect \? "2xl" : modalSize\}/, '단건 선택 품목 검색은 호출처 modalSize를 Modal 크기로 사용해야 한다');
  assert.match(manualPanel, /onSelect=\{addSelectedPart\}/, '선택창에서 고른 품목은 요청 목록에 추가되어야 한다');
  assert.doesNotMatch(manualPanel, /searchStockItems:\s*\(query: string\)/, '수동요청 패널은 임시 검색 prop에 의존하면 안 된다');
  assert.match(manualPanel, /api\.post\('\/material\/issue-requests'/, '수동요청 패널에서 출고요청 API를 호출해야 한다');
  assert.match(manualPanel, /orderNo:\s*undefined/, '수동요청 패널은 작업지시 없이 요청할 수 있어야 한다');
  assert.doesNotMatch(panel, /type RightMode = 'history' \| 'create' \| 'manual'/, '작업지시 상세 패널에 manual 모드를 섞으면 안 된다');
  assert.doesNotMatch(panel, /manualRequestVersion\?:\s*number/, '작업지시 상세 패널은 수동요청 신호 prop을 받으면 안 된다');
});

test('/material/request-other 기타출고요청은 별도 메뉴와 페이지에서 MANUAL 요청만 처리한다', () => {
  const manualPanel = readFileSync('apps/frontend/src/components/material/ManualIssueRequestPanel.tsx', 'utf8');
  const otherRequestPagePath = 'apps/frontend/src/app/(authenticated)/material/request-other/page.tsx';

  assert.ok(existsSync(otherRequestPagePath), '기타출고요청 전용 페이지가 있어야 한다');
  const otherRequestPage = readFileSync(otherRequestPagePath, 'utf8');

  assert.match(manualPanel, /issueType:\s*'MANUAL'/, '수동 출고요청 생성 시 ISSUE_TYPE=MANUAL을 저장해야 한다');
  assert.match(issueRequestDto, /issueType\?:\s*string/, '출고요청 목록 조회 DTO는 issueType 필터를 받아야 한다');
  assert.match(issueRequestDto, /'PARTIAL'/, '출고요청 목록 조회 DTO는 부분출고 상태 필터를 허용해야 한다');
  assert.match(issueRequestDto, /검색어 \(요청번호, 요청자, 작업지시, 출고유형, 품목, 비고\)/, '검색어 설명은 실제 검색 범위와 같아야 한다');
  assert.match(issueRequestService, /issueType/, '목록 조회는 issueType 조건을 다뤄야 한다');
  assert.match(issueRequestService, /req\.issueType = :issueType/, '목록 조회는 ISSUE_TYPE 필터를 서버에서 적용해야 한다');
  assert.match(issueRequestService, /UPPER\(COALESCE\(req\.issueType/, '검색어는 수동요청 유형도 찾을 수 있어야 한다');
  assert.match(issueRequestService, /UPPER\(COALESCE\(req\.remark/, '검색어는 수동요청 비고도 찾을 수 있어야 한다');
  assert.match(issueRequestService, /MAT_ISSUE_REQUEST_ITEMS/, '검색어는 요청 품목 테이블까지 확인해야 한다');
  assert.match(issueRequestService, /ITEM_MASTERS/, '검색어는 품목명 검색을 위해 품목마스터까지 확인해야 한다');
  assert.match(issueRequestService, /UPPER\(item\.ITEM_CODE\) LIKE :search/, '검색어는 요청 품목코드를 찾을 수 있어야 한다');
  assert.match(issueRequestService, /UPPER\(COALESCE\(part\.ITEM_NAME/, '검색어는 요청 품목명을 찾을 수 있어야 한다');
  assert.match(menuConfig, /MAT_REQUEST_OTHER[\s\S]*menu\.material\.requestOther[\s\S]*\/material\/request-other/, '자재 메뉴에 기타출고요청 항목이 있어야 한다');
  assert.match(menuCodeValidator, /MAT_REQUEST_OTHER/, '백엔드 메뉴 코드 화이트리스트에 기타출고요청 코드가 있어야 한다');
  assert.match(menuSeed, /MAT_REQUEST_OTHER/, '메뉴 seed에 기타출고요청 코드가 있어야 한다');
  assert.match(pageRegistry, /case "\/material\/request-other"/, '탭 keep-alive page registry에 기타출고요청 경로가 있어야 한다');
  assert.match(otherRequestPage, /issueType:\s*'MANUAL'/, '기타출고요청 페이지 목록은 ISSUE_TYPE=MANUAL만 조회해야 한다');
  assert.doesNotMatch(otherRequestPage, /ManualIssueRequestPanel/, '기타출고요청 페이지는 별도 수동 요청 패널을 열면 안 된다');
  assert.match(otherRequestPage, /OtherIssueRequestDetailPanel/, '기타출고요청 페이지는 우측 상세 패널에서 신규 요청까지 처리해야 한다');
  assert.match(otherRequestPage, /RequestTable/, '기타출고요청 페이지는 요청번호 기준 목록을 표시해야 한다');
  assert.match(requestTable, /groupCode="ISSUE_TYPE"/, '요청 목록은 출고유형 배지를 표시해야 한다');
  assert.match(requestTable, /material\.request\.manualRequest/, '작업지시 없는 수동요청은 목록에서 수동요청으로 표시해야 한다');
  assert.match(requestTable, /itemSummary/, '요청 목록은 수동요청을 품목으로 구분할 수 있어야 한다');
});

test('/material/request-other 기타출고요청 상세는 우측 고정 패널로 표시한다', () => {
  const otherRequestPagePath = 'apps/frontend/src/app/(authenticated)/material/request-other/page.tsx';
  const detailPanelPath = 'apps/frontend/src/app/(authenticated)/material/request-other/components/OtherIssueRequestDetailPanel.tsx';

  assert.ok(existsSync(detailPanelPath), '기타출고요청 상세 고정 패널 컴포넌트가 있어야 한다');
  const otherRequestPage = readFileSync(otherRequestPagePath, 'utf8');
  const detailPanel = readFileSync(detailPanelPath, 'utf8');

  assert.doesNotMatch(otherRequestPage, /IssueRequestDetailModal/, '기타출고요청 상세는 모달로 열면 안 된다');
  assert.match(otherRequestPage, /OtherIssueRequestDetailPanel/, '기타출고요청 페이지는 우측 상세 패널을 렌더링해야 한다');
  assert.match(otherRequestPage, /request=\{detailTarget\}/, '선택한 출고요청을 상세 패널에 전달해야 한다');
  assert.match(otherRequestPage, /mode=\{panelMode\}/, '우측 상세 패널은 조회/신규 모드를 받아야 한다');
  assert.match(otherRequestPage, /onViewDetail=\{handleSelectRequest\}/, '목록 행 선택은 우측 상세 패널을 조회 모드로 갱신해야 한다');
  assert.match(otherRequestPage, /setDetailTarget\(requests\[0\]/, '목록 조회 후 첫 요청을 기본 상세 대상으로 세팅해야 한다');
  assert.match(detailPanel, /w-\[520px\] flex-shrink-0 border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl/, '상세 패널은 오른쪽 고정 패널 폭/경계/그림자 구조여야 한다');
  assert.match(detailPanel, /요청 품목 상세/, '상세 패널은 요청 품목 상세를 표시해야 한다');
  assert.match(detailPanel, /totalRemainQty/, '상세 패널은 잔여수량 요약을 표시해야 한다');
  assert.match(detailPanel, /api\.post\('\/material\/issue-requests'/, '우측 상세 패널에서 기타출고요청을 등록해야 한다');
  assert.match(detailPanel, /issueType:\s*'MANUAL'/, '우측 상세 패널 신규 요청은 ISSUE_TYPE=MANUAL로 저장해야 한다');
  assert.match(detailPanel, /PartSearchModal/, '우측 상세 패널 신규 요청은 공통 품목 선택창을 사용해야 한다');
  assert.match(detailPanel, /mode === 'create'/, '우측 상세 패널은 신규 요청 모드를 지원해야 한다');
});

test('기타출고관리는 프론트 메뉴와 백엔드 seed가 함께 등록되어야 한다', () => {
  const issueOtherMigration = readFileSync('apps/backend/src/migrations/2026-06-10_issue_other_menu_seed.sql', 'utf8');

  assert.match(menuConfig, /MAT_ISSUE_OTHER[\s\S]*menu\.material\.issueOther[\s\S]*\/material\/issue-other/, '자재 메뉴에 기타출고관리 항목이 있어야 한다');
  assert.match(menuCodeValidator, /MAT_ISSUE_OTHER/, '백엔드 메뉴 코드 화이트리스트에 기타출고관리 코드가 있어야 한다');
  assert.match(menuSeed, /MAT_ISSUE_OTHER/, '메뉴 seed에 기타출고관리 코드가 있어야 한다');
  assert.match(issueOtherMigration, /MENU_CODE='MAT_ISSUE_OTHER'/, '기타출고관리 DB seed migration이 있어야 한다');
  assert.match(issueOtherMigration, /\);\s*\//, '기타출고관리 DB seed migration은 oracle-db execute-file용 / 구분자를 가져야 한다');
});

test('출고관리 화면은 출고요청 생성 화면을 유지한 채 요청 유형별로 처리 대상을 분리한다', () => {
  assert.match(issueRequestsHook, /interface UseIssueRequestsOptions/, '출고요청 처리 훅은 화면별 조회 옵션을 받아야 한다');
  assert.match(issueRequestsHook, /issueType\?:\s*string/, '출고요청 처리 훅은 ISSUE_TYPE 서버 필터를 지원해야 한다');
  assert.match(issueRequestsHook, /excludeIssueTypes\?:\s*string\[\]/, '자재출고관리는 기타출고요청을 제외할 수 있어야 한다');
  assert.match(issueRequestsHook, /params\.set\('issueType', issueType\)/, 'ISSUE_TYPE 조건은 API query string으로 전달해야 한다');
  assert.match(issueRequestsHook, /excludeIssueTypeSet/, '클라이언트 보정 필터로 제외할 요청 유형을 분리해야 한다');
  assert.match(issueRequestTab, /interface IssueRequestTabProps/, '출고요청 처리 탭은 재사용 props를 가져야 한다');
  assert.match(issueRequestTab, /useIssueRequests\(\{[\s\S]*issueType[\s\S]*excludeIssueTypes/, '출고요청 처리 탭은 훅에 유형 조건을 전달해야 한다');
  assert.match(issuePage, /<IssueRequestTab[\s\S]*excludeIssueTypes=\{\['MANUAL'\]\}/, '자재출고관리는 기타출고요청(MANUAL)을 제외해야 한다');
  assert.match(issueOtherPage, /type TabKey = 'request' \| 'scan' \| 'history'/, '기타출고관리에는 기타출고요청 처리 탭이 있어야 한다');
  assert.match(issueOtherPage, /<IssueRequestTab[\s\S]*issueType="MANUAL"/, '기타출고관리는 MANUAL 요청만 처리해야 한다');
});
