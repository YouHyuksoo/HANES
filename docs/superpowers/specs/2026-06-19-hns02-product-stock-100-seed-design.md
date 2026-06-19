# HNS02 제품재고 100개 — BOM 완전 다단계 정합 시드 (설계)

- 작성일: 2026-06-19
- 사이트: **JSHANES** / `COMPANY='40'` / `PLANT_CD='1000'`
- 목표: 포장 가능한 완제품 **HNS02** 제품재고 **100개**를, PO→입하→입고→자재재고→투입→작업지시→생산실적→반제품(SG)→제품재고(FG)→검사→장착 전 구간 **정합이 깨지지 않게** 생성한다.

## 1. 확정 결정 (사용자 합의)

1. **정합 깊이**: 완전 다단계 BOM (원자재까지 7단계 전개)
2. **작업지시**: BOM 트리의 **품번당 정확히 1건** (완제품 1 + 반제품 16 = **17건**)
3. **출하**: 만들지 않음 → 최종 제품재고 HNS02 = **100개 보유**
4. **기존 데이터**: 기존 HNS02 계열 트랜잭션 **정리(DELETE) 후 클린 재구성**
5. **기준정보 테이블은 읽기 전용** — ITEM_MASTERS / BOM_MASTERS / ROUTING_* / WAREHOUSES / PARTNER·VENDOR / 공정·설비 등 절대 수정 금지

## 2. 기준정보 사실 (읽기 전용, 실측 2026-06-19)

### 2.1 BOM 트리 (rev A) → 작업지시 17건과 수량

HNS02 100개 기준 누적 소요량(= 작업지시 PLAN_QTY=GOOD_QTY):

| 레벨 | 품번 | ITEM_TYPE | 라우팅 | 수량 |
|---|---|---|---|---|
| 0 | HNS02 | FINISHED | RT-HNS02 | 100 |
| 1 | HNS02_FA | SEMI | HNS02_FA | 100 |
| 2 | HNS02_FB | SEMI | HNS02_FB | 100 |
| 3 | HNS02C1 | SEMI | HNS02C1 | 100 |
| 3 | HNS02C2 | SEMI | HNS02C2 | 100 |
| 4 | HNS02C1A | SEMI | HNS02C1A | 100 |
| 5 | HNS02-SCA | SEMI | HNS02-SCA | **200** |
| 6 | HNS02-SCA_1 | SEMI | HNS02-SCA_1 | **200** |
| 7 | HNS02-SCA_2 | SEMI | HNS02-SCA_2 | **200** |
| 5 | HNS02C1AB | SEMI | HNS02C1AB | 100 |
| 6 | HNS02C1ABC | SEMI | HNS02C1ABC | 100 |
| 7 | HNS02C1ABCD | SEMI | HNS02C1ABCD | 100 |
| 4 | HNS02C2A | SEMI | HNS02C2A | 100 |
| 5 | HNS02C2AB | SEMI | HNS02C2AB | 100 |
| 6 | HNS02C2ABC | SEMI | HNS02C2ABC | 100 |
| 7 | HNS02C2ABCD | SEMI | HNS02C2ABCD | 100 |
| 8 | HNS02C2ABCDE | SEMI | HNS02C2ABCDE | 100 |

> 작업지시 PARENT_ID 트리는 BOM 부자관계를 따른다(HNS02 ← HNS02_FA ← HNS02_FB ← C1/C2 ← ...). HNS02-SCA 계열은 C1A당 2개라 200.

### 2.2 원자재(RAW) leaf 총소요량 (HNS02 100개분, 18종)

| 품번 | per HNS02 | ×100 | 소비 공정(OPER) |
|---|---|---|---|
| TP0001 | 800 | **80,000** | MASSY(300)+TAPPN(500) |
| CBL-B | 650 | **65,000** | ATCNS |
| CBL-SE | 500 | **50,000** | ATCUT |
| CBL-A | 500 | **50,000** | ATCUT |
| TUB-A | 20 | 2,000 | TUBHT |
| RSL-T | 4 | 400 | CRMPB |
| TMN-SE1 | 4 | 400 | CRMPB |
| NFT-A | 2 | 200 | MTASY |
| RSL-B | 2 | 200 | MTASY |
| HSG0001 | 1 | 100 | MASSY |
| CNTR001 | 1 | 100 | SASSY |
| HLD-01 | 1 | 100 | SASSY |
| TMN-B | 1 | 100 | WELDR |
| PHDL001 | 1 | 100 | MTASY |
| RSL-A | 1 | 100 | MTASY |
| TMN-A | 1 | 100 | CRMPF |
| TMN-C | 1 | 100 | CRMPR |
| CSH001 | 1 | 100 | HEXCP |

