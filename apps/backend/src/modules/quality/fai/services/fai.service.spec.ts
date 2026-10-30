/**
 * @file fai.service.spec.ts
 * @description FaiService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { FaiService } from './fai.service';
import { FaiRequest } from '../../../../entities/fai-request.entity';
import { FaiItem } from '../../../../entities/fai-item.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { NumberingService } from '../../../../shared/numbering.service';

describe('FaiService', () => {
  let target: FaiService;
  let mockFaiRepo: DeepMocked<Repository<FaiRequest>>;
  let mockItemRepo: DeepMocked<Repository<FaiItem>>;
  let mockNumbering: DeepMocked<NumberingService>;

  beforeEach(async () => {
    mockFaiRepo = createMock<Repository<FaiRequest>>();
    mockItemRepo = createMock<Repository<FaiItem>>();
    mockNumbering = createMock<NumberingService>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FaiService,
        { provide: getRepositoryToken(FaiRequest), useValue: mockFaiRepo },
        { provide: getRepositoryToken(FaiItem), useValue: mockItemRepo },
        { provide: NumberingService, useValue: mockNumbering },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<FaiService>(FaiService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findById', () => {
    it('should return fai with items', async () => {
      mockFaiRepo.findOne.mockResolvedValue({ id: 1, faiNo: 'FAI-001' } as any);
      mockItemRepo.find.mockResolvedValue([]);
      const r = await target.findById('FAI-001');
      expect(r.faiNo).toBe('FAI-001');
    });
    it('should throw NotFoundException', async () => {
      mockFaiRepo.findOne.mockResolvedValue(null);
      await expect(target.findById('999')).rejects.toThrow(NotFoundException);
    });

    it('scopes FAI lookup by tenant', async () => {
      mockFaiRepo.findOne.mockResolvedValue({ faiNo: 'FAI-001', company: 'CO', plant: 'P01' } as any);
      mockItemRepo.find.mockResolvedValue([]);

      await target.findById('FAI-001', 'CO', 'P01');

      expect(mockFaiRepo.findOne).toHaveBeenCalledWith({
        where: { faiNo: 'FAI-001', company: 'CO', plant: 'P01' },
      });
      expect(mockItemRepo.find).toHaveBeenCalledWith({
        where: { faiId: 'FAI-001' },
        order: { seq: 'ASC' },
      });
    });
  });

  describe('start', () => {
    it('should start from REQUESTED', async () => {
      const item = { id: 1, status: 'REQUESTED' } as any;
      mockFaiRepo.findOne.mockResolvedValue(item);
      mockFaiRepo.save.mockResolvedValue({ ...item, status: 'SAMPLING' });
      const r = await target.start('FAI-001', 'user');
      expect(r.status).toBe('SAMPLING');
    });
    it('should throw when not REQUESTED', async () => {
      mockFaiRepo.findOne.mockResolvedValue({ id: 1, status: 'PASS' } as any);
      await expect(target.start('FAI-001', 'user')).rejects.toThrow(BadRequestException);
    });

    it('rejects start when FAI belongs to a different tenant', async () => {
      mockFaiRepo.findOne.mockResolvedValue({ faiNo: 'FAI-001', status: 'REQUESTED', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.start('FAI-001', 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockFaiRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('complete', () => {
    it('should auto-determine PASS when all items OK', async () => {
      mockFaiRepo.findOne.mockResolvedValue({ id: 1, status: 'INSPECTING' } as any);
      mockItemRepo.find.mockResolvedValue([{ result: 'OK' } as any]);
      mockFaiRepo.save.mockImplementation(async (e) => e as any);
      const r = await target.complete('FAI-001', { result: 'PASS' } as any, 'user');
      expect(r.status).toBe('PASS');
    });
    it('should auto-determine FAIL when NG items exist', async () => {
      mockFaiRepo.findOne.mockResolvedValue({ id: 1, status: 'INSPECTING' } as any);
      mockItemRepo.find.mockResolvedValue([{ result: 'OK' } as any, { result: 'NG' } as any]);
      mockFaiRepo.save.mockImplementation(async (e) => e as any);
      const r = await target.complete('FAI-001', { result: 'PASS' } as any, 'user');
      expect(r.status).toBe('FAIL');
    });

    it('rejects complete when FAI belongs to a different tenant', async () => {
      mockFaiRepo.findOne.mockResolvedValue({ faiNo: 'FAI-001', status: 'INSPECTING', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.complete('FAI-001', { result: 'PASS' } as any, 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockItemRepo.find).not.toHaveBeenCalled();
      expect(mockFaiRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should throw when not REQUESTED', async () => {
      mockFaiRepo.findOne.mockResolvedValue({ id: 1, status: 'PASS' } as any);
      await expect(target.delete('FAI-001')).rejects.toThrow(BadRequestException);
    });

    it('rejects delete when FAI belongs to a different tenant', async () => {
      mockFaiRepo.findOne.mockResolvedValue({ faiNo: 'FAI-001', status: 'REQUESTED', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.delete('FAI-001', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockItemRepo.delete).not.toHaveBeenCalled();
      expect(mockFaiRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('rejects update when FAI belongs to a different tenant', async () => {
      mockFaiRepo.findOne.mockResolvedValue({ faiNo: 'FAI-001', status: 'REQUESTED', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.update('FAI-001', { remark: 'x' } as any, 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockFaiRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    it('rejects approve when FAI belongs to a different tenant', async () => {
      mockFaiRepo.findOne.mockResolvedValue({ faiNo: 'FAI-001', status: 'PASS', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.approve('FAI-001', 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockFaiRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('addItems', () => {
    it('rejects addItems when FAI belongs to a different tenant', async () => {
      mockFaiRepo.findOne.mockResolvedValue({ faiNo: 'FAI-001', status: 'REQUESTED', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.addItems('FAI-001', [{ seq: 1, inspectItem: 'A' }] as any, 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockItemRepo.delete).not.toHaveBeenCalled();
      expect(mockItemRepo.save).not.toHaveBeenCalled();
    });
  });
  describe('결함 수정', () => {
    const fai = (over: Record<string, unknown> = {}) => ({ faiNo: 'FAI-001', status: 'INSPECTING', ...over }) as any;

    it('판정(OK/NG)이 없는 항목이 있으면 완료할 수 없다 — NG 만 보고 합격시키던 것', async () => {
      mockFaiRepo.findOne.mockResolvedValue(fai());
      mockItemRepo.find.mockResolvedValue([{ result: 'OK' } as any, { result: null } as any]);
      await expect(target.complete('FAI-001', { result: 'PASS' } as any, 'user')).rejects.toThrow(/판정\(OK\/NG\)이 입력되지 않은 검사항목이 1건/);
      expect(mockFaiRepo.save).not.toHaveBeenCalled();
    });

    it('조건부 합격(CONDITIONAL)은 판정 안 된 항목이 있어도 수동으로 지정할 수 있다', async () => {
      mockFaiRepo.findOne.mockResolvedValue(fai());
      mockItemRepo.find.mockResolvedValue([{ result: null } as any]);
      mockFaiRepo.save.mockImplementation(async (e) => e as any);
      const r = await target.complete('FAI-001', { result: 'CONDITIONAL' } as any, 'user');
      expect(r.status).toBe('CONDITIONAL');
    });

    it('승인은 한 번만 된다', async () => {
      mockFaiRepo.findOne.mockResolvedValue(fai({ status: 'PASS', approvedAt: new Date() }));
      await expect(target.approve('FAI-001', 'user')).rejects.toThrow('이미 승인된 초물검사입니다.');
      expect(mockFaiRepo.save).not.toHaveBeenCalled();
    });

    it('판정이 끝난 요청은 검사항목을 바꿀 수 없다', async () => {
      mockFaiRepo.findOne.mockResolvedValue(fai({ status: 'PASS' }));
      await expect(target.addItems('FAI-001', [{ seq: 1, inspectItem: 'A', result: 'OK' }] as any, 'user')).rejects.toThrow('판정이 끝난 초물검사는 검사항목을 바꿀 수 없습니다.');
      expect(mockItemRepo.save).not.toHaveBeenCalled();
    });

    it('검사항목 본문은 배열·순번·항목명·판정·순번 중복을 검증한다', async () => {
      await expect(target.addItems('FAI-001', { seq: 1 } as any)).rejects.toThrow('배열이어야');
      await expect(target.addItems('FAI-001', [{ seq: 1 }] as any)).rejects.toThrow('순번(정수)과 항목명은 필수');
      await expect(target.addItems('FAI-001', [{ seq: 1, inspectItem: 'A', result: 'MAYBE' }] as any)).rejects.toThrow('OK 또는 NG');
      await expect(target.addItems('FAI-001', [{ seq: 1, inspectItem: 'A' }, { seq: 1, inspectItem: 'B' }] as any)).rejects.toThrow('순번이 중복되었습니다: 1');
      expect(mockFaiRepo.findOne).not.toHaveBeenCalled();
    });

    it('항목 삭제·재등록·상태 전이는 한 트랜잭션이다', async () => {
      const manager: any = {
        getRepository: jest.fn((entity: unknown) => (entity === FaiItem ? mockItemRepo : mockFaiRepo)),
      };
      (mockItemRepo as any).manager = { transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)) };
      (mockFaiRepo as any).manager = (mockItemRepo as any).manager;
      mockFaiRepo.findOne.mockResolvedValue(fai({ status: 'REQUESTED' }));
      mockItemRepo.create.mockImplementation((v: any) => v);
      mockItemRepo.save.mockImplementation(async (v: any) => v);
      mockFaiRepo.save.mockImplementation(async (v: any) => v);

      const saved = await target.addItems('FAI-001', [{ seq: 1, inspectItem: 'A', result: 'OK' }] as any, 'user');
      expect((mockItemRepo as any).manager.transaction).toHaveBeenCalledTimes(1);
      expect(mockItemRepo.delete).toHaveBeenCalled();
      expect(saved).toHaveLength(1);
      expect(mockFaiRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'INSPECTING' }));
    });

    it('수정에서 비울 수 없는 칸에 null 이 오면 그대로 둔다', async () => {
      mockFaiRepo.findOne.mockResolvedValue(fai({ status: 'REQUESTED', triggerType: 'ECN', itemCode: 'IT-1', sampleQty: 3 }));
      mockFaiRepo.save.mockImplementation(async (e) => e as any);
      const r = await target.update('FAI-001', { triggerType: null, itemCode: null, sampleQty: null, remark: '메모' } as any, 'user');
      expect(r).toMatchObject({ triggerType: 'ECN', itemCode: 'IT-1', sampleQty: 3, remark: '메모' });
    });

    it('기간은 시작일·종료일 중 하나만 와도 걸린다', async () => {
      const qb: any = {
        andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0), getMany: jest.fn().mockResolvedValue([]),
      };
      mockFaiRepo.createQueryBuilder.mockReturnValue(qb);
      await target.findAll({ fromDate: '2026-11-05T00:00:00.000Z' } as any, 'CO', 'P01');
      expect(qb.andWhere).toHaveBeenCalledWith('f.createdAt >= :fromDate', { fromDate: expect.any(Date) });
      expect(qb.andWhere).not.toHaveBeenCalledWith('f.createdAt <= :toDate', expect.anything());
      qb.andWhere.mockClear();
      await target.findAll({ toDate: '2026-11-05' } as any, 'CO', 'P01');
      expect(qb.andWhere).toHaveBeenCalledWith('f.createdAt <= :toDate', { toDate: expect.any(Date) });
    });
  });
});
