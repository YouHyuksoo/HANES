---
menuCode: MAT_ISSUE_OTHER
audience: operator
title: 기타출고관리 — 운영 가이드
summary: 비양산 자재출고 — LOT 바코드 스캔 전량출고, 출고이력 조회·취소, 불량/샘플/외주/폐기/반품/기타 출고계정
tags: [자재, 출고, 기타출고, LOT, 바코드]
keywords: [MAT_ISSUES, MAT_LOTS, MAT_STOCKS, STOCK_TRANSACTIONS, ISSUE_TYPE, DONE, CANCELED, MAT_OUT, WIP_MOVE, 기타출고, LOT출고, 바코드스캔, 출고취소]
related: [MAT_ISSUE, MAT_RECEIVE]
---

# 기타출고관리 — 운영 가이드

## 시스템 목적·역할
양산 외 자재 출고(불량/샘플/외주/폐기/반품/기타)를 처리하는 화면입니다. LOT 바코드를 스캔하여 해당 LOT의 전체 재고를 한 번에 출고하거나, 출고 이력을 조회하고 취소할 수 있습니다.

```
바코드스캔 탭: LOT 스캔 → 전량출고
출고이력 탭:   이력조회 → 취소(사유입력)
```

## 데이터 구조
```
MAT_LOTS (PK: matUid)
   ├─ ITEM_CODE → ITEM_MASTERS
   ├─ currentQty / iqcStatus / status(NORMAL/HOLD/DEPLETED)
   └─ MAT_STOCKS (qty / availableQty / reservedQty)

MAT_ISSUES (PK: issueNo + seq)
   ├─ matUid / issueQty / issueType / status(DONE/CANCELED)
   └─ STOCK_TRANSACTIONS (transType=MAT_OUT/WIP_MOVE)
```

## 화면 구성

### 바코드스캔 탭
- **출고계정 선택**: `ISSUE_TYPE` 공통코드 (PRODUCTION 제외)
- **LOT 바코드 입력**: 자동 포커스, Enter → `GET /material/lots/by-uid/{matUid}`
- **스캔 결과 카드**:
  - 품목코드·품목명·LOT·재고수량·단위
  - IQC 상태 (PASS여야 출고 가능)
  - 입고일·공급처
- **전량출고 버튼**: `POST /material/issues/scan { matUid, issueType }`
- **오늘 출고내역**: 로컬 DataGrid (방금 출고한 건)

### 출고이력 탭
- **검색 필터**: 상태·출고계정·기간
- **DataGrid**: `GET /material/issues?limit=200`
  - 컬럼: 출고번호·출고일·품목코드·품목명·LOT·수량·출고계정·작업지시·상태
  - 취소 버튼 (DONE 상태만)
- **취소 모달**:
  - 출고 상세 정보 표시
  - 취소 사유 입력 필수
  - `POST /material/issues/{issueNo}/{seq}/cancel { reason }`

## 작업 흐름

### ① 바코드스캔 출고
1. 출고계정 선택 (예: 불량, 샘플, 외주)
2. LOT 바코드 스캔 또는 수동 입력
3. 스캔 결과 확인 (IQC PASS 필수)
4. `전량출고` 버튼 클릭
5. 재고 차감 + STOCK_TRANSACTIONS 기록

### ② 출고이력 조회
- 기간·상태·출고계정 필터링
- 출고계정은 `ISSUE_TYPE` 공통코드 배지 표시
- DONE/CANCELED 상태 구분

### ③ 출고 취소
- DONE 상태인 건만 취소 가능
- 취소 사유 입력 필수
- 취소 시 재고 복원 + 역트랜잭션 기록
- 생산실적 연결된 건은 하류공정 진행 시 취소 불가

## 인터록

| 조건 | 설명 |
|------|------|
| IQC PASS 아님 | 출고 불가 |
| HOLD/DEPLETED 상태 | 출고 불가 |
| 재고 부족 | 출고 불가 |
| 생산실적 진행 중 | 취소 불가 |
| 이미 취소된 건 | 취소 불가 |

## 문제 해결

| 증상 | 원인 | 조치 |
|------|------|------|
| LOT 조회 안 됨 | 바코드 오류 | LOT 바코드 확인 |
| 출고계정 없음 | PRODUCTION 제외 | 기타계정 선택 확인 |
| 출고 실패 | IQC PASS·재고 확인 | 자재상태·재고 확인 |
| 취소 실패 | 생산실적 연결 | 하류공정 완료 후 취소 |

## 데이터·연계
- 테이블: `MAT_ISSUES`, `MAT_LOTS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS`, `WIP_MAT_STOCKS`
- 연계: 입고관리(`/material/receive`) → **기타출고(현재)** → 생산투입
- 공통코드: `ISSUE_TYPE` (PRODUCTION/SCRAP/SAMPLE/OUTSOURCING/RETURN/DEFECT/OTHER)
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
