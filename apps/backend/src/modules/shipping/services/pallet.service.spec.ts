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
import { TransactionService } from '../../../shared/transaction.service';

describe('PalletService', () => {
  let target: PalletService;
  let mockPalletRepo: DeepMocked<Repository<PalletMaster>>;
  let mockBoxRepo: DeepMocked<Repository<BoxMaster>>;
  let mockShipmentRepo: DeepMocked<Repository<ShipmentLog>>;
  let mockPartRepo: DeepMocked<Repository<PartMaster>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockTx: DeepMocked<TransactionService>;
  let mockQr: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockPalletRepo = createMock<Repository<PalletMaster>>();
    mockBoxRepo = createMock<Repository<BoxMaster>>();
    mockShipmentRepo = createMock<Repository<ShipmentLog>>();
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
        PalletService,
        { provide: getRepositoryToken(PalletMaster), useValue: mockPalletRepo },
        { provide: getRepositoryToken(BoxMaster), useValue: mockBoxRepo },
        { provide: getRepositoryToken(ShipmentLog), useValue: mockShipmentRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
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

  describe('update', () => {
    it('should block direct status changes', async () => {
      mockPalletRepo.findOne.mockResolvedValue({ palletNo: 'P-001', status: 'OPEN' } as any);

      await expect(target.update('P-001', { status: 'LOADED' } as any)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockPalletRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('blocks delete after pallet entered shipping flow', async () => {
      mockPalletRepo.findOne.mockResolvedValue({
        palletNo: 'P-002',
        status: 'CLOSED',
        boxCount: 0,
        shipmentId: null,
      } as any);

      await expect(target.delete('P-002')).rejects.toThrow(BadRequestException);
      expect(mockPalletRepo.delete).not.toHaveBeenCalled();
    });

    it('allows delete only for empty open pallet', async () => {
      mockPalletRepo.findOne.mockResolvedValue({
        palletNo: 'P-003',
        status: 'OPEN',
        boxCount: 0,
        shipmentId: null,
      } as any);

      await expect(target.delete('P-003')).resolves.toEqual({ id: 'P-003', deleted: true });
      expect(mockPalletRepo.delete).toHaveBeenCalledWith({ palletNo: 'P-003' });
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

  describe('transactional workflows', () => {
    const mockSummaryQb = (row: Record<string, string>) => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(row),
      };
      (mockQr.manager.createQueryBuilder as jest.Mock).mockReturnValue(qb);
    };

    it('addBox uses TransactionService', async () => {
      mockPalletRepo.findOne
        .mockResolvedValueOnce({ palletNo: 'P-001', status: 'OPEN' } as any)
        .mockResolvedValueOnce({ palletNo: 'P-001', status: 'OPEN' } as any);
      mockBoxRepo.find.mockResolvedValue([{ boxNo: 'BOX-001', status: 'CLOSED', oqcStatus: 'PASS' }] as any);
      mockSummaryQb({ count: '1', totalQty: '2' });

      await target.addBox('P-001', { boxIds: ['BOX-001'] } as any);

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQr.commitTransaction).not.toHaveBeenCalled();
      expect(mockQr.release).not.toHaveBeenCalled();
    });

    it('removeBox uses TransactionService', async () => {
      mockPalletRepo.findOne
        .mockResolvedValueOnce({ palletNo: 'P-001', status: 'OPEN' } as any)
        .mockResolvedValueOnce({ palletNo: 'P-001', status: 'OPEN' } as any);
      mockBoxRepo.find.mockResolvedValue([{ boxNo: 'BOX-001', status: 'CLOSED', palletNo: 'P-001' }] as any);
      mockSummaryQb({ count: '0', totalQty: '0' });

      await target.removeBox('P-001', { boxIds: ['BOX-001'] } as any);

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQr.commitTransaction).not.toHaveBeenCalled();
      expect(mockQr.release).not.toHaveBeenCalled();
    });

    it('assignToShipment uses TransactionService', async () => {
      mockPalletRepo.findOne
        .mockResolvedValueOnce({ palletNo: 'P-001', status: 'CLOSED', shipmentId: null } as any)
        .mockResolvedValueOnce({ palletNo: 'P-001', status: 'LOADED', shipmentId: 'SHIP-001' } as any);
      mockShipmentRepo.findOne.mockResolvedValue({ shipNo: 'SHIP-001', status: 'PREPARING' } as any);
      mockSummaryQb({ count: '1', boxCount: '1', totalQty: '2' });

      await target.assignToShipment('P-001', { shipmentId: 'SHIP-001' } as any);

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQr.commitTransaction).not.toHaveBeenCalled();
      expect(mockQr.release).not.toHaveBeenCalled();
    });

    it('removeFromShipment uses TransactionService', async () => {
      mockPalletRepo.findOne
        .mockResolvedValueOnce({ palletNo: 'P-001', status: 'LOADED', shipmentId: 'SHIP-001' } as any)
        .mockResolvedValueOnce({ palletNo: 'P-001', status: 'CLOSED', shipmentId: null } as any);
      mockShipmentRepo.findOne.mockResolvedValue({ shipNo: 'SHIP-001', status: 'PREPARING' } as any);
      mockSummaryQb({ count: '0', boxCount: '0', totalQty: '0' });

      await target.removeFromShipment('P-001');

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQr.commitTransaction).not.toHaveBeenCalled();
      expect(mockQr.release).not.toHaveBeenCalled();
    });
  });
});
