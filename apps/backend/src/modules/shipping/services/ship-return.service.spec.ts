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
import { PartMaster } from '../../../entities/part-master.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('ShipReturnService', () => {
  let target: ShipReturnService;
  let mockReturnRepo: DeepMocked<Repository<ShipmentReturn>>;
  let mockReturnItemRepo: DeepMocked<Repository<ShipmentReturnItem>>;
  let mockShipOrderRepo: DeepMocked<Repository<ShipmentOrder>>;
  let mockPartRepo: DeepMocked<Repository<PartMaster>>;
  let mockDataSource: DeepMocked<DataSource>;

  beforeEach(async () => {
    mockReturnRepo = createMock<Repository<ShipmentReturn>>();
    mockReturnItemRepo = createMock<Repository<ShipmentReturnItem>>();
    mockShipOrderRepo = createMock<Repository<ShipmentOrder>>();
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
        ShipReturnService,
        { provide: getRepositoryToken(ShipmentReturn), useValue: mockReturnRepo },
        { provide: getRepositoryToken(ShipmentReturnItem), useValue: mockReturnItemRepo },
        { provide: getRepositoryToken(ShipmentOrder), useValue: mockShipOrderRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartRepo },
        { provide: DataSource, useValue: mockDataSource },
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
});
