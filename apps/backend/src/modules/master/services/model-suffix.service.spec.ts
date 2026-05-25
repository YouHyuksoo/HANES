import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ModelSuffix } from '../../../entities/model-suffix.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { ModelSuffixService } from './model-suffix.service';

describe('ModelSuffixService', () => {
  let target: ModelSuffixService;
  let mockRepo: DeepMocked<Repository<ModelSuffix>>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<ModelSuffix>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModelSuffixService,
        { provide: getRepositoryToken(ModelSuffix), useValue: mockRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<ModelSuffixService>(ModelSuffixService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('finds a suffix only within the tenant context', async () => {
    const suffix = { modelCode: 'MDL-01', suffixCode: 'A', company: 'C1', plant: 'P1' } as ModelSuffix;
    mockRepo.findOne.mockResolvedValue(suffix);

    const result = await target.findByCompositeKey('MDL-01', 'A', 'C1', 'P1');

    expect(result).toEqual(suffix);
    expect(mockRepo.findOne).toHaveBeenCalledWith({
      where: { modelCode: 'MDL-01', suffixCode: 'A', company: 'C1', plant: 'P1' },
    });
  });

  it('throws NotFoundException when tenant scoped suffix is missing', async () => {
    mockRepo.findOne.mockResolvedValue(null);

    await expect(target.findByCompositeKey('MDL-01', 'A', 'C1', 'P1')).rejects.toThrow(NotFoundException);
  });

  it('throws when matched suffix tenant differs from request tenant', async () => {
    mockRepo.findOne.mockResolvedValue({ modelCode: 'MDL-01', suffixCode: 'A', company: 'OTHER', plant: 'P1' } as ModelSuffix);

    await expect(target.findByCompositeKey('MDL-01', 'A', 'C1', 'P1')).rejects.toThrow(BadRequestException);
  });

  it('creates a suffix within the tenant context', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    const created = { modelCode: 'MDL-01', suffixCode: 'A', company: 'C1', plant: 'P1' } as ModelSuffix;
    mockRepo.create.mockReturnValue(created);
    mockRepo.save.mockResolvedValue(created);

    await target.create({ modelCode: 'MDL-01', suffixCode: 'A', suffixName: 'A' } as any, 'C1', 'P1');

    expect(mockRepo.findOne).toHaveBeenCalledWith({
      where: { modelCode: 'MDL-01', suffixCode: 'A', company: 'C1', plant: 'P1' },
    });
    expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      modelCode: 'MDL-01',
      suffixCode: 'A',
      company: 'C1',
      plant: 'P1',
    }));
  });

  it('keeps tenant and suffix key columns from the matched suffix when update payload contains them', async () => {
    const suffix = { modelCode: 'MDL-01', suffixCode: 'A', suffixName: 'Old', company: 'C1', plant: 'P1' } as ModelSuffix;
    mockRepo.findOne.mockResolvedValue(suffix);
    mockRepo.save.mockImplementation(async (value) => value as ModelSuffix);

    const result = await target.update('MDL-01', 'A', {
      modelCode: 'MDL-99',
      suffixCode: 'Z',
      suffixName: 'New',
      company: 'C2',
      plant: 'P2',
    } as any, 'C1', 'P1');

    expect(result).toEqual(expect.objectContaining({
      modelCode: 'MDL-01',
      suffixCode: 'A',
      suffixName: 'New',
      company: 'C1',
      plant: 'P1',
    }));
  });

  it('deletes a suffix within the tenant context', async () => {
    const suffix = { modelCode: 'MDL-01', suffixCode: 'A', company: 'C1', plant: 'P1' } as ModelSuffix;
    mockRepo.findOne.mockResolvedValue(suffix);
    mockRepo.remove.mockResolvedValue(suffix);

    await target.delete('MDL-01', 'A', 'C1', 'P1');

    expect(mockRepo.findOne).toHaveBeenCalledWith({
      where: { modelCode: 'MDL-01', suffixCode: 'A', company: 'C1', plant: 'P1' },
    });
  });
});
