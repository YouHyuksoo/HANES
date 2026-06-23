---
menuCode: MAT_RECEIPT_CANCEL
audience: operator
title: 자재입고취소 — 운영 가이드
summary: 입고취소의 DB 구조(STOCK_TRANSACTIONS 취소 체인), 서버 검증 체인, 재고 차감 로직과 트러블슈팅
tags: [자재, 입고, 취소, 운영, 역트랜잭션, 수불]
keywords: [STOCK_TRANSACTIONS, CANCEL_REF_ID, RECEIVE, DONE, CANCELED, MatStock, 역트랜잭션, 취소사유, ensureNoDownstreamProgress, NotFoundException, BadRequestException, 재고차감]
related: [MAT_RECEIVE, MAT_ARRIVAL]
---

# 자재입고취소 — 운영 가이드

## 시스템 목적·역할
`STOCK_TRANSACTIONS`에 기록된 `RECEIVE` 유형의 입고 거래를 취소하는 화면입니다. 취소 시 원본 거래의 `STATUS`를 `CANCELED`로 변경하고, 반대 부호의 역트랜잭션을 생성하여 `MatStock` 재고를 차감합니다. 잘못된 입고나 품질 이상 발생 시 재고 정확성을 복원하는 데 사용합니다.

## 데이터 구조
```
STOCK_TRANSACTIONS (RECEIVE, STATUS='DONE')
    │
    ├── 취소 요청 ──▶ 검증(원본 존재·중복취소·transType·후행작업)
    │                     │
    │                     ├── 실패 → 예외 반환
    │                     │
    │                     └── 성공 → 이중 처리:
    │                              ├── 원본 STATUS = 'CANCELED'
    │                              │   + CANCEL_REF_ID = 자기참조
    │                              │
    │                              ├── 역트랜잭션 생성
    │                              │   (QTY = -원본QTY, REF_TYPE='CANCEL')
    │                              │   + CANCEL_REF_ID = 원본.TRANS_NO
    │                              │
    │                              └── MatStock 차감
    │                                    (해당 LOT 수량 감소)
    │
    └── 취소이력 ──▶ STOCK_TRANSACTIONS에 역트랜잭션으로 보관
```

---

## ① 취소가능 입고내역 — STOCK_TRANSACTIONS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 거래일 | `TRANS_DATE` | 입고 거래 발생 일자. 조회 기준이 되는 기간 필터와 연결. |
| 거래번호 | `TRANS_NO` | **PK**. 입고 거래 고유 식별 번호. 자동 채번. |
| 거래유형 | `TRANS_TYPE` | 입고취소 화면에서는 `RECEIVE`만 필터링하여 표시. |
| 품목코드 | `ITEM_CODE` | 입고된 품목 코드. `ITEM_MASTERS.ITEM_CODE` 참조. |
| 품목명 | (화면 조인) | `ITEM_MASTERS.ITEM_NAME`에서 조회. |
| 자재시리얼 | `MAT_UID` | 입고된 자재 LOT의 UID. `MAT_LOTS.MAT_UID`와 연결. |
| 공급처 | (화면 조인) | 거래처명. `PARTNERS` 테이블에서 조회. |
| 입고창고 | `TO_WAREHOUSE_ID` | 자재가 입고된 창고 ID. `WAREHOUSES` 참조. |
| 수량 | `QTY` | 입고된 수량. 취소 시 이 값의 역부호로 역트랜잭션 생성. |
| 상태 | `STATUS` | `DONE`(정상) / `CANCELED`(취소). `DONE` 건만 취소 버튼 활성화. |
| 취소참조 | `CANCEL_REF_ID` | 취소 시 원본 `TRANS_NO`를 저장. NULL이면 취소되지 않은 건. |
| 참조유형 | `REF_TYPE` | 원본 거래의 참조 유형. 취소 시 역트랜잭션은 `'CANCEL'`로 생성. |
| 참조ID | `REF_ID` | 원본 거래의 참조 ID(예: 입하번호, PO번호). |
| 적요 | `REMARK` | 거래 관련 비고(취소 사유는 취소 모달의 별도 필드). |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | 회사코드(`40`) / 플랜트코드(`1000`) 스코프. |
| 작성자 | `CREATED_BY` | 입고 등록자. |
| 생성일시 | `CREATED_AT` | 입고 등록 시각. |
| 수정자 | `UPDATED_BY` | 최종 수정자(취소 처리 시 갱신). |
| 수정일시 | `UPDATED_AT` | 최종 수정 시각(취소 처리 시 자동 갱신). |

---

## 취소 처리 상세

### 서버 검증 체인 (순서대로 실행)

