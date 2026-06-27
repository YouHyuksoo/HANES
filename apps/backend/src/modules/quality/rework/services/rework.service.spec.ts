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
import { ItemMaster } from '../../../../entities/item-master.entity';
import { ProductInventoryService } from '../../../inventory/services/product-inventory.service';
import { MockLoggerService } from '@test/mock-logger.service';

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
        { provide: getRepositoryToken(ItemMaster), useValue: createMock<Repository<ItemMaster>>() },
        { provide: ProductInventoryService, useValue: createMock<ProductInventoryService>() },
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
      expect(mockReworkRepo.findOne).toHaveBeenCalledWith({
        where: { reworkNo: 'RW-001' },
      });
    });
    it('should throw NotFoundException', async () => {
      mockReworkRepo.findOne.mockResolvedValue(null);
      await expect(target.findById('X')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should not join a non-existent defectLog relation', async () => {
      const qb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
      };
      mockReworkRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await target.findAll({ limit: 5000 } as any, 'CO', 'P01');

      expect(result).toEqual({ data: [], total: 0, page: 1, limit: 5000 });
      expect(mockReworkRepo.createQueryBuilder).toHaveBeenCalledWith('r');
      expect(qb.leftJoinAndSelect).not.toHaveBeenCalled();
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

    it('should restore linked defect status before deleting registered rework', async () => {
      mockReworkRepo.findOne.mockResolvedValue({
        reworkNo: 'RW-001',
        status: 'REGISTERED',
        defectLogId: '2026-04-08T00:00:00.000Z|1',
        id: 1,
      } as any);
      mockProcessRepo.find.mockResolvedValue([]);
      mockDefectLogRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockReworkRepo.delete.mockResolvedValue({ affected: 1 } as any);

      await target.delete('RW-001');

      expect(mockDefectLogRepo.update).toHaveBeenCalledWith(
        { occurAt: new Date('2026-04-08T00:00:00.000Z'), seq: 1 },
        { status: 'WAIT' },
      );
    });

    it('should restore linked defect status within the rework tenant', async () => {
      mockReworkRepo.findOne.mockResolvedValue({
        reworkNo: 'RW-001',
        status: 'REGISTERED',
        defectLogId: '2026-04-08T00:00:00.000Z|1',
        id: 1,
        company: 'CO',
        plant: 'P01',
      } as any);
      mockProcessRepo.find.mockResolvedValue([]);
      mockInspectRepo.find.mockResolvedValue([]);
      mockDefectLogRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockReworkRepo.delete.mockResolvedValue({ affected: 1 } as any);

      await target.delete('RW-001', 'CO', 'P01');

      expect(mockDefectLogRepo.update).toHaveBeenCalledWith(
        { occurAt: new Date('2026-04-08T00:00:00.000Z'), seq: 1, company: 'CO', plant: 'P01' },
        { status: 'WAIT' },
      );
    });

    it('should block delete when rework process has already progressed', async () => {
      mockReworkRepo.findOne.mockResolvedValue({
        reworkNo: 'RW-002',
        status: 'REGISTERED',
        id: 2,
      } as any);
      mockProcessRepo.find.mockResolvedValue([
        { reworkOrderId: 'RW-002', status: 'IN_PROGRESS' } as any,
      ]);

      await expect(target.delete('RW-002')).rejects.toThrow(BadRequestException);
      expect(mockReworkRepo.delete).not.toHaveBeenCalled();
    });

    it('should block delete when inspection history already exists', async () => {
      mockReworkRepo.findOne.mockResolvedValue({
        reworkNo: 'RW-003',
        status: 'REGISTERED',
        id: 3,
      } as any);
      mockProcessRepo.find.mockResolvedValue([]);
      mockInspectRepo.find.mockResolvedValue([{ reworkOrderId: 'RW-003' } as any]);

      await expect(target.delete('RW-003')).rejects.toThrow(BadRequestException);
      expect(mockReworkRepo.delete).not.toHaveBeenCalled();
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
