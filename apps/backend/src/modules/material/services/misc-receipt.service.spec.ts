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
  let dataSource: DeepMocked<DataSource>;
  let tx: DeepMocked<TransactionService>;
  let numbering: DeepMocked<NumberingService>;
  let queryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    stockTxRepo = createMock<Repository<StockTransaction>>();
    matStockRepo = createMock<Repository<MatStock>>();
    matLotRepo = createMock<Repository<MatLot>>();
    partRepo = createMock<Repository<ItemMaster>>();
    warehouseRepo = createMock<Repository<Warehouse>>();
    dataSource = createMock<DataSource>();
    tx = createMock<TransactionService>();
    numbering = createMock<NumberingService>();
    queryRunner = createMock<QueryRunner>();

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

  it('recalculates availableQty from qty and reservedQty when stock already exists', async () => {
    stockTxRepo.findOne.mockResolvedValue(null);

    queryRunner.manager.findOne
      .mockResolvedValueOnce({ warehouseCode: 'WH-01', warehouseName: 'Main WH' } as Warehouse)
      .mockResolvedValueOnce({ itemCode: 'ITEM-001', itemName: 'Raw' } as ItemMaster)
      .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-001' } as MatLot)
      .mockResolvedValueOnce({
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: 10,
        reservedQty: 8,
        availableQty: 2,
      } as MatStock);

    queryRunner.manager.create.mockReturnValue({ transNo: 'MISC2026010100001' } as any);
    queryRunner.manager.save.mockResolvedValue({ transNo: 'MISC2026010100001' } as any);

    await service.create({
      warehouseId: 'WH-01',
      itemCode: 'ITEM-001',
      matUid: 'MAT-001',
      qty: 5,
      workerId: 'W1',
    });

    expect(queryRunner.manager.update).toHaveBeenCalledWith(
      MatStock,
      { warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001' },
      expect.objectContaining({
        qty: 15,
        availableQty: 7,
      }),
    );
    expect(tx.run).toHaveBeenCalledTimes(1);
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('blocks create when existing stock belongs to a different tenant', async () => {
    stockTxRepo.findOne.mockResolvedValue(null);

    queryRunner.manager.findOne
      .mockResolvedValueOnce({ warehouseCode: 'WH-01', warehouseName: 'Main WH', company: 'HANES', plant: 'P01' } as Warehouse)
      .mockResolvedValueOnce({ itemCode: 'ITEM-001', itemName: 'Raw', company: 'HANES', plant: 'P01' } as ItemMaster)
      .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-001', company: 'HANES', plant: 'P01' } as MatLot)
      .mockResolvedValueOnce({
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: 10,
        reservedQty: 0,
        availableQty: 10,
        company: 'OTHER',
        plant: 'P01',
      } as MatStock);

    await expect(
      service.create({
        warehouseId: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: 5,
      }, 'HANES', 'P01'),
    ).rejects.toThrow(BadRequestException);

    expect(queryRunner.manager.update).not.toHaveBeenCalled();
    expect(queryRunner.manager.save).not.toHaveBeenCalled();
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
    expect(queryRunner.manager.create).toHaveBeenCalledWith(
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
