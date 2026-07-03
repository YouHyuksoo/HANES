---
menuCode: PROD_INPUT_ASSEMBLY
audience: operator
title: 실적입력(조립) — 운영 가이드
summary: 반제품(SG_LABELS) 스캔과 설비 장착 자재(WIP_MAT_STOCKS) 소모를 근거로 완제품(FG_LABELS)을 발행·확정하는 단일 트랜잭션 API 흐름입니다.
tags: [생산관리, 생산, HANES]
keywords: [실적입력(조립), PROD_INPUT_ASSEMBLY, FG_LABELS, SG_LABELS, WIP_MAT_STOCKS, PRODUCT_GENEALOGY, subprocess-kitting]
related: [PROD_ORDER, PROD_KITTING, PROD_RESULT]
---

# 실적입력(조립) — 운영 가이드

## 시스템 목적·역할
완제품 작업지시의 조립 공정에서 반제품(`SG_LABELS`) 스캔과 설비 장착 원자재(`WIP_MAT_STOCKS`) 소모를 근거로 완제품 라벨(`FG_LABELS`)을 발행·확정하는 API 흐름입니다. 확정 시 SG 소비, 자재 차감, genealogy 생성, 생산실적(`PROD_RESULTS`) 등록, 완제품 WIP 재고(`PRODUCT_STOCKS`, `FG_WIP` 창고) 적재가 **단일 트랜잭션**으로 처리됩니다.

## 데이터 구조
```
JOB_ORDERS(완제품, itemType=FINISHED)
 ├─ BOM_MASTERS(useYn=Y, validFrom~validTo)
 │   ├─ 자식 SEMI_PRODUCT → SG_LABELS(IN_STOCK/MOUNTED) 스캔 소모(가닥 1개씩 REMAIN_QTY 차감)
 │   └─ 자식 RAW_MATERIAL → WIP_MAT_STOCKS(설비 장착 자재) BOM qtyPer만큼 차감
 │        └─ ROUTING_MATERIALS(공정별 배정 있으면) 현재 공정 자재만 필터링(BACKFLUSH)
 ├─ FG_LABELS: 발행(ISSUED) → 확정(genealogy 존재)
 ├─ PRODUCT_GENEALOGY: FG→SG(qty:1, 가닥 수만큼), FG→MAT_LOT(차감 LOT별)
 ├─ PROD_RESULTS: goodQty=1, defectQty=0, status=DONE 1건
 └─ PRODUCT_STOCKS(FG_WIP 창고): WIP_IN +1

설비 자재 장착(별도 화면과 공용 API):
PROC_MAT_STOCKS(공정재고, 장착 대기) --mount--> WIP_MAT_STOCKS(설비재고, 장착됨) --unmount--> PROC_MAT_STOCKS

스코프: COMPANY='40', PLANT_CD='1000'
```

## ① FG_LABELS — 조립 라벨 전체 컬럼
| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| FG 바코드 | `FG_BARCODE` (PK) | `PKG_SEQ_GENERATOR.GET_NO('FG_BARCODE')`로 채번. `issue-label` 호출 시 생성됩니다. |
| 품목코드 | `ITEM_CODE` | 발행 시 작업지시의 완제품 품목으로 고정됩니다. |
| 작업지시 | `ORDER_NO` | 발행 요청의 작업지시번호. 확정 시 이 값과 요청 orderNo가 다르면 거부됩니다. |
| 설비 | `EQUIP_CODE` | 발행 요청에 넘긴 설비 코드입니다. |
| 상태 | `STATUS` | `ISSUED`(발행 직후). 이 화면 API는 별도 상태 갱신을 하지 않으며, 확정 여부는 `PRODUCT_GENEALOGY`에 `parentType='FG'` 레코드 존재로 판단합니다. 이후 외관검사·포장·출하 흐름에서 `VISUAL_PASS/VISUAL_FAIL → PACKED → SHIPPED`로 이어집니다. |
| 발행자 | `WORKER_CODE` | 로그인 사용자(`req.user.id`), 없으면 `system`. |
| 발행일시 | `ISSUED_AT` | 기본값 `CURRENT_TIMESTAMP`. |
| 검사 결과 | `INSPECT_RESULT_ID`, `INSPECT_PASS_YN` | 이 화면에서는 `null`로 저장되며 후속 통전/외관검사 공정에서 채워집니다. |
| 재발행 | `REPLACED_BY` | 라벨 재발행 시 새 바코드를 기록(자기참조). 이 화면 API에는 재발행 로직이 없습니다. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | 기본 스코프는 회사 `40`, 공장 `1000`. |
| 감사 이력 | `CREATED_BY/AT`, `UPDATED_BY/AT` | 표준 감사 컬럼. |

