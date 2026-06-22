# 출하취소 화면(`/shipping/return` 재구성) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/shipping/return`을 **출하취소** 화면으로 재구성한다 — 좌측 통합 출하이력(박스+팔레트), 우측 팔레트/박스 상세(박스출하 `*`), 선택 출하지시 전체를 단일 트랜잭션으로 취소(상태전이+FG재고복원+SHIPPING_RETURNS 취소이력).

**Architecture:** 박스/팔레트 출하의 공통 anchor인 `BOX_MASTERS`에 `SHIP_ORDER_NO`/`SHIPPED_AT` 컬럼을 추가하고 출하 시 stamp하여 통합 조회를 가능케 한다. 취소는 기존 `reverse`/`cancel`/`cancelShipBox` 로직을 in-tx 헬퍼로 추출해 출하지시 단위 단일 트랜잭션으로 합성하고, `SHIPPING_RETURNS`에 취소이력을 자동 기록한다.

**Tech Stack:** NestJS + TypeORM + Oracle(JSHANES 40/1000) 백엔드, Next.js(App Router)+React+TS 프론트, react-i18next, `@tanstack/react-table` DataGrid, axios(`@/services/api`).

## Global Constraints

- 패키지 매니저 `pnpm`. dev 서버 가동 중이면 `pnpm build` 금지 → 타입체크는 `pnpm --filter @harness/frontend exec tsc --noEmit` / `pnpm --filter @harness/backend exec tsc --noEmit`.
- 채번은 Oracle SEQUENCE만(`SELECT SEQ_x.NEXTVAL FROM DUAL`). `MAX+1` 금지.
- nullable union 컬럼(`string|null`/`Date|null`)은 `@Column`에 `type` 명시 필수(누락 시 Oracle 크래시, tsc는 통과).
- Oracle CREATED_AT/UPDATED_AT은 DEFAULT SYSTIMESTAMP 전제(엔티티는 @Create/UpdateDateColumn).
- 멀티테넌시: 모든 쿼리에 `company`/`plant`(COMPANY/PLANT_CD) 스코프. 기본 사이트 JSHANES(40/1000).
- DDL은 JSHANES에 적용하고 사이트 명시. DDL 후 의존 PL/SQL 있으면 `ALTER ... COMPILE`.
- 모든 취소는 **단일 `tx.run` 트랜잭션**(원자성, 동시성). 중간 실패 시 전체 롤백.
- i18n는 ko/en/zh/vi 4파일 동시, UTF-8 BOM 금지.
- UI: `alert/confirm/prompt` 금지(모달), 파스텔 배경 금지(텍스트/테두리·배지), flex 스크롤 `min-h-0`, 코드값은 ComCode 계열 우선.
- `catch (error: unknown)` 유지, `as any` 지양, 에러를 기본값 문자열로 숨기지 않기.
- 다른 세션과 main 공유: 편집 전 `LOCKS.md` 클레임, 파일 단위 `git add`, 협업 변경은 기능 커밋과 분리.
- 설계 근거: `docs/specs/2026-06-22-ship-order-cancel-design.md`.

## 파일 구조

**백엔드**
- Create: `apps/backend/src/migrations/2026-06-22_box_ship_order_no_and_return_seq.sql` — DDL(컬럼/인덱스/시퀀스) + 백필.
- Modify: `apps/backend/src/entities/box-master.entity.ts` — `shipOrderNo`/`shippedAt` 컬럼.
- Modify: `apps/backend/src/shared/numbering.service.ts` — `nextReturnNo()`.
- Modify: `apps/backend/src/modules/shipping/services/ship-order.service.ts` — shipBox/shipOrderPallets stamp, cancelShipBox in-tx 추출, 신규 조회/취소 서비스.
- Modify: `apps/backend/src/modules/shipping/services/shipment.service.ts` — markAsShipped stamp, cancel/reverse in-tx 추출.
- Modify: `apps/backend/src/modules/shipping/controllers/ship-order.controller.ts` — `GET /shipped`, `GET /:id/shipped-detail`, `POST /:id/cancel-shipment`.
- Create: `apps/backend/src/modules/shipping/dto/cancel-shipment.dto.ts` — 취소 요청 DTO.
- Modify: `apps/backend/src/modules/shipping/shipping.module.ts` — 필요 시 provider 확인(대부분 기존 주입으로 충분).

**프론트엔드**
- Rewrite: `apps/frontend/src/app/(authenticated)/shipping/return/page.tsx`.
- Create: `apps/frontend/src/app/(authenticated)/shipping/return/ship-cancel-page.structure.test.mjs`.
- Modify: `apps/frontend/src/locales/{ko,en,zh,vi}.json`.

---

### Task 1: DB 스키마 + 엔티티 + 채번 (BOX_MASTERS 컬럼, SEQ_SHIP_RETURN, nextReturnNo)

**Files:**
- Create: `apps/backend/src/migrations/2026-06-22_box_ship_order_no_and_return_seq.sql`
- Modify: `apps/backend/src/entities/box-master.entity.ts`
- Modify: `apps/backend/src/shared/numbering.service.ts`

**Interfaces:**
- Produces: `BOX_MASTERS.SHIP_ORDER_NO`(varchar2 50, null), `BOX_MASTERS.SHIPPED_AT`(timestamp, null). `BoxMaster.shipOrderNo: string|null`, `BoxMaster.shippedAt: Date|null`. `NumberingService.nextReturnNo(qr?): Promise<string>` → `RT{YYMMDD}-{5자리}` (SEQ_SHIP_RETURN).

- [ ] **Step 1: 마이그레이션 SQL 작성**

Create `apps/backend/src/migrations/2026-06-22_box_ship_order_no_and_return_seq.sql`:

```sql
-- 출하취소: 박스↔출하지시 연결 + 출하시각 + 취소이력 채번 시퀀스
-- Site: JSHANES (40/1000)

ALTER TABLE BOX_MASTERS ADD (
  SHIP_ORDER_NO VARCHAR2(50),
  SHIPPED_AT    TIMESTAMP
);

CREATE INDEX IX_BOX_SHIP_ORDER ON BOX_MASTERS (SHIP_ORDER_NO);

-- 취소이력(SHIPPING_RETURNS) 자동 채번 (전역 시퀀스, 일별 리셋 없음)
CREATE SEQUENCE SEQ_SHIP_RETURN START WITH 1 INCREMENT BY 1 NOCACHE;

-- 백필 1: 팔레트출하 박스 — 팔레트의 출하지시/출하시각 상속 (정확)
UPDATE BOX_MASTERS b
SET (b.SHIP_ORDER_NO, b.SHIPPED_AT) = (
  SELECT p.SHIP_ORDER_NO, p.SHIPPED_TIME
  FROM PALLET_MASTERS p
  WHERE p.PALLET_NO = b.PALLET_NO
)
WHERE b.PALLET_NO IS NOT NULL
  AND b.STATUS = 'SHIPPED'
  AND EXISTS (SELECT 1 FROM PALLET_MASTERS p WHERE p.PALLET_NO = b.PALLET_NO AND p.SHIP_ORDER_NO IS NOT NULL);

-- 백필 2: 박스출하 과거분 — 거래 remark '출하지시 박스출하:{boxNo}' 역파싱 (best-effort, 일회성)
UPDATE BOX_MASTERS b
SET b.SHIP_ORDER_NO = (
  SELECT MAX(t.REF_ID)
  FROM PRODUCT_TRANSACTIONS t
  WHERE t.REF_TYPE = 'SHIP_ORDER'
    AND t.TRANS_TYPE = 'FG_OUT'
    AND t.STATUS = 'DONE'
    AND t.REMARK = '출하지시 박스출하:' || b.BOX_NO
)
WHERE b.PALLET_NO IS NULL
  AND b.STATUS = 'SHIPPED'
  AND b.SHIP_ORDER_NO IS NULL;

COMMIT;
```

> 컬럼명은 실측 기준(`PALLET_MASTERS.SHIPPED_TIME`=shippedAt, `PRODUCT_TRANSACTIONS.REF_TYPE/REF_ID/REMARK/TRANS_TYPE/STATUS`). 적용 전 대상 컬럼 존재를 `DESC`로 확인.

- [ ] **Step 2: DDL을 JSHANES에 적용**

검증된 SQL 경로(oracle-db)로 위 SQL을 JSHANES(40/1000)에 실행. 적용 후 확인:
```sql
DESC BOX_MASTERS;   -- SHIP_ORDER_NO, SHIPPED_AT 존재 확인
SELECT SEQ_SHIP_RETURN.NEXTVAL FROM DUAL;  -- 1 반환(이후 사용 시작)
SELECT COUNT(*) FROM BOX_MASTERS WHERE STATUS='SHIPPED' AND SHIP_ORDER_NO IS NOT NULL;  -- 백필 결과
```
Expected: 두 컬럼 존재, 시퀀스 동작. DB 접근 불가 시 **BLOCKED로 보고**(컨트롤러가 사용자에게 적용 요청). DDL 후 `ALTER PACKAGE` 필요한 의존 객체 있으면 컴파일.

