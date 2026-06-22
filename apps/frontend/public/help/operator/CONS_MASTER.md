---
menuCode: CONS_MASTER
audience: operator
title: 소모품 마스터 — 운영 가이드
summary: 소모품 마스터(CONSUMABLE_MASTERS) 전체 컬럼의 DB 매핑, 사용처 매핑(CONSUMABLE_USAGE_MAP) 관계, 수명/상태 로직, 공통코드, 권한, 트러블슈팅, 멀티테넌시 스코프
tags: [소모품, 마스터, 기준정보, 운영]
keywords: [CONSUMABLE_MASTERS, CONSUMABLE_USAGE_MAP, CONSUMABLE_STOCKS, CONSUMABLE_LOGS, CONSUMABLE_CATEGORY, MOLD, JIG, TOOL, 기대수명, 경고임계치, 안전재고, 단위사용량, USAGE_PER_UNIT, 사용처매핑, 설비부품, 제품BOM, 멀티테넌시, COMPANY, PLANT_CD]
related: [MST_PART]
---

# 소모품 마스터 — 운영 가이드

## 시스템 목적·역할
생산에 투입되는 **소모품(금형·지그·공구)의 기준정보 마스터 `CONSUMABLE_MASTERS`** 관리 화면입니다. 소모품의 개별 재고 인스턴스(`CONSUMABLE_STOCKS`), 입출고 이력(`CONSUMABLE_LOGS`), 제품·설비 사용처 매핑(`CONSUMABLE_USAGE_MAP`), 키오스크 생산실적의 소모품 투입이 모두 `CONSUMABLE_CODE`로 이 마스터를 참조합니다.

> API 기준: 목록 `GET /consumables`, 단건 `GET /consumables/:id`, 등록 `POST /consumables`, 수정 `PUT /consumables/:id`, 삭제 `DELETE /consumables/:id`, 이미지 `POST|DELETE /consumables/:id/image`, 사용매핑 `GET|POST /consumables/:id/usage-maps`·`PUT|DELETE /consumables/:id/usage-maps/:productItemCode/:equipCode`. (화면 그리드의 `SELECT ... FROM CONSUMABLES`는 표시용 라벨일 뿐, 실제 테이블명은 `CONSUMABLE_MASTERS`다.)

## 데이터 구조
```
CONSUMABLE_MASTERS (PK: CONSUMABLE_CODE)
   ├─ 1:N ─▶ CONSUMABLE_STOCKS   (개별 인스턴스 CON_UID, 입고·장착 상태 추적)
   ├─ 1:N ─▶ CONSUMABLE_LOGS     (입출고/타수/교체 이력)
   └─ 1:N ─▶ CONSUMABLE_USAGE_MAP(제품모델 × 설비 × 소모품 사용처)
                 ├─ PRODUCT_ITEM_CODE ─▶ ITEM_MASTERS.ITEM_CODE (제품/모델)
                 └─ EQUIP_CODE        ─▶ EQUIP_MASTERS.EQUIP_CODE (설비)
```

## 소모품의 2종 구분 (운영 의미)
마스터는 하나지만 사용 경로가 둘이다.
- **설비 장착용**(금형·지그·블레이드): 설비에 장착해 타수(`CURRENT_COUNT`)가 누적되고, `EXPECTED_LIFE` 도달 시 교체. 키오스크 좌측 하단 "소모성 설비부품" 섹션 대상. `CONSUMABLE_USAGE_MAP`의 설비×소모품 매핑을 따른다.
- **제품 BOM 투입용**: 제품 BOM의 `CONSUMABLE` 항목으로 투입되어 생산수량만큼 차감. 키오스크 좌측의 제품 BOM 기준으로 표시된다.

---

