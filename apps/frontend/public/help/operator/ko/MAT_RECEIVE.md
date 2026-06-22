---
menuCode: MAT_RECEIVE
audience: operator
title: 자재입고관리 — 운영 가이드
summary: IQC 합격 LOT의 스캔 입고 처리 로직, 입고대기 산출 조건, 바코드 매핑/성적서 차단, 재고 반영과 트러블슈팅
tags: [자재, 입고, 수불, 운영]
keywords: [입고대기, IQC합격, matUid, vendor-barcode, 제조사바코드매핑, MatStock, 재고반영, 성적서, certRequired, 잔여수량, 채번, PROD, MRO]
related: [MST_PART, QC_AQL]
---

# 자재입고관리 — 운영 가이드

## 시스템 목적·역할
입하·수입검사를 거친 자재를 **창고 재고로 확정**하는 처리 화면입니다. IQC 합격 LOT만 입고 대상이 되며, 입고 확정 시 재고(`MatStock`)에 반영되고 입고 거래 이력이 생성됩니다.

## 처리 흐름
```
입하(PO 입고) → IQC 검사 → [합격 + 잔여>0] = 입고대기
   → 스캔 입고(거래처바코드 + 자재시리얼 매핑) → 재고(MatStock) 반영 + 입고 이력 채번
```

## 데이터 / API
- 입고대기 조회: `GET /material/receiving/receivable` — **IQC 합격 + 미입고(잔여수량>0)** LOT만 반환.
- 입고 확정: 스캔 매핑(`{ vendorBarcode, matUid }`) 단위로 처리. 매핑된 건만 확정.
- 재고 기준: 현재 재고 수량은 `MatStock`에서 관리(입고 시 증가).

## 입고대기 산출 조건 (운영자 확인 포인트)
LOT이 입고대기에 나타나려면 **모두 충족**해야 함:
- 수입검사 결과 `iqcStatus = 합격`
- 잔여수량(`remainingQty = initQty − receivedQty`) > 0
- (성적서 필요 품목) 입고 차단 사유 없음

## 주요 필드 의미 · 운영 포인트

| 화면 항목 | 의미 / 산출 · 연계 |
|------|------|
| 자재 시리얼(matUid) | 입하 시 채번된 LOT 식별값. 자체부착 바코드로 스캔. |
| 입하수량 / 기입고 / 잔여 | `initQty` / `receivedQty`(부분입고 누계) / `remainingQty`(입고 가능). 부분 입고 누적 지원. |
| 검사상태(iqcStatus) | IQC 판정. 합격건만 입고대기 포함. |
| 입하창고(arrivalWarehouse) | 입하 적치 창고. 입고 시 입고창고로 이동. |
| 성적서(certRequired/certUploaded) | 필요한데 미업로드면 `receivingBlockedReason` 설정 → 입고 차단. |
| 입고 차단 사유(receivingBlockedReason) | 입고 불가 원인. 해소 후 입고 가능. |
| 거래처 바코드(vendorBarcode) | [제조사 바코드 매핑](vendor-barcode 마스터)으로 MES 품번/시리얼과 연결. 미등록 매핑은 스캔 실패. |
| 구분(materialClass) | PROD(양산) / MRO(소모품). 입고 이력 분류. |
| 입고번호/거래번호(receiveNo/transNo) | 입고 처리 채번 값. |

## 스캔 입고 로직
1. 입고처리 시작 → 거래처 바코드 스캔 → vendor-barcode 마스터로 품번/시리얼 해석.
2. 자재 시리얼(matUid) 스캔 → 입고대기 LOT과 매핑.
3. 매핑 성공 건만 입고 확정 → `MatStock` 증가 + 입고 이력 생성.
4. 매핑 실패(미등록 바코드/대상 아님)는 확정되지 않음.

## 사전 설정
- 품목마스터(IQC 여부·성적서 필요 여부), AQL 정책(수입검사), 제조사 바코드 매핑(vendor-barcode), 창고 마스터.

## 권한
자재 담당자(입고 처리). 일반 사용자는 조회.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 입고대기에 LOT이 없음 | IQC 미합격 또는 잔여수량 0 | 검사 완료/합격 여부, 기입고 여부 확인 |
| 입고 처리가 막힘 | 성적서 필요한데 미업로드 | 성적서 업로드 후 차단 사유 해소 |
| 거래처 바코드 스캔 실패 | vendor-barcode 매핑 미등록 | [제조사 바코드 매핑]에 바코드↔품번 등록 |
| 자재 시리얼 스캔이 매칭 안 됨 | 입고대기 대상 아님(다른 LOT/전량입고) | 대상 LOT·잔여수량 확인 |
| 재고에 반영 안 됨 | 입고 미확정(매핑만 하고 확정 안 함) | 스캔 매핑 후 확정 처리 확인 |

## 데이터·연계
- 재고: `MatStock`(입고 시 증가)
- 연계: 입하/PO, 수입검사(IQC)·AQL, 제조사 바코드 매핑(vendor-barcode), 창고, 품목마스터
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
