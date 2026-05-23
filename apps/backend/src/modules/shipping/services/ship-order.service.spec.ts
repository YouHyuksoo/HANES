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
import { MockLoggerService } from '../../../common/test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';

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
