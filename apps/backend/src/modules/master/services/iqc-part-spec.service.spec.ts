import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { IqcPartSpec } from '../../../entities/iqc-part-spec.entity';
import { IqcPartSpecItem } from '../../../entities/iqc-part-spec-item.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { IqcPartSpecService } from './iqc-part-spec.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('IqcPartSpecService', () => {
  let target: IqcPartSpecService;
  let mockSpecRepo: DeepMocked<Repository<IqcPartSpec>>;
  let mockItemRepo: DeepMocked<Repository<IqcPartSpecItem>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockTx: DeepMocked<TransactionService>;

  beforeEach(async () => {
    mockSpecRepo = createMock<Repository<IqcPartSpec>>();
    mockItemRepo = createMock<Repository<IqcPartSpecItem>>();
    mockDataSource = createMock<DataSource>();
    mockTx = createMock<TransactionService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IqcPartSpecService,
        { provide: getRepositoryToken(IqcPartSpec), useValue: mockSpecRepo },
        { provide: getRepositoryToken(IqcPartSpecItem), useValue: mockItemRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<IqcPartSpecService>(IqcPartSpecService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('finds an item spec only within the tenant context', async () => {
    await target.findByItemCode('ITEM-001', 'C1', 'P1');

    expect(mockSpecRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' },
    }));
  });

  it('upserts and refreshes an item spec within the tenant context', async () => {
    const em = {
      findOne: jest.fn()
        .mockResolvedValueOnce({ itemCode: 'ITEM-001', company: 'C1', plant: 'P1' })
        .mockResolvedValueOnce({ itemCode: 'ITEM-001', company: 'C1', plant: 'P1' }),
      create: jest.fn((_, value) => value),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    mockTx.run.mockImplementation(async (callback) => callback({ manager: em } as any));

    await target.upsert({
      itemCode: 'ITEM-001',
      sampleQty: 1,
      isDest: 'N',
      useYn: 'Y',
      items: [],
    }, 'C1', 'P1', 'user1');

    expect(em.findOne).toHaveBeenNthCalledWith(1, IqcPartSpec, {
      where: { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' },
    });
    expect(em.delete).toHaveBeenCalledWith(IqcPartSpecItem, {
      itemCode: 'ITEM-001',
      company: 'C1',
      plant: 'P1',
    });
    expect(em.findOne).toHaveBeenNthCalledWith(2, IqcPartSpec, expect.objectContaining({
      where: { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' },
    }));
  });

  it('deletes an item spec only within the tenant context', async () => {
    const spec = { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' } as IqcPartSpec;
    mockSpecRepo.findOne.mockResolvedValue(spec);

    await target.delete('ITEM-001', 'C1', 'P1');

    expect(mockSpecRepo.findOne).toHaveBeenCalledWith({
      where: { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' },
    });
    expect(mockSpecRepo.remove).toHaveBeenCalledWith(spec);
  });
});
