---
menuCode: PROD_SPEC_SETUP
audience: operator
title: 제품 도면관리 — 운영 가이드
summary: 제품별 하네스 도면, Revision, 회로별 전선·단자·스트리핑 사양을 관리합니다.
tags: [생산관리, 생산, HANES]
keywords: [제품 도면관리, PROD_SPEC_SETUP, 생산실적, 작업지시, 재고, 추적성]
related: [PROD_ORDER, PROD_RESULT]
---

# 제품 도면관리 — 운영 가이드

## 시스템 목적·역할
제품별 하네스 도면, Revision, 회로별 전선·단자·스트리핑 사양을 관리합니다. 운영자는 이 화면을 통해 생산 실행 데이터가 작업지시, 실적, 재고, 라벨 추적성 기준과 맞는지 확인합니다.

## 데이터 구조
```
HARNESS_DRAWING_MASTERS
  -> JOB_ORDERS / PROD_RESULTS / PRODUCT_STOCKS / WIP_MAT_STOCKS / REWORK_ORDERS / REPAIR_ORDERS 중 화면 목적에 맞는 테이블과 연계
스코프: COMPANY='40', PLANT_CD='1000'
```

## ① HARNESS_DRAWING_MASTERS — 전체 컬럼
| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| **도면번호** | `DRAWINGNO` | 도면번호의 화면 표시/처리 기준입니다. 실제 컬럼명은 서비스 DTO와 조인 alias에 따라 달라질 수 있으므로 저장·정정 시 HARNESS_DRAWING_MASTERS 및 관련 테이블을 함께 확인합니다. |
| **ERP 품번** | `ERPITEMNO` | ERP 품번의 화면 표시/처리 기준입니다. 실제 컬럼명은 서비스 DTO와 조인 alias에 따라 달라질 수 있으므로 저장·정정 시 HARNESS_DRAWING_MASTERS 및 관련 테이블을 함께 확인합니다. |
| **품목코드** | `ITEMCODE` | 품목코드의 화면 표시/처리 기준입니다. 실제 컬럼명은 서비스 DTO와 조인 alias에 따라 달라질 수 있으므로 저장·정정 시 HARNESS_DRAWING_MASTERS 및 관련 테이블을 함께 확인합니다. |
| **품목명** | `ITEMNAME` | 품목명의 화면 표시/처리 기준입니다. 실제 컬럼명은 서비스 DTO와 조인 alias에 따라 달라질 수 있으므로 저장·정정 시 HARNESS_DRAWING_MASTERS 및 관련 테이블을 함께 확인합니다. |
| **고객품번** | `CUSTOMERPARTNO` | 고객품번의 화면 표시/처리 기준입니다. 실제 컬럼명은 서비스 DTO와 조인 alias에 따라 달라질 수 있으므로 저장·정정 시 HARNESS_DRAWING_MASTERS 및 관련 테이블을 함께 확인합니다. |
| **Revision** | `REVISIONCODE` | Revision의 화면 표시/처리 기준입니다. 실제 컬럼명은 서비스 DTO와 조인 alias에 따라 달라질 수 있으므로 저장·정정 시 HARNESS_DRAWING_MASTERS 및 관련 테이블을 함께 확인합니다. |
| **상태** | `STATUS` | 상태의 화면 표시/처리 기준입니다. 실제 컬럼명은 서비스 DTO와 조인 alias에 따라 달라질 수 있으므로 저장·정정 시 HARNESS_DRAWING_MASTERS 및 관련 테이블을 함께 확인합니다. |
| **적용일** | `EFFECTIVEFROM` | 적용일의 화면 표시/처리 기준입니다. 실제 컬럼명은 서비스 DTO와 조인 alias에 따라 달라질 수 있으므로 저장·정정 시 HARNESS_DRAWING_MASTERS 및 관련 테이블을 함께 확인합니다. |
| **변경사유** | `CHANGEREASON` | 변경사유의 화면 표시/처리 기준입니다. 실제 컬럼명은 서비스 DTO와 조인 alias에 따라 달라질 수 있으므로 저장·정정 시 HARNESS_DRAWING_MASTERS 및 관련 테이블을 함께 확인합니다. |
| **회로번호** | `CIRCUITNO` | 회로번호의 화면 표시/처리 기준입니다. 실제 컬럼명은 서비스 DTO와 조인 alias에 따라 달라질 수 있으므로 저장·정정 시 HARNESS_DRAWING_MASTERS 및 관련 테이블을 함께 확인합니다. |
| **전선품목** | `WIREITEMCODE` | 전선품목의 화면 표시/처리 기준입니다. 실제 컬럼명은 서비스 DTO와 조인 alias에 따라 달라질 수 있으므로 저장·정정 시 HARNESS_DRAWING_MASTERS 및 관련 테이블을 함께 확인합니다. |
| **길이** | `LENGTHMM` | 길이의 화면 표시/처리 기준입니다. 실제 컬럼명은 서비스 DTO와 조인 alias에 따라 달라질 수 있으므로 저장·정정 시 HARNESS_DRAWING_MASTERS 및 관련 테이블을 함께 확인합니다. |
| **Strip A/B** | `STRIPA/STRIPB` | Strip A/B의 화면 표시/처리 기준입니다. 실제 컬럼명은 서비스 DTO와 조인 alias에 따라 달라질 수 있으므로 저장·정정 시 HARNESS_DRAWING_MASTERS 및 관련 테이블을 함께 확인합니다. |
| **A/B단 하우징·터미널** | `A/B단_하우징·터미널` | A/B단 하우징·터미널의 화면 표시/처리 기준입니다. 실제 컬럼명은 서비스 DTO와 조인 alias에 따라 달라질 수 있으므로 저장·정정 시 HARNESS_DRAWING_MASTERS 및 관련 테이블을 함께 확인합니다. |
| **연결기호** | `CONNECTIONSYMBOL` | 연결기호의 화면 표시/처리 기준입니다. 실제 컬럼명은 서비스 DTO와 조인 alias에 따라 달라질 수 있으므로 저장·정정 시 HARNESS_DRAWING_MASTERS 및 관련 테이블을 함께 확인합니다. |
| **튜브/서브번호/비고** | `튜브/서브번호/비고` | 튜브/서브번호/비고의 화면 표시/처리 기준입니다. 실제 컬럼명은 서비스 DTO와 조인 alias에 따라 달라질 수 있으므로 저장·정정 시 HARNESS_DRAWING_MASTERS 및 관련 테이블을 함께 확인합니다. |
| **멀티테넌시** | `COMPANY`, `PLANT_CD` | HANES 기본 운영 스코프는 회사 `40`, 공장 `1000`입니다. 생산/품질/재고 데이터는 이 스코프를 벗어나 섞이면 안 됩니다. |
| **감사 이력** | `CREATED_BY`, `CREATED_AT`, `UPDATED_BY`, `UPDATED_AT` | 생성·수정 추적값입니다. 오입력 정정 시 담당자와 시간을 확인합니다. |

