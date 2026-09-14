import { BadRequestException } from '@nestjs/common';
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
    const inspectPending = (reworkNo: string) => ({
      reworkNo,
      status: 'INSPECT_PENDING',
      itemCode: 'IT-1',
      resultQty: 5,
      company: 'CO',
      plant: 'P01',
    });

    beforeEach(() => {
      mockProcessRepo.find.mockResolvedValue([]);
      mockReworkRepo.update.mockResolvedValue({ affected: 1 } as any);
    });

    it('합격분은 불용창고의 DEFECT 재고를 출고하고 공정창고에 GOOD 으로 입고한다', async () => {
      mockReworkRepo.findOne.mockResolvedValue(inspectPending('RW-300') as any);

      await target.createInspect(
        { reworkNo: 'RW-300', inspectResult: 'PASS', passQty: 5, failQty: 0, inspectorCode: 'QC1', inspectMethod: 'VISUAL' } as any,
        'CO',
        'P01',
        'user',
      );

      expect(mockWarehouseService.getDefaultWarehouse).toHaveBeenCalledWith('UNUSABLE', 'CO', 'P01');
      expect(mockProductInventoryService.issueStockInTx).toHaveBeenCalledTimes(1);
      expect(mockProductInventoryService.issueStockInTx).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ warehouseId: 'WH-DEFECT', qualityStatus: 'DEFECT', qty: 5, refType: 'REWORK', refId: 'RW-300' }),
      );
      expect(mockProductInventoryService.receiveStockInTx).toHaveBeenCalledTimes(1);
      expect(mockProductInventoryService.receiveStockInTx).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ warehouseId: 'SFG_WIP', qualityStatus: 'GOOD', qty: 5, refType: 'REWORK', refId: 'RW-300' }),
      );
      // 출고 수량과 입고 수량이 같아야 한다 — 이동이지 신규 생성이 아니다
      const issued = mockProductInventoryService.issueStockInTx.mock.calls[0][1];
      const received = mockProductInventoryService.receiveStockInTx.mock.calls[0][1];
      expect(received.qty).toBe(issued.qty);
    });

    it('폐기분은 불량 상태 그대로 폐기창고로 옮기고 양품 입고는 하지 않는다', async () => {
      mockReworkRepo.findOne.mockResolvedValue(inspectPending('RW-302') as any);

      await target.createInspect(
        { reworkNo: 'RW-302', inspectResult: 'SCRAP', passQty: 0, failQty: 5, inspectorCode: 'QC1', inspectMethod: 'VISUAL' } as any,
        'CO',
        'P01',
        'user',
      );

      expect(mockProductInventoryService.issueStockInTx).toHaveBeenCalledTimes(1);
      expect(mockProductInventoryService.issueStockInTx).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ warehouseId: 'WH-DEFECT', toWarehouseId: 'SCRAP', qualityStatus: 'DEFECT', qty: 5 }),
      );
      expect(mockProductInventoryService.receiveStockInTx).not.toHaveBeenCalled();
    });

    it('불용창고 재고가 부족하면 신규 입고로 보충하지 않고 실패한다', async () => {
      mockReworkRepo.findOne.mockResolvedValue(inspectPending('RW-301') as any);
      mockProductInventoryService.issueStockInTx.mockRejectedValue(
        new BadRequestException('재고 부족으로 출고할 수 없습니다: IT-1 (가용 2, 요청 5)'),
      );

      await expect(target.createInspect(
        { reworkNo: 'RW-301', inspectResult: 'PASS', passQty: 5, failQty: 0, inspectorCode: 'QC1', inspectMethod: 'VISUAL' } as any,
        'CO',
        'P01',
        'user',
      )).rejects.toThrow(/재고 부족/);

      expect(mockProductInventoryService.receiveStockInTx).not.toHaveBeenCalled();
    });

    it('불용창고가 없으면 재고를 건드리지 않고 실패한다', async () => {
      mockReworkRepo.findOne.mockResolvedValue(inspectPending('RW-303') as any);
      mockWarehouseService.getDefaultWarehouse.mockResolvedValue(null);

      await expect(target.createInspect(
        { reworkNo: 'RW-303', inspectResult: 'PASS', passQty: 5, failQty: 0, inspectorCode: 'QC1', inspectMethod: 'VISUAL' } as any,
        'CO',
        'P01',
        'user',
      )).rejects.toThrow(/불용창고가 설정되어 있지 않습니다/);

      expect(mockProductInventoryService.issueStockInTx).not.toHaveBeenCalled();
      expect(mockProductInventoryService.receiveStockInTx).not.toHaveBeenCalled();
    });
  });
});
