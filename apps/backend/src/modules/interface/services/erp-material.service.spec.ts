import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';

import { ErpMaterialService } from './erp-material.service';
import { InterLog } from '../../../entities/inter-log.entity';
import { PurchaseOrder } from '../../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../../entities/purchase-order-item.entity';
import { SysConfigService } from '../../system/services/sys-config.service';
import { TransactionService } from '../../../shared/transaction.service';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('ErpMaterialService', () => {
  let target: ErpMaterialService;
  let interLogRepo: DeepMocked<Repository<InterLog>>;
  let dataSource: DeepMocked<DataSource>;
  let tx: DeepMocked<TransactionService>;
  let queryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    interLogRepo = createMock<Repository<InterLog>>();
    dataSource = createMock<DataSource>();
    tx = createMock<TransactionService>();
    queryRunner = createMock<QueryRunner>();

    dataSource.query.mockResolvedValue([{ nextSeq: 1 }]);
    tx.run.mockImplementation(async (callback) => callback(queryRunner));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ErpMaterialService,
        { provide: getRepositoryToken(InterLog), useValue: interLogRepo },
        { provide: getRepositoryToken(PurchaseOrder), useValue: createMock<Repository<PurchaseOrder>>() },
        { provide: getRepositoryToken(PurchaseOrderItem), useValue: createMock<Repository<PurchaseOrderItem>>() },
        { provide: DataSource, useValue: dataSource },
        { provide: SysConfigService, useValue: createMock<SysConfigService>() },
        { provide: TransactionService, useValue: tx },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<ErpMaterialService>(ErpMaterialService);
  });

  it('imports purchase orders through TransactionService', async () => {
    queryRunner.manager.findOne.mockResolvedValue(null);
    queryRunner.manager.create.mockImplementation((_entity, payload) => payload as any);
    queryRunner.manager.save.mockImplementation(async (payload) => payload as any);
    queryRunner.manager.find.mockResolvedValue([]);
    interLogRepo.save.mockResolvedValue({} as InterLog);

    const result = await target.importPurchaseOrder({
      poNo: 'PO-1',
      orderDate: '2026-05-23',
      partnerId: 'V-1',
      partnerName: 'Vendor',
      items: [
        { seq: 1, itemCode: 'RM-1', itemName: 'Raw', orderQty: 10, unit: 'EA' },
      ],
      company: 'C1',
      plant: 'P1',
    });

    expect(result).toEqual({ success: true, poNo: 'PO-1' });
    expect(tx.run).toHaveBeenCalledTimes(1);
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(queryRunner.connect).not.toHaveBeenCalled();
    expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).not.toHaveBeenCalled();
  });

  it('upserts purchase orders and items within the ERP tenant scope', async () => {
    queryRunner.manager.findOne.mockResolvedValue({ poNo: 'PO-1', company: 'C1', plant: 'P1' } as PurchaseOrder);
    queryRunner.manager.find.mockResolvedValue([
      { poNo: 'PO-1', seq: 1, itemCode: 'RM-1', orderQty: 5, receivedQty: 0, company: 'C1', plant: 'P1' } as PurchaseOrderItem,
    ]);
    interLogRepo.save.mockResolvedValue({} as InterLog);

    await target.importPurchaseOrder({
      poNo: 'PO-1',
      orderDate: '2026-05-23',
      partnerId: 'V-1',
      partnerName: 'Vendor',
      items: [
        { seq: 1, itemCode: 'RM-1', itemName: 'Raw', orderQty: 10, unit: 'EA' },
      ],
      company: 'C1',
      plant: 'P1',
    });

    expect(queryRunner.manager.findOne).toHaveBeenCalledWith(PurchaseOrder, {
      where: { poNo: 'PO-1', company: 'C1', plant: 'P1' },
    });
    expect(queryRunner.manager.update).toHaveBeenCalledWith(
      PurchaseOrder,
      { poNo: 'PO-1', company: 'C1', plant: 'P1' },
      expect.objectContaining({ partnerId: 'V-1', partnerName: 'Vendor' }),
    );
    expect(queryRunner.manager.find).toHaveBeenCalledWith(PurchaseOrderItem, {
      where: { poNo: 'PO-1', company: 'C1', plant: 'P1' },
    });
    expect(queryRunner.manager.update).toHaveBeenCalledWith(
      PurchaseOrderItem,
      { poNo: 'PO-1', seq: 1, company: 'C1', plant: 'P1' },
      { orderQty: 10 },
    );
  });
});
