import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReworkService } from './rework.service';
import { ReworkOrder } from '../../../../entities/rework-order.entity';
import { ReworkInspect } from '../../../../entities/rework-inspect.entity';
import { ReworkProcess } from '../../../../entities/rework-process.entity';
import { DefectLog } from '../../../../entities/defect-log.entity';
import { ItemMaster } from '../../../../entities/item-master.entity';
import { ProductInventoryService } from '../../../inventory/services/product-inventory.service';
import { MockLoggerService } from '@test/mock-logger.service';

describe('ReworkService policy', () => {
  let target: ReworkService;
  let mockReworkRepo: DeepMocked<Repository<ReworkOrder>>;
  let mockProcessRepo: DeepMocked<Repository<ReworkProcess>>;
  let mockDefectLogRepo: DeepMocked<Repository<DefectLog>>;

  beforeEach(async () => {
    mockReworkRepo = createMock<Repository<ReworkOrder>>();
    mockProcessRepo = createMock<Repository<ReworkProcess>>();
    mockDefectLogRepo = createMock<Repository<DefectLog>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReworkService,
        { provide: getRepositoryToken(ReworkOrder), useValue: mockReworkRepo },
        { provide: getRepositoryToken(ReworkInspect), useValue: createMock<Repository<ReworkInspect>>() },
        { provide: getRepositoryToken(ReworkProcess), useValue: mockProcessRepo },
        { provide: getRepositoryToken(DefectLog), useValue: mockDefectLogRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: createMock<Repository<ItemMaster>>() },
        { provide: ProductInventoryService, useValue: createMock<ProductInventoryService>() },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get(ReworkService);
  });

  afterEach(() => jest.clearAllMocks());

  it('restores linked defect status when deleting a registered rework order', async () => {
    mockReworkRepo.findOne.mockResolvedValue({
      reworkNo: 'RW-001',
      status: 'REGISTERED',
      defectLogId: '2026-04-08T00:00:00.000Z|1',
    } as any);
    mockProcessRepo.find.mockResolvedValue([]);
    mockDefectLogRepo.update.mockResolvedValue({ affected: 1 } as any);
    mockReworkRepo.delete.mockResolvedValue({ affected: 1 } as any);

    await target.delete('RW-001');

    expect(mockDefectLogRepo.update).toHaveBeenCalledWith(
      { occurAt: new Date('2026-04-08T00:00:00.000Z'), seq: 1 },
      { status: 'WAIT' },
    );
  });

  it('blocks delete when rework inspection already exists', async () => {
    mockReworkRepo.findOne.mockResolvedValue({
      reworkNo: 'RW-009',
      status: 'REGISTERED',
    } as any);
    mockProcessRepo.find.mockResolvedValue([]);
    const mockInspectRepo = (target as any).inspectRepo;
    mockInspectRepo.find.mockResolvedValue([{ reworkOrderId: 'RW-009' }]);

    await expect(target.delete('RW-009')).rejects.toThrow();
  });
});
