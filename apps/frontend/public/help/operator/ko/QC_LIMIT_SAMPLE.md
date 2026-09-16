---
menuCode: QC_LIMIT_SAMPLE
audience: operator
title: 양불마스터 — 운영 가이드
summary: LIMIT_SAMPLES / LIMIT_SAMPLE_IMAGES 전체 컬럼·DB 매핑, CRUD·사진 다중 업로드(multer uploads/limit-samples)·대표 사진 유일성 강제, 만료임박(expiring) API, 통전·단자검사 대조 연동과 트러블슈팅
tags: [품질, 기준정보, 한도견본, 운영]
keywords: [LIMIT_SAMPLES, LIMIT_SAMPLE_IMAGES, LIMIT_SAMPLE_TYPE, LIMIT_SAMPLE_STATUS, OK, NG, IS_PRIMARY, UX_LIMIT_SAMPLE_IMAGES_PRIMARY, VALID_TO, expiring, expiryState, daysToExpiry, uploads/limit-samples, multer, 양불마스터, 한도견본, INSPECT_SAMPLE_CHECKS, INSPECT_SAMPLE_CHECK_ITEMS, SAMPLE_CODE, SAMPLE_TYPE, sample-check, prep-status, 멀티테넌시, 트러블슈팅]
related: [QC_INSPECT_AID, QC_DEFECT_CODE, MST_PART, MST_PROCESS]
---

# 양불마스터 — 운영 가이드

## 시스템 목적·역할
양품/불량 한도견본을 `LIMIT_SAMPLES`(부모) + `LIMIT_SAMPLE_IMAGES`(사진 자식) 두 테이블로 관리합니다. 통전·단자검사가 `INSPECT_TYPE`·`REQUIRED_YN`·`SORT_ORDER`로 대조 대상을 뽑고, 대조 결과는 `INSPECT_SAMPLE_CHECKS` / `INSPECT_SAMPLE_CHECK_ITEMS`에 남습니다.

> **2026-09-16 신설 경위**: 원래 `INSPECT_AIDS`(검사보조구)에 `AID_TYPE='LIMIT_OK'/'LIMIT_NG'`로 섞여 있던 76건을 이 테이블로 이관하고, `INSPECT_AIDS`는 검사홀더·지그 전용으로 좁혔습니다. 유형 도메인도 `LIMIT_OK`/`LIMIT_NG` → `OK`/`NG`로 바뀌었고, 대조 실적의 참조 컬럼은 `AID_CODE`/`AID_TYPE` → `SAMPLE_CODE`/`SAMPLE_TYPE`으로 리네임됐습니다. 설계: `docs/specs/2026-09-16-limit-sample-master-design.md`

## 데이터 구조
```
LIMIT_SAMPLES (PK COMPANY + PLANT_CD + SAMPLE_CODE)
  ├─ SAMPLE_TYPE  → COM_CODES 'LIMIT_SAMPLE_TYPE' (OK / NG)
  ├─ INSPECT_TYPE → COM_CODES 'INSPECT_TYPE' (CONTINUITY / TERMINAL, NULL=전 검사유형 공통)
  ├─ REQUIRED_YN  → 검사 전 대조 필수
  ├─ SORT_ORDER   → 대조 모달 표시 순서
  ├─ STATUS       → COM_CODES 'LIMIT_SAMPLE_STATUS' (ACTIVE / EXPIRED / RETIRED)
  ├─ ITEM_CODE    → ITEM_MASTERS (논리 참조, NULL=공용 견본)
  ├─ PROCESS_CODE → PROCESS_MASTERS (논리 참조)
  └─ DEFECT_CODE  → DEFECT_CODE_MASTERS (논리 참조, NG만)

LIMIT_SAMPLE_IMAGES (PK COMPANY + PLANT_CD + SAMPLE_CODE + SEQ_NO)
  ├─ IMAGE_URL    → ./uploads/limit-samples/limit-sample-<ts>-<rand>.<ext>
  ├─ IS_PRIMARY   → 대표 1장 (함수기반 유니크 인덱스가 강제)
  └─ CAPTION / SORT_ORDER

INSPECT_SAMPLE_CHECK_ITEMS.SAMPLE_CODE → LIMIT_SAMPLES.SAMPLE_CODE
```

