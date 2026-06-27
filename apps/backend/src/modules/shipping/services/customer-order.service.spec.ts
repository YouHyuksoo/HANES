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
import { ItemMaster } from '../../../entities/item-master.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('CustomerOrderService', () => {
  let target: CustomerOrderService;
  let mockOrderRepo: DeepMocked<Repository<CustomerOrder>>;
  let mockItemRepo: DeepMocked<Repository<CustomerOrderItem>>;
  let mockPartRepo: DeepMocked<Repository<ItemMaster>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockTx: DeepMocked<TransactionService>;
  let mockQr: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockOrderRepo = createMock<Repository<CustomerOrder>>();
    mockItemRepo = createMock<Repository<CustomerOrderItem>>();
    mockPartRepo = createMock<Repository<ItemMaster>>();
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
        CustomerOrderService,
        { provide: getRepositoryToken(CustomerOrder), useValue: mockOrderRepo },
        { provide: getRepositoryToken(CustomerOrderItem), useValue: mockItemRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: mockPartRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
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
    it('should enrich order items with part names within tenant only', async () => {
      mockOrderRepo.findOne.mockResolvedValue({ orderNo: 'CO-001', company: 'C1', plant: 'P1' } as any);
      mockItemRepo.find.mockResolvedValue([{ orderNo: 'CO-001', itemCode: 'ITEM-001', company: 'C1', plant: 'P1' }] as any);
      mockPartRepo.find.mockResolvedValue([{ itemCode: 'ITEM-001', itemName: 'Part A' }] as any);

      await target.findById('CO-001', 'C1', 'P1');

      expect(mockPartRepo.find).toHaveBeenCalledWith({
        where: { itemCode: expect.anything(), company: 'C1', plant: 'P1' },
        select: ['itemCode', 'itemName'],
      });
    });
  });

  describe('findAll', () => {
    // findAll은 createQueryBuilder(getMany/getCount)로 목록을 조회한다.
    const mockListQb = (orders: any[]) => {
      const qb: any = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(orders),
        getCount: jest.fn().mockResolvedValue(orders.length),
        clone: jest.fn(),
      };
      qb.clone.mockReturnValue(qb);
      mockOrderRepo.createQueryBuilder.mockReturnValue(qb as any);
      return qb;
    };

    it('화면 수정 URL에서 사용할 id로 orderNo를 함께 반환한다', async () => {
      mockListQb([{ orderNo: 'CO-001', company: 'C1', plant: 'P1' }]);
      mockItemRepo.find.mockResolvedValue([]);
      mockPartRepo.find.mockResolvedValue([]);

      const result = await target.findAll({} as any, 'C1', 'P1');

      expect(result.data[0]).toEqual(expect.objectContaining({ id: 'CO-001', orderNo: 'CO-001' }));
    });

    it('should enrich listed order items with part names within tenant only', async () => {
      mockListQb([{ orderNo: 'CO-001', company: 'C1', plant: 'P1' }]);
      mockItemRepo.find.mockResolvedValue([{ orderNo: 'CO-001', itemCode: 'ITEM-001', company: 'C1', plant: 'P1' }] as any);
      mockPartRepo.find.mockResolvedValue([{ itemCode: 'ITEM-001', itemName: 'Part A' }] as any);

      await target.findAll({} as any, 'C1', 'P1');

      expect(mockPartRepo.find).toHaveBeenCalledWith({
        where: { itemCode: expect.anything(), company: 'C1', plant: 'P1' },
        select: ['itemCode', 'itemName'],
      });
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

  describe('update', () => {
    it('should update through TransactionService', async () => {
      mockOrderRepo.findOne
        .mockResolvedValueOnce({ orderNo: 'CO-001', status: 'RECEIVED' } as any)
        .mockResolvedValueOnce({ orderNo: 'CO-001', status: 'RECEIVED' } as any);
      mockItemRepo.find.mockResolvedValue([]);
      mockPartRepo.find.mockResolvedValue([]);

      await target.update('CO-001', { customerName: 'Updated' } as any);

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQr.commitTransaction).not.toHaveBeenCalled();
      expect(mockQr.release).not.toHaveBeenCalled();
    });

    it('should block direct status changes', async () => {
      mockOrderRepo.findOne.mockResolvedValue({ orderNo: 'CO-001', status: 'RECEIVED' } as any);
      mockItemRepo.find.mockResolvedValue([]);

      await expect(target.update('CO-001', { status: 'CONFIRMED' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should preserve tenant columns when replacing items', async () => {
      mockOrderRepo.findOne
        .mockResolvedValueOnce({ orderNo: 'CO-001', status: 'RECEIVED', company: 'C1', plant: 'P1' } as any)
        .mockResolvedValueOnce({ orderNo: 'CO-001', status: 'RECEIVED', company: 'C1', plant: 'P1' } as any);
      mockItemRepo.find.mockResolvedValue([]);
      mockItemRepo.create.mockImplementation((payload) => payload as any);
      mockPartRepo.find.mockResolvedValue([]);

      await target.update(
        'CO-001',
        { items: [{ itemCode: 'ITEM-1', orderQty: 3 }] } as any,
        'C1',
        'P1',
      );

      expect(mockItemRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        orderNo: 'CO-001',
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
        .mockResolvedValueOnce({ orderNo: 'CO-001', status: 'RECEIVED' } as any);
      mockOrderRepo.create.mockReturnValue({ orderNo: 'CO-001' } as any);
      mockItemRepo.create.mockImplementation((payload) => payload as any);
      mockQr.manager.save
        .mockResolvedValueOnce({ orderNo: 'CO-001' } as any)
        .mockResolvedValueOnce([] as any);
      mockItemRepo.find.mockResolvedValue([]);
      mockPartRepo.find.mockResolvedValue([]);

      await target.create({
        orderNo: 'CO-001',
        customerId: 'CUST-1',
        customerName: 'Customer',
        items: [{ itemCode: 'ITEM-1', orderQty: 1 }],
      } as any);

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQr.commitTransaction).not.toHaveBeenCalled();
      expect(mockQr.release).not.toHaveBeenCalled();
    });

    it('should preserve tenant columns when creating items', async () => {
      mockOrderRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ orderNo: 'CO-001', status: 'RECEIVED', company: 'C1', plant: 'P1' } as any);
      mockOrderRepo.create.mockReturnValue({ orderNo: 'CO-001', company: 'C1', plant: 'P1' } as any);
      mockItemRepo.create.mockImplementation((payload) => payload as any);
      mockQr.manager.save
        .mockResolvedValueOnce({ orderNo: 'CO-001', company: 'C1', plant: 'P1' } as any)
        .mockResolvedValueOnce([] as any);
      mockItemRepo.find.mockResolvedValue([]);
      mockPartRepo.find.mockResolvedValue([]);

      await target.create(
        {
          orderNo: 'CO-001',
          customerId: 'CUST-1',
          customerName: 'Customer',
          items: [{ itemCode: 'ITEM-1', orderQty: 1 }],
        } as any,
        'C1',
        'P1',
      );

      expect(mockItemRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        orderNo: 'CO-001',
        itemCode: 'ITEM-1',
        company: 'C1',
        plant: 'P1',
      }));
    });
  });
});
