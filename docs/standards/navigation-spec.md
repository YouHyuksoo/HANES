# 네비게이션 스펙

## 목적

이 문서는 웹 사이드바, 상단 헤더, PDA 메뉴를 포함한 네비게이션 구조의 구현 기준을 정의한다.
메뉴 데이터 구조, 권한 필터링, 반응형 동작, 라우트 연동 방식을 규격으로 고정하는 문서다.

## 기준 코드

- 메뉴 정의: `apps/frontend/src/config/menuConfig.ts`
- 웹 사이드바: `apps/frontend/src/components/layout/Sidebar.tsx`
- 사이드바 렌더링: `apps/frontend/src/components/layout/SidebarMenu.tsx`
- 상단 헤더: `apps/frontend/src/components/layout/Header.tsx`
- PDA 메뉴 구성: `apps/frontend/src/components/pda/pdaMenuConfig.ts`
- PDA 메뉴 렌더링: `apps/frontend/src/components/pda/PdaMenuGrid.tsx`
- 인증별 메뉴 권한 데이터: `apps/frontend/src/stores/authStore.ts`

## 메뉴 데이터 구조

### 웹 메뉴

- `code`: 권한 체크용 고유 코드
- `labelKey`: i18n 번역 키
- `path`: 라우트 경로
- `icon`: 최상위 메뉴 아이콘
- `children`: 하위 메뉴 배열

### 설계 원칙

1. 메뉴 표시 기준은 하드코딩 JSX가 아니라 설정 배열이어야 한다.
2. 권한 체크 기준은 라우트가 아니라 메뉴 코드여야 한다.
3. 번역 라벨은 `labelKey` 기준으로 렌더링한다.
4. 상위 메뉴는 자식 메뉴 중 하나라도 권한이 있으면 표시 가능해야 한다.

## 권한 모델

### 웹 메뉴 권한

- 로그인 응답과 `me` 응답은 `allowedMenus` 배열을 내려준다.
- `ADMIN`은 예외적으로 전체 메뉴 허용으로 본다.
- 일반 사용자는 `allowedMenus`에 없는 메뉴를 볼 수 없다.

### PDA 메뉴 권한

- PDA는 `pdaAllowedMenus` 배열을 별도로 사용한다.
- PDA 작업자 권한은 일반 웹 권한과 분리한다.

## 웹 사이드바 스펙

### 상태 정의

- `isOpen`: 모바일 오버레이 표시 여부
- `collapsed`: 데스크톱 축소 여부
- `expandedMenus`: 펼쳐진 상위 메뉴 목록

### 필수 동작

1. 데스크톱에서는 고정 사이드바를 사용한다.
2. 모바일에서는 오버레이 사이드바를 사용한다.
3. 현재 경로에 해당하는 메뉴는 활성 상태를 표시한다.
4. 축소 상태에서는 상위 아이콘 중심으로 보인다.
5. 모바일 오픈 시 배경 오버레이를 함께 띄운다.
6. 상위 메뉴 클릭은 자식 펼침/접힘으로 동작한다.

## 상단 헤더 스펙

### 포함 요소

- 모바일 메뉴 토글
- 로고
- 데스크톱 사이드바 접기/펼치기 버튼
- 검색 입력
- 알림
- 컬러 테마 토글
- 라이트/다크 토글
- 언어 전환
- 회사/사업장 표시
- 사용자 드롭다운 메뉴

### 사용자 메뉴 최소 항목

- 프로필
- 설정
- 로그아웃

## PDA 메뉴 스펙

1. 웹 메뉴와 분리된 별도 메뉴 구성을 사용한다.
2. 카드형 또는 그리드형 메뉴를 우선한다.
3. 작업자 권한 기준으로 노출 여부를 제어한다.
4. 스캔 흐름 중심 메뉴를 상단에 둔다.

## 라우트 연동 규칙

1. URL과 메뉴 코드를 역으로 찾을 수 있어야 한다.
2. 보호 라우트는 현재 경로에서 메뉴 코드를 찾아 권한을 다시 검증한다.
3. 메뉴와 실제 라우트가 어긋나면 보호 로직이 깨지므로, 둘은 한 소스에서 관리해야 한다.

