---
menuCode: EQUIP_INSPECT_ITEM_MASTER
audience: operator
title: 점검항목 마스터 — 운영 가이드
summary: EQUIP_INSPECT_ITEM_MASTERS 테이블 전체 컬럼, 점검항목 속성, 이미지 업로드 구조와 트러블슈팅
tags: [설비, 점검, 항목, 마스터, 운영, 기준정보]
keywords: [EQUIP_INSPECT_ITEM_MASTERS, ITEM_CODE, INSPECT_TYPE, ITEM_TYPE, VISUAL, MEASURE, LSL_VALUE, USL_VALUE, CYCLE, IMAGE_URL, WORKER_QR_CODE, 설비점검, EQUIP_TYPE, COM_CODES]
related: [EQUIP_INSPECT_ITEM]
---

# 점검항목 마스터 — 운영 가이드

## 시스템 목적·역할
설비 점검에 사용할 모든 점검항목의 기준정보를 `EQUIP_INSPECT_ITEM_MASTERS` 테이블에 저장·관리합니다. 각 점검항목은 점검유형(DAILY/PERIODIC/PM/WORKER), 판정구분(VISUAL/MEASURE), 주기, 판정기준(LSL/USL) 등의 속성을 가지며, [설비별 점검항목] 화면에서 `EQUIP_INSPECT_ITEM_POOL`을 통해 개별 설비와 N:M 관계로 연결됩니다.

## 데이터 구조
```
EQUIP_INSPECT_ITEM_MASTERS (PK: COMPANY + PLANT_CD + ITEM_CODE)
    │
    ├── 점검유형(INSPECT_TYPE): DAILY / PERIODIC / PM / WORKER
    ├── 판정구분(ITEM_TYPE): VISUAL(판정형) / MEASURE(측정형)
    ├── 주기(CYCLE): DAILY / WEEKLY / MONTHLY / QUARTERLY / SEMI_ANNUAL / ANNUAL
    ├── 판정기준: CRITERIA(텍스트) 또는 LSL_VALUE + USL_VALUE + UNIT
    │
    └──▶ EQUIP_INSPECT_ITEM_POOL (N:M 매핑)
            └── EQUIP_MASTERS (개별 설비)
```

---

## ① 점검항목 마스터 — EQUIP_INSPECT_ITEM_MASTERS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 항목코드 | `ITEM_CODE` | **PK (3/3)**. 점검항목 식별자. 등록 후 변경 불가(매핑 유지). 명명규칙 권장: `EI-{설비유형}-{NNN}`. |
| 점검항목명 | `ITEM_NAME` | 점검 항목의 표시 이름. `varchar2(200)`. |
| 점검유형 | `INSPECT_TYPE` | `DAILY`(일상점검) / `PERIODIC`(정기점검) / `PM`(예방보전) / `WORKER`(작업자점검). 설비별 매핑 시 동일 유형끼리만 연결 가능. |
| 설비유형 | `EQUIP_TYPE` | 공통코드 `EQUIP_TYPE` 값 참조. 이 항목이 적용될 설비 유형 범위 지정. |
| 판정구분 | `ITEM_TYPE` | `VISUAL`(판정형) = OK/NG 정성판단 / `MEASURE`(측정형) = 수치 측정 후 LSL~USL 범위 판정. 기본값 `VISUAL`. |
| 판정기준 | `CRITERIA` | VISUAL형: OK/NG 판단 가이드 텍스트. / MEASURE형: 보조 설명(수치 기준은 LSL/USL 사용). |
| 주기 | `CYCLE` | 점검 수행 주기. `DAILY` / `WEEKLY` / `MONTHLY` / `QUARTERLY` / `SEMI_ANNUAL` / `ANNUAL`. |
| 단위 | `UNIT` | 측정형(MEASURE)일 때 측정값의 단위. 공통코드 또는 자유입력. |
| 하한값 | `LSL_VALUE` | 측정형의 허용 하한값(Lower Spec Limit). |
| 상한값 | `USL_VALUE` | 측정형의 허용 상한값(Upper Spec Limit). |
| 작업자QR코드 | `WORKER_QR_CODE` | 작업자점검(WORKER)용 QR 코드 값. |
| 사진URL | `IMAGE_URL` | 점검 참조 이미지의 서버 경로 또는 URL. `varchar2(500)`. |
| 사용여부 | `USE_YN` | `Y`(활성) / `N`(비활성). `N`이면 설비 매핑 시 선택 불가. 기본 `Y`. |
| 비고 | `REMARK` | 관리 메모. `varchar2(500)`. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | **PK (1,2/3)**. 회사코드(`40`) / 플랜트코드(`1000`) 스코프. |
| 생성자 | `CREATED_BY` | 최초 등록자. |
| 수정자 | `UPDATED_BY` | 최종 수정자. |
| 생성일시 | `CREATED_AT` | 레코드 생성 시각. |
| 수정일시 | `UPDATED_AT` | 레코드 수정 시각. |