| 단계 | 검증 | 실패 시 |
|------|------|--------|
| 1 | 원본 거래 존재 여부 확인 (`findOne` by `TRANS_NO`) | `NotFoundException` |
| 2 | 이미 취소되었는지 확인 (`STATUS = 'CANCELED'`) | `BadRequestException` — "already canceled" |
| 3 | 거래 유형 확인 (`TRANS_TYPE = 'RECEIVE'`) | `BadRequestException` — "not a receive transaction" |
| 4 | 후행 작업 진행 여부 확인 (`ensureNoDownstreamProgress`) | `BadRequestException` — "cannot cancel: downstream progress exists" |

### 취소 실행 처리 순서
1. `MatStock`에서 해당 창고 + 품목 + LOT의 재고 수량을 `원본 QTY`만큼 **차감**
2. 원본 `STOCK_TRANSACTIONS.STATUS`를 `'CANCELED'`로 갱신 + `CANCEL_REF_ID` 설정
3. 역트랜잭션 행 생성 (`QTY = -원본QTY`, `TRANS_TYPE = 'RECEIVE'`, `REF_TYPE = 'CANCEL'`, `CANCEL_REF_ID = 원본.TRANS_NO`)
4. 감사 필드(`UPDATED_BY`, `UPDATED_AT`) 갱신

> **트랜잭션 처리**: 위 1~4는 단일 DB 트랜잭션 내에서 실행되어 원자성이 보장됩니다. 중간 실패 시 전체 롤백됩니다.

---

## 취소 체인 구조

```
원본 입고 (RECEIVE, DONE)
  TRANS_NO = 'R20250101-001', QTY = 100
     │
     ├── 취소 처리 ──▶ STATUS → 'CANCELED'
     │                    CANCEL_REF_ID → 'R20250101-001' (자기참조)
     │
     └── 역트랜잭션 생성 ──▶ RECEIVE, STATUS = 'DONE'
                              TRANS_NO = 'R20250101-002' (신규 채번)
                              QTY = -100
                              REF_TYPE = 'CANCEL'
                              CANCEL_REF_ID = 'R20250101-001'
```

> `CANCEL_REF_ID`로 원본과 역트랜잭션을 추적할 수 있습니다. 역트랜잭션은 별도 취소 대상이 아니며, 이 화면에 표시되지 않습니다.

---

## 운영 절차
1. **취소 요청 접수**: 현장에서 입고 오류 또는 품질 이상 발견 시 취소 요청
2. **취소 가능 여부 확인**: 화면에서 대상 건의 상태 및 후행 작업 진행 여부 확인
3. **취소 사유 입력**: 구체적인 취소 사유를 기록(감사 추적 목적)
4. **취소 확정**: 역트랜잭션 생성 및 재고 차감 확인
5. **사후 조치**: 필요 시 재입고(MAT_RECEIVE) 또는 반품 처리

## 권한
입고 취소 권한이 있는 사용자(자재/품질 관리자). 일반 사용자는 조회만 가능.

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| 취소 버튼 비활성화 | 이미 `CANCELED` 상태이거나 `STATUS`가 `DONE`이 아님 | 원본 거래 상태 확인, 이미 취소된 건은 재취소 불가 |
| "원본 거래를 찾을 수 없습니다" | `TRANS_NO`가 DB에 존재하지 않음 | DB에서 해당 거래 존재 여부 직접 확인 |
| "이미 취소된 거래입니다" | `STATUS`가 이미 `CANCELED` | 취소 이력 조회로 원복 여부 판단 |
| "입고 거래가 아닙니다" | `TRANS_TYPE`이 `RECEIVE`가 아님 | 해당 화면은 `RECEIVE`만 취소 가능. 다른 유형은 해당 기능 사용 |
| "후행 작업이 있어 취소 불가" | 해당 LOT이 이미 생산 투입 등 진행됨 | 생산 진행 상태 확인. 후행 작업 완료 후 취소 가능 |
| 취소 후 재고 수량이 맞지 않음 | 역트랜잭션 생성 실패 또는 중복 차감 | `STOCK_TRANSACTIONS`와 `MatStock`의 해당 LOT 수량 대조 확인 |
| 취소 처리는 됐는데 화면에 반영 안 됨 | 브라우저 캐시 또는 미갱신 | **새로고침(Refresh)** 버튼 클릭 |

## 데이터·연계
- **테이블**: `STOCK_TRANSACTIONS` (원본 + 역트랜잭션), `MatStock` (재고 차감)
- **연계**: `ITEM_MASTERS`(품목), `WAREHOUSES`(창고), `PARTNERS`(거래처), `MAT_LOTS`(LOT)
- **검증 참조**: `ensureNoDownstreamProgress` — 생산 투입 등 후행 작업이 있는 취소 차단
- **스코프**: `COMPANY='40'`, `PLANT_CD='1000'`
- **감사**: 취소 시 `CANCEL_REF_ID`로 원본-역트랜잭션 연결 추적 가능
