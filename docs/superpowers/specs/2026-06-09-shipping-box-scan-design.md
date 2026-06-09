# 출하지시 기반 박스 스캔 출하 + 완제품 입고 창고 단순화 — 설계서

- 작성일: 2026-06-09
- 대상: `/shipping/confirm`(웹), `/pda/shipping`(PDA), `/pda/product/receiving`(제품입고), 백엔드 shipping·inventory 모듈
- 요약:
  1. (입고 정리) 완제품 박스 제품입고를 **FG 기본창고(FG_MAIN)로 직접 입고**하도록 단순화. WH-FG 경유·이동 개념 폐기.
  2. (출하) 출하지시 번호를 스캔/입력해 해당 지시에 대해 박스를 개별 스캔하면 즉시 출하 처리(박스 SHIPPED + FG_MAIN 재고 차감 + 출하지시 진행 갱신).

## 1. 배경 / 문제

기존 출하 확정(`/shipping/confirm`)은 "출하건 생성 → 팔레트 적재 → 출하확정"이라는 무거운 팔레트 기반 흐름만 제공한다. 현장은 입고처럼 "박스 1개 스캔 → 즉시 출하"하는 가벼운 흐름을 원한다.

PDA `/pda/shipping`은 이미 "출하지시 스캔 → 작업자 QR → 박스 스캔" 3단계 구조이지만, 호출하는 백엔드 API(`GET /shipping/orders/by-barcode/:barcode`, `POST /shipping/register`)가 **둘 다 미구현**이라 현재 동작하지 않는다. 이번 요청과 거의 동일하므로 신규 메뉴를 만들지 않고 이 깨진 흐름을 수리해 완성한다.

또한 출고 기준을 FG 기본창고(FG_MAIN)로 정했는데, 현재 박스 제품입고가 임의 선택 창고(WH-FG)로 들어가 입고·출고 창고가 어긋난다. 이를 **입고도 FG_MAIN으로 직접 받도록 단순 정리**한다.

## 2. 확정된 결정사항

| 항목 | 결정 |
|------|------|
| 출하처(고객사) | 출하지시에서 join으로 자동 취득 (별도 선택 없음) |
| 완제품 입고창고 | **박스 제품입고를 FG 기본창고(FG_MAIN)로 직접 입고**. WH-FG 경유/이동 없음 |
| 출고창고 | FG 기본창고(FG_MAIN). 해당 창고 재고 존재/충분 검증 |
| 출하 처리 동작 | 박스 `SHIPPED` + FG_MAIN 재고 차감(FG_OUT) + 출하지시 라인 `shippedQty` 갱신 |
| 출하건(SHIPMENT_LOGS) | 생성하지 않음. 출하이력조회가 `GET /shipping/orders`를 읽으므로 지시 상태/shippedQty 갱신으로 충분 |
| 웹 배치 | 기존 팔레트 흐름 유지 + 상단 "박스 스캔 출하" 버튼/모달 추가 |
| PDA | 기존 깨진 `/pda/shipping` 수리해 완성 (신규 메뉴 X) |
| 작업자 기록 | 웹=로그인 사용자, PDA=작업자 QR 스캔값 → 수불 트랜잭션 workerId |
| 처리 단위 | 박스 1건씩 즉시 출하(입고와 동일). 모아서 일괄 확정 아님 |
| 기존 WH-FG 잔여재고 | 테스트 데이터(`BXPDATEST01`/HNS01 5). 검증용으로 FG_MAIN으로 이행/재생성 후 원복 |

## 3. 도메인 사실 (실측, JSHANES 40/1000)

- 출하지시: `SHIPMENT_ORDERS`(PK `SHIP_ORDER_NO`, `CUSTOMER_ID/NAME`, `STATUS`), 라인 `SHIPMENT_ORDER_ITEMS`(복합PK `SHIP_ORDER_ID`+`SEQ`, `ITEM_CODE`, `ORDER_QTY`, `SHIPPED_QTY` default 0)
- 출하지시 상태: `DRAFT → CONFIRMED → CLOSED` ("CLOSED: 실출하 완료 후 자동 마감"이 기존 주석의 설계 의도)
- 박스: `BOX_MASTERS`(PK `BOX_NO`, `ITEM_CODE`, `QTY`, `STATUS` OPEN|CLOSED|SHIPPED, `OQC_STATUS`). 출하지시 FK 없음 → `itemCode`로 라인 매칭
- 제품재고/수불: `PRODUCT_STOCKS`(warehouseCode, itemCode, prdUid), `PRODUCT_TRANSACTIONS`. 메모리 규칙: `PRD_UID` 센티넬 `'*'` 사용
- FG 창고: `FG_MAIN`(기본 `IS_DEFAULT=Y`), `FG_SHIP`, `WH-FG`. 모두 PROCESS_CODE/LINE_CODE 없는 일반 FG 창고
- 재사용 서비스(`ProductInventoryService`):
  - `receiveStock(dto)` / `receiveStockInTx(qr, dto)` — 입고(증가)
  - `issueStock(dto)` / `issueStockInTx(qr, dto)` — 출고(차감), `dto.warehouseId`에서 차감, 재고부족/HOLD 거부
- 현재 동작: 박스 제품입고 `fg/receive` → `receiveStock`(FG_IN, 화면 선택 창고). 생산실적 완료 → WIP_MAIN 입고(별개, 범위 밖)
- 조회: `GET /shipping/orders/:id` → 지시 + items 반환 (이미 구현)

## 4. 입고 정리 (완제품 박스 제품입고 → FG_MAIN)

