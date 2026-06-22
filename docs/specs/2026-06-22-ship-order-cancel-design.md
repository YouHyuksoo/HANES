# 출하취소 화면(`/shipping/return` 재구성) 설계

- 작성일: 2026-06-22
- 대상 화면: `apps/frontend/src/app/(authenticated)/shipping/return/`
- 범위: 프론트 재구성 + 백엔드 추가(컬럼/시퀀스/엔드포인트/서비스). 데이터 정합성·동시성 중요.

## 1. 배경 / 목적

현재 `/shipping/return`은 `SHIPPING_RETURNS` 수동 CRUD(기록 전용, 재고·상태 무영향) 그리드다. 이를 **출하취소** 화면으로 재구성한다:

- **좌측**: 출하지시(Ship Order) 단위 **통합 출하이력** — 박스출하·팔레트출하 모두 포함.
- **우측**: 선택 출하지시의 **팔레트/박스 상세** — 박스출하분은 팔레트번호를 `*`로 표시.
- **기능**: 선택 출하지시 **전체를 단일 트랜잭션으로 취소** — 상태 전이 + FG재고 복원 + `SHIPPING_RETURNS`에 취소이력 자동 기록.

동시 사용 환경이므로 모든 취소는 단일 DB 트랜잭션으로 원자적으로 처리한다.

## 2. 결정 사항 (사용자 승인)

1. 출하이력은 **박스출하 + 팔레트출하 모두 포함**. 박스출하 행의 팔레트번호는 `*`.
2. 취소 = **실제 되돌림**: 상태 전이 + FG재고 복원(우회 금지, 단순 반품기록 아님).
3. 취소 단위 = **출하지시 전체 한 번에**(단일 트랜잭션).
4. 취소이력 = **기존 `SHIPPING_RETURNS` 재사용**(취소 시 자동 생성, 실제 reverse/재고복원 동반).
5. 정합성을 위해 **백엔드 추가 허용**(컬럼/시퀀스/엔드포인트/서비스 리팩토링).

## 3. 핵심 데이터 모델 사실 (실측)

- **팔레트출하**: `SHIPMENT_LOGS`(shipNo) + `PALLET_MASTERS`(shipmentId) 생성. 박스는 `palletNo` 보유. 재고차감 거래 `PRODUCT_TRANSACTIONS(refType='SHIPMENT', refId=shipNo)`.
- **박스출하(ship-box)**: `SHIPMENT_LOGS`/팔레트 **미생성**. `BOX_MASTERS.status='SHIPPED'`, `palletNo=NULL`, `FG_LABELS.status='SHIPPED'`, 지시 `shippedQty` 갱신. 재고차감 거래 `PRODUCT_TRANSACTIONS(refType='SHIP_ORDER', refId=shipOrderNo)`.
- **공통 anchor**: 두 경로 모두 박스를 `SHIPPED`로 만든다. 팔레트출하는 `palletNo` 有, 박스출하는 `palletNo=NULL`(→`*`).
- **단절**: `BOX_MASTERS`에 출하지시 컬럼이 없어 박스출하 박스↔출하지시 연결이 불가(거래 remark `출하지시 박스출하:{boxNo}`에만 존재). → 통합이력·취소를 위해 컬럼 추가.
- `returnNo`는 현재 수동입력(시퀀스 없음).
- 기존 취소/역분개 메서드(`cancel`, `reverseShipment`, `cancelShipBox`)는 각자 `this.tx.run`으로 **자체 트랜잭션**을 연다 → 주문 단위 단일 트랜잭션 합성을 위해 in-tx 헬퍼 추출 필요.

## 4. 백엔드 변경

### 4.1 DDL (JSHANES, 40/1000)
```sql
ALTER TABLE BOX_MASTERS ADD (
  SHIP_ORDER_NO VARCHAR2(50),     -- 출하 시 stamp (박스/팔레트 공통)
  SHIPPED_AT    TIMESTAMP         -- 출하 확정 시각
);
CREATE INDEX IX_BOX_SHIP_ORDER ON BOX_MASTERS (SHIP_ORDER_NO);

-- 취소이력(SHIPPING_RETURNS) 자동 채번용
CREATE SEQUENCE SEQ_SHIP_RETURN START WITH 1 INCREMENT BY 1 NOCACHE;
```
- 두 컬럼 nullable(기존 행 호환).
- **백필(일회성 마이그레이션)**:
  - 팔레트출하 박스: `BOX_MASTERS.SHIP_ORDER_NO = PALLET_MASTERS.SHIP_ORDER_NO` (box.palletNo 조인). 정확.
  - 박스출하 과거 박스: `PRODUCT_TRANSACTIONS(refType='SHIP_ORDER')`의 remark `출하지시 박스출하:{boxNo}` 역파싱(best-effort, 일회성). 매칭 실패분은 NULL 유지 → 통합이력에서 "출하지시 미상"으로 분류(표시만, 취소 불가). **신규 출하분은 stamp가 정본.**
  - `SHIPPED_AT`: 팔레트출하 박스=pallet.shippedAt, 박스출하 박스=거래 transDate(best-effort), 실패 시 NULL.

