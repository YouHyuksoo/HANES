---
menuCode: PROD_KITTING
audience: operator
title: 실적입력(서브공정) — 운영 가이드
summary: 이전 공정 반제품(SG_LABELS) 스캔과 설비 장착 원자재(WIP_MAT_STOCKS) 소모를 근거로 새 반제품(SG_LABELS)을 발행·확정하는 단일 트랜잭션 API 흐름입니다.
tags: [생산관리, 생산, HANES]
keywords: [실적입력(서브공정), PROD_KITTING, SG_LABELS, WIP_MAT_STOCKS, PRODUCT_GENEALOGY, confirm-subkit, 회로]
related: [PROD_ORDER, PROD_INPUT_ASSEMBLY, PROD_RESULT]
---

# 실적입력(서브공정) — 운영 가이드

## 시스템 목적·역할
반제품 작업지시의 서브공정에서 이전 공정 반제품(`SG_LABELS`) 스캔과 설비 장착 원자재(`WIP_MAT_STOCKS`) 소모를 근거로 새 반제품 라벨(`SG_LABELS`)을 발행·확정하는 API 흐름입니다. [실적입력(조립)](/production/input-assembly)의 대칭 구조(완제품 FG 대신 반제품 SG를 만듦)이며, 확정 시 입력 SG 소비, 자재 차감, genealogy 생성, 생산실적(`PROD_RESULTS`) 등록, 반제품 WIP 재고(`PRODUCT_STOCKS`, `SFG_WIP` 창고) 적재가 **단일 트랜잭션**으로 처리됩니다.

## 데이터 구조
```
JOB_ORDERS(반제품, itemType=SEMI_PRODUCT)
 ├─ EQUIP_MASTERS.CURRENT_JOB_ORDER_ID ↔ 설비별 진행 중 작업지시 연결(설비 선택 시 자동 복원/저장, PATCH /equipment/equips/:id/job-order)
 ├─ BOM_MASTERS(useYn=Y, validFrom~validTo)
 │   ├─ 자식 SEMI_PRODUCT → SG_LABELS(IN_STOCK/MOUNTED, 이전 공정 SFG) 스캔 소모(가닥 1개씩 REMAIN_QTY 차감)
 │   └─ 자식 RAW_MATERIAL → WIP_MAT_STOCKS(설비 장착 자재) BOM qtyPer만큼 차감
 │        └─ ROUTING_MATERIALS(공정별 배정 있으면) 현재 공정 자재만 필터링(BACKFLUSH)
 ├─ 회로 필수 검증: HarnessCircuitSpec(품목 기준 회로 존재) → 있으면 발행·확정 모두 circuitNo 필수(서버·프론트 대칭 가드)
 ├─ SG_LABELS(신규): 발행(ISSUED, LABEL_TYPE은 발행 공정 ISSUE_LABEL_TYPE 기준 BUNDLE/SG) → 확정(IN_STOCK 승격 + RESULT_NO 채움)
 ├─ PRODUCT_GENEALOGY: 신규SG→입력SG(qty:1, 가닥 수만큼), 신규SG→MAT_LOT(차감 LOT별)
 ├─ PROD_RESULTS: goodQty=1, defectQty=0, status=DONE 1건
 └─ PRODUCT_STOCKS(SFG_WIP 창고): WIP_IN +1(SEMI_PRODUCT)

설비 자재 장착(input-assembly와 공용 API, 이 화면은 orderNo+itemCode를 넘겨 BOM 검증 경로를 사용):
PROC_MAT_STOCKS(공정재고, 장착 대기) --mount(BOM 검증)--> WIP_MAT_STOCKS(설비재고, 장착됨) --unmount--> PROC_MAT_STOCKS

스코프: COMPANY='40', PLANT_CD='1000'
```

