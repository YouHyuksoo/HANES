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
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { BoxMaster } from '../../../entities/box-master.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { PalletMaster } from '../../../entities/pallet-master.entity';
import { ShipmentLog } from '../../../entities/shipment-log.entity';
import { ProductTransaction } from '../../../entities/product-transaction.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';
import { ProductInventoryService } from '../../inventory/services/product-inventory.service';
import { SysConfigService } from '../../system/services/sys-config.service';
import { NumberingService } from '../../../shared/numbering.service';
import { ShipmentService } from './shipment.service';

describe('ShipOrderService', () => {
  let target: ShipOrderService;
  let mockOrderRepo: DeepMocked<Repository<ShipmentOrder>>;
  let mockItemRepo: DeepMocked<Repository<ShipmentOrderItem>>;
  let mockPartRepo: DeepMocked<Repository<ItemMaster>>;
  let mockPartnerRepo: DeepMocked<Repository<PartnerMaster>>;
  let mockBoxRepo: DeepMocked<Repository<BoxMaster>>;
  let mockPalletRepo: DeepMocked<Repository<PalletMaster>>;
  let mockShipmentRepo: DeepMocked<Repository<ShipmentLog>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockTx: DeepMocked<TransactionService>;
  let mockQr: DeepMocked<QueryRunner>;
  let mockNumbering: DeepMocked<NumberingService>;
  let mockSysConfig: DeepMocked<SysConfigService>;

  beforeEach(async () => {
    mockOrderRepo = createMock<Repository<ShipmentOrder>>();
    mockItemRepo = createMock<Repository<ShipmentOrderItem>>();
    mockPartRepo = createMock<Repository<ItemMaster>>();
    mockPartnerRepo = createMock<Repository<PartnerMaster>>();
    mockBoxRepo = createMock<Repository<BoxMaster>>();
    mockPalletRepo = createMock<Repository<PalletMaster>>();
    mockShipmentRepo = createMock<Repository<ShipmentLog>>();
    mockDataSource = createMock<DataSource>();
    mockTx = createMock<TransactionService>();
    mockQr = createMock<QueryRunner>();
    mockNumbering = createMock<NumberingService>();
    mockSysConfig = createMock<SysConfigService>();
    mockSysConfig.isEnabled.mockResolvedValue(true);
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
        { provide: getRepositoryToken(ItemMaster), useValue: mockPartRepo },
        { provide: getRepositoryToken(PartnerMaster), useValue: mockPartnerRepo },
        { provide: getRepositoryToken(Warehouse), useValue: createMock<Repository<Warehouse>>() },
        { provide: getRepositoryToken(BoxMaster), useValue: mockBoxRepo },
        { provide: getRepositoryToken(PalletMaster), useValue: mockPalletRepo },
        { provide: getRepositoryToken(ShipmentLog), useValue: mockShipmentRepo },
        { provide: ProductInventoryService, useValue: createMock<ProductInventoryService>() },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
        { provide: SysConfigService, useValue: mockSysConfig },
        { provide: NumberingService, useValue: mockNumbering },
        { provide: ShipmentService, useValue: createMock<ShipmentService>() },
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

  describe('unconfirm', () => {
    it('should revert CONFIRMED order to DRAFT before shipping starts', async () => {
      const line = { shipOrderNo: 'SO-001', seq: 1, itemCode: 'ITEM-1', orderQty: 3, shippedQty: 0 };
      mockOrderRepo.findOne
        .mockResolvedValueOnce({ shipOrderNo: 'SO-001', status: 'CONFIRMED', company: 'C1', plant: 'P1' } as any)
        .mockResolvedValueOnce({ shipOrderNo: 'SO-001', status: 'DRAFT', company: 'C1', plant: 'P1' } as any);
      mockItemRepo.find
        .mockResolvedValueOnce([line] as any)
        .mockResolvedValueOnce([line] as any);
      mockPartRepo.findOne.mockResolvedValue(null);
      mockPartnerRepo.findOne.mockResolvedValue(null);
      mockPalletRepo.find.mockResolvedValue([]);
      mockBoxRepo.count.mockResolvedValue(0);

      const result = await target.unconfirm('SO-001', 'C1', 'P1');

      expect(mockOrderRepo.update).toHaveBeenCalledWith(
        { shipOrderNo: 'SO-001', company: 'C1', plant: 'P1' },
        { status: 'DRAFT' },
      );
      expect(result.status).toBe('DRAFT');
    });

    it('should delete empty OPEN pallets when reverting to DRAFT', async () => {
      const line = { shipOrderNo: 'SO-001', seq: 1, itemCode: 'ITEM-1', orderQty: 3, shippedQty: 0 };
      mockOrderRepo.findOne
        .mockResolvedValueOnce({ shipOrderNo: 'SO-001', status: 'CONFIRMED', company: 'C1', plant: 'P1' } as any)
        .mockResolvedValueOnce({ shipOrderNo: 'SO-001', status: 'DRAFT', company: 'C1', plant: 'P1' } as any);
      mockItemRepo.find
        .mockResolvedValueOnce([line] as any)
        .mockResolvedValueOnce([line] as any);
      mockPartRepo.findOne.mockResolvedValue(null);
      mockPartnerRepo.findOne.mockResolvedValue(null);
      mockPalletRepo.find.mockResolvedValue([
        { palletNo: 'PLT-001', status: 'OPEN', shipmentId: null, boxCount: 0, totalQty: 0 },
      ] as any);
      mockBoxRepo.count.mockResolvedValue(0);

      const result = await target.unconfirm('SO-001', 'C1', 'P1');

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockQr.manager.delete).toHaveBeenCalledWith(
        PalletMaster,
        { palletNo: expect.anything(), shipOrderNo: 'SO-001', company: 'C1', plant: 'P1' },
      );
      expect(mockQr.manager.update).toHaveBeenCalledWith(
        ShipmentOrder,
        { shipOrderNo: 'SO-001', company: 'C1', plant: 'P1' },
        { status: 'DRAFT' },
      );
      expect(mockOrderRepo.update).not.toHaveBeenCalled();
      expect(result.status).toBe('DRAFT');
    });

    it('should block unconfirm when order is not CONFIRMED', async () => {
      mockOrderRepo.findOne.mockResolvedValue({ shipOrderNo: 'SO-001', status: 'DRAFT' } as any);
      mockItemRepo.find.mockResolvedValue([]);

      await expect(target.unconfirm('SO-001')).rejects.toThrow('CONFIRMED 상태에서만 확정취소할 수 있습니다.');
    });

    it('should block unconfirm after shipping quantity exists', async () => {
      mockOrderRepo.findOne.mockResolvedValue({ shipOrderNo: 'SO-001', status: 'CONFIRMED' } as any);
      mockItemRepo.find.mockResolvedValue([
        { shipOrderNo: 'SO-001', seq: 1, itemCode: 'ITEM-1', orderQty: 3, shippedQty: 1 },
      ] as any);
      mockPartRepo.findOne.mockResolvedValue(null);

      await expect(target.unconfirm('SO-001')).rejects.toThrow('출하수량이 있는 출하지시는 확정취소할 수 없습니다.');
    });

    it('should block unconfirm after pallets or boxes are assigned', async () => {
      mockOrderRepo.findOne.mockResolvedValue({ shipOrderNo: 'SO-001', status: 'CONFIRMED' } as any);
      mockItemRepo.find.mockResolvedValue([
        { shipOrderNo: 'SO-001', seq: 1, itemCode: 'ITEM-1', orderQty: 3, shippedQty: 0 },
      ] as any);
      mockPartRepo.findOne.mockResolvedValue(null);
      mockPalletRepo.find.mockResolvedValue([
        { palletNo: 'PLT-001', status: 'OPEN', shipmentId: null, boxCount: 1, totalQty: 3 },
      ] as any);
      mockBoxRepo.count.mockResolvedValue(0);

      await expect(target.unconfirm('SO-001')).rejects.toThrow('확정취소 불가 — 배정된 팔레트 PLT-001를 먼저 해제하세요.');
    });
  });

  describe('create', () => {
    it('should reject creating an order without customer ship date', async () => {
      mockNumbering.nextShipmentNo.mockResolvedValue('SO-AUTO-001');
      mockOrderRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ shipOrderNo: 'SO-AUTO-001', status: 'DRAFT' } as any);
      mockOrderRepo.create.mockImplementation((payload) => payload as any);
      mockItemRepo.create.mockImplementation((payload) => payload as any);
      mockQr.manager.save
        .mockImplementation(async (entity: any) => Array.isArray(entity) ? entity : entity);
      mockItemRepo.find.mockResolvedValue([]);
      mockPartRepo.findOne.mockResolvedValue(null);
      mockPartnerRepo.findOne.mockResolvedValue(null);

      await expect(target.create({
        customerId: 'CUST-1',
        items: [{ itemCode: 'ITEM-1', orderQty: 1 }],
      } as any, 'C1', 'P1')).rejects.toThrow('고객사 출하일');
    });

    it('should generate shipOrderNo when creating an order', async () => {
      mockNumbering.nextShipmentNo.mockResolvedValue('SO-AUTO-001');
      mockOrderRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ shipOrderNo: 'SO-AUTO-001', status: 'DRAFT' } as any);
      mockOrderRepo.create.mockImplementation((payload) => payload as any);
      mockItemRepo.create.mockImplementation((payload) => payload as any);
      mockQr.manager.save
        .mockImplementation(async (entity: any) => Array.isArray(entity) ? entity : entity);
      mockItemRepo.find.mockResolvedValue([]);
      mockPartRepo.findOne.mockResolvedValue(null);
      mockPartnerRepo.findOne.mockResolvedValue(null);

      const result = await target.create({
        customerId: 'CUST-1',
        shipDate: '2026-06-22',
        items: [{ itemCode: 'ITEM-1', orderQty: 1 }],
      } as any, 'C1', 'P1');

      expect(mockNumbering.nextShipmentNo).toHaveBeenCalledWith(mockQr);
      expect(mockOrderRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        shipOrderNo: 'SO-AUTO-001',
        customerId: 'CUST-1',
        company: 'C1',
        plant: 'P1',
      }));
      expect(mockItemRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        shipOrderNo: 'SO-AUTO-001',
        itemCode: 'ITEM-1',
      }));
      expect(result.shipOrderNo).toBe('SO-AUTO-001');
    });

    it('should create through TransactionService', async () => {
      mockNumbering.nextShipmentNo.mockResolvedValue('SO-001');
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
      mockPartnerRepo.findOne.mockResolvedValue(null);

      await target.create({
        shipOrderNo: 'SO-001',
        customerId: 'CUST-1',
        customerName: 'Customer',
        shipDate: '2026-06-22',
        items: [{ itemCode: 'ITEM-1', orderQty: 1 }],
      } as any);

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQr.commitTransaction).not.toHaveBeenCalled();
      expect(mockQr.release).not.toHaveBeenCalled();
    });
  });

  describe('출하지시 중심 팔레트 작업', () => {
    beforeEach(() => {
      mockOrderRepo.findOne.mockResolvedValue({
        shipOrderNo: 'SO-001',
        status: 'CONFIRMED',
        customerName: '거래처A',
        customerId: 'CUST-A',
        shipDate: new Date('2026-06-20'),
      } as any);
      mockItemRepo.find.mockResolvedValue([
        { shipOrderNo: 'SO-001', seq: 1, itemCode: 'ITEM-A', orderQty: 10, shippedQty: 0 },
      ] as any);
      mockPartRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-A', itemName: '제품A' } as any);
      mockPartnerRepo.findOne.mockResolvedValue(null);
    });

    it('출하지시에 귀속된 팔레트를 생성한다', async () => {
      mockNumbering.nextPalletNo.mockResolvedValue('PLT-001');
      mockPalletRepo.find.mockResolvedValue([]);
      mockPalletRepo.findOne.mockResolvedValue(null);
      mockPalletRepo.create.mockImplementation((payload) => payload as any);
      mockQr.manager.save.mockImplementation(async (entity: any) => entity);

      const result = await target.createPalletForOrder('SO-001', {}, 'C1', 'P1');

      expect(result).toEqual(expect.objectContaining({
        palletNo: 'PLT-001',
        shipOrderNo: 'SO-001',
        status: 'OPEN',
      }));
      expect(mockNumbering.nextPalletNo).toHaveBeenCalledWith(mockQr);
      expect(mockPalletRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        palletNo: 'PLT-001',
        shipOrderNo: 'SO-001',
        company: 'C1',
        plant: 'P1',
      }));
    });

    it('이미 팔레트가 생성된 출하지시는 팔레트를 재생성하지 않는다', async () => {
      mockPalletRepo.find.mockResolvedValue([
        { palletNo: 'PLT-EXIST', shipOrderNo: 'SO-001', status: 'OPEN' },
      ] as any);

      await expect(target.createPalletForOrder('SO-001', {}, 'C1', 'P1')).rejects.toThrow(
        '이미 팔레트가 생성된 출하지시입니다',
      );

      expect(mockNumbering.nextPalletNo).not.toHaveBeenCalled();
      expect(mockPalletRepo.create).not.toHaveBeenCalled();
      expect(mockTx.run).not.toHaveBeenCalled();
    });

    it('출하지시에 없는 품목 박스는 출하지시 팔레트에 적재하지 않는다', async () => {
      mockPalletRepo.findOne.mockResolvedValue({
        palletNo: 'PLT-001',
        shipOrderNo: 'SO-001',
        status: 'OPEN',
        boxCount: 0,
      } as any);
      mockBoxRepo.find.mockResolvedValue([
        { boxNo: 'BX-OTHER', itemCode: 'OTHER', qty: 1, status: 'CLOSED', oqcStatus: 'PASS', palletNo: null },
      ] as any);

      await expect(
        target.addBoxesToOrderPallet('SO-001', 'PLT-001', { boxIds: ['BX-OTHER'] }, 'C1', 'P1'),
      ).rejects.toThrow('출하지시에 없는 품목입니다');

      expect(mockTx.run).not.toHaveBeenCalled();
    });

    it('OQC 미사용 시 fulfillment 후보 조회에서 OQC PASS 필터를 제거한다', async () => {
      mockSysConfig.isEnabled.mockResolvedValue(false);
      mockBoxRepo.find.mockResolvedValue([] as any);
      mockPalletRepo.find.mockResolvedValue([] as any);
      mockShipmentRepo.find.mockResolvedValue([] as any);

      await target.getFulfillment('SO-001', 'C1', 'P1');

      const firstBoxFind = mockBoxRepo.find.mock.calls[0]?.[0] as any;
      expect(firstBoxFind.where).toEqual(expect.objectContaining({
        status: 'CLOSED',
        palletNo: expect.anything(),
        company: 'C1',
        plant: 'P1',
      }));
      expect(firstBoxFind.where.oqcStatus).toBeUndefined();
    });

    it('OQC 미사용 시 PENDING 박스도 출하지시 팔레트에 적재한다', async () => {
      mockSysConfig.isEnabled.mockResolvedValue(false);
      mockPalletRepo.findOne.mockResolvedValue({
        palletNo: 'PLT-001',
        shipOrderNo: 'SO-001',
        status: 'OPEN',
        boxCount: 0,
      } as any);
      mockBoxRepo.find
        .mockResolvedValueOnce([
          { boxNo: 'BX-001', itemCode: 'ITEM-A', qty: 10, status: 'CLOSED', oqcStatus: 'PENDING', palletNo: null },
        ] as any)
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([] as any);
      mockPalletRepo.find
        .mockResolvedValueOnce([{ palletNo: 'PLT-001', status: 'OPEN' }] as any)
        .mockResolvedValueOnce([] as any);
      mockShipmentRepo.find.mockResolvedValue([] as any);
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '1', totalQty: '10' }),
      };
      mockQr.manager.createQueryBuilder.mockReturnValue(qb as any);

      await expect(
        target.addBoxesToOrderPallet('SO-001', 'PLT-001', { boxIds: ['BX-001'] }, 'C1', 'P1'),
      ).resolves.toEqual(expect.objectContaining({ candidateBoxes: [] }));

      expect(mockQr.manager.update).toHaveBeenCalledWith(
        BoxMaster,
        expect.objectContaining({ boxNo: expect.anything(), company: 'C1', plant: 'P1' }),
        { palletNo: 'PLT-001' },
      );
    });

    it('팔레트 바코드 출하 시 내부 출하건을 자동 생성해 제품출하까지 진행한다', async () => {
      mockNumbering.nextShipmentNo.mockResolvedValue('SHP-001');
      mockPalletRepo.find.mockResolvedValue([
        { palletNo: 'PLT-001', shipOrderNo: 'SO-001', status: 'CLOSED', shipmentId: null, boxCount: 1, totalQty: 10 },
      ] as any);
      mockBoxRepo.find.mockResolvedValue([
        { boxNo: 'BX-001', itemCode: 'ITEM-A', qty: 10, status: 'CLOSED', oqcStatus: 'PASS', palletNo: 'PLT-001', serialList: null },
      ] as any);
      mockShipmentRepo.findOne.mockResolvedValue(null);
      mockShipmentRepo.create.mockImplementation((payload) => payload as any);
      mockQr.manager.save.mockImplementation(async (entity: any) => entity);
      mockQr.manager.findOne.mockResolvedValue({ warehouseCode: 'FG_MAIN' } as any);

      await target.shipOrderPallets('SO-001', { palletNos: ['PLT-001'] }, 'C1', 'P1');

      expect(mockShipmentRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        shipNo: 'SHP-001',
        shipOrderNo: 'SO-001',
        customer: '거래처A',
        status: 'LOADED',
      }));
    });

    it('OQC 미사용 시 PENDING 박스가 포함된 팔레트도 출하한다', async () => {
      mockSysConfig.isEnabled.mockResolvedValue(false);
      mockNumbering.nextShipmentNo.mockResolvedValue('SHP-001');
      mockPalletRepo.find.mockResolvedValue([
        { palletNo: 'PLT-001', shipOrderNo: 'SO-001', status: 'CLOSED', shipmentId: null, boxCount: 1, totalQty: 10 },
      ] as any);
      mockBoxRepo.find.mockResolvedValue([
        { boxNo: 'BX-001', itemCode: 'ITEM-A', qty: 10, status: 'CLOSED', oqcStatus: 'PENDING', palletNo: 'PLT-001', serialList: null },
      ] as any);
      mockShipmentRepo.findOne.mockResolvedValue(null);
      mockShipmentRepo.create.mockImplementation((payload) => payload as any);
      mockQr.manager.save.mockImplementation(async (entity: any) => entity);
      mockQr.manager.findOne.mockResolvedValue({ warehouseCode: 'FG_MAIN' } as any);

      await expect(
        target.shipOrderPallets('SO-001', { palletNos: ['PLT-001'] }, 'C1', 'P1'),
      ).resolves.toEqual(expect.objectContaining({ shipped: true }));

      expect(mockShipmentRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        shipNo: 'SHP-001',
        shipOrderNo: 'SO-001',
      }));
    });
  });
});

