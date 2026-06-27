import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HoldService } from './hold.service';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { MockLoggerService } from '@test/mock-logger.service';

describe('HoldService', () => {
  let service: HoldService;
  let matLotRepo: DeepMocked<Repository<MatLot>>;
  let matStockRepo: DeepMocked<Repository<MatStock>>;
  let partRepo: DeepMocked<Repository<ItemMaster>>;
  let partnerRepo: DeepMocked<Repository<PartnerMaster>>;

  beforeEach(async () => {
    matLotRepo = createMock<Repository<MatLot>>();
    matStockRepo = createMock<Repository<MatStock>>();
    partRepo = createMock<Repository<ItemMaster>>();
    partnerRepo = createMock<Repository<PartnerMaster>>();
    partnerRepo.find.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HoldService,
        { provide: getRepositoryToken(MatLot), useValue: matLotRepo },
        { provide: getRepositoryToken(MatStock), useValue: matStockRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: partRepo },
        { provide: getRepositoryToken(PartnerMaster), useValue: partnerRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    service = module.get(HoldService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('품목 마스터가 누락되어도 HOLD 목록의 LOT 원본 itemCode는 유지한다', async () => {
      matLotRepo.find.mockResolvedValue([
        { matUid: 'MAT-MISSING', itemCode: 'ITEM-MISSING', status: 'HOLD' } as MatLot,
      ]);
      matLotRepo.count.mockResolvedValue(1);
      partRepo.find.mockResolvedValue([]);
      matStockRepo.find.mockResolvedValue([]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          matUid: 'MAT-MISSING',
          itemCode: 'ITEM-MISSING',
          itemName: null,
          unit: null,
          warehouseCode: null,
        }),
      );
    });
  });

  describe('hold', () => {
    it('throws when lot does not exist', async () => {
      matLotRepo.findOne.mockResolvedValue(null);

      await expect(service.hold({ matUid: 'MAT-404', reason: 'test' })).rejects.toThrow(NotFoundException);
    });

    it('throws when lot is depleted', async () => {
      matLotRepo.findOne.mockResolvedValue({ matUid: 'MAT-001', status: 'DEPLETED' } as MatLot);

      await expect(service.hold({ matUid: 'MAT-001', reason: 'test' })).rejects.toThrow(BadRequestException);
    });

    it('updates lot status to HOLD', async () => {
      matLotRepo.findOne
        .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-001', status: 'NORMAL' } as MatLot)
        .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-001', status: 'HOLD' } as MatLot);
      partRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Part 1' } as ItemMaster);

      const result = await service.hold({ matUid: 'MAT-001', reason: 'test' });

      expect(matLotRepo.update).toHaveBeenCalledWith({ matUid: 'MAT-001' }, { status: 'HOLD' });
      expect(result.status).toBe('HOLD');
      expect(result.itemCode).toBe('ITEM-001');
    });

    it('품목 마스터가 누락되어도 HOLD 결과의 LOT 원본 itemCode는 유지한다', async () => {
      matLotRepo.findOne
        .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-MISSING', status: 'NORMAL' } as MatLot)
        .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-MISSING', status: 'HOLD' } as MatLot);
      partRepo.findOne.mockResolvedValue(null);

      const result = await service.hold({ matUid: 'MAT-001', reason: 'test' });

      expect(result).toEqual(
        expect.objectContaining({
          matUid: 'MAT-001',
          itemCode: 'ITEM-MISSING',
          itemName: null,
        }),
      );
    });
  });

  describe('release', () => {
    it('throws when lot is not HOLD', async () => {
      matLotRepo.findOne.mockResolvedValue({ matUid: 'MAT-001', status: 'NORMAL' } as MatLot);

      await expect(service.release({ matUid: 'MAT-001' })).rejects.toThrow(BadRequestException);
    });

    it('updates lot status to NORMAL', async () => {
      matLotRepo.findOne
        .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-001', status: 'HOLD' } as MatLot)
        .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-001', status: 'NORMAL' } as MatLot);
      partRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Part 1' } as ItemMaster);

      const result = await service.release({ matUid: 'MAT-001' });

      expect(matLotRepo.update).toHaveBeenCalledWith({ matUid: 'MAT-001' }, { status: 'NORMAL' });
      expect(result.status).toBe('NORMAL');
      expect(result.itemCode).toBe('ITEM-001');
    });

    it('품목 마스터가 누락되어도 HOLD 해제 결과의 LOT 원본 itemCode는 유지한다', async () => {
      matLotRepo.findOne
        .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-MISSING', status: 'HOLD' } as MatLot)
        .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-MISSING', status: 'NORMAL' } as MatLot);
      partRepo.findOne.mockResolvedValue(null);

      const result = await service.release({ matUid: 'MAT-001' });

      expect(result).toEqual(
        expect.objectContaining({
          matUid: 'MAT-001',
          itemCode: 'ITEM-MISSING',
          itemName: null,
        }),
      );
    });

    it('applies tenant scope when releasing', async () => {
      matLotRepo.findOne
        .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-001', status: 'HOLD' } as MatLot)
        .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-001', status: 'NORMAL' } as MatLot);
      partRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Part 1' } as ItemMaster);

      await service.release({ matUid: 'MAT-001' }, 'C1', 'P1');

      expect(matLotRepo.findOne).toHaveBeenCalledWith({
        where: { matUid: 'MAT-001', company: 'C1', plant: 'P1' },
      });
      expect(matLotRepo.update).toHaveBeenCalledWith(
        { matUid: 'MAT-001', company: 'C1', plant: 'P1' },
        { status: 'NORMAL' },
      );
    });
  });
});
