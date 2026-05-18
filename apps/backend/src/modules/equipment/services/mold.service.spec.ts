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
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('MoldService', () => {
  let target: MoldService;
  let mockMoldRepo: DeepMocked<Repository<MoldMaster>>;
  let mockUsageRepo: DeepMocked<Repository<MoldUsageLog>>;
  let mockEquipRepo: DeepMocked<Repository<EquipMaster>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockManager: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    getRepository: jest.Mock;
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

    mockManager = {
      findOne: jest.fn(),
      create: jest.fn((_: unknown, payload: unknown) => payload),
      save: jest.fn(),
      update: jest.fn(),
      getRepository: jest.fn(() => mockUsageRepo),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MoldService,
        { provide: getRepositoryToken(MoldMaster), useValue: mockMoldRepo },
        { provide: getRepositoryToken(MoldUsageLog), useValue: mockUsageRepo },
        { provide: getRepositoryToken(EquipMaster), useValue: mockEquipRepo },
        { provide: DataSource, useValue: mockDataSource },
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
      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ maxSeq: 3 }),
      };
      mockUsageRepo.createQueryBuilder.mockReturnValue(qb as any);
      mockManager.save.mockImplementation(async (_entity: unknown, payload: any) => payload);

      const r = await target.addUsage('M-001', { shotCount: 50 } as any, 'CO', 'P01', 'user');

      expect(r.shotCount).toBe(50);
      expect(mockManager.save).toHaveBeenCalledTimes(2);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should throw when not ACTIVE', async () => {
      mockManager.findOne.mockResolvedValue({ moldCode: 'M-001', status: 'RETIRED' } as any);

      await expect(target.addUsage('M-001', { shotCount: 10 } as any, 'CO', 'P01', 'user')).rejects.toThrow(BadRequestException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should throw NotFoundException for cross-tenant/not-found mold', async () => {
      mockManager.findOne.mockResolvedValue(null);

      await expect(target.addUsage('M-001', { shotCount: 10 } as any, 'CO', 'P01', 'user')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should set INTERLOCK with tenant scope when guaranteed shots exceeded', async () => {
      const mold = {
        moldCode: 'M-001',
        status: 'ACTIVE',
        currentShots: 90,
        guaranteedShots: 100,
      } as any;
      mockManager.findOne.mockResolvedValue(mold);
      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ maxSeq: 1 }),
      };
      mockUsageRepo.createQueryBuilder.mockReturnValue(qb as any);
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
      mockDataSource.createQueryRunner
        .mockReturnValueOnce(runner1 as any)
        .mockReturnValueOnce(runner2 as any);

      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ maxSeq: 10 }),
      };
      mockUsageRepo.createQueryBuilder.mockReturnValue(qb as any);

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

      expect(mockDataSource.createQueryRunner).toHaveBeenCalledTimes(2);
      expect(runner1.commitTransaction).toHaveBeenCalled();
      expect(runner2.commitTransaction).toHaveBeenCalled();
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
