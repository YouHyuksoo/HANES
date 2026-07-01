---
menuCode: QC_AQL
audience: operator
title: AQL 기준관리 — 운영 가이드
summary: IQC 자동 LOT 판정에 쓰이는 AQL 표준 체계(정책·기준·Code Letter·Sampling Plan) DB 구조, API, 판정 로직 전체 정리
tags: [품질, IQC, AQL, 수입검사, 샘플링, ISO2859, 운영]
keywords: [IQC_AQL_POLICIES, AQL_STANDARDS, AQL_CODE_LETTER_RULES, AQL_CODE_LETTER_SAMPLES, AQL_ACCEPTANCE_RULES, resolveIqcPolicy, resolveIsoRule, Code Letter, IMMEDIATE_FAIL, criticalMode, inspectionMode, NORMAL, TIGHTENED, REDUCED, majorAqlCode, minorAqlCode, inspectionLevel, sampleCodeLetter, acceptQty, rejectQty]
related: [QC_IQC, QC_IQC_PART_SPEC, MST_PART]
---

# AQL 기준관리 — 운영 가이드

## 시스템 목적·역할

수입검사(IQC)에서 LOT의 합격/불합격을 **자동 판정**하는 데 필요한 모든 기준을 관리합니다.

ISO 2859-1 샘플링 체계를 DB에 내장(5개 테이블)하고, IQC 판정 시 아래 순서로 Ac/Re를 결정합니다.

```
품목마스터 (ITEM_MASTERS.IQC_AQL_POLICY_CODE)
  └─▶ IQC_AQL_POLICIES (정책: Major/Minor 기준 조합)
           │
   ┌───────┴───────┐
   ▼               ▼
AQL_STANDARDS    AQL_STANDARDS   ← Major/Minor AQL 기준
(majorAqlCode)  (minorAqlCode)
       │
       ▼
AQL_CODE_LETTER_RULES            ← LOT크기 + 검사수준 → Code Letter
       │
       ▼
AQL_ACCEPTANCE_RULES             ← Code Letter + AQL값 + 검사Mode → Ac/Re
```

`criticalMode` 는 항상 `IMMEDIATE_FAIL` 고정 — Critical 불량 1건 이상이면 Ac/Re에 관계없이 즉시 LOT FAIL.

---

## 데이터 구조

### 5개 DB 테이블 개요

| 테이블 | 역할 |
|------|------|
| `IQC_AQL_POLICIES` | 품목에 연결되는 정책(Major+Minor 기준 묶음) |
| `AQL_STANDARDS` | AQL 기준 헤더(코드·명칭·AQL 값) |
| `AQL_CODE_LETTER_RULES` | ISO Table I — LOT 크기 × 검사수준 → Code Letter |
| `AQL_CODE_LETTER_SAMPLES` | Code Letter별 표준 샘플수 |
| `AQL_ACCEPTANCE_RULES` | ISO Table II-A — Code Letter × AQL값 × 검사Mode → sampleCodeLetter·Ac·Re |

---

## ① AQL 정책 — IQC_AQL_POLICIES (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 정책 코드 | `POLICY_CODE` VARCHAR2(50) PK | 품목마스터 `IQC_AQL_POLICY_CODE`가 참조. 등록 후 변경 불가. |
| 정책명 | `POLICY_NAME` VARCHAR2(200) | 표시용 이름. 필수. |
| 검사수준 | `INSPECTION_LEVEL` VARCHAR2(20) | I/II/III/S1~S4. NULL 허용(미설정 시 `'II'`로 폴백). |
| Major AQL | `MAJOR_AQL_CODE` VARCHAR2(50) FK→AQL_STANDARDS | Major 불량에 적용할 AQL 기준 코드. NULL 허용. |
| Minor AQL | `MINOR_AQL_CODE` VARCHAR2(50) FK→AQL_STANDARDS | Minor 불량에 적용할 AQL 기준 코드. NULL 허용. |
| Critical 모드 | `CRITICAL_MODE` VARCHAR2(50) | 항상 `'IMMEDIATE_FAIL'` 고정(서버에서 주입). 화면에 노출 안 됨. |
| 사용여부 | `USE_YN` VARCHAR2(1) | Y=활성, N=비활성. 기본 Y. |
| 비고 | `REMARK` VARCHAR2(500) | |
| — | `COMPANY` VARCHAR2(50) PK | 멀티테넌시 |
| — | `PLANT_CD` VARCHAR2(50) PK | 멀티테넌시 |
| 등록자 | `CREATED_BY` VARCHAR2(50) | |
| 수정자 | `UPDATED_BY` VARCHAR2(50) | |
| — | `CREATED_AT` TIMESTAMP DEFAULT SYSTIMESTAMP | |
| — | `UPDATED_AT` TIMESTAMP DEFAULT SYSTIMESTAMP | |

