/**
 * @file src/modules/material/services/mat-issue.service.spec.ts
 * @description MatIssueService 단위 테스트 - 자재출고, 바코드 스캔 출고, 출고취소
 *
 * 초보자 가이드:
 * - create: 트랜잭션으로 LOT 검증 → 재고 차감 → StockTransaction 생성
 * - scanIssue: 바코드(matUid)로 LOT 전량 출고
 * - cancel: 역분개 방식 출고 취소
 * - 실행: `npx jest --testPathPattern="mat-issue.service.spec"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { MatIssueService } from './mat-issue.service';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { NumRuleService } from '../../num-rule/num-rule.service';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

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
  let mockNumRuleService: DeepMocked<NumRuleService>;

  const createLot = (overrides: Partial<MatLot> = {}): MatLot =>
    ({
      matUid: 'MAT-001',
      itemCode: 'ITEM-001',
      initQty: 100,
      iqcStatus: 'PASS',
      status: 'NORMAL',
      company: 'HANES',
      plant: 'P01',
      ...overrides,
    }) as MatLot;

  beforeEach(async () => {
    mockMatIssueRepo = createMock<Repository<MatIssue>>();
    mockMatLotRepo = createMock<Repository<MatLot>>();
    mockMatStockRepo = createMock<Repository<MatStock>>();
    mockStockTxRepo = createMock<Repository<StockTransaction>>();
    mockPartMasterRepo = createMock<Repository<PartMaster>>();
    mockJobOrderRepo = createMock<Repository<JobOrder>>();
    mockDataSource = createMock<DataSource>();
    mockQueryRunner = createMock<QueryRunner>();
    mockNumRuleService = createMock<NumRuleService>();

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
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
        { provide: NumRuleService, useValue: mockNumRuleService },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<MatIssueService>(MatIssueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findAll ───
  describe('findAll', () => {
    it('출고 이력 목록을 반환한다', async () => {
      const issue = { issueNo: 'ISS-001', seq: 1, matUid: 'MAT-001', orderNo: null } as MatIssue;
      mockMatIssueRepo.find.mockResolvedValue([issue]);
      mockMatIssueRepo.count.mockResolvedValue(1);
      mockMatLotRepo.findOne.mockResolvedValue(createLot());
      mockPartMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as PartMaster);
      mockJobOrderRepo.findOne.mockResolvedValue(null);

      const result = await target.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ─── findById ───
  describe('findById', () => {
    it('출고 이력을 issueNo + seq로 조회한다', async () => {
      const issue = { issueNo: 'ISS-001', seq: 1, matUid: 'MAT-001', orderNo: null } as MatIssue;
      mockMatIssueRepo.findOne.mockResolvedValue(issue);
      mockMatLotRepo.findOne.mockResolvedValue(createLot());
      mockPartMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as PartMaster);
      mockJobOrderRepo.findOne.mockResolvedValue(null);

      const result = await target.findById('ISS-001', 1);

      expect(result).not.toBeNull();
    });

    it('존재하지 않으면 NotFoundException', async () => {
      mockMatIssueRepo.findOne.mockResolvedValue(null);

      await expect(target.findById('NONE', 1)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ───
  describe('create', () => {
    it('LOT이 존재하지 않으면 BadRequestException', async () => {
      mockNumRuleService.nextNumberInTx.mockResolvedValue('ISS-001');
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(null); // lot not found

      await expect(
        target.create({
          issueType: 'PROD',
          items: [{ matUid: 'NONE', issueQty: 10 }],
        } as any),
      ).rejects.toThrow(BadRequestException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('IQC 미합격 LOT이면 BadRequestException', async () => {
      mockNumRuleService.nextNumberInTx.mockResolvedValue('ISS-001');
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(createLot({ iqcStatus: 'PENDING' }));

      await expect(
        target.create({
          issueType: 'PROD',
          items: [{ matUid: 'MAT-001', issueQty: 10 }],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('HOLD 상태 LOT이면 BadRequestException', async () => {
      mockNumRuleService.nextNumberInTx.mockResolvedValue('ISS-001');
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(createLot({ status: 'HOLD' }));

      await expect(
        target.create({
          issueType: 'PROD',
          items: [{ matUid: 'MAT-001', issueQty: 10 }],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('재고 부족이면 BadRequestException', async () => {
      const lot = createLot();
      mockNumRuleService.nextNumberInTx.mockResolvedValue('ISS-001');
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(lot) // lot 조회
        .mockResolvedValueOnce({ qty: 5 } as MatStock); // stock 조회 (부족)

      await expect(
        target.create({
          issueType: 'PROD',
          items: [{ matUid: 'MAT-001', issueQty: 10 }],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── cancel ───
  describe('cancel', () => {
    it('존재하지 않는 출고이면 NotFoundException', async () => {
      mockMatIssueRepo.findOne.mockResolvedValue(null);

      await expect(target.cancel('NONE', 1)).rejects.toThrow(NotFoundException);
    });

    it('이미 취소된 출고이면 BadRequestException', async () => {
      mockMatIssueRepo.findOne.mockResolvedValue({ issueNo: 'ISS-001', seq: 1, status: 'CANCELED' } as MatIssue);

      await expect(target.cancel('ISS-001', 1)).rejects.toThrow(BadRequestException);
    });

    it('정상 출고를 취소하면 역분개 처리한다', async () => {
      const issue = { issueNo: 'ISS-001', seq: 1, status: 'DONE', matUid: 'MAT-001', issueQty: 10 } as MatIssue;
      mockMatIssueRepo.findOne.mockResolvedValue(issue);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ transNo: 'TX-001', qty: -10, fromWarehouseId: 'WH-01', company: 'HANES', plant: 'P01' } as StockTransaction) // originalTx
        .mockResolvedValueOnce({ warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 0, availableQty: 0 } as MatStock); // stock
      mockNumRuleService.nextNumberInTx.mockResolvedValue('CANCEL-001');
      mockQueryRunner.manager.create.mockReturnValue({} as any);
      mockQueryRunner.manager.save.mockResolvedValue({} as any);

      const result = await target.cancel('ISS-001', 1);

      expect(result.status).toBe('CANCELED');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });
});
