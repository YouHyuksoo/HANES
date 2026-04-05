# Workflow Gap Fix — 워크플로우 단절 수정

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 5개 워크플로우 단절 지점(자재 연결키, 출하지시-실출하, 출하 재고 원자성, 생산-작업지시 연동, 문서 동기화)을 수정하여 전체 MES 흐름을 유기적으로 연결한다.

**Architecture:** 엔티티에 명시적 FK 컬럼 추가 → 서비스에서 itemCode 기반 느슨한 조회를 FK 기반 정확한 조회로 교체 → 트랜잭션 경계 재정리 → 문서 동기화

**Tech Stack:** NestJS, TypeORM, Oracle DB

**Spec:** `docs/superpowers/specs/2026-04-04-workflow-gap-checklist.md`

---

## ⚠️ DDL 변경 사항 (사용자 승인 필요)

아래 4개 테이블에 컬럼을 추가해야 합니다:

| 테이블 | 추가 컬럼 | 타입 | 용도 |
|--------|-----------|------|------|
| `MAT_LOTS` | `ARRIVAL_NO` | VARCHAR2(50) NULL | LOT → 입하 역추적 |
| `MAT_LOTS` | `ARRIVAL_SEQ` | NUMBER NULL | LOT → 입하 행 식별 |
| `MAT_RECEIVINGS` | `ARRIVAL_NO` | VARCHAR2(50) NULL | 입고 → 입하 역추적 |
| `MAT_RECEIVINGS` | `ARRIVAL_SEQ` | NUMBER NULL | 입고 → 입하 행 식별 |
| `IQC_LOGS` | `MAT_UID` | VARCHAR2(50) NULL | IQC → LOT 직접 연결 |
| `SHIPMENT_LOGS` | `SHIP_ORDER_NO` | VARCHAR2(50) NULL | 실출하 → 출하지시 연결 |

---

## File Map

### Task 1: 엔티티 + DDL
- Modify: `apps/backend/src/entities/mat-lot.entity.ts` — arrivalNo, arrivalSeq 추가
- Modify: `apps/backend/src/entities/mat-receiving.entity.ts` — arrivalNo, arrivalSeq 추가
- Modify: `apps/backend/src/entities/iqc-log.entity.ts` — matUid 추가
- Modify: `apps/backend/src/entities/shipment-log.entity.ts` — shipOrderNo 추가

### Task 2: 자재 서비스 FK 연결
- Modify: `apps/backend/src/modules/material/services/arrival.service.ts:498-507` — matUid → lot.arrivalNo로 정확한 취소
- Modify: `apps/backend/src/modules/material/services/receiving.service.ts:286-289` — lot.arrivalNo로 입하 조회
- Modify: `apps/backend/src/modules/material/services/iqc-history.service.ts:344-371` — matUid 기반 정확한 조회

### Task 3: 출하지시 상태 전이 + 실출하 연결
- Modify: `apps/backend/src/modules/shipping/services/ship-order.service.ts` — confirm() 메서드 추가
- Modify: `apps/backend/src/modules/shipping/controllers/ship-order.controller.ts` — confirm 엔드포인트 추가
- Modify: `apps/backend/src/modules/shipping/dto/ship-order.dto.ts` — ConfirmShipOrderDto (필요시)

### Task 4: 출하 재고 차감 원자성
- Modify: `apps/backend/src/modules/shipping/services/shipment.service.ts:412-565` — 재고 차감을 트랜잭션 안으로 이동

### Task 5: 생산실적 완료 → 작업지시 자동 완료
- Modify: `apps/backend/src/modules/production/services/prod-result.service.ts:585-680` — complete() 내 자동 완료 로직

### Task 6: 문서 동기화
- Modify: `docs/diagrams/05-production-process-flow.md` — 전면 재작성

---

## Task 1: 엔티티 컬럼 추가 + DDL

