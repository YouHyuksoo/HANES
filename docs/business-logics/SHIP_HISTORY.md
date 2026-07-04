# 출하이력조회 — 비즈니스 로직 & 데이터 흐름 분석

> **분석 기준 커밋:** `8a7e96ea`
> **분석 일자:** `2026-07-04`

---

## 1. 화면 개요

| 항목 | 내용 |
|------|------|
| **메뉴 코드** | `SHIP_HISTORY` |
| **URL** | `/shipping/history` |
| **메뉴 경로** | 출하관리 > 출하이력조회 |
| **화면 목적** | 출하 이력 필터링 조회 + 팔레트/박스 상세 |
| **주요 사용자** | 출하/영업 관리자 |

## 2. 화면 구성

| 영역 | 역할 |
| --- | --- |
| 좌측: DataGrid | 출하지시 이력 목록 (검색/상태/기간 필터) |
| 우측: 팔레트 상세 패널 | 선택 지시의 팔레트/박스 구성 |
| 팔레트 섹션 | 팔레트별 박스 리스트 (마감일/출하일) |
| 박스출하 섹션 | 팔레트 미소속 단건 출하 박스 |

## 3. API 호출 흐름

| 시점 | API | 용도 |
| --- | --- | --- |
| 페이지 로드 | `GET /shipping/history?limit=5000&search=&status=&shipDateFrom=&shipDateTo=` | 출하 이력 목록 |
| 행 선택 | `GET /shipping/orders/:no/shipped-detail` | 팔레트+박스 출하 상세 |

## 4. 백엔드 처리 — `ship-history.service.ts`

- `GET /shipping/history` — `SHIPMENT_ORDERS` 기준으로 shipment/pallet/box 상태를 JOIN하여 이력 조회
- `GET /shipping/orders/:no/shipped-detail` — 특정 지시의 팔레트/박스 출하 상세 조회

## 5. 상태 전이

해당 없음. 조회 전용.

## 6. DB 테이블 영향

조회 전용 — INSERT/UPDATE/DELETE 없음.

| 엔티티 | 테이블명 | 역할 |
|--------|----------|------|
| `ShipmentOrder` | `SHIPMENT_ORDERS` | 출하지시 |
| `ShipmentOrderItem` | `SHIPMENT_ORDER_ITEMS` | 지시 품목 |
| `BoxMaster` | `BOX_MASTERS` | 박스 |
| `PalletMaster` | `PALLET_MASTERS` | 팔레트 |
| `ShipmentLog` | `SHIPMENT_LOGS` | 출하 로그 |

## 7. 비고

- 조회 전용 화면
- 필터: 출하예정일, 상태, 검색어
- 우측 팔레트 상세는 선택 시 동적 로딩
