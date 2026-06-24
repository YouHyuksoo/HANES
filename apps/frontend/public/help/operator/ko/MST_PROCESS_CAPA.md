---
menuCode: MST_PROCESS_CAPA
audience: operator
title: 공정 CAPA 관리 — 운영 가이드
summary: PROCESS_CAPAS 전체 컬럼의 DB 매핑, UPH·일일 CAPA 자동계산 로직, FK 검증(공정·품목), 생산 시뮬레이션(MPS) 연계, 권한, 트러블슈팅
tags: [기준정보, CAPA, 생산능력, 마스터, 운영]
keywords: [PROCESS_CAPAS, STD_TACT_TIME, STD_UPH, DAILY_CAPA, BALANCE_EFF, WORKER_CNT, EQUIP_CNT, BOARD_CNT, SETUP_TIME, 공정능력, 생산능력, 택트타임, UPH, 일일CAPA, 밸런싱효율, 시뮬레이션, MPS, 복합키, 멀티테넌시]
related: [MST_PROCESS, MST_PART, PROD_SIMULATION]
---

# 공정 CAPA 관리 — 운영 가이드

## 시스템 목적·역할
공정과 품목 조합별 생산능력을 보유하는 **마스터 테이블 `PROCESS_CAPAS`** 관리 화면입니다. 한 공정에서 특정 품목의 표준 택트타임·UPH·일일 생산능력을 정의하며, **생산 시뮬레이션(MPS)**이 이 값을 읽어 공정별 소요 능력과 일정을 산출합니다. API는 `/master/process-capas`(GET/POST/PUT/DELETE).

## 데이터 구조
```
PROCESS_CAPAS (PK: COMPANY, PLANT_CD, PROCESS_CODE, ITEM_CODE)
   ├─ PROCESS_CODE ──▶ PROCESS_MASTERS (공정 마스터, FK 검증)
   ├─ ITEM_CODE    ──▶ ITEM_MASTERS  (품목 마스터, FK 검증)
   └─ 소비처: 생산 시뮬레이션(PROD_SIMULATION) — DAILY_CAPA / STD_UPH 기준 능력
```
- 키는 **공정 + 품목** 복합키이며, COMPANY/PLANT_CD로 공장 스코프가 분리됩니다.
- 저장 시 `STD_UPH`, `DAILY_CAPA`는 서버에서 **자동 계산**되어 채워집니다.

## ① 전체 컬럼 — PROCESS_CAPAS

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 공정 | `PROCESS_CODE` | PK 구성. 생성 시 `PROCESS_MASTERS`에 존재하는지 FK 검증(없으면 400). 수정 시 변경 불가. |
| 품목 | `ITEM_CODE` | PK 구성. 생성 시 `ITEM_MASTERS`에 존재하는지 FK 검증(없으면 400). 수정 시 변경 불가. |
| 표준 택트타임(초) | `STD_TACT_TIME` | NUMBER(10,2). 1개 생산 표준 시간(초). DTO 검증 `Min(0.01)`. UPH 자동계산의 입력값. |
| 표준 UPH | `STD_UPH` | NUMBER(10,2). 시간당 생산량. **미입력 시 `3600 ÷ STD_TACT_TIME`(소수 2자리 반올림)으로 자동 산출**. 직접 값을 보내면 그 값을 사용. |
| 작업자 수 | `WORKER_CNT` | NUMBER(3), 기본 0. `EQUIP_CNT`가 0일 때 일일 CAPA 배수로 사용. |
| 보드/지그 수 | `BOARD_CNT` | NUMBER(3), 기본 0. 능력 참고 정보(계산에는 미사용). |
| 설비 대수 | `EQUIP_CNT` | NUMBER(3), 기본 0. **1 이상이면** 일일 CAPA 배수로 작업자 수보다 우선 적용(설비종속). |
| 전환시간(분) | `SETUP_TIME` | NUMBER(5), 기본 0. 모델 전환·셋업 시간(분). 참고 정보. |
| 밸런싱 효율(%) | `BALANCE_EFF` | NUMBER(5,2), 기본 85. 일일 CAPA에 곱하는 가동 효율. DTO 검증 0~100. |
| 일일 CAPA | `DAILY_CAPA` | NUMBER(10), 기본 0. **서버 자동 계산**(아래 로직). 클라이언트가 보낸 값은 무시되고 재계산됨. |
| 사용여부 | `USE_YN` | CHAR(1), 기본 'Y'. `@Index(['useYn'])`. `IsIn(['Y','N'])`. N은 비활성 통계로 집계. |
| 비고 | `REMARK` | VARCHAR2(500) NULL. 관리 메모. |
| 감사 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 생성/수정자·시각. `CREATED_AT`/`UPDATED_AT`은 `@CreateDateColumn`/`@UpdateDateColumn` 자동 관리. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | PK 구성. `40` / `1000` 스코프. tenant 데코레이터로 주입. |

