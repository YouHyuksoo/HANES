---
menuCode: QC_INSPECT_AID
audience: operator
title: 검사보조구 관리 — 운영 가이드
summary: INSPECT_AIDS 테이블 전체 컬럼·DB 매핑, CRUD·사진 업로드(multer uploads/inspect-aids)·만료임박(expiring) API, 유효기간 계산 로직, 공통코드 INSPECT_AID_TYPE/INSPECT_AID_STATUS와 트러블슈팅
tags: [품질, 기준정보, 한도견본, 운영]
keywords: [INSPECT_AIDS, INSPECT_AID_TYPE, INSPECT_AID_STATUS, LIMIT_OK, LIMIT_NG, HOLDER, VALID_TO, expiring, expiryState, daysToExpiry, IMAGE_URL, uploads/inspect-aids, multer, inspect-aids, 한도견본, 검사홀더, 멀티테넌시, 트러블슈팅]
related: [QC_DEFECT_CODE, MST_PART, MST_PROCESS, EQUIP_INSPECT_ITEM_MASTER]
---

# 검사보조구 관리 — 운영 가이드

## 시스템 목적·역할
한도견본(양품/불량)과 검사홀더·지그를 `INSPECT_AIDS` 한 테이블로 관리합니다. 기존에는 PPAP 제출 체크박스 외에 개념이 없었고, 고객 감사(24P·25P) 대응으로 신설했습니다. 사진은 설비점검항목 마스터와 같은 multer 디스크 업로드 패턴(`uploads/inspect-aids/`)을 쓰고, 유효기간 만료·임박은 서버가 `VALID_TO` 기준으로 계산해 내려줍니다. 검사 화면에서 한도견본을 참조하는 연동은 후속 범위입니다.

## 데이터 구조
```
INSPECT_AIDS (PK COMPANY + PLANT_CD + AID_CODE)
  ├─ AID_TYPE     → COM_CODES 'INSPECT_AID_TYPE' (LIMIT_OK / LIMIT_NG / HOLDER)
  ├─ STATUS       → COM_CODES 'INSPECT_AID_STATUS' (ACTIVE / EXPIRED / RETIRED)
  ├─ ITEM_CODE    → ITEM_MASTERS (논리 참조)
  ├─ PROCESS_CODE → PROCESS_MASTERS (논리 참조)
  ├─ DEFECT_CODE  → DEFECT_CODE_MASTERS (논리 참조, LIMIT_NG만)
  └─ IMAGE_URL    → 파일시스템 ./uploads/inspect-aids/inspect-aid-<ts>-<rand>.<ext>
```

---

## ① 검사보조구 — INSPECT_AIDS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 보조구 코드 | `AID_CODE` | PK 일부. 사용자 입력, 수정 불가. 중복 시 **409**. |
| 유형 | `AID_TYPE` | NOT NULL. 공통코드 `INSPECT_AID_TYPE`. DTO `@IsIn(LIMIT_OK, LIMIT_NG, HOLDER)`. |
| 보조구 명칭 | `AID_NAME` | NOT NULL, VARCHAR2(200). |
| 대상 품목 | `ITEM_CODE` | NULL 허용. `ITEM_MASTERS` 논리 참조(FK 없음). PartSelect 전체 품목. |
| 적용 공정 | `PROCESS_CODE` | NULL 허용. `PROCESS_MASTERS` 논리 참조. ProcessSelect. |
| 대표 불량코드 | `DEFECT_CODE` | NULL 허용. `/quality/defect-codes/options` 목록에서 선택. 프론트가 `AID_TYPE<>'LIMIT_NG'`이면 null로 보냄(서버 강제는 없음). |
| 사진 | `IMAGE_URL` | VARCHAR2(500). `/uploads/inspect-aids/...` 상대경로. 업로드 API가 갱신, 본문 PUT으로는 바뀌지 않음. |
| 보관 위치 | `LOCATION` | VARCHAR2(200). 검색 대상. |
| 유효 시작일 / 종료일 | `VALID_FROM` / `VALID_TO` | DATE. API는 `YYYY-MM-DD` 문자열로 주고받으며 서비스가 로컬 Date로 변환(타임존 off-by-one 방지). `VALID_TO`가 만료·임박 계산 기준. |
| 승인자 / 승인일 | `APPROVED_BY` / `APPROVED_AT` | VARCHAR2(50) / TIMESTAMP. 화면은 날짜만 입력. |
| 상태 | `STATUS` | VARCHAR2(20) DEFAULT 'ACTIVE', CHECK(ACTIVE/EXPIRED/RETIRED). **수동 값** — 스케줄러 자동 전환 없음. |
| 비고 | `REMARK` | VARCHAR2(500). |
| 사용여부 | `USE_YN` | CHAR(1) DEFAULT 'Y', CHECK(Y/N). `expiring`은 `Y`만 집계. |
| (응답 전용) 유효기간 상태 | — | `expiryState`: `EXPIRED`(VALID_TO<오늘) / `EXPIRING`(0~days일) / `VALID` / `NONE`(VALID_TO 없음). `daysToExpiry`: 남은 일수(음수=경과). DB 컬럼 아님. |
| 감사 컬럼 | `CREATED_BY`/`UPDATED_BY`/`CREATED_AT`/`UPDATED_AT` | `*_AT` DEFAULT SYSTIMESTAMP. `*_BY`는 JWT 사용자 id(없으면 `SYSTEM`). |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | PK 일부. `40` / `1000` 스코프. |

