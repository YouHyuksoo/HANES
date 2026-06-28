/**
 * @file src/modules/master/services/routing-group.service.spec.ts
 * @description RoutingGroupService 단위 테스트 - 그룹/공정/양품조건 CRUD + 트랜잭션 검증
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "RoutingGroupService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { getMetadataArgsStorage } from 'typeorm';
import { RoutingGroupService } from './routing-group.service';
import { RoutingGroup } from '../../../entities/routing-group.entity';
import { RoutingProcess } from '../../../entities/routing-process.entity';
import { ProcessMaster } from '../../../entities/process-master.entity';
import { ProcessQualityCondition } from '../../../entities/process-quality-condition.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { BomMaster } from '../../../entities/bom-master.entity';
import { RoutingMaterial } from '../../../entities/routing-material.entity';
import { HarnessCircuitSpec } from '../../../entities/harness-circuit-spec.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('RoutingGroupService', () => {
  let target: RoutingGroupService;
  let mockGroupRepo: DeepMocked<Repository<RoutingGroup>>;
  let mockProcessRepo: DeepMocked<Repository<RoutingProcess>>;
  let mockProcessMasterRepo: DeepMocked<Repository<ProcessMaster>>;
  let mockConditionRepo: DeepMocked<Repository<ProcessQualityCondition>>;
  let mockPartRepo: DeepMocked<Repository<ItemMaster>>;
  let mockBomRepo: DeepMocked<Repository<BomMaster>>;
  let mockMaterialRepo: DeepMocked<Repository<RoutingMaterial>>;
  let mockCircuitRepo: DeepMocked<Repository<HarnessCircuitSpec>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockEntityManager: DeepMocked<EntityManager>;
  let mockTx: DeepMocked<TransactionService>;

  beforeEach(async () => {
    mockGroupRepo = createMock<Repository<RoutingGroup>>();
    mockProcessRepo = createMock<Repository<RoutingProcess>>();
    mockProcessMasterRepo = createMock<Repository<ProcessMaster>>();
    mockConditionRepo = createMock<Repository<ProcessQualityCondition>>();
    mockPartRepo = createMock<Repository<ItemMaster>>();
    mockBomRepo = createMock<Repository<BomMaster>>();
    mockMaterialRepo = createMock<Repository<RoutingMaterial>>();
    mockCircuitRepo = createMock<Repository<HarnessCircuitSpec>>();
    mockCircuitRepo.query.mockResolvedValue([]);
    mockDataSource = createMock<DataSource>();
    mockEntityManager = createMock<EntityManager>();
    mockTx = createMock<TransactionService>();
    mockProcessMasterRepo.findOne.mockImplementation(async (options: any) => {
      const processCode = options?.where?.processCode ?? 'P01';
      return {
        processCode,
        processName: 'Process',
        processType: 'ASSY',
      } as ProcessMaster;
    });

    // Transaction mock: execute callback with mockEntityManager
    mockDataSource.transaction.mockImplementation(async (cb: any) => {
      return cb(mockEntityManager);
    });
    mockTx.run.mockImplementation(async (cb) => cb({ manager: mockEntityManager } as any));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutingGroupService,
        { provide: getRepositoryToken(RoutingGroup), useValue: mockGroupRepo },
        { provide: getRepositoryToken(RoutingProcess), useValue: mockProcessRepo },
        { provide: getRepositoryToken(ProcessMaster), useValue: mockProcessMasterRepo },
        { provide: getRepositoryToken(ProcessQualityCondition), useValue: mockConditionRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: mockPartRepo },
        { provide: getRepositoryToken(BomMaster), useValue: mockBomRepo },
        { provide: getRepositoryToken(RoutingMaterial), useValue: mockMaterialRepo },
        { provide: getRepositoryToken(HarnessCircuitSpec), useValue: mockCircuitRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<RoutingGroupService>(RoutingGroupService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('tenant key metadata', () => {
    it('includes tenant columns in routing hierarchy primary keys', () => {
      const primaryColumnNames = (targetEntity: Function) =>
        getMetadataArgsStorage()
          .columns
          .filter((column) => column.target === targetEntity && column.options.primary)
          .map((column) => column.propertyName);

      for (const entity of [RoutingGroup, RoutingProcess, ProcessQualityCondition, RoutingMaterial]) {
        expect(primaryColumnNames(entity)).toEqual(expect.arrayContaining(['company', 'plant']));
      }
    });
  });

  // ─── Group CRUD ───

  describe('findAllGroups', () => {
    it('joins item master by tenant-scoped item key', async () => {
      const qb = {
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getRawAndEntities: jest.fn().mockResolvedValue({ raw: [], entities: [] }),
        getCount: jest.fn().mockResolvedValue(0),
      };
      mockGroupRepo.createQueryBuilder.mockReturnValue(qb as any);

      await target.findAllGroups({ page: 1, limit: 50 } as any, 'C1', 'P1');

      expect(qb.leftJoin).toHaveBeenCalledWith(
        'ITEM_MASTERS',
        'p',
        'g.ITEM_CODE = p.ITEM_CODE AND g.COMPANY = p.COMPANY AND g.PLANT_CD = p.PLANT_CD',
      );
    });
  });

  describe('findGroupByCode', () => {
    it('should return group when found', async () => {
      // Arrange
      const group = { routingCode: 'RG01', routingName: 'Group1' } as RoutingGroup;
      mockGroupRepo.findOne.mockResolvedValue(group);

      // Act
      const result = await target.findGroupByCode('RG01');

      // Assert
      expect(result).toEqual(group);
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockGroupRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findGroupByCode('RG99')).rejects.toThrow(NotFoundException);
    });

    it('should find group within tenant only', async () => {
      mockGroupRepo.findOne.mockResolvedValue({ routingCode: 'RG01', company: 'C1', plant: 'P1' } as RoutingGroup);

      await target.findGroupByCode('RG01', 'C1', 'P1');

      expect(mockGroupRepo.findOne).toHaveBeenCalledWith({
        where: { routingCode: 'RG01', company: 'C1', plant: 'P1' },
      });
    });
  });

  describe('createGroup', () => {
    it('should create a new group', async () => {
      // Arrange
      const dto = { routingCode: 'RG01', routingName: 'Group1' } as any;
      const created = { ...dto, useYn: 'Y' } as RoutingGroup;
      mockGroupRepo.findOne.mockResolvedValue(null);
      mockGroupRepo.create.mockReturnValue(created);
      mockGroupRepo.save.mockResolvedValue(created);

      // Act
      const result = await target.createGroup(dto);

      // Assert
      expect(result).toEqual(created);
    });

    it('should throw ConflictException when group exists', async () => {
      // Arrange
      const dto = { routingCode: 'RG01' } as any;
      mockGroupRepo.findOne.mockResolvedValue({ routingCode: 'RG01' } as RoutingGroup);

      // Act & Assert
      await expect(target.createGroup(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('updateGroup', () => {
    it('should update and return group', async () => {
      // Arrange
      const existing = { routingCode: 'RG01', routingName: 'Old' } as RoutingGroup;
      mockGroupRepo.findOne.mockResolvedValue(existing);
      mockGroupRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.updateGroup('RG01', { routingName: 'New' } as any, 'C1', 'P1');

      // Assert
      expect(mockGroupRepo.update).toHaveBeenCalledWith(
        { routingCode: 'RG01', company: 'C1', plant: 'P1' },
        expect.objectContaining({ routingName: 'New' }),
      );
    });
  });

  describe('deleteGroup', () => {
    it('should delete group with related conditions and processes in transaction', async () => {
      // Arrange
      const existing = { routingCode: 'RG01' } as RoutingGroup;
      mockGroupRepo.findOne.mockResolvedValue(existing);
      mockEntityManager.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.deleteGroup('RG01');

      // Assert
      expect(result).toEqual({ routingCode: 'RG01' });
      expect(mockTx.run).toHaveBeenCalled();
      expect(mockEntityManager.delete).toHaveBeenCalledTimes(4);
    });

    it('should throw NotFoundException when group not found', async () => {
      // Arrange
      mockGroupRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.deleteGroup('RG99')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Process CRUD ───

  describe('findProcesses', () => {
    it('should return processes ordered by seq', async () => {
      // Arrange
      const processes = [{ routingCode: 'RG01', seq: 10 }] as RoutingProcess[];
      mockProcessRepo.find.mockResolvedValue(processes);

      // Act
      const result = await target.findProcesses('RG01', 'C1', 'P1');

      // Assert
      expect(result).toEqual(processes);
      expect(mockProcessRepo.find).toHaveBeenCalledWith({
        where: { routingCode: 'RG01', company: 'C1', plant: 'P1' },
        order: { seq: 'ASC' },
      });
    });
  });

  describe('createProcess', () => {
    it('should create a new process', async () => {
      // Arrange
      const dto = { routingCode: 'RG01', seq: 10, processCode: 'P01' } as any;
      const created = { ...dto, useYn: 'Y' } as RoutingProcess;
      mockProcessRepo.findOne.mockResolvedValue(null);
      mockProcessRepo.create.mockReturnValue(created);
      mockProcessRepo.save.mockResolvedValue(created);

      // Act
      const result = await target.createProcess(dto, 'C1', 'P1');

      // Assert
      expect(result).toEqual(created);
      expect(mockProcessRepo.findOne).toHaveBeenCalledWith({
        where: { routingCode: 'RG01', seq: 10, company: 'C1', plant: 'P1' },
      });
    });

    it('should create a process with SG and FG label issue flags', async () => {
      const dto = {
        routingCode: 'RG01',
        seq: 10,
        processCode: 'P01',
        processName: 'Process',
        issueLabelType: 'SG',
      } as any;
      const created = { ...dto, useYn: 'Y' } as RoutingProcess;
      mockProcessRepo.findOne.mockResolvedValue(null);
      mockProcessRepo.create.mockReturnValue(created);
      mockProcessRepo.save.mockResolvedValue(created);

      await target.createProcess(dto, 'C1', 'P1');

      expect(mockProcessRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          processName: 'Process',
          issueLabelType: 'SG',
          company: 'C1',
          plant: 'P1',
        }),
      );
    });

    it('should create a process with subcontract execution metadata', async () => {
      const dto = {
        routingCode: 'RG01',
        seq: 20,
        processCode: 'P01',
        executionType: 'SUBCON',
        subconVendorCode: 'SUB001',
      } as any;
      const created = { ...dto, useYn: 'Y' } as RoutingProcess;
      mockProcessRepo.findOne.mockResolvedValue(null);
      mockProcessRepo.create.mockReturnValue(created);
      mockProcessRepo.save.mockResolvedValue(created);

      await target.createProcess(dto, 'C1', 'P1');

      expect(mockProcessRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          executionType: 'SUBCON',
          subconVendorCode: 'SUB001',
          company: 'C1',
          plant: 'P1',
        }),
      );
    });

    it('should create a process with job order creation flag', async () => {
      const dto = {
        routingCode: 'RG01',
        seq: 30,
        processCode: 'P01',
        jobOrderYn: 'N',
      } as any;
      const created = { ...dto, useYn: 'Y' } as RoutingProcess;
      mockProcessRepo.findOne.mockResolvedValue(null);
      mockProcessRepo.create.mockReturnValue(created);
      mockProcessRepo.save.mockResolvedValue(created);

      await target.createProcess(dto, 'C1', 'P1');

      expect(mockProcessRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          jobOrderYn: 'N',
          company: 'C1',
          plant: 'P1',
        }),
      );
    });

    it('uses PROCESS_MASTERS name when creating a routing process', async () => {
      const dto = {
        routingCode: 'RG01',
        seq: 10,
        processCode: 'P01',
        processName: 'Spoofed Name',
      } as any;
      const created = { ...dto, processName: 'Master Process', useYn: 'Y' } as RoutingProcess;
      mockProcessRepo.findOne.mockResolvedValue(null);
      mockProcessMasterRepo.findOne.mockResolvedValue({
        processCode: 'P01',
        processName: 'Master Process',
        processType: 'ASSY',
      } as ProcessMaster);
      mockProcessRepo.create.mockReturnValue(created);
      mockProcessRepo.save.mockResolvedValue(created);

      await target.createProcess(dto, 'C1', 'P1');

      expect(mockProcessMasterRepo.findOne).toHaveBeenCalledWith({
        where: { processCode: 'P01', useYn: 'Y', company: 'C1', plant: 'P1' },
      });
      expect(mockProcessRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          processCode: 'P01',
          processName: 'Master Process',
          processType: 'ASSY',
        }),
      );
    });

    it('should throw ConflictException when process exists', async () => {
      // Arrange
      const dto = { routingCode: 'RG01', seq: 10 } as any;
      mockProcessRepo.findOne.mockResolvedValue({ routingCode: 'RG01' } as RoutingProcess);

      // Act & Assert
      await expect(target.createProcess(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('updateProcess', () => {
    it('should update and return process', async () => {
      // Arrange
      const existing = { routingCode: 'RG01', seq: 10 } as RoutingProcess;
      mockProcessRepo.findOne.mockResolvedValue(existing);
      mockProcessRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.updateProcess('RG01', 10, { processCode: 'P02' } as any, 'C1', 'P1');

      // Assert
      expect(mockProcessRepo.update).toHaveBeenCalledWith(
        { routingCode: 'RG01', seq: 10, company: 'C1', plant: 'P1' },
        expect.objectContaining({ processCode: 'P02' }),
      );
    });

    it('should update SG and FG label issue flags', async () => {
      const existing = { routingCode: 'RG01', seq: 10 } as RoutingProcess;
      mockProcessRepo.findOne.mockResolvedValue(existing);
      mockProcessRepo.update.mockResolvedValue({ affected: 1 } as any);

      await target.updateProcess(
        'RG01',
        10,
        { issueLabelType: 'SG' } as any,
        'C1',
        'P1',
      );

      expect(mockProcessRepo.update).toHaveBeenCalledWith(
        { routingCode: 'RG01', seq: 10, company: 'C1', plant: 'P1' },
        expect.objectContaining({ issueLabelType: 'SG' }),
      );
    });

    it('should update subcontract execution metadata', async () => {
      const existing = { routingCode: 'RG01', seq: 10 } as RoutingProcess;
      mockProcessRepo.findOne.mockResolvedValue(existing);
      mockProcessRepo.update.mockResolvedValue({ affected: 1 } as any);

      await target.updateProcess(
        'RG01',
        10,
        { executionType: 'SUBCON', subconVendorCode: 'SUB001' } as any,
        'C1',
        'P1',
      );

      expect(mockProcessRepo.update).toHaveBeenCalledWith(
        { routingCode: 'RG01', seq: 10, company: 'C1', plant: 'P1' },
        expect.objectContaining({ executionType: 'SUBCON', subconVendorCode: 'SUB001' }),
      );
    });

    it('should update job order creation flag', async () => {
      const existing = { routingCode: 'RG01', seq: 10, jobOrderYn: 'Y' } as RoutingProcess;
      mockProcessRepo.findOne.mockResolvedValue(existing);
      mockProcessRepo.update.mockResolvedValue({ affected: 1 } as any);

      await target.updateProcess(
        'RG01',
        10,
        { jobOrderYn: 'N' } as any,
        'C1',
        'P1',
      );

      expect(mockProcessRepo.update).toHaveBeenCalledWith(
        { routingCode: 'RG01', seq: 10, company: 'C1', plant: 'P1' },
        expect.objectContaining({ jobOrderYn: 'N' }),
      );
    });

    it('clears subcontract vendor when switching process execution back to in-house', async () => {
      const existing = {
        routingCode: 'RG01',
        seq: 10,
        executionType: 'SUBCON',
        subconVendorCode: 'SUB001',
      } as RoutingProcess;
      mockProcessRepo.findOne.mockResolvedValue(existing);
      mockProcessRepo.update.mockResolvedValue({ affected: 1 } as any);

      await target.updateProcess(
        'RG01',
        10,
        { executionType: 'IN_HOUSE' } as any,
        'C1',
        'P1',
      );

      expect(mockProcessRepo.update).toHaveBeenCalledWith(
        { routingCode: 'RG01', seq: 10, company: 'C1', plant: 'P1' },
        expect.objectContaining({ executionType: 'IN_HOUSE', subconVendorCode: null }),
      );
    });

    it('uses PROCESS_MASTERS name when updating a routing process code', async () => {
      const existing = { routingCode: 'RG01', seq: 10, processCode: 'OLD', processName: 'Old' } as RoutingProcess;
      mockProcessRepo.findOne.mockResolvedValue(existing);
      mockProcessMasterRepo.findOne.mockResolvedValue({
        processCode: 'P02',
        processName: 'Master Process 2',
        processType: 'INSP',
      } as ProcessMaster);
      mockProcessRepo.update.mockResolvedValue({ affected: 1 } as any);

      await target.updateProcess(
        'RG01',
        10,
        { processCode: 'P02', processName: 'Spoofed Name' } as any,
        'C1',
        'P1',
      );

      expect(mockProcessMasterRepo.findOne).toHaveBeenCalledWith({
        where: { processCode: 'P02', useYn: 'Y', company: 'C1', plant: 'P1' },
      });
      expect(mockProcessRepo.update).toHaveBeenCalledWith(
        { routingCode: 'RG01', seq: 10, company: 'C1', plant: 'P1' },
        expect.objectContaining({
          processCode: 'P02',
          processName: 'Master Process 2',
          processType: 'INSP',
        }),
      );
    });

    it('should throw NotFoundException when process not found', async () => {
      // Arrange
      mockProcessRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.updateProcess('RG01', 10, {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteProcess', () => {
    it('should delete process and its conditions in transaction', async () => {
      // Arrange
      const existing = { routingCode: 'RG01', seq: 10 } as RoutingProcess;
      mockProcessRepo.findOne.mockResolvedValue(existing);
      mockEntityManager.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.deleteProcess('RG01', 10);

      // Assert
      expect(result).toEqual({ routingCode: 'RG01', seq: 10 });
      expect(mockEntityManager.delete).toHaveBeenCalledTimes(3);
    });
  });

  // ─── Condition CRUD ───

  describe('findConditions', () => {
    it('should return conditions ordered by conditionSeq', async () => {
      // Arrange
      const conditions = [{ routingCode: 'RG01', seq: 10, conditionSeq: 1 }] as ProcessQualityCondition[];
      mockConditionRepo.find.mockResolvedValue(conditions);

      // Act
      const result = await target.findConditions('RG01', 10, 'C1', 'P1');

      // Assert
      expect(result).toEqual(conditions);
      expect(mockConditionRepo.find).toHaveBeenCalledWith({
        where: { routingCode: 'RG01', seq: 10, company: 'C1', plant: 'P1' },
        order: { conditionSeq: 'ASC' },
      });
    });
  });

  describe('bulkSaveConditions', () => {
    it('should delete existing and save new conditions in transaction', async () => {
      // Arrange
      const dto = {
        conditions: [
          { conditionSeq: 1, conditionCode: 'TEMP', minValue: 10, maxValue: 50 },
        ],
      } as any;
      const created = { routingCode: 'RG01', seq: 10, conditionSeq: 1 } as ProcessQualityCondition;
      mockProcessRepo.findOne.mockResolvedValue({
        routingCode: 'RG01',
        seq: 10,
        company: 'COMP01',
        plant: 'PLANT01',
      } as RoutingProcess);
      mockEntityManager.delete.mockResolvedValue({ affected: 0 } as any);
      (mockEntityManager.create as jest.Mock).mockReturnValue(created);
      mockEntityManager.save.mockResolvedValue([created]);

      // Act
      const result = await target.bulkSaveConditions('RG01', 10, dto);

      // Assert
      expect(mockTx.run).toHaveBeenCalled();
      expect(mockEntityManager.delete).toHaveBeenCalledWith(ProcessQualityCondition, {
        routingCode: 'RG01',
        seq: 10,
        company: 'COMP01',
        plant: 'PLANT01',
      });
      expect(mockEntityManager.create).toHaveBeenCalledWith(
        ProcessQualityCondition,
        expect.objectContaining({ company: 'COMP01', plant: 'PLANT01' }),
      );
    });

    it('should return empty array when no conditions provided', async () => {
      // Arrange
      const dto = { conditions: [] } as any;
      mockProcessRepo.findOne.mockResolvedValue({
        routingCode: 'RG01',
        seq: 10,
        company: 'COMP01',
        plant: 'PLANT01',
      } as RoutingProcess);
      mockEntityManager.delete.mockResolvedValue({ affected: 0 } as any);

      // Act
      const result = await target.bulkSaveConditions('RG01', 10, dto);

      // Assert
      expect(result).toEqual([]);
    });

    it('should throw when request tenant differs from routing process tenant', async () => {
      const dto = { conditions: [{ conditionSeq: 1, conditionCode: 'TEMP' }] } as any;
      mockProcessRepo.findOne.mockResolvedValue({
        routingCode: 'RG01',
        seq: 10,
        company: 'COMP01',
        plant: 'PLANT01',
      } as RoutingProcess);

      await expect(
        target.bulkSaveConditions('RG01', 10, dto, 'OTHER', 'PLANT01'),
      ).rejects.toThrow(ConflictException);
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('should throw when request tenant is present but routing process tenant is missing', async () => {
      const dto = { conditions: [{ conditionSeq: 1, conditionCode: 'TEMP' }] } as any;
      mockProcessRepo.findOne.mockResolvedValue({
        routingCode: 'RG01',
        seq: 10,
        company: null,
        plant: 'PLANT01',
      } as RoutingProcess);

      await expect(
        target.bulkSaveConditions('RG01', 10, dto, 'COMP01', 'PLANT01'),
      ).rejects.toThrow(ConflictException);
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('routing materials', () => {
    it('should return BOM candidates with allocated material state', async () => {
      const group = { routingCode: 'RG01', itemCode: 'FG01' } as RoutingGroup;
      mockGroupRepo.findOne.mockResolvedValue(group);
      mockBomRepo.find.mockResolvedValue([
        { parentItemCode: 'FG01', childItemCode: 'MAT01', qtyPer: 2, useYn: 'Y' },
      ] as BomMaster[]);
      mockMaterialRepo.find.mockResolvedValue([
        { routingCode: 'RG01', seq: 10, childItemCode: 'MAT01', allocQty: 1, issueMethod: 'BACKFLUSH', useYn: 'Y' },
      ] as RoutingMaterial[]);
      mockPartRepo.find.mockResolvedValue([
        { itemCode: 'MAT01', itemName: 'Wire', itemNo: 'W-01', itemType: 'RAW_MATERIAL', unit: 'EA' },
      ] as ItemMaster[]);

      const result = await target.findMaterials('RG01', 10, 'C1', 'P1');

      expect(result).toEqual([
        expect.objectContaining({
          childItemCode: 'MAT01',
          childItemName: 'Wire',
          qtyPer: 2,
          selected: true,
          allocQty: 1,
          issueMethod: 'BACKFLUSH',
        }),
      ]);
      expect(mockBomRepo.find).toHaveBeenCalledWith({
        where: { parentItemCode: 'FG01', useYn: 'Y', company: 'C1', plant: 'P1' },
        order: { seq: 'ASC' },
      });
      expect(mockMaterialRepo.find).toHaveBeenCalledWith({
        where: { routingCode: 'RG01', seq: 10, useYn: 'Y', company: 'C1', plant: 'P1' },
      });
      expect(mockPartRepo.find).toHaveBeenCalledWith({
        where: { itemCode: expect.anything(), company: 'C1', plant: 'P1' },
        select: ['itemCode', 'itemName', 'itemNo', 'itemType', 'unit'],
      });
    });

    it('should bind each circuit option tenant placeholder occurrence separately', async () => {
      mockGroupRepo.findOne.mockResolvedValue({ routingCode: 'RG01', itemCode: 'FG01' } as RoutingGroup);
      mockBomRepo.find.mockResolvedValue([
        { parentItemCode: 'FG01', childItemCode: 'MAT01', qtyPer: 1, useYn: 'Y' },
        { parentItemCode: 'FG01', childItemCode: 'MAT02', qtyPer: 1, useYn: 'Y' },
      ] as BomMaster[]);
      mockMaterialRepo.find.mockResolvedValue([]);
      mockPartRepo.find.mockResolvedValue([]);
      mockCircuitRepo.query.mockResolvedValue([]);

      await target.findMaterials('RG01', 10, 'C1', 'P1');

      const [sql, params] = mockCircuitRepo.query.mock.calls[0] as [string, string[]];
      const placeholderOccurrences = [...sql.matchAll(/:\d+/g)].length;

      expect(placeholderOccurrences).toBe(params.length);
      expect(params).toEqual([
        'FG01',
        'C1',
        'C1',
        'C1',
        'P1',
        'P1',
        'P1',
        'MAT01',
        'MAT02',
      ]);
    });

    it('should reject material that is not in BOM for routing item', async () => {
      mockGroupRepo.findOne.mockResolvedValue({ routingCode: 'RG01', itemCode: 'FG01' } as RoutingGroup);
      mockProcessRepo.findOne.mockResolvedValue({ routingCode: 'RG01', seq: 10, company: 'COMP01', plant: 'PLANT01' } as RoutingProcess);
      mockBomRepo.find.mockResolvedValue([
        { parentItemCode: 'FG01', childItemCode: 'MAT01', useYn: 'Y' },
      ] as BomMaster[]);

      await expect(target.bulkSaveMaterials('RG01', 10, {
        materials: [{ childItemCode: 'MAT99', allocQty: 1, issueMethod: 'BACKFLUSH' }],
      } as any)).rejects.toThrow();
    });

    it('should save selected materials with process tenant fallback', async () => {
      mockGroupRepo.findOne.mockResolvedValue({ routingCode: 'RG01', itemCode: 'FG01' } as RoutingGroup);
      mockProcessRepo.findOne.mockResolvedValue({ routingCode: 'RG01', seq: 10, company: 'COMP01', plant: 'PLANT01' } as RoutingProcess);
      mockBomRepo.find.mockResolvedValue([
        { parentItemCode: 'FG01', childItemCode: 'MAT01', useYn: 'Y' },
      ] as BomMaster[]);
      mockEntityManager.delete.mockResolvedValue({ affected: 0 } as any);
      mockEntityManager.create.mockImplementation((_entity, value) => value);
      mockEntityManager.save.mockImplementation(async (_entity, value) => value);

      await target.bulkSaveMaterials('RG01', 10, {
        materials: [{ childItemCode: 'MAT01', allocQty: 1, issueMethod: 'BACKFLUSH' }],
      } as any);

      expect(mockEntityManager.delete).toHaveBeenCalledWith(RoutingMaterial, {
        routingCode: 'RG01',
        seq: 10,
        company: 'COMP01',
        plant: 'PLANT01',
      });
      expect(mockEntityManager.create).toHaveBeenCalledWith(
        RoutingMaterial,
        expect.objectContaining({ childItemCode: 'MAT01', company: 'COMP01', plant: 'PLANT01' }),
      );
    });
  });

  // ─── findByItemCode ───
  describe('findByItemCode', () => {
    it('should return group with processes when found', async () => {
      // Arrange
      const group = { routingCode: 'RG01', itemCode: 'ITEM01' } as RoutingGroup;
      const processes = [{ routingCode: 'RG01', seq: 10 }] as RoutingProcess[];
      mockGroupRepo.findOne.mockResolvedValue(group);
      mockProcessRepo.find.mockResolvedValue(processes);

      // Act
      const result = await target.findByItemCode('ITEM01', 'C1', 'P1');

      // Assert
      expect(result).toEqual({ ...group, processes });
      expect(mockGroupRepo.findOne).toHaveBeenCalledWith({
        where: { itemCode: 'ITEM01', useYn: 'Y', company: 'C1', plant: 'P1' },
      });
      expect(mockProcessRepo.find).toHaveBeenCalledWith({
        where: { routingCode: 'RG01', company: 'C1', plant: 'P1' },
        order: { seq: 'ASC' },
      });
    });

    it('should return null when no group found', async () => {
      // Arrange
      mockGroupRepo.findOne.mockResolvedValue(null);

      // Act
      const result = await target.findByItemCode('ITEM99');

      // Assert
      expect(result).toBeNull();
    });
  });
});