**Files:**
- Modify: `apps/backend/src/entities/mat-lot.entity.ts`
- Modify: `apps/backend/src/entities/mat-receiving.entity.ts`
- Modify: `apps/backend/src/entities/iqc-log.entity.ts`
- Modify: `apps/backend/src/entities/shipment-log.entity.ts`

- [ ] **Step 1: DDL 실행 (oracle-db 스킬)**

```sql
-- MAT_LOTS: 입하 연결
ALTER TABLE MAT_LOTS ADD (ARRIVAL_NO VARCHAR2(50), ARRIVAL_SEQ NUMBER);
CREATE INDEX IDX_MAT_LOTS_ARRIVAL ON MAT_LOTS(ARRIVAL_NO, ARRIVAL_SEQ);

-- MAT_RECEIVINGS: 입하 연결
ALTER TABLE MAT_RECEIVINGS ADD (ARRIVAL_NO VARCHAR2(50), ARRIVAL_SEQ NUMBER);

-- IQC_LOGS: LOT 직접 연결
ALTER TABLE IQC_LOGS ADD (MAT_UID VARCHAR2(50));
CREATE INDEX IDX_IQC_LOGS_MAT_UID ON IQC_LOGS(MAT_UID);

-- SHIPMENT_LOGS: 출하지시 연결
ALTER TABLE SHIPMENT_LOGS ADD (SHIP_ORDER_NO VARCHAR2(50));
CREATE INDEX IDX_SHIPMENT_LOGS_ORDER ON SHIPMENT_LOGS(SHIP_ORDER_NO);
```

- [ ] **Step 2: mat-lot.entity.ts에 arrivalNo, arrivalSeq 추가**

`expireDate` 컬럼 뒤에 추가:

```typescript
  @Column({ type: 'varchar2', name: 'ARRIVAL_NO', length: 50, nullable: true })
  arrivalNo: string | null;

  @Column({ type: 'number', name: 'ARRIVAL_SEQ', nullable: true })
  arrivalSeq: number | null;
```

- [ ] **Step 3: mat-receiving.entity.ts에 arrivalNo, arrivalSeq 추가**

`warehouseCode` 컬럼 뒤에 추가:

```typescript
  @Column({ type: 'varchar2', name: 'ARRIVAL_NO', length: 50, nullable: true })
  arrivalNo: string | null;

  @Column({ type: 'number', name: 'ARRIVAL_SEQ', nullable: true })
  arrivalSeq: number | null;
```

- [ ] **Step 4: iqc-log.entity.ts에 matUid 추가**

`arrivalNo` 컬럼 뒤에 추가:

```typescript
  @Column({ type: 'varchar2', name: 'MAT_UID', length: 50, nullable: true })
  matUid: string | null;
```

- [ ] **Step 5: shipment-log.entity.ts에 shipOrderNo 추가**

`customer` 컬럼 뒤에 추가:

```typescript
  @Column({ type: 'varchar2', name: 'SHIP_ORDER_NO', length: 50, nullable: true })
  shipOrderNo: string | null;
```

- [ ] **Step 6: 빌드 확인**

```bash
cd C:/Project/HANES && pnpm build
```

---

## Task 2: 자재 서비스 FK 연결 (itemCode → 명시적 FK)

**Files:**
- Modify: `apps/backend/src/modules/material/services/arrival.service.ts`
- Modify: `apps/backend/src/modules/material/services/receiving.service.ts`
- Modify: `apps/backend/src/modules/material/services/iqc-history.service.ts`

### 2-A: arrival.service.ts — 입하 취소 시 정확한 건 식별

- [ ] **Step 1: arrival.service.ts:498-507 수정**

기존 (itemCode 기반 느슨한 조회):
```typescript
if (original.itemCode) {
  const arrivalRecord = await queryRunner.manager.findOne(MatArrival, {
    where: { itemCode: original.itemCode, status: 'DONE' },
    order: { arrivalDate: 'DESC' },
  });
  if (arrivalRecord) {
    await queryRunner.manager.update(MatArrival, { arrivalNo: arrivalRecord.arrivalNo, seq: arrivalRecord.seq }, { status: 'CANCELED' });
  }
}
```

