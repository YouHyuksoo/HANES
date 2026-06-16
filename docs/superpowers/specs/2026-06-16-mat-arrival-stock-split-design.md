# 입하재고 테이블 분리 설계

작성일: 2026-06-16  
대상: HANES MES 자재 입하/입고/재고 수불 구조  
결정: A안, 기존 데이터 포함 완전 분리 마이그레이션

## 배경

현재 자재 입하와 입고가 모두 `STOCK_TRANSACTIONS`와 `MAT_STOCKS`에 반영된다.

- 입하 처리: `MAT_ARRIVALS` 생성, `STOCK_TRANSACTIONS.TRANS_TYPE = 'MAT_IN'` 생성, `MAT_STOCKS` 증가
- 입고 처리: `MAT_RECEIVINGS` 생성, `STOCK_TRANSACTIONS.TRANS_TYPE = 'RECEIVE'` 생성, `MAT_STOCKS` 창고 이동 또는 증가

이 구조에서는 `/inventory/transaction` 화면에 입하와 입고가 같이 보이며, 아직 창고 입고되지 않은 입하 대기 수량도 일반 자재 재고와 섞일 수 있다.

JSHANES 실측값:

```text
STOCK_TRANSACTIONS MAT_IN  : 57건, 322,303
STOCK_TRANSACTIONS RECEIVE : 44건, 316,303
MAT_ARRIVALS              : 67건, 327,303
MAT_RECEIVINGS DONE       : 44건, 316,303
MAT_STOCKS                : 93행, 227,314
MAT_IN 중 MAT_UID NULL    : 0건
```

따라서 입하 후 미입고 후보 수량은 최소 `MAT_IN - RECEIVE = 6,000`이며, 이 수량은 일반 창고재고가 아니라 입하재고로 분리되어야 한다.

## 목표

1. 입하재고와 입고재고를 물리 테이블로 분리한다.
2. 입하 수불원장과 입고 이후 수불원장을 분리한다.
3. 기존 `MAT_IN` 데이터를 새 입하 수불원장으로 마이그레이션한다.
4. 기존 `MAT_STOCKS`에서는 입하 후 미입고 잔량을 제거한다.
5. `/inventory/transaction`은 입고 이후 실제 창고재고 수불만 표시한다.

## 비목표

- 제품재고(`PRODUCT_STOCKS`, `PRODUCT_TRANSACTIONS`) 구조는 변경하지 않는다.
- 기타입고, 유수명 재검, 출고, 생산투입 수불 구조는 이번 범위에서 재설계하지 않는다.
- 기존 업무 이력 테이블 `MAT_ARRIVALS`, `MAT_RECEIVINGS`는 삭제하거나 통합하지 않는다.

## 신규 테이블

### `MAT_ARRIVAL_STOCKS`

입하재고 현재고 테이블이다. 아직 창고 입고되지 않은 자재 수량만 보관한다.

주요 컬럼:

```text
COMPANY
PLANT_CD
ARRIVAL_NO
ARRIVAL_SEQ
WAREHOUSE_CODE
ITEM_CODE
MAT_UID
QTY
AVAILABLE_QTY
STATUS
CREATED_AT
UPDATED_AT
CREATED_BY
UPDATED_BY
```

권장 PK:

```text
(COMPANY, PLANT_CD, MAT_UID)
```

이유:

- 현재 입고/LOT 흐름은 `MAT_UID` 단위 추적이 핵심이다.
- `MAT_UID`가 없는 legacy `MAT_IN`은 `ARRIVAL_NO/SEQ/ITEM_CODE/WAREHOUSE_CODE` 기반으로 보조 이관하되, 신규 생성 경로에서는 `MAT_UID`를 필수화하는 것이 맞다.

### `MAT_ARRIVAL_TRANSACTIONS`

입하재고 전용 수불원장이다.

주요 컬럼:

```text
TRANS_NO
TRANS_TYPE
TRANS_DATE
ARRIVAL_NO
ARRIVAL_SEQ
WAREHOUSE_CODE
ITEM_CODE
MAT_UID
QTY
REF_TYPE
REF_ID
CANCEL_REF_ID
WORKER_ID
REMARK
STATUS
COMPANY
PLANT_CD
CREATED_AT
UPDATED_AT
CREATED_BY
UPDATED_BY
```

