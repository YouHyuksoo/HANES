import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EquipInspectItemMaster } from '../../../entities/equip-inspect-item-master.entity';
import { EquipInspectService } from './equip-inspect.service';
import { EquipInspectItemPoolService } from './equip-inspect-item-pool.service';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('EquipInspectService', () => {
  let target: EquipInspectService;
  let mockRepo: DeepMocked<Repository<EquipInspectItemMaster>>;
  let mockPoolService: DeepMocked<EquipInspectItemPoolService>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<EquipInspectItemMaster>>();
    mockPoolService = createMock<EquipInspectItemPoolService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipInspectService,
        { provide: getRepositoryToken(EquipInspectItemMaster), useValue: mockRepo },
        { provide: EquipInspectItemPoolService, useValue: mockPoolService },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<EquipInspectService>(EquipInspectService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates equipment assignment from a selected pool item', async () => {
    mockPoolService.findByCode.mockResolvedValue({
      itemCode: 'EIP-001',
      itemName: 'Air pressure check',
      inspectType: 'DAILY',
      criteria: '0.5~0.7 MPa',
      cycle: 'DAILY',
      useYn: 'Y',
    } as any);

    const created = {
      company: 'HANES',
      plant: '1000',
      equipCode: 'EQ-CUT-01',
      itemCode: 'EIP-001',
      inspectType: 'DAILY',
      seq: 1,
      itemName: 'Air pressure check',
      criteria: '0.5~0.7 MPa',
      cycle: 'DAILY',
      useYn: 'Y',
    } as EquipInspectItemMaster;

    mockRepo.create.mockReturnValue(created);
    mockRepo.save.mockResolvedValue(created);

    await expect(target.create({
      equipCode: 'EQ-CUT-01',
      itemCode: 'EIP-001',
      seq: 1,
    } as any, 'HANES', '1000')).resolves.toEqual(created);

    expect(mockPoolService.findByCode).toHaveBeenCalledWith('HANES', '1000', 'EIP-001');
    expect(mockRepo.create).toHaveBeenCalledWith({
      company: 'HANES',
      plant: '1000',
      equipCode: 'EQ-CUT-01',
      itemCode: 'EIP-001',
      inspectType: 'DAILY',
      seq: 1,
      itemName: 'Air pressure check',
      criteria: '0.5~0.7 MPa',
      cycle: 'DAILY',
      useYn: 'Y',
    });
  });

  it('keeps tenant key columns from the matched equipment assignment when update payload contains them', async () => {
    const existing = {
      company: 'HANES',
      plant: '1000',
      equipCode: 'EQ-CUT-01',
      itemCode: 'EIP-001',
      inspectType: 'DAILY',
      seq: 1,
      itemName: 'Air pressure check',
      criteria: '0.5~0.7 MPa',
      cycle: 'DAILY',
      useYn: 'Y',
    } as EquipInspectItemMaster;

    mockRepo.findOne.mockResolvedValue(existing);
    mockRepo.save.mockImplementation(async (item) => item as EquipInspectItemMaster);

    const result = await target.update(
      'HANES',
      '1000',
      'EQ-CUT-01',
      'DAILY',
      1,
      {
        company: 'OTHER',
        plant: '9999',
        itemName: 'Updated pressure check',
      } as any,
    );

    expect(result.company).toBe('HANES');
    expect(result.plant).toBe('1000');
    expect(result.itemName).toBe('Updated pressure check');
    expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      company: 'HANES',
      plant: '1000',
      itemName: 'Updated pressure check',
    }));
  });
});
