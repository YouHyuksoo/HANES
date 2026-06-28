import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { DataSource, Repository } from 'typeorm';
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
import { ShiftPattern } from '../../../entities/shift-pattern.entity';
import { AutoIssueService } from './auto-issue.service';
import { ProductInventoryService } from '../../inventory/services/product-inventory.service';
import { WipMatStockService } from '../../inventory/services/wip-mat-stock.service';
import { NumberingService } from '../../../shared/numbering.service';
import { SysConfigService } from '../../system/services/sys-config.service';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('ProdResultService delete policy', () => {
  let target: ProdResultService;
  let mockProdResultRepo: DeepMocked<Repository<ProdResult>>;
  let mockMatIssueRepo: DeepMocked<Repository<MatIssue>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockTx: DeepMocked<TransactionService>;

  beforeEach(async () => {
    mockProdResultRepo = createMock<Repository<ProdResult>>();
    mockMatIssueRepo = createMock<Repository<MatIssue>>();
    mockDataSource = createMock<DataSource>();
    mockTx = createMock<TransactionService>();
    mockDataSource.getRepository.mockReturnValue(createMock<any>());

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
        { provide: NumberingService, useValue: createMock<NumberingService>() },
        { provide: SysConfigService, useValue: createMock<SysConfigService>() },
        { provide: TransactionService, useValue: mockTx },
      ],
    }).setLogger(new MockLoggerService()).compile();

    target = module.get(ProdResultService);
    mockMatIssueRepo.find.mockResolvedValue([]);
  });

  it('deletes result directly when no downstream progress exists', async () => {
    mockProdResultRepo.findOne.mockResolvedValue({
      resultNo: 'PR-001',
      status: 'DONE',
      prdUid: null,
      inspectResults: [],
      defectLogs: [],
    } as any);
    mockProdResultRepo.delete.mockResolvedValue({ affected: 1 } as any);

    await expect(target.delete('PR-001')).resolves.toEqual({ resultNo: 'PR-001' });
  });

  it('blocks delete when downstream label already progressed', async () => {
    const fgLabelRepo = createMock<Repository<any>>();
    const inspectRepo = createMock<Repository<any>>();
    const boxRepo = createMock<Repository<any>>();
    const palletRepo = createMock<Repository<any>>();
    const shipmentRepo = createMock<Repository<any>>();

    mockProdResultRepo.findOne.mockResolvedValue({
      resultNo: 'PR-001',
      status: 'DONE',
      prdUid: 'FG-001',
      inspectResults: [],
      defectLogs: [],
    } as any);
    inspectRepo.find.mockResolvedValue([]);
    fgLabelRepo.findOne.mockResolvedValue({ fgBarcode: 'FG-001', status: 'PACKED' });
    boxRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    } as any);
    palletRepo.findOne.mockResolvedValue(null);
    shipmentRepo.findOne.mockResolvedValue(null);
    mockDataSource.getRepository
      .mockReturnValueOnce(fgLabelRepo)
      .mockReturnValueOnce(inspectRepo)
      .mockReturnValueOnce(boxRepo)
      .mockReturnValueOnce(palletRepo)
      .mockReturnValueOnce(shipmentRepo);

    await expect(target.delete('PR-001')).rejects.toThrow(BadRequestException);
  });
});
