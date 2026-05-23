import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { LotSplitService } from './lot-split.service';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('LotSplitService', () => {
  let target: LotSplitService;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockMatStockRepo: DeepMocked<Repository<MatStock>>;
  let mockMatIssueRepo: DeepMocked<Repository<MatIssue>>;
  let mockPartRepo: DeepMocked<Repository<PartMaster>>;
  let mockStockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockTx: DeepMocked<TransactionService>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockMatLotRepo = createMock<Repository<MatLot>>();
    mockMatStockRepo = createMock<Repository<MatStock>>();
    mockMatIssueRepo = createMock<Repository<MatIssue>>();
    mockPartRepo = createMock<Repository<PartMaster>>();
    mockStockTxRepo = createMock<Repository<StockTransaction>>();
    mockDataSource = createMock<DataSource>();
    mockTx = createMock<TransactionService>();
    mockQueryRunner = createMock<QueryRunner>();

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockTx.run.mockImplementation(async (callback: any) => callback(mockQueryRunner));
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LotSplitService,
        { provide: getRepositoryToken(MatLot), useValue: mockMatLotRepo },
        { provide: getRepositoryToken(MatStock), useValue: mockMatStockRepo },
        { provide: getRepositoryToken(MatIssue), useValue: mockMatIssueRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartRepo },
        { provide: getRepositoryToken(StockTransaction), useValue: mockStockTxRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get(LotSplitService);
  });

  afterEach(() => jest.clearAllMocks());

  it('blocks split when reserved quantity exists', async () => {
    (mockQueryRunner as any).manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-001', status: 'NORMAL' } as MatLot)
        .mockResolvedValueOnce({
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          availableQty: 8,
          reservedQty: 2,
        } as MatStock),
    };

    await expect(
      target.split({ sourceLotId: 'MAT-001', splitQty: 3 } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('blocks split when material issue history exists', async () => {
    (mockQueryRunner as any).manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-001', status: 'NORMAL' } as MatLot)
        .mockResolvedValueOnce({
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          availableQty: 10,
          reservedQty: 0,
        } as MatStock),
      find: jest.fn().mockResolvedValue([
        { matUid: 'MAT-001', issueNo: 'ISS-001', status: 'DONE' } as MatIssue,
      ]),
    };

    await expect(
      target.split({ sourceLotId: 'MAT-001', splitQty: 3 } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('splits a LOT through TransactionService', async () => {
    const sourceLot = {
      matUid: 'MAT-001',
      itemCode: 'ITEM-001',
      status: 'NORMAL',
      company: 'C1',
      plant: 'P1',
    } as MatLot;
    const sourceStock = {
      warehouseCode: 'WH-01',
      itemCode: 'ITEM-001',
      matUid: 'MAT-001',
      qty: 10,
      availableQty: 10,
      reservedQty: 0,
      company: 'C1',
      plant: 'P1',
    } as MatStock;
    const part = { itemCode: 'ITEM-001', itemName: 'PART-A', isSplittable: 'Y' } as PartMaster;
    const newLot = { matUid: 'MAT-001-S001', itemCode: 'ITEM-001' } as MatLot;

    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce(sourceLot)
      .mockResolvedValueOnce(sourceStock)
      .mockResolvedValueOnce(part)
      .mockResolvedValueOnce(null);
    mockQueryRunner.manager.find.mockResolvedValue([]);
    mockQueryRunner.manager.create
      .mockReturnValueOnce(newLot)
      .mockReturnValueOnce({ matUid: 'MAT-001-S001' } as MatStock);
    mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
    mockQueryRunner.manager.save.mockResolvedValue({} as any);
    mockStockTxRepo.findOne.mockResolvedValue(null);

    const result = await target.split({
      sourceLotId: 'MAT-001',
      splitQty: 3,
      newLotNo: 'MAT-001-S001',
    } as any);

    expect(result.newLotNo).toBe('MAT-001-S001');
    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
  });
});