> ⚠ **cancel 미구현** — `subprocess-kitting.controller.ts` 상단 주석대로 이 컨트롤러는 발행 취소(cancel) API를 제공하지 않습니다. 프론트의 "발행 취소" 버튼은 화면 상태(`issuedFg`)만 초기화할 뿐 `FG_LABELS.STATUS='ISSUED'` 레코드는 그대로 남습니다. 미확정 `ISSUED` 라벨이 쌓이면 수기로 확인·정리가 필요합니다.

## ② SG_LABELS — 소모 대상 컬럼
| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| SG 바코드 | `SG_BARCODE` (PK) | 스캔 대상 반제품 묶음/회로 라벨. |
| 품목코드 | `ITEM_CODE` | 완제품 BOM의 `SEMI_PRODUCT` 자식 품목과 일치해야 스캔이 허용됩니다(불일치 시 오투입 거부). |
| 잔량 | `REMAIN_QTY` | 확정 시 1씩 차감되며, 0이 되면 `STATUS='CONSUMED'`, 아니면 `MOUNTED`로 갱신됩니다. |
| 상태 | `STATUS` | `IN_STOCK`/`MOUNTED`만 스캔 가능. `CONSUMED`/`DEFECT` 등은 거부됩니다. |
| 라벨 종류 | `LABEL_TYPE` | `BUNDLE`(묶음) / `SG`(회로). 화면에는 각각 "묶음"/"회로" 배지로 표시됩니다. |
| 현재 공정 | `CURRENT_PROCESS_CODE` | 확정 시 조립 확정 요청의 `processCode`로 갱신됩니다. |

## ③ WIP_MAT_STOCKS / PROC_MAT_STOCKS — 설비 자재 장착 컬럼
| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| LOT/UID | `MAT_UID` | 자재 바코드 스캔값. `WIP_MAT_STOCKS`는 (`COMPANY`, `PLANT_CD`, `EQUIP_CODE`, `ITEM_CODE`, `MAT_UID`) 복합 PK입니다. |
| 수량 / 가용수량 | `QTY`, `AVAILABLE_QTY` | `mount` 시 `PROC_MAT_STOCKS`의 가용 전량을 이동. `unmount` 시 예약(`RESERVED_QTY`)이 있으면 해제 불가. |
| 장착 흐름 | — | 자재 출고 → `PROC_MAT_STOCKS`(공정재고, 장착 대기) → `mount` → `WIP_MAT_STOCKS`(설비재고, 장착됨) → 조립 확정 시 BOM `RAW_MATERIAL` qtyPer만큼 차감(`PROD_CONSUME`) → `PRODUCT_GENEALOGY`(FG→MAT_LOT) 기록. |
| 장착 API | — | 이 화면은 `EquipMaterialMountPanel`에 `orderNo`/`itemCode`를 넘기지 않으므로(`page.tsx` 참고) **항상** `/production/equip-material/mount`(BOM 매칭 검증 없음)를 호출합니다. `orderNo`를 넘겨 BOM 오장착 검증(`/production/job-orders/:orderNo/material-mounts/scan`)까지 쓰는 화면은 [서브공정 키팅](/production/subprocess-kitting)입니다. |

