import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { MatOutRequestService } from './mat-out-request.service';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('MatOutRequestService', () => {
  let service: MatOutRequestService;
  let stockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let matStockRepo: DeepMocked<Repository<MatStock>>;
  let matLotRepo: DeepMocked<Repository<MatLot>>;
  let dataSource: DeepMocked<DataSource>;
  let tx: DeepMocked<TransactionService>;
  let queryRunner: DeepMocked<QueryRunner>;
  let numbering: DeepMocked<NumberingService>;

  beforeEach(async () => {
    stockTxRepo = createMock<Repository<StockTransaction>>();
    matStockRepo = createMock<Repository<MatStock>>();
    matLotRepo = createMock<Repository<MatLot>>();
    dataSource = createMock<DataSource>();
    tx = createMock<TransactionService>();
    queryRunner = createMock<QueryRunner>();
    numbering = createMock<NumberingService>();

    dataSource.createQueryRunner.mockReturnValue(queryRunner);
    tx.run.mockImplementation(async (callback: any) => callback(queryRunner));
    queryRunner.connect.mockResolvedValue(undefined);
    queryRunner.startTransaction.mockResolvedValue(undefined);
    queryRunner.commitTransaction.mockResolvedValue(undefined);
    queryRunner.rollbackTransaction.mockResolvedValue(undefined);
    queryRunner.release.mockResolvedValue(undefined);
    numbering.nextInTx.mockResolvedValue('TX-001');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatOutRequestService,
        { provide: getRepositoryToken(StockTransaction), useValue: stockTxRepo },
        { provide: getRepositoryToken(MatStock), useValue: matStockRepo },
        { provide: getRepositoryToken(MatLot), useValue: matLotRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: NumberingService, useValue: numbering },
        { provide: TransactionService, useValue: tx },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    service = module.get(MatOutRequestService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('blocks request for HOLD lot', async () => {
      matLotRepo.findOne.mockResolvedValue({ matUid: 'MAT-001', status: 'HOLD' } as MatLot);

      await expect(
        service.create({
          matUid: 'MAT-001',
          itemCode: 'ITEM-001',
          qty: 1,
          outType: 'SCRAP',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates reservedQty and availableQty when creating request', async () => {
      matLotRepo.findOne.mockResolvedValue({ matUid: 'MAT-001', status: 'NORMAL' } as MatLot);
      matStockRepo.findOne.mockResolvedValue({
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: 10,
        reservedQty: 2,
        availableQty: 8,
      } as MatStock);
      queryRunner.manager.create.mockReturnValue({ transNo: 'TX-001' } as any);
      queryRunner.manager.save.mockResolvedValue({ transNo: 'TX-001' } as any);

      await service.create({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        qty: 3,
        outType: 'SCRAP',
      });

      expect(queryRunner.manager.update).toHaveBeenCalledWith(
        MatStock,
        { warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001' },
        expect.objectContaining({ reservedQty: 5, availableQty: 5 }),
      );
      expect(tx.run).toHaveBeenCalledTimes(1);
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('blocks request when availableQty is insufficient', async () => {
      matLotRepo.findOne.mockResolvedValue({ matUid: 'MAT-001', status: 'NORMAL' } as MatLot);
      matStockRepo.findOne.mockResolvedValue({
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: 10,
        reservedQty: 2,
        availableQty: 1,
      } as MatStock);

      await expect(
        service.create({
          matUid: 'MAT-001',
          itemCode: 'ITEM-001',
          qty: 2,
          outType: 'SCRAP',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approve', () => {
    it('blocks approve for HOLD lot', async () => {
      stockTxRepo.findOne.mockResolvedValue({
        transNo: 'TX-001',
        status: 'PENDING_APPROVAL',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: -2,
      } as StockTransaction);
      matLotRepo.findOne.mockResolvedValue({ matUid: 'MAT-001', status: 'HOLD' } as MatLot);

      await expect(service.approve('TX-001', 'approver')).rejects.toThrow(BadRequestException);
    });

    it('blocks approve when physical stock is insufficient', async () => {
      stockTxRepo.findOne.mockResolvedValue({
        transNo: 'TX-001',
        status: 'PENDING_APPROVAL',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: -5,
      } as StockTransaction);
      matLotRepo.findOne.mockResolvedValue({ matUid: 'MAT-001', status: 'NORMAL' } as MatLot);
      matStockRepo.findOne.mockResolvedValue({
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: 3,
        reservedQty: 5,
        availableQty: 0,
      } as MatStock);

      await expect(service.approve('TX-001', 'approver')).rejects.toThrow(BadRequestException);
    });

    it('approve는 요청 트랜잭션의 회사/공장/출고창고 범위에서 재고를 차감한다', async () => {
      stockTxRepo.findOne.mockResolvedValue({
        transNo: 'TX-001',
        status: 'PENDING_APPROVAL',
        fromWarehouseId: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: -3,
        company: 'HANES',
        plant: 'P01',
      } as StockTransaction);
      matLotRepo.findOne.mockResolvedValue({
        matUid: 'MAT-001',
        status: 'NORMAL',
        company: 'HANES',
        plant: 'P01',
      } as MatLot);
      matStockRepo.findOne.mockResolvedValue({
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: 10,
        reservedQty: 5,
        availableQty: 5,
        company: 'HANES',
        plant: 'P01',
      } as MatStock);

      await (service as any).approve('TX-001', 'approver', 'HANES', 'P01');

      expect(stockTxRepo.findOne).toHaveBeenCalledWith({
        where: { transNo: 'TX-001', company: 'HANES', plant: 'P01' },
      });
      expect(matLotRepo.findOne).toHaveBeenCalledWith({
        where: { matUid: 'MAT-001', company: 'HANES', plant: 'P01' },
      });
      expect(matStockRepo.findOne).toHaveBeenCalledWith({
        where: {
          warehouseCode: 'WH-01',
          matUid: 'MAT-001',
          itemCode: 'ITEM-001',
          company: 'HANES',
          plant: 'P01',
        },
      });
      expect(matStockRepo.update).toHaveBeenCalledWith(
        {
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          company: 'HANES',
          plant: 'P01',
        },
        expect.objectContaining({ qty: 7, reservedQty: 2, availableQty: 5 }),
      );
      expect(stockTxRepo.update).toHaveBeenCalledWith(
        { transNo: 'TX-001', company: 'HANES', plant: 'P01' },
        expect.objectContaining({ status: 'DONE', approverId: 'approver' }),
      );
    });

    it('rejects approve when the request transaction belongs to a different tenant', async () => {
      stockTxRepo.findOne.mockResolvedValue({
        transNo: 'TX-001',
        status: 'PENDING_APPROVAL',
        fromWarehouseId: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: -3,
        company: 'OTHER',
        plant: 'P01',
      } as StockTransaction);
      matLotRepo.findOne.mockResolvedValue({ matUid: 'MAT-001', status: 'NORMAL', company: 'OTHER', plant: 'P01' } as MatLot);
      matStockRepo.findOne.mockResolvedValue({
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: 10,
        reservedQty: 5,
        availableQty: 5,
        company: 'OTHER',
        plant: 'P01',
      } as MatStock);

      await expect(service.approve('TX-001', 'approver', 'HANES', 'P01')).rejects.toThrow(BadRequestException);
      expect(matLotRepo.findOne).not.toHaveBeenCalled();
      expect(matStockRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('restores reservedQty and availableQty on reject', async () => {
      stockTxRepo.findOne.mockResolvedValue({
        transNo: 'TX-001',
        status: 'PENDING_APPROVAL',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: -3,
      } as StockTransaction);
      matStockRepo.findOne.mockResolvedValue({
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: 10,
        reservedQty: 5,
        availableQty: 5,
      } as MatStock);

      await service.reject('TX-001', 'approver');

      expect(matStockRepo.update).toHaveBeenCalledWith(
        { warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001' },
        expect.objectContaining({ reservedQty: 2, availableQty: 8 }),
      );
    });

    it('reject는 요청 트랜잭션의 회사/공장/출고창고 범위에서 예약재고를 해제한다', async () => {
      stockTxRepo.findOne.mockResolvedValue({
        transNo: 'TX-001',
        status: 'PENDING_APPROVAL',
        fromWarehouseId: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: -3,
        company: 'HANES',
        plant: 'P01',
      } as StockTransaction);
      matStockRepo.findOne.mockResolvedValue({
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: 10,
        reservedQty: 5,
        availableQty: 5,
        company: 'HANES',
        plant: 'P01',
      } as MatStock);

      await (service as any).reject('TX-001', 'approver', 'HANES', 'P01');

      expect(stockTxRepo.findOne).toHaveBeenCalledWith({
        where: { transNo: 'TX-001', company: 'HANES', plant: 'P01' },
      });
      expect(matStockRepo.findOne).toHaveBeenCalledWith({
        where: {
          warehouseCode: 'WH-01',
          matUid: 'MAT-001',
          itemCode: 'ITEM-001',
          company: 'HANES',
          plant: 'P01',
        },
      });
      expect(matStockRepo.update).toHaveBeenCalledWith(
        {
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          company: 'HANES',
          plant: 'P01',
        },
        expect.objectContaining({ reservedQty: 2, availableQty: 8 }),
      );
      expect(stockTxRepo.update).toHaveBeenCalledWith(
        { transNo: 'TX-001', company: 'HANES', plant: 'P01' },
        expect.objectContaining({ status: 'REJECTED', approverId: 'approver' }),
      );
    });

    it('rejects reject when the request transaction belongs to a different tenant', async () => {
      stockTxRepo.findOne.mockResolvedValue({
        transNo: 'TX-001',
        status: 'PENDING_APPROVAL',
        fromWarehouseId: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: -3,
        company: 'OTHER',
        plant: 'P01',
      } as StockTransaction);
      matStockRepo.findOne.mockResolvedValue({
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: 10,
        reservedQty: 5,
        availableQty: 5,
        company: 'OTHER',
        plant: 'P01',
      } as MatStock);

      await expect(service.reject('TX-001', 'approver', 'HANES', 'P01')).rejects.toThrow(BadRequestException);
      expect(matStockRepo.findOne).not.toHaveBeenCalled();
      expect(stockTxRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('rejects cancel when the request transaction belongs to a different tenant', async () => {
      stockTxRepo.findOne.mockResolvedValue({
        transNo: 'TX-001',
        status: 'PENDING_APPROVAL',
        fromWarehouseId: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: -3,
        company: 'OTHER',
        plant: 'P01',
      } as StockTransaction);
      matStockRepo.findOne.mockResolvedValue({
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: 10,
        reservedQty: 5,
        availableQty: 5,
        company: 'OTHER',
        plant: 'P01',
      } as MatStock);

      await expect(service.cancel('TX-001', 'HANES', 'P01')).rejects.toThrow(BadRequestException);
      expect(matStockRepo.findOne).not.toHaveBeenCalled();
      expect(stockTxRepo.update).not.toHaveBeenCalled();
    });
  });
});
