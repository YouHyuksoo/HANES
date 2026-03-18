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
import { PartMaster } from '../../../entities/part-master.entity';
import { InvAdjLog } from '../../../entities/inv-adj-log.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('MatStockService', () => {
  let target: MatStockService;
  let mockMatStockRepo: DeepMocked<Repository<MatStock>>;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockPartMasterRepo: DeepMocked<Repository<PartMaster>>;
  let mockInvAdjLogRepo: DeepMocked<Repository<InvAdjLog>>;
  let mockWarehouseRepo: DeepMocked<Repository<Warehouse>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

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
    mockPartMasterRepo = createMock<Repository<PartMaster>>();
    mockInvAdjLogRepo = createMock<Repository<InvAdjLog>>();
    mockWarehouseRepo = createMock<Repository<Warehouse>>();
    mockDataSource = createMock<DataSource>();
    mockQueryRunner = createMock<QueryRunner>();

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
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
        { provide: getRepositoryToken(PartMaster), useValue: mockPartMasterRepo },
        { provide: getRepositoryToken(InvAdjLog), useValue: mockInvAdjLogRepo },
        { provide: getRepositoryToken(Warehouse), useValue: mockWarehouseRepo },
        { provide: DataSource, useValue: mockDataSource },
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
      mockPartMasterRepo.find.mockResolvedValue([
        { itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA', safetyStock: 50 } as PartMaster,
      ]);
      mockMatLotRepo.find.mockResolvedValue([]);
      mockWarehouseRepo.find.mockResolvedValue([
        { warehouseCode: 'WH-01', warehouseName: '자재창고' } as Warehouse,
      ]);

      const result = await target.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
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
      mockPartMasterRepo.find.mockResolvedValue([
        { itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as PartMaster,
      ]);

      const result = await target.findAvailable({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
    });
  });

  // ─── findByPartAndWarehouse ───
  describe('findByPartAndWarehouse', () => {
    it('품목 + 창고로 재고를 찾아 반환한다', async () => {
      const stock = createStock();
      mockMatStockRepo.findOne.mockResolvedValue(stock);
      mockPartMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as PartMaster);
      mockMatLotRepo.findOne.mockResolvedValue(null);

      const result = await target.findByPartAndWarehouse('ITEM-001', 'WH-01');

      expect(result).not.toBeNull();
    });

    it('재고가 없으면 null 반환', async () => {
      mockMatStockRepo.findOne.mockResolvedValue(null);

      const result = await target.findByPartAndWarehouse('ITEM-001', 'WH-01');

      expect(result).toBeNull();
    });
  });

  // ─── getStockSummary ───
  describe('getStockSummary', () => {
    it('품목별 재고 요약을 반환한다', async () => {
      const stock = createStock();
      mockMatStockRepo.find.mockResolvedValue([stock]);
      mockPartMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as PartMaster);
      mockMatLotRepo.find.mockResolvedValue([]);

      const result = await target.getStockSummary('ITEM-001');

      expect(result.itemCode).toBe('ITEM-001');
      expect(result.totalQty).toBe(100);
      expect(result.availableQty).toBe(90);
    });
  });

  // ─── adjustStock ───
  describe('adjustStock', () => {
    it('기존 재고를 증가 조정한다', async () => {
      const stock = createStock();
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(stock); // 기존 재고 조회
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({ ...stock, qty: 110 }); // 업데이트 후 조회
      mockQueryRunner.manager.save.mockResolvedValue({} as any); // InvAdjLog 저장

      const result = await target.adjustStock({
        itemCode: 'ITEM-001',
        warehouseCode: 'WH-01',
        adjustQty: 10,
        reason: '조정',
      } as any);

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('재고가 음수가 되면 BadRequestException', async () => {
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

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('재고가 없는 상태에서 감소 조정이면 BadRequestException', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(null);

      await expect(
        target.adjustStock({
          itemCode: 'ITEM-001',
          warehouseCode: 'WH-01',
          adjustQty: -5,
          reason: '조정',
        } as any),
      ).rejects.toThrow(BadRequestException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  // ─── transferStock ───
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

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
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

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
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

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });
});
