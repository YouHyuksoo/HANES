import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { IqcHistoryService } from './iqc-history.service';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatReceiving } from '../../../entities/mat-receiving.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { SysConfigService } from '../../system/services/sys-config.service';
import { NumberingService } from '../../../shared/numbering.service';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('IqcHistoryService cancel policy', () => {
  let target: IqcHistoryService;
  let mockIqcLogRepo: DeepMocked<Repository<IqcLog>>;
  let mockMatReceivingRepo: DeepMocked<Repository<MatReceiving>>;
  let mockStockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;
  let mockNumbering: DeepMocked<NumberingService>;

  beforeEach(async () => {
    mockIqcLogRepo = createMock<Repository<IqcLog>>();
    mockMatReceivingRepo = createMock<Repository<MatReceiving>>();
    mockStockTxRepo = createMock<Repository<StockTransaction>>();
    mockDataSource = createMock<DataSource>();
    mockQueryRunner = createMock<QueryRunner>();
    mockNumbering = createMock<NumberingService>();

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IqcHistoryService,
        { provide: getRepositoryToken(IqcLog), useValue: mockIqcLogRepo },
        { provide: getRepositoryToken(MatLot), useValue: createMock<Repository<MatLot>>() },
        { provide: getRepositoryToken(MatReceiving), useValue: mockMatReceivingRepo },
        { provide: getRepositoryToken(MatStock), useValue: createMock<Repository<MatStock>>() },
        { provide: getRepositoryToken(StockTransaction), useValue: mockStockTxRepo },
        { provide: getRepositoryToken(Warehouse), useValue: createMock<Repository<Warehouse>>() },
        { provide: getRepositoryToken(PartMaster), useValue: createMock<Repository<PartMaster>>() },
        { provide: DataSource, useValue: mockDataSource },
        { provide: SysConfigService, useValue: createMock<SysConfigService>() },
        { provide: NumberingService, useValue: mockNumbering },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get(IqcHistoryService);
  });

  afterEach(() => jest.clearAllMocks());

  it('blocks cancel when receiving already exists', async () => {
    mockIqcLogRepo.findOne.mockResolvedValue({
      inspectDate: new Date('2026-04-08'),
      seq: 1,
      matUid: 'MAT-001',
      itemCode: 'ITEM-001',
      result: 'PASS',
      status: 'DONE',
    } as any);
    mockMatReceivingRepo.findOne.mockResolvedValue({ matUid: 'MAT-001', status: 'DONE' } as any);

    await expect(target.cancel('2026-04-08', 1, { reason: 'retest' } as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('blocks cancel when destruct sample issue already exists', async () => {
    mockIqcLogRepo.findOne.mockResolvedValue({
      inspectDate: new Date('2026-04-08'),
      seq: 1,
      matUid: 'MAT-001',
      itemCode: 'ITEM-001',
      result: 'PASS',
      status: 'DONE',
    } as any);
    mockMatReceivingRepo.findOne.mockResolvedValue(null);
    mockStockTxRepo.findOne.mockResolvedValue({
      transNo: 'TX-001',
      refType: 'IQC_DESTRUCT',
      status: 'DONE',
    } as any);

    await expect(target.cancel('2026-04-08', 1, { reason: 'retest' } as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('reverses IQC fail move before canceling the result', async () => {
    mockIqcLogRepo.findOne.mockResolvedValue({
      inspectDate: new Date('2026-04-08'),
      seq: 1,
      matUid: 'MAT-001',
      itemCode: 'ITEM-001',
      result: 'FAIL',
      status: 'DONE',
      company: 'HANES',
      plant: 'P01',
    } as any);
    mockMatReceivingRepo.findOne.mockResolvedValue(null);
    mockNumbering.nextInTx.mockResolvedValue('TX-CANCEL-001');

    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({
          transNo: 'TX-FAIL-001',
          fromWarehouseId: 'WH-NORMAL',
          toWarehouseId: 'WH-DEFECT',
          qty: 5,
        })
        .mockResolvedValueOnce({ warehouseCode: 'WH-DEFECT', qty: 5 })
        .mockResolvedValueOnce({ warehouseCode: 'WH-NORMAL', qty: 0 }),
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;

    const result = await target.cancel('2026-04-08', 1, { reason: 'retest' } as any);

    expect(result.status).toBe('CANCELED');
    expect(manager.save).toHaveBeenCalledWith(
      StockTransaction,
      expect.objectContaining({
        refType: 'IQC_FAIL_CANCEL',
        cancelRefId: 'TX-FAIL-001',
      }),
    );
  });
});
