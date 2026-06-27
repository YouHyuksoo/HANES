/**
 * @file src/modules/material/services/shelf-life.service.spec.ts
 * @description ShelfLifeService 단위 테스트 - 유수명자재 만료 현황 조회
 *
 * 초보자 가이드:
 * - 유효기한이 있는 LOT만 조회하여 만료 상태 계산
 * - expiryStatus: EXPIRED, NEAR_EXPIRY, VALID
 * - 실행: `npx jest --testPathPattern="shelf-life.service.spec"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShelfLifeService } from './shelf-life.service';
import { MatLot } from '../../../entities/mat-lot.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { MockLoggerService } from '@test/mock-logger.service';

describe('ShelfLifeService', () => {
  let target: ShelfLifeService;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockItemMasterRepo: DeepMocked<Repository<ItemMaster>>;
  let mockPartnerMasterRepo: DeepMocked<Repository<PartnerMaster>>;

  beforeEach(async () => {
    mockMatLotRepo = createMock<Repository<MatLot>>();
    mockItemMasterRepo = createMock<Repository<ItemMaster>>();
    mockPartnerMasterRepo = createMock<Repository<PartnerMaster>>();
    mockPartnerMasterRepo.find.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShelfLifeService,
        { provide: getRepositoryToken(MatLot), useValue: mockMatLotRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: mockItemMasterRepo },
        { provide: getRepositoryToken(PartnerMaster), useValue: mockPartnerMasterRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<ShelfLifeService>(ShelfLifeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('유효기한 있는 LOT 목록을 만료 상태와 함께 반환한다', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60);

      const lot = {
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        expireDate: futureDate,
        status: 'NORMAL',
      } as MatLot;

      mockMatLotRepo.find.mockResolvedValue([lot]);
      mockMatLotRepo.count.mockResolvedValue(1);
      mockItemMasterRepo.find.mockResolvedValue([
        { itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as ItemMaster,
      ]);

      const result = await target.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].expiryStatus).toBe('VALID');
      expect(result.data[0].daysUntilExpiry).toBeGreaterThan(30);
    });

    it('만료된 LOT을 EXPIRED로 표시한다', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      const lot = {
        matUid: 'MAT-002',
        itemCode: 'ITEM-001',
        expireDate: pastDate,
      } as MatLot;

      mockMatLotRepo.find.mockResolvedValue([lot]);
      mockMatLotRepo.count.mockResolvedValue(1);
      mockItemMasterRepo.find.mockResolvedValue([
        { itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as ItemMaster,
      ]);

      const result = await target.findAll({ page: 1, limit: 10 });

      expect(result.data[0].expiryStatus).toBe('EXPIRED');
      expect(result.data[0].daysUntilExpiry).toBeLessThan(0);
    });

    it('만료 임박 LOT을 NEAR_EXPIRY로 표시한다', async () => {
      const nearDate = new Date();
      nearDate.setDate(nearDate.getDate() + 10);

      const lot = {
        matUid: 'MAT-003',
        itemCode: 'ITEM-001',
        expireDate: nearDate,
      } as MatLot;

      mockMatLotRepo.find.mockResolvedValue([lot]);
      mockMatLotRepo.count.mockResolvedValue(1);
      mockItemMasterRepo.find.mockResolvedValue([
        { itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as ItemMaster,
      ]);

      const result = await target.findAll({ page: 1, limit: 10, nearExpiryDays: 30 });

      expect(result.data[0].expiryStatus).toBe('NEAR_EXPIRY');
    });

    it('expiryStatus 필터가 적용된다', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60);

      mockMatLotRepo.find.mockResolvedValue([
        { matUid: 'MAT-001', itemCode: 'ITEM-001', expireDate: pastDate } as MatLot,
        { matUid: 'MAT-002', itemCode: 'ITEM-001', expireDate: futureDate } as MatLot,
      ]);
      mockMatLotRepo.count.mockResolvedValue(2);
      mockItemMasterRepo.find.mockResolvedValue([
        { itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as ItemMaster,
      ]);

      const result = await target.findAll({ page: 1, limit: 10, expiryStatus: 'EXPIRED' as any });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].expiryStatus).toBe('EXPIRED');
    });

    it('품목 마스터가 누락되어도 유수명 LOT 원본 itemCode는 유지한다', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60);

      mockMatLotRepo.find.mockResolvedValue([
        {
          matUid: 'MAT-MISSING',
          itemCode: 'ITEM-MISSING',
          expireDate: futureDate,
        } as MatLot,
      ]);
      mockMatLotRepo.count.mockResolvedValue(1);
      mockItemMasterRepo.find.mockResolvedValue([]);

      const result = await target.findAll({ page: 1, limit: 10 });

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          matUid: 'MAT-MISSING',
          itemCode: 'ITEM-MISSING',
          itemName: null,
          unit: null,
        }),
      );
    });

    it('유수명 LOT 품목 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60);

      mockMatLotRepo.find.mockResolvedValue([
        { matUid: 'MAT-001', itemCode: 'ITEM-001', expireDate: futureDate, company: 'C1', plant: 'P1' } as MatLot,
      ]);
      mockMatLotRepo.count.mockResolvedValue(1);
      mockItemMasterRepo.find.mockResolvedValue([]);

      await target.findAll({ page: 1, limit: 10 }, 'C1', 'P1');

      expect(mockItemMasterRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
    });
  });
});