## 사전 설정
- 품목, 라인, 공정, 설비, 작업자 기준정보가 먼저 정합해야 합니다.
- 상태, 판정, 수리/재작업 구분값은 공통코드 또는 전용 기준정보 기준으로 관리합니다.
- 생산 데이터는 회사/공장 스코프 안에서 조회·처리합니다.

## 운영 절차
1. 조회 조건을 업무 기준과 맞춥니다.
2. 대상 행의 작업지시번호, 품목, 설비, 바코드/UID, 상태를 확인합니다.
3. 수량 변경 또는 상태 변경이 있는 처리는 처리 전후 값을 비교합니다.
4. 오류가 있으면 화면 처리 API와 HARNESS_DRAWING_MASTERS 기준 데이터를 함께 확인합니다.

## 권한
- 생산 현장 담당자는 조회와 실적 입력을 수행합니다.
- 생산/품질 관리자만 취소, 삭제, 승인, 완료, 기준 확정 같은 데이터 영향 작업을 수행합니다.

## 문제 해결
| 증상 | 원인 | 조치 |
|------|------|------|
| 대상이 조회되지 않음 | 기간, 상태, 품목유형, 회사/공장 스코프 불일치 | 필터 초기화 후 작업지시번호나 바코드로 재조회합니다. |
| 저장 또는 실행 실패 | 필수 작업지시, 설비, 작업자, 바코드/UID 누락 또는 상태 불일치 | 화면 필수값과 대상 상태를 확인한 뒤 다시 처리합니다. |
| 수량이 예상과 다름 | 집계 단위와 라벨/UID 상세 단위가 다름 | 품목 집계와 바코드 상세를 분리해 대조합니다. |

## 데이터·연계
- 화면 경로: `/production/specification-setup`
- 주요 테이블: `HARNESS_DRAWING_MASTERS`
- 멀티테넌시: `COMPANY='40'`, `PLANT_CD='1000'`
