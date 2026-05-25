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
import { MockLoggerService } from '@test/mock-logger.service';

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

    it('scopes plan and items by tenant', async () => {
      mockPlanRepo.findOne.mockResolvedValue({ planNo: 'CP-001', company: 'CO', plant: 'P01' } as any);
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockItemRepo.createQueryBuilder.mockReturnValue(qb);

      await target.findById('CP-001', 'CO', 'P01');

      expect(mockPlanRepo.findOne).toHaveBeenCalledWith({
        where: { planNo: 'CP-001', company: 'CO', plant: 'P01' },
      });
      expect(qb.andWhere).toHaveBeenCalledWith('i.company = :company', { company: 'CO' });
      expect(qb.andWhere).toHaveBeenCalledWith('i.plant = :plant', { plant: 'P01' });
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

    it('rejects approve when the plan belongs to a different tenant', async () => {
      mockPlanRepo.findOne.mockResolvedValue({ planNo: 'CP-001', status: 'DRAFT', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.approve('CP-001', 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockPlanRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should throw when not DRAFT', async () => {
      mockPlanRepo.findOne.mockResolvedValue({ planNo: 'CP-001', status: 'APPROVED' } as any);
      await expect(target.delete('CP-001')).rejects.toThrow(BadRequestException);
    });

    it('rejects delete when the plan belongs to a different tenant', async () => {
      mockPlanRepo.findOne.mockResolvedValue({ planNo: 'CP-001', status: 'DRAFT', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.delete('CP-001', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockPlanRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('rejects update when the plan belongs to a different tenant', async () => {
      mockPlanRepo.findOne.mockResolvedValue({ planNo: 'CP-001', status: 'DRAFT', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.update('CP-001', { itemName: 'New' } as any, 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockPlanRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('revise', () => {
    it('rejects revise when the plan belongs to a different tenant', async () => {
      mockPlanRepo.findOne.mockResolvedValue({ planNo: 'CP-001', status: 'APPROVED', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.revise('CP-001', 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockPlanRepo.save).not.toHaveBeenCalled();
    });
  });
});
