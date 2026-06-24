---
menuCode: SYS_DOCUMENT
audience: operator
title: 문서관리 — 운영 가이드
summary: 문서관리(DOCUMENT_MASTERS) 전체 컬럼의 DB 매핑, 자동채번(DOC-YYYYMMDD-NNN), 상태 전이(승인/개정/폐기), API 경로, 권한, 트러블슈팅, 멀티테넌시 스코프
tags: [시스템, 문서, 문서관리, 운영, IATF, DCC]
keywords: [DOCUMENT_MASTERS, DOC_NO, DOC_TYPE, DOC_STATUS, REVISION_NO, EXPIRES_AT, RETENTION_PERIOD, DRAFT, REVIEW, APPROVED, OBSOLETE, 자동채번, 개정, 승인, 폐기, IATF 16949, 7.5, 멀티테넌시, COMPANY, PLANT_CD]
related: []
---

# 문서관리 — 운영 가이드

## 시스템 목적·역할
품질·공정 문서를 등록·개정·승인·폐기하는 **문서통제(DCC)** 화면으로, IATF 16949 7.5(문서화된 정보)에 대응합니다. 모든 문서는 마스터 테이블 **`DOCUMENT_MASTERS`** 한 곳에서 관리되며, 상태 전이와 개정 차수로 버전 통제를 수행합니다.

> 화면 그리드 하단의 표시용 SQL에는 `SYS_DOCUMENTS`가 적혀 있으나, 실제 백엔드 엔티티/테이블명은 **`DOCUMENT_MASTERS`**입니다(`document-master.entity.ts` 기준). 운영 시 실 테이블명은 `DOCUMENT_MASTERS`로 본다.

## 데이터 구조
```
DOCUMENT_MASTERS (PK: DOC_NO)
   ├─ STATUS        : DRAFT → REVIEW → APPROVED → OBSOLETE
   ├─ REVISION_NO   : 개정 차수(개정 시 +1)
   ├─ DOC_TYPE      ──▶ 공통코드 DOC_TYPE (배지)
   ├─ STATUS        ──▶ 공통코드 DOC_STATUS (배지)
   └─ 스코프: COMPANY, PLANT_CD
```
- 인덱스: `(COMPANY, PLANT_CD, DOC_TYPE)`, `(COMPANY, PLANT_CD, STATUS)`.
- PK는 `DOC_NO` 단일 컬럼입니다. 개정 시 기존 행의 `DOC_NO`를 `{원번호}-R{개정전번호}`로 바꿔 unique 충돌을 회피합니다(아래 개정 로직 참조).

## ① 전체 컬럼 — DOCUMENT_MASTERS

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 문서번호 | `DOC_NO` | PK. `DOC-YYYYMMDD-NNN` 자동채번(당일·테넌시 내 LIKE MAX +1, 3자리 0패딩). 직접 입력 불가. 개정 시 구버전은 `{DOC_NO}-R{이전REV}`로 재명명. |
| 문서명 | `DOC_TITLE` | 필수, 최대 200자. 검색 대상(`docNo`/`docTitle` LIKE). |
| 문서유형 | `DOC_TYPE` | 필수, 최대 30자. 공통코드 `DOC_TYPE`. 인덱스 컬럼·필터 키. |
| 분류 | `CATEGORY` | 선택, 최대 50자(nullable). 사용자 분류 필터 키. |
| 개정번호 | `REVISION_NO` | int, 기본 1. 등록 시 1, 개정마다 +1. |
| 개정일 | `REVISION_DATE` | timestamp(nullable). 승인 시 현재시각으로 갱신. |
| 상태 | `STATUS` | 최대 20자, 기본 `DRAFT`. 공통코드 `DOC_STATUS`. DRAFT/REVIEW/APPROVED/OBSOLETE. 상태에 따라 수정·승인·개정·삭제 가능 여부 분기. |
| 파일경로 | `FILE_PATH` | 선택, 최대 500자(nullable). 실제 파일 보관 경로/링크. |
| (파일크기) | `FILE_SIZE` | int(nullable). DTO에 존재(`fileSize`)하나 현재 폼에는 입력 UI 없음. 향후 업로드 연동용. |
| 승인자 | `APPROVED_BY` | 최대 50자(nullable). 승인 시 요청 사용자 ID 기록. |
| 승인일 | `APPROVED_AT` | timestamp(nullable). 승인 시각. |
| 보존기간(월) | `RETENTION_PERIOD` | int(nullable). 보존 의무 기간(개월). 최소 1. |
| 만료일 | `EXPIRES_AT` | timestamp(nullable). 30일 이내면 프론트에서 강조·만료임박 집계. 만료예정 조회(`/expiring`)는 APPROVED+EXPIRES_AT 기준. |
| 설명 | `DESCRIPTION` | 선택, 최대 1000자(nullable). |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | 회사/사업장 스코프. 조회·채번·상태전이 모두 이 스코프로 필터. `40` / `1000`. |
| 감사 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 생성/수정 사용자·시각. CREATED_AT/UPDATED_AT은 TypeORM `@CreateDateColumn`/`@UpdateDateColumn`. |

