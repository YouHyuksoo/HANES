---
menuCode: MST_PART
audience: operator
title: 품목마스터 — 운영 가이드
summary: 품목마스터 전체 컬럼의 DB 매핑, ERP 동기화(IF_ITEM_MASTER), IQC/AQL 연계, 권한, 트러블슈팅
tags: [기준정보, 품목, 마스터, 운영, ERP]
keywords: [ITEM_MASTERS, IF_ITEM_MASTER, ERP-IF, IQC_AQL_POLICY_CODE, PRODUCT_TYPE, IQC_INSPECT_METHOD, UNIT_TYPE, 품목유형, 동기화, 멀티테넌시]
related: [QC_AQL]
---

# 품목마스터 — 운영 가이드

## 시스템 목적·역할
모든 품목의 기준정보를 보유하는 **마스터 테이블 `ITEM_MASTERS`** 관리 화면입니다. BOM·생산실적·자재수불·수입검사(IQC)·재고가 모두 `ITEM_CODE`로 이 마스터를 참조합니다.

## 데이터 구조
```
ITEM_MASTERS (PK: COMPANY, PLANT_CD, ITEM_CODE)
   ├─ IQC_AQL_POLICY_CODE ──▶ IQC_AQL_POLICIES (수입검사 AQL 정책)
   └─ 참조: BOM / 생산 / 자재수불 / 재고 / 라벨
```

## 전체 컬럼 — ITEM_MASTERS

| 화면 항목 | DB 컬럼 | 의미 · 운영 포인트 |
|------|------|------|
| 품목코드 | `ITEM_CODE` | PK 구성. 불변 권장(연결 무결성). |
| 품번 | `PART_NO` | 도면/ERP/고객 품번. |
| 품목명 | `ITEM_NAME` | 표시명. |
| 고객품번 | `CUST_PART_NO` | 고객사 품번(출하/라벨 매칭). |
| Rev | `REV` | 도면/사양 리비전. |
| 마킹문구 | `MARKING_TEXT` | 라벨·마킹 설비 전달 문구. |
| 품목유형 | `ITEM_TYPE` | RAW_MATERIAL/SEMI_PRODUCT/FINISHED/CONSUMABLE. 자재·생산 처리 분기. |
| 품목그룹 | `PRODUCT_TYPE` | 공통코드 PRODUCT_TYPE. |
| 차종/모델 | `MODEL_NAME` | 관리 특성. |
| 규격 | `SPEC` | 사양/치수. |
| 색상 | `COLOR` | 전선색 등. |
| 단위 | `UNIT` | 공통코드 UNIT_TYPE. 재고·불출 기준 단위. |
| IQC 여부 | `IQC_FLAG` | Y=수입검사 대상. |
| 검사방식 | `INSPECT_METHOD` | 공통코드 IQC_INSPECT_METHOD. |
| 기본시료수 | `SAMPLE_QTY` | IQC 기본 시료수(AQL 샘플수와 별개). |
| AQL 정책 | `IQC_AQL_POLICY_CODE` | `IQC_AQL_POLICIES.POLICY_CODE` 참조. 입고 LOT 판정 기준. |
| 박스수량 | `BOX_QTY` | 박스 장입 기준. |
| 최소포장수량 | `MIN_PACK_QTY` | 최소 불출 단위. |
| LOT 구성단위 | `LOT_UNIT_QTY` | 공정품 묶음 단위. |
| 팔레트 구성단위 | `PACK_UNIT` | 상위 포장 단위. |
| 안전재고 | `SAFETY_STOCK` | 부족 판단 기준. |
| 유효기간 | `EXPIRY_DATE` | 유효기간 일수. |
| 유효기간 연장 | `EXPIRY_EXT_DAYS` | 연장 가능 최대 일수. |
| 적재위치 | `STORAGE_LOCATION` | 기본 적재 로케이션. |
| 사진 | `IMAGE_URL` | 업로드 파일 경로(`/uploads/parts/...`). |
| 사용여부 | `USE_YN` | Y만 활성. |
| 비고 | `REMARK` | 메모. |
| 감사 | `CREATED_BY`, `CREATED_AT`, `UPDATED_AT` | 생성/수정 이력. ERP 동기화분은 `CREATED_BY='ERP-IF'`. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | `40` / `1000` 스코프. |

## ERP 동기화 (IF_ITEM_MASTER)
- 상단 **ERP 동기화** 버튼 → `POST /interface/inbound/item-master` → Oracle 프로시저 **`IF_ITEM_MASTER`** 실행(확인 모달 후).
- 동작: ERP `MTL_SYSTEM_ITEMS`를 `ITEM_MASTERS`로 **MERGE**. 신규는 INSERT(`CREATED_BY='ERP-IF'`), 기존은 ERP 최신값으로 UPDATE.
- 결과: `{ insert, update }` 건수 반환.
- **오조작 복구**: ERP로 잘못 추가된 신규 품목은 `CREATED_BY='ERP-IF'` + 해당 `CREATED_AT` 배치로 식별해 삭제할 수 있다(삭제 전 PROD_PLANS 등 자식 참조 확인). 한 번에 수만 건 들어올 수 있으므로 실행 전 확인 모달을 반드시 확인.

## IQC / AQL 연계
- `IQC_FLAG='Y'` 품목만 입고 시 수입검사 대상.
- `IQC_AQL_POLICY_CODE`가 `IQC_AQL_POLICIES`를 참조 → 입고 LOT 검사에서 샘플수·Ac·Re 자동 산출. 미설정 시 자동 판정 미적용.

## 사전 설정 (마스터·공통코드)
- 공통코드: `PRODUCT_TYPE`, `IQC_INSPECT_METHOD`, `UNIT_TYPE`, `USE_YN`
- AQL 정책([AQL 기준관리])이 선행되어야 품목에 연결 가능.

## 권한
기준정보 관리자(등록/수정/ERP 동기화). 일반 사용자는 조회.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| ERP 동기화로 대량 품목이 잘못 추가됨 | ERP 동기화 오실행 | `CREATED_BY='ERP-IF'` 배치 식별 후 삭제(자식 참조 확인) |
| 목록 사진이 깨져 보임 | `IMAGE_URL` 경로의 파일 없음(404) | 사진 재업로드 또는 경로 정리(프론트는 placeholder fallback) |
| 입고 검사에서 AQL 자동판정 안 됨 | `IQC_AQL_POLICY_CODE` 미설정 | 품목에 AQL 정책 연결 |
| 품목이 선택 목록에 안 보임 | `USE_YN='N'` | 사용여부 Y로 활성화 |
| 저장 시 코드 중복 오류 | 동일 `ITEM_CODE` 존재 | 코드 확인(불변 키) |

## 데이터·연계
- 테이블: `ITEM_MASTERS`
- 연계: BOM, 생산실적, 자재수불, 재고, 라벨, 수입검사(IQC)·AQL(`IQC_AQL_POLICIES`)
- 외부: ERP `MTL_SYSTEM_ITEMS`(IF_ITEM_MASTER MERGE)
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
