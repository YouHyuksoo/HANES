/**
 * @file mold.service.spec.ts
 * @description MoldService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
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

  beforeEach(async () => {
    mockMoldRepo = createMock<Repository<MoldMaster>>();
    mockUsageRepo = createMock<Repository<MoldUsageLog>>();
    mockEquipRepo = createMock<Repository<EquipMaster>>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MoldService,
        { provide: getRepositoryToken(MoldMaster), useValue: mockMoldRepo },
        { provide: getRepositoryToken(MoldUsageLog), useValue: mockUsageRepo },
        { provide: getRepositoryToken(EquipMaster), useValue: mockEquipRepo },
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
      mockMoldRepo.findOne.mockResolvedValue(mold);
      const usage = { shotCount: 50 } as any;
      mockUsageRepo.create.mockReturnValue(usage);
      mockUsageRepo.save.mockResolvedValue(usage);
      mockMoldRepo.save.mockResolvedValue({ ...mold, currentShots: 150 });
      const r = await target.addUsage('M-001', { shotCount: 50 } as any, 'CO', 'P01', 'user');
      expect(mockMoldRepo.save).toHaveBeenCalled();
    });
    it('should throw when not ACTIVE', async () => {
      mockMoldRepo.findOne.mockResolvedValue({ moldCode: 'M-001', status: 'RETIRED' } as any);
      await expect(target.addUsage('M-001', { shotCount: 10 } as any, 'CO', 'P01', 'user')).rejects.toThrow(BadRequestException);
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
    it('should throw for already retired', async () => {
      mockMoldRepo.findOne.mockResolvedValue({ moldCode: 'M-001', status: 'RETIRED' } as any);
      await expect(target.retire('M-001', 'user')).rejects.toThrow(BadRequestException);
    });
  });
});
