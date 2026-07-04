# 고객발주현황 — 비즈니스 로직 & 데이터 흐름 분석

> **분석 기준 커밋:** `8a7e96ea`
> **분석 일자:** `2026-07-04`

---

## 1. 화면 개요

| 항목 | 내용 |
|------|------|
| **메뉴 코드** | `SALES_CUST_PO_STATUS` |
| **URL** | `/shipping/customer-po-status` |
| **메뉴 경로** | 영업관리 > 고객발주현황 |
| **화면 목적** | 수주 대비 출하 진행률 모니터링 (출하율/잔량) |
| **주요 사용자** | 영업 관리자 |

## 2. 화면 구성

| 영역 | 역할 |
| --- | --- |
| 헤더 | 타이틀 + 새로고침 |
| 스탯카드 4개 | Total/InProgress/PartialShip/Completed |
| DataGrid | 발주현황 목록 (출하율/잔량/기한초과 표시) |

## 3. API 호출 흐름

| 시점 | API | 용도 |
| --- | --- | --- |
| 페이지 로드 | `GET /shipping/customer-orders/status?limit=5000&search=&status=` | 현황 목록 |

## 4. 백엔드 처리 — `customer-order.service.ts:findStatus()`

- `findAll()` 결과를 기준으로 출하율/잔량 계산
- 파생 상태:
  - `COMPLETED`: shippedQty >= orderQty
  - `PARTIAL_SHIP`: shippedQty > 0
  - `OVERDUE`: dueDate < 오늘 + shippedQty = 0
  - `IN_PROGRESS`: 그 외
- 프론트 상태 필터는 이 파생 상태 기준

## 5. 비고

- 조회 전용(read-only)
- 별도 DB 테이블 없음 — `CustomerOrder` + `CustomerOrderItem` 실시간 계산
- CRUD 없음
