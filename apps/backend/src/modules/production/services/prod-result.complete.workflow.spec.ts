import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
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
import { TransactionService } from '../../../shared/transaction.service';

describe('ProdResultService complete workflow', () => {
  let target: ProdResultService;
  let prodResultRepo: DeepMocked<Repository<ProdResult>>;
  let matIssueRepo: DeepMocked<Repository<MatIssue>>;
  let dataSource: DeepMocked<DataSource>;
  let tx: DeepMocked<TransactionService>;
  let queryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    prodResultRepo = createMock<Repository<ProdResult>>();
    matIssueRepo = createMock<Repository<MatIssue>>();
    dataSource = createMock<DataSource>();
    tx = createMock<TransactionService>();
    queryRunner = createMock<QueryRunner>();

    dataSource.createQueryRunner.mockReturnValue(queryRunner);
    tx.run.mockImplementation(async (callback: any) => callback(queryRunner));
    queryRunner.connect.mockResolvedValue(undefined);
    queryRunner.startTransaction.mockResolvedValue(undefined);
    queryRunner.commitTransaction.mockResolvedValue(undefined);
    queryRunner.rollbackTransaction.mockResolvedValue(undefined);
    queryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProdResultService,
        { provide: getRepositoryToken(ProdResult), useValue: prodResultRepo },
        { provide: getRepositoryToken(JobOrder), useValue: createMock<Repository<JobOrder>>() },
        { provide: getRepositoryToken(EquipMaster), useValue: createMock<Repository<EquipMaster>>() },
        { provide: getRepositoryToken(EquipBomRel), useValue: createMock<Repository<EquipBomRel>>() },
        { provide: getRepositoryToken(EquipBomItem), useValue: createMock<Repository<EquipBomItem>>() },
        { provide: getRepositoryToken(ItemMaster), useValue: createMock<Repository<ItemMaster>>() },
        { provide: getRepositoryToken(ConsumableMaster), useValue: createMock<Repository<ConsumableMaster>>() },
        { provide: getRepositoryToken(MatIssue), useValue: matIssueRepo },
        { provide: getRepositoryToken(User), useValue: createMock<Repository<User>>() },
        { provide: getRepositoryToken(WorkerMaster), useValue: createMock<Repository<WorkerMaster>>() },
        { provide: DataSource, useValue: dataSource },
        { provide: AutoIssueService, useValue: createMock<AutoIssueService>() },
        { provide: ProductInventoryService, useValue: createMock<ProductInventoryService>() },
        { provide: WipMatStockService, useValue: createMock<WipMatStockService>() },
        { provide: NumberingService, useValue: createMock<NumberingService>() },
        { provide: SysConfigService, useValue: createMock<SysConfigService>() },
        { provide: getRepositoryToken(ShiftPattern), useValue: createMock<Repository<ShiftPattern>>() },
        { provide: TransactionService, useValue: tx },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<ProdResultService>(ProdResultService);
  });

  it('auto-completes job-order for tenant scope even when job-order status is WAITING', async () => {
    const svc = (target as any);
    svc.autoIssueService.execute.mockResolvedValue({ warnings: [] });
    svc.productInventoryService.receiveStockInTx.mockResolvedValue(undefined);

    prodResultRepo.findOne
      .mockResolvedValueOnce({
        resultNo: 'PR-100',
        orderNo: 'JO-100',
        status: 'RUNNING',
        goodQty: 8,
        defectQty: 0,
        processCode: 'P1',
        prdUid: null,
        equipCode: 'EQ-1',
        inspectResults: [],
        defectLogs: [],
      } as any)
      .mockResolvedValueOnce({ resultNo: 'PR-100', status: 'DONE' } as any);

    matIssueRepo.find.mockResolvedValue([] as any);

    const jobOrder = {
      orderNo: 'JO-100',
      itemCode: 'ITEM-100',
      status: 'WAITING',
      planQty: 10,
      company: 'C1',
      plant: 'P1',
      part: { itemType: 'FINISHED' },
    };

    // 엔티티 기준 keyed mock — complete() 흐름에 금형 타수, 소모품 롯트(4-2),
    // 양품/불량 자동 적재(adsorb), 작업지시 자동 완료까지 findOne/find 호출이 늘어나
    // 순서 의존(mockResolvedValueOnce) 대신 엔티티 이름으로 분기한다.
    queryRunner.manager.find.mockImplementation(async (entity: any) => {
      if (entity === ConsumableMaster) {
        return [
          {
            consumableCode: 'MOLD-1',
            currentCount: 2,
            expectedLife: 100,
            warningCount: 80,
            status: 'NORMAL',
            company: 'C1',
            plant: 'P1',
          },
        ] as any;
      }
      // ConsumableUsageMap(4-2), ProdResult(generateProductSerial) 등은 빈 배열
      return [] as any;
    });

    queryRunner.manager.findOne.mockImplementation(async (entity: any) => {
      if (entity === JobOrder) return jobOrder as any;
      // ProductTransaction(멱등 가드)는 미적재 상태(null), ProdResult(prdUid 재확인)는 null
      return null as any;
    });

    const summaryQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ totalGoodQty: '10', totalDefectQty: '1' }),
    };

    queryRunner.manager.count.mockResolvedValue(0);
    queryRunner.manager.createQueryBuilder.mockReturnValue(summaryQb as any);

    await target.complete('PR-100', { goodQty: 10, defectQty: 1 } as any, 'C1', 'P1');

    expect(queryRunner.manager.update).toHaveBeenCalledWith(
      ProdResult,
      expect.objectContaining({ resultNo: 'PR-100', company: 'C1', plant: 'P1' }),
      expect.objectContaining({ status: 'DONE', goodQty: 10, defectQty: 1 }),
    );

    expect(queryRunner.manager.findOne).toHaveBeenCalledWith(
      JobOrder,
      expect.objectContaining({
        where: expect.objectContaining({ orderNo: 'JO-100', company: 'C1', plant: 'P1' }),
      }),
    );

    expect(queryRunner.manager.update).toHaveBeenCalledWith(
      JobOrder,
      expect.objectContaining({ orderNo: 'JO-100', company: 'C1', plant: 'P1' }),
      expect.objectContaining({ status: 'DONE', goodQty: 10, defectQty: 1 }),
    );
    expect(queryRunner.manager.find).toHaveBeenCalledWith(
      ConsumableMaster,
      expect.objectContaining({
        where: expect.objectContaining({
          mountedEquipCode: 'EQ-1',
          category: 'MOLD',
          operStatus: 'MOUNTED',
          company: 'C1',
          plant: 'P1',
        }),
      }),
    );
    expect(queryRunner.manager.update).toHaveBeenCalledWith(
      ConsumableMaster,
      expect.objectContaining({ consumableCode: 'MOLD-1', company: 'C1', plant: 'P1' }),
      expect.objectContaining({ currentCount: 13, status: 'NORMAL' }),
    );
    expect(queryRunner.manager.update).toHaveBeenCalledWith(
      EquipMaster,
      expect.objectContaining({ equipCode: 'EQ-1', company: 'C1', plant: 'P1' }),
      expect.objectContaining({ currentJobOrderId: null }),
    );
    expect(tx.run).toHaveBeenCalledTimes(1);
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });
});
