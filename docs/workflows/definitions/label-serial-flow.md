---
workflowId: LABEL_FLOW
title: 자재라벨/FG라벨/SG라벨 발행·스캔 흐름
steps:
  - menu: MAT_RECEIVE_LABEL
    requires: [QC_IQC]
    transitions: "matUid 신규채번 + MatLot 생성"
    produces: [MAT_LABEL, MAT_LOT]
  - menu: PROD_RESULT
    requires: [PROD_ORDER]
    transitions: "issueLabelType SG/BUNDLE 공정 최초 양품실적 시 1회 발행"
    produces: [SG_LABEL, FG_LABEL]
  - menu: PROD_KITTING
    requires: [MAT_RECEIVE_LABEL]
    transitions: "ISSUED 발행 → 실물 스캔 확정"
    produces: [SG_LABEL]
  - menu: PROD_INPUT_ASSEMBLY
    requires: [PROD_KITTING]
    transitions: "ISSUED 발행 → 실물 스캔 확정"
    produces: [FG_LABEL]
  - menu: SHIP_PACK
    requires: [PROD_INPUT_ASSEMBLY, PROD_RESULT]
    transitions: "FG_LABELS VISUAL_PASS→PACKED"
  - menu: SHIP_BOX_STOCK
    requires: [SHIP_PACK]
  - menu: SHIP_CONFIRM
    requires: [SHIP_BOX_STOCK]
    transitions: "FG_LABELS PACKED→SHIPPED"
troubleshooting:
  - symptom: "입하라벨(MAT_RECEIVE_LABEL)이 발행되지 않음"
    causes: [해당 입하건의 IQC 판정이 PASS가 아님, 이미 라벨 발행 이력(LABEL_PRINT_LOGS)이 있어 중복 발행 차단됨]
    resolutions: [QC_IQC에서 판정 확인, QC_IQC_HISTORY에서 기존 발행 이력 확인]
  - symptom: "SG 라벨(반제품 묶음)이 자동 발행되지 않음"
    causes: [MST_ROUTING의 해당 공정 issueLabelType이 SG/BUNDLE로 설정되지 않음, 최초 공정이 아닌 후속 공정에서 발생(이미 1회 발행되어 멱등 처리됨), 생산실적이 불량(양품수량 0)으로 등록됨]
    resolutions: [MST_ROUTING에서 공정별 issueLabelType 확인, PROD_KITTING 화면에서 sg-label 조회로 기발행 여부 확인, 양품수량 입력 확인]
  - symptom: "서브공정 키팅(PROD_KITTING)에서 이전 SFG 스캔이 거절됨"
    causes: [스캔한 SFG 바코드가 SG_LABELS에 없거나 이미 소진(remainQty=0)됨, BOM 기준 회로(circuit)와 스캔한 SFG 품목이 불일치, SFG 상태가 ISSUED가 아닌 이미 확정 완료된 라벨]
    resolutions: [sg-label 조회 API로 라벨 상태 확인, 회로 선택값과 BOM 구성 재확인, 새 작업으로 신규 SFG 발행]
  - symptom: "조립(PROD_INPUT_ASSEMBLY)에서 FG 발행 후 확정이 안 됨"
    causes: [발행된 FG 바코드와 실물 스캔 바코드 불일치, 발행 후 시간 초과로 세션 상태(issuedFg)가 초기화됨, BOM 요구사항(assembly-requirements) 대비 SFG 스캔 수량 부족]
    resolutions: [발행된 바코드로 정확히 재스캔, 화면 새로고침 후 재발행, BOM 요구 수량만큼 SFG 스캔 완료 확인]
  - symptom: "포장(SHIP_PACK)에서 FG 시리얼 스캔이 거절됨"
    causes: [FG_LABELS 상태가 검사합격(VISUAL_PASS 등)이 아님, 시리얼의 품목코드가 박스 품목과 다름, 이미 다른 박스에 포장(PACKED)된 시리얼]
    resolutions: [QC_INSPECT/자주검사 결과 확인, 박스 생성 시 선택 품목 재확인, SHIP_BOX_STOCK에서 시리얼 현재 위치 확인]
  - symptom: "출하확정(SHIP_CONFIRM)에서 FG 라벨이 SHIPPED로 갱신되지 않음"
    causes: [팔레트 바코드 스캔 검증이 완료되지 않음, 출하 상태가 LOADED가 아닌 상태에서 처리 시도]
    resolutions: [LOADED 상태에서 바코드 스캔 검증 절차 수행, SHIP_HISTORY에서 현재 출하 상태 확인]
