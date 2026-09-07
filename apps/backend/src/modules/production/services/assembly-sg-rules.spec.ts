import { planAssemblySgConsumption } from '@harness/shared';

describe('assembly SG quantity plan', () => {
  const label = (sgBarcode: string, itemCode: string, remainQty: number, status = 'IN_STOCK') => ({ sgBarcode, itemCode, remainQty, status });
  it('aggregates BOM quantity and allocates only required amounts in scan order', () => {
    expect(planAssemblySgConsumption([{ itemCode: 'A', qtyPer: 2 }, { itemCode: 'A', qtyPer: 1 }], [label('Z', 'A', 2), label('A', 'A', 5)]))
      .toEqual({ allocations: [{ sgBarcode: 'Z', qty: 2 }, { sgBarcode: 'A', qty: 1 }], shortages: [] });
  });
  it('reports a missing component and excludes unusable labels', () => {
    expect(planAssemblySgConsumption([{ itemCode: 'A', qtyPer: 2 }, { itemCode: 'B', qtyPer: 1 }], [label('A', 'A', 1), label('B', 'A', 9, 'DEFECT')]).shortages)
      .toEqual([{ itemCode: 'A', requiredQty: 2, availableQty: 1 }, { itemCode: 'B', requiredQty: 1, availableQty: 0 }]);
  });
  it('does not double count duplicate scans', () => {
    expect(planAssemblySgConsumption([{ itemCode: 'A', qtyPer: 2 }], [label('A', 'A', 1), label('A', 'A', 1)]).shortages).toHaveLength(1);
  });
});
