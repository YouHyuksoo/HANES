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
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';
import { WipMatStockService } from '../../inventory/services/wip-mat-stock.service';
import { MockLoggerService } from '@test/mock-logger.service';

describe('AutoIssueService', () => {
  let target: AutoIssueService;
  let mockBomRepo: DeepMocked<Repository<BomMaster>>;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockMatStockRepo: DeepMocked<Repository<MatStock>>;
  let mockMatIssueRepo: DeepMocked<Repository<MatIssue>>;
  let mockStockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let mockJobOrderRepo: DeepMocked<Repository<JobOrder>>;
  let mockSysConfigService: DeepMocked<SysConfigService>;
  let mockNumbering: DeepMocked<NumberingService>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockTx: DeepMocked<TransactionService>;
  let mockWipMatStockService: DeepMocked<WipMatStockService>;
  let mockQueryRunner: DeepMocked<QueryRunner>;
  const bomEffectiveDate = new Date(2026, 3, 15);

  beforeEach(async () => {
    mockBomRepo = createMock<Repository<BomMaster>>();
    mockMatLotRepo = createMock<Repository<MatLot>>();
    mockMatStockRepo = createMock<Repository<MatStock>>();
    mockMatIssueRepo = createMock<Repository<MatIssue>>();
    mockStockTxRepo = createMock<Repository<StockTransaction>>();
    mockJobOrderRepo = createMock<Repository<JobOrder>>();
    mockSysConfigService = createMock<SysConfigService>();
    mockNumbering = createMock<NumberingService>();
    mockDataSource = createMock<DataSource>();
    mockTx = createMock<TransactionService>();
    mockWipMatStockService = createMock<WipMatStockService>();
    mockQueryRunner = createMock<QueryRunner>();

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockTx.run.mockImplementation(async (callback) => callback(mockQueryRunner));
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
        { provide: NumberingService, useValue: mockNumbering },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
        { provide: WipMatStockService, useValue: mockWipMatStockService },
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
      const result = await target.execute('ON_CREATE', '1', 'JO-001', 50);

      // Assert
      expect(result.skipped).toBe(true);
      expect(result.issued).toHaveLength(0);
      expect(mockTx.run).not.toHaveBeenCalled();
    });

    it('should skip when config timing is null', async () => {
      // Arrange
      mockSysConfigService.getValue.mockResolvedValue(null);

      // Act
      const result = await target.execute('ON_CREATE', '1', 'JO-001', 50);

      // Assert
      expect(result.skipped).toBe(true);
      expect(mockTx.run).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // execute - no BOM
  // ─────────────────────────────────────────────
  describe('execute - no BOM', () => {
    it('should skip when no BOM found', async () => {
      // Arrange
      mockSysConfigService.getValue.mockResolvedValue('ON_CREATE');
      mockQueryRunner.manager.findOne.mockResolvedValue({ orderNo: 'JO-001', itemCode: 'PART-001', planDate: bomEffectiveDate });
      mockQueryRunner.manager.query.mockResolvedValue([]); // no BOM

      // Act
      const result = await target.execute('ON_CREATE', '1', 'JO-001', 50, mockQueryRunner);

      // Assert
      expect(result.skipped).toBe(true);
      expect(mockTx.run).not.toHaveBeenCalled();
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('should use job order planDate as the required BOM effective date', async () => {
      // Arrange
      mockSysConfigService.getValue.mockResolvedValue('ON_CREATE');
      mockQueryRunner.manager.findOne.mockResolvedValue({
        orderNo: 'JO-001',
        itemCode: 'PART-001',
        company: 'C1',
        plant: 'P1',
        planDate: bomEffectiveDate,
      });
      mockQueryRunner.manager.query.mockResolvedValue([]);

      // Act
      await target.execute('ON_CREATE', '1', 'JO-001', 50, mockQueryRunner);

      // Assert
      const [sql, params] = mockQueryRunner.manager.query.mock.calls[0];
      expect(sql).toContain("b.VALID_FROM <= TO_DATE(:2, 'YYYY-MM-DD')");
      expect(sql).toContain("b.VALID_TO   >= TO_DATE(:3, 'YYYY-MM-DD')");
      expect(sql).not.toContain('VALID_FROM IS NULL');
      expect(sql).not.toContain('VALID_TO   IS NULL');
      expect(params).toEqual(['PART-001', '2026-04-15', '2026-04-15', 'C1', 'P1']);
    });

    it('should reject BOM-based issue when job order has no planDate', async () => {
      // Arrange
      mockSysConfigService.getValue.mockResolvedValue('ON_CREATE');
      mockQueryRunner.manager.findOne.mockResolvedValue({ orderNo: 'JO-001', itemCode: 'PART-001' });

      // Act + Assert
      await expect(
        target.execute('ON_CREATE', '1', 'JO-001', 50, mockQueryRunner),
      ).rejects.toThrow('작업지시 계획일이 없어 BOM 기준일을 결정할 수 없습니다');
      expect(mockQueryRunner.manager.query).not.toHaveBeenCalled();
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

      const ownQR = createMock<QueryRunner>();
      mockTx.run.mockImplementationOnce(async (callback) => callback(ownQR));

      ownQR.manager.findOne.mockResolvedValue({ orderNo: 'JO-001', itemCode: 'PART-001', planDate: bomEffectiveDate });
      ownQR.manager.query.mockResolvedValue([]); // no BOM

      // Act
      const result = await target.execute('ON_CREATE', '1', 'JO-001', 50);

      // Assert
      expect(result.skipped).toBe(true);
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(ownQR.connect).not.toHaveBeenCalled();
      expect(ownQR.startTransaction).not.toHaveBeenCalled();
      expect(ownQR.commitTransaction).not.toHaveBeenCalled();
      expect(ownQR.release).not.toHaveBeenCalled();
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
        target.execute('ON_CREATE', '1', 'JO-INVALID', 50, mockQueryRunner),
      ).rejects.toThrow(BadRequestException);
      expect(mockTx.run).not.toHaveBeenCalled();
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // execute - FIFO deduction with external QR
  // ─────────────────────────────────────────────
  describe('execute - FIFO deduction', () => {
    it('should throw BadRequestException on stock shortage with BLOCK policy', async () => {
      // Arrange
      mockSysConfigService.getValue
        .mockResolvedValueOnce('ON_CREATE')  // timing
        .mockResolvedValueOnce('BLOCK');     // stock check policy

      mockQueryRunner.manager.findOne.mockResolvedValue({
        orderNo: 'JO-001', itemCode: 'FG-001', planDate: bomEffectiveDate,
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
      mockQueryRunner.manager.find.mockResolvedValueOnce([]); // scanned job material lots (none)

      // Act & Assert
      await expect(
        target.execute('ON_CREATE', '1', 'JO-001', 50, mockQueryRunner),
      ).rejects.toThrow(BadRequestException);
      expect(mockTx.run).not.toHaveBeenCalled();
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('should reject scanned job-material lots that are not in the BOM before FIFO fallback', async () => {
      mockSysConfigService.getValue
        .mockResolvedValueOnce('ON_CREATE')
        .mockResolvedValueOnce('WARN');

      mockQueryRunner.manager.findOne.mockResolvedValue({
        orderNo: 'JO-001',
        itemCode: 'FG-001',
        company: 'C1',
        plant: 'P1',
        planDate: bomEffectiveDate,
      });
      mockQueryRunner.manager.query.mockResolvedValue([
        { parentItemCode: 'FG-001', childItemCode: 'RM-001', qtyPer: 1, useYn: 'Y' },
      ]);

      mockQueryRunner.manager.find.mockResolvedValueOnce([
        { jobOrderNo: 'JO-001', itemCode: 'RM-WRONG', seq: 1, matUid: 'LOT-WRONG', company: 'C1', plant: 'P1' },
      ]);

      const mockLotQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { matUid: 'LOT-001', itemCode: 'RM-001', company: 'C1', plant: 'P1' },
        ]),
      };
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue(mockLotQb as any);

      await expect(
        target.execute('ON_CREATE', '1', 'JO-001', 10, mockQueryRunner),
      ).rejects.toThrow('BOM에 없는 자재 LOT가 스캔되어 실적처리를 중단합니다');

      expect(mockQueryRunner.manager.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should reject scanned matUid whose actual lot item differs from the BOM item', async () => {
      mockSysConfigService.getValue
        .mockResolvedValueOnce('ON_CREATE')
        .mockResolvedValueOnce('WARN');

      mockQueryRunner.manager.findOne.mockResolvedValue({
        orderNo: 'JO-001',
        itemCode: 'FG-001',
        company: 'C1',
        plant: 'P1',
        planDate: bomEffectiveDate,
      });
      mockQueryRunner.manager.query.mockResolvedValue([
        { parentItemCode: 'FG-001', childItemCode: 'RM-001', qtyPer: 1, useYn: 'Y' },
      ]);

      mockQueryRunner.manager.find
        .mockResolvedValueOnce([
          { jobOrderNo: 'JO-001', itemCode: 'RM-001', seq: 1, matUid: 'LOT-WRONG', company: 'C1', plant: 'P1' },
        ])
        .mockResolvedValueOnce([
          { matUid: 'LOT-WRONG', itemCode: 'RM-WRONG', company: 'C1', plant: 'P1' },
        ]);

      await expect(
        target.execute('ON_CREATE', '1', 'JO-001', 10, mockQueryRunner),
      ).rejects.toThrow('스캔 LOT의 실제 품목이 BOM 품목과 일치하지 않아 실적처리를 중단합니다');

      expect(mockQueryRunner.manager.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should reject auto issue when returned LOT tenant differs from job order tenant', async () => {
      mockSysConfigService.getValue
        .mockResolvedValueOnce('ON_CREATE')
        .mockResolvedValueOnce('BLOCK');

      mockQueryRunner.manager.findOne.mockResolvedValue({
        orderNo: 'JO-001',
        itemCode: 'FG-001',
        company: 'C1',
        plant: 'P1',
        planDate: bomEffectiveDate,
      });
      mockQueryRunner.manager.query.mockResolvedValue([
        { parentItemCode: 'FG-001', childItemCode: 'RM-001', qtyPer: 1, useYn: 'Y' },
      ]);

      const mockLotQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { matUid: 'LOT-001', itemCode: 'RM-001', company: 'OTHER', plant: 'P1' },
        ]),
      };
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue(mockLotQb as any);
      mockQueryRunner.manager.find.mockResolvedValue([
        { warehouseCode: 'WH-RM', itemCode: 'RM-001', matUid: 'LOT-001', qty: 10, availableQty: 10, company: 'C1', plant: 'P1' },
      ]);

      await expect(
        target.execute('ON_CREATE', '1', 'JO-001', 10, mockQueryRunner),
      ).rejects.toThrow(BadRequestException);

      expect(mockQueryRunner.manager.save).not.toHaveBeenCalled();
      expect(mockQueryRunner.manager.update).not.toHaveBeenCalled();
    });

    it('should reject auto issue when returned stock tenant differs from job order tenant', async () => {
      mockSysConfigService.getValue
        .mockResolvedValueOnce('ON_CREATE')
        .mockResolvedValueOnce('BLOCK');

      mockQueryRunner.manager.findOne.mockResolvedValue({
        orderNo: 'JO-001',
        itemCode: 'FG-001',
        company: 'C1',
        plant: 'P1',
        planDate: bomEffectiveDate,
      });
      mockQueryRunner.manager.query.mockResolvedValue([
        { parentItemCode: 'FG-001', childItemCode: 'RM-001', qtyPer: 1, useYn: 'Y' },
      ]);

      const mockLotQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { matUid: 'LOT-001', itemCode: 'RM-001', company: 'C1', plant: 'P1' },
        ]),
      };
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue(mockLotQb as any);
      mockQueryRunner.manager.find.mockResolvedValue([
        { warehouseCode: 'WH-RM', itemCode: 'RM-001', matUid: 'LOT-001', qty: 10, availableQty: 10, company: 'OTHER', plant: 'P1' },
      ]);

      await expect(
        target.execute('ON_CREATE', '1', 'JO-001', 10, mockQueryRunner),
      ).rejects.toThrow(BadRequestException);

      expect(mockQueryRunner.manager.save).not.toHaveBeenCalled();
      expect(mockQueryRunner.manager.update).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // execute - 공정재고(WIP_MAT_STOCKS) 소비 (PROD_CONSUME)
  // ─────────────────────────────────────────────
  describe('execute - WIP stock consume', () => {
    it('should delegate consumption to WipMatStockService and never touch raw-material MAT_STOCKS', async () => {
      // Arrange
      mockSysConfigService.getValue
        .mockResolvedValueOnce('ON_CREATE') // timing
        .mockResolvedValueOnce('BLOCK'); // stock check policy

      mockQueryRunner.manager.findOne.mockResolvedValue({
        orderNo: 'JO-001',
        itemCode: 'FG-001',
        company: 'C1',
        plant: 'P1',
        equipCode: 'EQ-1',
        lineCode: 'L1',
        processCode: 'OP10',
        planDate: bomEffectiveDate,
      });

      mockQueryRunner.manager.query.mockResolvedValue([
        { parentItemCode: 'FG-001', childItemCode: 'RM-001', qtyPer: 2, useYn: 'Y' },
      ]);

      // scanned job material lots (none)
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);

      // WipMatStockService.deductStockInTx returns deducted lots
      mockWipMatStockService.deductStockInTx.mockResolvedValue([
        { matUid: 'LOT-001', qty: 100 },
      ]);

      // Act
      const result = await target.execute('ON_CREATE', '1', 'JO-001', 50, mockQueryRunner);

      // Assert: WipMatStockService에 위임 (PROD_CONSUME / PROD_RESULT / equipCode)
      expect(mockWipMatStockService.deductStockInTx).toHaveBeenCalledTimes(1);
      expect(mockWipMatStockService.deductStockInTx).toHaveBeenCalledWith(
        mockQueryRunner,
        expect.objectContaining({
          equipCode: 'EQ-1',
          itemCode: 'RM-001',
          qty: 100, // 2 * 50
          transType: 'PROD_CONSUME',
          refType: 'PROD_RESULT',
          refId: '1',
          orderNo: 'JO-001',
          stockPolicy: 'BLOCK',
          company: 'C1',
          plant: 'P1',
        }),
      );

      // 차감 결과 반영
      expect(result.skipped).toBe(false);
      expect(result.issued).toHaveLength(1);
      expect(result.issued[0]).toMatchObject({ matUid: 'LOT-001', itemCode: 'RM-001', issueQty: 100 });

      // 이중차감 방지: 원자재재고(MAT_STOCKS) save/update 없어야 함
      const matStockSaves = mockQueryRunner.manager.save.mock.calls.filter((c) => c[0] === MatStock);
      const matStockUpdates = mockQueryRunner.manager.update.mock.calls.filter((c) => c[0] === MatStock);
      const matIssueSaves = mockQueryRunner.manager.save.mock.calls.filter((c) => c[0] === MatIssue);
      const stockTxSaves = mockQueryRunner.manager.save.mock.calls.filter((c) => c[0] === StockTransaction);
      expect(matStockSaves).toHaveLength(0);
      expect(matStockUpdates).toHaveLength(0);
      // MatIssue(PROD_AUTO) 및 원자재 StockTransaction 생성 없음
      expect(matIssueSaves).toHaveLength(0);
      expect(stockTxSaves).toHaveLength(0);
    });

    it('should forward scanned matUids and WARN policy to WipMatStockService', async () => {
      // Arrange
      mockSysConfigService.getValue
        .mockResolvedValueOnce('ON_CREATE') // timing
        .mockResolvedValueOnce('WARN'); // stock check policy

      mockQueryRunner.manager.findOne.mockResolvedValue({
        orderNo: 'JO-001',
        itemCode: 'FG-001',
        company: 'C1',
        plant: 'P1',
        equipCode: 'EQ-1',
        planDate: bomEffectiveDate,
      });

      mockQueryRunner.manager.query.mockResolvedValue([
        { parentItemCode: 'FG-001', childItemCode: 'RM-001', qtyPer: 2, useYn: 'Y' },
      ]);

      // scanned job material lots → LOT-SCANNED, 그 actual MatLot 조회
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([{ jobOrderNo: 'JO-001', itemCode: 'RM-001', seq: 1, matUid: 'LOT-SCANNED', company: 'C1', plant: 'P1' }])
        .mockResolvedValueOnce([{ matUid: 'LOT-SCANNED', itemCode: 'RM-001', company: 'C1', plant: 'P1' }]);

      // WARN: 가용분(30)만 차감하고 서비스가 warnings에 누적
      mockWipMatStockService.deductStockInTx.mockImplementation(async (_qr: any, p: any) => {
        p.warnings?.push(`공정재고 부족(가용분만 차감): ${p.itemCode} 부족수량 70`);
        return [{ matUid: 'LOT-SCANNED', qty: 30 }];
      });

      // Act
      const result = await target.execute('ON_CREATE', '1', 'JO-001', 50, mockQueryRunner);

      // Assert: 스캔 LOT 우선순위 + WARN 정책 전달
      expect(mockWipMatStockService.deductStockInTx).toHaveBeenCalledWith(
        mockQueryRunner,
        expect.objectContaining({
          scannedMatUids: ['LOT-SCANNED'],
          stockPolicy: 'WARN',
        }),
      );
      expect(result.issued[0].issueQty).toBe(30);
      expect(result.warnings.some((w) => w.includes('공정재고 부족'))).toBe(true);
    });

    it('should propagate BadRequestException from WipMatStockService on BLOCK shortage', async () => {
      mockSysConfigService.getValue
        .mockResolvedValueOnce('ON_CREATE')
        .mockResolvedValueOnce('BLOCK');

      mockQueryRunner.manager.findOne.mockResolvedValue({
        orderNo: 'JO-001', itemCode: 'FG-001', company: 'C1', plant: 'P1', equipCode: 'EQ-1', planDate: bomEffectiveDate,
      });
      mockQueryRunner.manager.query.mockResolvedValue([
        { parentItemCode: 'FG-001', childItemCode: 'RM-001', qtyPer: 2, useYn: 'Y' },
      ]);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]); // scanned lots none

      mockWipMatStockService.deductStockInTx.mockRejectedValue(
        new BadRequestException('공정재고 부족: 자재 준비 출고 필요 (RM-001)'),
      );

      await expect(
        target.execute('ON_CREATE', '1', 'JO-001', 50, mockQueryRunner),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw (fail loud, no fallback) when job order has no equip', async () => {
      // 예외 경로 배제(ADR 0002): 설비 미배정이면 원자재창고 우회 차감 없이 오류로 막는다.
      // Arrange
      mockSysConfigService.getValue
        .mockResolvedValueOnce('ON_CREATE')
        .mockResolvedValueOnce('BLOCK');

      mockQueryRunner.manager.findOne.mockResolvedValue({
        orderNo: 'JO-001',
        itemCode: 'FG-001',
        company: 'C1',
        plant: 'P1',
        equipCode: null, // 설비 미배정
        planDate: bomEffectiveDate,
      });

      mockQueryRunner.manager.query.mockResolvedValue([
        { parentItemCode: 'FG-001', childItemCode: 'RM-001', qtyPer: 2, useYn: 'Y' },
      ]);

      // Act + Assert: 우회 차감 없이 BadRequest로 막히고, WIP 위임도 호출되지 않는다.
      await expect(
        target.execute('ON_CREATE', '1', 'JO-001', 50, mockQueryRunner),
      ).rejects.toThrow(BadRequestException);
      expect(mockWipMatStockService.deductStockInTx).not.toHaveBeenCalled();
    });
  });
});
