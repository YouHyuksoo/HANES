---
menuCode: MST_WAREHOUSE
audience: operator
title: 창고/로케이션 관리 — 운영 가이드
summary: 창고·로케이션·이동규칙 3개 테이블의 전체 컬럼 DB 매핑, 창고유형 코드값, 자동 생성 창고, 권한, 트러블슈팅, 멀티테넌시 스코프
tags: [기준정보, 창고, 로케이션, 이동규칙, 운영]
keywords: [WAREHOUSES, WAREHOUSE_LOCATIONS, WAREHOUSE_TRANSFER_RULES, WAREHOUSE_TYPE, WAREHOUSE_GROUP, FROM_WAREHOUSE_ID, TO_WAREHOUSE_ID, ALLOW_YN, IS_DEFAULT, 창고유형, FLOOR, SUBCON, 자연키, 복합키, 멀티테넌시, COMPANY, PLANT_CD]
related: [MST_PART]
---

# 창고/로케이션 관리 — 운영 가이드

## 시스템 목적·역할
재고가 보관·이동되는 물리/논리 단위인 **창고**와 그 안의 **로케이션**, 창고 간 **이동규칙**을 보유하는 마스터 화면입니다. 입고·불출·재고(`MAT_STOCK`/`PRODUCT_STOCKS`)·생산실적·재고이동이 모두 `WAREHOUSE_CODE`로 이 마스터를 참조합니다.

## 데이터 구조
```
WAREHOUSES (PK: COMPANY, PLANT_CD, WAREHOUSE_CODE)
   ├─ WAREHOUSE_LOCATIONS (PK: COMPANY, PLANT_CD, WAREHOUSE_CODE, LOCATION_CODE)
   │        창고 1 : N 로케이션 (WAREHOUSE_CODE로 연결)
   └─ WAREHOUSE_TRANSFER_RULES (PK: COMPANY, PLANT_CD, FROM_WAREHOUSE_ID, TO_WAREHOUSE_ID)
            FROM/TO_WAREHOUSE_ID 값 = WAREHOUSES.WAREHOUSE_CODE (코드 저장, 컬럼명만 _ID)
```
> **주의**: `WAREHOUSE_TRANSFER_RULES`의 `FROM_WAREHOUSE_ID`/`TO_WAREHOUSE_ID`는 이름만 `_ID`이고 실제 저장값은 **창고코드(WAREHOUSE_CODE)**입니다. 서비스가 `fw.WAREHOUSE_CODE = rule.FROM_WAREHOUSE_ID`로 JOIN해 출발/도착 창고명을 가져옵니다. 외래키 제약(FK) 컬럼이 아니라 자연키 조인입니다.

각 영역의 CRUD API:
- 창고: `GET/POST/PUT/DELETE /inventory/warehouses[/{code}]`
- 로케이션: `GET/POST/PUT/DELETE /inventory/warehouse-locations[/{warehouseCode}::{locationCode}]`
- 이동규칙: `GET/POST/PUT/DELETE /master/transfer-rules[/{fromId}/{toId}]`

---

## ① 창고관리 — WAREHOUSES (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 창고코드 | `WAREHOUSE_CODE` | PK 구성. 자연키, 불변(연결 무결성). |
| 창고명 | `WAREHOUSE_NAME` | 표시명. |
| 창고유형 | `WAREHOUSE_TYPE` | 용도 분류. DTO `@IsIn` 검증값: `RAW`(원자재)/`WIP`(반제품)/`FG`(완제품)/`FLOOR`(공정재공)/`DEFECT`(불량)/`SCRAP`(폐기)/`SUBCON`(외주처). 공통코드 `WAREHOUSE_TYPE`. |
| (화면 미노출) 창고그룹 | `WAREHOUSE_GROUP` | 동일 그룹 내 이동은 즉시, 다른 그룹 이동은 매니저 승인 의도로 설계된 컬럼. 현재 화면에는 입력 UI 없음(nullable). |
| 라인 | `LINE_CODE` | FLOOR 창고의 소속 생산라인. 유형 FLOOR일 때만 폼에 노출. |
| 공정 | `PROCESS_CODE` | FLOOR 창고의 소속 공정. 유형 FLOOR일 때만 폼에 노출. |
| (화면 미노출) 플랜트코드 | `PLANT_CODE` | 별도 plant 코드 보조 컬럼(멀티테넌시 `PLANT_CD`와 별개, nullable). |
| (화면 미노출) 설비코드 | `EQUIP_CODE` | 설비 연계 WIP 창고용 컬럼(nullable). |
| (화면 미노출) 거래처ID | `VENDOR_ID` | 외주(SUBCON) 창고 자동 생성 시 거래처 식별값으로 채워짐(nullable). |
| 기본 | `IS_DEFAULT` | `'Y'`/`'N'`. 동일 유형 기본창고. `getDefaultWarehouse(type)`가 `IS_DEFAULT='Y' AND USE_YN='Y'`로 자동 적치 대상 선택. |
| 사용 | `USE_YN` | `'Y'`만 활성. 삭제는 소프트 비활성 운영 권장. |
| 감사 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 생성/수정 이력. CREATED_AT/UPDATED_AT은 DEFAULT SYSTIMESTAMP. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | PK 일부. `40` / `1000` 스코프. |

