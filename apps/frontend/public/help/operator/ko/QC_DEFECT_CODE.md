---
menuCode: QC_DEFECT_CODE
audience: operator
title: 불량코드관리 — 운영 가이드
summary: 불량 3레벨 분류(검사단계/모델구분/불량유형)와 불량코드 마스터의 전체 컬럼·DB 매핑, 모델구분 공통코드 연계, 등급/적용범위 코드값, 운영절차와 트러블슈팅
tags: [품질, 불량코드, 운영, 마스터, 설정]
keywords: [DEFECT_CODE_MASTERS, DEFECT_CATEGORY_MASTERS, DEFECT_CODE_PRODUCT_TYPES, DEFECT_MODEL_GROUP, DEFECT_LOGS, 불량등급, defectGrade, CRITICAL, MAJOR, MINOR, 적용범위, defectScope, RAW_MATERIAL, PRODUCT, PROCESS, COMMON, 검사단계, IQC, LQC, OQC, 모델구분, LV, HV, 저전압, 고전압, 불량유형, 3레벨, 계층, COMPANY, PLANT_CD, 트러블슈팅]
related: [QC_DEFECT, QC_AQL, MST_PART]
---

# 불량코드관리 — 운영 가이드

## 시스템 목적·역할
불량코드 마스터는 검사(수입/공정/출하)와 생산실적 불량 등록에서 선택하는 **불량코드의 단일 출처**입니다. 불량코드는 **3레벨 분류 체계**(1레벨 검사단계 → 2레벨 모델구분 → 3레벨 불량유형) 아래의 3레벨에만 연결되며, 각 코드는 **불량등급**과 **적용범위**, **모델구분 적용 목록**을 가집니다. 불량이력(`DEFECT_LOGS.DEFECT_CODE`)이 이 코드를 참조합니다.

## 데이터 구조 (3계층 + 모델 매핑)
```
DEFECT_CATEGORY_MASTERS (자기참조 트리, LEVEL_NO 1→2→3)
  1레벨 검사단계: IQC / LQC / OQC
    2레벨 모델구분: {단계}_LV / {단계}_HV         (예: IQC_LV)
      3레벨 불량유형: {2레벨}_FUNCTION / _APPEARANCE / _ETC   (예: IQC_LV_FUNCTION)
                              │ (CATEGORY_CODE, 3레벨만 연결)
                              ▼
DEFECT_CODE_MASTERS ──(DEFECT_CODE)──▶ DEFECT_CODE_PRODUCT_TYPES (모델구분별 적용, 1:N)
                                              │ PRODUCT_TYPE = DEFECT_MODEL_GROUP 코드(LV/HV)
DEFECT_LOGS.DEFECT_CODE ──(참조)──▶ DEFECT_CODE_MASTERS.DEFECT_CODE
```
- 2레벨 코드는 `{1레벨}_{모델구분}` 규칙입니다(예: `IQC_LV`). 화면은 2레벨 코드에서 접두사(`IQC_`)를 떼어 모델구분(`LV`)을 산출하고, 저장 시 그 값을 `DEFECT_CODE_PRODUCT_TYPES.PRODUCT_TYPE`에 1건 기록합니다.

---

## ① 불량 분류 — DEFECT_CATEGORY_MASTERS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 분류코드 | `CATEGORY_CODE` | PK. 자기참조 트리의 노드 키. 명명 규칙: 1레벨 `IQC`, 2레벨 `IQC_LV`, 3레벨 `IQC_LV_FUNCTION`. 대문자. |
| 분류명 | `CATEGORY_NAME` | 표시용 명칭(예: `IQC`, `저전압`, `기능`). |
| 분류 레벨 | `LEVEL_NO` | `1`=검사단계, `2`=모델구분, `3`=불량유형. 불량코드는 3레벨에만 연결 가능. |
| 상위 분류 | `PARENT_CATEGORY_CODE` | 부모 노드(self FK `FK_DEFECT_CATEGORY_PARENT`). 1레벨은 NULL. 부모 레벨은 반드시 `현재-1`이어야 함(서버 검증). |
| 정렬순서 | `SORT_ORDER` | 트리 표시 순서. |
| 사용여부 | `USE_YN` | `Y`만 선택지에 노출·연결 가능. 폐기 분류는 `N`(소프트 비활성). |
| 설명 | `DESCRIPTION` | 메모. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | PK 일부. 정본 스코프 `COMPANY='40'`, `PLANT_CD='1000'`. |
| (감사) | `CREATED_BY` / `UPDATED_BY` / `CREATED_AT` / `UPDATED_AT` | 등록·수정자/시각. |