- [ ] **Step 3: BoxMaster 엔티티에 컬럼 추가**

`apps/backend/src/entities/box-master.entity.ts`의 `oqcStatus`(라인 43-44) 아래에 추가:

```ts
  @Column({ type: 'varchar2', name: 'SHIP_ORDER_NO', length: 50, nullable: true })
  shipOrderNo: string | null;

  @Column({ name: 'SHIPPED_AT', type: 'timestamp', nullable: true })
  shippedAt: Date | null;
```

또한 클래스 상단 `@Index(['status'])` 아래에 `@Index(['shipOrderNo'])` 추가.

- [ ] **Step 4: nextReturnNo 채번 메서드 추가**

`apps/backend/src/shared/numbering.service.ts`의 `nextSgLabel` 아래(라인 175 이후)에 추가:

```ts
  /** 출하반품/취소이력 채번: RT + YYMMDD + '-' + 5자리(전역 시퀀스 SEQ_SHIP_RETURN). 날짜는 가독성용, 유일성은 시퀀스 보장. */
  async nextReturnNo(qr?: QueryRunner, txDate: Date = new Date()): Promise<string> {
    const manager = qr?.manager ?? this.dataSource.manager;
    const rows = await manager.query(
      'SELECT SEQ_SHIP_RETURN.NEXTVAL AS "NEXT_SEQ" FROM DUAL',
    );
    const seq = Number(rows[0]?.NEXT_SEQ ?? rows[0]?.next_seq ?? 0);
    return `RT${this.yyMMdd(txDate)}-${this.pad5(seq)}`;
  }
```

- [ ] **Step 5: 백엔드 타입체크**

Run: `cd /c/Project/HANES && pnpm --filter @harness/backend exec tsc --noEmit`
Expected: 에러 0건.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/migrations/2026-06-22_box_ship_order_no_and_return_seq.sql apps/backend/src/entities/box-master.entity.ts apps/backend/src/shared/numbering.service.ts
git commit -F - <<'EOF'
feat(shipping): BOX_MASTERS 출하지시/출하시각 컬럼 + 취소이력 채번 시퀀스

BOX_MASTERS.SHIP_ORDER_NO/SHIPPED_AT 추가(통합 출하이력·취소 연결용),
SEQ_SHIP_RETURN + NumberingService.nextReturnNo 추가. 백필 마이그레이션 포함.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: 출하 시 SHIP_ORDER_NO/SHIPPED_AT stamp (3개 출하 경로 + 취소 경로 초기화)

**Files:**
- Modify: `apps/backend/src/modules/shipping/services/ship-order.service.ts` (shipBox, shipOrderPallets, cancelShipBox)
- Modify: `apps/backend/src/modules/shipping/services/shipment.service.ts` (markAsShipped, cancel, reverseShipment)

**Interfaces:**
- Consumes: `BoxMaster.shipOrderNo`/`shippedAt` (Task 1).
- Produces: 출하 확정 시 박스에 `shipOrderNo`+`shippedAt`가 채워지고, 취소 시 `shippedAt`가 null로 초기화되는 불변식.

- [ ] **Step 1: shipBox() stamp (박스출하)**

`ship-order.service.ts` `shipBox()` 내 박스 SHIPPED 전이(현재 `await qr.manager.update(BoxMaster, { boxNo: box.boxNo, ...where }, { status: 'SHIPPED' });`)를 다음으로 변경:

```ts
      await qr.manager.update(
        BoxMaster,
        { boxNo: box.boxNo, ...where },
        { status: 'SHIPPED', shipOrderNo, shippedAt: new Date() },
      );
```

- [ ] **Step 2: shipOrderPallets() stamp (출하지시 팔레트출하)**

`ship-order.service.ts` `shipOrderPallets()`의 박스 SHIPPED 일괄 업데이트(현재 `update(BoxMaster, { palletNo: In(dto.palletNos), ...tenant }, { status: 'SHIPPED' })`)를 다음으로 변경:

```ts
      await qr.manager.update(
        BoxMaster,
        { palletNo: In(dto.palletNos), ...this.tenantWhere(company, plant) },
        { status: 'SHIPPED', shipOrderNo, shippedAt: new Date() },
      );
```
(`shipOrderNo`는 이 메서드의 파라미터로 이미 존재.)

- [ ] **Step 3: markAsShipped() stamp (Shipment 경로 팔레트출하)**

`shipment.service.ts` `markAsShipped()` 내 박스 SHIPPED 전이 업데이트(팔레트 박스를 `status:'SHIPPED'`로 바꾸는 `update(BoxMaster, { palletNo: In(palletIds), ... }, { status:'SHIPPED' })` 호출)에 `shipment.shipOrderNo`가 있을 때 stamp를 추가:

```ts
        await queryRunner.manager.update(
          BoxMaster,
          { palletNo: In(palletIds), ...this.tenantWhere(company, plant) },
          { status: 'SHIPPED', shipOrderNo: shipment.shipOrderNo ?? null, shippedAt: new Date() },
        );
```
(해당 메서드에서 박스를 SHIPPED로 바꾸는 지점을 찾아 위 객체로 교체. `palletIds`/변수명은 현 코드 기준 사용.)

- [ ] **Step 4: 취소 경로에서 shippedAt 초기화**

세 곳의 박스 복원(`{ status: 'CLOSED' }` 또는 `cancelShipBox`의 `{ status:'CLOSED' }`)에 `shippedAt: null` 추가:
- `ship-order.service.ts` `cancelShipBox()`: `update(BoxMaster, { boxNo: box.boxNo, ...where }, { status: 'CLOSED', shippedAt: null })`.
- `shipment.service.ts` `cancel()`: 박스 CLOSED 복원에 `shippedAt: null` 추가.
- `shipment.service.ts` `reverseShipment()`: 박스 CLOSED 복원에 `shippedAt: null` 추가.
(`shipOrderNo`는 추적용으로 잔존시킴 — 통합이력은 `status='SHIPPED'`로 필터하므로 무해.)

- [ ] **Step 5: 백엔드 타입체크 + 기존 jest**

Run:
```bash
cd /c/Project/HANES && pnpm --filter @harness/backend exec tsc --noEmit && pnpm --filter @harness/backend exec jest ship-order.service shipment.service 2>&1 | tail -20
```
Expected: tsc 0건. 기존 spec이 `update` 인자 형태를 strict 비교하면 일부 깨질 수 있음 → 깨지면 mock 기대값을 새 객체로 업데이트(테스트 의도 유지). 통과 확인.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/shipping/services/ship-order.service.ts apps/backend/src/modules/shipping/services/shipment.service.ts
git commit -F - <<'EOF'
feat(shipping): 출하 확정 시 박스에 SHIP_ORDER_NO/SHIPPED_AT stamp

shipBox/shipOrderPallets/markAsShipped에서 박스 SHIPPED 전이 시 출하지시번호와
출하시각을 기록하고, 취소 경로에서 shippedAt를 초기화한다(통합 출하이력 기반).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: 취소 로직 in-tx 헬퍼 추출 (동작 보존 리팩토링)

**Files:**
- Modify: `apps/backend/src/modules/shipping/services/shipment.service.ts` (cancel, reverseShipment)
- Modify: `apps/backend/src/modules/shipping/services/ship-order.service.ts` (cancelShipBox)

**Interfaces:**
- Produces:
  - `ShipmentService.cancelInTx(qr, shipment, remark?, company?, plant?): Promise<void>` — 기존 `cancel` 본문(자체 tx 제외).
  - `ShipmentService.reverseShipmentInTx(qr, shipment, remark?, company?, plant?): Promise<void>` — 기존 `reverseShipment` 본문(자체 tx 제외, 사전 조회 포함).
  - `ShipOrderService.cancelShipBoxInTx(qr, shipOrderNo, boxNo, workerId?, company?, plant?): Promise<{itemCode; qty}>` — 기존 `cancelShipBox` 본문(자체 tx 제외).
- 공개 메서드 `cancel`/`reverseShipment`/`cancelShipBox`는 `this.tx.run(qr => ...InTx(...))`로 위임하여 외부 동작 불변.

- [ ] **Step 1: reverseShipmentInTx 추출**

`shipment.service.ts`에서 `reverseShipment(id, remark, company, plant)`의 본문 중 `this.tx.run(async (queryRunner) => { ... })` 내부 전체를 `reverseShipmentInTx(qr, shipment, remark?, company?, plant?)` 메서드로 옮긴다. 사전 조회(palletIds, allBoxes, allFgBarcodes, shipmentTransactions)도 헬퍼 내부로 이동(qr.manager 사용). 공개 메서드는:

