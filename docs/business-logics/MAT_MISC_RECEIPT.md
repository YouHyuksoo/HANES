---
sources: []
verifiedCommit: 8a7e96ea
---

# 기타입고 — 비즈니스 로직 & 데이터 흐름 분석

> **분석 기준 커밋:** `8a7e96ea`
> **분석 일자:** `2026-07-04`

---

## 1. 화면 개요

| 항목 | 내용 |
|------|------|
| **메뉴 코드** | `MAT_MISC_RECEIPT` |
| **URL** | `/material/misc-receipt` |
| **메뉴 경로** | 자재관리 > 기타입고 |
| **화면 목적** | PO 없는 사유 입고 (MISC_IN) |
| **주요 사용자** | 자재입고 담당자 |

## 2. API

| 시점 | API | 용도 |
| --- | --- | --- |
| 이력 조회 | `GET /material/misc-receipt?limit=5000` | 기타입고 이력 |
| 등록 | `POST /material/misc-receipt` | 기타입고 등록 |

## 3. 백엔드 — MiscReceiptService

### create() — tx.run
- STOCK_TRANSACTIONS INSERT (MISC_IN)
- MAT_STOCKS UPSERT qty 증가

## 4. DB 테이블

| 테이블 | 변경 |
| --- | --- |
| `STOCK_TRANSACTIONS` | INSERT (MISC_IN) |
| `MAT_STOCKS` | UPSERT qty += qty |

## 5. 비고

- **tenant scope**: company/plant 포함
