---
workflowId: MAT_FLOW
title: 자재 입하→IQC→라벨→창고→불출/투입 흐름
steps:
  - menu: MAT_ARRIVAL
    transitions: "PO_LINE_STATUS OPEN/PARTIAL→CLOSE"
    produces: [MAT_LOT]
  - menu: QC_IQC
    requires: [MAT_ARRIVAL]
    transitions: "IQC_STATUS PENDING→PASS/FAIL"
  - menu: MAT_RECEIVE_LABEL
    requires: [QC_IQC]
    transitions: "MAT_LOT_STATUS 신규발번"
    produces: [MAT_LABEL, MAT_LOT]
  - menu: MAT_RECEIVE
    requires: [MAT_RECEIVE_LABEL]
    transitions: "ARRIVAL_RESULT_STATUS ARRIVED→RECEIVED"
  - menu: MAT_LOT
    requires: [MAT_RECEIVE]
  - menu: MAT_ISSUE
    requires: [MAT_RECEIVE]
    transitions: "MAT_ISSUE_STATUS 없음→DONE"
troubleshooting:
  - symptom: "입하는 등록됐는데 라벨 발행 화면(MAT_RECEIVE_LABEL)에 안 보임"
    causes: [IQC 판정이 PASS가 아님(PENDING/FAIL/HOLD), 이미 라벨 발행 이력(LABEL_PRINT_LOGS)이 있는 입하건]
    resolutions: [QC_IQC에서 판정 상태 확인, QC_IQC_HISTORY에서 기존 발행 이력 확인]
  - symptom: "자재입고(MAT_RECEIVE)에서 입고 처리가 차단됨"
    causes: [검사성적서 업로드가 필요한 품목인데 미첨부(iqcYn=Y), IQC 판정이 PASS가 아님, PO 수량 오차율(toleranceRate) 초과]
    resolutions: [QC_IQC_HISTORY에서 성적서 업로드, QC_IQC 판정 확인, PUR_PO에서 PO 수량/오차율 확인]
  - symptom: "자재출고(MAT_ISSUE)가 거절됨"
    causes: [LOT의 IQC 상태가 PASS 아님, LOT 상태가 HOLD, LOT 재고가 이미 DEPLETED(소진), 요청 수량이 가용재고 초과]
    resolutions: [MAT_LOT에서 IQC/상태 확인, MAT_HOLD에서 보류 해제, INV_MAT_STOCK에서 실제 가용재고 확인]
  - symptom: "LOT 분할/병합이 안 됨"
    causes: [입고가 아직 완료되지 않은 LOT, 예약수량(reservedQty)이 있는 LOT, 이미 출고 이력이 있는 LOT, 품목이 분할불가(isSplittable=N)로 설정됨]
    resolutions: [MAT_RECEIVE에서 입고 완료 여부 확인, 예약/출고 이력 정리 후 재시도, MST_PART에서 분할가능 여부 확인]
  - symptom: "입고취소(MAT_RECEIPT_CANCEL)에서 취소 버튼이 안 보임"
    causes: [이미 취소된 트랜잭션(cancelRefId 존재), 자재출고/생산실적/FG 라벨 등 뒤 공정이 이미 진행됨]
    resolutions: [거래 상태 재확인, 뒤 공정(MAT_ISSUE/PROD_RESULT) 역처리 후 재시도]
relatedWorkflows: [PROD_FLOW, QC_FLOW, LABEL_FLOW]
---
## 단계별 설명

### 1. 입하등록(MAT_ARRIVAL)
자재 흐름의 시작점으로, PO 라인 단위 입하 또는 수동 입하를 등록한다. 입하 시 품목의 `LOT_UNIT_QTY` 기준으로 MAT_LOT(시리얼)을 N건 발급하고 수불원장(StockTransaction, MAT_IN)을 기록한다. PO 라인은 입하수량 누적에 따라 `OPEN→PARTIAL→CLOSE`로 전이한다. 이 단계에서 시리얼을 먼저 발급하는 이유는 이후 IQC·라벨·입고 전 과정이 시리얼(matUid) 단위로 추적되기 때문이다.

### 2. IQC검사(QC_IQC)
입하번호+품목 단위(또는 개별 LOT 단위)로 샘플 검사를 등록하고 판정한다. `PASS`면 유효기간이 자동 계산되고 필요 시 파괴검사 시료가 자동 출고되며, `FAIL`이면 해당 시리얼 전량이 불용창고(DEFECT)로 자동 이동한다. IQC 판정이 이후 모든 단계(라벨발행/입고/출고)의 선행 게이트 역할을 하므로, 입하와 입고 사이에 반드시 이 단계를 거친다.

### 3. 입하라벨발행(MAT_RECEIVE_LABEL)
IQC 합격(PASS)된 입하건만 조회 대상이 되며, 선택 시 자재 시리얼(matUid)을 채번하고 80x40mm 라벨을 발행한다. `IQC_AUTO_RECEIVE` 시스템 설정이 켜져 있으면 라벨 발행과 동시에 기본창고로 자동 입고까지 처리된다. 라벨 발행이 곧 실물 부착 시점이므로, 이 단계 이후부터 창고 실사/스캔 투입이 가능해진다.

### 4. 자재입고(MAT_RECEIVE)
바코드 스캔 방식으로 IQC 합격 건을 입고 확정한다. 검사성적서 업로드가 필수인 품목(iqcYn=Y)은 성적서 미첨부 시 입고가 차단된다. 입고 시 입하창고 재고를 차감하고 입고창고 재고를 증가시켜, 이 시점부터 재고가 창고관리 대상(INV_MAT_STOCK)으로 전환된다.

### 5. LOT조회(MAT_LOT)
입하→IQC→입고 전 과정을 추적하는 기준점이다. 시리얼별 현재 상태(NORMAL/HOLD/DEPLETED/SPLIT/MERGED)와 IQC 상태를 조회하며, 필요 시 LOT분할(MAT_LOT_SPLIT)·병합(MAT_LOT_MERGE)으로 파생 시리얼을 만들 수 있다.

### 6. 자재출고(MAT_ISSUE)
출고요청 기반/수동/바코드스캔 방식으로 자재를 생산 또는 기타 용도로 출고한다. IQC 미합격, HOLD, 소진(DEPLETED) 상태의 LOT는 출고할 수 없다. 이 단계에서 출고된 자재는 생산 흐름(PROD_FLOW)의 자재투입 입력값이 되며, 재고가 0이 되면 LOT 상태가 자동으로 DEPLETED로 바뀐다.
