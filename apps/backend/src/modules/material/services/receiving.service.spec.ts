/**
 * @file src/modules/material/services/receiving.service.spec.ts
 * @description ReceivingService 단위 테스트 - 입고 가능 LOT 조회, 일괄/분할 입고, 자동입고
 *
 * 초보자 가이드:
 * - findReceivable: IQC PASS + 미입고 LOT 조회
 * - createBulkReceive: 트랜잭션 기반 일괄 입고
 * - autoReceive: 라벨 발행 시 자동 입고
 * - 실행: `npx jest --testPathPattern="receiving.service.spec"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { ReceivingService } from './receiving.service';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatArrival } from '../../../entities/mat-arrival.entity';
import { MatReceiving } from '../../../entities/mat-receiving.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { PurchaseOrder } from '../../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../../entities/purchase-order-item.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { LabelPrintLog } from '../../../entities/label-print-log.entity';
import { NumRuleService } from '../../num-rule/num-rule.service';
import { SysConfigService } from '../../system/services/sys-config.service';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('ReceivingService', () => {
  let target: ReceivingService;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockMatStockRepo: DeepMocked<Repository<MatStock>>;
  let mockMatArrivalRepo: DeepMocked<Repository<MatArrival>>;
  let mockMatReceivingRepo: DeepMocked<Repository<MatReceiving>>;
  let mockStockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let mockPartMasterRepo: DeepMocked<Repository<PartMaster>>;
  let mockPurchaseOrderRepo: DeepMocked<Repository<PurchaseOrder>>;
  let mockPurchaseOrderItemRepo: DeepMocked<Repository<PurchaseOrderItem>>;
  let mockWarehouseRepo: DeepMocked<Repository<Warehouse>>;
  let mockLabelPrintLogRepo: DeepMocked<Repository<LabelPrintLog>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;
  let mockNumRuleService: DeepMocked<NumRuleService>;
  let mockSysConfigService: DeepMocked<SysConfigService>;

  beforeEach(async () => {
    mockMatLotRepo = createMock<Repository<MatLot>>();
    mockMatStockRepo = createMock<Repository<MatStock>>();
    mockMatArrivalRepo = createMock<Repository<MatArrival>>();
    mockMatReceivingRepo = createMock<Repository<MatReceiving>>();
    mockStockTxRepo = createMock<Repository<StockTransaction>>();
    mockPartMasterRepo = createMock<Repository<PartMaster>>();
    mockPurchaseOrderRepo = createMock<Repository<PurchaseOrder>>();
    mockPurchaseOrderItemRepo = createMock<Repository<PurchaseOrderItem>>();
    mockWarehouseRepo = createMock<Repository<Warehouse>>();
    mockLabelPrintLogRepo = createMock<Repository<LabelPrintLog>>();
    mockDataSource = createMock<DataSource>();
    mockQueryRunner = createMock<QueryRunner>();
    mockNumRuleService = createMock<NumRuleService>();
    mockSysConfigService = createMock<SysConfigService>();

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceivingService,
        { provide: getRepositoryToken(MatLot), useValue: mockMatLotRepo },
        { provide: getRepositoryToken(MatStock), useValue: mockMatStockRepo },
        { provide: getRepositoryToken(MatArrival), useValue: mockMatArrivalRepo },
        { provide: getRepositoryToken(MatReceiving), useValue: mockMatReceivingRepo },
        { provide: getRepositoryToken(StockTransaction), useValue: mockStockTxRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartMasterRepo },
        { provide: getRepositoryToken(PurchaseOrder), useValue: mockPurchaseOrderRepo },
        { provide: getRepositoryToken(PurchaseOrderItem), useValue: mockPurchaseOrderItemRepo },
        { provide: getRepositoryToken(Warehouse), useValue: mockWarehouseRepo },
        { provide: getRepositoryToken(LabelPrintLog), useValue: mockLabelPrintLogRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: NumRuleService, useValue: mockNumRuleService },
        { provide: SysConfigService, useValue: mockSysConfigService },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<ReceivingService>(ReceivingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── createBulkReceive ───
  describe('createBulkReceive', () => {
    it('존재하지 않는 LOT이면 NotFoundException', async () => {
      mockMatLotRepo.findOne.mockResolvedValue(null);

      await expect(
        target.createBulkReceive({ items: [{ matUid: 'NONE', qty: 10, warehouseId: 'WH-01' }] } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('IQC 미합격 LOT이면 BadRequestException', async () => {
      mockMatLotRepo.findOne.mockResolvedValue({ matUid: 'MAT-001', iqcStatus: 'PENDING', initQty: 100 } as MatLot);

      await expect(
        target.createBulkReceive({ items: [{ matUid: 'MAT-001', qty: 10, warehouseId: 'WH-01' }] } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── autoReceive ───
  describe('autoReceive', () => {
    it('자동입고가 비활성화되면 스킵한다', async () => {
      mockSysConfigService.isEnabled.mockResolvedValue(false);

      const result = await target.autoReceive(['MAT-001']);

      expect(result.autoReceiveEnabled).toBe(false);
      expect(result.skipped).toEqual(['MAT-001']);
    });

    it('기본 창고가 없으면 에러 반환', async () => {
      mockSysConfigService.isEnabled.mockResolvedValue(true);
      mockWarehouseRepo.findOne.mockResolvedValue(null);

      const result = await target.autoReceive(['MAT-001']);

      expect(result.autoReceiveEnabled).toBe(true);
      expect(result.error).toBeDefined();
    });
  });

  // ─── getStats ───
  describe('getStats', () => {
    it('입고 통계를 반환한다', async () => {
      mockMatLotRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      } as any);
      mockStockTxRepo.count.mockResolvedValue(5);
      mockStockTxRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
        getRawOne: jest.fn().mockResolvedValue({ sumQty: '100' }),
      } as any);

      const result = await target.getStats();

      expect(result.pendingCount).toBe(0);
      expect(result.todayReceivedCount).toBe(5);
    });
  });
});
