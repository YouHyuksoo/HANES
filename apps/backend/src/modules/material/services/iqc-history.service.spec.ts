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
import { TransactionService } from '../../../shared/transaction.service';
import { MockLoggerService } from '@test/mock-logger.service';

describe('IqcHistoryService cancel policy', () => {
  let target: IqcHistoryService;
  let mockIqcLogRepo: DeepMocked<Repository<IqcLog>>;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockMatReceivingRepo: DeepMocked<Repository<MatReceiving>>;
  let mockMatStockRepo: DeepMocked<Repository<MatStock>>;
  let mockStockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let mockWarehouseRepo: DeepMocked<Repository<Warehouse>>;
  let mockPartMasterRepo: DeepMocked<Repository<PartMaster>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;
  let mockNumbering: DeepMocked<NumberingService>;
  let mockSysConfigService: DeepMocked<SysConfigService>;
  let mockTx: DeepMocked<TransactionService>;

  beforeEach(async () => {
    mockIqcLogRepo = createMock<Repository<IqcLog>>();
    mockMatLotRepo = createMock<Repository<MatLot>>();
    mockMatReceivingRepo = createMock<Repository<MatReceiving>>();
    mockMatStockRepo = createMock<Repository<MatStock>>();
    mockStockTxRepo = createMock<Repository<StockTransaction>>();
    mockWarehouseRepo = createMock<Repository<Warehouse>>();
    mockPartMasterRepo = createMock<Repository<PartMaster>>();
    mockDataSource = createMock<DataSource>();
    mockQueryRunner = createMock<QueryRunner>();
    mockNumbering = createMock<NumberingService>();
    mockSysConfigService = createMock<SysConfigService>();
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
        IqcHistoryService,
        { provide: getRepositoryToken(IqcLog), useValue: mockIqcLogRepo },
        { provide: getRepositoryToken(MatLot), useValue: mockMatLotRepo },
        { provide: getRepositoryToken(MatReceiving), useValue: mockMatReceivingRepo },
        { provide: getRepositoryToken(MatStock), useValue: mockMatStockRepo },
        { provide: getRepositoryToken(StockTransaction), useValue: mockStockTxRepo },
        { provide: getRepositoryToken(Warehouse), useValue: mockWarehouseRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartMasterRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: SysConfigService, useValue: mockSysConfigService },
        { provide: NumberingService, useValue: mockNumbering },
        { provide: TransactionService, useValue: mockTx },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get(IqcHistoryService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('품목 마스터가 누락되어도 IQC 이력 원본 itemCode는 유지한다', async () => {
      mockIqcLogRepo.find.mockResolvedValue([
        {
          inspectDate: new Date('2026-04-08'),
          seq: 1,
          matUid: 'MAT-001',
          itemCode: 'ITEM-MISSING',
          result: 'PASS',
          status: 'DONE',
        } as IqcLog,
      ]);
      mockIqcLogRepo.count.mockResolvedValue(1);
      mockPartMasterRepo.find.mockResolvedValue([]);

      const result = await target.findAll({ page: 1, limit: 10 });

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          matUid: 'MAT-001',
          itemCode: 'ITEM-MISSING',
          itemName: null,
          unit: null,
        }),
      );
    });

    it('IQC 이력 품목 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      mockIqcLogRepo.find.mockResolvedValue([
        {
          inspectDate: new Date('2026-04-08'),
          itemCode: 'ITEM-001',
          result: 'PASS',
          company: 'C1',
          plant: 'P1',
        } as IqcLog,
      ]);
      mockIqcLogRepo.count.mockResolvedValue(1);
      mockPartMasterRepo.find.mockResolvedValue([]);

      await target.findAll({ page: 1, limit: 10 }, 'C1', 'P1');

      expect(mockPartMasterRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
    });
  });

  describe('createResult', () => {
    it('요청 회사/공장과 다른 LOT에는 IQC 결과를 등록하지 않는다', async () => {
      mockMatLotRepo.findOne.mockResolvedValue({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        arrivalNo: 'ARR-001',
        company: 'OTHER',
        plant: 'P01',
      } as MatLot);
      mockIqcLogRepo.create.mockReturnValue({ matUid: 'MAT-001', itemCode: 'ITEM-001' } as IqcLog);
      mockIqcLogRepo.save.mockResolvedValue({ matUid: 'MAT-001', itemCode: 'ITEM-001' } as IqcLog);
      mockPartMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Item' } as PartMaster);

      await expect(
        target.createResult({ matUid: 'MAT-001', result: 'PASS' } as any, 'HANES', 'P01'),
      ).rejects.toThrow('회사 정보가 일치하지 않습니다');

      expect(mockMatLotRepo.update).not.toHaveBeenCalled();
      expect(mockIqcLogRepo.save).not.toHaveBeenCalled();
    });

    it('IQC 결과 등록은 LOT 회사/공장 범위에서 LOT와 품목을 조회/갱신한다', async () => {
      const lot = {
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        arrivalNo: 'ARR-001',
        company: 'HANES',
        plant: 'P01',
      } as MatLot;
      mockMatLotRepo.findOne.mockResolvedValue(lot);
      mockIqcLogRepo.create.mockReturnValue({ matUid: 'MAT-001', itemCode: 'ITEM-001' } as IqcLog);
      mockIqcLogRepo.save.mockResolvedValue({ matUid: 'MAT-001', itemCode: 'ITEM-001' } as IqcLog);
      mockPartMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Item' } as PartMaster);

      await target.createResult({ matUid: 'MAT-001', result: 'PASS' } as any, 'HANES', 'P01');

      expect(mockMatLotRepo.findOne).toHaveBeenCalledWith({
        where: { matUid: 'MAT-001', company: 'HANES', plant: 'P01' },
      });
      expect(mockMatLotRepo.update).toHaveBeenCalledWith(
        { matUid: 'MAT-001', company: 'HANES', plant: 'P01' },
        { iqcStatus: 'PASS' },
      );
      expect(mockPartMasterRepo.findOne).toHaveBeenCalledWith({
        where: { itemCode: 'ITEM-001', company: 'HANES', plant: 'P01' },
      });
    });

    it('품목 마스터가 누락되어도 IQC 결과 응답의 LOT 원본 itemCode는 유지한다', async () => {
      const lot = {
        matUid: 'MAT-001',
        itemCode: 'ITEM-MISSING',
        arrivalNo: 'ARR-001',
        company: 'HANES',
        plant: 'P01',
      } as MatLot;
      mockMatLotRepo.findOne.mockResolvedValue(lot);
      mockIqcLogRepo.create.mockReturnValue({ matUid: 'MAT-001', itemCode: 'ITEM-MISSING' } as IqcLog);
      mockIqcLogRepo.save.mockResolvedValue({ matUid: 'MAT-001', itemCode: 'ITEM-MISSING' } as IqcLog);
      mockPartMasterRepo.findOne.mockResolvedValue(null);

      const result = await target.createResult({ matUid: 'MAT-001', result: 'PASS' } as any);

      expect(result).toEqual(
        expect.objectContaining({
          matUid: 'MAT-001',
          itemCode: 'ITEM-MISSING',
          itemName: null,
        }),
      );
    });
  });

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
    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(manager.save).toHaveBeenCalledWith(
      StockTransaction,
      expect.objectContaining({
        refType: 'IQC_FAIL_CANCEL',
        cancelRefId: 'TX-FAIL-001',
      }),
    );
    expect(manager.findOne).toHaveBeenCalledWith(StockTransaction, {
      where: expect.objectContaining({ matUid: 'MAT-001', itemCode: 'ITEM-001', company: 'HANES', plant: 'P01' }),
      order: { createdAt: 'DESC' },
    });
    expect(manager.update).toHaveBeenCalledWith(
      IqcLog,
      { inspectDate: new Date('2026-04-08'), seq: 1, company: 'HANES', plant: 'P01' },
      { status: 'CANCELED', remark: 'retest' },
    );
    expect(manager.update).toHaveBeenCalledWith(
      MatLot,
      { matUid: 'MAT-001', company: 'HANES', plant: 'P01' },
      { iqcStatus: 'PENDING' },
    );
  });

  it('moves failed IQC stock through TransactionService', async () => {
    const lot = {
      matUid: 'MAT-001',
      itemCode: 'ITEM-001',
      arrivalNo: 'ARR-001',
      company: 'HANES',
      plant: 'P01',
    } as MatLot;
    mockMatLotRepo.findOne.mockResolvedValue(lot);
    mockIqcLogRepo.create.mockReturnValue({ seq: 1 } as IqcLog);
    mockIqcLogRepo.save.mockResolvedValue({ seq: 1 } as IqcLog);
    mockWarehouseRepo.findOne.mockResolvedValue({ warehouseCode: 'WH-DEFECT', company: 'HANES', plant: 'P01' } as Warehouse);
    mockMatStockRepo.findOne.mockResolvedValue({
      warehouseCode: 'WH-NORMAL',
      itemCode: 'ITEM-001',
      matUid: 'MAT-001',
      qty: 5,
      company: 'HANES',
      plant: 'P01',
    } as MatStock);
    mockNumbering.nextInTx.mockResolvedValue('TX-IQC-FAIL');
    mockPartMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Item' } as PartMaster);

    const manager = {
      update: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;

    await target.createResult({ matUid: 'MAT-001', result: 'FAIL' } as any);

    expect(mockWarehouseRepo.findOne).toHaveBeenCalledWith({
      where: { warehouseType: 'DEFECT', useYn: 'Y', company: 'HANES', plant: 'P01' },
    });
    expect(mockMatStockRepo.findOne).toHaveBeenCalledWith({
      where: { matUid: 'MAT-001', itemCode: 'ITEM-001', company: 'HANES', plant: 'P01' },
    });
    expect(manager.update).toHaveBeenCalledWith(
      MatStock,
      { warehouseCode: 'WH-NORMAL', itemCode: 'ITEM-001', matUid: 'MAT-001', company: 'HANES', plant: 'P01' },
      { qty: 0 },
    );
    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(manager.save).toHaveBeenCalledWith(StockTransaction, expect.objectContaining({
      transNo: 'TX-IQC-FAIL',
      refType: 'IQC_FAIL',
    }));
  });

  it('auto-issues destructive sample through TransactionService', async () => {
    const lot = {
      matUid: 'MAT-001',
      itemCode: 'ITEM-001',
      arrivalNo: 'ARR-001',
      company: 'HANES',
      plant: 'P01',
    } as MatLot;
    mockMatLotRepo.findOne.mockResolvedValue(lot);
    mockIqcLogRepo.create.mockReturnValue({ seq: 1 } as IqcLog);
    mockIqcLogRepo.save.mockResolvedValue({ seq: 1 } as IqcLog);
    mockSysConfigService.getValue.mockResolvedValue('AUTO_ISSUE');
    mockMatStockRepo.findOne.mockResolvedValue({
      warehouseCode: 'WH-NORMAL',
      itemCode: 'ITEM-001',
      matUid: 'MAT-001',
      qty: 10,
      company: 'HANES',
      plant: 'P01',
    } as MatStock);
    mockNumbering.nextInTx.mockResolvedValue('TX-IQC-DESTRUCT');
    mockPartMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Item' } as PartMaster);

    const manager = {
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;

    await target.createResult({ matUid: 'MAT-001', result: 'PASS', destructSampleQty: 2 } as any);

    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(manager.save).toHaveBeenCalledWith(StockTransaction, expect.objectContaining({
      transNo: 'TX-IQC-DESTRUCT',
      refType: 'IQC_DESTRUCT',
    }));
  });
});
