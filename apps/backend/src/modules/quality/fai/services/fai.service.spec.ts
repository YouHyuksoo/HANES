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

describe('FaiService', () => {
  let target: FaiService;
  let mockFaiRepo: DeepMocked<Repository<FaiRequest>>;
  let mockItemRepo: DeepMocked<Repository<FaiItem>>;

  beforeEach(async () => {
    mockFaiRepo = createMock<Repository<FaiRequest>>();
    mockItemRepo = createMock<Repository<FaiItem>>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FaiService,
        { provide: getRepositoryToken(FaiRequest), useValue: mockFaiRepo },
        { provide: getRepositoryToken(FaiItem), useValue: mockItemRepo },
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
});
