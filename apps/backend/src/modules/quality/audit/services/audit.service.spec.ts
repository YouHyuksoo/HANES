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
import { MockLoggerService } from '../../../../common/test/mock-logger.service';

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
      expect((await target.findById(1)).auditNo).toBe('AUD-001');
    });
    it('should throw NotFoundException', async () => {
      mockAuditRepo.findOne.mockResolvedValue(null);
      await expect(target.findById(999)).rejects.toThrow(NotFoundException);
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
      await expect(target.update(1, {} as any, 'user')).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('should throw when not PLANNED', async () => {
      mockAuditRepo.findOne.mockResolvedValue({ id: 1, status: 'IN_PROGRESS' } as any);
      await expect(target.delete(1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('complete', () => {
    it('should complete audit', async () => {
      const item = { id: 1, auditNo: 'AUD-001', status: 'IN_PROGRESS' } as any;
      mockAuditRepo.findOne.mockResolvedValue(item);
      mockAuditRepo.save.mockResolvedValue({ ...item, status: 'COMPLETED' });
      const r = await target.complete(1, 'PASS', 'user');
      expect(r.status).toBe('COMPLETED');
    });
    it('should throw when CLOSED', async () => {
      mockAuditRepo.findOne.mockResolvedValue({ id: 1, status: 'CLOSED' } as any);
      await expect(target.complete(1, 'PASS', 'user')).rejects.toThrow(BadRequestException);
    });
  });

  describe('close', () => {
    it('should close completed audit', async () => {
      const item = { id: 1, auditNo: 'AUD-001', status: 'COMPLETED' } as any;
      mockAuditRepo.findOne.mockResolvedValue(item);
      mockAuditRepo.save.mockResolvedValue({ ...item, status: 'CLOSED' });
      const r = await target.close(1, 'user');
      expect(r.status).toBe('CLOSED');
    });
  });

  describe('linkCapa', () => {
    it('should link CAPA to finding', async () => {
      const finding = { auditId: 1, findingNo: 1, status: 'OPEN' } as any;
      mockAuditRepo.findOne.mockResolvedValue({ id: 1 } as any);
      mockFindingRepo.findOne.mockResolvedValue(finding);
      mockFindingRepo.save.mockResolvedValue({ ...finding, capaId: 10, status: 'IN_PROGRESS' });
      const r = await target.linkCapa(1, 1, 10);
      expect(r.capaId).toBe(10);
    });
    it('should throw when finding not found', async () => {
      mockFindingRepo.findOne.mockResolvedValue(null);
      await expect(target.linkCapa(1, 99, 10)).rejects.toThrow(NotFoundException);
    });
  });
});
