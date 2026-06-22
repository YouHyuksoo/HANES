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
import { MockLoggerService } from '@test/mock-logger.service';

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

  const mockQueryBuilder = (plans: any[] = []) => {
    const qb: any = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(plans.length),
      getMany: jest.fn().mockResolvedValue(plans),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    return qb;
  };

  describe('findAllPlans', () => {
    it('should enrich plan equipment within tenant', async () => {
      const plan = { planCode: 'PM-001', equipCode: 'EQ-001', company: 'CO', plant: 'P01' } as any;
      mockPlanRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder([plan]));
      mockEquipRepo.find.mockResolvedValue([{ equipCode: 'EQ-001', equipName: 'Equip' }] as any);

      await target.findAllPlans({} as any, 'CO', 'P01');

      expect(mockEquipRepo.find).toHaveBeenCalledWith({
        where: { equipCode: expect.anything(), company: 'CO', plant: 'P01' },
        select: ['equipCode', 'equipName', 'lineCode', 'equipType'],
      });
    });
  });

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
    it('should validate equipment and create plan within request tenant', async () => {
      const saved = { planCode: 'PM-001', equipCode: 'EQ-001' } as any;
      mockEquipRepo.findOne.mockResolvedValue({ equipCode: 'EQ-001', company: 'CO', plant: 'P01' } as any);
      mockPlanRepo.create.mockReturnValue(saved);
      mockPlanRepo.save.mockResolvedValue(saved);
      mockPlanRepo.findOne.mockResolvedValue({ ...saved, items: [] });

      await target.createPlan({ equipCode: 'EQ-001', planCode: 'PM-001', planName: 'PM' } as any, 'CO', 'P01');

      expect(mockEquipRepo.findOne).toHaveBeenCalledWith({
        where: { equipCode: 'EQ-001', company: 'CO', plant: 'P01' },
      });
      expect(mockPlanRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ planCode: 'PM-001', equipCode: 'EQ-001', company: 'CO', plant: 'P01' }),
      );
    });

    it('should reject plan creation when equipment tenant differs from request tenant', async () => {
      mockEquipRepo.findOne.mockResolvedValue({ equipCode: 'EQ-001', company: 'OTHER', plant: 'P01' } as any);

      await expect(
        target.createPlan({ equipCode: 'EQ-001', planCode: 'PM-001', planName: 'PM' } as any, 'CO', 'P01'),
      ).rejects.toThrow(BadRequestException);

      expect(mockPlanRepo.create).not.toHaveBeenCalled();
      expect(mockPlanRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('createWorkOrder', () => {
    it('should validate equipment and create work order within tenant', async () => {
      mockEquipRepo.findOne.mockResolvedValue({ equipCode: 'EQ-001', company: 'CO', plant: 'P01' } as any);
      const qb = mockQueryBuilder([]);
      qb.getOne = jest.fn().mockResolvedValue(null);
      mockWoRepo.createQueryBuilder.mockReturnValue(qb);
      mockWoRepo.create.mockReturnValue({ workOrderNo: 'PM-20260318-001' } as any);
      mockWoRepo.save.mockResolvedValue({ workOrderNo: 'PM-20260318-001' } as any);

      await target.createWorkOrder(
        { equipCode: 'EQ-001', scheduledDate: '2026-03-18' } as any,
        'CO',
        'P01',
      );

      expect(mockEquipRepo.findOne).toHaveBeenCalledWith({
        where: { equipCode: 'EQ-001', company: 'CO', plant: 'P01' },
      });
      expect(mockWoRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ equipCode: 'EQ-001', company: 'CO', plant: 'P01' }),
      );
    });

    it('should reject work order creation when equipment tenant differs from request tenant', async () => {
      mockEquipRepo.findOne.mockResolvedValue({ equipCode: 'EQ-001', company: 'OTHER', plant: 'P01' } as any);

      await expect(
        target.createWorkOrder({ equipCode: 'EQ-001', scheduledDate: '2026-03-18' } as any, 'CO', 'P01'),
      ).rejects.toThrow(BadRequestException);

      expect(mockWoRepo.create).not.toHaveBeenCalled();
      expect(mockWoRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('generateWorkOrders', () => {
    // generateWorkOrders 채번/존재여부 조회용 WO 쿼리빌더 (where/andWhere/getMany + getOne)
    const woGenQueryBuilder = (existing: any[] = []) => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(existing),
      getOne: jest.fn().mockResolvedValue(null),
    });

    it('matches existing work orders by tenant as well as plan and date', async () => {
      const plan = {
        planCode: 'PM-001',
        equipCode: 'EQ-001',
        nextDueAt: new Date('2026-03-18T00:00:00Z'),
        pmType: 'TIME_BASED',
        company: 'CO',
        plant: 'P01',
      } as PmPlan;
      // 1st plan QB: TIME_BASED 도래 계획 → [plan], 2nd plan QB: USAGE_BASED → []
      mockPlanRepo.createQueryBuilder
        .mockReturnValueOnce(mockQueryBuilder([plan]))
        .mockReturnValueOnce(mockQueryBuilder([]));
      // 기존 WO는 다른 테넌트(OTHER)라 set 키가 달라 매칭되지 않음 → 생성 진행
      mockWoRepo.createQueryBuilder.mockReturnValue(
        woGenQueryBuilder([
          {
            pmPlanCode: 'PM-001',
            scheduledDate: new Date('2026-03-18T00:00:00Z'),
            company: 'OTHER',
            plant: 'P01',
          },
        ]) as any,
      );
      mockWoRepo.create.mockImplementation((value) => value as any);
      mockWoRepo.save.mockResolvedValue({} as any);

      const result = await target.generateWorkOrders(2026, 3);

      expect(result.created).toBe(1);
      expect(mockWoRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ pmPlanCode: 'PM-001', company: 'CO', plant: 'P01' }),
      );
    });

    it('resets usage-based plan within the plan tenant only', async () => {
      const plan = {
        planCode: 'PM-001',
        equipCode: 'EQ-001',
        nextDueAt: new Date('2026-03-18T00:00:00Z'),
        pmType: 'USAGE_BASED',
        company: 'CO',
        plant: 'P01',
      } as PmPlan;
      // 1st plan QB: TIME_BASED 도래 계획 없음 → [], 2nd plan QB: USAGE_BASED → [plan]
      mockPlanRepo.createQueryBuilder
        .mockReturnValueOnce(mockQueryBuilder([]))
        .mockReturnValueOnce(mockQueryBuilder([plan]));
      mockWoRepo.createQueryBuilder.mockReturnValue(woGenQueryBuilder([]) as any);
      mockWoRepo.create.mockImplementation((value) => value as any);
      mockWoRepo.save.mockResolvedValue({} as any);

      await target.generateWorkOrders(2026, 3);

      expect(mockPlanRepo.update).toHaveBeenCalledWith(
        { planCode: 'PM-001', company: 'CO', plant: 'P01' },
        { currentUsage: 0 },
      );
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
      await expect(target.executeWorkOrder('1', { overallResult: 'PASS' } as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelWorkOrder', () => {
    it('should throw when COMPLETED', async () => {
      mockWoRepo.findOne.mockResolvedValue({ id: 1, status: 'COMPLETED' } as any);
      await expect(target.cancelWorkOrder('1')).rejects.toThrow(BadRequestException);
    });
  });
});