```ts
  async reverseShipment(id: string, remark?: string, company?: string, plant?: string) {
    const shipment = await this.findById(id, company, plant);
    if (shipment.status !== 'SHIPPED') {
      throw new BadRequestException(`현재 상태(${shipment.status})에서는 출하 역분개할 수 없습니다. SHIPPED 상태여야 합니다.`);
    }
    if (shipment.erpSyncYn === 'Y') {
      throw new BadRequestException(`출하 ${shipment.shipNo} 는 ERP 연동이 완료되어 역분개할 수 없습니다. ERP 연동분부터 먼저 정리한 뒤 출하 역분개를 진행해 주세요.`);
    }
    await this.tx.run((qr) => this.reverseShipmentInTx(qr, shipment, remark, company, plant));
    return this.findById(id, company, plant);
  }
```
`reverseShipmentInTx`는 상태/ERP 검증을 제외(호출자가 검증)하고, 기존 트랜잭션 본문(팔레트 LOADED, 박스 CLOSED+shippedAt null, shipment LOADED, FG_LABEL PACKED, 재고 cancelTransactionInTx, shippedQty 복원, 지시 CONFIRMED)을 그대로 수행. `qr.manager` 사용으로 통일.

- [ ] **Step 2: cancelInTx 추출**

동일 방식으로 `cancel(id, remark, company, plant)`의 tx 본문을 `cancelInTx(qr, shipment, remark?, company?, plant?)`로 추출. 공개 메서드는 상태검증(PREPARING/LOADED) 후 `this.tx.run(qr => this.cancelInTx(qr, shipment, remark, company, plant))` 위임 + `findById` 반환.

- [ ] **Step 3: cancelShipBoxInTx 추출**

`ship-order.service.ts` `cancelShipBox(shipOrderNo, dto, company, plant)`의 `this.tx.run(async (qr) => { ... })` 본문을 `cancelShipBoxInTx(qr, shipOrderNo, boxNo, workerId?, company?, plant?)`로 추출하고 `{ itemCode, qty }`를 반환. 공개 메서드는:

```ts
  async cancelShipBox(shipOrderNo: string, dto: ShipBoxDto, company?: string, plant?: string) {
    return this.tx.run((qr) => this.cancelShipBoxInTx(qr, shipOrderNo, dto.boxNo, dto.workerId, company, plant));
  }
```
(기존 반환 형태를 유지하려면 `cancelShipBoxInTx`가 기존 반환객체를 그대로 반환하도록 옮긴다.) 박스 CLOSED 복원 시 `shippedAt: null` 유지(Task 2).

- [ ] **Step 4: 타입체크 + 기존 jest 회귀**

Run:
```bash
cd /c/Project/HANES && pnpm --filter @harness/backend exec tsc --noEmit && pnpm --filter @harness/backend exec jest shipment.service ship-order.service 2>&1 | tail -25
```
Expected: tsc 0건, 기존 cancel/reverse/cancelShipBox 관련 테스트 통과(동작 보존). 깨지면 위임 형태 점검.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/shipping/services/shipment.service.ts apps/backend/src/modules/shipping/services/ship-order.service.ts
git commit -F - <<'EOF'
refactor(shipping): 취소/역분개 로직을 in-tx 헬퍼로 추출(동작 보존)

cancel/reverseShipment/cancelShipBox의 트랜잭션 본문을 *InTx 헬퍼로 분리해
출하지시 단위 단일 트랜잭션 취소에서 합성 가능하게 함. 공개 메서드는 위임.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: 조회 엔드포인트 (좌측 출하이력 + 우측 팔레트/박스 상세)

**Files:**
- Modify: `apps/backend/src/modules/shipping/services/ship-order.service.ts` (findShippedOrders, getShippedDetail)
- Modify: `apps/backend/src/modules/shipping/controllers/ship-order.controller.ts`

**Interfaces:**
- Consumes: `BoxMaster.shipOrderNo`/`shippedAt`, `PALLET_MASTERS`, `SHIPMENT_LOGS`.
- Produces:
  - `GET /shipping/orders/shipped` → `{ data: Array<{ shipOrderNo; customerName; shipDate; shippedQty; shipType: 'BOX'|'PALLET'|'MIXED'; palletCount; boxCount; hasErpSynced: boolean }> }`.
  - `GET /shipping/orders/:id/shipped-detail` → `{ order:{shipOrderNo;customerName;shipDate}; pallets: Array<{palletNo;status;boxCount;totalQty;shipNo;erpSyncYn;boxes:Array<{boxNo;itemCode;qty}>}>; boxShipped: Array<{boxNo;itemCode;qty;palletNo:'*';shippedAt}> }`.

- [ ] **Step 1: findShippedOrders 서비스 (단일 집계 쿼리, N+1 금지)**

`ship-order.service.ts`에 추가. SHIPPED 박스를 출하지시 단위로 집계 + 품목/팔레트/ERP 정보 결합:

```ts
  /** 좌측 출하이력: 출하분(SHIPPED 박스)이 있는 출하지시 단위 통합 목록 */
  async findShippedOrders(company?: string, plant?: string) {
    const rows: Array<{
      SHIP_ORDER_NO: string; CUSTOMER_NAME: string | null; SHIP_DATE: Date | null;
      SHIPPED_QTY: number; PALLET_BOXES: number; LOOSE_BOXES: number;
      PALLET_COUNT: number; ERP_SYNCED: number;
    }> = await this.boxRepository.manager.query(
      `SELECT b.SHIP_ORDER_NO,
              o.CUSTOMER_NAME,
              o.SHIP_DATE,
              SUM(b.QTY)                                              AS SHIPPED_QTY,
              SUM(CASE WHEN b.PALLET_NO IS NOT NULL THEN 1 ELSE 0 END) AS PALLET_BOXES,
              SUM(CASE WHEN b.PALLET_NO IS NULL THEN 1 ELSE 0 END)     AS LOOSE_BOXES,
              COUNT(DISTINCT b.PALLET_NO)                             AS PALLET_COUNT,
              NVL((SELECT MAX(CASE WHEN s.ERP_SYNC_YN = 'Y' THEN 1 ELSE 0 END)
                     FROM SHIPMENT_LOGS s
                    WHERE s.SHIP_ORDER_NO = b.SHIP_ORDER_NO
                      AND s.COMPANY = b.COMPANY AND s.PLANT_CD = b.PLANT_CD), 0) AS ERP_SYNCED
         FROM BOX_MASTERS b
         JOIN SHIPMENT_ORDERS o
           ON o.SHIP_ORDER_NO = b.SHIP_ORDER_NO
          AND o.COMPANY = b.COMPANY AND o.PLANT_CD = b.PLANT_CD
        WHERE b.STATUS = 'SHIPPED'
          AND b.SHIP_ORDER_NO IS NOT NULL
          AND b.COMPANY = :1 AND b.PLANT_CD = :2
        GROUP BY b.SHIP_ORDER_NO, o.CUSTOMER_NAME, o.SHIP_DATE
        ORDER BY o.SHIP_DATE DESC NULLS LAST, b.SHIP_ORDER_NO DESC`,
      [company, plant],
    );

    const data = rows.map((r) => ({
      shipOrderNo: r.SHIP_ORDER_NO,
      customerName: r.CUSTOMER_NAME,
      shipDate: r.SHIP_DATE,
      shippedQty: Number(r.SHIPPED_QTY) || 0,
      palletCount: Number(r.PALLET_COUNT) || 0,
      boxCount: (Number(r.PALLET_BOXES) || 0) + (Number(r.LOOSE_BOXES) || 0),
      shipType: Number(r.PALLET_BOXES) > 0 && Number(r.LOOSE_BOXES) > 0
        ? 'MIXED'
        : Number(r.PALLET_BOXES) > 0 ? 'PALLET' : 'BOX',
      hasErpSynced: Number(r.ERP_SYNCED) === 1,
    }));
    return { data };
  }
```
> 바인드 변수는 이 repo의 Oracle 드라이버 관례에 맞춰 사용(다른 raw 쿼리 예시가 `:1`/`?`/named 중 무엇을 쓰는지 확인 후 일치). N+1 없이 단일 쿼리 + ERP는 상관 서브쿼리.

- [ ] **Step 2: getShippedDetail 서비스**

