import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { MatIssueService } from './mat-issue.service';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { MockLoggerService } from '../../../common/test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('MatIssueService', () => {
  let target: MatIssueService;
  let mockMatIssueRepo: DeepMocked<Repository<MatIssue>>;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockMatStockRepo: DeepMocked<Repository<MatStock>>;
  let mockStockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let mockPartMasterRepo: DeepMocked<Repository<PartMaster>>;
  let mockJobOrderRepo: DeepMocked<Repository<JobOrder>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;
  let mockNumbering: DeepMocked<NumberingService>;
  let mockTx: DeepMocked<TransactionService>;

  beforeEach(async () => {
    mockMatIssueRepo = createMock<Repository<MatIssue>>();
    mockMatLotRepo = createMock<Repository<MatLot>>();
    mockMatStockRepo = createMock<Repository<MatStock>>();
    mockStockTxRepo = createMock<Repository<StockTransaction>>();
    mockPartMasterRepo = createMock<Repository<PartMaster>>();
    mockJobOrderRepo = createMock<Repository<JobOrder>>();
    mockDataSource = createMock<DataSource>();
    mockQueryRunner = createMock<QueryRunner>();
    mockNumbering = createMock<NumberingService>();
    mockTx = createMock<TransactionService>();

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockTx.run.mockImplementation(async (callback: any) => callback(mockQueryRunner));
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatIssueService,
        { provide: getRepositoryToken(MatIssue), useValue: mockMatIssueRepo },
        { provide: getRepositoryToken(MatLot), useValue: mockMatLotRepo },
        { provide: getRepositoryToken(MatStock), useValue: mockMatStockRepo },
        { provide: getRepositoryToken(StockTransaction), useValue: mockStockTxRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartMasterRepo },
        { provide: getRepositoryToken(JobOrder), useValue: mockJobOrderRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: NumberingService, useValue: mockNumbering },
        { provide: TransactionService, useValue: mockTx },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get(MatIssueService);
  });

  afterEach(() => jest.clearAllMocks());

  it('create splits manual issue across multiple stock rows', async () => {
    const manager = {
      findOne: jest.fn().mockResolvedValueOnce({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        iqcStatus: 'PASS',
        status: 'NORMAL',
        company: 'HANES',
        plant: 'P01',
      } as MatLot),
      find: jest
        .fn()
        .mockResolvedValueOnce([
          { warehouseCode: 'W1', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 3, availableQty: 3 } as MatStock,
          { warehouseCode: 'W2', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 4, availableQty: 4 } as MatStock,
        ])
        .mockResolvedValueOnce([
          { warehouseCode: 'W1', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 0, availableQty: 0 } as MatStock,
          { warehouseCode: 'W2', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 2, availableQty: 2 } as MatStock,
        ]),
      create: jest.fn((entity, payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (entity) => entity),
      update: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;

    mockNumbering.nextInTx
      .mockResolvedValueOnce('ISS-001')
      .mockResolvedValueOnce('TX-001')
      .mockResolvedValueOnce('TX-002');
    mockMatLotRepo.findOne.mockResolvedValue({ matUid: 'MAT-001', itemCode: 'ITEM-001' } as MatLot);
    mockPartMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001' } as PartMaster);

    await target.create({
      issueType: 'PROD',
      items: [{ matUid: 'MAT-001', issueQty: 5 }],
    } as any);

    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ transNo: 'TX-001', qty: -3 }));
    expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ transNo: 'TX-002', qty: -2 }));
    expect(manager.update).toHaveBeenCalledWith(
      MatStock,
      { warehouseCode: 'W1', itemCode: 'ITEM-001', matUid: 'MAT-001' },
      { qty: 0, availableQty: 0 },
    );
    expect(manager.update).toHaveBeenCalledWith(
      MatStock,
      { warehouseCode: 'W2', itemCode: 'ITEM-001', matUid: 'MAT-001' },
      { qty: 2, availableQty: 2 },
    );
  });

  it('cancel restores stock to the original warehouse rows', async () => {
    mockMatIssueRepo.findOne.mockResolvedValue({
      issueNo: 'ISS-001',
      seq: 1,
      status: 'DONE',
      matUid: 'MAT-001',
      issueQty: 5,
    } as MatIssue);

    const manager = {
      update: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([
        {
          transNo: 'TX-001',
          fromWarehouseId: 'W1',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: -3,
          company: 'HANES',
          plant: 'P01',
        } as StockTransaction,
        {
          transNo: 'TX-002',
          fromWarehouseId: 'W2',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: -2,
          company: 'HANES',
          plant: 'P01',
        } as StockTransaction,
      ]),
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ warehouseCode: 'W1', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 0, availableQty: 0 } as MatStock)
        .mockResolvedValueOnce({ warehouseCode: 'W2', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 2, availableQty: 2 } as MatStock),
      create: jest.fn((entity, payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };
    (mockQueryRunner as any).manager = manager;

    mockNumbering.nextInTx
      .mockResolvedValueOnce('CANCEL-001')
      .mockResolvedValueOnce('CANCEL-002');

    await target.cancel('ISS-001', 1, 'cancel');

    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(manager.update).toHaveBeenCalledWith(
      MatStock,
      { warehouseCode: 'W1', itemCode: 'ITEM-001', matUid: 'MAT-001' },
      { qty: 3, availableQty: 3 },
    );
    expect(manager.update).toHaveBeenCalledWith(
      MatStock,
      { warehouseCode: 'W2', itemCode: 'ITEM-001', matUid: 'MAT-001' },
      { qty: 4, availableQty: 4 },
    );
  });

  it('blocks cancel when linked production has already progressed', async () => {
    mockMatIssueRepo.findOne.mockResolvedValue({
      issueNo: 'ISS-002',
      seq: 1,
      status: 'DONE',
      orderNo: 'JO-001',
      prodResultNo: 'PR-001',
      issueType: 'PROD',
    } as MatIssue);

    const prodResultRepo = {
      findOne: jest.fn().mockResolvedValue({
        resultNo: 'PR-001',
        status: 'DONE',
        prdUid: 'FG-001',
      } as any),
    };
    const fgLabelRepo = {
      findOne: jest.fn().mockResolvedValue({
        fgBarcode: 'FG-001',
        status: 'PACKED',
      } as any),
    };

    mockDataSource.getRepository.mockImplementation((entity: any) => {
      if (entity?.name === 'ProdResult') return prodResultRepo as any;
      if (entity?.name === 'FgLabel') return fgLabelRepo as any;
      return createMock<Repository<any>>() as any;
    });

    await expect(target.cancel('ISS-002', 1, 'rollback')).rejects.toThrow(BadRequestException);
    await expect(target.cancel('ISS-002', 1, 'rollback')).rejects.toThrow(
      '생산실적 순서로 역처리 후 다시 자재출고를 취소해 주세요.',
    );
  });
});