변경 (matUid → MatLot.arrivalNo로 정확한 건 조회):
```typescript
if (original.matUid) {
  const lot = await queryRunner.manager.findOne(MatLot, { where: { matUid: original.matUid } });
  if (lot?.arrivalNo) {
    await queryRunner.manager.update(MatArrival, { arrivalNo: lot.arrivalNo, seq: lot.arrivalSeq ?? 1 }, { status: 'CANCELED' });
  }
} else if (original.itemCode) {
  // matUid 없는 레거시 데이터 — 기존 로직 유지
  const arrivalRecord = await queryRunner.manager.findOne(MatArrival, {
    where: { itemCode: original.itemCode, status: 'DONE' },
    order: { arrivalDate: 'DESC' },
  });
  if (arrivalRecord) {
    await queryRunner.manager.update(MatArrival, { arrivalNo: arrivalRecord.arrivalNo, seq: arrivalRecord.seq }, { status: 'CANCELED' });
  }
}
```

### 2-B: receiving.service.ts — 입고 시 정확한 입하 건 참조

- [ ] **Step 2: receiving.service.ts:285-290 수정**

기존:
```typescript
// 0. MAT_ARRIVALS에서 입하 창고 조회 (itemCode 기준)
const arrivalRecord = await queryRunner.manager.findOne(MatArrival, {
  where: { itemCode: lot.itemCode, status: 'DONE' },
  order: { arrivalDate: 'DESC' },
});
const arrivalWarehouseCode = arrivalRecord?.warehouseCode || null;
```

변경:
```typescript
// 0. MAT_ARRIVALS에서 입하 창고 조회 (LOT의 arrivalNo FK 기준)
let arrivalRecord: MatArrival | null = null;
if (lot.arrivalNo) {
  arrivalRecord = await queryRunner.manager.findOne(MatArrival, {
    where: { arrivalNo: lot.arrivalNo, seq: lot.arrivalSeq ?? 1 },
  });
} else {
  // arrivalNo 없는 레거시 LOT — 기존 로직
  arrivalRecord = await queryRunner.manager.findOne(MatArrival, {
    where: { itemCode: lot.itemCode, status: 'DONE' },
    order: { arrivalDate: 'DESC' },
  });
}
const arrivalWarehouseCode = arrivalRecord?.warehouseCode || null;
```

- [ ] **Step 3: receiving.service.ts — MatReceiving 생성 시 arrivalNo 기록**

`receiving` 생성 부분 (`apps/backend/src/modules/material/services/receiving.service.ts:309-321`)에 arrivalNo 추가:

```typescript
const receiving = queryRunner.manager.create(MatReceiving, {
  receiveNo,
  seq: currentSeq,
  matUid: item.matUid,
  itemCode: lot.itemCode,
  qty: item.qty,
  warehouseCode: item.warehouseId,
  workerId: dto.workerId,
  remark: item.remark,
  status: 'DONE',
  company: lot.company,
  plant: lot.plant,
  arrivalNo: lot.arrivalNo,       // 추가
  arrivalSeq: lot.arrivalSeq,     // 추가
});
```

### 2-C: iqc-history.service.ts — IQC 판정/취소 시 matUid 기반

- [ ] **Step 4: IQC 판정 생성(create) 시 matUid 저장 확인**

IQC 결과 생성 로직에서 IqcLog에 matUid를 저장하는지 확인. 저장하고 있지 않으면 create 메서드에서 `matUid: dto.matUid` 추가.

- [ ] **Step 5: iqc-history.service.ts:344-352 수정 — 입고 여부 체크**

