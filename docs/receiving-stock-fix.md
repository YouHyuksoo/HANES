# 입고 시 입하 창고 재고 차감 로직 수정 지시서

## 📋 개요

### 문제 설명
현재 `receiving.service.ts`의 입고 처리(`createBulkReceive`)에서 입하(Arrival) 창고의 재고를 차감하지 않고 입고 창고에만 재고를 추가하고 있습니다. 이로 인해 입고 시 창고를 변경하면 입하 창고와 입고 창고 양쪽에 재고가 남아 **중복 재고**가 발생합니다.

### 정상 프로세스
입고는 창고 이동(Transfer) 개념으로 동작해야 합니다:
- 입하창고: 재고 감소 (출고)
- 입고창고: 재고 증가 (입고)

---

## 🔴 현재 문제 코드

```typescript
// receiving.service.ts - createBulkReceive (기존)
const stockTx = queryRunner.manager.create(StockTransaction, {
  transType: 'RECEIVE',
  toWarehouseId: item.warehouseId,  // ← 입고 창고만 기록
  // ❌ fromWarehouseId: 입하창고 (누락!)
  qty: item.qty,
  ...
});

// 3. Stock upsert (입고 창고에만 반영)
await this.upsertStock(queryRunner.manager, item.warehouseId, lot.partId, item.lotId, item.qty);
// ❌ 입하 창고 재고는 차감 안 됨!
```

### 문제 결과
| 상황 | 입하창고 | 입고창고 | 총 재고 |
|------|---------|---------|---------|
| 입하 후 | 100 | 0 | 100 |
| 입고(창고 변경) 후 | 100 | 100 | **200 (❌ 중복)** |

---

## ✅ 수정 사항

### 파일 경로
```
apps/backend/src/modules/material/services/receiving.service.ts
```

### 수정 내용

#### 1. 입하 창고 정보 조회 로직 추가

```typescript
// LOT 검증 루프 내에 추가
for (const item of dto.items) {
  // ... 기존 검증 코드 ...

  // ✅ 추가: 입하 트랜잭션에서 입하 창고 정보 조회
  const arrivalTx = await this.stockTransactionRepository.findOne({
    where: { 
      lotId: item.lotId, 
      transType: 'MAT_IN', 
      status: 'DONE' 
    },
    order: { transDate: 'DESC' } // 최신 입하 정보
  });
  const arrivalWarehouseId = arrivalTx?.toWarehouseId;

  if (!arrivalWarehouseId) {
    throw new BadRequestException(`LOT(${lot.lotNo})의 입하 정보를 찾을 수 없습니다.`);
  }
  
  // ... 이어서 처리
}
```

#### 2. StockTransaction에 fromWarehouseId 추가

```typescript
const stockTx = queryRunner.manager.create(StockTransaction, {
  transNo,
  transType: 'RECEIVE',
  fromWarehouseId: arrivalWarehouseId,  // ← ✅ 입하 창고 (출발)
  toWarehouseId: item.warehouseId,      // ← 입고 창고 (도착)
  partId: lot.partId,
  lotId: item.lotId,
  qty: item.qty,
  remark: item.remark,
  workerId: dto.workerId,
  refType: 'RECEIVE',
  refId: receiving.id,
});
```

#### 3. 입하 창고 재고 차감 로직 추가

```typescript
// ✅ 추가: 입하 창고 재고 차감 (창고가 다른 경우만)
if (arrivalWarehouseId !== item.warehouseId) {
  const arrivalStock = await queryRunner.manager.findOne(MatStock, {
    where: { 
      warehouseCode: arrivalWarehouseId, 
      partId: lot.partId, 
      lotId: item.lotId 
    }
  });

  if (arrivalStock) {
    const newQty = Math.max(0, arrivalStock.qty - item.qty);
    await queryRunner.manager.update(MatStock, arrivalStock.id, {
      qty: newQty,
      availableQty: Math.max(0, newQty - arrivalStock.reservedQty),
    });
  }
}

// 기존: 입고 창고 재고 증가
await this.upsertStock(queryRunner.manager, item.warehouseId, lot.partId, item.lotId, item.qty);
```

---

## 📝 전체 수정된 코드

