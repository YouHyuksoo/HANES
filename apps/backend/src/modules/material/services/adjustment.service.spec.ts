import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { AdjustmentService } from './adjustment.service';
import { InvAdjLog } from '../../../entities/inv-adj-log.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { TransactionService } from '../../../shared/transaction.service';
import { NumberingService } from '../../../shared/numbering.service';
import { MockLoggerService } from '@test/mock-logger.service';

describe('AdjustmentService', () => {
  let service: AdjustmentService;
  let invAdjLogRepo: DeepMocked<Repository<InvAdjLog>>;
  let matStockRepo: DeepMocked<Repository<MatStock>>;
  let matLotRepo: DeepMocked<Repository<MatLot>>;
  let itemMasterRepo: DeepMocked<Repository<ItemMaster>>;
  let stockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let dataSource: DeepMocked<DataSource>;
  let queryRunner: DeepMocked<QueryRunner>;
  let tx: DeepMocked<TransactionService>;
  let qb: any;

  beforeEach(async () => {
    invAdjLogRepo = createMock<Repository<InvAdjLog>>();
    matStockRepo = createMock<Repository<MatStock>>();
    matLotRepo = createMock<Repository<MatLot>>();
    itemMasterRepo = createMock<Repository<ItemMaster>>();
    stockTxRepo = createMock<Repository<StockTransaction>>();
    dataSource = createMock<DataSource>();
    queryRunner = createMock<QueryRunner>();
    tx = createMock<TransactionService>();
    qb = {
      update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(), setParameters: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    queryRunner.manager.createQueryBuilder.mockReturnValue(qb);
    invAdjLogRepo.createQueryBuilder.mockReturnValue(qb);

    dataSource.createQueryRunner.mockReturnValue(queryRunner);
    tx.run.mockImplementation(async (callback: any) => callback(queryRunner));
    queryRunner.connect.mockResolvedValue(undefined);
    queryRunner.startTransaction.mockResolvedValue(undefined);
    queryRunner.commitTransaction.mockResolvedValue(undefined);
    queryRunner.rollbackTransaction.mockResolvedValue(undefined);
    queryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdjustmentService,
        { provide: getRepositoryToken(InvAdjLog), useValue: invAdjLogRepo },
        { provide: getRepositoryToken(MatStock), useValue: matStockRepo },
        { provide: getRepositoryToken(MatLot), useValue: matLotRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: itemMasterRepo },
        { provide: getRepositoryToken(StockTransaction), useValue: stockTxRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: TransactionService, useValue: tx },
        { provide: NumberingService, useValue: createMock<NumberingService>() },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    service = module.get(AdjustmentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('품목 마스터가 누락되어도 보정 이력의 원본 itemCode는 유지한다', async () => {
      invAdjLogRepo.find.mockResolvedValue([
        {
          adjDate: new Date('2026-04-11'),
          seq: 1,
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-MISSING',
          beforeQty: 10,
          afterQty: 12,
          diffQty: 2,
          reason: '보정',
        } as InvAdjLog,
      ]);
      invAdjLogRepo.count.mockResolvedValue(1);
      itemMasterRepo.find.mockResolvedValue([]);

      const result = await service.findAll({ page: 1, limit: 10 } as any);

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          itemCode: 'ITEM-MISSING',
          itemName: null,
          unit: null,
        }),
      );
    });

    it('보정 이력 품목 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      invAdjLogRepo.find.mockResolvedValue([
        {
          adjDate: new Date('2026-04-11'),
          seq: 1,
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          company: 'C1',
          plant: 'P1',
        } as InvAdjLog,
      ]);
      invAdjLogRepo.count.mockResolvedValue(1);
      itemMasterRepo.find.mockResolvedValue([]);

      await service.findAll({ page: 1, limit: 10 } as any, 'C1', 'P1');

      expect(itemMasterRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
    });
  });

  describe('createPending', () => {
    it('승인대기 보정 요청은 TransactionService로 보정이력 저장을 처리한다', async () => {
      const invAdjLog = {
        adjDate: new Date('2026-04-11'),
        seq: 1,
      } as InvAdjLog;
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ itemCode: 'ITEM-001', itemName: 'PART', unit: 'EA' } as ItemMaster)
        .mockResolvedValueOnce({
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: null,
          qty: 10,
          reservedQty: 0,
          company: 'HANES',
          plant: 'P01',
        } as MatStock);
      (queryRunner.manager.create as jest.Mock).mockReturnValue(invAdjLog);
      (queryRunner.manager.save as jest.Mock).mockResolvedValue(invAdjLog);

      const result = await service.createPending({
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        afterQty: 12,
        reason: '보정',
      } as any, 'HANES', 'P01');

      expect(result.adjustStatus).toBe('PENDING');
      expect(tx.run).toHaveBeenCalledTimes(1);
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(queryRunner.manager.save).toHaveBeenCalledWith(invAdjLog);
    });

    it('승인대기 보정 요청은 품목과 LOT를 요청 테넌트 범위에서 확인한다', async () => {
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ itemCode: 'ITEM-001', itemName: 'PART', unit: 'EA' } as ItemMaster)
        .mockResolvedValueOnce({ matUid: 'MAT-001', company: 'HANES', plant: 'P01' } as MatLot)
        .mockResolvedValueOnce({
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          reservedQty: 0,
          company: 'HANES',
          plant: 'P01',
        } as MatStock);
      (queryRunner.manager.create as jest.Mock).mockReturnValue({ adjDate: new Date('2026-04-11'), seq: 1 } as InvAdjLog);
      (queryRunner.manager.save as jest.Mock).mockResolvedValue({ adjDate: new Date('2026-04-11'), seq: 1 } as InvAdjLog);

      await service.createPending({
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        afterQty: 12,
        reason: '보정',
      } as any, 'HANES', 'P01');

      expect(queryRunner.manager.findOne).toHaveBeenNthCalledWith(1, ItemMaster, {
        where: { itemCode: 'ITEM-001', company: 'HANES', plant: 'P01' },
      });
      expect(queryRunner.manager.findOne).toHaveBeenNthCalledWith(2, MatLot, {
        where: { matUid: 'MAT-001', company: 'HANES', plant: 'P01' },
      });
    });

    it('예약수량보다 적게 보정 요청하면 차단한다', async () => {
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ itemCode: 'ITEM-001', itemName: 'PART' } as ItemMaster)
        .mockResolvedValueOnce({ matUid: 'MAT-001' } as MatLot)
        .mockResolvedValueOnce({
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          reservedQty: 6,
          company: 'HANES',
          plant: 'P01',
        } as MatStock);

      await expect(
        service.createPending({
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          afterQty: 5,
          reason: '보정',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('승인대기 보정 요청은 조회된 재고 테넌트가 요청 테넌트와 다르면 차단한다', async () => {
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ itemCode: 'ITEM-001', itemName: 'PART', unit: 'EA' } as ItemMaster)
        .mockResolvedValueOnce({
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: null,
          qty: 10,
          reservedQty: 0,
          company: 'OTHER',
          plant: 'P01',
        } as MatStock);

      await expect(
        service.createPending({
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          afterQty: 12,
          reason: '보정',
        } as any, 'HANES', 'P01'),
      ).rejects.toThrow(BadRequestException);
      expect(queryRunner.manager.create).not.toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    it('승인 반영은 TransactionService로 재고, 수불, 보정상태를 함께 저장한다', async () => {
      invAdjLogRepo.findOne.mockResolvedValue({
        adjDate: new Date('2026-04-11'),
        seq: 1,
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: null,
        afterQty: 15,
        diffQty: 5,
        reason: '보정',
        adjustStatus: 'PENDING',
        company: 'HANES',
        plant: 'P01',
      } as InvAdjLog);
      queryRunner.manager.findOne.mockResolvedValue({
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: null,
        qty: 10,
        reservedQty: 0,
      } as MatStock);
      stockTxRepo.findOne.mockResolvedValue(null);
      (queryRunner.manager.create as jest.Mock).mockReturnValue({ transNo: 'ADJ2026041100001' } as StockTransaction);
      (queryRunner.manager.save as jest.Mock).mockResolvedValue({ transNo: 'ADJ2026041100001' } as StockTransaction);

      const result = await service.approve('2026-04-11', 1, 'admin');

      expect(result.adjustStatus).toBe('APPROVED');
      expect(tx.run).toHaveBeenCalledTimes(1);
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
      // PENDING 인 요청만 선점(APPROVED 로 바꿈)
      expect(qb.update).toHaveBeenCalledWith(InvAdjLog);
      expect(qb.set).toHaveBeenCalledWith(expect.objectContaining({ adjustStatus: 'APPROVED' }));
      expect(qb.andWhere).toHaveBeenCalledWith('"ADJUST_STATUS" = :pendingStatus', { pendingStatus: 'PENDING' });
      // 재고는 읽은 값 대입이 아니라 차이(15-10=5)만큼 상대 갱신
      expect(qb.setParameters).toHaveBeenCalledWith({ adjustDelta: 5 });
      expect(queryRunner.manager.update).toHaveBeenCalledWith(InvAdjLog, {
        adjDate: new Date('2026-04-11'),
        seq: 1,
        company: 'HANES',
        plant: 'P01',
      }, { beforeQty: 10, diffQty: 5 });
    });

    it('승인 시점 재고가 요청 때와 달라졌으면 승인 시점 재고 기준 차이로 반영한다', async () => {
      invAdjLogRepo.findOne.mockResolvedValue({
        adjDate: new Date('2026-04-11'), seq: 1, warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: null,
        beforeQty: 10, afterQty: 15, diffQty: 5, reason: '보정', adjustStatus: 'PENDING', company: 'HANES', plant: 'P01',
      } as InvAdjLog);
      // 요청 이후 다른 입고로 재고가 12 가 됨
      queryRunner.manager.findOne.mockResolvedValue({
        warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: null, qty: 12, reservedQty: 0,
      } as MatStock);
      (queryRunner.manager.create as jest.Mock).mockReturnValue({ transNo: 'ADJ2026041100001' } as StockTransaction);
      (queryRunner.manager.save as jest.Mock).mockResolvedValue({ transNo: 'ADJ2026041100001' } as StockTransaction);

      await service.approve('2026-04-11', 1, 'admin');

      expect(qb.setParameters).toHaveBeenCalledWith({ adjustDelta: 3 });
      expect(queryRunner.manager.create).toHaveBeenCalledWith(StockTransaction, expect.objectContaining({ transType: 'ADJUST_IN', qty: 3 }));
      expect(queryRunner.manager.update).toHaveBeenCalledWith(InvAdjLog, expect.anything(), { beforeQty: 12, diffQty: 3 });
    });

    it('같은 요청을 동시에 두 번 승인하면 PENDING 선점에 실패한 쪽은 재고를 건드리지 않고 거절된다', async () => {
      invAdjLogRepo.findOne.mockResolvedValue({
        adjDate: new Date('2026-04-11'), seq: 1, warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: null,
        afterQty: 15, diffQty: 5, reason: '보정', adjustStatus: 'PENDING', company: 'HANES', plant: 'P01',
      } as InvAdjLog);
      qb.execute.mockResolvedValueOnce({ affected: 0 });

      await expect(service.approve('2026-04-11', 1, 'admin')).rejects.toThrow('이미 처리된 보정 요청입니다');
      expect(queryRunner.query).not.toHaveBeenCalled();
      expect(queryRunner.manager.save).not.toHaveBeenCalled();
    });

    it('승인 반영은 보정 이력 회사/공장 범위에서 재고와 LOT 상태를 갱신한다', async () => {
      invAdjLogRepo.findOne.mockResolvedValue({
        adjDate: new Date('2026-04-11'),
        seq: 1,
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        afterQty: 0,
        diffQty: -10,
        reason: '보정',
        adjustStatus: 'PENDING',
        company: 'HANES',
        plant: 'P01',
      } as InvAdjLog);
      queryRunner.manager.findOne.mockResolvedValue({
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: 10,
        reservedQty: 0,
        company: 'HANES',
        plant: 'P01',
      } as MatStock);
      stockTxRepo.findOne.mockResolvedValue(null);
      (queryRunner.manager.create as jest.Mock).mockReturnValue({ transNo: 'ADJ2026041100001' } as StockTransaction);
      (queryRunner.manager.save as jest.Mock).mockResolvedValue({ transNo: 'ADJ2026041100001' } as StockTransaction);

      await service.approve('2026-04-11', 1, 'admin', 'HANES', 'P01');

      expect(invAdjLogRepo.findOne).toHaveBeenCalledWith({
        where: { adjDate: new Date('2026-04-11'), seq: 1, company: 'HANES', plant: 'P01' },
      });
      expect(queryRunner.manager.findOne).toHaveBeenCalledWith(MatStock, {
        where: {
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          company: 'HANES',
          plant: 'P01',
        },
      });
      expect(queryRunner.manager.update).toHaveBeenCalledWith(
        MatLot,
        { matUid: 'MAT-001', company: 'HANES', plant: 'P01' },
        { status: 'DEPLETED' },
      );
      expect(queryRunner.manager.update).toHaveBeenCalledWith(
        InvAdjLog,
        { adjDate: new Date('2026-04-11'), seq: 1, company: 'HANES', plant: 'P01' },
        { beforeQty: 10, diffQty: -10 },
      );
      expect(qb.set).toHaveBeenCalledWith(expect.objectContaining({ adjustStatus: 'APPROVED' }));
    });

    it('예약수량보다 적게 승인 반영하면 차단한다', async () => {
      invAdjLogRepo.findOne.mockResolvedValue({
        adjDate: new Date('2026-04-11'),
        seq: 1,
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        afterQty: 5,
        diffQty: -5,
        reason: '보정',
        adjustStatus: 'PENDING',
        company: 'HANES',
        plant: 'P01',
      } as InvAdjLog);
      queryRunner.manager.findOne.mockResolvedValue({
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: 10,
        reservedQty: 6,
      } as MatStock);

      await expect(service.approve('2026-04-11', 1, 'admin')).rejects.toThrow(BadRequestException);
    });
  });

  describe('create', () => {
    it('즉시승인 보정은 TransactionService로 재고, 보정이력, 수불을 함께 저장한다', async () => {
      const invAdjLog = {
        adjDate: new Date('2026-04-11'),
        seq: 1,
      } as InvAdjLog;
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ itemCode: 'ITEM-001', itemName: 'PART', unit: 'EA' } as ItemMaster)
        .mockResolvedValueOnce({
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: null,
          qty: 10,
          reservedQty: 0,
          company: 'HANES',
          plant: 'P01',
        } as MatStock);
      stockTxRepo.findOne.mockResolvedValue(null);
      (queryRunner.manager.create as jest.Mock)
        .mockReturnValueOnce(invAdjLog)
        .mockReturnValueOnce({ transNo: 'ADJ2026041100001' } as StockTransaction);
      (queryRunner.manager.save as jest.Mock)
        .mockResolvedValueOnce(invAdjLog)
        .mockResolvedValueOnce({ transNo: 'ADJ2026041100001' } as StockTransaction);

      const result = await service.create({
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        afterQty: 12,
        reason: '보정',
      } as any, 'HANES', 'P01');

      expect(result.adjustStatus).toBe('APPROVED');
      expect(tx.run).toHaveBeenCalledTimes(1);
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(queryRunner.manager.save).toHaveBeenCalledWith(invAdjLog);
      // 재고 행을 먼저 잠근 뒤 읽고(lock → 재고 findOne), 12-10=2 를 상대 갱신한다
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringMatching(/^SELECT 1 FROM MAT_STOCKS WHERE .* FOR UPDATE$/),
        ['WH-01', 'ITEM-001', 'HANES', 'P01'],
      );
      const lockOrder = (queryRunner.query as jest.Mock).mock.invocationCallOrder[0];
      const stockReadOrder = (queryRunner.manager.findOne as jest.Mock).mock.invocationCallOrder[1];
      expect(lockOrder).toBeLessThan(stockReadOrder);
      expect(qb.setParameters).toHaveBeenCalledWith({ adjustDelta: 2 });
      expect(qb.set).toHaveBeenCalledWith({
        qty: expect.any(Function),
        availableQty: expect.any(Function),
      });
    });

    it('상대 갱신 행수가 1이 아니면 거절한다', async () => {
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ itemCode: 'ITEM-001', itemName: 'PART', unit: 'EA' } as ItemMaster)
        .mockResolvedValueOnce({
          warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: null, qty: 10, reservedQty: 0, company: 'HANES', plant: 'P01',
        } as MatStock);
      qb.execute.mockResolvedValueOnce({ affected: 0 });

      await expect(
        service.create({ warehouseCode: 'WH-01', itemCode: 'ITEM-001', afterQty: 12, reason: '보정' } as any, 'HANES', 'P01'),
      ).rejects.toThrow(BadRequestException);
      expect(queryRunner.manager.save).not.toHaveBeenCalled();
    });

    it('즉시승인 보정은 품목과 LOT를 요청 테넌트 범위에서 확인한다', async () => {
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ itemCode: 'ITEM-001', itemName: 'PART', unit: 'EA' } as ItemMaster)
        .mockResolvedValueOnce({ matUid: 'MAT-001', company: 'HANES', plant: 'P01' } as MatLot)
        .mockResolvedValueOnce({
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          reservedQty: 0,
          company: 'HANES',
          plant: 'P01',
        } as MatStock);
      stockTxRepo.findOne.mockResolvedValue(null);
      (queryRunner.manager.create as jest.Mock)
        .mockReturnValueOnce({ adjDate: new Date('2026-04-11'), seq: 1 } as InvAdjLog)
        .mockReturnValueOnce({ transNo: 'ADJ2026041100001' } as StockTransaction);
      (queryRunner.manager.save as jest.Mock)
        .mockResolvedValueOnce({ adjDate: new Date('2026-04-11'), seq: 1 } as InvAdjLog)
        .mockResolvedValueOnce({ transNo: 'ADJ2026041100001' } as StockTransaction);

      await service.create({
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        afterQty: 12,
        reason: '보정',
      } as any, 'HANES', 'P01');

      expect(queryRunner.manager.findOne).toHaveBeenNthCalledWith(1, ItemMaster, {
        where: { itemCode: 'ITEM-001', company: 'HANES', plant: 'P01' },
      });
      expect(queryRunner.manager.findOne).toHaveBeenNthCalledWith(2, MatLot, {
        where: { matUid: 'MAT-001', company: 'HANES', plant: 'P01' },
      });
    });

    it('즉시승인 보정은 조회된 재고 테넌트가 요청 테넌트와 다르면 차단한다', async () => {
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ itemCode: 'ITEM-001', itemName: 'PART', unit: 'EA' } as ItemMaster)
        .mockResolvedValueOnce({
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: null,
          qty: 10,
          reservedQty: 0,
          company: 'HANES',
          plant: 'OTHER',
        } as MatStock);

      await expect(
        service.create({
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          afterQty: 12,
          reason: '보정',
        } as any, 'HANES', 'P01'),
      ).rejects.toThrow(BadRequestException);
      expect(queryRunner.manager.update).not.toHaveBeenCalled();
      expect(queryRunner.manager.create).not.toHaveBeenCalled();
    });
  });
});