기존:
```typescript
if (log.itemCode) {
  const receiving = await this.matReceivingRepository.findOne({
    where: { itemCode: log.itemCode, status: 'DONE' },
  });
  if (receiving) {
    throw new BadRequestException('이미 입고된 LOT은 IQC 판정을 취소할 수 없습니다.');
  }
}
```

변경:
```typescript
if (log.matUid) {
  const receiving = await this.matReceivingRepository.findOne({
    where: { matUid: log.matUid, status: 'DONE' },
  });
  if (receiving) {
    throw new BadRequestException('이미 입고된 LOT은 IQC 판정을 취소할 수 없습니다.');
  }
} else if (log.itemCode) {
  // matUid 없는 레거시 — 기존 로직
  const receiving = await this.matReceivingRepository.findOne({
    where: { itemCode: log.itemCode, status: 'DONE' },
  });
  if (receiving) {
    throw new BadRequestException('이미 입고된 LOT은 IQC 판정을 취소할 수 없습니다.');
  }
}
```

- [ ] **Step 6: iqc-history.service.ts:360-371 수정 — LOT iqcStatus 복원**

기존:
```typescript
if (log.itemCode) {
  const lot = await this.matLotRepository.findOne({
    where: { itemCode: log.itemCode, iqcStatus: log.result },
    order: { createdAt: 'DESC' },
  });
  if (lot) {
    await this.matLotRepository.update(lot.matUid, {
      iqcStatus: 'PENDING',
    });
  }
}
```

변경:
```typescript
if (log.matUid) {
  await this.matLotRepository.update(log.matUid, { iqcStatus: 'PENDING' });
} else if (log.itemCode) {
  // matUid 없는 레거시 — 기존 로직
  const lot = await this.matLotRepository.findOne({
    where: { itemCode: log.itemCode, iqcStatus: log.result },
    order: { createdAt: 'DESC' },
  });
  if (lot) {
    await this.matLotRepository.update(lot.matUid, { iqcStatus: 'PENDING' });
  }
}
```

- [ ] **Step 7: 빌드 확인**

```bash
cd C:/Project/HANES && pnpm build
```

---

## Task 3: 출하지시 상태 전이 + 실출하 연결

**Files:**
- Modify: `apps/backend/src/modules/shipping/services/ship-order.service.ts`
- Modify: `apps/backend/src/modules/shipping/controllers/ship-order.controller.ts`
- Modify: `apps/backend/src/modules/shipping/services/shipment.service.ts`
- Modify: `apps/backend/src/modules/shipping/dto/shipment.dto.ts`

**정책 결정:** 출하지시(ShipmentOrder)는 실출하(ShipmentLog)의 **선행 문서**다.
- 출하지시 DRAFT → CONFIRMED: 확정 시 실출하 생성 가능
- 실출하 생성 시 shipOrderNo 참조
- 출하지시 상태: DRAFT → CONFIRMED → CLOSED (실출하 완료 시 자동)

- [ ] **Step 1: ship-order.service.ts에 confirm() 메서드 추가**

`delete()` 메서드 뒤에 추가:

```typescript
  /**
   * 출하지시 확정 (DRAFT -> CONFIRMED)
   * 확정 후 실출하 생성 가능
   */
  async confirm(shipOrderNo: string) {
    const order = await this.findById(shipOrderNo);
    if (order.status !== 'DRAFT') {
      throw new BadRequestException('DRAFT 상태에서만 확정할 수 있습니다.');
    }

    // 품목이 없으면 확정 불가
    if (!order.items || order.items.length === 0) {
      throw new BadRequestException('품목이 없는 출하지시는 확정할 수 없습니다.');
    }

    await this.shipOrderRepository.update(
      { shipOrderNo },
      { status: 'CONFIRMED' },
    );

    return this.findById(shipOrderNo);
  }
```

- [ ] **Step 2: ship-order.controller.ts에 confirm 엔드포인트 추가**

`delete` 메서드 뒤에 추가:

