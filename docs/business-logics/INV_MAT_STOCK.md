---
sources:
  - apps/backend/src/modules/material/services/mat-stock.service.ts
verifiedCommit: 8a7e96ea
---

# 현 재고 현황 — 비즈니스 로직 & 데이터 흐름 분석

> **분석 기준 커밋:** `8a7e96ea`
> **분석 일자:** `2026-07-04`

---

## 1. 화면 개요

| 항목 | 내용 |
|------|------|
| **메뉴 코드** | `INV_MAT_STOCK` |
| **URL** | `/inventory/mat-stock` |
| **메뉴 경로** | 재고관리 > 현 재고 현황 |
| **화면 목적** | 품목/창고별 재고 조회 + LOT 상세 (읽기 전용) |
| **주요 사용자** | 자재/재고 담당자 |

## 2. API

| 시점 | API | 용도 |
| --- | --- | --- |
| 초기 로드 | `GET /material/stocks?limit=5000` | 재고 현황 조회 |

## 3. 백엔드 — MatStockService.findAll()

- MatStock → MAT_STOCKS (ItemMaster 조인)
- 하단 LOT 상세: MatLot 조인

## 4. DB 테이블

| 테이블 | 역할 |
|--------|------|
| `MAT_STOCKS` | 품목+창고 재고 |
| `MAT_LOTS` | LOT 상세 |
| `ITEM_MASTERS` | 품목 정보 |

## 5. 비고

- **읽기 전용**
- **tenant scope**: company/plant 포함
