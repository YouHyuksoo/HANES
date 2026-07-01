---
menuCode: SHIP_PALLET
audience: operator
title: 팔레트적재관리 — 운영 가이드
summary: 출하 팔레트(PALLET_MASTERS) CRUD — 팔레트 생성·박스 할당/제거·OPEN→CLOSED 마감/재오픈·라벨 출력. OQC_ENABLED 시스템 설정에 따라 박스 할당 조건이 달라집니다.
tags: [출하관리, 팔레트, 박스할당, 라벨출력]
keywords: [PALLET_MASTERS, BOX_MASTERS, SHIPMENT_ORDERS, OPEN, CLOSED, LOADED, SHIPPED, PALLET_STATUS, OQC_ENABLED, OQC_STATUS, 팔레트, 박스할당, includeOpen, 라벨템플릿]
related: [SHIP_PACK, SHIP_ORDER, SHIP_PALLET_SHIP]
---

# 팔레트적재관리 — 운영 가이드

## 시스템 목적·역할

확정된 출하지시(CONFIRMED)를 기준으로 팔레트를 생성하고, 포장 완료 박스를 할당해 출하를 준비합니다.

- 상태 흐름: `OPEN → CLOSED → LOADED → SHIPPED`
- `OQC_ENABLED` 시스템 설정이 활성화된 경우 OQC PASS 박스만 적재 가능합니다.
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`

## 데이터 구조

```
PALLET_MASTERS (PK: PALLET_NO)
   ├─ SHIP_ORDER_NO → SHIPMENT_ORDERS (CONFIRMED 상태)
   ├─ BOX_COUNT / TOTAL_QTY   (박스 할당/제거 시 자동계산)
   ├─ STATUS                  PALLET_STATUS 공통코드
   ├─ CLOSE_AT                마감 일시 (CLOSE 시 기록)
   ├─ SHIPPED_AT              출하 일시
   ├─ SHIPMENT_ID             출하 식별자 (출하처리 연결)
   └─ COMPANY / PLANT_CD / CREATED_AT / UPDATED_AT

BOX_MASTERS (PK: BOX_NO + COMPANY + PLANT_CD)
   ├─ ITEM_CODE → ITEM_MASTERS
   ├─ PALLET_NO → PALLET_MASTERS (할당 시 기록)
   ├─ STATUS     OPEN → CLOSED → SHIPPED
   └─ OQC_STATUS PENDING / PASS / FAIL
