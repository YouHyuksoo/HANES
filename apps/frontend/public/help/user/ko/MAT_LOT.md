---
menuCode: MAT_LOT
audience: user
title: 자재 LOT 조회
summary: 입하에서 발급된 자재 LOT 시리얼의 초기수량, 현재수량, IQC 상태, LOT 상태를 조회하는 화면입니다.
tags: [자재, LOT, 시리얼, 조회]
keywords: [MAT_LOTS, matUid, currentQty, IQC_STATUS, LOT상태]
related: [MAT_ARRIVAL_RESULT, MAT_RECEIVE, INV_MAT_STOCK]
---
# 자재 LOT 조회

## 화면 목적
입하에서 발급된 자재 LOT 시리얼의 초기수량, 현재수량, IQC 상태, LOT 상태를 조회하는 화면입니다.

## 화면 구성
- 조회 API는 /material/lots입니다.
- 화면은 currentQty를 현재수량(qty)로 정규화해 보여줍니다.
- LOT 상태와 IQC 상태를 독립 필터로 제공합니다.

## ① 컬럼·필드

| 컬럼 | 역할 / 의미 |
|------|------|
| **작업(actions)** | 선택 LOT의 상세 모달을 엽니다. |
| **자재UID(matUid)** | 자재 LOT의 유일 바코드 식별자입니다. |
| **품목코드(itemCode)** | LOT이 속한 품목코드입니다. |
| **품목명(itemName)** | 품목 표시명입니다. |
| **공급사(vendor)** | LOT 납품 거래처입니다. |
| **입고일(recvDate)** | LOT 등록/입고 기준 날짜입니다. |
| **초기수량(initQty)** | LOT 발행 시 원래 수량이며 추적 기준입니다. |
| **현재수량(qty/currentQty)** | 입고·출고·폐기·분할 후 남은 수량입니다. |
| **IQC(iqcStatus)** | PENDING/PASS/FAIL/HOLD 등 수입검사 상태입니다. |
| **상태(status)** | NORMAL/HOLD/DEPLETED/SPLIT/MERGED 등 LOT 운영 상태입니다. |

## 사용 순서
1. 검색어로 자재UID 또는 품목을 찾습니다.
2. LOT 상태와 IQC 상태 필터를 적용합니다.
3. 상세 버튼으로 선택 LOT의 수량과 상태를 확인합니다.

## 입력 규칙·검증
- 초기수량과 현재수량은 다를 수 있습니다.
- IQC PASS 전 LOT은 일반 출고 대상이 아닙니다.

## 자주 묻는 질문
- **Q.** 이 화면의 데이터가 다른 자재 화면과 다르게 보입니다.
  **A.** 입하재고, 창고재고, 수불원장은 서로 다른 단계입니다. 같은 자재UID(matUid)로 관련 화면을 함께 확인하세요.
- **Q.** 검색해도 데이터가 안 보입니다.
  **A.** 기간, 상태, 품목, 창고 필터를 초기화한 뒤 원본 업무 단계에서 데이터가 생성되었는지 확인하세요.

## 관련 화면
- MAT_ARRIVAL_RESULT
- MAT_RECEIVE
- INV_MAT_STOCK
