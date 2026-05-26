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
import { DataSource, Repository } from 'typeorm';
import { TrainingService } from './training.service';
import { TrainingPlan } from '../../../entities/training-plan.entity';
import { TrainingResult } from '../../../entities/training-result.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('TrainingService', () => {
  let target: TrainingService;
  let mockPlanRepo: DeepMocked<Repository<TrainingPlan>>;
  let mockResultRepo: DeepMocked<Repository<TrainingResult>>;
  let mockDataSource: {
    transaction: jest.Mock;
  };
  let mockTx: {
    run: jest.Mock;
  };
  let mockNumbering: {
    next: jest.Mock;
  };

  beforeEach(async () => {
    mockPlanRepo = createMock<Repository<TrainingPlan>>();
    mockResultRepo = createMock<Repository<TrainingResult>>();
    mockDataSource = {
      transaction: jest.fn(async (callback) =>
        callback({
          delete: jest.fn(),
          remove: jest.fn(),
        }),
      ),
    };
    mockTx = {
      run: jest.fn(async (callback) =>
        callback({
          manager: {
            delete: jest.fn(),
            remove: jest.fn(),
          },
        }),
      ),
    };
    mockNumbering = {
      next: jest.fn().mockResolvedValue('TRN-20260318-001'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrainingService,
        { provide: getRepositoryToken(TrainingPlan), useValue: mockPlanRepo },
        { provide: getRepositoryToken(TrainingResult), useValue: mockResultRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
        { provide: NumberingService, useValue: mockNumbering },
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

    it('scopes training plan lookup by tenant', async () => {
      const plan = { planNo: 'TRN-001', company: 'COMP', plant: 'PLANT' } as TrainingPlan;
      mockPlanRepo.findOne.mockResolvedValue(plan);

      await target.findById('TRN-001', 'COMP', 'PLANT');

      expect(mockPlanRepo.findOne).toHaveBeenCalledWith({
        where: { planNo: 'TRN-001', company: 'COMP', plant: 'PLANT' },
      });
    });
  });

  // ─── create ───
  describe('create', () => {
    it('should create plan with PLANNED status', async () => {
      // Arrange
      const dto = { title: 'Test Training' } as any;
      const entity = { planNo: 'TRN-20260318-001', status: 'PLANNED', ...dto } as TrainingPlan;
      mockPlanRepo.create.mockReturnValue(entity);
      mockPlanRepo.save.mockResolvedValue(entity);

      // Act
      const result = await target.create(dto, 'COMP', 'PLANT', 'user');

      // Assert
      expect(result.status).toBe('PLANNED');
      expect(mockNumbering.next).toHaveBeenCalledWith(
        'TRAINING_PLAN',
        undefined,
        'user',
      );
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

    it('should keep tenant and plan key columns from the matched plan when update payload contains them', async () => {
      const plan = { planNo: 'TRN-001', title: 'Old', status: 'PLANNED', company: 'COMP', plant: 'PLANT' } as TrainingPlan;
      mockPlanRepo.findOne.mockResolvedValue(plan);
      mockPlanRepo.save.mockImplementation(async (value) => value as TrainingPlan);

      const result = await target.update('TRN-001', {
        planNo: 'TRN-999',
        title: 'New',
        company: 'OTHER',
        plant: 'OTHER_PLANT',
      } as any, 'user');

      expect(result).toEqual(expect.objectContaining({
        planNo: 'TRN-001',
        title: 'New',
        company: 'COMP',
        plant: 'PLANT',
        updatedBy: 'user',
      }));
    });

    it('rejects update when plan belongs to a different tenant', async () => {
      const plan = { planNo: 'TRN-001', status: 'PLANNED', company: 'OTHER', plant: 'PLANT' } as TrainingPlan;
      mockPlanRepo.findOne.mockResolvedValue(plan);

      await expect(
        target.update('TRN-001', { title: 'Updated' } as any, 'user', 'COMP', 'PLANT'),
      ).rejects.toThrow(BadRequestException);
      expect(mockPlanRepo.save).not.toHaveBeenCalled();
    });
  });

  // ─── delete ───
  describe('delete', () => {
    it('should delete plan and associated results', async () => {
      // Arrange
      const plan = { planNo: 'TRN-001', status: 'PLANNED' } as TrainingPlan;
      const manager = {
        delete: jest.fn().mockResolvedValue({ affected: 0 }),
        remove: jest.fn().mockResolvedValue(plan),
      };
      mockTx.run.mockImplementationOnce(async (callback) =>
        callback({ manager }),
      );
      mockPlanRepo.findOne.mockResolvedValue(plan);

      // Act
      await target.delete('TRN-001');

      // Assert
      expect(manager.delete).toHaveBeenCalledWith(TrainingResult, {
        planNo: 'TRN-001',
      });
      expect(manager.remove).toHaveBeenCalledWith(TrainingPlan, plan);
    });

    it('rejects delete when plan belongs to a different tenant', async () => {
      const plan = { planNo: 'TRN-001', company: 'COMP', plant: 'OTHER' } as TrainingPlan;
      mockPlanRepo.findOne.mockResolvedValue(plan);

      await expect(target.delete('TRN-001', 'COMP', 'PLANT')).rejects.toThrow(BadRequestException);
      expect(mockTx.run).not.toHaveBeenCalled();
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

    it('rejects complete when plan belongs to a different tenant', async () => {
      const plan = { planNo: 'TRN-001', status: 'PLANNED', company: 'OTHER', plant: 'PLANT' } as TrainingPlan;
      mockPlanRepo.findOne.mockResolvedValue(plan);

      await expect(target.complete('TRN-001', 'user', 'COMP', 'PLANT')).rejects.toThrow(BadRequestException);
      expect(mockPlanRepo.save).not.toHaveBeenCalled();
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

    it('rejects cancelComplete when plan belongs to a different tenant', async () => {
      const plan = { planNo: 'TRN-001', status: 'COMPLETED', company: 'COMP', plant: 'OTHER' } as TrainingPlan;
      mockPlanRepo.findOne.mockResolvedValue(plan);

      await expect(target.cancelComplete('TRN-001', 'user', 'COMP', 'PLANT')).rejects.toThrow(BadRequestException);
      expect(mockPlanRepo.save).not.toHaveBeenCalled();
    });
  });

  // ─── addResult ───
  describe('addResult', () => {
    it('should add training result', async () => {
      // Arrange
      const plan = { planNo: 'TRN-001', company: 'COMP', plant: 'PLANT' } as TrainingPlan;
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

    it('rejects addResult when plan belongs to a different tenant', async () => {
      const plan = { planNo: 'TRN-001', company: 'OTHER', plant: 'PLANT' } as TrainingPlan;
      mockPlanRepo.findOne.mockResolvedValue(plan);

      await expect(
        target.addResult('TRN-001', { workerCode: 'W001' } as any, 'COMP', 'PLANT', 'user'),
      ).rejects.toThrow(BadRequestException);
      expect(mockResultRepo.save).not.toHaveBeenCalled();
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

    it('should keep tenant and result key columns from the matched training result when update payload contains them', async () => {
      const item = { planNo: 'TRN-001', workerCode: 'W001', workerName: 'Old', company: 'COMP', plant: 'PLANT' } as TrainingResult;
      mockResultRepo.findOne.mockResolvedValue(item);
      mockResultRepo.save.mockImplementation(async (value) => value as TrainingResult);

      const result = await target.updateResult('TRN-001', 'W001', {
        planNo: 'TRN-999',
        workerCode: 'W999',
        workerName: 'New',
        company: 'OTHER',
        plant: 'OTHER_PLANT',
      } as any);

      expect(result).toEqual(expect.objectContaining({
        planNo: 'TRN-001',
        workerCode: 'W001',
        workerName: 'New',
        company: 'COMP',
        plant: 'PLANT',
      }));
    });

    it('should throw NotFoundException when result not found', async () => {
      // Arrange
      mockResultRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.updateResult('TRN-001', 'W001', {})).rejects.toThrow(NotFoundException);
    });

    it('scopes training result lookup by tenant', async () => {
      const item = { planNo: 'TRN-001', workerCode: 'W001', company: 'COMP', plant: 'PLANT' } as TrainingResult;
      mockResultRepo.findOne.mockResolvedValue(item);
      mockResultRepo.save.mockResolvedValue(item);

      await target.updateResult('TRN-001', 'W001', { attended: true } as any, 'COMP', 'PLANT');

      expect(mockResultRepo.findOne).toHaveBeenCalledWith({
        where: { planNo: 'TRN-001', workerCode: 'W001', company: 'COMP', plant: 'PLANT' },
      });
    });

    it('rejects updateResult when result belongs to a different tenant', async () => {
      const item = { planNo: 'TRN-001', workerCode: 'W001', company: 'OTHER', plant: 'PLANT' } as TrainingResult;
      mockResultRepo.findOne.mockResolvedValue(item);

      await expect(
        target.updateResult('TRN-001', 'W001', { attended: true } as any, 'COMP', 'PLANT'),
      ).rejects.toThrow(BadRequestException);
      expect(mockResultRepo.save).not.toHaveBeenCalled();
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

    it('rejects deleteResult when result belongs to a different tenant', async () => {
      const item = { planNo: 'TRN-001', workerCode: 'W001', company: 'COMP', plant: 'OTHER' } as TrainingResult;
      mockResultRepo.findOne.mockResolvedValue(item);

      await expect(target.deleteResult('TRN-001', 'W001', 'COMP', 'PLANT')).rejects.toThrow(BadRequestException);
      expect(mockResultRepo.remove).not.toHaveBeenCalled();
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

  describe('getResults', () => {
    it('loads worker photos with 1-based binds and tenant filters', async () => {
      const plan = { planNo: 'TRN-001', company: 'COMP', plant: 'PLANT' } as TrainingPlan;
      mockPlanRepo.findOne.mockResolvedValue(plan);

      const resultQb = createMock<any>();
      resultQb.where.mockReturnThis();
      resultQb.andWhere.mockReturnThis();
      resultQb.orderBy.mockReturnThis();
      resultQb.getMany.mockResolvedValue([
        { planNo: 'TRN-001', workerCode: 'W001', company: 'COMP', plant: 'PLANT' },
        { planNo: 'TRN-001', workerCode: 'W002', company: 'COMP', plant: 'PLANT' },
      ]);
      mockResultRepo.createQueryBuilder.mockReturnValue(resultQb);
      mockResultRepo.manager.query = jest.fn().mockResolvedValue([]);

      await target.getResults('TRN-001', 'COMP', 'PLANT');

      expect(mockResultRepo.manager.query).toHaveBeenCalledWith(
        expect.stringContaining('WORKER_CODE IN (:1,:2)'),
        ['W001', 'W002', 'COMP', 'PLANT'],
      );
      expect(mockResultRepo.manager.query).toHaveBeenCalledWith(
        expect.stringContaining('COMPANY = :3 AND PLANT_CD = :4'),
        expect.any(Array),
      );
    });
  });
});
