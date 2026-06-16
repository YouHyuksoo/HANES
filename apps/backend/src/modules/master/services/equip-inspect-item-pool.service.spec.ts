import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EquipInspectItemMaster } from '../../../entities/equip-inspect-item-master.entity';
import { EquipInspectItemPoolService } from './equip-inspect-item-pool.service';
import { MockLoggerService } from '@test/mock-logger.service';

describe('EquipInspectItemPoolService', () => {
  let target: EquipInspectItemPoolService;
  let mockRepo: DeepMocked<Repository<EquipInspectItemMaster>>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<EquipInspectItemMaster>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipInspectItemPoolService,
        { provide: getRepositoryToken(EquipInspectItemMaster), useValue: mockRepo },
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
    const created = { ...dto, company: 'HANES', plant: '1000' } as EquipInspectItemMaster;

    mockRepo.findOne.mockResolvedValue(null);
    mockRepo.create.mockReturnValue(created);
    mockRepo.save.mockResolvedValue(created);

    await expect(target.create(dto, 'HANES', '1000')).resolves.toEqual(created);
    expect(mockRepo.create).toHaveBeenCalledWith({
      company: 'HANES',
      plant: '1000',
      itemCode: 'EIP-001',
      itemName: 'Air pressure check',
      inspectType: 'DAILY',
      equipType: null,
      criteria: '0.5~0.7 MPa',
      cycle: 'DAILY',
      useYn: 'Y',
      itemType: 'VISUAL',
      unit: null,
      lslValue: null,
      uslValue: null,
      workerQrCode: null,
      imageUrl: null,
      remark: null,
    });
  });

  it('updates an inspection item image URL in the matched tenant', async () => {
    const existing = { itemCode: 'EIP-001', imageUrl: null } as EquipInspectItemMaster;
    const updated = { itemCode: 'EIP-001', imageUrl: '/uploads/equip-inspect-items/item.png' } as EquipInspectItemMaster;

    mockRepo.findOne.mockResolvedValueOnce(existing).mockResolvedValueOnce(updated);
    mockRepo.update.mockResolvedValue({ affected: 1 } as any);

    const result = await target.updateImage('EIP-001', '/uploads/equip-inspect-items/item.png', 'HANES', '1000');

    expect(mockRepo.update).toHaveBeenCalledWith(
      { company: 'HANES', plant: '1000', itemCode: 'EIP-001' },
      { imageUrl: '/uploads/equip-inspect-items/item.png' },
    );
    expect(result).toEqual(updated);
  });

  it('rejects duplicate pool item codes in the same tenant', async () => {
    mockRepo.findOne.mockResolvedValue({ itemCode: 'EIP-001' } as EquipInspectItemMaster);

    await expect(target.create({ itemCode: 'EIP-001', itemName: 'Air pressure check', inspectType: 'DAILY' } as any, 'HANES', '1000'))
      .rejects.toThrow(ConflictException);
  });

  it('finds an active pool item by tenant and code', async () => {
    const item = { itemCode: 'EIP-001', itemName: 'Air pressure check', useYn: 'Y' } as EquipInspectItemMaster;
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
    } as EquipInspectItemMaster;

    mockRepo.findOne.mockResolvedValue(existing);
    mockRepo.save.mockImplementation(async (item) => item as EquipInspectItemMaster);

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
