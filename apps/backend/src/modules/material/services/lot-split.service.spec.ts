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

describe('LotSplitService', () => {
  let target: LotSplitService;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockMatStockRepo: DeepMocked<Repository<MatStock>>;
  let mockMatIssueRepo: DeepMocked<Repository<MatIssue>>;
  let mockPartRepo: DeepMocked<Repository<PartMaster>>;
  let mockStockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockMatLotRepo = createMock<Repository<MatLot>>();
    mockMatStockRepo = createMock<Repository<MatStock>>();
    mockMatIssueRepo = createMock<Repository<MatIssue>>();
    mockPartRepo = createMock<Repository<PartMaster>>();
    mockStockTxRepo = createMock<Repository<StockTransaction>>();
    mockDataSource = createMock<DataSource>();
    mockQueryRunner = createMock<QueryRunner>();

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
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
});
