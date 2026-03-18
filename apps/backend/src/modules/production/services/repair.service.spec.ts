/**
 * @file src/modules/production/services/repair.service.spec.ts
 * @description RepairService 단위 테스트 - 수리관리 CRUD + 재고 조회 로직 검증
 *
 * 초보자 가이드:
 * - `target`: 테스트 대상(SUT), `mock*`: 모킹된 의존성
 * - 트랜잭션 사용하는 create/update/remove 메서드를 QueryRunner 모킹으로 검증
 * - 실행: `npx jest --testPathPattern="repair.service.spec"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { RepairService } from './repair.service';
import { RepairOrder } from '../../../entities/repair-order.entity';
import { RepairUsedPart } from '../../../entities/repair-used-part.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('RepairService', () => {
  let target: RepairService;
  let mockRepairOrderRepo: DeepMocked<Repository<RepairOrder>>;
  let mockRepairUsedPartRepo: DeepMocked<Repository<RepairUsedPart>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockRepairOrderRepo = createMock<Repository<RepairOrder>>();
    mockRepairUsedPartRepo = createMock<Repository<RepairUsedPart>>();
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
        RepairService,
        { provide: getRepositoryToken(RepairOrder), useValue: mockRepairOrderRepo },
        { provide: getRepositoryToken(RepairUsedPart), useValue: mockRepairUsedPartRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<RepairService>(RepairService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────
  describe('findAll', () => {
    it('should return paginated repair orders', async () => {
      // Arrange
      const data = [{ seq: 1, status: 'RECEIVED' }] as RepairOrder[];
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([data, 1]),
      };
      mockRepairOrderRepo.createQueryBuilder.mockReturnValue(mockQb as any);

      // Act
      const result = await target.findAll(
        { page: 1, limit: 50 } as any, 'COMP', 'PLT',
      );

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should apply search filter', async () => {
      // Arrange
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockRepairOrderRepo.createQueryBuilder.mockReturnValue(mockQb as any);

      // Act
      await target.findAll(
        { page: 1, limit: 50, search: 'TEST' } as any, 'C', 'P',
      );

      // Assert
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('FG_BARCODE'),
        expect.objectContaining({ search: '%TEST%' }),
      );
    });
  });

  // ─────────────────────────────────────────────
  // findOne
  // ─────────────────────────────────────────────
  describe('findOne', () => {
    it('should return repair order with used parts', async () => {
      // Arrange
      const order = { repairDate: new Date('2026-03-18'), seq: 1, status: 'RECEIVED' } as any;
      const usedParts = [{ itemCode: 'PART-001', qty: 2 }] as RepairUsedPart[];
      mockRepairOrderRepo.findOne.mockResolvedValue(order);
      mockRepairUsedPartRepo.find.mockResolvedValue(usedParts);

      // Act
      const result = await target.findOne('2026-03-18', 1, 'C', 'P');

      // Assert
      expect(result.seq).toBe(1);
      expect(result.usedParts).toHaveLength(1);
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockRepairOrderRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        target.findOne('2026-03-18', 99, 'C', 'P'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────
  describe('create', () => {
    it('should create repair order with auto-seq and used parts', async () => {
      // Arrange
      const mockCreateQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ maxSeq: 3 }),
      };
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue(mockCreateQb as any);
      mockQueryRunner.manager.create.mockImplementation((_: any, data: any) => data);
      mockQueryRunner.manager.save.mockResolvedValue({} as any);

      // Act
      const result = await target.create(
        {
          repairDate: '2026-03-18',
          itemCode: 'PART-001',
          qty: 1,
          usedParts: [{ itemCode: 'COMP-001', qty: 2 }],
        } as any,
        'COMP', 'PLT',
      );

      // Assert
      expect(result.seq).toBe(4); // maxSeq(3) + 1
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(2); // order + parts
    });

    it('should create repair order without used parts', async () => {
      // Arrange
      const mockCreateQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ maxSeq: null }),
      };
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue(mockCreateQb as any);
      mockQueryRunner.manager.create.mockImplementation((_: any, data: any) => data);
      mockQueryRunner.manager.save.mockResolvedValue({} as any);

      // Act
      const result = await target.create(
        { itemCode: 'PART-001', qty: 1 } as any,
        'COMP', 'PLT',
      );

      // Assert
      expect(result.seq).toBe(1); // null + 1
      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(1); // only order
    });

    it('should rollback on error', async () => {
      // Arrange
      const mockCreateQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockRejectedValue(new Error('DB error')),
      };
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue(mockCreateQb as any);

      // Act & Assert
      await expect(
        target.create({ itemCode: 'PART', qty: 1 } as any, 'C', 'P'),
      ).rejects.toThrow('DB error');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────
  describe('update', () => {
    it('should update repair order and replace used parts', async () => {
      // Arrange
      const existing = { repairDate: new Date('2026-03-18'), seq: 1, status: 'RECEIVED' } as any;
      mockQueryRunner.manager.findOne.mockResolvedValue(existing);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
      mockQueryRunner.manager.delete.mockResolvedValue({ affected: 1 } as any);
      mockQueryRunner.manager.create.mockImplementation((_: any, data: any) => data);
      mockQueryRunner.manager.save.mockResolvedValue({} as any);

      // Act
      const result = await target.update(
        '2026-03-18', 1,
        { remark: '수정', usedParts: [{ itemCode: 'NEW-001', qty: 1 }] } as any,
        'C', 'P',
      );

      // Assert
      expect(result.seq).toBe(1);
      expect(mockQueryRunner.manager.delete).toHaveBeenCalled(); // old parts deleted
      expect(mockQueryRunner.manager.save).toHaveBeenCalled(); // new parts saved
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should mark as COMPLETED when disposition is set', async () => {
      // Arrange
      const existing = { repairDate: new Date('2026-03-18'), seq: 1, status: 'IN_REPAIR' } as any;
      mockQueryRunner.manager.findOne.mockResolvedValue(existing);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      await target.update(
        '2026-03-18', 1,
        { disposition: 'SCRAP' } as any,
        'C', 'P',
      );

      // Assert
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        RepairOrder,
        expect.anything(),
        expect.objectContaining({ status: 'COMPLETED' }),
      );
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        target.update('2026-03-18', 99, {} as any, 'C', 'P'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // remove
  // ─────────────────────────────────────────────
  describe('remove', () => {
    it('should delete repair order and used parts', async () => {
      // Arrange
      mockQueryRunner.manager.findOne.mockResolvedValue({
        repairDate: new Date('2026-03-18'), seq: 1,
      } as any);
      mockQueryRunner.manager.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      await target.remove('2026-03-18', 1, 'C', 'P');

      // Assert
      expect(mockQueryRunner.manager.delete).toHaveBeenCalledTimes(2); // parts + order
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        target.remove('2026-03-18', 99, 'C', 'P'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should rollback on error', async () => {
      // Arrange
      mockQueryRunner.manager.findOne.mockResolvedValue({
        repairDate: new Date('2026-03-18'), seq: 1,
      } as any);
      mockQueryRunner.manager.delete.mockRejectedValue(new Error('FK violation'));

      // Act & Assert
      await expect(
        target.remove('2026-03-18', 1, 'C', 'P'),
      ).rejects.toThrow('FK violation');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // getInventory
  // ─────────────────────────────────────────────
  describe('getInventory', () => {
    it('should return repair room inventory', async () => {
      // Arrange
      const data = [
        { seq: 1, status: 'RECEIVED' },
        { seq: 2, status: 'IN_REPAIR' },
      ] as RepairOrder[];
      mockRepairOrderRepo.find.mockResolvedValue(data);

      // Act
      const result = await target.getInventory('C', 'P');

      // Assert
      expect(result).toHaveLength(2);
      expect(mockRepairOrderRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            company: 'C',
            plant: 'P',
          }),
        }),
      );
    });
  });
});
