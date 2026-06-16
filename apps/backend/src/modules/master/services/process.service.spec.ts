import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getMetadataArgsStorage } from 'typeorm';
import { ProcessService } from './process.service';
import { ProcessMaster } from '../../../entities/process-master.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { ProcessEquipment } from '../../../entities/process-equipment.entity';
import { MockLoggerService } from '@test/mock-logger.service';

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

  it('includes tenant columns in process equipment primary key metadata', () => {
    const primaryColumnNames = getMetadataArgsStorage()
      .columns
      .filter((column) => column.target === ProcessEquipment && column.options.primary)
      .map((column) => column.propertyName);

    expect(primaryColumnNames).toEqual(expect.arrayContaining(['company', 'plant']));
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
      where: { processCode: 'PROC-A', equipCode: 'EQ-001', company: 'C1', plant: 'P1' },
    });
    expect(assignmentRepo.create).toHaveBeenCalledWith({
      company: 'C1',
      plant: 'P1',
      processCode: 'PROC-A',
      equipCode: 'EQ-001',
      useYn: 'Y',
    });
  });

  it('rejects duplicate active equipment assignment within the same tenant', async () => {
    processRepo.findOne.mockResolvedValue({ processCode: 'PROC-A', company: 'C1', plant: 'P1' } as ProcessMaster);
    equipRepo.findOne.mockResolvedValue({ equipCode: 'EQ-001', company: 'C1', plant: 'P1' } as EquipMaster);
    assignmentRepo.findOne.mockResolvedValue({
      processCode: 'PROC-A',
      equipCode: 'EQ-001',
      company: 'C1',
      plant: 'P1',
      useYn: 'Y',
    } as ProcessEquipment);

    await expect(target.assignEquipment('PROC-A', 'EQ-001', 'C1', 'P1')).rejects.toThrow('이미 배치된 설비입니다');
    expect(assignmentRepo.save).not.toHaveBeenCalled();
  });

  it('finds assigned equipment within tenant only', async () => {
    processRepo.findOne.mockResolvedValue({ processCode: 'PROC-A', company: 'C1', plant: 'P1' } as ProcessMaster);
    assignmentRepo.find.mockResolvedValue([]);

    await target.findEquipments('PROC-A', 'C1', 'P1');

    expect(assignmentRepo.find).toHaveBeenCalledWith({
      where: { processCode: 'PROC-A', useYn: 'Y', company: 'C1', plant: 'P1' },
      relations: ['equipment'],
      order: { equipCode: 'ASC' },
    });
  });

  it('removes equipment assignment within tenant only', async () => {
    processRepo.findOne.mockResolvedValue({ processCode: 'PROC-A', company: 'C1', plant: 'P1' } as ProcessMaster);
    assignmentRepo.delete.mockResolvedValue({ affected: 1 } as any);

    await target.removeEquipment('PROC-A', 'EQ-001', 'C1', 'P1');

    expect(assignmentRepo.delete).toHaveBeenCalledWith({
      processCode: 'PROC-A',
      equipCode: 'EQ-001',
      company: 'C1',
      plant: 'P1',
    });
  });

  it('counts assigned equipment within tenant only', async () => {
    const qb: any = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ processCode: 'PROC-A', count: '2' }]),
    };
    assignmentRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await target.getEquipmentCounts('C1', 'P1');

    expect(result).toEqual({ 'PROC-A': 2 });
    expect(qb.andWhere).toHaveBeenCalledWith('pe.company = :company', { company: 'C1' });
    expect(qb.andWhere).toHaveBeenCalledWith('pe.plant = :plant', { plant: 'P1' });
  });

  it('updates a process within tenant and strips key/tenant columns from payload', async () => {
    processRepo.findOne.mockResolvedValue({ processCode: 'PROC-A', company: 'C1', plant: 'P1' } as ProcessMaster);
    processRepo.update.mockResolvedValue({ affected: 1 } as any);

    await target.update('PROC-A', {
      processCode: 'PROC-B',
      processName: 'Cutting',
      company: 'C2',
      plant: 'P2',
    } as any, 'C1', 'P1');

    expect(processRepo.update).toHaveBeenCalledWith(
      { processCode: 'PROC-A', company: 'C1', plant: 'P1' },
      { processName: 'Cutting' },
    );
  });

  it('does not pass arbitrary fields from update payload to the repository', async () => {
    processRepo.findOne.mockResolvedValue({ processCode: 'PROC-A', company: 'C1', plant: 'P1' } as ProcessMaster);
    processRepo.update.mockResolvedValue({ affected: 1 } as any);

    await target.update('PROC-A', {
      processName: 'Cutting',
      externalSource: 'ERP',
    } as any, 'C1', 'P1');

    expect(processRepo.update).toHaveBeenCalledWith(
      { processCode: 'PROC-A', company: 'C1', plant: 'P1' },
      { processName: 'Cutting' },
    );
  });
});