```ts
  /** 우측 상세: 선택 출하지시의 팔레트(+박스) 및 박스출하(palletNo '*') */
  async getShippedDetail(shipOrderNo: string, company?: string, plant?: string) {
    const order = await this.shipOrderRepository.findOne({
      where: { shipOrderNo, ...this.tenantWhere(company, plant) },
      select: ['shipOrderNo', 'customerName', 'shipDate'],
    });
    if (!order) throw new NotFoundException(`출하지시를 찾을 수 없습니다: ${shipOrderNo}`);

    const pallets = await this.palletRepository.find({
      where: { shipOrderNo, ...this.tenantWhere(company, plant) },
      order: { createdAt: 'ASC' },
    });
    const palletNos = pallets.map((p) => p.palletNo);
    const palletBoxes = palletNos.length
      ? await this.boxRepository.find({ where: { palletNo: In(palletNos), ...this.tenantWhere(company, plant) }, order: { createdAt: 'ASC' } })
      : [];
    const boxesByPallet = new Map<string, typeof palletBoxes>();
    for (const b of palletBoxes) {
      if (!b.palletNo) continue;
      boxesByPallet.set(b.palletNo, [...(boxesByPallet.get(b.palletNo) ?? []), b]);
    }

    const looseBoxes = await this.boxRepository.find({
      where: { shipOrderNo, palletNo: IsNull(), status: 'SHIPPED', ...this.tenantWhere(company, plant) },
      order: { shippedAt: 'ASC' },
    });

    return {
      order,
      pallets: pallets.map((p) => ({
        palletNo: p.palletNo, status: p.status, boxCount: p.boxCount, totalQty: p.totalQty,
        shipNo: p.shipmentId ?? null, erpSyncYn: null,
        boxes: (boxesByPallet.get(p.palletNo) ?? []).map((b) => ({ boxNo: b.boxNo, itemCode: b.itemCode, qty: b.qty })),
      })),
      boxShipped: looseBoxes.map((b) => ({ boxNo: b.boxNo, itemCode: b.itemCode, qty: b.qty, palletNo: '*', shippedAt: b.shippedAt })),
    };
  }
```
> `IsNull`을 typeorm import에 포함. `erpSyncYn`은 필요 시 SHIPMENT_LOGS 조인으로 채우되, 1차는 null 허용(좌측 목록의 hasErpSynced가 ERP 차단 판단을 담당).

- [ ] **Step 3: 컨트롤러 라우트 추가**

`ship-order.controller.ts`에 추가(주의: `@Get('shipped')`는 `@Get(':id')`보다 **위에** 선언해 라우트 충돌 방지):

```ts
  @Get('shipped')
  @ApiOperation({ summary: '출하분이 있는 출하지시 통합 이력(박스+팔레트)' })
  async findShipped(@Company() company: string, @Plant() plant: string) {
    const result = await this.shipOrderService.findShippedOrders(company, plant);
    return ResponseUtil.success(result.data);
  }

  @Get(':id/shipped-detail')
  @ApiOperation({ summary: '출하지시 출하 상세(팔레트/박스, 박스출하는 *)' })
  @ApiParam({ name: 'id', description: '출하지시 번호' })
  async getShippedDetail(@Param('id') id: string, @Company() company: string, @Plant() plant: string) {
    const data = await this.shipOrderService.getShippedDetail(id, company, plant);
    return ResponseUtil.success(data);
  }
```
> `@Get('shipped')`를 기존 `@Get(':id')`(라인 59) 위로 배치(또는 NestJS 라우트 등록 순서상 정적 경로가 먼저 매칭되도록). 확인: `findById`의 `:id`가 'shipped'를 가로채지 않게 한다.

- [ ] **Step 4: 타입체크**

Run: `cd /c/Project/HANES && pnpm --filter @harness/backend exec tsc --noEmit`
Expected: 0건. (`IsNull` import 누락 시 에러 → 추가.)

- [ ] **Step 5: 라우트 동작 확인(서버 가동 시)**

서버가 떠 있으면(포트 확인) 인증 토큰으로 `GET /api/v1/shipping/orders/shipped` 200 + 배열, 임의 지시 `GET /api/v1/shipping/orders/{id}/shipped-detail` 200 확인. 서버 미가동이면 tsc로 갈음하고 수동검증 단계로 이월(보고).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/shipping/services/ship-order.service.ts apps/backend/src/modules/shipping/controllers/ship-order.controller.ts
git commit -F - <<'EOF'
feat(shipping): 통합 출하이력/출하상세 조회 API

GET /shipping/orders/shipped(출하분 있는 지시 통합 목록, 박스+팔레트 유형),
GET /shipping/orders/:id/shipped-detail(팔레트+박스출하 상세, 박스출하 팔레트 *).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: 출하지시 단위 취소 + 취소이력(SHIPPING_RETURNS) 자동기록

**Files:**
- Create: `apps/backend/src/modules/shipping/dto/cancel-shipment.dto.ts`
- Modify: `apps/backend/src/modules/shipping/services/ship-order.service.ts` (cancelOrderShipment)
- Modify: `apps/backend/src/modules/shipping/controllers/ship-order.controller.ts`

**Interfaces:**
- Consumes: `ShipmentService.reverseShipmentInTx`/`cancelInTx`, `ShipOrderService.cancelShipBoxInTx` (Task 3), `NumberingService.nextReturnNo` (Task 1).
- Produces: `POST /shipping/orders/:id/cancel-shipment` body `{ reason: string; workerId?: string }` → `{ shipOrderNo; canceledShipments: string[]; canceledBoxes: string[]; restoredQty: number; returnNo: string }`.

- [ ] **Step 1: DTO 작성**

Create `apps/backend/src/modules/shipping/dto/cancel-shipment.dto.ts`:

```ts
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

/** 출하지시 단위 출하취소 요청 */
export class CancelOrderShipmentDto {
  /** 취소 사유 (취소이력에 기록) */
  @IsString()
  @IsNotEmpty()
  reason: string;

  /** 작업자 ID (재고 거래/취소이력 기록용) */
  @IsOptional()
  @IsString()
  workerId?: string;
}
```

- [ ] **Step 2: cancelOrderShipment 서비스 (단일 트랜잭션 합성)**

`ship-order.service.ts`에 추가. `ShipmentService`를 생성자 주입(순환참조 주의 — 같은 모듈이며 이미 ShipOrderService가 다른 서비스 주입 패턴 있음. 순환 시 `forwardRef` 사용):

