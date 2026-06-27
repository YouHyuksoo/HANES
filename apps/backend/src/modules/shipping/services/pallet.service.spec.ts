/**
 * @file src/modules/shipping/services/pallet.service.spec.ts
 * @description PalletService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { PalletService } from './pallet.service';
import { PalletMaster } from '../../../entities/pallet-master.entity';
import { BoxMaster } from '../../../entities/box-master.entity';
import { ShipmentLog } from '../../../entities/shipment-log.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';
import { NumberingService } from '../../../shared/numbering.service';

describe('PalletService', () => {
  let target: PalletService;
  let mockPalletRepo: DeepMocked<Repository<PalletMaster>>;
  let mockBoxRepo: DeepMocked<Repository<BoxMaster>>;
  let mockShipmentRepo: DeepMocked<Repository<ShipmentLog>>;
  let mockPartRepo: DeepMocked<Repository<ItemMaster>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockTx: DeepMocked<TransactionService>;
  let mockQr: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockPalletRepo = createMock<Repository<PalletMaster>>();
    mockBoxRepo = createMock<Repository<BoxMaster>>();
    mockShipmentRepo = createMock<Repository<ShipmentLog>>();
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
        PalletService,
        { provide: getRepositoryToken(PalletMaster), useValue: mockPalletRepo },
        { provide: getRepositoryToken(BoxMaster), useValue: mockBoxRepo },
        { provide: getRepositoryToken(ShipmentLog), useValue: mockShipmentRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: mockPartRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
        { provide: NumberingService, useValue: { nextPalletNo: jest.fn().mockResolvedValue('PLT-TEST') } },
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
    it('should reject unbound pallet creation', async () => {
      await expect(target.create({ palletNo: 'P-001' } as any)).rejects.toThrow('출하지시');
      expect(mockPalletRepo.create).not.toHaveBeenCalled();
      expect(mockPalletRepo.save).not.toHaveBeenCalled();
    });
    it('should not run duplicate check for unbound pallet creation', async () => {
      await expect(target.create({ palletNo: 'P-001' } as any)).rejects.toThrow(BadRequestException);
      expect(mockPalletRepo.findOne).not.toHaveBeenCalled();
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
      mockPalletRepo.findOne.mockResolvedValue({ palletNo: 'P-001', status: 'OPEN', boxCount: 3, shipOrderNo: 'SO-001' } as any);
      mockBoxRepo.find.mockResolvedValue([] as any);
      await target.closePallet('P-001');
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockQr.manager.update).toHaveBeenCalledWith(
        PalletMaster,
        { palletNo: 'P-001' },
        expect.objectContaining({ status: 'CLOSED' }),
      );
    });
    it('should throw for empty pallet', async () => {
      mockPalletRepo.findOne.mockResolvedValue({ palletNo: 'P-001', status: 'OPEN', boxCount: 0, shipOrderNo: 'SO-001' } as any);
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

    it('화면 적재/상태변경 URL에서 사용할 id로 palletNo를 함께 반환한다', async () => {
      mockPalletRepo.find.mockResolvedValue([{ palletNo: 'PAL-001', status: 'OPEN' }] as any);
      mockPalletRepo.count.mockResolvedValue(1);

      const result = await target.findAll({} as any);

      expect(result.data[0]).toEqual(expect.objectContaining({ id: 'PAL-001', palletNo: 'PAL-001' }));
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

    it('addBox rejects the general pallet API', async () => {
      mockPalletRepo.findOne
        .mockResolvedValueOnce({ palletNo: 'P-001', status: 'OPEN', shipOrderNo: 'SO-001' } as any);

      await expect(target.addBox('P-001', { boxIds: ['BOX-001'] } as any)).rejects.toThrow('출하지시');
      expect(mockTx.run).not.toHaveBeenCalled();
      expect(mockBoxRepo.find).not.toHaveBeenCalled();
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
        .mockResolvedValueOnce({ palletNo: 'P-001', status: 'CLOSED', shipmentId: null, shipOrderNo: null } as any)
        .mockResolvedValueOnce({ palletNo: 'P-001', status: 'LOADED', shipmentId: 'SHIP-001' } as any);
      mockShipmentRepo.findOne.mockResolvedValue({ shipNo: 'SHIP-001', status: 'PREPARING', shipOrderNo: null } as any);
      mockSummaryQb({ count: '1', boxCount: '1', totalQty: '2' });

      await target.assignToShipment('P-001', { shipmentId: 'SHIP-001' } as any);

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQr.commitTransaction).not.toHaveBeenCalled();
      expect(mockQr.release).not.toHaveBeenCalled();
    });

    it('assignToShipment blocks order-bound pallet from unrelated manual shipment', async () => {
      mockPalletRepo.findOne.mockResolvedValue({ palletNo: 'P-001', status: 'CLOSED', shipmentId: null, shipOrderNo: 'SO-001' } as any);
      mockShipmentRepo.findOne.mockResolvedValue({ shipNo: 'SHIP-001', status: 'PREPARING', shipOrderNo: null } as any);

      await expect(target.assignToShipment('P-001', { shipmentId: 'SHIP-001' } as any)).rejects.toThrow(BadRequestException);
      expect(mockTx.run).not.toHaveBeenCalled();
    });

    it('assignToShipment blocks pallet from a different ship order', async () => {
      mockPalletRepo.findOne.mockResolvedValue({ palletNo: 'P-001', status: 'CLOSED', shipmentId: null, shipOrderNo: 'SO-001' } as any);
      mockShipmentRepo.findOne.mockResolvedValue({ shipNo: 'SHIP-001', status: 'PREPARING', shipOrderNo: 'SO-002' } as any);

      await expect(target.assignToShipment('P-001', { shipmentId: 'SHIP-001' } as any)).rejects.toThrow(BadRequestException);
      expect(mockTx.run).not.toHaveBeenCalled();
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

  describe('getPalletSummary', () => {
    it('should resolve part names within the same tenant as the pallet summary', async () => {
      mockPalletRepo.findOne.mockResolvedValue({
        palletNo: 'P-001',
        status: 'OPEN',
        boxCount: 1,
        totalQty: 2,
      } as any);
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ itemCode: 'ITEM-1', boxCount: '1', qty: '2' }]),
      };
      (mockBoxRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);
      mockPartRepo.find.mockResolvedValue([{ itemCode: 'ITEM-1', itemName: 'Part A' }] as any);

      await target.getPalletSummary('P-001', 'C1', 'P1');

      expect(mockPartRepo.find).toHaveBeenCalledWith({
        where: { itemCode: expect.anything(), company: 'C1', plant: 'P1' },
        select: ['itemCode', 'itemName'],
      });
    });
  });
});
