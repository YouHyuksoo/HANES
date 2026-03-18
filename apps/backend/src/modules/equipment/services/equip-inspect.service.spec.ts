/**
 * @file equip-inspect.service.spec.ts
 * @description EquipInspectService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EquipInspectService } from './equip-inspect.service';
import { EquipInspectLog } from '../../../entities/equip-inspect-log.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { EquipInspectItemMaster } from '../../../entities/equip-inspect-item-master.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('EquipInspectService', () => {
  let target: EquipInspectService;
  let mockLogRepo: DeepMocked<Repository<EquipInspectLog>>;
  let mockEquipRepo: DeepMocked<Repository<EquipMaster>>;
  let mockItemRepo: DeepMocked<Repository<EquipInspectItemMaster>>;

  beforeEach(async () => {
    mockLogRepo = createMock<Repository<EquipInspectLog>>();
    mockEquipRepo = createMock<Repository<EquipMaster>>();
    mockItemRepo = createMock<Repository<EquipInspectItemMaster>>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipInspectService,
        { provide: getRepositoryToken(EquipInspectLog), useValue: mockLogRepo },
        { provide: getRepositoryToken(EquipMaster), useValue: mockEquipRepo },
        { provide: getRepositoryToken(EquipInspectItemMaster), useValue: mockItemRepo },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<EquipInspectService>(EquipInspectService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create inspect log', async () => {
      mockEquipRepo.findOne.mockResolvedValue({ equipCode: 'EQ-001', company: 'CO', plant: 'P01' } as any);
      const saved = { equipCode: 'EQ-001', overallResult: 'PASS' } as any;
      mockLogRepo.create.mockReturnValue(saved);
      mockLogRepo.save.mockResolvedValue(saved);
      const r = await target.create({ equipCode: 'EQ-001', inspectType: 'DAILY', inspectDate: '2026-03-18', overallResult: 'PASS' } as any);
      expect(r.overallResult).toBe('PASS');
    });
    it('should throw when equip not found', async () => {
      mockEquipRepo.findOne.mockResolvedValue(null);
      await expect(target.create({ equipCode: 'X' } as any)).rejects.toThrow(NotFoundException);
    });
    it('should set INTERLOCK on FAIL', async () => {
      mockEquipRepo.findOne.mockResolvedValue({ equipCode: 'EQ-001', company: 'CO', plant: 'P01' } as any);
      mockLogRepo.create.mockReturnValue({ overallResult: 'FAIL' } as any);
      mockLogRepo.save.mockResolvedValue({ equipCode: 'EQ-001', overallResult: 'FAIL' } as any);
      mockEquipRepo.update.mockResolvedValue({ affected: 1 } as any);
      await target.create({ equipCode: 'EQ-001', inspectType: 'DAILY', inspectDate: '2026-03-18', overallResult: 'FAIL' } as any);
      expect(mockEquipRepo.update).toHaveBeenCalledWith({ equipCode: 'EQ-001' }, { status: 'INTERLOCK' });
    });
  });
});
