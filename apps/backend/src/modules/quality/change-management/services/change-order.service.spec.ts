/**
 * @file change-order.service.spec.ts
 * @description ChangeOrderService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ChangeOrderService } from './change-order.service';
import { ChangeOrder } from '../../../../entities/change-order.entity';
import { MockLoggerService } from '../../../../common/test/mock-logger.service';

describe('ChangeOrderService', () => {
  let target: ChangeOrderService;
  let mockRepo: DeepMocked<Repository<ChangeOrder>>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<ChangeOrder>>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChangeOrderService,
        { provide: getRepositoryToken(ChangeOrder), useValue: mockRepo },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<ChangeOrderService>(ChangeOrderService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findById', () => {
    it('should return change order', async () => {
      mockRepo.findOne.mockResolvedValue({ changeNo: 'ECN-001' } as any);
      expect((await target.findById('ECN-001')).changeNo).toBe('ECN-001');
    });
    it('should throw NotFoundException', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(target.findById('X')).rejects.toThrow(NotFoundException);
    });
  });

  describe('submit', () => {
    it('should submit DRAFT order', async () => {
      const item = { changeNo: 'ECN-001', status: 'DRAFT' } as any;
      mockRepo.findOne.mockResolvedValue(item);
      mockRepo.save.mockResolvedValue({ ...item, status: 'SUBMITTED' });
      const r = await target.submit('ECN-001', 'user');
      expect(r.status).toBe('SUBMITTED');
    });
    it('should throw when not DRAFT', async () => {
      mockRepo.findOne.mockResolvedValue({ changeNo: 'ECN-001', status: 'APPROVED' } as any);
      await expect(target.submit('ECN-001', 'user')).rejects.toThrow(BadRequestException);
    });
  });

  describe('review', () => {
    it('should approve submitted order', async () => {
      const item = { changeNo: 'ECN-001', status: 'SUBMITTED' } as any;
      mockRepo.findOne.mockResolvedValue(item);
      mockRepo.save.mockResolvedValue({ ...item, status: 'APPROVED' });
      const r = await target.review('ECN-001', { action: 'APPROVE' } as any, 'user');
      expect(r.status).toBe('APPROVED');
    });
    it('should reject submitted order', async () => {
      const item = { changeNo: 'ECN-001', status: 'SUBMITTED' } as any;
      mockRepo.findOne.mockResolvedValue(item);
      mockRepo.save.mockResolvedValue({ ...item, status: 'REJECTED' });
      const r = await target.review('ECN-001', { action: 'REJECT' } as any, 'user');
      expect(r.status).toBe('REJECTED');
    });
  });

  describe('complete', () => {
    it('should complete IN_PROGRESS order', async () => {
      const item = { changeNo: 'ECN-001', status: 'IN_PROGRESS' } as any;
      mockRepo.findOne.mockResolvedValue(item);
      mockRepo.save.mockResolvedValue({ ...item, status: 'COMPLETED' });
      const r = await target.complete('ECN-001', 'user');
      expect(r.status).toBe('COMPLETED');
    });
    it('should throw when not IN_PROGRESS', async () => {
      mockRepo.findOne.mockResolvedValue({ changeNo: 'ECN-001', status: 'DRAFT' } as any);
      await expect(target.complete('ECN-001', 'user')).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('should throw when not DRAFT', async () => {
      mockRepo.findOne.mockResolvedValue({ changeNo: 'ECN-001', status: 'SUBMITTED' } as any);
      await expect(target.delete('ECN-001')).rejects.toThrow(BadRequestException);
    });
  });
});
