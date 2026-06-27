/**
 * @file src/modules/consumables/services/consumables.service.spec.ts
 * @description ConsumablesService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "ConsumablesService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { ConsumablesService } from './consumables.service';
import { ConsumableMaster } from '../../../entities/consumable-master.entity';
import { ConsumableLog } from '../../../entities/consumable-log.entity';
import { ConsumableUsageMap } from '../../../entities/consumable-usage-map.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('ConsumablesService', () => {
  let target: ConsumablesService;
  let mockMasterRepo: DeepMocked<Repository<ConsumableMaster>>;
  let mockLogRepo: DeepMocked<Repository<ConsumableLog>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockTx: DeepMocked<TransactionService>;

  beforeEach(async () => {
    mockMasterRepo = createMock<Repository<ConsumableMaster>>();
    mockLogRepo = createMock<Repository<ConsumableLog>>();
    mockDataSource = createMock<DataSource>();
    mockTx = createMock<TransactionService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsumablesService,
        { provide: getRepositoryToken(ConsumableMaster), useValue: mockMasterRepo },
        { provide: getRepositoryToken(ConsumableLog), useValue: mockLogRepo },
        { provide: getRepositoryToken(ConsumableUsageMap), useValue: createMock<Repository<ConsumableUsageMap>>() },
        { provide: getRepositoryToken(ItemMaster), useValue: createMock<Repository<ItemMaster>>() },
        { provide: getRepositoryToken(EquipMaster), useValue: createMock<Repository<EquipMaster>>() },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<ConsumablesService>(ConsumablesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findById ───
  describe('findById', () => {
    it('should return consumable when found', async () => {
      // Arrange
      const item = { consumableCode: 'C001' } as ConsumableMaster;
      mockMasterRepo.findOne.mockResolvedValue(item);

      // Act
      const result = await target.findById('C001');

      // Assert
      expect(result).toEqual(item);
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockMasterRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findById('NONE')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ───
  describe('create', () => {
    it('should create a new consumable', async () => {
      // Arrange
      const dto = { consumableCode: 'C001', consumableName: 'Test' } as any;
      mockMasterRepo.findOne.mockResolvedValue(null);
      mockMasterRepo.create.mockReturnValue({ ...dto, stockQty: 0, currentCount: 0, status: 'NORMAL' } as ConsumableMaster);
      mockMasterRepo.save.mockResolvedValue({ ...dto, stockQty: 0 } as ConsumableMaster);

      // Act
      const result = await target.create(dto);

      // Assert
      expect(result.consumableCode).toBe('C001');
    });

    it('should throw ConflictException when code exists', async () => {
      // Arrange
      mockMasterRepo.findOne.mockResolvedValue({ consumableCode: 'C001' } as ConsumableMaster);

      // Act & Assert
      await expect(target.create({ consumableCode: 'C001' } as any)).rejects.toThrow(ConflictException);
    });
  });

  // ─── update ───
  describe('update', () => {
    it('should update consumable', async () => {
      // Arrange
      const item = { consumableCode: 'C001' } as ConsumableMaster;
      mockMasterRepo.findOne.mockResolvedValue(item);
      mockMasterRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.update('C001', { consumableName: 'Updated' } as any);

      // Assert
      expect(result).toEqual(item);
    });

    it('should ignore consumableCode from update body and keep URL id as the only key source', async () => {
      // Arrange
      const item = { consumableCode: 'C001' } as ConsumableMaster;
      mockMasterRepo.findOne.mockResolvedValue(item);
      mockMasterRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      await target.update('C001', { consumableCode: 'C002', consumableName: 'Updated' } as any, 'COMP', 'PLANT');

      // Assert
      expect(mockMasterRepo.update).toHaveBeenCalledWith(
        { consumableCode: 'C001', company: 'COMP', plant: 'PLANT' },
        expect.not.objectContaining({ consumableCode: expect.anything() }),
      );
    });

    it('should not run duplicate lookup for consumableCode in update body', async () => {
      // Arrange
      const existing = { consumableCode: 'C001' } as ConsumableMaster;
      mockMasterRepo.findOne.mockResolvedValue(existing);
      mockMasterRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      await target.update('C001', { consumableCode: 'C002' } as any);

      // Assert
      expect(mockMasterRepo.findOne).toHaveBeenCalledTimes(2);
    });
  });

  // ─── delete ───
  describe('delete', () => {
    it('should delete consumable', async () => {
      // Arrange
      mockMasterRepo.findOne.mockResolvedValue({ consumableCode: 'C001' } as ConsumableMaster);
      mockMasterRepo.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.delete('C001');

      // Assert
      expect(result).toEqual({ id: 'C001', deleted: true });
    });
  });

  // ─── remove (alias) ───
  describe('remove', () => {
    it('should call delete', async () => {
      // Arrange
      mockMasterRepo.findOne.mockResolvedValue({ consumableCode: 'C001' } as ConsumableMaster);
      mockMasterRepo.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.remove('C001');

      // Assert
      expect(result).toEqual({ id: 'C001', deleted: true });
    });
  });

  // ─── getSummary ───
  describe('getSummary', () => {
    it('should return summary counts', async () => {
      // Arrange
      mockMasterRepo.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(2) // warning
        .mockResolvedValueOnce(1); // replace

      // Act
      const result = await target.getSummary();

      // Assert
      expect(result).toEqual({ total: 10, warning: 2, replace: 1 });
    });
  });

  // ─── getWarningList ───
  describe('getWarningList', () => {
    it('should return warning/replace items', async () => {
      // Arrange
      const items = [{ consumableCode: 'C001', status: 'WARNING' }] as ConsumableMaster[];
      mockMasterRepo.find.mockResolvedValue(items);

      // Act
      const result = await target.getWarningList();

      // Assert
      expect(result).toEqual(items);
    });
  });

  // ─── getLifeStatus ───
  describe('getLifeStatus', () => {
    it('should return life status rows for the life status grid', async () => {
      // Arrange
      const items = [
        { consumableCode: 'C001', status: 'NORMAL' },
        { consumableCode: 'C002', status: 'NORMAL' },
        { consumableCode: 'C003', status: 'WARNING' },
        { consumableCode: 'C004', status: 'REPLACE' },
      ] as ConsumableMaster[];
      mockMasterRepo.find.mockResolvedValue(items);

      // Act
      const result = await target.getLifeStatus();

      // Assert
      expect(result).toEqual(items);
      expect(mockMasterRepo.find).toHaveBeenCalledWith({
        where: { useYn: 'Y' },
        order: { status: 'DESC', currentCount: 'DESC', consumableCode: 'ASC' },
      });
    });
  });

  // ─── createLog ───
  describe('createLog', () => {
    it('should create log and update stock for IN type', async () => {
      // Arrange
      const mockQr = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          findOne: jest.fn().mockResolvedValue({ consumableCode: 'C001', stockQty: 10 } as ConsumableMaster),
          create: jest.fn().mockReturnValue({ consumableCode: 'C001', logType: 'IN', qty: 5 } as any),
          save: jest.fn().mockResolvedValue({ consumableCode: 'C001', logType: 'IN', qty: 5 } as any),
          update: jest.fn().mockResolvedValue({ affected: 1 } as any),
          query: jest.fn().mockResolvedValue([{ nextSeq: 1 }]),
        },
      };
      mockTx.run.mockImplementationOnce(async (callback) => callback(mockQr as any));

      // Act
      const result = await target.createLog({ consumableId: 'C001', logType: 'IN', qty: 5 } as any);

      // Assert
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQr.commitTransaction).not.toHaveBeenCalled();
    });

    it('should allocate CONSUMABLE_LOGS seq from Oracle sequence', async () => {
      const mockQr = {
        manager: {
          findOne: jest.fn().mockResolvedValue({ consumableCode: 'C001', stockQty: 10 } as ConsumableMaster),
          create: jest.fn().mockReturnValue({ consumableCode: 'C001', logType: 'IN', qty: 5 } as any),
          save: jest.fn().mockResolvedValue({ consumableCode: 'C001', logType: 'IN', qty: 5 } as any),
          update: jest.fn().mockResolvedValue({ affected: 1 } as any),
          query: jest.fn().mockResolvedValue([{ nextSeq: 1 }]),
        },
      };
      mockTx.run.mockImplementationOnce(async (callback) => callback(mockQr as any));

      await target.createLog({ consumableId: 'C001', logType: 'IN', qty: 5 } as any, 'COMP', 'PLANT');

      expect(mockQr.manager.query).toHaveBeenCalledWith(
        'SELECT SEQ_CONSUMABLE_LOGS.NEXTVAL AS "nextSeq" FROM DUAL',
      );
    });

    it('should throw BadRequestException when stock insufficient for OUT', async () => {
      // Arrange
      const mockQr = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          findOne: jest.fn().mockResolvedValue({ consumableCode: 'C001', stockQty: 0 } as ConsumableMaster),
          query: jest.fn().mockResolvedValue([{ nextSeq: 1 }]),
        },
      };
      mockTx.run.mockImplementationOnce(async (callback) => callback(mockQr as any));

      // Act & Assert
      await expect(
        target.createLog({ consumableId: 'C001', logType: 'OUT', qty: 5 } as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQr.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when consumable not found', async () => {
      // Arrange
      const mockQr = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          findOne: jest.fn().mockResolvedValue(null),
        },
      };
      mockTx.run.mockImplementationOnce(async (callback) => callback(mockQr as any));

      // Act & Assert
      await expect(
        target.createLog({ consumableId: 'NONE', logType: 'IN', qty: 1 } as any),
      ).rejects.toThrow(NotFoundException);
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQr.rollbackTransaction).not.toHaveBeenCalled();
    });
  });

  // ─── updateShotCount ───
  describe('updateShotCount', () => {
    it('should update shot count and change status to WARNING', async () => {
      // Arrange
      const mockQr = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          findOne: jest.fn().mockResolvedValue({
            consumableCode: 'C001',
            currentCount: 90,
            expectedLife: 100,
            warningCount: 95,
            status: 'NORMAL',
          } as ConsumableMaster),
          update: jest.fn().mockResolvedValue({ affected: 1 } as any),
          create: jest.fn().mockReturnValue({} as any),
          save: jest.fn().mockResolvedValue({} as any),
          query: jest.fn().mockResolvedValue([{ nextSeq: 1 }]),
        },
      };
      mockTx.run.mockImplementationOnce(async (callback) => callback(mockQr as any));

      // Act
      const result = await target.updateShotCount({
        consumableId: 'C001',
        addCount: 5,
      } as any);

      // Assert
      expect(result.currentCount).toBe(95);
      expect(result.currentStatus).toBe('WARNING');
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('should change status to REPLACE when exceeding expectedLife', async () => {
      // Arrange
      const mockQr = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          findOne: jest.fn().mockResolvedValue({
            consumableCode: 'C001',
            currentCount: 95,
            expectedLife: 100,
            warningCount: 90,
            status: 'WARNING',
          } as ConsumableMaster),
          update: jest.fn().mockResolvedValue({ affected: 1 } as any),
          create: jest.fn().mockReturnValue({} as any),
          save: jest.fn().mockResolvedValue({} as any),
          query: jest.fn().mockResolvedValue([{ nextSeq: 1 }]),
        },
      };
      mockTx.run.mockImplementationOnce(async (callback) => callback(mockQr as any));

      // Act
      const result = await target.updateShotCount({
        consumableId: 'C001',
        addCount: 10,
      } as any);

      // Assert
      expect(result.currentCount).toBe(105);
      expect(result.currentStatus).toBe('REPLACE');
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });
  });

  // ─── resetShotCount ───
  describe('resetShotCount', () => {
    it('should reset shot count and status to NORMAL', async () => {
      // Arrange
      const mockQr = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          findOne: jest.fn().mockResolvedValue({
            consumableCode: 'C001',
            currentCount: 100,
            expectedLife: 100,
            status: 'REPLACE',
          } as ConsumableMaster),
          update: jest.fn().mockResolvedValue({ affected: 1 } as any),
          create: jest.fn().mockReturnValue({} as any),
          save: jest.fn().mockResolvedValue({} as any),
          query: jest.fn().mockResolvedValue([{ nextSeq: 1 }]),
        },
      };
      mockTx.run.mockImplementationOnce(async (callback) => callback(mockQr as any));

      // Act
      const result = await target.resetShotCount({
        consumableId: 'C001',
      } as any);

      // Assert
      expect(result.currentCount).toBe(0);
      expect(result.currentStatus).toBe('NORMAL');
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });
  });

  // ─── findAll ───
  describe('findAll', () => {
    it('should return paginated results using query builder', async () => {
      // Arrange
      const qb = createMock<any>();
      qb.andWhere.mockReturnThis();
      qb.orderBy.mockReturnThis();
      qb.skip.mockReturnThis();
      qb.take.mockReturnThis();
      qb.clone.mockReturnValue(qb);
      qb.getMany.mockResolvedValue([{ consumableCode: 'C001' }]);
      qb.getCount.mockResolvedValue(1);
      mockMasterRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await target.findAll({ page: 1, limit: 10 } as any);

      // Assert
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });
  });
});
