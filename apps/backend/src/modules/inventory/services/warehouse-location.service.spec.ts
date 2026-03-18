/**
 * @file warehouse-location.service.spec.ts
 * @description WarehouseLocationService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { WarehouseLocationService } from './warehouse-location.service';
import { WarehouseLocation } from '../../../entities/warehouse-location.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

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

  describe('create', () => {
    it('should create location', async () => {
      mockLocRepo.findOne.mockResolvedValue(null);
      const saved = { warehouseCode: 'WH-001', locationCode: 'A-01' } as any;
      mockLocRepo.create.mockReturnValue(saved);
      mockLocRepo.save.mockResolvedValue(saved);
      const r = await target.create({ warehouseCode: 'WH-001', locationCode: 'A-01' } as any);
      expect(r.success).toBe(true);
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
    it('should throw NotFoundException', async () => {
      mockLocRepo.findOne.mockResolvedValue(null);
      await expect(target.remove('WH-001::X')).rejects.toThrow(NotFoundException);
    });
  });
});