## ① SG_LABELS — 신규 발행 라벨 전체 컬럼
| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| SFG 바코드 | `SG_BARCODE` (PK) | `SEQ_SG_LABEL`로 채번(`issue-sg-label` 호출 시 생성). |
| 품목코드 | `ITEM_CODE` | 발행 시 작업지시의 반제품 품목으로 고정됩니다. |
| 작업지시 | `ORDER_NO` | 발행 요청의 작업지시번호. 확정 시 이 값과 요청 orderNo가 다르면 거부됩니다. |
| 발행 공정 / 현재 공정 | `ISSUE_PROCESS_CODE`, `CURRENT_PROCESS_CODE` | 발행 시점 공정, 확정 시 요청 `processCode`로 갱신됩니다. |
| 장착 설비 | `MOUNTED_EQUIP_CODE` | 발행 요청의 `equipCode`(옵션)가 저장됩니다. |
| 초기/잔여 수량 | `INIT_QTY`, `REMAIN_QTY` | 신규 발행 시 둘 다 `1`로 고정됩니다. |
| 상태 | `STATUS` | `ISSUED`(발행 직후) → 확정 성공 시 `IN_STOCK`으로 승격 + `RESULT_NO` 채움. 이후 후속 공정에서 다시 `MOUNTED`/`CONSUMED`로 전이됩니다. |
| 라벨 종류 | `LABEL_TYPE` | 발행 공정의 `RoutingProcess.issueLabelType`이 `BUNDLE`이면 `BUNDLE`, 아니면 기본값 `SG`. |
| 발행자 | `WORKER_CODE` | 로그인 사용자(`req.user.id`), 없으면 `system`. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | 기본 스코프는 회사 `40`, 공장 `1000`. |

> ⚠ **cancel 미구현** — `subprocess-kitting.controller.ts`는 발행 취소 API를 제공하지 않습니다. "발행 취소" 버튼은 화면 상태(`issuedSg`)만 초기화할 뿐 `SG_LABELS.STATUS='ISSUED'` 레코드는 그대로 남습니다.
> ⚠ **발행 즉시 자동 인쇄** — `confirm-subkit`이 아니라 `issue-sg-label` 성공 직후 프론트가 `SgLabelPrintHost.printBySgBarcodes`를 바로 호출합니다(FG 화면처럼 서버가 인쇄 여부를 판단하는 `printFg` 플래그가 없음). 발행 취소 후 재발행하면 실물 라벨이 중복 출력될 수 있습니다.

## ② SG_LABELS — 입력(소모) 대상 컬럼
| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| SFG 바코드 | `SG_BARCODE` (PK) | 스캔 대상 이전 공정 반제품 라벨. |
| 품목코드 | `ITEM_CODE` | 신규 반제품 BOM의 `SEMI_PRODUCT` 자식 품목과 일치해야 스캔이 허용됩니다(불일치 시 오투입 거부). |
| 잔량 | `REMAIN_QTY` | 확정 시 1씩 차감되며, 0이 되면 `STATUS='CONSUMED'`, 아니면 `MOUNTED`로 갱신됩니다. |
| 상태 | `STATUS` | `IN_STOCK`/`MOUNTED`만 스캔 가능. |

## ③ WIP_MAT_STOCKS / PROC_MAT_STOCKS — 설비 자재 장착 컬럼
| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| LOT/UID | `MAT_UID` | 자재 바코드 스캔값. |
| 수량 / 가용수량 | `QTY`, `AVAILABLE_QTY` | `mount` 시 `PROC_MAT_STOCKS`의 가용 전량을 이동. |
| 장착 API | — | `page.tsx`가 `EquipMaterialMountPanel`에 `orderNo`·`itemCode`·`expectedItemTypes=["RAW_MATERIAL"]`를 넘기므로, 좌측 패널은 **작업지시 BOM의 원자재만** 체크리스트로 보여주고 `POST /production/job-orders/:orderNo/material-mounts/scan`(BOM 오장착 검증 포함)으로 장착합니다. (input-assembly는 이 props를 넘기지 않아 검증 없는 `/production/equip-material/mount`만 사용 — 두 화면의 차이입니다.) |

## ④ EQUIP_MASTERS.CURRENT_JOB_ORDER_ID — 설비별 진행 작업지시 연결
| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 현재 작업지시 | `CURRENT_JOB_ORDER_ID` | 작업지시 선택 시 `PATCH /equipment/equips/:equipCode/job-order`로 저장, 설비 재선택 시 이 값으로 자동 복원됩니다. 복원된 작업지시가 반제품(`SEMI_PRODUCT`)이 아니면 즉시 `null`로 해제됩니다. "변경"·"초기화" 시에도 `null`로 해제됩니다. |

