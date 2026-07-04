# 입고이력조회 — 비즈니스 로직 & 데이터 흐름 분석

> **분석 기준 커밋:** `8a7e96ea`
> **분석 일자:** `2026-07-04`

---

## 1. 화면 개요

| 항목 | 내용 |
|------|------|
| **메뉴 코드** | `MAT_RECEIVE_HISTORY` |
| **URL** | `/material/receive-history` |
| **메뉴 경로** | 자재관리 > 입고이력조회 |
| **화면 목적** | MAT_RECEIVINGS 기반 입고 이력 조회 (읽기 전용) |
| **주요 사용자** | 자재관리 담당자 |

## 2. API

| 시점 | API | 용도 |
| --- | --- | --- |
| 초기 로드 | `GET /material/receiving?page=1&limit=200&fromDate=&toDate=&search=&matUid=` | 입고 이력 조회 |

## 3. 백엔드 — ReceivingService.findAll()

- `MatReceiving` Repository 조회
- 엔티티: `MatReceiving` → `MAT_RECEIVINGS`

## 4. DB 테이블

| 테이블 | 역할 |
|--------|------|
| `MAT_RECEIVINGS` | 입고 이력 |

## 5. 비고

- **읽기 전용**, CRUD 없음
- **tenant scope**: company/plant 포함
