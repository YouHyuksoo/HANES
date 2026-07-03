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
import { ItemMaster } from '../../../entities/item-master.entity';
import { ConsumableMaster } from '../../../entities/consumable-master.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { DefectLog } from '../../../entities/defect-log.entity';
import { SgLabel } from '../../../entities/sg-label.entity';
import { SelfInspectResult } from '../../../entities/self-inspect-result.entity';
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

describe('ProdResultService', () => {
  let service: ProdResultService;
  let prodResultRepo: DeepMocked<Repository<ProdResult>>;
  let jobOrderRepo: DeepMocked<Repository<JobOrder>>;
  let equipMasterRepo: DeepMocked<Repository<EquipMaster>>;
  let equipBomRelRepo: DeepMocked<Repository<EquipBomRel>>;
  let equipBomItemRepo: DeepMocked<Repository<EquipBomItem>>;
  let itemMasterRepo: DeepMocked<Repository<ItemMaster>>;
  let consumableRepo: DeepMocked<Repository<ConsumableMaster>>;
  let matIssueRepo: DeepMocked<Repository<MatIssue>>;
  let userRepo: DeepMocked<Repository<User>>;
  let workerMasterRepo: DeepMocked<Repository<WorkerMaster>>;
  let dataSource: DeepMocked<DataSource>;
  let autoIssueService: DeepMocked<AutoIssueService>;
  let productInventoryService: DeepMocked<ProductInventoryService>;
  let wipMatStockService: DeepMocked<WipMatStockService>;
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
    itemMasterRepo = createMock<Repository<ItemMaster>>();
    consumableRepo = createMock<Repository<ConsumableMaster>>();
    matIssueRepo = createMock<Repository<MatIssue>>();
    userRepo = createMock<Repository<User>>();
    workerMasterRepo = createMock<Repository<WorkerMaster>>();
    dataSource = createMock<DataSource>();
    autoIssueService = createMock<AutoIssueService>();
    productInventoryService = createMock<ProductInventoryService>();
    wipMatStockService = createMock<WipMatStockService>();
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
        { provide: getRepositoryToken(ItemMaster), useValue: itemMasterRepo },
        { provide: getRepositoryToken(ConsumableMaster), useValue: consumableRepo },
        { provide: getRepositoryToken(MatIssue), useValue: matIssueRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(WorkerMaster), useValue: workerMasterRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: AutoIssueService, useValue: autoIssueService },
        { provide: ProductInventoryService, useValue: productInventoryService },
        { provide: WipMatStockService, useValue: wipMatStockService },
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
    itemMasterRepo.find.mockResolvedValue([]);

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
    itemMasterRepo.find.mockResolvedValue([{ itemCode: 'RM-001', itemName: 'Raw Material', unit: 'EA' }] as any);

    await service.findMatIssues('PR-1', 'C1', 'P1');

    expect(itemMasterRepo.find).toHaveBeenCalledWith({
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
    itemMasterRepo.find.mockResolvedValue([]);

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

  it('adsorbs defect quantity into WIP product stock with DEFECT quality status', async () => {
    queryRunner.manager.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        orderNo: 'JO-1',
        itemCode: 'SFG-001',
        company: 'C1',
        plant: 'P1',
        part: { itemType: 'SEMI_PRODUCT' },
      } as any)
      .mockResolvedValueOnce({ resultNo: 'PR-1', prdUid: 'PRD-DEF-1' } as any);

    await (service as any).adsorbDefectStockInTx(queryRunner, {
      resultNo: 'PR-1',
      orderNo: 'JO-1',
      defectQty: 2,
      processCode: 'PROC-1',
      company: 'C1',
      plant: 'P1',
    });

    expect(productInventoryService.receiveStockInTx).toHaveBeenCalledWith(
      queryRunner,
      expect.objectContaining({
        warehouseId: 'SFG_WIP',
        itemCode: 'SFG-001',
        itemType: 'SEMI_PRODUCT',
        qty: 2,
        transType: 'WIP_IN',
        qualityStatus: 'DEFECT',
        refType: 'PROD_RESULT',
        refId: 'PR-1',
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
    expect(queryRunner.manager.create).toHaveBeenCalledWith(
      ProdResult,
      expect.objectContaining({ status: 'DONE' }),
    );
    expect(result?.resultNo).toBe('PR-1');
  });

  it('stores TRIAL production type until the latest FIRST inspection batch is all PASS', async () => {
    jobOrderRepo.findOne.mockResolvedValue({ orderNo: 'JO-1', status: 'RUNNING', planQty: 100, company: 'C1', plant: 'P1' } as any);

    const qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ totalGood: '0', totalDefect: '0' }),
    } as any;
    prodResultRepo.createQueryBuilder.mockReturnValue(qb);

    const selfInspectRepo = {
      find: jest.fn().mockResolvedValue([
        { status: 'PENDING', createdAt: new Date('2026-07-03T01:00:03.000Z') },
        { status: 'PASS', createdAt: new Date('2026-07-03T01:00:02.000Z') },
      ]),
    };
    dataSource.getRepository.mockImplementation((entity: any) => {
      if (entity === SelfInspectResult) return selfInspectRepo as any;
      return { find: jest.fn().mockResolvedValue([]) } as any;
    });

    numbering.next.mockResolvedValue('PR-1');
    queryRunner.manager.create.mockReturnValue({ resultNo: 'PR-1' } as any);
    queryRunner.manager.save.mockResolvedValue({ resultNo: 'PR-1' } as any);
    sysConfigService.getValue.mockResolvedValue('OFF');
    autoIssueService.execute.mockResolvedValue({ issued: [], warnings: [], skipped: false } as any);
    prodResultRepo.findOne.mockResolvedValue({ resultNo: 'PR-1' } as any);

    await service.create({ orderNo: 'JO-1', goodQty: 1, defectQty: 0 } as any, 'C1', 'P1');

    expect(queryRunner.manager.create).toHaveBeenCalledWith(
      ProdResult,
      expect.objectContaining({ productionType: 'TRIAL' }),
    );
  });

  it('stores MASS production type after the latest FIRST inspection batch is all PASS', async () => {
    jobOrderRepo.findOne.mockResolvedValue({ orderNo: 'JO-1', status: 'RUNNING', planQty: 100, company: 'C1', plant: 'P1' } as any);

    const qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ totalGood: '0', totalDefect: '0' }),
    } as any;
    prodResultRepo.createQueryBuilder.mockReturnValue(qb);

    const selfInspectRepo = {
      find: jest.fn().mockResolvedValue([
        { status: 'PASS', createdAt: new Date('2026-07-03T01:00:03.000Z') },
        { status: 'PASS', createdAt: new Date('2026-07-03T01:00:02.000Z') },
        { status: 'FAIL', createdAt: new Date('2026-07-03T00:30:00.000Z') },
      ]),
    };
    dataSource.getRepository.mockImplementation((entity: any) => {
      if (entity === SelfInspectResult) return selfInspectRepo as any;
      return { find: jest.fn().mockResolvedValue([]) } as any;
    });

    numbering.next.mockResolvedValue('PR-1');
    queryRunner.manager.create.mockReturnValue({ resultNo: 'PR-1' } as any);
    queryRunner.manager.save.mockResolvedValue({ resultNo: 'PR-1' } as any);
    sysConfigService.getValue.mockResolvedValue('OFF');
    autoIssueService.execute.mockResolvedValue({ issued: [], warnings: [], skipped: false } as any);
    prodResultRepo.findOne.mockResolvedValue({ resultNo: 'PR-1' } as any);

    await service.create({ orderNo: 'JO-1', goodQty: 1, defectQty: 0 } as any, 'C1', 'P1');

    expect(queryRunner.manager.create).toHaveBeenCalledWith(
      ProdResult,
      expect.objectContaining({ productionType: 'MASS' }),
    );
  });

  it('persists defect detail logs in the same transaction without double counting defectQty', async () => {
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

    await service.create(
      {
        orderNo: 'JO-1',
        goodQty: 5,
        defectQty: 5,
        defects: [
          { defectCode: 'D1', defectName: 'a', qty: 2 },
          { defectCode: 'D2', defectName: 'b', qty: 3 },
        ],
      } as any,
      'C1',
      'P1',
    );

    // 생산실적은 집계 defectQty(5)로 1회만 생성 — defect-logs로 재증가(이중 카운트) 없음
    expect(queryRunner.manager.create).toHaveBeenCalledWith(
      ProdResult,
      expect.objectContaining({ goodQty: 5, defectQty: 5 }),
    );
    // 자재 자동차감은 good+defect(10) 기준 유지
    expect(autoIssueService.execute).toHaveBeenCalledWith('ON_CREATE', 'PR-1', 'JO-1', 10, expect.anything(), undefined);
    // 불량 상세 2건이 같은 트랜잭션에서 DefectLog로 저장 (seq 1,2로 PK 충돌 방지)
    const defectSaves = queryRunner.manager.save.mock.calls.filter((c: any[]) => c[0] === DefectLog);
    expect(defectSaves).toHaveLength(2);
    expect(defectSaves[0][1]).toEqual(
      expect.objectContaining({ prodResultNo: 'PR-1', defectCode: 'D1', qty: 2, seq: 1, status: 'WAIT', company: 'C1', plant: 'P1' }),
    );
    expect(defectSaves[1][1]).toEqual(
      expect.objectContaining({ prodResultNo: 'PR-1', defectCode: 'D2', qty: 3, seq: 2 }),
    );
  });

  it('blocks create when the loaded job order belongs to a different tenant', async () => {
    jobOrderRepo.findOne.mockResolvedValue({
      orderNo: 'JO-1',
      status: 'RUNNING',
      planQty: 100,
      company: 'OTHER',
      plant: 'P1',
    } as any);

    await expect(service.create({ orderNo: 'JO-1', goodQty: 1, defectQty: 0 } as any, 'C1', 'P1')).rejects.toThrow(BadRequestException);

    expect(tx.run).not.toHaveBeenCalled();
  });

  it('blocks create when the loaded equipment belongs to a different tenant', async () => {
    jobOrderRepo.findOne.mockResolvedValue({
      orderNo: 'JO-1',
      status: 'RUNNING',
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
    equipBomRelRepo.find.mockResolvedValue([]);
    equipMasterRepo.findOne.mockResolvedValue({ equipCode: 'EQ-001', company: 'OTHER', plant: 'P1' } as any);

    await expect(service.create({ orderNo: 'JO-1', equipCode: 'EQ-001', goodQty: 1, defectQty: 0 } as any, 'C1', 'P1')).rejects.toThrow(BadRequestException);

    expect(tx.run).not.toHaveBeenCalled();
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

  it('validates worker by workerCode (WorkerMaster) within tenant when creating result', async () => {
    jobOrderRepo.findOne.mockResolvedValue({
      orderNo: 'JO-1',
      status: 'RUNNING',
      planQty: 100,
      company: 'C1',
      plant: 'P1',
    } as any);
    // 입력 화면들은 workerCode를 workerId로 전송 → WorkerMaster.workerCode로 검증된다.
    workerMasterRepo.findOne.mockResolvedValue({ workerCode: 'W010', company: 'C1', plant: 'P1' } as any);

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

    await service.create(
      { orderNo: 'JO-1', workerId: 'W010', goodQty: 1, defectQty: 0 } as any,
      'C1',
      'P1',
    );

    expect(workerMasterRepo.findOne).toHaveBeenCalledWith({
      where: { workerCode: 'W010', company: 'C1', plant: 'P1' },
    });
  });

  it('falls back to USERS.email when workerId is not a workerCode (legacy data)', async () => {
    jobOrderRepo.findOne.mockResolvedValue({
      orderNo: 'JO-1',
      status: 'RUNNING',
      planQty: 100,
      company: 'C1',
      plant: 'P1',
    } as any);
    workerMasterRepo.findOne.mockResolvedValue(null as any);
    userRepo.findOne.mockResolvedValue({ email: 'worker@harness.com', company: 'C1', plant: 'P1' } as any);

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

    await service.create(
      { orderNo: 'JO-1', workerId: 'worker@harness.com', goodQty: 1, defectQty: 0 } as any,
      'C1',
      'P1',
    );

    expect(userRepo.findOne).toHaveBeenCalledWith({
      where: { email: 'worker@harness.com', company: 'C1', plant: 'P1' },
    });
  });

  it('throws when workerId matches neither WorkerMaster nor USERS', async () => {
    jobOrderRepo.findOne.mockResolvedValue({
      orderNo: 'JO-1',
      status: 'RUNNING',
      planQty: 100,
      company: 'C1',
      plant: 'P1',
    } as any);
    workerMasterRepo.findOne.mockResolvedValue(null as any);
    userRepo.findOne.mockResolvedValue(null as any);

    const qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ totalGood: '0', totalDefect: '0' }),
    } as any;
    prodResultRepo.createQueryBuilder.mockReturnValue(qb);

    await expect(
      service.create(
        { orderNo: 'JO-1', workerId: 'NOPE', goodQty: 1, defectQty: 0 } as any,
        'C1',
        'P1',
      ),
    ).rejects.toThrow('작업자를 찾을 수 없습니다: NOPE');
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
      { resultNo: 'PR-1', company: 'C1', plant: 'P1' },
      expect.objectContaining({ remark: 'updated' }),
    );
    expect(tx.run).toHaveBeenCalledTimes(1);
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('recalculates material and product stock when a completed result quantity changes', async () => {
    prodResultRepo.findOne
      .mockResolvedValueOnce({
        resultNo: 'PR-1',
        status: 'DONE',
        goodQty: 1,
        defectQty: 0,
        orderNo: 'JO-1',
        processCode: 'PROC-1',
        company: 'C1',
        plant: 'P1',
        inspectResults: [],
        defectLogs: [],
      } as any)
      .mockResolvedValueOnce({ resultNo: 'PR-1', goodQty: 3, defectQty: 0 } as any);
    matIssueRepo.find.mockResolvedValue([] as any);
    queryRunner.manager.find.mockResolvedValue([] as any);
    queryRunner.manager.findOne
      .mockResolvedValueOnce(null as any)
      .mockResolvedValueOnce({ orderNo: 'JO-1', itemCode: 'FG-1', company: 'C1', plant: 'P1', part: { itemType: 'SEMI_PRODUCT' } } as any)
      .mockResolvedValueOnce({ resultNo: 'PR-1', prdUid: 'PRD-1' } as any);
    queryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
    autoIssueService.execute.mockResolvedValue({ issued: [], warnings: [], skipped: false } as any);

    await service.update('PR-1', { goodQty: 3 } as any, 'C1', 'P1');

    expect(autoIssueService.execute).toHaveBeenCalledWith(
      'ON_CREATE',
      'PR-1',
      'JO-1',
      3,
      expect.anything(),
      'PROC-1',
    );
    expect(productInventoryService.receiveStockInTx).toHaveBeenCalled();
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

  it('delete reverses linked movements and removes a completed result row', async () => {
    prodResultRepo.findOne.mockResolvedValue({
      resultNo: 'PR-1',
      orderNo: 'JO-1',
      status: 'DONE',
      equipCode: null,
      inspectResults: [],
      defectLogs: [],
      company: 'C1',
      plant: 'P1',
    } as any);
    matIssueRepo.find.mockResolvedValue([] as any);
    dataSource.getRepository.mockReturnValue({
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    } as any);
    queryRunner.manager.find.mockResolvedValue([] as any);
    queryRunner.manager.findOne.mockResolvedValue(null as any);
    queryRunner.manager.delete.mockResolvedValue({ affected: 1 } as any);

    await expect(service.delete('PR-1', 'C1', 'P1')).resolves.toEqual({ resultNo: 'PR-1' });

    expect(queryRunner.manager.delete).toHaveBeenCalledWith(
      ProdResult,
      { resultNo: 'PR-1', company: 'C1', plant: 'P1' },
    );
  });

  it('delete removes unused SG labels issued by the production result', async () => {
    prodResultRepo.findOne.mockResolvedValue({
      resultNo: 'PR-1',
      orderNo: 'JO-1',
      status: 'DONE',
      equipCode: null,
      inspectResults: [],
      defectLogs: [],
      company: 'C1',
      plant: 'P1',
    } as any);
    matIssueRepo.find.mockResolvedValue([] as any);
    dataSource.getRepository.mockReturnValue({
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    } as any);
    queryRunner.manager.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ sgBarcode: 'SG-1', resultNo: 'PR-1', status: 'IN_STOCK', company: 'C1', plant: 'P1' }]);
    queryRunner.manager.findOne.mockResolvedValue(null as any);
    queryRunner.manager.delete.mockResolvedValue({ affected: 1 } as any);

    await service.delete('PR-1', 'C1', 'P1');

    expect(queryRunner.manager.delete).toHaveBeenCalledWith(
      SgLabel,
      { resultNo: 'PR-1', company: 'C1', plant: 'P1' },
    );
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

  it('reverses WIP consumption by delegating to WipMatStockService.restoreInTx (ADD_BACK)', async () => {
    // equipCode 경로: MatIssue(PROD_AUTO) 없음 → MatIssue find 빈 배열
    queryRunner.manager.find.mockResolvedValue([] as any);
    wipMatStockService.restoreInTx.mockResolvedValue([
      { matUid: 'MAT-1', qty: 10, cancelRefId: 'WTX-1' },
    ] as any);

    await (service as any).reverseAutoIssue(queryRunner, 'PR-1', 'C1', 'P1');

    // 공정소비 복원 위임 (ADD_BACK / PROD_RESULT / PROD_CONSUME → PROD_CONSUME_CANCEL)
    expect(wipMatStockService.restoreInTx).toHaveBeenCalledWith(
      queryRunner,
      expect.objectContaining({
        mode: 'ADD_BACK',
        refType: 'PROD_RESULT',
        refId: 'PR-1',
        cancelTransType: 'PROD_CONSUME_CANCEL',
        originTransType: 'PROD_CONSUME',
        company: 'C1',
        plant: 'P1',
      }),
    );
    // MatIssue 없으므로 원자재 StockTransaction 생성 없음
    expect(queryRunner.manager.create).not.toHaveBeenCalledWith(
      StockTransaction,
      expect.anything(),
    );
  });

  it('skips WIP restore when company/plant are missing', async () => {
    queryRunner.manager.find.mockResolvedValue([] as any);

    await (service as any).reverseAutoIssue(queryRunner, 'PR-1');

    expect(wipMatStockService.restoreInTx).not.toHaveBeenCalled();
  });

  it('reverses legacy MAT_OUT consumption by restoring raw-material stock with MAT_IN', async () => {
    queryRunner.manager.find
      .mockResolvedValueOnce([
        {
          issueNo: 'MI-1',
          seq: 1,
          matUid: 'MAT-1',
          issueQty: 5,
          company: 'C1',
          plant: 'P1',
        },
      ] as any)
      .mockResolvedValueOnce([
        {
          transNo: 'TX-1',
          transType: 'MAT_OUT',
          fromWarehouseId: 'RM_MAIN',
          itemCode: 'ITEM-1',
          qty: -5,
          company: 'C1',
          plant: 'P1',
        },
      ] as any);
    queryRunner.manager.findOne
      .mockResolvedValueOnce({ matUid: 'MAT-1', itemCode: 'ITEM-1', company: 'C1', plant: 'P1' } as any) // lot
      .mockResolvedValueOnce({
        warehouseCode: 'RM_MAIN',
        itemCode: 'ITEM-1',
        matUid: 'MAT-1',
        qty: 0,
        availableQty: 0,
        company: 'C1',
        plant: 'P1',
      } as any); // stock at RM warehouse
    numbering.nextInTx.mockResolvedValue('RTX-1');
    queryRunner.manager.create.mockImplementation((_: any, data: any) => data);

    await (service as any).reverseAutoIssue(queryRunner, 'PR-1', 'C1', 'P1');

    expect(queryRunner.manager.update).toHaveBeenCalledWith(
      MatStock,
      expect.objectContaining({ warehouseCode: 'RM_MAIN' }),
      expect.objectContaining({ qty: 5, availableQty: 5 }),
    );
    expect(queryRunner.manager.create).toHaveBeenCalledWith(
      StockTransaction,
      expect.objectContaining({
        transType: 'MAT_IN',
        toWarehouseId: 'RM_MAIN',
        qty: 5,
      }),
    );
    expect(queryRunner.manager.create).not.toHaveBeenCalledWith(
      StockTransaction,
      expect.objectContaining({ transType: 'PROD_CONSUME_CANCEL' }),
    );
    // 두 경로 공존: WIP 복원은 호출되나 PROD_CONSUME 원본이 없어 no-op
    expect(wipMatStockService.restoreInTx).toHaveBeenCalledWith(
      queryRunner,
      expect.objectContaining({ refType: 'PROD_RESULT', refId: 'PR-1' }),
    );
  });
});
