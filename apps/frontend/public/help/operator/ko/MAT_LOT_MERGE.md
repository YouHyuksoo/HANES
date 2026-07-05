---
menuCode: MAT_LOT_MERGE
audience: operator
title: 자재병합 — 운영 가이드
summary: 자재 LOT 병합 DB 구조(MAT_LOTS, MAT_STOCKS, STOCK_TRANSACTIONS), 병합 로직(원본 폐기 후 신규 시리얼 발번), 게이팅 조건, API, 멀티테넌시 스코프
tags: [자재, LOT, 병합, 운영, DB, 시리얼, 수불]
keywords: [로트병합, LOT 병합, 자재병합, MAT_LOTS, MAT_STOCKS, STOCK_TRANSACTIONS, MAT_UID, INIT_QTY, CURRENT_QTY, ARRIVAL_NO, ORIGIN, STATUS, MERGED, LOT_MERGE_IN, LOT_MERGE_OUT, 입고완료게이팅, 채번, SEQ_MAT_SERIAL_DAILY, STOCK_TX, 멀티테넌시, COMPANY, PLANT_CD, lot-split]
related: [MAT_LOT_SPLIT, MAT_ARRIVAL, QC_IQC]
---

# 자재병합 — 운영 가이드

## 시스템 목적·역할
같은 품목·같은 입하건의 자재 LOT(`MAT_LOTS`) 여러 개를 **하나의 신규 통합 시리얼로 합치는** 화면입니다. 병합 시 원본 LOT은 전부 폐기(`STATUS='MERGED'`, 재고 0)되고, 합산 수량을 가진 **신규 `MAT_UID` 1개**가 발번됩니다. 재고(`MAT_STOCKS`)와 수불 원장(`STOCK_TRANSACTIONS`)이 트랜잭션 단위로 정합성 있게 갱신됩니다. 자재분할(LOT 분할)과 대칭 동작이며, 분할/병합 재가공(분할 결과를 다시 병합, 병합 결과를 다시 분할)을 지원합니다.

설계 근거: `docs/specs/2026-06-08-lot-split-merge-redesign-design.md`.

## 데이터 구조
```
MAT_LOTS (PK: MAT_UID)                      ← LOT 추적·상태
  STATUS: NORMAL → MERGED(원본 폐기)
  ORIGIN: 분할·병합 추적용 최초 시리얼 계승
       │
       ├─ MAT_STOCKS (PK: COMPANY+PLANT_CD+WAREHOUSE_CODE+ITEM_CODE+MAT_UID)
       │     QTY / AVAILABLE_QTY / RESERVED_QTY  ← 현재고 (병합 기준 수량)
       │
       └─ STOCK_TRANSACTIONS (PK: TRANS_NO)      ← 수불 원장
             TRANS_TYPE: LOT_MERGE_OUT(원본 출고) / LOT_MERGE_IN(신규 입고)
             REF_TYPE='LOT_MERGE', REF_ID=ORIGIN

검증 참조: MAT_ISSUE(출고 이력), PART_MASTER(품목), PARTNER_MASTER(거래처)
```

> 병합 가능 수량의 기준은 `MAT_STOCKS.QTY`(현재고)입니다. `MAT_LOTS.CURRENT_QTY`가 아니라 실제 현재고를 합산합니다.

---

## ① 병합 가능 LOT 목록 — MAT_LOTS + MAT_STOCKS (그리드)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 자재시리얼 | `MAT_LOTS.MAT_UID` | PK. 병합 대상 식별 키(라벨 바코드). |
| 품목코드 | `MAT_LOTS.ITEM_CODE` | `PART_MASTER.ITEM_CODE` 참조. 병합은 동일 `ITEM_CODE`만 허용. |
| 품목명 | `PART_MASTER.ITEM_NAME` | `attachMeta`에서 조인 부착(컬럼 아님). |
| 수량 | `MAT_STOCKS.QTY` | 현재 재고 수량. 병합 합산의 기준값. `attachMeta`에서 부착. |
| 입하번호 | `MAT_LOTS.ARRIVAL_NO` | 동일 입하번호 LOT만 병합 가능(입하 라벨/정보 계승). NULL이면 병합 불가. |
| 공급처 | `MAT_LOTS.VENDOR` | 거래처 코드. `PARTNER_MASTER.PARTNER_NAME`을 조인해 `vendorName`으로 표시. |
| 최초시리얼(내부) | `MAT_LOTS.ORIGIN` | 분할·병합 추적용. 신규 LOT이 계승(`base.origin || base.matUid`). 그리드 정렬 키. |
| 단위(내부) | `PART_MASTER.UNIT` | 수량 표시 단위. `attachMeta` 부착. |

