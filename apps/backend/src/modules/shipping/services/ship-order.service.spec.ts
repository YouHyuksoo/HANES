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

describe('ShipOrderService', () => {
  let target: ShipOrderService;
  let mockOrderRepo: DeepMocked<Repository<ShipmentOrder>>;
  let mockItemRepo: DeepMocked<Repository<ShipmentOrderItem>>;
  let mockPartRepo: DeepMocked<Repository<PartMaster>>;
  let mockDataSource: DeepMocked<DataSource>;

  beforeEach(async () => {
    mockOrderRepo = createMock<Repository<ShipmentOrder>>();
    mockItemRepo = createMock<Repository<ShipmentOrderItem>>();
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
        ShipOrderService,
        { provide: getRepositoryToken(ShipmentOrder), useValue: mockOrderRepo },
        { provide: getRepositoryToken(ShipmentOrderItem), useValue: mockItemRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartRepo },
        { provide: DataSource, useValue: mockDataSource },
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
});
