---
menuCode: QC_TERMINAL_CRIMP_SPEC
audience: operator
title: 단자별 압착 규격 — 운영 가이드
summary: TERMINAL_CRIMP_SPECS 테이블의 전체 컬럼·DB 매핑, CRUD·resolve API, 시퀀스 채번, 공통코드 TERMINAL_TYPE, 멀티테넌시와 트러블슈팅
tags: [품질, 기준정보, 압착, 운영]
keywords: [TERMINAL_CRIMP_SPECS, SEQ_TERMINAL_CRIMP_SPEC, TERMINAL_TYPE, CRIMP_HEIGHT_LSL, CRIMP_HEIGHT_USL, CRIMP_WIDTH, INS_CRIMP_HEIGHT, PULL_FORCE_MIN, STRIP_LENGTH, APPLICATOR_CODE, resolve, terminal-crimp-specs, 유니크제약, 멀티테넌시, 트러블슈팅]
related: [MST_PART, QC_SELF_INSPECT_HISTORY, QC_CONTROL_PLAN]
---

# 단자별 압착 규격 — 운영 가이드

## 시스템 목적·역할
단자 품목 × 전선 사이즈별 압착 상하한을 **단일 마스터**로 보관합니다. 기존 `PROCESS_MAPS.CRIMP_HEIGHT`(공정 조건값)와 `CONTROL_PLAN_ITEMS.SPECIFICATION`(자유 텍스트)은 판정 기준으로 쓰기 어려워, 고객 감사(11P·12P) 대응으로 신설했습니다. 자주검사·계측 수신 판정은 `GET /master/terminal-crimp-specs/resolve`로 이 마스터를 조회하도록 열어 두었고, 검사 화면 연동 자체는 후속 범위입니다.

## 데이터 구조
```
ITEM_MASTERS (단자 품목 / 전선 품목, ITEM_TYPE=RAW_MATERIAL)
        │ TERMINAL_ITEM_CODE / WIRE_ITEM_CODE (논리 참조, FK 없음)
        ▼
TERMINAL_CRIMP_SPECS (PK SPEC_ID, UK COMPANY+PLANT_CD+TERMINAL_ITEM_CODE+WIRE_SIZE)
        │ TERMINAL_TYPE → COM_CODES GROUP_CODE='TERMINAL_TYPE'
        ▼
(후속) 자주검사·계측 판정 → GET /resolve?terminalItemCode&wireSize
```

---

## ① 압착 규격 — TERMINAL_CRIMP_SPECS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| (숨김) | `SPEC_ID` | PK. `SEQ_TERMINAL_CRIMP_SPEC.NEXTVAL`로 채번(MAX+1 금지). 화면 URL·수정/삭제 API 경로에 사용. |
| 단자 품목 | `TERMINAL_ITEM_CODE` | NOT NULL. `ITEM_MASTERS.ITEM_CODE` 논리 참조(FK 없음). PartSelect(RAW)로만 입력. |
| 단자 종류 | `TERMINAL_TYPE` | NULL 허용. 공통코드 `TERMINAL_TYPE`(DISK/RING/FASTON/PIN/SOCKET). 분류·필터용. |
| 전선 사이즈 | `WIRE_SIZE` | NOT NULL. 자유 표기(`0.5SQ`, `AWG20`). UK 구성 컬럼 — 표기 흔들림(`0.5SQ` vs `0.5 SQ`)은 중복으로 잡히지 않으니 현장 표기 표준을 정한다. |
| 전선 품목 | `WIRE_ITEM_CODE` | NULL 허용. `ITEM_MASTERS` 논리 참조. |
| 압착고 하한/상한 | `CRIMP_HEIGHT_LSL` / `CRIMP_HEIGHT_USL` | NUMBER(10,3), mm. 둘 다 NULL이면 화면 `-`. |
| 압착폭 하한/상한 | `CRIMP_WIDTH_LSL` / `CRIMP_WIDTH_USL` | NUMBER(10,3), mm. |
| 절연부 압착고 하한/상한 | `INS_CRIMP_HEIGHT_LSL` / `INS_CRIMP_HEIGHT_USL` | NUMBER(10,3), mm. |
| 인장력 최소 | `PULL_FORCE_MIN` | NUMBER(10,3), N. 단일 하한. |
| 탈피길이 최소/최대 | `STRIP_LENGTH_MIN` / `STRIP_LENGTH_MAX` | NUMBER(10,3), mm. |
| 어플리케이터 | `APPLICATOR_CODE` | VARCHAR2(50), NULL 허용. 검색 대상. |
| 비고 | `REMARK` | VARCHAR2(500). |
| 사용여부 | `USE_YN` | CHAR(1) DEFAULT 'Y', CHECK(Y/N). `resolve`는 `Y`만 반환. |
| 감사 컬럼 | `CREATED_BY`/`UPDATED_BY`/`CREATED_AT`/`UPDATED_AT` | `*_AT`은 DB DEFAULT SYSTIMESTAMP. `*_BY`는 JWT 사용자 id(없으면 `SYSTEM`). |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | UK 일부. `COMPANY='40'`, `PLANT_CD='1000'` 스코프. 모든 API가 헤더/JWT의 테넌트로 필터. |

제약·인덱스: `PK_TERMINAL_CRIMP_SPECS(SPEC_ID)`, `UK_TERMINAL_CRIMP_SPECS(COMPANY,PLANT_CD,TERMINAL_ITEM_CODE,WIRE_SIZE)`, `CK_TERMINAL_CRIMP_USE_YN`, `IX_TERMINAL_CRIMP_TERMINAL(COMPANY,PLANT_CD,TERMINAL_ITEM_CODE)`.

