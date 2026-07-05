---
sources:
  - apps/backend/src/modules/production/services/production-views.service.ts
verifiedCommit: 8a7e96ea
---

# 포장실적조회 — 비즈니스 로직 & 데이터 흐름 분석

> **분석 기준 커밋:** `8a7e96ea`
> **분석 일자:** `2026-07-04`

---

## 1. 화면 개요

| 항목 | 내용 |
|------|------|
| **메뉴 코드** | `SHIP_PACK_RESULT` |
| **URL** | `/production/pack-result` |
| **메뉴 경로** | 생산관리 > 포장실적조회 |
| **화면 목적** | 포장 완료된 박스 실적 조회 (생산관리 메뉴) |
| **주요 사용자** | 생산 관리자 |

## 2. 화면 구성

| 영역 | 역할 |
| --- | --- |
| 헤더 | 타이틀 + 새로고침 |
| DataGrid | 포장실적 목록 (기간/검색 필터) |

## 3. API 호출 흐름

| 시점 | API | 용도 |
| --- | --- | --- |
| 페이지 로드 | `GET /production/pack-result?limit=5000&search=&fromDate=&toDate=` | 포장실적 목록 |

## 4. 백엔드 처리 — `production-views.controller.ts`

- `GET /production/pack-result` — `ProductionViewsService.getPackResult()`
- `BOX_MASTERS` 기준으로 포장 실적 조회 (status=CLOSED/SHIPPED)

## 5. DB 영향

조회 전용 — `BOX_MASTERS` SELECT.

## 6. 비고

- 물리적 경로: `apps/frontend/src/app/(authenticated)/production/pack-result/`
- 메뉴 분류: 생산관리(PRODUCTION) — 출하 SHIP_PACK과 동일한 BOX_MASTERS 조회
- 조회 전용(read-only)
- 다른 생산 메뉴와 같은 `production-views.controller.ts`에서 처리
- PackResult 타입은 `BoxMaster` 기반 뷰
