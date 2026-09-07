import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { QueryRunner, DataSource } from 'typeorm';
import { ProductInventoryService } from '../../inventory/services/product-inventory.service';
import { MatIssueService } from '../../material/services/mat-issue.service';
import { RepairOrder } from '../../../entities/repair-order.entity';
import { RepairUsedPart } from '../../../entities/repair-used-part.entity';
import { ProductTransaction } from '../../../entities/product-transaction.entity';
import { ProductStock } from '../../../entities/product-stock.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { TransactionService } from '../../../shared/transaction.service';
import { RepairStockService } from './repair-stock.service';

describe('RepairStockService', () => {
  let qr: DeepMocked<QueryRunner>;
  let product: DeepMocked<ProductInventoryService>;
  let material: DeepMocked<MatIssueService>;
  let service: RepairStockService;
  let movements: Partial<ProductTransaction>[];
  let parts: Partial<RepairUsedPart>[];
  let stock: Partial<ProductStock>;
  let warehouse: Partial<Warehouse>;
  let lot: Partial<MatLot>;
  let materialItem: Partial<ItemMaster>;
  const order = {
    repairDate: new Date('2026-09-05'), seq: 71, company: 'C', plant: 'P',
    itemCode: 'FG', qty: 2, workerId: 'W', returnProcess: 'INSPECT', disposition: 'RETURN',
  } as RepairOrder;
  const allocation = { itemCode: 'RAW', matUid: 'LOT1', warehouseCode: 'RAW_WH', qty: 3 };
  const origin = () => ({
    transNo: 'PTX1', transType: 'FG_OUT', itemCode: 'FG', itemType: 'FINISHED',
    company: 'C', plant: 'P', qualityStatus: 'DEFECT', qty: -2,
    fromWarehouseId: 'DEFECT', toWarehouseId: null, refType: 'REPAIR', refId: '71', status: 'DONE',
  });

  beforeEach(() => {
    qr = createMock<QueryRunner>();
    product = createMock<ProductInventoryService>();
    material = createMock<MatIssueService>();
    service = new RepairStockService(product, material);
    movements = [];
    parts = [];
    stock = { itemType: 'FINISHED', qty: 4, availableQty: 4, status: 'NORMAL' };
    warehouse = { warehouseType: 'WIP', useYn: 'Y' };
    lot = { itemCode: 'RAW', matUid: 'LOT1', company: 'C', plant: 'P' };
    materialItem = { itemCode: 'RAW', itemType: 'RAW_MATERIAL', useYn: 'Y' };
    qr.manager.find.mockImplementation(async (entity: any) => {
      if (entity === ProductTransaction) return movements as any;
      if (entity === RepairUsedPart) return parts as any;
      return [];
    });
    qr.manager.findOne.mockImplementation(async (entity: any, options: any) => {
      if (entity === Warehouse) return warehouse as any;
      if (entity === ItemMaster) return (options.where.itemCode === 'FG'
        ? { itemCode: 'FG', itemType: 'FINISHED', useYn: 'Y' } : materialItem) as any;
      if (entity === ProductStock) return stock as any;
      if (entity === MatLot) return lot as any;
      return null;
    });
  });

  it('takes exactly the repair quantity from tenant DEFECT stock within the caller transaction', async () => {
    await service.startInTx(qr, order, 'DEFECT');
    expect(qr.manager.findOne).toHaveBeenCalledWith(ProductStock, expect.objectContaining({
      where: { warehouseCode: 'DEFECT', itemCode: 'FG', qualityStatus: 'DEFECT', company: 'C', plant: 'P' },
    }));
    expect(product.issueStockInTx).toHaveBeenCalledWith(qr, expect.objectContaining({
      qty: 2, qualityStatus: 'DEFECT', warehouseId: 'DEFECT', transType: 'FG_OUT', refType: 'REPAIR', refId: '71', company: 'C', plant: 'P',
    }));
    expect(product.receiveStockInTx).not.toHaveBeenCalled();
  });

  it('takes a validated visual-fail FG label from GOOD stock because visual inspection does not reclassify stock', async () => {
    const fgOrder = { ...order, fgBarcode: 'FG001', prdUid: 'FG001', qty: 1 };
    await service.startInTx(qr, fgOrder, 'FG_WIP');
    expect(product.issueStockInTx).toHaveBeenCalledWith(qr, expect.objectContaining({
      warehouseId: 'FG_WIP', qualityStatus: 'GOOD', qty: 1, prdUid: 'FG001',
    }));
    movements = [{ ...origin(), qty: -1, qualityStatus: 'GOOD' }];
    await expect(service.assertStartedInTx(qr, fgOrder)).resolves.toBeUndefined();
  });

  it('rejects duplicate starts without consuming more stock', async () => {
    movements = [origin()];
    await expect(service.startInTx(qr, order, 'DEFECT')).rejects.toThrow();
    expect(product.issueStockInTx).not.toHaveBeenCalled();
  });

  it.each(['HOLD', 'insufficient'])('rejects unavailable source stock: %s', async (reason) => {
    if (reason === 'HOLD') stock.status = 'HOLD';
    else stock.availableQty = 1;
    await expect(service.startInTx(qr, order, 'DEFECT')).rejects.toThrow();
    expect(product.issueStockInTx).not.toHaveBeenCalled();
  });

  it('refuses legacy repairs lacking a matching start movement', async () => {
    await expect(service.finishInTx(qr, order, 'FG_WIP', [])).rejects.toThrow();
    movements = [{ ...origin(), qty: -1 }];
    await expect(service.finishInTx(qr, order, 'FG_WIP', [])).rejects.toThrow();
    expect(product.receiveStockInTx).not.toHaveBeenCalled();
  });

  it('requires the same unreversed custody evidence before entering reinspection', async () => {
    await expect(service.assertStartedInTx(qr, order)).rejects.toThrow();
    movements = [origin()];
    await expect(service.assertStartedInTx(qr, order)).resolves.toBeUndefined();
    movements = [{ ...origin(), status: 'CANCELED' }];
    await expect(service.assertStartedInTx(qr, order)).rejects.toThrow();
    expect(product.issueStockInTx).not.toHaveBeenCalled();
    expect(product.receiveStockInTx).not.toHaveBeenCalled();
  });

  it('returns repaired products once as GOOD and keeps the source defect movement', async () => {
    movements = [origin()];
    await service.finishInTx(qr, order, 'FG_WIP', []);
    expect(product.receiveStockInTx).toHaveBeenCalledWith(qr, expect.objectContaining({
      qty: 2, qualityStatus: 'GOOD', transType: 'FG_IN', warehouseId: 'FG_WIP', processCode: 'INSPECT', refId: '71', company: 'C', plant: 'P',
    }));
    expect(product.issueStockInTx).not.toHaveBeenCalled();
  });

  it('rejects repeated GOOD receipts', async () => {
    movements = [origin(), { ...origin(), transType: 'FG_IN', qualityStatus: 'GOOD', qty: 2 }];
    await expect(service.finishInTx(qr, order, 'FG_WIP', [])).rejects.toThrow();
    expect(product.receiveStockInTx).not.toHaveBeenCalled();
  });

  it('requires active WIP or FG destination for GOOD return', async () => {
    movements = [origin()];
    warehouse.warehouseType = 'SCRAP';
    await expect(service.finishInTx(qr, order, 'SCRAP', [])).rejects.toThrow();
    warehouse = { warehouseType: 'WIP', useYn: 'N' };
    await expect(service.finishInTx(qr, order, 'FG_WIP', [])).rejects.toThrow();
    expect(product.receiveStockInTx).not.toHaveBeenCalled();
  });

  it('rejects allocation totals that do not match the saved repair parts', async () => {
    movements = [origin()];
    parts = [{ itemCode: 'RAW', qty: 4 }];
    await expect(service.finishInTx(qr, order, 'FG_WIP', [allocation])).rejects.toThrow();
    expect(material.createInTx).not.toHaveBeenCalled();
  });

  it('rejects a LOT for another item and duplicate allocation rows', async () => {
    movements = [origin()];
    parts = [{ itemCode: 'RAW', qty: 3 }];
    lot.itemCode = 'OTHER';
    await expect(service.finishInTx(qr, order, 'FG_WIP', [allocation])).rejects.toThrow();
    parts = [{ itemCode: 'RAW', qty: 6 }];
    await expect(service.finishInTx(qr, order, 'FG_WIP', [allocation, allocation])).rejects.toThrow();
    expect(material.createInTx).not.toHaveBeenCalled();
  });

  it('rejects inactive or non-material parts submitted directly to the API', async () => {
    movements = [origin()];
    parts = [{ itemCode: 'RAW', qty: 3 }];
    materialItem.itemType = 'FINISHED';
    await expect(service.finishInTx(qr, order, 'FG_WIP', [allocation])).rejects.toThrow();
    materialItem.itemType = 'RAW_MATERIAL';
    materialItem.useYn = 'N';
    await expect(service.finishInTx(qr, order, 'FG_WIP', [allocation])).rejects.toThrow();
    expect(material.createInTx).not.toHaveBeenCalled();
  });

  it('rejects invalid quantities and cross-tenant origin evidence before changing stock', async () => {
    await expect(service.startInTx(qr, { ...order, qty: 0 }, 'DEFECT')).rejects.toThrow();
    await expect(service.startInTx(qr, { ...order, company: '' }, 'DEFECT')).rejects.toThrow();
    movements = [{ ...origin(), plant: 'OTHER' }];
    await expect(service.finishInTx(qr, order, 'FG_WIP', [])).rejects.toThrow();
    expect(product.issueStockInTx).not.toHaveBeenCalled();
    expect(product.receiveStockInTx).not.toHaveBeenCalled();
  });

  it('consumes IQC-checked raw material through the existing issue service with a locked LOT', async () => {
    movements = [origin()];
    parts = [{ itemCode: 'RAW', qty: 3 }];
    await service.finishInTx(qr, order, 'FG_WIP', [allocation]);
    expect(qr.manager.findOne).toHaveBeenCalledWith(MatLot, {
      where: { matUid: 'LOT1', company: 'C', plant: 'P' }, lock: { mode: 'pessimistic_write' },
    });
    expect(material.createInTx).toHaveBeenCalledWith(qr, {
      warehouseCode: 'RAW_WH', issueType: 'REPAIR', items: [{ matUid: 'LOT1', issueQty: 3 }], workerId: 'W', remark: 'REPAIR:71',
    }, 'C', 'P');
  });

  it('scrap consumes used material but does not recreate usable product stock', async () => {
    movements = [origin()];
    parts = [{ itemCode: 'RAW', qty: 3 }];
    await service.finishInTx(qr, { ...order, disposition: 'SCRAP' }, undefined, [allocation]);
    expect(material.createInTx).toHaveBeenCalledTimes(1);
    expect(product.receiveStockInTx).not.toHaveBeenCalled();
    expect(product.issueStockInTx).not.toHaveBeenCalled();
  });

  it('propagates material errors so the owner transaction rolls back and does not return GOOD stock', async () => {
    movements = [origin()];
    parts = [{ itemCode: 'RAW', qty: 3 }];
    material.createInTx.mockRejectedValue(new Error('IQC FAIL'));
    const ds = createMock<DataSource>();
    ds.createQueryRunner.mockReturnValue(qr);
    await expect(new TransactionService(ds).run((runner) => service.finishInTx(runner, order, 'FG_WIP', [allocation]))).rejects.toThrow('IQC FAIL');
    expect(qr.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(qr.commitTransaction).not.toHaveBeenCalled();
    expect(product.receiveStockInTx).not.toHaveBeenCalled();
  });

  it('rolls back material consumption when GOOD return fails', async () => {
    movements = [origin()];
    parts = [{ itemCode: 'RAW', qty: 3 }];
    product.receiveStockInTx.mockRejectedValue(new Error('receipt failed'));
    const ds = createMock<DataSource>();
    ds.createQueryRunner.mockReturnValue(qr);
    await expect(new TransactionService(ds).run((runner) => service.finishInTx(runner, order, 'FG_WIP', [allocation]))).rejects.toThrow('receipt failed');
    expect(material.createInTx).toHaveBeenCalledWith(qr, expect.any(Object), 'C', 'P');
    expect(qr.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(qr.commitTransaction).not.toHaveBeenCalled();
  });
});