> `CRITICAL_MODE='IMMEDIATE_FAIL'`은 정책 생성 시 서버가 자동 설정합니다. 화면 폼에는 노출되지 않으며 API save payload에도 포함되지 않습니다. 직접 변경하려면 DB DML로만 가능합니다.

---

## ② AQL 기준 — AQL_STANDARDS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| AQL 코드 | `AQL_CODE` VARCHAR2(50) PK | 정책의 MAJOR_AQL_CODE·MINOR_AQL_CODE가 참조. |
| AQL 명칭 | `AQL_NAME` VARCHAR2(200) | 필수. |
| 검사수준 | `INSPECTION_LEVEL` VARCHAR2(20) | I/II/III/S1~S4. NULL 허용. |
| AQL 값 | `AQL_VALUE` NUMBER | ISO 표준값. resolveIsoRule에서 Code Letter 표 조회 시 사용. |
| 사용여부 | `USE_YN` VARCHAR2(1) | N이면 정책 Major/Minor 목록에 미노출. |
| 비고 | `REMARK` VARCHAR2(500) | |
| — | `COMPANY`, `PLANT_CD` PK | |
| — | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | |

---

## ③ Code Letter 표 — AQL_CODE_LETTER_RULES (전체 컬럼)

ISO 2859-1 Table I 데이터. 사전 시드로 입력된 표준 데이터입니다.

| 화면 항목 | DB 컬럼 | 역할 / 의미 |
|------|------|------|
| 검사수준 | `INSPECTION_LEVEL` VARCHAR2(20) PK | I/II/III/S1/S2/S3/S4 |
| LOT 최솟값 | `LOT_QTY_FROM` NUMBER PK | LOT 크기 범위 시작 |
| LOT 최댓값 | `LOT_QTY_TO` NUMBER | LOT 크기 범위 끝 |
| Code Letter | `CODE_LETTER` VARCHAR2(5) | 결정된 시료 코드문자(A~R) |
| 정렬 순서 | `SORT_ORDER` NUMBER | |
| — | `COMPANY`, `PLANT_CD` PK | |

서비스 내부 조회 SQL:
```sql
SELECT CODE_LETTER
  FROM AQL_CODE_LETTER_RULES
 WHERE COMPANY = :company
   AND PLANT_CD = :plant
   AND INSPECTION_LEVEL = :inspectionLevel
   AND LOT_QTY_FROM <= :lotQty
   AND LOT_QTY_TO   >= :lotQty
```

---

## ④ Code Letter 샘플수 — AQL_CODE_LETTER_SAMPLES (전체 컬럼)

Code Letter별 ISO 표준 샘플수 참조표.

| DB 컬럼 | 역할 |
|------|------|
| `CODE_LETTER` VARCHAR2(5) PK | A~R |
| `SAMPLE_SIZE` NUMBER | ISO 표준 샘플수(2/3/5/8/13/20/32/50/80/125/200/315/500) |
| `COMPANY`, `PLANT_CD` PK | |
| `SORT_ORDER` | |

---

## ⑤ Sampling Plan 표 — AQL_ACCEPTANCE_RULES (전체 컬럼)

ISO 2859-1 Table II-A 데이터. 사전 시드로 입력된 표준 데이터입니다.