## ② 로케이션 — WAREHOUSE_LOCATIONS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 창고 | `WAREHOUSE_CODE` | PK 구성 + 상위 창고 참조. 등록 후 불변. |
| 로케이션코드 | `LOCATION_CODE` | PK 구성. (창고+로케이션) 조합이 유일. 불변. |
| 로케이션명 | `LOCATION_NAME` | 표시명. |
| 존(구역) | `ZONE` | 창고 내 구역 구분(nullable). |
| 행 | `ROW_NO` | 랙/선반 행 번호(nullable, varchar). |
| 열 | `COL_NO` | 랙/선반 열 번호(nullable, varchar). |
| 단(층) | `LEVEL_NO` | 랙/선반 단 번호(nullable, varchar). |
| 사용 | `USE_YN` | `'Y'`만 활성. 목록에 ● 점으로 표시. |
| 비고 | `REMARK` | 메모(nullable). |
| 감사 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 생성/수정 이력. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | PK 일부. `40` / `1000` 스코프. |

> 수정/삭제 API는 복합키를 `{WAREHOUSE_CODE}::{LOCATION_CODE}` 형태(`::` 구분자)로 전달합니다.

## ③ 창고이동규칙 — WAREHOUSE_TRANSFER_RULES (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 출발창고(코드/명) | `FROM_WAREHOUSE_ID` | PK 구성. **값=출발 창고코드**. `WAREHOUSES.WAREHOUSE_CODE`와 조인해 코드·명 표시. |
| 도착창고(코드/명) | `TO_WAREHOUSE_ID` | PK 구성. **값=도착 창고코드**. 동일 방식 조인. |
| 허용여부 | `ALLOW_YN` | `'Y'`=이동 허용, `'N'`=금지. 기본 `'Y'`. |
| 비고 | `REMARK` | 메모(nullable). |
| 감사 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 생성/수정 이력. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | PK 일부. `40` / `1000` 스코프. |

> (출발→도착) 쌍은 유일. 중복 등록 시 409 Conflict. 수정/삭제 API는 `/{fromWarehouseId}/{toWarehouseId}` 경로로 복합키 전달.

---

## 창고 자동 생성 (코드 기반 동작)
일부 창고는 운영 중 시스템이 자동 생성합니다(화면 등록과 별개).
- **공정재공(FLOOR/WIP)**: `getOrCreateFloorWarehouse(lineCode, processCode)` → 코드 `FLOOR_{라인}_{공정}`, 유형 `WIP`, 라인·공정 채움.
- **외주(SUBCON)**: `getOrCreateSubconWarehouse(vendorId, vendorName)` → 코드 `SUBCON_{거래처ID}`, 유형 `SUBCON`, `VENDOR_ID` 채움.
- **기본창고 초기화**: `initDefaultWarehouses()`가 `RM_MAIN/RM_SUB/WIP_MAIN/FG_MAIN/FG_SHIP/DEFECT/SCRAP/SUBCON_MAIN` 등을 생성. (이 시드의 일부 유형값은 `RM`으로 들어갈 수 있어, 화면 필터 코드값 `RAW`와 다를 수 있으니 데이터 점검 시 유의.)

## 사전 설정 (마스터·공통코드)
- 공통코드: `WAREHOUSE_TYPE`(창고유형), `USE_YN`
- 라인·공정 코드(FLOOR 창고): 라인/공정 마스터가 선행되어야 선택 가능.

## 운영 절차
1. 창고관리에서 운영 창고 등록(유형·기본창고 지정).
2. 필요 창고에 로케이션(존/행/열/단) 등록.
3. 통제가 필요한 창고 쌍에 이동규칙 등록(허용/금지).
4. 단종 창고는 삭제 대신 `USE_YN='N'`으로 비활성(재고/이력 보존).

## 권한
기준정보 관리자(등록/수정/삭제). 일반 사용자는 조회.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 창고 삭제 실패 | 해당 창고에 재고 잔량 존재(`재고가 있는 창고는 삭제 불가`) | 재고 이관/비우기 후 삭제, 또는 `USE_YN='N'` 비활성 |
| 폼에 라인·공정 칸 안 보임 | 창고유형이 FLOOR가 아님 | 유형을 `FLOOR`(공정재공)로 변경 |
| 자동 적치가 엉뚱한 창고로 감 | 유형별 `IS_DEFAULT='Y'` 창고 부재/중복 | 유형별 기본창고 1개만 `IS_DEFAULT='Y'`로 정리 |
| 이동규칙 저장 시 409 | 동일 (출발→도착) 쌍 이미 존재 | 기존 규칙 수정으로 처리 |
| 이동규칙 출발/도착명이 빈 값 | `FROM/TO_WAREHOUSE_ID`가 가리키는 창고코드가 WAREHOUSES에 없음 | 창고코드 정합성 확인(유효 창고코드로 정정) |
| 창고/로케이션이 선택 목록에 없음 | `USE_YN='N'` | 사용여부 `Y`로 활성화 |

## 데이터·연계
- 테이블: `WAREHOUSES`, `WAREHOUSE_LOCATIONS`, `WAREHOUSE_TRANSFER_RULES`
- 연계: 입고/불출, 재고(`MAT_STOCK`, `PRODUCT_STOCKS`), 생산실적, 재고이동, 품목마스터(기본 적재위치)
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
