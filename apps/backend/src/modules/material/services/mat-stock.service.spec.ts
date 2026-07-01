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
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { MatStockService } from './mat-stock.service';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { InvAdjLog } from '../../../entities/inv-adj-log.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { TransactionService } from '../../../shared/transaction.service';
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

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockTx.run.mockImplementation(async (callback: any) => callback(mockQueryRunner));
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);

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

    it('검색어가 matUid와 일치하면 해당 LOT 재고도 반환한다', async () => {
      const stock = createStock({ matUid: 'MAT-SEARCH-001', itemCode: 'ITEM-001' });
      mockMatStockRepo.find.mockResolvedValue([stock]);
      mockMatStockRepo.count.mockResolvedValue(1);
      mockItemMasterRepo.find.mockResolvedValue([
        { itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as ItemMaster,
      ]);
      mockMatLotRepo.find.mockResolvedValue([
        { matUid: 'MAT-SEARCH-001', itemCode: 'ITEM-001' } as MatLot,
      ]);
      mockWarehouseRepo.find.mockResolvedValue([]);

      const result = await target.findAll({ page: 1, limit: 10, search: 'MAT-SEARCH' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].matUid).toBe('MAT-SEARCH-001');
    });
  });

  // ─── findAvailable ───
  describe('findAvailable', () => {
    it('IQC PASS + 잔량 > 0인 재고만 반환한다', async () => {
      const stock = createStock();
      mockMatStockRepo.find.mockResolvedValue([stock]);
      mockMatLotRepo.find.mockResolvedValue([
        { matUid: 'MAT-001', iqcStatus: 'PASS', status: 'NORMAL', itemCode: 'ITEM-001' } as MatLot,
      ]);
      mockItemMasterRepo.find.mockResolvedValue([
        { itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as ItemMaster,
      ]);

      const result = await target.findAvailable({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
    });

    it('품목 마스터가 누락되어도 출고 가능 재고의 원본 itemCode와 matUid는 유지한다', async () => {
      const stock = createStock({ itemCode: 'ITEM-MISSING', matUid: 'MAT-001' });
      mockMatStockRepo.find.mockResolvedValue([stock]);
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
      mockMatStockRepo.find.mockResolvedValue([stock]);
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

    it('출고 가능 재고를 입고일(recvDate) 오름차순(FIFO)으로 정렬한다', async () => {
      const newer = createStock({ matUid: 'MAT-NEW', itemCode: 'ITEM-001' });
      const older = createStock({ matUid: 'MAT-OLD', itemCode: 'ITEM-001' });
      // repository는 임의 순서로 반환(최신 입고가 먼저)
      mockMatStockRepo.find.mockResolvedValue([newer, older]);
      mockMatLotRepo.find.mockResolvedValue([
        { matUid: 'MAT-NEW', iqcStatus: 'PASS', status: 'NORMAL', itemCode: 'ITEM-001', recvDate: new Date('2026-06-20') } as MatLot,
        { matUid: 'MAT-OLD', iqcStatus: 'PASS', status: 'NORMAL', itemCode: 'ITEM-001', recvDate: new Date('2026-06-10') } as MatLot,
      ]);
      mockItemMasterRepo.find.mockResolvedValue([]);

      const result = await target.findAvailable({ page: 1, limit: 10 });

      // 가장 오래 보관된 LOT(MAT-OLD)이 먼저 와야 한다
      expect(result.data.map((d) => d.matUid)).toEqual(['MAT-OLD', 'MAT-NEW']);
    });

    it('입고일이 없는(null) LOT은 FIFO 정렬에서 뒤로 보낸다', async () => {
      const dated = createStock({ matUid: 'MAT-DATED', itemCode: 'ITEM-001' });
      const undated = createStock({ matUid: 'MAT-NULL', itemCode: 'ITEM-001' });
      mockMatStockRepo.find.mockResolvedValue([undated, dated]);
      mockMatLotRepo.find.mockResolvedValue([
        { matUid: 'MAT-DATED', iqcStatus: 'PASS', status: 'NORMAL', itemCode: 'ITEM-001', recvDate: new Date('2026-06-15') } as MatLot,
        { matUid: 'MAT-NULL', iqcStatus: 'PASS', status: 'NORMAL', itemCode: 'ITEM-001', recvDate: null } as unknown as MatLot,
      ]);
      mockItemMasterRepo.find.mockResolvedValue([]);

      const result = await target.findAvailable({ page: 1, limit: 10 });

      expect(result.data.map((d) => d.matUid)).toEqual(['MAT-DATED', 'MAT-NULL']);
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
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        MatStock,
        { warehouseCode: 'WH-FROM', itemCode: 'ITEM-001', matUid: 'MAT-001', company: 'C1', plant: 'P1' },
        expect.objectContaining({ qty: 80, availableQty: 80 }),
      );
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        MatStock,
        { warehouseCode: 'WH-TO', itemCode: 'ITEM-001', matUid: 'MAT-001', company: 'C1', plant: 'P1' },
        expect.objectContaining({ qty: 70, availableQty: 70 }),
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