## 버튼·API·상태 전이
| 버튼/액션 | API 또는 서비스 | 허용 조건 | 결과 상태 / DB 영향 |
|------|------|------|------|
| 설비 목록 조회 | `GET /equipment/equips` | — | 화면 진입 시 1회 로드 |
| 작업지시 조회(스캔/검색) | `GET /production/job-orders` | `equipCode` 필요, `itemType=FINISHED`, `processCode` 필터 | — |
| 조립 요구사항 조회 | `GET /production/subprocess-kitting/assembly-requirements/:orderNo` | 작업지시 선택 시 자동 호출 | BOM의 `SEMI_PRODUCT` 자식 목록(`components`) 반환 |
| SG 라벨 조회 | `GET /production/subprocess-kitting/sg-label/:sgBarcode` | SG 스캔 시 | 없으면 404 |
| 자재 장착(검증 없음) | `POST /production/equip-material/mount` | 이 화면은 항상 이 경로만 사용(`orderNo` 미전달) | `PROC_MAT_STOCKS`→`WIP_MAT_STOCKS` 이동(`PROC_MOUNT`/`WIP_IN`), BOM 매칭 검증 없음 |
| 자재 해제 | `POST /production/equip-material/unmount` | `RESERVED_QTY=0` | `WIP_MAT_STOCKS`→`PROC_MAT_STOCKS` 역이동(`WIP_IN_CANCEL`/`PROC_MOUNT_CANCEL`) |
| **조립 실행 → FG 라벨 발행** | `POST /production/subprocess-kitting/issue-label` | 작업지시가 `FINISHED`이고 `WAITING`/`RUNNING`(`DONE`/`CANCELED`/`HOLD` 불가) | `FG_LABELS` 신규 1행, `STATUS='ISSUED'`. SG·자재·실적·재고는 아직 미반영 |
| **실물 라벨 스캔 확인 / 확인 버튼** | `POST /production/subprocess-kitting/confirm` | FG 라벨이 `ISSUED` + `orderNo` 일치 + genealogy 미존재(중복 확정 방지) | 아래 "확정 로직" 참고 |
| 발행 취소(되돌리기 아이콘) | API 없음(프론트 상태만 리셋) | — | `FG_LABELS.STATUS='ISSUED'` 레코드는 그대로 남음 |

## 확정(confirm) 로직
1. `FgLabel` 조회 — `status='ISSUED'` 및 `orderNo` 일치 확인, `PRODUCT_GENEALOGY`에 이미 `parentType='FG', parentKey=fgBarcode`가 있으면 중복 확정으로 거부.
2. 작업지시 + `BOM_MASTERS`(`useYn='Y'`, 작업지시 계획일 기준 `validFrom~validTo`) 조회, `SEMI_PRODUCT`/`RAW_MATERIAL` 자식으로 분류.
3. 라우팅에 `ROUTING_MATERIALS` 배정이 있으면 현재 `processCode`(seq)에 배정된 원자재만 남기고 나머지는 차감 대상에서 제외(공정별 BACKFLUSH). 배정이 없으면 BOM 원자재 전체가 차감 대상입니다.
4. 스캔된 SG 전건 검증(존재/상태/잔량/오투입) 후 1개씩 `REMAIN_QTY` 차감 + `PRODUCT_GENEALOGY`(FG→SG, qty=1) 생성.
5. 원자재는 `WipMatStockService.deductStockInTx`로 설비 재고에서 BOM `qtyPer`만큼 차감(`PROD_CONSUME`, `stockPolicy='BLOCK'`) 후 차감된 LOT별로 `PRODUCT_GENEALOGY`(FG→MAT_LOT) 생성.
6. `PROD_RESULTS` 1건 저장(`goodQty=1, defectQty=0, status='DONE'`). 작업지시가 `WAITING`이면 `RUNNING`으로 승격, `startAt` 기록.
7. `ProductInventoryService.receiveStockInTx`로 `PRODUCT_STOCKS`의 `FG_WIP` 창고에 완제품 1 적재(`WIP_IN`).
8. 라우팅 `RoutingProcess.issueLabelType='FG'`인 공정이면 응답의 `printFg=true` — 프론트가 이 값을 보고 `FgLabelPrintHost`로 실물 라벨을 자동 출력합니다. `issueLabelType`이 다르면 데이터는 항상 발행되지만 프린터 출력만 생략됩니다.

## 사전 설정 (마스터·공통코드)
- 완제품 BOM(`BOM_MASTERS`, `useYn='Y'`, 유효기간에 작업지시 계획일 포함)에 `SEMI_PRODUCT`·`RAW_MATERIAL` 자식이 등록돼 있어야 합니다.
- 설비 마스터(`EquipMaster.processCode`)가 지정돼 있어야 설비 선택만으로 공정이 결정됩니다.
- 공정별 자재 배정을 쓰려면 `ROUTING_MATERIALS`에 해당 라우팅·공정 배정을 등록합니다(미등록 시 BOM 원자재 전체가 차감 대상).
- FG 라벨 자동 인쇄를 쓰려면 해당 공정의 `RoutingProcess.issueLabelType='FG'`로 설정합니다.

