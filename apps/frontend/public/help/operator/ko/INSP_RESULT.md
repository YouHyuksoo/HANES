---
menuCode: INSP_RESULT
audience: operator
title: 통전검사 — 운영 가이드
summary: 완제품 통전(Continuity) 검사 — 검사기 선택·작업지시 조회·PASS/FAIL 판정·FG 바코드 발행·회로라벨 스캔·소모성부품 장착·라벨 재발행/폐기/재검사
tags: [품질, 통전검사, 검사, 운영]
keywords: [INSPECT_RESULTS, FG_LABELS, CONTINUITY_DEFECT, FG_BARCODE, CIRCUIT_LABEL, PASS_YN, ERROR_CODE, TESTER, CONSUMABLE, JOB_ORDERS, 통전검사, 연속성검사, FG바코드, 회로라벨, 검사기, 소모성부품, 재발행, 폐기, 재검사, 합격, 불합격]
related: [QC_INSPECT, SHIP_PACK]
---

# 통전검사 — 운영 가이드

## 시스템 목적·역할
완제품(FG)의 **통전(Continuity) 검사**를 수행하는 화면입니다. 검사기(Tester)를 선택하고 작업지시 단위로 FG 바코드를 발행·검사합니다. PASS/FAIL 판정과 동시에 FG 라벨이 생성되며, 소모성 부품 장착 상태를 확인해야 검사가 가능합니다.

```
FG 발행 → 검사기 연동 → 통전검사(PASS/FAIL) → FG_LABELS (ISSUED) → 외관검사
```

## 데이터 구조
```
JOB_ORDERS (PK: ORDER_NO)
   ├─ 생산실적(PROD_RESULTS) → FG_LABELS (바코드 발행)
   └─ CONSUMABLES (소모성부품 매핑)

FG_LABELS (PK: FG_BARCODE)
   상태 전이: ISSUED → VISUAL_PASS/FAIL → PACKED → SHIPPED
   통전검사 PASS 시 ISSUED 상태로 생성 → 외관검사(VISUAL)에서 VISUAL_PASS로 전이

INSPECT_RESULTS (PK: RESULT_NO)
   통전검사 결과 저장 (INSPECT_TYPE='CONTINUITY')
```

## 화면 구성
좌측 4 / 우측 8 컬럼 그리드:

### 좌측 패널 (4/12)
- **검사기 선택** 드롭다운: `GET /equipment/equips/type/TESTER` — localStorage에 선택 유지
- **작업지시 목록**: `GET /quality/continuity-inspect/job-orders`
  - 작업지시번호·품목코드·품목명·계획수량/양품/불량
  - 상태 배지(`JOB_ORDER_STATUS` 공통코드)
  - 검색: 작업지시번호·품목코드·품목명 (300ms 디바운스)
- **소모성부품 패널** (`ConsumablePanel`): 선택된 작업지시+검사기에 매핑된 소모품 목록
  - 소모품 UID 바코드 스캔 → 장착
  - 미장착 시 검사 차단 인터록
  - 장착 상태 색상: 초록(정상) / 주황(경고) / 빨강(수명초과)

### 우측 패널 (8/12)
- `InspectPanel` — 검사 실행 인터페이스
- **FG 바코드 발행 이력** DataGrid: `GET /quality/continuity-inspect/fg-labels/{orderNo}`
  - FG바코드·발행시간·상태·재발행횟수·inspectPassYn
  - 레이블 복구 액션: 재검사(FAIL만) / 재발행 / 폐기
- **PASS/FAIL 버튼** (대형 토글)
- **스캔 모드** (설정에 따라): 제품바코드 + 회로라벨 스캔 후 PASS 가능

## 검사 흐름

### ① 검사기 선택
`GET /equipment/equips/type/TESTER`
- 검사기 미선택 시 모든 검사 차단
- 선택값은 `localStorage` (`hanes:inspection:equip:CONTINUITY`)에 유지

### ② 작업지시 선택
`GET /quality/continuity-inspect/job-orders?finishedOnly=true`
- 완제품 작업지시만 표시 (`finishedOnly=true`)
- 선택 시 소모성부품 장착 상태 확인

### ③ 소모성부품 장착
`POST /production/job-orders/{orderNo}/consumables/scan { conUid, equipCode }`
- 소모품 UID 바코드 스캔 → 해당 작업지시+검사기 조합에 매핑된 소모품 자동 장착
- 장착 해제: `DELETE /production/job-orders/{orderNo}/consumables/{mountedConUid}`
- 소모품 미장착 시 검사 차단

### ④ PASS/FAIL 검사
`POST /quality/continuity-inspect/inspect { orderNo, itemCode, equipCode, passYn, ... }`
- **PASS**: FG 바코드 자동 발행 + FG_LABELS `ISSUED` 상태로 생성
- **FAIL**: `FailModal` → 불량코드(`CONTINUITY_DEFECT`) + 상세 사유 → `INSPECT_RESULTS`에 기록 (FG_LABELS 미생성)
- 스캔 모드(선택사항): 제품바코드 + 회로라벨(`CIRCUIT_LABEL`)을 먼저 스캔해야 PASS 가능

### ⑤ 라벨 후속 조치
- **재검사**(Re-inspect): `POST /quality/continuity-inspect/re-inspect/{barcode}` — FAIL→PASS 전환
- **재발행**(Reprint): `POST /quality/continuity-inspect/reprint/{barcode}` — 재발행횟수 증가
- **폐기**(Void): `POST /quality/continuity-inspect/void/{barcode}` — FG_LABELS `VOIDED`로 전이

