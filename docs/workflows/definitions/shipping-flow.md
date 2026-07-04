---
workflowId: SHIP_FLOW
title: 출하지시→피킹/팔레트→출하확정 흐름
steps:
  - menu: SHIP_ORDER
    transitions: "DRAFT→CONFIRMED→SHIPPING→SHIPPED"
  - menu: SHIP_PACK
    requires: [SHIP_ORDER]
    transitions: "BOX_STATUS OPEN→CLOSED"
    produces: [BOX]
  - menu: SHIP_PACK_RESULT
    requires: [SHIP_PACK]
  - menu: QC_OQC
    requires: [SHIP_PACK]
    transitions: "PENDING→IN_PROGRESS→PASS/FAIL"
  - menu: SHIP_PALLET
    requires: [QC_OQC]
    transitions: "PALLET_STATUS OPEN→CLOSED→LOADED→SHIPPED"
  - menu: SHIP_BOX_STOCK
    requires: [SHIP_PACK]
  - menu: SHIP_CONFIRM
    requires: [SHIP_ORDER, SHIP_PALLET]
    transitions: "SHIPMENT_STATUS PREPARING→LOADED→SHIPPED→DELIVERED"
  - menu: SHIP_HISTORY
    requires: [SHIP_CONFIRM]
  - menu: SHIP_RETURN
    requires: [SHIP_CONFIRM]
troubleshooting:
  - symptom: "포장(SHIP_PACK)에서 박스를 마감할 수 없음"
    causes: [박스 수량이 0(qty=0), 이미 CLOSED/SHIPPED 상태]
    resolutions: [시리얼을 1개 이상 추가한 뒤 마감, 현재 박스 상태 확인]
  - symptom: "팔레트(SHIP_PALLET)에 박스를 적재할 수 없음"
    causes: [박스가 OQC 미완료/불합격 상태, 박스가 이미 다른 팔레트에 할당됨, 박스가 아직 CLOSED 상태가 아님]
    resolutions: [QC_OQC에서 판정 결과 확인, SHIP_BOX_STOCK에서 박스 할당 현황 확인, SHIP_PACK에서 박스 마감 여부 확인]
  - symptom: "출하확정(SHIP_CONFIRM)에서 적재완료 처리가 안 됨"
    causes: [출하에 할당된 팔레트가 없음, 출하 상태가 PREPARING이 아님]
    resolutions: [SHIP_PALLET에서 팔레트를 출하에 먼저 할당, SHIP_CONFIRM에서 현재 출하 상태 확인]
  - symptom: "출하처리(mark-shipped)가 거절됨"
    causes: [OQC 미완료/불합격 박스가 팔레트에 포함됨, 팔레트 바코드 스캔 검증 미완료, 재고(PRODUCT_STOCKS) 부족]
    resolutions: [QC_OQC 판정 확인 후 재적재, LOADED 상태에서 바코드 스캔 검증 수행, INV_PRODUCT_STOCK/PROD_FG_STOCK에서 재고 확인]
  - symptom: "출하 역분개(reverse)가 안 됨"
    causes: [ERP 동기화가 이미 완료됨(erpSyncYn=Y), 출하 상태가 SHIPPED가 아님(이미 DELIVERED로 진행)]
    resolutions: [ERP 동기화 상태 확인 후 필요 시 ERP측 선 정리, SHIP_HISTORY에서 현재 출하 상태 확인]
relatedWorkflows: [PROD_FLOW, QC_FLOW]
---
## 단계별 설명

### 1. 출하지시(SHIP_ORDER)
고객사에 출하할 품목과 수량을 지정하는 지시서다. `DRAFT`(작성중)에서 품목을 추가한 뒤 `CONFIRMED`(확정)로 전환해야 실제 출하가 가능하다. 확정 이후에는 수정/삭제가 불가능한데, 이는 출하 약속(고객 PO)이 픽스된 이후의 변경을 통제하기 위함이다. 일부만 출하되면 `SHIPPING`, 전량 출하되면 `SHIPPED`/`CLOSED`로 자동 전이한다.

### 2. 포장(SHIP_PACK)
검사 합격된 완제품 시리얼(FG 바코드)을 박스에 담는다. 박스를 마감하면 `OPEN→CLOSED`로 전이하며 동시에 OQC 검사요청이 자동 생성된다. 생산 흐름(PROD_FLOW)에서 넘어온 개별 시리얼을 박스라는 물류 단위로 묶는 첫 단계다.

### 3. 포장실적(SHIP_PACK_RESULT)
완료된 포장 실적을 조회 전용으로 확인한다. 박스별 상태(OPEN/CLOSED/SHIPPED), 팔레트 할당 여부, OQC 상태를 한눈에 확인해 다음 단계 진행 여부를 판단하는 근거로 쓰인다.

### 4. OQC검사(QC_OQC)
박스 마감 시 자동 생성된 검사요청을 실행해 PASS/FAIL을 판정한다. FAIL이면 해당 박스는 이후 팔레트 적재와 출하 대상에서 제외된다. 출하 전 마지막 품질 게이트 역할을 한다.

### 5. 팔레트관리(SHIP_PALLET)
OQC 합격(PASS) 박스만 팔레트에 적재할 수 있다. `OPEN`(적재중)에서 박스를 담고 `CLOSED`(마감)로 전환한 뒤 출하에 할당하면 `LOADED`가 된다. 출하 완료 시 `SHIPPED`로 종결된다. 박스 단위가 아닌 팔레트 단위로 출하를 관리하는 이유는 실제 상차/배송이 팔레트 단위로 이뤄지기 때문이다.

### 6. 박스입고재고(SHIP_BOX_STOCK)
FG_LABELS 기준으로 박스별 미출하 재고를 조회한다. 팔레트 적재 전, 어떤 박스가 아직 출하되지 않았는지 확인하는 조회 화면이다.

### 7. 출하확정(SHIP_CONFIRM)
팔레트를 출하에 적재하고 `PREPARING→LOADED→SHIPPED→DELIVERED` 상태를 관리한다. `LOADED→SHIPPED` 전환에는 팔레트 바코드 스캔 검증이 필수이며, 출하 처리 시 재고 차감(PRODUCT_STOCKS)과 FG_LABELS 상태 갱신이 함께 일어난다. ERP 동기화가 완료되면 역분개(취소)가 불가능해진다.

### 8. 출하이력(SHIP_HISTORY)
출하지시 기준으로 전체 출하 이력을 조회 전용으로 확인한다.

### 9. 반품(SHIP_RETURN)
출하 완료된 제품에 대한 반품을 등록하고 관리한다. 출하확정(SHIP_CONFIRM) 이후 발생하는 역흐름으로, 정상 출하 흐름과 별도로 취급된다.
