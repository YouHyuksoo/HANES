---
menuCode: MAT_ARRIVAL
audience: operator
title: 입하관리 — 운영 가이드
summary: 입하관리 DB 구조(MAT_ARRIVALS, MAT_LOTS, MAT_ARRIVAL_STOCKS, PURCHASE_ORDER_ITEMS), PO 라인 입하 로직, 역분개 취소, IQC 연계, 멀티테넌시 스코프
tags: [자재, 입하, 운영, DB, LOT, IQC, 역분개]
keywords: [MAT_ARRIVALS, MAT_LOTS, MAT_ARRIVAL_STOCKS, MAT_ARRIVAL_TRANSACTIONS, PURCHASE_ORDERS, PURCHASE_ORDER_ITEMS, ARRIVAL_NO, MAT_UID, IQC_STATUS, LINE_STATUS, ARRIVAL_TYPE, MFG_PARTNER_CODE, 역분개, 멀티테넌시, COMPANY, PLANT_CD, 입하취소, LOT채번, 시리얼]
related: [PUR_PO, QC_IQC, MAT_ARRIVAL_RESULT, MAT_ARRIVAL_TRANSACTION, INV_ARRIVAL_STOCK]
---

# 입하관리 — 운영 가이드

## 시스템 목적·역할
공급업체가 납품한 자재를 **발주(PO) 라인 단위로 입하 등록**하고, 자재 LOT(MAT_LOTS) 시리얼을 채번하는 화면입니다. 입하 시점에 `MAT_ARRIVALS`(업무 이력) + `MAT_LOTS`(LOT 추적) + `MAT_ARRIVAL_STOCKS`(입하대기 재고) 세 테이블이 동시에 생성됩니다. 입고(원자재 현재고 `MAT_STOCKS` 반영)는 IQC 합격 후 별도 처리입니다.

## 데이터 구조
```
PURCHASE_ORDERS (PK: PO_NO)
  └─ PURCHASE_ORDER_ITEMS (PK: PO_ID + SEQ)
       │   LINE_STATUS: OPEN → PARTIAL → CLOSE
       │   RECEIVED_QTY 누적 업데이트
       ↓ 입하 등록
MAT_ARRIVALS (PK: ARRIVAL_NO + SEQ)
  ├─ MAT_LOTS (PK: MAT_UID)   ← LOT 추적·IQC
  │     IQC_STATUS: PENDING → PASS/FAIL/HOLD
  └─ MAT_ARRIVAL_STOCKS (PK: COMPANY + PLANT_CD + MAT_UID)
         STATUS: AVAILABLE   ← IQC 대기 입하재고

MAT_ARRIVAL_TRANSACTIONS (PK: TRANS_NO)
       ← 입하·취소 원장 (ARRIVAL_IN / ARRIVAL_CANCEL)
```

---

## ① PO 라인 — PURCHASE_ORDERS / PURCHASE_ORDER_ITEMS

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 발주번호 | `PURCHASE_ORDERS.PO_NO` | PK. 입하 가능 조건: `STATUS IN ('CONFIRMED', 'PARTIAL')`. |
| 거래처 | `PURCHASE_ORDERS.PARTNER_ID / PARTNER_NAME` | 공급업체. `MAT_ARRIVALS.VENDOR_ID/VENDOR_NAME`으로 복사됨. |
| 발주일 | `PURCHASE_ORDERS.ORDER_DATE` | DATE 타입. |
| 납기일 | `PURCHASE_ORDERS.DUE_DATE` | DATE 타입. 화면에 현재 표시되지 않음. |
| 사용구분 | `PURCHASE_ORDERS.USE_TYPE` | 공통코드 `PO_USE_TYPE`(예: PROD). 그리드 표시. |
| 라인번호 | `PURCHASE_ORDER_ITEMS.LINE_NO` | 발주서 내 순번(L/N). |
| 개정번호 | `PURCHASE_ORDER_ITEMS.REV_NO` | 라인 개정번호(R/N). 기본값 1. |
| 품목코드 | `PURCHASE_ORDER_ITEMS.ITEM_CODE` | `ITEM_MASTERS.ITEM_CODE` 참조. |
| 발주수량 | `PURCHASE_ORDER_ITEMS.ORDER_QTY` | INT. |
| 누적입하 | `PURCHASE_ORDER_ITEMS.RECEIVED_QTY` | 입하 등록 시마다 증가. 잔량 = ORDER_QTY − RECEIVED_QTY. |
| 라인상태 | `PURCHASE_ORDER_ITEMS.LINE_STATUS` | `OPEN`(미입하) / `PARTIAL`(일부입하) / `CLOSE`(완료). 서버에서 자동 재계산. |