## 운영 절차
1. 조립 전 해당 공정의 원자재가 `PROC_MAT_STOCKS`(장착 대기)까지 출고돼 있는지 확인합니다.
2. 설비 선택 → 작업지시 선택 순서로 진행하도록 안내합니다(설비가 조회 조건을 결정하므로 순서를 바꾸면 재선택이 필요합니다).
3. 발행 후 확정하지 않고 방치된 `ISSUED` FG 라벨이 있는지 주기적으로 점검합니다(cancel API 없음 — 위 경고 참고).
4. 확정 실패가 반복되면 BOM 유효기간(`validFrom/validTo`)과 작업지시 계획일(`planDate`)을 함께 확인합니다(계획일이 없거나 BOM 유효기간 밖이면 확정 불가).

## 권한
- 생산 현장 작업자는 설비/작업지시 선택, 자재 장착·해제, SG 스캔, 조립 실행·확정을 수행합니다.
- 인증 가드가 걸린 것은 `equip-material` 컨트롤러(`JwtAuthGuard`)뿐이며, `subprocess-kitting` 컨트롤러는 별도 가드 데코레이터가 없어 전역 가드 설정을 따릅니다.
- 자재 마스터·BOM·라우팅 배정 변경은 생산기술 담당자가 기준정보 화면에서 수행합니다.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 작업지시가 조회되지 않음 | 설비 미선택, 또는 설비 공정과 작업지시 공정 불일치 | 설비 선택 여부와 `EquipMaster.processCode`·작업지시 `processCode`를 확인 |
| 자재 스캔 시 "장착할 공정재고가 없습니다" | 해당 LOT이 `PROC_MAT_STOCKS`에 없음(출고 미이행) | 원자재 출고(공정 입고) 처리 후 재시도 |
| SG 스캔 "BOM에 없는 반제품입니다(오투입)" | SG 품목이 완제품 BOM의 `SEMI_PRODUCT` 자식 목록에 없음 | BOM 등록 상태와 스캔한 라벨의 품목코드를 대조 |
| 확정 시 "완제품 BOM이 없습니다" | `BOM_MASTERS`에 유효기간 내 레코드가 없음 | BOM 유효기간(`validFrom/validTo`)과 작업지시 계획일 확인 |
| 확정 시 "이미 확정된 FG 라벨입니다" | `PRODUCT_GENEALOGY`에 해당 FG 이력이 이미 존재(중복 확정 시도) | 같은 라벨을 재스캔하지 않았는지 확인, 필요 시 조회 화면에서 이력 확인 |
| 발행만 되고 확정 안 된 라벨이 남음 | "발행 취소"는 화면 상태만 리셋(cancel API 없음) | `FG_LABELS`에서 `STATUS='ISSUED'`이고 genealogy가 없는 오래된 행을 조회해 수기 정리 |

## 데이터·연계
- 화면 경로: `/production/input-assembly`
- 주요 테이블: `FG_LABELS`, `SG_LABELS`, `WIP_MAT_STOCKS`, `PROC_MAT_STOCKS`, `PRODUCT_GENEALOGY`, `PROD_RESULTS`, `PRODUCT_STOCKS`, `BOM_MASTERS`, `ROUTING_MATERIALS`, `JOB_ORDERS`
- 주요 API: `GET /production/subprocess-kitting/assembly-requirements/:orderNo`, `GET /production/subprocess-kitting/sg-label/:sgBarcode`, `POST /production/subprocess-kitting/issue-label`, `POST /production/subprocess-kitting/confirm`, `POST /production/equip-material/mount`, `POST /production/equip-material/unmount`, `POST /production/job-orders/:orderNo/material-mounts/scan`
- 멀티테넌시: `COMPANY='40'`, `PLANT_CD='1000'`
- 관련 화면: 작업지시 관리(`PROD_ORDER`), 서브공정 키팅(`PROD_KITTING`), 생산실적(`PROD_RESULT`)
