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
import { MockLoggerService } from '@test/mock-logger.service';

describe('ErpMaterialService', () => {
  let target: ErpMaterialService;
  let interLogRepo: DeepMocked<Repository<InterLog>>;
  let dataSource: DeepMocked<DataSource>;
  let sysConfig: DeepMocked<SysConfigService>;
  let tx: DeepMocked<TransactionService>;
  let queryRunner: DeepMocked<QueryRunner>;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    interLogRepo = createMock<Repository<InterLog>>();
    dataSource = createMock<DataSource>();
    sysConfig = createMock<SysConfigService>();
    tx = createMock<TransactionService>();
    queryRunner = createMock<QueryRunner>();

    dataSource.query.mockResolvedValue([{ nextSeq: 1 }]);
    sysConfig.getValue.mockImplementation(async (key: string) => {
      if (key === 'ERP_EXPORT_ENABLED') return 'N';
      return undefined;
    });
    tx.run.mockImplementation(async (callback) => callback(queryRunner));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ErpMaterialService,
        { provide: getRepositoryToken(InterLog), useValue: interLogRepo },
        { provide: getRepositoryToken(PurchaseOrder), useValue: createMock<Repository<PurchaseOrder>>() },
        { provide: getRepositoryToken(PurchaseOrderItem), useValue: createMock<Repository<PurchaseOrderItem>>() },
        { provide: DataSource, useValue: dataSource },
        { provide: SysConfigService, useValue: sysConfig },
        { provide: TransactionService, useValue: tx },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<ErpMaterialService>(ErpMaterialService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
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
      partnerCode: 'V-1',
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
      partnerCode: 'V-1',
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
      expect.objectContaining({ partnerCode: 'V-1', partnerName: 'Vendor' }),
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

  it('writes interface logs with the same tenant as the imported purchase order', async () => {
    queryRunner.manager.findOne.mockResolvedValue(null);
    queryRunner.manager.create.mockImplementation((_entity, payload) => payload as any);
    queryRunner.manager.save.mockImplementation(async (payload) => payload as any);
    queryRunner.manager.find.mockResolvedValue([]);
    interLogRepo.save.mockResolvedValue({} as InterLog);

    await target.importPurchaseOrder({
      poNo: 'PO-1',
      orderDate: '2026-05-23',
      partnerCode: 'V-1',
      partnerName: 'Vendor',
      items: [
        { seq: 1, itemCode: 'RM-1', itemName: 'Raw', orderQty: 10, unit: 'EA' },
      ],
      company: 'C1',
      plant: 'P1',
    });

    expect(interLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ company: 'C1', plant: 'P1' }),
    );
  });

  it('allocates inbound INTER_LOGS seq from Oracle sequence', async () => {
    queryRunner.manager.findOne.mockResolvedValue(null);
    queryRunner.manager.create.mockImplementation((_entity, payload) => payload as any);
    queryRunner.manager.save.mockImplementation(async (payload) => payload as any);
    queryRunner.manager.find.mockResolvedValue([]);
    interLogRepo.save.mockResolvedValue({} as InterLog);

    await target.importPurchaseOrder({
      poNo: 'PO-1',
      orderDate: '2026-05-23',
      partnerCode: 'V-1',
      partnerName: 'Vendor',
      items: [],
      company: 'C1',
      plant: 'P1',
    });

    expect(dataSource.query).toHaveBeenCalledWith(
      'SELECT SEQ_INTER_LOGS.NEXTVAL AS "nextSeq" FROM DUAL',
    );
  });

  it('writes outbound interface logs with the requested tenant', async () => {
    sysConfig.getValue.mockImplementation(async (key: string) => {
      if (key === 'ERP_EXPORT_ENABLED') return 'Y';
      if (key === 'ERP_API_URL') return 'https://erp.example.test/interface';
      return undefined;
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(''),
    } as any);
    interLogRepo.save.mockResolvedValue({} as InterLog);

    await target.exportReceiving('RCV-1', 'RM-1', 5, 'PO-1', 'C1', 'P1');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://erp.example.test/interface',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(interLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'OUTBOUND',
        messageType: 'ERP_RECEIVING',
        company: 'C1',
        plant: 'P1',
      }),
    );
  });

  it('allocates outbound INTER_LOGS seq from Oracle sequence', async () => {
    sysConfig.getValue.mockImplementation(async (key: string) => {
      if (key === 'ERP_EXPORT_ENABLED') return 'Y';
      if (key === 'ERP_API_URL') return 'https://erp.example.test/interface';
      return undefined;
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(''),
    } as any);
    interLogRepo.save.mockResolvedValue({} as InterLog);

    await target.exportReceiving('RCV-1', 'RM-1', 5, 'PO-1', 'C1', 'P1');

    expect(dataSource.query).toHaveBeenCalledWith(
      'SELECT SEQ_INTER_LOGS.NEXTVAL AS "nextSeq" FROM DUAL',
    );
  });

  it('marks outbound export failed when ERP export is enabled but endpoint is missing', async () => {
    sysConfig.getValue.mockImplementation(async (key: string) => {
      if (key === 'ERP_EXPORT_ENABLED') return 'Y';
      if (key === 'ERP_API_URL') return '';
      return undefined;
    });
    interLogRepo.save.mockResolvedValue({} as InterLog);

    const result = await target.exportReceiving('RCV-1', 'RM-1', 5, 'PO-1', 'C1', 'P1');

    expect(result).toEqual(expect.objectContaining({
      success: false,
      refNo: 'RCV-1',
      error: expect.stringContaining('ERP_API_URL'),
    }));
    expect(interLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'OUTBOUND',
        messageType: 'ERP_RECEIVING',
        status: 'FAILED',
        interfaceId: 'RCV-1',
        errorMsg: expect.stringContaining('ERP_API_URL'),
        company: 'C1',
        plant: 'P1',
      }),
    );
  });

  it('retries only failed outbound logs in the requested tenant', async () => {
    const transDate = new Date('2026-05-23');
    interLogRepo.find.mockResolvedValue([
      {
        transDate,
        seq: 1,
        status: 'FAILED',
        direction: 'OUTBOUND',
        messageType: 'ERP_RECEIVING',
        interfaceId: 'RCV-1',
        retryCount: 0,
        payload: '{}',
        company: 'C1',
        plant: 'P1',
      } as InterLog,
    ]);
    interLogRepo.update.mockResolvedValue({ affected: 1 } as any);
    sysConfig.getValue.mockResolvedValue('https://erp.example.test/interface');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(''),
    } as any);

    await target.retryFailed('C1', 'P1');

    expect(interLogRepo.find).toHaveBeenCalledWith({
      where: { status: 'FAILED', direction: 'OUTBOUND', company: 'C1', plant: 'P1' },
      order: { transDate: 'ASC' },
    });
    expect(interLogRepo.update).toHaveBeenCalledWith(
      { transDate, seq: 1, company: 'C1', plant: 'P1' },
      expect.objectContaining({ status: 'SUCCESS', retryCount: 1 }),
    );
  });

  it('queries today stats within requested tenant', async () => {
    dataSource.query.mockResolvedValue([{ STATUS: 'SUCCESS', cnt: 2 }]);

    await target.getTodayStats('C1', 'P1');

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('"COMPANY" = :2'),
      expect.arrayContaining([expect.any(String), 'C1', 'P1']),
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('"PLANT_CD" = :3'),
      expect.any(Array),
    );
  });
});
