/**
 * @file warehouse.service.spec.ts
 * @description WarehouseService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository, DataSource, getMetadataArgsStorage } from 'typeorm';
import { WarehouseService } from './warehouse.service';
import { Warehouse } from '../../../entities/warehouse.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MockLoggerService } from '@test/mock-logger.service';

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

  it('includes tenant columns in warehouse primary key metadata', () => {
    const primaryColumnNames = getMetadataArgsStorage()
      .columns
      .filter((column) => column.target === Warehouse && column.options.primary)
      .map((column) => column.propertyName);

    expect(primaryColumnNames).toEqual(expect.arrayContaining(['company', 'plant']));
  });

  describe('findOne', () => {
    it('should return warehouse', async () => {
      mockWhRepo.findOne.mockResolvedValue({ warehouseCode: 'WH-001' } as any);
      expect((await target.findOne('WH-001')).warehouseCode).toBe('WH-001');
    });
    it('should scope lookup by company and plant', async () => {
      mockWhRepo.findOne.mockResolvedValue({ warehouseCode: 'WH-001', company: 'C1', plant: 'P1' } as any);

      await target.findOne('WH-001', 'C1', 'P1');

      expect(mockWhRepo.findOne).toHaveBeenCalledWith({
        where: { warehouseCode: 'WH-001', company: 'C1', plant: 'P1' },
      });
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
    it('should persist company and plant from tenant context', async () => {
      mockWhRepo.findOne.mockResolvedValue(null);
      const saved = { warehouseCode: 'WH-001', company: 'TESTV', plant: 'WAREHOUSES' } as any;
      mockWhRepo.create.mockReturnValue(saved);
      mockWhRepo.save.mockResolvedValue(saved);

      const r = await target.create(
        { warehouseCode: 'WH-001', warehouseName: 'Test', warehouseType: 'RM' } as any,
        'TESTV',
        'WAREHOUSES',
      );

      expect(r).toBe(saved);
      expect(mockWhRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        warehouseCode: 'WH-001',
        company: 'TESTV',
        plant: 'WAREHOUSES',
      }));
    });
    it('should default warehouse plantCode from tenant plant when dto plantCode is omitted', async () => {
      mockWhRepo.findOne.mockResolvedValue(null);
      const saved = { warehouseCode: 'WH-001', company: 'C1', plant: 'P1', plantCode: 'P1' } as any;
      mockWhRepo.create.mockReturnValue(saved);
      mockWhRepo.save.mockResolvedValue(saved);

      await target.create(
        { warehouseCode: 'WH-001', warehouseName: 'Test', warehouseType: 'RM' } as any,
        'C1',
        'P1',
      );

      expect(mockWhRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        plantCode: 'P1',
        plant: 'P1',
      }));
    });
    it('should check duplicate warehouse code within tenant only', async () => {
      mockWhRepo.findOne.mockResolvedValue(null);
      const saved = { warehouseCode: 'WH-001', company: 'C1', plant: 'P1' } as any;
      mockWhRepo.create.mockReturnValue(saved);
      mockWhRepo.save.mockResolvedValue(saved);

      await target.create(
        { warehouseCode: 'WH-001', warehouseName: 'Test', warehouseType: 'RM' } as any,
        'C1',
        'P1',
      );

      expect(mockWhRepo.findOne).toHaveBeenCalledWith({
        where: { warehouseCode: 'WH-001', company: 'C1', plant: 'P1' },
      });
    });
    it('should throw ConflictException', async () => {
      mockWhRepo.findOne.mockResolvedValue({ warehouseCode: 'WH-001' } as any);
      await expect(target.create({ warehouseCode: 'WH-001' } as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should update warehouse within tenant only', async () => {
      mockWhRepo.findOne
        .mockResolvedValueOnce({ warehouseCode: 'WH-001', company: 'C1', plant: 'P1' } as any)
        .mockResolvedValueOnce({ warehouseCode: 'WH-001', warehouseName: 'Changed', company: 'C1', plant: 'P1' } as any);
      mockWhRepo.update.mockResolvedValue({ affected: 1 } as any);

      await target.update('WH-001', { warehouseName: 'Changed' } as any, 'C1', 'P1');

      expect(mockWhRepo.findOne).toHaveBeenNthCalledWith(1, {
        where: { warehouseCode: 'WH-001', company: 'C1', plant: 'P1' },
      });
      expect(mockWhRepo.update).toHaveBeenCalledWith(
        { warehouseCode: 'WH-001', company: 'C1', plant: 'P1' },
        expect.objectContaining({ warehouseName: 'Changed' }),
      );
      expect(mockWhRepo.findOne).toHaveBeenNthCalledWith(2, {
        where: { warehouseCode: 'WH-001', company: 'C1', plant: 'P1' },
      });
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
    it('should check stock and delete warehouse within tenant only', async () => {
      mockWhRepo.findOne.mockResolvedValue({ warehouseCode: 'WH-001', company: 'C1', plant: 'P1' } as any);
      mockStockRepo.count.mockResolvedValue(0);
      mockWhRepo.delete.mockResolvedValue({ affected: 1 } as any);

      await target.remove('WH-001', 'C1', 'P1');

      expect(mockWhRepo.findOne).toHaveBeenCalledWith({
        where: { warehouseCode: 'WH-001', company: 'C1', plant: 'P1' },
      });
      expect(mockStockRepo.count).toHaveBeenCalledWith({
        where: { warehouseCode: 'WH-001', company: 'C1', plant: 'P1' },
      });
      expect(mockWhRepo.delete).toHaveBeenCalledWith({ warehouseCode: 'WH-001', company: 'C1', plant: 'P1' });
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
    it('should find and create floor warehouse within tenant only', async () => {
      mockWhRepo.findOne.mockResolvedValue(null);
      const newWh = { warehouseCode: 'FLOOR_L1_P01', company: 'C1', plant: 'P1' } as any;
      mockWhRepo.create.mockReturnValue(newWh);
      mockWhRepo.save.mockResolvedValue(newWh);

      await target.getOrCreateFloorWarehouse('L1', 'P01', 'C1', 'P1');

      expect(mockWhRepo.findOne).toHaveBeenCalledWith({
        where: { warehouseCode: 'FLOOR_L1_P01', company: 'C1', plant: 'P1' },
      });
      expect(mockWhRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        warehouseCode: 'FLOOR_L1_P01',
        plantCode: 'P1',
        company: 'C1',
        plant: 'P1',
      }));
    });
  });

  describe('initDefaultWarehouses', () => {
    it('should initialize default warehouses within tenant only', async () => {
      mockWhRepo.find.mockResolvedValue([{ warehouseCode: 'RM_MAIN' } as Warehouse]);
      mockWhRepo.create.mockImplementation((payload) => payload as Warehouse);
      mockWhRepo.save.mockResolvedValue([] as any);

      await target.initDefaultWarehouses('C1', 'P1');

      expect(mockWhRepo.find).toHaveBeenCalledWith({
        where: expect.arrayContaining([
          { warehouseCode: 'RM_MAIN', company: 'C1', plant: 'P1' },
        ]),
        select: ['warehouseCode'],
      });
      expect(mockWhRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        warehouseCode: 'RM_SUB',
        plantCode: 'P1',
        company: 'C1',
        plant: 'P1',
      }));
    });
  });

  describe('getDefaultWarehouse', () => {
    it('should lookup default warehouse within tenant only', async () => {
      mockWhRepo.findOne.mockResolvedValue({ warehouseCode: 'RM_MAIN' } as any);

      await target.getDefaultWarehouse('RM', 'C1', 'P1');

      expect(mockWhRepo.findOne).toHaveBeenCalledWith({
        where: { warehouseType: 'RM', isDefault: 'Y', useYn: 'Y', company: 'C1', plant: 'P1' },
      });
    });
  });
});
