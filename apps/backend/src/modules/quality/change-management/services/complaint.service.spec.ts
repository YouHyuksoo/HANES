/**
 * @file complaint.service.spec.ts
 * @description ComplaintService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ComplaintService } from './complaint.service';
import { CustomerComplaint } from '../../../../entities/customer-complaint.entity';
import { MockLoggerService } from '../../../../common/test/mock-logger.service';

describe('ComplaintService', () => {
  let target: ComplaintService;
  let mockRepo: DeepMocked<Repository<CustomerComplaint>>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<CustomerComplaint>>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplaintService,
        { provide: getRepositoryToken(CustomerComplaint), useValue: mockRepo },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<ComplaintService>(ComplaintService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findById', () => {
    it('should return complaint', async () => {
      mockRepo.findOne.mockResolvedValue({ complaintNo: 'CC-001' } as any);
      expect((await target.findById('CC-001')).complaintNo).toBe('CC-001');
    });
    it('should throw NotFoundException', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(target.findById('X')).rejects.toThrow(NotFoundException);
    });
  });

  describe('investigate', () => {
    it('should start investigation from RECEIVED', async () => {
      const item = { complaintNo: 'CC-001', status: 'RECEIVED' } as any;
      mockRepo.findOne.mockResolvedValue(item);
      mockRepo.save.mockResolvedValue({ ...item, status: 'INVESTIGATING' });
      const r = await target.investigate('CC-001', {} as any, 'user');
      expect(r.status).toBe('INVESTIGATING');
    });
    it('should throw when not RECEIVED', async () => {
      mockRepo.findOne.mockResolvedValue({ complaintNo: 'CC-001', status: 'CLOSED' } as any);
      await expect(target.investigate('CC-001', {} as any, 'user')).rejects.toThrow(BadRequestException);
    });
  });

  describe('resolve', () => {
    it('should resolve from RESPONDING', async () => {
      const item = { complaintNo: 'CC-001', status: 'RESPONDING' } as any;
      mockRepo.findOne.mockResolvedValue(item);
      mockRepo.save.mockResolvedValue({ ...item, status: 'RESOLVED' });
      const r = await target.resolve('CC-001', 'user');
      expect(r.status).toBe('RESOLVED');
    });
  });

  describe('close', () => {
    it('should close from RESOLVED', async () => {
      const item = { complaintNo: 'CC-001', status: 'RESOLVED' } as any;
      mockRepo.findOne.mockResolvedValue(item);
      mockRepo.save.mockResolvedValue({ ...item, status: 'CLOSED' });
      const r = await target.close('CC-001', 'user');
      expect(r.status).toBe('CLOSED');
    });
  });

  describe('delete', () => {
    it('should throw when not RECEIVED', async () => {
      mockRepo.findOne.mockResolvedValue({ complaintNo: 'CC-001', status: 'INVESTIGATING' } as any);
      await expect(target.delete('CC-001')).rejects.toThrow(BadRequestException);
    });
  });
});