## 버튼·API·상태 전이
| 버튼/액션 | API 또는 서비스 | 허용 조건 | 결과 상태 / DB 영향 |
|------|------|------|------|
| 설비 목록 조회 | `GET /equipment/equips` | — | 화면 진입 시 1회 로드 |
| 설비 현재 상태 조회(복원용) | `GET /equipment/equips/:equipCode` | 설비 선택 시 | `currentJobOrderId`가 있으면 해당 작업지시 조회 후 자동 선택 |
| 작업지시 단건 조회(복원용) | `GET /production/job-orders/order-no/:orderNo` | 위 복원 흐름에서 | `itemType!=='SEMI_PRODUCT'`면 즉시 연결 해제 |
| 작업지시 조회(스캔/검색) | `GET /production/job-orders` | `statuses=WAITING,RUNNING`, `itemType=SEMI_PRODUCT`, `orderKind=OPERATION`, `assignableEquipCode`/`equipCode` | — |
| 작업지시 선택 시 현재 작업지시 저장 | `PATCH /equipment/equips/:equipCode/job-order` | 작업지시 선택/해제 시 | `EQUIP_MASTERS.CURRENT_JOB_ORDER_ID` 갱신 |
| 조립 요구사항 조회(BOM 반제품 목록) | `GET /production/subprocess-kitting/assembly-requirements/:orderNo` | 작업지시 선택 시 자동 호출 | BOM의 `SEMI_PRODUCT` 자식 목록(`components`) 반환 — SFG 스캔 오투입 검증에 사용 |
| 회로 목록 조회 | `GET /production/subprocess-kitting/circuits-by-order/:orderNo` | 작업지시 선택 시 자동 호출 | 품목의 도면 회로 목록 반환. 1건 이상이면 회로 선택 필수 |
| SFG 라벨 조회 | `GET /production/subprocess-kitting/sg-label/:sgBarcode` | SFG 스캔 시 | 없으면 404 |
| 자재 장착(BOM 검증) | `POST /production/job-orders/:orderNo/material-mounts/scan` | 항상(orderNo 전달됨) | `PROC_MAT_STOCKS`→`WIP_MAT_STOCKS` 이동 |
| 자재 해제 | `POST /production/equip-material/unmount` | `RESERVED_QTY=0` | `WIP_MAT_STOCKS`→`PROC_MAT_STOCKS` 역이동 |
| **키팅 실행 → SFG 라벨 발행** | `POST /production/subprocess-kitting/issue-sg-label` | 작업지시가 `SEMI_PRODUCT`이고 `WAITING`/`RUNNING`, 회로 있으면 선택 완료 | `SG_LABELS` 신규 1행(`STATUS='ISSUED'`) + 프론트가 즉시 자동 인쇄 |
| **실물 라벨 스캔 확인 / 확인 버튼** | `POST /production/subprocess-kitting/confirm-subkit` | 신규 SG가 `ISSUED` + `orderNo` 일치 + genealogy 미존재 + 회로 있으면 선택 완료 | 아래 "확정 로직" 참고 |
| 발행 취소(되돌리기 아이콘) | API 없음(프론트 상태만 리셋) | — | `SG_LABELS.STATUS='ISSUED'` 레코드는 그대로 남음 |

## 확정(confirm-subkit) 로직
1. 신규 `SgLabel` 조회 — `status='ISSUED'` 및 `orderNo` 일치 확인, `PRODUCT_GENEALOGY`에 이미 `parentType='SG', parentKey=newSgBarcode`가 있으면 중복 확정으로 거부.
2. 작업지시 + `BOM_MASTERS`(`useYn='Y'`, 계획일 기준 유효기간) 조회, `SEMI_PRODUCT`/`RAW_MATERIAL` 자식으로 분류.
3. 회로 필수 검증 — `HarnessCircuitSpec`에 품목 기준 회로가 있으면 `circuitNo` 없이 확정 불가(프론트 가드와 대칭인 서버 강제).
4. 라우팅에 `ROUTING_MATERIALS` 배정이 있으면 현재 공정 자재만 남기고 나머지는 차감 대상에서 제외.
5. 스캔된 입력 SFG 전건 검증(존재/상태/잔량/오투입, 신규 바코드를 입력으로 재사용 시 거부) 후 1개씩 `REMAIN_QTY` 차감 + `PRODUCT_GENEALOGY`(신규SG→입력SG, qty=1) 생성.
6. `equipCode`가 있으면 원자재를 설비 재고에서 BOM `qtyPer`만큼 차감(`PROD_CONSUME`) 후 차감 LOT별로 `PRODUCT_GENEALOGY`(신규SG→MAT_LOT) 생성.
7. 신규 SG 승격 — `STATUS`를 `IN_STOCK`으로, `RESULT_NO`·`CURRENT_PROCESS_CODE` 채움.
8. `PROD_RESULTS` 1건 저장(`goodQty=1, defectQty=0, status='DONE'`). 작업지시가 `WAITING`이면 `RUNNING`으로 승격.
9. `ProductInventoryService.receiveStockInTx`로 `PRODUCT_STOCKS`의 `SFG_WIP` 창고에 반제품 1 적재(`WIP_IN`).

