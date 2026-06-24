---
menuCode: MST_PARTNER
audience: operator
title: 거래처관리 — 운영 가이드
summary: 거래처관리 전체 컬럼의 DB 매핑(PARTNER_MASTERS), API 엔드포인트, 거래처 유형/검사모드, 멀티테넌시 스코프, 권한, 트러블슈팅
tags: [기준정보, 거래처, 마스터, 운영]
keywords: [PARTNER_MASTERS, PARTNER_TYPE, SUPPLIER, CUSTOMER, MFG, INSPECTION_MODE, QUALITY_GRADE, 거래처유형, 검사모드, 품질등급, 멀티테넌시, COMPANY, PLANT_CD, 자연키, 소프트삭제]
related: [MST_PART]
---

# 거래처관리 — 운영 가이드

## 시스템 목적·역할
모든 거래처(공급사·고객사·제조사)의 기준정보를 보유하는 **마스터 테이블 `PARTNER_MASTERS`** 관리 화면입니다. 구매발주(매입처)·자재입하·수입검사(IQC)·출하(매출처)가 `PARTNER_CODE`로 이 마스터를 참조합니다. 거래처유형은 단일 마스터에서 `PARTNER_TYPE`으로 통합 관리합니다(제조사 MFG 포함).

## 데이터 구조
```
PARTNER_MASTERS (PK: PARTNER_CODE, COMPANY, PLANT_CD)
   ├─ PARTNER_TYPE ──▶ 공통코드 PARTNER_TYPE (SUPPLIER / CUSTOMER / MFG)
   └─ 참조: 구매발주 / 자재입하 / 수입검사(IQC) / 출하
```
- PK는 자연키 복합키(`PARTNER_CODE` + 멀티테넌시 `COMPANY`/`PLANT_CD`)입니다. `@PrimaryGeneratedColumn`을 쓰지 않습니다.
- API 기본 경로: `/master/partners` (NestJS `PartnerController`).

## ① 거래처 마스터 — PARTNER_MASTERS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 거래처코드 | `PARTNER_CODE` | PK 구성(자연키). 불변 권장 — 발주·입하·출하 무결성의 기준. 길이 50. |
| 거래처명 | `PARTNER_NAME` | 표시명. 필수. 엔티티 길이 100(생성 DTO는 200까지 허용하므로 실제 컬럼 길이 확인 필요). |
| 거래처 유형 | `PARTNER_TYPE` | 공통코드 PARTNER_TYPE. `SUPPLIER`(공급사)/`CUSTOMER`(고객사)/`MFG`(제조사). 구매·판매·제조 흐름 분기. 인덱스(`@Index`) 존재. |
| 사업자번호 | `BIZ_NO` | 사업자등록번호. 법인 식별·세금계산서. |
| 대표자 | `CEO_NAME` | 대표자명. |
| 주소 | `ADDRESS` | 거래처 주소. 엔티티 길이 255. |
| 전화번호 | `TEL` | 대표 전화번호. |
| 팩스번호 | `FAX` | 팩스번호. |
| 이메일 | `EMAIL` | 대표 이메일(발주·통지 연락). |
| 담당자 | `CONTACT_PERSON` | 거래처 측 연락 담당자. 검색 대상 컬럼. |
| 품질등급 | `QUALITY_GRADE` | 거래처 품질등급(A 등). DTO에는 있으나 현재 화면 폼에는 노출되지 않음(API/배치로만 설정). |
| 검사모드 | `INSPECTION_MODE` | `TIGHTENED`(까다로운 검사)/`NORMAL`(보통)/`REDUCED`(수월한 검사). 기본 `NORMAL`. 거래처 IQC 검사 강도 결정에 쓰는 값. 현재 화면 폼에는 미노출(API/배치 관리). |
| 비고 | `REMARK` | 메모. 길이 500. |
| 사용여부 | `USE_YN` | `Y`만 활성(조회·선택 대상). 기본 `Y`. 거래 종료 시 `N`. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | PK 구성. `40` / `1000` 스코프. 엔티티 매핑은 `company`/`plant`. |
| 감사 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 생성/수정 이력. `CREATED_AT`/`UPDATED_AT`은 TypeORM `@CreateDateColumn`/`@UpdateDateColumn`. |

