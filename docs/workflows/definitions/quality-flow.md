---
workflowId: QC_FLOW
title: 검사(IQC/공정/출하)→불량 처리 흐름
steps:
  - menu: QC_IQC
    transitions: "IQC_STATUS PENDING→PASS/FAIL"
  - menu: QC_INSPECT
    requires: [QC_IQC]
    transitions: "PASS_YN Y/N"
  - menu: QC_DEFECT
    requires: [QC_INSPECT]
    transitions: "WAIT→REPAIR/REWORK/SCRAP→DONE"
  - menu: QC_REWORK
    requires: [QC_DEFECT]
    transitions: "REGISTERED→QC_PENDING→PROD_PENDING→APPROVED→IN_PROGRESS→INSPECT_PENDING"
  - menu: QC_REWORK_INSPECT
    requires: [QC_REWORK]
    transitions: "INSPECT_PENDING→PASS/FAIL/SCRAP"
  - menu: QC_REWORK_HISTORY
    requires: [QC_REWORK_INSPECT]
  - menu: QC_OQC
    transitions: "PENDING→IN_PROGRESS→PASS/FAIL"
  - menu: QC_OQC_HISTORY
    requires: [QC_OQC]
troubleshooting:
  - symptom: "IQC 판정을 취소할 수 없음"
    causes: [입고(MAT_RECEIVING)가 이미 DONE 상태로 완료됨, 파괴검사 시료가 이미 자동출고됨, FAIL 취소인데 불용창고 재고가 이미 변경되어 원복 불가]
    resolutions: [QC_IQC_HISTORY에서 입고 여부 확인 후 역처리, 시료 출고 이력 정리, 수동 재고 조정 필요 여부 확인]
  - symptom: "불량(QC_DEFECT) 상태를 바꿀 수 없음"
    causes: [재작업(QC_REWORK)이 이미 연결되어 직접 처리 불가, 이미 SCRAP/DONE으로 종결된 건, 상태 전이 매트릭스에 없는 전이 시도(WAIT→DONE 직행 등)]
    resolutions: [연결된 재작업 지시를 먼저 정리, 종결 상태 확인, 상태 전이 매트릭스(WAIT→REPAIR/REWORK/SCRAP) 준수]
  - symptom: "재작업 지시(QC_REWORK) 승인이 진행되지 않음"
    causes: [품질승인(QC_PENDING) 전에 생산승인 시도, REGISTERED/QC_REJECTED/PROD_REJECTED가 아닌 상태에서 수정 시도, 진행된 공정/검사 이력이 있어 삭제 불가]
    resolutions: [2단계 승인 순서(품질→생산) 준수, 상태별 수정 가능 여부 확인, 공정 진행 전 삭제]
  - symptom: "재작업검사(QC_REWORK_INSPECT) 등록이 안 됨"
    causes: [재작업 지시가 아직 INSPECT_PENDING 상태가 아님(작업 미완료), 공정목록(processItems) 실적이 합산되지 않음]
    resolutions: [QC_REWORK에서 작업완료 처리 여부 확인, COMPLETED 공정 resultQty 합계 확인]
  - symptom: "OQC 의뢰(QC_OQC)에 박스가 안 보임"
    causes: [박스가 아직 CLOSED 상태가 아님(포장 미마감), 이미 다른 OQC 의뢰에 포함된 박스, 팔레트/출하가 이미 진행된 박스]
    resolutions: [SHIP_PACK에서 박스 마감 확인, 가용박스조회 API로 중복 여부 확인, 팔레트 적재 이전에 OQC 처리]
  - symptom: "OQC FAIL 판정 후 출하가 계속 진행됨"
    causes: [BOX_MASTER.oqcStatus 갱신 반영 지연, 팔레트에 이미 적재된 이후 결과 변경]
    resolutions: [QC_OQC_HISTORY에서 최신 판정 확인, SHIP_PALLET에서 OQC 미완료/불합격 박스 적재 차단 여부 확인]
relatedWorkflows: [PROD_FLOW, MAT_FLOW, SHIP_FLOW]
---
## 단계별 설명

### 1. IQC검사(QC_IQC)
자재 입하 단계의 품질 게이트다. 입하번호+품목 단위 또는 개별 LOT 단위로 판정하며, PASS/FAIL 결과가 이후 라벨발행·입고 가능 여부를 결정한다. 자재관리 흐름(MAT_FLOW)의 첫 검사 지점이다.

### 2. 검사관리(QC_INSPECT)
생산실적별 검사 결과(도통/외관/치수/기능 등)를 등록한다. 바코드 스캔으로 추적로그(TraceLog)를 통해 생산실적을 역추적할 수 있어, 불량 발생 시 원인 공정을 특정하는 근거가 된다. 이 결과가 불합격이면 다음 단계인 불량관리(QC_DEFECT)로 이어진다.

### 3. 불량관리(QC_DEFECT)
생산실적에 연결된 불량을 등록하고, 수리(REPAIR)/재작업(REWORK)/폐기(SCRAP) 중 하나로 분류한다. 상태 전이 매트릭스(WAIT→REPAIR/REWORK/SCRAP, REPAIR/REWORK→DONE/SCRAP/WAIT)를 벗어난 전이는 차단된다. 재작업으로 분류되면 재작업지시(QC_REWORK)와 1:1로 연결되어 직접 처리가 제한된다.

### 4. 재작업지시(QC_REWORK)
불량품 재작업을 등록하고 품질→생산 순서의 2단계 승인을 거친다. 승인이 끝나면 작업을 시작(IN_PROGRESS)하고 완료 시 검사대기(INSPECT_PENDING) 상태가 된다. 품질과 생산 양쪽 승인을 모두 요구하는 이유는 재작업 방법이 IATF 등 품질 규정에 맞는지, 생산 라인 투입이 가능한지를 각각 확인하기 위함이다.

### 5. 재작업검사(QC_REWORK_INSPECT)
재작업 완료품의 재검사 결과를 등록한다. PASS면 격리 해제(isolationFlag=0)되고 원 불량 로그가 DONE으로 자동 변경되며, FAIL/SCRAP이면 격리가 유지된다. 재검사 결과가 불량 처리의 최종 판정점이다.

### 6. 재작업이력(QC_REWORK_HISTORY)
재작업 전체 이력을 조회 전용으로 확인한다. 승인/공정/검사 각 단계의 이력을 추적성 관점에서 남긴다.

### 7. OQC검사(QC_OQC)
출하 전 박스 단위 샘플 검사다. 포장(SHIP_PACK)에서 박스를 마감하면 자동으로 OQC 의뢰가 생성되며(PENDING), 검사 실행 결과에 따라 `BOX_MASTER.oqcStatus`가 PASS/FAIL로 갱신된다. FAIL이면 해당 박스는 팔레트 적재와 출하가 차단된다.

### 8. OQC이력(QC_OQC_HISTORY)
OQC 판정 이력을 조회한다. 출하 흐름(SHIP_FLOW)에서 팔레트 적재/출하확정 가능 여부를 판단하는 근거 자료로 쓰인다.
