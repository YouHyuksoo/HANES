import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { IqcItemMaster } from '../../../entities/iqc-item-master.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { IqcItemService } from './iqc-item.service';

describe('IqcItemService', () => {
  let target: IqcItemService;
  let mockRepo: DeepMocked<Repository<IqcItemMaster>>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<IqcItemMaster>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IqcItemService,
        { provide: getRepositoryToken(IqcItemMaster), useValue: mockRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<IqcItemService>(IqcItemService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('finds an item only within the tenant context', async () => {
    const item = { itemCode: 'ITEM01', seq: 1, company: 'C1', plant: 'P1' } as IqcItemMaster;
    mockRepo.findOne.mockResolvedValue(item);

    const result = await target.findByCompositeKey('ITEM01', 1, 'C1', 'P1');

    expect(result).toEqual(item);
    expect(mockRepo.findOne).toHaveBeenCalledWith({
      where: { itemCode: 'ITEM01', seq: 1, company: 'C1', plant: 'P1' },
    });
  });

  it('throws NotFoundException when tenant scoped item is missing', async () => {
    mockRepo.findOne.mockResolvedValue(null);

    await expect(target.findByCompositeKey('ITEM99', 1, 'C1', 'P1')).rejects.toThrow(NotFoundException);
  });

  it('rejects a matched IQC item when its tenant differs from the request tenant', async () => {
    mockRepo.findOne.mockResolvedValue({ itemCode: 'ITEM01', seq: 1, company: 'OTHER', plant: 'P1' } as IqcItemMaster);

    await expect(target.findByCompositeKey('ITEM01', 1, 'C1', 'P1')).rejects.toThrow(BadRequestException);
  });

  it('rejects duplicate itemCode and seq on create within the tenant context', async () => {
    mockRepo.findOne.mockResolvedValue({ itemCode: 'ITEM01', seq: 1, company: 'C1', plant: 'P1' } as IqcItemMaster);

    await expect(target.create({
      itemCode: 'ITEM01',
      seq: 1,
      inspectItem: 'Length',
    } as any, 'C1', 'P1')).rejects.toThrow(ConflictException);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('updates an item within the tenant context', async () => {
    const item = { itemCode: 'ITEM01', seq: 1, inspectItem: 'Old', company: 'C1', plant: 'P1' } as IqcItemMaster;
    mockRepo.findOne.mockResolvedValue(item);
    mockRepo.save.mockResolvedValue({ ...item, inspectItem: 'New' } as IqcItemMaster);

    const result = await target.update('ITEM01', 1, { inspectItem: 'New' } as any, 'C1', 'P1');

    expect(result.inspectItem).toBe('New');
    expect(mockRepo.findOne).toHaveBeenCalledWith({
      where: { itemCode: 'ITEM01', seq: 1, company: 'C1', plant: 'P1' },
    });
  });

  it('keeps tenant and item key columns from the matched IQC item when update payload contains them', async () => {
    const item = { itemCode: 'ITEM01', seq: 1, inspectItem: 'Old', company: 'C1', plant: 'P1' } as IqcItemMaster;
    mockRepo.findOne.mockResolvedValue(item);
    mockRepo.save.mockImplementation(async (value) => value as IqcItemMaster);

    const result = await target.update('ITEM01', 1, {
      itemCode: 'ITEM99',
      seq: 99,
      inspectItem: 'New',
      company: 'C2',
      plant: 'P2',
    } as any, 'C1', 'P1');

    expect(result).toEqual(expect.objectContaining({
      itemCode: 'ITEM01',
      seq: 1,
      inspectItem: 'New',
      company: 'C1',
      plant: 'P1',
    }));
  });

  it('deletes an item within the tenant context', async () => {
    const item = { itemCode: 'ITEM01', seq: 1, company: 'C1', plant: 'P1' } as IqcItemMaster;
    mockRepo.findOne.mockResolvedValue(item);
    mockRepo.remove.mockResolvedValue(item);

    const result = await target.delete('ITEM01', 1, 'C1', 'P1');

    expect(result).toEqual({ itemCode: 'ITEM01', seq: 1, deleted: true });
    expect(mockRepo.remove).toHaveBeenCalledWith(item);
  });
});