제약·인덱스: `PK_INSPECT_AIDS(COMPANY,PLANT_CD,AID_CODE)`, `CK_INSPECT_AIDS_STATUS`, `CK_INSPECT_AIDS_USE_YN`, `IX_INSPECT_AIDS_TYPE(COMPANY,PLANT_CD,AID_TYPE,VALID_TO)`.

---

## 버튼·API·상태 전이

| 버튼/액션 | API | 허용 조건 | 결과 / DB 영향 |
|------|------|------|------|
| 목록·탭·필터·페이징 | `GET /master/inspect-aids?page&limit&aidType&status&itemCode&processCode&useYn&search` | — | 읽기. 정렬 AID_TYPE, AID_CODE. 각 행에 `expiryState`/`daysToExpiry`(30일 기준) 포함. |
| 상단 만료·임박 요약 | `GET /master/inspect-aids/expiring?days=30` | days 0~3650 | `USE_YN='Y' AND STATUS<>'RETIRED' AND VALID_TO<=TRUNC(SYSDATE)+days` 전량(경과분 포함), VALID_TO 오름차순. 프론트가 EXPIRED/EXPIRING 건수로 집계. |
| 저장(신규) | `POST /master/inspect-aids` | 코드·유형·명칭 필수 | INSERT (`IMAGE_URL` null). 코드 중복 409. |
| 저장(수정) | `PUT /master/inspect-aids/:aidCode` | 대상 존재 | UPDATE (부분 갱신, `IMAGE_URL` 제외). |
| 사진 선택 후 저장 | `POST /master/inspect-aids/:aidCode/image` (multipart `image`) | 이미지 MIME(jpeg/png/gif/webp), 5MB | 파일 저장 → **기존 파일 삭제** → `IMAGE_URL` 갱신. 저장 순서: 본문 PUT/POST 후 업로드. |
| 사진 삭제 후 저장 | `DELETE /master/inspect-aids/:aidCode/image` | 대상 존재 | 파일 삭제(실패해도 경고 로그만) → `IMAGE_URL=NULL`. |
| 행 휴지통 | `DELETE /master/inspect-aids/:aidCode` | 대상 존재 | 물리 삭제 + 사진 파일 삭제. |
| 상세 | `GET /master/inspect-aids/:aidCode` | — | 읽기(없으면 404). |

### 상태(STATUS) 운영 규칙
`ACTIVE → EXPIRED`(유효기간 경과 확인 후 담당자 변경) → 재승인 시 `VALID_TO` 연장 + `ACTIVE`, 폐기 시 `RETIRED`. 시스템은 강제하지 않으며, `expiring` 목록으로 대상만 알려줍니다.

