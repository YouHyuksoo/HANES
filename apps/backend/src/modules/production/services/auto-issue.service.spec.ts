/**
 * @file src/modules/production/services/auto-issue.service.spec.ts
 * @description AutoIssueService 단위 테스트 - BOM 기반 자재 자동차감 로직 검증
 *
 * 초보자 가이드:
 * - `target`: 테스트 대상(SUT), `mock*`: 모킹된 의존성
 * - SysConfig 타이밍 체크, FIFO 차감, 재고 부족 정책을 검증
 * - 실행: `npx jest --testPathPattern="auto-issue.service.spec"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { AutoIssueService } from './auto-issue.service';
import { BomMaster } from '../../../entities/bom-master.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { SysConfigService } from '../../system/services/sys-config.service';
import { NumRuleService } from '../../num-rule/num-rule.service';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('AutoIssueService', () => {
  let target: AutoIssueService;
  let mockBomRepo: DeepMocked<Repository<BomMaster>>;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockMatStockRepo: DeepMocked<Repository<MatStock>>;
  let mockMatIssueRepo: DeepMocked<Repository<MatIssue>>;
  let mockStockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let mockJobOrderRepo: DeepMocked<Repository<JobOrder>>;
  let mockSysConfigService: DeepMocked<SysConfigService>;
  let mockNumRuleService: DeepMocked<NumRuleService>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockBomRepo = createMock<Repository<BomMaster>>();
    mockMatLotRepo = createMock<Repository<MatLot>>();
    mockMatStockRepo = createMock<Repository<MatStock>>();
    mockMatIssueRepo = createMock<Repository<MatIssue>>();
    mockStockTxRepo = createMock<Repository<StockTransaction>>();
    mockJobOrderRepo = createMock<Repository<JobOrder>>();
    mockSysConfigService = createMock<SysConfigService>();
    mockNumRuleService = createMock<NumRuleService>();
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
        AutoIssueService,
        { provide: getRepositoryToken(BomMaster), useValue: mockBomRepo },
        { provide: getRepositoryToken(MatLot), useValue: mockMatLotRepo },
        { provide: getRepositoryToken(MatStock), useValue: mockMatStockRepo },
        { provide: getRepositoryToken(MatIssue), useValue: mockMatIssueRepo },
        { provide: getRepositoryToken(StockTransaction), useValue: mockStockTxRepo },
        { provide: getRepositoryToken(JobOrder), useValue: mockJobOrderRepo },
        { provide: SysConfigService, useValue: mockSysConfigService },
        { provide: NumRuleService, useValue: mockNumRuleService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<AutoIssueService>(AutoIssueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────
  // execute - timing skip
  // ─────────────────────────────────────────────
  describe('execute - timing', () => {
    it('should skip when config timing does not match', async () => {
      // Arrange
      mockSysConfigService.getValue.mockResolvedValue('ON_COMPLETE');

      // Act
      const result = await target.execute('ON_CREATE', 1, 'JO-001', 50);

      // Assert
      expect(result.skipped).toBe(true);
      expect(result.issued).toHaveLength(0);
    });

    it('should skip when config timing is null', async () => {
      // Arrange
      mockSysConfigService.getValue.mockResolvedValue(null);

      // Act
      const result = await target.execute('ON_CREATE', 1, 'JO-001', 50);

      // Assert
      expect(result.skipped).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // execute - no BOM
  // ─────────────────────────────────────────────
  describe('execute - no BOM', () => {
    it('should skip when no BOM found', async () => {
      // Arrange
      mockSysConfigService.getValue.mockResolvedValue('ON_CREATE');
      mockQueryRunner.manager.findOne.mockResolvedValue({ orderNo: 'JO-001', itemCode: 'PART-001' });
      mockQueryRunner.manager.query.mockResolvedValue([]); // no BOM

      // Act
      const result = await target.execute('ON_CREATE', 1, 'JO-001', 50, mockQueryRunner);

      // Assert
      expect(result.skipped).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // execute - happy path (own transaction)
  // ─────────────────────────────────────────────
  describe('execute - happy path with own transaction', () => {
    it('should create own transaction when no external QR', async () => {
      // Arrange
      mockSysConfigService.getValue
        .mockResolvedValueOnce('ON_CREATE')  // timing
        .mockResolvedValueOnce('WARN');      // stock check policy

      // We don't pass externalQR, so it creates its own
      const ownQR = createMock<QueryRunner>();
      mockDataSource.createQueryRunner.mockReturnValue(ownQR);
      ownQR.connect.mockResolvedValue(undefined);
      ownQR.startTransaction.mockResolvedValue(undefined);
      ownQR.commitTransaction.mockResolvedValue(undefined);
      ownQR.release.mockResolvedValue(undefined);

      ownQR.manager.findOne.mockResolvedValue({ orderNo: 'JO-001', itemCode: 'PART-001' });
      ownQR.manager.query.mockResolvedValue([]); // no BOM

      // Act
      const result = await target.execute('ON_CREATE', 1, 'JO-001', 50);

      // Assert
      expect(result.skipped).toBe(true);
      expect(ownQR.commitTransaction).toHaveBeenCalled();
      expect(ownQR.release).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // execute - job order not found
  // ─────────────────────────────────────────────
  describe('execute - job order not found', () => {
    it('should throw BadRequestException when job order not found', async () => {
      // Arrange
      mockSysConfigService.getValue.mockResolvedValue('ON_CREATE');
      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        target.execute('ON_CREATE', 1, 'JO-INVALID', 50, mockQueryRunner),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  // execute - FIFO deduction with external QR
  // ─────────────────────────────────────────────
  describe('execute - FIFO deduction', () => {
    it('should deduct stock FIFO when BOM and stock exist', async () => {
      // Arrange
      mockSysConfigService.getValue
        .mockResolvedValueOnce('ON_CREATE')  // timing
        .mockResolvedValueOnce('BLOCK');     // stock check policy

      mockQueryRunner.manager.findOne.mockResolvedValue({
        orderNo: 'JO-001', itemCode: 'FG-001',
      });

      // BOM query
      mockQueryRunner.manager.query.mockResolvedValue([
        { parentItemCode: 'FG-001', childItemCode: 'RM-001', qtyPer: 2, useYn: 'Y' },
      ]);

      // FIFO lots
      const mockLotQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { matUid: 'LOT-001', company: 'C', plant: 'P' },
        ]),
      };
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue(mockLotQb as any);

      // MatStock for LOT-001
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([{ warehouseCode: 'WH-RM', itemCode: 'RM-001', matUid: 'LOT-001', qty: 200, availableQty: 200, createdAt: new Date() }]) // stock for lot
        .mockResolvedValueOnce([{ warehouseCode: 'WH-RM', itemCode: 'RM-001', matUid: 'LOT-001', qty: 200, availableQty: 200, createdAt: new Date() }]) // deductMatStock
        .mockResolvedValueOnce([{ matUid: 'LOT-001', qty: 100 }]); // remaining check

      mockNumRuleService.nextNumberInTx
        .mockResolvedValueOnce('ISS-001') // MatIssue
        .mockResolvedValueOnce('TX-001'); // StockTransaction

      mockQueryRunner.manager.create.mockImplementation((_: any, data: any) => data);
      mockQueryRunner.manager.save.mockResolvedValue({} as any);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.execute('ON_CREATE', 1, 'JO-001', 50, mockQueryRunner);

      // Assert
      expect(result.skipped).toBe(false);
      expect(result.issued).toHaveLength(1);
      expect(result.issued[0].itemCode).toBe('RM-001');
      expect(result.issued[0].issueQty).toBe(100); // 2 * 50
    });

    it('should throw BadRequestException on stock shortage with BLOCK policy', async () => {
      // Arrange
      mockSysConfigService.getValue
        .mockResolvedValueOnce('ON_CREATE')  // timing
        .mockResolvedValueOnce('BLOCK');     // stock check policy

      mockQueryRunner.manager.findOne.mockResolvedValue({
        orderNo: 'JO-001', itemCode: 'FG-001',
      });

      mockQueryRunner.manager.query.mockResolvedValue([
        { parentItemCode: 'FG-001', childItemCode: 'RM-001', qtyPer: 2, useYn: 'Y' },
      ]);

      // FIFO lots - empty stock
      const mockLotQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue(mockLotQb as any);

      // Act & Assert
      await expect(
        target.execute('ON_CREATE', 1, 'JO-001', 50, mockQueryRunner),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