```ts
  /**
   * 출하지시 단위 출하취소: 팔레트출하분 reverse/cancel + 박스출하분 cancel-ship-box를
   * 단일 트랜잭션으로 합성하고 SHIPPING_RETURNS에 취소이력을 기록한다.
   */
  async cancelOrderShipment(shipOrderNo: string, dto: CancelOrderShipmentDto, company?: string, plant?: string) {
    const where = this.tenantWhere(company, plant);

    // 사전 조회(검증용)
    const shipments = await this.shipmentRepository.find({
      where: { shipOrderNo, ...where },
    });
    const activeShipments = shipments.filter((s) => ['PREPARING', 'LOADED', 'SHIPPED'].includes(s.status));
    const looseBoxes = await this.boxRepository.find({
      where: { shipOrderNo, palletNo: IsNull(), status: 'SHIPPED', ...where },
    });

    if (activeShipments.length === 0 && looseBoxes.length === 0) {
      throw new BadRequestException('취소할 출하분이 없습니다.');
    }
    // ERP 가드: 하나라도 연동완료면 전체 중단
    const erpBlocked = activeShipments.find((s) => s.erpSyncYn === 'Y');
    if (erpBlocked) {
      throw new BadRequestException(`ERP 연동이 완료된 출하(${erpBlocked.shipNo})가 포함되어 취소할 수 없습니다. ERP 연동분부터 정리해 주세요.`);
    }

    const canceledShipments: string[] = [];
    const canceledBoxes: string[] = [];
    const itemQty = new Map<string, number>();

    let returnNo!: string;
    await this.tx.run(async (qr) => {
      // 1) 팔레트출하분: SHIPPED→reverse, PREPARING/LOADED→cancel, 이후 SHIPPED는 CANCELED 마감
      for (const s of activeShipments) {
        if (s.status === 'SHIPPED') {
          // 재고복원/라벨/팔레트 LOADED/박스 CLOSED/shippedQty 복원
          await this.shipmentService.reverseShipmentInTx(qr, s, dto.reason, company, plant);
          // 되돌린 후 출하 자체를 취소 마감 + 팔레트 분리(CLOSED)
          await qr.manager.update(PalletMaster, { shipmentId: s.shipNo, ...where }, { shipmentId: null, status: 'CLOSED' });
          await qr.manager.update(ShipmentLog, { shipNo: s.shipNo, ...where }, { status: 'CANCELED', palletCount: 0, boxCount: 0, totalQty: 0, remark: `출하취소:${dto.reason}` });
        } else {
          await this.shipmentService.cancelInTx(qr, s, dto.reason, company, plant);
        }
        canceledShipments.push(s.shipNo);
      }

      // 2) 박스출하분: cancel-ship-box(재고복원/박스 CLOSED/라벨/shippedQty 복원)
      for (const b of looseBoxes) {
        const res = await this.cancelShipBoxInTx(qr, shipOrderNo, b.boxNo, dto.workerId, company, plant);
        canceledBoxes.push(b.boxNo);
        itemQty.set(res.itemCode, (itemQty.get(res.itemCode) ?? 0) + res.qty);
      }

      // 3) 취소이력(SHIPPING_RETURNS) 자동 생성 — 품목별 합계는 reverse/cancelShipBox 복원 후 재계산
      //    (팔레트출하분 품목수량은 위 reverse가 박스 기준으로 처리하므로 여기선 박스출하분 + 팔레트 박스 합산)
      const palletBoxItems = await qr.manager.find(BoxMaster, {
        // 방금 CLOSED로 복원된, 이 지시의 (구)출하 박스 중 팔레트 보유분 — shipOrderNo로 합산
        where: { shipOrderNo, ...where },
      });
      // 합계: 박스출하분(itemQty) + 이번 취소로 풀린 팔레트 박스 수량
      const totalByItem = new Map<string, number>(itemQty);
      // 주: 단순화를 위해 취소이력 수량은 박스출하분(itemQty)만 기록해도 무방하나,
      // 전체 복원 수량을 남기려면 reverse가 반환하도록 확장 가능(YAGNI: 1차는 itemQty + canceledShipments 메모).

      returnNo = await this.numbering.nextReturnNo(qr);
      const ret = qr.manager.create(ShipmentReturn, {
        returnNo,
        shipmentId: shipOrderNo,
        returnDate: new Date(),
        returnReason: dto.reason,
        status: 'COMPLETED',
        remark: `출하취소(shipments:${canceledShipments.join(',') || '-'} / boxes:${canceledBoxes.length})`,
        company: company || null,
        plant: plant || null,
      });
      await qr.manager.save(ret);

      let seq = 1;
      for (const [itemCode, qty] of totalByItem) {
        await qr.manager.save(qr.manager.create(ShipmentReturnItem, {
          returnNo, seq: seq++, itemCode, returnQty: qty, disposalType: 'RESTOCK',
          company: company || null, plant: plant || null,
        }));
      }
      void palletBoxItems; // (확장 지점)
    });

    const restoredQty = [...itemQty.values()].reduce((a, b) => a + b, 0);
    return { shipOrderNo, canceledShipments, canceledBoxes, restoredQty, returnNo };
  }
```
> Import 추가: `IsNull`(typeorm), `ShipmentLog`, `PalletMaster`, `ShipmentReturn`, `ShipmentReturnItem`, `CancelOrderShipmentDto`. 생성자에 `private readonly shipmentService: ShipmentService` 주입(같은 모듈; 순환 시 `@Inject(forwardRef(() => ShipmentService))`).
> **취소이력 수량 단순화(YAGNI)**: 1차 구현은 박스출하분(itemQty) 품목수량만 `SHIPMENT_RETURN_ITEMS`에 기록하고, 팔레트출하분은 `remark`에 shipNo 목록으로 남긴다. 팔레트 박스별 품목수량까지 항목화하려면 `reverseShipmentInTx`가 itemQtyMap을 반환하도록 확장(별도, 본 작업 범위 밖 — 주석으로 표시).

- [ ] **Step 3: 컨트롤러 라우트 추가**

`ship-order.controller.ts`에 추가:

```ts
  @Post(':id/cancel-shipment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '출하지시 단위 출하취소(상태전이+재고복원+취소이력)' })
  @ApiParam({ name: 'id', description: '출하지시 번호' })
  async cancelOrderShipment(@Param('id') id: string, @Body() dto: CancelOrderShipmentDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.shipOrderService.cancelOrderShipment(id, dto, company, plant);
    return ResponseUtil.success(data, '출하가 취소되었습니다.');
  }
```
Import `CancelOrderShipmentDto`.

- [ ] **Step 4: 타입체크 + jest 회귀**

Run:
```bash
cd /c/Project/HANES && pnpm --filter @harness/backend exec tsc --noEmit && pnpm --filter @harness/backend exec jest ship-order.service shipment.service 2>&1 | tail -25
```
Expected: tsc 0건, 기존 spec 통과(순환참조 시 모듈 부팅 에러는 jest module-init에서 드러남 → forwardRef로 해결). 순환참조 확인: `pnpm --filter @harness/backend exec jest shipping 2>&1 | tail` 또는 앱 부팅 테스트가 있으면 실행.

- [ ] **Step 5: 실DB 트랜잭션 E2E(서버/DB 가용 시) 또는 보고**

JSHANES에 박스출하 1건 + 팔레트출하 1건이 섞인 출하지시를 대상으로:
1. `POST /shipping/orders/{id}/cancel-shipment {reason}` 호출 → 200.
2. 검증(SQL): 해당 지시 박스 `status='CLOSED'`·`shippedAt IS NULL`, 팔레트 `status='CLOSED'`·`shipmentId IS NULL`, SHIPMENT_LOGS `status='CANCELED'`, FG_LABELS 복원(`PACKED`), PRODUCT_STOCKS FG_MAIN 수량 복원(FG_OUT_CANCEL 거래 생성), SHIPMENT_ORDER_ITEMS `shippedQty` 차감, 지시 `status='CONFIRMED'`, SHIPPING_RETURNS 1건(status COMPLETED)+items.
3. ERP=Y 케이스: erpSyncYn='Y'인 출하 포함 지시 취소 시 400 + 전체 미변경(롤백) 확인.

DB 접근 불가 시 이 단계를 수동검증으로 이월하고 tsc/jest로 1차 완료 보고.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/shipping/dto/cancel-shipment.dto.ts apps/backend/src/modules/shipping/services/ship-order.service.ts apps/backend/src/modules/shipping/controllers/ship-order.controller.ts
git commit -F - <<'EOF'
feat(shipping): 출하지시 단위 출하취소 + 취소이력 자동기록

POST /shipping/orders/:id/cancel-shipment — 팔레트출하분 reverse+CANCELED,
박스출하분 cancel-ship-box를 단일 트랜잭션 합성(재고복원·상태전이),
SHIPPING_RETURNS에 취소이력(RESTOCK) 자동 생성. ERP 연동분 포함 시 전체 차단.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 6: i18n (메뉴 라벨 + 출하취소 페이지 키, 4파일)

**Files:**
- Modify: `apps/frontend/src/locales/{ko,en,zh,vi}.json`

**Interfaces:**
- Produces: 메뉴 평면키 `"shipping.return"` 라벨 변경, 중첩 `shipping.return.*` 페이지 키. Task 7의 `t(...)`가 소비.

- [ ] **Step 1: ko.json 메뉴 라벨 변경**

ko.json 메뉴 평면키(라인 388 인근) `"shipping.return": "출하반품등록"` → `"shipping.return": "출하취소"`.

- [ ] **Step 2: ko.json 페이지 키(`shipping.return` 중첩 블록, 라인 5108 인근) 갱신/추가**

기존 반품 CRUD 키는 남겨도 무방하나 아래 키를 추가/수정:
```json
      "title": "출하취소",
      "subtitle": "출하지시 단위로 출하분(박스·팔레트)을 조회하고 출하를 취소합니다.",
      "shipHistory": "출하이력",
      "cancelHistory": "취소이력",
      "shipType": "출하유형",
      "typeBox": "박스",
      "typePallet": "팔레트",
      "typeMixed": "혼합",
      "shippedQty": "출하수량",
      "palletCount": "팔레트수",
      "boxCount": "박스수",
      "shipDetail": "출하 상세",
      "palletSection": "팔레트",
      "boxShippedSection": "박스출하",
      "palletNo": "팔레트번호",
      "boxNo": "박스번호",
      "selectOrder": "출하지시를 선택하세요",
      "noShippedOrders": "출하분이 있는 출하지시가 없습니다.",
      "cancelShip": "출하취소",
      "cancelReason": "취소 사유",
      "cancelReasonPlaceholder": "취소 사유를 입력하세요",
      "cancelConfirm": "선택한 출하지시의 모든 출하분을 취소하고 재고를 복원합니다. 진행할까요?",
      "erpBlocked": "ERP 연동이 완료된 출하가 포함되어 취소할 수 없습니다.",
      "cancelSuccess": "출하가 취소되었습니다.",
      "loadHistoryFailed": "출하이력을 불러오지 못했습니다.",
      "loadDetailFailed": "출하 상세를 불러오지 못했습니다.",
      "cancelFailed": "출하취소에 실패했습니다."
```

- [ ] **Step 3: en.json 동기화**