조회 API `GET /quality/defect-codes/categories`는 평면 행을 트리로 조립해 반환합니다.

---

## ② 불량코드 — DEFECT_CODE_MASTERS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 불량코드 | `DEFECT_CODE` | PK. `DEFECT_LOGS`가 참조하는 키. 등록 후 변경 불가(화면에서 잠금). 대문자 정규화. |
| 불량명 | `DEFECT_NAME` | 표시용 명칭. 필수. |
| (3레벨)분류 | `CATEGORY_CODE` | 연결된 3레벨 분류 코드. 서버가 **`LEVEL_NO=3` 이고 `USE_YN='Y'`** 인지 검증(`assertLeafCategory`). 화면 목록의 1·2·3레벨은 이 코드에서 부모를 거슬러 산출. |
| 등급 | `DEFECT_GRADE` | `CRITICAL`=치명(안전·핵심기능), `MAJOR`=중결함, `MINOR`=경결함. 기본 `MAJOR`. 검사 합·불·통계 기준. |
| 적용범위 | `DEFECT_SCOPE` | `COMMON`=공통, `RAW_MATERIAL`=원자재, `PRODUCT`=제품, `PROCESS`=공정. 기본 `COMMON`. `findOptions`에서 `defectScope` 필터 시 해당 범위 + `COMMON`을 함께 노출. |
| 사용여부 | `USE_YN` | `Y`만 옵션/검사 노출. 사용중지(`DELETE` API)는 `USE_YN='N'` 소프트 비활성. |
| 설명 | `DESCRIPTION` | 메모(최대 500자). |
| 정렬순서 | `SORT_ORDER` | 목록/옵션 정렬 키(ASC, 이후 코드순). |
| (모델구분 적용) | — (별도 테이블) | 화면 2레벨 선택값에서 산출한 모델구분(LV/HV)을 `DEFECT_CODE_PRODUCT_TYPES`에 저장. 본 테이블에는 컬럼 없음. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | PK 일부. `40` / `1000` 스코프. |
| (감사) | `CREATED_BY` / `UPDATED_BY` / `CREATED_AT` / `UPDATED_AT` | 등록·수정자/시각. |

---

## ③ 모델구분 적용 매핑 — DEFECT_CODE_PRODUCT_TYPES (전체 컬럼)

불량코드 1건에 적용 모델구분 N건을 매핑합니다(현재 화면은 2레벨에서 산출한 1건을 저장).

| DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|
| `COMPANY`, `PLANT_CD`, `DEFECT_CODE`, `PRODUCT_TYPE` | 복합 PK. `PRODUCT_TYPE`은 공통코드 `DEFECT_MODEL_GROUP`의 DETAIL_CODE(`LV`=저전압, `HV`=고전압). |
| `CREATED_BY`, `CREATED_AT` | 등록자/시각. |

저장 로직(`replaceProductTypes`): 해당 불량코드의 기존 매핑을 전부 삭제 후 다시 INSERT(전량 교체). 화면은 2레벨 코드에서 모델구분 1건을 산출해 넣습니다.

---

## 코드값 정리 (선택지·공통코드)

