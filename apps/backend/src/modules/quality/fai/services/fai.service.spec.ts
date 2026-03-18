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
import { MockLoggerService } from '../../../../common/test/mock-logger.service';

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
      const r = await target.findById(1);
      expect(r.faiNo).toBe('FAI-001');
    });
    it('should throw NotFoundException', async () => {
      mockFaiRepo.findOne.mockResolvedValue(null);
      await expect(target.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('start', () => {
    it('should start from REQUESTED', async () => {
      const item = { id: 1, status: 'REQUESTED' } as any;
      mockFaiRepo.findOne.mockResolvedValue(item);
      mockFaiRepo.save.mockResolvedValue({ ...item, status: 'SAMPLING' });
      const r = await target.start(1, 'user');
      expect(r.status).toBe('SAMPLING');
    });
    it('should throw when not REQUESTED', async () => {
      mockFaiRepo.findOne.mockResolvedValue({ id: 1, status: 'PASS' } as any);
      await expect(target.start(1, 'user')).rejects.toThrow(BadRequestException);
    });
  });

  describe('complete', () => {
    it('should auto-determine PASS when all items OK', async () => {
      mockFaiRepo.findOne.mockResolvedValue({ id: 1, status: 'INSPECTING' } as any);
      mockItemRepo.find.mockResolvedValue([{ result: 'OK' } as any]);
      mockFaiRepo.save.mockImplementation(async (e) => e as any);
      const r = await target.complete(1, { result: 'PASS' } as any, 'user');
      expect(r.status).toBe('PASS');
    });
    it('should auto-determine FAIL when NG items exist', async () => {
      mockFaiRepo.findOne.mockResolvedValue({ id: 1, status: 'INSPECTING' } as any);
      mockItemRepo.find.mockResolvedValue([{ result: 'OK' } as any, { result: 'NG' } as any]);
      mockFaiRepo.save.mockImplementation(async (e) => e as any);
      const r = await target.complete(1, { result: 'PASS' } as any, 'user');
      expect(r.status).toBe('FAIL');
    });
  });

  describe('delete', () => {
    it('should throw when not REQUESTED', async () => {
      mockFaiRepo.findOne.mockResolvedValue({ id: 1, status: 'PASS' } as any);
      await expect(target.delete(1)).rejects.toThrow(BadRequestException);
    });
  });
});
