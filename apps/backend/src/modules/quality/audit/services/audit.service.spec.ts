/**
 * @file audit.service.spec.ts
 * @description AuditService 단위 테스트 - 심사 CRUD + 상태 전이 + 발견사항
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuditService } from './audit.service';
import { AuditPlan } from '../../../../entities/audit-plan.entity';
import { AuditFinding } from '../../../../entities/audit-finding.entity';
import { MockLoggerService } from '@test/mock-logger.service';

describe('AuditService', () => {
  let target: AuditService;
  let mockAuditRepo: DeepMocked<Repository<AuditPlan>>;
  let mockFindingRepo: DeepMocked<Repository<AuditFinding>>;

  beforeEach(async () => {
    mockAuditRepo = createMock<Repository<AuditPlan>>();
    mockFindingRepo = createMock<Repository<AuditFinding>>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditPlan), useValue: mockAuditRepo },
        { provide: getRepositoryToken(AuditFinding), useValue: mockFindingRepo },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<AuditService>(AuditService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findById', () => {
    it('should return audit plan', async () => {
      mockAuditRepo.findOne.mockResolvedValue({ id: 1, auditNo: 'AUD-001' } as any);
      expect((await target.findById('AUD-001')).auditNo).toBe('AUD-001');
    });
    it('should throw NotFoundException', async () => {
      mockAuditRepo.findOne.mockResolvedValue(null);
      await expect(target.findById('999')).rejects.toThrow(NotFoundException);
    });

    it('scopes audit lookup by tenant', async () => {
      mockAuditRepo.findOne.mockResolvedValue({ auditNo: 'AUD-001', company: 'CO', plant: 'P01' } as any);

      await target.findById('AUD-001' as any, 'CO', 'P01');

      expect(mockAuditRepo.findOne).toHaveBeenCalledWith({
        where: { auditNo: 'AUD-001', company: 'CO', plant: 'P01' },
      });
    });
  });

  describe('create', () => {
    it('should create audit plan with PLANNED status', async () => {
      const qb: any = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(null) };
      mockAuditRepo.createQueryBuilder.mockReturnValue(qb);
      const saved = { id: 1, auditNo: 'AUD-20260318-001', status: 'PLANNED' } as any;
      mockAuditRepo.create.mockReturnValue(saved);
      mockAuditRepo.save.mockResolvedValue(saved);
      const result = await target.create({} as any, 'HANES', 'P01', 'user');
      expect(result.status).toBe('PLANNED');
    });
  });

  describe('update', () => {
    it('should throw when not PLANNED', async () => {
      mockAuditRepo.findOne.mockResolvedValue({ id: 1, status: 'COMPLETED' } as any);
      await expect(target.update('AUD-001', {} as any, 'user')).rejects.toThrow(BadRequestException);
    });

    it('should update only DTO fields and keep tenant/audit key columns from the matched audit', async () => {
      const item = { auditNo: 'AUD-001', auditScope: 'Old', status: 'PLANNED', company: 'CO', plant: 'P01' } as unknown as AuditPlan;
      mockAuditRepo.findOne.mockResolvedValue(item);
      mockAuditRepo.save.mockImplementation(async (value) => value as AuditPlan);

      const result = await target.update('AUD-001' as any, {
        auditNo: 'AUD-999',
        auditScope: 'New',
        title: 'Ignored',
        company: 'OTHER',
        plant: 'P99',
      } as any, 'user');

      expect(result).toEqual(expect.objectContaining({
        auditNo: 'AUD-001',
        auditScope: 'New',
        company: 'CO',
        plant: 'P01',
        updatedBy: 'user',
      }));
      expect(result).not.toHaveProperty('title');
    });

    it('rejects update when audit belongs to a different tenant', async () => {
      mockAuditRepo.findOne.mockResolvedValue({ auditNo: 'AUD-001', status: 'PLANNED', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.update('AUD-001' as any, {} as any, 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockAuditRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should throw when not PLANNED', async () => {
      mockAuditRepo.findOne.mockResolvedValue({ id: 1, status: 'IN_PROGRESS' } as any);
      await expect(target.delete('AUD-001')).rejects.toThrow(BadRequestException);
    });

    it('rejects delete when audit belongs to a different tenant', async () => {
      mockAuditRepo.findOne.mockResolvedValue({ auditNo: 'AUD-001', status: 'PLANNED', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.delete('AUD-001' as any, 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockAuditRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('complete', () => {
    it('should complete audit', async () => {
      const item = { id: 1, auditNo: 'AUD-001', status: 'IN_PROGRESS' } as any;
      mockAuditRepo.findOne.mockResolvedValue(item);
      mockAuditRepo.save.mockResolvedValue({ ...item, status: 'COMPLETED' });
      const r = await target.complete('AUD-001', 'PASS', 'user');
      expect(r.status).toBe('COMPLETED');
    });
    it('should throw when CLOSED', async () => {
      mockAuditRepo.findOne.mockResolvedValue({ id: 1, status: 'CLOSED' } as any);
      await expect(target.complete('AUD-001', 'PASS', 'user')).rejects.toThrow(BadRequestException);
    });

    it('rejects complete when audit belongs to a different tenant', async () => {
      mockAuditRepo.findOne.mockResolvedValue({ auditNo: 'AUD-001', status: 'IN_PROGRESS', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.complete('AUD-001' as any, 'PASS', 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockAuditRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should close completed audit', async () => {
      const item = { id: 1, auditNo: 'AUD-001', status: 'COMPLETED' } as any;
      mockAuditRepo.findOne.mockResolvedValue(item);
      mockAuditRepo.save.mockResolvedValue({ ...item, status: 'CLOSED' });
      const r = await target.close('AUD-001', 'user');
      expect(r.status).toBe('CLOSED');
    });

    it('rejects close when audit belongs to a different tenant', async () => {
      mockAuditRepo.findOne.mockResolvedValue({ auditNo: 'AUD-001', status: 'COMPLETED', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.close('AUD-001' as any, 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockAuditRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('findings', () => {
    it('rejects addFinding when audit belongs to a different tenant', async () => {
      mockAuditRepo.findOne.mockResolvedValue({ auditNo: 'AUD-001', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.addFinding({ auditId: 'AUD-001' } as any, 'CO', 'P01', 'user')).rejects.toThrow(BadRequestException);
      expect(mockFindingRepo.save).not.toHaveBeenCalled();
    });

    it('scopes findings by tenant', async () => {
      mockFindingRepo.find.mockResolvedValue([]);
      await target.getFindings('AUD-001' as any, 'CO', 'P01');
      expect(mockFindingRepo.find).toHaveBeenCalledWith({
        where: { auditId: 'AUD-001', company: 'CO', plant: 'P01' },
        order: { findingNo: 'ASC' },
      });
    });
  });

  describe('linkCapa', () => {
    it('should link CAPA to finding', async () => {
      const finding = { auditId: 1, findingNo: 1, status: 'OPEN' } as any;
      mockAuditRepo.findOne.mockResolvedValue({ id: 1 } as any);
      mockFindingRepo.findOne.mockResolvedValue(finding);
      mockFindingRepo.save.mockResolvedValue({ ...finding, capaId: 10, status: 'IN_PROGRESS' });
      const r = await target.linkCapa('AUD-001', 1, '10');
      expect(r.capaId).toBe(10);
    });
    it('should throw when finding not found', async () => {
      mockFindingRepo.findOne.mockResolvedValue(null);
      await expect(target.linkCapa('AUD-001', 99, '10')).rejects.toThrow(NotFoundException);
    });

    it('rejects linkCapa when finding belongs to a different tenant', async () => {
      mockFindingRepo.findOne.mockResolvedValue({ auditId: 'AUD-001', findingNo: 1, status: 'OPEN', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.linkCapa('AUD-001' as any, 1, 'CAPA-001', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockFindingRepo.save).not.toHaveBeenCalled();
    });
  });
});
