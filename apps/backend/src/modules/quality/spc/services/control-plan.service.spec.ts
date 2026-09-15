/**
 * @file control-plan.service.spec.ts
 * @description ControlPlanService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException, GoneException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ControlPlanService } from './control-plan.service';
import { ControlPlan } from '../../../../entities/control-plan.entity';
import { ControlPlanItem } from '../../../../entities/control-plan-item.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { NumberingService } from '../../../../shared/numbering.service';
import { TransactionService } from '../../../../shared/transaction.service';

describe('ControlPlanService', () => {
  let target: ControlPlanService;
  let mockPlanRepo: DeepMocked<Repository<ControlPlan>>;
  let mockItemRepo: DeepMocked<Repository<ControlPlanItem>>;
  let mockNumbering: DeepMocked<NumberingService>;

  beforeEach(async () => {
    mockPlanRepo = createMock<Repository<ControlPlan>>();
    mockItemRepo = createMock<Repository<ControlPlanItem>>();
    mockNumbering = createMock<NumberingService>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ControlPlanService,
        { provide: getRepositoryToken(ControlPlan), useValue: mockPlanRepo },
        { provide: getRepositoryToken(ControlPlanItem), useValue: mockItemRepo },
        { provide: NumberingService, useValue: mockNumbering },
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

  it('구 목록 API는 신규 Revision 테이블을 조회하는 adapter를 사용한다', async () => {
    const tx = createMock<TransactionService>();
    const query = jest.fn().mockResolvedValue([{ planNo: 'CP-20260915-001', itemCode: 'FG01', itemName: '제품', phase: 'PRODUCTION', revisionNo: 0, status: 'DRAFT' }]);
    tx.run.mockImplementation(async (callback) => callback({ query } as any));
    const adapter = new ControlPlanService(mockPlanRepo, mockItemRepo, mockNumbering, tx);
    const result = await adapter.findAll({ page: 1, limit: 50 }, '40', '1000');
    expect(result.data).toHaveLength(1);
    expect(String(query.mock.calls[0][0])).toContain('QUALITY_PLAN_REVISIONS');
    expect(mockPlanRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('구 쓰기 API는 레거시 테이블에 이중 저장하지 않고 신규 API 안내와 함께 종료한다', async () => {
    const tx = createMock<TransactionService>();
    const adapter = new ControlPlanService(mockPlanRepo, mockItemRepo, mockNumbering, tx);

    await expect(adapter.create({ itemCode: 'FG01', itemName: '제품' } as any, '40', '1000', 'tester'))
      .rejects.toThrow(GoneException);
    await expect(adapter.update('CP-001', {} as any, 'tester', '40', '1000')).rejects.toThrow(GoneException);
    await expect(adapter.delete('CP-001', '40', '1000')).rejects.toThrow(GoneException);
    await expect(adapter.approve('CP-001', 'tester', '40', '1000')).rejects.toThrow(GoneException);
    await expect(adapter.revise('CP-001', 'tester', '40', '1000')).rejects.toThrow(GoneException);
    expect(mockPlanRepo.save).not.toHaveBeenCalled();
    expect(mockItemRepo.save).not.toHaveBeenCalled();
  });
});
