/**
 * @file src/modules/material/services/shelf-life.service.spec.ts
 * @description ShelfLifeService 단위 테스트 - 유수명자재 만료 현황 조회
 *
 * 초보자 가이드:
 * - 유효기한이 있는 LOT만 조회하여 만료 상태 계산
 * - expiryStatus: EXPIRED, NEAR_EXPIRY, VALID, DISCARDED
 * - 상태/검색/품목/잔량 조건은 전부 QueryBuilder WHERE(DB 조건)로 붙는지 검증한다
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

/** 체이닝 가능한 QueryBuilder mock — where/andWhere 호출을 기록한다 */
function createQbMock(rows: MatLot[], total: number) {
  const whereCalls: Array<{ sql: string; params?: Record<string, unknown> }> = [];
  const qb = {
    whereCalls,
    where: jest.fn((sql: string, params?: Record<string, unknown>) => { whereCalls.push({ sql, params }); return qb; }),
    andWhere: jest.fn((sql: string, params?: Record<string, unknown>) => { whereCalls.push({ sql, params }); return qb; }),
    orderBy: jest.fn(() => qb),
    addOrderBy: jest.fn(() => qb),
    skip: jest.fn(() => qb),
    take: jest.fn(() => qb),
    getManyAndCount: jest.fn().mockResolvedValue([rows, total]),
  };
  return qb;
}

describe('ShelfLifeService', () => {
  let target: ShelfLifeService;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockItemMasterRepo: DeepMocked<Repository<ItemMaster>>;
  let mockPartnerMasterRepo: DeepMocked<Repository<PartnerMaster>>;

  const mockRows = (rows: MatLot[], total = rows.length) => {
    const qb = createQbMock(rows, total);
    mockMatLotRepo.createQueryBuilder.mockReturnValue(qb as unknown as ReturnType<Repository<MatLot>['createQueryBuilder']>);
    return qb;
  };
  const whereSql = (qb: ReturnType<typeof createQbMock>) => qb.whereCalls.map((c) => c.sql.replace(/\s+/g, ' ')).join(' | ');

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

      mockRows([lot]);
      mockItemMasterRepo.find.mockResolvedValue([
        { itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as ItemMaster,
      ]);

      const result = await target.findAll({ page: 1, limit: 10, expiryStatus: 'VALID' });

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

      mockRows([lot]);
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

      mockRows([lot]);
      mockItemMasterRepo.find.mockResolvedValue([
        { itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as ItemMaster,
      ]);

      const result = await target.findAll({ page: 1, limit: 10, nearExpiryDays: 30 });

      expect(result.data[0].expiryStatus).toBe('NEAR_EXPIRY');
    });

    it('기본 조건은 관리 대상(만료+임박) + 폐기 제외 + 잔량>0 을 DB WHERE로 붙인다', async () => {
      const qb = mockRows([]);
      mockItemMasterRepo.find.mockResolvedValue([]);

      await target.findAll({ page: 1, limit: 10 }, 'C1', 'P1');

      const sql = whereSql(qb);
      expect(sql).toContain('lot.expireDate IS NOT NULL');
      expect(sql).toContain('lot.currentQty > 0');
      expect(sql).toContain("lot.status <> 'DISCARDED'");
      expect(sql).toContain('lot.expireDate <= :nearExpiryDate');
      expect(sql).toContain('lot.company = :company');
      expect(sql).toContain('lot.plant = :plant');
      // 페이지·건수는 DB에서 함께 산출
      expect(qb.getManyAndCount).toHaveBeenCalledTimes(1);
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('expiryStatus=EXPIRED 는 만료일 < 오늘(00:00) DB 조건으로 반영한다', async () => {
      const qb = mockRows([]);
      mockItemMasterRepo.find.mockResolvedValue([]);

      await target.findAll({ page: 1, limit: 10, expiryStatus: 'EXPIRED' });

      const call = qb.whereCalls.find((c) => c.sql.includes('lot.expireDate < :today'));
      expect(call).toBeDefined();
      const today = call?.params?.today as Date;
      expect(today.getHours()).toBe(0);
      expect(today.getMinutes()).toBe(0);
      expect(whereSql(qb)).not.toContain('lot.expireDate <= :nearExpiryDate');
    });

    it('expiryStatus=NEAR_EXPIRY 는 오늘 <= 만료일 <= 오늘+N 구간 조건, N은 nearExpiryDays', async () => {
      const qb = mockRows([]);
      mockItemMasterRepo.find.mockResolvedValue([]);

      await target.findAll({ page: 1, limit: 10, expiryStatus: 'NEAR_EXPIRY', nearExpiryDays: 30 });

      const call = qb.whereCalls.find((c) => c.sql.includes('lot.expireDate >= :today AND lot.expireDate <= :nearExpiryDate'));
      expect(call).toBeDefined();
      const today = call?.params?.today as Date;
      const near = call?.params?.nearExpiryDate as Date;
      expect(Math.round((near.getTime() - today.getTime()) / 86_400_000)).toBe(30);
    });

    it('검색어/품목코드/hasStockYn=N 은 메모리 필터가 아니라 DB 조건으로 반영한다', async () => {
      const qb = mockRows([]);
      mockItemMasterRepo.find.mockResolvedValue([]);

      await target.findAll({ page: 2, limit: 20, search: ' abc ', itemCode: 'ITEM-001', hasStockYn: 'N' });

      const sql = whereSql(qb);
      expect(sql).toContain('UPPER(lot.matUid) LIKE :search');
      expect(sql).toContain('UPPER(im.ITEM_NAME) LIKE :search');
      expect(sql).toContain('lot.itemCode = :itemCode');
      expect(sql).not.toContain('lot.currentQty > 0');
      const searchCall = qb.whereCalls.find((c) => c.sql.includes(':search'));
      expect(searchCall?.params?.search).toBe('%ABC%');
      expect(qb.skip).toHaveBeenCalledWith(20);
    });

    it('품목 마스터가 누락되어도 유수명 LOT 원본 itemCode는 유지한다', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60);

      mockRows([
        {
          matUid: 'MAT-MISSING',
          itemCode: 'ITEM-MISSING',
          expireDate: futureDate,
        } as MatLot,
      ]);
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

      mockRows([
        { matUid: 'MAT-001', itemCode: 'ITEM-001', expireDate: futureDate, company: 'C1', plant: 'P1' } as MatLot,
      ]);
      mockItemMasterRepo.find.mockResolvedValue([]);

      await target.findAll({ page: 1, limit: 10 }, 'C1', 'P1');

      expect(mockItemMasterRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
    });
  });
});
