/**
 * @file src/modules/system/services/training.service.spec.ts
 * @description TrainingService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "TrainingService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TrainingService } from './training.service';
import { TrainingPlan } from '../../../entities/training-plan.entity';
import { TrainingResult } from '../../../entities/training-result.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('TrainingService', () => {
  let target: TrainingService;
  let mockPlanRepo: DeepMocked<Repository<TrainingPlan>>;
  let mockResultRepo: DeepMocked<Repository<TrainingResult>>;

  beforeEach(async () => {
    mockPlanRepo = createMock<Repository<TrainingPlan>>();
    mockResultRepo = createMock<Repository<TrainingResult>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrainingService,
        { provide: getRepositoryToken(TrainingPlan), useValue: mockPlanRepo },
        { provide: getRepositoryToken(TrainingResult), useValue: mockResultRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<TrainingService>(TrainingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findById ───
  describe('findById', () => {
    it('should return plan when found', async () => {
      // Arrange
      const plan = { planNo: 'TRN-001', status: 'PLANNED' } as TrainingPlan;
      mockPlanRepo.findOne.mockResolvedValue(plan);

      // Act
      const result = await target.findById('TRN-001');

      // Assert
      expect(result).toEqual(plan);
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockPlanRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findById('NONE')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ───
  describe('create', () => {
    it('should create plan with PLANNED status', async () => {
      // Arrange
      const qb = createMock<any>();
      qb.where.mockReturnThis();
      qb.andWhere.mockReturnThis();
      qb.orderBy.mockReturnThis();
      qb.getOne.mockResolvedValue(null);
      mockPlanRepo.createQueryBuilder.mockReturnValue(qb);

      const dto = { title: 'Test Training' } as any;
      const entity = { planNo: 'TRN-20260318-001', status: 'PLANNED', ...dto } as TrainingPlan;
      mockPlanRepo.create.mockReturnValue(entity);
      mockPlanRepo.save.mockResolvedValue(entity);

      // Act
      const result = await target.create(dto, 'COMP', 'PLANT', 'user');

      // Assert
      expect(result.status).toBe('PLANNED');
    });
  });

  // ─── update ───
  describe('update', () => {
    it('should update plan', async () => {
      // Arrange
      const plan = { planNo: 'TRN-001', status: 'PLANNED' } as TrainingPlan;
      mockPlanRepo.findOne.mockResolvedValue(plan);
      mockPlanRepo.save.mockResolvedValue(plan);

      // Act
      const result = await target.update('TRN-001', { title: 'Updated' } as any, 'user');

      // Assert
      expect(mockPlanRepo.save).toHaveBeenCalled();
    });
  });

  // ─── delete ───
  describe('delete', () => {
    it('should delete plan and associated results', async () => {
      // Arrange
      const plan = { planNo: 'TRN-001', status: 'PLANNED' } as TrainingPlan;
      mockPlanRepo.findOne.mockResolvedValue(plan);
      mockResultRepo.delete.mockResolvedValue({ affected: 0 } as any);
      mockPlanRepo.remove.mockResolvedValue(plan);

      // Act
      await target.delete('TRN-001');

      // Assert
      expect(mockResultRepo.delete).toHaveBeenCalledWith({ planNo: 'TRN-001' });
      expect(mockPlanRepo.remove).toHaveBeenCalledWith(plan);
    });
  });

  // ─── complete ───
  describe('complete', () => {
    it('should complete PLANNED plan', async () => {
      // Arrange
      const plan = { planNo: 'TRN-001', status: 'PLANNED' } as TrainingPlan;
      mockPlanRepo.findOne.mockResolvedValue(plan);
      mockPlanRepo.save.mockResolvedValue({ ...plan, status: 'COMPLETED' } as TrainingPlan);

      // Act
      const result = await target.complete('TRN-001', 'user');

      // Assert
      expect(mockPlanRepo.save).toHaveBeenCalled();
    });

    it('should complete IN_PROGRESS plan', async () => {
      // Arrange
      const plan = { planNo: 'TRN-001', status: 'IN_PROGRESS' } as TrainingPlan;
      mockPlanRepo.findOne.mockResolvedValue(plan);
      mockPlanRepo.save.mockResolvedValue({ ...plan, status: 'COMPLETED' } as TrainingPlan);

      // Act
      await target.complete('TRN-001', 'user');

      // Assert
      expect(mockPlanRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException when status is COMPLETED', async () => {
      // Arrange
      const plan = { planNo: 'TRN-001', status: 'COMPLETED' } as TrainingPlan;
      mockPlanRepo.findOne.mockResolvedValue(plan);

      // Act & Assert
      await expect(target.complete('TRN-001', 'user')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── cancelComplete ───
  describe('cancelComplete', () => {
    it('should cancel completed plan', async () => {
      // Arrange
      const plan = { planNo: 'TRN-001', status: 'COMPLETED' } as TrainingPlan;
      mockPlanRepo.findOne.mockResolvedValue(plan);
      mockPlanRepo.save.mockResolvedValue({ ...plan, status: 'PLANNED' } as TrainingPlan);

      // Act
      await target.cancelComplete('TRN-001', 'user');

      // Assert
      expect(mockPlanRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException when not COMPLETED', async () => {
      // Arrange
      const plan = { planNo: 'TRN-001', status: 'PLANNED' } as TrainingPlan;
      mockPlanRepo.findOne.mockResolvedValue(plan);

      // Act & Assert
      await expect(target.cancelComplete('TRN-001', 'user')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── addResult ───
  describe('addResult', () => {
    it('should add training result', async () => {
      // Arrange
      const plan = { planNo: 'TRN-001' } as TrainingPlan;
      mockPlanRepo.findOne.mockResolvedValue(plan);
      const dto = { workerCode: 'W001', attended: true } as any;
      const entity = { planNo: 'TRN-001', ...dto } as TrainingResult;
      mockResultRepo.create.mockReturnValue(entity);
      mockResultRepo.save.mockResolvedValue(entity);

      // Act
      const result = await target.addResult('TRN-001', dto, 'COMP', 'PLANT', 'user');

      // Assert
      expect(result.planNo).toBe('TRN-001');
    });
  });

  // ─── updateResult ───
  describe('updateResult', () => {
    it('should update training result', async () => {
      // Arrange
      const item = { planNo: 'TRN-001', workerCode: 'W001' } as TrainingResult;
      mockResultRepo.findOne.mockResolvedValue(item);
      mockResultRepo.save.mockResolvedValue(item);

      // Act
      await target.updateResult('TRN-001', 'W001', { attended: false } as any);

      // Assert
      expect(mockResultRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when result not found', async () => {
      // Arrange
      mockResultRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.updateResult('TRN-001', 'W001', {})).rejects.toThrow(NotFoundException);
    });
  });

  // ─── deleteResult ───
  describe('deleteResult', () => {
    it('should delete training result', async () => {
      // Arrange
      const item = { planNo: 'TRN-001', workerCode: 'W001' } as TrainingResult;
      mockResultRepo.findOne.mockResolvedValue(item);
      mockResultRepo.remove.mockResolvedValue(item);

      // Act
      await target.deleteResult('TRN-001', 'W001');

      // Assert
      expect(mockResultRepo.remove).toHaveBeenCalledWith(item);
    });

    it('should throw NotFoundException when result not found', async () => {
      // Arrange
      mockResultRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.deleteResult('TRN-001', 'NONE')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findAll ───
  describe('findAll', () => {
    it('should return paginated results', async () => {
      // Arrange
      const qb = createMock<any>();
      qb.andWhere.mockReturnThis();
      qb.orderBy.mockReturnThis();
      qb.skip.mockReturnThis();
      qb.take.mockReturnThis();
      qb.getCount.mockResolvedValue(1);
      qb.getMany.mockResolvedValue([{ planNo: 'TRN-001' }]);
      mockPlanRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await target.findAll({ page: 1, limit: 50 } as any);

      // Assert
      expect(result.total).toBe(1);
    });
  });

  // ─── getWorkerHistory ───
  describe('getWorkerHistory', () => {
    it('should return worker history', async () => {
      // Arrange
      const qb = createMock<any>();
      qb.leftJoinAndSelect.mockReturnThis();
      qb.where.mockReturnThis();
      qb.andWhere.mockReturnThis();
      qb.orderBy.mockReturnThis();
      qb.getMany.mockResolvedValue([]);
      mockResultRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await target.getWorkerHistory('W001', 'COMP', 'PLANT');

      // Assert
      expect(result).toEqual([]);
    });
  });
});
