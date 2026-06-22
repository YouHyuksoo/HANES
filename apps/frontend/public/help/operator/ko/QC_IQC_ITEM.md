---
menuCode: QC_IQC_ITEM
audience: operator
title: 검사항목마스터
summary: IQC 전역 검사항목 풀(IQC_ITEM_POOL)을 관리하는 화면의 운영 가이드. 화면 항목↔DB 컬럼 매핑, 판정방법 값, 연계 화면을 설명한다.
tags: [품질, IQC, 수입검사, 검사항목, 기준정보, 운영가이드]
keywords: [IQC_ITEM_POOL, 검사항목풀, INSP_ITEM_CODE, INSP_ITEM_NAME, JUDGE_METHOD, LSL, USL, CRITERIA, USE_YN, 판정방법, 육안, 계측, 단위, UNIT_TYPE, 멀티테넌시]
related: [QC_IQC_PART_SPEC, QC_IQC, QC_AQL]
---

# 검사항목마스터 — 운영 가이드

## 시스템 목적·역할
수입검사(IQC) 체계의 **공용 검사항목 풀**입니다. 이 화면에서 등록한 항목을 [품목별 IQC 항목관리](/master/iqc-part-spec)가 참조해, 품목마다 어떤 항목을 어떤 규격으로 검사할지 구성합니다. 즉 **항목의 정의(여기) ↔ 품목별 적용·규격(품목별 IQC 항목관리)** 으로 책임이 분리됩니다.

## 데이터 구조
```
IQC_ITEM_POOL (검사항목 풀 · 본 화면)
   └─ INSP_ITEM_CODE 로 참조 ─▶ IQC_PART_SPEC_ITEMS (품목별 검사항목 상세)
                                     └─ IQC_PART_SPECS (품목별 IQC 기준 헤더)
```
- 본 화면 API: `GET/POST/PUT/DELETE /master/iqc-item-pool`
- 키: `INSP_ITEM_CODE` (+ 멀티테넌시 `COMPANY`/`PLANT_CD`)

## ① 검사항목 — IQC_ITEM_POOL (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|---|---|---|
| **항목코드** | `INSP_ITEM_CODE` | 검사항목 식별 키(NOT NULL). 화면에서 신규 등록 시에만 입력, 수정 시 잠금. 품목별 상세가 이 코드로 참조하므로 사용 중 코드 삭제 주의. |
| **검사항목** | `INSP_ITEM_NAME` | 검사항목명(NOT NULL). |
| **판정방법** | `JUDGE_METHOD` | NOT NULL. 화면 선택값 **VISUAL=육안 / MEASURE=계측**. (DB 컬럼 코멘트에는 NUMERIC/VISUAL/GONOGG 표기가 남아 있으나, 본 화면이 쓰는 값은 VISUAL·MEASURE.) |
| **단위** | `UNIT` | 측정 단위(NULL 허용). 공통코드 `UNIT_TYPE`에서 선택. 계측 항목에 사용. |
| (화면 미편집) | `CRITERIA` | 판정기준 텍스트. 본 화면에서는 입력하지 않음 — 품목별 규격은 IQC_PART_SPEC_ITEMS에서 관리. |
| (화면 미편집) | `LSL` / `USL` | 하한/상한 규격값(NUMBER). 본 화면 미편집(품목별 규격은 품목별 IQC 항목관리). |
| (화면 미편집) | `REVISION` | 개정번호(NOT NULL). |
| (화면 미편집) | `EFFECTIVE_DATE` | 유효일자. |
| (화면 미편집) | `USE_YN` | 사용여부(NOT NULL, 기본 Y). 본 화면은 토글 UI 없이 삭제로 관리. |
| (화면 미편집) | `REMARK` | 비고. |
| 스코프 | `COMPANY` / `PLANT_CD` | 멀티테넌시 스코프(NOT NULL). 기본 `40` / `1000`. |
| 감사 | `CREATED_BY` `UPDATED_BY` `CREATED_AT` `UPDATED_AT` | 등록/수정 추적. CREATED_AT/UPDATED_AT은 NOT NULL(SYSTIMESTAMP 기본). |

> 본 화면 폼은 `INSP_ITEM_CODE / INSP_ITEM_NAME / JUDGE_METHOD / UNIT` 4개만 직접 편집한다. 나머지(CRITERIA·LSL·USL·USE_YN 등)는 기본값으로 생성되며, 품목별 규격은 품목별 IQC 항목관리에서 설정한다.

## 판정방법(JUDGE_METHOD) 값
| 값 | 화면 라벨 | 의미 |
|---|---|---|
| `VISUAL` | 육안 | 눈으로 합/불 판정(외관 등). 단위 불필요. |
| `MEASURE` | 계측 | 측정기 값으로 규격(LSL/USL) 비교. 단위 권장. |

## 사전 설정 (마스터·공통코드)
- 공통코드 `UNIT_TYPE` — 단위 드롭다운 소스. 필요한 단위(mm, g, ㎏ 등)가 없으면 [공통코드 관리]에 먼저 추가.

## 운영 절차
1. `검사항목추가` → 항목코드·검사항목·판정방법(·단위) 입력 → 저장(`POST /master/iqc-item-pool`).
2. 수정은 행 ✎ → 코드 제외 필드 수정(`PUT /master/iqc-item-pool/{code}`).
3. 삭제는 🗑 → 확인(`DELETE /master/iqc-item-pool/{code}`). **품목별 상세에서 사용 중이면 삭제 전 영향 확인.**

## 권한
- 기준정보 마스터 등록 권한 보유자(품질/기준정보 관리자)가 관리.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|---|---|---|
| 단위 드롭다운이 비어 있음 | 공통코드 `UNIT_TYPE` 미등록 | 공통코드 관리에서 단위 코드 추가 |
| 저장 버튼 비활성 | 항목코드 또는 검사항목 미입력 | 필수 2개 입력 |
| 항목코드 수정 불가 | 코드는 키(수정 잠금) | 삭제 후 재등록(연결도 재설정) |
| 삭제 후 품목 검사에서 항목 사라짐 | 품목별 상세가 해당 코드 참조 중 | 삭제 전 품목별 IQC 항목관리에서 사용처 확인 |

## 데이터·연계
- 테이블: `IQC_ITEM_POOL`
- 연계 화면: [품목별 IQC 항목관리](/master/iqc-part-spec)(이 풀을 참조), [수입검사(IQC)](/material/iqc)
- 멀티테넌시 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