메뉴: `"shipping.return": "Shipment Cancellation"`. 페이지 값(영문):
```json
      "title": "Shipment Cancellation",
      "subtitle": "Review shipped content (box/pallet) per ship order and cancel shipments.",
      "shipHistory": "Shipment History",
      "cancelHistory": "Cancellation History",
      "shipType": "Type",
      "typeBox": "Box",
      "typePallet": "Pallet",
      "typeMixed": "Mixed",
      "shippedQty": "Shipped Qty",
      "palletCount": "Pallets",
      "boxCount": "Boxes",
      "shipDetail": "Shipment Detail",
      "palletSection": "Pallets",
      "boxShippedSection": "Box Shipments",
      "palletNo": "Pallet No",
      "boxNo": "Box No",
      "selectOrder": "Select a ship order",
      "noShippedOrders": "No ship orders with shipped content.",
      "cancelShip": "Cancel Shipment",
      "cancelReason": "Cancellation Reason",
      "cancelReasonPlaceholder": "Enter cancellation reason",
      "cancelConfirm": "This cancels all shipped content of the selected ship order and restores stock. Proceed?",
      "erpBlocked": "Cannot cancel: an ERP-synced shipment is included.",
      "cancelSuccess": "Shipment canceled.",
      "loadHistoryFailed": "Failed to load shipment history.",
      "loadDetailFailed": "Failed to load shipment detail.",
      "cancelFailed": "Failed to cancel shipment."
```

- [ ] **Step 4: zh.json 동기화**

메뉴: `"shipping.return": "出货取消"`. 페이지 값(중문):
```json
      "title": "出货取消",
      "subtitle": "按出货指示查看出货内容(箱/托盘)并取消出货。",
      "shipHistory": "出货历史",
      "cancelHistory": "取消历史",
      "shipType": "出货类型",
      "typeBox": "按箱",
      "typePallet": "托盘",
      "typeMixed": "混合",
      "shippedQty": "出货数量",
      "palletCount": "托盘数",
      "boxCount": "箱数",
      "shipDetail": "出货明细",
      "palletSection": "托盘",
      "boxShippedSection": "按箱出货",
      "palletNo": "托盘号",
      "boxNo": "箱号",
      "selectOrder": "请选择出货指示",
      "noShippedOrders": "没有含出货内容的出货指示。",
      "cancelShip": "出货取消",
      "cancelReason": "取消原因",
      "cancelReasonPlaceholder": "请输入取消原因",
      "cancelConfirm": "将取消所选出货指示的全部出货内容并恢复库存。是否继续？",
      "erpBlocked": "包含已与ERP同步的出货，无法取消。",
      "cancelSuccess": "出货已取消。",
      "loadHistoryFailed": "无法加载出货历史。",
      "loadDetailFailed": "无法加载出货明细。",
      "cancelFailed": "出货取消失败。"
```

- [ ] **Step 5: vi.json 동기화**

메뉴: `"shipping.return": "Hủy xuất hàng"`. 페이지 값(베트남어):
```json
      "title": "Hủy xuất hàng",
      "subtitle": "Xem nội dung đã xuất (thùng/pallet) theo lệnh xuất hàng và hủy xuất hàng.",
      "shipHistory": "Lịch sử xuất hàng",
      "cancelHistory": "Lịch sử hủy",
      "shipType": "Loại xuất",
      "typeBox": "Thùng",
      "typePallet": "Pallet",
      "typeMixed": "Hỗn hợp",
      "shippedQty": "SL đã xuất",
      "palletCount": "Số pallet",
      "boxCount": "Số thùng",
      "shipDetail": "Chi tiết xuất hàng",
      "palletSection": "Pallet",
      "boxShippedSection": "Xuất theo thùng",
      "palletNo": "Số pallet",
      "boxNo": "Số thùng",
      "selectOrder": "Chọn một lệnh xuất hàng",
      "noShippedOrders": "Không có lệnh xuất hàng nào có nội dung đã xuất.",
      "cancelShip": "Hủy xuất hàng",
      "cancelReason": "Lý do hủy",
      "cancelReasonPlaceholder": "Nhập lý do hủy",
      "cancelConfirm": "Thao tác này hủy toàn bộ nội dung đã xuất của lệnh và khôi phục tồn kho. Tiếp tục?",
      "erpBlocked": "Không thể hủy: có lô đã đồng bộ ERP.",
      "cancelSuccess": "Đã hủy xuất hàng.",
      "loadHistoryFailed": "Không tải được lịch sử xuất hàng.",
      "loadDetailFailed": "Không tải được chi tiết xuất hàng.",
      "cancelFailed": "Hủy xuất hàng thất bại."
```

- [ ] **Step 6: JSON 유효성 + 라벨 확인**

Run:
```bash
cd /c/Project/HANES/apps/frontend/src/locales && for f in ko en zh vi; do node -e "JSON.parse(require('fs').readFileSync('$f.json','utf8')); console.log('$f ok')"; done && grep -l "출하취소" ko.json && grep -l "Shipment Cancellation" en.json
```
Expected: 4파일 ok, 라벨 매칭. BOM 없음.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json apps/frontend/src/locales/zh.json apps/frontend/src/locales/vi.json
git commit -F - <<'EOF'
i18n(shipping): 출하취소 메뉴 라벨·페이지 키 (ko/en/zh/vi)

menu.shipping.return 라벨을 출하취소로 변경하고 shipping.return.* 페이지 키 추가.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 7: 프론트엔드 페이지 재구성 (`/shipping/return`)

**Files:**
- Rewrite: `apps/frontend/src/app/(authenticated)/shipping/return/page.tsx`
- Create: `apps/frontend/src/app/(authenticated)/shipping/return/ship-cancel-page.structure.test.mjs`

**Interfaces:**
- Consumes: i18n(Task 6). API: `GET /shipping/orders/shipped`(data: ShippedOrder[]), `GET /shipping/orders/{id}/shipped-detail`(data: { order, pallets[], boxShipped[] }), `POST /shipping/orders/{id}/cancel-shipment` `{reason, workerId?}`, `GET /shipping/returns`(취소이력 보기, 기존).
- Produces: 기본 export `ShipCancelPage`. 라우트 `/shipping/return`.

- [ ] **Step 1: 구조 회귀 테스트 작성**

Create `apps/frontend/src/app/(authenticated)/shipping/return/ship-cancel-page.structure.test.mjs`:

