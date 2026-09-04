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
import { NumberingService } from '../../../../shared/numbering.service';

describe('ReworkService', () => {
  let target: ReworkService;
  let mockReworkRepo: DeepMocked<Repository<ReworkOrder>>;
  let mockInspectRepo: DeepMocked<Repository<ReworkInspect>>;
  let mockProcessRepo: DeepMocked<Repository<ReworkProcess>>;
  let mockDefectLogRepo: DeepMocked<Repository<DefectLog>>;
  let mockNumbering: DeepMocked<NumberingService>;

  beforeEach(async () => {
    mockReworkRepo = createMock<Repository<ReworkOrder>>();
    mockInspectRepo = createMock<Repository<ReworkInspect>>();
    mockProcessRepo = createMock<Repository<ReworkProcess>>();
    mockDefectLogRepo = createMock<Repository<DefectLog>>();
    mockNumbering = createMock<NumberingService>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReworkService,
        { provide: getRepositoryToken(ReworkOrder), useValue: mockReworkRepo },
        { provide: getRepositoryToken(ReworkInspect), useValue: mockInspectRepo },
        { provide: getRepositoryToken(ReworkProcess), useValue: mockProcessRepo },
        { provide: getRepositoryToken(DefectLog), useValue: mockDefectLogRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: createMock<Repository<ItemMaster>>() },
        { provide: ProductInventoryService, useValue: createMock<ProductInventoryService>() },
        { provide: NumberingService, useValue: mockNumbering },
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

  describe('create — 불량이력 상태 연동', () => {
    it('defectLogId가 있으면 불량이력을 공통코드 DEFECT_LOG_STATUS.REWORK 로 바꾸고, 재작업 공정은 REWORK_PROCESS_STATUS.WAITING 으로 만든다', async () => {
      mockNumbering.next.mockResolvedValue('RW-100');
      mockReworkRepo.create.mockImplementation((v: any) => v);
      mockReworkRepo.save.mockResolvedValue({} as any);
      mockReworkRepo.findOne.mockResolvedValue({ reworkNo: 'RW-100', status: 'REGISTERED' } as any);
      mockProcessRepo.create.mockImplementation((v: any) => v);
      mockProcessRepo.save.mockResolvedValue([] as any);
      mockDefectLogRepo.update.mockResolvedValue({ affected: 1 } as any);

      await target.create(
        {
          defectLogId: '2026-04-08T00:00:00.000Z|1',
          itemCode: 'IT-1',
          reworkQty: 5,
          reworkMethod: 'RESOLDER',
          processItems: [{ processCode: 'P10', processName: '재납땜', seq: 1 }],
        } as any,
        'CO',
        'P01',
        'user',
      );

      expect(mockDefectLogRepo.update).toHaveBeenCalledWith(
        { occurAt: new Date('2026-04-08T00:00:00.000Z'), seq: 1, company: 'CO', plant: 'P01' },
        { status: 'REWORK' },
      );
      const processes = mockProcessRepo.save.mock.calls[0][0] as any[];
      expect(processes).toHaveLength(1);
      expect(processes[0].status).toBe('WAITING');
      expect(mockReworkRepo.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'REGISTERED' }));
    });
  });

  describe('createInspect — 불량이력 상태 연동', () => {
    const order = {
      reworkNo: 'RW-200',
      status: 'INSPECT_PENDING',
      itemCode: 'IT-1',
      defectLogId: '2026-04-08T00:00:00.000Z|2',
      company: 'CO',
      plant: 'P01',
    };

    beforeEach(() => {
      mockReworkRepo.findOne.mockResolvedValue(order as any);
      mockProcessRepo.find.mockResolvedValue([]);
      mockInspectRepo.query.mockResolvedValue([{ NEXT_SEQ: 1 }]);
      mockInspectRepo.create.mockImplementation((v: any) => v);
      mockInspectRepo.save.mockImplementation(async (v: any) => v);
      mockReworkRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockDefectLogRepo.update.mockResolvedValue({ affected: 1 } as any);
    });

    it.each([
      ['PASS', 'DONE'],
      ['SCRAP', 'SCRAP'],
      ['FAIL', 'REWORK'],
    ])('검사결과 %s → 불량이력 상태 %s (DEFECT_LOG_STATUS 정본만 기록)', async (inspectResult, expectedDefectStatus) => {
      await target.createInspect(
        { reworkNo: 'RW-200', inspectResult, passQty: 0, failQty: 0, inspectorCode: 'QC1', inspectMethod: 'VISUAL' } as any,
        'CO',
        'P01',
        'user',
      );

      expect(mockReworkRepo.update).toHaveBeenCalledWith(
        { reworkNo: 'RW-200', company: 'CO', plant: 'P01' },
        expect.objectContaining({ status: inspectResult }),
      );
      expect(mockDefectLogRepo.update).toHaveBeenCalledWith(
        { occurAt: new Date('2026-04-08T00:00:00.000Z'), seq: 2, company: 'CO', plant: 'P01' },
        { status: expectedDefectStatus },
      );
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
