/**
 * @file src/modules/material/services/receipt-cancel.service.spec.ts
 * @description ReceiptCancelService 단위 테스트 - 입고취소 역분개 처리
 *
 * 초보자 가이드:
 * - findCancellable: 취소 가능한 입고 트랜잭션 목록 조회
 * - cancel: 원본 RECEIPT → 역분개 RECEIPT_CANCEL 트랜잭션 생성
 * - 실행: `npx jest --testPathPattern="receipt-cancel.service.spec"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { ReceiptCancelService } from './receipt-cancel.service';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { PurchaseOrderItem } from '../../../entities/purchase-order-item.entity';
import { NumRuleService } from '../../num-rule/num-rule.service';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('ReceiptCancelService', () => {
  let target: ReceiptCancelService;
  let mockStockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let mockMatStockRepo: DeepMocked<Repository<MatStock>>;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockPoItemRepo: DeepMocked<Repository<PurchaseOrderItem>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;
  let mockNumRuleService: DeepMocked<NumRuleService>;

  beforeEach(async () => {
    mockStockTxRepo = createMock<Repository<StockTransaction>>();
    mockMatStockRepo = createMock<Repository<MatStock>>();
    mockMatLotRepo = createMock<Repository<MatLot>>();
    mockPoItemRepo = createMock<Repository<PurchaseOrderItem>>();
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
        ReceiptCancelService,
        { provide: getRepositoryToken(StockTransaction), useValue: mockStockTxRepo },
        { provide: getRepositoryToken(MatStock), useValue: mockMatStockRepo },
        { provide: getRepositoryToken(MatLot), useValue: mockMatLotRepo },
        { provide: getRepositoryToken(PurchaseOrderItem), useValue: mockPoItemRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: NumRuleService, useValue: mockNumRuleService },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<ReceiptCancelService>(ReceiptCancelService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findCancellable ───
  describe('findCancellable', () => {
    it('취소 가능한 입고 트랜잭션 목록을 반환한다', async () => {
      mockStockTxRepo.find.mockResolvedValue([{ transNo: 'TX-001' } as StockTransaction]);
      mockStockTxRepo.count.mockResolvedValue(1);

      const result = await target.findCancellable({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
    });
  });

  // ─── cancel ───
  describe('cancel', () => {
    it('존재하지 않는 트랜잭션이면 NotFoundException', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(null);

      await expect(
        target.cancel({ transactionId: 'NONE', reason: '취소' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('이미 취소된 트랜잭션이면 BadRequestException', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({
        transNo: 'TX-001', cancelRefId: 'CANCEL-001', transType: 'RECEIPT',
      } as StockTransaction);

      await expect(
        target.cancel({ transactionId: 'TX-001', reason: '취소' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('RECEIPT가 아닌 트랜잭션이면 BadRequestException', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({
        transNo: 'TX-001', cancelRefId: null, transType: 'MAT_OUT',
      } as StockTransaction);

      await expect(
        target.cancel({ transactionId: 'TX-001', reason: '취소' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('입고 창고 정보가 없으면 BadRequestException', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({
        transNo: 'TX-001', cancelRefId: null, transType: 'RECEIPT',
        toWarehouseId: null, itemCode: 'ITEM-001', matUid: null, qty: 10,
      } as StockTransaction);

      await expect(
        target.cancel({ transactionId: 'TX-001', reason: '취소' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('재고 부족이면 BadRequestException', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({
          transNo: 'TX-001', cancelRefId: null, transType: 'RECEIPT',
          toWarehouseId: 'WH-01', itemCode: 'ITEM-001', matUid: null, qty: 100,
        } as StockTransaction)
        .mockResolvedValueOnce({ qty: 50, availableQty: 50 } as MatStock);

      await expect(
        target.cancel({ transactionId: 'TX-001', reason: '취소' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('정상적으로 입고취소를 처리한다', async () => {
      const originalTx = {
        transNo: 'TX-001', cancelRefId: null, transType: 'RECEIPT',
        toWarehouseId: 'WH-01', itemCode: 'ITEM-001', matUid: null, qty: 10,
        refType: null, refId: null,
      } as StockTransaction;
      const stock = { warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: null, qty: 50, availableQty: 50 } as MatStock;
      const cancelTx = { transNo: 'CANCEL-001' } as StockTransaction;

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(originalTx) // 원본 트랜잭션
        .mockResolvedValueOnce(stock); // 재고
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
      mockNumRuleService.nextNumberInTx.mockResolvedValue('CANCEL-001');
      mockQueryRunner.manager.create.mockReturnValue(cancelTx);
      mockQueryRunner.manager.save.mockResolvedValue(cancelTx);

      const result = await target.cancel({ transactionId: 'TX-001', reason: '취소' } as any);

      expect(result.cancelled).toBe(true);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });
});
