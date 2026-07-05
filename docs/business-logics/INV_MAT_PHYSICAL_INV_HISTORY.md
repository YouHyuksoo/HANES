---
sources: []
verifiedCommit: 8a7e96ea
---

# 실사이력 — 비즈니스 로직 & 데이터 흐름 분석

> **분석 기준 커밋:** `8a7e96ea`
> **분석 일자:** `2026-07-04`

---

## 1. 화면 개요

| 항목 | 내용 |
|------|------|
| **메뉴 코드** | `INV_MAT_PHYSICAL_INV_HISTORY` |
| **URL** | `/inventory/physical-inv-history` |
| **메뉴 경로** | 재고관리 > 실사이력 |
| **화면 목적** | APPLIED 실사건 이력 조회 (읽기 전용) |
| **주요 사용자** | 재고관리 담당자 |

## 2. API

| 시점 | API | 용도 |
| --- | --- | --- |
| 초기 로드 | `GET /physical-inv/schedules?status=APPLIED` | 실사 이력 조회 |

## 3. 백엔드 — PhysicalInvService

- PHYSICAL_INV_SCHEDULES.status='APPLIED'
- PHYSICAL_INV_DETAILS systemQty/countQty 조인

## 4. DB 테이블

| 테이블 | 역할 |
|--------|------|
| `PHYSICAL_INV_SCHEDULES` | APPLIED 실사 |
| `PHYSICAL_INV_DETAILS` | 대상별 수량 |

## 5. 비고

- **읽기 전용**
- **tenant scope**: company/plant 포함
