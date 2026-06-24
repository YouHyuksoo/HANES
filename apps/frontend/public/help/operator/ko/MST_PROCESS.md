---
menuCode: MST_PROCESS
audience: operator
title: 공정마스터 — 운영 가이드
summary: 공정마스터(PROCESS_MASTERS)와 설비배치(PROCESS_EQUIPMENTS) 전체 컬럼의 DB 매핑, CRUD/배치 API, 공통코드 연계, 권한, 트러블슈팅
tags: [기준정보, 공정, 마스터, 운영, 설비배치]
keywords: [PROCESS_MASTERS, PROCESS_EQUIPMENTS, EQUIP_MASTERS, PROCESS_TYPE, PROCESS_CATEGORY, LINE_TYPE, EQUIP_TYPE, EQUIP_STATUS, 공정코드, 라인구분, 설비배치, 멀티테넌시, COMPANY, PLANT_CD]
related: [MST_PART]
---

# 공정마스터 — 운영 가이드

## 시스템 목적·역할
생산 공정의 기준정보를 보유하는 **마스터 테이블 `PROCESS_MASTERS`** 관리 화면입니다. 라우팅·생산실적·공정 CAPA·공정조건이 `PROCESS_CODE`로 이 마스터를 참조합니다. 추가로 **`PROCESS_EQUIPMENTS`**(공정-설비 연결 테이블)로 공정에 설비를 배치하며, 오른쪽 그리드는 이 연결을 통해 `EQUIP_MASTERS`를 조인해 표시합니다.

## 데이터 구조
```
PROCESS_MASTERS (PK: COMPANY, PLANT_CD, PROCESS_CODE)
   │
   └─ PROCESS_EQUIPMENTS (PK: COMPANY, PLANT_CD, PROCESS_CODE, EQUIP_CODE)   ── 공정⇄설비 배치(연결)
          └─ EQUIP_CODE ──▶ EQUIP_MASTERS (설비 마스터; 오른쪽 그리드 표시값 출처)
```
- `PROCESS_EQUIPMENTS`는 `ProcessMaster`·`EquipMaster`에 `onDelete: CASCADE` ManyToOne으로 연결됩니다.

## ① 공정 — PROCESS_MASTERS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 공정코드 | `PROCESS_CODE` | PK 구성(자연키). 불변 권장 — 라우팅/실적/CAPA가 이 코드로 연결. 수정 폼에서 비활성. 중복 시 409 ConflictException. |
| 공정명 | `PROCESS_NAME` | 표시명(varchar2 255). 필수. |
| 공정유형 | `PROCESS_TYPE` | 공통코드 `PROCESS_TYPE`. 필수. `processType` 인덱스 존재(필터·조회). |
| 공정 대분류 | `PROCESS_CATEGORY` | 공통코드 `PROCESS_CATEGORY`(ASSY/INSP 등). nullable. 목록 다중 필터. |
| 라인구분 | `LINE_TYPE` | 공통코드 `LINE_TYPE`. **LV=저전압 / HV=고전압 / CM=공통**. nullable, DTO에서 `IsIn(['LV','HV','CM'])` 검증. |
| 정렬순서 | `SORT_ORDER` | 목록 정렬 기준(ASC). 기본 0, `Min(0)` 정수. |
| 사용여부 | `USE_YN` | Y만 활성. `IsIn(['Y','N'])`. |
| 비고 | `REMARK` | 메모(varchar2 500). |
| 설비수 | (집계) | 화면 "설비" 컬럼. DB 컬럼 아님 — `GET /master/processes/equipment-counts`가 `PROCESS_EQUIPMENTS`를 `PROCESS_CODE`로 GROUP BY COUNT(useYn='Y')한 값. |
| 감사 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 생성/수정 이력. CREATED_AT/UPDATED_AT은 DEFAULT SYSTIMESTAMP. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | PK 구성. `40` / `1000` 스코프. |

## ② 설비배치 — PROCESS_EQUIPMENTS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| (공정) | `PROCESS_CODE` | PK 구성. 배치 대상 공정. |
| 설비코드 | `EQUIP_CODE` | PK 구성. 배치 설비. `equipCode` 인덱스 존재. |
| 사용여부 | `USE_YN` | `Y`만 유효 배치로 집계·표시. 재배치 시 기존 행 `useYn='N'`이면 `Y`로 복원(재INSERT 안 함). |
| 감사 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 생성/수정 이력. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | PK 구성. `40` / `1000` 스코프. |

## ③ 배치 설비 표시값 — EQUIP_MASTERS (오른쪽 그리드, 읽기 전용)

