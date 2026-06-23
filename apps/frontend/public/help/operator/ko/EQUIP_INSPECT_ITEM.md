---
menuCode: EQUIP_INSPECT_ITEM
audience: operator
title: 설비별 점검항목 — 운영 가이드
summary: EQUIP_INSPECT_ITEM_POOL 테이블 전체 컬럼, 설비-항목 매핑 프로세스, QR 라벨과 트러블슈팅
tags: [설비, 점검, 매핑, 운영, 할당, QR]
keywords: [EQUIP_INSPECT_ITEM_POOL, EQUIP_INSPECT_ITEM_MASTERS, EQUIP_MASTERS, 설비점검항목매핑, 일괄등록, SORT_SEQ, QR라벨, 점검유형별탭]
related: [EQUIP_INSPECT_ITEM_MASTER]
---

# 설비별 점검항목 — 운영 가이드

## 시스템 목적·역할
`EQUIP_INSPECT_ITEM_POOL` 테이블을 통해 개별 설비(`EQUIP_MASTERS`)와 점검항목(`EQUIP_INSPECT_ITEM_MASTERS`)을 N:M 관계로 연결합니다. 동일한 점검항목이라도 설비마다 별도로 연결/해제할 수 있으며, 점검유형별 탭으로 분류하여 관리합니다. 현장에서는 QR 라벨을 부착하여 PDA로 점검 결과를 입력합니다.

## 데이터 구조
```
EQUIP_MASTERS (개별 설비)
    │
    └──▶ EQUIP_INSPECT_ITEM_POOL (PK: COMPANY + PLANT_CD + EQUIP_CODE + ITEM_CODE + INSPECT_TYPE)
              │
              ├── SORT_SEQ (표시 순서)
              └── USE_YN (연결 활성/비활성)
                    │
                    └──▶ EQUIP_INSPECT_ITEM_MASTERS (점검항목 기준정보)
                              ├── ITEM_NAME, CRITERIA, CYCLE
                              ├── ITEM_TYPE(VISUAL/MEASURE), UNIT, LSL_VALUE, USL_VALUE
                              ├── IMAGE_URL
                              └── INSPECT_TYPE (DAILY/PERIODIC/PM/WORKER)
```

---

## ① 설비-항목 매핑 — EQUIP_INSPECT_ITEM_POOL (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 설비코드 | `EQUIP_CODE` | **PK (1/5)**. 개별 설비. `EQUIP_MASTERS.EQUIP_CODE` 참조. |
| 항목코드 | `ITEM_CODE` | **PK (2/5)**. 점검항목. `EQUIP_INSPECT_ITEM_MASTERS.ITEM_CODE` 참조. |
| 점검유형 | `INSPECT_TYPE` | **PK (3/5)**. `DAILY` / `PERIODIC` / `PM` / `WORKER`. 마스터의 INSPECT_TYPE과 일치해야 함. |
| 사용여부 | `USE_YN` | `Y`(활성) / `N`(비활성). 연결은 유지하되 일시적 제외 시 사용. 기본 `Y`. |
| 표시순서 | `SORT_SEQ` | 설비 내 점검항목 표시 순서. 숫자가 작을수록 먼저 표시. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | **PK (4,5/5)**. 회사코드(`40`) / 플랜트코드(`1000`). |
| 생성자 | `CREATED_BY` | 매핑 등록자. |
| 수정자 | `UPDATED_BY` | 최종 수정자. |
| 생성일시 | `CREATED_AT` | 매핑 등록 시각. |
| 수정일시 | `UPDATED_AT` | 매핑 수정 시각. |

---

## 점검유형별 탭 구조

화면 우측 상단의 4개 탭은 각 점검유형별로 `EQUIP_INSPECT_ITEM_POOL`을 필터링합니다:

| 탭 | INSPECT_TYPE | Pool 필터 조건 |
|-----|-------------|---------------|
| 일상점검 | DAILY | `POOL.INSPECT_TYPE = 'DAILY'` |
| 정기점검 | PERIODIC | `POOL.INSPECT_TYPE = 'PERIODIC'` |
| 예방보전 | PM | `POOL.INSPECT_TYPE = 'PM'` |
| 작업자점검 | WORKER | `POOL.INSPECT_TYPE = 'WORKER'` |

탭 전환 시마다 선택한 설비 + 점검유형으로 API 재조회합니다:
`GET /master/equip-inspect-items?equipCode={code}&inspectType={type}`

---

## 항목 추가(매핑) 프로세스

1. `InspectItemSelectPanel` 드로어에서 `GET /master/equip-inspect-item-masters?useYn=Y&inspectType={type}` 호출
2. 마스터 목록을 체크박스로 표시(이미 매핑된 항목은 비활성화 + "등록됨" 표시)
3. 선택한 항목들을 순차적으로 `POST /master/equip-inspect-items` 호출
4. 각 POST의 body: `{ equipCode, itemCode, inspectType }`

---

## QR 라벨 발행

`InspectItemLabelModal`에서 `react-qr-code`로 `itemCode`를 QR 인코딩하여 라벨 출력:
- 라벨 크기: 60mm × 55mm (인쇄 CSS)
- 구성: 헤더("설비 점검항목") + QR 코드(128px) + 항목코드 + 항목명 + 점검유형 + 주기 + 기준
- `window.print()`로 프린트 다이얼로그 호출

---

## 권한
설비 점검항목 관리 권한이 있는 사용자(설비/품질 관리자). 일반 사용자는 조회만 가능.

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| 좌측 설비 목록이 안 보임 | 설비 마스터에 데이터 없음 | 설비 등록 후 재조회 |
| 특정 점검유형 탭에 항목 없음 | 해당 유형으로 매핑된 항목이 없음 | 해당 유형 탭에서 항목 추가 |
| 항목 추가 드로어에 항목이 안 보임 | 마스터에서 `USE_YN='N'` 또는 INSPECT_TYPE 불일치 | 마스터에서 사용여부·점검유형 확인 |
| "이미 등록된 항목"으로 표시 | 동일 설비+항목+유형 조합이 Pool에 이미 존재 | 중복 매핑 불가 |
| QR 라벨 출력 안 됨 | 브라우저 팝업 차단 | 팝업 허용 후 재시도 |
| QR 라벨 크기가 맞지 않음 | 인쇄 설정이 라벼 사이즈와 다름 | 인쇄 설정에서 용지 크기·여백 조정 |

## 데이터·연계
- **테이블**: `EQUIP_INSPECT_ITEM_POOL` (매핑), `EQUIP_INSPECT_ITEM_MASTERS` (항목 기준정보), `EQUIP_MASTERS` (설비)
- **연계**: 설비점검(Equip Inspect) 결과 입력 화면, QR 라벨 발행
- **스코프**: `COMPANY='40'`, `PLANT_CD='1000'`
