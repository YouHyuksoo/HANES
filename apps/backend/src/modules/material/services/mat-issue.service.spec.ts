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
import { ItemMaster } from '../../../entities/item-master.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';
import { ProcMatStockService } from '../../inventory/services/proc-mat-stock.service';

describe('MatIssueService', () => {
  let target: MatIssueService;
  let mockMatIssueRepo: DeepMocked<Repository<MatIssue>>;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockMatStockRepo: DeepMocked<Repository<MatStock>>;
  let mockStockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let mockItemMasterRepo: DeepMocked<Repository<ItemMaster>>;
  let mockJobOrderRepo: DeepMocked<Repository<JobOrder>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;
  let mockNumbering: DeepMocked<NumberingService>;
  let mockTx: DeepMocked<TransactionService>;
  let mockProcMatStockService: DeepMocked<ProcMatStockService>;

  beforeEach(async () => {
    mockMatIssueRepo = createMock<Repository<MatIssue>>();
    mockMatLotRepo = createMock<Repository<MatLot>>();
    mockMatStockRepo = createMock<Repository<MatStock>>();
    mockStockTxRepo = createMock<Repository<StockTransaction>>();
    mockItemMasterRepo = createMock<Repository<ItemMaster>>();
    mockJobOrderRepo = createMock<Repository<JobOrder>>();
    mockDataSource = createMock<DataSource>();
    mockQueryRunner = createMock<QueryRunner>();
    mockNumbering = createMock<NumberingService>();
    mockTx = createMock<TransactionService>();
    mockProcMatStockService = createMock<ProcMatStockService>();

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
        { provide: getRepositoryToken(ItemMaster), useValue: mockItemMasterRepo },
        { provide: getRepositoryToken(JobOrder), useValue: mockJobOrderRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: NumberingService, useValue: mockNumbering },
        { provide: TransactionService, useValue: mockTx },
        { provide: ProcMatStockService, useValue: mockProcMatStockService },
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
      mockItemMasterRepo.find.mockResolvedValue([]);

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
      mockItemMasterRepo.find.mockResolvedValue([]);

      await target.findAll({ page: 1, limit: 10 }, 'C1', 'P1');

      expect(mockMatLotRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
      expect(mockJobOrderRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
      expect(mockItemMasterRepo.find).toHaveBeenCalledWith({
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
      mockItemMasterRepo.findOne.mockResolvedValue(null);

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
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Item', unit: 'EA' } as ItemMaster);
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
      expect(mockItemMasterRepo.findOne).toHaveBeenCalledWith({
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
    mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001' } as ItemMaster);

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

  it('moves stock to the process PROC_MAT_STOCKS when processCode is given', async () => {
    const manager = {
      findOne: jest
        .fn()
        // LOT 조회 (출고는 더 이상 JobOrder/설비를 보지 않는다 — processCode 직접 지정)
        .mockResolvedValueOnce({
          matUid: 'MAT-001',
          itemCode: 'ITEM-001',
          iqcStatus: 'PASS',
          status: 'NORMAL',
          company: 'HANES',
          plant: 'P01',
        } as MatLot),
      find: jest
        .fn()
        // 출고 대상 재고
        .mockResolvedValueOnce([
          { warehouseCode: 'RM_MAIN', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 5, availableQty: 5, company: 'HANES', plant: 'P01' } as MatStock,
        ])
        // 출고 후 원자재 잔여 재고 (공정재고는 별도 테이블이라 여기엔 안 잡힘 → DEPLETED 처리됨)
        .mockResolvedValueOnce([
          { warehouseCode: 'RM_MAIN', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 0, availableQty: 0, company: 'HANES', plant: 'P01' } as MatStock,
        ]),
      create: jest.fn((entity, payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (entity) => entity),
      update: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;

    mockProcMatStockService.addStockInTx.mockResolvedValue(undefined);

    mockNumbering.nextInTx
      .mockResolvedValueOnce('ISS-001')
      .mockResolvedValueOnce('TX-001');
    mockMatLotRepo.findOne.mockResolvedValue({ matUid: 'MAT-001', itemCode: 'ITEM-001' } as MatLot);
    mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001' } as ItemMaster);

    await target.create({
      processCode: 'PRC1',
      issueType: 'PROD',
      items: [{ matUid: 'MAT-001', issueQty: 5 }],
    } as any, 'HANES', 'P01');

    // 원자재 STOCK_TRANSACTIONS 는 PROC_MOVE(from=원자재창고, qty-)
    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        transNo: 'TX-001',
        transType: 'PROC_MOVE',
        fromWarehouseId: 'RM_MAIN',
        toWarehouseId: null,
        qty: -5,
      }),
    );
    // 원자재창고 차감
    expect(manager.update).toHaveBeenCalledWith(
      MatStock,
      { warehouseCode: 'RM_MAIN', itemCode: 'ITEM-001', matUid: 'MAT-001', company: 'HANES', plant: 'P01' },
      { qty: 0, availableQty: 0 },
    );
    // 공정재고 가산은 ProcMatStockService.addStockInTx 로 위임(PROC_MAT_STOCKS)
    expect(mockProcMatStockService.addStockInTx).toHaveBeenCalledWith(
      mockQueryRunner,
      expect.objectContaining({
        processCode: 'PRC1',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: 5,
        transType: 'PROC_IN',
        fromWarehouseId: 'RM_MAIN',
        refType: 'MAT_ISSUE',
        refId: 'ISS-001-1',
        company: 'HANES',
        plant: 'P01',
      }),
    );
  });

  it('keeps the simple MAT_OUT issue when orderNo is absent', async () => {
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
          { warehouseCode: 'RM_MAIN', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 5, availableQty: 5, company: 'HANES', plant: 'P01' } as MatStock,
        ])
        .mockResolvedValueOnce([
          { warehouseCode: 'RM_MAIN', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 0, availableQty: 0, company: 'HANES', plant: 'P01' } as MatStock,
        ]),
      create: jest.fn((entity, payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (entity) => entity),
      update: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;

    mockNumbering.nextInTx
      .mockResolvedValueOnce('ISS-001')
      .mockResolvedValueOnce('TX-001');
    mockMatLotRepo.findOne.mockResolvedValue({ matUid: 'MAT-001', itemCode: 'ITEM-001' } as MatLot);
    mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001' } as ItemMaster);

    await target.create({
      issueType: 'PROD',
      items: [{ matUid: 'MAT-001', issueQty: 5 }],
    } as any, 'HANES', 'P01');

    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        transNo: 'TX-001',
        transType: 'MAT_OUT',
        fromWarehouseId: 'RM_MAIN',
        toWarehouseId: null,
        qty: -5,
      }),
    );
    // 공정재고 가산(addStockInTx)이 호출되지 않아야 한다
    expect(mockProcMatStockService.addStockInTx).not.toHaveBeenCalled();
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
    // 역분개 거래는 MAT_OUT_CANCEL 로 기록한다.
    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({ transNo: 'CANCEL-001', transType: 'MAT_OUT_CANCEL', qty: 3 }),
    );
    // 설비 미배정 단순출고 취소는 공정재고를 건드리지 않는다.
    expect(mockProcMatStockService.restoreInTx).not.toHaveBeenCalled();
  });

  it('reverses a PROC_MOVE issue: restores raw warehouse and delegates proc stock deduction to restoreInTx', async () => {
    mockMatIssueRepo.findOne.mockResolvedValue({
      issueNo: 'ISS-009',
      seq: 1,
      status: 'DONE',
      matUid: 'MAT-001',
      orderNo: 'JO-001',
      issueQty: 5,
      company: 'HANES',
      plant: 'P01',
    } as MatIssue);

    const manager = {
      update: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([
        {
          transNo: 'TX-001',
          transType: 'PROC_MOVE',
          fromWarehouseId: 'RM_MAIN',
          toWarehouseId: null,
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: -5,
          company: 'HANES',
          plant: 'P01',
        } as StockTransaction,
      ]),
      findOne: jest
        .fn()
        // 원자재창고 재고 조회 (복원 대상)
        .mockResolvedValueOnce({ warehouseCode: 'RM_MAIN', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 0, availableQty: 0, company: 'HANES', plant: 'P01' } as MatStock),
      create: jest.fn((entity, payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };
    (mockQueryRunner as any).manager = manager;

    mockProcMatStockService.restoreInTx.mockResolvedValue([]);
    mockNumbering.nextInTx.mockResolvedValueOnce('CANCEL-001');

    await target.cancel('ISS-009', 1, 'cancel', 'HANES', 'P01');

    // 원자재측 역분개 거래: PROC_MOVE_CANCEL, 원자재창고 복원
    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        transNo: 'CANCEL-001',
        transType: 'PROC_MOVE_CANCEL',
        fromWarehouseId: 'RM_MAIN',
        toWarehouseId: 'RM_MAIN',
        qty: 5,
        cancelRefId: 'TX-001',
      }),
    );
    // 원자재창고 복원
    expect(manager.update).toHaveBeenCalledWith(
      MatStock,
      { warehouseCode: 'RM_MAIN', itemCode: 'ITEM-001', matUid: 'MAT-001', company: 'HANES', plant: 'P01' },
      { qty: 5, availableQty: 5 },
    );
    // 원본 거래 취소 처리
    expect(manager.update).toHaveBeenCalledWith(
      StockTransaction,
      { transNo: 'TX-001', company: 'HANES', plant: 'P01' },
      { status: 'CANCELED' },
    );
    // 공정재고 차감은 ProcMatStockService.restoreInTx(DEDUCT_BACK)로 위임
    expect(mockProcMatStockService.restoreInTx).toHaveBeenCalledWith(
      mockQueryRunner,
      expect.objectContaining({
        mode: 'DEDUCT_BACK',
        refType: 'MAT_ISSUE',
        refId: 'ISS-009-1',
        cancelTransType: 'PROC_IN_CANCEL',
        originTransType: 'PROC_IN',
        orderNo: 'JO-001',
        company: 'HANES',
        plant: 'P01',
      }),
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
