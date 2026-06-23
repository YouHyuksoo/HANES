---
menuCode: CONS_MOUNT
audience: operator
title: 소모품 장착관리 — 운영 가이드
summary: 소모품의 설비 장착/해제/수리 상태 전환과 CONSUMABLE_MASTERS, CONSUMABLE_MOUNT_LOGS 데이터 흐름 및 트러블슈팅
tags: [소모품, 장착, 해제, 수리, 운영, 설정]
keywords: [CONSUMABLE_MASTERS, CONSUMABLE_MOUNT_LOGS, EQUIP_MASTERS, OPER_STATUS, MOUNTED, WAREHOUSE, REPAIR, MOUNT, UNMOUNT, SEQ_CONSUMABLE_MOUNT_LOGS]
related: [CONS_MASTER, CONS_STOCK, CONS_LIFE]
---

# 소모품 장착관리 — 운영 가이드

## 시스템 목적·역할
생산 설비에 사용하는 소모품(금형·지그·공구)의 **물리적 상태**를 관리합니다. `CONSUMABLE_MASTERS`의 `OPER_STATUS`와 `MOUNTED_EQUIP_ID`를 갱신하고, 모든 상태 전환은 `CONSUMABLE_MOUNT_LOGS`에 감사 이력으로 남습니다. 이 화면은 입출고나 수명 관리와는 별개의 상태 관리 흐름입니다.

## 데이터 구조
```
CONSUMABLE_MASTERS (PK: CONSUMABLE_CODE, COMPANY, PLANT_CD)
   ├─ OPER_STATUS        : WAREHOUSE / MOUNTED / REPAIR
   ├─ MOUNTED_EQUIP_ID   : 현재 장착 설비 (MOUNTED 상태일 때)
   └─ 1:N ─▶ CONSUMABLE_MOUNT_LOGS (PK: MOUNT_DATE, SEQ)
              ├─ ACTION: MOUNT / UNMOUNT
              ├─ EQUIP_CODE
              ├─ WORKER_NO
              └─ REMARK

EQUIP_MASTERS (PK: EQUIP_CODE, COMPANY, PLANT_CD)
   └─ 참조: MOUNTED_EQUIP_ID
```

## ① 메인 그리드 — CONSUMABLE_MASTERS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 소모품 코드 | `CONSUMABLE_CODE` | PK. 다른 소모품 흐름의 참조 키. |
| 소모품명 | `NAME` | 표시명(엔티티 속성명 `consumableName`). |
| 분류 | `CATEGORY` | 공통코드 `CONSUMABLE_CATEGORY`(MOLD/JIG/TOOL). |
| 운영상태 | `OPER_STATUS` | `WAREHOUSE`(창고) / `MOUNTED`(장착) / `REPAIR`(수리). 화면 액션 버튼 노출 기준. |
| 장착설비 | `MOUNTED_EQUIP_ID` | `MOUNTED`일 때만 값이 있음. `WAREHOUSE`/`REPAIR` 시 null. |
| 수명상태 | `STATUS` | `NORMAL`/`WARNING`/`REPLACE`. 수명 관리 모듈에서 갱신. |
| 현재 사용횟수 | `CURRENT_COUNT` | 키오스크/타수 API로 누적. |
| 기대수명 | `EXPECTED_LIFE` | `REPLACE` 임계 기준. |
| 보관위치 | `LOCATION` | 기본 보관 장소. |
| 사용여부 | `USE_YN` | `Y`만 목록에 노출. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | `40` / `1000` 스코프. |

## ② 장착/해제 이력 — CONSUMABLE_MOUNT_LOGS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 일자 | `MOUNT_DATE` | PK(1). 장착/해제가 발생한 날짜. |
| 순번 | `SEQ` | PK(2). `SEQ_CONSUMABLE_MOUNT_LOGS.NEXTVAL`로 채번. |
| 소모품코드 | `CONSUMABLE_CODE` | FK 성격. `CONSUMABLE_MASTERS` 참조. |
| 설비코드 | `EQUIP_CODE` | 당시 장착/해제 대상 설비. |
| 동작 | `ACTION` | `MOUNT` 또는 `UNMOUNT`. |
| 작업자 | `WORKER_NO` | API 요청자 또는 dto.workerId. |
| 비고 | `REMARK` | 최대 500자. |
| CON_UID | `CON_UID` | 개별 인스턴스 추적용(선택). |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | `40` / `1000`. |

