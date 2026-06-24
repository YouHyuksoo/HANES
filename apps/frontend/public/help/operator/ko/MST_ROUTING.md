---
menuCode: MST_ROUTING
audience: operator
title: 라우팅관리 — 운영 가이드
summary: 라우팅 그룹·공정순서·양품조건·투입자재·자주검사 4개 하위 테이블의 DB 매핑, 채번·일괄저장 동작, 권한, 트러블슈팅, 멀티테넌시 스코프
tags: [기준정보, 라우팅, 공정순서, 마스터, 운영]
keywords: [ROUTING_GROUPS, ROUTING_PROCESSES, PROCESS_QUALITY_CONDITIONS, ROUTING_MATERIALS, SELF_INSPECT_ITEMS, 라우팅, 공정순서, 양품조건, 투입자재, 자주검사, BACKFLUSH, PRE_ISSUE, EQUIP_INTERFACE_YN, ISSUE_SG_LABEL_YN, ISSUE_FG_LABEL_YN, 멀티테넌시, COMPANY, PLANT_CD]
related: [MST_PART, MST_PROCESS]
---

# 라우팅관리 — 운영 가이드

## 시스템 목적·역할
완제품·반제품의 **공정 라우팅(작업 순서)**과 공정별 품질·자재 기준을 보유하는 마스터입니다. 라우팅 그룹(`ROUTING_GROUPS`)을 정점으로, 공정순서·양품조건·투입자재·자주검사가 계층으로 연결됩니다. 생산 작업지시·실적·설비투입·검사가 이 라우팅을 참조합니다.

## 데이터 구조
```
ROUTING_GROUPS (PK: COMPANY, PLANT_CD, ROUTING_CODE)   ← 완제품 1건당 라우팅
   ├─ ROUTING_PROCESSES (PK: …, ROUTING_CODE, SEQ)     ← 공정순서
   │     ├─ PROCESS_QUALITY_CONDITIONS (…, SEQ, CONDITION_SEQ)  ← 양품조건
   │     └─ ROUTING_MATERIALS (…, SEQ, CHILD_ITEM_CODE)         ← 투입자재(BOM 연결)
   └─ (참조) PROCESS_MASTERS                            ← PROCESS_CODE
SELF_INSPECT_ITEMS (PK: ID)                            ← 자주검사, PROCESS_CODE 기준(라우팅 비종속)
```
- 화면 좌측 BOM 트리는 `GET /master/boms/hierarchy/:itemCode`로 전개하며, 트리에서 선택한 품목코드로 `GET /master/routing-groups/by-item/:itemCode`를 호출해 라우팅+공정을 가져옵니다.
- 라우팅 목록은 `itemType=FINISHED`, `useYn=Y` 조건으로만 조회합니다.

## ① 라우팅 그룹 — ROUTING_GROUPS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 라우팅코드 | `ROUTING_CODE` | PK 구성. 불변 권장. 신규 공정 추가 시 라우팅이 없으면 **itemCode를 routingCode로** 자동 생성. |
| 라우팅명 | `ROUTING_NAME` | 표시명. 필수. |
| 연결 품목 | `ITEM_CODE` | 라우팅 대상 완제품. `by-item` 조회 키. |
| 설명 | `DESCRIPTION` | 비고. |
| 사용여부 | `USE_YN` | Y만 목록 노출(조회 시 `useYn=Y` 고정). |
| 감사 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 생성/수정 이력. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | PK 구성. `40` / `1000` 스코프. |

