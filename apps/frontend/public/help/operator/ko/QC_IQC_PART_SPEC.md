---
menuCode: QC_IQC_PART_SPEC
audience: operator
title: 품목별 IQC 항목관리 — 운영 가이드
summary: 품목별 IQC 검사기준(헤더/검사항목)의 전체 컬럼·DB 매핑, 검사유형·샘플방식 로직, 검사항목 풀·AQL 연계와 트러블슈팅
tags: [품질, IQC, 수입검사, 운영, 기준정보]
keywords: [IQC_PART_SPECS, IQC_PART_SPEC_ITEMS, IQC_ITEM_POOL, 검사항목, 검사유형, 샘플방식, INSPECTION_TYPE, SAMPLE_METHOD, DESTRUCTIVE, FULL, AQL, FIXED, LSL, USL, 불량등급, 검사수준, 멀티테넌시, 트러블슈팅]
related: [QC_IQC_ITEM, QC_AQL, MST_PART, QC_IQC]
---

# 품목별 IQC 항목관리 — 운영 가이드

## 시스템 목적·역할
원자재 품목별 **수입검사(IQC) 검사기준서**를 정의합니다. 헤더(시료수·파괴검사 여부)와 검사항목 N건(검사항목 풀 참조 + 규격·불량등급·샘플방식)을 한 번에 저장하며, 이 기준이 수입검사 화면의 검사표와 AQL 판정의 입력이 됩니다. 검사항목 자체의 정의는 검사항목 풀(`IQC_ITEM_POOL`)에서, 표본수·합불 임계(Ac/Re)는 AQL 정책/기준에서 공급됩니다.

## 데이터 구조
```
IQC_PART_SPECS (헤더: COMPANY+PLANT_CD+ITEM_CODE)
        │ 1:N (CASCADE)
        ▼
IQC_PART_SPEC_ITEMS (검사항목: +SEQ)
        │ (INSP_ITEM_CODE 참조, eager)
        ▼
IQC_ITEM_POOL (검사항목 풀: 이름·판정방법·단위)

ITEM_MASTERS.IQC_AQL_POLICY_CODE ──▶ AQL 정책/기준 (요약 카드·자동 표본수 산출)
```

---

## ① 검사기준 헤더 — IQC_PART_SPECS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 품목코드 | `ITEM_CODE` | PK 일부. 좌측 목록에서 선택한 원자재 품목. `/master/parts?itemType=RAW_MATERIAL`로 조회. |
| 기본 시료수 | `SAMPLE_QTY` | 항목별 고정 샘플수가 없을 때의 기본 표본 개수. 기본값 1. |
| 파괴검사 여부 | `IS_DEST` | `Y`=파괴검사 / `N`=비파괴. 표본 소모 여부 표시. |
| 사용여부 | `USE_YN` | `Y`만 검사 대상. 기본 `Y`. |
| 감사 컬럼 | `CREATED_BY`/`UPDATED_BY`/`CREATED_AT`/`UPDATED_AT` | 생성·수정 이력. `CREATED_AT`/`UPDATED_AT`은 DB DEFAULT SYSTIMESTAMP. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | PK 일부. `COMPANY='40'`, `PLANT_CD='1000'` 스코프. |

> 저장은 **헤더+항목 전체를 한 번에 POST**(`/master/iqc-part-specs`)하는 upsert 방식입니다. 항목은 매 저장 시 재구성되며, `INSP_ITEM_CODE`가 빈 행은 제외됩니다.

---

## ② 검사항목 — IQC_PART_SPEC_ITEMS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 순서 | `SEQ` | PK 일부. 저장 시 1부터 재부여. |
| 검사항목 | `INSP_ITEM_CODE` | `IQC_ITEM_POOL.INSP_ITEM_CODE` 참조(eager). 종류·단위는 풀에서 따라옴. |
| 종류 | (풀의 `judgeMethod`) | `MEASURE`(측정형)=LSL/USL 비교 / `VISUAL`(판정형)=판정기준. 본 테이블엔 저장 안 됨, 풀에서 결정. |
| 검사유형 | `INSPECTION_TYPE` | 공통코드 `IQC_ITEM_INSP_TYPE`. `AQL`/`DESTRUCTIVE`/`FULL`. **NULL=AQL로 간주**. |
| 샘플방식 | `SAMPLE_METHOD` | 공통코드 `IQC_SAMPLE_METHOD`. `AQL`(자동)/`FIXED`(고정). 검사유형이 AQL이면 `AQL`, 그 외 `FIXED`로 자동 세팅. **NULL=AQL**. |
| 샘플수 | `SAMPLE_QTY` | FIXED/DESTRUCTIVE/FULL의 고정 표본 개수(LOT당). AQL이면 NULL(자동 산출). |
| 불량등급 | `DEFECT_GRADE` | 공통코드 `DEFECT_GRADE`. `CRITICAL`/`MAJOR`/`MINOR`. AQL 판정 시 등급별 Ac/Re 적용. |
| 검사수준 | `INSPECTION_LEVEL` | 공통코드 `AQL_INSP_LEVEL`(II, S4 등). 표본 크기 결정. |
| AQL | `AQL` | 공통코드 `AQL_VALUE`(0.65/1.0/2.5 등). 합격품질한계. 작을수록 엄격. |
| 하한(LSL) | `LSL` | 측정형 허용 최소값. 미만이면 불량. NUMBER(12,4). |
| 상한(USL) | `USL` | 측정형 허용 최대값. 초과면 불량. NUMBER(12,4). |
| 판정기준 | `JUDGE_CRITERIA` | 판정형 합·불 기준 문구(최대 500자). |
| 사용여부 | `USE_YN` | `Y`만 적용. |
| 단위 | (풀의 `unit`) | 표시 전용. 풀에서 따라옴. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | PK 일부. `40` / `1000` 스코프. |