부모에는 `IMAGE_URL` 컬럼이 없습니다. 사진은 자식 테이블이 단일출처이고, 대표 사진이 두 곳에 기록돼 어긋나는 일을 막기 위한 설계입니다.

---

## ① 양불마스터 — LIMIT_SAMPLES (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 견본 코드 | `SAMPLE_CODE` | PK 일부. 사용자 입력, 수정 불가. 실물 바코드 스캔값. 중복 시 **409**. |
| 유형 | `SAMPLE_TYPE` | NOT NULL, `CK_LIMIT_SAMPLES_TYPE CHECK(OK/NG)`. 공통코드 `LIMIT_SAMPLE_TYPE`. |
| 견본 명칭 | `SAMPLE_NAME` | NOT NULL, VARCHAR2(200). |
| 대상 품목 | `ITEM_CODE` | NULL 허용. `ITEM_MASTERS` 논리 참조(FK 없음). **NULL이면 모든 품목에 공용**으로 대조 후보에 나옴. |
| 적용 공정 | `PROCESS_CODE` | NULL 허용. `PROCESS_MASTERS` 논리 참조. |
| 대표 불량코드 | `DEFECT_CODE` | NULL 허용. `/quality/defect-codes/options`에서 선택. **서버가 `SAMPLE_TYPE='OK'`이면 null로 강제**(create/update 양쪽). |
| 적용 검사유형 | `INSPECT_TYPE` | NULL 허용. `CONTINUITY`/`TERMINAL`. **NULL이면 전 검사유형 공통**. |
| 대조 필수 | `REQUIRED_YN` | CHAR(1) DEFAULT 'Y', CHECK(Y/N). `Y`인 견본이 하나라도 만료면 대조·검사가 막힘. |
| 표시순서 | `SORT_ORDER` | NUMBER DEFAULT 0. 대조 모달 정렬 1순위. |
| 보관 위치 | `LOCATION` | VARCHAR2(200). 검색 대상. |
| 유효 시작일 / 종료일 | `VALID_FROM` / `VALID_TO` | DATE. API는 `YYYY-MM-DD` 문자열로 주고받으며 서비스가 로컬 Date로 변환(타임존 off-by-one 방지). `VALID_TO`가 만료·임박 계산 기준. |
| 승인자 / 승인일 | `APPROVED_BY` / `APPROVED_AT` | VARCHAR2(50) / TIMESTAMP. 화면은 날짜만 입력. |
| 상태 | `STATUS` | VARCHAR2(20) DEFAULT 'ACTIVE', CHECK(ACTIVE/EXPIRED/RETIRED). **수동 값** — 스케줄러 자동 전환 없음. |
| 비고 | `REMARK` | VARCHAR2(500). |
| 사용여부 | `USE_YN` | CHAR(1) DEFAULT 'Y', CHECK(Y/N). 대조 후보와 `expiring`은 `Y`만. |
| (응답 전용) 유효기간 상태 | — | `expiryState`: `EXPIRED`(VALID_TO<오늘) / `EXPIRING`(0~days일) / `VALID` / `NONE`. `daysToExpiry`: 남은 일수(음수=경과). DB 컬럼 아님. |
| (응답 전용) 사진 | — | `images[]`(seqNo·imageUrl·caption·isPrimary·sortOrder), `primaryImageUrl`. 목록은 페이지 단위로 사진을 한 번에 읽어 매핑(N+1 없음). |
| 감사 컬럼 | `CREATED_BY`/`UPDATED_BY`/`CREATED_AT`/`UPDATED_AT` | `*_AT` DEFAULT SYSTIMESTAMP. `*_BY`는 JWT 사용자 id(없으면 `SYSTEM`). |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | PK 일부. `40` / `1000` 스코프. |