거래유형:

```text
ARRIVAL_IN       입하재고 증가
ARRIVAL_OUT      입고 처리 시 입하재고 감소
ARRIVAL_CANCEL   입하 취소
ARRIVAL_RESTORE  입고 취소 시 입하재고 복원
```

## 변경 후 업무 흐름

### 입하

```text
MAT_ARRIVALS 생성
MAT_LOTS 생성 또는 연결
MAT_ARRIVAL_TRANSACTIONS: ARRIVAL_IN 생성
MAT_ARRIVAL_STOCKS 증가
STOCK_TRANSACTIONS 미생성
MAT_STOCKS 미변경
```

### 입고

```text
입고 가능 수량 = MAT_ARRIVAL_STOCKS.AVAILABLE_QTY
MAT_RECEIVINGS 생성
MAT_ARRIVAL_TRANSACTIONS: ARRIVAL_OUT 생성
MAT_ARRIVAL_STOCKS 감소
STOCK_TRANSACTIONS: RECEIVE 생성
MAT_STOCKS 증가
```

### 입하 취소

```text
입고된 수량이 있으면 차단
MAT_ARRIVAL_TRANSACTIONS: ARRIVAL_CANCEL 생성
MAT_ARRIVAL_STOCKS 감소
MAT_ARRIVALS/MAT_LOTS 상태 취소
STOCK_TRANSACTIONS 미변경
MAT_STOCKS 미변경
```

### 입고 취소

```text
MAT_STOCKS 감소
STOCK_TRANSACTIONS: RECEIVE_CANCEL 생성
MAT_ARRIVAL_STOCKS 복원
MAT_ARRIVAL_TRANSACTIONS: ARRIVAL_RESTORE 생성
MAT_RECEIVINGS 상태 취소 또는 역분개 상태 기록
```

## 기존 데이터 마이그레이션

### 1. 새 테이블 생성

`MAT_ARRIVAL_STOCKS`, `MAT_ARRIVAL_TRANSACTIONS`를 생성하고 인덱스와 주석을 추가한다.

필수 인덱스:

```text
MAT_ARRIVAL_STOCKS: MAT_UID, ITEM_CODE, ARRIVAL_NO/ARRIVAL_SEQ, WAREHOUSE_CODE
MAT_ARRIVAL_TRANSACTIONS: TRANS_TYPE, TRANS_DATE, MAT_UID, ARRIVAL_NO/ARRIVAL_SEQ, REF_TYPE/REF_ID, CANCEL_REF_ID
```

### 2. 기존 `MAT_IN` 이관

`STOCK_TRANSACTIONS.TRANS_TYPE = 'MAT_IN'`를 `MAT_ARRIVAL_TRANSACTIONS.TRANS_TYPE = 'ARRIVAL_IN'`으로 복사한다.

매핑:

```text
TRANS_NO       기존 값 유지
TRANS_TYPE     MAT_IN -> ARRIVAL_IN
TO_WAREHOUSE_ID -> WAREHOUSE_CODE
ITEM_CODE      유지
MAT_UID        유지
QTY            유지
REF_TYPE       유지
REF_ID         유지
STATUS         유지
COMPANY        유지
PLANT_CD       유지
```

`TRANS_NO`는 테이블이 분리되므로 기존 값을 유지한다. 이렇게 해야 기존 보고서, 테스트 증적, 감사 추적에서 원본 수불번호를 그대로 대조할 수 있다.

`ARRIVAL_NO`, `ARRIVAL_SEQ`는 `MAT_UID`로 `MAT_LOTS`를 조인해 채운다. 현재 JSHANES의 `MAT_IN` 57건은 모두 `MAT_UID`가 있으므로 이관 주 경로는 `MAT_UID` 기준으로 처리할 수 있다.

`MAT_IN_CANCEL`이 존재하면 `ARRIVAL_CANCEL`로 이관한다.

### 3. 입하재고 현재고 산출

`MAT_UID` 단위 공식:

```text
arrival_qty = SUM(MAT_IN 및 ARRIVAL_IN 계열)
received_qty = SUM(RECEIVE) - SUM(RECEIVE_CANCEL)
arrival_stock_qty = arrival_qty - received_qty
```

