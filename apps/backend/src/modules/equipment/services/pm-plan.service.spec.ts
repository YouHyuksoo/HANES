/**
 * @file pm-plan.service.spec.ts
 * @description PmPlanService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PmPlanService } from './pm-plan.service';
import { PmPlan } from '../../../entities/pm-plan.entity';
import { PmPlanItem } from '../../../entities/pm-plan-item.entity';
import { PmWorkOrder } from '../../../entities/pm-work-order.entity';
import { PmWoResult } from '../../../entities/pm-wo-result.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('PmPlanService', () => {
  let target: PmPlanService;
  let mockPlanRepo: DeepMocked<Repository<PmPlan>>;
  let mockItemRepo: DeepMocked<Repository<PmPlanItem>>;
  let mockWoRepo: DeepMocked<Repository<PmWorkOrder>>;
  let mockWoResultRepo: DeepMocked<Repository<PmWoResult>>;
  let mockEquipRepo: DeepMocked<Repository<EquipMaster>>;

  beforeEach(async () => {
    mockPlanRepo = createMock<Repository<PmPlan>>();
    mockItemRepo = createMock<Repository<PmPlanItem>>();
    mockWoRepo = createMock<Repository<PmWorkOrder>>();
    mockWoResultRepo = createMock<Repository<PmWoResult>>();
    mockEquipRepo = createMock<Repository<EquipMaster>>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PmPlanService,
        { provide: getRepositoryToken(PmPlan), useValue: mockPlanRepo },
        { provide: getRepositoryToken(PmPlanItem), useValue: mockItemRepo },
        { provide: getRepositoryToken(PmWorkOrder), useValue: mockWoRepo },
        { provide: getRepositoryToken(PmWoResult), useValue: mockWoResultRepo },
        { provide: getRepositoryToken(EquipMaster), useValue: mockEquipRepo },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<PmPlanService>(PmPlanService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findPlanById', () => {
    it('should return plan with equip', async () => {
      mockPlanRepo.findOne.mockResolvedValue({ planCode: 'PM-001', equipCode: 'EQ-001', items: [] } as any);
      mockEquipRepo.findOne.mockResolvedValue({ equipCode: 'EQ-001', equipName: 'Equip' } as any);
      const r = await target.findPlanById('PM-001');
      expect(r.planCode).toBe('PM-001');
    });
    it('should throw NotFoundException', async () => {
      mockPlanRepo.findOne.mockResolvedValue(null);
      await expect(target.findPlanById('X')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createPlan', () => {
    it('should throw when equip not found', async () => {
      mockEquipRepo.findOne.mockResolvedValue(null);
      await expect(target.createPlan({ equipCode: 'X', planCode: 'PM-001' } as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deletePlan', () => {
    it('should delete plan', async () => {
      mockPlanRepo.findOne.mockResolvedValue({ planCode: 'PM-001' } as any);
      mockPlanRepo.delete.mockResolvedValue({ affected: 1 } as any);
      const r = await target.deletePlan('PM-001');
      expect(r.deleted).toBe(true);
    });
  });

  describe('executeWorkOrder', () => {
    it('should throw when already COMPLETED', async () => {
      mockWoRepo.findOne.mockResolvedValue({ id: 1, status: 'COMPLETED' } as any);
      await expect(target.executeWorkOrder(1, { overallResult: 'PASS' } as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelWorkOrder', () => {
    it('should throw when COMPLETED', async () => {
      mockWoRepo.findOne.mockResolvedValue({ id: 1, status: 'COMPLETED' } as any);
      await expect(target.cancelWorkOrder(1)).rejects.toThrow(BadRequestException);
    });
  });
});
