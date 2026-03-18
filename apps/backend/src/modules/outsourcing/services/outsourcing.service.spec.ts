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
import { SeqGeneratorService } from '../../../shared/seq-generator.service';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('OutsourcingService', () => {
  let target: OutsourcingService;
  let mockOrderRepo: DeepMocked<Repository<SubconOrder>>;
  let mockDeliveryRepo: DeepMocked<Repository<SubconDelivery>>;
  let mockReceiveRepo: DeepMocked<Repository<SubconReceive>>;
  let mockVendorRepo: DeepMocked<Repository<VendorMaster>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockSeqGenerator: DeepMocked<SeqGeneratorService>;

  beforeEach(async () => {
    mockOrderRepo = createMock<Repository<SubconOrder>>();
    mockDeliveryRepo = createMock<Repository<SubconDelivery>>();
    mockReceiveRepo = createMock<Repository<SubconReceive>>();
    mockVendorRepo = createMock<Repository<VendorMaster>>();
    mockDataSource = createMock<DataSource>();
    mockSeqGenerator = createMock<SeqGeneratorService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutsourcingService,
        { provide: getRepositoryToken(SubconOrder), useValue: mockOrderRepo },
        { provide: getRepositoryToken(SubconDelivery), useValue: mockDeliveryRepo },
        { provide: getRepositoryToken(SubconReceive), useValue: mockReceiveRepo },
        { provide: getRepositoryToken(VendorMaster), useValue: mockVendorRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: SeqGeneratorService, useValue: mockSeqGenerator },
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
      const order = { orderNo: 'ORD001', vendorId: 'V001' } as SubconOrder;
      mockOrderRepo.findOne.mockResolvedValue(order);
      mockVendorRepo.findOne.mockResolvedValue({ vendorCode: 'V001' } as VendorMaster);
      mockDeliveryRepo.find.mockResolvedValue([]);
      mockReceiveRepo.find.mockResolvedValue([]);

      // Act
      const result = await target.findOrderById('ORD001');

      // Assert
      expect(result.orderNo).toBe('ORD001');
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
      mockSeqGenerator.nextSubconNo.mockResolvedValue('SCO20260318-0001');
      const order = { orderNo: 'SCO20260318-0001' } as SubconOrder;
      mockOrderRepo.create.mockReturnValue(order);
      mockOrderRepo.save.mockResolvedValue(order);

      // Act
      const result = await target.createOrder({
        vendorId: 'V001',
        itemCode: 'PART1',
        orderQty: 100,
      } as any);

      // Assert
      expect(result.orderNo).toBe('SCO20260318-0001');
    });
  });

  describe('cancelOrder', () => {
    it('should cancel ORDERED order', async () => {
      // Arrange
      const order = { orderNo: 'ORD001', status: 'ORDERED', vendorId: 'V001' } as SubconOrder;
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
      const order = { orderNo: 'ORD001', status: 'DELIVERED', vendorId: 'V001' } as SubconOrder;
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