describe('ShipOrderService.shipBox', () => {
  let service: ShipOrderService;
  let issueStockInTx: jest.Mock;
  let receiveStockInTx: jest.Mock;
  let cancelTransactionInTx: jest.Mock;
  let managed: Record<string, any>;

  const makeManager = (overrides: Partial<Record<string, any>>) => ({
    findOne: jest.fn((entity: any) => {
      if (entity === ShipmentOrder) return overrides.order ?? null;
      if (entity === BoxMaster) return overrides.box ?? null;
      if (entity === ShipmentOrderItem) return overrides.line ?? null;
      if (entity === Warehouse) return overrides.warehouse ?? null;
      if (entity === ProductTransaction) return overrides.originalFgOut ?? null;
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
    receiveStockInTx = jest.fn().mockResolvedValue({ transNo: 'PTX_CANCEL' });
    cancelTransactionInTx = jest.fn().mockResolvedValue({ transNo: 'PTX_CANCEL' });
    const moduleRef = await Test.createTestingModule({
      providers: [
        ShipOrderService,
        { provide: getRepositoryToken(ShipmentOrder), useValue: {} },
        { provide: getRepositoryToken(ShipmentOrderItem), useValue: {} },
        { provide: getRepositoryToken(ItemMaster), useValue: {} },
        { provide: getRepositoryToken(PartnerMaster), useValue: {} },
        { provide: getRepositoryToken(Warehouse), useValue: {} },
        { provide: getRepositoryToken(BoxMaster), useValue: {} },
        { provide: getRepositoryToken(PalletMaster), useValue: {} },
        { provide: getRepositoryToken(ShipmentLog), useValue: {} },
        { provide: TransactionService, useValue: { run: (cb: any) => cb({ manager: managed }) } },
        { provide: ProductInventoryService, useValue: { issueStockByItemFifoInTx: issueStockInTx, receiveStockInTx, cancelTransactionInTx } },
        { provide: SysConfigService, useValue: { isEnabled: jest.fn().mockResolvedValue(true) } },
        { provide: NumberingService, useValue: { nextShipmentNo: jest.fn().mockResolvedValue('SO-TEST'), nextReturnNo: jest.fn().mockResolvedValue('RT-TEST') } },
        { provide: ShipmentService, useValue: { reverseShipmentInTx: jest.fn().mockResolvedValue(undefined), cancelInTx: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();
    service = moduleRef.get(ShipOrderService);
  };

  it('정상 출하: 박스 시리얼별 재고차감 + SHIPPED + shippedQty 증가', async () => {
    await buildService({
      order: { shipOrderNo: 'SO1', status: 'CONFIRMED' },
      box: { boxNo: 'BX1', itemCode: 'HNS01', qty: 2, status: 'CLOSED', oqcStatus: 'PASS', serialList: JSON.stringify(['FG1', 'FG2']) },
      line: { shipOrderNo: 'SO1', seq: 1, itemCode: 'HNS01', orderQty: 10, shippedQty: 0 },
      warehouse: { warehouseCode: 'FG_MAIN' },
      allLines: [{ shipOrderNo: 'SO1', seq: 1, itemCode: 'HNS01', orderQty: 10, shippedQty: 0 }],
    });
    const res = await service.shipBox('SO1', { boxNo: 'BX1' }, '40', '1000');
    expect(issueStockInTx).toHaveBeenCalledTimes(1);
    expect(issueStockInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ warehouseId: 'FG_MAIN', itemCode: 'HNS01', qty: 2, transType: 'FG_OUT', refType: 'SHIP_ORDER', refId: 'SO1' }),
    );
    expect(managed.update).toHaveBeenCalledWith(BoxMaster, expect.objectContaining({ boxNo: 'BX1' }), expect.objectContaining({ status: 'SHIPPED', shipOrderNo: 'SO1', shippedAt: expect.any(Date) }));
    expect(managed.update).toHaveBeenCalledWith(FgLabel, expect.objectContaining({ fgBarcode: expect.anything() }), { status: 'SHIPPED' });
    expect(res.lineShippedQty).toBe(2);
    expect(res.fullyShipped).toBe(false);
  });

  it('박스 시리얼 수량과 박스 수량이 다르면 출하를 거부한다', async () => {
    await buildService({
      order: { shipOrderNo: 'SO1', status: 'CONFIRMED' },
      box: { boxNo: 'BX1', itemCode: 'HNS01', qty: 2, status: 'CLOSED', oqcStatus: 'PASS', serialList: JSON.stringify(['FG1']) },
      line: { shipOrderNo: 'SO1', seq: 1, itemCode: 'HNS01', orderQty: 10, shippedQty: 0 },
      warehouse: { warehouseCode: 'FG_MAIN' },
    });

    await expect(service.shipBox('SO1', { boxNo: 'BX1' }, '40', '1000')).rejects.toThrow(BadRequestException);
    expect(issueStockInTx).not.toHaveBeenCalled();
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

  it('출하 취소: 제품재고 복원 + 박스/라벨/출하지시 상태를 출하 전으로 되돌린다', async () => {
    await buildService({
      order: { shipOrderNo: 'SO1', status: 'CLOSED' },
      box: { boxNo: 'BX1', itemCode: 'HNS01', qty: 2, status: 'SHIPPED', oqcStatus: 'PASS', serialList: JSON.stringify(['FG1', 'FG2']) },
      line: { shipOrderNo: 'SO1', seq: 1, itemCode: 'HNS01', orderQty: 2, shippedQty: 2 },
      warehouse: { warehouseCode: 'FG_MAIN' },
      originalFgOut: { transNo: 'PTX_OUT', transType: 'FG_OUT', refType: 'SHIP_ORDER', refId: 'SO1', itemCode: 'HNS01', qty: -2, status: 'DONE', fromWarehouseId: 'FG_MAIN' },
    });

    const res = await service.cancelShipBox('SO1', { boxNo: 'BX1', workerId: 'worker1' }, '40', '1000');

    expect(receiveStockInTx).not.toHaveBeenCalled();
    expect(cancelTransactionInTx).toHaveBeenCalledTimes(1);
    expect(cancelTransactionInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ transNo: 'PTX_OUT', transType: 'FG_OUT', refType: 'SHIP_ORDER', refId: 'SO1' }),
      expect.objectContaining({ transactionId: 'PTX_OUT', workerId: 'worker1', remark: '출하지시 박스출하 취소:BX1' }),
    );
    expect(managed.update).toHaveBeenCalledWith(BoxMaster, expect.objectContaining({ boxNo: 'BX1' }), expect.objectContaining({ status: 'CLOSED', shippedAt: null }));
    expect(managed.update).toHaveBeenCalledWith(FgLabel, expect.objectContaining({ fgBarcode: expect.anything() }), { status: 'PACKED' });
    expect(managed.update).toHaveBeenCalledWith(ShipmentOrderItem, expect.objectContaining({ shipOrderNo: 'SO1', seq: 1 }), { shippedQty: 0 });
    expect(managed.update).toHaveBeenCalledWith(ShipmentOrder, expect.objectContaining({ shipOrderNo: 'SO1' }), { status: 'CONFIRMED' });
    expect(res.lineShippedQty).toBe(0);
    expect(res.orderStatus).toBe('CONFIRMED');
  });
});
