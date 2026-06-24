---
menuCode: MAT_RECEIVE_LABEL
audience: user
title: 자재라벨발행
summary: IQC 합격 입하 건의 자재 라벨을 선택·미리보기·출력하고, 라벨 발행 이력을 확인하는 화면입니다.
tags: [자재, 라벨, 입고, 출력]
keywords: [라벨발행, receive-label, LabelPrintLog, ZPL, BROWSER, mat_lot]
related: [MAT_ARRIVAL_RESULT, MAT_RECEIVE, MST_LABEL]
---
# 자재라벨발행

## 화면 목적
IQC 합격 입하 건의 자재 라벨을 선택·미리보기·출력하고, 라벨 발행 이력을 확인하는 화면입니다.

## 화면 구성
- 대상 목록은 /material/receive-label/arrivals에서 조회합니다.
- 라벨 디자인은 /master/label-templates category=mat_lot 기준입니다.
- 출력은 브라우저, ZPL USB, ZPL TCP 경로를 지원하고 /material/label-print/log에 로그를 남깁니다.

## ① 컬럼·필드

| 컬럼 | 역할 / 의미 |
|------|------|
| **선택(select)** | 라벨을 출력할 입하 행을 체크합니다. |
| **입하번호(arrivalNo)** | 라벨 발행 대상 입하번호입니다. |
| **품목코드(itemCode)** | 라벨에 인쇄될 품목코드입니다. |
| **품목명(itemName)** | 라벨에 인쇄될 품목명입니다. |
| **수량(qty)** | 라벨 발행 대상 수량입니다. |
| **공급사(vendor)** | 입하 공급사입니다. |
| **PO번호(poNo)** | 발주 기반 입하의 연결 PO입니다. |
| **입하일(arrivalDate)** | 자재가 납품된 날짜입니다. |
| **라벨상태(labelPrinted)** | 성공 출력 로그 존재 여부입니다. |
| **출력방식(printMode)** | BROWSER/ZPL_USB/ZPL_TCP 등 실제 출력 경로입니다. |
| **프린터(printerName)** | 선택된 로컬 또는 네트워크 프린터입니다. |
| **발행일시(printedAt)** | 라벨 로그 생성 시각입니다. |
| **매수(labelCount)** | 한 작업에서 출력한 라벨 수입니다. |
| **발행자(workerId)** | 출력 작업자입니다. |
| **상태(status)** | 라벨 출력 로그의 성공/실패 상태입니다. |

## 사용 순서
1. 출력할 입하 행을 체크합니다.
2. 라벨 템플릿과 출력 방식을 선택합니다.
3. 미리보기에서 인쇄 내용을 확인합니다.
4. 출력 후 이력 섹션에서 SUCCESS 로그를 확인합니다.

## 입력 규칙·검증
- IQC PASS 상태의 입하 건만 라벨 발행 대상입니다.
- ZPL USB는 Zebra Agent와 프린터 선택이 필요합니다.
- 출력 로그는 uidList, printMode, labelCount를 남겨 중복 발행 판단에 사용합니다.

## 자주 묻는 질문
- **Q.** 이 화면의 데이터가 다른 자재 화면과 다르게 보입니다.
  **A.** 입하재고, 창고재고, 수불원장은 서로 다른 단계입니다. 같은 자재UID(matUid)로 관련 화면을 함께 확인하세요.
- **Q.** 검색해도 데이터가 안 보입니다.
  **A.** 기간, 상태, 품목, 창고 필터를 초기화한 뒤 원본 업무 단계에서 데이터가 생성되었는지 확인하세요.

## 관련 화면
- MAT_ARRIVAL_RESULT
- MAT_RECEIVE
- MST_LABEL
