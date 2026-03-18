/**
 * @file src/modules/material/services/scrap.service.spec.ts
 * @description ScrapService 단위 테스트 - 자재폐기 이력 조회, 폐기 처리
 *
 * 초보자 가이드:
 * - create: LOT 조회 → 재고 확인 → 차감 → SCRAP 트랜잭션 생성
 * - LOT 재고 0이면 DEPLETED 상태로 변경
 * - 실행: `npx jest --testPathPattern="scrap.service.spec"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { ScrapService } from './scrap.service';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { NumRuleService } from '../../num-rule/num-rule.service';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('ScrapService', () => {
  let target: ScrapService;
  let mockStockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockMatStockRepo: DeepMocked<Repository<MatStock>>;
  let mockPartMasterRepo: DeepMocked<Repository<PartMaster>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;
  let mockNumRuleService: DeepMocked<NumRuleService>;

  beforeEach(async () => {
    mockStockTxRepo = createMock<Repository<StockTransaction>>();
    mockMatLotRepo = createMock<Repository<MatLot>>();
    mockMatStockRepo = createMock<Repository<MatStock>>();
    mockPartMasterRepo = createMock<Repository<PartMaster>>();
    mockDataSource = createMock<DataSource>();
    mockQueryRunner = createMock<QueryRunner>();
    mockNumRuleService = createMock<NumRuleService>();

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScrapService,
        { provide: getRepositoryToken(StockTransaction), useValue: mockStockTxRepo },
        { provide: getRepositoryToken(MatLot), useValue: mockMatLotRepo },
        { provide: getRepositoryToken(MatStock), useValue: mockMatStockRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartMasterRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: NumRuleService, useValue: mockNumRuleService },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<ScrapService>(ScrapService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findAll ───
  describe('findAll', () => {
    it('폐기 이력 목록을 반환한다', async () => {
      const tx = { transNo: 'TX-001', transType: 'SCRAP', itemCode: 'ITEM-001', matUid: 'MAT-001' } as StockTransaction;
      mockStockTxRepo.find.mockResolvedValue([tx]);
      mockStockTxRepo.count.mockResolvedValue(1);
      mockPartMasterRepo.find.mockResolvedValue([{ itemCode: 'ITEM-001', itemName: '커넥터A' } as PartMaster]);
      mockMatLotRepo.find.mockResolvedValue([{ matUid: 'MAT-001' } as MatLot]);

      const result = await target.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ─── create ───
  describe('create', () => {
    it('LOT이 존재하지 않으면 NotFoundException', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(null);

      await expect(
        target.create({ matUid: 'NONE', warehouseId: 'WH-01', qty: 10, reason: '폐기' } as any),
      ).rejects.toThrow(NotFoundException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('재고 부족이면 BadRequestException', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-001' } as MatLot)
        .mockResolvedValueOnce({ qty: 5 } as MatStock);

      await expect(
        target.create({ matUid: 'MAT-001', warehouseId: 'WH-01', qty: 10, reason: '폐기' } as any),
      ).rejects.toThrow(BadRequestException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('정상적으로 폐기 처리한다', async () => {
      const lot = { matUid: 'MAT-001', itemCode: 'ITEM-001' } as MatLot;
      const stock = { warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 100, availableQty: 100 } as MatStock;

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(lot)
        .mockResolvedValueOnce(stock);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
      mockNumRuleService.nextNumberInTx.mockResolvedValue('SCRAP-001');
      mockQueryRunner.manager.create.mockReturnValue({ transNo: 'SCRAP-001' } as any);
      mockQueryRunner.manager.save.mockResolvedValue({ transNo: 'SCRAP-001' } as any);

      const result = await target.create({ matUid: 'MAT-001', warehouseId: 'WH-01', qty: 10, reason: '불량' } as any);

      expect(result.transNo).toBe('SCRAP-001');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('폐기 후 재고 0이면 LOT DEPLETED 처리', async () => {
      const lot = { matUid: 'MAT-001', itemCode: 'ITEM-001' } as MatLot;
      const stock = { warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 10, availableQty: 10 } as MatStock;

      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(lot)
        .mockResolvedValueOnce(stock);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
      mockNumRuleService.nextNumberInTx.mockResolvedValue('SCRAP-002');
      mockQueryRunner.manager.create.mockReturnValue({ transNo: 'SCRAP-002' } as any);
      mockQueryRunner.manager.save.mockResolvedValue({ transNo: 'SCRAP-002' } as any);

      await target.create({ matUid: 'MAT-001', warehouseId: 'WH-01', qty: 10, reason: '전량 폐기' } as any);

      // MatLot DEPLETED 업데이트 호출 확인
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        MatLot,
        'MAT-001',
        { status: 'DEPLETED' },
      );
    });
  });
});
