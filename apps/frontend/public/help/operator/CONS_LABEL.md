---
menuCode: CONS_LABEL
audience: operator
title: 소모품 라벨발행 — 운영 가이드
summary: 소모품 UID(conUid) 채번·미입고(PENDING) 인스턴스 생성, 라벨 인쇄/재발행 로직, CONSUMABLE_STOCKS·LABEL_PRINT_LOGS 매핑, 채번 규칙(F_GET_CON_UID), 라벨 템플릿, 입고확정 연계, 권한·트러블슈팅·멀티테넌시
tags: [소모품, 라벨, 발행, 인쇄, 운영]
keywords: [CONSUMABLE_STOCKS, CONSUMABLE_MASTERS, LABEL_PRINT_LOGS, CON_UID, conUid, F_GET_CON_UID, CON_UID_SEQ, 소모품UID, 채번, PENDING, ACTIVE, CON_STOCK_STATUS, 라벨발행, 라벨템플릿, LABEL_TEMPLATES, 인쇄, 재발행, print agent, ZPL, BROWSER, 멀티테넌시, COMPANY, PLANT_CD]
related: [CONS_MASTER, CONS_RECEIVING]
---

# 소모품 라벨발행 — 운영 가이드

## 시스템 목적·역할
소모품 마스터(`CONSUMABLE_MASTERS`)를 기준으로 **개별 추적용 UID(`CON_UID`)**를 채번해 `CONSUMABLE_STOCKS`에 **미입고(PENDING) 인스턴스**를 생성하고, 라벨을 인쇄·재발행하는 화면입니다. 발행은 입고가 아니라 **추적 개체 생성 + 라벨 출력**이며, 실제 입고(재고 증가)는 [소모품입고](`CONS_RECEIVING`)에서 바코드 스캔으로 확정합니다.

> API 기준(컨트롤러 `consumables/label`): 발행 가능 마스터 `GET /consumables/label/masters`, UID 채번+PENDING 생성 `POST /consumables/label/create`, 미입고 목록 `GET /consumables/label/pending`, 단건/다건 입고확정 `POST /consumables/label/confirm`·`confirm-bulk`, 스캔 반납/출고/출고취소 `POST /consumables/label/return`·`issue`·`issue-return`. 우측 패널의 인스턴스 조회는 `GET /consumables/stocks`(파라미터 `consumableCode`·`status`), 인쇄 이력 보강 기록은 `POST /material/label-print/log`, 템플릿은 `GET /master/label-templates?category=jig`.
>
> 화면 그리드 하단의 `SELECT * FROM CON_LABELS ...`는 표시용 라벨 문구일 뿐이며, 실제 테이블명은 `CONSUMABLE_STOCKS`다.

## 데이터 구조
```
CONSUMABLE_MASTERS (PK: CONSUMABLE_CODE)         소모품 마스터
   └─ 1:N ─▶ CONSUMABLE_STOCKS (PK: CON_UID)     개별 인스턴스(발행 단위)
                 status: PENDING → ACTIVE → MOUNTED/ISSUED/RETURNED ...

LABEL_PRINT_LOGS (PK: PRINTED_AT + SEQ)          라벨 발행 이력
   category='con_uid', UID_LIST=발행 UID JSON 배열
```
- 발행 1회 = `qty`만큼 `CONSUMABLE_STOCKS` 행 생성 + `LABEL_PRINT_LOGS` 1건.
- 미입고 패널은 같은 마스터의 `status='PENDING'` 행만 클라이언트에서 필터링해 표시.

## ① 발행 대상 목록 — CONSUMABLE_MASTERS / 집계(CONSUMABLE_STOCKS)

`GET /consumables/label/masters`가 `useYn='Y'` 마스터에 인스턴스 집계를 붙여 반환한다.

| 화면 항목 | DB 컬럼 / 산출 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 선택(체크박스) | (UI 상태) | 발행 대상 다중 선택. 헤더 체크로 전체 토글. 0건이면 발행 버튼 disabled. |
| 이미지 | `CONSUMABLE_MASTERS.IMAGE_URL` | 썸네일·라벨 이미지. `resolveBackendFileUrl`로 백엔드 경로 해석, 로드 실패 시 placeholder. |
| 소모품코드 | `CONSUMABLE_MASTERS.CONSUMABLE_CODE` | 발행 UID가 묶이는 자연키(FK 대상). |
| 소모품명 | `CONSUMABLE_MASTERS.NAME` (속성 `consumableName`) | 검색·라벨 표기. |
| 카테고리 | `CONSUMABLE_MASTERS.CATEGORY` | 공통코드 `CONSUMABLE_CATEGORY`(MOLD/JIG/TOOL). 상단 필터 기준. `ComCodeBadge`로 표시. |
| 현재고 | `CONSUMABLE_MASTERS.STOCK_QTY` | 입고확정 시 +1, 반납/출고 시 -1 되는 보유 수량. |
| 인스턴스 | `COUNT(*)` of `CONSUMABLE_STOCKS` (속성 `instanceCount`) | 발행 누적 개체 수. 옆의 `(미입고: n)`은 `SUM(status='PENDING')`(속성 `pendingCount`). |
| 발행수량 | (UI 상태 `qtyMap`) | 이번 채번 수량. UI 1~99 보정, DTO 검증 1~999(`@Min(1)@Max(999)`). |