relatedWorkflows: [PROD_FLOW, MAT_FLOW, QC_FLOW, SHIP_FLOW]
---
## 단계별 설명

### 1. 자재라벨 발행(MAT_RECEIVE_LABEL)
IQC 합격(PASS)된 입하건에 한해 자재 시리얼(matUid)을 채번하고 80x40mm 라벨을 발행한다. 자재 계보의 시작점으로, 이후 LOT분할/병합, 출고, 생산투입까지 이 시리얼이 그대로 추적 키로 쓰인다. 발행 시 MatLot이 생성되고 supUid(거래처 바코드 연결)가 갱신된다.

### 2. 생산실적의 자동 라벨 발행(PROD_RESULT)
생산실적을 완료 처리하는 시점에, 라우팅에 정의된 공정별 `issueLabelType`이 SG 또는 BUNDLE이면 최초 공정 양품 실적 등록 시 SG_LABEL이 1회 자동 발행된다(멱등 처리). 단일 공정으로 완결되는 품목은 `FG_BARCODE_ISSUE_TIMING` 설정(ON_PRODUCTION/PRE_ISSUE/ON_INSPECT)에 따라 이 단계에서 바로 FG_LABEL이 발행되기도 한다. 라벨 발행 시점을 공정/설정에 따라 분기하는 이유는 품목별로 몇 개의 서브공정을 거치는지가 다르기 때문이다.

### 3. 서브공정 키팅(PROD_KITTING)
이전 공정에서 부착된 SFG 라벨을 스캔해 BOM 기준 회로별로 새 SFG를 발행하는 화면이다. "키팅 실행"으로 새 SG_LABEL을 `ISSUED` 상태로 먼저 발행(프린터 출력)하고, 실물 라벨을 스캔해야 이전 SFG 소비 + genealogy 연결 + 자재차감 + 재고적재가 단일 트랜잭션으로 확정된다. 발행과 확정을 분리한 이유는 라벨 인쇄 실패/오부착 시 되돌릴 수 있는 지점을 만들기 위함이다.

### 4. 조립 실적입력(PROD_INPUT_ASSEMBLY)
서브공정 키팅과 동일한 서비스(subprocess-kitting.service)를 공유하는 거울상 화면으로, SFG를 소비해 완제품(FG) 라벨을 발행·확정한다. FG 발행(`POST .../issue-label`)은 SEQ_FG_LABEL로 채번해 `ISSUED` 상태로 저장하고, 실물 스캔 확정(`POST .../confirm`)에서 SG_LABELS 소비, FG_LABELS 승격, PRODUCT_STOCKS(FG_WIP) 적재가 함께 처리된다.

### 5. 포장(SHIP_PACK)
검사에서 합격 판정을 받은 FG 시리얼만 스캔해 박스에 담을 수 있다. 박스 마감 시 FG_LABELS 상태가 `PACKED`로 일괄 전환되며, 이 시점부터 시리얼은 박스라는 상위 단위로 관리된다.

### 6. 박스입고재고(SHIP_BOX_STOCK)
FG_LABELS를 박스 단위로 집계 조회한다. 특정 박스에 어떤 시리얼이 담겨 있는지, 아직 출하되지 않은 재고가 무엇인지 확인하는 화면으로, 팔레트 적재나 출하지시 처리 전 확인 단계로 쓰인다.

### 7. 출하확정(SHIP_CONFIRM)
출하 처리(mark-shipped) 시 FG_LABELS 상태가 `PACKED→SHIPPED`로 일괄 전환되며, 이것이 라벨/시리얼 계보의 마지막 상태 전이다. 이후 이력 조회(SHIP_HISTORY)나 반품(SHIP_RETURN)에서만 해당 시리얼을 참조하게 된다.
