/**
 * @file src/modules/shipping/services/customer-order.service.spec.ts
 * @description CustomerOrderService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { CustomerOrderService } from './customer-order.service';
import { CustomerOrder } from '../../../entities/customer-order.entity';
import { CustomerOrderItem } from '../../../entities/customer-order-item.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('CustomerOrderService', () => {
  let target: CustomerOrderService;
  let mockOrderRepo: DeepMocked<Repository<CustomerOrder>>;
  let mockItemRepo: DeepMocked<Repository<CustomerOrderItem>>;
  let mockPartRepo: DeepMocked<Repository<PartMaster>>;
  let mockDataSource: DeepMocked<DataSource>;

  beforeEach(async () => {
    mockOrderRepo = createMock<Repository<CustomerOrder>>();
    mockItemRepo = createMock<Repository<CustomerOrderItem>>();
    mockPartRepo = createMock<Repository<PartMaster>>();
    mockDataSource = createMock<DataSource>();
    const mockQr = createMock<QueryRunner>();
    mockDataSource.createQueryRunner.mockReturnValue(mockQr);
    mockQr.connect.mockResolvedValue(undefined);
    mockQr.startTransaction.mockResolvedValue(undefined);
    mockQr.commitTransaction.mockResolvedValue(undefined);
    mockQr.rollbackTransaction.mockResolvedValue(undefined);
    mockQr.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerOrderService,
        { provide: getRepositoryToken(CustomerOrder), useValue: mockOrderRepo },
        { provide: getRepositoryToken(CustomerOrderItem), useValue: mockItemRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<CustomerOrderService>(CustomerOrderService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findById', () => {
    it('should return order with items', async () => {
      mockOrderRepo.findOne.mockResolvedValue({ orderNo: 'CO-001' } as any);
      mockItemRepo.find.mockResolvedValue([]);
      const r = await target.findById('CO-001');
      expect(r.orderNo).toBe('CO-001');
    });
    it('should throw NotFoundException', async () => {
      mockOrderRepo.findOne.mockResolvedValue(null);
      await expect(target.findById('X')).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete RECEIVED order', async () => {
      mockOrderRepo.findOne.mockResolvedValue({ orderNo: 'CO-001', status: 'RECEIVED' } as any);
      mockItemRepo.find.mockResolvedValue([]);
      mockOrderRepo.delete.mockResolvedValue({ affected: 1 } as any);
      const r = await target.delete('CO-001');
      expect(r.deleted).toBe(true);
    });
    it('should throw when not RECEIVED', async () => {
      mockOrderRepo.findOne.mockResolvedValue({ orderNo: 'CO-001', status: 'CONFIRMED' } as any);
      mockItemRepo.find.mockResolvedValue([]);
      await expect(target.delete('CO-001')).rejects.toThrow(BadRequestException);
    });
  });
});
