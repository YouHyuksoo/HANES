import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { MiscReceiptService } from './misc-receipt.service';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { WarehouseLocation } from '../../../entities/warehouse-location.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';
import { NumberingService } from '../../../shared/numbering.service';

describe('MiscReceiptService', () => {
  let service: MiscReceiptService;
  let stockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let matStockRepo: DeepMocked<Repository<MatStock>>;
  let matLotRepo: DeepMocked<Repository<MatLot>>;
  let partRepo: DeepMocked<Repository<ItemMaster>>;
  let warehouseRepo: DeepMocked<Repository<Warehouse>>;
  let warehouseLocationRepo: DeepMocked<Repository<WarehouseLocation>>;
  let dataSource: DeepMocked<DataSource>;
  let tx: DeepMocked<TransactionService>;
  let numbering: DeepMocked<NumberingService>;
  let queryRunner: DeepMocked<QueryRunner>;
  let stockQb: any;

  beforeEach(async () => {
    stockTxRepo = createMock<Repository<StockTransaction>>();
    matStockRepo = createMock<Repository<MatStock>>();
    matLotRepo = createMock<Repository<MatLot>>();
    partRepo = createMock<Repository<ItemMaster>>();
    warehouseRepo = createMock<Repository<Warehouse>>();
    warehouseLocationRepo = createMock<Repository<WarehouseLocation>>();
    dataSource = createMock<DataSource>();
    tx = createMock<TransactionService>();
    numbering = createMock<NumberingService>();
    queryRunner = createMock<QueryRunner>();
    stockQb = {
      update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(), setParameters: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    queryRunner.manager.createQueryBuilder.mockReturnValue(stockQb);

    dataSource.createQueryRunner.mockReturnValue(queryRunner);
    tx.run.mockImplementation(async (callback: any) => callback(queryRunner));
    queryRunner.connect.mockResolvedValue(undefined);
    queryRunner.startTransaction.mockResolvedValue(undefined);
    queryRunner.commitTransaction.mockResolvedValue(undefined);
    queryRunner.rollbackTransaction.mockResolvedValue(undefined);
    queryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MiscReceiptService,
        { provide: getRepositoryToken(StockTransaction), useValue: stockTxRepo },
        { provide: getRepositoryToken(MatStock), useValue: matStockRepo },
        { provide: getRepositoryToken(WarehouseLocation), useValue: warehouseLocationRepo },
        { provide: getRepositoryToken(MatLot), useValue: matLotRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: partRepo },
        { provide: getRepositoryToken(Warehouse), useValue: warehouseRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: TransactionService, useValue: tx },
        { provide: NumberingService, useValue: numbering },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    service = module.get(MiscReceiptService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('preserves transaction codes when master rows are missing', async () => {
      stockTxRepo.find.mockResolvedValue([
        {
          transNo: 'MISC-001',
          transType: 'MISC_IN',
          itemCode: 'ITEM-MISSING',
          matUid: 'MAT-MISSING',
          toWarehouseId: 'WH-MISSING',
        } as StockTransaction,
      ]);
      stockTxRepo.count.mockResolvedValue(1);
      partRepo.find.mockResolvedValue([]);
      matLotRepo.find.mockResolvedValue([]);
      warehouseRepo.find.mockResolvedValue([]);

      const result = await service.findAll({ page: 1, limit: 10 } as any);

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          itemCode: 'ITEM-MISSING',
          matUid: 'MAT-MISSING',
          warehouseCode: 'WH-MISSING',
          itemName: null,
          warehouseName: null,
        }),
      );
    });
  });

  it('기타입고 이력에 해당 자재의 현재 보관위치를 붙인다', async () => {
    // 입고한 자재를 다시 찾을 때 창고만으로는 부족하다. 이력 시점이 아니라 '현재' 위치다.
    stockTxRepo.find.mockResolvedValue([
      {
        transNo: 'MISC-001',
        transType: 'MISC_IN',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        toWarehouseId: 'WH-01',
      } as StockTransaction,
    ]);
    stockTxRepo.count.mockResolvedValue(1);
    partRepo.find.mockResolvedValue([]);
    matLotRepo.find.mockResolvedValue([]);
    warehouseRepo.find.mockResolvedValue([]);
    matStockRepo.find.mockResolvedValue([
      { matUid: 'MAT-001', warehouseCode: 'WH-01', locationCode: 'RM-A-01-01' } as MatStock,
    ]);
    warehouseLocationRepo.find.mockResolvedValue([
      { warehouseCode: 'WH-01', locationCode: 'RM-A-01-01', locationName: '원자재 A구역 1열 1단' } as WarehouseLocation,
    ]);

    const result = await service.findAll({ page: 1, limit: 10 } as any);

    expect(result.data[0]).toEqual(
      expect.objectContaining({
        locationCode: 'RM-A-01-01',
        locationName: '원자재 A구역 1열 1단',
      }),
    );
  });

  it('increments qty and availableQty atomically when stock already exists', async () => {
    stockTxRepo.findOne.mockResolvedValue(null);

    queryRunner.manager.findOne
      .mockResolvedValueOnce({ warehouseCode: 'WH-01', warehouseName: 'Main WH' } as Warehouse)
      .mockResolvedValueOnce({ itemCode: 'ITEM-001', itemName: 'Raw' } as ItemMaster)
      .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-001' } as MatLot);

    queryRunner.manager.create.mockReturnValue({ transNo: 'MISC2026010100001' } as any);
    queryRunner.manager.save.mockResolvedValue({ transNo: 'MISC2026010100001' } as any);

    await service.create({
      warehouseId: 'WH-01',
      itemCode: 'ITEM-001',
      matUid: 'MAT-001',
      qty: 5,
      workerId: 'W1',
    });

    // 먼저 상대 UPDATE (find 로 행 존재를 판단하지 않는다)
    expect(stockQb.update).toHaveBeenCalledWith(MatStock);
    expect(stockQb.set).toHaveBeenCalledWith(
      expect.objectContaining({ qty: expect.any(Function), availableQty: expect.any(Function) }),
    );
    expect(stockQb.where).toHaveBeenCalledWith({ warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001' });
    expect(stockQb.setParameters).toHaveBeenCalledWith({ stockDelta: 5 });
    expect(queryRunner.manager.insert).not.toHaveBeenCalled();
    expect(tx.run).toHaveBeenCalledTimes(1);
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('inserts a new stock row when the relative update matched nothing', async () => {
    stockTxRepo.findOne.mockResolvedValue(null);
    queryRunner.manager.findOne
      .mockResolvedValueOnce({ warehouseCode: 'WH-01', warehouseName: 'Main WH', company: 'HANES', plant: 'P01' } as Warehouse)
      .mockResolvedValueOnce({ itemCode: 'ITEM-001', itemName: 'Raw', company: 'HANES', plant: 'P01' } as ItemMaster)
      .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-001', company: 'HANES', plant: 'P01' } as MatLot);
    queryRunner.manager.create.mockReturnValue({ transNo: 'MISC2026010100001' } as any);
    queryRunner.manager.save.mockResolvedValue({ transNo: 'MISC2026010100001' } as any);
    stockQb.execute.mockResolvedValueOnce({ affected: 0 });

    await service.create({ warehouseId: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 5 }, 'HANES', 'P01');

    expect(stockQb.where).toHaveBeenCalledWith({
      warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001', company: 'HANES', plant: 'P01',
    });
    expect(queryRunner.manager.insert).toHaveBeenCalledWith(
      MatStock,
      expect.objectContaining({ warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 5, availableQty: 5, company: 'HANES', plant: 'P01' }),
    );
  });

  it('adds to the row again when a concurrent insert wins (unique violation)', async () => {
    stockTxRepo.findOne.mockResolvedValue(null);
    queryRunner.manager.findOne
      .mockResolvedValueOnce({ warehouseCode: 'WH-01', warehouseName: 'Main WH', company: 'HANES', plant: 'P01' } as Warehouse)
      .mockResolvedValueOnce({ itemCode: 'ITEM-001', itemName: 'Raw', company: 'HANES', plant: 'P01' } as ItemMaster)
      .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-001', company: 'HANES', plant: 'P01' } as MatLot);
    queryRunner.manager.create.mockReturnValue({ transNo: 'MISC2026010100001' } as any);
    queryRunner.manager.save.mockResolvedValue({ transNo: 'MISC2026010100001' } as any);
    stockQb.execute.mockResolvedValueOnce({ affected: 0 }).mockResolvedValueOnce({ affected: 1 });
    queryRunner.manager.insert.mockRejectedValueOnce(new Error('ORA-00001: unique constraint violated'));

    await service.create({ warehouseId: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 5 }, 'HANES', 'P01');

    expect(queryRunner.manager.insert).toHaveBeenCalledTimes(1);
    expect(stockQb.execute).toHaveBeenCalledTimes(2);
  });

  it('blocks create when matUid lot itemCode mismatches request itemCode', async () => {
    stockTxRepo.findOne.mockResolvedValue(null);

    queryRunner.manager.findOne
      .mockResolvedValueOnce({ warehouseCode: 'WH-01', warehouseName: 'Main WH' } as Warehouse)
      .mockResolvedValueOnce({ itemCode: 'ITEM-001', itemName: 'Raw' } as ItemMaster)
      .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-999' } as MatLot);

    await expect(
      service.create({
        warehouseId: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: 1,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('generates a material lot when misc receipt is created without matUid', async () => {
    stockTxRepo.findOne.mockResolvedValue(null);
    numbering.nextMatSerial.mockResolvedValue('VH1-RM260701-00001');
    queryRunner.manager.create.mockImplementation((_entity: any, payload: any) => payload);
    queryRunner.manager.save.mockImplementation(async (payload: any) => payload);
    stockQb.execute.mockResolvedValueOnce({ affected: 0 });

    queryRunner.manager.findOne
      .mockResolvedValueOnce({ warehouseCode: 'WH-01', warehouseName: 'Main WH', company: 'HANES', plant: 'P01' } as Warehouse)
      .mockResolvedValueOnce({ itemCode: 'ITEM-001', itemName: 'Raw', company: 'HANES', plant: 'P01' } as ItemMaster)
      .mockResolvedValueOnce(null);

    const result = await service.create({
      warehouseId: 'WH-01',
      itemCode: 'ITEM-001',
      qty: 5,
      remark: '기타입고',
    }, 'HANES', 'P01');

    expect(numbering.nextMatSerial).toHaveBeenCalledWith(queryRunner, expect.any(Date));
    expect(queryRunner.manager.create).toHaveBeenCalledWith(
      MatLot,
      expect.objectContaining({
        matUid: 'VH1-RM260701-00001',
        itemCode: 'ITEM-001',
        initQty: 5,
        currentQty: 5,
        recvDate: expect.any(Date),
        origin: 'VH1-RM260701-00001',
        vendor: 'MISC',
        iqcStatus: 'PASS',
        status: 'NORMAL',
        company: 'HANES',
        plant: 'P01',
      }),
    );
    expect(queryRunner.manager.insert).toHaveBeenCalledWith(
      MatStock,
      expect.objectContaining({
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'VH1-RM260701-00001',
        qty: 5,
        availableQty: 5,
      }),
    );
    expect(queryRunner.manager.create).toHaveBeenCalledWith(
      StockTransaction,
      expect.objectContaining({
        transType: 'MISC_IN',
        itemCode: 'ITEM-001',
        matUid: 'VH1-RM260701-00001',
        qty: 5,
      }),
    );
    expect(result).toEqual(expect.objectContaining({ matUid: 'VH1-RM260701-00001' }));
  });
});
