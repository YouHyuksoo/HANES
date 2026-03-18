/**
 * @file src/modules/production/services/prod-result.service.spec.ts
 * @description ProdResultService 단위 테스트 - 생산실적 CRUD + 완료/취소 로직 검증
 *
 * 초보자 가이드:
 * - `target`: 테스트 대상(SUT), `mock*`: 모킹된 의존성
 * - QueryRunner 모킹으로 트랜잭션 로직 검증
 * - 실행: `npx jest --testPathPattern="prod-result.service.spec"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { ProdResultService } from './prod-result.service';
import { ProdResult } from '../../../entities/prod-result.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { EquipBomRel } from '../../../entities/equip-bom-rel.entity';
import { EquipBomItem } from '../../../entities/equip-bom-item.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { ConsumableMaster } from '../../../entities/consumable-master.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { User } from '../../../entities/user.entity';
import { AutoIssueService } from './auto-issue.service';
import { ProductInventoryService } from '../../inventory/services/product-inventory.service';
import { NumRuleService } from '../../num-rule/num-rule.service';
import { SeqGeneratorService } from '../../../shared/seq-generator.service';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('ProdResultService', () => {
  let target: ProdResultService;
  let mockProdResultRepo: DeepMocked<Repository<ProdResult>>;
  let mockJobOrderRepo: DeepMocked<Repository<JobOrder>>;
  let mockEquipMasterRepo: DeepMocked<Repository<EquipMaster>>;
  let mockEquipBomRelRepo: DeepMocked<Repository<EquipBomRel>>;
  let mockEquipBomItemRepo: DeepMocked<Repository<EquipBomItem>>;
  let mockPartMasterRepo: DeepMocked<Repository<PartMaster>>;
  let mockConsumableRepo: DeepMocked<Repository<ConsumableMaster>>;
  let mockMatIssueRepo: DeepMocked<Repository<MatIssue>>;
  let mockUserRepo: DeepMocked<Repository<User>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockAutoIssueService: DeepMocked<AutoIssueService>;
  let mockProductInventoryService: DeepMocked<ProductInventoryService>;
  let mockNumRuleService: DeepMocked<NumRuleService>;
  let mockSeqGenerator: DeepMocked<SeqGeneratorService>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockProdResultRepo = createMock<Repository<ProdResult>>();
    mockJobOrderRepo = createMock<Repository<JobOrder>>();
    mockEquipMasterRepo = createMock<Repository<EquipMaster>>();
    mockEquipBomRelRepo = createMock<Repository<EquipBomRel>>();
    mockEquipBomItemRepo = createMock<Repository<EquipBomItem>>();
    mockPartMasterRepo = createMock<Repository<PartMaster>>();
    mockConsumableRepo = createMock<Repository<ConsumableMaster>>();
    mockMatIssueRepo = createMock<Repository<MatIssue>>();
    mockUserRepo = createMock<Repository<User>>();
    mockDataSource = createMock<DataSource>();
    mockAutoIssueService = createMock<AutoIssueService>();
    mockProductInventoryService = createMock<ProductInventoryService>();
    mockNumRuleService = createMock<NumRuleService>();
    mockSeqGenerator = createMock<SeqGeneratorService>();
    mockQueryRunner = createMock<QueryRunner>();

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProdResultService,
        { provide: getRepositoryToken(ProdResult), useValue: mockProdResultRepo },
        { provide: getRepositoryToken(JobOrder), useValue: mockJobOrderRepo },
        { provide: getRepositoryToken(EquipMaster), useValue: mockEquipMasterRepo },
        { provide: getRepositoryToken(EquipBomRel), useValue: mockEquipBomRelRepo },
        { provide: getRepositoryToken(EquipBomItem), useValue: mockEquipBomItemRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartMasterRepo },
        { provide: getRepositoryToken(ConsumableMaster), useValue: mockConsumableRepo },
        { provide: getRepositoryToken(MatIssue), useValue: mockMatIssueRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AutoIssueService, useValue: mockAutoIssueService },
        { provide: ProductInventoryService, useValue: mockProductInventoryService },
        { provide: NumRuleService, useValue: mockNumRuleService },
        { provide: SeqGeneratorService, useValue: mockSeqGenerator },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<ProdResultService>(ProdResultService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────
  // findById
  // ─────────────────────────────────────────────
  describe('findById', () => {
    it('should return prod result when found', async () => {
      // Arrange
      const pr = {
        resultNo: 'PR-001', id: 1, inspectResults: [], defectLogs: [],
      } as any;
      mockProdResultRepo.findOne.mockResolvedValue(pr);
      mockMatIssueRepo.find.mockResolvedValue([]);

      // Act
      const result = await target.findById('PR-001');

      // Assert
      expect(result.resultNo).toBe('PR-001');
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockProdResultRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findById('INVALID')).rejects.toThrow(NotFoundException);
    });

    it('should filter inspectResults to only passYn=N and limit to 10', async () => {
      // Arrange
      const inspects = [
        ...Array(15).fill(null).map((_, i) => ({ id: i, passYn: 'N' })),
        { id: 99, passYn: 'Y' },
      ];
      const pr = {
        resultNo: 'PR-001', id: 1,
        inspectResults: inspects,
        defectLogs: [],
      } as any;
      mockProdResultRepo.findOne.mockResolvedValue(pr);
      mockMatIssueRepo.find.mockResolvedValue([]);

      // Act
      const result = await target.findById('PR-001');

      // Assert
      expect(result.inspectResults).toHaveLength(10);
      expect(result.inspectResults!.every((r: any) => r.passYn === 'N')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────
  describe('findAll', () => {
    it('should return paginated results', async () => {
      // Arrange
      const data = [{ resultNo: 'PR-001' }] as ProdResult[];
      mockProdResultRepo.find.mockResolvedValue(data);
      mockProdResultRepo.count.mockResolvedValue(1);

      // Act
      const result = await target.findAll({ page: 1, limit: 10 } as any);

      // Assert
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────
  describe('create', () => {
    const createDto = {
      orderNo: 'JO-001',
      goodQty: 10,
      defectQty: 2,
    } as any;

    it('should create prod result successfully', async () => {
      // Arrange
      mockJobOrderRepo.findOne.mockResolvedValue({
        orderNo: 'JO-001', status: 'RUNNING', planQty: 100,
      } as any);
      mockEquipBomRelRepo.find.mockResolvedValue([]);

      // checkJobOrderQtyLimit
      const mockQbLimit = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalGood: '0', totalDefect: '0' }),
      };
      mockProdResultRepo.createQueryBuilder.mockReturnValue(mockQbLimit as any);

      mockSeqGenerator.getNo.mockResolvedValue('PR-001');
      mockQueryRunner.manager.create.mockReturnValue({ resultNo: 'PR-001', id: 1 } as any);
      mockQueryRunner.manager.save.mockResolvedValue({ resultNo: 'PR-001', id: 1 } as any);
      mockAutoIssueService.execute.mockResolvedValue({ issued: [], warnings: [], skipped: false });
      mockProdResultRepo.findOne.mockResolvedValue({ resultNo: 'PR-001' } as any);

      // Act
      const result = await target.create(createDto);

      // Assert
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result?.resultNo).toBe('PR-001');
    });

    it('should throw NotFoundException when job order not found', async () => {
      // Arrange
      mockJobOrderRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when job order is DONE', async () => {
      // Arrange
      mockJobOrderRepo.findOne.mockResolvedValue({
        orderNo: 'JO-001', status: 'DONE',
      } as JobOrder);

      // Act & Assert
      await expect(target.create(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when job order is HOLD', async () => {
      // Arrange
      mockJobOrderRepo.findOne.mockResolvedValue({
        orderNo: 'JO-001', status: 'HOLD',
      } as JobOrder);

      // Act & Assert
      await expect(target.create(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when equip not found', async () => {
      // Arrange
      mockJobOrderRepo.findOne.mockResolvedValue({
        orderNo: 'JO-001', status: 'RUNNING', planQty: 0,
      } as any);
      mockEquipBomRelRepo.find.mockResolvedValue([]);
      mockProdResultRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalGood: '0', totalDefect: '0' }),
      } as any);
      mockEquipMasterRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.create({ ...createDto, equipCode: 'EQ-001' })).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────
  describe('update', () => {
    it('should update prod result fields', async () => {
      // Arrange
      const existing = {
        resultNo: 'PR-001', id: 1, status: 'RUNNING',
        inspectResults: [], defectLogs: [],
      } as any;
      mockProdResultRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ ...existing, goodQty: 20 });
      mockMatIssueRepo.find.mockResolvedValue([]);
      mockProdResultRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.update('PR-001', { goodQty: 20 } as any);

      // Assert
      expect(mockProdResultRepo.update).toHaveBeenCalledWith(
        'PR-001',
        expect.objectContaining({ goodQty: 20 }),
      );
    });

    it('should throw BadRequestException when updating core fields on DONE status', async () => {
      // Arrange
      const existing = {
        resultNo: 'PR-001', status: 'DONE',
        inspectResults: [], defectLogs: [],
      } as any;
      mockProdResultRepo.findOne.mockResolvedValue(existing);
      mockMatIssueRepo.find.mockResolvedValue([]);

      // Act & Assert
      await expect(
        target.update('PR-001', { orderNo: 'JO-002' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  // delete
  // ─────────────────────────────────────────────
  describe('delete', () => {
    it('should delete prod result', async () => {
      // Arrange
      mockProdResultRepo.findOne.mockResolvedValue({
        resultNo: 'PR-001', inspectResults: [], defectLogs: [],
      } as any);
      mockMatIssueRepo.find.mockResolvedValue([]);
      mockProdResultRepo.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.delete('PR-001');

      // Assert
      expect(result).toEqual({ resultNo: 'PR-001' });
    });
  });

  // ─────────────────────────────────────────────
  // complete
  // ─────────────────────────────────────────────
  describe('complete', () => {
    it('should complete prod result with transaction', async () => {
      // Arrange
      const existing = {
        resultNo: 'PR-001', id: 1, status: 'RUNNING',
        equipCode: null, orderNo: 'JO-001', goodQty: 10, defectQty: 2,
        inspectResults: [], defectLogs: [],
      } as any;
      mockProdResultRepo.findOne
        .mockResolvedValueOnce(existing)  // findById
        .mockResolvedValueOnce({ ...existing, status: 'DONE' }); // final find
      mockMatIssueRepo.find.mockResolvedValue([]);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
      mockAutoIssueService.execute.mockResolvedValue({ issued: [], warnings: [], skipped: false });

      // Act
      const result = await target.complete('PR-001', { goodQty: 10, defectQty: 2 } as any);

      // Assert
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException when not RUNNING', async () => {
      // Arrange
      mockProdResultRepo.findOne.mockResolvedValue({
        resultNo: 'PR-001', status: 'DONE',
        inspectResults: [], defectLogs: [],
      } as any);
      mockMatIssueRepo.find.mockResolvedValue([]);

      // Act & Assert
      await expect(target.complete('PR-001', {} as any)).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  // cancel
  // ─────────────────────────────────────────────
  describe('cancel', () => {
    it('should cancel prod result', async () => {
      // Arrange
      const existing = {
        resultNo: 'PR-001', id: 1, status: 'RUNNING',
        equipCode: null, inspectResults: [], defectLogs: [],
      } as any;
      mockProdResultRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ ...existing, status: 'CANCELED' });
      mockMatIssueRepo.find.mockResolvedValue([]);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
      mockQueryRunner.manager.find.mockResolvedValue([]); // reverseAutoIssue: no issues

      // reverseProductStock dynamic imports
      jest.mock('../../../entities/product-transaction.entity', () => ({
        ProductTransaction: class {},
      }));
      jest.mock('../../../entities/product-stock.entity', () => ({
        ProductStock: class {},
      }));

      // Act
      const result = await target.cancel('PR-001', '취소 사유');

      // Assert
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException when already CANCELED', async () => {
      // Arrange
      mockProdResultRepo.findOne.mockResolvedValue({
        resultNo: 'PR-001', status: 'CANCELED',
        inspectResults: [], defectLogs: [],
      } as any);
      mockMatIssueRepo.find.mockResolvedValue([]);

      // Act & Assert
      await expect(target.cancel('PR-001')).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  // getSummaryByJobOrder
  // ─────────────────────────────────────────────
  describe('getSummaryByJobOrder', () => {
    it('should return aggregated summary', async () => {
      // Arrange
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          totalGoodQty: '80', totalDefectQty: '20', avgCycleTime: '3.5', resultCount: '5',
        }),
      };
      mockProdResultRepo.createQueryBuilder.mockReturnValue(mockQb as any);

      // Act
      const result = await target.getSummaryByJobOrder('JO-001');

      // Assert
      expect(result.totalGoodQty).toBe(80);
      expect(result.totalDefectQty).toBe(20);
      expect(result.defectRate).toBe(20);
      expect(result.resultCount).toBe(5);
    });

    it('should handle zero results', async () => {
      // Arrange
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          totalGoodQty: null, totalDefectQty: null, avgCycleTime: null, resultCount: '0',
        }),
      };
      mockProdResultRepo.createQueryBuilder.mockReturnValue(mockQb as any);

      // Act
      const result = await target.getSummaryByJobOrder('JO-001');

      // Assert
      expect(result.totalGoodQty).toBe(0);
      expect(result.defectRate).toBe(0);
    });
  });

  // ─────────────────────────────────────────────
  // getDailySummary
  // ─────────────────────────────────────────────
  describe('getDailySummary', () => {
    it('should return daily grouped data', async () => {
      // Arrange
      const results = [
        { startAt: new Date('2026-03-18T10:00:00Z'), goodQty: 50, defectQty: 5 },
        { startAt: new Date('2026-03-18T14:00:00Z'), goodQty: 30, defectQty: 3 },
        { startAt: new Date('2026-03-19T10:00:00Z'), goodQty: 40, defectQty: 2 },
      ] as ProdResult[];
      mockProdResultRepo.find.mockResolvedValue(results);

      // Act
      const result = await target.getDailySummary('2026-03-18', '2026-03-19');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2026-03-18');
      expect(result[0].goodQty).toBe(80);
    });
  });
});
