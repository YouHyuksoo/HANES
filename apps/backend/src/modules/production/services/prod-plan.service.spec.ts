/**
 * @file src/modules/production/services/prod-plan.service.spec.ts
 * @description ProdPlanService 단위 테스트 - 월간생산계획 CRUD + 상태 전이 로직 검증
 *
 * 초보자 가이드:
 * - `target`: 테스트 대상(SUT), `mock*`: 모킹된 의존성
 * - 상태 워크플로우: DRAFT -> CONFIRMED -> CLOSED
 * - 실행: `npx jest --testPathPattern="prod-plan.service.spec"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { ProdPlanService } from './prod-plan.service';
import { ProdPlan } from '../../../entities/prod-plan.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('ProdPlanService', () => {
  let target: ProdPlanService;
  let mockPlanRepo: DeepMocked<Repository<ProdPlan>>;
  let mockPartRepo: DeepMocked<Repository<PartMaster>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockPlanRepo = createMock<Repository<ProdPlan>>();
    mockPartRepo = createMock<Repository<PartMaster>>();
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
        ProdPlanService,
        { provide: getRepositoryToken(ProdPlan), useValue: mockPlanRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<ProdPlanService>(ProdPlanService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────
  describe('findAll', () => {
    it('should return paginated plans', async () => {
      // Arrange
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(2),
        getMany: jest.fn().mockResolvedValue([{ planNo: 'PP-001' }, { planNo: 'PP-002' }]),
      };
      mockPlanRepo.createQueryBuilder.mockReturnValue(mockQb as any);

      // Act
      const result = await target.findAll({ page: 1, limit: 50 } as any);

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  // ─────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────
  describe('create', () => {
    it('should create production plan with auto-generated planNo', async () => {
      // Arrange
      mockPartRepo.findOne.mockResolvedValue({ itemCode: 'PART-001' } as PartMaster);

      // generatePlanNo mock - no existing plans
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      mockPlanRepo.createQueryBuilder.mockReturnValue(mockQb as any);
      mockPlanRepo.create.mockReturnValue({ planNo: 'PP-202603-001' } as any);
      mockPlanRepo.save.mockResolvedValue({ planNo: 'PP-202603-001' } as any);
      mockPlanRepo.findOne.mockResolvedValue({ planNo: 'PP-202603-001' } as any);

      // Act
      const result = await target.create({
        planMonth: '2026-03', itemCode: 'PART-001', itemType: 'FINISHED', planQty: 100,
      } as any, 'COMP', 'PLT');

      // Assert
      expect(result?.planNo).toBe('PP-202603-001');
    });

    it('should throw NotFoundException when part not found', async () => {
      // Arrange
      mockPartRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        target.create({
          planMonth: '2026-03', itemCode: 'INVALID', itemType: 'FINISHED', planQty: 100,
        } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────
  describe('update', () => {
    it('should update DRAFT plan', async () => {
      // Arrange
      mockPlanRepo.findOne
        .mockResolvedValueOnce({ planNo: 'PP-001', status: 'DRAFT' } as ProdPlan)
        .mockResolvedValueOnce({ planNo: 'PP-001', planQty: 200 } as any);
      mockPlanRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.update('PP-001', { planQty: 200 } as any);

      // Assert
      expect(mockPlanRepo.update).toHaveBeenCalledWith(
        { planNo: 'PP-001' },
        expect.objectContaining({ planQty: 200 }),
      );
    });

    it('should throw BadRequestException when not DRAFT', async () => {
      // Arrange
      mockPlanRepo.findOne.mockResolvedValue({ planNo: 'PP-001', status: 'CONFIRMED' } as ProdPlan);

      // Act & Assert
      await expect(target.update('PP-001', {} as any)).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  // delete
  // ─────────────────────────────────────────────
  describe('delete', () => {
    it('should delete DRAFT plan', async () => {
      // Arrange
      mockPlanRepo.findOne.mockResolvedValue({ planNo: 'PP-001', status: 'DRAFT' } as ProdPlan);
      mockPlanRepo.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.delete('PP-001');

      // Assert
      expect(result).toEqual({ planNo: 'PP-001' });
    });

    it('should throw BadRequestException when not DRAFT', async () => {
      // Arrange
      mockPlanRepo.findOne.mockResolvedValue({ planNo: 'PP-001', status: 'CONFIRMED' } as ProdPlan);

      // Act & Assert
      await expect(target.delete('PP-001')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when plan not found', async () => {
      // Arrange
      mockPlanRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.delete('INVALID')).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // confirm
  // ─────────────────────────────────────────────
  describe('confirm', () => {
    it('should change status from DRAFT to CONFIRMED', async () => {
      // Arrange
      mockPlanRepo.findOne
        .mockResolvedValueOnce({ planNo: 'PP-001', status: 'DRAFT' } as ProdPlan)
        .mockResolvedValueOnce({ planNo: 'PP-001', status: 'CONFIRMED' } as any);
      mockPlanRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.confirm('PP-001');

      // Assert
      expect(mockPlanRepo.update).toHaveBeenCalledWith(
        { planNo: 'PP-001' },
        { status: 'CONFIRMED' },
      );
    });

    it('should throw BadRequestException when not DRAFT', async () => {
      // Arrange
      mockPlanRepo.findOne.mockResolvedValue({ planNo: 'PP-001', status: 'CLOSED' } as ProdPlan);

      // Act & Assert
      await expect(target.confirm('PP-001')).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  // bulkConfirm
  // ─────────────────────────────────────────────
  describe('bulkConfirm', () => {
    it('should confirm only DRAFT plans', async () => {
      // Arrange
      mockPlanRepo.findOne
        .mockResolvedValueOnce({ planNo: 'PP-001', status: 'DRAFT' } as ProdPlan)
        .mockResolvedValueOnce({ planNo: 'PP-002', status: 'CONFIRMED' } as ProdPlan);
      mockPlanRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.bulkConfirm(['PP-001', 'PP-002']);

      // Assert
      expect(result.count).toBe(1);
    });
  });

  // ─────────────────────────────────────────────
  // unconfirm
  // ─────────────────────────────────────────────
  describe('unconfirm', () => {
    it('should change status from CONFIRMED to DRAFT', async () => {
      // Arrange
      mockPlanRepo.findOne
        .mockResolvedValueOnce({ planNo: 'PP-001', status: 'CONFIRMED' } as ProdPlan)
        .mockResolvedValueOnce({ planNo: 'PP-001', status: 'DRAFT' } as any);
      mockPlanRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      await target.unconfirm('PP-001');

      // Assert
      expect(mockPlanRepo.update).toHaveBeenCalledWith(
        { planNo: 'PP-001' },
        { status: 'DRAFT' },
      );
    });

    it('should throw BadRequestException when not CONFIRMED', async () => {
      // Arrange
      mockPlanRepo.findOne.mockResolvedValue({ planNo: 'PP-001', status: 'DRAFT' } as ProdPlan);

      // Act & Assert
      await expect(target.unconfirm('PP-001')).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  // close
  // ─────────────────────────────────────────────
  describe('close', () => {
    it('should change status from CONFIRMED to CLOSED', async () => {
      // Arrange
      mockPlanRepo.findOne
        .mockResolvedValueOnce({ planNo: 'PP-001', status: 'CONFIRMED' } as ProdPlan)
        .mockResolvedValueOnce({ planNo: 'PP-001', status: 'CLOSED' } as any);
      mockPlanRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      await target.close('PP-001');

      // Assert
      expect(mockPlanRepo.update).toHaveBeenCalledWith(
        { planNo: 'PP-001' },
        { status: 'CLOSED' },
      );
    });

    it('should throw BadRequestException when not CONFIRMED', async () => {
      // Arrange
      mockPlanRepo.findOne.mockResolvedValue({ planNo: 'PP-001', status: 'DRAFT' } as ProdPlan);

      // Act & Assert
      await expect(target.close('PP-001')).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  // getSummary
  // ─────────────────────────────────────────────
  describe('getSummary', () => {
    it('should return monthly summary', async () => {
      // Arrange
      const plans = [
        { status: 'DRAFT', itemType: 'FINISHED', planQty: 100, orderQty: 50 },
        { status: 'CONFIRMED', itemType: 'SEMI_PRODUCT', planQty: 200, orderQty: 100 },
        { status: 'CLOSED', itemType: 'FINISHED', planQty: 150, orderQty: 150 },
      ] as ProdPlan[];
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([plans, 3]),
      };
      mockPlanRepo.createQueryBuilder.mockReturnValue(mockQb as any);

      // Act
      const result = await target.getSummary('2026-03');

      // Assert
      expect(result.total).toBe(3);
      expect(result.draft).toBe(1);
      expect(result.confirmed).toBe(1);
      expect(result.closed).toBe(1);
      expect(result.fgCount).toBe(2);
      expect(result.wipCount).toBe(1);
      expect(result.totalPlanQty).toBe(450);
    });
  });

  // ─────────────────────────────────────────────
  // bulkCreate
  // ─────────────────────────────────────────────
  describe('bulkCreate', () => {
    it('should bulk create plans in transaction', async () => {
      // Arrange
      mockPartRepo.findOne.mockResolvedValue({ itemCode: 'PART-001' } as PartMaster);

      // generatePlanNo within transaction
      const mockTxQb = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      const mockTxRepo = { createQueryBuilder: jest.fn().mockReturnValue(mockTxQb) };
      mockQueryRunner.manager.getRepository.mockReturnValue(mockTxRepo as any);
      mockQueryRunner.manager.create.mockReturnValue({ planNo: 'PP-202603-001' } as any);
      mockQueryRunner.manager.save.mockResolvedValue({ planNo: 'PP-202603-001' } as any);

      // Act
      const result = await target.bulkCreate({
        planMonth: '2026-03',
        items: [{ itemCode: 'PART-001', itemType: 'FINISHED', planQty: 100 }],
      } as any);

      // Assert
      expect(result.count).toBe(1);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should rollback on part not found', async () => {
      // Arrange
      mockPartRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        target.bulkCreate({
          planMonth: '2026-03',
          items: [{ itemCode: 'INVALID', itemType: 'FINISHED', planQty: 100 }],
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });
});
