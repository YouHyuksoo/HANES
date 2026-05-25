/**
 * @file ppap.service.spec.ts
 * @description PpapService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PpapService } from './ppap.service';
import { PpapSubmission } from '../../../../entities/ppap-submission.entity';
import { MockLoggerService } from '@test/mock-logger.service';

describe('PpapService', () => {
  let target: PpapService;
  let mockRepo: DeepMocked<Repository<PpapSubmission>>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<PpapSubmission>>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PpapService,
        { provide: getRepositoryToken(PpapSubmission), useValue: mockRepo },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<PpapService>(PpapService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findById', () => {
    it('should return ppap', async () => {
      mockRepo.findOne.mockResolvedValue({ ppapNo: 'PPAP-001' } as any);
      expect((await target.findById('PPAP-001')).ppapNo).toBe('PPAP-001');
    });
    it('should throw NotFoundException', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(target.findById('X')).rejects.toThrow(NotFoundException);
    });

    it('scopes PPAP lookup by tenant', async () => {
      mockRepo.findOne.mockResolvedValue({ ppapNo: 'PPAP-001', company: 'CO', plant: 'P01' } as any);

      await target.findById('PPAP-001', 'CO', 'P01');

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { ppapNo: 'PPAP-001', company: 'CO', plant: 'P01' },
      });
    });
  });

  describe('submit', () => {
    it('should submit DRAFT', async () => {
      const item = { ppapNo: 'PPAP-001', status: 'DRAFT' } as any;
      mockRepo.findOne.mockResolvedValue(item);
      mockRepo.save.mockResolvedValue({ ...item, status: 'SUBMITTED' });
      const r = await target.submit('PPAP-001', 'user');
      expect(r.status).toBe('SUBMITTED');
    });
    it('should throw when not DRAFT', async () => {
      mockRepo.findOne.mockResolvedValue({ ppapNo: 'PPAP-001', status: 'APPROVED' } as any);
      await expect(target.submit('PPAP-001', 'user')).rejects.toThrow(BadRequestException);
    });

    it('rejects submit when PPAP belongs to a different tenant', async () => {
      mockRepo.findOne.mockResolvedValue({ ppapNo: 'PPAP-001', status: 'DRAFT', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.submit('PPAP-001', 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should keep tenant and ppap key columns from the matched submission when update payload contains them', async () => {
      const item = { ppapNo: 'PPAP-001', itemCode: 'ITEM-OLD', status: 'DRAFT', company: 'CO', plant: 'P01' } as PpapSubmission;
      mockRepo.findOne.mockResolvedValue(item);
      mockRepo.save.mockImplementation(async (value) => value as PpapSubmission);

      const result = await target.update('PPAP-001', {
        ppapNo: 'PPAP-999',
        itemCode: 'ITEM-NEW',
        company: 'OTHER',
        plant: 'P99',
      } as any, 'user');

      expect(result).toEqual(expect.objectContaining({
        ppapNo: 'PPAP-001',
        itemCode: 'ITEM-NEW',
        company: 'CO',
        plant: 'P01',
        updatedBy: 'user',
      }));
    });

    it('rejects update when PPAP belongs to a different tenant', async () => {
      mockRepo.findOne.mockResolvedValue({ ppapNo: 'PPAP-001', status: 'DRAFT', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.update('PPAP-001', {} as any, 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    it('should approve SUBMITTED', async () => {
      const item = { ppapNo: 'PPAP-001', status: 'SUBMITTED' } as any;
      mockRepo.findOne.mockResolvedValue(item);
      mockRepo.save.mockResolvedValue({ ...item, status: 'APPROVED' });
      const r = await target.approve('PPAP-001', 'user');
      expect(r.status).toBe('APPROVED');
    });

    it('rejects approve when PPAP belongs to a different tenant', async () => {
      mockRepo.findOne.mockResolvedValue({ ppapNo: 'PPAP-001', status: 'SUBMITTED', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.approve('PPAP-001', 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('should reject SUBMITTED', async () => {
      const item = { ppapNo: 'PPAP-001', status: 'SUBMITTED' } as any;
      mockRepo.findOne.mockResolvedValue(item);
      mockRepo.save.mockResolvedValue({ ...item, status: 'REJECTED' });
      const r = await target.reject('PPAP-001', 'reason', 'user');
      expect(r.status).toBe('REJECTED');
    });

    it('rejects reject when PPAP belongs to a different tenant', async () => {
      mockRepo.findOne.mockResolvedValue({ ppapNo: 'PPAP-001', status: 'SUBMITTED', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.reject('PPAP-001', 'reason', 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('getRequiredElements', () => {
    it('should return level 3 required elements', () => {
      const r = target.getRequiredElements(3);
      expect(r.level).toBe(3);
      expect(r.totalRequired).toBeGreaterThan(0);
    });
    it('should throw for invalid level', () => {
      expect(() => target.getRequiredElements(0)).toThrow(BadRequestException);
      expect(() => target.getRequiredElements(6)).toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('should throw when not DRAFT', async () => {
      mockRepo.findOne.mockResolvedValue({ ppapNo: 'PPAP-001', status: 'SUBMITTED' } as any);
      await expect(target.delete('PPAP-001')).rejects.toThrow(BadRequestException);
    });

    it('rejects delete when PPAP belongs to a different tenant', async () => {
      mockRepo.findOne.mockResolvedValue({ ppapNo: 'PPAP-001', status: 'DRAFT', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.delete('PPAP-001', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('cancel transitions', () => {
    it('rejects cancelApproval when PPAP belongs to a different tenant', async () => {
      mockRepo.findOne.mockResolvedValue({ ppapNo: 'PPAP-001', status: 'APPROVED', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.cancelApproval('PPAP-001', 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('rejects cancelSubmit when PPAP belongs to a different tenant', async () => {
      mockRepo.findOne.mockResolvedValue({ ppapNo: 'PPAP-001', status: 'SUBMITTED', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.cancelSubmit('PPAP-001', 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });
});
