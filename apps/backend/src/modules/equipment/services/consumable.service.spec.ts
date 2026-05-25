/**
 * @file consumable.service.spec.ts
 * @description ConsumableService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { ConsumableService } from './consumable.service';
import { ConsumableMaster } from '../../../entities/consumable-master.entity';
import { ConsumableLog } from '../../../entities/consumable-log.entity';
import { ConsumableMountLog } from '../../../entities/consumable-mount-log.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { User } from '../../../entities/user.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('ConsumableService', () => {
  let target: ConsumableService;
  let mockConsumableRepo: DeepMocked<Repository<ConsumableMaster>>;
  let mockLogRepo: DeepMocked<Repository<ConsumableLog>>;
  let mockMountLogRepo: DeepMocked<Repository<ConsumableMountLog>>;
  let mockUserRepo: DeepMocked<Repository<User>>;
  let mockEquipRepo: DeepMocked<Repository<EquipMaster>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockTx: DeepMocked<TransactionService>;
  let mockQr: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockConsumableRepo = createMock<Repository<ConsumableMaster>>();
    mockLogRepo = createMock<Repository<ConsumableLog>>();
    mockMountLogRepo = createMock<Repository<ConsumableMountLog>>();
    mockUserRepo = createMock<Repository<User>>();
    mockEquipRepo = createMock<Repository<EquipMaster>>();
    mockDataSource = createMock<DataSource>();
    mockTx = createMock<TransactionService>();
    mockDataSource.manager = { query: jest.fn().mockResolvedValue([{ nextSeq: 1 }]) } as any;
    mockQr = createMock<QueryRunner>();
    mockDataSource.createQueryRunner.mockReturnValue(mockQr);
    mockTx.run.mockImplementation(async (callback) => callback(mockQr));
    mockQr.connect.mockResolvedValue(undefined);
    mockQr.startTransaction.mockResolvedValue(undefined);
    mockQr.commitTransaction.mockResolvedValue(undefined);
    mockQr.rollbackTransaction.mockResolvedValue(undefined);
    mockQr.release.mockResolvedValue(undefined);
    mockQr.manager = { query: jest.fn().mockResolvedValue([{ nextSeq: 1 }]), update: jest.fn(), save: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsumableService,
        { provide: getRepositoryToken(ConsumableMaster), useValue: mockConsumableRepo },
        { provide: getRepositoryToken(ConsumableLog), useValue: mockLogRepo },
        { provide: getRepositoryToken(ConsumableMountLog), useValue: mockMountLogRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(EquipMaster), useValue: mockEquipRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<ConsumableService>(ConsumableService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findById', () => {
    it('should return consumable with logs', async () => {
      mockConsumableRepo.findOne.mockResolvedValue({ consumableCode: 'C-001', company: 'COMP', plant: 'PLANT' } as any);
      const qb: any = { where: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), take: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([]) };
      mockLogRepo.createQueryBuilder.mockReturnValue(qb);
      const r = await target.findById('C-001');
      expect(r.consumableCode).toBe('C-001');
    });

    it('should scope detail lookup by tenant', async () => {
      mockConsumableRepo.findOne.mockResolvedValue({ consumableCode: 'C-001', company: 'COMP', plant: 'PLANT' } as any);
      const qb: any = { where: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), take: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([]) };
      mockLogRepo.createQueryBuilder.mockReturnValue(qb);

      await target.findById('C-001', 'COMP', 'PLANT');

      expect(mockConsumableRepo.findOne).toHaveBeenCalledWith({
        where: { consumableCode: 'C-001', company: 'COMP', plant: 'PLANT' },
      });
    });

    it('should throw NotFoundException', async () => {
      mockConsumableRepo.findOne.mockResolvedValue(null);
      await expect(target.findById('X')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create consumable', async () => {
      mockConsumableRepo.findOne.mockResolvedValue(null);
      const saved = { consumableCode: 'C-001' } as any;
      mockConsumableRepo.create.mockReturnValue(saved);
      mockConsumableRepo.save.mockResolvedValue(saved);
      const r = await target.create({ consumableCode: 'C-001', name: 'Test' } as any);
      expect(r.consumableCode).toBe('C-001');
    });

    it('should persist tenant columns from request context when creating consumable', async () => {
      mockConsumableRepo.findOne.mockResolvedValue(null);
      const saved = { consumableCode: 'C-001' } as any;
      mockConsumableRepo.create.mockReturnValue(saved);
      mockConsumableRepo.save.mockResolvedValue(saved);

      await target.create({ consumableCode: 'C-001', name: 'Test' } as any, 'COMP', 'PLANT');

      expect(mockConsumableRepo.findOne).toHaveBeenCalledWith({
        where: { consumableCode: 'C-001', company: 'COMP', plant: 'PLANT' },
      });
      expect(mockConsumableRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ company: 'COMP', plant: 'PLANT' }),
      );
    });

    it('should throw ConflictException', async () => {
      mockConsumableRepo.findOne.mockResolvedValue({ consumableCode: 'C-001' } as any);
      await expect(target.create({ consumableCode: 'C-001' } as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('update/delete tenant scope', () => {
    const mockRecentLogs = () => {
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockLogRepo.createQueryBuilder.mockReturnValue(qb);
    };

    it('should update only the tenant-scoped consumable', async () => {
      mockRecentLogs();
      mockConsumableRepo.findOne.mockResolvedValue({
        consumableCode: 'C-001',
        currentCount: 0,
        company: 'COMP',
        plant: 'PLANT',
      } as any);
      mockConsumableRepo.update.mockResolvedValue({ affected: 1 } as any);

      await target.update('C-001', { name: 'Updated' } as any, 'COMP', 'PLANT');

      expect(mockConsumableRepo.update).toHaveBeenCalledWith(
        { consumableCode: 'C-001', company: 'COMP', plant: 'PLANT' },
        expect.objectContaining({ consumableName: 'Updated' }),
      );
    });

    it('should delete only the tenant-scoped consumable', async () => {
      mockRecentLogs();
      mockConsumableRepo.findOne.mockResolvedValue({
        consumableCode: 'C-001',
        company: 'COMP',
        plant: 'PLANT',
      } as any);
      mockConsumableRepo.delete.mockResolvedValue({ affected: 1 } as any);

      await target.delete('C-001', 'COMP', 'PLANT');

      expect(mockConsumableRepo.delete).toHaveBeenCalledWith({
        consumableCode: 'C-001',
        company: 'COMP',
        plant: 'PLANT',
      });
    });
  });

  describe('transactional workflows', () => {
    const mockRecentLogs = () => {
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockLogRepo.createQueryBuilder.mockReturnValue(qb);
    };

    it('registerReplacement uses TransactionService', async () => {
      mockRecentLogs();
      mockConsumableRepo.findOne.mockResolvedValue({
        consumableCode: 'C-001',
        currentCount: 100,
      } as any);

      const result = await target.registerReplacement('C-001', { workerId: 'u1' } as any);

      expect(result.consumableCode).toBe('C-001');
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQr.commitTransaction).not.toHaveBeenCalled();
      expect(mockQr.release).not.toHaveBeenCalled();
    });

    it('registerReplacement should reject when consumable tenant differs from request tenant', async () => {
      mockRecentLogs();
      mockConsumableRepo.findOne.mockResolvedValue({
        consumableCode: 'C-001',
        currentCount: 100,
        company: 'OTHER',
        plant: 'PLANT',
      } as any);

      await expect(
        target.registerReplacement('C-001', { workerId: 'u1' } as any, 'COMP', 'PLANT'),
      ).rejects.toThrow(BadRequestException);
      expect(mockTx.run).not.toHaveBeenCalled();
    });

    it('increaseCount should update only the tenant-scoped consumable', async () => {
      mockRecentLogs();
      mockConsumableRepo.findOne.mockResolvedValue({
        consumableCode: 'C-001',
        currentCount: 5,
        status: 'NORMAL',
        company: 'COMP',
        plant: 'PLANT',
      } as any);
      mockConsumableRepo.update.mockResolvedValue({ affected: 1 } as any);

      await target.increaseCount('C-001', { count: 3 } as any, 'COMP', 'PLANT');

      expect(mockConsumableRepo.update).toHaveBeenCalledWith(
        { consumableCode: 'C-001', company: 'COMP', plant: 'PLANT' },
        { currentCount: 8 },
      );
    });

    it('findWarningConsumables should return only tenant-scoped rows', async () => {
      mockConsumableRepo.find.mockResolvedValue([]);

      await target.findWarningConsumables('COMP', 'PLANT');

      expect(mockConsumableRepo.find).toHaveBeenCalledWith({
        where: {
          status: expect.anything(),
          useYn: 'Y',
          company: 'COMP',
          plant: 'PLANT',
        },
        order: { status: 'DESC' },
      });
    });

    it('updateWarningStatus should interlock only the tenant-scoped mounted equipment', async () => {
      mockConsumableRepo.findOne.mockResolvedValue({
        consumableCode: 'C-001',
        currentCount: 100,
        expectedLife: 100,
        warningCount: 80,
        status: 'WARNING',
        mountedEquipCode: 'EQ-1',
      } as any);
      mockConsumableRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockEquipRepo.update.mockResolvedValue({ affected: 1 } as any);

      await target.updateWarningStatus('C-001', 'COMP', 'PLANT');

      expect(mockEquipRepo.update).toHaveBeenCalledWith(
        { equipCode: 'EQ-1', company: 'COMP', plant: 'PLANT' },
        { status: 'INTERLOCK' },
      );
    });

    it('mountToEquip uses TransactionService', async () => {
      mockRecentLogs();
      mockConsumableRepo.findOne.mockResolvedValue({
        consumableCode: 'C-001',
        operStatus: 'WAREHOUSE',
        company: 'CO',
        plant: 'P01',
      } as any);

      await target.mountToEquip('C-001', { equipCode: 'EQ-1', workerId: 'u1' } as any);

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQr.commitTransaction).not.toHaveBeenCalled();
      expect(mockQr.release).not.toHaveBeenCalled();
    });

    it('mountToEquip should reject when consumable tenant differs from request tenant', async () => {
      mockConsumableRepo.findOne.mockResolvedValue({
        consumableCode: 'C-001',
        operStatus: 'WAREHOUSE',
        company: 'CO',
        plant: 'OTHER',
      } as any);

      await expect(
        target.mountToEquip('C-001', { equipCode: 'EQ-1', workerId: 'u1' } as any, 'CO', 'P01'),
      ).rejects.toThrow(BadRequestException);
      expect(mockTx.run).not.toHaveBeenCalled();
    });

    it('unmountFromEquip uses TransactionService', async () => {
      mockRecentLogs();
      mockConsumableRepo.findOne.mockResolvedValue({
        consumableCode: 'C-001',
        operStatus: 'MOUNTED',
        mountedEquipCode: 'EQ-1',
        company: 'CO',
        plant: 'P01',
      } as any);

      await target.unmountFromEquip('C-001', { workerId: 'u1' } as any);

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQr.commitTransaction).not.toHaveBeenCalled();
      expect(mockQr.release).not.toHaveBeenCalled();
    });

    it('setRepairStatus uses TransactionService', async () => {
      mockRecentLogs();
      mockConsumableRepo.findOne.mockResolvedValue({
        consumableCode: 'C-001',
        operStatus: 'MOUNTED',
        mountedEquipCode: 'EQ-1',
        company: 'CO',
        plant: 'P01',
      } as any);

      await target.setRepairStatus('C-001', { workerId: 'u1' } as any);

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQr.commitTransaction).not.toHaveBeenCalled();
      expect(mockQr.release).not.toHaveBeenCalled();
    });

    it('createLog should reject when consumable tenant differs from request tenant', async () => {
      mockRecentLogs();
      mockConsumableRepo.findOne.mockResolvedValue({
        consumableCode: 'C-001',
        company: 'OTHER',
        plant: 'PLANT',
      } as any);

      await expect(
        target.createLog({ consumableId: 'C-001', logType: 'IN' } as any, 'COMP', 'PLANT'),
      ).rejects.toThrow(BadRequestException);
      expect(mockLogRepo.create).not.toHaveBeenCalled();
      expect(mockLogRepo.save).not.toHaveBeenCalled();
    });
  });
});