> 전개는 하드코딩하지 않고 구현 시 `BOM_MASTERS`를 재귀 조회해 산출·검증한다(위 표는 검증 기준값).

### 2.3 라벨/검사 발행 지점 (ROUTING_PROCESSES 실측)

- **SG 라벨**: `HNS02_FA / TAPPN(SEQ10)` → `ISSUE_SG_LABEL_YN='Y'`
- **FG 라벨**: `RT-HNS02 / SASSY(SEQ10)` → `ISSUE_FG_LABEL_YN='Y'`
- **완제품 검사**: `RT-HNS02` AINSP(통합/통전, SEQ20), OINSP(외관, SEQ30)
- 반제품 자주검사: HNS02C1/HNS02C2 의 TINSP, HNS02C1/WELDR 샘플검사 → (시드에서는 생략 또는 PASS 1건, §4.7)

### 2.4 창고 / 거래처

- 원자재 창고: `W001`(원자재창고)
- 반제품 창고: `WIP_MAIN`
- 완제품 창고: `FG_MAIN`
- 시드 자재 공급사: `VND-001`(한국단자공업) — 단일 공급사로 통일

## 3. 대상 스키마 계약 (실측 NOT NULL · 채번 · PK)

> 감사컬럼(CREATED_AT/UPDATED_AT)은 DEFAULT SYSTIMESTAMP/CURRENT_TIMESTAMP 존재 → INSERT에서 명시하지 않아도 됨. 단 일자 분포가 필요하면 명시.

| 테이블 | PK | 핵심 NOT NULL | 채번 |
|---|---|---|---|
| PURCHASE_ORDERS | PO_NO | STATUS, USE_TYPE, COMPANY, PLANT_CD | 시드 채번 |
| PURCHASE_ORDER_ITEMS | (PO_ID,SEQ?) | PO_ID, ITEM_CODE, ORDER_QTY, RECEIVED_QTY, SEQ, LINE_NO, REV_NO, LINE_STATUS | 라인 순번 |
| MAT_ARRIVALS | (ARRIVAL_NO,SEQ) | VENDOR_ID, VENDOR_NAME, ITEM_CODE, QTY, WAREHOUSE_CODE, ARRIVAL_TYPE, STATUS, IQC_STATUS, SEQ(SEQ_MAT_ARRIVALS) | 시드 채번 |
| IQC_LOGS | (INSPECT_DATE,SEQ) | ITEM_CODE, INSPECT_TYPE, RESULT, STATUS, SEQ, COMPANY, PLANT_CD | RESULT='PASS' |
| MAT_RECEIVINGS | (RECEIVE_NO,SEQ) | MAT_UID, ITEM_CODE, QTY, WAREHOUSE_CODE, STATUS, SEQ(SEQ_MAT_RECEIVINGS) | 시드 채번 |
| MAT_LOTS | MAT_UID | ITEM_CODE, INIT_QTY, CURRENT_QTY, VENDOR, IQC_STATUS, STATUS, SPECIAL_ACCEPT_YN | MAT_UID=`VH1-RM...` |
| MAT_STOCKS | (CO,PLANT,WH,ITEM,MAT_UID) | QTY, RESERVED_QTY, AVAILABLE_QTY | — |
| MAT_ISSUES | (ISSUE_NO,SEQ) | MAT_UID, ISSUE_QTY, ISSUE_TYPE, STATUS, SEQ(SEQ_MAT_ISSUES), ISSUE_NO | 시드 채번 |
| STOCK_TRANSACTIONS | TRANS_NO | TRANS_TYPE, ITEM_CODE, QTY, STATUS | 시드 채번 |
| JOB_ORDERS | ORDER_NO | ITEM_CODE, PLAN_QTY, GOOD_QTY, DEFECT_QTY, PRIORITY, STATUS, ERP_SYNC_YN | 시드 채번 |
| PROD_RESULTS | RESULT_NO | ORDER_NO, GOOD_QTY, DEFECT_QTY, STATUS | 시드 채번 |
| SG_LABELS | SG_BARCODE | ITEM_CODE, INIT_QTY, REMAIN_QTY, STATUS, ISSUED_AT | SG 채번 |
| FG_LABELS | FG_BARCODE | ITEM_CODE, ISSUED_AT, STATUS, REPRINT_COUNT | FG 채번 |
| PRODUCT_STOCKS | (CO,PLANT,WH,ITEM) | ITEM_TYPE, QTY, RESERVED_QTY, AVAILABLE_QTY, STATUS, VERSION | — |
| PRODUCT_TRANSACTIONS | TRANS_NO | TRANS_TYPE, ITEM_CODE, QTY, STATUS | 시드 채번 |
| INSPECT_RESULTS | RESULT_NO | PASS_YN, RESULT_NO, INSPECT_TIME, COMPANY, PLANT_CD | 시드 채번 |
| PRODUCT_GENEALOGY | GENEALOGY_ID | PARENT_TYPE, PARENT_KEY, CHILD_TYPE, CHILD_KEY, QTY | SEQ_PROD_GENEALOGY |