## ② 공정순서 — ROUTING_PROCESSES (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 순서 | `SEQ` | PK 구성. 보통 10 간격. 신규는 `MAX(SEQ)+10`. 수정 시 변경 불가. |
| 공정코드 | `PROCESS_CODE` | `PROCESS_MASTERS` 참조. 화면 셀렉트에서 선택. |
| 공정명 | `PROCESS_NAME` | 공정코드 선택 시 마스터 이름으로 자동 채움(직접 입력 불가). |
| 공정유형 | `PROCESS_TYPE` | 공통코드 PROCESS_TYPE. 공정코드에서 파생(읽기 전용 표시). |
| 설비유형 | `EQUIP_TYPE` | 공통코드 EQUIP_TYPE. |
| 표준시간 | `STD_TIME` | NUMBER(10,4), 초. CAPA/계획 산출. |
| 셋업시간 | `SETUP_TIME` | NUMBER(10,4), 초. 준비/교체 시간. |
| 공정샘플검사 | `SAMPLE_INSPECT_YN` | Y=샘플검사 필요 표시(기본 N). |
| 라벨발행 SG | `ISSUE_SG_LABEL_YN` | Y=공정 완료 시 반제품 라벨(SG) 발행 지점(기본 N). |
| 라벨발행 FG | `ISSUE_FG_LABEL_YN` | Y=공정 완료 시 완제품 라벨(FG) 발행 지점(기본 N). |
| (미노출) 자주검사 | `QC_SELF_YN` | 자주검사 사용 플래그(기본 N). 현재 화면 폼에서 직접 편집하지 않음. |
| (미노출) 검사방법 | `INSPECT_METHOD` | 기본 DIRECT. |
| (미노출) 파괴검사 | `DESTRUCTIVE_YN` | 기본 N. |
| (미노출) 시료수 | `SAMPLE_QTY` | 기본 1. |
| 사용여부 | `USE_YN` | 저장 시 Y 고정. |
| 감사 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 생성/수정 이력. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | PK 구성. `40` / `1000`. |

## ③ 양품조건 — PROCESS_QUALITY_CONDITIONS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| (순번) | `CONDITION_SEQ` | PK 구성(ROUTING_CODE+SEQ+CONDITION_SEQ). 일괄 저장 시 **1부터 재부여**. |
| 양품조건 | `CONDITION_CODE` | 공통코드 QUALITY_CONDITION. 검사 항목 식별. |
| 수치(MIN) | `MIN_VALUE` | NUMBER(10,2). 합격 하한. null=하한 없음. |
| 수치(MAX) | `MAX_VALUE` | NUMBER(10,2). 합격 상한. null=상한 없음. |
| 단위 | `UNIT` | 공통코드 UNIT_TYPE. |
| 설비 I/F | `EQUIP_INTERFACE_YN` | Y=설비에서 측정값 자동 수신 대상(기본 N). |
| 사용여부 | `USE_YN` | 기본 Y. |
| 감사/테넌시 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT`, `COMPANY`, `PLANT_CD` | 이력 + `40`/`1000` 스코프. |

> 저장 동작: `PUT /master/routing-groups/:code/processes/:seq/conditions/bulk` — 전체 행을 받아 **전량 교체(delete-insert 형)**로 저장합니다. 화면에서 행을 지우고 저장하면 DB에서도 사라집니다.

## ④ 투입자재 — ROUTING_MATERIALS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 자재 | `CHILD_ITEM_CODE` | PK 구성(ROUTING_CODE+SEQ+CHILD_ITEM_CODE). 라우팅 품목 BOM의 자재. |
| 회로사양 | `CIRCUIT_ID` | 전선류 회로 연결(`CIRCUITS` 등 참조). null=미연결. 길이/Strip은 회로에서 파생 표시. |
| 투입수량 | `ALLOC_QTY` | NUMBER(10,4). 공정 투입(차감) 수량. 기본은 BOM 소요량. |
| 투입방식 | `ISSUE_METHOD` | BACKFLUSH(실적 시 자동 차감) / PRE_ISSUE(선투입). 기본 BACKFLUSH. |
| 사용여부 | `USE_YN` | 기본 Y. |
| 감사/테넌시 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT`, `COMPANY`, `PLANT_CD` | 이력 + `40`/`1000` 스코프. |

> 저장 동작: `PUT …/materials/bulk` — **선택(체크)된 자재만** 전송해 전량 교체 저장. 체크 해제 후 저장하면 해당 자재가 제거됩니다. 후보 목록은 라우팅 품목의 BOM 자재를 기준으로 채워집니다.

