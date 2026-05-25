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
import { MockLoggerService } from '@test/mock-logger.service';

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

    it('scopes complaint lookup by tenant', async () => {
      mockRepo.findOne.mockResolvedValue({ complaintNo: 'CC-001', company: 'CO', plant: 'P01' } as any);

      await target.findById('CC-001', 'CO', 'P01');

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { complaintNo: 'CC-001', company: 'CO', plant: 'P01' },
      });
    });
  });

  describe('update', () => {
    it('should keep tenant and complaint key columns from the matched complaint when update payload contains them', async () => {
      const item = { complaintNo: 'CC-001', customerCode: 'CUST-OLD', status: 'RECEIVED', company: 'CO', plant: 'P01' } as CustomerComplaint;
      mockRepo.findOne.mockResolvedValue(item);
      mockRepo.save.mockImplementation(async (value) => value as CustomerComplaint);

      const result = await target.update('CC-001', {
        complaintNo: 'CC-999',
        customerCode: 'CUST-NEW',
        company: 'OTHER',
        plant: 'P99',
      } as any, 'user');

      expect(result).toEqual(expect.objectContaining({
        complaintNo: 'CC-001',
        customerCode: 'CUST-NEW',
        company: 'CO',
        plant: 'P01',
        updatedBy: 'user',
      }));
    });

    it('rejects update when complaint belongs to a different tenant', async () => {
      mockRepo.findOne.mockResolvedValue({ complaintNo: 'CC-001', status: 'RECEIVED', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.update('CC-001', {} as any, 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockRepo.save).not.toHaveBeenCalled();
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

    it('rejects investigate when complaint belongs to a different tenant', async () => {
      mockRepo.findOne.mockResolvedValue({ complaintNo: 'CC-001', status: 'RECEIVED', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.investigate('CC-001', {} as any, 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('respond', () => {
    it('rejects respond when complaint belongs to a different tenant', async () => {
      mockRepo.findOne.mockResolvedValue({ complaintNo: 'CC-001', status: 'INVESTIGATING', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.respond('CC-001', {} as any, 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockRepo.save).not.toHaveBeenCalled();
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

    it('rejects resolve when complaint belongs to a different tenant', async () => {
      mockRepo.findOne.mockResolvedValue({ complaintNo: 'CC-001', status: 'RESPONDING', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.resolve('CC-001', 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockRepo.save).not.toHaveBeenCalled();
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

    it('rejects close when complaint belongs to a different tenant', async () => {
      mockRepo.findOne.mockResolvedValue({ complaintNo: 'CC-001', status: 'RESOLVED', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.close('CC-001', 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should throw when not RECEIVED', async () => {
      mockRepo.findOne.mockResolvedValue({ complaintNo: 'CC-001', status: 'INVESTIGATING' } as any);
      await expect(target.delete('CC-001')).rejects.toThrow(BadRequestException);
    });

    it('rejects delete when complaint belongs to a different tenant', async () => {
      mockRepo.findOne.mockResolvedValue({ complaintNo: 'CC-001', status: 'RECEIVED', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.delete('CC-001', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('linkCapa', () => {
    it('rejects linkCapa when complaint belongs to a different tenant', async () => {
      mockRepo.findOne.mockResolvedValue({ complaintNo: 'CC-001', status: 'RESPONDING', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.linkCapa('CC-001', { capaId: 'CAPA-001' } as any, 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });
});