## UPH · 일일 CAPA 자동계산 로직
서비스(`process-capa.service.ts`)에서 생성·수정 시 매번 재계산합니다.

1. **UPH 산출**: `stdUph` 미전달이고 `stdTactTime`이 입력/변경되면 `STD_UPH = round(3600 / STD_TACT_TIME, 2)`.
2. **일일 CAPA 산출** (`calculateDailyCapa`):
   ```
   배수 = EQUIP_CNT > 0 ? EQUIP_CNT
        : WORKER_CNT > 0 ? WORKER_CNT
        : 1
   DAILY_CAPA = floor( STD_UPH × 8(가동시간) × 배수 × (BALANCE_EFF ÷ 100) )
   ```
   - 가동시간은 8시간(1교대) 고정.
   - 결과는 소수점 **버림(floor)**.
   - 프론트 미리보기와 서버 계산식은 동일(설비 우선 → 작업자 → 1).

## 사전 설정 (마스터·공통코드)
- **공정 마스터**([공정관리])에 `PROCESS_CODE`가 선행 등록되어야 함(FK 검증).
- **품목 마스터**([품목마스터])에 `ITEM_CODE`가 선행 등록되어야 함(FK 검증).
- 공통코드 직접 의존 없음(사용여부 Y/N은 고정 값).

## 운영 절차
1. **신규**: `POST /master/process-capas` — 공정+품목 중복 체크 → 공정/품목 FK 검증 → UPH·DAILY_CAPA 자동계산 → 저장.
2. **수정**: `PUT /master/process-capas/:processCode/:itemCode` — 키(공정·품목)는 제외(PartialType+OmitType). 전달된 필드만 갱신 후 UPH·DAILY_CAPA 재계산.
3. **삭제**: `DELETE /master/process-capas/:processCode/:itemCode` — 존재 확인 후 복합키로 삭제.
4. **조회**: `GET /master/process-capas` — 공정/품목 LEFT JOIN, `processCode`·`itemCode`·`search`(공정코드/공정명/품목코드/품목명 LIKE) 필터, COMPANY/PLANT_CD 스코프 자동 적용.

## 권한
기준정보 관리자(등록/수정/삭제). 일반 사용자는 조회. 화면은 별도 액션 권한 가드 없이 공통 인증 라우트 하위에서 동작합니다.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 저장 시 "이미 존재하는 공정 CAPA" (409) | 동일 `PROCESS_CODE`+`ITEM_CODE` 존재 | 기존 행을 수정하거나 다른 조합으로 등록 |
| "공정 마스터를 찾을 수 없습니다" (400) | `PROCESS_CODE`가 `PROCESS_MASTERS`에 없음 | 공정관리에서 공정 먼저 등록 |
| "품목 마스터를 찾을 수 없습니다" (400) | `ITEM_CODE`가 `ITEM_MASTERS`에 없음 | 품목마스터에서 품목 먼저 등록 |
| UPH가 0으로 저장됨 | `STD_TACT_TIME` 미입력/0 | 택트타임을 0.01초 이상으로 입력(UPH 자동 계산) |
| 일일 CAPA가 기대보다 작음 | 설비 대수·작업자 수 0 또는 밸런싱 효율 낮음 | 배수(설비/작업자)·효율 확인. 배수 0이면 1로 계산됨 |
| 설비/작업자를 다 넣었는데 작업자 기준이 안 잡힘 | `EQUIP_CNT`가 1 이상이면 설비 우선 | 작업자 기준 계산이 필요하면 `EQUIP_CNT`를 0으로 |
| 시뮬레이션에 능력이 반영 안 됨 | `USE_YN='N'` 또는 CAPA 미등록 | 사용여부 Y 활성화, 해당 공정+품목 CAPA 등록 |

## 데이터·연계
- 테이블: `PROCESS_CAPAS`
- FK 참조: `PROCESS_MASTERS`(공정), `ITEM_MASTERS`(품목)
- 소비처: 생산 시뮬레이션([생산 시뮬레이션], MPS) — `STD_UPH`/`DAILY_CAPA` 기준 능력으로 공정 소요·일정 산출
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
