import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { ReceivingService } from './receiving.service';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatArrivalStock } from '../../../entities/mat-arrival-stock.entity';
import { MatArrival } from '../../../entities/mat-arrival.entity';
import { MatReceiving } from '../../../entities/mat-receiving.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { PurchaseOrder } from '../../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../../entities/purchase-order-item.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { LabelPrintLog } from '../../../entities/label-print-log.entity';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';
import { SysConfigService } from '../../system/services/sys-config.service';
import { parseDateStart } from '../../../shared/date.util';
import { MockLoggerService } from '@test/mock-logger.service';

describe('ReceivingService', () => {
  let target: ReceivingService;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockMatStockRepo: DeepMocked<Repository<MatStock>>;
  let mockMatArrivalRepo: DeepMocked<Repository<MatArrival>>;
  let mockMatReceivingRepo: DeepMocked<Repository<MatReceiving>>;
  let mockStockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let mockItemMasterRepo: DeepMocked<Repository<ItemMaster>>;
  let mockPartnerMasterRepo: DeepMocked<Repository<PartnerMaster>>;
  let mockPurchaseOrderRepo: DeepMocked<Repository<PurchaseOrder>>;
  let mockPurchaseOrderItemRepo: DeepMocked<Repository<PurchaseOrderItem>>;
  let mockWarehouseRepo: DeepMocked<Repository<Warehouse>>;
  let mockLabelPrintLogRepo: DeepMocked<Repository<LabelPrintLog>>;
  let mockIqcLogRepo: DeepMocked<Repository<IqcLog>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;
  let mockNumbering: DeepMocked<NumberingService>;
  let mockTx: DeepMocked<TransactionService>;
  let mockSysConfigService: DeepMocked<SysConfigService>;

  beforeEach(async () => {
    mockMatLotRepo = createMock<Repository<MatLot>>();
    mockMatStockRepo = createMock<Repository<MatStock>>();
    mockMatArrivalRepo = createMock<Repository<MatArrival>>();
    mockMatReceivingRepo = createMock<Repository<MatReceiving>>();
    mockStockTxRepo = createMock<Repository<StockTransaction>>();
    mockItemMasterRepo = createMock<Repository<ItemMaster>>();
    mockPartnerMasterRepo = createMock<Repository<PartnerMaster>>();
    mockPartnerMasterRepo.find.mockResolvedValue([]);
    mockPurchaseOrderRepo = createMock<Repository<PurchaseOrder>>();
    mockPurchaseOrderItemRepo = createMock<Repository<PurchaseOrderItem>>();
    mockWarehouseRepo = createMock<Repository<Warehouse>>();
    mockLabelPrintLogRepo = createMock<Repository<LabelPrintLog>>();
    mockIqcLogRepo = createMock<Repository<IqcLog>>();
    mockDataSource = createMock<DataSource>();
    mockQueryRunner = createMock<QueryRunner>();
    mockNumbering = createMock<NumberingService>();
    mockTx = createMock<TransactionService>();
    mockSysConfigService = createMock<SysConfigService>();

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockTx.run.mockImplementation(async (callback: any) => callback(mockQueryRunner));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceivingService,
        { provide: getRepositoryToken(MatLot), useValue: mockMatLotRepo },
        { provide: getRepositoryToken(MatStock), useValue: mockMatStockRepo },
        { provide: getRepositoryToken(MatArrival), useValue: mockMatArrivalRepo },
        { provide: getRepositoryToken(MatReceiving), useValue: mockMatReceivingRepo },
        { provide: getRepositoryToken(StockTransaction), useValue: mockStockTxRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: mockItemMasterRepo },
        { provide: getRepositoryToken(PartnerMaster), useValue: mockPartnerMasterRepo },
        { provide: getRepositoryToken(PurchaseOrder), useValue: mockPurchaseOrderRepo },
        { provide: getRepositoryToken(PurchaseOrderItem), useValue: mockPurchaseOrderItemRepo },
        { provide: getRepositoryToken(Warehouse), useValue: mockWarehouseRepo },
        { provide: getRepositoryToken(LabelPrintLog), useValue: mockLabelPrintLogRepo },
        { provide: getRepositoryToken(IqcLog), useValue: mockIqcLogRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: NumberingService, useValue: mockNumbering },
        { provide: TransactionService, useValue: mockTx },
        { provide: SysConfigService, useValue: mockSysConfigService },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get(ReceivingService);
  });

  afterEach(() => jest.clearAllMocks());

  it('findAll 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          receiveNo: 'RCV-001',
          seq: 1,
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          warehouseCode: 'WH-01',
          qty: 5,
          status: 'DONE',
          receiveDate: new Date('2026-05-23'),
          company: 'C1',
          plant: 'P1',
        } as MatReceiving,
      ]),
      getCount: jest.fn().mockResolvedValue(1),
    };
    mockMatReceivingRepo.createQueryBuilder.mockReturnValue(queryBuilder as any);
    mockItemMasterRepo.find.mockResolvedValue([]);
    mockMatLotRepo.find.mockResolvedValue([
      {
        matUid: 'MAT-001',
        poNo: 'PO-001',
        iqcStatus: 'FAIL',
        specialAcceptYn: 'Y',
        company: 'C1',
        plant: 'P1',
      } as MatLot,
    ]);
    mockWarehouseRepo.find.mockResolvedValue([]);

    const result = await target.findAll({ page: 1, limit: 10 }, 'C1', 'P1');

    expect(mockItemMasterRepo.find).toHaveBeenCalledWith({
      where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
    });
    expect(mockMatLotRepo.find).toHaveBeenCalledWith({
      where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
    });
    expect(mockWarehouseRepo.find).toHaveBeenCalledWith({
      where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
    });
    expect(result.data[0]).toEqual(expect.objectContaining({
      isConcession: true,
      specialAcceptYn: 'Y',
    }));
    expect(result.data[0].lot).toEqual(expect.objectContaining({
      matUid: 'MAT-001',
      poNo: 'PO-001',
      iqcStatus: 'FAIL',
      specialAcceptYn: 'Y',
    }));
  });

  it('findReceivable prefers the actual arrival warehouse over the default warehouse', async () => {
    mockMatLotRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { matUid: 'MAT-001', itemCode: 'ITEM-001', initQty: 100, arrivalNo: 'ARR-001', arrivalSeq: 1 } as MatLot,
      ]),
    } as any);
    mockStockTxRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    } as any);
    mockWarehouseRepo.findOne.mockResolvedValue({ warehouseCode: 'DEF', warehouseName: 'Default' } as Warehouse);
    mockMatArrivalRepo.find.mockResolvedValue([
      { arrivalNo: 'ARR-001', seq: 1, itemCode: 'ITEM-001', warehouseCode: 'ARR' } as MatArrival,
    ]);
    mockWarehouseRepo.find.mockResolvedValue([
      { warehouseCode: 'ARR', warehouseName: 'Arrival' } as Warehouse,
    ]);
    mockItemMasterRepo.find.mockResolvedValue([
      { itemCode: 'ITEM-001', itemName: 'Wire', unit: 'EA', expiryDate: 0 } as ItemMaster,
    ]);
    mockLabelPrintLogRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    } as any);

    const result = await target.findReceivable();

    expect(result[0].arrivalWarehouseCode).toBe('ARR');
    expect(result[0].arrivalWarehouseName).toBe('Arrival');
  });

  it('findReceivable 입고수량 집계도 요청 테넌트 범위로 제한한다', async () => {
    const receiveTxQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    mockMatLotRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { matUid: 'MAT-001', itemCode: 'ITEM-001', initQty: 100, company: 'C1', plant: 'P1' } as MatLot,
      ]),
    } as any);
    mockStockTxRepo.createQueryBuilder.mockReturnValue(receiveTxQb as any);
    mockMatArrivalRepo.find.mockResolvedValue([]);
    mockWarehouseRepo.findOne.mockResolvedValue({ warehouseCode: 'DEF', warehouseName: 'Default', company: 'C1', plant: 'P1' } as Warehouse);
    mockWarehouseRepo.find.mockResolvedValue([]);
    mockItemMasterRepo.find.mockResolvedValue([]);
    mockLabelPrintLogRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    } as any);

    await target.findReceivable('C1', 'P1');

    expect(receiveTxQb.andWhere).toHaveBeenCalledWith('tx.company = :company', { company: 'C1' });
    expect(receiveTxQb.andWhere).toHaveBeenCalledWith('tx.plant = :plant', { plant: 'P1' });
  });

  it('findReceivable는 같은 품목의 다른 입하창고가 아니라 LOT의 입하번호/순번 창고를 사용한다', async () => {
    mockMatLotRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          matUid: 'MAT-001',
          itemCode: 'ITEM-001',
          initQty: 100,
          arrivalNo: 'ARR-LOT',
          arrivalSeq: 2,
          company: 'C1',
          plant: 'P1',
        } as MatLot,
      ]),
    } as any);
    mockStockTxRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    } as any);
    mockMatArrivalRepo.find.mockResolvedValue([
      { arrivalNo: 'ARR-OTHER', seq: 1, itemCode: 'ITEM-001', warehouseCode: 'WRONG' } as MatArrival,
      { arrivalNo: 'ARR-LOT', seq: 2, itemCode: 'ITEM-001', warehouseCode: 'RIGHT' } as MatArrival,
    ]);
    mockWarehouseRepo.findOne.mockResolvedValue({ warehouseCode: 'DEF', warehouseName: 'Default' } as Warehouse);
    mockWarehouseRepo.find.mockResolvedValue([
      { warehouseCode: 'RIGHT', warehouseName: 'Right Warehouse' } as Warehouse,
      { warehouseCode: 'WRONG', warehouseName: 'Wrong Warehouse' } as Warehouse,
    ]);
    mockItemMasterRepo.find.mockResolvedValue([]);
    mockLabelPrintLogRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    } as any);

    const result = await target.findReceivable('C1', 'P1');

    expect(mockMatArrivalRepo.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.arrayContaining([
        expect.objectContaining({ arrivalNo: 'ARR-LOT', seq: 2, itemCode: 'ITEM-001', company: 'C1', plant: 'P1' }),
      ]),
    }));
    expect(result[0].arrivalWarehouseCode).toBe('RIGHT');
    expect(result[0].arrivalWarehouseName).toBe('Right Warehouse');
  });

  it('findReceivable 품목 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
    mockMatLotRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { matUid: 'MAT-001', itemCode: 'ITEM-001', initQty: 100, company: 'C1', plant: 'P1' } as MatLot,
      ]),
    } as any);
    mockStockTxRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    } as any);
    mockMatArrivalRepo.find.mockResolvedValue([]);
    mockWarehouseRepo.findOne.mockResolvedValue({ warehouseCode: 'DEF', warehouseName: 'Default', company: 'C1', plant: 'P1' } as Warehouse);
    mockItemMasterRepo.find.mockResolvedValue([]);
    mockLabelPrintLogRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    } as any);

    await target.findReceivable('C1', 'P1');

    expect(mockItemMasterRepo.find).toHaveBeenCalledWith({
      where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
    });
  });

  it('createBulkReceive uses TransactionService for receiving, stock, and transaction writes', async () => {
    const lot = {
      matUid: 'MAT-001',
      itemCode: 'ITEM-001',
      initQty: 10,
      iqcStatus: 'PASS',
      arrivalNo: 'ARR-001',
      arrivalSeq: 1,
      company: 'CO',
      plant: 'P01',
    } as MatLot;
    mockMatLotRepo.findOne.mockResolvedValue(lot);
    mockStockTxRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ sumQty: '0' }),
    } as any);
    mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', iqcYn: 'N' } as ItemMaster);
    mockNumbering.nextInTx
      .mockResolvedValueOnce('RCV-001')
      .mockResolvedValueOnce('TX-001');

    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(lot)
        .mockResolvedValueOnce({ arrivalNo: 'ARR-001', seq: 1, warehouseCode: 'ARR-WH', company: 'CO', plant: 'P01' } as MatArrival)
        .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-001', qty: 10, availableQty: 10, company: 'CO', plant: 'P01' } as MatArrivalStock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null),
      create: jest.fn((entity, payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (entity) => entity),
      update: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;

    await target.createBulkReceive({
      workerId: 'user',
      items: [{ matUid: 'MAT-001', qty: 5, warehouseId: 'MAIN-WH', vendorBarcode: 'VENDOR-001' }],
    } as any, 'CO', 'P01');

    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ receiveNo: 'RCV-001', vendorBarcode: 'VENDOR-001' }));
    expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ transNo: 'TX-001', transType: 'RECEIVE' }));
    expect(manager.findOne).toHaveBeenCalledWith(MatArrivalStock, {
      where: { matUid: 'MAT-001', itemCode: 'ITEM-001', company: 'CO', plant: 'P01' },
    });
  });

  it('createBulkReceive는 프론트 입고 화면의 warehouseCode 요청도 입고 창고로 처리한다', async () => {
    const lot = {
      matUid: 'MAT-001',
      itemCode: 'ITEM-001',
      initQty: 10,
      iqcStatus: 'PASS',
      arrivalNo: 'ARR-001',
      arrivalSeq: 1,
      company: 'CO',
      plant: 'P01',
    } as MatLot;
    mockMatLotRepo.findOne.mockResolvedValue(lot);
    mockStockTxRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ sumQty: '0' }),
    } as any);
    mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', iqcYn: 'N' } as ItemMaster);
    mockNumbering.nextInTx
      .mockResolvedValueOnce('RCV-001')
      .mockResolvedValueOnce('TX-001');

    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(lot)
        .mockResolvedValueOnce({ arrivalNo: 'ARR-001', seq: 1, warehouseCode: 'ARR-WH', company: 'CO', plant: 'P01' } as MatArrival)
        .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-001', qty: 10, availableQty: 10, company: 'CO', plant: 'P01' } as MatArrivalStock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null),
      create: jest.fn((entity, payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (entity) => entity),
      update: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;

    await target.createBulkReceive({
      workerId: 'user',
      items: [{ matUid: 'MAT-001', qty: 5, warehouseCode: 'MAIN-WH' }],
    } as any, 'CO', 'P01');

    expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({
      receiveNo: 'RCV-001',
      warehouseCode: 'MAIN-WH',
    }));
    expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({
      transNo: 'TX-001',
      toWarehouseId: 'MAIN-WH',
    }));
  });

  it('findReceivable는 IQC 대상품의 PASS 성적서가 없어도 입고 차단 사유를 만들지 않는다', async () => {
    mockMatLotRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          matUid: 'MAT-001',
          itemCode: 'ITEM-001',
          initQty: 10,
          iqcStatus: 'PASS',
          arrivalNo: 'ARR-001',
          arrivalSeq: 1,
          company: 'CO',
          plant: 'P01',
        } as MatLot,
      ]),
    } as any);
    mockStockTxRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    } as any);
    mockMatArrivalRepo.find.mockResolvedValue([
      { arrivalNo: 'ARR-001', seq: 1, itemCode: 'ITEM-001', warehouseCode: 'ARR-WH' } as MatArrival,
    ]);
    mockWarehouseRepo.findOne.mockResolvedValue({ warehouseCode: 'DEF', warehouseName: 'Default' } as Warehouse);
    mockWarehouseRepo.find.mockResolvedValue([
      { warehouseCode: 'ARR-WH', warehouseName: 'Arrival Warehouse' } as Warehouse,
    ]);
    mockItemMasterRepo.find.mockResolvedValue([
      { itemCode: 'ITEM-001', itemName: 'Item', unit: 'EA', iqcYn: 'Y' } as ItemMaster,
    ]);
    mockIqcLogRepo.find.mockResolvedValue([
      {
        arrivalNo: 'ARR-001',
        itemCode: 'ITEM-001',
        result: 'PASS',
        status: 'DONE',
        certFilePath: null,
        company: 'CO',
        plant: 'P01',
      } as IqcLog,
    ]);
    mockLabelPrintLogRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    } as any);

    const result = await target.findReceivable('CO', 'P01');

    expect(result[0].certRequired).toBe(false);
    expect(result[0].receivingBlockedReason).toBeNull();
  });

  it('createBulkReceive는 IQC 대상품의 PASS 성적서가 없어도 입고를 허용한다', async () => {
    const lot = {
      matUid: 'MAT-001',
      itemCode: 'ITEM-001',
      initQty: 10,
      iqcStatus: 'PASS',
      arrivalNo: 'ARR-001',
      arrivalSeq: 1,
      company: 'CO',
      plant: 'P01',
    } as MatLot;
    mockMatLotRepo.findOne.mockResolvedValue(lot);
    mockStockTxRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ sumQty: '0' }),
    } as any);
    mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', iqcYn: 'Y' } as ItemMaster);
    mockIqcLogRepo.findOne.mockResolvedValue({
      arrivalNo: 'ARR-001',
      itemCode: 'ITEM-001',
      result: 'PASS',
      status: 'DONE',
      certFilePath: null,
      company: 'CO',
      plant: 'P01',
    } as IqcLog);
    mockNumbering.nextInTx
      .mockResolvedValueOnce('RCV-001')
      .mockResolvedValueOnce('TX-001');

    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(lot)
        .mockResolvedValueOnce({ arrivalNo: 'ARR-001', seq: 1, warehouseCode: 'ARR-WH', company: 'CO', plant: 'P01' } as MatArrival)
        .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-001', qty: 10, availableQty: 10, company: 'CO', plant: 'P01' } as MatArrivalStock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null),
      create: jest.fn((entity, payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (entity) => entity),
      update: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;

    await target.createBulkReceive({
      workerId: 'user',
      items: [{ matUid: 'MAT-001', qty: 5, warehouseId: 'MAIN-WH' }],
    } as any, 'CO', 'P01');

    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ receiveNo: 'RCV-001' }));
  });

  it('createBulkReceive는 IQC 대상품의 PASS 성적서가 있으면 입고를 허용한다', async () => {
    const lot = {
      matUid: 'MAT-001',
      itemCode: 'ITEM-001',
      initQty: 10,
      iqcStatus: 'PASS',
      arrivalNo: 'ARR-001',
      arrivalSeq: 1,
      company: 'CO',
      plant: 'P01',
    } as MatLot;
    mockMatLotRepo.findOne.mockResolvedValue(lot);
    mockStockTxRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ sumQty: '0' }),
    } as any);
    mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', iqcYn: 'Y' } as ItemMaster);
    mockIqcLogRepo.findOne.mockResolvedValue({
      arrivalNo: 'ARR-001',
      itemCode: 'ITEM-001',
      result: 'PASS',
      status: 'DONE',
      certFilePath: 'uploads/iqc-certs/test.pdf',
      company: 'CO',
      plant: 'P01',
    } as IqcLog);
    mockNumbering.nextInTx
      .mockResolvedValueOnce('RCV-001')
      .mockResolvedValueOnce('TX-001');

    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(lot)
        .mockResolvedValueOnce({ arrivalNo: 'ARR-001', seq: 1, warehouseCode: 'ARR-WH', company: 'CO', plant: 'P01' } as MatArrival)
        .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-001', qty: 10, availableQty: 10, company: 'CO', plant: 'P01' } as MatArrivalStock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null),
      create: jest.fn((entity, payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (entity) => entity),
      update: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;

    await target.createBulkReceive({
      workerId: 'user',
      items: [{ matUid: 'MAT-001', qty: 5, warehouseId: 'MAIN-WH' }],
    } as any, 'CO', 'P01');

    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(manager.findOne).toHaveBeenCalledWith(MatArrivalStock, {
      where: { matUid: 'MAT-001', itemCode: 'ITEM-001', company: 'CO', plant: 'P01' },
    });
  });

  it('createBulkReceive는 요청 테넌트와 LOT 테넌트가 다르면 차단한다', async () => {
    mockMatLotRepo.findOne.mockResolvedValue({
      matUid: 'MAT-001',
      itemCode: 'ITEM-001',
      initQty: 10,
      iqcStatus: 'PASS',
      company: 'OTHER',
      plant: 'P01',
    } as MatLot);

    await expect(target.createBulkReceive({
      workerId: 'user',
      items: [{ matUid: 'MAT-001', qty: 5, warehouseId: 'MAIN-WH' }],
    } as any, 'CO', 'P01')).rejects.toThrow(BadRequestException);

    expect(mockTx.run).not.toHaveBeenCalled();
  });

  it('createBulkReceive는 PO 허용오차와 제조일 갱신도 LOT 회사/공장 범위로 처리한다', async () => {
    const lot = {
      matUid: 'MAT-001',
      itemCode: 'ITEM-001',
      initQty: 10,
      iqcStatus: 'PASS',
      poNo: 'PO-001',
      arrivalNo: 'ARR-001',
      arrivalSeq: 1,
      company: 'CO',
      plant: 'P01',
    } as MatLot;
    const stockTxQb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ sumQty: '0' }),
    };
    mockMatLotRepo.findOne.mockResolvedValue(lot);
    mockStockTxRepo.createQueryBuilder.mockReturnValue(stockTxQb as any);
    mockPurchaseOrderRepo.findOne.mockResolvedValue({ poNo: 'PO-001', company: 'CO', plant: 'P01' } as PurchaseOrder);
    mockPurchaseOrderItemRepo.findOne.mockResolvedValue({
      poNo: 'PO-001',
      itemCode: 'ITEM-001',
      orderQty: 10,
      company: 'CO',
      plant: 'P01',
    } as PurchaseOrderItem);
    mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', toleranceRate: 5, expiryDate: 10 } as any);
    mockNumbering.nextInTx
      .mockResolvedValueOnce('RCV-001')
      .mockResolvedValueOnce('TX-001');

    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(lot)
        .mockResolvedValueOnce({ arrivalNo: 'ARR-001', seq: 1, warehouseCode: 'ARR-WH', company: 'CO', plant: 'P01' } as MatArrival)
        .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-001', qty: 10, availableQty: 10, company: 'CO', plant: 'P01' } as MatArrivalStock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null),
      create: jest.fn((entity, payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (entity) => entity),
      update: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;

    await target.createBulkReceive({
      workerId: 'user',
      items: [{
        matUid: 'MAT-001',
        qty: 5,
        warehouseId: 'MAIN-WH',
        manufactureDate: '2026-05-01',
      }],
    } as any, 'CO', 'P01');

    expect(mockPurchaseOrderRepo.findOne).toHaveBeenCalledWith({
      where: { poNo: 'PO-001', company: 'CO', plant: 'P01' },
    });
    expect(mockPurchaseOrderItemRepo.findOne).toHaveBeenCalledWith({
      where: { poNo: 'PO-001', itemCode: 'ITEM-001', company: 'CO', plant: 'P01' },
    });
    expect(stockTxQb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('plant_cd = :plant'),
      { poNo: 'PO-001', company: 'CO', plant: 'P01' },
    );
    expect(mockItemMasterRepo.findOne).toHaveBeenCalledWith({
      where: { itemCode: 'ITEM-001', company: 'CO', plant: 'P01' },
      select: ['itemCode', 'toleranceRate'],
    });
    expect(mockItemMasterRepo.findOne).toHaveBeenCalledWith({
      where: { itemCode: 'ITEM-001', company: 'CO', plant: 'P01' },
    });
    expect(manager.update).toHaveBeenCalledWith(
      MatLot,
      { matUid: 'MAT-001', company: 'CO', plant: 'P01' },
      expect.objectContaining({ manufactureDate: parseDateStart('2026-05-01') }),
    );
  });
});