> 대상 테이블 간 DB 레벨 FK 제약 없음 → 정리/삽입은 **논리 역순/정순**으로 안전하게 처리.

### 채번 전략 (시드 전용, 식별·정리 용이)

기존 운영 채번(NumberingService/PKG)과 충돌·혼동을 피하기 위해 **시드 마커 포함 고유 채번**을 사용한다. 모두 `26061 9`(YYMMDD) + 순번. MAT_UID만 메모리 규칙대로 `VH1-RM` 유지.

| 대상 | 형식 | 예 |
|---|---|---|
| PO_NO | `POH-260619-001` | 1건 |
| ARRIVAL_NO | `ARH-260619-NNN` | 18 |
| RECEIVE_NO | `RVH-260619-NNN` | 18 |
| MAT_UID | `VH1-RM260619-NNNNN` | 18 LOT |
| ISSUE_NO | `ISH-260619-NNN` | 소비 건수 |
| ORDER_NO | `WOH-260619-NN` | 17 |
| RESULT_NO(생산) | `PRH-260619-NNN` | 17 |
| SG_BARCODE | `SGH260619NNNNN` | 100 |
| FG_BARCODE | `FGH260619NNNNN` | 100 |
| RESULT_NO(검사) | `IRH260619NNNNN` | 200 |
| STOCK_TX | `STH-260619-NNNNN` | |
| PRODUCT_TX | `PTH-260619-NNNNN` | |

> PRODUCT_GENEALOGY.GENEALOGY_ID 는 `SEQ_PROD_GENEALOGY.NEXTVAL` 사용(운영 시퀀스, 식별 무관).

## 4. 데이터 생성 흐름 (정합 단위)

### 4.0 정리 (DELETE, 트랜잭션 1)
기존 HNS02 계열 트랜잭션을 전량 삭제. **논리 역순**:
1. PRODUCT_GENEALOGY (PARENT_KEY/CHILD_KEY가 HNS02 FG/SG/MAT_UID)
2. INSPECT_RESULTS (FG_BARCODE/PROD_RESULT_ID 연계)
3. FG_LABELS / SG_LABELS (ITEM_CODE LIKE 'HNS02%')
4. PRODUCT_TRANSACTIONS / PRODUCT_STOCKS (ITEM_CODE LIKE 'HNS02%')
5. PROD_RESULTS (ORDER_NO ∈ HNS02 작업지시)
6. JOB_ORDERS (ITEM_CODE LIKE 'HNS02%') — 55건
7. MAT_ISSUES / STOCK_TRANSACTIONS (HNS02 자재 LOT·작업지시 연계분)
8. MAT_STOCKS / MAT_LOTS / MAT_RECEIVINGS / IQC_LOGS / MAT_ARRIVAL_STOCKS / MAT_ARRIVALS (HNS02 BOM 원자재 + 기존 HNS02 입하분)
9. PURCHASE_ORDER_ITEMS / PURCHASE_ORDERS (HNS02 시드 PO)