| 구분 | 값 | 의미 |
|------|------|------|
| 등급 `DEFECT_GRADE` | CRITICAL / MAJOR / MINOR | 치명 / 중 / 경 |
| 적용범위 `DEFECT_SCOPE` | COMMON / RAW_MATERIAL / PRODUCT / PROCESS | 공통 / 원자재 / 제품 / 공정 |
| 모델구분 `DEFECT_MODEL_GROUP`(공통코드) | LV / HV | 저전압 / 고전압 |
| 검사단계(1레벨 분류) | IQC / LQC / OQC | 수입검사 / 공정검사 / 출하검사 |
| 불량유형(3레벨 분류) | FUNCTION / APPEARANCE / ETC | 기능 / 외관 / 기타 |

> 등급·적용범위는 화면 enum(서버 DTO `IsIn`)으로 고정됩니다. 모델구분만 공통코드(`DEFECT_MODEL_GROUP`)로 확장 가능합니다.

## 사전 설정 (마스터·공통코드)
- 공통코드 `DEFECT_MODEL_GROUP`(LV/HV) 등록 — 2레벨 분류·모델구분 매핑의 기준.
- 분류 트리: 1레벨(IQC/LQC/OQC) → 2레벨(`{단계}_LV`/`{단계}_HV`) → 3레벨(`{2레벨}_FUNCTION`/`_APPEARANCE`/`_ETC`)을 먼저 구성.
- 사용여부 `USE_YN` 공통코드(화면 사용여부 셀렉트).

## 운영 절차
1. `DEFECT_MODEL_GROUP` 공통코드(LV/HV) 확인·등록.
2. 분류 빠른 추가로 1→2→3레벨 분류 트리 구성(레벨이 한 단계씩 맞아야 저장됨).
3. 불량코드 등록: 1·2·3레벨 선택 + 불량코드·불량명·등급·적용범위 입력. 2레벨 선택값이 모델구분 매핑으로 저장됨.
4. [불량관리]·검사·생산실적 키오스크에서 코드가 노출되는지 확인.
5. 폐기 코드는 사용중지(`USE_YN='N'`)로 전환(삭제 금지).

## 권한
품질 관리자(분류·코드 등록/수정/사용중지). 일반 사용자는 검사·실적에서 조회·선택만.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 저장 시 "3레벨 분류를 입력하세요" | 1·2·3레벨 중 미선택 | 1→2→3 순서로 모두 선택 |
| "불량코드는 3레벨 분류에만 연결할 수 있습니다" | 1·2레벨 코드를 분류로 지정 | 3레벨(불량유형) 분류 선택 |
| "사용중인 불량 분류만 연결할 수 있습니다" | 대상 3레벨 분류 `USE_YN='N'` | 분류를 `Y`로 활성화 |
| 2레벨 선택지가 안 보임 | 1레벨 미선택 또는 하위 2레벨 없음/비활성 | 1레벨 먼저 선택, 2레벨 분류 등록·활성화 |
| 검사/실적에서 불량코드 안 보임 | 코드 `USE_YN='N'` 또는 적용범위·모델 불일치 | 코드 활성화, `DEFECT_SCOPE`·모델구분 확인 |
| "이미 존재하는 불량코드입니다" | 동일 코드 중복 등록 | 다른 코드 사용(코드는 테넌트 내 유일) |
| 모델구분 매핑이 비어 있음 | 2레벨이 `{단계}_{모델}` 규칙 아님 | 2레벨 코드를 `IQC_LV` 형식으로 정비 |

## 데이터·연계
- 테이블: `DEFECT_CATEGORY_MASTERS`(분류 트리), `DEFECT_CODE_MASTERS`(코드), `DEFECT_CODE_PRODUCT_TYPES`(모델구분 매핑).
- API: `GET/POST /quality/defect-codes/categories`, `PUT .../categories/:categoryCode`, `GET /quality/defect-codes`, `GET /quality/defect-codes/options`, `POST /quality/defect-codes`, `PUT/DELETE /quality/defect-codes/:defectCode`.
- 연계: 불량이력(`DEFECT_LOGS.DEFECT_CODE`), 불량관리(`/quality/defect`), 통합검사(`/inspection/integrated`), 생산실적 키오스크 불량입력.
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`(모든 테이블 PK에 포함).