```js
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("ship cancel page wires shipped history, detail, and order cancel", () => {
  // 통합 출하이력 + 상세 + 취소 엔드포인트
  assert.match(source, /\/shipping\/orders\/shipped/);
  assert.match(source, /shipped-detail/);
  assert.match(source, /cancel-shipment/);
  // 박스출하 팔레트번호 * 표기
  assert.match(source, /'\*'|"\*"|*/);
  // 취소이력 보기(기존 returns 재사용)
  assert.match(source, /\/shipping\/returns/);
  // 기존 수동 반품 CRUD 제거
  assert.doesNotMatch(source, /api\.post\("\/shipping\/returns"/);
  assert.doesNotMatch(source, /api\.put\(`\/shipping\/returns/);
  assert.doesNotMatch(source, /api\.delete\(`\/shipping\/returns/);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test "apps/frontend/src/app/(authenticated)/shipping/return/ship-cancel-page.structure.test.mjs"`
Expected: FAIL — 현재 page.tsx는 `/shipping/orders/shipped` 등을 포함하지 않고 `api.post("/shipping/returns"...)`를 포함.

- [ ] **Step 3: page.tsx 전체 재작성**

`apps/frontend/src/app/(authenticated)/shipping/return/page.tsx`를 아래로 전체 교체:

```tsx
"use client";

/**
 * @file src/app/(authenticated)/shipping/return/page.tsx
 * @description 출하취소 - 출하지시 단위로 출하분(박스+팔레트)을 조회하고 출하를 취소
 *
 * 워크플로우:
 * 1. 좌측에서 출하분이 있는 출하지시(통합 이력) 선택. (출하이력 ↔ 취소이력 토글)
 * 2. 우측에 팔레트(+박스) / 박스출하(팔레트번호 '*') 상세 표시.
 * 3. "출하취소" → 사유 입력 후 선택 지시의 모든 출하분을 단일 트랜잭션으로 취소(재고복원).
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Undo2, RefreshCw, Package, AlertTriangle, XCircle, Boxes, Layers } from "lucide-react";
import { Card, CardContent, Button, Modal, Input } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { useAuthStore } from "@/stores/authStore";
import api from "@/services/api";

type ShipType = "BOX" | "PALLET" | "MIXED";
interface ShippedOrder {
  shipOrderNo: string;
  customerName: string | null;
  shipDate: string | null;
  shippedQty: number;
  shipType: ShipType;
  palletCount: number;
  boxCount: number;
  hasErpSynced: boolean;
}
interface DetailBox { boxNo: string; itemCode: string; qty: number; }
interface DetailPallet { palletNo: string; status: string; boxCount: number; totalQty: number; shipNo: string | null; boxes: DetailBox[]; }
interface DetailLooseBox extends DetailBox { palletNo: string; shippedAt: string | null; }
interface ShippedDetail {
  order: { shipOrderNo: string; customerName: string | null; shipDate: string | null };
  pallets: DetailPallet[];
  boxShipped: DetailLooseBox[];
}
interface ReturnRow { returnNo: string; shipmentId: string | null; returnDate: string; returnReason: string; status: string; }

function errMsg(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

export default function ShipCancelPage() {
  const { t } = useTranslation();
  const userId = useAuthStore((s) => s.user?.id);

  const [view, setView] = useState<"history" | "cancel">("history");
  const [orders, setOrders] = useState<ShippedOrder[]>([]);
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrderNo, setSelectedOrderNo] = useState<string | null>(null);
  const [detail, setDetail] = useState<ShippedDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [canceling, setCanceling] = useState(false);
  const [pageError, setPageError] = useState("");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/shipping/orders/shipped");
      setOrders(res.data?.data ?? []);
    } catch (e: unknown) {
      setPageError(errMsg(e, t("shipping.return.loadHistoryFailed", "출하이력을 불러오지 못했습니다.")));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/shipping/returns", { params: { limit: "5000" } });
      setReturns(res.data?.data ?? []);
    } catch (e: unknown) {
      setPageError(errMsg(e, t("shipping.return.loadHistoryFailed", "출하이력을 불러오지 못했습니다.")));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (view === "history") fetchOrders();
    else fetchReturns();
  }, [view, fetchOrders, fetchReturns]);

  const fetchDetail = useCallback(async (orderNo: string) => {
    setSelectedOrderNo(orderNo);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await api.get(`/shipping/orders/${encodeURIComponent(orderNo)}/shipped-detail`);
      setDetail(res.data?.data ?? null);
    } catch (e: unknown) {
      setPageError(errMsg(e, t("shipping.return.loadDetailFailed", "출하 상세를 불러오지 못했습니다.")));
    } finally {
      setDetailLoading(false);
    }
  }, [t]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.shipOrderNo === selectedOrderNo) ?? null,
    [orders, selectedOrderNo],
  );

  const doCancel = useCallback(async () => {
    if (!selectedOrderNo || !cancelReason.trim()) return;
    setCanceling(true);
    setPageError("");
    try {
      await api.post(`/shipping/orders/${encodeURIComponent(selectedOrderNo)}/cancel-shipment`, {
        reason: cancelReason.trim(),
        workerId: userId,
      });
      setCancelOpen(false);
      setCancelReason("");
      setSelectedOrderNo(null);
      setDetail(null);
      fetchOrders();
    } catch (e: unknown) {
      setPageError(errMsg(e, t("shipping.return.cancelFailed", "출하취소에 실패했습니다.")));
    } finally {
      setCanceling(false);
    }
  }, [selectedOrderNo, cancelReason, userId, fetchOrders, t]);

  const typeLabel = useCallback((tp: ShipType) =>
    tp === "MIXED" ? t("shipping.return.typeMixed", "혼합")
    : tp === "PALLET" ? t("shipping.return.typePallet", "팔레트")
    : t("shipping.return.typeBox", "박스"), [t]);

  const orderColumns = useMemo<ColumnDef<ShippedOrder>[]>(() => [
    { accessorKey: "shipOrderNo", header: t("shipping.return.shipOrderNo", "출하지시번호"), size: 150, meta: { filterType: "text" as const }, cell: ({ getValue }) => <span className="font-mono font-medium">{getValue() as string}</span> },
    { accessorKey: "customerName", header: t("shipping.return.customer", "고객사"), size: 120, meta: { filterType: "text" as const }, cell: ({ getValue }) => (getValue() as string) || "-" },
    { accessorKey: "shipDate", header: t("shipping.return.shipDate", "출하일"), size: 100, meta: { filterType: "date" as const }, cell: ({ getValue }) => { const v = getValue() as string | null; return v ? String(v).slice(0, 10) : "-"; } },
    { accessorKey: "shipType", header: t("shipping.return.shipType", "출하유형"), size: 90, meta: { align: "center" as const }, cell: ({ getValue }) => <span className="text-xs font-medium text-text">{typeLabel(getValue() as ShipType)}</span> },
    { accessorKey: "shippedQty", header: t("shipping.return.shippedQty", "출하수량"), size: 90, meta: { align: "right" as const, filterType: "number" as const }, cell: ({ getValue }) => <span className="font-medium">{((getValue() as number) ?? 0).toLocaleString()}</span> },
    { accessorKey: "palletCount", header: t("shipping.return.palletCount", "팔레트수"), size: 80, meta: { align: "center" as const }, cell: ({ getValue }) => ((getValue() as number) ?? 0).toLocaleString() },
    { accessorKey: "boxCount", header: t("shipping.return.boxCount", "박스수"), size: 80, meta: { align: "center" as const }, cell: ({ getValue }) => ((getValue() as number) ?? 0).toLocaleString() },
    { accessorKey: "hasErpSynced", header: "ERP", size: 60, meta: { align: "center" as const }, cell: ({ getValue }) => (getValue() ? "Y" : "-") },
  ], [t, typeLabel]);

  const returnColumns = useMemo<ColumnDef<ReturnRow>[]>(() => [
    { accessorKey: "returnNo", header: t("shipping.return.returnNo", "반품번호"), size: 160, meta: { filterType: "text" as const }, cell: ({ getValue }) => <span className="font-mono">{getValue() as string}</span> },
    { accessorKey: "shipmentId", header: t("shipping.return.shipOrderNo", "출하지시번호"), size: 150, meta: { filterType: "text" as const }, cell: ({ getValue }) => (getValue() as string) || "-" },
    { accessorKey: "returnDate", header: t("shipping.return.returnDate", "반품일"), size: 100, meta: { filterType: "date" as const }, cell: ({ getValue }) => { const v = getValue() as string | null; return v ? String(v).slice(0, 10) : "-"; } },
    { accessorKey: "returnReason", header: t("shipping.return.cancelReason", "취소 사유"), size: 200, meta: { filterType: "text" as const } },
    { accessorKey: "status", header: t("common.status"), size: 100, meta: { filterType: "text" as const } },
  ], [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Undo2 className="w-7 h-7 text-primary" />{t("shipping.return.title", "출하취소")}</h1>
          <p className="text-text-muted mt-1">{t("shipping.return.subtitle", "출하지시 단위로 출하분을 조회하고 출하를 취소합니다.")}</p>
        </div>
        <div className="flex gap-2">
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            <button type="button" onClick={() => setView("history")} className={`px-3 py-1.5 text-sm ${view === "history" ? "bg-primary text-white" : "text-text-muted hover:bg-surface"}`}>{t("shipping.return.shipHistory", "출하이력")}</button>
            <button type="button" onClick={() => setView("cancel")} className={`px-3 py-1.5 text-sm ${view === "cancel" ? "bg-primary text-white" : "text-text-muted hover:bg-surface"}`}>{t("shipping.return.cancelHistory", "취소이력")}</button>
          </div>
          <Button variant="secondary" size="sm" onClick={() => (view === "history" ? fetchOrders() : fetchReturns())}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
        </div>
      </div>

      {pageError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm flex-shrink-0">
          <AlertTriangle className="w-4 h-4 shrink-0" /><span className="flex-1">{pageError}</span>
          <button onClick={() => setPageError("")}><XCircle className="w-4 h-4" /></button>
        </div>
      )}

      {view === "cancel" ? (
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid data={returns} columns={returnColumns} isLoading={loading} enableColumnFilter enableExport exportFileName={t("shipping.return.cancelHistory", "취소이력")} />
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 flex-1 min-h-0 overflow-hidden">
          {/* left: shipped orders */}
          <Card className="min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-3 flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-text flex-shrink-0">{t("shipping.return.shipHistory", "출하이력")} <span className="text-text-muted font-normal">({orders.length})</span></h2>
            <div className="flex-1 min-h-0">
              <DataGrid data={orders} columns={orderColumns} isLoading={loading} enableColumnFilter enableExport
                exportFileName={t("shipping.return.shipHistory", "출하이력")}
                emptyMessage={t("shipping.return.noShippedOrders", "출하분이 있는 출하지시가 없습니다.")}
                selectedRowId={selectedOrderNo ?? undefined}
                getRowId={(row) => row.shipOrderNo}
                onRowClick={(row) => fetchDetail(row.shipOrderNo)} />
            </div>
          </CardContent></Card>

          {/* right: detail + cancel */}
          <Card padding="none"><CardContent className="p-3 h-full flex flex-col min-h-0">
            <div className="flex items-center justify-between gap-2 mb-2 flex-shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-text">{t("shipping.return.shipDetail", "출하 상세")}</h2>
                <p className="text-xs text-text-muted mt-0.5">{selectedOrderNo ?? t("shipping.return.selectOrder", "출하지시를 선택하세요")}</p>
              </div>
              <Button size="sm" variant="danger"
                disabled={!detail || detailLoading || !!selectedOrder?.hasErpSynced}
                onClick={() => { setCancelReason(""); setCancelOpen(true); }}>
                <Undo2 className="w-4 h-4 mr-1" />{t("shipping.return.cancelShip", "출하취소")}
              </Button>
            </div>
            {selectedOrder?.hasErpSynced && (
              <div className="mb-2 px-2 py-1 rounded border border-amber-500 text-amber-600 text-xs flex-shrink-0">{t("shipping.return.erpBlocked", "ERP 연동이 완료된 출하가 포함되어 취소할 수 없습니다.")}</div>
            )}
            {!selectedOrderNo ? (
              <div className="flex-1 flex flex-col items-center justify-center text-text-muted"><Package className="w-12 h-12 mb-2 opacity-50" /><p className="text-sm">{t("shipping.return.selectOrder", "출하지시를 선택하세요")}</p></div>
            ) : detailLoading ? (
              <div className="flex-1 flex items-center justify-center text-text-muted">{t("common.loading", "로딩 중...")}</div>
            ) : detail ? (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
                {/* pallets */}
                <div>
                  <p className="text-xs font-semibold text-text-muted flex items-center gap-1 mb-1"><Layers className="w-3.5 h-3.5" />{t("shipping.return.palletSection", "팔레트")} ({detail.pallets.length})</p>
                  {detail.pallets.length === 0 ? <p className="text-xs text-text-muted pl-1">-</p> : detail.pallets.map((p) => (
                    <div key={p.palletNo} className="p-2 bg-background rounded mb-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-mono font-medium">{p.palletNo}</span>
                        <span className="text-xs text-text-muted">{p.boxCount.toLocaleString()}box · {p.totalQty.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* box shipments (palletNo = *) */}
                <div>
                  <p className="text-xs font-semibold text-text-muted flex items-center gap-1 mb-1"><Boxes className="w-3.5 h-3.5" />{t("shipping.return.boxShippedSection", "박스출하")} ({detail.boxShipped.length})</p>
                  {detail.boxShipped.length === 0 ? <p className="text-xs text-text-muted pl-1">-</p> : detail.boxShipped.map((b) => (
                    <div key={b.boxNo} className="flex items-center justify-between p-2 bg-background rounded mb-1 text-sm">
                      <span className="font-mono">{b.boxNo}</span>
                      <span className="text-xs text-text-muted">{t("shipping.return.palletNo", "팔레트번호")}: <span className="font-mono">{b.palletNo}</span> · {b.qty.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent></Card>
        </div>
      )}

      {/* cancel confirm modal */}
      <Modal isOpen={cancelOpen} onClose={() => setCancelOpen(false)} title={t("shipping.return.cancelShip", "출하취소")} size="md">
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm text-amber-700 dark:text-amber-400">
            {t("shipping.return.cancelConfirm", "선택한 출하지시의 모든 출하분을 취소하고 재고를 복원합니다. 진행할까요?")}
          </div>
          <Input label={t("shipping.return.cancelReason", "취소 사유")} placeholder={t("shipping.return.cancelReasonPlaceholder", "취소 사유를 입력하세요")}
            value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} fullWidth />
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>{t("common.cancel")}</Button>
            <Button variant="danger" onClick={doCancel} disabled={!cancelReason.trim() || canceling}>
              {canceling ? t("common.processing", "처리 중...") : t("shipping.return.cancelShip", "출하취소")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
```
> `selectedRowId`/`getRowId`/`emptyMessage`/`onRowClick`는 기존 DataGrid 사용처(예: confirm/page.tsx)와 동일 prop. `useAuthStore` 경로(`@/stores/authStore`)는 BoxScanShipModal과 동일. lucide 아이콘 `Boxes`/`Layers` 존재 확인(없으면 `Package`로 대체).

- [ ] **Step 4: 구조 테스트 통과 확인**

Run: `node --test "apps/frontend/src/app/(authenticated)/shipping/return/ship-cancel-page.structure.test.mjs"`
Expected: PASS.

- [ ] **Step 5: 타입체크**

Run: `cd /c/Project/HANES && pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 0건. (DataGrid prop/아이콘/스토어 타입 에러 시 사용처에 맞게 보정.)

- [ ] **Step 6: Commit**

```bash
git add "apps/frontend/src/app/(authenticated)/shipping/return/page.tsx" "apps/frontend/src/app/(authenticated)/shipping/return/ship-cancel-page.structure.test.mjs"
git commit -F - <<'EOF'
feat(shipping): 출하반품 화면을 출하취소로 재구성

좌측 통합 출하이력(박스+팔레트)/우측 팔레트·박스출하(팔레트번호 *) 상세/
출하지시 단위 취소(사유 입력→cancel-shipment) + 취소이력 토글. 기존 수동 반품 CRUD 제거.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 8: 통합 검증

- [ ] **Step 1: 양 앱 타입체크**

Run: `cd /c/Project/HANES && pnpm --filter @harness/backend exec tsc --noEmit && pnpm --filter @harness/frontend exec tsc --noEmit`
Expected: 0건.

- [ ] **Step 2: i18n 누락 점검**

Run: `cd /c/Project/HANES && node scripts/find_missing_i18n.js 2>&1 | tail -8`
Expected: `shipping.return.*` 누락 0(다른 네임스페이스 기존 누락은 무관·보고만).

- [ ] **Step 3: 구조 테스트 + 기존 jest**

Run: `node --test "apps/frontend/src/app/(authenticated)/shipping/return/ship-cancel-page.structure.test.mjs" && cd /c/Project/HANES && pnpm --filter @harness/backend exec jest shipping 2>&1 | tail -15`
Expected: 구조 테스트 PASS, shipping jest 통과(모듈 부팅·기존 취소 동작 회귀 없음).

- [ ] **Step 4: 실DB/브라우저 E2E (사용자/DB 가용 시)**

> dev :3002 + JSHANES. 체크리스트:
> 1. 좌측 메뉴 "출하취소"(/shipping/return) 진입, 출하이력에 박스출하·팔레트출하 모두 표시, 출하유형 배지 확인.
> 2. 박스출하 지시 선택 → 우측 박스출하 섹션에 팔레트번호 `*` 표시.
> 3. 팔레트출하 지시 선택 → 우측 팔레트 섹션에 팔레트번호 표시.
> 4. "출하취소"+사유 → 성공, 좌측 목록에서 사라짐(지시 CONFIRMED), 제품재고 복원 확인.
> 5. 취소이력 토글 → SHIPPING_RETURNS 기록 표시.
> 6. ERP 연동 출하 포함 지시 → 취소 버튼 비활성/400 안내.

- [ ] **Step 5: 협업 보드 정리**

`LOCKS.md`에서 본 작업 lock 제거, `JOURNAL.md`/`ARCHIVE.md` 결과 기록, `HANDOFF/claude.md` 갱신(별도 커밋, 기능 커밋과 분리).

---

## Self-Review

- **Spec coverage:** §4.1 DDL/시퀀스→T1; §4.2 엔티티→T1; §4.3 stamp→T2; §4.4 조회 2종→T4; §4.5 in-tx 추출→T3, 주문취소+취소이력→T5; §5 프론트→T7; §6 i18n→T6; §8 검증→T8. ✅
- **Placeholder scan:** 모든 코드 스텝에 완전 코드 포함. T5의 "확장 지점"은 YAGNI 주석으로 명시(팔레트 품목 항목화는 범위 밖, 1차는 itemQty+remark). ✅
- **Type consistency:** `findShippedOrders`/`getShippedDetail`/`cancelOrderShipment` 반환형이 T7 인터페이스(ShippedOrder/ShippedDetail)와 일치. `nextReturnNo`(T1)→T5 사용. `*InTx` 시그니처(T3)→T5 호출 일치. `CancelOrderShipmentDto`(T5) 일관. ✅
- **위험/주의:** (a) DDL 적용은 DB 접근 필요 — 불가 시 T1 BLOCKED 보고. (b) `@Get('shipped')` vs `@Get(':id')` 라우트 순서 — T4에서 명시. (c) ShipOrderService↔ShipmentService 순환참조 가능 — T5에서 forwardRef 안내. (d) 기존 service spec이 `update` 인자 strict 비교 시 T2/T3에서 기대값 갱신 필요. (e) raw SQL 바인드 변수 표기는 repo 관례 확인 후 일치(T4 주석).

## Execution Handoff
(스킬 지시에 따라 저장 후 실행 방식 선택 제시.)
