/**
 * @file src/modules/production/services/job-order.service.spec.ts
 * @description JobOrderService 단위 테스트 - 작업지시 CRUD + 상태 변경 로직 검증
 *
 * 초보자 가이드:
 * - `target`: 테스트 대상(SUT), `mock*`: 모킹된 의존성
 * - AAA 패턴(Arrange/Act/Assert) 사용
 * - 실행: `npx jest --testPathPattern="job-order.service.spec"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { JobOrderService } from './job-order.service';
import { JobOrder } from '../../../entities/job-order.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { ProdResult } from '../../../entities/prod-result.entity';
import { BomMaster } from '../../../entities/bom-master.entity';
import { RoutingGroup } from '../../../entities/routing-group.entity';
import { RoutingProcess } from '../../../entities/routing-process.entity';
import { SeqGeneratorService } from '../../../shared/seq-generator.service';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('JobOrderService', () => {
  let target: JobOrderService;
  let mockJobOrderRepo: DeepMocked<Repository<JobOrder>>;
  let mockPartMasterRepo: DeepMocked<Repository<PartMaster>>;
  let mockProdResultRepo: DeepMocked<Repository<ProdResult>>;
  let mockBomMasterRepo: DeepMocked<Repository<BomMaster>>;
  let mockRoutingGroupRepo: DeepMocked<Repository<RoutingGroup>>;
  let mockRoutingProcessRepo: DeepMocked<Repository<RoutingProcess>>;
  let mockSeqGenerator: DeepMocked<SeqGeneratorService>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockJobOrderRepo = createMock<Repository<JobOrder>>();
    mockPartMasterRepo = createMock<Repository<PartMaster>>();
    mockProdResultRepo = createMock<Repository<ProdResult>>();
    mockBomMasterRepo = createMock<Repository<BomMaster>>();
    mockRoutingGroupRepo = createMock<Repository<RoutingGroup>>();
    mockRoutingProcessRepo = createMock<Repository<RoutingProcess>>();
    mockSeqGenerator = createMock<SeqGeneratorService>();
    mockDataSource = createMock<DataSource>();
    mockQueryRunner = createMock<QueryRunner>();

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobOrderService,
        { provide: getRepositoryToken(JobOrder), useValue: mockJobOrderRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartMasterRepo },
        { provide: getRepositoryToken(ProdResult), useValue: mockProdResultRepo },
        { provide: getRepositoryToken(BomMaster), useValue: mockBomMasterRepo },
        { provide: getRepositoryToken(RoutingGroup), useValue: mockRoutingGroupRepo },
        { provide: getRepositoryToken(RoutingProcess), useValue: mockRoutingProcessRepo },
        { provide: SeqGeneratorService, useValue: mockSeqGenerator },
        { provide: DataSource, useValue: mockDataSource },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<JobOrderService>(JobOrderService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────
  // findById
  // ─────────────────────────────────────────────
  describe('findById', () => {
    it('should return job order when found', async () => {
      // Arrange
      const jobOrder = { orderNo: 'JO-001', status: 'WAITING' } as JobOrder;
      mockJobOrderRepo.findOne.mockResolvedValue(jobOrder);

      // Act
      const result = await target.findById('JO-001');

      // Assert
      expect(result).toEqual(jobOrder);
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockJobOrderRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findById('INVALID')).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────
  describe('findAll', () => {
    it('should return paginated results', async () => {
      // Arrange
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        getMany: jest.fn().mockResolvedValue([{ orderNo: 'JO-001' }]),
      };
      mockJobOrderRepo.createQueryBuilder.mockReturnValue(mockQb as any);

      // Act
      const result = await target.findAll({ page: 1, limit: 10 } as any);

      // Assert
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.page).toBe(1);
    });
  });

  // ─────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────
  describe('create', () => {
    const createDto = {
      itemCode: 'PART-001',
      lineCode: 'LINE-A',
      planQty: 100,
      planDate: '2026-03-18',
    } as any;

    it('should create job order with auto-generated orderNo', async () => {
      // Arrange
      mockSeqGenerator.nextJobOrderNo.mockResolvedValue('JO-20260318-0001');
      mockJobOrderRepo.findOne
        .mockResolvedValueOnce(null) // existing check
        .mockResolvedValueOnce({ orderNo: 'JO-20260318-0001' } as JobOrder); // final findOne
      mockPartMasterRepo.findOne.mockResolvedValue({ itemCode: 'PART-001' } as PartMaster);
      mockRoutingGroupRepo.findOne.mockResolvedValue(null);
      mockQueryRunner.manager.create.mockReturnValue({ orderNo: 'JO-20260318-0001' } as any);
      mockQueryRunner.manager.save.mockResolvedValue({ orderNo: 'JO-20260318-0001' } as any);

      // Act
      const result = await target.create(createDto, 'COMPANY', 'PLANT');

      // Assert
      expect(mockSeqGenerator.nextJobOrderNo).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should throw ConflictException when orderNo already exists', async () => {
      // Arrange
      const dto = { ...createDto, orderNo: 'JO-EXISTS' };
      mockJobOrderRepo.findOne.mockResolvedValue({ orderNo: 'JO-EXISTS' } as JobOrder);
      mockPartMasterRepo.findOne.mockResolvedValue({ itemCode: 'PART-001' } as PartMaster);

      // Act & Assert
      await expect(target.create(dto, 'C', 'P')).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when part not found', async () => {
      // Arrange
      mockSeqGenerator.nextJobOrderNo.mockResolvedValue('JO-001');
      mockJobOrderRepo.findOne.mockResolvedValue(null);
      mockPartMasterRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.create(createDto, 'C', 'P')).rejects.toThrow(NotFoundException);
    });

    it('should rollback on error', async () => {
      // Arrange
      mockSeqGenerator.nextJobOrderNo.mockResolvedValue('JO-001');
      mockJobOrderRepo.findOne.mockResolvedValue(null);
      mockPartMasterRepo.findOne.mockResolvedValue({ itemCode: 'PART-001' } as PartMaster);
      mockRoutingGroupRepo.findOne.mockResolvedValue(null);
      mockQueryRunner.manager.create.mockReturnValue({} as any);
      mockQueryRunner.manager.save.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(target.create(createDto)).rejects.toThrow('DB error');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────
  describe('update', () => {
    it('should update job order fields', async () => {
      // Arrange
      const existing = { orderNo: 'JO-001', status: 'WAITING', itemCode: 'PART-001' } as JobOrder;
      mockJobOrderRepo.findOne
        .mockResolvedValueOnce(existing) // findById
        .mockResolvedValueOnce({ ...existing, planQty: 200 } as JobOrder); // findOneWithSelect
      mockJobOrderRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.update('JO-001', { planQty: 200 } as any);

      // Assert
      expect(mockJobOrderRepo.update).toHaveBeenCalledWith(
        { orderNo: 'JO-001' },
        expect.objectContaining({ planQty: 200 }),
      );
    });

    it('should throw BadRequestException when status is DONE', async () => {
      // Arrange
      mockJobOrderRepo.findOne.mockResolvedValue({ orderNo: 'JO-001', status: 'DONE' } as JobOrder);

      // Act & Assert
      await expect(target.update('JO-001', { planQty: 200 } as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when status is CANCELED', async () => {
      // Arrange
      mockJobOrderRepo.findOne.mockResolvedValue({ orderNo: 'JO-001', status: 'CANCELED' } as JobOrder);

      // Act & Assert
      await expect(target.update('JO-001', {} as any)).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  // delete
  // ─────────────────────────────────────────────
  describe('delete', () => {
    it('should delete job order when status is WAITING', async () => {
      // Arrange
      mockJobOrderRepo.findOne.mockResolvedValue({ orderNo: 'JO-001', status: 'WAITING' } as JobOrder);
      mockJobOrderRepo.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.delete('JO-001');

      // Assert
      expect(result).toEqual({ id: 'JO-001' });
    });

    it('should throw BadRequestException when status is RUNNING', async () => {
      // Arrange
      mockJobOrderRepo.findOne.mockResolvedValue({ orderNo: 'JO-001', status: 'RUNNING' } as JobOrder);

      // Act & Assert
      await expect(target.delete('JO-001')).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  // start
  // ─────────────────────────────────────────────
  describe('start', () => {
    it('should change status from WAITING to RUNNING', async () => {
      // Arrange
      const jo = { orderNo: 'JO-001', status: 'WAITING', startAt: null } as any;
      mockJobOrderRepo.findOne
        .mockResolvedValueOnce(jo)
        .mockResolvedValueOnce({ ...jo, status: 'RUNNING' });
      mockJobOrderRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.start('JO-001');

      // Assert
      expect(mockJobOrderRepo.update).toHaveBeenCalledWith(
        { orderNo: 'JO-001' },
        expect.objectContaining({ status: 'RUNNING' }),
      );
    });

    it('should throw BadRequestException when not WAITING', async () => {
      // Arrange
      mockJobOrderRepo.findOne.mockResolvedValue({ orderNo: 'JO-001', status: 'RUNNING' } as JobOrder);

      // Act & Assert
      await expect(target.start('JO-001')).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  // hold
  // ─────────────────────────────────────────────
  describe('hold', () => {
    it('should change status from RUNNING to HOLD', async () => {
      // Arrange
      const jo = { orderNo: 'JO-001', status: 'RUNNING', remark: null } as any;
      mockJobOrderRepo.findOne
        .mockResolvedValueOnce(jo)
        .mockResolvedValueOnce({ ...jo, status: 'HOLD' });
      mockJobOrderRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      await target.hold('JO-001');

      // Assert
      expect(mockJobOrderRepo.update).toHaveBeenCalledWith(
        { orderNo: 'JO-001' },
        expect.objectContaining({ status: 'HOLD' }),
      );
    });

    it('should throw BadRequestException when status is DONE', async () => {
      // Arrange
      mockJobOrderRepo.findOne.mockResolvedValue({ orderNo: 'JO-001', status: 'DONE' } as JobOrder);

      // Act & Assert
      await expect(target.hold('JO-001')).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  // holdRelease
  // ─────────────────────────────────────────────
  describe('holdRelease', () => {
    it('should restore previous status from HOLD', async () => {
      // Arrange
      const jo = { orderNo: 'JO-001', status: 'HOLD', remark: '[HOLD] 이전상태:RUNNING | 기존비고' } as any;
      mockJobOrderRepo.findOne
        .mockResolvedValueOnce(jo)
        .mockResolvedValueOnce({ ...jo, status: 'RUNNING' });
      mockJobOrderRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      await target.holdRelease('JO-001');

      // Assert
      expect(mockJobOrderRepo.update).toHaveBeenCalledWith(
        { orderNo: 'JO-001' },
        expect.objectContaining({ status: 'RUNNING', remark: '기존비고' }),
      );
    });

    it('should throw BadRequestException when not HOLD', async () => {
      // Arrange
      mockJobOrderRepo.findOne.mockResolvedValue({ orderNo: 'JO-001', status: 'RUNNING' } as JobOrder);

      // Act & Assert
      await expect(target.holdRelease('JO-001')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when remark has no hold info', async () => {
      // Arrange
      mockJobOrderRepo.findOne.mockResolvedValue({
        orderNo: 'JO-001', status: 'HOLD', remark: 'no hold info',
      } as any);

      // Act & Assert
      await expect(target.holdRelease('JO-001')).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  // complete
  // ─────────────────────────────────────────────
  describe('complete', () => {
    it('should complete job order with aggregated results', async () => {
      // Arrange
      const jo = { orderNo: 'JO-001', status: 'RUNNING' } as JobOrder;
      mockJobOrderRepo.findOne
        .mockResolvedValueOnce(jo)
        .mockResolvedValueOnce({ ...jo, status: 'DONE' } as JobOrder);

      const mockCreateQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalGoodQty: '80', totalDefectQty: '5' }),
      };
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue(mockCreateQb as any);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      await target.complete('JO-001');

      // Assert
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        JobOrder,
        { orderNo: 'JO-001' },
        expect.objectContaining({ status: 'DONE', goodQty: 80, defectQty: 5 }),
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException when not RUNNING', async () => {
      // Arrange
      mockJobOrderRepo.findOne.mockResolvedValue({ orderNo: 'JO-001', status: 'WAITING' } as JobOrder);

      // Act & Assert
      await expect(target.complete('JO-001')).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  // cancel
  // ─────────────────────────────────────────────
  describe('cancel', () => {
    it('should cancel WAITING job order with no results', async () => {
      // Arrange
      const jo = { orderNo: 'JO-001', status: 'WAITING' } as JobOrder;
      mockJobOrderRepo.findOne
        .mockResolvedValueOnce(jo)
        .mockResolvedValueOnce({ ...jo, status: 'CANCELED' } as JobOrder);
      mockProdResultRepo.count.mockResolvedValue(0);
      mockJobOrderRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.cancel('JO-001');

      // Assert
      expect(mockJobOrderRepo.update).toHaveBeenCalledWith(
        { orderNo: 'JO-001' },
        expect.objectContaining({ status: 'CANCELED' }),
      );
    });

    it('should throw BadRequestException when status is RUNNING', async () => {
      // Arrange
      mockJobOrderRepo.findOne.mockResolvedValue({ orderNo: 'JO-001', status: 'RUNNING' } as JobOrder);

      // Act & Assert
      await expect(target.cancel('JO-001')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when results exist', async () => {
      // Arrange
      mockJobOrderRepo.findOne.mockResolvedValue({ orderNo: 'JO-001', status: 'WAITING' } as JobOrder);
      mockProdResultRepo.count.mockResolvedValue(3);

      // Act & Assert
      await expect(target.cancel('JO-001')).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  // changeStatus
  // ─────────────────────────────────────────────
  describe('changeStatus', () => {
    it('should directly change status', async () => {
      // Arrange
      mockJobOrderRepo.findOne
        .mockResolvedValueOnce({ orderNo: 'JO-001', status: 'WAITING' } as JobOrder)
        .mockResolvedValueOnce({ orderNo: 'JO-001', status: 'RUNNING' } as JobOrder);
      mockJobOrderRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      await target.changeStatus('JO-001', { status: 'RUNNING' } as any);

      // Assert
      expect(mockJobOrderRepo.update).toHaveBeenCalledWith(
        { orderNo: 'JO-001' },
        expect.objectContaining({ status: 'RUNNING' }),
      );
    });
  });

  // ─────────────────────────────────────────────
  // updateErpSyncYn
  // ─────────────────────────────────────────────
  describe('updateErpSyncYn', () => {
    it('should update ERP sync flag', async () => {
      // Arrange
      mockJobOrderRepo.findOne
        .mockResolvedValueOnce({ orderNo: 'JO-001' } as JobOrder)
        .mockResolvedValueOnce({ orderNo: 'JO-001', erpSyncYn: 'Y' } as JobOrder);
      mockJobOrderRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.updateErpSyncYn('JO-001', { erpSyncYn: 'Y' } as any);

      // Assert
      expect(mockJobOrderRepo.update).toHaveBeenCalledWith(
        { orderNo: 'JO-001' },
        { erpSyncYn: 'Y' },
      );
    });
  });

  // ─────────────────────────────────────────────
  // findUnsyncedForErp
  // ─────────────────────────────────────────────
  describe('findUnsyncedForErp', () => {
    it('should return DONE + N records', async () => {
      // Arrange
      const data = [{ orderNo: 'JO-001', status: 'DONE', erpSyncYn: 'N' }] as JobOrder[];
      mockJobOrderRepo.find.mockResolvedValue(data);

      // Act
      const result = await target.findUnsyncedForErp();

      // Assert
      expect(result).toEqual(data);
      expect(mockJobOrderRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { erpSyncYn: 'N', status: 'DONE' },
        }),
      );
    });
  });

  // ─────────────────────────────────────────────
  // markAsSynced
  // ─────────────────────────────────────────────
  describe('markAsSynced', () => {
    it('should update multiple records', async () => {
      // Arrange
      const mockQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 2 }),
      };
      mockJobOrderRepo.createQueryBuilder.mockReturnValue(mockQb as any);

      // Act
      const result = await target.markAsSynced(['JO-001', 'JO-002']);

      // Assert
      expect(result).toEqual({ count: 2 });
    });
  });

  // ─────────────────────────────────────────────
  // getJobOrderSummary
  // ─────────────────────────────────────────────
  describe('getJobOrderSummary', () => {
    it('should return aggregated summary', async () => {
      // Arrange
      mockJobOrderRepo.findOne.mockResolvedValue({
        orderNo: 'JO-001', planQty: 100,
      } as JobOrder);

      const mockQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          totalGoodQty: '80', totalDefectQty: '10', avgCycleTime: '5.5', resultCount: '3',
        }),
      };
      mockProdResultRepo.createQueryBuilder.mockReturnValue(mockQb as any);

      // Act
      const result = await target.getJobOrderSummary('JO-001');

      // Assert
      expect(result.totalGoodQty).toBe(80);
      expect(result.totalDefectQty).toBe(10);
      expect(result.achievementRate).toBe(80);
      expect(result.resultCount).toBe(3);
    });
  });
});
