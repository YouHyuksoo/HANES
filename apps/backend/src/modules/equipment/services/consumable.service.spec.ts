/**
 * @file consumable.service.spec.ts
 * @description ConsumableService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { ConsumableService } from './consumable.service';
import { ConsumableMaster } from '../../../entities/consumable-master.entity';
import { ConsumableLog } from '../../../entities/consumable-log.entity';
import { ConsumableMountLog } from '../../../entities/consumable-mount-log.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { User } from '../../../entities/user.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('ConsumableService', () => {
  let target: ConsumableService;
  let mockConsumableRepo: DeepMocked<Repository<ConsumableMaster>>;
  let mockLogRepo: DeepMocked<Repository<ConsumableLog>>;
  let mockMountLogRepo: DeepMocked<Repository<ConsumableMountLog>>;
  let mockUserRepo: DeepMocked<Repository<User>>;
  let mockEquipRepo: DeepMocked<Repository<EquipMaster>>;
  let mockDataSource: DeepMocked<DataSource>;

  beforeEach(async () => {
    mockConsumableRepo = createMock<Repository<ConsumableMaster>>();
    mockLogRepo = createMock<Repository<ConsumableLog>>();
    mockMountLogRepo = createMock<Repository<ConsumableMountLog>>();
    mockUserRepo = createMock<Repository<User>>();
    mockEquipRepo = createMock<Repository<EquipMaster>>();
    mockDataSource = createMock<DataSource>();
    mockDataSource.manager = { query: jest.fn().mockResolvedValue([{ nextSeq: 1 }]) } as any;
    const mockQr = createMock<QueryRunner>();
    mockDataSource.createQueryRunner.mockReturnValue(mockQr);
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
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<ConsumableService>(ConsumableService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findById', () => {
    it('should return consumable with logs', async () => {
      mockConsumableRepo.findOne.mockResolvedValue({ consumableCode: 'C-001' } as any);
      const qb: any = { where: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), take: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([]) };
      mockLogRepo.createQueryBuilder.mockReturnValue(qb);
      const r = await target.findById('C-001');
      expect(r.consumableCode).toBe('C-001');
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
    it('should throw ConflictException', async () => {
      mockConsumableRepo.findOne.mockResolvedValue({ consumableCode: 'C-001' } as any);
      await expect(target.create({ consumableCode: 'C-001' } as any)).rejects.toThrow(ConflictException);
    });
  });
});