`arrival_stock_qty > 0`인 건만 `MAT_ARRIVAL_STOCKS`에 생성한다.

`MAT_UID`가 없는 legacy 행은 같은 `COMPANY`, `PLANT_CD`, `ITEM_CODE`, `WAREHOUSE_CODE`, `REF_ID` 기준으로 보조 집계한다. 다만 신규 로직에서는 `MAT_UID` 없는 입하재고 생성을 막는다.

### 4. 기존 `MAT_STOCKS` 재분류

입하재고로 산출된 수량만큼 `MAT_STOCKS`에서 차감한다.

```text
MAT_STOCKS.QTY = MAT_STOCKS.QTY - MAT_ARRIVAL_STOCKS.QTY
MAT_STOCKS.AVAILABLE_QTY = MAT_STOCKS.AVAILABLE_QTY - MAT_ARRIVAL_STOCKS.QTY
```

차감 후 `QTY = 0`이고 `RESERVED_QTY = 0`인 행은 삭제한다.

차감 결과가 음수가 되면 마이그레이션을 중단한다. 이는 기존 데이터가 이미 불일치한 상태라는 뜻이다.

### 5. 기존 `STOCK_TRANSACTIONS` 정리

검증이 끝난 뒤 `STOCK_TRANSACTIONS`에서 `MAT_IN`, `MAT_IN_CANCEL` 행을 제거한다.

대체안으로 삭제 대신 `MIGRATED_YN` 컬럼을 두는 방식도 가능하지만, 이번 결정은 완전 분리이므로 삭제가 기본이다. 삭제 전 백업 테이블을 만든다.

```text
STOCK_TRANSACTIONS_BAK_20260616
```

## 코드 변경 범위

### Backend entity/module

추가:

- `MatArrivalStock` entity
- `MatArrivalTransaction` entity
- `ArrivalInventoryService` 또는 `ArrivalStockService`

수정:

- `arrival.service.ts`
  - `StockTransaction(MAT_IN)` 생성 제거
  - `MAT_STOCKS` 증가 제거
  - `MatArrivalTransaction(ARRIVAL_IN)` 생성
  - `MAT_ARRIVAL_STOCKS` 증가
- `receiving.service.ts`
  - 입고 가능 수량 조회 기준을 `STOCK_TRANSACTIONS(RECEIVE)` 중심에서 `MAT_ARRIVAL_STOCKS` 중심으로 전환
  - 입고 시 `MAT_ARRIVAL_STOCKS` 감소
  - 입고 시 `MAT_STOCKS` 증가
  - `STOCK_TRANSACTIONS(RECEIVE)`는 유지
- `receipt-cancel.service.ts`
  - `RECEIVE` 취소 기준으로 정렬
  - 입고 취소 시 `MAT_STOCKS` 감소 및 `MAT_ARRIVAL_STOCKS` 복원
- `inventory-query.service.ts`
  - `/inventory/transactions`는 `STOCK_TRANSACTIONS`만 조회하므로 `MAT_IN`이 더 이상 보이지 않음

### Frontend

수정:

- `/inventory/transaction`
  - `MAT_IN`, `MAT_IN_CANCEL` 필터/라벨 제거
- 입하 이력/입하실적 화면
  - 필요 시 새 입하 수불 API를 조회하도록 변경

추가 후보:

- `/material/arrival-transaction` 또는 기존 입하실적 화면 내 "입하재고 수불" 탭

## API 변경

기존:

```text
GET /inventory/transactions
```

변경 후:

```text
GET /inventory/transactions
```

입고 이후 창고재고 수불만 반환한다.

신규 후보:

```text
GET /material/arrival-transactions
GET /material/arrival-stocks
```

## 검증 계획

### 마이그레이션 전 검증

```sql
SELECT TRANS_TYPE, STATUS, COUNT(*) CNT, SUM(QTY) SUM_QTY
FROM STOCK_TRANSACTIONS
WHERE TRANS_TYPE IN ('MAT_IN', 'MAT_IN_CANCEL', 'RECEIVE', 'RECEIVE_CANCEL')
GROUP BY TRANS_TYPE, STATUS;
```

### 마이그레이션 후 검증

