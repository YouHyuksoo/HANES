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
import { NumberingService } from '../../../../shared/numbering.service';

describe('AuditService', () => {
  let target: AuditService;
  let mockAuditRepo: DeepMocked<Repository<AuditPlan>>;
  let mockFindingRepo: DeepMocked<Repository<AuditFinding>>;
  let mockNumbering: DeepMocked<NumberingService>;

  beforeEach(async () => {
    mockAuditRepo = createMock<Repository<AuditPlan>>();
    mockFindingRepo = createMock<Repository<AuditFinding>>();
    mockNumbering = createMock<NumberingService>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditPlan), useValue: mockAuditRepo },
        { provide: getRepositoryToken(AuditFinding), useValue: mockFindingRepo },
        { provide: NumberingService, useValue: mockNumbering },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<AuditService>(AuditService);
  });
  afterEach(() => jest.clearAllMocks());

  /** 트랜잭션·공통코드·CAPA 조회용 매니저 모의: 쿼리는 건수 1, 트랜잭션은 같은 저장소를 돌려준다 */
  const stubManager = () => {
    const manager: any = {
      query: jest.fn().mockResolvedValue([{ cnt: 1 }]),
      getRepository: jest.fn((entity: unknown) => (entity === AuditFinding ? mockFindingRepo : mockAuditRepo)),
      transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)),
    };
    (mockAuditRepo as any).manager = manager;
    return manager;
  };

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
      stubManager();
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

  describe('결함 수정', () => {
    it('발견사항 등록은 심사 행을 잠근 뒤 번호를 정한다', async () => {
      const manager = stubManager();
      mockAuditRepo.findOne.mockResolvedValue({ auditNo: 'AUD-001', status: 'IN_PROGRESS', company: 'CO', plant: 'P01' } as any);
      const qb: any = { where: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue({ findingNo: 3 }) };
      mockFindingRepo.createQueryBuilder.mockReturnValue(qb);
      mockFindingRepo.create.mockImplementation((v: any) => v);
      mockFindingRepo.save.mockImplementation(async (v: any) => v);

      const saved = await target.addFinding({ auditId: 'AUD-001', category: 'OFI', description: 'd' } as any, 'CO', 'P01', 'user');

      expect(saved.findingNo).toBe(4);
      expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE'), ['AUD-001', 'CO', 'P01']);
    });

    it('완료·종결된 심사에는 발견사항을 등록할 수 없다', async () => {
      stubManager();
      mockAuditRepo.findOne.mockResolvedValue({ auditNo: 'AUD-001', status: 'COMPLETED', company: 'CO', plant: 'P01' } as any);
      await expect(target.addFinding({ auditId: 'AUD-001' } as any, 'CO', 'P01', 'user')).rejects.toThrow('계획 또는 진행중 상태의 심사에서만');
      expect(mockFindingRepo.save).not.toHaveBeenCalled();
    });

    it('CAPA 연결은 번호가 있고 실제로 있어야 하며 종결된 발견사항은 거부한다', async () => {
      const manager = stubManager();
      mockFindingRepo.findOne.mockResolvedValue({ auditId: 'AUD-001', findingNo: 1, status: 'OPEN', company: 'CO', plant: 'P01' } as any);
      await expect(target.linkCapa('AUD-001', 1, undefined as never, 'CO', 'P01')).rejects.toThrow('CAPA 번호가 없습니다');

      manager.query.mockResolvedValue([{ cnt: 0 }]);
      await expect(target.linkCapa('AUD-001', 1, 'CAPA-X', 'CO', 'P01')).rejects.toThrow(NotFoundException);
      expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('CAPA_REQUESTS'), ['CAPA-X', 'CO', 'P01']);

      mockFindingRepo.findOne.mockResolvedValue({ auditId: 'AUD-001', findingNo: 1, status: 'CLOSED', company: 'CO', plant: 'P01' } as any);
      await expect(target.linkCapa('AUD-001', 1, 'CAPA-1', 'CO', 'P01')).rejects.toThrow('종결된 발견사항');
      expect(mockFindingRepo.save).not.toHaveBeenCalled();
    });

    it('심사 계획을 지우면 발견사항도 한 트랜잭션으로 함께 지운다', async () => {
      const manager = stubManager();
      const item = { auditNo: 'AUD-001', status: 'PLANNED', company: 'CO', plant: 'P01' } as any;
      mockAuditRepo.findOne.mockResolvedValue(item);

      await target.delete('AUD-001', 'CO', 'P01');

      expect(manager.transaction).toHaveBeenCalledTimes(1);
      expect(mockFindingRepo.delete).toHaveBeenCalledWith({ auditId: 'AUD-001', company: 'CO', plant: 'P01' });
      expect(mockAuditRepo.remove).toHaveBeenCalledWith(item);
    });

    it('완료의 종합 결과는 공통코드(AUDIT_RESULT)에 있어야 한다', async () => {
      const manager = stubManager();
      const item = { auditNo: 'AUD-001', status: 'IN_PROGRESS', company: 'CO', plant: 'P01' } as any;
      mockAuditRepo.findOne.mockResolvedValue(item);
      mockAuditRepo.save.mockImplementation(async (v: any) => v);

      manager.query.mockResolvedValue([{ cnt: 0 }]);
      await expect(target.complete('AUD-001', 'ZZ', 'user', 'CO', 'P01')).rejects.toThrow('공통코드(AUDIT_RESULT)');
      expect(mockAuditRepo.save).not.toHaveBeenCalled();

      // 결과를 비워 완료하는 화면 호출은 그대로 통과한다
      const done = await target.complete('AUD-001', undefined as never, 'user', 'CO', 'P01');
      expect(done.status).toBe('COMPLETED');
    });

    it('목록의 기간은 시작일·종료일 중 하나만 와도 걸린다', async () => {
      const qb: any = {
        andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0), getMany: jest.fn().mockResolvedValue([]),
      };
      mockAuditRepo.createQueryBuilder.mockReturnValue(qb);
      await target.findAll({ fromDate: '2026-11-05T00:00:00.000Z' } as any, 'CO', 'P01');
      expect(qb.andWhere).toHaveBeenCalledWith('a.createdAt >= :fromDate', { fromDate: expect.any(Date) });
      expect(qb.andWhere).not.toHaveBeenCalledWith('a.createdAt <= :toDate', expect.anything());
    });

    it('수정에서 비울 수 없는 칸에 null 이 오면 그대로 둔다', async () => {
      const item = { auditNo: 'AUD-001', status: 'PLANNED', auditType: 'SYSTEM', auditScope: '범위', auditor: '홍', company: 'CO', plant: 'P01' } as any;
      mockAuditRepo.findOne.mockResolvedValue(item);
      mockAuditRepo.save.mockImplementation(async (v: any) => v);
      const r = await target.update('AUD-001', { auditType: null, auditScope: null, auditor: null, scheduledDate: null, summary: '메모' } as any, 'user');
      expect(r).toMatchObject({ auditType: 'SYSTEM', auditScope: '범위', auditor: '홍', summary: '메모' });
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
      stubManager();
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
