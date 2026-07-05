---
sources: []
verifiedCommit: 8a7e96ea
---

# 유수명자재 — 비즈니스 로직 & 데이터 흐름 분석

> **분석 기준 커밋:** `8a7e96ea`
> **분석 일자:** `2026-07-04`

---

## 1. 화면 개요

| 항목 | 내용 |
|------|------|
| **메뉴 코드** | `MAT_SHELF_LIFE` |
| **URL** | `/material/shelf-life` |
| **메뉴 경로** | 자재관리 > 유수명자재 |
| **화면 목적** | 유효기한 LOT 만료 현황 조회, 재검사 화면 이동 |
| **주요 사용자** | 자재관리 담당자 |

## 2. API

| 시점 | API | 용도 |
| --- | --- | --- |
| 초기 로드 | `GET /material/shelf-life?limit=5000&search=&expiryStatus=` | 유수명 LOT 목록 조회 |

## 3. 백엔드 — ShelfLifeService

- `MatLot`: expireDate IS NOT NULL 조건
- 만료 상태 계산: EXPIRED(만료) / NEAR_EXPIRY(10일 이내) / VALID / DISCARDED

## 4. DB 테이블

| 테이블 | 역할 |
|--------|------|
| `MAT_LOTS` | expireDate 보유 LOT |

## 5. 만료 상태 색상

- EXPIRED: 빨강 배경
- NEAR_EXPIRY: 노랑 배경
- DISCARDED: 회색(opacity 60%)

## 6. 비고

- **읽기 전용**, 재검사 페이지로 이동 라우팅
- **tenant scope**: company/plant 포함