## 반응형 규칙

- `lg` 이상: 고정 사이드바
- `lg` 미만: 슬라이드인 오버레이
- 모바일에서는 메뉴 선택 후 자동으로 닫히는 동작을 권장한다.

## 접근성 규칙

1. 메뉴 토글 버튼에는 `aria-label`을 둔다.
2. 사용자 드롭다운은 `aria-haspopup`, `aria-expanded`를 둔다.
3. ESC 키로 닫히는 동작을 지원한다.
4. 오버레이 클릭으로 닫히는 동작을 제공한다.

## 좋은 예시

- 메뉴 구조를 `menuConfig`에 두고, 렌더링은 `Sidebar`와 `SidebarMenu`가 담당하는 구조
- 로그인 후 `allowedMenus`, `pdaAllowedMenus`를 받아 웹/PDA를 각각 제한하는 구조

## HANES 코드 예시

- 메뉴 설정: `apps/frontend/src/config/menuConfig.ts`
- 웹 사이드바: `apps/frontend/src/components/layout/Sidebar.tsx`
- 헤더: `apps/frontend/src/components/layout/Header.tsx`
- 인증 스토어: `apps/frontend/src/stores/authStore.ts`

## 나쁜 예시

- 각 페이지에서 메뉴를 직접 조건 분기하여 렌더링하는 방식
- 권한 체크를 문자열 라우트 비교만으로 처리하는 방식
- PDA와 웹 메뉴를 같은 권한 배열로 억지로 공유하는 방식

## 적용 체크리스트

1. 메뉴 데이터 구조가 설정 파일로 분리됐는가
2. 메뉴 코드와 라우트 매핑 함수가 있는가
3. 웹과 PDA 권한 배열이 분리됐는가
4. 모바일 오버레이와 데스크톱 접힘 동작이 분리됐는가
5. 사용자 메뉴와 로그아웃 흐름이 헤더에 통합됐는가

## AI 입력 순서에서의 역할

- `ui-screen-patterns.md` 뒤에 읽는다.
- 공통 레이아웃과 메뉴 구조를 생성할 때 기준이 되는 횡단 기능 스펙이다.

---

## 3. 웹 사이트 메뉴 구성 표 (실제 구현 기준)

현재 소스 코드(`apps/frontend/src/config/menuConfig.ts`)에 구현된 전체 메뉴 분류 및 라우팅 명세는 다음과 같다.

