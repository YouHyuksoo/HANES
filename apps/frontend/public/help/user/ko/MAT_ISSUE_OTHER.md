---
menuCode: MAT_ISSUE_OTHER
audience: user
title: 기타출고관리
summary: 양산 출고가 아닌 불량·샘플·외주·반품·기타 목적의 자재 LOT을 바코드 스캔으로 출고하고 이력을 취소까지 관리하는 화면입니다.
tags: [자재, 기타출고, 바코드, 취소]
keywords: [MAT_ISSUES, issueType, scan, cancel, 기타출고]
related: [MAT_ISSUE, MAT_RECEIVE, INV_TRANSACTION]
---
# 기타출고관리

## 화면 목적
양산 출고가 아닌 불량·샘플·외주·반품·기타 목적의 자재 LOT을 바코드 스캔으로 출고하고 이력을 취소까지 관리하는 화면입니다.

## 화면 구성
- 바코드스캔 탭은 /material/lots/by-uid/:matUid로 LOT을 조회하고 /material/issues/scan으로 출고합니다.
- 출고이력 탭은 /material/issues를 조회하고 DONE 건을 /cancel로 되돌립니다.

## ① 컬럼·필드

| 컬럼 | 역할 / 의미 |
|------|------|
| **출고계정(issueType)** | ISSUE_TYPE 공통코드 중 PRODUCTION을 제외한 기타 출고 목적입니다. |
| **LOT 바코드(matUid)** | 스캔 또는 직접 입력하는 자재 시리얼입니다. |
| **품목코드(itemCode)** | 조회된 LOT의 품목코드입니다. |
| **품목명(itemName)** | 조회된 LOT의 품목명입니다. |
| **재고수량(currentQty/availableQty)** | 전량출고 가능 여부를 판단하는 잔량입니다. |
| **단위(unit)** | 품목 수량 단위입니다. |
| **IQC상태(iqcStatus)** | PASS일 때만 출고 가능한 검사 상태입니다. |
| **입고일(recvDate)** | LOT 입고 기준일입니다. |
| **공급처(vendor)** | LOT 공급사입니다. |
| **출고번호(issueNo)** | 출고 이력 번호입니다. |
| **출고일(issueDate)** | 기타출고 처리 시각입니다. |
| **수량(issueQty)** | 출고된 수량입니다. |
| **상태(status)** | DONE 또는 CANCELED 상태입니다. |

## 사용 순서
1. 출고계정을 선택합니다.
2. LOT 바코드를 스캔하고 품목·재고·IQC 상태를 확인합니다.
3. 전량출고를 실행합니다.
4. 출고이력 탭에서 결과를 조회합니다.
5. 오출고는 DONE 이력의 취소 버튼으로 사유를 입력해 되돌립니다.

## 입력 규칙·검증
- IQC PASS가 아니거나 HOLD/DEPLETED LOT은 출고할 수 없습니다.
- 취소는 DONE 상태 이력만 가능하며 재고 복원과 역원장을 남깁니다.

## 자주 묻는 질문
- **Q.** 이 화면의 데이터가 다른 자재 화면과 다르게 보입니다.
  **A.** 입하재고, 창고재고, 수불원장은 서로 다른 단계입니다. 같은 자재UID(matUid)로 관련 화면을 함께 확인하세요.
- **Q.** 검색해도 데이터가 안 보입니다.
  **A.** 기간, 상태, 품목, 창고 필터를 초기화한 뒤 원본 업무 단계에서 데이터가 생성되었는지 확인하세요.

## 관련 화면
- MAT_ISSUE
- MAT_RECEIVE
- INV_TRANSACTION
