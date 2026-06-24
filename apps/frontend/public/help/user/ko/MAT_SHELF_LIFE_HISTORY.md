---
menuCode: MAT_SHELF_LIFE_HISTORY
audience: user
title: 유수명자재 검사이력
summary: 유수명자재 재검사로 저장된 RETEST 이력을 조회하고 행별 측정항목 상세를 확인하는 읽기 전용 화면입니다.
tags: [자재, 유수명, 검사이력, 재검사]
keywords: [RETEST, inspectDate, retestRound, details, judge]
related: [MAT_SHELF_LIFE, MAT_SHELF_LIFE_REINSPECT]
---
# 유수명자재 검사이력

## 화면 목적
유수명자재 재검사로 저장된 RETEST 이력을 조회하고 행별 측정항목 상세를 확인하는 읽기 전용 화면입니다.

## 화면 구성
- 목록은 /material/shelf-life/reinspect에서 조회합니다.
- 상세 모달은 details JSON의 검사항목, 규격, 측정값, 판정을 표시합니다.

## ① 컬럼·필드

| 컬럼 | 역할 / 의미 |
|------|------|
| **작업(actions)** | 측정항목 상세 모달을 엽니다. |
| **검사일(inspectDate)** | 재검사가 수행된 날짜입니다. |
| **LOT No.(matUid)** | 검사 대상 자재 시리얼입니다. |
| **품목코드(itemCode)** | 검사 품목코드입니다. |
| **품목명(itemName)** | 품목 표시명입니다. |
| **재검회차(retestRound)** | 같은 LOT에 대한 재검사 순번입니다. |
| **결과(result)** | PASS 또는 FAIL 종합판정입니다. |
| **검사자(inspectorName)** | 재검사 수행자입니다. |
| **비고(remark)** | 검사 메모입니다. |
| **검사항목(inspectItem)** | 상세 모달의 항목명입니다. |
| **규격(spec)** | 검사 기준 설명입니다. |
| **하한/상한(lsl/usl)** | 숫자 측정 항목의 허용 범위입니다. |
| **측정값(measuredValue)** | 실제 입력한 검사값입니다. |
| **항목판정(judge)** | 항목별 PASS/FAIL입니다. |

## 사용 순서
1. LOT, 품목, 검사자 검색어나 품목 필터를 입력합니다.
2. PASS/FAIL 결과 필터를 선택합니다.
3. 행의 보기 버튼으로 측정항목 상세를 확인합니다.

## 입력 규칙·검증
- 조회 전용이며 이력 수정/삭제는 제공하지 않습니다.
- details가 없으면 수동판정 이력으로 보고 항목 상세 없음으로 표시됩니다.

## 자주 묻는 질문
- **Q.** 이 화면의 데이터가 다른 자재 화면과 다르게 보입니다.
  **A.** 입하재고, 창고재고, 수불원장은 서로 다른 단계입니다. 같은 자재UID(matUid)로 관련 화면을 함께 확인하세요.
- **Q.** 검색해도 데이터가 안 보입니다.
  **A.** 기간, 상태, 품목, 창고 필터를 초기화한 뒤 원본 업무 단계에서 데이터가 생성되었는지 확인하세요.

## 관련 화면
- MAT_SHELF_LIFE
- MAT_SHELF_LIFE_REINSPECT
