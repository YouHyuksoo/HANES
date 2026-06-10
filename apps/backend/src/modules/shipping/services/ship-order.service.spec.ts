/**
 * @file src/modules/shipping/services/ship-order.service.spec.ts
 * @description ShipOrderService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { ShipOrderService } from './ship-order.service';
import { ShipmentOrder } from '../../../entities/shipment-order.entity';
import { ShipmentOrderItem } from '../../../entities/shipment-order-item.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { BoxMaster } from '../../../entities/box-master.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';
import { ProductInventoryService } from '../../inventory/services/product-inventory.service';

describe('ShipOrderService', () => {
  let target: ShipOrderService;
  let mockOrderRepo: DeepMocked<Repository<ShipmentOrder>>;
  let mockItemRepo: DeepMocked<Repository<ShipmentOrderItem>>;
  let mockPartRepo: DeepMocked<Repository<PartMaster>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockTx: DeepMocked<TransactionService>;
  let mockQr: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockOrderRepo = createMock<Repository<ShipmentOrder>>();
    mockItemRepo = createMock<Repository<ShipmentOrderItem>>();
    mockPartRepo = createMock<Repository<PartMaster>>();
    mockDataSource = createMock<DataSource>();
    mockTx = createMock<TransactionService>();
    mockQr = createMock<QueryRunner>();
    mockDataSource.createQueryRunner.mockReturnValue(mockQr);
    mockTx.run.mockImplementation(async (callback) => callback(mockQr));
    mockQr.connect.mockResolvedValue(undefined);
    mockQr.startTransaction.mockResolvedValue(undefined);
    mockQr.commitTransaction.mockResolvedValue(undefined);
    mockQr.rollbackTransaction.mockResolvedValue(undefined);
    mockQr.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipOrderService,
        { provide: getRepositoryToken(ShipmentOrder), useValue: mockOrderRepo },
        { provide: getRepositoryToken(ShipmentOrderItem), useValue: mockItemRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartRepo },
        { provide: getRepositoryToken(Warehouse), useValue: createMock<Repository<Warehouse>>() },
        { provide: getRepositoryToken(BoxMaster), useValue: createMock<Repository<BoxMaster>>() },
        { provide: ProductInventoryService, useValue: createMock<ProductInventoryService>() },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<ShipOrderService>(ShipOrderService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findById', () => {
    it('should return ship order with items', async () => {
      mockOrderRepo.findOne.mockResolvedValue({ shipOrderNo: 'SO-001' } as any);
      mockItemRepo.find.mockResolvedValue([]);
      const r = await target.findById('SO-001');
      expect(r.shipOrderNo).toBe('SO-001');
    });
    it('should throw NotFoundException', async () => {
      mockOrderRepo.findOne.mockResolvedValue(null);
      await expect(target.findById('X')).rejects.toThrow(NotFoundException);
    });
    it('should enrich order items with part names within tenant only', async () => {
      mockOrderRepo.findOne.mockResolvedValue({ shipOrderNo: 'SO-001', company: 'C1', plant: 'P1' } as any);
      mockItemRepo.find.mockResolvedValue([{ shipOrderNo: 'SO-001', itemCode: 'ITEM-001', company: 'C1', plant: 'P1' }] as any);
      mockPartRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Part A' } as any);

      await target.findById('SO-001', 'C1', 'P1');

      expect(mockPartRepo.findOne).toHaveBeenCalledWith({
        where: { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' },
        select: ['itemCode', 'itemName'],
      });
    });
  });

  describe('findAll', () => {
    it('should enrich listed order items with part names within tenant only', async () => {
      mockOrderRepo.find.mockResolvedValue([{ shipOrderNo: 'SO-001', company: 'C1', plant: 'P1' }] as any);
      mockOrderRepo.count.mockResolvedValue(1);
      mockItemRepo.find.mockResolvedValue([{ shipOrderNo: 'SO-001', itemCode: 'ITEM-001', company: 'C1', plant: 'P1' }] as any);
      mockPartRepo.find.mockResolvedValue([{ itemCode: 'ITEM-001', itemName: 'Part A' }] as any);

      await target.findAll({} as any, 'C1', 'P1');

      expect(mockPartRepo.find).toHaveBeenCalledWith({
        where: { itemCode: expect.anything(), company: 'C1', plant: 'P1' },
        select: ['itemCode', 'itemName'],
      });
    });
  });

  describe('delete', () => {
    it('should delete DRAFT order', async () => {
      mockOrderRepo.findOne.mockResolvedValue({ shipOrderNo: 'SO-001', status: 'DRAFT' } as any);
      mockItemRepo.find.mockResolvedValue([]);
      mockOrderRepo.delete.mockResolvedValue({ affected: 1 } as any);
      const r = await target.delete('SO-001');
      expect(r.deleted).toBe(true);
    });
    it('should throw when not DRAFT', async () => {
      mockOrderRepo.findOne.mockResolvedValue({ shipOrderNo: 'SO-001', status: 'CONFIRMED' } as any);
      mockItemRepo.find.mockResolvedValue([]);
      await expect(target.delete('SO-001')).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update through TransactionService', async () => {
      mockOrderRepo.findOne
        .mockResolvedValueOnce({ shipOrderNo: 'SO-001', status: 'DRAFT' } as any)
        .mockResolvedValueOnce({ shipOrderNo: 'SO-001', status: 'DRAFT' } as any);
      mockItemRepo.find.mockResolvedValue([]);
      mockPartRepo.findOne.mockResolvedValue(null);

      await target.update('SO-001', { customerName: 'Updated' } as any);

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQr.commitTransaction).not.toHaveBeenCalled();
      expect(mockQr.release).not.toHaveBeenCalled();
    });

    it('should block direct status changes', async () => {
      mockOrderRepo.findOne.mockResolvedValue({ shipOrderNo: 'SO-001', status: 'DRAFT' } as any);
      mockItemRepo.find.mockResolvedValue([]);

      await expect(target.update('SO-001', { status: 'CONFIRMED' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should preserve tenant columns when replacing items', async () => {
      mockOrderRepo.findOne
        .mockResolvedValueOnce({ shipOrderNo: 'SO-001', status: 'DRAFT', company: 'C1', plant: 'P1' } as any)
        .mockResolvedValueOnce({ shipOrderNo: 'SO-001', status: 'DRAFT', company: 'C1', plant: 'P1' } as any);
      mockItemRepo.find.mockResolvedValue([]);
      mockItemRepo.create.mockImplementation((payload) => payload as any);
      mockPartRepo.findOne.mockResolvedValue(null);

      await target.update(
        'SO-001',
        { items: [{ itemCode: 'ITEM-1', orderQty: 3 }] } as any,
        'C1',
        'P1',
      );

      expect(mockItemRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        shipOrderNo: 'SO-001',
        itemCode: 'ITEM-1',
        company: 'C1',
        plant: 'P1',
      }));
    });
  });

  describe('create', () => {
    it('should create through TransactionService', async () => {
      mockOrderRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ shipOrderNo: 'SO-001', status: 'DRAFT' } as any);
      mockOrderRepo.create.mockReturnValue({ shipOrderNo: 'SO-001' } as any);
      mockItemRepo.create.mockImplementation((payload) => payload as any);
      mockQr.manager.save
        .mockResolvedValueOnce({ shipOrderNo: 'SO-001' } as any)
        .mockResolvedValueOnce([] as any);
      mockItemRepo.find.mockResolvedValue([]);
      mockPartRepo.findOne.mockResolvedValue(null);

      await target.create({
        shipOrderNo: 'SO-001',
        customerId: 'CUST-1',
        customerName: 'Customer',
        items: [{ itemCode: 'ITEM-1', orderQty: 1 }],
      } as any);

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQr.commitTransaction).not.toHaveBeenCalled();
      expect(mockQr.release).not.toHaveBeenCalled();
    });
  });
});

describe('ShipOrderService.shipBox', () => {
  let service: ShipOrderService;
  let issueStockInTx: jest.Mock;
  let managed: Record<string, any>;

  const makeManager = (overrides: Partial<Record<string, any>>) => ({
    findOne: jest.fn((entity: any) => {
      if (entity === ShipmentOrder) return overrides.order ?? null;
      if (entity === BoxMaster) return overrides.box ?? null;
      if (entity === ShipmentOrderItem) return overrides.line ?? null;
      if (entity === Warehouse) return overrides.warehouse ?? null;
      return null;
    }),
    find: jest.fn((entity: any) => {
      if (entity === ShipmentOrderItem) return overrides.allLines ?? [];
      return [];
    }),
    update: jest.fn(),
  });

  const buildService = async (overrides: Partial<Record<string, any>>) => {
    managed = makeManager(overrides);
    issueStockInTx = jest.fn().mockResolvedValue({ transNo: 'PTX_TEST' });
    const moduleRef = await Test.createTestingModule({
      providers: [
        ShipOrderService,
        { provide: getRepositoryToken(ShipmentOrder), useValue: {} },
        { provide: getRepositoryToken(ShipmentOrderItem), useValue: {} },
        { provide: getRepositoryToken(PartMaster), useValue: {} },
        { provide: getRepositoryToken(Warehouse), useValue: {} },
        { provide: getRepositoryToken(BoxMaster), useValue: {} },
        { provide: TransactionService, useValue: { run: (cb: any) => cb({ manager: managed }) } },
        { provide: ProductInventoryService, useValue: { issueStockInTx } },
      ],
    }).compile();
    service = moduleRef.get(ShipOrderService);
  };

  it('정상 출하: 박스 SHIPPED + 재고차감 + shippedQty 증가', async () => {
    await buildService({
      order: { shipOrderNo: 'SO1', status: 'CONFIRMED' },
      box: { boxNo: 'BX1', itemCode: 'HNS01', qty: 5, status: 'CLOSED', oqcStatus: 'PASS', serialList: JSON.stringify(['FG1', 'FG2']) },
      line: { shipOrderNo: 'SO1', seq: 1, itemCode: 'HNS01', orderQty: 10, shippedQty: 0 },
      warehouse: { warehouseCode: 'FG_MAIN' },
      allLines: [{ shipOrderNo: 'SO1', seq: 1, itemCode: 'HNS01', orderQty: 10, shippedQty: 0 }],
    });
    const res = await service.shipBox('SO1', { boxNo: 'BX1' }, '40', '1000');
    expect(issueStockInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ warehouseId: 'FG_MAIN', itemCode: 'HNS01', qty: 5, transType: 'FG_OUT', prdUid: '*', refType: 'SHIP_ORDER', refId: 'SO1' }),
    );
    expect(managed.update).toHaveBeenCalledWith(BoxMaster, expect.objectContaining({ boxNo: 'BX1' }), { status: 'SHIPPED' });
    expect(managed.update).toHaveBeenCalledWith(FgLabel, expect.objectContaining({ fgBarcode: expect.anything() }), { status: 'SHIPPED' });
    expect(res.lineShippedQty).toBe(5);
    expect(res.fullyShipped).toBe(false);
  });

  it('CONFIRMED 아니면 거부', async () => {
    await buildService({ order: { shipOrderNo: 'SO1', status: 'DRAFT' } });
    await expect(service.shipBox('SO1', { boxNo: 'BX1' }, '40', '1000')).rejects.toThrow(BadRequestException);
  });

  it('이미 SHIPPED 박스 거부', async () => {
    await buildService({
      order: { shipOrderNo: 'SO1', status: 'CONFIRMED' },
      box: { boxNo: 'BX1', itemCode: 'HNS01', qty: 5, status: 'SHIPPED', oqcStatus: 'PASS' },
    });
    await expect(service.shipBox('SO1', { boxNo: 'BX1' }, '40', '1000')).rejects.toThrow(BadRequestException);
  });

  it('OQC 미합격 박스 거부', async () => {
    await buildService({
      order: { shipOrderNo: 'SO1', status: 'CONFIRMED' },
      box: { boxNo: 'BX1', itemCode: 'HNS01', qty: 5, status: 'CLOSED', oqcStatus: 'PENDING' },
    });
    await expect(service.shipBox('SO1', { boxNo: 'BX1' }, '40', '1000')).rejects.toThrow(BadRequestException);
  });

  it('팔레트 적재 박스 거부 (이중 차감 방지)', async () => {
    await buildService({
      order: { shipOrderNo: 'SO1', status: 'CONFIRMED' },
      box: { boxNo: 'BX1', itemCode: 'HNS01', qty: 5, status: 'CLOSED', oqcStatus: 'PASS', palletNo: 'PLT-1' },
    });
    await expect(service.shipBox('SO1', { boxNo: 'BX1' }, '40', '1000')).rejects.toThrow(BadRequestException);
  });

  it('지시에 없는 품목 거부', async () => {
    await buildService({
      order: { shipOrderNo: 'SO1', status: 'CONFIRMED' },
      box: { boxNo: 'BX1', itemCode: 'OTHER', qty: 5, status: 'CLOSED', oqcStatus: 'PASS' },
      line: null,
    });
    await expect(service.shipBox('SO1', { boxNo: 'BX1' }, '40', '1000')).rejects.toThrow(BadRequestException);
  });

  it('초과 출하 거부', async () => {
    await buildService({
      order: { shipOrderNo: 'SO1', status: 'CONFIRMED' },
      box: { boxNo: 'BX1', itemCode: 'HNS01', qty: 7, status: 'CLOSED', oqcStatus: 'PASS' },
      line: { shipOrderNo: 'SO1', seq: 1, itemCode: 'HNS01', orderQty: 10, shippedQty: 5 },
    });
    await expect(service.shipBox('SO1', { boxNo: 'BX1' }, '40', '1000')).rejects.toThrow(BadRequestException);
  });

  it('전 라인 완출 시 지시 CLOSED', async () => {
    await buildService({
      order: { shipOrderNo: 'SO1', status: 'CONFIRMED' },
      box: { boxNo: 'BX1', itemCode: 'HNS01', qty: 10, status: 'CLOSED', oqcStatus: 'PASS' },
      line: { shipOrderNo: 'SO1', seq: 1, itemCode: 'HNS01', orderQty: 10, shippedQty: 0 },
      warehouse: { warehouseCode: 'FG_MAIN' },
      allLines: [{ shipOrderNo: 'SO1', seq: 1, itemCode: 'HNS01', orderQty: 10, shippedQty: 0 }],
    });
    const res = await service.shipBox('SO1', { boxNo: 'BX1' }, '40', '1000');
    expect(res.fullyShipped).toBe(true);
    expect(managed.update).toHaveBeenCalledWith(ShipmentOrder, expect.objectContaining({ shipOrderNo: 'SO1' }), { status: 'CLOSED' });
  });
});
