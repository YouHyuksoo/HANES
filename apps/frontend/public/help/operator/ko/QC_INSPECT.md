---
menuCode: QC_INSPECT
audience: operator
title: 외관검사 — 운영 가이드
summary: INSPECT_RESULTS(VISUAL) 테이블 구조, FG_LABELS 상태 전이, 합불 처리 트랜잭션과 트러블슈팅
tags: [품질, 외관검사, 운영, VISUAL, FG_LABELS, INSPECT_RESULTS]
keywords: [QC_INSPECT, INSPECT_RESULTS, VISUAL, FG_LABELS, PASS_YN, VISUAL_DEFECT, FG_BARCODE, 외관검사, VISUAL_PASS, VISUAL_FAIL, ISSUED]
related: [QC_DEFECT_CODE, QC_DEFECT]
---

# 외관검사 — 운영 가이드

## 시스템 목적·역할
생산 완료되어 FG 라벨이 발행(`ISSUED`)된 제품의 외관을 육안 검사하고, 결과를 `INSPECT_RESULTS` 테이블에 `INSPECT_TYPE='VISUAL'`로 저장합니다. 합불 결과에 따라 `FG_LABELS.STATUS`가 `VISUAL_PASS` 또는 `VISUAL_FAIL`로 전이됩니다.

## 데이터 구조
```
FG_LABELS (FG_BARCODE PK)
    │   STATUS: ISSUED → VISUAL_PASS / VISUAL_FAIL → PACKED → SHIPPED
    │   INSPECT_RESULT_ID → INSPECT_RESULTS.RESULT_NO
    │   ORDER_NO → JOB_ORDERS
    │
    └──▶ INSPECT_RESULTS (RESULT_NO PK)
            │   INSPECT_TYPE = 'VISUAL' (고정)
            │   INSPECT_SCOPE = 'FULL' (고정)
            │   PASS_YN = 'Y'(합격) / 'N'(불합격)
            │   ERROR_CODE → COM_CODES.VISUAL_DEFECT
            │   ERROR_DETAIL (VARCHAR2 500)
            │   FG_BARCODE → FG_LABELS
            │   INSPECTOR_ID → WORKER_MASTERS
```

---

## ① 검사 결과 — INSPECT_RESULTS (외관검사 관련 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 결과번호 | `RESULT_NO` | **PK**. 시퀀스 자동 채번. |
| 생산실적ID | `PROD_RESULT_ID` | → `PROD_RESULTS` FK (외관검사는 생략 가능). |
| 검사유형 | `INSPECT_TYPE` | `'VISUAL'`로 고정. |
| 검사범위 | `INSPECT_SCOPE` | `'FULL'`로 고정. |
| 합불여부 | `PASS_YN` | `'Y'`(합격) / `'N'`(불합격). 기본값 `'Y'`. |
| 불량코드 | `ERROR_CODE` | 공통코드 `VISUAL_DEFECT` 그룹 값 참조. |
| 상세사유 | `ERROR_DETAIL` | 불합격 상세 사유. 최대 500자. |
| 검사데이터 | `INSPECT_DATA` | CLOB — 추가 검사 데이터(JSON). |
| FG바코드 | `FG_BARCODE` | → `FG_LABELS.FG_BARCODE`. |
| 검사시각 | `INSPECT_TIME` | 검사 수행 타임스탬프. |
| 검사자ID | `INSPECTOR_ID` | → `WORKER_MASTERS`. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | 회사코드(`40`) / 플랜트코드(`1000`). |

---

## ② FG 라벨 — FG_LABELS (상태 전이 관련)

| DB 컬럼 | 역할 / 의미 |
|---------|------|
| `FG_BARCODE` | **PK**. FG 바코드(시리얼). |
| `STATUS` | `ISSUED`(발행) → `VISUAL_PASS`(외관합격) / `VISUAL_FAIL`(외관불합) → `PACKED`(포장) → `SHIPPED`(출하). |
| `INSPECT_RESULT_ID` | 검사 완료 후 `INSPECT_RESULTS.RESULT_NO` 참조 설정. |
| `INSPECT_PASS_YN` | 최종 검사 합불 결과. |

---

## 합불 처리 트랜잭션 상세

`POST /quality/continuity-inspect/visual-inspect/{fgBarcode}` 호출 시 `visualInspect()` 실행:

1. **검증 단계**:
   - `VISUAL_INSP_BYPASS` 시스템 설정 확인(활성화 시 400 에러)
   - FG 라벨 존재 확인 + `STATUS`가 `ISSUED`인지 확인
   - `PACKED`, `SHIPPED`, `VOIDED` 상태는 검사 불가

2. **트랜잭션 내 실행**:
   - `RESULT_NO` 시퀀스 채번
   - `INSPECT_RESULTS` INSERT (`INSPECT_TYPE='VISUAL'`, `INSPECT_SCOPE='FULL'`, `PASS_YN`, `ERROR_CODE`, `ERROR_DETAIL`)
   - `FG_LABELS.UPDATE`: `STATUS='VISUAL_PASS'` 또는 `STATUS='VISUAL_FAIL'`, `INSPECT_RESULT_ID` 설정

---

## 공통코드

| 그룹코드 | 용도 | 예시 |
|---------|------|------|
| `VISUAL_DEFECT` | 외관검사 불량코드 | 스크래치, 이물, 변색, 인쇄불량, 기타 |

---

## 검증 규칙

| 조건 | 처리 |
|------|------|
| FG 바코드 미존재 | `BadRequestException` |
| FG 라벨 상태가 `ISSUED` 아님 | 검사 불가 안내(이미 검사완료/포장/출하/폐기) |
| 바코드가 선택한 작업지시 소속 아님 | 경고 메시지 표시 |
| `VISUAL_INSP_BYPASS` ON | 400 BadRequest |
| FAIL 시 불량코드 미선택 | `FailModal`에서 필수 입력 |

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| FG 바코드 조회 실패 | 바코드 오입력 또는 존재하지 않음 | 바코드 재확인 |
| "이미 검사 완료" 메시지 | FG 라벨이 이미 `VISUAL_PASS`/`VISUAL_FAIL` 상태 | 재검사 불가, 불량관리 화면에서 확인 |
| "다른 작업지시 라벨" 오류 | 스캔한 바코드가 현재 선택한 작업지시와 다름 | 올바른 작업지시 선택 또는 바코드 재확인 |
| FAIL 저장 실패 | 불량코드 미선택 또는 상세 사유 미입력 | 필수 항목 입력 확인 |
| 시스템 설정 오류(400) | `VISUAL_INSP_BYPASS`가 활성화됨 | 관리자에게 문의하여 설정 확인 |
| 검사 후 상태 변화 없음 | 트랜잭션 실패(DB 오류) | 로그 확인 후 재시도 |

## 데이터·연계
- **테이블**: `INSPECT_RESULTS` (검사결과), `FG_LABELS` (라벨/상태), `COM_CODES` (불량코드)
- **연계**: 생산실적(`PROD_RESULTS`), 작업자(`WORKER_MASTERS`)
- **스코프**: `COMPANY='40'`, `PLANT_CD='1000'`