| 대분류 (Code) | 소분류 (Code) | 라벨 번역 키 | 라우트 경로 (Path) |
| :--- | :--- | :--- | :--- |
| **DASHBOARD** | - | `menu.dashboard` | `/dashboard` |
| **WORKFLOW** | - | `menu.workflow` | `/workflow` |
| **MONITORING** | MON_EQUIP_STATUS | `menu.equipment.status` | `/equipment/status` |
| **MASTER** (기준정보) | MST_PART | `menu.master.part` | `/master/part` |
| | MST_BOM | `menu.master.bom` | `/master/bom` |
| | MST_PARTNER | `menu.master.partner` | `/master/partner` |
| | EQUIP_MASTER | `menu.equipment.master` | `/master/equip` |
| | MST_PROCESS | `menu.master.process` | `/master/process` |
| | MST_PROD_LINE | `menu.master.prodLine` | `/master/prod-line` |
| | MST_ROUTING | `menu.master.routing` | `/master/routing` |
| | MST_WORK_CALENDAR | `menu.master.workCalendar` | `/master/work-calendar` |
| | MST_WORKER | `menu.master.worker` | `/master/worker` |
| | MST_WORK_INST | `menu.master.workInstruction` | `/master/work-instruction` |
| | MST_WAREHOUSE | `menu.master.warehouse` | `/master/warehouse` |
| | MST_LABEL | `menu.master.label` | `/master/label` |
| | MST_VENDOR_BARCODE | `menu.master.vendorBarcode` | `/master/vendor-barcode` |
| | MST_PROCESS_CAPA | `menu.master.processCapa` | `/master/process-capa` |
| | SYS_DOCUMENT | `menu.system.document` | `/system/document` |
| **INVENTORY** (자재재고) | INV_MAT_STOCK | `menu.inventory.matStock` | `/inventory/material-stock` |
| | INV_TRANSACTION | `menu.inventory.transaction` | `/inventory/transaction` |
| | INV_MAT_PHYSICAL_INV | `menu.inventory.matPhysicalInv` | `/inventory/material-physical-inv` |
| | INV_MAT_PHYSICAL_INV_HISTORY | `menu.inventory.matPhysicalInvHistory` | `/inventory/material-physical-inv-history` |
| | INV_ARRIVAL_STOCK | `menu.inventory.arrivalStock` | `/material/arrival-stock` |
| | MAT_HOLD | `menu.material.hold` | `/material/hold` |
| **PRODUCT_INVENTORY** | INV_PRODUCT_STOCK | `menu.inventory.productStock` | `/inventory/stock` |
| | INV_PRODUCT_PHYSICAL_INV | `menu.inventory.productPhysicalInv` | `/inventory/product-physical-inv` |
| | INV_PRODUCT_PHYSICAL_INV_HISTORY | `menu.inventory.productPhysicalInvHistory` | `/inventory/product-physical-inv-history` |
| | PROD_HOLD | `menu.productInventory.hold` | `/inventory/product-hold` |
| **PRODUCT_MGMT** | PROD_RECEIVE | `menu.productMgmt.receive` | `/product/receive` |
| | PROD_RECEIPT_CANCEL | `menu.productMgmt.receiptCancel` | `/product/receipt-cancel` |
| | PROD_ISSUE | `menu.productMgmt.issue` | `/product/issue` |
| | PROD_ISSUE_CANCEL | `menu.productMgmt.issueCancel` | `/product/issue-cancel` |
| **MATERIAL** (자재관리) | MAT_ARRIVAL | `menu.material.arrival` | `/material/arrival` |
| | MAT_RECEIVE_LABEL | `menu.material.receiveLabel` | `/material/receive-label` |
| | MAT_RECEIVE | `menu.material.receive` | `/material/receive` |
| | MAT_RECEIVE_HISTORY | `menu.material.receiveHistory` | `/material/receive-history` |
| | MAT_REQUEST | `menu.material.request` | `/material/request` |
| | MAT_ISSUE | `menu.material.issue` | `/material/issue` |
| | MAT_LOT | `menu.material.lot` | `/material/lot` |
| | MAT_LOT_SPLIT | `menu.material.lotSplit` | `/material/lot-split` |
| | MAT_LOT_MERGE | `menu.material.lotMerge` | `/material/lot-merge` |
| | MAT_SHELF_LIFE | `menu.material.shelfLife` | `/material/shelf-life` |
| | MAT_SCRAP | `menu.material.scrap` | `/material/scrap` |
| | MAT_ADJUSTMENT | `menu.material.adjustment` | `/material/adjustment` |
| | MAT_MISC_RECEIPT | `menu.material.miscReceipt` | `/material/misc-receipt` |
| | MAT_RECEIPT_CANCEL | `menu.material.receiptCancel` | `/material/receipt-cancel` |
| **PURCHASING** | PUR_PO | `menu.purchasing.po` | `/material/po` |
| | PUR_PO_STATUS | `menu.purchasing.poStatus` | `/material/po-status` |
| **PRODUCTION** (생산관리) | PROD_MONTHLY_PLAN | `menu.production.monthlyPlan` | `/production/monthly-plan` |
| | PROD_SIMULATION | `menu.production.simulation` | `/production/simulation` |
| | PROD_ORDER | `menu.production.order` | `/production/order` |
| | PROD_RESULT | `menu.production.result` | `/production/result` |
| | PROD_PROGRESS | `menu.production.progress` | `/production/progress` |
| | PROD_INPUT_MANUAL | `menu.production.inputManual` | `/production/input-manual` |
| | PROD_INPUT_KIOSK | `menu.production.inputKiosk` | `/production/input-kiosk` |
| | PROD_INPUT_MACHINE | `menu.production.inputMachine` | `/production/input-machine` |
| | PROD_INPUT_INSPECT | `menu.production.inputInspect` | `/production/input-inspect` |
| | PROD_INPUT_EQUIP | `menu.production.inputEquip` | `/production/input-equip` |
| | PROD_RESULT_SUMMARY | `menu.production.resultSummary` | `/production/result-summary` |
| | PROD_WIP_STOCK | `menu.production.wipStock` | `/production/wip-stock` |
| | QC_REWORK | `menu.quality.rework` | `/quality/rework` |
| | QC_REWORK_HISTORY | `menu.quality.reworkHistory` | `/quality/rework-history` |
| | PROD_REPAIR | `menu.production.repair` | `/production/repair` |
| **INSPECTION** | INSP_RESULT | `menu.inspection.result` | `/inspection/result` |
| | INSP_HISTORY | `menu.inspection.history` | `/inspection/history` |
| | INSP_PROTOCOL | `menu.inspection.protocol` | `/inspection/protocol` |
| **QUALITY** (품질관리) | QC_IQC_ITEM | `menu.master.iqcItem` | `/master/iqc-item` |
| | QC_IQC | `menu.material.iqc` | `/material/iqc` |
| | QC_IQC_HISTORY | `menu.material.iqcHistory` | `/material/iqc-history` |
| | QC_DEFECT | `menu.quality.defect` | `/quality/defect` |
| | QC_REWORK_INSPECT | `menu.quality.reworkInspect` | `/quality/rework-inspect` |
| | QC_INSPECT | `menu.quality.inspect` | `/quality/inspect` |
| | QC_REQUEST_INSPECT | `menu.quality.requestInspect` | `/quality/request-inspect` |
| | QC_SELF_INSPECT_HISTORY | `menu.quality.selfInspectHistory` | `/quality/self-inspect-history` |
| | QC_SAMPLE_INSPECT | `menu.production.sampleInspect` | `/production/sample-inspect` |
| | QC_OQC | `menu.quality.oqc` | `/quality/oqc` |
| | QC_OQC_HISTORY | `menu.quality.oqcHistory` | `/quality/oqc-history` |
| | QC_TRACE | `menu.quality.trace` | `/quality/trace` |
| | QC_CHANGE | `menu.quality.changeControl` | `/quality/change-control` |
| | QC_COMPLAINT | `menu.quality.complaint` | `/quality/complaint` |
| | QC_CAPA | `menu.quality.capa` | `/quality/capa` |
| | QC_FAI | `menu.quality.fai` | `/quality/fai` |
| | QC_PPAP | `menu.quality.ppap` | `/quality/ppap` |
| | QC_SPC | `menu.quality.spc` | `/quality/spc` |
| | QC_CONTROL_PLAN | `menu.quality.controlPlan` | `/quality/control-plan` |
| | QC_AUDIT | `menu.quality.audit` | `/quality/audit` |
| | SYS_TRAINING | `menu.system.training` | `/system/training` |
| **EQUIPMENT** (설비관리) | EQ_MOLD_MGMT | `menu.equipment.mold` | `/equipment/mold-mgmt` |
| | EQUIP_INSPECT_ITEM_MASTER | `menu.equipment.inspectItemMaster` | `/master/equip-inspect-item` |
| | EQUIP_INSPECT_ITEM | `menu.master.equipInspect` | `/master/equip-inspect` |
| | EQUIP_INSPECT_CALENDAR | `menu.equipment.dailyInspectCalendar` | `/equipment/inspect-calendar` |
| | EQUIP_DAILY | `menu.equipment.dailyInspect` | `/equipment/daily-inspect` |
| | EQUIP_PERIODIC_CALENDAR | `menu.equipment.periodicInspectCalendar` | `/equipment/periodic-inspect-calendar` |
| | EQUIP_PERIODIC | `menu.equipment.periodicInspect` | `/equipment/periodic-inspect` |
| | EQUIP_HISTORY | `menu.equipment.inspectHistory` | `/equipment/inspect-history` |
| | EQUIP_PM_PLAN | `menu.equipment.pmPlan` | `/equipment/pm-plan` |
| | EQUIP_PM_CALENDAR | `menu.equipment.pmCalendar` | `/equipment/pm-calendar` |
| | EQUIP_PM_RESULT | `menu.equipment.pmResult` | `/equipment/pm-result` |
| **GAUGE_MGMT** | GAUGE_MASTER | `menu.gauge.master` | `/master/gauge` |
| | GAUGE_CALIBRATION | `menu.gauge.calibration` | `/quality/msa` |
| | GAUGE_CALIBRATION_HISTORY | `menu.gauge.calibrationHistory` | `/equipment/calibration-history` |
| **SHIPPING** (출하관리) | SHIP_PACK_RESULT | `menu.production.packResult` | `/production/pack-result` |
| | SHIP_PACK | `menu.shipping.pack` | `/shipping/pack` |
| | SHIP_PALLET | `menu.shipping.pallet` | `/shipping/pallet` |
| | SHIP_CONFIRM | `menu.shipping.confirm` | `/shipping/confirm` |
| | SHIP_ORDER | `menu.shipping.order` | `/shipping/order` |
| | SHIP_HISTORY | `menu.shipping.history` | `/shipping/history` |
| | SHIP_RETURN | `menu.shipping.return` | `/shipping/return` |
| **SALES** | SALES_CUST_PO | `menu.sales.customerPo` | `/sales/customer-po` |
| | SALES_CUST_PO_STATUS | `menu.sales.customerPoStatus` | `/sales/customer-po-status` |
| **CUSTOMS** | CUST_ENTRY | `menu.customs.entry` | `/customs/entry` |
| | CUST_STOCK | `menu.customs.stock` | `/customs/stock` |
| | CUST_USAGE | `menu.customs.usage` | `/customs/usage` |
| **CONSUMABLES** | CONS_MASTER | `menu.consumables.master` | `/consumables/master` |
| | CONS_LABEL | `menu.consumables.label` | `/consumables/label` |
| | CONS_RECEIVING | `menu.consumables.receiving` | `/consumables/receiving` |
| | CONS_ISSUING | `menu.consumables.issuing` | `/consumables/issuing` |
| | CONS_STOCK | `menu.consumables.stock` | `/consumables/stock` |
| | CONS_LIFE | `menu.consumables.life` | `/consumables/life` |
| | CONS_MOUNT | `menu.consumables.mount` | `/consumables/mount` |
| **OUTSOURCING** | OUT_VENDOR | `menu.outsourcing.vendor` | `/outsourcing/vendor` |
| | OUT_ORDER | `menu.outsourcing.order` | `/outsourcing/order` |
| | OUT_RECEIVE | `menu.outsourcing.receive` | `/outsourcing/receive` |
| **INTERFACE** | IF_DASHBOARD | `menu.interface.dashboard` | `/interface/dashboard` |
| | IF_LOG | `menu.interface.log` | `/interface/log` |
| | IF_MANUAL | `menu.interface.manual` | `/interface/manual` |
| **SYSTEM** (시스템관리) | SYS_COMPANY | `menu.master.company` | `/master/company` |
| | SYS_DEPT | `menu.system.department` | `/system/department` |
| | SYS_USER | `menu.system.users` | `/system/users` |
| | SYS_ROLE | `menu.system.roles` | `/system/roles` |
| | SYS_PDA_ROLE | `menu.system.pdaRoles` | `/system/pda-roles` |
| | SYS_COMM | `menu.system.commConfig` | `/system/comm-config` |
| | SYS_CONFIG | `menu.system.config` | `/system/config` |
| | SYS_CODE | `menu.master.code` | `/master/code` |
| | SYS_SCHEDULER | `scheduler.title` | `/system/scheduler` |
| | SYS_MENU_CATEGORY | `menu.system.menuCategory` | `/system/menu-categories` |
| | SYS_SCREEN_REQ | `menu.system.screenRequirements` | `/system/screen-requirements` |
| | SYS_IMPR_REQ | `menu.system.improvementRequests` | `/system/improvement-requests` |