```typescript
async createBulkReceive(dto: CreateBulkReceiveDto) {
  // LOT 검증
  for (const item of dto.items) {
    const lot = await this.matLotRepository.findOne({
      where: { id: item.lotId, deletedAt: IsNull() },
    });
    if (!lot) throw new NotFoundException(`LOT을 찾을 수 없습니다: ${item.lotId}`);
    if (lot.iqcStatus !== 'PASS') throw new BadRequestException(`IQC 합격되지 않은 LOT입니다: ${lot.lotNo}`);

    // 기입고수량 확인
    const receivedAgg = await this.stockTransactionRepository
      .createQueryBuilder('tx')
      .select('SUM(tx.qty)', 'sumQty')
      .where('tx.lotId = :lotId', { lotId: item.lotId })
      .andWhere('tx.transType = :transType', { transType: 'RECEIVE' })
      .andWhere('tx.status = :status', { status: 'DONE' })
      .getRawOne();

    const receivedQty = parseInt(receivedAgg?.sumQty) || 0;
    const remaining = lot.initQty - receivedQty;
    if (item.qty > remaining) {
      throw new BadRequestException(
        `입고수량(${item.qty})이 잔량(${remaining})을 초과합니다. LOT: ${lot.lotNo}`,
      );
    }
  }

  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const results = [];
    const receiveNo = `RCV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

    for (const item of dto.items) {
      const transNo = `RCV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
      const lot = await queryRunner.manager.findOne(MatLot, { where: { id: item.lotId } });
      if (!lot) continue;

      // ✅ 입하 창고 정보 조회
      const arrivalTx = await this.stockTransactionRepository.findOne({
        where: { 
          lotId: item.lotId, 
          transType: 'MAT_IN', 
          status: 'DONE' 
        },
        order: { transDate: 'DESC' }
      });
      const arrivalWarehouseId = arrivalTx?.toWarehouseId;

      if (!arrivalWarehouseId) {
        throw new BadRequestException(`LOT(${lot.lotNo})의 입하 정보를 찾을 수 없습니다.`);
      }

      // 제조일자 수정
      if (item.manufactureDate) {
        const part = await this.partMasterRepository.findOne({ where: { id: lot.partId } });
        const mfgDate = new Date(item.manufactureDate);
        let expDate: Date | null = null;
        if (part?.expiryDate && part.expiryDate > 0) {
          expDate = new Date(mfgDate);
          expDate.setDate(expDate.getDate() + part.expiryDate);
        }
        await queryRunner.manager.update(MatLot, lot.id, {
          manufactureDate: mfgDate,
          expireDate: expDate,
        });
      }

      // 1. MatReceiving 생성
      const receiving = queryRunner.manager.create(MatReceiving, {
        receiveNo,
        lotId: item.lotId,
        partId: lot.partId,
        qty: item.qty,
        warehouseCode: item.warehouseId,
        workerId: dto.workerId,
        remark: item.remark,
        status: 'DONE',
      });
      await queryRunner.manager.save(receiving);

      // 2. StockTransaction(RECEIVE) 생성 - 창고 이동으로 기록
      const stockTx = queryRunner.manager.create(StockTransaction, {
        transNo,
        transType: 'RECEIVE',
        fromWarehouseId: arrivalWarehouseId,  // ✅ 입하 창고 (출발)
        toWarehouseId: item.warehouseId,      // 입고 창고 (도착)
        partId: lot.partId,
        lotId: item.lotId,
        qty: item.qty,
        remark: item.remark,
        workerId: dto.workerId,
        refType: 'RECEIVE',
        refId: receiving.id,
      });
      await queryRunner.manager.save(stockTx);

      // ✅ 3. 입하 창고 재고 차감 (창고가 다른 경우만)
      if (arrivalWarehouseId !== item.warehouseId) {
        const arrivalStock = await queryRunner.manager.findOne(MatStock, {
          where: { 
            warehouseCode: arrivalWarehouseId, 
            partId: lot.partId, 
            lotId: item.lotId 
          }
        });

        if (arrivalStock) {
          const newQty = Math.max(0, arrivalStock.qty - item.qty);
          await queryRunner.manager.update(MatStock, arrivalStock.id, {
            qty: newQty,
            availableQty: Math.max(0, newQty - arrivalStock.reservedQty),
          });
        }
      }

      // 4. 입고 창고 재고 증가
      await this.upsertStock(queryRunner.manager, item.warehouseId, lot.partId, item.lotId, item.qty);

      results.push({ ...stockTx, receiveNo });
    }

    await queryRunner.commitTransaction();
    return results;
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw err;
  } finally {
    await queryRunner.release();
  }
}
```

---

## 🧪 테스트 케이스

### 테스트 1: 창고 변경 입고
```
[초기 상태]
- 입하: WH_ARRIVAL에 100개 입고 (MatStock: WH_ARRIVAL=100)

[동작]
- 입고 확정 시 WH_MAIN으로 100개 입고

[기대 결과]
- MatStock: WH_ARRIVAL=0, WH_MAIN=100
- StockTransaction: from=WH_ARRIVAL, to=WH_MAIN, type=RECEIVE
```

### 테스트 2: 동일 창고 입고
```
[초기 상태]
- 입하: WH_MAIN에 100개 입고

[동작]
- 입고 확정 시 WH_MAIN으로 100개 입고 (같은 창고)

[기대 결과]
- MatStock: WH_MAIN=200 (입하+입고 합산)
- 입하 창고 재고 차감 없음 (동일 창고)
```

### 테스트 3: 부분 입고
```
[초기 상태]
- 입하: WH_ARRIVAL에 100개 입고

[동작]
- 입고 확정 시 WH_MAIN으로 30개만 입고

[기대 결과]
- MatStock: WH_ARRIVAL=70, WH_MAIN=30
- 다음 입고 시 남은 70개 입고 가능
```

---

## ⚠️ 주의사항

1. **동일 창고 입고**: 입하 창고와 입고 창고가 같은 경우 차감 로직을 건너뛰어야 함 (음수 재고 방지)

2. **부분 입고 지원**: 분할 입고 시 입하 창고 재고는 해당 수량만큼만 차감

3. **취소 로직 확인**: 입고 취소(`receipt-cancel.service.ts`) 시에도 입하 창고로 복구되는지 확인 필요

4. **기존 데이터**: 이미 잘못 처리된 과거 데이터는 별도 정정 필요

---

## ✅ 완료 체크리스트

- [ ] `createBulkReceive`에서 입하 창고 ID 조회 로직 추가
- [ ] StockTransaction에 `fromWarehouseId` 설정
- [ ] 입하 창고 재고 차감 로직 추가 (다른 창고인 경우만)
- [ ] 동일 창고 입고 시 중복 차감 방지
- [ ] 테스트 케이스 3개 모두 통과
- [ ] 입고 취소 로직도 함께 확인/수정

---

## 📊 수정 후 예상 결과

| 상황 | 입하창고 | 입고창고 | 총 재고 |
|------|---------|---------|---------|
| 입하 후 | 100 | 0 | 100 |
| 입고(창고 변경) 후 | 0 | 100 | **100 (✅ 정상)** |

**결과**: 재고 중복 없이 정확한 창고 이동 처리