---

## ② 입하 헤더 — MAT_ARRIVALS

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 입하번호 | `ARRIVAL_NO` | PK(복합). Oracle Sequence `ARRIVAL` 채번. 같은 배치의 여러 품목은 동일 `ARRIVAL_NO`를 공유. |
| SEQ | `SEQ` | PK(복합). 같은 `ARRIVAL_NO` 내 순번. 1부터 시작. |
| PO번호 | `PO_NO` | 연결된 발주번호. 수동 입하는 NULL. |
| PO_ID | `PO_ID` | `PURCHASE_ORDERS.PO_NO` 참조. |
| PO_ITEM_ID | `PO_ITEM_ID` | `PURCHASE_ORDER_ITEMS.SEQ` 참조. |
| 인보이스번호 | `INVOICE_NO` | 공급업체 인보이스 번호(거래 추적용). 현재 PO 입하 모달에서는 입력 UI 없음(수동 입하에서만 입력). |
| 거래처 ID | `VENDOR_ID` | PO의 `PARTNER_ID`에서 복사. |
| 거래처명 | `VENDOR_NAME` | PO의 `PARTNER_NAME`에서 복사. |
| 공급사 UID | `SUP_UID` | 납품업체가 자체 부여한 자재 시리얼(선택). |
| 품목코드 | `ITEM_CODE` | `ITEM_MASTERS.ITEM_CODE` 참조. |
| 입하수량 | `QTY` | INT. 이번 입하에서 등록된 수량. |
| 창고코드 | `WAREHOUSE_CODE` | 입하 적치 창고. |
| 입하일시 | `ARRIVAL_DATE` | TIMESTAMP. 사용자가 입력한 입하일 기준 저장. |
| 입하유형 | `ARRIVAL_TYPE` | `PO`(발주 기반) / `MANUAL`(수동). |
| 작업자 | `WORKER_ID` | 등록 사용자 ID. |
| IQC 상태 | `IQC_STATUS` | 입하 직후 `PENDING`. 수입검사 결과에 따라 변경. |
| 상태 | `STATUS` | `DONE` / `CANCELED`. 취소 시 역분개로 전환. |
| 비고 | `REMARK` | 메모. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | `'40'` / `'1000'` 스코프. |

---

## ③ 자재 LOT — MAT_LOTS

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 자재 UID | `MAT_UID` | PK. Oracle Sequence `VH1-RM...` 형식 채번. LOT의 유일 식별자(라벨 바코드). |
| 품목코드 | `ITEM_CODE` | `ITEM_MASTERS.ITEM_CODE` 참조. |
| 초기수량 | `INIT_QTY` | 입하 시 발급된 원수량. 불변값. 수불이 발생해도 변경 안 됨. |
| 현재수량 | `CURRENT_QTY` | 현재 잔량. 불출 시 감소. 신규 LOT는 INIT_QTY와 동일. |
| 입고일 | `RECV_DATE` | 입하 등록 시점의 날짜(TIMESTAMP). |
| 제조일 | `MANUFACTURE_DATE` | 자재 제조일(선택). 수동 입하에서 입력 가능. |
| 유효기한 | `EXPIRE_DATE` | 유효기한 일자. 현재 자동 계산 안 됨(NULL). |
| 입하번호 | `ARRIVAL_NO` | `MAT_ARRIVALS.ARRIVAL_NO` 참조. LOT 역추적에 사용. |
| 입하 SEQ | `ARRIVAL_SEQ` | `MAT_ARRIVALS.SEQ`와 연결. |
| 원산지 | `ORIGIN` | LOT 분할·병합 추적용. 최초 입하 시 `MAT_UID`와 동일값. |
| 거래처 | `VENDOR` | PO의 `PARTNER_ID`. |
| 제조사 코드 | `MFG_PARTNER_CODE` | 실제 제조사(`PARTNER_MASTERS` MFG 유형). 입하 모달에서 필수 선택. 라벨 출력에 사용. |
| 인보이스번호 | `INVOICE_NO` | 거래 추적용. |
| PO번호 | `PO_NO` | 연결 발주번호. |
| IQC 상태 | `IQC_STATUS` | `PENDING`(검사 대기) / `PASS` / `FAIL` / `HOLD`. 수입검사(IQC) 화면에서 갱신됨. |
| 특채여부 | `SPECIAL_ACCEPT_YN` | `Y`=불합격 자재를 양품으로 특별 채택. 기본 `N`. |
| LOT 상태 | `STATUS` | `NORMAL`(정상) / `HOLD`(보류) / `DEPLETED`(소진) / `SPLIT`(분할) / `MERGED`(병합). |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | `'40'` / `'1000'` 스코프. |