| 화면 항목 | DB 컬럼 | 역할 / 의미 |
|------|------|------|
| 검사 Mode | `INSPECTION_MODE` VARCHAR2(20) PK | NORMAL / TIGHTENED / REDUCED |
| Code Letter | `CODE_LETTER` VARCHAR2(5) PK | A~R |
| AQL 값 | `AQL_VALUE` NUMBER(8,3) PK | 0.065~6.5 |
| 샘플 Code Letter | `SAMPLE_CODE_LETTER` VARCHAR2(5) | 실제 사용할 Code Letter. 자신과 같으면 직접 판정, 다르면 해당 행의 Ac/Re 참조(화살표 처리) |
| 합격판정개수 | `ACCEPT_QTY` NUMBER | Ac |
| 불합격판정개수 | `REJECT_QTY` NUMBER | Re |
| — | `COMPANY`, `PLANT_CD` PK | |
| — | `SORT_ORDER`, `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | |

> **현재 IQC 자동 판정은 `INSPECTION_MODE='NORMAL'`만 조회합니다.** `findIsoTables()` 서비스도 NORMAL 필터를 기본 적용합니다. TIGHTENED/REDUCED 전환 기능은 별도 확장이 필요합니다.

sampleCodeLetter 화살표 처리 예시:
```
CODE_LETTER='H', AQL_VALUE=1.0 → SAMPLE_CODE_LETTER='G'
→ Code Letter G의 SAMPLE_SIZE(32개), ACCEPT_QTY, REJECT_QTY를 사용
→ 화면 Sampling Plan 표에 "↑G" 형식으로 표시됨
```

---

## 버튼·API·상태 전이

### 정책 관련 API

| 버튼/액션 | API | 허용 조건 | 결과 / DB 영향 |
|------|------|------|------|
| 정책 저장(신규) | `POST /quality/aql/policies` | policyCode 중복 없음, Major/Minor 기준이 useYn='Y' | IQC_AQL_POLICIES INSERT, CRITICAL_MODE='IMMEDIATE_FAIL' 자동 설정 |
| 정책 저장(수정) | `PUT /quality/aql/policies/:code` | 해당 policyCode 존재 | IQC_AQL_POLICIES UPDATE (CRITICAL_MODE 변경 없음) |
| 사용중지 | `DELETE /quality/aql/policies/:code` | ITEM_MASTERS 참조 중인 품목 없어야 함 | USE_YN='N' (물리 삭제 아님). 참조 중이면 400 |

### AQL 기준 관련 API

| 버튼/액션 | API | 허용 조건 | 결과 / DB 영향 |
|------|------|------|------|
| 저장(신규) | `POST /quality/aql` | aqlCode 중복 없음 | AQL_STANDARDS INSERT |
| 저장(수정) | `PUT /quality/aql/:code` | 해당 aqlCode 존재 | AQL_STANDARDS UPDATE |
| 사용중지 | `DELETE /quality/aql/:code` | 활성 정책(useYn='Y')에서 참조 중 아닐 것 | USE_YN='N'. 참조 중이면 400 |
| 내보내기 | 클라이언트 | — | Excel 다운로드(DB 변경 없음) |

### ISO 표 관련 API

| 액션 | API | 결과 |
|------|------|------|
| Code Letter·Sampling Plan 표 조회 | `GET /quality/aql/iso` | `{ codeLetterRules, samples, acceptanceRules }` |

> ISO 표는 화면에서 **읽기 전용**입니다. 수정은 DB DML 또는 별도 관리 기능이 필요합니다.

---

## IQC 자동 판정 로직

### resolveIqcPolicy — 품목 단일 모델 (aql.service.ts)

```
1. ITEM_MASTERS.IQC_AQL_POLICY_CODE → 정책 코드 조회
2. IQC_AQL_POLICIES에서 INSPECTION_LEVEL, MAJOR_AQL_CODE, MINOR_AQL_CODE 조회
3. PARTNER_MASTERS.INSPECTION_MODE 조회 (없으면 'NORMAL')
4. Major/Minor 각각 resolveRuleByStandardCode → resolveIsoRule 호출:
   a. AQL_CODE_LETTER_RULES: LOT 크기 + 검사수준 → CODE_LETTER 결정
   b. AQL_ACCEPTANCE_RULES: CODE_LETTER + AQL_VALUE + INSPECTION_MODE='NORMAL'
      → SAMPLE_CODE_LETTER, ACCEPT_QTY, REJECT_QTY 조회
   c. SAMPLE_CODE_LETTER ≠ CODE_LETTER이면 해당 행의 샘플수로 교체
5. 판정 우선순위:
   defectCritical > 0            → FAIL ("Critical 불량 1건 이상으로 즉시 불합격")
   defectMajor > majorRule.Ac    → FAIL ("Major 불량 N건이 Ac M 초과")
   defectMinor > minorRule.Ac    → FAIL ("Minor 불량 N건이 Ac M 초과")
   else                          → PASS
