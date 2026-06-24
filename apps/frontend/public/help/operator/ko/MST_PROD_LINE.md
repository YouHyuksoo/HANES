---
menuCode: MST_PROD_LINE
audience: operator
title: 생산라인관리 — 운영 가이드
summary: 생산라인마스터(PROD_LINE_MASTERS) 전체 컬럼 DB 매핑, CRUD API, 자연키/중복 처리, 권한, 멀티테넌시 스코프
tags: [기준정보, 생산라인, 마스터, 운영]
keywords: [PROD_LINE_MASTERS, LINE_CODE, LINE_NAME, OPER, LINE_TYPE, WH_LOC, ERP_CODE, USE_YN, 자연키, 복합PK, COMPANY, PLANT_CD, 멀티테넌시, prod-lines]
related: [MST_PART]
---

# 생산라인관리 — 운영 가이드

## 시스템 목적·역할
공정에 속한 물리적 생산라인의 기준정보를 보유하는 **마스터 테이블 `PROD_LINE_MASTERS`** 관리 화면입니다. 작업지시·생산실적·설비 배치·창고 연계가 `LINE_CODE`로 이 마스터를 참조합니다.

## 데이터 구조
```
PROD_LINE_MASTERS (PK: LINE_CODE, COMPANY, PLANT_CD)
   ├─ OPER     ──▶ ERP 공정코드(라인이 속한 공정)
   ├─ WH_LOC   ──▶ 창고 로케이션 연계
   └─ 참조: 작업지시 / 생산실적 / 설비배치
```
- PK는 자연키 복합키 `(LINE_CODE, COMPANY, PLANT_CD)`입니다(`@PrimaryGeneratedColumn` 미사용).

## ① 생산라인 — PROD_LINE_MASTERS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| **라인코드(lineCode)** | `LINE_CODE` | PK 구성(자연키). 불변 권장 — 작업지시·실적 연결 무결성. 수정 시 입력칸 잠김. 최대 50자(DTO 검증 20자). |
| **라인명(lineName)** | `LINE_NAME` | 현장 표시명. 필수. 검색 대상(`LIKE`). |
| **공정코드(oper)** | `OPER` | 라인이 매핑되는 ERP 공정코드. 인덱스(`@Index`) 존재. 검색 대상. |
| **라인유형(lineType)** | `LINE_TYPE` | 조립/포장 등 라인 분류(예: `PACKING`). 목록 배지 표시. 인덱스 존재. multi 필터. |
| **창고위치(whLoc)** | `WH_LOC` | 라인 기본 창고 로케이션. 입출고 연계. |
| **ERP코드(erpCode)** | `ERP_CODE` | ERP 라인 연계 코드. ERP 매칭용. |
| **비고(remark)** | `REMARK` | 메모. 최대 500자. |
| **사용여부(useYn)** | `USE_YN` | `Y`만 활성(목록 초록 점), `N`은 중지(회색 점). 기본값 `Y`. |
| **감사** | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 생성/수정 이력. 그리드 정렬 기준은 `CREATED_AT DESC`(표시 SQL), API 정렬은 `LINE_CODE ASC`. |
| **멀티테넌시** | `COMPANY`, `PLANT_CD` | PK 구성. `40` / `1000` 스코프. |

## 사전 설정
- 별도 공통코드·선행 마스터 의존성은 없습니다(라인유형·공정코드는 자유 입력 텍스트).
- 라인을 사용하는 작업지시·실적·설비배치 화면이 이 라인코드를 선택하므로, 라인은 해당 업무 전에 선행 등록되어야 합니다.

## 운영 절차
1. **조회**: `GET /master/prod-lines` — 회사/공장 스코프 + `search`(LINE_CODE/LINE_NAME LIKE) 필터. 프론트는 `limit=5000`으로 일괄 조회.
2. **등록**: `POST /master/prod-lines` — 동일 스코프에 같은 `LINE_CODE` 존재 시 409 Conflict(`이미 존재하는 라인 코드입니다`).
3. **수정**: `PUT /master/prod-lines/:lineCode` — `LINE_CODE`는 변경 불가, 전달된 필드만 부분 업데이트.
4. **삭제**: `DELETE /master/prod-lines/:lineCode` — 대상 없으면 404. 물리 삭제이므로 참조(작업지시·실적) 확인 후 수행, 이력 보존이 필요하면 `USE_YN='N'` 권장.

## 권한
기준정보 관리자(등록/수정/삭제). 일반 사용자는 조회. AI 채팅 페이지 도구(`master.prod-line`)로 등록/수정/삭제 write 도구가 백엔드에서 실행될 수 있음.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 저장 시 `이미 존재하는 라인 코드` 오류 | 동일 스코프에 같은 `LINE_CODE` 존재 | 다른 코드 사용 또는 기존 행 수정 |
| 라인코드 입력칸이 잠겨 수정 불가 | 자연키(불변) 정책 | 삭제 후 재등록(참조 확인) |
| 저장 버튼을 눌러도 반응 없음 | `LINE_CODE` 또는 `LINE_NAME` 미입력 | 필수 두 항목 입력(프론트가 빈 값이면 저장 차단) |
| 삭제했는데 404 | 해당 스코프에 라인 없음 | `COMPANY/PLANT_CD` 스코프·라인코드 확인 |
| 목록에 라인이 안 보임 | 검색어 잔존 또는 다른 회사/공장 스코프 | 검색창 비우고 새로고침, 헤더 스코프 확인 |

## 데이터·연계
- 테이블: `PROD_LINE_MASTERS`
- API: `/master/prod-lines` (GET 목록/상세, POST/PUT/DELETE) — `ProdLineController`, `ProdLineService`, `prod-line.dto.ts`
- 연계: 작업지시·생산실적·설비 배치(라인 선택), 창고 로케이션(`WH_LOC`), ERP(`OPER`/`ERP_CODE`)
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