```typescript
  @Put(':id/confirm')
  @ApiOperation({ summary: '출하지시 확정 (DRAFT → CONFIRMED)' })
  @ApiParam({ name: 'id', description: '출하지시 번호' })
  async confirm(@Param('id') id: string) {
    const data = await this.shipOrderService.confirm(id);
    return ResponseUtil.success(data, '출하지시가 확정되었습니다.');
  }
```

- [ ] **Step 3: ship-order.service.ts JSDoc 상태 흐름 수정**

파일 상단 주석에서 상태 흐름을 실제 구현과 맞춤:
```
 * 2. **상태 흐름**: DRAFT -> CONFIRMED -> CLOSED
 *    - DRAFT: 작성 중 (수정/삭제 가능)
 *    - CONFIRMED: 확정 (실출하 생성 가능, 수정/삭제 불가)
 *    - CLOSED: 실출하 완료 후 자동 마감
```

- [ ] **Step 4: shipment.service.ts — 실출하 생성 시 shipOrderNo 연결**

`create()` 메서드의 shipment 생성 부분에 `shipOrderNo` 추가.

shipment.dto.ts의 `CreateShipmentDto`에 `shipOrderNo?: string` 필드 추가 후:

```typescript
const shipment = this.shipmentRepository.create({
  shipNo: dto.shipNo,
  // ... 기존 필드들 ...
  shipOrderNo: dto.shipOrderNo || null,  // 추가
});
```

- [ ] **Step 5: 빌드 확인**

```bash
cd C:/Project/HANES && pnpm build
```

---

## Task 4: 출하 재고 차감 원자성 보장

**Files:**
- Modify: `apps/backend/src/modules/shipping/services/shipment.service.ts`

**현재 문제:** `markAsShipped()`에서 상태 변경(트랜잭션)과 재고 차감(트랜잭션 밖)이 분리되어 있다. 상태는 SHIPPED인데 재고는 차감 안 된 상태가 가능.

- [ ] **Step 1: shipment.service.ts markAsShipped() — 재고 차감을 트랜잭션 안으로 이동**

현재 구조:
```
트랜잭션 {
  팔레트 SHIPPED
  박스 SHIPPED
  출하 SHIPPED
  FG라벨 SHIPPED
} ← 커밋

재고 차감 (트랜잭션 밖, try/catch로 실패 무시)
```

변경 구조:
```
트랜잭션 {
  팔레트 SHIPPED
  박스 SHIPPED
  출하 SHIPPED
  FG라벨 SHIPPED
  제품재고 차감 (issueStockInTx)  ← 트랜잭션 안으로
} ← 커밋
```

핵심 변경:
1. `queryRunner.commitTransaction()` (현재 line 514) 전에 재고 차감 로직 이동
2. `productInventoryService.issueStock()` 대신 `productInventoryService.issueStockInTx(queryRunner, ...)` 사용
3. 재고 부족 시 경고 로그 + 트랜잭션 롤백이 아닌, 재고 부족이면 출하 차단

`issueStockInTx` 메서드가 없으면 `productInventoryService`에 추가 필요. 확인 후 구현.

- [ ] **Step 2: 빌드 확인**

```bash
cd C:/Project/HANES && pnpm build
```

---

## Task 5: 생산실적 완료 → 작업지시 자동 완료 체크

**Files:**
- Modify: `apps/backend/src/modules/production/services/prod-result.service.ts`

**정책:** 실적 완료 시 해당 작업지시의 모든 실적이 DONE이면 작업지시도 자동 DONE 처리.
단, 작업지시의 `planQty ≤ totalGoodQty`인 경우에만 (계획수량 달성).

- [ ] **Step 1: prod-result.service.ts complete() 끝에 자동 완료 로직 추가**

`queryRunner.commitTransaction()` 직전에 추가:

