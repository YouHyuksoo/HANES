---
menuCode: MST_BOM
audience: operator
title: BOM관리 — 운영 가이드
summary: BOM_MASTERS 전체 컬럼·복합키(적용일 기준), 재귀 전개, 엑셀 업로드, 중복 판정 로직, 라우팅 연계, 트러블슈팅
tags: [기준정보, BOM, 자재명세서, 운영]
keywords: [BOM_MASTERS, PARENT_ITEM_CODE, CHILD_ITEM_CODE, VALID_FROM, REVISION, QTY_PER, OPER, 재귀전개, 엑셀업로드, 중복판정, ECO_NO, 멀티테넌시]
related: [MST_PART, MST_ROUTING]
---

# BOM관리 — 운영 가이드

## 시스템 목적·역할
상위-자품목 구성을 정의하는 **`BOM_MASTERS`** 관리 화면입니다. 생산 시 자재 소요량 전개(필요량 계산)·투입의 기준이며, 자기참조(자품목이 다시 상위품목) 구조로 다단계 BOM을 표현합니다. **2026-07-03 변경**: 복합키가 리비전 기준에서 **적용일(VALID_FROM) 기준**으로 바뀌어, 같은 상위+자품목 조합도 적용일이 다르면 여러 버전으로 공존할 수 있습니다.

## 데이터 구조
```
BOM_MASTERS (복합 PK: COMPANY + PLANT_CD + PARENT_ITEM_CODE + CHILD_ITEM_CODE + VALID_FROM)
   ├─ PARENT_ITEM_CODE ─▶ ITEM_MASTERS (상위품목)
   └─ CHILD_ITEM_CODE  ─▶ ITEM_MASTERS (자품목) ─▶ (자품목이 상위로 재귀) BOM_MASTERS
```
- **복합 PK**: `COMPANY + PLANT_CD + PARENT_ITEM_CODE + CHILD_ITEM_CODE + VALID_FROM` (UUID id 없음). **`REVISION`은 더 이상 PK가 아닙니다** — 표시용 일반 컬럼(nullable, 기본 `A`).
- 프론트 복합키 표기: `parentItemCode::childItemCode::validFrom(YYYY-MM-DD)` (예: `N91H00-X9800-C1::1SH21A7A09::2026-07-03`). 조회/수정/삭제 API의 `:id` 경로 파라미터가 이 형식입니다.
- 트리 조회 API: `GET /master/boms/hierarchy/:parentItemCode` (Oracle `CONNECT BY`로 재귀 전개, `depth`·`effectiveDate` 쿼리 지원).

## ① BOM 자재 구조 — BOM_MASTERS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 의미 · 운영 포인트 |
|------|------|------|
| 상위품목 | `PARENT_ITEM_CODE` | PK. `ITEM_MASTERS.ITEM_CODE` 참조. |
| 자품목코드 | `CHILD_ITEM_CODE` | PK. `ITEM_MASTERS.ITEM_CODE` 참조. |
| 적용일 | `VALID_FROM` | **PK(NOT NULL)**. DATE. 같은 상위+자품목 조합의 버전을 구분하는 키. |
| 완료일 | `VALID_TO` | DATE, nullable. 적용 종료일(기간 외 미적용). |
| 리비전 | `REVISION` | 길이10, nullable, 기본 `A`. **PK 아님** — 사양 라벨용 일반 속성. 자유롭게 변경 가능. |
| 소요량 | `QTY_PER` | NUMBER(10,4). 상위품목 1개당 자품목 수량. |
| 순번 | `SEQ` | 표시/처리 순서(기본 0). |
| BOM 그룹 | `BOM_GRP` | 그룹 분류(인덱스 존재). |
| 공정 | `OPER` | 투입 공정코드(엔티티 필드명 `processCode`). |
| 사이드 | `SIDE` | 공통코드 `BOM_SIDE`: `N`(N/A) / `L`(좌) / `R`(우). |
| ECO 번호 | `ECO_NO` | 설계변경 추적 번호(폼에는 미노출, 엑셀 업로드만 지원). |
| 비고 | `REMARK` | 메모. |
| 사용여부 | `USE_YN` | Y만 유효 구성으로 조회(하드 삭제 아님, 트리/목록 API는 `USE_YN='Y'`만 조회). |
| 자품목명/유형 | (조인) | `ITEM_MASTERS.ITEM_NAME / ITEM_TYPE` — 표시·재귀전개 판단용(BOM_MASTERS에는 없음). |
| 레벨(Lv) | (계산) | 트리 깊이. Oracle `LEVEL` 의사컬럼, 저장값 아님. |
| 감사 | `CREATED_BY/UPDATED_BY/CREATED_AT/UPDATED_AT` | 이력. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | PK 포함. `40` / `1000` 스코프. |