### 4.2 엔티티
`BoxMaster`에 추가:
```ts
@Column({ type: 'varchar2', name: 'SHIP_ORDER_NO', length: 50, nullable: true })
shipOrderNo: string | null;

@Column({ name: 'SHIPPED_AT', type: 'timestamp', nullable: true })
shippedAt: Date | null;
```
(nullable union 컬럼은 `type` 명시 — 누락 시 Oracle 크래시.)

### 4.3 출하 시 stamp
- `ShipOrderService.shipBox()`: box `SHIPPED` 전이 시 `shipOrderNo=shipOrderNo, shippedAt=now` 함께 set.
- `ShipOrderService.shipOrderPallets()` 및 `ShipmentService.markAsShipped()`(팔레트→출하): 출하되는 박스들에 `shipOrderNo`(=shipment.shipOrderNo), `shippedAt=now` set.
- 취소 시(아래 4.5): box가 `SHIPPED`에서 풀릴 때 `shippedAt=null`로 초기화(`shipOrderNo`는 추적용 잔존 허용 — 통합이력은 status로 필터하므로 무해).

### 4.4 조회 엔드포인트
- **좌측 출하이력**: 신규 `GET /shipping/orders/shipped` — 출하분이 있는 출하지시 목록.
  - 조건: 해당 지시에 `status='SHIPPED'`인 박스(BOX_MASTERS.shipOrderNo=지시)가 1개 이상, 또는 `SHIPMENT_LOGS`(shipOrderNo=지시, status IN PREPARING/LOADED/SHIPPED)가 존재.
  - 행 필드: `shipOrderNo, customerName, shipDate, shippedQty(합), shipType('BOX'|'PALLET'|'MIXED'), palletCount, boxCount, hasErpSynced(boolean)`.
  - 집계는 단일 쿼리(그룹). N+1 금지.
- **우측 상세**: 신규 `GET /shipping/orders/{id}/shipped-detail`.
  - 응답:
    ```ts
    {
      order: { shipOrderNo, customerName, shipDate },
      pallets: [{ palletNo, status, boxCount, totalQty, shipNo, erpSyncYn, boxes: [{ boxNo, itemCode, qty }] }],
      boxShipped: [{ boxNo, itemCode, qty, palletNo: '*', shippedAt }],  // palletNo NULL → '*'
    }
    ```
  - pallets = `PALLET_MASTERS(shipOrderNo=id, status IN LOADED/SHIPPED)` + 박스. boxShipped = `BOX_MASTERS(shipOrderNo=id, palletNo IS NULL, status='SHIPPED')`.

### 4.5 취소 엔드포인트 (핵심)
`POST /shipping/orders/{id}/cancel-shipment`  body `{ reason: string, workerId?: string }`

**리팩토링 선행**: `ShipmentService`/`ShipOrderService`의 기존 로직을 in-tx 헬퍼로 추출하여 단일 트랜잭션에서 합성:
- `reverseShipmentInTx(qr, shipment, remark)` ← 기존 `reverseShipment` 본문(자체 tx 제거 버전).
- `cancelShipmentInTx(qr, shipment, remark)` ← 기존 `cancel` 본문.
- `cancelShipBoxInTx(qr, shipOrderNo, boxNo, workerId, remark)` ← 기존 `cancelShipBox` 본문.
- 기존 public 메서드는 `this.tx.run(qr => ...InTx(qr, ...))`로 위임(동작 불변).

**처리(단일 `tx.run`)**:
1. 지시 로드. 출하분 없으면 400.
2. 수집: ① 해당 지시의 `SHIPMENT_LOGS`(status PREPARING/LOADED/SHIPPED), ② 박스출하 박스(`shipOrderNo=id, palletNo NULL, status SHIPPED`).
3. **ERP 가드**: 어떤 shipment이라도 `erpSyncYn='Y'`면 전체 중단(throw, 명확 메시지). 부분취소 안 함.
4. 각 shipment: `SHIPPED`→`reverseShipmentInTx`(재고복원·FG_LABEL PACKED·shippedQty 복원) **후** 해당 shipment를 `CANCELED`로 마감 + 팔레트 `shipmentId=null, status=CLOSED`. `PREPARING/LOADED`→`cancelShipmentInTx`.
5. 각 박스출하 박스: `cancelShipBoxInTx`(재고복원·박스 CLOSED·FG_LABEL PACKED·shippedQty 복원). 박스 `shippedAt=null`.
6. 지시 상태: 전부 복원 후 `shippedQty` 합이 0이면 `CONFIRMED`.
7. **취소이력 생성**: `SHIPPING_RETURNS` 1건 — `returnNo=SEQ_SHIP_RETURN`, `shipmentId=shipOrderNo`, `returnDate=오늘`, `returnReason=reason`, `status='COMPLETED'`, `remark='출하취소'`. `SHIPMENT_RETURN_ITEMS` = 취소된 품목별 합계수량, `disposalType='RESTOCK'`(재고 복원됨).
8. 반환: `{ shipOrderNo, canceledShipments:[shipNo], canceledBoxes:[boxNo], restoredQty, returnNo }`.

