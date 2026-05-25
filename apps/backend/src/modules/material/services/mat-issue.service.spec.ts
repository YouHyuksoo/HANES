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
import { MockLoggerService } from '@test/mock-logger.service';
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

  describe('findAll', () => {
    it('LOT 마스터가 누락되어도 출고 이력의 원본 matUid는 유지한다', async () => {
      mockMatIssueRepo.find.mockResolvedValue([
        {
          issueNo: 'ISS-001',
          seq: 1,
          matUid: 'MAT-MISSING',
          issueQty: 5,
          issueType: 'PROD',
          status: 'DONE',
        } as MatIssue,
      ]);
      mockMatIssueRepo.count.mockResolvedValue(1);
      mockMatLotRepo.find.mockResolvedValue([]);
      mockJobOrderRepo.find.mockResolvedValue([]);
      mockPartMasterRepo.find.mockResolvedValue([]);

      const result = await target.findAll({ page: 1, limit: 10 });

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          issueNo: 'ISS-001',
          matUid: 'MAT-MISSING',
          itemCode: null,
          itemName: null,
          unit: null,
        }),
      );
    });

    it('출고 이력 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      mockMatIssueRepo.find.mockResolvedValue([
        {
          issueNo: 'ISS-001',
          seq: 1,
          matUid: 'MAT-001',
          orderNo: 'JO-001',
          issueQty: 5,
          issueType: 'PROD',
          status: 'DONE',
          company: 'C1',
          plant: 'P1',
        } as MatIssue,
      ]);
      mockMatIssueRepo.count.mockResolvedValue(1);
      mockMatLotRepo.find.mockResolvedValue([
        { matUid: 'MAT-001', itemCode: 'ITEM-001', company: 'C1', plant: 'P1' } as MatLot,
      ]);
      mockJobOrderRepo.find.mockResolvedValue([{ orderNo: 'JO-001', company: 'C1', plant: 'P1' } as JobOrder]);
      mockPartMasterRepo.find.mockResolvedValue([]);

      await target.findAll({ page: 1, limit: 10 }, 'C1', 'P1');

      expect(mockMatLotRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
      expect(mockJobOrderRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
      expect(mockPartMasterRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
    });
  });

  describe('findById', () => {
    it('LOT 마스터가 누락되어도 출고 상세의 원본 matUid는 유지한다', async () => {
      mockMatIssueRepo.findOne.mockResolvedValue({
        issueNo: 'ISS-001',
        seq: 1,
        matUid: 'MAT-MISSING',
        issueQty: 5,
        issueType: 'PROD',
        status: 'DONE',
      } as MatIssue);
      mockMatLotRepo.findOne.mockResolvedValue(null);
      mockJobOrderRepo.findOne.mockResolvedValue(null);

      const result = await target.findById('ISS-001', 1);

      expect(result).toEqual(
        expect.objectContaining({
          issueNo: 'ISS-001',
          matUid: 'MAT-MISSING',
          itemCode: null,
          itemName: null,
          unit: null,
        }),
      );
    });
  });

  describe('scanIssue', () => {
    it('품목 마스터가 누락되어도 스캔 출고 결과의 LOT 원본 itemCode는 유지한다', async () => {
      mockMatLotRepo.findOne.mockResolvedValue({
        matUid: 'MAT-001',
        itemCode: 'ITEM-MISSING',
        iqcStatus: 'PASS',
        status: 'NORMAL',
      } as MatLot);
      mockMatStockRepo.find.mockResolvedValue([
        { warehouseCode: 'WH-01', itemCode: 'ITEM-MISSING', matUid: 'MAT-001', qty: 5, availableQty: 5 } as MatStock,
      ]);
      mockPartMasterRepo.findOne.mockResolvedValue(null);

      jest.spyOn(target, 'create').mockResolvedValue([
        {
          issueNo: 'ISS-001',
          seq: 1,
          matUid: 'MAT-001',
          issueQty: 5,
          itemCode: null,
          itemName: null,
          unit: null,
        } as any,
      ]);

      const result = await target.scanIssue({
        matUid: 'MAT-001',
        issueType: 'PROD',
        workerId: 'worker',
      });

      expect(result).toEqual(
        expect.objectContaining({
          matUid: 'MAT-001',
          issuedQty: 5,
          itemCode: 'ITEM-MISSING',
          itemName: null,
          unit: null,
        }),
      );
    });

    it('스캔 출고의 LOT/재고/품목 조회도 요청 테넌트 범위로 제한한다', async () => {
      mockMatLotRepo.findOne.mockResolvedValue({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        iqcStatus: 'PASS',
        status: 'NORMAL',
        company: 'C1',
        plant: 'P1',
      } as MatLot);
      mockMatStockRepo.find.mockResolvedValue([
        { warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 5, availableQty: 5, company: 'C1', plant: 'P1' } as MatStock,
      ]);
      mockPartMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Item', unit: 'EA' } as PartMaster);
      jest.spyOn(target, 'create').mockResolvedValue([
        {
          issueNo: 'ISS-001',
          seq: 1,
          matUid: 'MAT-001',
          issueQty: 5,
          itemCode: 'ITEM-001',
          itemName: 'Item',
          unit: 'EA',
        } as any,
      ]);

      await target.scanIssue({
        matUid: 'MAT-001',
        warehouseCode: 'WH-01',
        issueType: 'PROD',
        workerId: 'worker',
      }, 'C1', 'P1');

      expect(mockMatLotRepo.findOne).toHaveBeenCalledWith({
        where: { matUid: 'MAT-001', company: 'C1', plant: 'P1' },
      });
      expect(mockMatStockRepo.find).toHaveBeenCalledWith({
        where: { matUid: 'MAT-001', warehouseCode: 'WH-01', company: 'C1', plant: 'P1' },
      });
      expect(mockPartMasterRepo.findOne).toHaveBeenCalledWith({
        where: { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' },
      });
    });

    it('스캔 출고 재고 행이 LOT 회사/공장과 다르면 출고하지 않는다', async () => {
      mockMatLotRepo.findOne.mockResolvedValue({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        iqcStatus: 'PASS',
        status: 'NORMAL',
        company: 'C1',
        plant: 'P1',
      } as MatLot);
      mockMatStockRepo.find.mockResolvedValue([
        { warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 5, availableQty: 5, company: 'OTHER', plant: 'P1' } as MatStock,
      ]);

      await expect(target.scanIssue({
        matUid: 'MAT-001',
        warehouseCode: 'WH-01',
        issueType: 'PROD',
        workerId: 'worker',
      }, 'C1', 'P1')).rejects.toThrow(BadRequestException);
    });
  });

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
          { warehouseCode: 'W1', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 3, availableQty: 3, company: 'HANES', plant: 'P01' } as MatStock,
          { warehouseCode: 'W2', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 4, availableQty: 4, company: 'HANES', plant: 'P01' } as MatStock,
        ])
        .mockResolvedValueOnce([
          { warehouseCode: 'W1', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 0, availableQty: 0, company: 'HANES', plant: 'P01' } as MatStock,
          { warehouseCode: 'W2', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 2, availableQty: 2, company: 'HANES', plant: 'P01' } as MatStock,
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
    } as any, 'HANES', 'P01');

    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ transNo: 'TX-001', qty: -3 }));
    expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ transNo: 'TX-002', qty: -2 }));
    expect(manager.update).toHaveBeenCalledWith(
      MatStock,
      { warehouseCode: 'W1', itemCode: 'ITEM-001', matUid: 'MAT-001', company: 'HANES', plant: 'P01' },
      { qty: 0, availableQty: 0 },
    );
    expect(manager.update).toHaveBeenCalledWith(
      MatStock,
      { warehouseCode: 'W2', itemCode: 'ITEM-001', matUid: 'MAT-001', company: 'HANES', plant: 'P01' },
      { qty: 2, availableQty: 2 },
    );
  });

  it('blocks create when an issue stock row belongs to a different tenant', async () => {
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
          {
            warehouseCode: 'W1',
            itemCode: 'ITEM-001',
            matUid: 'MAT-001',
            qty: 5,
            availableQty: 5,
            company: 'OTHER',
            plant: 'P01',
          } as MatStock,
        ])
        .mockResolvedValueOnce([]),
      create: jest.fn((entity, payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (entity) => entity),
      update: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;
    mockNumbering.nextInTx.mockResolvedValue('ISS-001');

    await expect(target.create({
      issueType: 'PROD',
      items: [{ matUid: 'MAT-001', issueQty: 5 }],
    } as any, 'HANES', 'P01')).rejects.toThrow(BadRequestException);

    expect(manager.update).not.toHaveBeenCalledWith(MatStock, expect.anything(), expect.anything());
  });

  it('cancel restores stock to the original warehouse rows', async () => {
    mockMatIssueRepo.findOne.mockResolvedValue({
      issueNo: 'ISS-001',
      seq: 1,
      status: 'DONE',
      matUid: 'MAT-001',
      issueQty: 5,
      company: 'HANES',
      plant: 'P01',
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
        .mockResolvedValueOnce({ warehouseCode: 'W1', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 0, availableQty: 0, company: 'HANES', plant: 'P01' } as MatStock)
        .mockResolvedValueOnce({ warehouseCode: 'W2', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 2, availableQty: 2, company: 'HANES', plant: 'P01' } as MatStock),
      create: jest.fn((entity, payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };
    (mockQueryRunner as any).manager = manager;

    mockNumbering.nextInTx
      .mockResolvedValueOnce('CANCEL-001')
      .mockResolvedValueOnce('CANCEL-002');

    await target.cancel('ISS-001', 1, 'cancel', 'HANES', 'P01');

    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(manager.update).toHaveBeenCalledWith(
      MatStock,
      { warehouseCode: 'W1', itemCode: 'ITEM-001', matUid: 'MAT-001', company: 'HANES', plant: 'P01' },
      { qty: 3, availableQty: 3 },
    );
    expect(manager.update).toHaveBeenCalledWith(
      MatStock,
      { warehouseCode: 'W2', itemCode: 'ITEM-001', matUid: 'MAT-001', company: 'HANES', plant: 'P01' },
      { qty: 4, availableQty: 4 },
    );
    expect(manager.update).toHaveBeenCalledWith(
      StockTransaction,
      { transNo: 'TX-001', company: 'HANES', plant: 'P01' },
      { status: 'CANCELED' },
    );
    expect(manager.update).toHaveBeenCalledWith(
      StockTransaction,
      { transNo: 'TX-002', company: 'HANES', plant: 'P01' },
      { status: 'CANCELED' },
    );
  });

  it('blocks cancel when the loaded issue belongs to a different tenant', async () => {
    mockMatIssueRepo.findOne.mockResolvedValue({
      issueNo: 'ISS-001',
      seq: 1,
      status: 'DONE',
      matUid: 'MAT-001',
      company: 'OTHER',
      plant: 'P01',
    } as MatIssue);

    await expect(target.cancel('ISS-001', 1, 'cancel', 'HANES', 'P01')).rejects.toThrow(BadRequestException);

    expect(mockTx.run).not.toHaveBeenCalled();
    expect(mockDataSource.getRepository).not.toHaveBeenCalled();
  });

  it('blocks cancel when an original stock transaction belongs to a different tenant', async () => {
    mockMatIssueRepo.findOne.mockResolvedValue({
      issueNo: 'ISS-001',
      seq: 1,
      status: 'DONE',
      matUid: 'MAT-001',
      company: 'HANES',
      plant: 'P01',
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
          company: 'OTHER',
          plant: 'P01',
        } as StockTransaction,
      ]),
      findOne: jest.fn(),
      create: jest.fn((entity, payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };
    (mockQueryRunner as any).manager = manager;

    await expect(target.cancel('ISS-001', 1, 'cancel', 'HANES', 'P01')).rejects.toThrow(BadRequestException);

    expect(manager.save).not.toHaveBeenCalled();
  });

  it('blocks cancel when the restore stock row belongs to a different tenant', async () => {
    mockMatIssueRepo.findOne.mockResolvedValue({
      issueNo: 'ISS-001',
      seq: 1,
      status: 'DONE',
      matUid: 'MAT-001',
      company: 'HANES',
      plant: 'P01',
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
      ]),
      findOne: jest.fn().mockResolvedValue({
        warehouseCode: 'W1',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: 0,
        availableQty: 0,
        company: 'OTHER',
        plant: 'P01',
      } as MatStock),
      create: jest.fn((entity, payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };
    (mockQueryRunner as any).manager = manager;
    mockNumbering.nextInTx.mockResolvedValue('CANCEL-001');

    await expect(target.cancel('ISS-001', 1, 'cancel', 'HANES', 'P01')).rejects.toThrow(BadRequestException);

    expect(manager.update).not.toHaveBeenCalledWith(
      MatStock,
      expect.anything(),
      expect.anything(),
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
