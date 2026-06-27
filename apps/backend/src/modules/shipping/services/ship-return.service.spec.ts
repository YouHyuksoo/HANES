/**
 * @file src/modules/shipping/services/ship-return.service.spec.ts
 * @description ShipReturnService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { ShipReturnService } from './ship-return.service';
import { ShipmentReturn } from '../../../entities/shipment-return.entity';
import { ShipmentReturnItem } from '../../../entities/shipment-return-item.entity';
import { ShipmentOrder } from '../../../entities/shipment-order.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('ShipReturnService', () => {
  let target: ShipReturnService;
  let mockReturnRepo: DeepMocked<Repository<ShipmentReturn>>;
  let mockReturnItemRepo: DeepMocked<Repository<ShipmentReturnItem>>;
  let mockShipOrderRepo: DeepMocked<Repository<ShipmentOrder>>;
  let mockPartRepo: DeepMocked<Repository<ItemMaster>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockTx: DeepMocked<TransactionService>;
  let mockQr: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockReturnRepo = createMock<Repository<ShipmentReturn>>();
    mockReturnItemRepo = createMock<Repository<ShipmentReturnItem>>();
    mockShipOrderRepo = createMock<Repository<ShipmentOrder>>();
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
        ShipReturnService,
        { provide: getRepositoryToken(ShipmentReturn), useValue: mockReturnRepo },
        { provide: getRepositoryToken(ShipmentReturnItem), useValue: mockReturnItemRepo },
        { provide: getRepositoryToken(ShipmentOrder), useValue: mockShipOrderRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: mockPartRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<ShipReturnService>(ShipReturnService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findById', () => {
    it('should return ship return', async () => {
      mockReturnRepo.findOne.mockResolvedValue({ returnNo: 'SR-001', shipmentId: null } as any);
      mockReturnItemRepo.find.mockResolvedValue([]);
      const r = await target.findById('SR-001');
      expect(r.returnNo).toBe('SR-001');
    });
    it('should throw NotFoundException', async () => {
      mockReturnRepo.findOne.mockResolvedValue(null);
      await expect(target.findById('X')).rejects.toThrow(NotFoundException);
    });
    it('should enrich return items with part names within tenant only', async () => {
      mockReturnRepo.findOne.mockResolvedValue({
        returnNo: 'SR-001',
        shipmentId: null,
        company: 'C1',
        plant: 'P1',
      } as any);
      mockReturnItemRepo.find.mockResolvedValue([
        { returnNo: 'SR-001', itemCode: 'ITEM-001', company: 'C1', plant: 'P1' } as ShipmentReturnItem,
      ]);
      mockPartRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Part A' } as ItemMaster);

      await target.findById('SR-001', 'C1', 'P1');

      expect(mockPartRepo.findOne).toHaveBeenCalledWith({
        where: { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' },
        select: ['itemCode', 'itemName'],
      });
    });
  });

  describe('delete', () => {
    it('should delete DRAFT return', async () => {
      mockReturnRepo.findOne.mockResolvedValue({ returnNo: 'SR-001', status: 'DRAFT', shipmentId: null } as any);
      mockReturnItemRepo.find.mockResolvedValue([]);
      mockReturnRepo.delete.mockResolvedValue({ affected: 1 } as any);
      const r = await target.delete('SR-001');
      expect(r.deleted).toBe(true);
    });
    it('should throw when not DRAFT', async () => {
      mockReturnRepo.findOne.mockResolvedValue({ returnNo: 'SR-001', status: 'CONFIRMED', shipmentId: null } as any);
      mockReturnItemRepo.find.mockResolvedValue([]);
      await expect(target.delete('SR-001')).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update through TransactionService', async () => {
      mockReturnRepo.findOne
        .mockResolvedValueOnce({ returnNo: 'SR-001', status: 'DRAFT', shipmentId: null } as any)
        .mockResolvedValueOnce({ returnNo: 'SR-001', status: 'DRAFT', shipmentId: null } as any);
      mockReturnItemRepo.find.mockResolvedValue([]);
      mockPartRepo.findOne.mockResolvedValue(null);

      await target.update('SR-001', { remark: 'Updated' } as any);

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQr.commitTransaction).not.toHaveBeenCalled();
      expect(mockQr.release).not.toHaveBeenCalled();
    });

    it('should block direct status changes', async () => {
      mockReturnRepo.findOne.mockResolvedValue({ returnNo: 'SR-001', status: 'DRAFT', shipmentId: null } as any);
      mockReturnItemRepo.find.mockResolvedValue([]);

      await expect(target.update('SR-001', { status: 'CONFIRMED' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should preserve tenant columns when replacing items', async () => {
      mockReturnRepo.findOne
        .mockResolvedValueOnce({ returnNo: 'SR-001', status: 'DRAFT', shipmentId: null, company: 'C1', plant: 'P1' } as any)
        .mockResolvedValueOnce({ returnNo: 'SR-001', status: 'DRAFT', shipmentId: null, company: 'C1', plant: 'P1' } as any);
      mockReturnItemRepo.find.mockResolvedValue([]);
      mockReturnItemRepo.create.mockImplementation((payload) => payload as any);
      mockPartRepo.findOne.mockResolvedValue(null);

      await target.update(
        'SR-001',
        { items: [{ itemCode: 'ITEM-1', returnQty: 2 }] } as any,
        'C1',
        'P1',
      );

      expect(mockReturnItemRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        returnNo: 'SR-001',
        itemCode: 'ITEM-1',
        company: 'C1',
        plant: 'P1',
      }));
    });
  });

  describe('create', () => {
    it('should create through TransactionService', async () => {
      mockReturnRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ returnNo: 'SR-001', status: 'DRAFT', shipmentId: null } as any);
      mockReturnRepo.create.mockReturnValue({ returnNo: 'SR-001' } as any);
      mockReturnItemRepo.create.mockImplementation((payload) => payload as any);
      mockQr.manager.save
        .mockResolvedValueOnce({ returnNo: 'SR-001' } as any)
        .mockResolvedValueOnce([] as any);
      mockReturnItemRepo.find.mockResolvedValue([]);
      mockPartRepo.findOne.mockResolvedValue(null);

      await target.create({
        returnNo: 'SR-001',
        items: [{ itemCode: 'ITEM-1', returnQty: 1 }],
      } as any);

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQr.commitTransaction).not.toHaveBeenCalled();
      expect(mockQr.release).not.toHaveBeenCalled();
    });

    it('should preserve tenant columns when creating items', async () => {
      mockReturnRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ returnNo: 'SR-001', status: 'DRAFT', shipmentId: null, company: 'C1', plant: 'P1' } as any);
      mockReturnRepo.create.mockReturnValue({ returnNo: 'SR-001', company: 'C1', plant: 'P1' } as any);
      mockReturnItemRepo.create.mockImplementation((payload) => payload as any);
      mockQr.manager.save
        .mockResolvedValueOnce({ returnNo: 'SR-001', company: 'C1', plant: 'P1' } as any)
        .mockResolvedValueOnce([] as any);
      mockReturnItemRepo.find.mockResolvedValue([]);
      mockPartRepo.findOne.mockResolvedValue(null);

      await target.create(
        {
          returnNo: 'SR-001',
          items: [{ itemCode: 'ITEM-1', returnQty: 1 }],
        } as any,
        'C1',
        'P1',
      );

      expect(mockReturnItemRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        returnNo: 'SR-001',
        itemCode: 'ITEM-1',
        company: 'C1',
        plant: 'P1',
      }));
    });
  });
});
