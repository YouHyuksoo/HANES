/**
 * @file src/modules/material/services/arrival.service.spec.ts
 * @description ArrivalService 단위 테스트 - PO 입하, 수동 입하, 입하 취소
 *
 * 초보자 가이드:
 * - findReceivablePOs: CONFIRMED/PARTIAL 상태 PO 목록 조회
 * - createPoArrival: PO 기반 입하 (트랜잭션)
 * - cancel: 역분개 방식 입하 취소
 * - 실행: `npx jest --testPathPattern="arrival.service.spec"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { ArrivalService } from './arrival.service';
import { PurchaseOrder } from '../../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../../entities/purchase-order-item.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatArrival } from '../../../entities/mat-arrival.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { VendorBarcodeMapping } from '../../../entities/vendor-barcode-mapping.entity';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { NumRuleService } from '../../num-rule/num-rule.service';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('ArrivalService', () => {
  let target: ArrivalService;
  let mockPurchaseOrderRepo: DeepMocked<Repository<PurchaseOrder>>;
  let mockPurchaseOrderItemRepo: DeepMocked<Repository<PurchaseOrderItem>>;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockMatStockRepo: DeepMocked<Repository<MatStock>>;
  let mockMatArrivalRepo: DeepMocked<Repository<MatArrival>>;
  let mockStockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let mockPartMasterRepo: DeepMocked<Repository<PartMaster>>;
  let mockWarehouseRepo: DeepMocked<Repository<Warehouse>>;
  let mockVendorBarcodeRepo: DeepMocked<Repository<VendorBarcodeMapping>>;
  let mockIqcLogRepo: DeepMocked<Repository<IqcLog>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;
  let mockNumRuleService: DeepMocked<NumRuleService>;

  beforeEach(async () => {
    mockPurchaseOrderRepo = createMock<Repository<PurchaseOrder>>();
    mockPurchaseOrderItemRepo = createMock<Repository<PurchaseOrderItem>>();
    mockMatLotRepo = createMock<Repository<MatLot>>();
    mockMatStockRepo = createMock<Repository<MatStock>>();
    mockMatArrivalRepo = createMock<Repository<MatArrival>>();
    mockStockTxRepo = createMock<Repository<StockTransaction>>();
    mockPartMasterRepo = createMock<Repository<PartMaster>>();
    mockWarehouseRepo = createMock<Repository<Warehouse>>();
    mockVendorBarcodeRepo = createMock<Repository<VendorBarcodeMapping>>();
    mockIqcLogRepo = createMock<Repository<IqcLog>>();
    mockDataSource = createMock<DataSource>();
    mockQueryRunner = createMock<QueryRunner>();
    mockNumRuleService = createMock<NumRuleService>();

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArrivalService,
        { provide: getRepositoryToken(PurchaseOrder), useValue: mockPurchaseOrderRepo },
        { provide: getRepositoryToken(PurchaseOrderItem), useValue: mockPurchaseOrderItemRepo },
        { provide: getRepositoryToken(MatLot), useValue: mockMatLotRepo },
        { provide: getRepositoryToken(MatStock), useValue: mockMatStockRepo },
        { provide: getRepositoryToken(MatArrival), useValue: mockMatArrivalRepo },
        { provide: getRepositoryToken(StockTransaction), useValue: mockStockTxRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartMasterRepo },
        { provide: getRepositoryToken(Warehouse), useValue: mockWarehouseRepo },
        { provide: getRepositoryToken(VendorBarcodeMapping), useValue: mockVendorBarcodeRepo },
        { provide: getRepositoryToken(IqcLog), useValue: mockIqcLogRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: NumRuleService, useValue: mockNumRuleService },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<ArrivalService>(ArrivalService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findReceivablePOs ───
  describe('findReceivablePOs', () => {
    it('입하 가능 PO 목록을 반환한다', async () => {
      const po = { poNo: 'PO-001', status: 'CONFIRMED', orderDate: new Date() } as PurchaseOrder;
      mockPurchaseOrderRepo.find.mockResolvedValue([po]);
      mockPurchaseOrderItemRepo.find.mockResolvedValue([
        { poNo: 'PO-001', seq: 1, itemCode: 'ITEM-001', orderQty: 100, receivedQty: 0 } as PurchaseOrderItem,
      ]);
      mockPartMasterRepo.find.mockResolvedValue([
        { itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as PartMaster,
      ]);

      const result = await target.findReceivablePOs();

      expect(result).toHaveLength(1);
      expect(result[0].totalRemainingQty).toBe(100);
    });
  });

  // ─── getPoItems ───
  describe('getPoItems', () => {
    it('PO의 입하 가능 품목을 반환한다', async () => {
      mockPurchaseOrderRepo.findOne.mockResolvedValue({ poNo: 'PO-001' } as PurchaseOrder);
      mockPurchaseOrderItemRepo.find.mockResolvedValue([
        { poNo: 'PO-001', seq: 1, itemCode: 'ITEM-001', orderQty: 100, receivedQty: 50 } as PurchaseOrderItem,
      ]);
      mockPartMasterRepo.find.mockResolvedValue([
        { itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as PartMaster,
      ]);

      const result = await target.getPoItems('PO-001');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].remainingQty).toBe(50);
    });

    it('존재하지 않는 PO이면 NotFoundException', async () => {
      mockPurchaseOrderRepo.findOne.mockResolvedValue(null);

      await expect(target.getPoItems('NONE')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── createPoArrival ───
  describe('createPoArrival', () => {
    it('존재하지 않는 PO이면 NotFoundException', async () => {
      mockPurchaseOrderRepo.findOne.mockResolvedValue(null);

      await expect(
        target.createPoArrival({ poId: 'NONE', items: [] } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('입하 불가 상태이면 BadRequestException', async () => {
      mockPurchaseOrderRepo.findOne.mockResolvedValue({ poNo: 'PO-001', status: 'CLOSED' } as PurchaseOrder);

      await expect(
        target.createPoArrival({ poId: 'PO-001', items: [] } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── cancel ───
  describe('cancel', () => {
    it('존재하지 않는 트랜잭션이면 NotFoundException', async () => {
      mockStockTxRepo.findOne.mockResolvedValue(null);

      await expect(
        target.cancel({ transactionId: 'NONE' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('이미 취소된 트랜잭션이면 BadRequestException', async () => {
      mockStockTxRepo.findOne.mockResolvedValue({ transNo: 'TX-001', status: 'CANCELED' } as StockTransaction);

      await expect(
        target.cancel({ transactionId: 'TX-001' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('MAT_IN이 아닌 트랜잭션이면 BadRequestException', async () => {
      mockStockTxRepo.findOne.mockResolvedValue({ transNo: 'TX-001', status: 'DONE', transType: 'MAT_OUT' } as StockTransaction);

      await expect(
        target.cancel({ transactionId: 'TX-001' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── getStats ───
  describe('getStats', () => {
    it('오늘 입하 통계를 반환한다', async () => {
      mockStockTxRepo.count.mockResolvedValueOnce(5); // todayCount
      mockStockTxRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ sumQty: '500' }),
      } as any);
      mockPurchaseOrderRepo.count.mockResolvedValue(3); // unrecevedPoCount
      mockStockTxRepo.count.mockResolvedValueOnce(100); // totalCount

      const result = await target.getStats();

      expect(result.todayCount).toBe(5);
    });
  });

  // ─── findByBarcode ───
  describe('findByBarcode', () => {
    it('바코드로 입하 정보를 찾는다 (arrivalNo 매치)', async () => {
      const arrival = {
        arrivalNo: 'ARR-001', seq: 1, itemCode: 'ITEM-001',
        qty: 100, vendorName: 'VENDOR-A', poId: null, poItemId: null,
        poNo: null, iqcStatus: 'PASS',
      } as MatArrival;
      mockMatArrivalRepo.findOne.mockResolvedValueOnce(arrival);
      mockPartMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA', iqcYn: 'N' } as PartMaster);

      const result = await target.findByBarcode('ARR-001');

      expect(result.arrivalNo).toBe('ARR-001');
      expect(result.iqcStatus).toBe('NONE');
    });

    it('바코드에 해당하는 입하가 없으면 NotFoundException', async () => {
      mockMatArrivalRepo.findOne.mockResolvedValue(null);
      mockVendorBarcodeRepo.findOne.mockResolvedValue(null);

      await expect(target.findByBarcode('UNKNOWN')).rejects.toThrow(NotFoundException);
    });
  });
});
