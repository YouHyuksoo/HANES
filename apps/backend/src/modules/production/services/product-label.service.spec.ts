/**
 * @file src/modules/production/services/product-label.service.spec.ts
 * @description ProductLabelService 단위 테스트 - 제품 라벨 발행 로직 검증
 *
 * 초보자 가이드:
 * - `target`: 테스트 대상(SUT), `mock*`: 모킹된 의존성
 * - 트랜잭션 처리(createPrdLabels)와 조회 로직을 검증
 * - 실행: `npx jest --testPathPattern="product-label.service.spec"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { ProductLabelService } from './product-label.service';
import { ProdResult } from '../../../entities/prod-result.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { LabelPrintLog } from '../../../entities/label-print-log.entity';
import { SeqGeneratorService } from '../../../shared/seq-generator.service';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('ProductLabelService', () => {
  let target: ProductLabelService;
  let mockProdResultRepo: DeepMocked<Repository<ProdResult>>;
  let mockPartRepo: DeepMocked<Repository<PartMaster>>;
  let mockPrintLogRepo: DeepMocked<Repository<LabelPrintLog>>;
  let mockSeqGenerator: DeepMocked<SeqGeneratorService>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockProdResultRepo = createMock<Repository<ProdResult>>();
    mockPartRepo = createMock<Repository<PartMaster>>();
    mockPrintLogRepo = createMock<Repository<LabelPrintLog>>();
    mockSeqGenerator = createMock<SeqGeneratorService>();
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
        ProductLabelService,
        { provide: getRepositoryToken(ProdResult), useValue: mockProdResultRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartRepo },
        { provide: getRepositoryToken(LabelPrintLog), useValue: mockPrintLogRepo },
        { provide: SeqGeneratorService, useValue: mockSeqGenerator },
        { provide: DataSource, useValue: mockDataSource },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<ProductLabelService>(ProductLabelService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────
  // findLabelableResults
  // ─────────────────────────────────────────────
  describe('findLabelableResults', () => {
    it('should return results with null prdUid enriched with part info', async () => {
      // Arrange
      const results = [
        {
          id: 1, orderNo: 'JO-001', goodQty: 10, prdUid: null,
          createdAt: new Date(),
          jobOrder: { itemCode: 'PART-001', part: { itemName: '부품A' } },
        },
      ] as any;
      mockProdResultRepo.find.mockResolvedValue(results);

      // Act
      const result = await target.findLabelableResults();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].itemCode).toBe('PART-001');
      expect(result[0].itemName).toBe('부품A');
    });
  });

  // ─────────────────────────────────────────────
  // findLabelableOqcPassed
  // ─────────────────────────────────────────────
  describe('findLabelableOqcPassed', () => {
    it('should return OQC passed results', async () => {
      // Arrange
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockProdResultRepo.createQueryBuilder.mockReturnValue(mockQb as any);

      // Act
      const result = await target.findLabelableOqcPassed();

      // Assert
      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────
  // createPrdLabels
  // ─────────────────────────────────────────────
  describe('createPrdLabels', () => {
    it('should create labels with prdUid and update prod result for single qty', async () => {
      // Arrange
      const prodResult = {
        id: 1, resultNo: 'PR-001', prdUid: null, company: 'C', plant: 'P',
        jobOrder: { itemCode: 'PART-001' },
      } as any;
      mockProdResultRepo.findOne.mockResolvedValue(prodResult);
      mockPartRepo.findOne.mockResolvedValue({ itemCode: 'PART-001', itemName: '부품A' } as PartMaster);
      mockSeqGenerator.nextPrdUid.mockResolvedValue('PRD-20260318-0001');
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
      mockQueryRunner.manager.create.mockReturnValue({} as any);
      mockQueryRunner.manager.save.mockResolvedValue({} as any);

      // Act
      const result = await target.createPrdLabels({ sourceId: 1, qty: 1 } as any);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].prdUid).toBe('PRD-20260318-0001');
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        ProdResult, 'PR-001', { prdUid: 'PRD-20260318-0001' },
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should create multiple labels without updating prod result', async () => {
      // Arrange
      const prodResult = {
        id: 1, resultNo: 'PR-001', prdUid: null, company: 'C', plant: 'P',
        jobOrder: { itemCode: 'PART-001' },
      } as any;
      mockProdResultRepo.findOne.mockResolvedValue(prodResult);
      mockPartRepo.findOne.mockResolvedValue({ itemCode: 'PART-001', itemName: '부품A' } as PartMaster);
      mockSeqGenerator.nextPrdUid
        .mockResolvedValueOnce('PRD-001')
        .mockResolvedValueOnce('PRD-002')
        .mockResolvedValueOnce('PRD-003');
      mockQueryRunner.manager.create.mockReturnValue({} as any);
      mockQueryRunner.manager.save.mockResolvedValue({} as any);

      // Act
      const result = await target.createPrdLabels({ sourceId: 1, qty: 3 } as any);

      // Assert
      expect(result).toHaveLength(3);
      // update should NOT be called because qty > 1
      expect(mockQueryRunner.manager.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when prod result not found', async () => {
      // Arrange
      mockProdResultRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        target.createPrdLabels({ sourceId: 999, qty: 1 } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should rollback on error', async () => {
      // Arrange
      const prodResult = {
        id: 1, resultNo: 'PR-001', prdUid: null, company: 'C', plant: 'P',
        jobOrder: { itemCode: 'PART-001' },
      } as any;
      mockProdResultRepo.findOne.mockResolvedValue(prodResult);
      mockPartRepo.findOne.mockResolvedValue(null);
      mockSeqGenerator.nextPrdUid.mockRejectedValue(new Error('Seq error'));

      // Act & Assert
      await expect(
        target.createPrdLabels({ sourceId: 1, qty: 1 } as any),
      ).rejects.toThrow('Seq error');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });
});
