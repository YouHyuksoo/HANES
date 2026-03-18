/**
 * @file warehouse.service.spec.ts
 * @description WarehouseService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { WarehouseService } from './warehouse.service';
import { Warehouse } from '../../../entities/warehouse.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('WarehouseService', () => {
  let target: WarehouseService;
  let mockWhRepo: DeepMocked<Repository<Warehouse>>;
  let mockStockRepo: DeepMocked<Repository<MatStock>>;
  let mockDataSource: DeepMocked<DataSource>;

  beforeEach(async () => {
    mockWhRepo = createMock<Repository<Warehouse>>();
    mockStockRepo = createMock<Repository<MatStock>>();
    mockDataSource = createMock<DataSource>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehouseService,
        { provide: getRepositoryToken(Warehouse), useValue: mockWhRepo },
        { provide: getRepositoryToken(MatStock), useValue: mockStockRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<WarehouseService>(WarehouseService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findOne', () => {
    it('should return warehouse', async () => {
      mockWhRepo.findOne.mockResolvedValue({ warehouseCode: 'WH-001' } as any);
      expect((await target.findOne('WH-001')).warehouseCode).toBe('WH-001');
    });
    it('should throw NotFoundException', async () => {
      mockWhRepo.findOne.mockResolvedValue(null);
      await expect(target.findOne('X')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create warehouse', async () => {
      mockWhRepo.findOne.mockResolvedValue(null);
      const saved = { warehouseCode: 'WH-001' } as any;
      mockWhRepo.create.mockReturnValue(saved);
      mockWhRepo.save.mockResolvedValue(saved);
      const r = await target.create({ warehouseCode: 'WH-001', warehouseName: 'Test', warehouseType: 'RM' } as any);
      expect(r.warehouseCode).toBe('WH-001');
    });
    it('should throw ConflictException', async () => {
      mockWhRepo.findOne.mockResolvedValue({ warehouseCode: 'WH-001' } as any);
      await expect(target.create({ warehouseCode: 'WH-001' } as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should throw when stock exists', async () => {
      mockWhRepo.findOne.mockResolvedValue({ warehouseCode: 'WH-001' } as any);
      mockStockRepo.count.mockResolvedValue(5);
      await expect(target.remove('WH-001')).rejects.toThrow(ConflictException);
    });
    it('should remove empty warehouse', async () => {
      mockWhRepo.findOne.mockResolvedValue({ warehouseCode: 'WH-001' } as any);
      mockStockRepo.count.mockResolvedValue(0);
      mockWhRepo.delete.mockResolvedValue({ affected: 1 } as any);
      const r = await target.remove('WH-001');
      expect(r.deleted).toBe(true);
    });
  });

  describe('findAll', () => {
    it('should return warehouses', async () => {
      mockWhRepo.find.mockResolvedValue([]);
      mockWhRepo.count.mockResolvedValue(0);
      const r = await target.findAll();
      expect(r.data).toEqual([]);
    });
  });

  describe('getOrCreateFloorWarehouse', () => {
    it('should return existing warehouse', async () => {
      mockWhRepo.findOne.mockResolvedValue({ warehouseCode: 'FLOOR_L1_P01' } as any);
      const r = await target.getOrCreateFloorWarehouse('L1', 'P01');
      expect(r.warehouseCode).toBe('FLOOR_L1_P01');
    });
    it('should create new warehouse when not found', async () => {
      mockWhRepo.findOne.mockResolvedValue(null);
      const newWh = { warehouseCode: 'FLOOR_L1_P01' } as any;
      mockWhRepo.create.mockReturnValue(newWh);
      mockWhRepo.save.mockResolvedValue(newWh);
      const r = await target.getOrCreateFloorWarehouse('L1', 'P01');
      expect(r.warehouseCode).toBe('FLOOR_L1_P01');
    });
  });
});
