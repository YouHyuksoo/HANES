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
import { RoutingGroupService } from './routing-group.service';
import { RoutingGroup } from '../../../entities/routing-group.entity';
import { RoutingProcess } from '../../../entities/routing-process.entity';
import { ProcessQualityCondition } from '../../../entities/process-quality-condition.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('RoutingGroupService', () => {
  let target: RoutingGroupService;
  let mockGroupRepo: DeepMocked<Repository<RoutingGroup>>;
  let mockProcessRepo: DeepMocked<Repository<RoutingProcess>>;
  let mockConditionRepo: DeepMocked<Repository<ProcessQualityCondition>>;
  let mockPartRepo: DeepMocked<Repository<PartMaster>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockEntityManager: DeepMocked<EntityManager>;

  beforeEach(async () => {
    mockGroupRepo = createMock<Repository<RoutingGroup>>();
    mockProcessRepo = createMock<Repository<RoutingProcess>>();
    mockConditionRepo = createMock<Repository<ProcessQualityCondition>>();
    mockPartRepo = createMock<Repository<PartMaster>>();
    mockDataSource = createMock<DataSource>();
    mockEntityManager = createMock<EntityManager>();

    // Transaction mock: execute callback with mockEntityManager
    mockDataSource.transaction.mockImplementation(async (cb: any) => {
      return cb(mockEntityManager);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutingGroupService,
        { provide: getRepositoryToken(RoutingGroup), useValue: mockGroupRepo },
        { provide: getRepositoryToken(RoutingProcess), useValue: mockProcessRepo },
        { provide: getRepositoryToken(ProcessQualityCondition), useValue: mockConditionRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<RoutingGroupService>(RoutingGroupService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Group CRUD ───

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
      const result = await target.updateGroup('RG01', { routingName: 'New' } as any);

      // Assert
      expect(mockGroupRepo.update).toHaveBeenCalled();
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
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockEntityManager.delete).toHaveBeenCalledTimes(3);
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
      const result = await target.findProcesses('RG01');

      // Assert
      expect(result).toEqual(processes);
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
      const result = await target.createProcess(dto);

      // Assert
      expect(result).toEqual(created);
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
      const result = await target.updateProcess('RG01', 10, { processCode: 'P02' } as any);

      // Assert
      expect(mockProcessRepo.update).toHaveBeenCalled();
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
      expect(mockEntityManager.delete).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Condition CRUD ───

  describe('findConditions', () => {
    it('should return conditions ordered by conditionSeq', async () => {
      // Arrange
      const conditions = [{ routingCode: 'RG01', seq: 10, conditionSeq: 1 }] as ProcessQualityCondition[];
      mockConditionRepo.find.mockResolvedValue(conditions);

      // Act
      const result = await target.findConditions('RG01', 10);

      // Assert
      expect(result).toEqual(conditions);
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
      mockEntityManager.delete.mockResolvedValue({ affected: 0 } as any);
      mockEntityManager.create.mockReturnValue(created);
      mockEntityManager.save.mockResolvedValue([created]);

      // Act
      const result = await target.bulkSaveConditions('RG01', 10, dto);

      // Assert
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('should return empty array when no conditions provided', async () => {
      // Arrange
      const dto = { conditions: [] } as any;
      mockEntityManager.delete.mockResolvedValue({ affected: 0 } as any);

      // Act
      const result = await target.bulkSaveConditions('RG01', 10, dto);

      // Assert
      expect(result).toEqual([]);
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
      const result = await target.findByItemCode('ITEM01');

      // Assert
      expect(result).toEqual({ ...group, processes });
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