## ② 라벨 발행 도구 (상단 우측)

| 화면 항목 | 연계 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 상태 메시지 | (UI `issueStatus`) | loading/success/error 한 줄 표시. `aria-live=polite`. |
| 새로고침 | `GET /consumables/label/masters` | 목록·집계 재조회. |
| 라벨 템플릿 선택 | `GET /master/label-templates?category=jig` | `LABEL_TEMPLATES` 중 jig 카테고리. `isDefault` 우선, 없으면 첫 항목. `__default__`는 내장 기본 디자인(`createDefaultLabelDesign('jig')`). `designData`는 JSON(문자열이면 parse). |
| UID 발행 | `POST /consumables/label/create` | 선택 마스터별로 `{consumableCode, qty}` 전송 → conUid 채번 → 인쇄. |

## ③ 미입고 인스턴스 패널 — CONSUMABLE_STOCKS

`GET /consumables/stocks?consumableCode=...`로 조회 후 `status='PENDING'`만 표시.

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 소모품 UID | `CON_UID` | PK. 라벨/바코드 추적 키. |
| 상태 | `STATUS` | 공통코드 `CON_STOCK_STATUS`. 패널은 `PENDING`만. (전이: PENDING→ACTIVE→MOUNTED/ISSUED/RETURNED/REPAIR/SCRAPPED) |
| 보관위치 | `LOCATION` | 입고확정 시 지정 가능. |
| 사용횟수 | `CURRENT_COUNT` / 마스터 `EXPECTED_LIFE` | `현재타수 / 기대수명` 표기. 미입고는 보통 0. |
| 입고일 | `RECV_DATE` | 입고확정 시각. PENDING은 null(`-`). |
| 장착설비 | `MOUNTED_EQUIP_CODE` (속성 `mountedEquipCode`) | 장착 흐름에서 갱신. |
| 공급처 | `VENDOR_CODE`, `VENDOR_NAME` | 채번 시 dto/마스터에서 승계. |
| 미리보기 | (UI) | `LabelDesignRenderer`로 모달 미리보기(인쇄 안 함). |
| 재발행 | `POST /material/label-print/log` + print agent | 라벨을 PNG로 렌더 → `printAgentPng`로 프린터 전송 + 인쇄로그. |

## ④ 라벨 발행 이력 — LABEL_PRINT_LOGS

| 화면 항목(비표시) | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| (자동) 발행시각 | `PRINTED_AT` | 복합 PK 1. |
| (자동) 순번 | `SEQ` | 복합 PK 2(create 시 1 고정). |
| (자동) 분류 | `CATEGORY` | `'con_uid'` 고정. |
| (자동) 인쇄방식 | `PRINT_MODE` | `BROWSER`(브라우저 출력) / `ZPL`(직접출력). create·로그는 `BROWSER`. |
| (자동) UID 목록 | `UID_LIST` | 발행 conUid JSON 배열(CLOB). |
| (자동) 라벨수 | `LABEL_COUNT` | 발행 건수(create는 `qty`). |
| (자동) 상태 | `STATUS` | `SUCCESS`/`FAILED`. |
| (키) 멀티테넌시 | `COMPANY`, `PLANT_CD` | `40` / `1000`(속성 `company`, `plant`). |

## UID 채번 규칙 (CON_UID)
- 발행 시 `NumberingService.nextConUid()` → `PKG_SEQ_GENERATOR`(채번 유형 `CON_UID`)를 통해 트랜잭션 내 채번(결번 없음).
- 형식 함수 `F_GET_CON_UID`: `'C' + TO_CHAR(SYSDATE,'YYMMDD') + LPAD(CON_UID_SEQ.NEXTVAL, 5, '0')`.
  - 예) 2026-06-23 발행 → `C2606230001`, `C2606230002` …
- `CON_UID_SEQ`는 Oracle SEQUENCE. 일자 prefix가 붙어 날짜별로 구분되며, 시퀀스 값으로 유일성 보장.

## 발행 / 인쇄 로직 (브라우저 출력)
1. **선택 검증**: `selectedCodes` 0건이면 중단. 새 인쇄창 `window.open` 실패(팝업 차단) 시 오류 표시 후 중단.
2. **채번**(`createConUids`): 선택 마스터별 `POST /consumables/label/create`. 서버는 트랜잭션으로 `qty`만큼 `nextConUid()` → `CONSUMABLE_STOCKS`(status=`PENDING`, `LABEL_PRINTED_AT`=now, vendor·unitPrice 승계) 저장 + `LABEL_PRINT_LOGS` 1건 기록. 마스터 미존재 시 404.
3. **라벨 데이터 구성**: 각 conUid에 `consumableCode/Name/category/imageUrl/stockQty/expectedLife/location`을 묶어 `LabelPrintRenderer`로 그림.
4. **렌더 대기**: `data-label-barcode-pending` 플래그와 이미지 로드를 최대 2.5초 대기. 바코드 미완료 시 출력 차단(미리보기 권장).
5. **인쇄**: 새 창에 라벨 HTML + `@page size:{labelWidth}mm {labelHeight}mm`로 작성 후 `window.print()` 호출.
6. **인쇄 로그 보강**: `POST /material/label-print/log`(category=`con_uid`, printMode=`BROWSER`, uidList, SUCCESS). 실패는 무시(silent).
7. **마무리**: 선택 해제·상태 초기화·목록 새로고침.