---

## ④ 입하재고 — MAT_ARRIVAL_STOCKS

IQC 통과 전 대기 재고입니다. 합격 후 `MAT_STOCKS`(원자재 현재고)로 이동됩니다.

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 자재 UID | `MAT_UID` | PK(복합). LOT 단위 재고 행. |
| 입하번호 | `ARRIVAL_NO` | 연결 입하번호. |
| 입하 SEQ | `ARRIVAL_SEQ` | 연결 입하 순번. |
| 창고코드 | `WAREHOUSE_CODE` | 적치 창고. |
| 품목코드 | `ITEM_CODE` | 자재 품목코드. |
| 수량 | `QTY` | 총 보유 수량. |
| 가용수량 | `AVAILABLE_QTY` | 불출 가능한 수량. IQC HOLD 시 0. |
| 상태 | `STATUS` | `AVAILABLE`(가용) / `HOLD`(IQC 보류 등). |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | PK(복합). |

---

## ⑤ 입하 원장 — MAT_ARRIVAL_TRANSACTIONS

| DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|
| `TRANS_NO` | PK. 트랜잭션 번호. |
| `TRANS_TYPE` | `ARRIVAL_IN`(입하) / `ARRIVAL_CANCEL`(취소 역분개). |
| `TRANS_DATE` | 트랜잭션 발생 일시(TIMESTAMP). |
| `ARRIVAL_NO` | 연결 입하번호. |
| `ARRIVAL_SEQ` | 연결 입하 순번. |
| `WAREHOUSE_CODE` | 창고. |
| `ITEM_CODE` | 품목코드. |
| `MAT_UID` | LOT 시리얼. |
| `QTY` | 수량(취소 시 음수). |
| `UNIT_PRICE` | 단가(DECIMAL 12,4). |
| `TOTAL_AMOUNT` | 금액(DECIMAL 14,2). |
| `REF_TYPE` | 참조 유형(취소 연결 등). |
| `REF_ID` | 참조 ID. |
| `CANCEL_REF_ID` | 역분개 시 원본 트랜잭션 ID. |
| `WORKER_ID` | 처리 사용자. |
| `STATUS` | `DONE` / `CANCELED`. |
| `COMPANY`, `PLANT_CD` | 멀티테넌시 스코프. |

---

## 입하 등록 로직 (PO 기반)

1. `PURCHASE_ORDERS.STATUS IN ('CONFIRMED', 'PARTIAL')` 검증.
2. 잔량(= `ORDER_QTY - RECEIVED_QTY`) 초과 여부 검증.
3. Oracle Sequence로 `ARRIVAL_NO` 채번(`ARRIVAL` 채번 키).
4. Oracle Sequence로 `MAT_UID`(자재 시리얼) 채번(`VH1-RM...` 형식).
5. `MAT_ARRIVALS` 레코드 생성(`IQC_STATUS = 'PENDING'`, `STATUS = 'DONE'`).
6. `MAT_LOTS` 레코드 생성(`INIT_QTY = CURRENT_QTY = 입하수량`, `IQC_STATUS = 'PENDING'`).
7. `MAT_ARRIVAL_STOCKS` 레코드 생성(`STATUS = 'AVAILABLE'`).
8. `MAT_ARRIVAL_TRANSACTIONS` 레코드 생성(`TRANS_TYPE = 'ARRIVAL_IN'`).
9. `PURCHASE_ORDER_ITEMS.RECEIVED_QTY` 증가.
10. `PURCHASE_ORDER_ITEMS.LINE_STATUS` 재계산(OPEN → PARTIAL → CLOSE).
11. `PURCHASE_ORDERS.STATUS` 재계산(CONFIRMED → PARTIAL → CLOSED).

> 원자재 현재고(`MAT_STOCKS`)는 IQC 합격 후 **입고** 시점에만 증가합니다. 입하 단계에서는 `MAT_ARRIVAL_STOCKS`에만 쌓입니다.

## 입하 취소 로직 (역분개)

