/**
 * @file src/modules/outsourcing/services/outsourcing.service.spec.ts
 * @description OutsourcingService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "OutsourcingService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { OutsourcingService } from './outsourcing.service';
import { SubconOrder } from '../../../entities/subcon-order.entity';
import { SubconDelivery } from '../../../entities/subcon-delivery.entity';
import { SubconReceive } from '../../../entities/subcon-receive.entity';
import { VendorMaster } from '../../../entities/vendor-master.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('OutsourcingService', () => {
  let target: OutsourcingService;
  let mockOrderRepo: DeepMocked<Repository<SubconOrder>>;
  let mockDeliveryRepo: DeepMocked<Repository<SubconDelivery>>;
  let mockReceiveRepo: DeepMocked<Repository<SubconReceive>>;
  let mockVendorRepo: DeepMocked<Repository<VendorMaster>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockNumbering: DeepMocked<NumberingService>;
  let mockTx: DeepMocked<TransactionService>;

  beforeEach(async () => {
    mockOrderRepo = createMock<Repository<SubconOrder>>();
    mockDeliveryRepo = createMock<Repository<SubconDelivery>>();
    mockReceiveRepo = createMock<Repository<SubconReceive>>();
    mockVendorRepo = createMock<Repository<VendorMaster>>();
    mockDataSource = createMock<DataSource>();
    mockNumbering = createMock<NumberingService>();
    mockTx = createMock<TransactionService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutsourcingService,
        { provide: getRepositoryToken(SubconOrder), useValue: mockOrderRepo },
        { provide: getRepositoryToken(SubconDelivery), useValue: mockDeliveryRepo },
        { provide: getRepositoryToken(SubconReceive), useValue: mockReceiveRepo },
        { provide: getRepositoryToken(VendorMaster), useValue: mockVendorRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
        { provide: NumberingService, useValue: mockNumbering },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<OutsourcingService>(OutsourcingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Vendor CRUD ───
  describe('findAllVendors', () => {
    it('외주처 수정 URL에서 사용할 id로 vendorCode를 함께 반환한다', async () => {
      const vendors = [{ vendorCode: 'V001', vendorName: 'Vendor 1' }] as any;
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(vendors),
        getCount: jest.fn().mockResolvedValue(1),
      };
      mockVendorRepo.createQueryBuilder.mockReturnValue(queryBuilder as any);

      const result = await target.findAllVendors({ page: 1, limit: 10 } as any);

      expect(result.data[0]).toEqual(expect.objectContaining({ id: 'V001', vendorCode: 'V001' }));
    });
  });

  describe('findVendorById', () => {
    it('should return vendor with recent orders', async () => {
      // Arrange
      const vendor = { vendorCode: 'V001' } as VendorMaster;
      mockVendorRepo.findOne.mockResolvedValue(vendor);
      mockOrderRepo.find.mockResolvedValue([]);

      // Act
      const result = await target.findVendorById('V001');

      // Assert
      expect(result.vendorCode).toBe('V001');
    });
    it('should return vendor and recent orders within tenant', async () => {
      const vendor = { vendorCode: 'V001', company: 'CO', plant: 'P01' } as VendorMaster;
      mockVendorRepo.findOne.mockResolvedValue(vendor);
      mockOrderRepo.find.mockResolvedValue([]);

      await target.findVendorById('V001', 'CO', 'P01');

      expect(mockVendorRepo.findOne).toHaveBeenCalledWith({
        where: { vendorCode: 'V001', company: 'CO', plant: 'P01' },
      });
      expect(mockOrderRepo.find).toHaveBeenCalledWith({
        where: { vendorCode: 'V001', company: 'CO', plant: 'P01' },
        order: { createdAt: 'DESC' },
        take: 10,
      });
    });

    it('should throw NotFoundException when vendor not found', async () => {
      // Arrange
      mockVendorRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findVendorById('NONE')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createVendor', () => {
    it('should create a new vendor', async () => {
      // Arrange
      const dto = { vendorCode: 'V001', vendorName: 'Test' } as any;
      mockVendorRepo.findOne.mockResolvedValue(null);
      mockVendorRepo.create.mockReturnValue(dto as VendorMaster);
      mockVendorRepo.save.mockResolvedValue(dto as VendorMaster);

      // Act
      const result = await target.createVendor(dto);

      // Assert
      expect(result).toEqual(dto);
    });
    it('should check duplicate and create vendor within tenant', async () => {
      const dto = { vendorCode: 'V001', vendorName: 'Test' } as any;
      mockVendorRepo.findOne.mockResolvedValue(null);
      mockVendorRepo.create.mockReturnValue({ ...dto, company: 'CO', plant: 'P01' } as VendorMaster);
      mockVendorRepo.save.mockResolvedValue({ ...dto, company: 'CO', plant: 'P01' } as VendorMaster);

      await target.createVendor(dto, 'CO', 'P01');

      expect(mockVendorRepo.findOne).toHaveBeenCalledWith({
        where: { vendorCode: 'V001', company: 'CO', plant: 'P01' },
      });
      expect(mockVendorRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ vendorCode: 'V001', company: 'CO', plant: 'P01' }),
      );
    });

    it('should throw ConflictException when vendor code exists', async () => {
      // Arrange
      mockVendorRepo.findOne.mockResolvedValue({ vendorCode: 'V001' } as VendorMaster);

      // Act & Assert
      await expect(target.createVendor({ vendorCode: 'V001' } as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('deleteVendor', () => {
    it('should delete vendor', async () => {
      // Arrange
      mockVendorRepo.findOne.mockResolvedValue({ vendorCode: 'V001' } as VendorMaster);
      mockOrderRepo.find.mockResolvedValue([]);
      mockVendorRepo.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.deleteVendor('V001');

      // Assert
      expect(result).toEqual({ vendorCode: 'V001' });
    });
  });

  // ─── Order CRUD ───
  describe('findOrderById', () => {
    it('should return order with vendor, deliveries, receives', async () => {
      // Arrange
      const order = { orderNo: 'ORD001', vendorCode: 'V001' } as SubconOrder;
      mockOrderRepo.findOne.mockResolvedValue(order);
      mockVendorRepo.findOne.mockResolvedValue({ vendorCode: 'V001' } as VendorMaster);
      mockDeliveryRepo.find.mockResolvedValue([]);
      mockReceiveRepo.find.mockResolvedValue([]);

      // Act
      const result = await target.findOrderById('ORD001');

      // Assert
      expect(result.orderNo).toBe('ORD001');
    });
    it('should return order relationships within tenant', async () => {
      const order = { orderNo: 'ORD001', vendorCode: 'V001', company: 'CO', plant: 'P01' } as SubconOrder;
      mockOrderRepo.findOne.mockResolvedValue(order);
      mockVendorRepo.findOne.mockResolvedValue({ vendorCode: 'V001', company: 'CO', plant: 'P01' } as VendorMaster);
      mockDeliveryRepo.find.mockResolvedValue([]);
      mockReceiveRepo.find.mockResolvedValue([]);

      await target.findOrderById('ORD001', 'CO', 'P01');

      expect(mockOrderRepo.findOne).toHaveBeenCalledWith({
        where: { orderNo: 'ORD001', company: 'CO', plant: 'P01' },
      });
      expect(mockVendorRepo.findOne).toHaveBeenCalledWith({
        where: { vendorCode: 'V001', company: 'CO', plant: 'P01' },
      });
      expect(mockDeliveryRepo.find).toHaveBeenCalledWith({
        where: { orderNo: 'ORD001', company: 'CO', plant: 'P01' },
        order: { createdAt: 'DESC' },
      });
      expect(mockReceiveRepo.find).toHaveBeenCalledWith({
        where: { orderNo: 'ORD001', company: 'CO', plant: 'P01' },
        order: { createdAt: 'DESC' },
      });
    });

    it('should throw NotFoundException when order not found', async () => {
      // Arrange
      mockOrderRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findOrderById('NONE')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createOrder', () => {
    it('should create order with generated orderNo', async () => {
      // Arrange
      mockNumbering.nextSubconNo.mockResolvedValue('SCO20260318-0001');
      const order = { orderNo: 'SCO20260318-0001' } as SubconOrder;
      mockOrderRepo.create.mockReturnValue(order);
      mockOrderRepo.save.mockResolvedValue(order);

      // Act
      const result = await target.createOrder({
        vendorCode: 'V001',
        itemCode: 'PART1',
        orderQty: 100,
      } as any);

      // Assert
      expect(result.orderNo).toBe('SCO20260318-0001');
    });
    it('should create order within tenant', async () => {
      mockNumbering.nextSubconNo.mockResolvedValue('SCO20260318-0001');
      mockOrderRepo.create.mockReturnValue({ orderNo: 'SCO20260318-0001' } as SubconOrder);
      mockOrderRepo.save.mockResolvedValue({ orderNo: 'SCO20260318-0001' } as SubconOrder);

      await target.createOrder({ vendorCode: 'V001', itemCode: 'PART1', orderQty: 100 } as any, 'CO', 'P01');

      expect(mockOrderRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ orderNo: 'SCO20260318-0001', company: 'CO', plant: 'P01' }),
      );
    });

    it('should persist ITEM_CODE through the itemCode entity property', async () => {
      mockNumbering.nextSubconNo.mockResolvedValue('SCO20260318-0001');
      mockOrderRepo.create.mockReturnValue({ orderNo: 'SCO20260318-0001' } as SubconOrder);
      mockOrderRepo.save.mockResolvedValue({ orderNo: 'SCO20260318-0001' } as SubconOrder);

      await target.createOrder({
        vendorCode: 'V001',
        itemCode: 'ITEM-001',
        itemName: 'Harness A',
        orderQty: 100,
      } as any);

      expect(mockOrderRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          itemCode: 'ITEM-001',
          itemName: 'Harness A',
        }),
      );
      expect(mockOrderRepo.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          partCode: 'ITEM-001',
          partName: 'Harness A',
        }),
      );
    });

    it('should persist job order and routing process reference for subcontract workflow', async () => {
      mockNumbering.nextSubconNo.mockResolvedValue('SCO20260318-0001');
      mockOrderRepo.create.mockReturnValue({ orderNo: 'SCO20260318-0001' } as SubconOrder);
      mockOrderRepo.save.mockResolvedValue({ orderNo: 'SCO20260318-0001' } as SubconOrder);

      await target.createOrder({
        vendorCode: 'SUB001',
        itemCode: 'ITEM-001',
        orderQty: 100,
        jobOrderNo: 'JO-001',
        routingCode: 'RT-001',
        processSeq: 20,
        processCode: 'PLATING',
      } as any, 'CO', 'P01');

      expect(mockOrderRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          jobOrderNo: 'JO-001',
          routingCode: 'RT-001',
          processSeq: 20,
          processCode: 'PLATING',
          company: 'CO',
          plant: 'P01',
        }),
      );
    });
  });

  describe('updateOrder', () => {
    it('should update ITEM_CODE through the itemCode entity property', async () => {
      const order = { orderNo: 'ORD001', vendorCode: 'V001' } as SubconOrder;
      mockOrderRepo.findOne.mockResolvedValue(order);
      mockVendorRepo.findOne.mockResolvedValue({ vendorCode: 'V001' } as VendorMaster);
      mockDeliveryRepo.find.mockResolvedValue([]);
      mockReceiveRepo.find.mockResolvedValue([]);
      mockOrderRepo.update.mockResolvedValue({ affected: 1 } as any);

      await target.updateOrder('ORD001', {
        itemCode: 'ITEM-002',
        itemName: 'Harness B',
      } as any);

      expect(mockOrderRepo.update).toHaveBeenCalledWith(
        { orderNo: 'ORD001' },
        expect.objectContaining({
          itemCode: 'ITEM-002',
          itemName: 'Harness B',
        }),
      );
      expect(mockOrderRepo.update).not.toHaveBeenCalledWith(
        { orderNo: 'ORD001' },
        expect.objectContaining({
          partCode: 'ITEM-002',
          partName: 'Harness B',
        }),
      );
    });
    it('should update order within tenant', async () => {
      const order = { orderNo: 'ORD001', vendorCode: 'V001', company: 'CO', plant: 'P01' } as SubconOrder;
      mockOrderRepo.findOne.mockResolvedValue(order);
      mockVendorRepo.findOne.mockResolvedValue({ vendorCode: 'V001' } as VendorMaster);
      mockDeliveryRepo.find.mockResolvedValue([]);
      mockReceiveRepo.find.mockResolvedValue([]);
      mockOrderRepo.update.mockResolvedValue({ affected: 1 } as any);

      await target.updateOrder('ORD001', { itemName: 'Harness B' } as any, 'CO', 'P01');

      expect(mockOrderRepo.update).toHaveBeenCalledWith(
        { orderNo: 'ORD001', company: 'CO', plant: 'P01' },
        expect.objectContaining({ itemName: 'Harness B' }),
      );
    });
  });

  describe('cancelOrder', () => {
    it('should cancel ORDERED order', async () => {
      // Arrange
      const order = { orderNo: 'ORD001', status: 'ORDERED', vendorCode: 'V001' } as SubconOrder;
      mockOrderRepo.findOne.mockResolvedValue(order);
      mockVendorRepo.findOne.mockResolvedValue({ vendorCode: 'V001' } as VendorMaster);
      mockDeliveryRepo.find.mockResolvedValue([]);
      mockReceiveRepo.find.mockResolvedValue([]);
      mockOrderRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.cancelOrder('ORD001');

      // Assert
      expect(mockOrderRepo.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException for non-ORDERED status', async () => {
      // Arrange
      const order = { orderNo: 'ORD001', status: 'DELIVERED', vendorCode: 'V001' } as SubconOrder;
      mockOrderRepo.findOne.mockResolvedValue(order);
      mockVendorRepo.findOne.mockResolvedValue({ vendorCode: 'V001' } as VendorMaster);
      mockDeliveryRepo.find.mockResolvedValue([]);
      mockReceiveRepo.find.mockResolvedValue([]);

      // Act & Assert
      await expect(target.cancelOrder('ORD001')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── Summary ───
  describe('getSummary', () => {
    it('should return summary counts', async () => {
      // Arrange
      mockOrderRepo.count.mockResolvedValue(10);
      mockVendorRepo.count.mockResolvedValue(5);

      // Act
      const result = await target.getSummary();

      // Assert
      expect(result).toHaveProperty('totalOrders');
      expect(result).toHaveProperty('totalVendors');
    });
  });
});
