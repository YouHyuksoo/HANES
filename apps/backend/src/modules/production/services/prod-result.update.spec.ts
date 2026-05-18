import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
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
import { ShiftPattern } from '../../../entities/shift-pattern.entity';
import { AutoIssueService } from './auto-issue.service';
import { ProductInventoryService } from '../../inventory/services/product-inventory.service';
import { NumberingService } from '../../../shared/numbering.service';
import { SysConfigService } from '../../system/services/sys-config.service';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('ProdResultService update policy', () => {
  let target: ProdResultService;
  let mockProdResultRepo: DeepMocked<Repository<ProdResult>>;
  let mockMatIssueRepo: DeepMocked<Repository<MatIssue>>;

  beforeEach(async () => {
    mockProdResultRepo = createMock<Repository<ProdResult>>();
    mockMatIssueRepo = createMock<Repository<MatIssue>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProdResultService,
        { provide: getRepositoryToken(ProdResult), useValue: mockProdResultRepo },
        { provide: getRepositoryToken(JobOrder), useValue: createMock<Repository<JobOrder>>() },
        { provide: getRepositoryToken(EquipMaster), useValue: createMock<Repository<EquipMaster>>() },
        { provide: getRepositoryToken(EquipBomRel), useValue: createMock<Repository<EquipBomRel>>() },
        { provide: getRepositoryToken(EquipBomItem), useValue: createMock<Repository<EquipBomItem>>() },
        { provide: getRepositoryToken(PartMaster), useValue: createMock<Repository<PartMaster>>() },
        { provide: getRepositoryToken(ConsumableMaster), useValue: createMock<Repository<ConsumableMaster>>() },
        { provide: getRepositoryToken(MatIssue), useValue: mockMatIssueRepo },
        { provide: getRepositoryToken(User), useValue: createMock<Repository<User>>() },
        { provide: getRepositoryToken(ShiftPattern), useValue: createMock<Repository<ShiftPattern>>() },
        { provide: DataSource, useValue: createMock<DataSource>() },
        { provide: AutoIssueService, useValue: createMock<AutoIssueService>() },
        { provide: ProductInventoryService, useValue: createMock<ProductInventoryService>() },
        { provide: NumberingService, useValue: createMock<NumberingService>() },
        { provide: SysConfigService, useValue: createMock<SysConfigService>() },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get(ProdResultService);
  });

  afterEach(() => jest.clearAllMocks());

  it('blocks direct status changes and requires dedicated APIs', async () => {
    mockProdResultRepo.findOne.mockResolvedValue({
      resultNo: 'PR-001',
      id: 1,
      status: 'RUNNING',
      inspectResults: [],
      defectLogs: [],
      goodQty: 5,
      defectQty: 0,
    } as any);
    mockMatIssueRepo.find.mockResolvedValue([]);

    await expect(
      target.update('PR-001', { status: 'DONE' } as any),
    ).rejects.toThrow(BadRequestException);
  });
});
