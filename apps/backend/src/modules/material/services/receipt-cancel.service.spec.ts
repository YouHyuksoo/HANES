/**
 * @file src/modules/material/services/receipt-cancel.service.spec.ts
 * @description ReceiptCancelService 단위 테스트 - 입고취소 역분개 처리
 *
 * 초보자 가이드:
 * - findCancellable: 취소 가능한 입고 트랜잭션 목록 조회
 * - cancel: 원본 RECEIVE → 역분개 RECEIPT_CANCEL 트랜잭션 생성
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
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { MatReceiving } from '../../../entities/mat-receiving.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';
import { MockLoggerService } from '@test/mock-logger.service';

describe('ReceiptCancelService', () => {
  let target: ReceiptCancelService;
  let mockStockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let mockMatStockRepo: DeepMocked<Repository<MatStock>>;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockItemMasterRepo: DeepMocked<Repository<ItemMaster>>;
  let mockPartnerMasterRepo: DeepMocked<Repository<PartnerMaster>>;
  let mockWarehouseRepo: DeepMocked<Repository<Warehouse>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;
  let mockNumbering: DeepMocked<NumberingService>;
  let mockTx: DeepMocked<TransactionService>;

  beforeEach(async () => {
    mockStockTxRepo = createMock<Repository<StockTransaction>>();
    mockMatStockRepo = createMock<Repository<MatStock>>();
    mockMatLotRepo = createMock<Repository<MatLot>>();
    mockItemMasterRepo = createMock<Repository<ItemMaster>>();
    mockPartnerMasterRepo = createMock<Repository<PartnerMaster>>();
    mockWarehouseRepo = createMock<Repository<Warehouse>>();

    // enrichment 조회 기본값 (빈 배열)
    mockMatLotRepo.find.mockResolvedValue([]);
    mockItemMasterRepo.find.mockResolvedValue([]);
    mockPartnerMasterRepo.find.mockResolvedValue([]);
    mockWarehouseRepo.find.mockResolvedValue([]);
    mockDataSource = createMock<DataSource>();
    mockQueryRunner = createMock<QueryRunner>();
    mockNumbering = createMock<NumberingService>();
    mockTx = createMock<TransactionService>();

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockTx.run.mockImplementation(async (callback: any) => callback(mockQueryRunner));
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
        { provide: getRepositoryToken(ItemMaster), useValue: mockItemMasterRepo },
        { provide: getRepositoryToken(PartnerMaster), useValue: mockPartnerMasterRepo },
        { provide: getRepositoryToken(Warehouse), useValue: mockWarehouseRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: NumberingService, useValue: mockNumbering },
        { provide: TransactionService, useValue: mockTx },
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
        transNo: 'TX-001', cancelRefId: 'CANCEL-001', transType: 'RECEIVE',
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
        transNo: 'TX-001', cancelRefId: null, transType: 'RECEIVE',
        toWarehouseId: null, itemCode: 'ITEM-001', matUid: null, qty: 10,
      } as StockTransaction);

      await expect(
        target.cancel({ transactionId: 'TX-001', reason: '취소' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('재고 부족이면 BadRequestException', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({
          transNo: 'TX-001', cancelRefId: null, transType: 'RECEIVE',
          toWarehouseId: 'WH-01', itemCode: 'ITEM-001', matUid: null, qty: 100,
        } as StockTransaction)
        .mockResolvedValueOnce({ qty: 50, availableQty: 50 } as MatStock);

      await expect(
        target.cancel({ transactionId: 'TX-001', reason: '취소' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('요청 회사/공장과 다른 원본 입고 거래는 취소하지 않는다', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({
        transNo: 'TX-001',
        cancelRefId: null,
        transType: 'RECEIVE',
        toWarehouseId: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: null,
        qty: 10,
        company: 'OTHER',
        plant: 'P01',
      } as StockTransaction);

      await expect(
        target.cancel({ transactionId: 'TX-001', reason: '취소' } as any, 'HANES', 'P01'),
      ).rejects.toThrow(BadRequestException);

      expect(mockQueryRunner.manager.update).not.toHaveBeenCalled();
      expect(mockQueryRunner.manager.save).not.toHaveBeenCalled();
    });

    it('정상적으로 입고취소를 처리한다', async () => {
      const originalTx = {
        transNo: 'TX-001', cancelRefId: null, transType: 'RECEIVE',
        toWarehouseId: 'WH-01', itemCode: 'ITEM-001', matUid: null, qty: 10,
        refType: null, refId: null,
      } as StockTransaction;
      const stock = { warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: null, qty: 50, availableQty: 50 } as MatStock;
      const cancelTx = { transNo: 'CANCEL-001' } as StockTransaction;

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(originalTx) // 원본 트랜잭션
        .mockResolvedValueOnce(stock); // 재고
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
      mockNumbering.nextInTx.mockResolvedValue('CANCEL-001');
      (mockQueryRunner.manager.create as jest.Mock).mockReturnValue(cancelTx);
      (mockQueryRunner.manager.save as jest.Mock).mockResolvedValue(cancelTx);

      const result = await target.cancel({ transactionId: 'TX-001', reason: '취소' } as any);

      expect(result.cancelled).toBe(true);
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('입고취소는 원거래 회사/공장 범위에서 재고와 원거래를 갱신한다', async () => {
      const originalTx = {
        transNo: 'TX-001',
        cancelRefId: null,
        transType: 'RECEIVE',
        toWarehouseId: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: 10,
        refType: 'RECEIVE',
        refId: 'RCV-001-2',
        company: 'HANES',
        plant: 'P01',
      } as StockTransaction;
      const stock = {
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: 50,
        availableQty: 50,
        company: 'HANES',
        plant: 'P01',
      } as MatStock;
      const cancelTx = { transNo: 'CANCEL-001' } as StockTransaction;
      const matIssueRepo = { findOne: jest.fn().mockResolvedValue(null) };

      mockDataSource.getRepository.mockReturnValue(matIssueRepo as any);
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(originalTx)
        .mockResolvedValueOnce(stock);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
      mockNumbering.nextInTx.mockResolvedValue('CANCEL-001');
      (mockQueryRunner.manager.create as jest.Mock).mockReturnValue(cancelTx);
      (mockQueryRunner.manager.save as jest.Mock).mockResolvedValue(cancelTx);

      await (target as any).cancel({ transactionId: 'TX-001', reason: '취소' }, 'HANES', 'P01');

      expect(mockQueryRunner.manager.findOne).toHaveBeenNthCalledWith(1, StockTransaction, {
        where: { transNo: 'TX-001', company: 'HANES', plant: 'P01' },
      });
      expect(mockQueryRunner.manager.findOne).toHaveBeenNthCalledWith(2, MatStock, {
        where: {
          itemCode: 'ITEM-001',
          warehouseCode: 'WH-01',
          matUid: 'MAT-001',
          company: 'HANES',
          plant: 'P01',
        },
      });
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        MatStock,
        {
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          company: 'HANES',
          plant: 'P01',
        },
        { qty: 40, availableQty: 40 },
      );
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        StockTransaction,
        expect.objectContaining({ company: 'HANES', plant: 'P01' }),
      );
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        StockTransaction,
        { transNo: 'TX-001', company: 'HANES', plant: 'P01' },
        { cancelRefId: 'CANCEL-001', status: 'CANCELED' },
      );
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        MatReceiving,
        { receiveNo: 'RCV-001', seq: 2, company: 'HANES', plant: 'P01' },
        { status: 'CANCELED' },
      );
    });

    it('뒤 공정이 진행된 LOT는 입고취소를 차단한다', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({
        transNo: 'TX-010',
        cancelRefId: null,
        transType: 'RECEIVE',
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        qty: 10,
        toWarehouseId: 'WH-01',
      } as StockTransaction);

      const matIssueRepo = {
        findOne: jest.fn().mockResolvedValue({
          issueNo: 'ISS-001',
          seq: 1,
          orderNo: 'JO-001',
          prodResultNo: 'PR-001',
          status: 'DONE',
        }),
      };
      const prodResultRepo = {
        findOne: jest.fn().mockResolvedValue({
          resultNo: 'PR-001',
          status: 'DONE',
          prdUid: 'FG-001',
        }),
      };
      const fgLabelRepo = {
        findOne: jest.fn().mockResolvedValue({
          fgBarcode: 'FG-001',
          status: 'PACKED',
        }),
      };

      mockDataSource.getRepository.mockImplementation((entity: any) => {
        if (entity?.name === 'MatIssue') return matIssueRepo as any;
        if (entity?.name === 'ProdResult') return prodResultRepo as any;
        if (entity?.name === 'FgLabel') return fgLabelRepo as any;
        return createMock<Repository<any>>() as any;
      });

      await expect(
        target.cancel({ transactionId: 'TX-010', reason: '취소' } as any),
      ).rejects.toThrow('자재출고 순서로 역처리 후 다시 입고취소를 진행해 주세요.');
    });
  });
});