## 상태 전이 로직
- **등록(create)**: `STATUS='DRAFT'`, `REVISION_NO=1`, `DOC_NO` 자동채번.
- **수정(update)**: `STATUS='DRAFT'`일 때만 허용. 그 외 상태면 `초안 상태에서만 수정할 수 있습니다` BadRequest.
- **승인(approve)**: `DRAFT` 또는 `REVIEW` → `APPROVED`. `APPROVED_BY`/`APPROVED_AT`/`REVISION_DATE` 기록.
- **개정(revise)**: `APPROVED`만 가능. 처리 순서 ①기존 행 `STATUS='OBSOLETE'` ②`REVISION_NO+1`의 새 `DRAFT` 행 생성(같은 `DOC_NO`) ③기존 행 `DOC_NO`를 `{DOC_NO}-R{이전REV}`로 재명명해 PK 충돌 회피.
- **삭제(delete)**: `STATUS='DRAFT'`일 때만 허용(물리 삭제).

## API 경로 (컨트롤러 prefix `/system`)
| 동작 | 메서드·경로 |
|------|------|
| 목록 조회 | `GET /system/documents` (page/limit/status/docType/category/search/fromDate/toDate) |
| 만료예정 | `GET /system/documents/expiring?days=30` |
| 단건 | `GET /system/documents/:id` |
| 등록 | `POST /system/documents` (201) |
| 수정 | `PUT /system/documents/:id` |
| 삭제 | `DELETE /system/documents/:id` (DRAFT만) |
| 승인 | `PATCH /system/documents/:id/approve` |
| 개정 | `PATCH /system/documents/:id/revise` |

> 프론트 폼은 수정 시 `PATCH /system/documents/:docNo`를 호출하나, 컨트롤러의 수정 라우트는 `PUT /system/documents/:id`입니다. 경로/메서드 불일치 가능성이 있으니 수정 저장이 동작하지 않으면 이 지점을 우선 점검한다(승인/개정 PATCH 경로는 일치).

## 사전 설정 (마스터·공통코드)
- 공통코드 `DOC_TYPE`: 문서유형(배지·필터·폼 셀렉트 소스).
- 공통코드 `DOC_STATUS`: 문서상태(배지). DRAFT/REVIEW/APPROVED/OBSOLETE 값이 등록돼 있어야 배지 라벨이 정상 표시.
- 사용자/사업장 컨텍스트(`COMPANY`/`PLANT_CD`)가 토큰에 실려야 채번·조회가 정상 동작.

## 운영 절차
1. 신규 문서: 추가 → 문서명·문서유형 입력 → 저장(DRAFT 채번).
2. 검토 완료 후 승인 → APPROVED.
3. 변경 발생 시 개정 → 구버전 OBSOLETE + 신버전 DRAFT(REV+1).
4. 만료 관리: `/documents/expiring`로 30일 이내 만료 문서를 주기 점검.

## 권한
- 등록·수정·승인·개정·삭제: 문서관리 담당자/시스템 관리자.
- 일반 사용자: 조회 위주.
- 인증 컨텍스트의 `req.user.id`가 `CREATED_BY`/`UPDATED_BY`/`APPROVED_BY`에 기록되며, 미상 시 `system`으로 대체된다.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 수정 저장이 안 됨 | 승인됨/폐기 상태(초안 아님) | 개정으로 새 DRAFT 생성 후 수정 |
| 수정 PATCH가 404/405 | 프론트 `PATCH :id` vs 백엔드 `PUT :id` 라우트 불일치 | 라우트/메서드 정합 점검 |
| 문서유형·상태 배지가 코드로만 보임 | 공통코드 `DOC_TYPE`/`DOC_STATUS` 미등록 | 해당 공통코드 항목 등록 |
| 승인 버튼이 안 보임 | 상태가 DRAFT/REVIEW 아님 | 초안 상태에서만 승인 가능 |
| 개정 버튼이 안 보임 | 상태가 APPROVED 아님 | 승인된 문서만 개정 가능 |
| 삭제가 거부됨 | DRAFT 상태 아님 | 초안만 삭제 가능, 그 외는 개정/폐기로 관리 |
| 채번 순번이 꼬임 | 동일 당일·테넌시 LIKE MAX+1 방식(병렬 등록 시 경합 가능) | 순차 등록 또는 충돌 시 재시도 |
| 다른 사업장 문서가 안 보임 | `COMPANY`/`PLANT_CD` 스코프 필터 | 로그인 사업장 컨텍스트 확인 |

## 데이터·연계
- 테이블: `DOCUMENT_MASTERS` (PK `DOC_NO`).
- 공통코드 연계: `DOC_TYPE`, `DOC_STATUS`.
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`.
