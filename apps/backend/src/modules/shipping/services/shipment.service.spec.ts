/**
 * @file src/modules/shipping/services/shipment.service.spec.ts
 * @description ShipmentService 단위 테스트 - 출하 CRUD + 팔레트 적재/하차 + 상태 관리
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { ShipmentService } from './shipment.service';
import { ShipmentLog } from '../../../entities/shipment-log.entity';
import { PalletMaster } from '../../../entities/pallet-master.entity';
import { BoxMaster } from '../../../entities/box-master.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('ShipmentService', () => {
  let target: ShipmentService;
  let mockShipmentRepo: DeepMocked<Repository<ShipmentLog>>;
  let mockPalletRepo: DeepMocked<Repository<PalletMaster>>;
  let mockBoxRepo: DeepMocked<Repository<BoxMaster>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockShipmentRepo = createMock<Repository<ShipmentLog>>();
    mockPalletRepo = createMock<Repository<PalletMaster>>();
    mockBoxRepo = createMock<Repository<BoxMaster>>();
    mockDataSource = createMock<DataSource>();
    mockQueryRunner = createMock<QueryRunner>();
    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentService,
        { provide: getRepositoryToken(ShipmentLog), useValue: mockShipmentRepo },
        { provide: getRepositoryToken(PalletMaster), useValue: mockPalletRepo },
        { provide: getRepositoryToken(BoxMaster), useValue: mockBoxRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<ShipmentService>(ShipmentService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findById', () => {
    it('should return shipment when found', async () => {
      mockShipmentRepo.findOne.mockResolvedValue({ shipNo: 'S-001' } as any);
      expect((await target.findById('S-001')).shipNo).toBe('S-001');
    });
    it('should throw NotFoundException', async () => {
      mockShipmentRepo.findOne.mockResolvedValue(null);
      await expect(target.findById('X')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create shipment', async () => {
      mockShipmentRepo.findOne.mockResolvedValue(null);
      const saved = { shipNo: 'S-001', status: 'PREPARING' } as any;
      mockShipmentRepo.create.mockReturnValue(saved);
      mockShipmentRepo.save.mockResolvedValue(saved);
      const result = await target.create({ shipNo: 'S-001' } as any);
      expect(result.status).toBe('PREPARING');
    });
    it('should throw ConflictException on duplicate', async () => {
      mockShipmentRepo.findOne.mockResolvedValue({ shipNo: 'S-001' } as any);
      await expect(target.create({ shipNo: 'S-001' } as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('should delete PREPARING shipment with no pallets', async () => {
      mockShipmentRepo.findOne.mockResolvedValue({ shipNo: 'S-001', status: 'PREPARING', palletCount: 0 } as any);
      mockShipmentRepo.delete.mockResolvedValue({ affected: 1 } as any);
      const result = await target.delete('S-001');
      expect(result.deleted).toBe(true);
    });
    it('should throw when SHIPPED', async () => {
      mockShipmentRepo.findOne.mockResolvedValue({ shipNo: 'S-001', status: 'SHIPPED' } as any);
      await expect(target.delete('S-001')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated shipments', async () => {
      mockShipmentRepo.find.mockResolvedValue([]);
      mockShipmentRepo.count.mockResolvedValue(0);
      const r = await target.findAll({} as any);
      expect(r.data).toEqual([]);
    });
  });

  describe('findUnsyncedForErp', () => {
    it('should return unsynced shipments', async () => {
      mockShipmentRepo.find.mockResolvedValue([{ shipNo: 'S1' } as any]);
      const r = await target.findUnsyncedForErp();
      expect(r).toHaveLength(1);
    });
  });

  describe('markAsSynced', () => {
    it('should mark shipments as synced', async () => {
      mockShipmentRepo.update.mockResolvedValue({ affected: 2 } as any);
      const r = await target.markAsSynced(['S1', 'S2']);
      expect(r.count).toBe(2);
    });
  });
});