## 버튼·API·상태 전이

| 버튼/액션 | API 또는 서비스 | 허용 조건 | 결과 상태 / DB 영향 |
|------|------|------|------|
| 왼쪽 목록 조회 | `GET /master/boms/parents?search=&effectiveDate=` | - | `BOM_MASTERS`를 상위품목 기준 GROUP BY, `bomCount`·`revisions` 집계 |
| 트리 조회 | `GET /master/boms/hierarchy/:parentItemCode?depth=&effectiveDate=` | - | `CONNECT BY PRIOR`로 재귀. `effectiveDate` 있으면 `VALID_FROM<=date AND (VALID_TO IS NULL OR VALID_TO>=date)` 필터 |
| BOM 추가 | `POST /master/boms` (`BomService.create`) | 상위≠자품목, `validFrom` 필수 | 같은 상위+자품목+적용일 존재 시 **409** "동일 상위·하위 품목에 같은 적용일자의 BOM이 이미 존재합니다." 통과 시 INSERT |
| BOM 수정 | `PUT /master/boms/:id` (`id=parent::child::validFrom`) | 대상 존재 | `validFrom`을 변경하면 같은 상위+자품목의 **다른** 행과 겹치는지 재검사(겹치면 409) 후 UPDATE. `revision`은 자유 변경 |
| BOM 삭제 | `DELETE /master/boms/:id` | 대상 존재 | 물리 DELETE(1행) |
| 엑셀 업로드 미리보기 | `POST /master/boms/upload/preview` (multipart) | - | 행별로 `new`/`duplicate_db`/`duplicate_file`/`error` 판정만 하고 DB에 쓰지 않음 |
| 엑셀 업로드 실행 | `POST /master/boms/upload` (multipart) | 미리보기에서 중복 0건 | 신규 판정 행만 INSERT, 판정 로직은 미리보기와 동일 |
| 폼 다운로드 | `GET /master/boms/template` | - | 빈 xlsx(헤더만, `BOM_template.xlsx`) |
| 내보내기 | `GET /master/boms/export?parentItemCode=` | - | `USE_YN='Y'` 행을 xlsx로 스트리밍 |
| 라우팅이동 | `GET /master/routing-groups/by-item/:itemCode` | - | 조회 전용, `/master/routing?itemCode=` 이동도 가능 |

## 중복 판정 로직
등록/수정/업로드 3경로 모두 **동일한 단일 규칙**을 쓴다(`bom.service.ts`의 `toDateOnly`로 날짜를 `YYYY-MM-DD`로 정규화 후 비교):