## 인터록 (검사 차단 조건)
검사 전 아래 조건이 모두 충족되어야 PASS/FAIL 버튼이 활성화됩니다.

| 조건 | 메시지 | 해결 |
|------|--------|------|
| 검사기 선택 | 검사 전 검사기를 선택하세요 | 검사기 드롭다운에서 선택 |
| 소모품 장착 완료 | 소모품 N개 미장착 | 소모품 UID 스캔하여 장착 |
| 바코드 스캔 (스캔모드) | 바코드를 먼저 스캔해주세요 | 제품바코드 스캔 |
| 회로라벨 스캔 (스캔모드·PASS) | 합격하려면 회로라벨을 스캔해주세요 | 회로라벨(CIRCUIT_LABEL) 스캔 |

## 전체 컬럼 — INSPECT_RESULTS

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 검사번호 | `RESULT_NO` | PK. SeqGenerator 자동 채번 (`INSPECT_RESULT`). |
| FG 바코드 | `FG_BARCODE` | `FG_LABELS.FG_BARCODE` 참조. |
| 검사유형 | `INSPECT_TYPE` | `CONTINUITY`(통전검사). |
| 검사범위 | `INSPECT_SCOPE` | `FULL`(전수). 통전검사는 항상 전수. |
| 합격여부 | `PASS_YN` | Y/N. |
| 불량코드 | `ERROR_CODE` | 공통코드 `CONTINUITY_DEFECT`. 불합격 시 필수. |
| 상세사유 | `ERROR_DETAIL` | 불합격 상세 텍스트. |
| 회로라벨 | `CIRCUIT_LABEL` | 설비 출력 2차원 바코드 (스캔모드 PASS 시 매핑). |
| 검사데이터 | `INSPECT_DATA` | CLOB. 추가 검사 데이터 JSON. |
| 검사시간 | `INSPECT_TIME` | 검사 시점. Default CURRENT_TIMESTAMP. |
| 검사원 | `INSPECTOR_ID` | 검사 수행자. |
| 설비코드 | `EQUIP_CODE` | 검사기(TESTER) 설비코드. |
| 생산실적 | `PROD_RESULT_ID` | → `PROD_RESULTS.RESULT_NO` 참조. |
| 감사 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 생성/수정 이력. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | `40` / `1000` 스코프. |

## 소모성부품 상태

| 표시 | 의미 | 조치 |
|------|------|------|
| 초록 테두리 + CheckCircle | 정상 장착됨 | 검사 진행 가능 |
| 주황 테두리 + AlertTriangle | 경고 카운트 도달 | 소모품 교체 검토 |
| 빨강 테두리 + AlertCircle | 예상 수명 초과 | 즉시 교체 필요 |
| 빨강 테두리 + AlertCircle (미장착) | 장착되지 않음 | UID 스캔하여 장착 |

## 사전 설정 (마스터·공통코드)
- 공통코드: `CONTINUITY_DEFECT`(통전검사 불량코드), `JOB_ORDER_STATUS`, `TESTER`(검사기 유형)
- 설비 마스터: `EQUIPMENTS.equipType='TESTER'`인 검사기 등록 필요
- 소모품 매핑: 작업지시 품목+검사기 조합에 소모품 사전 매핑 필요
- FG_LABELS: `SEQ_FG_BARCODE` 시퀀스 필요

## 권한
품질검사 담당자(통전검사 수행/라벨 관리). 관리자는 검사 이력 수정/삭제 가능.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 검사기 목록이 비어 있음 | `EQUIPMENTS`에 TESTER 유형 설비 없음 | 설비 마스터에 TESTER 등록 |
| 작업지시 목록이 비어 있음 | 완제품 작업지시 없음 | 생산계획·작업지시 확인 |
| PASS 버튼 비활성화 | 소모품 미장착 또는 장비 미선택 | 인터록 조건 확인 |
| 소모품 스캔 실패 | 잘못된 UID 또는 매핑 안 됨 | UID 확인, 작업지시-검사기-소모품 매핑 확인 |
| FG 바코드 발행 안 됨 | `SEQ_FG_BARCODE` 시퀀스 문제 | 시퀀스 상태 확인 |
| 라벨 재발행 시 인쇄 안 됨 | 프린터 연결 또는 bwip-js 오류 | 프린터·브라우저 인쇄 설정 확인 |
| 폐기 버튼 비활성화 | 이미 PACKED/SHIPPED/VOIDED 상태 | 현재 상태 확인 (PACKED 이후는 폐기 불가) |
| 재검사 버튼 비활성화 | FG가 FAIL 상태가 아님 | PASS 상태는 재검사 불필요 |

## 데이터·연계
- 테이블: `INSPECT_RESULTS`, `FG_LABELS`, `JOB_ORDERS`, `PROD_RESULTS`, `CONSUMABLES`
- 연계: 외관검사(`/quality/inspect`), 제품포장(`/shipping/pack`), 설비관리(검사기), 소모품관리, 추적관리(`/quality/trace`)
- FG 바코드 채번: Oracle `SEQ_FG_BARCODE`
- 검사번호 채번: `SEQ_RULES` 코드 `INSPECT_RESULT`
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
