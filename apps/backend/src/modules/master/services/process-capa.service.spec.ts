import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { MockLoggerService } from '@test/mock-logger.service';
import { ItemMaster } from '../../../entities/item-master.entity';
import { ProcessCapa } from '../../../entities/process-capa.entity';
import { ProcessMaster } from '../../../entities/process-master.entity';
import { ProcessCapaService } from './process-capa.service';

describe('ProcessCapaService', () => {
  let target: ProcessCapaService;
  let repo: DeepMocked<Repository<ProcessCapa>>;
  let processRepo: DeepMocked<Repository<ProcessMaster>>;
  let partRepo: DeepMocked<Repository<ItemMaster>>;

  beforeEach(async () => {
    repo = createMock<Repository<ProcessCapa>>();
    processRepo = createMock<Repository<ProcessMaster>>();
    partRepo = createMock<Repository<ItemMaster>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessCapaService,
        { provide: getRepositoryToken(ProcessCapa), useValue: repo },
        { provide: getRepositoryToken(ProcessMaster), useValue: processRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: partRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get(ProcessCapaService);
  });

  afterEach(() => jest.clearAllMocks());

  it('creates capa after validating process and part within tenant only', async () => {
    repo.findOne.mockResolvedValue(null);
    processRepo.findOne.mockResolvedValue({ processCode: 'P01', company: 'C1', plant: 'P1' } as ProcessMaster);
    partRepo.findOne.mockResolvedValue({ itemCode: 'ITEM01', company: 'C1', plant: 'P1' } as ItemMaster);
    repo.create.mockImplementation((value) => value as ProcessCapa);
    repo.save.mockImplementation(async (value) => value as ProcessCapa);

    await target.create({ processCode: 'P01', itemCode: 'ITEM01', stdTactTime: 10 } as any, 'C1', 'P1');

    expect(processRepo.findOne).toHaveBeenCalledWith({
      where: { processCode: 'P01', company: 'C1', plant: 'P1' },
    });
    expect(partRepo.findOne).toHaveBeenCalledWith({
      where: { itemCode: 'ITEM01', company: 'C1', plant: 'P1' },
    });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ company: 'C1', plant: 'P1', processCode: 'P01', itemCode: 'ITEM01' }),
    );
  });

  it('rejects duplicate capa within tenant', async () => {
    repo.findOne.mockResolvedValue({ processCode: 'P01', itemCode: 'ITEM01' } as ProcessCapa);

    await expect(target.create({ processCode: 'P01', itemCode: 'ITEM01', stdTactTime: 10 } as any, 'C1', 'P1'))
      .rejects.toThrow(ConflictException);
  });

  it('rejects create when tenant-scoped process is missing', async () => {
    repo.findOne.mockResolvedValue(null);
    processRepo.findOne.mockResolvedValue(null);

    await expect(target.create({ processCode: 'P01', itemCode: 'ITEM01', stdTactTime: 10 } as any, 'C1', 'P1'))
      .rejects.toThrow(BadRequestException);
  });

  it('updates and deletes by tenant composite key', async () => {
    repo.findOne.mockResolvedValue({ processCode: 'P01', itemCode: 'ITEM01', stdTactTime: 10 } as ProcessCapa);
    repo.save.mockImplementation(async (value) => value as ProcessCapa);
    repo.delete.mockResolvedValue({ affected: 1 } as any);

    await target.update('P01', 'ITEM01', { stdTactTime: 12 } as any, 'C1', 'P1');
    await target.delete('P01', 'ITEM01', 'C1', 'P1');

    expect(repo.findOne).toHaveBeenCalledWith({
      where: { company: 'C1', plant: 'P1', processCode: 'P01', itemCode: 'ITEM01' },
    });
    expect(repo.delete).toHaveBeenCalledWith({ company: 'C1', plant: 'P1', processCode: 'P01', itemCode: 'ITEM01' });
  });

  it('throws when update target is missing in tenant', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(target.update('P01', 'ITEM01', {} as any, 'C1', 'P1')).rejects.toThrow(NotFoundException);
  });
});