- **중복 키 = 상위품목코드 + 하위품목코드 + 적용일(VALID_FROM)**. 리비전은 이 판정에 관여하지 않는다.
- **등록(`create`)**: 같은 상위+자품목의 기존 행 중 적용일이 같은 게 있으면 즉시 409.
- **수정(`update`)**: `validFrom`을 다른 날짜로 바꿀 때만 같은 상위+자품목의 형제 행들과 재검사. 같은 날짜 유지·리비전만 변경하는 건 제약 없음.
- **엑셀 미리보기(`previewUpload`)**: 파일 내에서 같은 키가 두 번 나오면 `duplicate_file`, DB에 이미 있으면 `duplicate_db`. 미리보기 화면은 **중복이 1건이라도 있으면 업로드 자체를 막는다**(전체 차단, 부분 업로드 아님).
- **엑셀 업로드 실행(`uploadFromExcel`)**: 미리보기와 동일 키로 DB 기존 행 스킵(스킵 카운트 증가), 신규 키만 INSERT. 상위/자품목코드가 `ITEM_MASTERS`에 없으면 행 단위 에러로 기록하고 계속 진행.
- 날짜 비교는 **로컬(KST) 날짜 문자열** 기준이다. 과거에 `toISOString().slice(0,10)`로 자르던 방식은 KST 오전 시간대에 -1일 밀리는 버그가 있었고, 지금은 `getTodayLocal`/`formatDateOnly` 계열 유틸로 통일되어 있다.

## 사전 설정 (마스터·공통코드)
- `ITEM_MASTERS`에 상위/자품목이 먼저 등록되어야 함.
- 공정코드(`OPER`)는 라우팅관리(공정마스터) 기준.
- 사이드(`SIDE`)는 공통코드 `BOM_SIDE`(N/L/R) — 시스템관리 > 공통코드에서 관리.

## 운영 절차
1. 왼쪽 목록에서 상위품목 선택 → 오른쪽 트리에서 자품목 등록/수정/삭제.
2. 다건 등록은 폼 다운로드 → 엑셀 작성 → 업로드(미리보기 필수 통과) 순서.
3. 사양 변경(설계변경)이 있으면 **기존 행을 수정하지 말고, 적용일을 새 날짜로 한 새 행을 추가**해 이전 버전을 이력으로 남기는 걸 권장한다(리비전 라벨도 같이 올려 구분).
4. 기준일 이력 조회로 특정 시점의 실제 적용 구성을 검증할 수 있다("전체이력" 토글로 모든 버전 확인).

## 권한
기준정보 관리자(등록/수정/삭제/업로드). 일반 사용자는 조회.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 자품목 추가 시 코드 오류 | 자품목이 `ITEM_MASTERS`에 없음 | 품목마스터에 먼저 등록 |
| BOM 추가/수정 시 409(중복) | 같은 **상위+자품목+적용일** 조합이 이미 존재 | 적용일을 다르게 하거나 기존 행을 수정 (리비전만 바꿔서는 회피 불가) |
| 엑셀 업로드에서 업로드 버튼이 안 뜸 | 미리보기 `duplicateCount > 0` | 파일에서 `duplicate_db`/`duplicate_file` 행의 적용일 또는 값을 수정 후 재선택 |
| 트리에 자품목이 안 펼쳐짐 | 자품목 자체의 BOM 미등록 | 자품목을 상위품목으로 하위 BOM 등록 |
| 생산 전개 수량이 안 맞음 | `QTY_PER` 오입력 / 유효기간(`VALID_FROM~VALID_TO`) 외 | 소요량·적용일/완료일 확인, 기준일자를 문제 시점으로 맞춰 재조회 |
| 구성이 조회에 안 나옴 | `USE_YN='N'` 또는 기준일자가 유효기간 밖 | `USE_YN`·적용일/완료일 점검, "전체이력"으로 전환해 확인 |
| 방금 등록한 행이 기본 기준일자로 안 보임 | 등록한 적용일이 오늘보다 미래/과거 | 기준일자를 해당 적용일로 변경하거나 전체이력 조회 |

## 데이터·연계
- 테이블: `BOM_MASTERS`
- 연계: 품목마스터(`ITEM_MASTERS`), 공정/라우팅(`OPER`, `/master/routing-groups/by-item`), 생산 소요량 전개
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
- 관련 소스: `apps/backend/src/modules/master/services/bom.service.ts`, `apps/backend/src/entities/bom-master.entity.ts`, `apps/frontend/src/app/(authenticated)/master/bom/`