제약·인덱스: `PK_LIMIT_SAMPLES`, `CK_LIMIT_SAMPLES_TYPE/STATUS/USE_YN/REQ_YN`,
`IX_LIMIT_SAMPLES_LOOKUP(COMPANY,PLANT_CD,ITEM_CODE,INSPECT_TYPE,SAMPLE_TYPE)` — 대조 후보 조회용,
`IX_LIMIT_SAMPLES_VALID(COMPANY,PLANT_CD,VALID_TO)` — 만료·임박 조회용.

## ② 견본 사진 — LIMIT_SAMPLE_IMAGES

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| (내부) 순번 | `SEQ_NO` | PK 일부. 견본 내 `MAX+1`로 채번. |
| 사진 | `IMAGE_URL` | NOT NULL VARCHAR2(500). `/uploads/limit-samples/...` 상대경로. |
| 사진 설명 | `CAPTION` | VARCHAR2(200). 촬영 각도·불량 부위 등. |
| 대표 | `IS_PRIMARY` | CHAR(1) DEFAULT 'N', CHECK(Y/N). **첫 사진은 서버가 자동으로 `Y`**. 대표 변경 시 같은 견본 전체를 `N`으로 내린 뒤 대상만 `Y`로 올림. 대표를 지우면 남은 첫 사진이 자동 승격. |
| 표시 순서 | `SORT_ORDER` | NUMBER DEFAULT 0. 정렬 1순위(같으면 SEQ_NO). |

유니크: `UX_LIMIT_SAMPLE_IMAGES_PRIMARY` — `CASE WHEN IS_PRIMARY='Y' THEN COMPANY||'|'||PLANT_CD||'|'||SAMPLE_CODE END`에 건 **함수기반 유니크 인덱스**. `IS_PRIMARY='N'` 행은 NULL이 되어 대상에서 빠지므로, 견본당 대표 1장을 DB가 강제합니다. 애플리케이션 버그가 있어도 대표가 2장이 될 수 없습니다.

---

## 버튼·API·상태 전이

| 버튼/액션 | API | 허용 조건 | 결과 / DB 영향 |
|------|------|------|------|
| 목록·탭·필터·페이징 | `GET /master/limit-samples?page&limit&sampleType&status&itemCode&processCode&useYn&search&inspectType` | — | 읽기. 정렬 SORT_ORDER, SAMPLE_TYPE, SAMPLE_CODE. 각 행에 `images[]`/`primaryImageUrl`/`expiryState`(30일 기준) 포함. |
| 상단 만료·임박 요약 | `GET /master/limit-samples/expiring?days=30` | days 0~3650 | `USE_YN='Y' AND STATUS<>'RETIRED' AND VALID_TO<=TRUNC(SYSDATE)+days` 전량(경과분 포함), VALID_TO 오름차순. |
| 상세 | `GET /master/limit-samples/:sampleCode` | — | 사진 목록 포함(없으면 404). |
| 저장(신규) | `POST /master/limit-samples` | 코드·유형·명칭 필수 | INSERT. 코드 중복 409. `SAMPLE_TYPE='OK'`이면 `DEFECT_CODE` null 강제. |
| 저장(수정) | `PUT /master/limit-samples/:sampleCode` | 대상 존재 | UPDATE(부분 갱신). 유형을 OK로 바꾸면 `DEFECT_CODE` 자동 null. |
| 사진 추가 | `POST /master/limit-samples/:sampleCode/images` (multipart `image`) | 이미지 MIME(jpeg/png/gif/webp), 5MB | 파일 저장 → `SEQ_NO=MAX+1` INSERT. 기존 사진이 없으면 `IS_PRIMARY='Y'`. |
| 사진 설명·대표·순서 | `PUT /master/limit-samples/:sampleCode/images/:seqNo` | 대상 존재 | `isPrimary='Y'`면 같은 견본 전체를 `N`으로 UPDATE 후 대상만 `Y`. caption/sortOrder 부분 갱신. |
| 사진 삭제 | `DELETE /master/limit-samples/:sampleCode/images/:seqNo` | 대상 존재 | 행 삭제 + 파일 삭제(실패해도 경고 로그만). 대표였으면 남은 첫 사진 승격. 화면에서는 **저장 전에 즉시** 반영됩니다. |
| 행 휴지통 | `DELETE /master/limit-samples/:sampleCode` | 대상 존재 | 자식 행 전량 삭제 → 부모 물리 삭제 → 사진 파일 전량 삭제. |
| 대조 후보 | `GET /quality/continuity-inspect/sample-check/candidates?itemCode&inspectType` | — | `USE_YN='Y'`, 품목·검사유형이 일치하거나 NULL인 견본. `expectedResult`는 `OK→PASS / NG→FAIL`, `imageUrl`은 대표 1장. |

