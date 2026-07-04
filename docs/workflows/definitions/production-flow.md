---
workflowId: PROD_FLOW
title: 생산계획→작업지시→자재투입/실적→라벨→박스→입고 흐름
steps:
  - menu: PROD_MONTHLY_PLAN
    transitions: "DRAFT→CONFIRMED→CLOSED"
    produces: [JOB_ORDER]
  - menu: PROD_ORDER
    requires: [PROD_MONTHLY_PLAN]
    transitions: "WAITING→RUNNING→DONE"
    produces: [JOB_ORDER]
  - menu: PROD_INPUT_KIOSK
    requires: [PROD_ORDER]
    transitions: "JOB_ORDER WAITING→RUNNING"
    produces: [PROD_RESULT]
  - menu: PROD_RESULT
    requires: [PROD_ORDER]
    transitions: "RUNNING→DONE"
    produces: [FG_LABEL, SG_LABEL]
  - menu: PROD_KITTING
    requires: [PROD_RESULT]
    produces: [SG_LABEL]
  - menu: PROD_INPUT_ASSEMBLY
    requires: [PROD_KITTING]
    produces: [FG_LABEL]
  - menu: SHIP_PACK
    requires: [PROD_RESULT]
    transitions: "OPEN→CLOSED"
    produces: [BOX]
  - menu: PROD_RECEIVE
    requires: [SHIP_PACK]
    produces: [PRODUCT_STOCK]
troubleshooting:
  - symptom: "작업지시가 안 보임(입력키오스크/실적)"
    causes: [작업지시 상태가 WAITING/RUNNING 아님(HOLD/DONE/CANCELED), 설비에 다른 작업지시가 할당됨(assignableEquipCode 불일치), 품목유형(itemType) 필터 불일치]
    resolutions: [PROD_ORDER 화면에서 상태 확인, 설비-작업지시 매핑 해제 후 재선택, 작업지시 품목유형과 화면(조립/키팅) 대상 확인]
  - symptom: "생산실적 등록이 거절됨"
    causes: [작업지시가 HOLD 상태, 작업지시가 DONE/CANCELED로 이미 종결, 계획수량(planQty) 초과, 설비 BOM 부품 불일치]
    resolutions: [PROD_ORDER에서 홀딩해제, 상태 확인 후 신규 작업지시 발행, 수량 조정, 설비 장착 자재 확인]
  - symptom: "SG/FG 라벨이 발행되지 않음"
    causes: [라우팅(ROUTING_PROCESSES)의 해당 공정 issueLabelType이 SG/BUNDLE로 설정되지 않음, BOM 반제품 구성이 없음(단일공정 품목), FG_BARCODE_ISSUE_TIMING 설정이 기대와 다름(ON_PRODUCTION/PRE_ISSUE/ON_INSPECT)]
    resolutions: [MST_ROUTING에서 공정별 issueLabelType 확인, MST_BOM에서 SEMI_PRODUCT 자식 구성 확인, SYS_CONFIG에서 FG_BARCODE_ISSUE_TIMING 값 확인]
  - symptom: "포장(SHIP_PACK)에서 시리얼 추가가 거절됨"
    causes: [FG 시리얼이 검사 합격 상태가 아님, 시리얼의 품목과 박스 품목 불일치, 이미 다른 박스에 포장된 시리얼]
    resolutions: [QC_INSPECT/자주검사 결과 확인 후 재시도, 박스 생성 시 선택한 품목 재확인, FG 라벨 상태(SHIP_BOX_STOCK) 조회]
  - symptom: "제품입고(PROD_RECEIVE) 처리 후 재고에 반영되지 않음"
    causes: [박스가 아직 CLOSED 상태가 아님(포장 미마감), OQC 판정 대기/불합격으로 팔레트·출하 경로 차단, 입고창고 미지정]
    resolutions: [SHIP_PACK에서 박스 마감 확인, QC_OQC 판정 결과 확인, ReceivablePanel에서 입고창고 재선택]
relatedWorkflows: [MAT_FLOW, QC_FLOW, SHIP_FLOW, LABEL_FLOW]
---
## 단계별 설명

