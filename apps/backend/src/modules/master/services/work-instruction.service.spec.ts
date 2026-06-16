import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { WorkInstruction } from '../../../entities/work-instruction.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { WorkInstructionService } from './work-instruction.service';

describe('WorkInstructionService', () => {
  let target: WorkInstructionService;
  let mockRepo: DeepMocked<Repository<WorkInstruction>>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<WorkInstruction>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkInstructionService,
        { provide: getRepositoryToken(WorkInstruction), useValue: mockRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<WorkInstructionService>(WorkInstructionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('finds a work instruction within tenant only', async () => {
    const item = { itemCode: 'ITEM01', processCode: 'P10', revision: 'A', company: 'C1', plant: 'P1' } as WorkInstruction;
    mockRepo.findOne.mockResolvedValue(item);

    const result = await target.findById('ITEM01::P10::A', 'C1', 'P1');

    expect(result).toEqual(item);
    expect(mockRepo.findOne).toHaveBeenCalledWith({
      where: { itemCode: 'ITEM01', processCode: 'P10', revision: 'A', company: 'C1', plant: 'P1' },
    });
  });

  it('throws when tenant scoped work instruction is missing', async () => {
    mockRepo.findOne.mockResolvedValue(null);

    await expect(target.findById('ITEM01::P10::A', 'C1', 'P1')).rejects.toThrow(NotFoundException);
  });

  it('creates a work instruction within tenant', async () => {
    const created = { itemCode: 'ITEM01', processCode: 'P10', revision: 'A', company: 'C1', plant: 'P1' } as WorkInstruction;
    mockRepo.findOne.mockResolvedValue(null);
    mockRepo.create.mockReturnValue(created);
    mockRepo.save.mockResolvedValue(created);

    await target.create({ itemCode: 'ITEM01', processCode: 'P10', title: 'Guide', revision: 'A' } as any, 'C1', 'P1');

    expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      itemCode: 'ITEM01',
      processCode: 'P10',
      revision: 'A',
      company: 'C1',
      plant: 'P1',
    }));
  });

  it('rejects duplicate item, process, and revision within tenant', async () => {
    mockRepo.findOne.mockResolvedValue({ itemCode: 'ITEM01', processCode: 'P10', revision: 'A', company: 'C1', plant: 'P1' } as WorkInstruction);

    await expect(target.create({
      itemCode: 'ITEM01',
      processCode: 'P10',
      title: 'Guide',
      revision: 'A',
    } as any, 'C1', 'P1')).rejects.toThrow(ConflictException);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('updates a work instruction within tenant and strips key columns from payload', async () => {
    const item = { itemCode: 'ITEM01', processCode: 'P10', revision: 'A', title: 'Old', company: 'C1', plant: 'P1' } as WorkInstruction;
    mockRepo.findOne.mockResolvedValue(item);
    mockRepo.update.mockResolvedValue({ affected: 1 } as any);

    await target.update('ITEM01::P10::A', {
      itemCode: 'ITEM99',
      processCode: 'P99',
      revision: 'Z',
      title: 'New',
      company: 'C2',
      plant: 'P2',
    } as any, 'C1', 'P1');

    expect(mockRepo.update).toHaveBeenCalledWith(
      { itemCode: 'ITEM01', processCode: 'P10', revision: 'A', company: 'C1', plant: 'P1' },
      expect.not.objectContaining({
        itemCode: expect.anything(),
        processCode: expect.anything(),
        revision: expect.anything(),
        company: expect.anything(),
        plant: expect.anything(),
      }),
    );
  });

  it('deletes a work instruction within tenant only', async () => {
    const item = { itemCode: 'ITEM01', processCode: 'P10', revision: 'A', company: 'C1', plant: 'P1' } as WorkInstruction;
    mockRepo.findOne.mockResolvedValue(item);
    mockRepo.delete.mockResolvedValue({ affected: 1 } as any);

    await target.delete('ITEM01::P10::A', 'C1', 'P1');

    expect(mockRepo.delete).toHaveBeenCalledWith({
      itemCode: 'ITEM01',
      processCode: 'P10',
      revision: 'A',
      company: 'C1',
      plant: 'P1',
    });
  });
});
