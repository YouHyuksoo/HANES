import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EquipInspectItemMaster } from '../../../entities/equip-inspect-item-master.entity';
import { EquipInspectService } from './equip-inspect.service';
import { EquipInspectItemPoolService } from './equip-inspect-item-pool.service';
import { MockLoggerService } from '@test/mock-logger.service';

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
      itemType: 'VISUAL',
      unit: null,
      lslValue: null,
      uslValue: null,
      workerQrCode: null,
    });
  });

  it('preserves worker QR fields when creating a worker inspection assignment', async () => {
    mockPoolService.findByCode.mockResolvedValue({
      itemCode: 'EIP-STD-W001',
      itemName: '작업 전 설비 주변 정리',
      inspectType: 'WORKER',
      criteria: '작업 공간 이상 없음',
      cycle: 'DAILY',
      useYn: 'Y',
    } as any);

    const created = {
      company: '40',
      plant: '1000',
      equipCode: 'EQ-CUT-01',
      itemCode: 'EIP-STD-W001',
      inspectType: 'WORKER',
      seq: 1,
      itemName: '작업 전 설비 주변 정리',
      criteria: '작업 공간 이상 없음',
      cycle: 'DAILY',
      useYn: 'Y',
      itemType: 'VISUAL',
      unit: null,
      lslValue: null,
      uslValue: null,
      workerQrCode: 'EQ-CUT-01:W001',
    } as EquipInspectItemMaster;

    mockRepo.create.mockReturnValue(created);
    mockRepo.save.mockResolvedValue(created);

    await expect(target.create({
      equipCode: 'EQ-CUT-01',
      itemCode: 'EIP-STD-W001',
      inspectType: 'WORKER',
      seq: 1,
      workerQrCode: 'EQ-CUT-01:W001',
    } as any, '40', '1000')).resolves.toEqual(created);

    expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      inspectType: 'WORKER',
      itemCode: 'EIP-STD-W001',
      workerQrCode: 'EQ-CUT-01:W001',
      itemType: 'VISUAL',
    }));
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