- API: `POST /material/arrivals/cancel` (`transactionId`, `reason`)
- 삭제가 아닌 역분개: 원본 `MAT_ARRIVAL_TRANSACTIONS.STATUS = 'CANCELED'`, 반대 수량의 `ARRIVAL_CANCEL` 트랜잭션 신규 생성.
- `MAT_ARRIVALS.STATUS = 'CANCELED'`, `MAT_ARRIVAL_STOCKS` 재고 차감.
- 취소 사유는 필수이며, 원본 트랜잭션이 `DONE` + `ARRIVAL_IN` 상태일 때만 가능합니다.

---

## API 경로

| 목적 | 경로 |
|------|------|
| PO 라인 목록 조회 | `GET /material/arrivals/po-lines` |
| PO 라인 입하 등록 | `POST /material/arrivals/po-line` |
| 수동 입하 등록 | `POST /material/arrivals/manual` |
| 입하 취소 | `POST /material/arrivals/cancel` |

---

## 사전 설정 (마스터·공통코드)

- 발주(PO)가 `CONFIRMED` 상태 이상이어야 입하 목록에 나타납니다.
- 품목마스터(`ITEM_MASTERS`)에 `LOT_UNIT_QTY`(시리얼 구성단위) 설정 필요 — 미설정 시 입하 수량 전체가 1 LOT으로 발급됩니다.
- 원자재 창고(`WAREHOUSES`, `WAREHOUSE_TYPE = 'RAW'`) 사전 등록 필요.
- 제조사(`PARTNER_MASTERS`, `PARTNER_TYPE = 'MFG'`) 사전 등록 필요.
- 공통코드: `PO_LINE_STATUS`(OPEN/PARTIAL/CLOSE), `PO_USE_TYPE`, `PO_STATUS`.
- 라벨 출력을 위한 `mat_lot` 카테고리 라벨 템플릿 설정 권장(`/master/label-templates`).

---

## 권한

| 역할 | 허용 작업 |
|------|------|
| 일반 사용자 | PO 라인 조회, PO 기반 입하 등록, 라벨 출력 |
| 물류/자재 담당자 | 위 + 수동 입하 |
| 운영자/관리자 | 위 + 입하 취소(역분개) |

---

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| PO 라인이 목록에 안 보임 | `PURCHASE_ORDERS.STATUS`가 `DRAFT`이거나 `CLOSED` | 발주관리에서 PO를 CONFIRM 처리하거나 상태 확인 |
| 자재입하 버튼이 비활성화 | `LINE_STATUS = 'CLOSE'` 또는 `REMAINING_QTY <= 0` | 잔량 확인. 필요하면 발주 수량 수정 후 재처리 |
| 입하수량이 잔량 초과 오류 | `receivedQty > remainingQty` | 입력 수량이 잔량 이내인지 확인 |
| 시리얼 수가 예상보다 많음 | `LOT_UNIT_QTY`가 너무 작게 설정됨 | 품목마스터에서 `LOT_UNIT_QTY` 수정 |
| 라벨이 출력 안 됨 | Print Agent 미실행 또는 포트 연결 오류 | 로컬 Print Agent 실행 상태 확인 |
| IQC 대기 상태가 안 바뀜 | IQC 화면에서 검사 미등록 | 수입검사(IQC) 화면에서 해당 LOT 검사 진행 |
| 입하 취소 버튼이 안 보임 | 트랜잭션 상태가 `CANCELED`이거나 `ARRIVAL_CANCEL` 유형 | 이미 취소된 건임. 원본 트랜잭션 조회 필요 |
| 입하 후 `MAT_STOCKS` 수량 변화 없음 | 정상 동작. 입고는 IQC 합격 후 별도 처리 | [입하재고] 화면에서 IQC 대기 수량 확인 |

---

## 데이터·연계

| 항목 | 내용 |
|------|------|
| 주요 테이블 | `MAT_ARRIVALS`, `MAT_LOTS`, `MAT_ARRIVAL_STOCKS`, `MAT_ARRIVAL_TRANSACTIONS`, `PURCHASE_ORDERS`, `PURCHASE_ORDER_ITEMS` |
| 참조 마스터 | `ITEM_MASTERS`, `PARTNER_MASTERS`, `WAREHOUSES` |
| 연계 화면 | 발주관리(PO 상태), 수입검사(IQC 결과), 입하결과(이력·취소), 입하재고(대기재고) |
| 멀티테넌시 스코프 | `COMPANY = '40'`, `PLANT_CD = '1000'` — 모든 조회·저장 시 공통 필터 |
