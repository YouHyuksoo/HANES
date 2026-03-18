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
import { PartMaster } from '../../../entities/part-master.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('ShelfLifeService', () => {
  let target: ShelfLifeService;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockPartMasterRepo: DeepMocked<Repository<PartMaster>>;

  beforeEach(async () => {
    mockMatLotRepo = createMock<Repository<MatLot>>();
    mockPartMasterRepo = createMock<Repository<PartMaster>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShelfLifeService,
        { provide: getRepositoryToken(MatLot), useValue: mockMatLotRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartMasterRepo },
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
      mockPartMasterRepo.find.mockResolvedValue([
        { itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as PartMaster,
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
      mockPartMasterRepo.find.mockResolvedValue([
        { itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as PartMaster,
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
      mockPartMasterRepo.find.mockResolvedValue([
        { itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as PartMaster,
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
      mockPartMasterRepo.find.mockResolvedValue([
        { itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as PartMaster,
      ]);

      const result = await target.findAll({ page: 1, limit: 10, expiryStatus: 'EXPIRED' as any });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].expiryStatus).toBe('EXPIRED');
    });
  });
});