---

## 이미지 업로드 구조

| 항목 | 상세 |
|------|------|
| 업로드 API | `POST /master/equip-inspect-item-masters/{itemCode}/image` (multipart) |
| 삭제 API | `DELETE /master/equip-inspect-item-masters/{itemCode}/image` |
| 허용 형식 | `image/jpeg`, `image/png`, `image/gif`, `image/webp` |
| 최대 크기 | 5MB |
| 저장 위치 | 서버 `./uploads/equip-inspect-items/` 디렉토리 |

---

## 점검유형 상세

| 유형 | 코드 | 설명 | 주기 예 |
|------|------|------|---------|
| 일상점검 | DAILY | 매일 작업 시작 전 기본 상태 확인 | DAILY |
| 정기점검 | PERIODIC | 월/분기/반기/연 단위 정기 점검 | MONTHLY ~ ANNUAL |
| 예방보전 | PM | 설비 예방보전(Prescriptive Maintenance) 시 점검 | MONTHLY ~ ANNUAL |
| 작업자점검 | WORKER | 작업자가 자체 수행하는 점검(QR 기반 가능) | DAILY ~ MONTHLY |

## 판정기준 입력 방식

| 판정구분 | 입력 필드 | 저장 |
|---------|----------|------|
| VISUAL(판정형) | criteria 텍스트 입력 | `CRITERIA` 컬럼에 저장 |
| MEASURE(측정형) | 단위(UNIT) + 하한(LSL) + 상한(USL) | `UNIT`, `LSL_VALUE`, `USL_VALUE` 저장, `CRITERIA`는 보조설명 |

## 권한
마스터 데이터 관리 권한이 있는 사용자(설비/품질 관리자). 일반 사용자는 조회만 가능.

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| 항목코드 중복 오류 | 동일 PK(COMPANY+PLANT_CD+ITEM_CODE) 존재 | 다른 코드로 등록 |
| 사진 업로드 실패 | 5MB 초과 또는 지원하지 않는 형식 | 파일 크기·형식 확인 |
| 측정형인데 기준값이 안 보임 | LSL/USL 미입력 | 측정형은 하한·상한 필수 |
| 설비 매핑 시 항목이 안 보임 | 항목의 `USE_YN='N'` 또는 EQUIP_TYPE 불일치 | 사용여부와 설비유형 확인 |
| 작업자점검 QR 코드 미작동 | WORKER_QR_CODE 미설정 | QR 코드 값 입력 후 QR 라벨 재발행 |

## 데이터·연계
- **테이블**: `EQUIP_INSPECT_ITEM_MASTERS` (기준정보), `EQUIP_INSPECT_ITEM_POOL` (설비-항목 매핑), `EQUIP_INSPECT_LOGS` (점검 결과)
- **연계**: 설비마스터(`EQUIP_MASTERS`), 공통코드(`COM_CODES.EQUIP_TYPE`)
- **스코프**: `COMPANY='40'`, `PLANT_CD='1000'`
