---
menuCode: EQUIP_INSPECT_ITEM
audience: operator
title: 설비점검항목 — 운영 가이드
summary: 설비점검항목 마스터(Pool) + 설비별 할당(Pool) 2개 테이블의 전체 컬럼, 4가지 점검유형(일상/정기/PM/작업자), 점검항목 추가·삭제 절차, QR 라벨 출력
tags: [기준정보, 설비, 점검, 운영]
keywords: [EQUIP_INSPECT_ITEM_MASTERS, EQUIP_INSPECT_ITEM_POOL, EQUIP_CODE, ITEM_CODE, INSPECT_TYPE, DAILY, PERIODIC, PM, WORKER, ITEM_TYPE, VISUAL, MEASURE, CYCLE, 설비점검, 점검항목, 점검유형, 설비유형, 판정형, 측정형, QR라벨, 멀티테넌시]
related: [EQUIP_INSPECT_CALENDAR, EQUIP_DAILY]
---

# 설비점검항목 — 운영 가이드

## 시스템 목적·역할
설비별 점검 기준을 정의하는 **2개 테이블**을 관리합니다.

| 테이블 | 역할 | PK |
|--------|------|----|
| `EQUIP_INSPECT_ITEM_MASTERS` | 점검항목 풀 — 설비유형별 점검항목 템플릿 | `COMPANY + PLANT_CD + ITEM_CODE` |
| `EQUIP_INSPECT_ITEM_POOL` | 설비-점검항목 연결 — 특정 설비에 실제 할당된 항목 | `COMPANY + PLANT_CD + EQUIP_CODE + ITEM_CODE + INSPECT_TYPE` |

화면 좌측에서 설비 선택 → 우측 4개 탭(일상/정기/PM/작업자)별로 할당된 점검항목을 조회·추가·삭제합니다. 등록된 항목은 일상점검(`/equipment/daily-inspect`)·정기점검(`/equipment/periodic-inspect`) 화면에서 실제 점검 입력에 사용됩니다.

## 데이터 구조
```
EQUIP_INSPECT_ITEM_MASTERS (Pool: PK = COMPANY + PLANT_CD + ITEM_CODE)
   설비유형별 점검항목 템플릿 보관 (EQUIP_TYPE으로 설비유형 필터)

EQUIP_INSPECT_ITEM_POOL (할당: PK = COMPANY + PLANT_CD + EQUIP_CODE + ITEM_CODE + INSPECT_TYPE)
   ├─ EQUIP_CODE ─▶ EQUIPMENTS (설비)
   └─ ITEM_CODE ─▶ EQUIP_INSPECT_ITEM_MASTERS (점검항목 마스터)

EQUIP_INSPECT_LOGS (점검 이력 — 참조)
   점검 실행 시 EQUIP_CODE + ITEM_CODE + INSPECT_TYPE으로 Pool 연결
```

## 화면 구성
- **좌측 패널**: 설비 목록 (설비유형별 아코디언 그룹, 검색 필터 지원, `GET /equipment/equips`)
- **우측 패널**: 4개 점검유형 탭 + DataGrid로 할당된 항목 표시
  - `DAILY`(일상점검) / `PERIODIC`(정기점검) / `PM`(예방보전) / `WORKER`(작업자점검)
- **슬라이드 패널**: `점검항목 추가` 버튼 → 우측 480px 패널 열림 → 마스터에서 항목 다중 선택 → 일괄 등록

### 점검유형 (INSPECT_TYPE) 코드값

| 코드 | 화면 표시 | 설명 |
|------|-----------|------|
| `DAILY` | 설비일일점검 | 매일 실시하는 기본 점검 |
| `PERIODIC` | 정기점검 | 주기적으로 실시하는 점검 |
| `PM` | 예방보전 | 설비 예방보전 계획에 따른 점검 |
| `WORKER` | 작업자설비점검 | 작업자가 자체 수행하는 점검 |

### 주기 (CYCLE) 코드값

