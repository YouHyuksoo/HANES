---
menuCode: MAT_SHELF_LIFE_REINSPECT
audience: user
title: 유수명자재 재검사
summary: 유효기한 임박 또는 만료 LOT을 IQC 검사항목 기준으로 재검사하고, 합격 시 만료일 연장·불합격 시 격리/폐기 처리하는 화면입니다.
tags: [자재, 유수명, 재검사, IQC]
keywords: [RETEST, IQC_LOGS, extendDays, destructSampleQty, PASS, FAIL]
related: [MAT_SHELF_LIFE, MAT_SHELF_LIFE_HISTORY, QC_IQC_PART_SPEC]
---
# 유수명자재 재검사

## 화면 목적
유효기한 임박 또는 만료 LOT을 IQC 검사항목 기준으로 재검사하고, 합격 시 만료일 연장·불합격 시 격리/폐기 처리하는 화면입니다.

## 화면 구성
- 대상 목록은 /material/shelf-life에서 EXPIRED와 NEAR_EXPIRY LOT만 필터링합니다.
- 재검사 모달은 /master/iqc-part-specs/{itemCode}/resolve-items로 검사항목을 불러옵니다.
- 저장은 /material/shelf-life/reinspect로 결과와 측정 상세를 제출합니다.

## ① 컬럼·필드

| 컬럼 | 역할 / 의미 |
|------|------|
| **검사(actions)** | 선택 LOT의 재검사 모달을 엽니다. |
| **LOT No.(matUid)** | 재검사 대상 자재 시리얼입니다. |
| **품목코드(itemCode)** | 재검사 기준 품목입니다. |
| **품목명(itemName)** | 품목 표시명입니다. |
| **현재수량(currentQty)** | 재검사 시점 LOT 잔량입니다. |
| **만료일(expireDate)** | 현재 저장된 유효기한입니다. |
| **잔여일수(daysUntilExpiry)** | 오늘 기준 만료일까지 남은 일수입니다. |
| **상태(expiryStatus)** | EXPIRED 또는 NEAR_EXPIRY 대상 상태입니다. |
| **측정값(measuredValue)** | 검사항목별 실제 측정값입니다. |
| **종합판정(result)** | 전체 항목 판정 결과입니다. |
| **검사자(inspectorName)** | 재검사 수행자입니다. |
| **시료수량(destructSampleQty)** | 검사로 소모된 시료 수량입니다. |
| **적용연장일(extendDays)** | PASS 시 새 만료일 계산에 쓰는 연장일입니다. |
| **비고(remark)** | 재검사 메모입니다. |

## 사용 순서
1. 대상 LOT을 검색합니다.
2. 검사 버튼으로 측정항목을 불러옵니다.
3. 측정값 또는 PASS/FAIL을 입력합니다.
4. 검사자, 시료수량, 연장일, 비고를 확인하고 제출합니다.

## 입력 규칙·검증
- DISCARDED LOT은 재검사할 수 없습니다.
- 연장일은 품목마스터 최대 연장일을 초과할 수 없습니다.
- FAIL은 DEFECT 격리 또는 폐기 흐름으로 이어집니다.

## 자주 묻는 질문
- **Q.** 이 화면의 데이터가 다른 자재 화면과 다르게 보입니다.
  **A.** 입하재고, 창고재고, 수불원장은 서로 다른 단계입니다. 같은 자재UID(matUid)로 관련 화면을 함께 확인하세요.
- **Q.** 검색해도 데이터가 안 보입니다.
  **A.** 기간, 상태, 품목, 창고 필터를 초기화한 뒤 원본 업무 단계에서 데이터가 생성되었는지 확인하세요.

## 관련 화면
- MAT_SHELF_LIFE
- MAT_SHELF_LIFE_HISTORY
- QC_IQC_PART_SPEC