## 사전 설정 (마스터·공통코드)
- 신규 반제품 BOM(`BOM_MASTERS`)에 이전 공정 `SEMI_PRODUCT` 자식과 `RAW_MATERIAL` 자식이 등록돼 있어야 합니다.
- 회로 검증을 쓰려면 품목에 `HarnessCircuitSpec`(도면 회로) 데이터가 있어야 합니다. 없으면 회로 선택 자체가 생략됩니다.
- 설비 마스터(`EquipMaster.processCode`)가 지정돼 있어야 설비 선택만으로 공정이 결정됩니다.
- 라벨 종류(`BUNDLE`/`SG`)를 구분하려면 발행 공정의 `RoutingProcess.issueLabelType`을 설정합니다.

## 운영 절차
1. 조립 전 해당 공정의 원자재가 `PROC_MAT_STOCKS`(장착 대기)까지 출고돼 있는지 확인합니다.
2. 설비를 재선택했을 때 원치 않는 작업지시가 자동 복원되면 "변경"으로 해제하도록 안내합니다.
3. 발행 후 확정하지 않고 방치된 `ISSUED` SG 라벨이 있는지 주기적으로 점검합니다(cancel API 없음, 자동 인쇄로 실물 라벨이 이미 나갔을 수 있음).
4. 확정 실패가 반복되면 BOM 유효기간, 작업지시 계획일, 회로 데이터 등록 여부를 함께 확인합니다.

## 권한
- 생산 현장 작업자는 설비/작업지시/회로 선택, 자재 장착·해제, SFG 스캔, 키팅 실행·확정을 수행합니다.
- `subprocess-kitting` 컨트롤러는 전용 인증 가드 데코레이터가 없어 전역 가드 설정을 따르며, `equip-material` 컨트롤러만 `JwtAuthGuard`가 명시돼 있습니다.
- 자재 마스터·BOM·라우팅·회로 배정 변경은 생산기술 담당자가 기준정보 화면에서 수행합니다.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 설비 선택 시 원하지 않는 작업지시가 자동으로 잡힘 | `EQUIP_MASTERS.CURRENT_JOB_ORDER_ID`에 이전 작업 상태가 남아있음 | "변경" 또는 "초기화"로 해제 후 다시 선택 |
| 작업지시가 조회되지 않음 | 설비 미선택, 상태가 `WAITING`/`RUNNING`이 아니거나 품목유형이 `SEMI_PRODUCT`가 아님 | 조건과 작업지시 상태를 확인 |
| "회로를 선택하세요" 반복 | 품목에 회로 데이터가 있는데 미선택 | 상단 회로 드롭다운에서 선택 후 재시도 |
| SFG 스캔 "BOM에 없는 반제품입니다(오투입)" | SFG 품목이 신규 반제품 BOM의 `SEMI_PRODUCT` 자식 목록에 없음 | BOM 등록 상태와 스캔 라벨 품목코드 대조 |
| 자재 스캔이 계속 거부됨 | `orderNo` 기준 BOM 오장착 검증에 걸림(체크리스트에 없는 품목) | 작업지시 BOM 원자재 구성과 실제 스캔 품목이 일치하는지 확인 |
| 발행만 되고 확정 안 된 라벨이 남음 | "발행 취소"는 화면 상태만 리셋(cancel API 없음), 실물은 이미 자동 인쇄됨 | `SG_LABELS`에서 `STATUS='ISSUED'`이고 genealogy가 없는 오래된 행을 조회해 수기 정리, 중복 출력된 실물 라벨 회수 |

## 데이터·연계
- 화면 경로: `/production/subprocess-kitting`
- 주요 테이블: `SG_LABELS`, `WIP_MAT_STOCKS`, `PROC_MAT_STOCKS`, `PRODUCT_GENEALOGY`, `PROD_RESULTS`, `PRODUCT_STOCKS`, `BOM_MASTERS`, `ROUTING_MATERIALS`, `JOB_ORDERS`, `EQUIP_MASTERS`
- 주요 API: `GET /production/subprocess-kitting/assembly-requirements/:orderNo`, `GET /production/subprocess-kitting/circuits-by-order/:orderNo`, `GET /production/subprocess-kitting/sg-label/:sgBarcode`, `POST /production/subprocess-kitting/issue-sg-label`, `POST /production/subprocess-kitting/confirm-subkit`, `POST /production/job-orders/:orderNo/material-mounts/scan`, `POST /production/equip-material/unmount`, `PATCH /equipment/equips/:id/job-order`
- 멀티테넌시: `COMPANY='40'`, `PLANT_CD='1000'`
- 관련 화면: 작업지시 관리(`PROD_ORDER`), 실적입력(조립)(`PROD_INPUT_ASSEMBLY`), 생산실적(`PROD_RESULT`)