### 저장 순서 (화면 동작)
신규 등록은 견본이 아직 없으므로 사진이 로컬 큐에 쌓였다가 **본문 저장 후** 순차 업로드되고, 업로드마다 설명·대표 지정이 따라갑니다. 수정은 본문 PUT → 저장된 사진의 변경분만 PUT → 대기 중 사진 업로드 순서입니다.

### 상태(STATUS) 운영 규칙
`ACTIVE → EXPIRED`(유효기간 경과 확인 후 담당자 변경) → 재승인 시 `VALID_TO` 연장 + `ACTIVE`, 폐기 시 `RETIRED`. 시스템은 강제하지 않으며, `expiring` 목록으로 대상만 알려줍니다.

## 유효기간 계산 로직
1. `VALID_TO`가 없으면 `expiryState='NONE'`, `daysToExpiry=null`.
2. `daysToExpiry = round((VALID_TO 로컬 자정 − 오늘 로컬 자정) / 1일)`.
3. `<0 → EXPIRED`, `0~days → EXPIRING`, 그 외 `VALID`. 목록은 `days=30` 고정, `expiring` API는 쿼리 `days` 사용.
4. 화면 배지는 이 값을 그대로 표시(프론트 재계산 없음).

## 검사 연동 (대조 인터락)
- 후보 선정: `USE_YN='Y'` + (품목 일치 또는 `ITEM_CODE IS NULL`) + (검사유형 일치 또는 `INSPECT_TYPE IS NULL`), `SAMPLE_TYPE IN ('OK','NG')`.
- 필수 견본이 0건이면 대조 대상이 아니므로 통과 처리(소모품 인터락과 같은 관례).
- 필수 견본이 만료·비활성이면 대조 자체가 막히고 검사도 진행되지 않습니다(`blockReason` 반환).
- 판정 단위: 작업지시 × 검사유형 × 검사기 × 조업일 × 교대. 재대조는 갱신이 아니라 새 기록입니다.
- 기대결과 비교(`OK→PASS`, `NG→FAIL`)와 종합판정은 **서버**가 합니다. 프론트 판정을 신뢰하지 않습니다.

## 사전 설정 (마스터·공통코드)
- 공통코드 `LIMIT_SAMPLE_TYPE`(OK/NG), `LIMIT_SAMPLE_STATUS`(ACTIVE/EXPIRED/RETIRED) — 마이그레이션이 MERGE.
- 마스터: 품목(`ITEM_MASTERS`), 공정(`PROCESS_MASTERS`), 불량코드(`DEFECT_CODE_MASTERS`, `/quality/defect-codes/options`).
- 업로드 디렉터리: 백엔드 실행 경로 기준 `./uploads/limit-samples` (없으면 자동 생성). 정적 서빙은 기존 `/uploads` 설정을 그대로 사용.
- 메뉴: `QC_LIMIT_SAMPLE` (QUALITY, SORT_ORDER 7), 권한 MANAGER/OPERATOR.

