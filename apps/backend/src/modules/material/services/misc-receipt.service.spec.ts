import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { MiscReceiptService } from './misc-receipt.service';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('MiscReceiptService', () => {
  let service: MiscReceiptService;
  let stockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let matStockRepo: DeepMocked<Repository<MatStock>>;
  let matLotRepo: DeepMocked<Repository<MatLot>>;
  let partRepo: DeepMocked<Repository<PartMaster>>;
  let warehouseRepo: DeepMocked<Repository<Warehouse>>;
  let dataSource: DeepMocked<DataSource>;
  let tx: DeepMocked<TransactionService>;
  let queryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    stockTxRepo = createMock<Repository<StockTransaction>>();
    matStockRepo = createMock<Repository<MatStock>>();
    matLotRepo = createMock<Repository<MatLot>>();
    partRepo = createMock<Repository<PartMaster>>();
    warehouseRepo = createMock<Repository<Warehouse>>();
    dataSource = createMock<DataSource>();
    tx = createMock<TransactionService>();
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
        { provide: getRepositoryToken(PartMaster), useValue: partRepo },
        { provide: getRepositoryToken(Warehouse), useValue: warehouseRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: TransactionService, useValue: tx },
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
      .mockResolvedValueOnce({ itemCode: 'ITEM-001', itemName: 'Raw' } as PartMaster)
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
      .mockResolvedValueOnce({ itemCode: 'ITEM-001', itemName: 'Raw', company: 'HANES', plant: 'P01' } as PartMaster)
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
      .mockResolvedValueOnce({ itemCode: 'ITEM-001', itemName: 'Raw' } as PartMaster)
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
});
