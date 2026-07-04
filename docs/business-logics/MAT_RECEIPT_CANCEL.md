# 입고취소 — 비즈니스 로직 & 데이터 흐름 분석

> **분석 기준 커밋:** `8a7e96ea`
> **분석 일자:** `2026-07-04`

---

## 1. 화면 개요

| 항목 | 내용 |
|------|------|
| **메뉴 코드** | `MAT_RECEIPT_CANCEL` |
| **URL** | `/material/receipt-cancel` |
| **메뉴 경로** | 자재관리 > 입고취소 |
| **화면 목적** | 입고 트랜잭션 역분개 처리 — RECEIPT 유형 트랜잭션 취소 |
| **주요 사용자** | 자재관리 담당자 |

## 2. API 호출 흐름

| 시점 | API | 용도 |
| --- | --- | --- |
| 초기 로드 | `GET /material/receipt-cancel?limit=5000&search=&fromDate=&toDate=` | 취소 가능 입고 조회 |
| 취소 실행 | `POST /material/receipt-cancel` | 입고 취소 (역분개) |

## 3. 백엔드 — ReceiptCancelService

### findCancellable()
- 원본 RECEIVE 트랜잭션 중 cancelRefId가 없는 건 조회 (아직 취소되지 않은 건)

### cancel() — tx.run
1. 원본 RECEIVE 트랜잭션 검증 (취소 가능 여부)
2. `STOCK_TRANSACTIONS` INSERT (transType='RECEIVE', qty=음수값, cancelRefId=원본ID)
3. `MAT_STOCKS` UPDATE (qty 차감)
4. `MAT_RECEIVINGS` UPDATE status='CANCELED'

## 4. DB 테이블 영향

| 테이블 | 변경 |
| --- | --- |
| `STOCK_TRANSACTIONS` | INSERT (음수 qty, cancelRefId) |
| `MAT_STOCKS` | UPDATE qty -= qty |
| `MAT_RECEIVINGS` | UPDATE status='CANCELED' |

## 5. 비고

- **취소 가능 조건**: cancelRefId 없는 RECEIPT 유형만 취소 가능
- **역분개 방식**: 원본을 삭제하지 않고 반대 부호 트랜잭션 추가
- **tenant scope**: company/plant 포함
