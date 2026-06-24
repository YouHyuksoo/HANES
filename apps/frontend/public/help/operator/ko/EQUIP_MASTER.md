---
menuCode: EQUIP_MASTER
audience: operator
title: 설비마스터 — 운영 가이드
summary: 설비마스터(EQUIP_MASTERS)·설비BOM(EQUIP_BOM_ITEMS/EQUIP_BOM_RELS) 전체 컬럼 DB 매핑, API 경로, 통신설정, 권한, 트러블슈팅, 멀티테넌시 스코프
tags: [기준정보, 설비, 마스터, BOM, 운영]
keywords: [EQUIP_MASTERS, EQUIP_BOM_ITEMS, EQUIP_BOM_RELS, EQUIP_CODE, COMM_TYPE, COMM_CONFIG, EQUIP_TYPE, IP_ADDRESS, PORT, PROCESS_CODE, LINE_CODE, BOM_ITEM_CODE, 복합키, 멀티테넌시, COMPANY, PLANT_CD]
related: [MST_PART, MST_PROD_LINE, MST_PROCESS]
---

# 설비마스터 — 운영 가이드

## 시스템 목적·역할
설비 기준정보를 보유하는 **마스터 테이블 `EQUIP_MASTERS`**와, 설비별 부품·소모품 구성을 관리하는 **`EQUIP_BOM_ITEMS`(품목)·`EQUIP_BOM_RELS`(연결)** 관리 화면입니다. 생산실적·키오스크·설비통신·점검(일상/정기)·금형·PM이 `EQUIP_CODE`로 이 마스터를 참조합니다.

## 데이터 구조
```
EQUIP_MASTERS (PK: COMPANY, PLANT_CD, EQUIP_CODE)
   └─ EQUIP_BOM_RELS (PK: EQUIP_CODE, BOM_ITEM_CODE / FK→설비, BOM품목, onDelete CASCADE)
         └─▶ EQUIP_BOM_ITEMS (PK: BOM_ITEM_CODE) — 부품(PART)/소모품(CONSUMABLE)
   참조: 생산실적 / 키오스크 / 설비통신 / 일상·정기점검 / 금형 / PM
```

## API 경로
- 설비 마스터: `GET/POST /equipment/equips`, `PUT/DELETE /equipment/equips/:id`, `PATCH /equipment/equips/:id/status`, `POST/DELETE /equipment/equips/:id/image`
- 조회 보조: `GET /equipment/equips/code/:equipCode`, `/line/:lineCode`, `/type/:equipType`, `/status/:status`, `/stats`, `/maintenance`
- BOM 품목: `GET/POST /master/equip-bom/items`, `PUT/DELETE /master/equip-bom/items/:id`
- 설비-BOM 연결: `GET /master/equip-bom/equip/:equipCode`, `POST /master/equip-bom/rels`, `PUT/DELETE /master/equip-bom/rels/:equipCode/:bomItemCode`

## ① 설비 기본정보 — EQUIP_MASTERS

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 설비코드 | `EQUIP_CODE` | PK 구성(자연키). 불변 권장 — 생산실적·BOM·통신이 이 코드 참조. |
| 설비명 | `EQUIP_NAME` | 표시명. |
| 유형 | `EQUIP_TYPE` | 공통코드 EQUIP_TYPE. 값: COMMON/AUTO_CRIMP/SINGLE_CUT/MULTI_CUT/TWIST/SOLDER/HOUSING/TESTER/LABEL_PRINTER/INSPECTION/PACKING/OTHER. |
| 모델명 | `MODEL_NAME` | 설비 모델. |
| 사진 | `IMAGE_URL` | 업로드 경로(`/uploads/equips/...`). 업로드/삭제는 별도 엔드포인트. |
| 제조사 | `MAKER` | 설비 제조사. |
| 라인 | `LINE_CODE` | 소속 생산 라인. Serial 통신 표시에 사용. |
| 공정 | `PROCESS_CODE` | 소속 공정. 그리드에 공정명/코드 함께 표시. |
| IP 주소 | `IP_ADDRESS` | TCP/MQTT 통신 IP. DTO에서 `@IsIP` 검증(빈 값 허용). |
| 포트 | `PORT` | 통신 포트(1~65535, int). |
| 통신방식 | `COMM_TYPE` | 공통코드 COMM_TYPE. shared 값: MQTT/SERIAL/TCP/OPC_UA/MODBUS. 화면 표시는 None/MQTT/Serial/TCP/IP. |
| 통신상세 | `COMM_CONFIG` | 통신 상세설정 JSON(Oracle CLOB). baudRate/dataBits 등. 수동 parse/stringify. |
| 설치일 | `INSTALL_DATE` | 설비 설치일(date). |
| 상태 | `STATUS` | EQUIP_STATUS_VALUES(NORMAL/MAINT/STOP), 기본 NORMAL. 상태변경 PATCH 별도. |
| 작업지시 | `CURRENT_JOB_ORDER_ID` | 현재 할당된 작업지시. `PATCH /:id/job-order`로 할당/해제. |
| 사용여부 | `USE_YN` | Y만 활성(기본 Y). |
| 감사 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 생성/수정 이력(CREATE/UPDATE DateColumn). |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | PK 구성. `40` / `1000` 스코프. |