## ⑤ 자주검사 — SELF_INSPECT_ITEMS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| (PK) | `ID` | UUID 자동 생성. |
| 공정코드 | `PROCESS_CODE` | **라우팅이 아닌 공정코드 기준**. 같은 공정을 쓰는 모든 라우팅에 공유됨. |
| 항목명 | `ITEM_NAME` | 검사 항목명. 필수(빈 값 저장 차단). |
| 기준/규격 | `STANDARD` | 기준 설명(선택). |
| 검사방법 | `INSPECT_METHOD` | DIRECT(직접) / DELEGATE(의뢰). 기본 DIRECT. |
| 시점 | `TIMING` | FIRST/MID/LAST 콤마 구분 복수. 기본 MID. |
| 파괴 | `IS_DESTRUCTIVE` | 파괴검사 여부(boolean). |
| 순서 | `SORT_ORDER` | 정렬 순서. |
| 사용여부 | `USE_YN` | Y/N. |
| 유형 | `ITEM_TYPE` | VISUAL(판정형) / MEASURE(측정형). 기본 VISUAL. |
| 단위 | `UNIT` | 측정형 단위. |
| 하한규격 | `LSL_VALUE` | 측정형 하한(NUMBER). |
| 상한규격 | `USL_VALUE` | 측정형 상한(NUMBER). |
| 샘플수 | `SAMPLE_COUNT` | 초물 시점 시료 수(MID/LAST는 1). 기본 1. |
| 감사/테넌시 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT`, `COMPANY`, `PLANT_CD` | 이력 + `40`/`1000` 스코프. |

> 저장 동작: 양품조건·투입자재와 달리 **행 단위 CRUD**입니다. 신규 `POST /production/self-inspect/items`, 수정 `PUT …/items/:id`, 삭제 `DELETE …/items/:id`. 조회는 `GET /production/self-inspect/items/all?processCode=…`.

## 저장 방식 요약
| 탭 | 단위 | 엔드포인트 | 주의 |
|------|------|------|------|
| 양품조건 | 일괄(전량 교체) | `PUT …/processes/:seq/conditions/bulk` | 행 삭제 후 저장 시 DB 삭제, CONDITION_SEQ 재부여 |
| 투입자재 | 일괄(선택분만) | `PUT …/processes/:seq/materials/bulk` | 체크 해제분은 제거 |
| 자주검사 | 행 단위 | `POST/PUT/DELETE /production/self-inspect/items` | 공정코드 기준 공유 |

## 사전 설정 (마스터·공통코드)
- 마스터: 품목마스터(`ITEM_MASTERS`, 라우팅 품목·BOM 자재), 공정마스터(`PROCESS_MASTERS`, 공정코드), BOM(트리 전개).
- 공통코드: `PROCESS_TYPE`, `EQUIP_TYPE`, `QUALITY_CONDITION`, `UNIT_TYPE`.
- 라우팅 등록 전 대상 완제품의 **BOM**이 있어야 BOM 트리·투입자재 후보가 채워집니다.

## 운영 절차
1. 완제품 라우팅 그룹 생성(또는 공정 추가 시 자동 생성).
2. BOM 트리에서 완제품/반제품 선택 → 공정순서 등록(10 간격 권장).
3. 공정별 양품조건·투입자재 일괄 저장.
4. 공정 자주검사 항목 등록(공정코드 공유 주의).
5. 라벨 발행 지점(SG/FG)과 샘플검사 필요 공정 지정.

## 권한
- 기준정보 관리자: 라우팅 그룹·공정·조건·자재·자주검사 등록/수정/삭제.
- 일반 사용자: 조회.
- 자주검사 항목은 생산 모듈(`/production/self-inspect`) 권한과 연동됨.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 라우팅 목록에 완제품이 안 보임 | `USE_YN='N'` 또는 `ITEM_TYPE≠FINISHED` | 사용여부 Y, 품목유형 확인 |
| BOM 트리가 비어 있음 | 완제품 BOM 미등록 또는 자재가 RAW/CONSUMABLE만 | BOM 등록(트리는 원자재·소모품 제외) |
| 공정추가 버튼 비활성 | 선택 품목이 완제품/반제품이 아님 | FINISHED/SEMI_PRODUCT/FG/WIP 품목 선택 |
| 투입자재 후보가 비어 있음 | 라우팅 품목에 BOM 자재 없음 | 해당 품목 BOM 자재 등록 |
| 저장한 양품조건이 사라짐 | bulk가 전량 교체라 누락 행은 삭제됨 | 저장 전 전체 행 유지 확인 |
| 자주검사 수정이 다른 라우팅에도 반영됨 | `SELF_INSPECT_ITEMS`는 공정코드 기준 공유 | 공정 단위 영향 인지 후 편집 |

## 데이터·연계
- 테이블: `ROUTING_GROUPS`, `ROUTING_PROCESSES`, `PROCESS_QUALITY_CONDITIONS`, `ROUTING_MATERIALS`, `SELF_INSPECT_ITEMS`
- 참조: `PROCESS_MASTERS`(공정), `ITEM_MASTERS`/BOM(품목·자재), 회로(`CIRCUIT_ID`)
- 연계: 작업지시·생산실적·설비투입·검사(공정생품검사/자주검사), 라벨 발행(SG/FG)
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
