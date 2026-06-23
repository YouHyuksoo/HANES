---
menuCode: EQUIP_DAILY
audience: operator
title: 일상점검 — 운영 가이드
summary: EQUIP_INSPECT_LOGS 테이블 DAILY 타입 점검, 인터록(INTERLOCK) 메커니즘, 측정형 자동판정 로직과 트러블슈팅
tags: [설비, 점검, 일상, 운영, DAILY, 결과, 인터록]
keywords: [EQUIP_INSPECT_LOGS, DAILY, 일상점검결과, OVERALL_RESULT, INTERLOCK, VISUAL, MEASURE, LSL, USL, DETAILS, CLOB]
related: [EQUIP_INSPECT_CALENDAR, EQUIP_INSPECT_ITEM]
---

# 일상점검 — 운영 가이드

## 시스템 목적·역할
`EQUIP_INSPECT_LOGS` 테이블에 `INSPECT_TYPE='DAILY'`로 저장되는 일상점검 결과를 등록·조회·수정합니다. 점검 결과가 FAIL이면 연계된 설비의 상태를 **INTERLOCK(인터록)**으로 자동 변경하여 설비 가동을 제한합니다.

## 데이터 구조
```
EQUIP_INSPECT_LOGS (PK: COMPANY + PLANT_CD + EQUIP_CODE + INSPECT_TYPE + INSPECT_DATE)
    │
    ├── INSPECT_TYPE = 'DAILY' (고정)
    ├── OVERALL_RESULT = 'PASS' | 'FAIL' | 'CONDITIONAL'
    ├── DETAILS (CLOB): 항목별 결과 JSON 배열
    ├── INSPECTOR_NAME & INSPECT_AT
    │
    ├──▶ EquipMaster.status = 'INTERLOCK' (FAIL 시 자동)
    │
    └── 연계: EQUIP_INSPECT_ITEM_POOL → EQUIP_INSPECT_ITEM_MASTERS
              (해당 설비의 DAILY 점검항목)
```

---

## ① 점검 로그 — EQUIP_INSPECT_LOGS (전체 컬럼 - DAILY)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 설비코드 | `EQUIP_CODE` | **PK (1/6)**. 개별 설비. |
| 점검유형 | `INSPECT_TYPE` | **PK (2/6)**. `'DAILY'`로 고정. |
| 점검일 | `INSPECT_DATE` | **PK (3/6)**. 점검 수행일. |
| 작업지시번호 | `ORDER_NO` | WORKER 점검용(DAILY는 보통 null). |
| 조업일 | `WORK_DATE` | DAILY 점검의 업무 키(조업일 기준). |
| 점검시각 | `INSPECT_AT` | 실제 점검 완료 시각(TIMESTAMP). |
| 조업시작시각 | `OP_WINDOW_START_AT` | 당일 작업 시작 시각(WorkCalendar 연계). |
| 조업종료시각 | `OP_WINDOW_END_AT` | 당일 작업 종료 시각(WorkCalendar 연계). |
| 점검자명 | `INSPECTOR_NAME` | 점검 수행자 이름. |
| 종합결과 | `OVERALL_RESULT` | `PASS`(합격) / `FAIL`(불합격) / `CONDITIONAL`(조건부). |
| 항목별결과 | `DETAILS` | CLOB — 항목별 판정 JSON 배열. |
| 비고 | `REMARK` | 점검 관련 메모. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | **PK (4,5,6/6)**. 회사코드(`40`) / 플랜트코드(`1000`). |
| 생성자 | `CREATED_BY` | 최초 등록자. |
| 수정자 | `UPDATED_BY` | 최종 수정자. |
| 생성일시 | `CREATED_AT` | 레코드 생성 시각. |
| 수정일시 | `UPDATED_AT` | 레코드 수정 시각. |

---

## DETAILS(CLOB) JSON 구조

각 항목별 점검 결과는 CLOB 컬럼에 JSON 배열로 저장됩니다:

```json
[
  {
    "itemCode": "EI-DAILY-001",
    "itemName": "비상정지 버튼 작동",
    "itemType": "VISUAL",
    "result": "PASS",
    "criteria": "정상 작동 확인",
    "remark": "",
    "measureValue": null,
    "lsl": null,
    "usl": null
  },
  {
    "itemCode": "EI-DAILY-002",
    "itemName": "메인 압력 게이지",
    "itemType": "MEASURE",
    "result": "FAIL",
    "criteria": "5.0 ~ 7.0 kgf/cm²",
    "remark": "압력 4.2로 하한 이탈",
    "measureValue": 4.2,
    "lsl": 5.0,
    "usl": 7.0
  }
]
```

---

## 인터록(INTERLOCK) 메커니즘

| 조건 | 동작 | 해제 방법 |
|------|------|----------|
| `OVERALL_RESULT = 'FAIL'` | `EquipMaster.status` → `'INTERLOCK'` 자동 변경 | 별도 해제 프로세스 필요 |
| `OVERALL_RESULT = 'PASS'` | `EquipMaster.status` → `'NORMAL'` 자동 변경 (이전 상태가 INTERLOCK이었다면) | 자동 |
| `OVERALL_RESULT = 'CONDITIONAL'` | 설비 상태 변경 없음 | - |

---

## 자동 판정 로직

### 측정형(MEASURE) 자동 판정
```
if measureValue < LSL → FAIL (하한 이탈)
if measureValue > USL → FAIL (상한 초과)
if LSL <= measureValue <= USL → PASS (정상 범위)
```
- 사용자가 수동으로 OK/NG 선택도 가능

### 판정형(VISUAL)
- 사용자가 직접 OK 또는 NG 선택

---

## 권한
설비 점검 결과 입력 권한(작업자/설비管理者). 조회는 전체 사용자.

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| 좌측 설비 목록이 비어 있음 | 해당 설비에 DAILY 점검항목 미연결 | 설비별 점검항목 화면에서 항목 추가 |
| 점검 저장 실패 | 점검자 미선택 또는 항목 판정 미입력 | 모든 필수 항목 입력 확인 |
| FAIL 저장했는데 설비가 INTERLOCK 안 됨 | 서비스 로직 예외 또는 트랜잭션 실패 | 로그 확인 후 수동 INTERLOCK 처리 |
| 측정값 입력 시 자동 판정이 안 됨 | LSL/USL이 마스터에 미설정 | 점검항목 마스터에서 LSL/USL 설정 |
| 저장 버튼이 비활성화됨 | 점검자 미선택 또는 일부 항목 판정 누락 | 모든 필드 입력 완료 확인 |
| 동일 설비·일에 중복 저장 | 이미 점검 완료된 레코드 존재 | 수정(PUT)으로 처리 |

## 데이터·연계
- **테이블**: `EQUIP_INSPECT_LOGS` (점검 결과), `EQUIP_INSPECT_ITEM_POOL` (매핑), `EQUIP_INSPECT_ITEM_MASTERS` (항목 기준), `EQUIP_MASTERS` (설비 상태)
- **연계**: 작업실적 화면 팝업과 데이터 공유, 설비 인터록(INTERLOCK) 상태 변경
- **스코프**: `COMPANY='40'`, `PLANT_CD='1000'`
