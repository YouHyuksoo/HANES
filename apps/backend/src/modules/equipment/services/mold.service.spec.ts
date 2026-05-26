/**
 * @file mold.service.spec.ts
 * @description MoldService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { MoldService } from './mold.service';
import { MoldMaster } from '../../../entities/mold-master.entity';
import { MoldUsageLog } from '../../../entities/mold-usage-log.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('MoldService', () => {
  let target: MoldService;
  let mockMoldRepo: DeepMocked<Repository<MoldMaster>>;
  let mockUsageRepo: DeepMocked<Repository<MoldUsageLog>>;
  let mockEquipRepo: DeepMocked<Repository<EquipMaster>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockTx: DeepMocked<TransactionService>;
  let mockManager: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    getRepository: jest.Mock;
    query: jest.Mock;
  };
  let mockQueryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    manager: typeof mockManager;
  };

  beforeEach(async () => {
    mockMoldRepo = createMock<Repository<MoldMaster>>();
    mockUsageRepo = createMock<Repository<MoldUsageLog>>();
    mockEquipRepo = createMock<Repository<EquipMaster>>();
    mockDataSource = createMock<DataSource>();
    mockTx = createMock<TransactionService>();

    mockManager = {
      findOne: jest.fn(),
      create: jest.fn((_: unknown, payload: unknown) => payload),
      save: jest.fn(),
      update: jest.fn(),
      getRepository: jest.fn(() => mockUsageRepo),
      query: jest.fn().mockResolvedValue([{ nextSeq: 4 }]),
    };
    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: mockManager,
    };
    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner as any);
    mockTx.run.mockImplementation(async (callback) => callback(mockQueryRunner as any));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MoldService,
        { provide: getRepositoryToken(MoldMaster), useValue: mockMoldRepo },
        { provide: getRepositoryToken(MoldUsageLog), useValue: mockUsageRepo },
        { provide: getRepositoryToken(EquipMaster), useValue: mockEquipRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<MoldService>(MoldService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findById', () => {
    it('should return mold', async () => {
      mockMoldRepo.findOne.mockResolvedValue({ moldCode: 'M-001' } as any);
      expect((await target.findById('M-001')).moldCode).toBe('M-001');
    });

    it('should include tenant scope when provided', async () => {
      mockMoldRepo.findOne.mockResolvedValue({ moldCode: 'M-001' } as any);

      await target.findById('M-001', 'CO', 'P01');

      expect(mockMoldRepo.findOne).toHaveBeenCalledWith({
        where: { moldCode: 'M-001', company: 'CO', plant: 'P01' },
      });
    });

    it('should throw NotFoundException', async () => {
      mockMoldRepo.findOne.mockResolvedValue(null);
      await expect(target.findById('X')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should throw when SCRAPPED', async () => {
      mockMoldRepo.findOne.mockResolvedValue({ moldCode: 'M-001', status: 'SCRAPPED' } as any);
      await expect(target.update('M-001', {} as any, 'user')).rejects.toThrow(BadRequestException);
    });

    it('should block status change via generic update', async () => {
      mockMoldRepo.findOne.mockResolvedValue({ moldCode: 'M-001', status: 'ACTIVE' } as any);

      await expect(target.update('M-001', { status: 'RETIRED' } as any, 'user')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should keep tenant and mold key columns from the matched mold when update payload contains them', async () => {
      const mold = { moldCode: 'M-001', moldName: 'Old', status: 'ACTIVE', company: 'CO', plant: 'P01' } as MoldMaster;
      mockMoldRepo.findOne.mockResolvedValue(mold);
      mockMoldRepo.save.mockImplementation(async (value) => value as MoldMaster);

      const result = await target.update('M-001', {
        moldCode: 'M-999',
        moldName: 'New',
        company: 'OTHER',
        plant: 'P99',
      } as any, 'user', 'CO', 'P01');

      expect(result).toEqual(expect.objectContaining({
        moldCode: 'M-001',
        moldName: 'New',
        company: 'CO',
        plant: 'P01',
        updatedBy: 'user',
      }));
    });
  });

  describe('delete', () => {
    it('should throw when usage exists', async () => {
      mockMoldRepo.findOne.mockResolvedValue({ moldCode: 'M-001' } as any);
      mockUsageRepo.count.mockResolvedValue(5);
      await expect(target.delete('M-001')).rejects.toThrow(BadRequestException);
    });
  });

  describe('addUsage', () => {
    it('should add usage and increment shots', async () => {
      const mold = { moldCode: 'M-001', status: 'ACTIVE', currentShots: 100, guaranteedShots: null } as any;
      mockManager.findOne.mockResolvedValue(mold);
      mockManager.save.mockImplementation(async (_entity: unknown, payload: any) => payload);

      const r = await target.addUsage('M-001', { shotCount: 50 } as any, 'CO', 'P01', 'user');

      expect(r.shotCount).toBe(50);
      expect(mockManager.save).toHaveBeenCalledTimes(2);
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).not.toHaveBeenCalled();
    });

    it('should throw when not ACTIVE', async () => {
      mockManager.findOne.mockResolvedValue({ moldCode: 'M-001', status: 'RETIRED' } as any);

      await expect(target.addUsage('M-001', { shotCount: 10 } as any, 'CO', 'P01', 'user')).rejects.toThrow(BadRequestException);
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for cross-tenant/not-found mold', async () => {
      mockManager.findOne.mockResolvedValue(null);

      await expect(target.addUsage('M-001', { shotCount: 10 } as any, 'CO', 'P01', 'user')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).not.toHaveBeenCalled();
    });

    it('should set INTERLOCK with tenant scope when guaranteed shots exceeded', async () => {
      const mold = {
        moldCode: 'M-001',
        status: 'ACTIVE',
        currentShots: 90,
        guaranteedShots: 100,
      } as any;
      mockManager.findOne.mockResolvedValue(mold);
      mockManager.query.mockResolvedValueOnce([{ nextSeq: 2 }]);
      mockManager.save.mockImplementation(async (_entity: unknown, payload: any) => payload);

      await target.addUsage(
        'M-001',
        { shotCount: 20, equipCode: 'EQ-01', usageDate: '2026-04-12T00:00:00.000Z' } as any,
        'CO',
        'P01',
        'user',
      );

      expect(mockManager.update).toHaveBeenCalledWith(
        EquipMaster,
        { equipCode: 'EQ-01', company: 'CO', plant: 'P01' },
        { status: 'INTERLOCK' },
      );
    });

    it('should handle concurrent usage calls with isolated query runners', async () => {
      const sharedMold = {
        moldCode: 'M-001',
        status: 'ACTIVE',
        currentShots: 100,
        guaranteedShots: null,
      } as any;

      const makeRunner = () => {
        const manager = {
          findOne: jest.fn().mockResolvedValue(sharedMold),
          create: jest.fn((_: unknown, payload: unknown) => payload),
          save: jest.fn(async (_entity: unknown, payload: any) => payload),
          update: jest.fn(),
          getRepository: jest.fn(() => mockUsageRepo),
          query: jest.fn().mockResolvedValue([{ nextSeq: 11 }]),
        };

        return {
          connect: jest.fn(),
          startTransaction: jest.fn(),
          commitTransaction: jest.fn(),
          rollbackTransaction: jest.fn(),
          release: jest.fn(),
          manager,
        };
      };

      const runner1 = makeRunner();
      const runner2 = makeRunner();
      mockTx.run
        .mockImplementationOnce(async (callback) => callback(runner1 as any))
        .mockImplementationOnce(async (callback) => callback(runner2 as any));

      await Promise.all([
        target.addUsage(
          'M-001',
          { shotCount: 10, usageDate: '2026-04-12T00:00:00.000Z' } as any,
          'CO',
          'P01',
          'user',
        ),
        target.addUsage(
          'M-001',
          { shotCount: 20, usageDate: '2026-04-12T00:00:00.000Z' } as any,
          'CO',
          'P01',
          'user',
        ),
      ]);

      expect(mockTx.run).toHaveBeenCalledTimes(2);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(runner1.commitTransaction).not.toHaveBeenCalled();
      expect(runner2.commitTransaction).not.toHaveBeenCalled();
      expect(sharedMold.currentShots).toBe(130);
    });
  });

  describe('retire', () => {
    it('should retire active mold', async () => {
      const mold = { moldCode: 'M-001', status: 'ACTIVE' } as any;
      mockMoldRepo.findOne.mockResolvedValue(mold);
      mockMoldRepo.save.mockResolvedValue({ ...mold, status: 'RETIRED' });
      const r = await target.retire('M-001', 'user');
      expect(r.status).toBe('RETIRED');
    });

    it('should throw when status is not ACTIVE or MAINTENANCE', async () => {
      mockMoldRepo.findOne.mockResolvedValue({ moldCode: 'M-001', status: 'INACTIVE' } as any);

      await expect(target.retire('M-001', 'user')).rejects.toThrow(BadRequestException);
    });

    it('should throw for already retired', async () => {
      mockMoldRepo.findOne.mockResolvedValue({ moldCode: 'M-001', status: 'RETIRED' } as any);
      await expect(target.retire('M-001', 'user')).rejects.toThrow(BadRequestException);
    });
  });
});