**정합성 원칙**: 모든 단계 동일 `qr`. 중간 실패 시 전체 롤백. 재고 복원은 기존 `cancelTransactionInTx`/`receiveStockInTx`(FG_OUT_CANCEL) 재사용 — 수량 기준 정합.

## 5. 프론트엔드 (`/shipping/return/page.tsx` 재구성)

3-컬럼 + 취소 흐름. 기존 반품 수동 CRUD(등록/수정/삭제 모달·그리드)는 제거.

- **좌측 — 출하이력**: `GET /shipping/orders/shipped`. 컬럼: 출하지시번호 / 고객 / 출하일 / 출하수량 / 출하유형(박스·팔레트·혼합 배지) / 팔레트수 / 박스수 / ERP. 행 클릭 → 우측 상세. 상태/날짜/검색 필터(날짜 기본 당일은 적용 안 함 — 이력 조회라 전체, 단 필터로 당일 제공).
- **우측 — 상세**: `GET /shipping/orders/{id}/shipped-detail`. 팔레트 섹션(palletNo, 상태, 박스수, 수량, shipNo) + 박스출하 섹션(boxNo, 품목, 수량, **팔레트번호 `*`**). 박스 펼치면 시리얼(선택 — 박스 serials 재사용 가능, YAGNI로 1차 제외 가능).
- **취소**: 상단/우측 "출하취소" 버튼(상세 로드 시 활성). ERP 동기화분 포함 시 버튼 비활성+안내. 클릭 → 확인 모달(취소 사유 필수 입력) → `POST cancel-shipment`. 성공 시 요약(취소 shipment/박스 수, 복원수량, returnNo) 표시 후 좌측 목록·우측 상세 갱신. 서버 에러(ERP 차단 등) 메시지 노출.
- **취소이력 보기**: 좌측 그리드 상단 토글 — "출하이력"(기본) ↔ "취소이력". 취소이력은 기존 `GET /shipping/returns`(SHIPPING_RETURNS, 이미 items/shipOrder 병합 반환) 재사용, 읽기 전용. (수동 등록/수정/삭제 UI는 제거.)
- UI 규칙: `alert/confirm/prompt` 금지(모달). 파스텔 배경 금지(텍스트/테두리·배지). flex 스크롤 `min-h-0`. 코드값은 ComCodeBadge 계열 우선.

## 6. i18n
- 메뉴 라벨 `shipping.return`(평면키): "출하반품등록" → "출하취소"(en "Shipment Cancellation", zh "出货取消", vi "Hủy xuất hàng").
- 페이지 키 `shipping.return.*` 재정의/추가(타이틀·출하이력·상세·팔레트번호·출하유형·출하취소·취소사유·ERP차단안내·취소이력 토글 등). ko/en/zh/vi 4파일 동시, BOM 금지. 검증 `scripts/find_missing_i18n.js`.

## 7. 제거 / 정리
- `page.tsx`에서 반품 수동 CRUD(생성/수정/삭제 모달, ConfirmModal 삭제 흐름, form 상태) 제거.
- 백엔드 `ship-return` 컨트롤러의 `POST/PUT/DELETE`는 잔존(다른 사용처 없으면 비활성 무방). 본 작업에선 삭제하지 않고 미사용화(YAGNI — 제거는 별도). `GET`은 취소이력 보기에서 사용.

## 8. 검증
- 백엔드: `pnpm --filter @harness/backend exec tsc --noEmit`. 핵심 jest(취소 합성 로직) 또는 실DB 트랜잭션 E2E(박스출하 1건+팔레트출하 1건 섞인 지시 → cancel-shipment → 재고/상태/라벨/shippedQty/SHIPPING_RETURNS 정합, ERP=Y 차단). 동시성: 단일 tx 원자성 확인.
- 프론트: `pnpm --filter @harness/frontend exec tsc --noEmit`. i18n 4파일 동기화.
- DDL 적용 후 의존 PL/SQL 있으면 `ALTER ... COMPILE`(ORA-04068 예방).

## 9. 범위 밖 / 주의
- 백필 best-effort: 컬럼 도입 이전 박스출하 과거분은 remark 역파싱 실패 시 출하지시 미연결 → 통합이력에 "미상"으로만 표시, 취소 불가. (신규 출하분은 정상.)
- 팔레트출하로 만들어진 Shipment의 DELIVERED 이후/배송완료건 취소 정책은 reverse 전제(SHIPPED)만 다룸. DELIVERED는 1차 제외(필요 시 별도).
- `/shipping/history` 화면과 좌측 목록이 유사하나, 본 화면은 **취소 액션** 전용으로 구분(중복 재편 금지, 통합은 별도 과제).