> 오른쪽 그리드는 `findEquipments`가 `PROCESS_EQUIPMENTS`(useYn='Y') → `relations: ['equipment']`로 `EQUIP_MASTERS`를 조인해 설비 엔티티를 반환한 것입니다. 값 편집은 설비마스터에서 합니다.

| 화면 항목 | DB 컬럼 | 역할 / 의미 |
|------|------|------|
| 설비코드 | `EQUIP_CODE` | 설비 식별 코드. |
| 설비명 | `EQUIP_NAME` | 설비명. |
| 설비유형 | `EQUIP_TYPE` | 공통코드 `EQUIP_TYPE`. nullable → 화면 `-`. |
| 모델명 | `MODEL_NAME` | nullable → `-`. |
| 제조사 | `MAKER` | nullable → `-`. |
| 라인코드 | `LINE_CODE` | nullable → `-`. |
| 상태 | `STATUS` | 공통코드 `EQUIP_STATUS`(기본 NORMAL). |
| 사용여부 | `USE_YN` | 배치 후보는 `useYn='Y'` 설비만(`GET /equipment/equips?useYn=Y`). |

## API 엔드포인트
- `GET /master/processes` — 공정 목록(페이징·search·processType·useYn 필터). 정렬: SORT_ORDER ASC, PROCESS_CODE ASC.
- `GET /master/processes/equipment-counts` — 공정별 배치 설비수(useYn='Y' GROUP BY).
- `GET /master/processes/:id` — 공정 상세.
- `POST /master/processes` — 생성(코드 중복 시 409).
- `PUT /master/processes/:id` — 수정(부분 업데이트, PROCESS_CODE 불변).
- `DELETE /master/processes/:id` — 삭제(**하드 삭제** — repository.delete). 자식 PROCESS_EQUIPMENTS는 CASCADE.
- `GET /master/processes/:id/equipments` — 배치 설비 목록.
- `POST /master/processes/:id/equipments` (body `equipCode`) — 설비 배치(미존재 설비 404, 이미 배치 409).
- `DELETE /master/processes/:id/equipments/:equipCode` — 배치 해제(하드 삭제).

## 사전 설정 (마스터·공통코드)
- 공통코드: `PROCESS_TYPE`, `PROCESS_CATEGORY`, `LINE_TYPE`(LV/HV/CM), 설비 표시용 `EQUIP_TYPE`·`EQUIP_STATUS`.
- 설비 배치 전 **설비마스터(EQUIP_MASTERS)에 설비가 등록·`USE_YN='Y'`** 상태여야 후보로 나옵니다.

## 운영 절차
1. 공통코드(`PROCESS_TYPE`/`PROCESS_CATEGORY`/`LINE_TYPE`) 선등록.
2. 공정 등록 — 코드·명·유형 필수, 생산 흐름 순서대로 `SORT_ORDER` 부여.
3. 공정 선택 후 설비 배치 — 사용 중인 설비만 셀렉트에 노출.
4. 라인 운영 구분이 필요하면 `LINE_TYPE`로 LV/HV/CM 분리.

## 권한
기준정보 관리자(공정 등록/수정/삭제, 설비 배치/해제). 일반 사용자는 조회.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 저장 시 코드 중복 오류(409) | 동일 `PROCESS_CODE` 존재 | 코드 변경(불변 키, 중복 불가) |
| 저장이 안 됨(필수 미입력) | `processCode`/`processName`/`processType` 누락 | 3개 필수값 입력 후 저장 |
| 라인구분 저장 실패 | `LINE_TYPE`이 LV/HV/CM 외 값 | LV/HV/CM 중 선택 |
| 설비 배치 시 "이미 배치된 설비"(409) | 동일 공정에 `useYn='Y'`로 이미 배치 | 중복 배치 불가(셀렉트에서 자동 제외) |
| 설비 배치 시 설비 못 찾음(404) | `EQUIP_CODE`가 EQUIP_MASTERS에 없음 | 설비마스터 등록 확인 |
| 셀렉트에 설비가 없음 | 후보 설비 `USE_YN='N'` 또는 이미 전량 배치 | 설비마스터에서 사용여부 Y 확인 |
| 공정 삭제 시 배치도 사라짐 | PROCESS_EQUIPMENTS가 CASCADE 삭제 | 정상 동작(공정 삭제는 하드 삭제) |
| 설비수 배지가 0인데 설비가 있음 | 배치 행 `USE_YN='N'`(집계는 Y만) | 재배치로 useYn='Y' 복원 |

## 데이터·연계
- 테이블: `PROCESS_MASTERS`, `PROCESS_EQUIPMENTS`(연결), `EQUIP_MASTERS`(표시 출처)
- 연계: 라우팅, 생산실적, 공정 CAPA, 공정조건 — `PROCESS_CODE` 참조
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
