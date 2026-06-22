import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { ShipmentService } from './shipment.service';
import { ShipmentLog } from '../../../entities/shipment-log.entity';
import { PalletMaster } from '../../../entities/pallet-master.entity';
import { BoxMaster } from '../../../entities/box-master.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { ProductTransaction } from '../../../entities/product-transaction.entity';
import { ProductInventoryService } from '../../inventory/services/product-inventory.service';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';
import { SysConfigService } from '../../system/services/sys-config.service';

describe('ShipmentService', () => {
  let target: ShipmentService;
  let mockShipmentRepo: DeepMocked<Repository<ShipmentLog>>;
  let mockPalletRepo: DeepMocked<Repository<PalletMaster>>;
  let mockBoxRepo: DeepMocked<Repository<BoxMaster>>;
  let mockFgLabelRepo: DeepMocked<Repository<FgLabel>>;
  let mockProductInventoryService: DeepMocked<ProductInventoryService>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockTx: DeepMocked<TransactionService>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockShipmentRepo = createMock<Repository<ShipmentLog>>();
    mockPalletRepo = createMock<Repository<PalletMaster>>();
    mockBoxRepo = createMock<Repository<BoxMaster>>();
    mockFgLabelRepo = createMock<Repository<FgLabel>>();
    mockProductInventoryService = createMock<ProductInventoryService>();
    mockDataSource = createMock<DataSource>();
    mockTx = createMock<TransactionService>();
    mockQueryRunner = createMock<QueryRunner>();

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockTx.run.mockImplementation(async (callback) => callback(mockQueryRunner));
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentService,
        { provide: getRepositoryToken(ShipmentLog), useValue: mockShipmentRepo },
        { provide: getRepositoryToken(PalletMaster), useValue: mockPalletRepo },
        { provide: getRepositoryToken(BoxMaster), useValue: mockBoxRepo },
        { provide: getRepositoryToken(FgLabel), useValue: mockFgLabelRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
        { provide: ProductInventoryService, useValue: mockProductInventoryService },
        { provide: SysConfigService, useValue: { isEnabled: jest.fn().mockResolvedValue(true) } },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get(ShipmentService);
  });

  afterEach(() => jest.clearAllMocks());

  it('markAsShipped issues aggregate FG stock and marks labels shipped', async () => {
    mockShipmentRepo.findOne.mockResolvedValue({
      shipNo: 'SHIP-001',
      status: 'LOADED',
      company: 'HANES',
      plant: 'P01',
    } as ShipmentLog);
    mockPalletRepo.find.mockResolvedValue([{ palletNo: 'PALLET-001' } as PalletMaster]);
    mockBoxRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    } as any);
    mockBoxRepo.find.mockResolvedValue([
      { boxNo: 'BOX-001', itemCode: 'ITEM-001', qty: 2, serialList: JSON.stringify(['FG-001', 'FG-002']) } as BoxMaster,
    ]);

    const fgLabelRepo = { find: jest.fn().mockResolvedValue([
      { fgBarcode: 'FG-001', itemCode: 'ITEM-001' } as FgLabel,
      { fgBarcode: 'FG-002', itemCode: 'ITEM-001' } as FgLabel,
    ]) };
    (mockQueryRunner as any).manager = {
      update: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn((entity) => {
        if (entity === Warehouse) return { warehouseCode: 'FG-WH' };
        return null;
      }),
      getRepository: jest.fn((entity) => {
        if (entity === FgLabel) return fgLabelRepo;
        throw new Error('unexpected repository');
      }),
    };

    await target.markAsShipped('SHIP-001');

    expect((mockQueryRunner as any).manager.update).toHaveBeenCalledWith(
      FgLabel,
      expect.objectContaining({ fgBarcode: expect.anything() }),
      { status: 'SHIPPED' },
    );
    expect(mockProductInventoryService.issueStockByItemFifoInTx).toHaveBeenCalledTimes(1);
    expect(mockProductInventoryService.issueStockByItemFifoInTx).toHaveBeenCalledWith(
      mockQueryRunner,
      expect.objectContaining({ warehouseId: 'FG-WH', itemCode: 'ITEM-001', qty: 2 }),
    );
    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(mockQueryRunner.release).not.toHaveBeenCalled();
  });

  it('markAsShipped blocks boxes without OQC pass', async () => {
    mockShipmentRepo.findOne.mockResolvedValue({
      shipNo: 'SHIP-001',
      status: 'LOADED',
      company: 'HANES',
      plant: 'P01',
    } as ShipmentLog);
    mockPalletRepo.find.mockResolvedValue([{ palletNo: 'PALLET-001' } as PalletMaster]);
    mockBoxRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ boxNo: 'BOX-001', oqcStatus: null }]),
    } as any);

    await expect(target.markAsShipped('SHIP-001')).rejects.toThrow(BadRequestException);
    expect(mockProductInventoryService.issueStockByItemFifoInTx).not.toHaveBeenCalled();
    expect(mockTx.run).not.toHaveBeenCalled();
  });

  it('reverseShipment restores statuses and cancels FG_OUT transactions', async () => {
    mockShipmentRepo.findOne
      .mockResolvedValueOnce({
        shipNo: 'SHIP-001',
        status: 'SHIPPED',
        company: 'HANES',
        plant: 'P01',
      } as ShipmentLog)
      .mockResolvedValueOnce({
        shipNo: 'SHIP-001',
        status: 'LOADED',
      } as ShipmentLog);

    const transactions = [
      { transNo: 'PTX-001', refType: 'SHIPMENT', refId: 'SHIP-001', status: 'DONE' },
      { transNo: 'PTX-002', refType: 'SHIPMENT', refId: 'SHIP-001', status: 'DONE' },
    ];

    (mockQueryRunner as any).manager = {
      update: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockImplementation((entity: unknown) => {
        if (entity === PalletMaster) return Promise.resolve([{ palletNo: 'PALLET-001' }]);
        if (entity === BoxMaster) return Promise.resolve([
          { boxNo: 'BOX-001', itemCode: 'ITEM-001', qty: 2, serialList: JSON.stringify(['FG-001', 'FG-002']) },
        ]);
        if (entity === ProductTransaction) return Promise.resolve(transactions);
        return Promise.resolve([]);
      }),
    };

    await target.reverseShipment('SHIP-001', 'rollback');

    expect(mockProductInventoryService.cancelTransactionInTx).toHaveBeenCalledTimes(2);
    expect(mockProductInventoryService.cancelTransactionInTx).toHaveBeenNthCalledWith(
      1,
      mockQueryRunner,
      expect.objectContaining({ transNo: 'PTX-001' }),
      expect.objectContaining({ transactionId: 'PTX-001' }),
    );
    expect(mockProductInventoryService.cancelTransactionInTx).toHaveBeenNthCalledWith(
      2,
      mockQueryRunner,
      expect.objectContaining({ transNo: 'PTX-002' }),
      expect.objectContaining({ transactionId: 'PTX-002' }),
    );
    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(mockQueryRunner.release).not.toHaveBeenCalled();
  });

  it('reverseShipment blocks when ERP sync has already completed', async () => {
    mockShipmentRepo.findOne.mockResolvedValue({
      shipNo: 'SHIP-009',
      status: 'SHIPPED',
      erpSyncYn: 'Y',
    } as ShipmentLog);

    await expect(target.reverseShipment('SHIP-009', 'rollback')).rejects.toThrow(
      'ERP 연동분부터 먼저 정리한 뒤 출하 역분개를 진행해 주세요.',
    );
    expect(mockProductInventoryService.cancelTransaction).not.toHaveBeenCalled();
  });

  it('update blocks direct status overrides', async () => {
    mockShipmentRepo.findOne.mockResolvedValue({
      shipNo: 'SHIP-020',
      status: 'PREPARING',
    } as ShipmentLog);

    await expect(
      target.update('SHIP-020', { status: 'CANCELED' } as any),
    ).rejects.toThrow('적재/출하/역분개/취소 API를 사용해 주세요.');
  });

  it('changeStatus blocks manual state transitions', async () => {
    mockShipmentRepo.findOne.mockResolvedValue({
      shipNo: 'SHIP-021',
      status: 'PREPARING',
    } as ShipmentLog);

    await expect(
      target.changeStatus('SHIP-021', { status: 'SHIPPED' } as any),
    ).rejects.toThrow('직접 변경할 수 없습니다.');
  });

  it('delete blocks shipment once it has entered downstream flow', async () => {
    mockShipmentRepo.findOne.mockResolvedValue({
      shipNo: 'SHIP-030',
      status: 'LOADED',
      palletCount: 0,
    } as ShipmentLog);

    await expect(target.delete('SHIP-030')).rejects.toThrow(BadRequestException);
    expect(mockShipmentRepo.delete).not.toHaveBeenCalled();
  });

  it('delete allows only empty preparing shipment', async () => {
    mockShipmentRepo.findOne.mockResolvedValue({
      shipNo: 'SHIP-031',
      status: 'PREPARING',
      palletCount: 0,
    } as ShipmentLog);

    await expect(target.delete('SHIP-031')).resolves.toEqual({ id: 'SHIP-031', deleted: true });
    expect(mockShipmentRepo.delete).toHaveBeenCalledWith({ shipNo: 'SHIP-031' });
  });

  it('loadPallets uses TransactionService', async () => {
    mockShipmentRepo.findOne
      .mockResolvedValueOnce({ shipNo: 'SHIP-001', status: 'PREPARING', shipOrderNo: null } as ShipmentLog)
      .mockResolvedValueOnce({ shipNo: 'SHIP-001', status: 'PREPARING', shipOrderNo: null } as ShipmentLog);
    mockPalletRepo.find.mockResolvedValue([{ palletNo: 'P-001', status: 'CLOSED', shipOrderNo: null }] as PalletMaster[]);
    mockBoxRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    } as any);
    mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ count: '1', boxCount: '1', totalQty: '2' }),
    } as any);

    await target.loadPallets('SHIP-001', { palletIds: ['P-001'] } as any);

    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('loadPallets blocks order-bound pallets from unrelated manual shipments', async () => {
    mockShipmentRepo.findOne.mockResolvedValue({ shipNo: 'SHIP-001', status: 'PREPARING', shipOrderNo: null } as ShipmentLog);
    mockPalletRepo.find.mockResolvedValue([{ palletNo: 'P-001', status: 'CLOSED', shipOrderNo: 'SO-001' }] as PalletMaster[]);

    await expect(target.loadPallets('SHIP-001', { palletIds: ['P-001'] } as any)).rejects.toThrow(BadRequestException);
    expect(mockTx.run).not.toHaveBeenCalled();
  });

  it('loadPallets blocks pallets from a different ship order', async () => {
    mockShipmentRepo.findOne.mockResolvedValue({ shipNo: 'SHIP-001', status: 'PREPARING', shipOrderNo: 'SO-002' } as ShipmentLog);
    mockPalletRepo.find.mockResolvedValue([{ palletNo: 'P-001', status: 'CLOSED', shipOrderNo: 'SO-001' }] as PalletMaster[]);

    await expect(target.loadPallets('SHIP-001', { palletIds: ['P-001'] } as any)).rejects.toThrow(BadRequestException);
    expect(mockTx.run).not.toHaveBeenCalled();
  });

  it('unloadPallets uses TransactionService', async () => {
    mockShipmentRepo.findOne
      .mockResolvedValueOnce({ shipNo: 'SHIP-001', status: 'PREPARING' } as ShipmentLog)
      .mockResolvedValueOnce({ shipNo: 'SHIP-001', status: 'PREPARING' } as ShipmentLog);
    mockPalletRepo.find.mockResolvedValue([{ palletNo: 'P-001', status: 'LOADED', shipmentId: 'SHIP-001' }] as PalletMaster[]);
    mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ count: '0', boxCount: '0', totalQty: '0' }),
    } as any);

    await target.unloadPallets('SHIP-001', { palletIds: ['P-001'] } as any);

    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('cancel uses TransactionService', async () => {
    mockShipmentRepo.findOne
      .mockResolvedValueOnce({ shipNo: 'SHIP-001', status: 'PREPARING' } as ShipmentLog)
      .mockResolvedValueOnce({ shipNo: 'SHIP-001', status: 'CANCELED' } as ShipmentLog);

    await target.cancel('SHIP-001', 'cancel');

    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('getShipmentSummary joins boxes to pallets by tenant-scoped pallet key', async () => {
    mockShipmentRepo.findOne.mockResolvedValue({
      shipNo: 'SHIP-001',
      status: 'LOADED',
      company: 'C1',
      plant: 'P1',
    } as ShipmentLog);
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    mockBoxRepo.createQueryBuilder.mockReturnValue(qb as any);

    await target.getShipmentSummary('SHIP-001', 'C1', 'P1');

    expect(qb.innerJoin).toHaveBeenCalledWith(
      PalletMaster,
      'pallet',
      'box.palletNo = pallet.palletNo AND box.company = pallet.company AND box.plant = pallet.plant',
    );
  });

});