6. sampleQty = max(majorRule.sampleSize, minorRule.sampleSize) 반환
```

### resolveIqcPolicyByItem — 검사항목별 모델 (aql.service.ts)

`IQC_PART_SPEC_ITEMS`에 `DEFECT_GRADE`(CRITICAL/MAJOR/MINOR)가 설정된 항목이 있을 때 작동. 항목별로 독립적인 INSPECTION_LEVEL·AQL로 resolveIsoRule 호출. 하나라도 FAIL이면 LOT FAIL. defectGrade 설정 항목이 없으면 `resolveIqcPolicy`로 폴백.

### 검사 Mode 적용

| `PARTNER_MASTERS.INSPECTION_MODE` | AQL_ACCEPTANCE_RULES 조회 필터 |
|------|------|
| NORMAL (기본) | INSPECTION_MODE='NORMAL' |
| TIGHTENED | INSPECTION_MODE='TIGHTENED' |
| REDUCED | INSPECTION_MODE='REDUCED' |
| NULL / 미설정 | INSPECTION_MODE='NORMAL' |

---

## 사전 설정 (마스터·공통코드)

ISO 표 데이터(`AQL_CODE_LETTER_RULES`, `AQL_CODE_LETTER_SAMPLES`, `AQL_ACCEPTANCE_RULES`)는 시드 또는 초기 DML로 사전 입력해야 합니다.

**필수 세팅 순서:**
1. ISO 표 3개 테이블에 표준 데이터 입력(시드)
2. `AQL_STANDARDS`에 AQL 기준 등록 (예: AQL-0.65, AQL-1.0, AQL-2.5)
3. `IQC_AQL_POLICIES`에 정책 등록
4. `ITEM_MASTERS.IQC_AQL_POLICY_CODE`에 품목별 정책 연결

**공통코드 확인 항목:**
- 검사수준: I/II/III/S1/S2/S3/S4
- AQL 값 선택: 0.065/0.10/0.15/0.25/0.40/0.65/1.0/1.5/2.5/4.0/6.5

---

## 권한

| 역할 | 허용 작업 |
|------|------|
| 품질 담당자 | AQL 기준·정책 조회, 등록, 수정, 사용중지 |
| 품질 관리자 | 동일 + ISO 표 직접 DML |
| 일반 사용자 | 조회만 |

---

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| 정책 사용중지 400 오류 "품목에 배정된 AQL 정책은 사용중지할 수 없습니다." | `ITEM_MASTERS`에서 해당 policyCode 참조 품목 존재 | 품목마스터에서 해당 정책 연결 해제 후 사용중지 |
| AQL 기준 사용중지 400 오류 "IQC AQL 정책에서 참조 중인..." | 활성 정책(useYn='Y')의 MAJOR/MINOR_AQL_CODE에서 참조 중 | 해당 정책의 Major/Minor를 다른 기준으로 변경하거나 정책 비활성화 |
| IQC 판정 시 Code Letter 조회 실패 | `AQL_CODE_LETTER_RULES`에 해당 LOT 범위·검사수준 행 없음 | ISO 표 시드 데이터 확인. 누락된 범위 DML INSERT |
| IQC 판정 시 Ac/Re 조회 실패 | `AQL_ACCEPTANCE_RULES`에 CODE_LETTER·AQL_VALUE·NORMAL 행 없음 | ISO Sampling Plan 데이터 확인 후 INSERT |
| 정책 폼 Major/Minor 선택 목록이 비어 있음 | `AQL_STANDARDS`에 useYn='Y'인 기준 없음 | AQL 기준 탭에서 기준 등록 후 useYn=Y 확인 |
| ISO 표 탭에 데이터가 없음 | DB 미입력 | 시드 스크립트 실행 또는 DML로 3개 테이블 데이터 입력 |
| 정책 저장 400 "이미 등록된 IQC AQL 정책입니다" | policyCode 중복 | 다른 코드 사용 또는 기존 정책 수정 |
| AQL 기준 저장 400 "이미 등록된 AQL 코드입니다" | aqlCode 중복 | 다른 코드 사용 |
| Critical 불량 없는데 FAIL 판정 | defectCritical 집계 오류 | IQC 검사 항목 화면에서 Critical 등급 불량 입력 여부 재확인 |

---

## 데이터·연계

| 연계 대상 | 방향 | 내용 |
|------|------|------|
| `ITEM_MASTERS` | → 정책 참조 | `IQC_AQL_POLICY_CODE` 컬럼이 `IQC_AQL_POLICIES.POLICY_CODE` FK 참조 |
| `IQC_LOGS` | 정책 소비 → | IQC 판정 시 resolveIqcPolicy 호출, 결과(PASS/FAIL, sampleQty, judgeReason)를 IQC_LOGS에 기록 |
| `PARTNER_MASTERS` | → 검사 Mode | `INSPECTION_MODE`(NORMAL/TIGHTENED/REDUCED)가 AQL_ACCEPTANCE_RULES 조회 필터로 사용 |
| `IQC_PART_SPEC_ITEMS` | → 항목별 AQL | 항목에 AQL·DEFECT_GRADE·INSPECTION_LEVEL 설정 시 `resolveIqcPolicyByItem` 작동 |
