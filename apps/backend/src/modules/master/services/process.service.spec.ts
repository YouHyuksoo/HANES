import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessService } from './process.service';
import { ProcessMaster } from '../../../entities/process-master.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { ProcessEquipment } from '../../../entities/process-equipment.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('ProcessService equipment assignments', () => {
  let target: ProcessService;
  let processRepo: DeepMocked<Repository<ProcessMaster>>;
  let equipRepo: DeepMocked<Repository<EquipMaster>>;
  let assignmentRepo: DeepMocked<Repository<ProcessEquipment>>;

  beforeEach(async () => {
    processRepo = createMock<Repository<ProcessMaster>>();
    equipRepo = createMock<Repository<EquipMaster>>();
    assignmentRepo = createMock<Repository<ProcessEquipment>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessService,
        { provide: getRepositoryToken(ProcessMaster), useValue: processRepo },
        { provide: getRepositoryToken(EquipMaster), useValue: equipRepo },
        { provide: getRepositoryToken(ProcessEquipment), useValue: assignmentRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<ProcessService>(ProcessService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('allows the same equipment to be assigned to different processes', async () => {
    processRepo.findOne
      .mockResolvedValueOnce({ processCode: 'PROC-A' } as ProcessMaster)
      .mockResolvedValueOnce({ processCode: 'PROC-B' } as ProcessMaster);
    equipRepo.findOne.mockResolvedValue({ equipCode: 'EQ-001' } as EquipMaster);
    assignmentRepo.findOne.mockResolvedValue(null);
    assignmentRepo.create.mockImplementation((value) => value as ProcessEquipment);
    assignmentRepo.save.mockImplementation(async (value) => value as ProcessEquipment);

    await target.assignEquipment('PROC-A', 'EQ-001');
    await target.assignEquipment('PROC-B', 'EQ-001');

    expect(assignmentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ processCode: 'PROC-A', equipCode: 'EQ-001' }),
    );
    expect(assignmentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ processCode: 'PROC-B', equipCode: 'EQ-001' }),
    );
  });

  it('assigns equipment using process, equipment, and existing assignment within tenant only', async () => {
    processRepo.findOne.mockResolvedValue({ processCode: 'PROC-A', company: 'C1', plant: 'P1' } as ProcessMaster);
    equipRepo.findOne.mockResolvedValue({ equipCode: 'EQ-001', company: 'C1', plant: 'P1' } as EquipMaster);
    assignmentRepo.findOne.mockResolvedValue(null);
    assignmentRepo.create.mockImplementation((value) => value as ProcessEquipment);
    assignmentRepo.save.mockImplementation(async (value) => value as ProcessEquipment);

    await target.assignEquipment('PROC-A', 'EQ-001', 'C1', 'P1');

    expect(processRepo.findOne).toHaveBeenCalledWith({
      where: { processCode: 'PROC-A', company: 'C1', plant: 'P1' },
    });
    expect(equipRepo.findOne).toHaveBeenCalledWith({
      where: { equipCode: 'EQ-001', company: 'C1', plant: 'P1' },
    });
    expect(assignmentRepo.findOne).toHaveBeenCalledWith({
      where: { processCode: 'PROC-A', equipCode: 'EQ-001' },
    });
    expect(assignmentRepo.create).toHaveBeenCalledWith({
      processCode: 'PROC-A',
      equipCode: 'EQ-001',
      useYn: 'Y',
    });
  });

  it('finds assigned equipment within tenant only', async () => {
    processRepo.findOne.mockResolvedValue({ processCode: 'PROC-A', company: 'C1', plant: 'P1' } as ProcessMaster);
    assignmentRepo.find.mockResolvedValue([]);

    await target.findEquipments('PROC-A', 'C1', 'P1');

    expect(assignmentRepo.find).toHaveBeenCalledWith({
      where: { processCode: 'PROC-A', useYn: 'Y' },
      relations: ['equipment'],
      order: { equipCode: 'ASC' },
    });
  });
});