> 참고: `QUALITY_GRADE`·`INSPECTION_MODE`는 백엔드 엔티티·DTO·생성/수정 로직에는 존재하지만 현재 거래처 폼(`PartnerFormPanel`)에는 입력 필드가 없습니다. 화면에서 직접 편집하려면 폼 확장이 필요합니다.

## API 엔드포인트
| 동작 | 메서드 · 경로 | 비고 |
|------|------|------|
| 목록 조회 | `GET /master/partners` | 쿼리: `search`, `partnerType`, `useYn`, `page`, `limit`. 페이징 응답. 화면은 `limit=5000`으로 호출. |
| 통계 | `GET /master/partners/statistics` | `{ totalCount, supplierCount, customerCount, activeCount }` 단일 집계 쿼리. |
| 유형별 목록 | `GET /master/partners/types/:type` | `useYn='Y'`만 반환. |
| 코드 조회 | `GET /master/partners/code/:partnerCode` | |
| 상세 조회 | `GET /master/partners/:id` | `:id`는 `PARTNER_CODE`. |
| 생성 | `POST /master/partners` | 코드 중복 시 409(ConflictException). |
| 수정 | `PUT /master/partners/:id` | 부분 업데이트(UpdatePartnerDto = PartialType). 코드 변경 불가. |
| 삭제 | `DELETE /master/partners/:id` | 존재 확인 후 `repository.delete`로 **물리 삭제**. |

> 삭제 동작: 화면 코멘트는 "소프트삭제"라 적혀 있으나, 현재 서비스(`partner.service.ts delete`)는 `repository.delete`로 행을 **물리 삭제**합니다. 이력 보존이 필요하면 사용여부 `N` 처리를 안내하세요.

## 검색·필터 로직
- `search`는 `PARTNER_CODE`·`PARTNER_NAME`·`BIZ_NO`·`CONTACT_PERSON`을 대상으로 LIKE 검색합니다(코드/사업자번호는 대문자 변환 후 매칭, 이름/담당자는 원문 매칭).
- 목록 정렬은 `PARTNER_CODE ASC`.

## 사전 설정 (마스터·공통코드)
- 공통코드 `PARTNER_TYPE`: `SUPPLIER`/`CUSTOMER`/`MFG` 코드값이 등록되어 있어야 유형 셀렉트·배지가 정상 표시됩니다(`ComCodeSelect`/`ComCodeBadge`).
- 공통코드 `USE_YN`: 사용여부 필터(`UseYnSelect`).

## 운영 절차
1. **신규 등록**: 거래처 추가 → 코드·유형·이름 입력 → 저장. 코드 중복이면 409.
2. **수정**: 행 ✏️ → 폼 수정 → 저장. 코드는 잠김.
3. **비활성화**: 거래 종료 거래처는 `USE_YN='N'`. 이력 참조가 있으면 삭제 대신 비활성화 권장.
4. **삭제**: 발주·입하·출하 참조가 없는 신규 오등록 건만 삭제(물리 삭제이므로 자식 참조 사전 확인).

## 권한
기준정보 관리자(등록/수정/삭제). 일반 사용자는 조회. (별도 화면 권한 코드는 메뉴 권한 설정에 따름.)

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 저장 시 코드 중복 오류(409) | 동일 `PARTNER_CODE` 존재 | 다른 코드 사용(코드는 불변 키) |
| 거래처가 선택 목록(발주·입하 등)에 안 보임 | `USE_YN='N'` | 사용여부 `Y`로 활성화 |
| 거래처 유형 배지가 코드 그대로 표시됨 | 공통코드 `PARTNER_TYPE`에 해당 코드 미등록 | 공통코드 등록 |
| 수정 화면에서 코드 변경 불가 | 사양상 코드는 불변 키 | 신규 등록 후 기존 건 `USE_YN='N'` |
| 검사모드/품질등급을 화면에서 못 바꿈 | 폼에 입력 필드 미노출 | API/배치로 설정 또는 폼 확장 |
| 삭제했더니 복구 불가 | 현재 삭제는 물리 삭제 | 이력 필요 건은 `USE_YN='N'`로 비활성화 |

## 데이터·연계
- 테이블: `PARTNER_MASTERS`
- 연계: 구매발주(매입처), 자재입하·수입검사(IQC) 제조사/공급사, 출하(매출처)
- 공통코드: `PARTNER_TYPE`, `USE_YN`
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'` (모든 조회·생성·수정·삭제에 멀티테넌시 적용)
