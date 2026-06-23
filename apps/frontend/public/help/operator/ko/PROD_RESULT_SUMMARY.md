---
menuCode: PROD_RESULT_SUMMARY
audience: operator
title: 작업실적 통합 조회 — 운영 가이드
summary: 완제품 기준 생산실적 집계 — 품목별 계획수량·양품·불량·달성률·수율·불량률 종합 조회
tags: [생산, 실적, 집계, 조회]
keywords: [PROD_RESULTS, JOB_ORDERS, PART_MASTERS, totalPlanQty, totalGoodQty, totalDefectQty, achieveRate, yieldRate, defectRate, 작업실적, 생산실적, 통합조회, 수율, 달성률]
related: [PROD_ORDER, PROD_INPUT_KIOSK]
---

# 작업실적 통합 조회 — 운영 가이드

## 시스템 목적·역할
완제품(FINISHED) 기준으로 생산실적을 품목별로 집계·조회하는 화면입니다. 계획수량 대비 달성률, 양품 대비 수율, 불량률을 한눈에 파악할 수 있습니다.

```
JOB_ORDERS(계획) + PROD_RESULTS(실적) → 품목별 집계 → 달성률·수율·불량률
```

## 데이터 구조
```
PROD_RESULTS ← JOB_ORDERS → PART_MASTERS (ITEM_MASTERS)
```

## 화면 구성
- **헤더**: 제목 + 새로고침 버튼
- **툴바**: 검색어(품목코드·품목명) + 기간 필터(DateRangeFilter, 기본 오늘)
- **DataGrid**: `GET /production/prod-results/summary/by-product`

| 컬럼 | 설명 | 계산 |
|------|------|------|
| 품목코드 | `PART_MASTERS.ITEM_CODE` | |
| 품목명 | `PART_MASTERS.ITEM_NAME` | |
| 품목유형 | `PART_MASTERS.ITEM_TYPE` | |
| 라인 | `JOB_ORDERS.LINE_CODE` | |
| 계획수량 | `SUM(JOB_ORDERS.PLAN_QTY)` | |
| 양품수량 | `SUM(PROD_RESULTS.GOOD_QTY)` | |
| 불량수량 | `SUM(PROD_RESULTS.DEFECT_QTY)` | |
| 총생산수량 | `totalGoodQty + totalDefectQty` | |
| 달성률 | `totalGoodQty / totalPlanQty × 100` | |
| 수율 | `totalGoodQty / (totalGoodQty + totalDefectQty) × 100` | |
| 불량률 | `totalDefectQty / (totalGoodQty + totalDefectQty) × 100` | |
| 작업지시건수 | `COUNT(DISTINCT JOB_ORDERS.ORDER_NO)` | |
| 실적건수 | `COUNT(PROD_RESULTS.RESULT_NO)` | |

## 조회 조건
- **기간**: `PROD_RESULTS.START_TIME` 기준, 기본값 오늘
- **취소 제외**: `PROD_RESULTS.STATUS != 'CANCELED'`
- **정렬**: 양품수량 내림차순

## 주요 지표 해석
| 지표 | 의미 | 좋은 방향 |
|------|------|-----------|
| 달성률 | 계획 대비 생산한 비율 | 100% ↑ |
| 수율 | 양품 비율 (품질) | 100% ↑ |
| 불량률 | 불량 비율 | 0% ↓ |

## 문제 해결
| 증상 | 원인 | 조치 |
|------|------|------|
| 데이터 없음 | 해당 기간 실적 없음 | 기간 범위 확대 |
| 달성률 0% | 계획수량 0 | 작업지시 계획 확인 |
| 수율 100% | 불량 미등록 | DefectLog 등록 확인 |

## 데이터·연계
- 테이블: `PROD_RESULTS`, `JOB_ORDERS`, `PART_MASTERS`
- 연계: 작업지시(`/production/order`) → 실적입력(`/production/input-kiosk`) → **실적조회(현재)**
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