> ⚠️ 정리 범위 안전장치: 원자재(CBL-* 등)는 **다른 품번에서도 공유**될 수 있으므로, 무차별 `ITEM_CODE IN (원자재)` 삭제 금지. 삭제는 **이번 시드가 만든 채번(POH-/ARH-/VH1-RM260619-… 등)** 과 **HNS02 계열 ITEM_CODE 직접분**으로 한정한다. 1차 실행 시 기존 HNS02 트랜잭션 현황(작업지시 55건 외 자재/재고 0건)을 재확인 후 범위 확정.

### 4.1 구매발주 (트랜잭션 2~)
- PO 1건(`POH-260619-001`, STATUS='CLOSED', USE_TYPE='PROD', 공급사 VND-001) + 원자재 18라인(ORDER_QTY=총소요량, RECEIVED_QTY=동일, LINE_STATUS='CLOSED')

### 4.2 입하 → IQC → 입고 → 자재 LOT/재고
원자재 18종 각각:
- MAT_ARRIVALS 1건 (QTY=소요량, IQC_STATUS='PASS', STATUS='DONE', WH=W001, VENDOR_ID=VND-001)
- IQC_LOGS 1건 (RESULT='PASS', STATUS='DONE')
- MAT_RECEIVINGS 1건 (MAT_UID 발급, QTY=소요량, WH=W001)
- MAT_LOTS 1건 (MAT_UID, INIT_QTY=소요량, CURRENT_QTY=소비 후 잔량=0, IQC_STATUS='PASS', STATUS='DEPLETED'(전량소비), VENDOR='한국단자공업')
- MAT_STOCKS 1행 (WH=W001, QTY=잔량=0, AVAILABLE_QTY=0)
- STOCK_TRANSACTIONS: MAT_IN(+소요량)

### 4.3 자재 투입(출고) — 생산 소비
- 각 원자재 LOT을 소비 공정에서 출고: MAT_ISSUES(ISSUE_TYPE='PROD') + STOCK_TRANSACTIONS MAT_OUT(−소요량)
- 결과 MAT_STOCKS.QTY = 0 (입고 100% 소비)

### 4.4 작업지시 17건 (STATUS='DONE')
- §2.1 트리대로 ORDER_NO 17건. PARENT_ID=상위 작업지시. PLAN_QTY=GOOD_QTY=수량, DEFECT_QTY=0, ROUTING_CODE=품번 라우팅

### 4.5 생산실적 + 반제품(SG) + 반제품재고 (leaf→상위 역순)
각 작업지시당:
- PROD_RESULTS 1건 (GOOD_QTY=수량, STATUS='DONE', PROCESS_CODE=라우팅 라벨/대표 공정)
- **HNS02_FA**: SG_LABELS **20건** 발행 (묶음 **5개 단위**: INIT_QTY=5, REMAIN_QTY=0 전량소비, ISSUE_PROCESS_CODE='TAPPN', STATUS 최종 'CONSUMED', WAREHOUSE_CODE='WIP_MAIN'). 100개 / 5 = 20 라벨
- 반제품 PRODUCT_STOCKS(WIP_MAIN, ITEM_TYPE='SEMI_PRODUCT') 입고(+수량) → 상위 소비(−수량) → 최종 QTY=0
- PRODUCT_TRANSACTIONS: WIP_IN(+), WIP_OUT(−) 쌍
- PRODUCT_GENEALOGY: 상위SG/반제품 ← 하위 반제품/원자재 매핑

### 4.6 완제품 HNS02 (최상위)
- PROD_RESULTS 1건 (ORDER_NO=HNS02 작업지시, GOOD_QTY=100, PROCESS_CODE='SASSY')
- FG_LABELS 100건 (ITEM_CODE='HNS02', ORDER_NO, STATUS 최종 'PACKED', INSPECT_PASS_YN='Y')
- PRODUCT_STOCKS 1행 (FG_MAIN, ITEM_TYPE='FINISHED', QTY=100, AVAILABLE_QTY=100, STATUS='NORMAL')
- PRODUCT_TRANSACTIONS: FG_IN(+100)
- PRODUCT_GENEALOGY: FG ← SG(HNS02_FA) 매핑 100건
- **포장(박스) BOX_MASTERS 10건** (10개/박스): BOX_NO=`BXH260619-NNN`, QTY=10, STATUS='CLOSED', OQC_STATUS='PASS', SERIAL_LIST=FG바코드 10개. FG_LABELS.BOX_NO 스탬프 → 포장실적 화면(`/production/pack-result`, BOX_MASTERS 조회)에 노출

