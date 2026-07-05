---
sources:
  - apps/backend/src/modules/material/services/physical-inv.service.ts
verifiedCommit: 8a7e96ea
---

# 실사적용 — 비즈니스 로직 & 데이터 흐름 분석

> **분석 기준 커밋:** `8a7e96ea`
> **분석 일자:** `2026-07-04`

---

## 1. 화면 개요

| 항목 | 내용 |
|------|------|
| **메뉴 코드** | `INV_MAT_PHYSICAL_INV_APPLY` |
| **URL** | `/inventory/physical-inv-apply` |
| **메뉴 경로** | 재고관리 > 실사적용 |
| **화면 목적** | COMPLETED 실사건 차이 필터 → 승인 적용 |
| **주요 사용자** | 재고관리 담당자 |

## 2. API

| 시점 | API | 용도 |
| --- | --- | --- |
| 초기 로드 | `GET /physical-inv/schedules?status=COMPLETED` | 적용 대상 조회 |
| 적용 | `PATCH /physical-inv/schedules/{id}/apply` | 실사 차이 적용 |

## 3. 백엔드 — PhysicalInvService.apply()

- INV_ADJ_LOGS INSERT → MAT_STOCKS/MAT_LOTS 조정 → SCHEDULES status='APPLIED'

## 4. DB 테이블

| 테이블 | 변경 |
| --- | --- |
| `PHYSICAL_INV_SCHEDULES` | UPDATE status='APPLIED' |
| `INV_ADJ_LOGS` | INSERT |
| `MAT_STOCKS` | UPDATE |
| `STOCK_TRANSACTIONS` | INSERT |

## 5. 비고

- **tenant scope**: company/plant 포함
