import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EquipInspectItemPool } from '../../../entities/equip-inspect-item-pool.entity';
import { EquipInspectService } from './equip-inspect.service';
import { MockLoggerService } from '@test/mock-logger.service';

describe('EquipInspectService (master)', () => {
  let target: EquipInspectService;
  let mockRepo: DeepMocked<Repository<EquipInspectItemPool>>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<EquipInspectItemPool>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipInspectService,
        { provide: getRepositoryToken(EquipInspectItemPool), useValue: mockRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<EquipInspectService>(EquipInspectService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates a lean pool assignment', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const entity = {
        company: '40', plant: '1000', equipCode: 'EQ-CUT-01',
        itemCode: 'EIP-001', inspectType: 'DAILY', useYn: 'Y', sortSeq: null,
      } as EquipInspectItemPool;
      mockRepo.create.mockReturnValue(entity);
      mockRepo.save.mockResolvedValue(entity);

      const result = await target.create(
        { equipCode: 'EQ-CUT-01', itemCode: 'EIP-001', inspectType: 'DAILY' },
        '40', '1000',
      );

      expect(result.equipCode).toBe('EQ-CUT-01');
      expect(result.itemCode).toBe('EIP-001');
      expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        equipCode: 'EQ-CUT-01', itemCode: 'EIP-001', inspectType: 'DAILY', useYn: 'Y',
      }));
    });

    it('throws ConflictException when assignment already exists', async () => {
      mockRepo.findOne.mockResolvedValue({ equipCode: 'EQ-CUT-01' } as any);
      await expect(
        target.create({ equipCode: 'EQ-CUT-01', itemCode: 'EIP-001', inspectType: 'DAILY' }, '40', '1000'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('removes the assignment by composite key', async () => {
      const item = { equipCode: 'EQ-CUT-01', itemCode: 'EIP-001', inspectType: 'DAILY' } as any;
      mockRepo.findOne.mockResolvedValue(item);
      mockRepo.remove.mockResolvedValue(item);

      await expect(
        target.delete('40', '1000', 'EQ-CUT-01', 'EIP-001', 'DAILY'),
      ).resolves.not.toThrow();
      expect(mockRepo.remove).toHaveBeenCalledWith(item);
    });

    it('throws NotFoundException when assignment not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(
        target.delete('40', '1000', 'EQ-CUT-01', 'EIP-999', 'DAILY'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
