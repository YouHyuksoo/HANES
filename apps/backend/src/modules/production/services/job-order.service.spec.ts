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
import { ItemMaster } from '../../../entities/item-master.entity';
import { ProdResult } from '../../../entities/prod-result.entity';
import { BomMaster } from '../../../entities/bom-master.entity';
import { RoutingGroup } from '../../../entities/routing-group.entity';
import { RoutingProcess } from '../../../entities/routing-process.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { ProdPlan } from '../../../entities/prod-plan.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { SysConfigService } from '../../system/services/sys-config.service';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('JobOrderService', () => {
  let target: JobOrderService;
  let mockJobOrderRepo: DeepMocked<Repository<JobOrder>>;
  let mockItemMasterRepo: DeepMocked<Repository<ItemMaster>>;
  let mockProdResultRepo: DeepMocked<Repository<ProdResult>>;
  let mockBomMasterRepo: DeepMocked<Repository<BomMaster>>;
  let mockRoutingGroupRepo: DeepMocked<Repository<RoutingGroup>>;
  let mockRoutingProcessRepo: DeepMocked<Repository<RoutingProcess>>;
  let mockFgLabelRepo: DeepMocked<Repository<FgLabel>>;
  let mockProdPlanRepo: DeepMocked<Repository<ProdPlan>>;
  let mockNumbering: DeepMocked<NumberingService>;
  let mockSysConfigService: DeepMocked<SysConfigService>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockTx: DeepMocked<TransactionService>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockJobOrderRepo = createMock<Repository<JobOrder>>();
    mockItemMasterRepo = createMock<Repository<ItemMaster>>();
    mockProdResultRepo = createMock<Repository<ProdResult>>();
    mockBomMasterRepo = createMock<Repository<BomMaster>>();
    mockRoutingGroupRepo = createMock<Repository<RoutingGroup>>();
    mockRoutingProcessRepo = createMock<Repository<RoutingProcess>>();
    mockFgLabelRepo = createMock<Repository<FgLabel>>();
    mockProdPlanRepo = createMock<Repository<ProdPlan>>();
    mockNumbering = createMock<NumberingService>();
    mockSysConfigService = createMock<SysConfigService>();
    mockDataSource = createMock<DataSource>();
    mockTx = createMock<TransactionService>();
    mockQueryRunner = createMock<QueryRunner>();

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockTx.run.mockImplementation(async (callback: any) => callback(mockQueryRunner));
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobOrderService,
        { provide: getRepositoryToken(JobOrder), useValue: mockJobOrderRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: mockItemMasterRepo },
        { provide: getRepositoryToken(ProdResult), useValue: mockProdResultRepo },
        { provide: getRepositoryToken(BomMaster), useValue: mockBomMasterRepo },
        { provide: getRepositoryToken(RoutingGroup), useValue: mockRoutingGroupRepo },
        { provide: getRepositoryToken(RoutingProcess), useValue: mockRoutingProcessRepo },
        { provide: getRepositoryToken(FgLabel), useValue: mockFgLabelRepo },
        { provide: getRepositoryToken(ProdPlan), useValue: mockProdPlanRepo },
        { provide: NumberingService, useValue: mockNumbering },
        { provide: SysConfigService, useValue: mockSysConfigService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
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

    it('should reject when the found job order tenant differs from request tenant', async () => {
      mockJobOrderRepo.findOne.mockResolvedValue({
        orderNo: 'JO-001',
        status: 'WAITING',
        company: 'OTHER',
        plant: 'P1',
      } as JobOrder);

      await expect(target.findById('JO-001', 'C1', 'P1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findByIdWithResults', () => {
    it('loads routing processes within the job order tenant', async () => {
      // Arrange
      const jobOrder = {
        orderNo: 'JO-001',
        routingCode: 'RT-001',
        company: 'C1',
        plant: 'P1',
      } as JobOrder;
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockJobOrderRepo.findOne.mockResolvedValue(jobOrder);
      mockProdResultRepo.createQueryBuilder.mockReturnValue(mockQb as any);
      mockRoutingProcessRepo.find.mockResolvedValue([]);

      // Act
      await target.findByIdWithResults('JO-001', 'C1', 'P1');

      // Assert
      expect(mockRoutingProcessRepo.find).toHaveBeenCalledWith({
        where: { routingCode: 'RT-001', useYn: 'Y', company: 'C1', plant: 'P1' },
        order: { seq: 'ASC' },
      });
    });

    it('exposes next subcontract routing process after the current job order process', async () => {
      const jobOrder = {
        orderNo: 'JO-001',
        routingCode: 'RT-001',
        processCode: 'CUT',
        company: 'C1',
        plant: 'P1',
      } as JobOrder;
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockJobOrderRepo.findOne.mockResolvedValue(jobOrder);
      mockProdResultRepo.createQueryBuilder.mockReturnValue(mockQb as any);
      mockRoutingProcessRepo.find.mockResolvedValue([
        { routingCode: 'RT-001', seq: 10, processCode: 'CUT', processName: '절단', executionType: 'IN_HOUSE', subconVendorCode: null } as RoutingProcess,
        { routingCode: 'RT-001', seq: 20, processCode: 'PLATING', processName: '도금', executionType: 'SUBCON', subconVendorCode: 'SUB001' } as RoutingProcess,
      ]);

      const result = await target.findByIdWithResults('JO-001', 'C1', 'P1');

      expect((result as any).nextRoutingProcess).toEqual({
        routingCode: 'RT-001',
        seq: 20,
        processCode: 'PLATING',
        processName: '도금',
        executionType: 'SUBCON',
        subconVendorCode: 'SUB001',
      });
    });
  });

  describe('findByOrderNo', () => {
    it('exposes next subcontract routing process for kiosk refresh', async () => {
      const jobOrder = {
        orderNo: 'JO-001',
        routingCode: 'RT-001',
        processCode: 'CUT',
        company: 'C1',
        plant: 'P1',
      } as JobOrder;
      const summaryQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalGoodQty: '10', totalDefectQty: '0' }),
      };
      mockJobOrderRepo.findOne.mockResolvedValue(jobOrder);
      mockProdResultRepo.createQueryBuilder.mockReturnValue(summaryQb as any);
      mockRoutingProcessRepo.find.mockResolvedValue([
        { routingCode: 'RT-001', seq: 10, processCode: 'CUT', processName: '절단', executionType: 'IN_HOUSE', subconVendorCode: null } as RoutingProcess,
        { routingCode: 'RT-001', seq: 20, processCode: 'PLATING', processName: '도금', executionType: 'SUBCON', subconVendorCode: 'SUB001' } as RoutingProcess,
      ]);

      const result = await target.findByOrderNo('JO-001', 'C1', 'P1');

      expect((result as any).nextRoutingProcess?.executionType).toBe('SUBCON');
      expect((result as any).nextRoutingProcess?.subconVendorCode).toBe('SUB001');
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

    it('filters job orders by production result equipment code', async () => {
      // Arrange
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockJobOrderRepo.createQueryBuilder.mockReturnValue(mockQb as any);

      // Act
      await target.findAll({ page: 1, limit: 10, equipCode: 'EQ-CUT-01' } as any, '40', '1000');

      // Assert
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('pr.EQUIP_CODE = :equipCode'),
        expect.objectContaining({ equipCode: 'EQ-CUT-01' }),
      );
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
      mockNumbering.nextJobOrderNo.mockResolvedValue('JO-20260318-0001');
      mockJobOrderRepo.findOne
        .mockResolvedValueOnce(null) // existing check
        .mockResolvedValueOnce({ orderNo: 'JO-20260318-0001' } as JobOrder); // final findOne
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'PART-001', company: 'COMPANY', plant: 'PLANT' } as ItemMaster);
      mockRoutingGroupRepo.findOne.mockResolvedValue({ routingCode: 'RT-001', itemCode: 'PART-001', company: 'COMPANY', plant: 'PLANT' } as any);
      mockQueryRunner.manager.create.mockReturnValue({ orderNo: 'JO-20260318-0001' } as any);
      mockQueryRunner.manager.save.mockResolvedValue({ orderNo: 'JO-20260318-0001' } as any);

      // Act
      const result = await target.create(createDto, 'COMPANY', 'PLANT');

      // Assert
      expect(mockNumbering.nextJobOrderNo).toHaveBeenCalled();
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('checks duplicate order and item existence within tenant when creating', async () => {
      // Arrange
      const dto = { ...createDto, orderNo: 'JO-001' };
      mockJobOrderRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ orderNo: 'JO-001', company: 'C1', plant: 'P1' } as JobOrder);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'PART-001', company: 'C1', plant: 'P1' } as ItemMaster);
      mockRoutingGroupRepo.findOne.mockResolvedValue({ routingCode: 'RT-001', itemCode: 'PART-001', company: 'C1', plant: 'P1' } as any);
      mockQueryRunner.manager.create.mockReturnValue({ orderNo: 'JO-001' } as any);
      mockQueryRunner.manager.save.mockResolvedValue({ orderNo: 'JO-001' } as any);

      // Act
      await target.create(dto, 'C1', 'P1');

      // Assert
      expect(mockJobOrderRepo.findOne).toHaveBeenNthCalledWith(1, {
        where: { orderNo: 'JO-001', company: 'C1', plant: 'P1' },
      });
      expect(mockItemMasterRepo.findOne).toHaveBeenCalledWith({
        where: { itemCode: 'PART-001', company: 'C1', plant: 'P1' },
      });
    });

    it('creates operation job orders for each routing process under the item job order', async () => {
      mockNumbering.nextJobOrderNo
        .mockResolvedValueOnce('JO-ITEM')
        .mockResolvedValueOnce('JO-OP-10')
        .mockResolvedValueOnce('JO-OP-20');
      mockJobOrderRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ orderNo: 'JO-ITEM', company: 'C1', plant: 'P1' } as JobOrder);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'PART-001', company: 'C1', plant: 'P1' } as ItemMaster);
      mockRoutingGroupRepo.findOne.mockResolvedValue({ routingCode: 'RT-001', itemCode: 'PART-001', company: 'C1', plant: 'P1' } as RoutingGroup);
      mockRoutingProcessRepo.findOne.mockResolvedValue({ routingCode: 'RT-001', seq: 10, processCode: 'CUT' } as RoutingProcess);
      mockRoutingProcessRepo.find.mockResolvedValue([
        { routingCode: 'RT-001', seq: 10, processCode: 'CUT', processName: '절단', useYn: 'Y', jobOrderYn: 'Y' } as RoutingProcess,
        { routingCode: 'RT-001', seq: 20, processCode: 'CRIMP', processName: '압착', useYn: 'Y', jobOrderYn: 'Y' } as RoutingProcess,
        { routingCode: 'RT-001', seq: 30, processCode: 'INSP', processName: '검사', useYn: 'Y', jobOrderYn: 'N' } as RoutingProcess,
      ]);
      mockBomMasterRepo.find.mockResolvedValue([]);
      mockQueryRunner.manager.create.mockImplementation((_entity, payload) => payload as any);
      mockQueryRunner.manager.save.mockImplementation(async (entity: any) => entity);

      await target.create({ ...createDto, orderNo: undefined }, 'C1', 'P1');

      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        JobOrder,
        expect.objectContaining({ orderNo: 'JO-ITEM', orderKind: 'ITEM', routingCode: 'RT-001', processCode: 'CUT' }),
      );
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        JobOrder,
        expect.objectContaining({
          orderNo: 'JO-OP-10',
          orderKind: 'OPERATION',
          parentOrderNo: 'JO-ITEM',
          routingSeq: 10,
          processCode: 'CUT',
          itemCode: 'PART-001',
        }),
      );
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        JobOrder,
        expect.objectContaining({
          orderNo: 'JO-OP-20',
          orderKind: 'OPERATION',
          parentOrderNo: 'JO-ITEM',
          routingSeq: 20,
          processCode: 'CRIMP',
          itemCode: 'PART-001',
        }),
      );
      expect(mockQueryRunner.manager.create).not.toHaveBeenCalledWith(
        JobOrder,
        expect.objectContaining({ processCode: 'INSP', orderKind: 'OPERATION' }),
      );
    });

    it('creates item and operation job orders recursively for semi-product BOM children', async () => {
      mockNumbering.nextJobOrderNo
        .mockResolvedValueOnce('JO-FG')
        .mockResolvedValueOnce('JO-FG-OP10')
        .mockResolvedValueOnce('JO-SEMI')
        .mockResolvedValueOnce('JO-SEMI-OP10');
      mockJobOrderRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ orderNo: 'JO-FG', company: 'C1', plant: 'P1' } as JobOrder);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'FG-001', company: 'C1', plant: 'P1' } as ItemMaster);
      mockRoutingGroupRepo.findOne
        .mockResolvedValueOnce({ routingCode: 'RT-FG', itemCode: 'FG-001', company: 'C1', plant: 'P1' } as RoutingGroup)
        .mockResolvedValueOnce({ routingCode: 'RT-SEMI', itemCode: 'SEMI-001', company: 'C1', plant: 'P1' } as RoutingGroup);
      mockRoutingProcessRepo.findOne
        .mockResolvedValueOnce({ routingCode: 'RT-FG', seq: 10, processCode: 'ASSY' } as RoutingProcess)
        .mockResolvedValueOnce({ routingCode: 'RT-SEMI', seq: 10, processCode: 'CUT' } as RoutingProcess);
      mockRoutingProcessRepo.find
        .mockResolvedValueOnce([{ routingCode: 'RT-FG', seq: 10, processCode: 'ASSY', processName: '조립', useYn: 'Y', jobOrderYn: 'Y' } as RoutingProcess])
        .mockResolvedValueOnce([{ routingCode: 'RT-SEMI', seq: 10, processCode: 'CUT', processName: '절단', useYn: 'Y', jobOrderYn: 'Y' } as RoutingProcess]);
      mockBomMasterRepo.find
        .mockResolvedValueOnce([{ parentItemCode: 'FG-001', childItemCode: 'SEMI-001', qtyPer: 2, seq: 1, company: 'C1', plant: 'P1' } as BomMaster])
        .mockResolvedValueOnce([]);
      const childPartQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ itemCode: 'SEMI-001', itemType: 'SEMI_PRODUCT', company: 'C1', plant: 'P1' }]),
      };
      mockItemMasterRepo.createQueryBuilder.mockReturnValue(childPartQb as any);
      mockQueryRunner.manager.create.mockImplementation((_entity, payload) => payload as any);
      mockQueryRunner.manager.save.mockImplementation(async (entity: any) => entity);

      await target.create({ ...createDto, orderNo: undefined, itemCode: 'FG-001', planQty: 10 }, 'C1', 'P1');

      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        JobOrder,
        expect.objectContaining({ orderNo: 'JO-SEMI', orderKind: 'ITEM', itemCode: 'SEMI-001', parentOrderNo: 'JO-FG', planQty: 20 }),
      );
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        JobOrder,
        expect.objectContaining({ orderNo: 'JO-SEMI-OP10', orderKind: 'OPERATION', itemCode: 'SEMI-001', parentOrderNo: 'JO-SEMI', routingSeq: 10, processCode: 'CUT' }),
      );
    });

    it('should throw ConflictException when orderNo already exists', async () => {
      // Arrange
      const dto = { ...createDto, orderNo: 'JO-EXISTS' };
      mockJobOrderRepo.findOne.mockResolvedValue({ orderNo: 'JO-EXISTS' } as JobOrder);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'PART-001' } as ItemMaster);

      // Act & Assert
      await expect(target.create(dto, 'C', 'P')).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when part not found', async () => {
      // Arrange
      mockNumbering.nextJobOrderNo.mockResolvedValue('JO-001');
      mockJobOrderRepo.findOne.mockResolvedValue(null);
      mockItemMasterRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.create(createDto, 'C', 'P')).rejects.toThrow(NotFoundException);
    });

    it('should reject when the found part belongs to a different tenant', async () => {
      mockNumbering.nextJobOrderNo.mockResolvedValue('JO-001');
      mockJobOrderRepo.findOne.mockResolvedValue(null);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'PART-001', company: 'OTHER', plant: 'P' } as ItemMaster);

      await expect(target.create(createDto, 'C', 'P')).rejects.toThrow(BadRequestException);

      expect(mockTx.run).not.toHaveBeenCalled();
    });

    it('should reject when resolved routing group belongs to a different tenant', async () => {
      mockNumbering.nextJobOrderNo.mockResolvedValue('JO-001');
      mockJobOrderRepo.findOne.mockResolvedValue(null);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'PART-001', company: 'C', plant: 'P' } as ItemMaster);
      mockRoutingGroupRepo.findOne.mockResolvedValue({ routingCode: 'RT-OTHER', itemCode: 'PART-001', company: 'OTHER', plant: 'P' } as RoutingGroup);

      await expect(target.create(createDto, 'C', 'P')).rejects.toThrow(BadRequestException);

      expect(mockTx.run).not.toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      // Arrange
      mockNumbering.nextJobOrderNo.mockResolvedValue('JO-001');
      mockJobOrderRepo.findOne.mockResolvedValue(null);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'PART-001' } as ItemMaster);
      mockRoutingGroupRepo.findOne.mockResolvedValue({ routingCode: 'RT-001' } as any);
      mockQueryRunner.manager.create.mockReturnValue({} as any);
      mockQueryRunner.manager.save.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(target.create(createDto)).rejects.toThrow('DB error');
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
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

    it('should block direct status changes in update', async () => {
      mockJobOrderRepo.findOne.mockResolvedValue({
        orderNo: 'JO-001',
        status: 'WAITING',
        itemCode: 'PART-001',
      } as JobOrder);

      await expect(target.update('JO-001', { status: 'RUNNING' } as any)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockJobOrderRepo.update).not.toHaveBeenCalled();
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
        andWhere: jest.fn().mockReturnThis(),
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
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('returns next subcontract routing process after completion', async () => {
      const jo = {
        orderNo: 'JO-001',
        status: 'RUNNING',
        routingCode: 'RT-001',
        processCode: 'CUT',
        company: 'C1',
        plant: 'P1',
      } as JobOrder;
      mockJobOrderRepo.findOne
        .mockResolvedValueOnce(jo)
        .mockResolvedValueOnce({ ...jo, status: 'DONE' } as JobOrder);
      const txSummaryQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalGoodQty: '10', totalDefectQty: '0' }),
      };
      const refreshSummaryQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalGoodQty: '10', totalDefectQty: '0' }),
      };
      mockQueryRunner.manager.createQueryBuilder.mockReturnValue(txSummaryQb as any);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
      mockProdResultRepo.createQueryBuilder.mockReturnValue(refreshSummaryQb as any);
      mockRoutingProcessRepo.find.mockResolvedValue([
        { routingCode: 'RT-001', seq: 10, processCode: 'CUT', processName: '절단', executionType: 'IN_HOUSE', subconVendorCode: null } as RoutingProcess,
        { routingCode: 'RT-001', seq: 20, processCode: 'PLATING', processName: '도금', executionType: 'SUBCON', subconVendorCode: 'SUB001' } as RoutingProcess,
      ]);

      const result = await target.complete('JO-001', 'C1', 'P1');

      expect((result as any).nextRoutingProcess?.executionType).toBe('SUBCON');
      expect((result as any).nextRoutingProcess?.processCode).toBe('PLATING');
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
    it('should block direct status changes and require lifecycle APIs', async () => {
      // Arrange
      mockJobOrderRepo.findOne.mockResolvedValue({ orderNo: 'JO-001', status: 'WAITING' } as JobOrder);

      // Act
      await expect(target.changeStatus('JO-001', { status: 'RUNNING' } as any)).rejects.toThrow(
        BadRequestException,
      );

      // Assert
      expect(mockJobOrderRepo.update).not.toHaveBeenCalled();
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
        andWhere: jest.fn().mockReturnThis(),
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