| 코드 | 표시 | 의미 |
|------|------|------|
| `DAILY` | 매일 | 1일 주기 |
| `WEEKLY` | 매주 | 1주 주기 |
| `MONTHLY` | 매월 | 1개월 주기 |
| `QUARTERLY` | 분기 | 3개월 주기 |
| `SEMI_ANNUAL` | 반기 | 6개월 주기 |
| `ANNUAL` | 연간 | 1년 주기 |

### 판정구분 (ITEM_TYPE) 코드값

| 코드 | 표시 | 설명 |
|------|------|------|
| `VISUAL` | 판정형 | 육안/합부 판정 (기준 문자열 비교) |
| `MEASURE` | 측정형 | 계측값 기록 (LSL/USL 범위 판정) |

---

## ① 점검항목 마스터 — EQUIP_INSPECT_ITEM_MASTERS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 항목코드 | `ITEM_CODE` | PK. 코드 직접 입력, 등록 후 불변. |
| 항목명 | `ITEM_NAME` | 표시명. 점검 화면에 그대로 노출. |
| 점검유형 | `INSPECT_TYPE` | `DAILY`/`PERIODIC`/`PM`/`WORKER`. 등록 후 변경 시 Pool의 PK도 함께 바뀌어야 함에 주의. |
| 설비유형 | `EQUIP_TYPE` | 공통코드 `EQUIP_TYPE`. 점검항목 선택 패널에서 설비유형별 필터로 사용. |
| 판정구분 | `ITEM_TYPE` | `VISUAL`(판정형) / `MEASURE`(측정형). Default `VISUAL`. |
| 판정기준 | `CRITERIA` | VISUAL 판정 기준 문자열(예: "이상 없음", "균열 없음"). MEASURE형은 기준값 + LSL/USL로 판정. |
| 주기 | `CYCLE` | `DAILY`/`WEEKLY`/`MONTHLY`/`QUARTERLY`/`SEMI_ANNUAL`/`ANNUAL`. |
| 단위 | `UNIT` | 측정 단위(mm, kgf, ℃ 등). MEASURE형에서 LSL/USL과 함께 의미. |
| 하한값 | `LSL_VALUE` | 측정 허용 하한값. MEASURE형에서 USL과 함께 범위 판정에 사용. |
| 상한값 | `USL_VALUE` | 측정 허용 상한값. MEASURE형에서 LSL과 함께 범위 판정에 사용. |
| 작업자QR코드 | `WORKER_QR_CODE` | 작업자점검(WORKER)에서 QR 스캔 시 매칭되는 코드값. |
| 사진 | `IMAGE_URL` | 점검항목 사진. 업로드 시 `/uploads/equip-inspect-items/`에 저장. 5MB 제한, jpeg/png/gif/webp. |
| 사용여부 | `USE_YN` | `Y`만 Pool 선택 목록에 표시. |
| 비고 | `REMARK` | 메모. |
| 감사 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 생성/수정 이력. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | PK 일부. `40` / `1000` 스코프. |

## ② 설비-점검항목 할당 — EQUIP_INSPECT_ITEM_POOL (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 설비코드 | `EQUIP_CODE` | PK. `EQUIPMENTS.EQUIP_CODE` 참조. 좌측 설비 목록에서 선택. |
| 항목코드 | `ITEM_CODE` | PK. `EQUIP_INSPECT_ITEM_MASTERS.ITEM_CODE` 참조. |
| 점검유형 | `INSPECT_TYPE` | PK. `DAILY`/`PERIODIC`/`PM`/`WORKER`. 탭별로 분류. |
| 표시순서 | `SORT_SEQ` | 정렬 순서(ASC). 숫자가 작을수록 먼저 표시. |
| 사용여부 | `USE_YN` | `Y`만 점검 화면에서 활성. |
| 감사 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 생성/수정 이력. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | PK 일부. `40` / `1000` 스코프. |

> Pool은 5중 복합키(PK: COMPANY + PLANT_CD + EQUIP_CODE + ITEM_CODE + INSPECT_TYPE)로 중복 등록 시 409 Conflict. 동일 설비에 같은 항목을 다른 점검유형으로는 별도 등록 가능(예: DAILY + PERIODIC 동시 등록).

## 점검항목 등록 절차

