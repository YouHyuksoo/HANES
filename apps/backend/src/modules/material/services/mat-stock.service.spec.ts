/**
 * @file src/modules/material/services/mat-stock.service.spec.ts
 * @description MatStockService 단위 테스트 - 재고 조회, 재고조정, 재고이동
 *
 * 초보자 가이드:
 * - adjustStock/transferStock은 DataSource + QueryRunner 트랜잭션 사용
 * - MatStock PK: warehouseCode + itemCode + matUid
 * - 실행: `npx jest --testPathPattern="mat-stock.service.spec"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner, MoreThan } from 'typeorm';
import { MatStockService } from './mat-stock.service';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { InvAdjLog } from '../../../entities/inv-adj-log.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { TransactionService } from '../../../shared/transaction.service';
import { SysConfigService } from '../../system/services/sys-config.service';
import { MockLoggerService } from '@test/mock-logger.service';

describe('MatStockService', () => {
  let target: MatStockService;
  let mockMatStockRepo: DeepMocked<Repository<MatStock>>;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockItemMasterRepo: DeepMocked<Repository<ItemMaster>>;
  let mockPartnerMasterRepo: DeepMocked<Repository<PartnerMaster>>;
  let mockInvAdjLogRepo: DeepMocked<Repository<InvAdjLog>>;
  let mockWarehouseRepo: DeepMocked<Repository<Warehouse>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;
  let mockTx: DeepMocked<TransactionService>;
  let mockSysConfig: DeepMocked<SysConfigService>;
  let stockQb: any;

  const createStock = (overrides: Partial<MatStock> = {}): MatStock =>
    ({
      warehouseCode: 'WH-01',
      itemCode: 'ITEM-001',
      matUid: 'MAT-001',
      qty: 100,
      availableQty: 90,
      reservedQty: 10,
      company: 'HANES',
      plant: 'P01',
      updatedAt: new Date(),
      ...overrides,
    }) as MatStock;

  // findAvailable 은 repository.find 가 아니라 createQueryBuilder 로 조회한다(DB ORDER BY FIFO).
  // getMany 가 반환하는 순서는 "DB가 이미 정렬해 돌려준 순서"를 흉내낸다.
  const mockAvailableStocksQb = (stocks: MatStock[]) => {
    const qb = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(stocks),
    };
    mockMatStockRepo.createQueryBuilder.mockReturnValue(qb as never);
    return qb;
  };

  beforeEach(async () => {
    mockMatStockRepo = createMock<Repository<MatStock>>();
    mockMatLotRepo = createMock<Repository<MatLot>>();
    mockItemMasterRepo = createMock<Repository<ItemMaster>>();
    mockPartnerMasterRepo = createMock<Repository<PartnerMaster>>();
    mockPartnerMasterRepo.find.mockResolvedValue([]);
    mockInvAdjLogRepo = createMock<Repository<InvAdjLog>>();
    mockWarehouseRepo = createMock<Repository<Warehouse>>();
    mockDataSource = createMock<DataSource>();
    mockQueryRunner = createMock<QueryRunner>();
    mockTx = createMock<TransactionService>();
    mockSysConfig = createMock<SysConfigService>();
    // 실 DB(company 40 / plant 1000) 기본값은 RCV_DATE 계열이 아니라 MFG_DATE 지만,
    // 키가 없을 때의 정규화 기본(RECEIVE_DATE)이 기존 계약이라 여기서는 null 을 돌려준다.
    mockSysConfig.getValue.mockResolvedValue(null);
    stockQb = {
      update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(), setParameters: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockTx.run.mockImplementation(async (callback: any) => callback(mockQueryRunner));
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);
    mockQueryRunner.manager.createQueryBuilder.mockReturnValue(stockQb);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatStockService,
        { provide: getRepositoryToken(MatStock), useValue: mockMatStockRepo },
        { provide: getRepositoryToken(MatLot), useValue: mockMatLotRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: mockItemMasterRepo },
        { provide: getRepositoryToken(PartnerMaster), useValue: mockPartnerMasterRepo },
        { provide: getRepositoryToken(InvAdjLog), useValue: mockInvAdjLogRepo },
        { provide: getRepositoryToken(Warehouse), useValue: mockWarehouseRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
        { provide: SysConfigService, useValue: mockSysConfig },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<MatStockService>(MatStockService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findAll ───
  describe('findAll', () => {
    it('페이지네이션과 함께 재고 목록을 반환한다', async () => {
      const stock = createStock();
      mockMatStockRepo.find.mockResolvedValue([stock]);
      mockMatStockRepo.count.mockResolvedValue(1);
      mockItemMasterRepo.find.mockResolvedValue([
        { itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA', safetyStock: 50 } as ItemMaster,
      ]);
      mockMatLotRepo.find.mockResolvedValue([]);
      mockWarehouseRepo.find.mockResolvedValue([
        { warehouseCode: 'WH-01', warehouseName: '자재창고' } as Warehouse,
      ]);

      const result = await target.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('품목/LOT 마스터가 누락되어도 재고 원본 itemCode와 matUid는 유지한다', async () => {
      const stock = createStock({ itemCode: 'ITEM-MISSING', matUid: 'MAT-MISSING' });
      mockMatStockRepo.find.mockResolvedValue([stock]);
      mockMatStockRepo.count.mockResolvedValue(1);
      mockItemMasterRepo.find.mockResolvedValue([]);
      mockMatLotRepo.find.mockResolvedValue([]);
      mockWarehouseRepo.find.mockResolvedValue([]);

      const result = await target.findAll({ page: 1, limit: 10 });

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          itemCode: 'ITEM-MISSING',
          itemName: null,
          unit: null,
          matUid: 'MAT-MISSING',
          manufactureDate: null,
          expireDate: null,
        }),
      );
    });

    it('재고 목록 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      const stock = createStock({ company: 'C1', plant: 'P1' });
      mockMatStockRepo.find.mockResolvedValue([stock]);
      mockMatStockRepo.count.mockResolvedValue(1);
      mockItemMasterRepo.find.mockResolvedValue([]);
      mockMatLotRepo.find.mockResolvedValue([]);
      mockWarehouseRepo.find.mockResolvedValue([]);

      await target.findAll({ page: 1, limit: 10 }, 'C1', 'P1');

      expect(mockItemMasterRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
      expect(mockMatLotRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
      expect(mockWarehouseRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
    });

    it('검색어(matUid/품목코드/품목명)는 DB WHERE(QueryBuilder)로 걸어 페이지 안에서 거르지 않는다', async () => {
      const stock = createStock({ matUid: 'MAT-SEARCH-001', itemCode: 'ITEM-001' });
      const qb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[stock], 1]),
      };
      mockMatStockRepo.createQueryBuilder.mockReturnValue(qb as any);
      mockItemMasterRepo.find.mockResolvedValue([
        { itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as ItemMaster,
      ]);
      mockMatLotRepo.find.mockResolvedValue([
        { matUid: 'MAT-SEARCH-001', itemCode: 'ITEM-001' } as MatLot,
      ]);
      mockWarehouseRepo.find.mockResolvedValue([]);

      const result = await target.findAll({ page: 2, limit: 10, search: 'mat-search' }, 'C1', 'P1');

      expect(mockMatStockRepo.find).not.toHaveBeenCalled();
      expect(qb.andWhere).toHaveBeenCalledWith('stock.qty > 0');
      expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('LIKE :search'), expect.objectContaining({ search: '%MAT-SEARCH%' }));
      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(result.total).toBe(1);
      expect(result.data[0].matUid).toBe('MAT-SEARCH-001');
    });

    it('기본 조회는 수량>0 조건을 DB where 에 건다 (소진 행은 페이지 밖으로 밀리지 않는다)', async () => {
      mockMatStockRepo.find.mockResolvedValue([]);
      mockMatStockRepo.count.mockResolvedValue(0);
      mockItemMasterRepo.find.mockResolvedValue([]);
      mockMatLotRepo.find.mockResolvedValue([]);
      mockWarehouseRepo.find.mockResolvedValue([]);

      await target.findAll({ page: 1, limit: 10 }, 'C1', 'P1');

      expect(mockMatStockRepo.find).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ qty: MoreThan(0), company: 'C1', plant: 'P1' }),
      }));
    });

    it('includeZero=true 면 수량 조건을 빼고 fromDate/toDate 는 최종변동일 구간(종료일 당일 포함)으로 반영한다', async () => {
      mockMatStockRepo.find.mockResolvedValue([]);
      mockMatStockRepo.count.mockResolvedValue(0);
      mockItemMasterRepo.find.mockResolvedValue([]);
      mockMatLotRepo.find.mockResolvedValue([]);
      mockWarehouseRepo.find.mockResolvedValue([]);

      await target.findAll({ page: 1, limit: 10, includeZero: true, fromDate: '2026-09-01', toDate: '2026-09-03' }, 'C1', 'P1');

      const call = mockMatStockRepo.find.mock.calls.at(-1)?.[0] as { where: { qty?: unknown; updatedAt?: { _type?: string; _value?: unknown } } };
      expect(call.where.qty).toBeUndefined();
      expect(call.where.updatedAt?._type).toBe('between');
      const [from, to] = call.where.updatedAt?._value as [Date, Date];
      expect(from.getTime()).toBeLessThan(to.getTime());
      expect(to.getDate()).toBe(3);
    });
  });

  // ─── findAvailable ───
  describe('findAvailable', () => {
    it('IQC PASS + 잔량 > 0인 재고만 반환한다', async () => {
      const stock = createStock();
      mockAvailableStocksQb([stock]);
      mockMatLotRepo.find.mockResolvedValue([
        { matUid: 'MAT-001', iqcStatus: 'PASS', status: 'NORMAL', itemCode: 'ITEM-001' } as MatLot,
      ]);
      mockItemMasterRepo.find.mockResolvedValue([
        { itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as ItemMaster,
      ]);

      const result = await target.findAvailable({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
    });

    it('HOLD LOT 은 재고가 있어도 출고 가능 목록에서 제외한다', async () => {
      mockAvailableStocksQb([createStock()]);
      mockMatLotRepo.find.mockResolvedValue([
        { matUid: 'MAT-001', iqcStatus: 'PASS', status: 'HOLD', itemCode: 'ITEM-001' } as MatLot,
      ]);
      mockItemMasterRepo.find.mockResolvedValue([]);

      const result = await target.findAvailable({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(0);
    });

    it.each(['MERGED', 'SPLIT', 'DISCARDED', 'DEPLETED'])(
      '종결 LOT(%s)은 MAT_STOCKS 잔량이 남아 있어도 출고 가능 목록에서 제외한다',
      async (status) => {
        mockAvailableStocksQb([createStock({ qty: 10, availableQty: 10 })]);
        mockMatLotRepo.find.mockResolvedValue([
          { matUid: 'MAT-001', iqcStatus: 'PASS', status, itemCode: 'ITEM-001' } as MatLot,
        ]);
        mockItemMasterRepo.find.mockResolvedValue([]);

        const result = await target.findAvailable({ page: 1, limit: 10 });

        expect(result.data).toHaveLength(0);
        expect(result.total).toBe(0);
      },
    );

    it('품목 마스터가 누락되어도 출고 가능 재고의 원본 itemCode와 matUid는 유지한다', async () => {
      const stock = createStock({ itemCode: 'ITEM-MISSING', matUid: 'MAT-001' });
      mockAvailableStocksQb([stock]);
      mockMatLotRepo.find.mockResolvedValue([
        { matUid: 'MAT-001', iqcStatus: 'PASS', status: 'NORMAL', itemCode: 'ITEM-MISSING' } as MatLot,
      ]);
      mockItemMasterRepo.find.mockResolvedValue([]);

      const result = await target.findAvailable({ page: 1, limit: 10 });

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          itemCode: 'ITEM-MISSING',
          itemName: null,
          unit: null,
          matUid: 'MAT-001',
        }),
      );
    });

    it('출고 가능 재고 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      const stock = createStock({ company: 'C1', plant: 'P1' });
      mockAvailableStocksQb([stock]);
      mockMatLotRepo.find.mockResolvedValue([
        { matUid: 'MAT-001', iqcStatus: 'PASS', status: 'NORMAL', itemCode: 'ITEM-001' } as MatLot,
      ]);
      mockItemMasterRepo.find.mockResolvedValue([]);

      await target.findAvailable({ page: 1, limit: 10 }, 'C1', 'P1');

      expect(mockMatLotRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
      expect(mockItemMasterRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
    });

    // FIFO 정렬은 이제 DB의 몫이라(Task 2), mock 으로는 "DB가 실제로 정렬한다"를 증명할 수
    // 없다(그건 오라클 스모크 테스트가 한다). 이 단위 테스트가 가진 유일한 이빨은 서비스가
    // 쿼리빌더에 정확히 어떤 계약(조인/조건/정렬/페이징)을 요청하는지다. 이미 정렬된 입력을
    // mock에 넣고 같은 순서가 나오는지 보던 이전 두 테스트는 통과 조건이 항상 참이라 삭제하고,
    // 쿼리빌더 호출 계약 하나로 합친다 — 이 중 하나라도 빠지면 반드시 실패해야 한다.
    it('LOT 조인 + FIFO 정렬 + 페이징 계약을 쿼리빌더에 정확히 건다 (find 대신 createQueryBuilder)', async () => {
      const qb = mockAvailableStocksQb([]);

      await target.findAvailable(
        { page: 2, limit: 20, itemCode: 'ITEM-001', warehouseCode: 'WH-01' } as never,
        'C1',
        'P1',
      );

      expect(mockMatStockRepo.find).not.toHaveBeenCalled();
      expect(qb.leftJoin).toHaveBeenCalledWith(MatLot, 'lot', 'lot.matUid = stock.matUid');
      expect(qb.where).toHaveBeenCalledWith('stock.qty > 0');
      expect(qb.andWhere).toHaveBeenCalledWith('stock.itemCode = :itemCode', { itemCode: 'ITEM-001' });
      expect(qb.andWhere).toHaveBeenCalledWith('stock.warehouseCode = :warehouseCode', { warehouseCode: 'WH-01' });
      expect(qb.andWhere).toHaveBeenCalledWith('stock.company = :company', { company: 'C1' });
      expect(qb.andWhere).toHaveBeenCalledWith('stock.plant = :plant', { plant: 'P1' });
      expect(qb.orderBy).toHaveBeenCalledWith('lot.recvDate', 'ASC', 'NULLS LAST');
      // 2차 키는 계보(ORIGIN). 이게 빠지면 분할 자식이 오늘 발번된 시리얼 때문에 같은
      // 입고일 그룹 맨 뒤로 밀려 방금 라벨 붙인 LOT 를 다시 분할하게 된다(finding #6).
      expect(qb.addOrderBy).toHaveBeenCalledWith('COALESCE(lot.origin, stock.matUid)', 'ASC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('stock.matUid', 'ASC');
      // 정렬 키 순서까지 계약이다 — 계보 키가 시리얼 키보다 먼저 와야 한다.
      expect(qb.addOrderBy.mock.calls.map((call) => call[0])).toEqual([
        'COALESCE(lot.origin, stock.matUid)',
        'stock.matUid',
      ]);
      // page=2, limit=20 → offset = (2-1)*20 = 20. skip/take 는 leftJoin 조인 컬럼 정렬과
      // 함께 쓰면 distinctAlias 페이징 래퍼를 타 ORA-00904 로 거부된다(2026-09-15 실측,
      // oracle-smoke.e2e-spec.ts 회귀 테스트 참조). offset/limit 으로만 페이징해야 한다.
      expect(qb.offset).toHaveBeenCalledWith(20);
      expect(qb.limit).toHaveBeenCalledWith(20);
    });

    // finding #10 — 모달은 입고일로 배분하는데 출고 정책은 FIFO_CRITERIA 로 위반을 판정했다.
    // 두 기준이 어긋나면 엄격히 FIFO 로 배분해도 FIFO_ACTION=BLOCK 에 막힌다.
    it('FIFO_CRITERIA=MFG_DATE 면 제조일자로 정렬한다', async () => {
      mockSysConfig.getValue.mockResolvedValue('MFG_DATE');
      const qb = mockAvailableStocksQb([]);

      await target.findAvailable({ page: 1, limit: 10 } as never, 'C1', 'P1');

      expect(mockSysConfig.getValue).toHaveBeenCalledWith('FIFO_CRITERIA', 'C1', 'P1');
      expect(qb.orderBy).toHaveBeenCalledWith('lot.manufactureDate', 'ASC', 'NULLS LAST');
      expect(qb.orderBy).not.toHaveBeenCalledWith('lot.recvDate', 'ASC', 'NULLS LAST');
    });

    it.each([
      ['RCV_DATE', 'lot.recvDate'],
      ['RECEIVE_DATE', 'lot.recvDate'],
      [null, 'lot.recvDate'],
      ['ALIEN_VALUE', 'lot.recvDate'],
    ])('FIFO_CRITERIA=%s 면 %s 로 정렬한다', async (configValue, expectedColumn) => {
      mockSysConfig.getValue.mockResolvedValue(configValue as never);
      const qb = mockAvailableStocksQb([]);

      await target.findAvailable({ page: 1, limit: 10 } as never, 'C1', 'P1');

      expect(qb.orderBy).toHaveBeenCalledWith(expectedColumn, 'ASC', 'NULLS LAST');
    });

    it('응답 행에 정렬 기준(fifoCriteria)과 제조일자를 함께 내려준다 — 프론트가 기준을 추측하지 않는다', async () => {
      mockSysConfig.getValue.mockResolvedValue('MFG_DATE');
      mockAvailableStocksQb([createStock()]);
      mockMatLotRepo.find.mockResolvedValue([
        {
          matUid: 'MAT-001', iqcStatus: 'PASS', status: 'NORMAL', itemCode: 'ITEM-001',
          recvDate: new Date('2026-07-03'), manufactureDate: new Date('2026-06-01'),
        } as MatLot,
      ]);
      mockItemMasterRepo.find.mockResolvedValue([]);

      const result = await target.findAvailable({ page: 1, limit: 10 } as never, 'C1', 'P1');

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          fifoCriteria: 'MFG_DATE',
          manufactureDate: new Date('2026-06-01'),
          recvDate: new Date('2026-07-03'),
        }),
      );
    });
  });

  // ─── findByPartAndWarehouse ───
  describe('findByPartAndWarehouse', () => {
    it('품목 + 창고로 재고를 찾아 반환한다', async () => {
      const stock = createStock();
      mockMatStockRepo.findOne.mockResolvedValue(stock);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as ItemMaster);
      mockMatLotRepo.findOne.mockResolvedValue(null);

      const result = await target.findByPartAndWarehouse('ITEM-001', 'WH-01');

      expect(result).not.toBeNull();
    });

    it('재고가 없으면 null 반환', async () => {
      mockMatStockRepo.findOne.mockResolvedValue(null);

      const result = await target.findByPartAndWarehouse('ITEM-001', 'WH-01');

      expect(result).toBeNull();
    });

    it('품목/LOT 마스터가 누락되어도 단건 재고 원본 itemCode와 matUid는 유지한다', async () => {
      const stock = createStock({ itemCode: 'ITEM-MISSING', matUid: 'MAT-MISSING' });
      mockMatStockRepo.findOne.mockResolvedValue(stock);
      mockItemMasterRepo.findOne.mockResolvedValue(null);
      mockMatLotRepo.findOne.mockResolvedValue(null);

      const result = await target.findByPartAndWarehouse('ITEM-MISSING', 'WH-01', 'MAT-MISSING');

      expect(result).toEqual(
        expect.objectContaining({
          itemCode: 'ITEM-MISSING',
          itemName: null,
          unit: null,
          matUid: 'MAT-MISSING',
        }),
      );
    });

    it('단건 재고의 품목/LOT 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      const stock = createStock({ company: 'C1', plant: 'P1' });
      mockMatStockRepo.findOne.mockResolvedValue(stock);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Item', unit: 'EA' } as ItemMaster);
      mockMatLotRepo.findOne.mockResolvedValue({ matUid: 'MAT-001', itemCode: 'ITEM-001' } as MatLot);

      await target.findByPartAndWarehouse('ITEM-001', 'WH-01', 'MAT-001', 'C1', 'P1');

      expect(mockMatStockRepo.findOne).toHaveBeenCalledWith({
        where: { itemCode: 'ITEM-001', warehouseCode: 'WH-01', matUid: 'MAT-001', company: 'C1', plant: 'P1' },
      });
      expect(mockItemMasterRepo.findOne).toHaveBeenCalledWith({
        where: { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' },
      });
      expect(mockMatLotRepo.findOne).toHaveBeenCalledWith({
        where: { matUid: 'MAT-001', company: 'C1', plant: 'P1' },
      });
    });
  });

  // ─── getStockSummary ───
  describe('getStockSummary', () => {
    it('품목별 재고 요약을 반환한다', async () => {
      const stock = createStock();
      mockMatStockRepo.find.mockResolvedValue([stock]);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as ItemMaster);
      mockMatLotRepo.find.mockResolvedValue([]);

      const result = await target.getStockSummary('ITEM-001');

      expect(result.itemCode).toBe('ITEM-001');
      expect(result.totalQty).toBe(100);
      expect(result.availableQty).toBe(90);
    });

    it('품목/LOT 마스터가 누락되어도 재고 요약의 원본 itemCode와 matUid는 유지한다', async () => {
      const stock = createStock({ itemCode: 'ITEM-MISSING', matUid: 'MAT-MISSING' });
      mockMatStockRepo.find.mockResolvedValue([stock]);
      mockItemMasterRepo.findOne.mockResolvedValue(null);
      mockMatLotRepo.find.mockResolvedValue([]);

      const result = await target.getStockSummary('ITEM-MISSING');

      expect(result.itemCode).toBe('ITEM-MISSING');
      expect(result.byWarehouse[0]).toEqual(
        expect.objectContaining({
          itemCode: 'ITEM-MISSING',
          itemName: null,
          unit: null,
          matUid: 'MAT-MISSING',
        }),
      );
    });

    it('재고 요약의 재고/품목/LOT 조회도 요청 테넌트 범위로 제한한다', async () => {
      const stock = createStock({ company: 'C1', plant: 'P1' });
      mockMatStockRepo.find.mockResolvedValue([stock]);
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Item', unit: 'EA' } as ItemMaster);
      mockMatLotRepo.find.mockResolvedValue([{ matUid: 'MAT-001', itemCode: 'ITEM-001' } as MatLot]);

      await target.getStockSummary('ITEM-001', 'C1', 'P1');

      expect(mockMatStockRepo.find).toHaveBeenCalledWith({
        where: { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' },
      });
      expect(mockItemMasterRepo.findOne).toHaveBeenCalledWith({
        where: { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' },
      });
      expect(mockMatLotRepo.find).toHaveBeenCalledWith({
        where: { matUid: expect.anything(), company: 'C1', plant: 'P1' },
      });
    });
  });

  // ─── adjustStock ───
  describe('adjustStock', () => {
    it('재고를 정상적으로 조정한다', async () => {
      const stock = createStock();
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(stock); // 기존 재고 조회
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({ ...stock, qty: 110 }); // 업데이트 후 재조회
      mockQueryRunner.manager.save.mockResolvedValue({} as any); // InvAdjLog 저장

      const result = await target.adjustStock({
        itemCode: 'ITEM-001',
        warehouseCode: 'WH-01',
        adjustQty: 10,
        reason: '조정',
      } as any);

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('조정 후 재고가 음수가 되면 BadRequestException', async () => {
      const stock = createStock({ qty: 5 });
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(stock);

      await expect(
        target.adjustStock({
          itemCode: 'ITEM-001',
          warehouseCode: 'WH-01',
          adjustQty: -10,
          reason: '조정',
        } as any),
      ).rejects.toThrow(BadRequestException);

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('재고가 없는 상태에서 감소 조정을 하면 BadRequestException', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(null);

      await expect(
        target.adjustStock({
          itemCode: 'ITEM-001',
          warehouseCode: 'WH-01',
          adjustQty: -5,
          reason: '조정',
        } as any),
      ).rejects.toThrow(BadRequestException);

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('예약수량보다 적게 조정하면 BadRequestException', async () => {
      const stock = createStock({ qty: 20, reservedQty: 10, availableQty: 10 });
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(stock);

      await expect(
        target.adjustStock({
          itemCode: 'ITEM-001',
          warehouseCode: 'WH-01',
          adjustQty: -15,
          reason: '조정',
        } as any),
      ).rejects.toThrow(BadRequestException);

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('조회된 재고 테넌트가 요청 테넌트와 다르면 조정 이력을 만들지 않는다', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(createStock({ company: 'OTHER', plant: 'P01' }));

      await expect(
        target.adjustStock({
          itemCode: 'ITEM-001',
          warehouseCode: 'WH-01',
          adjustQty: 10,
          reason: '보정',
        } as any, 'HANES', 'P01'),
      ).rejects.toThrow(BadRequestException);

      expect(mockQueryRunner.manager.update).not.toHaveBeenCalled();
      expect(mockQueryRunner.manager.save).not.toHaveBeenCalled();
    });
  });

  describe('transferStock', () => {
    it('출고 창고에서 입고 창고로 재고를 이동한다', async () => {
      const fromStock = createStock({ warehouseCode: 'WH-FROM', qty: 100, availableQty: 100 });
      const toStock = createStock({ warehouseCode: 'WH-TO', qty: 50, availableQty: 50 });

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(fromStock) // 출고 창고 조회
        .mockResolvedValueOnce(toStock)  // 입고 창고 조회
        .mockResolvedValueOnce({ ...toStock, qty: 70 }); // 업데이트 후 조회
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);

      const result = await target.transferStock({
        itemCode: 'ITEM-001',
        fromWarehouseCode: 'WH-FROM',
        toWarehouseCode: 'WH-TO',
        qty: 20,
      } as any);

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(stockQb.andWhere).toHaveBeenCalledWith('"QTY" >= :stockDelta AND "AVAILABLE_QTY" >= :stockDelta');
      expect(stockQb.setParameters).toHaveBeenCalledWith({ stockDelta: 20 });
    });

    it('재고 이동은 요청 테넌트 범위에서 출고/입고 재고를 조회하고 갱신한다', async () => {
      const fromStock = createStock({
        warehouseCode: 'WH-FROM',
        qty: 100,
        availableQty: 100,
        company: 'C1',
        plant: 'P1',
      });
      const toStock = createStock({
        warehouseCode: 'WH-TO',
        qty: 50,
        availableQty: 50,
        company: 'C1',
        plant: 'P1',
      });

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(fromStock)
        .mockResolvedValueOnce(toStock)
        .mockResolvedValueOnce({ ...toStock, qty: 70 });
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);

      await target.transferStock({
        itemCode: 'ITEM-001',
        fromWarehouseCode: 'WH-FROM',
        toWarehouseCode: 'WH-TO',
        qty: 20,
        matUid: 'MAT-001',
      } as any, 'C1', 'P1');

      expect(mockQueryRunner.manager.findOne).toHaveBeenNthCalledWith(1, MatStock, {
        where: { itemCode: 'ITEM-001', warehouseCode: 'WH-FROM', matUid: 'MAT-001', company: 'C1', plant: 'P1' },
      });
      expect(mockQueryRunner.manager.findOne).toHaveBeenNthCalledWith(2, MatStock, {
        where: { itemCode: 'ITEM-001', warehouseCode: 'WH-TO', matUid: 'MAT-001', company: 'C1', plant: 'P1' },
      });
      expect(stockQb.where).toHaveBeenCalledWith(
        { warehouseCode: 'WH-FROM', itemCode: 'ITEM-001', matUid: 'MAT-001', company: 'C1', plant: 'P1' },
      );
      expect(stockQb.where).toHaveBeenCalledWith(
        { warehouseCode: 'WH-TO', itemCode: 'ITEM-001', matUid: 'MAT-001', company: 'C1', plant: 'P1' },
      );
    });

    it('출고 재고 테넌트가 요청 테넌트와 다르면 이동하지 않는다', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(createStock({
        warehouseCode: 'WH-FROM',
        qty: 100,
        availableQty: 100,
        company: 'OTHER',
        plant: 'P1',
      }));

      await expect(
        target.transferStock({
          itemCode: 'ITEM-001',
          fromWarehouseCode: 'WH-FROM',
          toWarehouseCode: 'WH-TO',
          qty: 20,
        } as any, 'C1', 'P1'),
      ).rejects.toThrow(BadRequestException);

      expect(mockQueryRunner.manager.update).not.toHaveBeenCalled();
      expect(mockQueryRunner.manager.create).not.toHaveBeenCalled();
    });

    it('입고 재고 테넌트가 요청 테넌트와 다르면 이동하지 않는다', async () => {
      const fromStock = createStock({
        warehouseCode: 'WH-FROM',
        qty: 100,
        availableQty: 100,
        company: 'C1',
        plant: 'P1',
      });
      const toStock = createStock({
        warehouseCode: 'WH-TO',
        qty: 50,
        availableQty: 50,
        company: 'C1',
        plant: 'OTHER',
      });

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(fromStock)
        .mockResolvedValueOnce(toStock);

      await expect(
        target.transferStock({
          itemCode: 'ITEM-001',
          fromWarehouseCode: 'WH-FROM',
          toWarehouseCode: 'WH-TO',
          qty: 20,
        } as any, 'C1', 'P1'),
      ).rejects.toThrow(BadRequestException);

      expect(mockQueryRunner.manager.update).not.toHaveBeenCalled();
      expect(mockQueryRunner.manager.create).not.toHaveBeenCalled();
    });

    it('출고 창고 재고 부족이면 BadRequestException', async () => {
      const fromStock = createStock({ warehouseCode: 'WH-FROM', qty: 5 });
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(fromStock);

      await expect(
        target.transferStock({
          itemCode: 'ITEM-001',
          fromWarehouseCode: 'WH-FROM',
          toWarehouseCode: 'WH-TO',
          qty: 20,
        } as any),
      ).rejects.toThrow(BadRequestException);

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('출고 창고에 재고가 없으면 BadRequestException', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(null);

      await expect(
        target.transferStock({
          itemCode: 'ITEM-001',
          fromWarehouseCode: 'WH-FROM',
          toWarehouseCode: 'WH-TO',
          qty: 20,
        } as any),
      ).rejects.toThrow(BadRequestException);

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });
    it('출발 창고와 도착 창고가 같으면 BadRequestException', async () => {
      const fromStock = createStock({ warehouseCode: 'WH-01', qty: 50, availableQty: 50 });
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(fromStock);

      await expect(
        target.transferStock({
          itemCode: 'ITEM-001',
          fromWarehouseCode: 'WH-01',
          toWarehouseCode: 'WH-01',
          qty: 10,
        } as any),
      ).rejects.toThrow(BadRequestException);

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('가용재고가 부족하면 BadRequestException', async () => {
      const fromStock = createStock({ warehouseCode: 'WH-FROM', qty: 50, availableQty: 5, reservedQty: 45 });
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(fromStock);

      await expect(
        target.transferStock({
          itemCode: 'ITEM-001',
          fromWarehouseCode: 'WH-FROM',
          toWarehouseCode: 'WH-TO',
          qty: 10,
        } as any),
      ).rejects.toThrow(BadRequestException);

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('출발 창고와 도착 창고가 같으면 BadRequestException', async () => {
      const fromStock = createStock({ warehouseCode: 'WH-01', qty: 50, availableQty: 50 });
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(fromStock);

      await expect(
        target.transferStock({
          itemCode: 'ITEM-001',
          fromWarehouseCode: 'WH-01',
          toWarehouseCode: 'WH-01',
          qty: 10,
        } as any),
      ).rejects.toThrow(BadRequestException);

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('가용재고가 부족하면 BadRequestException', async () => {
      const fromStock = createStock({ warehouseCode: 'WH-FROM', qty: 50, availableQty: 5, reservedQty: 45 });
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(fromStock);

      await expect(
        target.transferStock({
          itemCode: 'ITEM-001',
          fromWarehouseCode: 'WH-FROM',
          toWarehouseCode: 'WH-TO',
          qty: 10,
        } as any),
      ).rejects.toThrow(BadRequestException);

      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

  });
});
