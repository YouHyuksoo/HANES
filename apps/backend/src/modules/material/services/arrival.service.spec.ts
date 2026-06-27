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
import { MatArrivalStock } from '../../../entities/mat-arrival-stock.entity';
import { MatArrivalTransaction } from '../../../entities/mat-arrival-transaction.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { VendorBarcodeMapping } from '../../../entities/vendor-barcode-mapping.entity';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';
import { MockLoggerService } from '@test/mock-logger.service';

describe('ArrivalService', () => {
  let target: ArrivalService;
  let mockPurchaseOrderRepo: DeepMocked<Repository<PurchaseOrder>>;
  let mockPurchaseOrderItemRepo: DeepMocked<Repository<PurchaseOrderItem>>;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockMatStockRepo: DeepMocked<Repository<MatStock>>;
  let mockMatArrivalRepo: DeepMocked<Repository<MatArrival>>;
  let mockMatArrivalStockRepo: DeepMocked<Repository<MatArrivalStock>>;
  let mockMatArrivalTxRepo: DeepMocked<Repository<MatArrivalTransaction>>;
  let mockStockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let mockItemMasterRepo: DeepMocked<Repository<ItemMaster>>;
  let mockWarehouseRepo: DeepMocked<Repository<Warehouse>>;
  let mockVendorBarcodeRepo: DeepMocked<Repository<VendorBarcodeMapping>>;
  let mockIqcLogRepo: DeepMocked<Repository<IqcLog>>;
  let mockPartnerMasterRepo: DeepMocked<Repository<PartnerMaster>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;
  let mockNumbering: DeepMocked<NumberingService>;
  let mockTx: DeepMocked<TransactionService>;

  beforeEach(async () => {
    mockPurchaseOrderRepo = createMock<Repository<PurchaseOrder>>();
    mockPurchaseOrderItemRepo = createMock<Repository<PurchaseOrderItem>>();
    mockMatLotRepo = createMock<Repository<MatLot>>();
    mockMatStockRepo = createMock<Repository<MatStock>>();
    mockMatArrivalRepo = createMock<Repository<MatArrival>>();
    mockMatArrivalStockRepo = createMock<Repository<MatArrivalStock>>();
    mockMatArrivalTxRepo = createMock<Repository<MatArrivalTransaction>>();
    mockStockTxRepo = createMock<Repository<StockTransaction>>();
    mockItemMasterRepo = createMock<Repository<ItemMaster>>();
    mockWarehouseRepo = createMock<Repository<Warehouse>>();
    mockVendorBarcodeRepo = createMock<Repository<VendorBarcodeMapping>>();
    mockIqcLogRepo = createMock<Repository<IqcLog>>();
    mockPartnerMasterRepo = createMock<Repository<PartnerMaster>>();
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
        ArrivalService,
        { provide: getRepositoryToken(PurchaseOrder), useValue: mockPurchaseOrderRepo },
        { provide: getRepositoryToken(PurchaseOrderItem), useValue: mockPurchaseOrderItemRepo },
        { provide: getRepositoryToken(MatLot), useValue: mockMatLotRepo },
        { provide: getRepositoryToken(MatStock), useValue: mockMatStockRepo },
        { provide: getRepositoryToken(MatArrival), useValue: mockMatArrivalRepo },
        { provide: getRepositoryToken(MatArrivalStock), useValue: mockMatArrivalStockRepo },
        { provide: getRepositoryToken(MatArrivalTransaction), useValue: mockMatArrivalTxRepo },
        { provide: getRepositoryToken(StockTransaction), useValue: mockStockTxRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: mockItemMasterRepo },
        { provide: getRepositoryToken(Warehouse), useValue: mockWarehouseRepo },
        { provide: getRepositoryToken(VendorBarcodeMapping), useValue: mockVendorBarcodeRepo },
        { provide: getRepositoryToken(IqcLog), useValue: mockIqcLogRepo },
        { provide: getRepositoryToken(PartnerMaster), useValue: mockPartnerMasterRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: NumberingService, useValue: mockNumbering },
        { provide: TransactionService, useValue: mockTx },
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
      mockItemMasterRepo.find.mockResolvedValue([
        { itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as ItemMaster,
      ]);

      const result = await target.findReceivablePOs();

      expect(result).toHaveLength(1);
      expect(result[0].totalRemainingQty).toBe(100);
    });

    it('입하 가능 PO 품목과 품목마스터 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      const po = { poNo: 'PO-001', status: 'CONFIRMED', orderDate: new Date(), company: 'C1', plant: 'P1' } as PurchaseOrder;
      mockPurchaseOrderRepo.find.mockResolvedValue([po]);
      mockPurchaseOrderItemRepo.find.mockResolvedValue([
        { poNo: 'PO-001', seq: 1, itemCode: 'ITEM-001', orderQty: 100, receivedQty: 0, company: 'C1', plant: 'P1' } as PurchaseOrderItem,
      ]);
      mockItemMasterRepo.find.mockResolvedValue([]);

      await target.findReceivablePOs('C1', 'P1');

      expect(mockPurchaseOrderItemRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
      expect(mockItemMasterRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
    });
  });

  // ─── getPoItems ───
  describe('getPoItems', () => {
    it('PO의 입하 가능 품목을 반환한다', async () => {
      mockPurchaseOrderRepo.findOne.mockResolvedValue({ poNo: 'PO-001' } as PurchaseOrder);
      mockPurchaseOrderItemRepo.find.mockResolvedValue([
        { poNo: 'PO-001', seq: 1, itemCode: 'ITEM-001', orderQty: 100, receivedQty: 50 } as PurchaseOrderItem,
      ]);
      mockItemMasterRepo.find.mockResolvedValue([
        { itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as ItemMaster,
      ]);

      const result = await target.getPoItems('PO-001');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].remainingQty).toBe(50);
    });

    it('PO 품목 상세의 품목마스터 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      mockPurchaseOrderRepo.findOne.mockResolvedValue({ poNo: 'PO-001', company: 'C1', plant: 'P1' } as PurchaseOrder);
      mockPurchaseOrderItemRepo.find.mockResolvedValue([
        { poNo: 'PO-001', seq: 1, itemCode: 'ITEM-001', orderQty: 100, receivedQty: 50, company: 'C1', plant: 'P1' } as PurchaseOrderItem,
      ]);
      mockItemMasterRepo.find.mockResolvedValue([]);

      await target.getPoItems('PO-001', 'C1', 'P1');

      expect(mockItemMasterRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
    });

    it('품목마스터가 없어도 PO 품목 원본 itemCode는 유지한다', async () => {
      mockPurchaseOrderRepo.findOne.mockResolvedValue({ poNo: 'PO-001', company: 'C1', plant: 'P1' } as PurchaseOrder);
      mockPurchaseOrderItemRepo.find.mockResolvedValue([
        { poNo: 'PO-001', seq: 1, itemCode: 'ITEM-MISSING', orderQty: 100, receivedQty: 50, company: 'C1', plant: 'P1' } as PurchaseOrderItem,
      ]);
      mockItemMasterRepo.find.mockResolvedValue([]);

      const result = await target.getPoItems('PO-001', 'C1', 'P1');

      expect(result.items[0]).toEqual(
        expect.objectContaining({
          itemCode: 'ITEM-MISSING',
          itemName: undefined,
          unit: undefined,
        }),
      );
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

    it('PO 행의 회사/공장이 요청 테넌트와 다르면 입하를 생성하지 않는다', async () => {
      mockPurchaseOrderRepo.findOne.mockResolvedValue({
        poNo: 'PO-001',
        status: 'CONFIRMED',
        company: 'OTHER',
        plant: 'P01',
      } as PurchaseOrder);

      await expect(
        target.createPoArrival({
          poId: 'PO-001',
          items: [{ poItemId: '1', itemCode: 'ITEM-001', receivedQty: 1, warehouseId: 'WH-001' }],
        } as any, 'CO', 'P01'),
      ).rejects.toThrow('회사 정보가 일치하지 않습니다');

      expect(mockTx.run).not.toHaveBeenCalled();
    });

    it('PO 입하는 TransactionService로 입하, 수불, 재고, PO상태를 함께 저장한다', async () => {
      mockPurchaseOrderRepo.findOne.mockResolvedValue({
        poNo: 'PO-001',
        status: 'CONFIRMED',
        partnerCode: 'V-001',
        partnerName: 'Vendor',
        company: 'CO',
        plant: 'P01',
      } as PurchaseOrder);
      mockPurchaseOrderItemRepo.find.mockResolvedValue([
        { poNo: 'PO-001', seq: 1, itemCode: 'ITEM-001', orderQty: 10, receivedQty: 0, company: 'CO', plant: 'P01' } as PurchaseOrderItem,
      ]);
      mockStockTxRepo.find.mockResolvedValue([]);
      mockItemMasterRepo.find.mockResolvedValue([
        { itemCode: 'ITEM-001', itemName: 'Item', unit: 'EA' } as ItemMaster,
      ]);
      mockWarehouseRepo.find.mockResolvedValue([
        { warehouseCode: 'WH-001', warehouseName: 'Warehouse' } as Warehouse,
      ]);
      mockNumbering.nextInTx.mockResolvedValueOnce('ARR-PO-001');
      mockNumbering.nextMatSerial.mockResolvedValueOnce('MAT-PO-001');
      mockNumbering.next.mockResolvedValueOnce('TX-PO-001');

      const manager = {
        findOne: jest.fn().mockResolvedValue(null),
        find: jest.fn().mockResolvedValue([
          { poNo: 'PO-001', seq: 1, itemCode: 'ITEM-001', orderQty: 10, receivedQty: 10 } as PurchaseOrderItem,
        ]),
        create: jest.fn((entity, payload) => ({ ...payload })),
        save: jest.fn().mockImplementation(async (entity) => entity),
        update: jest.fn().mockResolvedValue(undefined),
      };
      (mockQueryRunner as any).manager = manager;

      const result = await target.createPoArrival({
        poId: 'PO-001',
        items: [{ poItemId: '1', itemCode: 'ITEM-001', receivedQty: 10, warehouseId: 'WH-001' }],
      } as any, 'CO', 'P01');

      expect(result[0].arrivalNo).toBe('ARR-PO-001');
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ arrivalNo: 'ARR-PO-001' }));
      expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ matUid: 'MAT-PO-001', initQty: 10 }));
      expect(manager.save).toHaveBeenCalledWith(
        MatArrivalTransaction,
        expect.objectContaining({ transNo: 'TX-PO-001', transType: 'ARRIVAL_IN', matUid: 'MAT-PO-001' }),
      );
      expect(manager.update).toHaveBeenCalledWith(
        PurchaseOrder,
        { poNo: 'PO-001', company: 'CO', plant: 'P01' },
        { status: 'RECEIVED' },
      );
    });

    it('PO 입하 응답 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      mockPurchaseOrderRepo.findOne.mockResolvedValue({
        poNo: 'PO-001',
        status: 'CONFIRMED',
        partnerCode: 'V-001',
        partnerName: 'Vendor',
        company: 'C1',
        plant: 'P1',
      } as PurchaseOrder);
      mockPurchaseOrderItemRepo.find.mockResolvedValue([
        { poNo: 'PO-001', seq: 1, itemCode: 'ITEM-001', orderQty: 10, receivedQty: 0, company: 'C1', plant: 'P1' } as PurchaseOrderItem,
      ]);
      mockStockTxRepo.find.mockResolvedValue([]);
      mockItemMasterRepo.find.mockResolvedValue([]);
      mockWarehouseRepo.find.mockResolvedValue([]);
      mockNumbering.nextInTx.mockResolvedValueOnce('ARR-PO-001');
      mockNumbering.nextMatSerial.mockResolvedValueOnce('MAT-PO-001');
      mockNumbering.next.mockResolvedValueOnce('TX-PO-001');
      (mockQueryRunner as any).manager = {
        findOne: jest.fn().mockResolvedValue(null),
        find: jest.fn().mockResolvedValue([
          { poNo: 'PO-001', seq: 1, itemCode: 'ITEM-001', orderQty: 10, receivedQty: 10 } as PurchaseOrderItem,
        ]),
        create: jest.fn((entity, payload) => ({ ...payload })),
        save: jest.fn().mockImplementation(async (entity) => entity),
        update: jest.fn().mockResolvedValue(undefined),
      };

      await target.createPoArrival({
        poId: 'PO-001',
        items: [{ poItemId: '1', itemCode: 'ITEM-001', receivedQty: 10, warehouseId: 'WH-001' }],
      } as any, 'C1', 'P1');

      expect(mockItemMasterRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
      expect(mockWarehouseRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
    });

    it('품목/창고 마스터가 누락되어도 PO 입하 결과의 원본 itemCode와 warehouseCode는 유지한다', async () => {
      mockPurchaseOrderRepo.findOne.mockResolvedValue({
        poNo: 'PO-001',
        status: 'CONFIRMED',
        partnerCode: 'V-001',
        partnerName: 'Vendor',
        company: 'CO',
        plant: 'P01',
      } as PurchaseOrder);
      mockPurchaseOrderItemRepo.find.mockResolvedValue([
        { poNo: 'PO-001', seq: 1, itemCode: 'ITEM-MISSING', orderQty: 10, receivedQty: 0, company: 'CO', plant: 'P01' } as PurchaseOrderItem,
      ]);
      mockStockTxRepo.find.mockResolvedValue([]);
      mockItemMasterRepo.find.mockResolvedValue([]);
      mockWarehouseRepo.find.mockResolvedValue([]);
      mockNumbering.nextInTx.mockResolvedValueOnce('ARR-PO-001');
      mockNumbering.nextMatSerial.mockResolvedValueOnce('MAT-PO-001');
      mockNumbering.next.mockResolvedValueOnce('TX-PO-001');

      const manager = {
        findOne: jest.fn().mockResolvedValue(null),
        find: jest.fn().mockResolvedValue([
          { poNo: 'PO-001', seq: 1, itemCode: 'ITEM-MISSING', orderQty: 10, receivedQty: 10 } as PurchaseOrderItem,
        ]),
        create: jest.fn((entity, payload) => ({ ...payload })),
        save: jest.fn().mockImplementation(async (entity) => entity),
        update: jest.fn().mockResolvedValue(undefined),
      };
      (mockQueryRunner as any).manager = manager;

      const result = await target.createPoArrival({
        poId: 'PO-001',
        items: [{ poItemId: '1', itemCode: 'ITEM-MISSING', receivedQty: 10, warehouseId: 'WH-MISSING' }],
      } as any, 'CO', 'P01');

      expect(result[0]).toEqual(
        expect.objectContaining({
          itemCode: 'ITEM-MISSING',
          itemName: null,
          unit: null,
          warehouseCode: 'WH-MISSING',
          warehouseName: null,
        }),
      );
      expect(manager.update).toHaveBeenCalledWith(
        PurchaseOrderItem,
        { poNo: 'PO-001', seq: 1, company: 'CO', plant: 'P01' },
        { receivedQty: 10 },
      );
      expect(manager.find).toHaveBeenCalledWith(PurchaseOrderItem, {
        where: { poNo: 'PO-001', company: 'CO', plant: 'P01' },
      });
      expect(manager.update).toHaveBeenCalledWith(
        PurchaseOrder,
        { poNo: 'PO-001', company: 'CO', plant: 'P01' },
        { status: 'RECEIVED' },
      );
    });
  });

  describe('createManualArrival', () => {
    it('수동 입하 등록은 TransactionService로 입하, 수불, 재고를 함께 저장한다', async () => {
      mockNumbering.nextInTx.mockResolvedValueOnce('ARR-001');
      mockNumbering.nextMatSerial.mockResolvedValueOnce('MAT-001');
      mockNumbering.next.mockResolvedValueOnce('TX-001');
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Item', unit: 'EA' } as ItemMaster);
      mockWarehouseRepo.findOne.mockResolvedValue({ warehouseCode: 'WH-001', warehouseName: 'Warehouse' } as Warehouse);

      const manager = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((entity, payload) => ({ ...payload })),
        save: jest.fn().mockImplementation(async (entity) => entity),
        update: jest.fn().mockResolvedValue(undefined),
      };
      (mockQueryRunner as any).manager = manager;

      const result = await target.createManualArrival({
        itemCode: 'ITEM-001',
        qty: 10,
        warehouseId: 'WH-001',
        workerId: 'user',
      } as any, 'CO', 'P01');

      expect(result.arrivalNo).toBe('ARR-001');
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ arrivalNo: 'ARR-001' }));
      expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ matUid: 'MAT-001', initQty: 10 }));
      expect(manager.save).toHaveBeenCalledWith(
        MatArrivalTransaction,
        expect.objectContaining({ transNo: 'TX-001', transType: 'ARRIVAL_IN', matUid: 'MAT-001' }),
      );
    });

    it('품목/창고 마스터가 누락되어도 수동 입하 결과의 원본 itemCode와 warehouseCode는 유지한다', async () => {
      mockNumbering.nextInTx.mockResolvedValueOnce('ARR-001');
      mockNumbering.nextMatSerial.mockResolvedValueOnce('MAT-001');
      mockNumbering.next.mockResolvedValueOnce('TX-001');
      mockItemMasterRepo.findOne.mockResolvedValue(null);
      mockWarehouseRepo.findOne.mockResolvedValue(null);

      const manager = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((entity, payload) => ({ ...payload })),
        save: jest.fn().mockImplementation(async (entity) => entity),
        update: jest.fn().mockResolvedValue(undefined),
      };
      (mockQueryRunner as any).manager = manager;

      const result = await target.createManualArrival({
        itemCode: 'ITEM-MISSING',
        qty: 10,
        warehouseId: 'WH-MISSING',
        workerId: 'user',
      } as any, 'CO', 'P01');

      expect(result).toEqual(
        expect.objectContaining({
          itemCode: 'ITEM-MISSING',
          itemName: null,
          unit: null,
          warehouseCode: 'WH-MISSING',
          warehouseName: null,
        }),
      );
    });

    it('수동 입하 결과의 품목마스터 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      mockNumbering.nextInTx.mockResolvedValueOnce('ARR-001');
      mockNumbering.nextMatSerial.mockResolvedValueOnce('MAT-001');
      mockNumbering.next.mockResolvedValueOnce('TX-001');
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Item', unit: 'EA' } as ItemMaster);
      mockWarehouseRepo.findOne.mockResolvedValue({ warehouseCode: 'WH-001', warehouseName: 'Warehouse' } as Warehouse);

      const manager = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((entity, payload) => ({ ...payload })),
        save: jest.fn().mockImplementation(async (entity) => entity),
        update: jest.fn().mockResolvedValue(undefined),
      };
      (mockQueryRunner as any).manager = manager;

      await target.createManualArrival({
        itemCode: 'ITEM-001',
        qty: 10,
        warehouseId: 'WH-001',
        workerId: 'user',
      } as any, 'C1', 'P1');

      expect(mockItemMasterRepo.findOne).toHaveBeenCalledWith({
        where: { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' },
      });
    });
  });

  describe('findAll', () => {
    it('보강 마스터가 누락되어도 수불 원본 itemCode와 toWarehouseId는 유지한다', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            transNo: 'TX-001',
            transType: 'ARRIVAL_IN',
            itemCode: 'ITEM-MISSING',
            matUid: 'MAT-MISSING',
            warehouseCode: 'WH-MISSING',
            qty: 10,
          } as MatArrivalTransaction,
        ]),
        getCount: jest.fn().mockResolvedValue(1),
      };
      mockMatArrivalTxRepo.createQueryBuilder.mockReturnValue(queryBuilder as any);
      mockItemMasterRepo.find.mockResolvedValue([]);
      mockMatLotRepo.find.mockResolvedValue([]);
      mockWarehouseRepo.find.mockResolvedValue([]);
      mockMatArrivalRepo.find.mockResolvedValue([]);

      const result = await target.findAll({ page: 1, limit: 10 });

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          itemCode: 'ITEM-MISSING',
          itemName: null,
          unit: null,
          matUid: 'MAT-MISSING',
          warehouseCode: 'WH-MISSING',
          warehouseName: null,
        }),
      );
    });

    it('입하 이력 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            transNo: 'TX-001',
            transType: 'ARRIVAL_IN',
            itemCode: 'ITEM-001',
            matUid: 'MAT-001',
            warehouseCode: 'WH-001',
            qty: 10,
            company: 'C1',
            plant: 'P1',
          } as MatArrivalTransaction,
        ]),
        getCount: jest.fn().mockResolvedValue(1),
      };
      mockMatArrivalTxRepo.createQueryBuilder.mockReturnValue(queryBuilder as any);
      mockItemMasterRepo.find.mockResolvedValue([]);
      mockMatLotRepo.find.mockResolvedValue([]);
      mockWarehouseRepo.find.mockResolvedValue([]);
      mockMatArrivalRepo.find.mockResolvedValue([]);

      await target.findAll({ page: 1, limit: 10 }, 'C1', 'P1');

      expect(mockItemMasterRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
      expect(mockMatLotRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
      expect(mockWarehouseRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
      expect(mockMatArrivalRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
    });

    it('입하 이력 검색은 실제 ITEM_MASTERS.ITEM_NAME 컬럼을 사용한다', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getCount: jest.fn().mockResolvedValue(0),
      };
      mockMatArrivalTxRepo.createQueryBuilder.mockReturnValue(queryBuilder as any);
      mockItemMasterRepo.find.mockResolvedValue([]);
      mockMatLotRepo.find.mockResolvedValue([]);
      mockWarehouseRepo.find.mockResolvedValue([]);
      mockMatArrivalRepo.find.mockResolvedValue([]);

      await target.findAll({ page: 1, limit: 10, search: 'LEAD' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('UPPER(item_name) LIKE :search'),
        { search: '%LEAD%' },
      );
      expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('part_name'),
        expect.anything(),
      );
    });

    it('입하 이력 보강은 품목만이 아니라 거래 refId의 arrivalNo로 매칭한다', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            transNo: 'TX-002',
            transType: 'ARRIVAL_IN',
            itemCode: 'ITEM-001',
            matUid: 'MAT-002',
            warehouseCode: 'WH-001',
            refType: 'ARRIVAL',
            refId: 'ARR-002',
            qty: 1,
            company: 'C1',
            plant: 'P1',
          } as MatArrivalTransaction,
        ]),
        getCount: jest.fn().mockResolvedValue(1),
      };
      mockMatArrivalTxRepo.createQueryBuilder.mockReturnValue(queryBuilder as any);
      mockItemMasterRepo.find.mockResolvedValue([]);
      mockMatLotRepo.find.mockResolvedValue([
        { matUid: 'MAT-002', itemCode: 'ITEM-001', arrivalNo: 'ARR-002', arrivalSeq: 1, company: 'C1', plant: 'P1' } as MatLot,
      ]);
      mockWarehouseRepo.find.mockResolvedValue([]);
      mockMatArrivalRepo.find.mockResolvedValue([
        { arrivalNo: 'ARR-002', seq: 1, itemCode: 'ITEM-001', vendorCode: 'V-002', company: 'C1', plant: 'P1' } as MatArrival,
      ]);

      const result = await target.findAll({ page: 1, limit: 10 }, 'C1', 'P1');

      expect(mockMatArrivalRepo.find).toHaveBeenCalledWith({
        where: expect.arrayContaining([
          expect.objectContaining({ arrivalNo: 'ARR-002', seq: 1, itemCode: 'ITEM-001', company: 'C1', plant: 'P1' }),
        ]),
      });
      expect(result.data[0]).toEqual(expect.objectContaining({ arrivalNo: 'ARR-002', vendorCode: 'V-002' }));
    });
  });

  // ─── cancel ───
  describe('cancel', () => {
    it('존재하지 않는 트랜잭션이면 NotFoundException', async () => {
      mockMatArrivalTxRepo.findOne.mockResolvedValue(null);

      await expect(
        target.cancel({ transactionId: 'NONE' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('이미 취소된 트랜잭션이면 BadRequestException', async () => {
      mockMatArrivalTxRepo.findOne.mockResolvedValue({ transNo: 'TX-001', status: 'CANCELED' } as MatArrivalTransaction);

      await expect(
        target.cancel({ transactionId: 'TX-001' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('ARRIVAL_IN이 아닌 트랜잭션이면 BadRequestException', async () => {
      mockMatArrivalTxRepo.findOne.mockResolvedValue({ transNo: 'TX-001', status: 'DONE', transType: 'ARRIVAL_CANCEL' } as MatArrivalTransaction);

      await expect(
        target.cancel({ transactionId: 'TX-001' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('뒤 공정이 진행된 LOT는 취소를 차단한다', async () => {
      mockMatArrivalTxRepo.findOne.mockResolvedValue({
        transNo: 'TX-002',
        status: 'DONE',
        transType: 'ARRIVAL_IN',
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        qty: 10,
        warehouseCode: 'WH-001',
      } as MatArrivalTransaction);
      mockIqcLogRepo.findOne.mockResolvedValue(null);

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

      await expect(target.cancel({ transactionId: 'TX-002' } as any)).rejects.toThrow(
        '자재출고 순서로 역처리 후 다시 입하를 취소해 주세요.',
      );
    });

    it('입하 취소는 TransactionService로 원본취소, 역분개, 재고차감을 함께 저장한다', async () => {
      mockMatArrivalTxRepo.findOne.mockResolvedValue({
        transNo: 'TX-003',
        status: 'DONE',
        transType: 'ARRIVAL_IN',
        matUid: 'MAT-003',
        itemCode: 'ITEM-001',
        qty: 10,
        warehouseCode: 'WH-001',
        refType: 'MANUAL',
        refId: null,
        company: 'CO',
        plant: 'P01',
      } as MatArrivalTransaction);
      mockIqcLogRepo.findOne.mockResolvedValue(null);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Item', unit: 'EA' } as ItemMaster);
      mockWarehouseRepo.findOne.mockResolvedValue({ warehouseCode: 'WH-001', warehouseName: 'Warehouse' } as Warehouse);
      mockDataSource.getRepository.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
      } as any);

      const manager = {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ matUid: 'MAT-003', itemCode: 'ITEM-001', qty: 10, availableQty: 10, company: 'CO', plant: 'P01' } as MatArrivalStock),
        create: jest.fn((entity, payload) => ({ ...payload })),
        save: jest.fn().mockImplementation(async (entity) => entity),
        update: jest.fn().mockResolvedValue(undefined),
      };
      (mockQueryRunner as any).manager = manager;

      const result = await target.cancel({ transactionId: 'TX-003', reason: 'cancel', workerId: 'user' } as any, 'CO', 'P01');

      expect(result.transNo).toBe('TX-003-C');
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(manager.update).toHaveBeenCalledWith(
        MatArrivalTransaction,
        { transNo: 'TX-003', company: 'CO', plant: 'P01' },
        { status: 'CANCELED' },
      );
      expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ transNo: 'TX-003-C', transType: 'ARRIVAL_CANCEL' }));
    });

    it('입하 취소는 원본 트랜잭션 테넌트가 요청 테넌트와 다르면 후속 조회를 실행하지 않는다', async () => {
      mockMatArrivalTxRepo.findOne.mockResolvedValue({
        transNo: 'TX-003',
        status: 'DONE',
        transType: 'ARRIVAL_IN',
        matUid: 'MAT-003',
        itemCode: 'ITEM-001',
        qty: 10,
        warehouseCode: 'WH-001',
        refType: 'MANUAL',
        refId: 'ARR-001',
        company: 'OTHER',
        plant: 'P01',
      } as MatArrivalTransaction);

      await expect(
        target.cancel({ transactionId: 'TX-003', reason: 'cancel', workerId: 'user' } as any, 'CO', 'P01'),
      ).rejects.toThrow(BadRequestException);

      expect(mockIqcLogRepo.findOne).not.toHaveBeenCalled();
      expect(mockTx.run).not.toHaveBeenCalled();
    });

    it('보강 마스터가 누락되어도 입하 취소 결과의 원본 itemCode, matUid, warehouseCode는 유지한다', async () => {
      mockMatArrivalTxRepo.findOne.mockResolvedValue({
        transNo: 'TX-004',
        status: 'DONE',
        transType: 'ARRIVAL_IN',
        matUid: 'MAT-MISSING',
        itemCode: 'ITEM-MISSING',
        qty: 10,
        warehouseCode: 'WH-MISSING',
        refType: 'MANUAL',
        refId: null,
        company: 'CO',
        plant: 'P01',
      } as MatArrivalTransaction);
      mockIqcLogRepo.findOne.mockResolvedValue(null);
      mockItemMasterRepo.findOne.mockResolvedValue(null);
      mockMatLotRepo.findOne.mockResolvedValue(null);
      mockWarehouseRepo.findOne.mockResolvedValue(null);
      mockDataSource.getRepository.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
      } as any);

      const manager = {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ warehouseCode: 'WH-MISSING', itemCode: 'ITEM-MISSING', matUid: 'MAT-MISSING', qty: 10, availableQty: 10, company: 'CO', plant: 'P01' } as MatArrivalStock),
        create: jest.fn((entity, payload) => ({ ...payload })),
        save: jest.fn().mockImplementation(async (entity) => entity),
        update: jest.fn().mockResolvedValue(undefined),
      };
      (mockQueryRunner as any).manager = manager;

      const result = await target.cancel({ transactionId: 'TX-004', reason: 'cancel', workerId: 'user' } as any, 'CO', 'P01');

      expect(result).toEqual(
        expect.objectContaining({
          itemCode: 'ITEM-MISSING',
          itemName: null,
          unit: null,
          matUid: 'MAT-MISSING',
          warehouseCode: 'WH-MISSING',
          warehouseName: null,
        }),
      );
    });

    it('입하 취소의 IQC/품목마스터 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      mockMatArrivalTxRepo.findOne.mockResolvedValue({
        transNo: 'TX-005',
        status: 'DONE',
        transType: 'ARRIVAL_IN',
        matUid: 'MAT-005',
        itemCode: 'ITEM-001',
        qty: 10,
        warehouseCode: 'WH-001',
        refType: 'MANUAL',
        refId: 'ARR-001',
        company: 'C1',
        plant: 'P1',
      } as MatArrivalTransaction);
      mockIqcLogRepo.findOne.mockResolvedValue(null);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Item', unit: 'EA' } as ItemMaster);
      mockWarehouseRepo.findOne.mockResolvedValue({ warehouseCode: 'WH-001', warehouseName: 'Warehouse' } as Warehouse);
      mockDataSource.getRepository.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
      } as any);

      const manager = {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ warehouseCode: 'WH-001', itemCode: 'ITEM-001', matUid: 'MAT-005', qty: 10, availableQty: 10, company: 'C1', plant: 'P1' } as MatArrivalStock),
        create: jest.fn((entity, payload) => ({ ...payload })),
        save: jest.fn().mockImplementation(async (entity) => entity),
        update: jest.fn().mockResolvedValue(undefined),
      };
      (mockQueryRunner as any).manager = manager;

      await target.cancel({ transactionId: 'TX-005', reason: 'cancel', workerId: 'user' } as any, 'C1', 'P1');

      expect(mockIqcLogRepo.findOne).toHaveBeenCalledWith({
        where: { arrivalNo: 'ARR-001', itemCode: 'ITEM-001', company: 'C1', plant: 'P1' },
        order: { inspectDate: 'DESC' },
      });
      expect(mockItemMasterRepo.findOne).toHaveBeenCalledWith({
        where: { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' },
      });
    });
  });

  // ─── getStats ───
  describe('getStats', () => {
    it('오늘 입하 통계를 반환한다', async () => {
      mockMatArrivalTxRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(5),
        getRawOne: jest.fn().mockResolvedValue({ sumQty: '500' }),
      } as any);
      mockPurchaseOrderRepo.count.mockResolvedValue(3); // unrecevedPoCount
      mockMatArrivalTxRepo.count.mockResolvedValueOnce(100); // totalCount

      const result = await target.getStats();

      expect(result.todayCount).toBe(5);
    });
  });

  describe('getArrivalStockStatus', () => {
    it('품목 마스터가 누락되어도 입하 원본 itemCode는 유지한다', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            arrivalNo: 'ARR-001',
            seq: 1,
            invoiceNo: 'INV-001',
            poNo: null,
            vendorName: 'Vendor',
            itemCode: 'ITEM-MISSING',
            qty: 10,
            warehouseCode: 'WH-MISSING',
            arrivalType: 'MANUAL',
            arrivalDate: new Date('2026-04-11'),
          } as MatArrival,
        ]),
      };
      mockMatArrivalRepo.createQueryBuilder.mockReturnValue(queryBuilder as any);
      mockItemMasterRepo.find.mockResolvedValue([]);
      mockWarehouseRepo.find.mockResolvedValue([]);
      mockMatArrivalStockRepo.find.mockResolvedValue([]);

      const result = await target.getArrivalStockStatus({ page: 1, limit: 20 });

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          arrivalNo: 'ARR-001',
          itemCode: 'ITEM-MISSING',
          itemName: null,
          unit: null,
          warehouseName: 'WH-MISSING',
        }),
      );
      expect(result.stats.partCount).toBe(1);
    });

    it('입하재고현황의 품목/창고 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            arrivalNo: 'ARR-001',
            seq: 1,
            itemCode: 'ITEM-001',
            qty: 10,
            warehouseCode: 'WH-001',
            arrivalType: 'MANUAL',
            arrivalDate: new Date('2026-04-11'),
            status: 'DONE',
            company: 'C1',
            plant: 'P1',
          } as MatArrival,
        ]),
      };
      mockMatArrivalRepo.createQueryBuilder.mockReturnValue(queryBuilder as any);
      mockItemMasterRepo.find.mockResolvedValue([]);
      mockWarehouseRepo.find.mockResolvedValue([]);
      mockMatArrivalStockRepo.find.mockResolvedValue([]);

      await target.getArrivalStockStatus({ page: 1, limit: 20 }, 'C1', 'P1');

      expect(mockItemMasterRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
      expect(mockWarehouseRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
    });
  });

  describe('receivePoLine', () => {
    it('불량/폐기 창고로 PO 라인 입하를 등록하지 않는다', async () => {
      const manager = {
        findOne: jest
          .fn()
          .mockResolvedValueOnce({
            poNo: 'PO-001',
            lineNo: 1,
            revNo: 1,
            seq: 1,
            itemCode: 'ITEM-001',
            orderQty: 10,
            receivedQty: 0,
          } as PurchaseOrderItem)
          .mockResolvedValueOnce({
            poNo: 'PO-001',
            partnerCode: 'V001',
            partnerName: 'Vendor',
          } as PurchaseOrder)
          .mockResolvedValueOnce({
            partnerCode: 'M001',
            partnerType: 'MFG',
          } as PartnerMaster)
          .mockResolvedValueOnce({
            warehouseCode: 'DEFECT',
            warehouseType: 'DEFECT',
          } as Warehouse),
        save: jest.fn(),
      };
      (mockQueryRunner as any).manager = manager;

      await expect(
        target.receivePoLine({
          poNo: 'PO-001',
          lineNo: 1,
          revNo: 1,
          receivedQty: 1,
          mfgPartnerCode: 'M001',
          receivedDate: '2026-05-30',
          warehouseCode: 'DEFECT',
        } as any, { username: 'tester', company: 'C1', plant: 'P1' }),
      ).rejects.toThrow('원자재 창고만 선택');

      expect(manager.save).not.toHaveBeenCalled();
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
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA', iqcYn: 'N' } as ItemMaster);

      const result = await target.findByBarcode('ARR-001');

      expect(result.arrivalNo).toBe('ARR-001');
      expect(result.iqcStatus).toBe('NONE');
    });

    it('바코드에 해당하는 입하가 없으면 NotFoundException', async () => {
      mockMatArrivalRepo.findOne.mockResolvedValue(null);
      mockVendorBarcodeRepo.findOne.mockResolvedValue(null);

      await expect(target.findByBarcode('UNKNOWN')).rejects.toThrow(NotFoundException);
    });

    it('벤더 바코드 매핑과 품목마스터 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      const arrival = {
        arrivalNo: 'ARR-002',
        seq: 1,
        itemCode: 'ITEM-001',
        qty: 10,
        vendorName: 'VENDOR-A',
        poId: null,
        poItemId: null,
        poNo: null,
        iqcStatus: 'PASS',
        company: 'C1',
        plant: 'P1',
      } as MatArrival;
      mockMatArrivalRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(arrival);
      mockVendorBarcodeRepo.findOne.mockResolvedValue({
        vendorBarcode: 'VB-001',
        itemCode: 'ITEM-001',
        useYn: 'Y',
        company: 'C1',
        plant: 'P1',
      } as VendorBarcodeMapping);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Item', unit: 'EA', iqcYn: 'N' } as ItemMaster);

      const result = await target.findByBarcode('VB-001', 'C1', 'P1');

      expect(result.arrivalNo).toBe('ARR-002');
      expect(mockVendorBarcodeRepo.findOne).toHaveBeenCalledWith({
        where: { vendorBarcode: 'VB-001', useYn: 'Y', company: 'C1', plant: 'P1' },
      });
      expect(mockItemMasterRepo.findOne).toHaveBeenCalledWith({
        where: { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' },
      });
    });
  });
});
