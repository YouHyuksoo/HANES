---
menuCode: QC_AQL
audience: operator
title: AQL 기준관리 — 운영 가이드
summary: AQL 정책/기준/판정기준의 전체 컬럼 의미, DB 매핑, 판정 로직, 품목 연계와 트러블슈팅
tags: [품질, IQC, AQL, 운영, 설정]
keywords: [IQC_AQL_POLICIES, AQL_STANDARDS, 품목연계, 검사수준, 치명결함, IMMEDIATE_FAIL, Ac, Re, 샘플수, 트러블슈팅, ITEM_MASTERS]
related: [MST_PART]
---

# AQL 기준관리 — 운영 가이드

## 시스템 목적·역할
품목별 수입검사(IQC) 판정의 기준이 되는 **AQL 정책 / AQL 기준 / LOT 수량별 판정기준**을 정의합니다. 품목마스터의 AQL 정책 필드(`ITEM_MASTERS.IQC_AQL_POLICY_CODE`)가 이 정책을 참조하며, 입고 LOT 검사 시 정책 → 기준 → LOT 구간 순으로 샘플수·Ac·Re를 산출해 합·불을 자동 판정합니다.

## 데이터 구조 (3계층)
```
ITEM_MASTERS.IQC_AQL_POLICY_CODE
        │ (참조)
        ▼
IQC_AQL_POLICIES  ──(MAJOR_AQL_CODE / MINOR_AQL_CODE)──▶  AQL_STANDARDS  ──(1:N)──▶  LOT 수량별 판정기준(rules)
```

---

## ① AQL 정책 — IQC_AQL_POLICIES (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 정책 코드 | `POLICY_CODE` | PK. 품목마스터가 참조하는 키. 변경 불가(연결 깨짐 방지). 명명 규칙 권장: `AQLP-{검사수준}-{Major}-{Minor}`. |
| 정책명 | `POLICY_NAME` | 표시용 명칭. |
| 검사수준 | `INSPECTION_LEVEL` | 공통코드 `AQL_INSP_LEVEL`. LOT 크기 → 샘플문자(code letter) 결정 기준. 표준은 II. |
| Major AQL | `MAJOR_AQL_CODE` | 중결함용 `AQL_STANDARDS.AQL_CODE` 참조(FK 성격). 미설정 시 중결함 자동판정 불가. |
| Minor AQL | `MINOR_AQL_CODE` | 경결함용 `AQL_STANDARDS.AQL_CODE` 참조. |
| 치명결함 처리 | `CRITICAL_MODE` | `IMMEDIATE_FAIL` = 치명결함 1건이라도 발생 시 즉시 LOT 불합격(샘플수/Ac 무관). |
| 사용여부 | `USE_YN` | `Y`만 품목 연결·검사 대상. 정책 "사용중지"는 소프트 비활성(`N`). |
| 비고 | `REMARK` | 메모. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | 정책은 `COMPANY='40'`, `PLANT_CD='1000'` 스코프로 관리. |

---

## ② AQL 기준 — AQL_STANDARDS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| AQL 코드 | `AQL_CODE` | PK. 정책의 Major/Minor가 참조. 변경 불가. 예: `AQL-1.0`. |
| AQL 명칭 | `AQL_NAME` | 표시용. |
| 검사수준 | `INSPECTION_LEVEL` | 공통코드 `AQL_INSP_LEVEL`. 정책 검사수준과 정합되게 운영. |
| AQL 값 | `AQL_VALUE` | 공통코드 `AQL_VALUE`(0.65/1.0/2.5 등). 합격품질한계 수치. **작을수록 엄격**. 샘플수와 결합해 Ac/Re 산출. |
| 사용여부 | `USE_YN` | `Y`만 정책에서 선택 가능. |
| 비고 | `REMARK` | 메모. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | `40` / `1000` 스코프. |

---

## ③ LOT 수량별 판정기준 — rules (전체 컬럼)

AQL 기준 1건에 N개의 LOT 구간 행을 둡니다. LOT 크기 구간별로 샘플수·Ac·Re를 정의합니다(KS Q ISO 2859-1 표 기반).

| 화면 항목 | 컬럼 | 역할 / 의미 |
|------|------|------|
| LOT From | `lotQtyFrom` | 적용 LOT 수량 구간 하한. |
| LOT To | `lotQtyTo` | 적용 LOT 수량 구간 상한. |
| 샘플수(n) | `sampleSize` | 검사 표본 개수. |
| Ac | `acceptQty` | 합격판정개수. 불량수 ≤ Ac → 합격. |
| Re | `rejectQty` | 불합격판정개수. 불량수 ≥ Re → 불합격. 보통 Re=Ac+1. |
| 정렬순서 | `sortOrder` | 저장 시 LOT 수량 순으로 재정렬. |

**입력 검증(저장 시 차단)**: From ≤ To, Re > Ac, 구간 비중복(앞 To < 다음 From).

---

## 판정 로직 (입고 LOT 검사 시)
1. 품목의 `IQC_AQL_POLICY_CODE`로 정책 조회. 없으면 자동판정 미적용.
2. 치명결함이 있고 `CRITICAL_MODE='IMMEDIATE_FAIL'`이면 즉시 불합격.
3. Major/Minor 각각: 정책의 해당 AQL 기준 → LOT 크기에 맞는 구간 행 선택 → 그 행의 n·Ac·Re 적용.
4. 결함등급별 불량수를 Ac/Re와 비교해 합·불 판정. 하나라도 불합격이면 LOT 불합격.

## 사전 설정 (마스터·공통코드)
- 공통코드: `AQL_INSP_LEVEL`(검사수준), `AQL_VALUE`(AQL 값)
- AQL 기준 → LOT 판정기준 → 정책 순으로 등록 후, 품목마스터에서 품목에 정책 연결

## 운영 절차
1. `AQL_STANDARDS`(AQL 값별 기준) 정의 + 각 기준에 LOT 구간 판정기준 등록
2. `IQC_AQL_POLICIES`에서 Major/Minor에 기준 연결, 검사수준·치명결함 처리 설정
3. [품목마스터]에서 품목에 정책 연결(`ITEM_MASTERS.IQC_AQL_POLICY_CODE`)
4. 입고 LOT 수입검사에서 자동 판정 확인

## 권한
품질 관리자(기준 등록/수정). 일반 사용자는 조회.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 검사에서 AQL 자동판정 안 됨 | 품목에 정책 미연결 | 품목마스터에서 AQL 정책 지정 |
| 정책에서 기준이 선택 안 됨 | 해당 AQL 기준 `USE_YN='N'` | 기준을 `Y`로 활성화 |
| 특정 LOT 크기에서 판정 누락 | 해당 수량을 포함하는 구간 행 없음 | LOT 구간 행 추가(빈 구간 제거) |
| 치명결함인데 합격 처리 | `CRITICAL_MODE` 미설정 | 정책에 `IMMEDIATE_FAIL` 설정 |
| 저장 거부(구간 겹침/Re≤Ac) | 입력 검증 위반 | From≤To, Re>Ac, 구간 비중복으로 수정 |

## 데이터·연계
- 테이블: `IQC_AQL_POLICIES`, `AQL_STANDARDS`(+ LOT 판정기준 rules)
- 연계: 품목마스터(`ITEM_MASTERS.IQC_AQL_POLICY_CODE`), 수입검사(IQC) 판정 엔진
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
