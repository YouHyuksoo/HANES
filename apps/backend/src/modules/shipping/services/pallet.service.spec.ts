/**
 * @file src/modules/shipping/services/pallet.service.spec.ts
 * @description PalletService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { PalletService } from './pallet.service';
import { PalletMaster } from '../../../entities/pallet-master.entity';
import { BoxMaster } from '../../../entities/box-master.entity';
import { ShipmentLog } from '../../../entities/shipment-log.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('PalletService', () => {
  let target: PalletService;
  let mockPalletRepo: DeepMocked<Repository<PalletMaster>>;
  let mockBoxRepo: DeepMocked<Repository<BoxMaster>>;
  let mockShipmentRepo: DeepMocked<Repository<ShipmentLog>>;
  let mockPartRepo: DeepMocked<Repository<PartMaster>>;
  let mockDataSource: DeepMocked<DataSource>;

  beforeEach(async () => {
    mockPalletRepo = createMock<Repository<PalletMaster>>();
    mockBoxRepo = createMock<Repository<BoxMaster>>();
    mockShipmentRepo = createMock<Repository<ShipmentLog>>();
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
        PalletService,
        { provide: getRepositoryToken(PalletMaster), useValue: mockPalletRepo },
        { provide: getRepositoryToken(BoxMaster), useValue: mockBoxRepo },
        { provide: getRepositoryToken(ShipmentLog), useValue: mockShipmentRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<PalletService>(PalletService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findById', () => {
    it('should return pallet', async () => {
      mockPalletRepo.findOne.mockResolvedValue({ palletNo: 'P-001' } as any);
      expect((await target.findById('P-001')).palletNo).toBe('P-001');
    });
    it('should throw NotFoundException', async () => {
      mockPalletRepo.findOne.mockResolvedValue(null);
      await expect(target.findById('X')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create pallet', async () => {
      mockPalletRepo.findOne.mockResolvedValue(null);
      const saved = { palletNo: 'P-001', status: 'OPEN' } as any;
      mockPalletRepo.create.mockReturnValue(saved);
      mockPalletRepo.save.mockResolvedValue(saved);
      const result = await target.create({ palletNo: 'P-001' } as any);
      expect(result.status).toBe('OPEN');
    });
    it('should throw ConflictException', async () => {
      mockPalletRepo.findOne.mockResolvedValue({ palletNo: 'P-001' } as any);
      await expect(target.create({ palletNo: 'P-001' } as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('closePallet', () => {
    it('should close OPEN pallet with boxes', async () => {
      mockPalletRepo.findOne.mockResolvedValue({ palletNo: 'P-001', status: 'OPEN', boxCount: 3 } as any);
      mockPalletRepo.update.mockResolvedValue({ affected: 1 } as any);
      await target.closePallet('P-001');
      expect(mockPalletRepo.update).toHaveBeenCalled();
    });
    it('should throw for empty pallet', async () => {
      mockPalletRepo.findOne.mockResolvedValue({ palletNo: 'P-001', status: 'OPEN', boxCount: 0 } as any);
      await expect(target.closePallet('P-001')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated pallets', async () => {
      mockPalletRepo.find.mockResolvedValue([]);
      mockPalletRepo.count.mockResolvedValue(0);
      const r = await target.findAll({} as any);
      expect(r.data).toEqual([]);
    });
  });
});