## 상태 전환 로직
1. **장착** (`POST /equipment/consumables/:id/mount`)
   - `OPER_STATUS='WAREHOUSE'`이고 `MOUNTED_EQUIP_ID`가 null이어야 함
   - `OPER_STATUS` → `MOUNTED`, `MOUNTED_EQUIP_ID` → 요청 설비
   - `CONSUMABLE_MOUNT_LOGS`에 `MOUNT` 기록
2. **해제** (`POST /equipment/consumables/:id/unmount`)
   - `OPER_STATUS='MOUNTED'`이어야 함
   - `OPER_STATUS` → `WAREHOUSE`, `MOUNTED_EQUIP_ID` → null
   - 이전 장착 설비 코드로 `UNMOUNT` 기록
3. **수리 전환** (`POST /equipment/consumables/:id/repair`)
   - 장착 중이면 먼저 `UNMOUNT` 기록을 남기고
   - `OPER_STATUS` → `REPAIR`, `MOUNTED_EQUIP_ID` → null
4. **수리 완료** (`POST /equipment/consumables/:id/complete-repair`)
   - `OPER_STATUS='REPAIR'`이어야 함
   - `OPER_STATUS` → `WAREHOUSE`
   - 이력은 남기지 않음(상태만 복귀)

> 수명 초과(`STATUS='REPLACE'`)로 인터락된 설비는 본 화면에서 해제 후 교체 처리 권장.

## 사전 설정 (마스터·공통코드)
- 공통코드: `CONSUMABLE_CATEGORY`(MOLD/JIG/TOOL), `CONSUMABLE_STATUS`(NORMAL/WARNING/REPLACE), `CONSUMABLE_OPER_STATUS`(WAREHOUSE/MOUNTED/REPAIR)
- `CONSUMABLE_MASTERS`에 관리 대상 소모품이 `USE_YN='Y'`로 등록되어 있어야 함
- `EQUIP_MASTERS`에 장착 대상 설비가 등록되어 있어야 함
- Oracle SEQUENCE: `SEQ_CONSUMABLE_MOUNT_LOGS.NEXTVAL`

## 운영 절차
1. 소모품 마스터 등록([소모품 마스터]) 및 입고([소모품 입고])로 `OPER_STATUS='WAREHOUSE'` 확보
2. 본 화면에서 대상 소모품 필터링 후 장착/해제/수리 처리
3. 필요 시 [수명현황]에서 교체 시점 모니터링
4. 수리 완료 후 본 화면에서 `수리완료`로 창고 복귀

## 권한
생산/설비 관리자(장착·해제·수리 처리). 일반 사용자는 조회 및 이력 확인.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 장착 시 "이미 설비에 장착된 금형"(409) | `OPER_STATUS='MOUNTED'` | 먼저 해제 후 재장착 |
| 해제 시 "장착 상태가 아님"(400) | `OPER_STATUS`가 WAREHOUSE/REPAIR | 상태 확인 |
| 수리완료 시 "수리 상태가 아님"(400) | `OPER_STATUS != 'REPAIR'` | 수리 전환 먼저 실행 |
| 이력 모달에 기록 없음 | `CONSUMABLE_MOUNT_LOGS` 미생성 | 장착/해제/수리 API 정상 호출 여부 확인 |
| 목록에 소모품 안 보임 | `USE_YN='N'` 또는 필터 불일치 | 마스터 사용여부·필터 확인 |
| 대상 설비 선택 불가 | `EQUIP_MASTERS` 미등록 또는 `USE_YN='N'` | 설비 마스터 활성화 |

## 데이터·연계
- 테이블: `CONSUMABLE_MASTERS`, `CONSUMABLE_MOUNT_LOGS`, `EQUIP_MASTERS`
- 연계: [소모품 마스터](`CONSUMABLE_MASTERS`), [소모품입고](`CONSUMABLE_LOGS`), [수명현황](`CURRENT_COUNT`/`EXPECTED_LIFE`), 설비마스터(`EQUIP_MASTERS`)
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
