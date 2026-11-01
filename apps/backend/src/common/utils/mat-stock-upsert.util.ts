/**
 * @file common/utils/mat-stock-upsert.util.ts
 * @description MAT_STOCKS 행에 수량을 더하되, 행이 없으면 넣는다 — 동시 호출에도 중복·유니크 오류가 나지 않게
 *
 * 초보자 가이드:
 * 1. 예전 방식은 "행이 있나 find → 있으면 UPDATE, 없으면 INSERT" 라서, 같은 LOT·창고로 동시에 들어오면
 *    둘 다 "없음"으로 보고 INSERT 해 ORA-00001(유니크 위반)이 났다.
 * 2. 여기서는 먼저 상대 UPDATE(`QTY = QTY + n`)를 하고, 0행이면 INSERT 한다.
 *    INSERT 가 유니크 위반이면 그 사이 다른 호출이 넣은 것이므로 UPDATE 를 한 번 더 한다.
 *    (Oracle 은 문장 하나가 실패해도 트랜잭션이 이어진다.)
 * 3. 더하기(delta > 0) 전용이다. 차감은 호출 측에서 `"QTY" >= :n` 조건을 붙여 따로 처리한다.
 */
import { EntityManager, IsNull } from 'typeorm';
import { MatStock } from '../../entities/mat-stock.entity';

export interface MatStockKey {
  warehouseCode: string;
  itemCode: string;
  matUid: string | null | undefined;
  company?: string | null;
  plant?: string | null;
}

export interface AddMatStockOptions {
  /** UPDATE 시 함께 바꿀 컬럼 (예: 적재 로케이션) */
  locationCode?: string | null;
  /** INSERT 시 회사·사업장 (조건용 key 가 비어 있어도 새 행에는 값이 필요할 때) */
  insertCompany?: string | null;
  insertPlant?: string | null;
}

/** ORA-00001 (유니크 제약 위반) 여부 */
export function isUniqueViolation(error: unknown): boolean {
  if ((typeof error !== 'object' && typeof error !== 'function') || error === null) return false;
  return Reflect.get(error, 'errorNum') === 1
    || Reflect.get(error, 'code') === 'ORA-00001'
    || (error instanceof Error && error.message.includes('ORA-00001'));
}

/**
 * 재고 행에 `delta`(양수)를 더한다. 행이 없으면 새로 넣는다.
 * @returns 'UPDATED' 기존 행에 더함 / 'INSERTED' 새 행을 넣음
 */
export async function addMatStockQty(
  manager: EntityManager,
  key: MatStockKey,
  delta: number,
  options: AddMatStockOptions = {},
): Promise<'UPDATED' | 'INSERTED'> {
  if (!(delta > 0)) throw new Error(`addMatStockQty 는 양수만 더할 수 있습니다: ${delta}`);

  const addToExisting = async (): Promise<number> => {
    const result = await manager.createQueryBuilder().update(MatStock)
      .set({
        qty: () => '"QTY" + :stockDelta',
        availableQty: () => '"AVAILABLE_QTY" + :stockDelta',
        ...(options.locationCode ? { locationCode: options.locationCode } : {}),
      })
      .where({
        warehouseCode: key.warehouseCode,
        itemCode: key.itemCode,
        matUid: key.matUid ?? IsNull(),
        ...(key.company ? { company: key.company } : {}),
        ...(key.plant ? { plant: key.plant } : {}),
      })
      .setParameters({ stockDelta: delta })
      .execute();
    return result.affected ?? 0;
  };

  if ((await addToExisting()) > 0) return 'UPDATED';

  try {
    await manager.insert(MatStock, {
      warehouseCode: key.warehouseCode,
      itemCode: key.itemCode,
      matUid: key.matUid ?? undefined,
      qty: delta,
      availableQty: delta,
      reservedQty: 0,
      ...(options.locationCode ? { locationCode: options.locationCode } : {}),
      company: (key.company ?? options.insertCompany) ?? undefined,
      plant: (key.plant ?? options.insertPlant) ?? undefined,
    });
    return 'INSERTED';
  } catch (error: unknown) {
    if (!isUniqueViolation(error)) throw error;
    // 동시에 같은 행을 넣은 호출이 먼저 커밋/대기 중 — 그 행에 더한다
    if ((await addToExisting()) > 0) return 'UPDATED';
    throw error;
  }
}
