import { SubprocessKittingService } from './subprocess-kitting.service';
import { FgLabel } from '../../../entities/fg-label.entity';
import { SgLabel } from '../../../entities/sg-label.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { BomMaster } from '../../../entities/bom-master.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { ProductGenealogy } from '../../../entities/product-genealogy.entity';
import { ProdResult } from '../../../entities/prod-result.entity';

describe('continuous assembly transaction (unit)', () => {
  let service: SubprocessKittingService;
  let manager: any;
  let labels: any[];
  let bom: any[];
  let confirmed: boolean;
  const dto = { fgBarcode: 'FG1', orderNo: 'JO1', processCode: 'P', equipCode: 'EQ', sgBarcodes: ['Z', 'A'] };
  beforeEach(() => {
    labels = ['Z', 'A'].map(sgBarcode => ({ sgBarcode, itemCode: 'SEMI', remainQty: 5, status: 'IN_STOCK' }));
    bom = [{ childItemCode: 'SEMI', qtyPer: 2 }];
    confirmed = false;
    manager = {
      query: jest.fn(async () => []),
      findOne: jest.fn(async (entity, options) => {
        if (entity === FgLabel) return { fgBarcode: 'FG1', orderNo: 'JO1', status: 'ISSUED' };
        if (entity === JobOrder) return { orderNo: 'JO1', itemCode: 'FG', status: 'RUNNING', planDate: new Date(), part: { itemType: 'FINISHED' } };
        if (entity === SgLabel) return labels.find(row => row.sgBarcode === options.where.sgBarcode) ?? null;
        if (entity === ProdResult) return confirmed ? { resultNo: 'PR1' } : null;
        return null;
      }),
      find: jest.fn(async entity => {
        if (entity === BomMaster) return bom;
        if (entity === ItemMaster) return [{ itemCode: 'SEMI', itemType: 'SEMI_PRODUCT' }, { itemCode: 'MISSING', itemType: 'SEMI_PRODUCT' }];
        if (entity === SgLabel) return labels;
        return [];
      }),
      save: jest.fn(async (entity, value) => { if (entity === ProdResult) confirmed = true; return value; }),
    };
    service = new SubprocessKittingService({} as any, {} as any, {} as any, {} as any,
      { run: async callback => callback({ manager }) } as any,
      { nextGenealogyIds: async (_qr, count) => Array.from({ length: count }, (_, i) => i + 1), nextProdResultNo: async () => 'PR1' } as any,
      { receiveStockInTx: jest.fn() } as any, {} as any, {} as any, {} as any,
      { syncJobOrderFromResultsInTx: jest.fn(), assertEquipInspectGate: jest.fn(async () => undefined) } as any);
  });
  it('locks SGs in sorted order but consumes BOM quantity in scan order and returns actual balances', async () => {
    const result = await service.confirmAssembly(dto, 'C', 'P');
    expect(labels.map(row => row.remainQty)).toEqual([3, 5]);
    expect(result).toEqual(expect.objectContaining({ sgLabels: expect.arrayContaining([expect.objectContaining({ sgBarcode: 'Z', remainQty: 3 })]) }));
    expect(manager.findOne.mock.calls.filter(([entity]) => entity === SgLabel).map(([, options]) => options.where.sgBarcode)).toEqual(['A', 'Z']);
    expect(manager.query).toHaveBeenCalledWith(
      'SELECT FG_BARCODE FROM FG_LABELS WHERE FG_BARCODE = :1 AND COMPANY = :2 AND PLANT_CD = :3 FOR UPDATE', ['FG1', 'C', 'P']);
    expect(manager.query.mock.calls.filter(([sql]) => sql.includes('FROM SG_LABELS')).map(([, binds]) => binds[0])).toEqual(['A', 'Z']);
    expect(manager.findOne.mock.calls.every(([, options]) => !options.lock)).toBe(true);
    expect(manager.save).toHaveBeenCalledWith(ProductGenealogy, expect.objectContaining({ childKey: 'Z', qty: 2 }));
  });
  it('refuses a missing BOM component before any writes', async () => {
    bom.push({ childItemCode: 'MISSING', qtyPer: 1 });
    await expect(service.confirmAssembly(dto, 'C', 'P')).rejects.toThrow('반제품 수량이 부족');
    expect(manager.save).not.toHaveBeenCalled();
  });
  it('refuses a duplicate FG even when no genealogy was written', async () => {
    confirmed = true;
    await expect(service.confirmAssembly(dto, 'C', 'P')).rejects.toThrow('이미 확정된 FG');
    expect(manager.save).not.toHaveBeenCalled();
  });
  it('rejects duplicate scans before writes', async () => {
    await expect(service.confirmAssembly({ ...dto, sgBarcodes: ['Z', 'Z'] }, 'C', 'P')).rejects.toThrow('중복');
    expect(manager.save).not.toHaveBeenCalled();
  });
  it('rejects the next product when latest SG balances cannot supply the BOM', async () => {
    labels = [{ sgBarcode: 'Z', itemCode: 'SEMI', remainQty: 3, status: 'IN_STOCK' }];
    await service.confirmAssembly({ ...dto, sgBarcodes: ['Z'] }, 'C', 'P');
    expect(labels[0].remainQty).toBe(1);
    confirmed = false;
    manager.save.mockClear();
    await expect(service.confirmAssembly({ ...dto, sgBarcodes: ['Z'] }, 'C', 'P')).rejects.toThrow('반제품 수량이 부족');
    expect(manager.save).not.toHaveBeenCalled();
    expect(labels[0].remainQty).toBe(1);
  });
  it('rejects an out-of-BOM label without consuming any quantity', async () => {
    labels[0].itemCode = 'OTHER';
    await expect(service.confirmAssembly(dto, 'C', 'P')).rejects.toThrow('오투입');
    expect(manager.save).not.toHaveBeenCalled();
  });
  it('subkit locks output and inputs together in the same global SG order', async () => {
    labels.push({ sgBarcode: 'M', status: 'ISSUED', orderNo: 'JO1' });
    // The fixture is a FINISHED job: stop after locks and inspect their sequence.
    await expect(service.confirmSubKit({ newSgBarcode: 'M', orderNo: 'JO1', processCode: 'P', inputSgBarcodes: ['Z', 'A'] }, 'C', 'P')).rejects.toThrow('반제품 작업지시');
    const locks = manager.query.mock.calls.filter(([sql]) => sql.includes('FROM SG_LABELS'));
    expect(locks.map(([, binds]) => binds[0])).toEqual(['A', 'M', 'Z']);
    expect(locks.every(([sql, binds]) => sql.endsWith('FOR UPDATE') && binds[1] === 'C' && binds[2] === 'P')).toBe(true);
    expect(manager.save).not.toHaveBeenCalled();
  });
});
