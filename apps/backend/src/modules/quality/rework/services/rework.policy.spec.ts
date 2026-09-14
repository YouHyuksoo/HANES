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
import { Warehouse } from '../../../../entities/warehouse.entity';
import { ProductInventoryService } from '../../../inventory/services/product-inventory.service';
import { WarehouseService } from '../../../inventory/services/warehouse.service';
import { MockLoggerService } from '@test/mock-logger.service';
import { NumberingService } from '../../../../shared/numbering.service';
import { TransactionService } from '../../../../shared/transaction.service';

describe('ReworkService policy', () => {
  let target: ReworkService;
  let mockReworkRepo: DeepMocked<Repository<ReworkOrder>>;
  let mockProcessRepo: DeepMocked<Repository<ReworkProcess>>;
  let mockDefectLogRepo: DeepMocked<Repository<DefectLog>>;
  let mockProductInventoryService: DeepMocked<ProductInventoryService>;
  let mockWarehouseService: DeepMocked<WarehouseService>;
  let mockTx: DeepMocked<TransactionService>;

  beforeEach(async () => {
    mockReworkRepo = createMock<Repository<ReworkOrder>>();
    mockProcessRepo = createMock<Repository<ReworkProcess>>();
    mockDefectLogRepo = createMock<Repository<DefectLog>>();
    mockProductInventoryService = createMock<ProductInventoryService>();
    mockWarehouseService = createMock<WarehouseService>();
    mockWarehouseService.getDefaultWarehouse.mockResolvedValue({ warehouseCode: 'WH-DEFECT' } as Warehouse);
    mockTx = createMock<TransactionService>();
    mockTx.run.mockImplementation(async (callback: any) => callback({
      query: jest.fn().mockResolvedValue([{ NEXT_SEQ: 1 }]),
      manager: {
        create: jest.fn((_: any, value: any) => value),
        save: jest.fn(async (_: any, value: any) => value),
        update: jest.fn(),
        findOne: jest.fn().mockResolvedValue({ itemCode: 'IT-1', itemType: 'SEMI_PRODUCT' }),
      },
    } as any));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReworkService,
        { provide: getRepositoryToken(ReworkOrder), useValue: mockReworkRepo },
        { provide: getRepositoryToken(ReworkInspect), useValue: createMock<Repository<ReworkInspect>>() },
        { provide: getRepositoryToken(ReworkProcess), useValue: mockProcessRepo },
        { provide: getRepositoryToken(DefectLog), useValue: mockDefectLogRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: createMock<Repository<ItemMaster>>() },
        { provide: ProductInventoryService, useValue: mockProductInventoryService },
        { provide: NumberingService, useValue: createMock<NumberingService>() },
        { provide: TransactionService, useValue: mockTx },
        { provide: WarehouseService, useValue: mockWarehouseService },
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

  describe('createInspect — 재작업 재고 이동 정책', () => {
    it('재작업 합격분을 불용창고에서 공정창고로 이동한다', async () => {
      mockReworkRepo.findOne.mockResolvedValue({
        reworkNo: 'RW-300',
        status: 'INSPECT_PENDING',
        itemCode: 'IT-1',
        resultQty: 5,
        company: 'CO',
        plant: 'P01',
      } as any);
      mockProcessRepo.find.mockResolvedValue([]);
      mockReworkRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockWarehouseService.getDefaultWarehouse.mockResolvedValue({ warehouseCode: 'WH-DEFECT' } as Warehouse);
      mockProductInventoryService.transferStockByItemInTx.mockResolvedValue(5);

      await target.createInspect(
        { reworkNo: 'RW-300', inspectResult: 'PASS', passQty: 5, failQty: 0, inspectorCode: 'QC1', inspectMethod: 'VISUAL' } as any,
        'CO',
        'P01',
        'user',
      );

      expect(mockProductInventoryService.transferStockByItemInTx).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ fromWarehouseId: 'WH-DEFECT', toWarehouseId: 'SFG_WIP' }),
      );
    });

    it('불용창고 재고가 부족하면 신규 입고로 보충하지 않고 실패한다', async () => {
      mockReworkRepo.findOne.mockResolvedValue({
        reworkNo: 'RW-301',
        status: 'INSPECT_PENDING',
        itemCode: 'IT-1',
        resultQty: 5,
        company: 'CO',
        plant: 'P01',
      } as any);
      mockProcessRepo.find.mockResolvedValue([]);
      mockReworkRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockWarehouseService.getDefaultWarehouse.mockResolvedValue({ warehouseCode: 'WH-DEFECT' } as Warehouse);
      mockProductInventoryService.transferStockByItemInTx.mockResolvedValue(2);

      await expect(target.createInspect(
        { reworkNo: 'RW-301', inspectResult: 'PASS', passQty: 5, failQty: 0, inspectorCode: 'QC1', inspectMethod: 'VISUAL' } as any,
        'CO',
        'P01',
        'user',
      )).rejects.toThrow(/재고가 부족/);

      expect(mockProductInventoryService.receiveStockInTx).not.toHaveBeenCalled();
    });
  });
});
