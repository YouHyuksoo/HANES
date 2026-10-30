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
import { NumberingService } from '../../../../shared/numbering.service';

describe('ComplaintService', () => {
  let target: ComplaintService;
  let mockRepo: DeepMocked<Repository<CustomerComplaint>>;
  let mockNumbering: DeepMocked<NumberingService>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<CustomerComplaint>>();
    mockNumbering = createMock<NumberingService>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplaintService,
        { provide: getRepositoryToken(CustomerComplaint), useValue: mockRepo },
        { provide: NumberingService, useValue: mockNumbering },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<ComplaintService>(ComplaintService);
  });
  afterEach(() => jest.clearAllMocks());

  /** 마스터·공통코드·CAPA 조회 모의: 쿼리마다 같은 건수를 돌려준다 */
  const stubQuery = (cnt: number) => {
    const query = jest.fn().mockResolvedValue([{ cnt }]);
    (mockRepo as any).manager = { query };
    return query;
  };

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

  describe('결함 수정', () => {
    const received = (over: Record<string, unknown> = {}) => ({ complaintNo: 'CC-001', status: 'RECEIVED', company: 'CO', plant: 'P01', customerCode: 'C1', complaintType: 'QUALITY', urgency: 'MEDIUM', defectQty: 3, ...over }) as any;

    it('등록은 거래처·품목 마스터와 유형·긴급도 공통코드를 확인한다', async () => {
      const query = stubQuery(0);
      mockNumbering.next.mockResolvedValue('CC-1');
      await expect(target.create({ customerCode: 'NOCUST', complaintDate: '2026-12-01', complaintType: 'QUALITY' } as any, 'CO', 'P01', 'user')).rejects.toThrow('고객(거래처)을 찾을 수 없습니다: NOCUST');
      expect(query.mock.calls[0][0]).toContain('PARTNER_MASTERS');

      query.mockResolvedValueOnce([{ cnt: 1 }]).mockResolvedValueOnce([{ cnt: 0 }]);
      await expect(target.create({ customerCode: 'C1', itemCode: 'NOITEM', complaintDate: '2026-12-01', complaintType: 'QUALITY' } as any, 'CO', 'P01', 'user')).rejects.toThrow('품목을 찾을 수 없습니다: NOITEM');

      query.mockResolvedValueOnce([{ cnt: 1 }]).mockResolvedValueOnce([{ cnt: 0 }]);
      await expect(target.create({ customerCode: 'C1', complaintDate: '2026-12-01', complaintType: 'XYZ' } as any, 'CO', 'P01', 'user')).rejects.toThrow('공통코드(COMPLAINT_TYPE)');
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('수정은 값이 오면 마스터를 확인하고, 비울 수 없는 칸의 null 은 그대로 둔다', async () => {
      const query = stubQuery(1);
      mockRepo.findOne.mockResolvedValue(received());
      mockRepo.save.mockImplementation(async (v: any) => v);
      const r = await target.update('CC-001', { customerCode: null, complaintDate: null, defectQty: null, complaintType: null, urgency: null, description: '메모' } as any, 'user');
      expect(r).toMatchObject({ customerCode: 'C1', complaintType: 'QUALITY', urgency: 'MEDIUM', defectQty: 3, description: '메모' });
      expect(query).not.toHaveBeenCalled();

      query.mockResolvedValue([{ cnt: 0 }]);
      await expect(target.update('CC-001', { customerCode: 'NOCUST' } as any, 'user')).rejects.toThrow(NotFoundException);
    });

    it('CAPA 연계는 번호가 있고 같은 회사·사업장에 실제로 있어야 한다', async () => {
      const query = stubQuery(0);
      mockRepo.findOne.mockResolvedValue(received({ status: 'CLOSED' }));
      mockRepo.save.mockImplementation(async (v: any) => v);
      await expect(target.linkCapa('CC-001', {} as any, 'user')).rejects.toThrow('CAPA 번호가 없습니다');
      await expect(target.linkCapa('CC-001', { capaId: 'CAPA-X' } as any, 'user')).rejects.toThrow(NotFoundException);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('CAPA_REQUESTS'), ['CAPA-X', 'CO', 'P01']);

      query.mockResolvedValue([{ cnt: 1 }]);
      const r = await target.linkCapa('CC-001', { capaId: 'CAPA-1' } as any, 'user');
      expect(r.capaId).toBe('CAPA-1');
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
