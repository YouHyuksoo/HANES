import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { PhysicalInvService } from './physical-inv.service';
import { MatStock } from '../../../entities/mat-stock.entity';
import { InvAdjLog } from '../../../entities/inv-adj-log.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PhysicalInvSession } from '../../../entities/physical-inv-session.entity';
import { PhysicalInvCountDetail } from '../../../entities/physical-inv-count-detail.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';
import { parseDateStart } from '../../../shared/date.util';

describe('PhysicalInvService', () => {
  let service: PhysicalInvService;
  let matStockRepo: DeepMocked<Repository<MatStock>>;
  let invAdjLogRepo: DeepMocked<Repository<InvAdjLog>>;
  let matLotRepo: DeepMocked<Repository<MatLot>>;
  let itemMasterRepo: DeepMocked<Repository<ItemMaster>>;
  let sessionRepo: DeepMocked<Repository<PhysicalInvSession>>;
  let countDetailRepo: DeepMocked<Repository<PhysicalInvCountDetail>>;
  let warehouseRepo: DeepMocked<Repository<Warehouse>>;
  let dataSource: DeepMocked<DataSource>;
  let tx: DeepMocked<TransactionService>;
  let queryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    matStockRepo = createMock<Repository<MatStock>>();
    invAdjLogRepo = createMock<Repository<InvAdjLog>>();
    matLotRepo = createMock<Repository<MatLot>>();
    itemMasterRepo = createMock<Repository<ItemMaster>>();
    sessionRepo = createMock<Repository<PhysicalInvSession>>();
    countDetailRepo = createMock<Repository<PhysicalInvCountDetail>>();
    warehouseRepo = createMock<Repository<Warehouse>>();
    dataSource = createMock<DataSource>();
    tx = createMock<TransactionService>();
    queryRunner = createMock<QueryRunner>();

    dataSource.createQueryRunner.mockReturnValue(queryRunner);
    dataSource.getRepository.mockReturnValue(createMock<Repository<StockTransaction>>() as any);
    dataSource.query.mockResolvedValue([{ nextSeq: 1 }]);
    tx.run.mockImplementation(async (callback: any) => callback(queryRunner));
    queryRunner.connect.mockResolvedValue(undefined);
    queryRunner.startTransaction.mockResolvedValue(undefined);
    queryRunner.commitTransaction.mockResolvedValue(undefined);
    queryRunner.rollbackTransaction.mockResolvedValue(undefined);
    queryRunner.release.mockResolvedValue(undefined);
    queryRunner.manager.find.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhysicalInvService,
        { provide: getRepositoryToken(MatStock), useValue: matStockRepo },
        { provide: getRepositoryToken(InvAdjLog), useValue: invAdjLogRepo },
        { provide: getRepositoryToken(MatLot), useValue: matLotRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: itemMasterRepo },
        { provide: getRepositoryToken(PhysicalInvSession), useValue: sessionRepo },
        { provide: getRepositoryToken(PhysicalInvCountDetail), useValue: countDetailRepo },
        { provide: getRepositoryToken(Warehouse), useValue: warehouseRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: TransactionService, useValue: tx },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    service = module.get(PhysicalInvService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findStocks', () => {
    it('품목/LOT 마스터가 누락되어도 재고 원본 itemCode와 matUid는 유지한다', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            warehouseCode: 'WH-01',
            itemCode: 'ITEM-MISSING',
            matUid: 'MAT-MISSING',
            qty: 10,
          } as MatStock,
        ]),
        getCount: jest.fn().mockResolvedValue(1),
      };
      matStockRepo.createQueryBuilder.mockReturnValue(queryBuilder as any);
      itemMasterRepo.find.mockResolvedValue([]);
      matLotRepo.find.mockResolvedValue([]);

      const result = await service.findStocks({ page: 1, limit: 10 });

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-MISSING',
          itemName: null,
          matUid: 'MAT-MISSING',
        }),
      );
    });

    it('실사 재고 목록 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            warehouseCode: 'WH-01',
            itemCode: 'ITEM-001',
            matUid: 'MAT-001',
            qty: 10,
            company: 'C1',
            plant: 'P1',
          } as MatStock,
        ]),
        getCount: jest.fn().mockResolvedValue(1),
      };
      matStockRepo.createQueryBuilder.mockReturnValue(queryBuilder as any);
      itemMasterRepo.find.mockResolvedValue([]);
      matLotRepo.find.mockResolvedValue([]);

      await service.findStocks({ page: 1, limit: 10 }, 'C1', 'P1');

      expect(itemMasterRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
      expect(matLotRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
    });

    it('검색용 품목 조인도 재고 테넌트와 같은 범위로 제한한다', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getCount: jest.fn().mockResolvedValue(0),
      };
      matStockRepo.createQueryBuilder.mockReturnValue(queryBuilder as any);

      await service.findStocks({ page: 1, limit: 10, search: 'ITEM' } as any, 'C1', 'P1');

      expect(queryBuilder.leftJoin).toHaveBeenCalledWith(
        ItemMaster,
        'part',
        'part.itemCode = stock.itemCode AND part.company = stock.company AND part.plant = stock.plant',
      );
    });
  });

  describe('findHistory', () => {
    it('이력 조회의 품목/LOT 조인도 이력 테넌트와 같은 범위로 제한한다', async () => {
      const queryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      invAdjLogRepo.createQueryBuilder.mockReturnValue(queryBuilder as any);

      await service.findHistory({ page: 1, limit: 50 } as any, 'C1', 'P1');

      expect(queryBuilder.leftJoin).toHaveBeenCalledWith(
        ItemMaster,
        'part',
        'part.itemCode = log.itemCode AND part.company = log.company AND part.plant = log.plant',
      );
      expect(queryBuilder.leftJoin).toHaveBeenCalledWith(
        MatLot,
        'lot',
        'lot.matUid = log.matUid AND lot.company = log.company AND lot.plant = log.plant',
      );
    });
  });

  describe('getLocationItems', () => {
    it('PDA 로케이션 품목 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      matStockRepo.find.mockResolvedValue([
        {
          warehouseCode: 'WH-01',
          locationCode: 'LOC-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          company: 'C1',
          plant: 'P1',
        } as MatStock,
      ]);
      itemMasterRepo.find.mockResolvedValue([]);
      countDetailRepo.find.mockResolvedValue([]);

      await service.getLocationItems('2026-05-23', 1, 'LOC-01', 'C1', 'P1');

      expect(itemMasterRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
    });

    it('PDA 로케이션 기존 실사수량 조회도 요청 테넌트 범위로 제한한다', async () => {
      matStockRepo.find.mockResolvedValue([
        {
          warehouseCode: 'WH-01',
          locationCode: 'LOC-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          company: 'C1',
          plant: 'P1',
        } as MatStock,
      ]);
      itemMasterRepo.find.mockResolvedValue([]);
      countDetailRepo.find.mockResolvedValue([]);

      await service.getLocationItems('2026-05-23', 1, 'LOC-01', 'C1', 'P1');

      expect(countDetailRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({
          sessionDate: parseDateStart('2026-05-23'),
          seq: 1,
          locationCode: 'LOC-01',
        }),
      });
    });
  });

  describe('getActiveSession', () => {
    it('활성 실사 세션의 창고명 조회도 세션 테넌트 범위로 제한한다', async () => {
      sessionRepo.findOne.mockResolvedValue({
        sessionDate: new Date('2026-05-23'),
        seq: 1,
        status: 'IN_PROGRESS',
        invType: 'MATERIAL',
        warehouseCode: 'WH-01',
        countMonth: '2026-05',
        company: 'C1',
        plant: 'P1',
      } as PhysicalInvSession);
      warehouseRepo.findOne.mockResolvedValue({ warehouseCode: 'WH-01', warehouseName: 'Raw WH' } as Warehouse);

      const result = await service.getActiveSession('C1', 'P1');

      expect(result?.warehouseName).toBe('Raw WH');
      expect(warehouseRepo.findOne).toHaveBeenCalledWith({
        where: { warehouseCode: 'WH-01', company: 'C1', plant: 'P1' },
      });
    });
  });

  describe('scanCount', () => {
    it('blocks when session does not exist', async () => {
      const sessionQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      sessionRepo.createQueryBuilder.mockReturnValue(sessionQb as any);

      await expect(
        service.scanCount({
          sessionDate: '2026-03-18',
          seq: 1,
          locationCode: 'LOC-01',
          barcode: 'MAT-001',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('blocks when session is not IN_PROGRESS', async () => {
      const sessionQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ status: 'COMPLETED' }),
      };
      sessionRepo.createQueryBuilder.mockReturnValue(sessionQb as any);

      await expect(
        service.scanCount({
          sessionDate: '2026-03-18',
          seq: 1,
          locationCode: 'LOC-01',
          barcode: 'MAT-001',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks when scanned stock location mismatches request location', async () => {
      const sessionQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ status: 'IN_PROGRESS' }),
      };
      sessionRepo.createQueryBuilder.mockReturnValue(sessionQb as any);

      const stockQb = {
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          warehouseCode: 'WH-01',
          locationCode: 'LOC-02',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 5,
          itemName: 'Part 1',
        }),
      };
      matStockRepo.createQueryBuilder.mockReturnValue(stockQb as any);

      await expect(
        service.scanCount({
          sessionDate: '2026-03-18',
          seq: 1,
          locationCode: 'LOC-01',
          barcode: 'MAT-001',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks when scanned stock warehouse mismatches active session warehouse', async () => {
      const sessionQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ status: 'IN_PROGRESS', warehouseCode: 'WH-SESSION' }),
      };
      sessionRepo.createQueryBuilder.mockReturnValue(sessionQb as any);

      const stockQb = {
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          warehouseCode: 'WH-OTHER',
          locationCode: 'LOC-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 5,
          itemName: 'Part 1',
        }),
      };
      matStockRepo.createQueryBuilder.mockReturnValue(stockQb as any);

      await expect(
        service.scanCount({
          sessionDate: '2026-03-18',
          seq: 1,
          locationCode: 'LOC-01',
          barcode: 'MAT-001',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('PDA 스캔 조인도 재고 테넌트와 같은 범위로 제한한다', async () => {
      const sessionQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ status: 'IN_PROGRESS' }),
      };
      sessionRepo.createQueryBuilder.mockReturnValue(sessionQb as any);

      const stockQb = {
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(null),
      };
      matStockRepo.createQueryBuilder.mockReturnValue(stockQb as any);

      await expect(
        service.scanCount({
          sessionDate: '2026-03-18',
          seq: 1,
          locationCode: 'LOC-01',
          barcode: 'MAT-001',
        }, 'C1', 'P1'),
      ).rejects.toThrow(NotFoundException);

      expect(stockQb.innerJoin).toHaveBeenCalledWith(
        'MAT_LOTS',
        'l',
        's.ITEM_CODE = l.ITEM_CODE AND s.MAT_UID = l.MAT_UID AND s.COMPANY = l.COMPANY AND s.PLANT_CD = l.PLANT_CD',
      );
      expect(stockQb.leftJoin).toHaveBeenCalledWith(
        'ITEM_MASTERS',
        'p',
        's.ITEM_CODE = p.ITEM_CODE AND s.COMPANY = p.COMPANY AND s.PLANT_CD = p.PLANT_CD',
      );
      expect(stockQb.andWhere).toHaveBeenCalledWith('s.COMPANY = :company', { company: 'C1' });
      expect(stockQb.andWhere).toHaveBeenCalledWith('s.PLANT_CD = :plant', { plant: 'P1' });
    });
  });

  describe('findStocksWithCounts', () => {
    it('PC 실사 재고 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      sessionRepo.find.mockResolvedValue([
        {
          sessionDate: new Date('2026-05-23'),
          seq: 1,
          countMonth: '2026-05',
          status: 'IN_PROGRESS',
          company: 'C1',
          plant: 'P1',
        } as PhysicalInvSession,
      ]);
      const stockQb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            warehouseCode: 'WH-01',
            itemCode: 'ITEM-001',
            matUid: 'MAT-001',
            qty: 10,
            company: 'C1',
            plant: 'P1',
          } as MatStock,
        ]),
      };
      matStockRepo.createQueryBuilder.mockReturnValue(stockQb as any);
      itemMasterRepo.find.mockResolvedValue([]);
      warehouseRepo.find.mockResolvedValue([]);
      countDetailRepo.find.mockResolvedValue([]);

      await service.findStocksWithCounts({ page: 1, limit: 20, countMonth: '2026-05' }, 'C1', 'P1');

      expect(itemMasterRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
      expect(warehouseRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
    });

    it('PC 실사 누적수량 상세 조회도 세션 테넌트 범위로 제한한다', async () => {
      sessionRepo.find.mockResolvedValue([
        {
          sessionDate: new Date('2026-05-23'),
          seq: 1,
          countMonth: '2026-05',
          status: 'IN_PROGRESS',
          company: 'C1',
          plant: 'P1',
        } as PhysicalInvSession,
      ]);
      const stockQb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            warehouseCode: 'WH-01',
            itemCode: 'ITEM-001',
            matUid: 'MAT-001',
            qty: 10,
            company: 'C1',
            plant: 'P1',
          } as MatStock,
        ]),
      };
      matStockRepo.createQueryBuilder.mockReturnValue(stockQb as any);
      itemMasterRepo.find.mockResolvedValue([]);
      warehouseRepo.find.mockResolvedValue([]);
      countDetailRepo.find.mockResolvedValue([]);

      await service.findStocksWithCounts({ page: 1, limit: 20, countMonth: '2026-05' }, 'C1', 'P1');

      expect(countDetailRepo.find).toHaveBeenCalledWith({
        where: [
          expect.objectContaining({
            sessionDate: new Date('2026-05-23'),
            seq: 1,
          }),
        ],
      });
    });

    it('PC 실사 검색용 품목 조인도 재고 테넌트와 같은 범위로 제한한다', async () => {
      sessionRepo.find.mockResolvedValue([]);
      const stockQb = {
        andWhere: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      matStockRepo.createQueryBuilder.mockReturnValue(stockQb as any);

      await service.findStocksWithCounts({ countMonth: '2026-05', search: 'ITEM' } as any, 'C1', 'P1');

      expect(stockQb.leftJoin).toHaveBeenCalledWith(
        ItemMaster,
        'sp',
        'sp.itemCode = stock.itemCode AND sp.company = stock.company AND sp.plant = stock.plant',
      );
    });
  });

  describe('applyCount', () => {
    it('blocks when no IN_PROGRESS session exists', async () => {
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.applyCount({
          items: [{ stockId: 'WH-01::ITEM-001::MAT-001', countedQty: 9 }],
          createdBy: 'admin',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('skips records with no diff through TransactionService', async () => {
      sessionRepo.findOne.mockResolvedValue({
        sessionDate: new Date('2026-03-18'),
        seq: 1,
        status: 'IN_PROGRESS',
      } as PhysicalInvSession);
      queryRunner.manager.find.mockResolvedValue([
        {
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          reservedQty: 0,
          company: 'HANES',
          plant: 'P01',
        } as MatStock,
      ]);
      const txRepo = createMock<Repository<StockTransaction>>();
      txRepo.findOne.mockResolvedValue(null);
      queryRunner.manager.getRepository = jest.fn().mockReturnValue(txRepo);

      const result = await service.applyCount({
        items: [{ stockId: 'WH-01::ITEM-001::MAT-001', countedQty: 10 }],
        createdBy: 'admin',
      });

      expect(result).toHaveLength(0);
      expect(tx.run).toHaveBeenCalledTimes(1);
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('blocks when counted qty is lower than reserved qty', async () => {
      sessionRepo.findOne.mockResolvedValue({
        sessionDate: new Date('2026-03-18'),
        seq: 1,
        status: 'IN_PROGRESS',
      } as PhysicalInvSession);
      queryRunner.manager.find.mockResolvedValue([
        {
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          reservedQty: 8,
          company: 'HANES',
          plant: 'P01',
        } as MatStock,
      ]);

      await expect(
        service.applyCount({
          items: [{ stockId: 'WH-01::ITEM-001::MAT-001', countedQty: 7 }],
          createdBy: 'admin',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('filters active session by tenant in applyCount', async () => {
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.applyCount(
          {
            items: [{ stockId: 'WH-01::ITEM-001::MAT-001', countedQty: 7 }],
            createdBy: 'admin',
          },
          'HANES',
          'P01',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(sessionRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'IN_PROGRESS', company: 'HANES', plant: 'P01' }),
        }),
      );
    });

    it('blocks when request includes duplicated stockId', async () => {
      await expect(
        service.applyCount({
          items: [
            { stockId: 'WH-01::ITEM-001::MAT-001', countedQty: 10 },
            { stockId: 'WH-01::ITEM-001::MAT-001', countedQty: 9 },
          ],
          createdBy: 'admin',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks when stock warehouse is outside active session warehouse scope', async () => {
      sessionRepo.findOne.mockResolvedValue({
        sessionDate: new Date('2026-03-18'),
        seq: 1,
        status: 'IN_PROGRESS',
        warehouseCode: 'WH-SESSION',
      } as PhysicalInvSession);
      queryRunner.manager.find.mockResolvedValue([
        {
          warehouseCode: 'WH-OTHER',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          reservedQty: 0,
          company: 'HANES',
          plant: 'P01',
        } as MatStock,
      ]);

      await expect(
        service.applyCount({
          items: [{ stockId: 'WH-OTHER::ITEM-001::MAT-001', countedQty: 9 }],
          createdBy: 'admin',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('handles null reservedQty as zero', async () => {
      sessionRepo.findOne.mockResolvedValue({
        sessionDate: new Date('2026-03-18'),
        seq: 1,
        status: 'IN_PROGRESS',
        warehouseCode: 'WH-01',
        company: 'HANES',
        plant: 'P01',
      } as PhysicalInvSession);
      queryRunner.manager.find.mockResolvedValue([
        {
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          reservedQty: null,
          company: 'HANES',
          plant: 'P01',
        } as unknown as MatStock,
      ]);
      const txRepo = createMock<Repository<StockTransaction>>();
      txRepo.findOne.mockResolvedValue(null);
      queryRunner.manager.getRepository = jest.fn().mockReturnValue(txRepo);
      queryRunner.manager.create
        .mockReturnValueOnce({ transNo: 'PHC202603180001' } as any)
        .mockReturnValueOnce({ adjDate: new Date('2026-03-18') } as any);
      queryRunner.manager.save
        .mockResolvedValueOnce({ transNo: 'PHC202603180001' } as any)
        .mockResolvedValueOnce({ adjDate: new Date('2026-03-18') } as any);

      await service.applyCount({
        items: [{ stockId: 'WH-01::ITEM-001::MAT-001', countedQty: 8 }],
        createdBy: 'admin',
      }, 'HANES', 'P01');

      expect(queryRunner.manager.find).toHaveBeenCalledWith(MatStock, {
        where: [{
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          company: 'HANES',
          plant: 'P01',
        }],
      });
      expect(queryRunner.manager.update).toHaveBeenCalledWith(
        MatStock,
        { warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001', company: 'HANES', plant: 'P01' },
        expect.objectContaining({ qty: 8, availableQty: 8 }),
      );
    });

    it('blocks apply when stock tenant is missing under a request tenant', async () => {
      sessionRepo.findOne.mockResolvedValue({
        sessionDate: new Date('2026-03-18'),
        seq: 1,
        status: 'IN_PROGRESS',
        warehouseCode: 'WH-01',
        company: 'HANES',
        plant: 'P01',
      } as PhysicalInvSession);
      queryRunner.manager.find.mockResolvedValue([
        {
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          reservedQty: 0,
          company: null,
          plant: 'P01',
        } as unknown as MatStock,
      ]);

      await expect(
        service.applyCount({
          items: [{ stockId: 'WH-01::ITEM-001::MAT-001', countedQty: 8 }],
          createdBy: 'admin',
        }, 'HANES', 'P01'),
      ).rejects.toThrow(BadRequestException);

      expect(queryRunner.manager.update).not.toHaveBeenCalledWith(MatStock, expect.anything(), expect.anything());
      expect(queryRunner.manager.save).not.toHaveBeenCalled();
    });
  });

  describe('workflow', () => {
    it('keeps consistency across start -> scan -> apply -> complete flow', async () => {
      // startSession 은 tx.run 내부에서 queryRunner.manager.findOne/query/create/save 를 사용한다.
      // applyCount 가 동일 활성 세션을 조회할 때는 sessionRepo.findOne 을 쓰므로 그쪽은 그대로 둔다.
      sessionRepo.findOne.mockResolvedValueOnce({
        sessionDate: new Date('2026-03-18'),
        seq: 1,
        status: 'IN_PROGRESS',
        warehouseCode: 'WH-01',
        company: 'HANES',
        plant: 'P01',
      } as PhysicalInvSession);

      const scanSessionQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          status: 'IN_PROGRESS',
          warehouseCode: 'WH-01',
        }),
      };
      const completeSessionEntity = {
        sessionDate: new Date('2026-03-18'),
        seq: 1,
        status: 'IN_PROGRESS',
        warehouseCode: 'WH-01',
      } as PhysicalInvSession;
      const completeSessionQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(completeSessionEntity),
      };
      sessionRepo.createQueryBuilder
        .mockReturnValueOnce(scanSessionQb as any)
        .mockReturnValueOnce(completeSessionQb as any);

      // startSession 의 tx 내부 mock — IN_PROGRESS 부재 → SEQ NEXTVAL → create → save 순서.
      queryRunner.manager.findOne.mockResolvedValueOnce(null);
      queryRunner.manager.query.mockResolvedValueOnce([{ nextSeq: 1 }]);

      sessionRepo.save.mockResolvedValueOnce({
        ...completeSessionEntity,
        status: 'COMPLETED',
      } as PhysicalInvSession);

      const stockQb = {
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          warehouseCode: 'WH-01',
          locationCode: 'LOC-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          itemName: 'Part 1',
        }),
      };
      matStockRepo.createQueryBuilder.mockReturnValue(stockQb as any);

      countDetailRepo.findOne.mockResolvedValue(null);
      countDetailRepo.create.mockReturnValue({
        sessionDate: new Date('2026-03-18'),
        seq: 1,
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        countedQty: 1,
      } as PhysicalInvCountDetail);
      countDetailRepo.save.mockResolvedValue({
        sessionDate: new Date('2026-03-18'),
        seq: 1,
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        countedQty: 1,
      } as PhysicalInvCountDetail);

      queryRunner.manager.find.mockResolvedValue([
        {
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          reservedQty: 0,
          company: 'HANES',
          plant: 'P01',
        } as MatStock,
      ]);
      const txRepo = createMock<Repository<StockTransaction>>();
      txRepo.findOne.mockResolvedValue(null);
      queryRunner.manager.getRepository = jest.fn().mockReturnValue(txRepo);
      queryRunner.manager.create
        // startSession: PhysicalInvSession 엔티티 생성
        .mockReturnValueOnce({
          sessionDate: new Date('2026-03-18'),
          seq: 1,
          status: 'IN_PROGRESS',
          warehouseCode: 'WH-01',
          company: 'HANES',
          plant: 'P01',
        } as any)
        // applyCount: StockTransaction, InvAdjLog
        .mockReturnValueOnce({ transNo: 'PHC202603180001' } as any)
        .mockReturnValueOnce({ adjDate: new Date('2026-03-18') } as any);
      queryRunner.manager.save
        // startSession: 세션 저장 결과
        .mockResolvedValueOnce({
          sessionDate: new Date('2026-03-18'),
          seq: 1,
          status: 'IN_PROGRESS',
          warehouseCode: 'WH-01',
          company: 'HANES',
          plant: 'P01',
        } as any)
        .mockResolvedValueOnce({ transNo: 'PHC202603180001' } as any)
        .mockResolvedValueOnce({ adjDate: new Date('2026-03-18') } as any);

      const started = await service.startSession(
        { invType: 'MATERIAL', countMonth: '2026-03', warehouseCode: 'WH-01', startedBy: 'admin' },
        'HANES',
        'P01',
      );
      expect(started.status).toBe('IN_PROGRESS');

      const scanned = await service.scanCount(
        { sessionDate: '2026-03-18', seq: 1, locationCode: 'LOC-01', barcode: 'MAT-001' },
        'HANES',
        'P01',
      );
      expect(scanned.countedQty).toBe(1);

      const applied = await service.applyCount(
        { items: [{ stockId: 'WH-01::ITEM-001::MAT-001', countedQty: 8 }], createdBy: 'admin' },
        'HANES',
        'P01',
      );
      expect(applied).toHaveLength(1);

      const completed = await service.completeSession('2026-03-18', 1, { completedBy: 'admin' });
      expect(completed.status).toBe('COMPLETED');
    });
  });
});
