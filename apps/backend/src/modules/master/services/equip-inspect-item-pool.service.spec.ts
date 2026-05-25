import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EquipInspectItemPool } from '../../../entities/equip-inspect-item-pool.entity';
import { EquipInspectItemPoolService } from './equip-inspect-item-pool.service';
import { MockLoggerService } from '@test/mock-logger.service';

describe('EquipInspectItemPoolService', () => {
  let target: EquipInspectItemPoolService;
  let mockRepo: DeepMocked<Repository<EquipInspectItemPool>>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<EquipInspectItemPool>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipInspectItemPoolService,
        { provide: getRepositoryToken(EquipInspectItemPool), useValue: mockRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<EquipInspectItemPoolService>(EquipInspectItemPoolService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates a reusable equipment inspection item in the pool', async () => {
    const dto = {
      itemCode: 'EIP-001',
      itemName: 'Air pressure check',
      inspectType: 'DAILY',
      criteria: '0.5~0.7 MPa',
      cycle: 'DAILY',
      useYn: 'Y',
    };
    const created = { ...dto, company: 'HANES', plant: '1000' } as EquipInspectItemPool;

    mockRepo.findOne.mockResolvedValue(null);
    mockRepo.create.mockReturnValue(created);
    mockRepo.save.mockResolvedValue(created);

    await expect(target.create(dto, 'HANES', '1000')).resolves.toEqual(created);
    expect(mockRepo.create).toHaveBeenCalledWith({
      ...dto,
      company: 'HANES',
      plant: '1000',
      remark: null,
    });
  });

  it('rejects duplicate pool item codes in the same tenant', async () => {
    mockRepo.findOne.mockResolvedValue({ itemCode: 'EIP-001' } as EquipInspectItemPool);

    await expect(target.create({ itemCode: 'EIP-001', itemName: 'Air pressure check', inspectType: 'DAILY' } as any, 'HANES', '1000'))
      .rejects.toThrow(ConflictException);
  });

  it('finds an active pool item by tenant and code', async () => {
    const item = { itemCode: 'EIP-001', itemName: 'Air pressure check', useYn: 'Y' } as EquipInspectItemPool;
    mockRepo.findOne.mockResolvedValue(item);

    await expect(target.findByCode('HANES', '1000', 'EIP-001')).resolves.toEqual(item);
  });

  it('throws when a pool item code is missing', async () => {
    mockRepo.findOne.mockResolvedValue(null);

    await expect(target.findByCode('HANES', '1000', 'EIP-999')).rejects.toThrow(NotFoundException);
  });

  it('keeps tenant and item key columns from the matched pool item when update payload contains them', async () => {
    const existing = {
      company: 'HANES',
      plant: '1000',
      itemCode: 'EIP-001',
      itemName: 'Air pressure check',
      inspectType: 'DAILY',
      criteria: '0.5~0.7 MPa',
      cycle: 'DAILY',
      useYn: 'Y',
    } as EquipInspectItemPool;

    mockRepo.findOne.mockResolvedValue(existing);
    mockRepo.save.mockImplementation(async (item) => item as EquipInspectItemPool);

    const result = await target.update('HANES', '1000', 'EIP-001', {
      company: 'OTHER',
      plant: '9999',
      itemCode: 'EIP-999',
      itemName: 'Updated pressure check',
    } as any);

    expect(result.company).toBe('HANES');
    expect(result.plant).toBe('1000');
    expect(result.itemCode).toBe('EIP-001');
    expect(result.itemName).toBe('Updated pressure check');
    expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      company: 'HANES',
      plant: '1000',
      itemCode: 'EIP-001',
      itemName: 'Updated pressure check',
    }));
  });
});
