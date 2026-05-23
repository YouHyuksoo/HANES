import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { User } from '../../../entities/user.entity';
import { AutoIssueService } from './auto-issue.service';
import { ProductInventoryService } from '../../inventory/services/product-inventory.service';
import { NumberingService } from '../../../shared/numbering.service';
import { SysConfigService } from '../../system/services/sys-config.service';
import { ShiftPattern } from '../../../entities/shift-pattern.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('ProdResultService', () => {
  let service: ProdResultService;
  let prodResultRepo: DeepMocked<Repository<ProdResult>>;
  let jobOrderRepo: DeepMocked<Repository<JobOrder>>;
  let equipMasterRepo: DeepMocked<Repository<EquipMaster>>;
  let equipBomRelRepo: DeepMocked<Repository<EquipBomRel>>;
  let equipBomItemRepo: DeepMocked<Repository<EquipBomItem>>;
  let partMasterRepo: DeepMocked<Repository<PartMaster>>;
  let consumableRepo: DeepMocked<Repository<ConsumableMaster>>;
  let matIssueRepo: DeepMocked<Repository<MatIssue>>;
  let userRepo: DeepMocked<Repository<User>>;
  let dataSource: DeepMocked<DataSource>;
  let autoIssueService: DeepMocked<AutoIssueService>;
  let productInventoryService: DeepMocked<ProductInventoryService>;
  let numbering: DeepMocked<NumberingService>;
  let sysConfigService: DeepMocked<SysConfigService>;
  let shiftPatternRepo: DeepMocked<Repository<ShiftPattern>>;
  let tx: DeepMocked<TransactionService>;
  let queryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    prodResultRepo = createMock<Repository<ProdResult>>();
    jobOrderRepo = createMock<Repository<JobOrder>>();
    equipMasterRepo = createMock<Repository<EquipMaster>>();
    equipBomRelRepo = createMock<Repository<EquipBomRel>>();
    equipBomItemRepo = createMock<Repository<EquipBomItem>>();
    partMasterRepo = createMock<Repository<PartMaster>>();
    consumableRepo = createMock<Repository<ConsumableMaster>>();
    matIssueRepo = createMock<Repository<MatIssue>>();
    userRepo = createMock<Repository<User>>();
    dataSource = createMock<DataSource>();
    autoIssueService = createMock<AutoIssueService>();
    productInventoryService = createMock<ProductInventoryService>();
    numbering = createMock<NumberingService>();
    sysConfigService = createMock<SysConfigService>();
    shiftPatternRepo = createMock<Repository<ShiftPattern>>();
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
        { provide: getRepositoryToken(JobOrder), useValue: jobOrderRepo },
        { provide: getRepositoryToken(EquipMaster), useValue: equipMasterRepo },
        { provide: getRepositoryToken(EquipBomRel), useValue: equipBomRelRepo },
        { provide: getRepositoryToken(EquipBomItem), useValue: equipBomItemRepo },
        { provide: getRepositoryToken(PartMaster), useValue: partMasterRepo },
        { provide: getRepositoryToken(ConsumableMaster), useValue: consumableRepo },
        { provide: getRepositoryToken(MatIssue), useValue: matIssueRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: AutoIssueService, useValue: autoIssueService },
        { provide: ProductInventoryService, useValue: productInventoryService },
        { provide: NumberingService, useValue: numbering },
        { provide: SysConfigService, useValue: sysConfigService },
        { provide: getRepositoryToken(ShiftPattern), useValue: shiftPatternRepo },
        { provide: TransactionService, useValue: tx },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    service = module.get(ProdResultService);
  });

  afterEach(() => jest.clearAllMocks());

  it('findById returns one', async () => {
    prodResultRepo.findOne.mockResolvedValue({ resultNo: 'PR-1', inspectResults: [], defectLogs: [] } as any);
    matIssueRepo.find.mockResolvedValue([] as any);

    const result = await service.findById('PR-1', 'C1', 'P1');

    expect(result.resultNo).toBe('PR-1');
  });

  it('findById throws not found', async () => {
    prodResultRepo.findOne.mockResolvedValue(null);
    await expect(service.findById('X')).rejects.toThrow(NotFoundException);
  });

  it('findMatIssues keeps issue matUid when LOT master is missing', async () => {
    matIssueRepo.find.mockResolvedValue([
      {
        issueNo: 'ISS-001',
        seq: 1,
        prodResultNo: 'PR-1',
        matUid: 'MAT-MISSING',
        issueQty: 2,
        status: 'DONE',
      } as MatIssue,
    ]);
    dataSource.getRepository.mockReturnValue({
      find: jest.fn().mockResolvedValue([]),
    } as any);
    partMasterRepo.find.mockResolvedValue([]);

    const result = await service.findMatIssues('PR-1', 'C1', 'P1');

    expect(result[0]).toEqual(
      expect.objectContaining({
        issueNo: 'ISS-001',
        matUid: 'MAT-MISSING',
        itemCode: null,
        itemName: null,
        unit: null,
      }),
    );
  });

  it('findMatIssues resolves material part within tenant from lot itemCode', async () => {
    matIssueRepo.find.mockResolvedValue([
      {
        issueNo: 'ISS-001',
        seq: 1,
        prodResultNo: 'PR-1',
        matUid: 'MAT-001',
        issueQty: 2,
        status: 'DONE',
      } as MatIssue,
    ]);
    dataSource.getRepository.mockReturnValue({
      find: jest.fn().mockResolvedValue([{ matUid: 'MAT-001', itemCode: 'RM-001' }]),
    } as any);
    partMasterRepo.find.mockResolvedValue([{ itemCode: 'RM-001', itemName: 'Raw Material', unit: 'EA' }] as any);

    await service.findMatIssues('PR-1', 'C1', 'P1');

    expect(partMasterRepo.find).toHaveBeenCalledWith({
      where: { itemCode: expect.anything(), company: 'C1', plant: 'P1' },
    });
  });

  it('findMatIssues keeps LOT itemCode when part master is missing', async () => {
    matIssueRepo.find.mockResolvedValue([
      {
        issueNo: 'ISS-001',
        seq: 1,
        prodResultNo: 'PR-1',
        matUid: 'MAT-001',
        issueQty: 2,
        status: 'DONE',
      } as MatIssue,
    ]);
    dataSource.getRepository.mockReturnValue({
      find: jest.fn().mockResolvedValue([{ matUid: 'MAT-001', itemCode: 'RM-MISSING' }]),
    } as any);
    partMasterRepo.find.mockResolvedValue([]);

    const result = await service.findMatIssues('PR-1', 'C1', 'P1');

    expect(result[0]).toEqual(
      expect.objectContaining({
        matUid: 'MAT-001',
        itemCode: 'RM-MISSING',
        itemName: null,
        unit: null,
      }),
    );
  });

  it('create persists result', async () => {
    jobOrderRepo.findOne.mockResolvedValue({ orderNo: 'JO-1', status: 'RUNNING', planQty: 100, company: 'C1', plant: 'P1' } as any);

    const qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ totalGood: '0', totalDefect: '0' }),
    } as any;
    prodResultRepo.createQueryBuilder.mockReturnValue(qb);

    numbering.next.mockResolvedValue('PR-1');
    queryRunner.manager.create.mockReturnValue({ resultNo: 'PR-1' } as any);
    queryRunner.manager.save.mockResolvedValue({ resultNo: 'PR-1' } as any);
    sysConfigService.getValue.mockResolvedValue('OFF');
    autoIssueService.execute.mockResolvedValue({ issued: [], warnings: [], skipped: false } as any);
    prodResultRepo.findOne.mockResolvedValue({ resultNo: 'PR-1' } as any);

    const result = await service.create({ orderNo: 'JO-1', goodQty: 1, defectQty: 0 } as any, 'C1', 'P1');

    expect(tx.run).toHaveBeenCalledTimes(1);
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(result?.resultNo).toBe('PR-1');
  });

  it('validates equipment and equipment BOM within tenant when creating result', async () => {
    jobOrderRepo.findOne.mockResolvedValue({
      orderNo: 'JO-1',
      status: 'RUNNING',
      planQty: 100,
      part: { itemCode: 'FG-001' },
      company: 'C1',
      plant: 'P1',
    } as any);
    equipBomRelRepo.find.mockResolvedValue([]);
    equipMasterRepo.findOne.mockResolvedValue({ equipCode: 'EQ-001', company: 'C1', plant: 'P1' } as any);

    const qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ totalGood: '0', totalDefect: '0' }),
    } as any;
    prodResultRepo.createQueryBuilder.mockReturnValue(qb);

    numbering.next.mockResolvedValue('PR-1');
    queryRunner.manager.create.mockReturnValue({ resultNo: 'PR-1' } as any);
    queryRunner.manager.save.mockResolvedValue({ resultNo: 'PR-1' } as any);
    sysConfigService.getValue.mockResolvedValue('OFF');
    autoIssueService.execute.mockResolvedValue({ issued: [], warnings: [], skipped: false } as any);
    prodResultRepo.findOne.mockResolvedValue({ resultNo: 'PR-1' } as any);

    await service.create({ orderNo: 'JO-1', equipCode: 'EQ-001', goodQty: 1, defectQty: 0 } as any, 'C1', 'P1');

    expect(equipBomRelRepo.find).toHaveBeenCalledWith({
      where: { equipCode: 'EQ-001', useYn: 'Y', company: 'C1', plant: 'P1' },
    });
    expect(equipMasterRepo.findOne).toHaveBeenCalledWith({
      where: { equipCode: 'EQ-001', company: 'C1', plant: 'P1' },
    });
  });

  it('create promotes job-order status from WAITING to RUNNING', async () => {
    jobOrderRepo.findOne.mockResolvedValue({
      orderNo: 'JO-2',
      status: 'WAITING',
      planQty: 100,
      company: 'C1',
      plant: 'P1',
    } as any);

    const qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ totalGood: '0', totalDefect: '0' }),
    } as any;
    prodResultRepo.createQueryBuilder.mockReturnValue(qb);

    numbering.next.mockResolvedValue('PR-2');
    queryRunner.manager.create.mockReturnValue({ resultNo: 'PR-2' } as any);
    queryRunner.manager.save.mockResolvedValue({ resultNo: 'PR-2' } as any);
    sysConfigService.getValue.mockResolvedValue('OFF');
    autoIssueService.execute.mockResolvedValue({ issued: [], warnings: [], skipped: false } as any);
    prodResultRepo.findOne.mockResolvedValue({ resultNo: 'PR-2' } as any);

    await service.create({ orderNo: 'JO-2', goodQty: 1, defectQty: 0 } as any, 'C1', 'P1');

    expect(queryRunner.manager.update).toHaveBeenCalledWith(
      JobOrder,
      expect.objectContaining({ orderNo: 'JO-2', company: 'C1', plant: 'P1' }),
      expect.objectContaining({ status: 'RUNNING' }),
    );
  });

  it('update persists editable fields through TransactionService', async () => {
    prodResultRepo.findOne
      .mockResolvedValueOnce({
        resultNo: 'PR-1',
        status: 'RUNNING',
        goodQty: 1,
        defectQty: 0,
        orderNo: 'JO-1',
        inspectResults: [],
        defectLogs: [],
      } as any)
      .mockResolvedValueOnce({ resultNo: 'PR-1', remark: 'updated' } as any);
    matIssueRepo.find.mockResolvedValue([] as any);
    queryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);

    const result = await service.update('PR-1', { remark: 'updated' } as any, 'C1', 'P1');

    expect(result?.resultNo).toBe('PR-1');
    expect(queryRunner.manager.update).toHaveBeenCalledWith(
      ProdResult,
      'PR-1',
      expect.objectContaining({ remark: 'updated' }),
    );
    expect(tx.run).toHaveBeenCalledTimes(1);
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('update blocks direct status change', async () => {
    prodResultRepo.findOne.mockResolvedValue({
      resultNo: 'PR-1',
      status: 'RUNNING',
      goodQty: 1,
      defectQty: 0,
      orderNo: 'JO-1',
      inspectResults: [],
      defectLogs: [],
    } as any);
    matIssueRepo.find.mockResolvedValue([] as any);

    await expect(service.update('PR-1', { status: 'DONE' } as any, 'C1', 'P1')).rejects.toThrow(BadRequestException);
  });

  it('delete only allows canceled', async () => {
    prodResultRepo.findOne.mockResolvedValue({ resultNo: 'PR-1', status: 'DONE', inspectResults: [], defectLogs: [] } as any);
    matIssueRepo.find.mockResolvedValue([] as any);

    await expect(service.delete('PR-1', 'C1', 'P1')).rejects.toThrow(BadRequestException);
  });

  it('blocks auto-issue reversal when tenant values disagree across source rows', async () => {
    queryRunner.manager.find
      .mockResolvedValueOnce([
        {
          issueNo: 'MI-1',
          seq: 1,
          matUid: 'MAT-1',
          issueQty: 1,
          company: 'C1',
          plant: 'P1',
        },
      ] as any)
      .mockResolvedValueOnce([
        {
          transNo: 'TX-1',
          fromWarehouseId: 'WH-1',
          itemCode: 'ITEM-1',
          qty: -1,
          company: 'C2',
          plant: 'P1',
        },
      ] as any);
    queryRunner.manager.findOne
      .mockResolvedValueOnce({ matUid: 'MAT-1', itemCode: 'ITEM-1', company: 'C1', plant: 'P1' } as any)
      .mockResolvedValueOnce({
        warehouseCode: 'WH-1',
        itemCode: 'ITEM-1',
        matUid: 'MAT-1',
        qty: 0,
        availableQty: 0,
      } as any);

    await expect(
      (service as any).reverseAutoIssue(queryRunner, 'PR-1', 'C1', 'P1'),
    ).rejects.toThrow(BadRequestException);
    expect(queryRunner.manager.create).not.toHaveBeenCalledWith(
      StockTransaction,
      expect.objectContaining({ company: 'C2' }),
    );
  });
});