---

## 검사유형·샘플방식 로직
- **검사유형(INSPECTION_TYPE)을 바꾸면 샘플방식이 연동**됩니다. `AQL` 선택 시 `SAMPLE_METHOD='AQL'` + `SAMPLE_QTY=NULL`(자동 산출), 그 외(`DESTRUCTIVE`/`FULL`) 선택 시 `SAMPLE_METHOD='FIXED'`로 전환되어 **샘플수를 직접 입력**합니다.
- **종류(judgeMethod)는 검사항목 풀에서 결정**됩니다. `MEASURE`일 때만 LSL/USL 입력란이 열리고, `VISUAL`은 판정기준으로 관리합니다.
- AQL 요약 카드의 샘플수·Ac/Re는 이 테이블이 아니라 **품목의 AQL 정책**(`/quality/aql/resolve-iqc-items`)에서 LOT 수량 기준으로 산출되는 참고값입니다.

## 사전 설정 (마스터·공통코드)
- 공통코드: `DEFECT_GRADE`(불량등급), `AQL_INSP_LEVEL`(검사수준), `AQL_VALUE`(AQL 값), `IQC_ITEM_INSP_TYPE`(검사유형), `IQC_SAMPLE_METHOD`(샘플방식)
- 마스터: 검사항목 풀(`IQC_ITEM_POOL`, `USE_YN='Y'`), 원자재 품목(`ITEM_MASTERS` itemType=RAW_MATERIAL), 품목의 AQL 정책 연결(`ITEM_MASTERS.IQC_AQL_POLICY_CODE`)

## 운영 절차
1. [검사항목 풀]에서 항목(이름·판정방법·단위)을 먼저 등록한다.
2. 품목 선택 → 헤더(시료수·파괴여부) 설정 → 검사항목 추가(또는 템플릿 적용).
3. 항목별 검사유형·불량등급·검사수준·AQL·규격(LSL/USL 또는 판정기준) 입력 후 저장.
4. [품목마스터]에서 AQL 정책을 연결하면 요약 카드와 수입검사 자동 표본수가 채워진다.

## 권한
품질 관리자(기준 등록/수정). 일반 사용자는 조회.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 검사항목 선택 목록이 비어 있음 | 검사항목 풀 미등록 또는 `USE_YN='N'` | [검사항목 풀]에서 항목 등록·활성화 |
| 저장했는데 항목이 사라짐 | `INSP_ITEM_CODE` 미선택 행은 저장 제외 | 모든 행에 검사항목 선택 후 저장 |
| LSL/USL 입력란이 안 열림 | 항목 종류가 `VISUAL`(판정형) | 판정기준으로 입력하거나 풀에서 `MEASURE` 항목으로 교체 |
| 샘플수가 `자동`으로만 표시 | 검사유형이 `AQL` | 고정 표본이 필요하면 `DESTRUCTIVE`/`FULL`로 변경 |
| AQL 요약 카드가 전부 `-` | 품목에 AQL 정책 미연결 | [품목마스터]에서 AQL 정책 지정 |
| 다른 공장 데이터가 보임/안 보임 | `COMPANY`/`PLANT_CD` 스코프 | `40`/`1000` 스코프 확인 |

## 데이터·연계
- 테이블: `IQC_PART_SPECS`(헤더), `IQC_PART_SPEC_ITEMS`(항목, CASCADE)
- 참조: `IQC_ITEM_POOL`(검사항목 풀), `ITEM_MASTERS`(품목·AQL 정책)
- 연계: 검사항목 풀, AQL 기준관리(요약·표본수 산출), 수입검사(IQC) 검사 실행
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