> 목록 게이팅 조건(`findMergeableLots`): `MAT_STOCKS.QTY > 0` AND `MAT_LOTS.STATUS='NORMAL'` AND `NVL(RESERVED_QTY,0)=0` AND **입고완료**(아래 로직 참조).

---

## ② 자재 LOT — MAT_LOTS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 자재 UID | `MAT_UID` (varchar2 50) | PK. 시리얼. 신규 병합 LOT은 `SEQ_MAT_SERIAL_DAILY`로 채번(`VH1-RM...`). |
| 품목코드 | `ITEM_CODE` (varchar2 50) | 품목. 신규 LOT은 원본 품목 계승. |
| 초기수량 | `INIT_QTY` (int) | 불변 원수량. 신규 LOT은 `totalQty`(합산 수량)로 생성. 입고완료 게이팅 비교 기준. |
| 현재수량 | `CURRENT_QTY` (int) | 현재 잔량. 원본은 병합 시 0으로 갱신, 신규는 `totalQty`. |
| 입고일 | `RECV_DATE` (date) | 신규 LOT은 첫 스캔(base) LOT의 값 계승. |
| 제조일 | `MANUFACTURE_DATE` (date) | 신규 LOT은 base 계승. |
| 유효기한 | `EXPIRE_DATE` (date) | 신규 LOT은 원본 중 **가장 이른 일자**를 보수적 계승. |
| 입하번호 | `ARRIVAL_NO` (varchar2 50) | 병합 핵심 키. 모든 원본이 동일해야 함. 신규 LOT이 계승. |
| 입하 SEQ | `ARRIVAL_SEQ` (number) | base 계승. 라벨 발행에 사용. |
| 원산지/추적 | `ORIGIN` (varchar2 50) | 신규 LOT = `base.origin || base.matUid`. 수불 `REF_ID`로도 기록. |
| 거래처 | `VENDOR` (varchar2 50) | base 계승. |
| 제조사 코드 | `MFG_PARTNER_CODE` (varchar2 50) | base 계승. 동일 입하건이므로 제조사 일치 가정. 라벨 인쇄. |
| 인보이스번호 | `INVOICE_NO` (varchar2 50) | base 계승. |
| PO번호 | `PO_NO` (varchar2 50) | base 계승. |
| IQC 상태 | `IQC_STATUS` (varchar2 20) | base 계승. |
| 특채여부 | `SPECIAL_ACCEPT_YN` (char 1) | 기본 N. |
| LOT 상태 | `STATUS` (varchar2 20) | `NORMAL`/`HOLD`/`DEPLETED`/`SPLIT`/`MERGED`. 원본→`MERGED`, 신규→`NORMAL`. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | `'40'` / `'1000'` 스코프. 모든 조회·저장 필터. |
| 감사 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 생성/수정 사용자·시각. |

---

## ③ 자재 재고 — MAT_STOCKS

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 창고코드 | `WAREHOUSE_CODE` | PK(복합). 신규 LOT은 base LOT의 창고 계승. |
| 위치코드 | `LOCATION_CODE` | base 계승. |
| 품목코드 | `ITEM_CODE` | PK(복합). |
| 자재 UID | `MAT_UID` | PK(복합). |
| 수량 | `QTY` | 병합 합산 기준. 원본은 0으로 갱신, 신규는 `totalQty`. |
| 가용수량 | `AVAILABLE_QTY` | 원본 0, 신규 `totalQty`. |
| 예약수량 | `RESERVED_QTY` | 0보다 크면 병합 불가(게이팅·검증). 신규는 0. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | PK(복합) 스코프. |

---

## ④ 수불 원장 — STOCK_TRANSACTIONS

병합 1건당 원본 수만큼의 `LOT_MERGE_OUT` + 신규 1건의 `LOT_MERGE_IN`이 기록됩니다.

| DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|
| `TRANS_NO` | PK. `NumberingService.next('STOCK_TX')` 채번. |
| `TRANS_TYPE` | `LOT_MERGE_OUT`(원본 출고, 음수) / `LOT_MERGE_IN`(신규 입고, 양수). |
| `TRANS_DATE` | 트랜잭션 일시. |
| `FROM_WAREHOUSE_ID` | OUT: 원본 LOT 창고. |
| `TO_WAREHOUSE_ID` | IN: 신규 LOT 창고. |
| `ITEM_CODE` | 품목코드. |
| `MAT_UID` | OUT: 원본 시리얼 / IN: 신규 시리얼. |
| `QTY` | OUT: `-원본재고` / IN: `+합산수량`. |
| `REF_TYPE` | `'LOT_MERGE'`. |
| `REF_ID` | OUT: 원본 `MAT_UID` / IN: `ORIGIN`(원본 목록은 길이 제한으로 REMARK에 기록). |
| `REMARK` | `자재병합: [원본시리얼들] → 신규 (합산수량)` 형식. |
| `STATUS` | `'DONE'`. 입고완료 게이팅 SQL은 `STATUS <> 'CANCELED'`만 집계. |
| `WORKER_ID`, `CREATED_BY` | 처리 사용자. |
| `COMPANY`, `PLANT_CD` | 멀티테넌시 스코프. |

---

## 병합 로직 (동작 순서)

`POST /material/lot-merge` (`LotMergeService.merge`), 단일 DB 트랜잭션(`TransactionService.run`):

1. `sourceLotIds` 중복 제거 후 **2개 이상** 검증.
2. 모든 `MAT_UID`를 `MAT_LOTS`에서 조회 — 누락 시 404. 테넌트 일치 검증.
3. **동일 품목** 검증(`ITEM_CODE` 단일).
4. **동일 입하번호** 검증(`ARRIVAL_NO` 단일, NULL 불가).
5. `MAT_STOCKS` 조회 → 시리얼별 재고 맵 구성.
6. LOT별 상태/재고/예약/입고완료 검증:
   - `STATUS='HOLD'` 불가, `STATUS<>'NORMAL'` 불가.
   - `QTY<=0` 불가, `RESERVED_QTY>0` 불가.
   - **입고완료 게이팅**: `SUM(STOCK_TRANSACTIONS.QTY WHERE TRANS_TYPE IN ('RECEIVE','LOT_SPLIT_IN','LOT_MERGE_IN') AND STATUS<>'CANCELED') >= MAT_LOTS.INIT_QTY`.
7. **출고 이력** 검증(`MAT_ISSUE` 중 `STATUS<>'CANCELED'` 존재 시 불가).
8. 품목(`PART_MASTER`) 조회·테넌트 검증.
9. 합산값 계산: `totalQty=Σ재고`, `origin=base.origin||base.matUid`, `expireDate=MIN(원본 유효기한)`.
10. **원본 폐기**: 각 원본에 대해 `LOT_MERGE_OUT`(−재고) 수불 기록 → `MAT_LOTS.STATUS='MERGED', CURRENT_QTY=0` → `MAT_STOCKS.QTY=0, AVAILABLE_QTY=0`.
11. **신규 시리얼 발번**: `numbering.nextMatSerial`로 `MAT_UID` 생성, `MAT_LOTS`(`STATUS='NORMAL'`, base 정보 계승) + `MAT_STOCKS`(`QTY=AVAILABLE_QTY=totalQty`, `RESERVED_QTY=0`) 생성.
12. **신규 입고** `LOT_MERGE_IN`(+합산수량) 수불 기록.
13. 응답: `newLotNo`, `mergedLotNos`, `totalQty`, `itemCode`, `itemName`, `arrivalNo`, 라벨 데이터(`MatLabelPreviewModal` 재사용).

> `by-barcode/:matUid`(`findByBarcode`)는 스캔 단건의 병합 자격(상태/재고/예약/입고완료/출고이력)을 선제 검증해 프론트 누적에 사용합니다.

---

## API 경로