### 재발행 로직 (agent 직접 출력)
- 우측 패널 **재발행**: 단일 conUid 라벨을 `renderLabelNodeToPngBase64`로 PNG(스케일 3배) 변환 → `printAgentPng({ jobId: 'CON-REPRINT-{conUid}', widthMm, heightMm, copies:1, contentBase64 })` 전송 → `POST /material/label-print/log` 기록. 라벨 프린트 agent(로컬 출력 서비스)가 떠 있어야 한다.
- **미리보기**는 채번·전송 없이 `LabelDesignRenderer` 모달만 표시(출력 전 바코드·배치 확인용).

## 사전 설정 (마스터·공통코드)
- 공통코드: `CONSUMABLE_CATEGORY`(MOLD/JIG/TOOL), `CON_STOCK_STATUS`(PENDING/ACTIVE/MOUNTED/REPAIR/SCRAPPED 등).
- 채번: Oracle `CON_UID_SEQ` 시퀀스 + `F_GET_CON_UID` 함수, `PKG_SEQ_GENERATOR`에 `CON_UID` 유형 등록(`seed_seq_rules.sql`).
- 라벨 템플릿: `LABEL_TEMPLATES`에 `category='jig'` 디자인이 있어야 선택 가능(없으면 내장 기본 디자인 사용). 디자인·템플릿 관리는 라벨관리 화면.
- 대상 소모품은 `CONSUMABLE_MASTERS.USE_YN='Y'`여야 목록에 노출.

## 운영 절차
1. 라벨관리에서 소모품(jig) 라벨 **템플릿**을 만들고 기본값 지정(선택).
2. 본 화면에서 소모품 선택 + 발행수량 입력 → **UID 발행** → 라벨 출력 → 실물 부착.
3. 라벨 분실·훼손 시 우측 패널에서 해당 UID **재발행**.
4. 부착 후 **소모품입고**에서 바코드 스캔 → 입고확정(`POST /consumables/label/confirm`): `CONSUMABLE_STOCKS.STATUS` PENDING→ACTIVE, `RECV_DATE` 설정, `CONSUMABLE_MASTERS.STOCK_QTY +1`, `CONSUMABLE_LOGS`에 IN 이력(`SEQ_CONSUMABLE_LOGS.NEXTVAL`).

## 권한
소모품/자재 관리자(발행·재발행). 일반 사용자는 조회. 라벨 직접출력(agent)은 출력 에이전트가 설치된 단말에서만 동작.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| UID 발행 버튼 비활성 | 선택 0건 또는 발행/인쇄 진행 중 | 소모품 1건 이상 체크, 진행 완료 후 재시도 |
| "브라우저가 출력창을 차단" | 팝업 차단 | 사이트 팝업 허용 후 재발행 |
| "발행된 UID가 없습니다" | 선택 항목·발행수량 0 | 발행수량(1~99) 확인 |
| "바코드 생성이 완료되지 않았습니다" | 바코드 렌더 미완(2.5초 초과) | 미리보기로 라벨 확인 후 다시 출력 |
| 발행 시 404(마스터 없음) | `consumableCode` 미존재/타테넌트 | 소모품 마스터 등록·테넌트 확인 |
| 재발행 시 "agent 출력 오류" | 라벨 프린트 agent 미기동/오류 | 출력 에이전트 상태·프린터 연결 확인 |
| 미입고 목록이 비어 있음 | 해당 소모품 PENDING 없음(이미 입고/없음) | 발행 여부·입고확정 상태 확인 |
| 라벨에 이미지 안 나옴 | `IMAGE_URL` 파일 404 | 소모품 마스터에서 이미지 재업로드 |
| 인스턴스 수만 늘고 재고 변동 없음 | 입고확정 미수행(PENDING 상태) | 소모품입고에서 스캔·입고확정 |

## 데이터·연계
- 테이블: `CONSUMABLE_STOCKS`(발행 인스턴스·PK `CON_UID`), `CONSUMABLE_MASTERS`(마스터·발행 대상), `LABEL_PRINT_LOGS`(발행 이력), `CONSUMABLE_LOGS`(입고확정 시 IN 이력), `LABEL_TEMPLATES`(라벨 디자인)
- 채번: `CON_UID_SEQ` + `F_GET_CON_UID` + `PKG_SEQ_GENERATOR(CON_UID)`
- 연계 화면: 소모품 마스터(발행 대상), 소모품입고(스캔 입고확정), 라벨관리(템플릿 디자인)
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
