# 입하수불조회 — 비즈니스 로직 & 데이터 흐름 분석

> **분석 기준 커밋:** `8a7e96ea`
> **분석 일자:** `2026-07-04`

---

## 1. 화면 개요

| 항목 | 내용 |
|------|------|
| **메뉴 코드** | `MAT_ARRIVAL_TRANSACTION` |
| **URL** | `/material/arrival-transaction` |
| **메뉴 경로** | 자재관리 > 입하수불조회 |
| **화면 목적** | MAT_ARRIVAL_TRANSACTIONS 기반 입하/입하취소 원장 조회 (읽기 전용) |
| **주요 사용자** | 자재관리 담당자 |

## 2. API

| 시점 | API | 용도 |
| --- | --- | --- |
| 초기 로드 | `GET /material/arrivals?page=1&limit=5000&fromDate=&toDate=&transType=&status=&matUid=&search=` | 입하수불 목록 조회 |

## 3. 백엔드 — ArrivalService.findAll()

- `MatArrivalTransaction` Repository 조회 (transType: ARRIVAL_IN / ARRIVAL_CANCEL)
- 엔티티: `MatArrivalTransaction` → `MAT_ARRIVAL_TRANSACTIONS`

## 4. DB 테이블

| 테이블 | 역할 |
|--------|------|
| `MAT_ARRIVAL_TRANSACTIONS` | 입하/입하취소 원장 |

## 5. 비고

- **읽기 전용**, CRUD 없음
- **tenant scope**: company/plant 포함
