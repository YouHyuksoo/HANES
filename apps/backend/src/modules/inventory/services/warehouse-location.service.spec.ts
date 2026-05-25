/**
 * @file warehouse-location.service.spec.ts
 * @description WarehouseLocationService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository, getMetadataArgsStorage } from 'typeorm';
import { WarehouseLocationService } from './warehouse-location.service';
import { WarehouseLocation } from '../../../entities/warehouse-location.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { MockLoggerService } from '@test/mock-logger.service';

describe('WarehouseLocationService', () => {
  let target: WarehouseLocationService;
  let mockLocRepo: DeepMocked<Repository<WarehouseLocation>>;
  let mockWhRepo: DeepMocked<Repository<Warehouse>>;

  beforeEach(async () => {
    mockLocRepo = createMock<Repository<WarehouseLocation>>();
    mockWhRepo = createMock<Repository<Warehouse>>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehouseLocationService,
        { provide: getRepositoryToken(WarehouseLocation), useValue: mockLocRepo },
        { provide: getRepositoryToken(Warehouse), useValue: mockWhRepo },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<WarehouseLocationService>(WarehouseLocationService);
  });
  afterEach(() => jest.clearAllMocks());

  it('includes tenant columns in warehouse location primary key metadata', () => {
    const primaryColumnNames = getMetadataArgsStorage()
      .columns
      .filter((column) => column.target === WarehouseLocation && column.options.primary)
      .map((column) => column.propertyName);

    expect(primaryColumnNames).toEqual(expect.arrayContaining(['company', 'plant']));
  });

  describe('findAll', () => {
    it('should preserve location WAREHOUSE_CODE even when warehouse master is missing', async () => {
      mockLocRepo.find.mockResolvedValue([
        { warehouseCode: 'WH-MISSING', locationCode: 'A-01', locationName: 'A-01' } as WarehouseLocation,
      ]);
      mockWhRepo.find.mockResolvedValue([]);

      const r = await target.findAll();

      expect(r.data[0]).toEqual(
        expect.objectContaining({
          warehouseCode: 'WH-MISSING',
          warehouseName: '',
        }),
      );
    });

    it('should lookup warehouse names within the same tenant as locations', async () => {
      mockLocRepo.find.mockResolvedValue([
        { warehouseCode: 'WH-001', locationCode: 'A-01', locationName: 'A-01', company: 'C1', plant: 'P1' } as WarehouseLocation,
      ]);
      mockWhRepo.find.mockResolvedValue([
        { warehouseCode: 'WH-001', warehouseName: 'Main', company: 'C1', plant: 'P1' } as Warehouse,
      ]);

      await target.findAll(undefined, 'C1', 'P1');

      expect(mockLocRepo.find).toHaveBeenCalledWith({
        where: { company: 'C1', plant: 'P1' },
        order: { locationCode: 'ASC' },
      });
      expect(mockWhRepo.find).toHaveBeenCalledWith({
        where: { warehouseCode: expect.anything(), company: 'C1', plant: 'P1' },
      });
    });
  });

  describe('create', () => {
    it('should create location', async () => {
      mockLocRepo.findOne.mockResolvedValue(null);
      const saved = { warehouseCode: 'WH-001', locationCode: 'A-01' } as any;
      mockLocRepo.create.mockReturnValue(saved);
      mockLocRepo.save.mockResolvedValue(saved);
      const r = await target.create({ warehouseCode: 'WH-001', locationCode: 'A-01' } as any);
      expect(r.success).toBe(true);
    });
    it('should check duplicate location within tenant only', async () => {
      mockLocRepo.findOne.mockResolvedValue(null);
      const saved = { warehouseCode: 'WH-001', locationCode: 'A-01', company: 'C1', plant: 'P1' } as any;
      mockLocRepo.create.mockReturnValue(saved);
      mockLocRepo.save.mockResolvedValue(saved);

      await target.create({ warehouseCode: 'WH-001', locationCode: 'A-01' } as any, 'C1', 'P1');

      expect(mockLocRepo.findOne).toHaveBeenCalledWith({
        where: { warehouseCode: 'WH-001', locationCode: 'A-01', company: 'C1', plant: 'P1' },
      });
    });
    it('should throw ConflictException', async () => {
      mockLocRepo.findOne.mockResolvedValue({ locationCode: 'A-01' } as any);
      await expect(target.create({ warehouseCode: 'WH-001', locationCode: 'A-01' } as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should update location', async () => {
      const loc = { warehouseCode: 'WH-001', locationCode: 'A-01' } as any;
      mockLocRepo.findOne.mockResolvedValue(loc);
      mockLocRepo.save.mockResolvedValue(loc);
      const r = await target.update('WH-001::A-01', {} as any);
      expect(r.success).toBe(true);
    });
    it('should update location within tenant only', async () => {
      const loc = { warehouseCode: 'WH-001', locationCode: 'A-01', company: 'C1', plant: 'P1' } as any;
      mockLocRepo.findOne.mockResolvedValue(loc);
      mockLocRepo.save.mockResolvedValue(loc);

      await target.update('WH-001::A-01', { locationName: 'Changed' } as any, 'C1', 'P1');

      expect(mockLocRepo.findOne).toHaveBeenCalledWith({
        where: { warehouseCode: 'WH-001', locationCode: 'A-01', company: 'C1', plant: 'P1' },
      });
      expect(mockLocRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        warehouseCode: 'WH-001',
        locationCode: 'A-01',
        locationName: 'Changed',
      }));
    });
    it('should keep tenant and location key columns from the matched location when update payload contains them', async () => {
      const loc = { warehouseCode: 'WH-001', locationCode: 'A-01', company: 'C1', plant: 'P1', locationName: 'Old' } as any;
      mockLocRepo.findOne.mockResolvedValue(loc);
      mockLocRepo.save.mockImplementation(async (value) => value as WarehouseLocation);

      const result = await target.update('WH-001::A-01', {
        warehouseCode: 'WH-999',
        locationCode: 'Z-99',
        company: 'C2',
        plant: 'P2',
        locationName: 'Changed',
      } as any, 'C1', 'P1');

      expect(result.data).toEqual(expect.objectContaining({
        warehouseCode: 'WH-001',
        locationCode: 'A-01',
        company: 'C1',
        plant: 'P1',
        locationName: 'Changed',
      }));
    });
    it('should throw NotFoundException', async () => {
      mockLocRepo.findOne.mockResolvedValue(null);
      await expect(target.update('WH-001::X', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove location', async () => {
      mockLocRepo.findOne.mockResolvedValue({ warehouseCode: 'WH-001', locationCode: 'A-01' } as any);
      mockLocRepo.remove.mockResolvedValue({} as any);
      const r = await target.remove('WH-001::A-01');
      expect(r.success).toBe(true);
    });
    it('should remove location within tenant only', async () => {
      const loc = { warehouseCode: 'WH-001', locationCode: 'A-01', company: 'C1', plant: 'P1' } as any;
      mockLocRepo.findOne.mockResolvedValue(loc);
      mockLocRepo.remove.mockResolvedValue(loc);

      await target.remove('WH-001::A-01', 'C1', 'P1');

      expect(mockLocRepo.findOne).toHaveBeenCalledWith({
        where: { warehouseCode: 'WH-001', locationCode: 'A-01', company: 'C1', plant: 'P1' },
      });
    });
    it('should throw NotFoundException', async () => {
      mockLocRepo.findOne.mockResolvedValue(null);
      await expect(target.remove('WH-001::X')).rejects.toThrow(NotFoundException);
    });
  });
});