## ① 기본정보 — CONSUMABLE_MASTERS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 소모품 코드 | `CONSUMABLE_CODE` | PK(자연키). 입출고·재고·사용매핑 연결 키. 변경 불가(수정 모드 잠김). |
| 소모품명 | `NAME` | 표시명(엔티티 속성명은 `consumableName`). |
| 분류 | `CATEGORY` | 공통코드 `CONSUMABLE_CATEGORY`(MOLD/JIG/TOOL). DTO enum은 `['MOLD','JIG','TOOL']`. 미선택 시 null 저장. |
| 이미지 | `IMAGE_URL` | 업로드 경로(`/uploads/consumables/...`). 마스터 저장 후에만 업로드(`POST /consumables/:id/image`). |

## ② 수명 / 관리 — CONSUMABLE_MASTERS

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 기대수명 | `EXPECTED_LIFE` | 누적 타수 상한(INT). `CURRENT_COUNT ≥ EXPECTED_LIFE` → `STATUS='REPLACE'`. null이면 자동 상태전이 없음. |
| 경고 임계치 | `WARNING_COUNT` | 교체 임박 알림 타수(INT). `CURRENT_COUNT ≥ WARNING_COUNT` → `STATUS='WARNING'`. 보통 `< EXPECTED_LIFE`. |
| 안전재고 | `SAFETY_STOCK` | 재고 부족 판단 기준(INT, default 0). 보유 재고 미만 시 부족. |
| (자동) 현재 타수 | `CURRENT_COUNT` | 누적 사용횟수(INT, default 0). 키오스크/타수 API(`POST /consumables/shot-count`)로 누적, 교체(`/consumables/reset`)로 0 리셋. 폼에 직접 입력란 없음. |
| (자동) 상태 | `STATUS` | NORMAL/WARNING/REPLACE. 타수 누적 시 자동 전이. |
| (자동) 운영상태 | `OPER_STATUS` | WAREHOUSE(창고)/MOUNTED(장착) 등. 장착 흐름에서 갱신. |
| (자동) 장착설비 | `MOUNTED_EQUIP_ID` | 현재 장착된 설비코드(속성명 `mountedEquipCode`). |
| (자동) 재고수량 | `STOCK_QTY` | 입출고 이력으로 가감되는 보유 수량(INT, default 0). |
| (자동) 교체일 | `LAST_REPLACE`, `NEXT_REPLACE` | 최근/예정 교체 시각(TIMESTAMP). |

## ③ 거래처 / 위치 — CONSUMABLE_MASTERS

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 보관위치 | `LOCATION` | 기본 보관 장소. |
| 거래처 | `VENDOR` | 공급 거래처/제조사. |
| 단가 | `UNIT_PRICE` | NUMBER(12,2). 입고 단가·자산 평가 참고. |
| 사용여부 | `USE_YN` | `Y`만 목록/선택 노출(목록 조회 시 `useYn='Y'` 고정). |
| 감사 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 생성/수정 이력. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | `40` / `1000` 스코프(엔티티 속성명 `company`, `plant`). |

## ④ 사용처 매핑 — CONSUMABLE_USAGE_MAP (전체 컬럼)

선택한 소모품을 **어느 제품(모델)·설비에서 쓰는지** 정의한다. 키오스크가 작업지시(제품)+설비로 필요 소모품을 조회하는 기준.

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 제품/모델 | `PRODUCT_ITEM_CODE` | PK 구성. `ITEM_MASTERS.ITEM_CODE` 참조. 옵션은 `FINISHED`/`SEMI_PRODUCT` 품목만. 등록 시 존재·`USE_YN='Y'` 검증. |
| 설비 | `EQUIP_CODE` | PK 구성. `EQUIP_MASTERS.EQUIP_CODE` 참조. 등록 시 존재·`USE_YN='Y'` 검증. |
| (키) 소모품 | `CONSUMABLE_CODE` | PK 구성. 선택된 마스터. |
| 단위사용량 | `USAGE_PER_UNIT` | NUMBER(default 1). 단위 생산당 소모 타수. 생산수량 × 이 값만큼 타수 누적. |
| 사용여부 | `USE_YN` | `Y`/`N`. 목록 `Y` 배지 토글로 전환. |
| 비고 | `REMARK` | 매핑 메모. |
| (키) 멀티테넌시 | `COMPANY`, `PLANT_CD` | PK 구성. `40` / `1000`. |

