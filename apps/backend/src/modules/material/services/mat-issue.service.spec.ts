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
import { IssueRequestAllocationService } from './issue-request-allocation.service';
import { SysConfigService } from '../../system/services/sys-config.service';

/** FIFO 후보 LOT(MAT_STOCKS JOIN MAT_LOTS) raw row 를 돌려주는 QueryBuilder mock */
const createFifoCandidateQueryBuilder = (rows: Array<Record<string, unknown>>) => ({
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getRawMany: jest.fn().mockResolvedValue(rows),
});

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
  let mockAllocation: DeepMocked<IssueRequestAllocationService>;
  let mockSysConfigService: DeepMocked<SysConfigService>;

  const emptyAllocation = { allocations: [], allocatedQty: 0, unallocatedQty: 0 };

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
    mockAllocation = createMock<IssueRequestAllocationService>();
    mockAllocation.allocateIssuedQtyInTx.mockResolvedValue(emptyAllocation);
    mockSysConfigService = createMock<SysConfigService>();
    // 정책 키 미설정(null) = 기본값(FIFO_ENABLED=Y, RECEIVE_DATE, BLOCK, EXPIRED_ISSUE_BLOCK=Y)
    mockSysConfigService.getValue.mockResolvedValue(null);
    // FIFO 후보 LOT 기본값: 없음(테스트별로 덮어쓴다)
    mockMatStockRepo.createQueryBuilder.mockReturnValue(createFifoCandidateQueryBuilder([]) as any);

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
        { provide: IssueRequestAllocationService, useValue: mockAllocation },
        { provide: SysConfigService, useValue: mockSysConfigService },
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

      jest.spyOn(target, 'createInTx').mockResolvedValue([
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
        processCode: 'PRC1',
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
      jest.spyOn(target, 'createInTx').mockResolvedValue([
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
        processCode: 'PRC1',
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
        processCode: 'PRC1',
        workerId: 'worker',
      }, 'C1', 'P1')).rejects.toThrow(BadRequestException);
    });

    it('스캔 출고는 공정코드를 createInTx로 넘겨 공정재고 이동을 탄다', async () => {
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
      const createSpy = jest.spyOn(target, 'createInTx').mockResolvedValue([
        { issueNo: 'ISS-001', seq: 1, matUid: 'MAT-001', issueQty: 5 } as any,
      ]);

      await target.scanIssue({
        matUid: 'MAT-001',
        warehouseCode: 'WH-01',
        issueType: 'PROD',
        processCode: 'PRC1',
        workerId: 'worker',
      }, 'C1', 'P1');

      expect(createSpy).toHaveBeenCalledWith(
        mockQueryRunner,
        expect.objectContaining({
          processCode: 'PRC1',
          issueType: 'PROD',
          orderNo: undefined,
          items: [{ matUid: 'MAT-001', issueQty: 5 }],
        }),
        'C1',
        'P1',
      );
    });

    it('스캔 출고는 출고와 출고요청 배분을 한 트랜잭션에서 처리하고 배분 결과를 응답에 포함한다', async () => {
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
      const createSpy = jest.spyOn(target, 'createInTx').mockResolvedValue([
        { issueNo: 'ISS-001', seq: 1, matUid: 'MAT-001', issueQty: 5 } as any,
      ]);
      const allocation = {
        allocations: [{ requestNo: 'REQ-001', seq: 1, orderNo: 'WO-001', allocatedQty: 5, requestStatus: 'COMPLETED' as const }],
        allocatedQty: 5,
        unallocatedQty: 0,
      };
      mockAllocation.allocateIssuedQtyInTx.mockResolvedValue(allocation);

      const result = await target.scanIssue({
        matUid: 'MAT-001',
        warehouseCode: 'WH-01',
        issueType: 'PRODUCTION',
        processCode: 'PRC1',
        orderNo: 'WO-001',
        workerId: 'worker',
      }, 'C1', 'P1');

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      // MAT_ISSUES.ORDER_NO 기록
      expect(createSpy).toHaveBeenCalledWith(
        mockQueryRunner,
        expect.objectContaining({ orderNo: 'WO-001', processCode: 'PRC1' }),
        'C1',
        'P1',
      );
      // 출고 후 같은 QueryRunner로 배분
      expect(mockAllocation.allocateIssuedQtyInTx).toHaveBeenCalledWith(
        mockQueryRunner,
        expect.objectContaining({
          itemCode: 'ITEM-001',
          qty: 5,
          issueType: 'PRODUCTION',
          processCode: 'PRC1',
          orderNo: 'WO-001',
          company: 'C1',
          plant: 'P1',
        }),
        'ISS-001',
      );
      expect(result.allocation).toEqual(allocation);
      expect(result.issuedQty).toBe(5);
    });

    it('스캔 출고 중 배분이 실패하면 트랜잭션이 통째로 실패한다(출고만 남지 않음)', async () => {
      mockMatLotRepo.findOne.mockResolvedValue({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        iqcStatus: 'PASS',
        status: 'NORMAL',
      } as MatLot);
      mockMatStockRepo.find.mockResolvedValue([
        { warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 5, availableQty: 5 } as MatStock,
      ]);
      mockItemMasterRepo.findOne.mockResolvedValue(null);
      jest.spyOn(target, 'createInTx').mockResolvedValue([{ issueNo: 'ISS-001', seq: 1 } as any]);
      mockAllocation.allocateIssuedQtyInTx.mockRejectedValue(new Error('allocation failed'));

      await expect(target.scanIssue({
        matUid: 'MAT-001',
        issueType: 'PROD',
        processCode: 'PRC1',
      })).rejects.toThrow('allocation failed');
      expect(mockTx.run).toHaveBeenCalledTimes(1);
    });

    it('HOLD LOT 스캔 출고는 거부한다', async () => {
      mockMatLotRepo.findOne.mockResolvedValue({
        matUid: 'MAT-001', itemCode: 'ITEM-001', iqcStatus: 'PASS', status: 'HOLD',
      } as MatLot);
      const createInTx = jest.spyOn(target, 'createInTx');

      await expect(target.scanIssue({
        matUid: 'MAT-001', issueType: 'PROD', processCode: 'PRC1', workerId: 'worker',
      })).rejects.toThrow('보류 상태의 LOT는 출고할 수 없습니다');
      expect(createInTx).not.toHaveBeenCalled();
    });

    it.each(['MERGED', 'SPLIT', 'DISCARDED', 'DEPLETED'])(
      '종결 LOT(%s)은 MAT_STOCKS 잔량이 남아 있어도 스캔 출고를 거부한다',
      async (status) => {
        mockMatLotRepo.findOne.mockResolvedValue({
          matUid: 'MAT-001', itemCode: 'ITEM-001', iqcStatus: 'PASS', status,
        } as MatLot);
        mockMatStockRepo.find.mockResolvedValue([
          { warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 5, availableQty: 5 } as MatStock,
        ]);
        const createInTx = jest.spyOn(target, 'createInTx');

        await expect(target.scanIssue({
          matUid: 'MAT-001', issueType: 'PROD', processCode: 'PRC1', workerId: 'worker',
        })).rejects.toThrow(`출고할 수 없는 상태의 LOT입니다: MAT-001 (상태: ${status})`);
        expect(createInTx).not.toHaveBeenCalled();
      },
    );

    it('스캔 출고에 공정코드가 없으면 거부한다', async () => {
      mockMatLotRepo.findOne.mockResolvedValue({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        iqcStatus: 'PASS',
        status: 'NORMAL',
      } as MatLot);
      mockMatStockRepo.find.mockResolvedValue([
        { warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 5, availableQty: 5 } as MatStock,
      ]);

      await expect(target.scanIssue({
        matUid: 'MAT-001',
        issueType: 'PROD',
        workerId: 'worker',
      })).rejects.toThrow(/공정/);
    });

    it('특채 승인된 FAIL LOT은 스캔 출고가 가능하다', async () => {
      mockMatLotRepo.findOne.mockResolvedValue({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        iqcStatus: 'FAIL',
        specialAcceptYn: 'Y',
        status: 'NORMAL',
        company: 'C1',
        plant: 'P1',
      } as MatLot);
      mockMatStockRepo.find.mockResolvedValue([
        { warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 5, availableQty: 5, company: 'C1', plant: 'P1' } as MatStock,
      ]);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Item', unit: 'EA' } as ItemMaster);
      jest.spyOn(target, 'createInTx').mockResolvedValue([
        { issueNo: 'ISS-001', seq: 1, matUid: 'MAT-001', issueQty: 5 } as any,
      ]);

      const result = await target.scanIssue({
        matUid: 'MAT-001',
        warehouseCode: 'WH-01',
        issueType: 'PROD',
        processCode: 'PRC1',
        workerId: 'worker',
      }, 'C1', 'P1');

      expect(result.matUid).toBe('MAT-001');
      expect(result.issuedQty).toBe(5);
    });
  });

  it.each(['MERGED', 'SPLIT', 'DISCARDED'])('create: 종결 LOT(%s)은 재고가 남아 있어도 수동 출고를 거부한다', async (status) => {
    mockQueryRunner.manager.findOne.mockResolvedValueOnce({
      matUid: 'MAT-001', itemCode: 'ITEM-001', iqcStatus: 'PASS', status, company: 'C1', plant: 'P1',
    } as MatLot);
    mockQueryRunner.manager.find.mockResolvedValue([
      { warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 5, availableQty: 5, company: 'C1', plant: 'P1' } as MatStock,
    ]);

    await expect(target.create({
      issueType: 'ETC', workerId: 'worker',
      items: [{ matUid: 'MAT-001', issueQty: 1 }],
    } as any, 'C1', 'P1')).rejects.toThrow(`출고할 수 없는 상태의 LOT입니다: MAT-001 (상태: ${status})`);
    expect(mockQueryRunner.manager.save).not.toHaveBeenCalled();
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
      createQueryBuilder: jest.fn(() => ({ update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), setParameters: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue({ affected: 1 }) })),
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
      issueType: 'OTHER', // 비생산 출고 — 생산 출고(PROD)는 공정코드 필수라 재고 분할 자체를 검증하려면 기타출고로
      items: [{ matUid: 'MAT-001', issueQty: 5 }],
    } as any, 'HANES', 'P01');

    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ transNo: 'TX-001', qty: -3 }));
    expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ transNo: 'TX-002', qty: -2 }));
    expect(manager.createQueryBuilder).toHaveBeenCalledTimes(2);
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
      createQueryBuilder: jest.fn(() => ({ update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), setParameters: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue({ affected: 1 }) })),
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
    expect(manager.createQueryBuilder).toHaveBeenCalledTimes(1);
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

  it('keeps the simple MAT_OUT issue for a non-production issue type without processCode', async () => {
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
      createQueryBuilder: jest.fn(() => ({ update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), setParameters: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue({ affected: 1 }) })),
      update: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;

    mockNumbering.nextInTx
      .mockResolvedValueOnce('ISS-001')
      .mockResolvedValueOnce('TX-001');
    mockMatLotRepo.findOne.mockResolvedValue({ matUid: 'MAT-001', itemCode: 'ITEM-001' } as MatLot);
    mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001' } as ItemMaster);

    await target.create({
      issueType: 'OTHER',
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

  it('blocks a production issue without processCode instead of silently falling back to MAT_OUT', async () => {
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
      createQueryBuilder: jest.fn(() => ({ update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), setParameters: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue({ affected: 1 }) })),
      update: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;

    mockNumbering.nextInTx
      .mockResolvedValueOnce('ISS-001')
      .mockResolvedValueOnce('TX-001');
    mockMatLotRepo.findOne.mockResolvedValue({ matUid: 'MAT-001', itemCode: 'ITEM-001' } as MatLot);
    mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001' } as ItemMaster);

    await expect(target.create({
      issueType: 'PROD',
      items: [{ matUid: 'MAT-001', issueQty: 5 }],
    } as any, 'HANES', 'P01')).rejects.toThrow('공정코드가 필요합니다');

    // 출고 이력/재고 거래가 하나도 기록되지 않아야 한다(단순출고 폴백 제거)
    expect(manager.save).not.toHaveBeenCalled();
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

  describe('출고 정책(FIFO/유효기간) — createInTx 게이트', () => {
    /** 기타출고(공정 불필요) 1건을 처리하는 manager mock — LOT 1개, 창고 재고 1행 */
    const setupManager = (lot: Partial<MatLot>) => {
      const manager = {
        findOne: jest.fn().mockResolvedValue({
          matUid: 'MAT-NEW', itemCode: 'ITEM-001', iqcStatus: 'PASS', status: 'NORMAL', company: 'HANES', plant: 'P01',
          recvDate: new Date(2026, 8, 5), manufactureDate: new Date(2026, 8, 1), expireDate: null, currentQty: 5,
          ...lot,
        } as MatLot),
        find: jest.fn()
          .mockResolvedValueOnce([{ warehouseCode: 'W1', itemCode: 'ITEM-001', matUid: 'MAT-NEW', qty: 5, availableQty: 5, company: 'HANES', plant: 'P01' } as MatStock])
          .mockResolvedValueOnce([{ warehouseCode: 'W1', itemCode: 'ITEM-001', matUid: 'MAT-NEW', qty: 0, availableQty: 0, company: 'HANES', plant: 'P01' } as MatStock]),
        create: jest.fn((entity, payload) => ({ ...payload })),
        save: jest.fn().mockImplementation(async (entity) => entity),
        createQueryBuilder: jest.fn(() => ({ update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), setParameters: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue({ affected: 1 }) })),
        update: jest.fn().mockResolvedValue(undefined),
      };
      (mockQueryRunner as any).manager = manager;
      mockNumbering.nextInTx.mockResolvedValueOnce('ISS-001').mockResolvedValueOnce('TX-001');
      mockMatLotRepo.findOne.mockResolvedValue({ matUid: 'MAT-NEW', itemCode: 'ITEM-001' } as MatLot);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001' } as ItemMaster);
      return manager;
    };
    const issueDto = { issueType: 'OTHER', warehouseCode: 'W1', items: [{ matUid: 'MAT-NEW', issueQty: 5 }] } as any;
    const configBy = (values: Record<string, string | null>) =>
      mockSysConfigService.getValue.mockImplementation(async (key: string) => values[key] ?? null);

    it('FIFO BLOCK(기본): 더 오래된 출고가능 LOT 가 있으면 먼저 낼 LOT 와 기준일을 담아 차단한다', async () => {
      const manager = setupManager({});
      mockMatStockRepo.createQueryBuilder.mockReturnValue(createFifoCandidateQueryBuilder([
        { matUid: 'MAT-OLD', recvDate: new Date(2026, 8, 1), manufactureDate: null, lotStatus: 'NORMAL' },
      ]) as any);

      await expect(target.create(issueDto, 'HANES', 'P01')).rejects.toThrow(/FIFO.*MAT-OLD.*2026-09-01/);
      // 재고 차감 전에 막힌다
      expect(manager.createQueryBuilder).not.toHaveBeenCalled();
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('FIFO WARN: 출고는 진행하고 결과 행에 warnings 를 싣는다', async () => {
      configBy({ FIFO_ACTION: 'WARN' });
      const manager = setupManager({});
      mockMatStockRepo.createQueryBuilder.mockReturnValue(createFifoCandidateQueryBuilder([
        { matUid: 'MAT-OLD', recvDate: new Date(2026, 8, 1), manufactureDate: null, lotStatus: 'NORMAL' },
      ]) as any);

      const result = await target.create(issueDto, 'HANES', 'P01');

      expect(manager.createQueryBuilder).toHaveBeenCalledTimes(1);
      expect(result[0].warnings).toHaveLength(1);
      expect(result[0].warnings[0]).toMatch(/FIFO.*MAT-OLD/);
    });

    it('기준일이 같은 LOT 는 위반이 아니다', async () => {
      setupManager({});
      mockMatStockRepo.createQueryBuilder.mockReturnValue(createFifoCandidateQueryBuilder([
        { matUid: 'MAT-SAME', recvDate: new Date(2026, 8, 5, 9, 0), manufactureDate: null, lotStatus: 'NORMAL' },
      ]) as any);

      const result = await target.create(issueDto, 'HANES', 'P01');
      expect(result[0].warnings).toEqual([]);
    });

    it('기준일이 null 인 후보 LOT 는 순서를 만들지 않는다', async () => {
      setupManager({});
      mockMatStockRepo.createQueryBuilder.mockReturnValue(createFifoCandidateQueryBuilder([
        { matUid: 'MAT-NODATE', recvDate: null, manufactureDate: null, lotStatus: 'NORMAL' },
      ]) as any);

      const result = await target.create(issueDto, 'HANES', 'P01');
      expect(result[0].warnings).toEqual([]);
    });

    it('FIFO_CRITERIA=MFG_DATE 면 제조일로 비교한다', async () => {
      configBy({ FIFO_CRITERIA: 'MFG_DATE' });
      setupManager({});
      // 입고일은 더 늦지만 제조일이 더 빠른 LOT → MFG_DATE 기준 위반
      mockMatStockRepo.createQueryBuilder.mockReturnValue(createFifoCandidateQueryBuilder([
        { matUid: 'MAT-OLDMFG', recvDate: new Date(2026, 8, 8), manufactureDate: new Date(2026, 7, 20), lotStatus: 'NORMAL' },
      ]) as any);

      await expect(target.create(issueDto, 'HANES', 'P01')).rejects.toThrow(/제조일.*MAT-OLDMFG.*2026-08-20/);
    });

    it('수리 부품 소비(REPAIR)는 FIFO_APPLY_REPAIR 미설정(기본 N)이면 FIFO 후보를 조회하지 않는다', async () => {
      setupManager({});
      mockMatStockRepo.createQueryBuilder.mockReturnValue(createFifoCandidateQueryBuilder([
        { matUid: 'MAT-OLD', recvDate: new Date(2026, 8, 1), manufactureDate: null, lotStatus: 'NORMAL' },
      ]) as any);

      const result = await target.create({ ...issueDto, issueType: 'REPAIR' }, 'HANES', 'P01');

      expect(mockMatStockRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(result[0].warnings).toEqual([]);
    });

    it('수리 부품 소비(REPAIR)도 FIFO_APPLY_REPAIR=Y 면 FIFO BLOCK 이 적용된다', async () => {
      configBy({ FIFO_APPLY_REPAIR: 'Y' });
      const manager = setupManager({});
      mockMatStockRepo.createQueryBuilder.mockReturnValue(createFifoCandidateQueryBuilder([
        { matUid: 'MAT-OLD', recvDate: new Date(2026, 8, 1), manufactureDate: null, lotStatus: 'NORMAL' },
      ]) as any);

      await expect(target.create({ ...issueDto, issueType: 'REPAIR' }, 'HANES', 'P01')).rejects.toThrow(/FIFO.*MAT-OLD/);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('수리 부품 소비(REPAIR)는 FIFO 를 건너뛰어도 유효기간 만료 차단은 그대로다', async () => {
      const manager = setupManager({ expireDate: new Date(2026, 0, 1) });

      await expect(target.create({ ...issueDto, issueType: 'REPAIR' }, 'HANES', 'P01')).rejects.toThrow(/유효기간이 만료된 LOT/);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('FIFO_ENABLED=N 이면 후보 LOT 를 조회하지 않는다', async () => {
      configBy({ FIFO_ENABLED: 'N' });
      setupManager({});

      const result = await target.create(issueDto, 'HANES', 'P01');

      expect(mockMatStockRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(result[0].warnings).toEqual([]);
    });

    it('설정은 출고 1건당 1회만 읽는다(항목 루프 안 반복 조회 금지)', async () => {
      const manager = setupManager({});
      manager.find
        .mockReset()
        .mockResolvedValue([{ warehouseCode: 'W1', itemCode: 'ITEM-001', matUid: 'MAT-NEW', qty: 50, availableQty: 50, company: 'HANES', plant: 'P01' } as MatStock]);
      mockNumbering.nextInTx.mockReset().mockResolvedValue('TX-N');

      await target.create({ ...issueDto, items: [{ matUid: 'MAT-NEW', issueQty: 1 }, { matUid: 'MAT-NEW', issueQty: 1 }, { matUid: 'MAT-NEW', issueQty: 1 }] }, 'HANES', 'P01');

      // 5키(FIFO_ENABLED/FIFO_CRITERIA/FIFO_ACTION/EXPIRED_ISSUE_BLOCK/FIFO_APPLY_REPAIR) × 1회
      expect(mockSysConfigService.getValue).toHaveBeenCalledTimes(5);
      // 후보 LOT 조회는 항목마다 1쿼리
      expect(mockMatStockRepo.createQueryBuilder).toHaveBeenCalledTimes(3);
    });

    it('유효기간 만료 LOT 는 EXPIRED_ISSUE_BLOCK=Y(기본)에서 항상 차단한다', async () => {
      const manager = setupManager({ expireDate: new Date(2026, 0, 1) });

      await expect(target.create(issueDto, 'HANES', 'P01')).rejects.toThrow(/유효기간이 만료된 LOT.*MAT-NEW.*2026-01-01/);
      expect(manager.save).not.toHaveBeenCalled();
      // 만료 차단은 FIFO 후보 조회보다 먼저
      expect(mockMatStockRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('EXPIRED_ISSUE_BLOCK=N 이면 만료 LOT 도 출고한다', async () => {
      configBy({ EXPIRED_ISSUE_BLOCK: 'N' });
      setupManager({ expireDate: new Date(2026, 0, 1) });

      const result = await target.create(issueDto, 'HANES', 'P01');
      expect(result[0].warnings).toEqual([]);
    });

    it('유효기한이 오늘이면 만료가 아니다', async () => {
      const today = new Date();
      setupManager({ expireDate: new Date(today.getFullYear(), today.getMonth(), today.getDate()) });

      const result = await target.create(issueDto, 'HANES', 'P01');
      expect(result[0].warnings).toEqual([]);
    });
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
    (manager as any).createQueryBuilder = jest.fn(() => ({ update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), setParameters: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue({ affected: 1 }) }));
    (mockQueryRunner as any).manager = manager;

    mockNumbering.nextInTx
      .mockResolvedValueOnce('CANCEL-001')
      .mockResolvedValueOnce('CANCEL-002');

    await target.cancel('ISS-001', 1, 'cancel', 'HANES', 'P01');

    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    expect((manager as any).createQueryBuilder).toHaveBeenCalledTimes(2);
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
    (manager as any).createQueryBuilder = jest.fn(() => ({ update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), setParameters: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue({ affected: 1 }) }));
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
    expect((manager as any).createQueryBuilder).toHaveBeenCalledTimes(1);
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

  it('blocks cancellation of materials already consumed by a repair order', async () => {
    mockMatIssueRepo.findOne.mockResolvedValue({
      issueNo: 'ISS-REPAIR', seq: 1, status: 'DONE', issueType: 'REPAIR', remark: 'REPAIR:71',
      company: 'HANES', plant: 'P01',
    } as MatIssue);
    await expect(target.cancel('ISS-REPAIR', 1, 'cancel', 'HANES', 'P01')).rejects.toThrow('수리');
    expect(mockTx.run).not.toHaveBeenCalled();
    expect(mockQueryRunner.manager.update).not.toHaveBeenCalled();
  });

  it.each([
    { issueType: 'REPAIR', remark: '일반 수리용 자재 출고' },
    { issueType: 'OTHER', remark: 'REPAIR:71' },
  ])('keeps ordinary material issue cancellation available: %j', async (fields) => {
    mockMatIssueRepo.findOne.mockResolvedValue({
      issueNo: 'ISS-ORDINARY', seq: 1, status: 'DONE', company: 'HANES', plant: 'P01', ...fields,
    } as MatIssue);
    mockQueryRunner.manager.find.mockResolvedValue([]);
    await target.cancel('ISS-ORDINARY', 1, 'cancel', 'HANES', 'P01');
    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(MatIssue,
      { issueNo: 'ISS-ORDINARY', seq: 1, company: 'HANES', plant: 'P01' },
      { status: 'CANCELED', remark: 'cancel' });
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