```sql
-- STOCK_TRANSACTIONS에 입하 타입이 남지 않아야 한다.
SELECT COUNT(*) CNT
FROM STOCK_TRANSACTIONS
WHERE TRANS_TYPE IN ('MAT_IN', 'MAT_IN_CANCEL');

-- 이관된 입하원장 수량 합계 확인
SELECT TRANS_TYPE, COUNT(*) CNT, SUM(QTY) SUM_QTY
FROM MAT_ARRIVAL_TRANSACTIONS
GROUP BY TRANS_TYPE;

-- 입하재고가 음수이면 실패
SELECT COUNT(*) CNT
FROM MAT_ARRIVAL_STOCKS
WHERE QTY < 0 OR AVAILABLE_QTY < 0;

-- 일반 재고가 음수이면 실패
SELECT COUNT(*) CNT
FROM MAT_STOCKS
WHERE QTY < 0 OR AVAILABLE_QTY < 0;
```

### 런타임 시나리오

1. PO 생성
2. PO 확정
3. 입하 처리
4. `MAT_ARRIVAL_STOCKS` 증가 확인
5. `/inventory/transaction`에 `MAT_IN` 미노출 확인
6. IQC PASS
7. 입고 처리
8. `MAT_ARRIVAL_STOCKS` 감소 확인
9. `MAT_STOCKS` 증가 확인
10. `/inventory/transaction`에 `RECEIVE`만 노출 확인
11. 입고 취소
12. `MAT_STOCKS` 감소, `MAT_ARRIVAL_STOCKS` 복원 확인
13. 입하 취소 가능/불가 조건 확인

## 위험과 대응

### 기존 `MAT_STOCKS`와 수불 합계 불일치

위험: 이미 생산투입, 조정, 재검, 기타수불이 섞여 있어 단순 `MAT_IN - RECEIVE`만으로 현재고가 설명되지 않을 수 있다.

대응:

- 마이그레이션 전 `MAT_UID`별 산출표를 만든다.
- 차감 시 음수 발생 건은 전체 마이그레이션을 중단한다.
- 실제 적용 전 dry-run SQL로 영향 행과 수량을 보고한다.
- `MAT_ARRIVALS` 합계와 `MAT_IN` 합계가 다르므로, 원장 이관 기준은 먼저 `STOCK_TRANSACTIONS.MAT_IN`으로 잡고, 차이는 별도 불일치 리포트로 남긴다.

### `MAT_UID` 없는 legacy 입하

위험: 입하재고는 추적 단위가 `MAT_UID`인데 일부 기존 `MAT_IN`은 `MAT_UID`가 없을 수 있다.

대응:

- 신규 로직에서는 `MAT_UID` 필수.
- 기존 데이터는 `ARRIVAL_NO/SEQ/ITEM_CODE/WAREHOUSE_CODE` 보조키로 이관하되 별도 검증 목록을 남긴다.

### 입고취소 서비스의 기존 `RECEIPT` 타입 참조

위험: 일부 코드가 `RECEIPT`/`RECEIPT_CANCEL`을 참조하지만 현재 실측 `STOCK_TRANSACTIONS`에는 해당 타입이 없다.

대응:

- 구현 단계에서 `RECEIVE` 기준으로 서비스 계약을 정리한다.
- 기존 미사용 타입은 테스트와 화면 라벨에서 제거하거나 legacy로 분리한다.

## 완료 기준

- JSHANES dry-run 결과에서 음수 재고 후보가 없다.
- 신규 테이블 생성 및 기존 `MAT_IN` 이관이 성공한다.
- `STOCK_TRANSACTIONS`에 `MAT_IN`, `MAT_IN_CANCEL`이 남지 않는다.
- `/inventory/transaction`에서 입하 거래가 보이지 않는다.
- 입하 후 `MAT_ARRIVAL_STOCKS`만 증가한다.
- 입고 후 `MAT_ARRIVAL_STOCKS`는 감소하고 `MAT_STOCKS`만 증가한다.
- 입고취소 시 `MAT_STOCKS`는 감소하고 `MAT_ARRIVAL_STOCKS`는 복원된다.
- backend typecheck와 관련 서비스 테스트가 통과한다.
- DB 스키마 변경 후 `docs/reports/db-schema-erd.md`를 재생성한다.
