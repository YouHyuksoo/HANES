import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { ProdResultService } from './prod-result.service';
import { ProdResult } from '../../../entities/prod-result.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { EquipBomRel } from '../../../entities/equip-bom-rel.entity';
import { EquipBomItem } from '../../../entities/equip-bom-item.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { ConsumableMaster } from '../../../entities/consumable-master.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { User } from '../../../entities/user.entity';
import { WorkerMaster } from '../../../entities/worker-master.entity';
import { AutoIssueService } from './auto-issue.service';
import { ProductInventoryService } from '../../inventory/services/product-inventory.service';
import { WipMatStockService } from '../../inventory/services/wip-mat-stock.service';
import { NumberingService } from '../../../shared/numbering.service';
import { SysConfigService } from '../../system/services/sys-config.service';
import { ShiftPattern } from '../../../entities/shift-pattern.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { TransactionService } from '../../../shared/transaction.service';
import { ProductTransaction } from '../../../entities/product-transaction.entity';
import { DefectLog } from '../../../entities/defect-log.entity';

describe('ProdResultService cancel flow', () => {
  let target: ProdResultService;
  let mockProdResultRepo: DeepMocked<Repository<ProdResult>>;
  let mockMatIssueRepo: DeepMocked<Repository<MatIssue>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockTx: DeepMocked<TransactionService>;
  let mockQueryRunner: DeepMocked<QueryRunner>;
  let mockNumbering: DeepMocked<NumberingService>;

  beforeEach(async () => {
    mockProdResultRepo = createMock<Repository<ProdResult>>();
    mockMatIssueRepo = createMock<Repository<MatIssue>>();
    mockDataSource = createMock<DataSource>();
    mockTx = createMock<TransactionService>();
    mockQueryRunner = createMock<QueryRunner>();
    mockNumbering = createMock<NumberingService>();

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockTx.run.mockImplementation(async (callback: any) => callback(mockQueryRunner));
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProdResultService,
        { provide: getRepositoryToken(ProdResult), useValue: mockProdResultRepo },
        { provide: getRepositoryToken(JobOrder), useValue: createMock<Repository<JobOrder>>() },
        { provide: getRepositoryToken(EquipMaster), useValue: createMock<Repository<EquipMaster>>() },
        { provide: getRepositoryToken(EquipBomRel), useValue: createMock<Repository<EquipBomRel>>() },
        { provide: getRepositoryToken(EquipBomItem), useValue: createMock<Repository<EquipBomItem>>() },
        { provide: getRepositoryToken(ItemMaster), useValue: createMock<Repository<ItemMaster>>() },
        { provide: getRepositoryToken(ConsumableMaster), useValue: createMock<Repository<ConsumableMaster>>() },
        { provide: getRepositoryToken(MatIssue), useValue: mockMatIssueRepo },
        { provide: getRepositoryToken(User), useValue: createMock<Repository<User>>() },
        { provide: getRepositoryToken(WorkerMaster), useValue: createMock<Repository<WorkerMaster>>() },
        { provide: getRepositoryToken(ShiftPattern), useValue: createMock<Repository<ShiftPattern>>() },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AutoIssueService, useValue: createMock<AutoIssueService>() },
        { provide: ProductInventoryService, useValue: createMock<ProductInventoryService>() },
        { provide: WipMatStockService, useValue: createMock<WipMatStockService>() },
        { provide: NumberingService, useValue: mockNumbering },
        { provide: SysConfigService, useValue: createMock<SysConfigService>() },
        { provide: TransactionService, useValue: mockTx },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get(ProdResultService);
  });

  afterEach(() => jest.clearAllMocks());

  it('restores auto-issued material stock back to original warehouse rows on cancel', async () => {
    mockProdResultRepo.findOne
      .mockResolvedValueOnce({ resultNo: 'PR-001', orderNo: 'JO-001', status: 'DONE', equipCode: null, inspectResults: [], defectLogs: [] } as any);
    mockMatIssueRepo.find.mockResolvedValue([]);

    const manager = {
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn().mockImplementation(async (_entity, payload) => payload ?? _entity),
      create: jest.fn((entity, payload) => ({ ...payload })),
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-001', company: 'HANES', plant: 'P01' })
        .mockResolvedValueOnce({ warehouseCode: 'W1', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 0, availableQty: 0 } as MatStock)
        .mockResolvedValueOnce({ warehouseCode: 'W2', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 1, availableQty: 1 } as MatStock),
      find: jest
        .fn()
        .mockResolvedValueOnce([
          { issueNo: 'ISS-001', seq: 1, matUid: 'MAT-001', issueQty: 3, company: 'HANES', plant: 'P01' } as MatIssue,
        ])
        .mockResolvedValueOnce([
          { transNo: 'TX-001', refType: 'MAT_ISSUE', refId: 'ISS-001-1', status: 'DONE', fromWarehouseId: 'W1', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: -2, company: 'HANES', plant: 'P01' } as StockTransaction,
          { transNo: 'TX-002', refType: 'MAT_ISSUE', refId: 'ISS-001-1', status: 'DONE', fromWarehouseId: 'W2', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: -1, company: 'HANES', plant: 'P01' } as StockTransaction,
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    };
    (mockQueryRunner as any).manager = manager;

    mockNumbering.nextInTx
      .mockResolvedValueOnce('REV-001')
      .mockResolvedValueOnce('REV-002');

    await target.cancel('PR-001', 'rollback', 'HANES', 'P01');

    expect(manager.update).toHaveBeenCalledWith(
      MatStock,
      { warehouseCode: 'W1', itemCode: 'ITEM-001', matUid: 'MAT-001', company: 'HANES', plant: 'P01' },
      { qty: 2, availableQty: 2 },
    );
    expect(manager.update).toHaveBeenCalledWith(
      MatStock,
      { warehouseCode: 'W2', itemCode: 'ITEM-001', matUid: 'MAT-001', company: 'HANES', plant: 'P01' },
      { qty: 2, availableQty: 2 },
    );
    expect(manager.update).toHaveBeenCalledWith(
      StockTransaction,
      { transNo: 'TX-001', company: 'HANES', plant: 'P01' },
      { status: 'CANCELED' },
    );
    expect(manager.update).toHaveBeenCalledWith(
      StockTransaction,
      { transNo: 'TX-002', company: 'HANES', plant: 'P01' },
      { status: 'CANCELED' },
    );
    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('blocks auto-issue reversal when issue tenant is missing under a request tenant', async () => {
    mockProdResultRepo.findOne
      .mockResolvedValueOnce({ resultNo: 'PR-001', orderNo: 'JO-001', status: 'DONE', equipCode: null, inspectResults: [], defectLogs: [] } as any);
    mockMatIssueRepo.find.mockResolvedValue([]);

    const manager = {
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn().mockImplementation(async (_entity, payload) => payload ?? _entity),
      create: jest.fn((entity, payload) => ({ ...payload })),
      findOne: jest.fn().mockResolvedValue({ matUid: 'MAT-001', itemCode: 'ITEM-001', company: 'HANES', plant: 'P01' }),
      find: jest
        .fn()
        .mockResolvedValueOnce([
          { issueNo: 'ISS-001', seq: 1, matUid: 'MAT-001', issueQty: 3, company: null, plant: 'P01' } as MatIssue,
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    };
    (mockQueryRunner as any).manager = manager;

    await expect(target.cancel('PR-001', 'rollback', 'HANES', 'P01')).rejects.toThrow(BadRequestException);

    expect(manager.create).not.toHaveBeenCalledWith(StockTransaction, expect.anything());
  });

  it('blocks product stock reversal when product transaction tenant differs from request tenant', async () => {
    mockProdResultRepo.findOne
      .mockResolvedValueOnce({ resultNo: 'PR-001', orderNo: 'JO-001', status: 'DONE', equipCode: null, inspectResults: [], defectLogs: [] } as any);
    mockMatIssueRepo.find.mockResolvedValue([]);

    const manager = {
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn().mockImplementation(async (_entity, payload) => payload ?? _entity),
      create: jest.fn((entity, payload) => ({ ...payload })),
      findOne: jest.fn().mockResolvedValue(null),
      find: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            transNo: 'PTX-001',
            refType: 'PROD_RESULT',
            refId: 'PR-001',
            status: 'DONE',
            toWarehouseId: 'WIP-01',
            itemCode: 'FG-001',
            prdUid: 'PRD-001',
            qty: 1,
            company: 'OTHER',
            plant: 'P01',
          } as ProductTransaction,
        ]),
    };
    (mockQueryRunner as any).manager = manager;

    await expect(target.cancel('PR-001', 'rollback', 'HANES', 'P01')).rejects.toThrow(BadRequestException);

    expect(manager.create).not.toHaveBeenCalledWith(ProductTransaction, expect.anything());
    expect(manager.save).not.toHaveBeenCalledWith(ProductTransaction, expect.anything());
  });

  it('marks production result as CANCELED and clears equipment within tenant on cancel', async () => {
    mockProdResultRepo.findOne
      .mockResolvedValueOnce({
        resultNo: 'PR-001',
        orderNo: 'JO-001',
        status: 'DONE',
        equipCode: 'EQ-001',
        inspectResults: [],
        defectLogs: [],
        company: 'HANES',
        plant: 'P01',
      } as any);
    mockMatIssueRepo.find.mockResolvedValue([]);

    const manager = {
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn().mockImplementation(async (_entity, payload) => payload ?? _entity),
      create: jest.fn((entity, payload) => ({ ...payload })),
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
    };
    (mockQueryRunner as any).manager = manager;

    await target.cancel('PR-001', 'rollback', 'HANES', 'P01');

    expect(manager.update).toHaveBeenCalledWith(
      EquipMaster,
      { equipCode: 'EQ-001', company: 'HANES', plant: 'P01' },
      { currentJobOrderId: null },
    );
    expect(manager.update).toHaveBeenCalledWith(
      ProdResult,
      { resultNo: 'PR-001', company: 'HANES', plant: 'P01' },
      expect.objectContaining({ status: 'CANCELED' }),
    );
    expect(manager.delete).toHaveBeenCalledWith(
      DefectLog,
      expect.objectContaining({ prodResultNo: 'PR-001', company: 'HANES', plant: 'P01' }),
    );
  });

  it('blocks cancel when downstream shipping flow has already progressed', async () => {
    mockProdResultRepo.findOne.mockResolvedValue({
      resultNo: 'PR-002',
      status: 'DONE',
      prdUid: 'FG-001',
      equipCode: null,
      inspectResults: [],
      defectLogs: [],
    } as any);

    const fgLabelRepo = {
      findOne: jest.fn().mockResolvedValue({ fgBarcode: 'FG-001', status: 'PACKED' }),
    };
    const boxRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          boxNo: 'BOX-001',
          palletNo: 'PALLET-001',
          oqcStatus: 'PASS',
        }),
      }),
    };
    const palletRepo = {
      findOne: jest.fn().mockResolvedValue({ palletNo: 'PALLET-001', shipmentId: 'SHIP-001' }),
    };
    const shipmentRepo = {
      findOne: jest.fn().mockResolvedValue({ shipNo: 'SHIP-001' }),
    };

    mockDataSource.getRepository.mockImplementation((entity: any) => {
      if (entity === ProdResult) return mockProdResultRepo as any;
      if (entity?.name === 'FgLabel') return fgLabelRepo as any;
      if (entity?.name === 'BoxMaster') return boxRepo as any;
      if (entity?.name === 'PalletMaster') return palletRepo as any;
      if (entity?.name === 'ShipmentLog') return shipmentRepo as any;
      return createMock<Repository<any>>() as any;
    });

    try {
      await target.cancel('PR-002', 'rollback');
      fail('expected cancel to be blocked');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).message).toContain(
        '출하 -> 팔레트 -> 박스/OQC -> FG 라벨 순서로 역처리 후 다시 취소해 주세요.',
      );
      expect((error as BadRequestException).message).toContain('BOX-001');
      expect((error as BadRequestException).message).toContain('SHIP-001');
    }
  });
});
