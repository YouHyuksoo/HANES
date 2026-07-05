---
sources: []
verifiedCommit: 8a7e96ea
---

# 완제품 재공재고 — 비즈니스 로직 & 데이터 흐름 분석

> **Menu Code:** `PROD_FG_STOCK`
> **Path:** `/production/fg-stock`
> **Label:** `menu.production.fgStock`
> **분석 기준 커밋:** `8a7e96ea`
> **분석 일자:** `2026-07-04`

## 1. 화면 개요

완제품(FINISHED) 재공재고를 품목별로 조회하는 화면. `WipStockView` 컴포넌트를 `itemType="FINISHED"`로 재사용한다.

## 2. 화면 구성 및 동작

`PROD_WIP_STOCK`과 동일한 구조. 단, `itemType`이 `FINISHED`로 고정되어 FG 재고만 조회.

**페이지 코드:**
```tsx
export default function FgStockPage() {
  return <WipStockView itemType="FINISHED" titleKey="production.wipStock.fgTitle" descriptionKey="production.wipStock.fgDescription" />;
}
```

## 3. API 호출

| 시점 | API | 용도 |
| --- | --- | --- |
| 진입/조회 | `GET /production/wip-stock?itemType=FINISHED` | FG 재고 집계 |
| 행 선택 | `GET /production/wip-stock/labels?itemCode=&itemType=FINISHED` | FG_LABELS 상세 |

## 4. DB 테이블 영향

| 테이블 | 작업 | 설명 |
| --- | --- | --- |
| `PRODUCT_STOCKS` | SELECT | FG 재고 집계 (warehouseCode=FG_WIP, itemType=FINISHED) |
| `FG_LABELS` | SELECT (itemType=FINISHED) | FG 라벨 상세 |

## 5. 비고

- `WipStockView` 공유 컴포넌트 사용 → `PROD_WIP_STOCK`과 동일 분석 참조
- 읽기 전용 화면
- warehouseCode = `FG_WIP` 창고 대상