```typescript
// 6. 작업지시 자동 완료 체크
// 해당 작업지시의 모든 실적이 DONE이고 계획수량 달성 시 자동 완료
const jobOrder = await queryRunner.manager.findOne(JobOrder, {
  where: { orderNo: prodResult.orderNo },
});

if (jobOrder && jobOrder.status === 'RUNNING') {
  const pendingResults = await queryRunner.manager.count(ProdResult, {
    where: { orderNo: prodResult.orderNo, status: In(['RUNNING', 'WAITING']) },
  });

  if (pendingResults === 0) {
    const summary = await queryRunner.manager
      .createQueryBuilder(ProdResult, 'pr')
      .select('SUM(pr.goodQty)', 'totalGoodQty')
      .addSelect('SUM(pr.defectQty)', 'totalDefectQty')
      .where('pr.orderNo = :orderNo AND pr.status = :status', {
        orderNo: prodResult.orderNo,
        status: 'DONE',
      })
      .getRawOne();

    const totalGood = parseInt(summary?.totalGoodQty) || 0;
    const totalDefect = parseInt(summary?.totalDefectQty) || 0;

    if (totalGood >= jobOrder.planQty) {
      await queryRunner.manager.update(JobOrder, { orderNo: prodResult.orderNo }, {
        status: 'DONE',
        endAt: new Date(),
        goodQty: totalGood,
        defectQty: totalDefect,
      });
      this.logger.log(`작업지시 자동 완료: ${prodResult.orderNo} (양품 ${totalGood} >= 계획 ${jobOrder.planQty})`);
    }
  }
}
```

- [ ] **Step 2: Import 확인**

`In`이 이미 import 되어있는지 확인. 없으면 typeorm import에 추가.

- [ ] **Step 3: 빌드 확인**

```bash
cd C:/Project/HANES && pnpm build
```

---

## Task 6: 문서 동기화 — 05-production-process-flow.md 재작성

**Files:**
- Modify: `docs/diagrams/05-production-process-flow.md`

- [ ] **Step 1: 전면 재작성**

수정 대상:
1. `Prisma/Supabase` → `Oracle DB (TypeORM)` 
2. `PLANNED` → `WAITING` (작업지시)
3. `IN_PROGRESS` → `RUNNING` (작업지시)
4. `READY` → `PREPARING` (출하)
5. 상태 전이표를 실제 코드 기준으로 교체:
   - 생산계획: `DRAFT → CONFIRMED → CLOSED`
   - 작업지시: `WAITING → RUNNING → HOLD → DONE / CANCELED`
   - 출하지시: `DRAFT → CONFIRMED → CLOSED`
   - 실출하: `PREPARING → LOADED → SHIPPED → DELIVERED / CANCELED`
   - 자재: 입하(`DONE`) → IQC(`PENDING/PASS/FAIL`) → 입고(`DONE`)
6. Prisma 코드 예시 → TypeORM `queryRunner` 트랜잭션 예시로 교체
7. prisma.box.findUnique → TypeORM repository 패턴
8. API 경로를 현재 컨트롤러 기준으로 수정

- [ ] **Step 2: 빌드 확인 (문서이므로 불필요하지만 다른 변경과 함께 최종 빌드)**

```bash
cd C:/Project/HANES && pnpm build
```

---

## 실행 순서 및 의존성

```
Task 1 (DDL+엔티티) ──→ Task 2 (자재 FK)
                    ──→ Task 3 (출하 연결)
                    ──→ Task 4 (출하 원자성) — Task 3과 병렬 가능
Task 5 (생산 자동완료) — 독립, 병렬 가능
Task 6 (문서) — 모든 Task 완료 후 최종 작성
```

## 완료 기준

1. `pnpm build` 에러 0건
2. 자재 흐름: matUid/arrivalNo 기반 정확한 연결
3. 출하 흐름: 출하지시 확정 → 실출하 생성 → 재고 차감 원자성 보장
4. 생산 흐름: 실적 완료 시 작업지시 자동 완료 체크
5. 문서: 실제 코드와 상태값 일치