### 4.7 검사이력
- 완제품 100개 × (AINSP 통전 + OINSP 외관) = **200건** INSPECT_RESULTS (PASS_YN='Y', FG_BARCODE 연계, INSPECT_TYPE=AINSP/OINSP, EQUIP_CODE=검사설비)
- 반제품 자주/샘플검사(TINSP 등)는 1차 범위에서 생략(필요 시 확장)

### 4.8 장착이력
- SG_LABELS 상태 전이로 표현: IN_STOCK → MOUNTED(상위 공정 장착) → CONSUMED. MOUNTED_EQUIP_CODE/CURRENT_PROCESS_CODE 세팅
- 원자재 자동장착은 수불 없음(설계 원칙) → STOCK_TRANSACTIONS MAT_OUT(소비)로만 표현

### 4.9 출하지시 (재고 미차감)
- **SHIPMENT_ORDERS 1건**(`SOH-260619-001`, STATUS='CONFIRMED', 고객 CUS-001/현대자동차, SHIP_DATE=오늘) + **SHIPMENT_ORDER_ITEMS**(HNS02 ORDER_QTY=100, SHIPPED_QTY=0)
- 출하지시 화면(`/shipping/order`) + 출하이력 화면(`/shipping/history`, 둘 다 `GET /shipping/orders`=SHIPMENT_ORDERS 조회, 날짜필터 없음)에 노출
- **실제 출하(SHIPMENT_LOGS)는 생성 안 함** → mark-shipped 미실행 → 제품재고 100·박스 10 그대로 유지(재고 차감 없음). 출하확정 화면(`/shipping/confirm`, SHIPMENT_LOGS)은 빈 상태

## 5. 최종 상태 (검증 기준)

| 검증 | 기대값 |
|---|---|
| PRODUCT_STOCKS HNS02 (FG_MAIN) QTY | **100** |
| FG_LABELS HNS02 건수 | 100 (STATUS='PACKED', BOX_NO 스탬프) |
| BOX_MASTERS HNS02 (포장실적) | 10 (10개/박스, CLOSED/OQC PASS) |
| SG_LABELS HNS02_FA 건수 | 20 (5개 묶음, STATUS='CONSUMED') |
| JOB_ORDERS HNS02 계열 | 17건 (모두 DONE) |
| PROD_RESULTS HNS02 계열 | 17건 |
| INSPECT_RESULTS HNS02 | 200건 (전수 PASS) |
| 반제품 PRODUCT_STOCKS(WIP) 잔량 | 0 (전량 소비) |
| MAT_STOCKS 원자재 잔량 | 0 (입고=소비) |
| 수불 차변=대변 정합 | STOCK_TX/PRODUCT_TX 합계 균형 |
| SHIPMENT_ORDERS (출하지시) | 1건 CONFIRMED (HNS02 100, SHIPPED_QTY=0) |
| SHIPMENT_LOGS (실제 출하) | 0 (재고 미차감) |

## 6. 구현 방식

- **Python 빌더 스크립트** 1개: `BOM_MASTERS` 재귀 전개 → 수량 산출(§2 표와 대조 검증) → 채번 → INSERT SQL 생성 → 단일 트랜잭션 실행(oracledb) → §5 검증 쿼리 자동 실행.
- 멱등성: 재실행 시 §4.0 정리가 선행되므로 중복 없이 재구성.
- 안전: 정리 DELETE 범위는 본 시드 채번 + HNS02 ITEM_CODE 직접분으로 한정(원자재 공유분 보호).

## 7. 미확정/구현 시 확정 항목

1. ~~SG 묶음 단위~~ **확정: 5개 단위, INIT_QTY=5, 20건**.
2. 생산실적을 작업지시당 1건으로 단순화(공정별 다건 미생성).
3. 검사 설비/작업자 코드 — 기준정보에서 실존 코드 1개 선택(없으면 NULL 허용 컬럼은 NULL).
4. 정리 DELETE 최종 범위 — 1차 실행 직전 기존 데이터 재조회로 확정.