> 복합 PK: `COMPANY + PLANT_CD + PRODUCT_ITEM_CODE + EQUIP_CODE + CONSUMABLE_CODE`. 같은 조합 재등록은 upsert(수량·사용여부·비고 갱신).

## 수명 / 상태 로직
1. 타수 누적(`POST /consumables/shot-count`, `addCount`): `CURRENT_COUNT += addCount`.
2. `EXPECTED_LIFE`가 있고 `CURRENT_COUNT ≥ EXPECTED_LIFE` → `STATUS='REPLACE'`.
3. 아니고 `WARNING_COUNT`가 있고 `CURRENT_COUNT ≥ WARNING_COUNT` → `STATUS='WARNING'`.
4. 교체(`POST /consumables/reset`): `CURRENT_COUNT=0`, `STATUS='NORMAL'`, `LAST_REPLACE`=현재, `NEXT_REPLACE`=현재+`EXPECTED_LIFE`일.
5. 입출고(`POST /consumables/logs`·`receiving`·`issuing`): `STOCK_QTY` 가감(출고 시 음수 재고 차단).

## 사전 설정 (마스터·공통코드)
- 공통코드: `CONSUMABLE_CATEGORY`(MOLD/JIG/TOOL)
- 사용처 매핑 선행: 제품/모델은 [품목마스터](`ITEM_MASTERS`, `FINISHED`/`SEMI_PRODUCT`), 설비는 설비마스터(`EQUIP_MASTERS`)에 `USE_YN='Y'`로 등록되어 있어야 선택 가능.

## 운영 절차
1. `CONSUMABLE_MASTERS` 등록(코드·이름·분류) → 저장.
2. 이미지 업로드(저장 후) → 수명/관리·거래처/위치 채움.
3. 사용처 매핑(`CONSUMABLE_USAGE_MAP`)에 제품·설비·단위사용량 등록.
4. 입고·타수 누적·교체는 입출고/키오스크/타수 API를 통해 자동 반영.

## 권한
기준정보 관리자(등록/수정/삭제/매핑). 일반 사용자는 조회.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 등록 시 이미지 업로드 비활성 | 마스터 미저장(신규 모드) | 기본정보 저장 후 다시 열어 업로드 |
| 저장 시 코드 중복 오류(409) | 동일 `CONSUMABLE_CODE` 존재 | 코드 확인(불변 키) 또는 기존 건 수정 |
| 사용매핑 저장 시 "제품/설비 없음"(404) | 품목/설비 미등록 또는 `USE_YN='N'` | 품목마스터·설비마스터에서 활성화 후 매핑 |
| 사용매핑 제품 목록이 비어 있음 | 품목유형이 `FINISHED`/`SEMI_PRODUCT`가 아님 | 해당 유형으로 품목 등록 |
| 목록에 안 보임 | `USE_YN='N'` 또는 분류/검색 필터 | 사용여부·필터·검색어 확인 |
| 출고 시 재고 부족 오류(400) | `STOCK_QTY` 부족 | 입고 후 재시도 |
| 타수 누적해도 상태 안 바뀜 | `EXPECTED_LIFE`/`WARNING_COUNT` 미설정(null) | 기대수명·경고 임계치 입력 |
| 썸네일/이미지 깨짐 | `IMAGE_URL` 파일 없음(404) | 재업로드(프론트 placeholder fallback) |

## 데이터·연계
- 테이블: `CONSUMABLE_MASTERS`(마스터), `CONSUMABLE_STOCKS`(개별 인스턴스), `CONSUMABLE_LOGS`(입출고/타수/교체 이력), `CONSUMABLE_USAGE_MAP`(사용처 매핑)
- 연계: 품목마스터(`ITEM_MASTERS`), 설비마스터(`EQUIP_MASTERS`), 키오스크 생산실적(소모품 투입), 자재 통합 흐름(소모품 입하 LOT → `MAT_STOCKS` 적재·auto-issue 차감)
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
