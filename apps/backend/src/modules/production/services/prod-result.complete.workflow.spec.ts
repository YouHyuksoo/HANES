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
import { PartMaster } from '../../../entities/part-master.entity';
import { ConsumableMaster } from '../../../entities/consumable-master.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { User } from '../../../entities/user.entity';
import { AutoIssueService } from './auto-issue.service';
import { ProductInventoryService } from '../../inventory/services/product-inventory.service';
import { NumberingService } from '../../../shared/numbering.service';
import { SysConfigService } from '../../system/services/sys-config.service';
import { ShiftPattern } from '../../../entities/shift-pattern.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('ProdResultService complete workflow', () => {
  let target: ProdResultService;
  let prodResultRepo: DeepMocked<Repository<ProdResult>>;
  let matIssueRepo: DeepMocked<Repository<MatIssue>>;
  let dataSource: DeepMocked<DataSource>;
  let queryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    prodResultRepo = createMock<Repository<ProdResult>>();
    matIssueRepo = createMock<Repository<MatIssue>>();
    dataSource = createMock<DataSource>();
    queryRunner = createMock<QueryRunner>();

    dataSource.createQueryRunner.mockReturnValue(queryRunner);
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
        { provide: getRepositoryToken(PartMaster), useValue: createMock<Repository<PartMaster>>() },
        { provide: getRepositoryToken(ConsumableMaster), useValue: createMock<Repository<ConsumableMaster>>() },
        { provide: getRepositoryToken(MatIssue), useValue: matIssueRepo },
        { provide: getRepositoryToken(User), useValue: createMock<Repository<User>>() },
        { provide: DataSource, useValue: dataSource },
        { provide: AutoIssueService, useValue: createMock<AutoIssueService>() },
        { provide: ProductInventoryService, useValue: createMock<ProductInventoryService>() },
        { provide: NumberingService, useValue: createMock<NumberingService>() },
        { provide: SysConfigService, useValue: createMock<SysConfigService>() },
        { provide: getRepositoryToken(ShiftPattern), useValue: createMock<Repository<ShiftPattern>>() },
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
        equipCode: null,
        inspectResults: [],
        defectLogs: [],
      } as any)
      .mockResolvedValueOnce({ resultNo: 'PR-100', status: 'DONE' } as any);

    matIssueRepo.find.mockResolvedValue([] as any);

    const summaryQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ totalGoodQty: '10', totalDefectQty: '1' }),
    };

    queryRunner.manager.findOne
      .mockResolvedValueOnce({
        orderNo: 'JO-100',
        itemCode: 'ITEM-100',
        status: 'WAITING',
        planQty: 10,
        company: 'C1',
        plant: 'P1',
        part: { itemType: 'FINISHED' },
      } as any)
      .mockResolvedValueOnce({
        orderNo: 'JO-100',
        status: 'WAITING',
        planQty: 10,
        company: 'C1',
        plant: 'P1',
      } as any);
    queryRunner.manager.count.mockResolvedValue(0);
    queryRunner.manager.createQueryBuilder.mockReturnValue(summaryQb as any);

    await target.complete('PR-100', { goodQty: 10, defectQty: 1 } as any, 'C1', 'P1');

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
  });
});