| 목적 | 경로 |
|------|------|
| 병합 가능 LOT 목록 | `GET /material/lot-merge` (`search`, `itemCode`, `limit`) |
| 바코드 단건 자격 검증 | `GET /material/lot-merge/by-barcode/:matUid` |
| LOT 병합 실행 | `POST /material/lot-merge` (`sourceLotIds[]`, `remark?`) — `InventoryFreezeGuard` 적용 |

---

## 사전 설정 (마스터·공통코드)

- 병합 대상 LOT이 **입고완료**(IQC 합격 후 입고로 `MAT_STOCKS`에 반영)되어 있어야 목록에 노출됩니다.
- 신규 시리얼 채번 시퀀스(`SEQ_MAT_SERIAL_DAILY`)·수불 채번 키(`STOCK_TX`)가 정상 동작해야 합니다.
- 제조사(`PARTNER_MASTER`, `PARTNER_TYPE='MFG'`)가 등록되어 있어야 라벨 제조사명이 표시됩니다.
- 라벨 출력용 `mat_lot` 카테고리 라벨 템플릿 설정 권장(`/master/label-templates`).
- 재고 마감(`InventoryFreezeGuard`) 기간에는 병합 실행이 차단될 수 있습니다.

---

## 운영 절차

1. 병합할 LOT을 목록/검색에서 확인하거나 바코드로 스캔해 누적합니다(2개 이상, 동일 품목·동일 입하번호).
2. **선택 병합** → 확인 모달에서 합산 수량 확인 → **병합 실행**.
3. 원본 폐기·신규 발번이 단일 트랜잭션으로 처리됩니다(부분 실패 시 전체 롤백).
4. 신규 시리얼 라벨을 출력해 통합 박스에 부착합니다.

---

## 권한

| 역할 | 허용 작업 |
|------|------|
| 일반 사용자 | 병합 가능 LOT 조회, 바코드 누적, 병합 실행, 라벨 출력 |
| 물류/자재 담당자 | 위와 동일 |
| 운영자/관리자 | 위 + 재고 마감/예외 처리 판단 |

---

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| 목록에 LOT이 없음 | 재고 0 / 예약 보유 / 입고 미완료 / 비정상 상태 | 입고확정·예약 해제·상태 확인 |
| "입고완료된 LOT만 병합" 오류 | `SUM(입고수불) < INIT_QTY` | IQC 합격 후 입고확정 진행 |
| "서로 다른 품목" 오류 | 누적 LOT의 `ITEM_CODE` 불일치 | 동일 품목 LOT만 선택 |
| "입하번호가 동일한 LOT만" 오류 | `ARRIVAL_NO` 불일치 또는 NULL | 같은 입하건의 LOT만 병합 |
| "예약 수량이 있는 LOT" 오류 | `RESERVED_QTY > 0` | 예약/할당 해제 후 재시도 |
| "이미 자재출고 이력" 오류 | `MAT_ISSUE`에 활성 출고 존재 | 해당 LOT 출고 정리 후 재시도 |
| 신규 시리얼 채번 실패 | 시퀀스/채번 키 이상 | `SEQ_MAT_SERIAL_DAILY`·`STOCK_TX` 상태 점검 |
| 병합 버튼 비활성 | 누적 2개 미만 | 시리얼을 2개 이상 누적 |
| 라벨 미출력 | Print Agent 미실행 | 로컬 Print Agent 상태 확인 |

---

## 데이터·연계

| 항목 | 내용 |
|------|------|
| 주요 테이블 | `MAT_LOTS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS` |
| 참조 테이블 | `MAT_ISSUE`(출고 이력 검증), `PART_MASTER`(품목), `PARTNER_MASTER`(거래처/제조사) |
| 수불 유형 | `LOT_MERGE_OUT`(원본 폐기), `LOT_MERGE_IN`(신규 입고) — `REF_TYPE='LOT_MERGE'` |
| 채번 | 신규 시리얼 `SEQ_MAT_SERIAL_DAILY`(`VH1-RM...`), 수불 `STOCK_TX` |
| 연계 화면 | 자재분할(대칭), 입하관리(LOT 발급), 수입검사(IQC 게이팅) |
| 멀티테넌시 스코프 | `COMPANY = '40'`, `PLANT_CD = '1000'` — 모든 조회·저장 시 공통 필터 |