1. **마스터 등록**(선행): 점검항목 풀에 항목코드·명·유형·기준 등록 (`POST /master/equip-inspect-item-masters`)
2. **설비 선택**: 좌측 설비 목록에서 대상 설비 클릭 (설비유형별 그룹화, 검색 가능)
3. **탭 전환**: 등록할 점검유형 탭(DAILY/PERIODIC/PM/WORKER) 선택
4. **항목 추가**: `점검항목 추가` 버튼 → 우측 패널에서 항목 다중 선택 → `일괄등록`
5. **순서 조정**: `SORT_SEQ` 값으로 표시 순서 제어(화면 수정 필요시 DTO 전달)
6. **QR 라벨 출력**: 점검항목의 QR 코드 라벨 출력 가능 (`InspectItemLabelModal` — 60mm x 55mm)

> 설비에 이미 등록된 항목은 추가 패널에서 `등록됨` 배지 + 비활성 처리되어 중복 선택 방지.

## 사전 설정 (마스터·공통코드)
- 공통코드: `EQUIP_TYPE`(설비유형)
- 설비 마스터(`EQUIPMENTS`): 좌측 설비 목록의 데이터 원천. 설비가 먼저 등록되어야 화면에 표시됨.
- 점검항목 마스터(`EQUIP_INSPECT_ITEM_MASTERS`): Pool 할당 전에 먼저 등록 필요.

## 운영 절차
1. 점검항목 마스터에 점검항목을 등록한다(항목코드·명·유형·기준).
2. 설비별 점검항목 화면에서 설비를 선택하고, 유형별 탭에서 필요한 항목을 Pool에 추가한다.
3. 설비 운영 중 점검항목이 바뀌면 Pool에 추가/삭제로 반영한다.
4. 단종된 점검항목은 Pool에서 삭제하거나 `USE_YN='N'`으로 비활성한다(이력 보존 시 비활성 권장).

## 권한
기준정보 관리자(마스터 등록/수정/삭제, Pool 할당/해제). 일반 사용자는 조회.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 좌측 설비 목록이 비어 있음 | `EQUIPMENTS`에 설비 미등록 | 설비 마스터에 먼저 설비 등록 |
| 점검항목 추가 패널에 항목 없음 | 마스터에 해당 점검유형의 항목 미등록 | 마스터 화면(`/master/equip-inspect-item`)에서 항목 등록 |
| 설비유형 드롭다운에 값 안 나옴 | 공통코드 `EQUIP_TYPE` 미설정 | 공통코드에 설비유형 코드 등록 |
| Pool 저장 시 409 오류 | 동일 (설비+항목+유형) 조합 이미 존재 | 중복 확인 후 다른 유형으로 등록 또는 기존 항목 활성화 |
| 점검 화면에서 항목 안 보임 | Pool의 `USE_YN='N'` 또는 점검유형 불일치 | Pool 사용여부·점검유형 확인 |
| 사진 업로드 실패 | 파일 5MB 초과 또는 형식不符(jpeg/png/gif/webp 외) | 파일 크기·형식 확인 |
| Pool의 `SORT_SEQ` 미반영 | 등록 시 `sortSeq` 미전달 | 등록 DTO에 sortSeq 포함 또는 별도 수정 요청 |

## 데이터·연계
- 테이블: `EQUIP_INSPECT_ITEM_MASTERS`, `EQUIP_INSPECT_ITEM_POOL`, `EQUIP_INSPECT_LOGS`
- 연계: 설비 마스터(`EQUIPMENTS`), 일상점검(`/equipment/daily-inspect`), 정기점검(`/equipment/periodic-inspect`), 점검 캘린더(`/equipment/inspect-calendar`), 점검 이력(`/equipment/inspect-history`)
- 관련 API: `GET /master/equip-inspect-items`, `POST /master/equip-inspect-items`, `DELETE /master/equip-inspect-items/:equipCode/:itemCode/:inspectType`
- 관련 API (마스터): `GET /master/equip-inspect-item-masters`, `POST /master/equip-inspect-item-masters`, `PUT /master/equip-inspect-item-masters/:itemCode`, `DELETE /master/equip-inspect-item-masters/:itemCode`
- 이미지 저장: `./uploads/equip-inspect-items/` (5MB, jpeg/png/gif/webp)
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
