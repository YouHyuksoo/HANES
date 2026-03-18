/**
 * @file rework.service.spec.ts
 * @description ReworkService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ReworkService } from './rework.service';
import { ReworkOrder } from '../../../../entities/rework-order.entity';
import { ReworkInspect } from '../../../../entities/rework-inspect.entity';
import { ReworkProcess } from '../../../../entities/rework-process.entity';
import { DefectLog } from '../../../../entities/defect-log.entity';
import { MockLoggerService } from '../../../../common/test/mock-logger.service';

describe('ReworkService', () => {
  let target: ReworkService;
  let mockReworkRepo: DeepMocked<Repository<ReworkOrder>>;
  let mockInspectRepo: DeepMocked<Repository<ReworkInspect>>;
  let mockProcessRepo: DeepMocked<Repository<ReworkProcess>>;
  let mockDefectLogRepo: DeepMocked<Repository<DefectLog>>;

  beforeEach(async () => {
    mockReworkRepo = createMock<Repository<ReworkOrder>>();
    mockInspectRepo = createMock<Repository<ReworkInspect>>();
    mockProcessRepo = createMock<Repository<ReworkProcess>>();
    mockDefectLogRepo = createMock<Repository<DefectLog>>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReworkService,
        { provide: getRepositoryToken(ReworkOrder), useValue: mockReworkRepo },
        { provide: getRepositoryToken(ReworkInspect), useValue: mockInspectRepo },
        { provide: getRepositoryToken(ReworkProcess), useValue: mockProcessRepo },
        { provide: getRepositoryToken(DefectLog), useValue: mockDefectLogRepo },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<ReworkService>(ReworkService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findById', () => {
    it('should return rework order with processes', async () => {
      mockReworkRepo.findOne.mockResolvedValue({ reworkNo: 'RW-001', id: 1 } as any);
      mockProcessRepo.find.mockResolvedValue([]);
      const r = await target.findById('RW-001');
      expect(r.reworkNo).toBe('RW-001');
    });
    it('should throw NotFoundException', async () => {
      mockReworkRepo.findOne.mockResolvedValue(null);
      await expect(target.findById('X')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should throw when not REGISTERED or REJECTED', async () => {
      mockReworkRepo.findOne.mockResolvedValue({ reworkNo: 'RW-001', status: 'IN_PROGRESS', id: 1 } as any);
      mockProcessRepo.find.mockResolvedValue([]);
      await expect(target.update('RW-001', {} as any, 'user')).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('should throw when not REGISTERED', async () => {
      mockReworkRepo.findOne.mockResolvedValue({ reworkNo: 'RW-001', status: 'APPROVED', id: 1 } as any);
      mockProcessRepo.find.mockResolvedValue([]);
      await expect(target.delete('RW-001')).rejects.toThrow(BadRequestException);
    });
  });

  describe('qcApprove', () => {
    it('should approve QC pending', async () => {
      mockReworkRepo.findOne.mockResolvedValue({ reworkNo: 'RW-001', status: 'QC_PENDING', id: 1 } as any);
      mockProcessRepo.find.mockResolvedValue([]);
      mockReworkRepo.update.mockResolvedValue({ affected: 1 } as any);
      await target.qcApprove('RW-001', { action: 'APPROVE' } as any, 'user');
      expect(mockReworkRepo.update).toHaveBeenCalled();
    });
    it('should throw when not QC_PENDING', async () => {
      mockReworkRepo.findOne.mockResolvedValue({ reworkNo: 'RW-001', status: 'REGISTERED', id: 1 } as any);
      mockProcessRepo.find.mockResolvedValue([]);
      await expect(target.qcApprove('RW-001', { action: 'APPROVE' } as any, 'user')).rejects.toThrow(BadRequestException);
    });
  });
});