## 유효기간 계산 로직
1. `VALID_TO`가 없으면 `expiryState='NONE'`, `daysToExpiry=null`.
2. `daysToExpiry = round((VALID_TO 로컬 자정 − 오늘 로컬 자정) / 1일)`.
3. `<0 → EXPIRED`, `0~days → EXPIRING`, 그 외 `VALID`. 목록은 `days=30` 고정, `expiring` API는 쿼리 `days` 사용.
4. 화면 배지는 이 값을 그대로 표시(프론트 재계산 없음).

## 사전 설정 (마스터·공통코드)
- 공통코드 `INSPECT_AID_TYPE`(LIMIT_OK/LIMIT_NG/HOLDER), `INSPECT_AID_STATUS`(ACTIVE/EXPIRED/RETIRED) — 마이그레이션이 MERGE.
- 마스터: 품목(`ITEM_MASTERS`), 공정(`PROCESS_MASTERS`), 불량코드(`DEFECT_CODE_MASTERS`, `/quality/defect-codes/options`).
- 업로드 디렉터리: 백엔드 실행 경로 기준 `./uploads/inspect-aids` (없으면 자동 생성). 정적 서빙은 기존 `/uploads` 설정을 그대로 사용.
- 메뉴: `QC_INSPECT_AID` (QUALITY, SORT_ORDER 6), 권한 MANAGER/OPERATOR.

## 운영 절차
1. 마이그레이션 `2026-09-09_inspect_aids.sql` 적용 → `INSPECT_AIDS` 테이블·공통코드·메뉴 확인.
2. 한도견본 실물에 코드 라벨을 붙이고, 같은 코드로 등록 + 사진 업로드.
3. 주간 점검: `GET /master/inspect-aids/expiring?days=30` 또는 화면 상단 요약으로 대상 확인 → 재승인/폐기 처리.
4. 백업 시 `uploads/inspect-aids/` 디렉터리도 포함(DB에는 경로만 있음).

## 권한
품질 관리자(등록/수정/삭제/사진). 작업자 조회. `ROLE_MENU_PERMISSIONS` MANAGER/OPERATOR.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| "이미 존재하는 검사보조구 코드" (409) | 같은 테넌트에 동일 AID_CODE | 다른 코드 사용 또는 기존 행 수정 |
| 사진 업로드 400 "업로드할 이미지 파일이 없습니다" | 필드명이 `image`가 아니거나 MIME 미허용으로 필터에서 거부 | 이미지 파일(jpeg/png/gif/webp)인지, 5MB 이하인지 확인 |
| 썸네일이 깨짐 | 파일이 지워졌거나 `uploads` 정적 서빙 미설정 | `IMAGE_URL` 경로의 실제 파일 존재 확인, 사진 재업로드 |
| 만료 배지가 안 뜸 | `VALID_TO` 미입력 | 유효 종료일 입력 |
| 상단 만료 건수와 목록 배지 수가 다름 | 요약은 `USE_YN='Y'`·`STATUS<>'RETIRED'`만, 목록은 필터에 따름 | 정상 동작 |
| 유형 탭 라벨이 코드로 보임 | i18n `comCode.INSPECT_AID_TYPE.*` 누락 | 4개 locale에 키 추가 |
| 메뉴가 안 보임 | `MENU_CATEGORY_ITEMS`/`ROLE_MENU_PERMISSIONS` 미등록 | 마이그레이션 4) 블록 확인 |

## 데이터·연계
- 테이블: `INSPECT_AIDS`; 파일: `uploads/inspect-aids/`
- 참조: `COM_CODES`(`INSPECT_AID_TYPE`, `INSPECT_AID_STATUS`), `ITEM_MASTERS`, `PROCESS_MASTERS`, `DEFECT_CODE_MASTERS`(모두 논리 참조)
- 소스: `apps/backend/src/modules/master/{controllers,services,dto}/inspect-aid.*`, `apps/backend/src/entities/inspect-aid.entity.ts`, `apps/frontend/src/app/(authenticated)/master/inspect-aid/`, 공용 썸네일 `components/shared/InspectItemImage.tsx`
- 마이그레이션: `apps/backend/src/migrations/2026-09-09_inspect_aids.sql`
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