### 1. 월간생산계획(PROD_MONTHLY_PLAN)
생산의 시작점은 월별 생산계획이다. 계획은 `DRAFT`(초안)로 등록되며, 수정/삭제가 가능한 유일한 상태다. `CONFIRMED`(확정)로 전환되어야 작업지시 발행이 가능해지고, 모든 작업지시가 끝나면 `CLOSED`(마감)로 종료한다. 이 순서를 지키는 이유는 계획 대비 실적(발행수량 누적)을 잔량 기준으로 통제하기 위함이다.

### 2. 작업지시(PROD_ORDER)
확정된 계획에서 작업지시를 발행하거나, 계획 없이 직접 생성할 수도 있다. 작업지시는 `WAITING`(대기)로 시작해 작업 시작 시 `RUNNING`(진행), 완료 시 `DONE`으로 전이한다. `WAITING`/`RUNNING`에서는 `HOLD`(홀딩)로 실적·출하를 차단할 수 있다. 이 화면이 생산 전체 흐름의 축인 이유는 이후 모든 실적·자재투입·라벨발행이 작업지시 단위로 귀속되기 때문이다.

### 3. 입력키오스크(PROD_INPUT_KIOSK)
현장 작업자가 설비 점검, 소모품 수명확인, 자재투입, 실적등록을 한 화면에서 순서대로 처리한다. `WAITING` 상태 작업지시에 실적이 최초 등록되면 자동으로 `RUNNING`으로 승격된다. 담당 화면에서 하는 일은 실물 스캔 기반의 현장 데이터 입력이며, 뒤이어 나오는 생산실적(PROD_RESULT) API를 그대로 호출한다.

### 4. 생산실적(PROD_RESULT)
양품/불량 수량을 등록하고 완료 처리하면 `RUNNING→DONE`으로 전이하며, 공정재고 적재·금형 타수 증가·자재 자동차감·작업지시 자동완료 체크가 동시에 일어난다. 라우팅의 공정별 `issueLabelType`이 SG/BUNDLE이면 최초 공정 양품 실적 등록 시 SG_LABEL이 1회 자동 발행되고, FG_BARCODE_ISSUE_TIMING 설정에 따라 FG_LABEL이 실적 생성/시작/검사 시점에 발행될 수 있다.

### 5. 서브공정 키팅(PROD_KITTING)
반제품(SFG)을 여러 회로로 나누어 관리해야 하는 품목은 이전 공정 SFG 라벨을 스캔하고 BOM 기준으로 새 SFG를 발행한다. "키팅 실행"으로 `ISSUED` 상태의 새 SG_LABEL을 먼저 발행한 뒤, 실물 라벨을 스캔해 확정해야 genealogy(계보) 연결과 자재 소비, 재고 적재가 단일 트랜잭션으로 반영된다. 이 2단계 확정 구조는 발행과 실물 부착 사이의 오류(라벨 분실/오부착)를 막기 위함이다.

### 6. 조립 실적입력(PROD_INPUT_ASSEMBLY)
반제품 SFG를 스캔해 완제품(FG)을 조립하는 화면으로, PROD_KITTING과 동일한 서비스(subprocess-kitting.service)를 공유하는 거울상 화면이다. FG 발행 후 실물 스캔으로 확정하면 SG_LABELS 소비, FG_LABELS 승격, PROD_RESULTS/PRODUCT_GENEALOGY 기록, PRODUCT_STOCKS(FG_WIP) 적재가 한 번에 처리된다.

### 7. 포장(SHIP_PACK)
검사 합격한 FG 시리얼을 박스 단위로 스캔해 담는다. 박스를 마감(`OPEN→CLOSED`)하면 OQC 검사요청이 자동 생성되고 FG_LABELS 상태가 `PACKED`로 바뀐다. 생산 실적과 출하 사이의 완충 단위가 박스이기 때문에, 이 단계부터는 시리얼이 아니라 박스 단위로 관리가 넘어간다.

### 8. 제품입고(PROD_RECEIVE)
포장 마감된 박스를 스캔해 입고창고에 일괄 입고 처리한다. 이 단계로 생산 흐름이 종료되고 재고(PRODUCT_STOCKS)가 확정되며, 이후 출하 흐름(SHIP_FLOW)의 입력값이 된다.