```

## ① 팔레트 목록 그리드 — PALLET_MASTERS

조회 API: `GET /shipping/pallets?limit=5000&createdFrom=&createdTo=&palletNo=&status=&includeOpen=true`

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| **출하지시번호** | `SHIP_ORDER_NO` | 연결된 출하지시. NULL이면 미연결(작업 불가). |
| **팔레트번호** | `PALLET_NO` | PK. 자동채번. 바코드 스캔 검색 가능. |
| **박스수** | `BOX_COUNT` | 현재 적재 박스 수. 박스 추가/제거 시 서버에서 재계산. |
| **총수량** | `TOTAL_QTY` | 적재 박스 내 수량 합산. |
| **상태** | `STATUS` | PALLET_STATUS 공통코드 배지. |
| **출하번호** | `SHIPMENT_ID` | 출하처리 연결 시 기록. 없으면 `-`. |
| **생성일시** | `CREATED_AT` | 팔레트 생성 일시. 기간 필터 기준. |
| **멀티테넌시** | `COMPANY`, `PLANT_CD` | 40 / 1000 고정 스코프. |

### includeOpen 동작

상태 필터를 지정하지 않으면 `includeOpen=true` 파라미터가 함께 전송됩니다.
서버는 생성일 기간 밖이더라도 `STATUS IN ('OPEN','CLOSED','LOADED')`인 팔레트를 결과에 포함합니다.
화면에서는 기간 밖 미완료 행을 왼쪽 주황색 테두리로 구분하고 상단에 건수 알림을 표시합니다.

## ② 포함 박스 패널 — BOX_MASTERS

API: `GET /shipping/pallets/barcode/{palletNo}/boxes`

| 화면 항목 | DB 컬럼 | 역할 / 의미 |
|------|------|------|
| **박스번호** | `BOX_NO` | 적재된 박스 식별자. |
| **품목코드** | `ITEM_CODE` | 박스 안 완제품 코드. |
| **수량** | `QTY` | 박스 내 수량. |
| **OQC 상태** | `OQC_STATUS` | PASS / FAIL / PENDING. 패널에서 표시됨. |
| **제거(X)** | — | OPEN 상태에서만 표시. `DELETE .../boxes` 호출. |

## 버튼·API·상태 전이

| 버튼/액션 | API | 허용 조건 | 결과 상태 / DB 영향 |
|------|------|------|------|
| **팔레트 생성** | `POST /shipping/orders/{shipOrderNo}/pallets` | 출하지시 CONFIRMED + 기존 팔레트 없음 | `PALLET_MASTERS` INSERT (STATUS=OPEN) |
| **박스 할당** | `POST /shipping/orders/{shipOrderNo}/pallets/{palletNo}/boxes { boxIds }` | STATUS=OPEN + 출하지시 연결 | `BOX_MASTERS.PALLET_NO` 설정, `PALLET_MASTERS.BOX_COUNT·TOTAL_QTY` 갱신 |
| **박스 제거** | `DELETE /shipping/orders/{shipOrderNo}/pallets/{palletNo}/boxes { boxIds }` | STATUS=OPEN | `BOX_MASTERS.PALLET_NO` NULL 해제, 집계 갱신 |
| **마감(CLOSE)** | `POST /shipping/orders/{shipOrderNo}/pallets/{palletNo}/close` | STATUS=OPEN + 출하지시 연결 | OPEN → CLOSED, `CLOSE_AT` 기록 |
| **재오픈** | `POST /shipping/pallets/{palletNo}/reopen` | STATUS=CLOSED | CLOSED → OPEN, `CLOSE_AT` 초기화 |
| **라벨 출력** | `GET /master/label-templates?category=pallet` (라벨 템플릿 조회) + `window.print()` | 항상 | DB 변경 없음. Code128 바코드 + 팔레트정보 100mm×120mm 인쇄 |
| **빈 팔레트 삭제** | `DELETE /shipping/pallets/{palletNo}` | STATUS=OPEN + BOX_COUNT=0 + SHIPMENT_ID=NULL | `PALLET_MASTERS` DELETE |
| **바코드 스캔(검색)** | (클라이언트 검색 필터) | 항상 | 스캔한 팔레트번호로 목록 필터 |

## 상태 코드 (PALLET_STATUS)

| 코드 | 화면 라벨 | 의미 | 허용 작업 |
|------|------|------|------|
| `OPEN` | 진행중 | 박스 적재 가능 | 박스 추가·제거·마감·빈 팔레트 삭제 |
| `CLOSED` | 마감 | 구성 완료, 라벨 출력 대기 | 재오픈·라벨출력 |
| `LOADED` | 적재 | 차량·컨테이너 상차 완료 | 라벨출력(조회 전용) |
| `SHIPPED` | 출하 | 출하 완료 | 조회·라벨출력만 |

## 박스 할당 조건

| 조건 | DB 컬럼 | 설명 |
|------|------|------|
| 포장 완료 | `BOX_MASTERS.STATUS = 'CLOSED'` | 포장관리에서 마감된 박스 |
| 팔레트 미할당 | `BOX_MASTERS.PALLET_NO IS NULL` (`unassigned=true`) | 다른 팔레트에 배정되지 않은 박스 |
| OQC 합격 | `BOX_MASTERS.OQC_STATUS = 'PASS'` | `OQC_ENABLED=true` 시에만 적용. 미활성화 시 OQC 조건 무시 |

> `OQC_ENABLED`는 시스템설정(`SYSTEM_CONFIGS`)에서 관리합니다. 미활성화 시 OQC FAIL 또는 PENDING 박스도 할당 가능합니다.

## 팔레트 생성 인터록

| 조건 | 차단 동작 |
|------|------|
| 출하지시 미선택 | [생성] 버튼 비활성 |
| 출하지시 STATUS ≠ CONFIRMED | 대기 목록에 미표시, 스캔 시 오류 메시지 |
| 출하지시에 팔레트 이미 존재 | 대기 목록에 미표시 |
| 출하지시의 미출하 품목 없음 | 대기 목록에 미표시 |

## 사전 설정 (마스터·공통코드)

| 항목 | 관리 위치 | 비고 |
|------|------|------|
| 공통코드 PALLET_STATUS | 공통코드 관리 | OPEN / CLOSED / LOADED / SHIPPED |
| OQC_ENABLED | 시스템설정(`SYSTEM_CONFIGS`) | 박스 할당 OQC 조건 on/off |
| 팔레트 라벨 템플릿 | 라벨마스터(`/master/label`) | category='pallet'. 없으면 기본 라벨 사용 |
| 출하지시 | `SHIPMENT_ORDERS` (CONFIRMED) | 팔레트 생성 전에 먼저 출하지시 확정 필요 |

## 운영 절차

1. **일일 조회**: 생성일 기간을 오늘로 설정하고 OPEN/CLOSED 팔레트를 확인합니다.
2. **기간 밖 미완료 확인**: 주황색 테두리 행을 검토해 미완료 팔레트를 처리하거나 출하처리 화면으로 이관합니다.
3. **팔레트 생성**: [팔레트 생성] → 출하지시 스캔 또는 목록 선택 → [생성].
4. **박스 적재**: 생성된 팔레트 행의 [+박스추가] → 박스 스캔 또는 목록 선택 → [할당].
5. **마감**: 박스 구성 완료 후 [마감] → CLOSED 전환.
6. **라벨 출력**: [라벨출력] → 템플릿 선택 → [라벨 출력] → 100mm×120mm 인쇄.
7. **재오픈**: 오적재 발견 시 [재오픈] → OPEN 복귀 → 박스 제거/추가 → 재마감.
8. **출하처리 연계**: 출하처리 화면(`/shipping/pallet-ship`)에서 LOADED → SHIPPED 처리.

## 권한

- **일반 사용자**: 팔레트 조회·생성·박스 할당/제거·마감·재오픈·라벨 출력.
- **관리자**: 출하 취소, 시스템설정(OQC_ENABLED) 변경, 라벨 템플릿 관리.

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| 팔레트 생성 모달에 출하지시가 없음 | STATUS ≠ CONFIRMED 또는 이미 팔레트 존재 또는 미출하 품목 없음 | 출하지시관리에서 CONFIRMED 확인, 기존 팔레트 여부 조회 |
| 박스 할당 모달에 박스가 없음 | 포장 미완료 또는 이미 할당됨 또는 OQC 미합격 | 포장관리·외관검사 화면에서 박스 상태 확인 |
| 박스 스캔 시 "적재 가능한 박스를 찾을 수 없습니다" | CLOSED 아님 또는 PALLET_NO 이미 설정됨 또는 OQC FAIL | `BOX_MASTERS` 직접 조회해 STATUS·PALLET_NO·OQC_STATUS 확인 |
| 마감 버튼 비활성 | STATUS ≠ OPEN 또는 SHIP_ORDER_NO NULL | 팔레트 상태·출하지시 연결 확인 |
| 재오픈 버튼 비활성 | STATUS ≠ CLOSED | OPEN/LOADED/SHIPPED 상태에서는 재오픈 불가 |
| 빈 팔레트 삭제 불가 | BOX_COUNT > 0 또는 SHIPMENT_ID 있음 | 박스를 먼저 제거하거나 출하번호 연결 해제 후 재시도 |
| 기간 밖 팔레트가 목록에 보임 | `includeOpen=true` 자동 포함 | 상태 필터를 지정해 자동 포함 해제, 또는 해당 팔레트 출하완료 처리 |
| 라벨 인쇄 불가 | 브라우저 팝업 차단 | 브라우저 팝업 허용 설정 변경 후 재시도 |
| `ORA-04068` (PL/SQL INVALID) | DDL 변경 후 패키지 무효화 | `ALTER PACKAGE {패키지명} COMPILE` 실행 |

## 데이터·연계

- **화면 경로**: `/shipping/pallet`
- **MENU_CODE**: `SHIP_PALLET`
- **주요 테이블**: `PALLET_MASTERS`, `BOX_MASTERS`
- **참조 테이블**: `SHIPMENT_ORDERS`, `ITEM_MASTERS`, `SYSTEM_CONFIGS`(OQC_ENABLED), `LABEL_TEMPLATES`
- **연계 API**:
  - `GET /shipping/pallets` — 목록 조회
  - `POST /shipping/orders/{shipOrderNo}/pallets` — 팔레트 생성
  - `GET /shipping/pallets/barcode/{palletNo}/boxes` — 포함 박스 조회
  - `GET /shipping/boxes?status=CLOSED&unassigned=true&oqcStatus=PASS` — 할당 가능 박스
  - `POST /shipping/orders/{shipOrderNo}/pallets/{palletNo}/boxes` — 박스 할당
  - `DELETE /shipping/orders/{shipOrderNo}/pallets/{palletNo}/boxes` — 박스 제거
  - `POST /shipping/orders/{shipOrderNo}/pallets/{palletNo}/close` — 마감
  - `POST /shipping/pallets/{palletNo}/reopen` — 재오픈
  - `DELETE /shipping/pallets/{palletNo}` — 빈 팔레트 삭제
  - `GET /master/label-templates?category=pallet` — 라벨 템플릿 조회
- **멀티테넌시**: `COMPANY='40'`, `PLANT_CD='1000'`
- **연계 화면**: 출하지시(`/shipping/order`) → 포장관리(`/shipping/pack`) → 팔레트적재(현재) → 출하처리(`/shipping/pallet-ship`)