## ② 설비 BOM 품목 — EQUIP_BOM_ITEMS

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 품목코드 | `BOM_ITEM_CODE` | PK(자연키). 불변. PartMaster의 itemCode와 충돌 방지 위해 별도 명명. |
| 품목명 | `BOM_ITEM_NAME` | 부품/소모품명(프론트 `itemName`). |
| 유형 | `ITEM_TYPE` | PART(부품)/CONSUMABLE(소모품), 기본 PART. |
| 규격 | `SPEC` | 사양/치수. |
| 제조사 | `MAKER` | 부품/소모품 제조사. |
| 단위 | `UNIT` | 수량 단위(기본 EA). |
| 단가 | `UNIT_PRICE` | decimal(12,2). 원화 표시. |
| 교체주기 | `REPLACEMENT_CYCLE` | 권장 교체 주기 일수(number). |
| 현재재고 | `STOCK_QTY` | 보유 재고(float, 기본 0). 안전재고 이하 시 화면 강조. |
| 안전재고 | `SAFETY_STOCK` | 부족 판단 기준(int, 기본 0). |
| 사용여부 | `USE_YN` | Y만 연결/선택 대상(기본 Y). |
| 감사 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 생성/수정 이력. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | `40` / `1000` 스코프. |

## ③ 설비-BOM 연결 — EQUIP_BOM_RELS

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 설비코드 | `EQUIP_CODE` | 복합 PK. EQUIP_MASTERS FK(onDelete CASCADE — 설비 삭제 시 연결 동반 삭제). |
| 품목코드 | `BOM_ITEM_CODE` | 복합 PK. EQUIP_BOM_ITEMS FK(onDelete CASCADE). API 등록 시 body는 `bomItemId`로 전달. |
| 수량 | `QUANTITY` | 설비당 필요 수량(float, 기본 1). |
| 설치일 | `INSTALL_DATE` | 부품/소모품 설치일(date). |
| 유효기한 | `EXPIRE_DATE` | 교체 권장 기한(date). 지난 날짜 화면 빨강 표시. |
| 비고 | `REMARK` | 연결 참고사항. |
| 사용여부 | `USE_YN` | Y만 BOM 목록에 노출(기본 Y). |
| 감사 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 생성/수정 이력. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | `40` / `1000` 스코프. FK 조인에 포함. |

## 통신설정 동작
- `COMM_TYPE`이 **TCP/MQTT**일 때만 화면이 `ipAddress`/`port`를 전송·저장. SERIAL/NONE은 IP·포트 미저장.
- 화면의 `mqttTopic`·`serialPort`·`baudRate`는 UI 입력란이며, 상세 통신 파라미터는 `COMM_CONFIG`(CLOB JSON)로 관리하는 구조다. 저장 본문에는 직접 매핑되지 않으므로 운영 시 통신 상세는 `COMM_CONFIG` 기준으로 점검.
- IP는 `@IsIP`, 포트는 `@Min(1)/@Max(65535)` 검증.

## 사전 설정 (마스터·공통코드)
- 공통코드: `EQUIP_TYPE`, `COMM_TYPE`, `EQUIP_STATUS`(NORMAL/MAINT/STOP), `USE_YN`
- 라인(`LINE_CODE`)·공정(`PROCESS_CODE`)이 선행 등록되어야 설비에 연결 가능.
- BOM 연결 전 `EQUIP_BOM_ITEMS`에 품목이 먼저 등록되어야 함.

## 운영 절차
1. 설비 등록: `POST /equipment/equips`(중복 코드 시 409). 사진은 `POST /:id/image`로 별도 업로드.
2. 상태 운영: 정비/중지 전환은 `PATCH /:id/status`(사유 reason 기록), 정비중/중지 목록은 `/maintenance`.
3. BOM 품목 등록 후, 설비 선택 → 연결 생성(`POST /master/equip-bom/rels`, body `bomItemId`).
4. 연결 수정/해제는 `equipCode/bomItemCode` 복합키로 수행.

## 권한
기준정보 관리자(설비/BOM 등록·수정·삭제, 상태 변경, 사진 업로드). 일반 사용자는 조회.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 설비 저장 시 409 | 동일 `EQUIP_CODE` 존재 | 코드 확인(불변 자연키), 다른 코드 사용 |
| IP 입력 시 검증 오류 | 잘못된 IP 형식 또는 포트 범위 초과 | 유효 IP, 포트 1~65535로 수정 |
| 통신설정 입력란 안 보임 | `COMM_TYPE`이 TCP/MQTT/SERIAL이 아님 | 통신방식을 해당 값으로 변경 |
| 설비 삭제했더니 BOM 연결도 사라짐 | `EQUIP_BOM_RELS` FK onDelete CASCADE | 정상 동작. 연결만 해제하려면 rels 삭제 사용 |
| 설비 BOM 목록이 비어 있음 | 설비 미선택 또는 `USE_YN='N'` 연결만 존재 | 설비 선택 확인, 연결 `USE_YN` 확인 |
| 그리드 사진 깨짐 | `IMAGE_URL` 경로 파일 없음(404) | 사진 재업로드(프론트는 아이콘 fallback) |
| BOM 품목이 연결 선택지에 없음 | 품목 `USE_YN='N'` | 품목 사용여부 Y로 활성화 |

## 데이터·연계
- 테이블: `EQUIP_MASTERS`, `EQUIP_BOM_ITEMS`, `EQUIP_BOM_RELS`
- 연계: 생산실적·키오스크(설비 선택), 설비통신/프로토콜(`COMM_TYPE`/`COMM_CONFIG`), 일상·정기점검, 금형, PM
- 외부 저장: 설비 사진 `/uploads/equips/`(디스크)
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