---

## 버튼·API·상태 전이

| 버튼/액션 | API | 허용 조건 | 결과 / DB 영향 |
|------|------|------|------|
| 목록 조회·필터·페이징 | `GET /master/terminal-crimp-specs?page&limit&search&terminalType&wireSize&terminalItemCode&useYn` | — | 읽기. 정렬 TERMINAL_ITEM_CODE, WIRE_SIZE. 검색은 단자품목/전선사이즈/전선품목/어플리케이터 UPPER LIKE. |
| 저장(신규) | `POST /master/terminal-crimp-specs` | 단자품목·전선사이즈 필수, LSL≤USL(프론트), 조합 미중복 | INSERT. 중복이면 **409**. `SPEC_ID`는 시퀀스. |
| 저장(수정) | `PUT /master/terminal-crimp-specs/:specId` | 대상 존재 | UPDATE. 단자품목/전선사이즈 변경 시 다른 행과 중복이면 409. |
| 휴지통 | `DELETE /master/terminal-crimp-specs/:specId` | 대상 존재 | 물리 삭제. 이력 보존이 필요하면 `USE_YN='N'` 권장. |
| 상세 | `GET /master/terminal-crimp-specs/:specId` | — | 읽기(404 없음). |
| (연동용) 규격 해석 | `GET /master/terminal-crimp-specs/resolve?terminalItemCode&wireSize` | 두 파라미터 필수 | `USE_YN='Y'` 1건 또는 **null**. null이면 호출측이 "규격 미등록"으로 명시 처리해야 하며 추측 fallback 금지. |

상태 전이는 없습니다(마스터). 사용여부 Y/N만 있습니다.

## 채번·중복 로직
- `SPEC_ID`: 서비스가 `SELECT SEQ_TERMINAL_CRIMP_SPEC.NEXTVAL FROM DUAL`로 받아 INSERT. 시퀀스가 없으면 `ORA-02289` — 마이그레이션 `2026-09-09_terminal_crimp_specs.sql` 적용 여부 확인.
- 중복 판정은 서비스에서 `(COMPANY, PLANT_CD, TERMINAL_ITEM_CODE, WIRE_SIZE)` 조회 후 409, DB UK가 최종 방어.

## 사전 설정 (마스터·공통코드)
- 공통코드 `TERMINAL_TYPE`: 마이그레이션이 DISK/RING/FASTON/PIN/SOCKET 5종을 MERGE. 추가 종류는 [공통코드 관리]에서 등록(김종현 책임 확인 후).
- 품목: `ITEM_MASTERS` `ITEM_TYPE='RAW_MATERIAL'`, `USE_YN='Y'`인 단자·전선 품목(PartSelect partType=RAW 목록 기준).
- 메뉴: `QC_TERMINAL_CRIMP_SPEC` (QUALITY, SORT_ORDER 5), 권한 MANAGER/OPERATOR `CAN_ACCESS='Y'`.

## 운영 절차
1. 마이그레이션 적용 → `USER_TABLES`에 `TERMINAL_CRIMP_SPECS`, `USER_SEQUENCES`에 `SEQ_TERMINAL_CRIMP_SPEC` 확인.
2. `TERMINAL_TYPE` 공통코드 5종 확인, 필요 시 추가.
3. 단자 제조사 규격서 기준으로 조합별 규격 입력. 전선 사이즈 표기 표준(예: `0.5SQ`)을 먼저 정한다.
4. 변경 시 삭제보다 사용여부 N + 신규 행을 권장(감사 추적).

## 권한
품질 관리자(등록/수정/삭제). 작업자는 조회. 메뉴 권한은 `ROLE_MENU_PERMISSIONS`.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 저장 시 "이미 등록된 단자·전선 조합" (409) | 같은 테넌트에 동일 단자품목+전선사이즈 존재 | 기존 행을 수정하거나 사이즈 표기 확인 |
| 저장 시 500 `ORA-02289` | 시퀀스 미생성 | 마이그레이션 SQL 재적용 |
| 단자 종류 드롭다운 비어 있음 | `COM_CODES` `TERMINAL_TYPE` 미시드 또는 다른 테넌트 | 마이그레이션 3) 블록 재실행, COMPANY/PLANT_CD 확인 |
| 품목 드롭다운에 단자가 없음 | `ITEM_TYPE`이 RAW_MATERIAL이 아니거나 `USE_YN='N'` | 품목마스터 수정 |
| 저장 버튼 비활성 | 필수 누락 또는 LSL>USL | 입력값 확인 |
| 메뉴가 안 보임 | `MENU_CATEGORY_ITEMS`/`ROLE_MENU_PERMISSIONS` 미등록 | 마이그레이션 4) 블록 확인 |

## 데이터·연계
- 테이블: `TERMINAL_CRIMP_SPECS`; 시퀀스 `SEQ_TERMINAL_CRIMP_SPEC`
- 참조: `ITEM_MASTERS`(논리), `COM_CODES`(`TERMINAL_TYPE`)
- 소스: `apps/backend/src/modules/master/{controllers,services,dto}/terminal-crimp-spec.*`, `apps/backend/src/entities/terminal-crimp-spec.entity.ts`, `apps/frontend/src/app/(authenticated)/master/terminal-crimp-spec/`
- 마이그레이션: `apps/backend/src/migrations/2026-09-09_terminal_crimp_specs.sql`
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