## 운영 절차
1. 마이그레이션 `2026-09-16_limit_samples.sql` → `2026-09-16_limit_samples_migrate.sql` → `2026-09-16_sample_check_rename.sql` 순서로 적용.
2. 견본 실물에 코드 라벨(바코드)을 붙이고, 같은 코드로 등록 + 사진 업로드.
3. 대조를 걸 견본은 `INSPECT_TYPE`·`REQUIRED_YN='Y'`·`SORT_ORDER`를 지정.
4. 주간 점검: `GET /master/limit-samples/expiring?days=30` 또는 화면 상단 요약으로 대상 확인 → 재승인/폐기 처리.
5. 백업 시 `uploads/limit-samples/` 디렉터리도 포함(DB에는 경로만 있음).

## 권한
품질 관리자(등록/수정/삭제/사진). 작업자 조회. `ROLE_MENU_PERMISSIONS` MANAGER/OPERATOR.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| "이미 존재하는 견본 코드" (409) | 같은 테넌트에 동일 SAMPLE_CODE | 다른 코드 사용 또는 기존 행 수정 |
| 사진 업로드 400 "업로드할 이미지 파일이 없습니다" | 필드명이 `image`가 아니거나 MIME 미허용으로 필터에서 거부 | 이미지 파일(jpeg/png/gif/webp)인지, 5MB 이하인지 확인 |
| 사진 저장 시 ORA-00001 (유니크 위반) | 대표를 `Y`로 올리기 전에 기존 대표를 내리지 않음 | 서버 `updateImageMeta`가 전체 `N` UPDATE 후 올리도록 되어 있음. 직접 SQL로 손댔다면 `IS_PRIMARY='Y'`가 1건인지 확인 |
| 목록 썸네일이 비어 있음 | 사진이 없거나 파일이 지워짐 | `LIMIT_SAMPLE_IMAGES` 행과 실제 파일 존재 확인 |
| 만료 배지가 안 뜸 | `VALID_TO` 미입력 | 유효 종료일 입력 |
| 상단 만료 건수와 목록 배지 수가 다름 | 요약은 `USE_YN='Y'`·`STATUS<>'RETIRED'`만, 목록은 필터에 따름 | 정상 동작 |
| 검사 화면에 견본이 안 나옴 | `USE_YN='N'`이거나 품목·검사유형 불일치 | 품목/검사유형을 비우면 공용으로 나옴 |
| 유형 배지가 코드로 보임 | i18n `comCode.LIMIT_SAMPLE_TYPE.*` 누락 | 4개 locale(ko/en/zh/vi)에 키 추가 |
| 대조 이력에 견본 코드가 빈칸 | 화면이 옛 필드명(`aidCode`)을 읽음 | `sampleCode`/`sampleType`으로 수정 (2026-09-16 리네임) |
| 메뉴가 안 보임 | `MENU_CATEGORY_ITEMS`/`ROLE_MENU_PERMISSIONS` 미등록 | 마이그레이션 5) 블록 확인 |

## 데이터·연계
- 테이블: `LIMIT_SAMPLES`, `LIMIT_SAMPLE_IMAGES`; 파일: `uploads/limit-samples/`
- 참조: `COM_CODES`(`LIMIT_SAMPLE_TYPE`, `LIMIT_SAMPLE_STATUS`, `INSPECT_TYPE`), `ITEM_MASTERS`, `PROCESS_MASTERS`, `DEFECT_CODE_MASTERS`(모두 논리 참조)
- 소비: `INSPECT_SAMPLE_CHECKS` / `INSPECT_SAMPLE_CHECK_ITEMS`(`SAMPLE_CODE`, `SAMPLE_TYPE`)
- 소스: `apps/backend/src/modules/master/{controllers,services,dto}/limit-sample.*`, `apps/backend/src/entities/limit-sample{,-image}.entity.ts`, `apps/frontend/src/app/(authenticated)/master/limit-sample/`, 대조 `apps/backend/src/modules/quality/continuity-inspect/services/inspect-sample-check.service.ts`
- 마이그레이션: `apps/backend/src/migrations/2026-09-16_limit_samples.sql`, `2026-09-16_limit_samples_migrate.sql`, `2026-09-16_sample_check_rename.sql`
- 설계·계획: `docs/specs/2026-09-16-limit-sample-master-design.md`, `docs/plans/2026-09-16-limit-sample-master.md`
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
