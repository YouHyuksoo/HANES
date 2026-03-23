/**
 * @file control-plan.service.spec.ts
 * @description ControlPlanService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ControlPlanService } from './control-plan.service';
import { ControlPlan } from '../../../../entities/control-plan.entity';
import { ControlPlanItem } from '../../../../entities/control-plan-item.entity';
import { MockLoggerService } from '../../../../common/test/mock-logger.service';

describe('ControlPlanService', () => {
  let target: ControlPlanService;
  let mockPlanRepo: DeepMocked<Repository<ControlPlan>>;
  let mockItemRepo: DeepMocked<Repository<ControlPlanItem>>;

  beforeEach(async () => {
    mockPlanRepo = createMock<Repository<ControlPlan>>();
    mockItemRepo = createMock<Repository<ControlPlanItem>>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ControlPlanService,
        { provide: getRepositoryToken(ControlPlan), useValue: mockPlanRepo },
        { provide: getRepositoryToken(ControlPlanItem), useValue: mockItemRepo },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<ControlPlanService>(ControlPlanService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findById', () => {
    it('should return plan with items', async () => {
      mockPlanRepo.findOne.mockResolvedValue({ planNo: 'CP-001' } as any);
      const qb: any = { where: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([]) };
      mockItemRepo.createQueryBuilder.mockReturnValue(qb);
      const r = await target.findById('CP-001');
      expect(r.planNo).toBe('CP-001');
    });
    it('should throw NotFoundException', async () => {
      mockPlanRepo.findOne.mockResolvedValue(null);
      await expect(target.findById('CP-999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('approve', () => {
    it('should approve DRAFT plan', async () => {
      const plan = { planNo: 'CP-001', status: 'DRAFT' } as any;
      mockPlanRepo.findOne.mockResolvedValue(plan);
      mockPlanRepo.save.mockResolvedValue({ ...plan, status: 'APPROVED' });
      const r = await target.approve('CP-001', 'user');
      expect(r.status).toBe('APPROVED');
    });
    it('should throw when OBSOLETE', async () => {
      mockPlanRepo.findOne.mockResolvedValue({ planNo: 'CP-001', status: 'OBSOLETE' } as any);
      await expect(target.approve('CP-001', 'user')).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('should throw when not DRAFT', async () => {
      mockPlanRepo.findOne.mockResolvedValue({ planNo: 'CP-001', status: 'APPROVED' } as any);
      await expect(target.delete('CP-001')).rejects.toThrow(BadRequestException);
    });
  });
});