### 4.1 변경
- `fg/receive`(제품입고)의 입고 대상 창고를 **FG 기본창고(FG_MAIN)로 고정**.
  - 구현: `productReceivePayload`/`receiveFg`에서 `warehouseId` 미지정 시 FG 기본창고로 결정, 또는 컨트롤러에서 기본창고 주입.
- 프론트 `/pda/product/receiving`: 창고 선택 UI 제거(또는 FG 기본창고 고정 표시). 박스 스캔 → 입고확인 시 FG_MAIN으로 FG_IN.
- WH-FG로 입고하던 경로/선택은 폐기.

### 4.2 데이터 정리
- 기존 WH-FG 잔여 FG 재고(테스트분)는 검증 시 FG_MAIN 기준으로 재구성. 운영 데이터 이행은 범위 밖(없음 확인됨).

## 5. 출하 백엔드 설계 (단일 트랜잭션 1건 처리)

### 5.1 신규 엔드포인트
`POST /shipping/orders/:shipOrderNo/ship-box`
- 입력 DTO: `{ boxNo: string; workerId?: string }` (출고창고는 FG 기본창고 자동)
- 단일 트랜잭션 처리 순서:
  1. 출하지시 조회 → 없으면 404, `status !== 'CONFIRMED'`면 400 (DRAFT/CLOSED 거부)
  2. 박스를 **트랜잭션 안에서 재조회**(스캔 페이로드 신뢰 금지) → `status==='CLOSED' && oqcStatus==='PASS' && status!=='SHIPPED'` 아니면 400
  3. `box.itemCode`에 해당하는 지시 라인 탐색 → 없으면 400(WRONG_ITEM)
  4. `line.shippedQty + box.qty > line.orderQty` 면 400(OVER_QTY)
  5. FG 기본창고 결정(`warehouseType='FG' && isDefault='Y'`) → `issueStockInTx`로 차감
     (transType=`FG_OUT`, refType=`SHIP_ORDER`, refId=`shipOrderNo`, itemType=`FINISHED`, prdUid=`*`, workerId)
  6. 박스 `status='SHIPPED'` 갱신
  7. 라인 `shippedQty += box.qty` 갱신
  8. 전 라인 `shippedQty >= orderQty` 면 지시 `status='CLOSED'`
- 반환: `{ shipOrderNo, boxNo, itemCode, qty, lineShippedQty, lineOrderQty, orderStatus, fullyShipped }`

### 5.2 PDA 호환
- 기존 훅의 `GET /shipping/orders/by-barcode/:barcode` 호출은 신설하지 않고 `GET /shipping/orders/:id`(번호=바코드) 호출로 수정
- 기존 `POST /shipping/register`(items 일괄)는 사용하지 않고, 박스 스캔 즉시 `ship-box` 1건 호출로 교체

### 5.3 검증/게이트
- 지시 CONFIRMED 한정 / 박스 CLOSED+OQC PASS+미출하 / 품목 매칭 / 초과 출하 차단 / 재고 충분
- 멀티테넌시: 모든 조회·갱신에 `COMPANY`, `PLANT_CD` 스코프

## 6. 출하 프론트엔드 설계

### 6.1 웹 `/shipping/confirm`
- 기존 팔레트 기반 출하 흐름·모달은 그대로 유지
- 상단 액션 영역에 "박스 스캔 출하" 버튼 추가 → 신규 모달
- 모달 흐름:
  1. 출하지시 번호 스캔/입력 → `GET /shipping/orders/:no` 조회 → 고객사·납기·라인(품목/주문/기출하) 표시. CONFIRMED 아니면 경고
  2. 박스 바코드 입력(ScanLine, 포커스 유지) → Enter 시 `POST .../ship-box` 1건 호출
  3. 성공 시 출하 목록에 누적, 라인별 진행률(shippedQty/orderQty) 갱신, 입력 포커스 복귀
  4. 오류(WRONG_ITEM/OVER_QTY/재고부족/중복) 인라인 표기
- `alert/confirm` 금지 — 모달 내 인라인 메시지 사용

### 6.2 PDA `/pda/shipping`
- Phase1: 출하지시 스캔 → `GET /shipping/orders/:id`
- Phase2: 작업자 QR 스캔 (기존 유지)
- Phase3: 박스/팔레트 스캔 → 박스 1건마다 `ship-box` 즉시 호출(workerId 포함), 진행률 표시
- 기존 `useShippingScan` 훅의 미구현 API 호출부를 위 계약에 맞게 수정

## 7. 시스템 점검 (동시 확인 항목)

- **이중 차감 가드**: 기존 팔레트 `markAsShipped`/`loadPallets`/`assign-pallet`이 이미 `SHIPPED`된 박스를 다시 처리·차감하지 않도록 상태 가드 여부 확인. 누락 시 가드 추가.
- **fg/receive 호출처 영향**: `fg/receive`를 FG_MAIN 고정으로 바꿀 때 다른 호출처가 창고를 직접 지정하는지 확인 후 회귀 방지.

## 8. 범위 밖 (YAGNI)

- 박스 스캔 출하분의 취소/되돌리기 (요청 없음)
- 팔레트 단위 스캔 즉시 출하(기존 팔레트 흐름과 중복)
- 신규 SHIPMENT_LOGS 적재
- 생산실적→WIP_MAIN 입고 정책 변경(별개 이슈)
- WH-FG 창고 자체 삭제(미사용 처리만, 마스터 삭제는 안 함)

## 9. i18n / 검증

- 신규 UI 문자열은 `ko, en, zh, vi` 4개 로케일 동시 추가, Grep 검증
- 검증: 백엔드 `tsc`, 프론트 `tsc --noEmit`, 실DB 입고→출하 end-to-end(JSHANES), 테스트 데이터 원복
- 빌드는 구현 완료 후 검증 시점에만
