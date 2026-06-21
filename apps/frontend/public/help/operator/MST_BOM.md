---
menuCode: MST_BOM
audience: operator
title: BOM관리 — 운영 가이드
summary: BOM_MASTERS 전체 컬럼·복합키, 재귀 전개, 엑셀 업로드, 품목/라우팅 연계, 트러블슈팅
tags: [기준정보, BOM, 자재명세서, 운영]
keywords: [BOM_MASTERS, PARENT_ITEM_CODE, CHILD_ITEM_CODE, REVISION, QTY_PER, OPER, 재귀전개, 엑셀업로드, ECO_NO, 멀티테넌시]
related: [MST_PART]
---

# BOM관리 — 운영 가이드

## 시스템 목적·역할
부모-자품목 구성을 정의하는 **`BOM_MASTERS`** 관리 화면입니다. 생산 시 자재 소요량 전개(필요량 계산)·투입의 기준이며, 자기참조(자품목이 다시 부모) 구조로 다단계 BOM을 표현합니다.

## 데이터 구조
```
BOM_MASTERS (복합 PK: PARENT_ITEM_CODE + CHILD_ITEM_CODE + REVISION)
   ├─ PARENT_ITEM_CODE ─▶ ITEM_MASTERS (부모품목)
   └─ CHILD_ITEM_CODE  ─▶ ITEM_MASTERS (자품목) ─▶ (자품목이 부모로 재귀) BOM_MASTERS
```
- **복합 PK**: `PARENT_ITEM_CODE + CHILD_ITEM_CODE + REVISION` (UUID id 없음).
- 트리 조회 API: `GET /master/boms/hierarchy/:parentPartId` (재귀 전개).

## 전체 컬럼 — BOM_MASTERS

| 화면 항목 | DB 컬럼 | 의미 · 운영 포인트 |
|------|------|------|
| 부모품목 | `PARENT_ITEM_CODE` | PK. `ITEM_MASTERS.ITEM_CODE` 참조. |
| 자품목코드 | `CHILD_ITEM_CODE` | PK. `ITEM_MASTERS.ITEM_CODE` 참조. |
| 리비전 | `REVISION` | PK. 기본 `A`. 구성 버전 구분. |
| 소요량 | `QTY_PER` | NUMBER(10,4). 부모 1개당 자품목 수량. |
| 순번 | `SEQ` | 표시/처리 순서(기본 0). |
| BOM 그룹 | `BOM_GRP` | 그룹 분류(인덱스 존재). |
| 공정 | `OPER` | 투입 공정코드(엔티티 필드명 processCode). |
| 사이드 | `SIDE` | 적용 면(TOP/BOT 등). |
| ECO 번호 | `ECO_NO` | 설계변경 추적 번호. |
| 유효시작 | `VALID_FROM` | DATE. 적용 시작일. |
| 유효종료 | `VALID_TO` | DATE. 적용 종료일(기간 외 미적용). |
| 비고 | `REMARK` | 메모. |
| 사용여부 | `USE_YN` | Y만 유효 구성. |
| 자품목명/유형 | (조인) | `ITEM_MASTERS.ITEM_NAME / ITEM_TYPE` — 표시·전개 판단용(BOM_MASTERS에는 없음). |
| 레벨(Lv) | (계산) | 트리 깊이. 저장값 아님. |
| 감사 | `CREATED_BY/UPDATED_BY/CREATED_AT/UPDATED_AT` | 이력. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | `40` / `1000` 스코프. |

## 엑셀 업로드
- BOM 다건을 엑셀 템플릿으로 일괄 등록(업로드 모달). 부모/자품목코드가 `ITEM_MASTERS`에 존재해야 하며, 키(부모+자식+리비전) 중복은 거부/갱신 정책을 따른다.

## 재귀 전개 / 라우팅 연계
- 자품목이 반제품이면 그 자품목을 부모로 하위 BOM이 다시 전개된다(다단계). 생산 소요량 전개는 이 재귀를 따라 누적 계산.
- 각 BOM 행의 `OPER`(공정)로 자재가 어느 공정에서 투입되는지 연결되며, 라우팅과 함께 본다.

## 사전 설정
- `ITEM_MASTERS`에 부모/자품목이 먼저 등록되어야 함.
- 공정코드(OPER)는 공정마스터 기준.

## 권한
기준정보 관리자(등록/수정/업로드). 일반 사용자는 조회.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 자품목 추가 시 코드 오류 | 자품목이 ITEM_MASTERS에 없음 | 품목마스터에 먼저 등록 |
| 같은 자품목 추가가 거부됨 | 부모+자품목+리비전 키 중복 | 리비전을 달리하거나 기존 행 수정 |
| 트리에 자품목이 안 펼쳐짐 | 자품목 자체의 BOM 미등록 | 자품목을 부모로 하위 BOM 등록 |
| 생산 전개 수량이 안 맞음 | QTY_PER 오입력 / 유효기간 외 | 소요량·VALID_FROM/TO 확인 |
| 구성이 적용 안 됨 | USE_YN='N' 또는 유효기간 경과 | USE_YN·유효기간 점검 |

## 데이터·연계
- 테이블: `BOM_MASTERS`
- 연계: 품목마스터(`ITEM_MASTERS`), 공정/라우팅(OPER), 생산 소요량 전개
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
