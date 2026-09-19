import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { BoxService } from './box.service';
import { BoxMaster } from '../../../entities/box-master.entity';
import { PalletMaster } from '../../../entities/pallet-master.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { OqcRequest } from '../../../entities/oqc-request.entity';
import { OqcRequestBox } from '../../../entities/oqc-request-box.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';
import { NumberingService } from '../../../shared/numbering.service';
import { SysConfigService } from '../../system/services/sys-config.service';
import { ProductTransaction } from '../../../entities/product-transaction.entity';
import { ProdResult } from '../../../entities/prod-result.entity';
import { CarrierFlowService } from '../../production/services/carrier-flow.service';

describe('BoxService', () => {
  let target: BoxService;
  let mockBoxRepo: DeepMocked<Repository<BoxMaster>>;
  let mockPalletRepo: DeepMocked<Repository<PalletMaster>>;
  let mockPartRepo: DeepMocked<Repository<ItemMaster>>;
  let mockLotRepo: DeepMocked<Repository<MatLot>>;
  let mockFgLabelRepo: DeepMocked<Repository<FgLabel>>;
  let mockOqcRequestRepo: DeepMocked<Repository<OqcRequest>>;
  let mockOqcRequestBoxRepo: DeepMocked<Repository<OqcRequestBox>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockTx: DeepMocked<TransactionService>;
  let mockQueryRunner: DeepMocked<QueryRunner>;
  let mockSysConfig: DeepMocked<SysConfigService>;
  let mockCarrierFlow: { clearInTx: jest.Mock; stampInTx: jest.Mock; assertLoadableInTx: jest.Mock };

  function mockPackableFgWip(labels: FgLabel[]) {
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(labels),
    };
    mockFgLabelRepo.createQueryBuilder.mockReturnValue(qb as any);
    return qb;
  }

  beforeEach(async () => {
    mockBoxRepo = createMock<Repository<BoxMaster>>();
    mockPalletRepo = createMock<Repository<PalletMaster>>();
    mockPartRepo = createMock<Repository<ItemMaster>>();
    mockLotRepo = createMock<Repository<MatLot>>();
    mockFgLabelRepo = createMock<Repository<FgLabel>>();
    mockOqcRequestRepo = createMock<Repository<OqcRequest>>();
    mockOqcRequestBoxRepo = createMock<Repository<OqcRequestBox>>();
    mockDataSource = createMock<DataSource>();
    mockTx = createMock<TransactionService>();
    mockQueryRunner = createMock<QueryRunner>();
    mockSysConfig = createMock<SysConfigService>();
    mockCarrierFlow = { clearInTx: jest.fn(), stampInTx: jest.fn(), assertLoadableInTx: jest.fn() };
    mockSysConfig.isEnabled.mockResolvedValue(false);
    (mockBoxRepo.manager.findOne as jest.Mock).mockResolvedValue(null);

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockTx.run.mockImplementation(async (callback) => callback(mockQueryRunner));
    // 시리얼 선점 검사와 박스 쓰기가 트랜잭션 manager로 옮겨갔다. BoxMaster 접근만
    // 기존 repo mock으로 위임해 두면 기존 기대(mockBoxRepo.find/save/update)가 그대로 산다.
    (mockQueryRunner.query as jest.Mock).mockResolvedValue([]);
    (mockQueryRunner.manager.find as jest.Mock).mockImplementation((entity: unknown, options: unknown) =>
      entity === BoxMaster ? mockBoxRepo.find(options as never) : Promise.resolve([]),
    );
    (mockQueryRunner.manager.create as jest.Mock).mockImplementation((_entity: unknown, value: unknown) => value);
    (mockQueryRunner.manager.save as jest.Mock).mockImplementation((entity: unknown, value: unknown) =>
      entity === BoxMaster ? mockBoxRepo.save(value as never) : Promise.resolve(value),
    );
    (mockQueryRunner.manager.update as jest.Mock).mockImplementation(
      (entity: unknown, criteria: unknown, partial: unknown) =>
        entity === BoxMaster
          ? mockBoxRepo.update(criteria as never, partial as never)
          : Promise.resolve(undefined),
    );
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoxService,
        { provide: getRepositoryToken(BoxMaster), useValue: mockBoxRepo },
        { provide: getRepositoryToken(PalletMaster), useValue: mockPalletRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: mockPartRepo },
        { provide: getRepositoryToken(MatLot), useValue: mockLotRepo },
        { provide: getRepositoryToken(FgLabel), useValue: mockFgLabelRepo },
        { provide: getRepositoryToken(OqcRequest), useValue: mockOqcRequestRepo },
        { provide: getRepositoryToken(OqcRequestBox), useValue: mockOqcRequestBoxRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
        { provide: NumberingService, useValue: { nextBoxNo: jest.fn().mockResolvedValue('BX-TEST') } },
        { provide: SysConfigService, useValue: mockSysConfig },
        { provide: CarrierFlowService, useValue: mockCarrierFlow },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get(BoxService);
  });

  afterEach(() => jest.clearAllMocks());

  it('findById throws when box is missing', async () => {
    mockBoxRepo.findOne.mockResolvedValue(null);

    await expect(target.findById('BOX-001')).rejects.toThrow(NotFoundException);
  });

  it('findByBoxNo enriches part within tenant only', async () => {
    mockBoxRepo.findOne.mockResolvedValue({
      boxNo: 'BOX-001',
      itemCode: 'ITEM-001',
      company: 'C1',
      plant: 'P1',
    } as BoxMaster);
    mockPartRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'Part A' } as ItemMaster);

    await target.findByBoxNo('BOX-001', 'C1', 'P1');

    expect(mockBoxRepo.findOne).toHaveBeenCalledWith({
      where: { boxNo: 'BOX-001', company: 'C1', plant: 'P1' },
    });
    expect(mockPartRepo.findOne).toHaveBeenCalledWith({
      where: { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' },
    });
  });

  it('create validates part within tenant only', async () => {
    mockBoxRepo.findOne.mockResolvedValue(null);
    mockPartRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001' } as ItemMaster);
    mockBoxRepo.create.mockReturnValue({ boxNo: 'BOX-001', itemCode: 'ITEM-001' } as BoxMaster);
    mockBoxRepo.save.mockResolvedValue({ boxNo: 'BOX-001', itemCode: 'ITEM-001' } as BoxMaster);

    await target.create({ boxNo: 'BOX-001', itemCode: 'ITEM-001', qty: 0 } as any, 'C1', 'P1');

    expect(mockPartRepo.findOne).toHaveBeenCalledWith({
      where: { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' },
    });
  });

  it('findStockByBox 는 박스 안 가장 오래된 제품라벨 발행일로 장기보관을 판정한다', async () => {
    const today = new Date();
    const daysAgo = (n: number) => new Date(today.getTime() - n * 24 * 60 * 60 * 1000);
    const qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          // 최신 라벨은 어제지만 가장 오래된 라벨이 120일 전 → 장기보관
          boxNo: 'BOX-OLD',
          itemCode: 'ITEM-001',
          qty: '2',
          orderNo: 'WO-001',
          latestAt: daysAgo(1),
          oldestAt: daysAgo(120),
          receivedFlag: '1',
          receivedAt: daysAgo(1),
          warehouseCode: 'FG_MAIN',
        },
        {
          boxNo: 'BOX-FRESH',
          itemCode: 'ITEM-001',
          qty: '3',
          orderNo: 'WO-002',
          latestAt: daysAgo(1),
          oldestAt: daysAgo(10),
          receivedFlag: '1',
          receivedAt: daysAgo(1),
          warehouseCode: 'FG_MAIN',
        },
      ]),
    };
    mockFgLabelRepo.createQueryBuilder.mockReturnValue(qb as any);
    mockPartRepo.find.mockResolvedValue([{ itemCode: 'ITEM-001', itemName: 'Harness' } as ItemMaster]);
    mockSysConfig.isEnabled.mockResolvedValue(true);
    mockSysConfig.getValue.mockResolvedValue('90');

    const rows = await target.findStockByBox(undefined, 'C1', 'P1');

    expect(qb.addSelect).toHaveBeenCalledWith('MIN(l.issuedAt)', 'oldestAt');
    expect(rows[0]).toEqual(expect.objectContaining({ boxNo: 'BOX-OLD', storageDays: 120, longStoredYn: 'Y', longStockDays: 90 }));
    expect(rows[1]).toEqual(expect.objectContaining({ boxNo: 'BOX-FRESH', storageDays: 10, longStoredYn: 'N' }));
  });

  it('findStockByBox 는 LONG_STOCK_CHECK 가 꺼져 있으면 경과일만 주고 장기보관 판정은 하지 않는다', async () => {
    const today = new Date();
    const qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          boxNo: 'BOX-OLD',
          itemCode: 'ITEM-001',
          qty: '2',
          orderNo: 'WO-001',
          latestAt: today,
          oldestAt: new Date(today.getTime() - 200 * 24 * 60 * 60 * 1000),
          receivedFlag: '1',
          receivedAt: today,
          warehouseCode: 'FG_MAIN',
        },
      ]),
    };
    mockFgLabelRepo.createQueryBuilder.mockReturnValue(qb as any);
    mockPartRepo.find.mockResolvedValue([{ itemCode: 'ITEM-001', itemName: 'Harness' } as ItemMaster]);
    mockSysConfig.isEnabled.mockResolvedValue(false);
    mockSysConfig.getValue.mockResolvedValue('90');

    const rows = await target.findStockByBox(undefined, 'C1', 'P1');

    expect(rows[0]).toEqual(expect.objectContaining({ storageDays: 200, longStoredYn: 'N' }));
  });

  it('findStockByBox separates packed waiting boxes from warehouse received boxes', async () => {
    const qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          boxNo: 'BOX-PACKED',
          itemCode: 'ITEM-001',
          qty: '2',
          orderNo: 'WO-001',
          latestAt: new Date('2026-06-20T01:00:00Z'),
          receivedFlag: '0',
          receivedAt: null,
          warehouseCode: null,
        },
        {
          boxNo: 'BOX-RECEIVED',
          itemCode: 'ITEM-001',
          qty: '3',
          orderNo: 'WO-002',
          latestAt: new Date('2026-06-20T02:00:00Z'),
          receivedFlag: '1',
          receivedAt: new Date('2026-06-20T03:00:00Z'),
          warehouseCode: 'FG_MAIN',
        },
      ]),
    };
    mockFgLabelRepo.createQueryBuilder.mockReturnValue(qb as any);
    mockPartRepo.find.mockResolvedValue([{ itemCode: 'ITEM-001', itemName: 'Harness' } as ItemMaster]);

    const rows = await target.findStockByBox(undefined, 'C1', 'P1');

    expect(qb.leftJoin).toHaveBeenCalledWith(
      expect.anything(),
      'tx',
      expect.stringContaining('tx.refType = :boxRefType'),
      expect.objectContaining({ boxRefType: 'BOX' }),
    );
    expect(rows).toEqual([
      expect.objectContaining({
        boxNo: 'BOX-PACKED',
        inventoryState: 'PACKED_WAITING',
        warehouseCode: null,
        receivedAt: null,
      }),
      expect.objectContaining({
        boxNo: 'BOX-RECEIVED',
        inventoryState: 'WAREHOUSE_RECEIVED',
        warehouseCode: 'FG_MAIN',
        receivedAt: new Date('2026-06-20T03:00:00Z'),
      }),
    ]);
  });

  it('addSerial rejects labels that did not pass inspection', async () => {
    mockBoxRepo.findOne.mockResolvedValue({
      boxNo: 'BOX-001',
      itemCode: 'ITEM-001',
      status: 'OPEN',
      serialList: null,
    } as BoxMaster);
    mockLotRepo.find.mockResolvedValue([]);
    mockPartRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', boxQty: 10 } as ItemMaster);
    mockFgLabelRepo.find.mockResolvedValue([
      { fgBarcode: 'FG-001', itemCode: 'ITEM-001', inspectPassYn: 'N', status: 'ISSUED' } as FgLabel,
    ]);

    await expect(
      target.addSerial('BOX-001', { serials: ['FG-001'] } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('findPackableSerials requires assembly stock-in to the FG_WIP process warehouse', async () => {
    const qb = mockPackableFgWip([{ fgBarcode: 'FG-001', itemCode: 'ITEM-001' } as FgLabel]);
    mockPartRepo.find.mockResolvedValue([{ itemCode: 'ITEM-001', itemName: 'Harness' } as ItemMaster]);

    const result = await target.findPackableSerials('C1', 'P1', 'ITEM-001');

    expect(result).toHaveLength(1);
    expect(qb.innerJoin).toHaveBeenCalledWith(
      ProductTransaction,
      'wipIn',
      expect.stringContaining('wipIn.toWarehouseId = :fgWip'),
      expect.objectContaining({ fgWip: 'FG_WIP', assemblyRef: 'ASSEMBLY', goodQuality: 'GOOD' }),
    );
    expect(qb.innerJoin).toHaveBeenCalledWith(
      ProdResult,
      'pr',
      expect.stringContaining('pr.status = :doneResult'),
      { doneResult: 'DONE' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith('fg.company = :company', { company: 'C1' });
    expect(qb.andWhere).toHaveBeenCalledWith('fg.plant = :plant', { plant: 'P1' });
  });

  it('addSerial rejects a visual-pass FG without FG_WIP process-stock provenance', async () => {
    mockPackableFgWip([]);
    mockBoxRepo.findOne.mockResolvedValue({ boxNo: 'BOX-001', itemCode: 'ITEM-001', status: 'OPEN', serialList: null } as BoxMaster);
    mockLotRepo.find.mockResolvedValue([]);
    mockPartRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', boxQty: 10 } as ItemMaster);
    mockFgLabelRepo.find.mockResolvedValue([
      { fgBarcode: 'FG-001', itemCode: 'ITEM-001', inspectPassYn: 'Y', status: 'VISUAL_PASS' } as FgLabel,
    ]);

    await expect(target.addSerial('BOX-001', { serials: ['FG-001'] } as any, 'C1', 'P1'))
      .rejects.toThrow('완제품 공정창고(FG_WIP)');
    expect(mockBoxRepo.update).not.toHaveBeenCalled();
  });

  it('closeBox stamps FG_LABELS with boxNo so box stock can find packed serials', async () => {
    mockPackableFgWip([{ fgBarcode: 'FG-001' } as FgLabel]);
    mockBoxRepo.findOne
      .mockResolvedValueOnce({
        boxNo: 'BOX-001',
        itemCode: 'ITEM-001',
        qty: 1,
        status: 'OPEN',
        serialList: JSON.stringify(['FG-001']),
        company: 'C1',
        plant: 'P1',
      } as BoxMaster)
      .mockResolvedValueOnce({
        boxNo: 'BOX-001',
        itemCode: 'ITEM-001',
        qty: 1,
        status: 'CLOSED',
        serialList: JSON.stringify(['FG-001']),
        company: 'C1',
        plant: 'P1',
      } as BoxMaster);
    mockOqcRequestRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    } as any);
    mockQueryRunner.manager.create.mockImplementation((_entity, payload) => payload as any);

    await target.closeBox('BOX-001', 'C1', 'P1');

    expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
      FgLabel,
      { fgBarcode: expect.anything(), company: 'C1', plant: 'P1' },
      { status: 'PACKED', boxNo: 'BOX-001' },
    );
    // 포장된 FG는 같은 트랜잭션에서 대차에서 해제된다 — 안 하면 대차가 영원히 IN_TRANSIT으로 남는다.
    expect(mockCarrierFlow.clearInTx).toHaveBeenCalledWith(mockQueryRunner, 'FG', ['FG-001'], 'C1', 'P1');
  });

  it('closeBox rejects a serial that is no longer eligible in FG_WIP', async () => {
    mockPackableFgWip([]);
    mockBoxRepo.findOne.mockResolvedValue({
      boxNo: 'BOX-001',
      itemCode: 'ITEM-001',
      qty: 1,
      status: 'OPEN',
      serialList: JSON.stringify(['FG-001']),
      company: 'C1',
      plant: 'P1',
    } as BoxMaster);

    await expect(target.closeBox('BOX-001', 'C1', 'P1'))
      .rejects.toThrow('완제품 공정창고(FG_WIP)');
    expect(mockQueryRunner.manager.update).not.toHaveBeenCalled();
  });

  it('addSerial validates lots, part and fg labels within tenant only', async () => {
    mockPackableFgWip([{ fgBarcode: 'FG-001' } as FgLabel]);
    mockBoxRepo.findOne
      .mockResolvedValueOnce({
        boxNo: 'BOX-001',
        itemCode: 'ITEM-001',
        status: 'OPEN',
        serialList: null,
        company: 'C1',
        plant: 'P1',
      } as BoxMaster)
      .mockResolvedValueOnce({
        boxNo: 'BOX-001',
        itemCode: 'ITEM-001',
        status: 'OPEN',
        serialList: JSON.stringify(['FG-001']),
        company: 'C1',
        plant: 'P1',
      } as BoxMaster);
    mockLotRepo.find.mockResolvedValue([{ matUid: 'FG-001', itemCode: 'ITEM-001' } as MatLot]);
    mockPartRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', boxQty: 10 } as ItemMaster);
    mockFgLabelRepo.find.mockResolvedValue([
      { fgBarcode: 'FG-001', itemCode: 'ITEM-001', inspectPassYn: 'Y', status: 'VISUAL_PASS' } as FgLabel,
    ]);
    mockBoxRepo.find.mockResolvedValue([]);

    await target.addSerial('BOX-001', { serials: ['FG-001'] } as any, 'C1', 'P1');

    expect(mockLotRepo.find).toHaveBeenCalledWith({
      where: { matUid: expect.anything(), company: 'C1', plant: 'P1' },
    });
    expect(mockPartRepo.findOne).toHaveBeenCalledWith({
      where: { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' },
    });
    expect(mockFgLabelRepo.find).toHaveBeenCalledWith({
      where: { fgBarcode: expect.anything(), company: 'C1', plant: 'P1' },
    });
    expect(mockBoxRepo.update).toHaveBeenCalledWith(
      { boxNo: 'BOX-001', company: 'C1', plant: 'P1' },
      expect.objectContaining({ qty: 1 }),
    );
  });

  it('addSerial rejects serials already packed in another box', async () => {
    mockPackableFgWip([{ fgBarcode: 'FG-001' } as FgLabel]);
    mockBoxRepo.findOne.mockResolvedValue({
      boxNo: 'BOX-001',
      itemCode: 'ITEM-001',
      status: 'OPEN',
      serialList: null,
      company: 'C1',
      plant: 'P1',
    } as BoxMaster);
    mockLotRepo.find.mockResolvedValue([]);
    mockPartRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', boxQty: 10 } as ItemMaster);
    mockFgLabelRepo.find.mockResolvedValue([
      { fgBarcode: 'FG-001', itemCode: 'ITEM-001', inspectPassYn: 'Y', status: 'VISUAL_PASS' } as FgLabel,
    ]);
    mockBoxRepo.find.mockResolvedValue([
      { boxNo: 'BOX-OTHER', serialList: JSON.stringify(['FG-001']) } as BoxMaster,
    ]);

    await expect(
      target.addSerial('BOX-001', { serials: ['FG-001'] } as any, 'C1', 'P1'),
    ).rejects.toThrow(ConflictException);
    expect(mockBoxRepo.update).not.toHaveBeenCalled();
  });

  it('시리얼 포장은 FG 라벨을 FOR UPDATE로 잠근 뒤 교차 박스 검사를 한다', async () => {
    // 잠그지 않으면 두 박스가 같은 시리얼을 동시에 담아도 서로의 SERIAL_LIST를 못 본다.
    mockPackableFgWip([{ fgBarcode: 'FG-001' } as FgLabel, { fgBarcode: 'FG-002' } as FgLabel]);
    mockBoxRepo.findOne.mockResolvedValue({
      boxNo: 'BOX-001', itemCode: 'ITEM-001', status: 'OPEN', serialList: null, company: 'C1', plant: 'P1',
    } as BoxMaster);
    mockLotRepo.find.mockResolvedValue([]);
    mockPartRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', boxQty: 10 } as ItemMaster);
    mockFgLabelRepo.find.mockResolvedValue([
      { fgBarcode: 'FG-002', itemCode: 'ITEM-001', inspectPassYn: 'Y', status: 'VISUAL_PASS' } as FgLabel,
      { fgBarcode: 'FG-001', itemCode: 'ITEM-001', inspectPassYn: 'Y', status: 'VISUAL_PASS' } as FgLabel,
    ]);
    mockBoxRepo.find.mockResolvedValue([]);

    await target.addSerial('BOX-001', { serials: ['FG-002', 'FG-001'] } as never, 'C1', 'P1');

    const lockCall = (mockQueryRunner.query as jest.Mock).mock.calls.find(([sql]) =>
      String(sql).includes('FOR UPDATE'),
    );
    expect(lockCall).toBeDefined();
    expect(String(lockCall![0])).toMatch(/FROM FG_LABELS/);
    // 잠금 순서를 시리얼 정렬로 고정해 교차 대기 데드락을 피한다
    expect(lockCall![1]).toEqual(['FG-001', 'FG-002', 'C1', 'P1']);
  });

  it('create rejects serialList already packed in another box', async () => {
    mockBoxRepo.findOne.mockResolvedValue(null);
    mockPartRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001' } as ItemMaster);
    mockBoxRepo.find.mockResolvedValue([
      { boxNo: 'BOX-OTHER', serialList: JSON.stringify(['FG-001']) } as BoxMaster,
    ]);

    await expect(
      target.create({ boxNo: 'BOX-001', itemCode: 'ITEM-001', serialList: ['FG-001'] } as any, 'C1', 'P1'),
    ).rejects.toThrow(ConflictException);
    expect(mockBoxRepo.save).not.toHaveBeenCalled();
  });

  it('update rejects serialList already packed in another box', async () => {
    mockBoxRepo.findOne.mockResolvedValue({
      boxNo: 'BOX-001',
      itemCode: 'ITEM-001',
      status: 'OPEN',
      serialList: null,
    } as BoxMaster);
    mockBoxRepo.find.mockResolvedValue([
      { boxNo: 'BOX-OTHER', serialList: JSON.stringify(['FG-001']) } as BoxMaster,
    ]);

    await expect(
      target.update('BOX-001', { serialList: ['FG-001'] } as any),
    ).rejects.toThrow(ConflictException);
    expect(mockBoxRepo.update).not.toHaveBeenCalled();
  });

  it('cross-box guard ignores LIKE false positives via exact JSON match', async () => {
    mockBoxRepo.findOne.mockResolvedValue({
      boxNo: 'BOX-001',
      itemCode: 'ITEM-001',
      status: 'OPEN',
      serialList: null,
    } as BoxMaster);
    mockBoxRepo.find.mockResolvedValue([
      { boxNo: 'BOX-OTHER', serialList: JSON.stringify(['FG-0010']) } as BoxMaster,
    ]);

    await target.update('BOX-001', { serialList: ['FG-001'] } as any);

    expect(mockBoxRepo.update).toHaveBeenCalledWith(
      { boxNo: 'BOX-001' },
      expect.objectContaining({ serialList: JSON.stringify(['FG-001']) }),
    );
  });

  it('update blocks direct status changes', async () => {
    mockBoxRepo.findOne.mockResolvedValue({
      boxNo: 'BOX-001',
      itemCode: 'ITEM-001',
      status: 'OPEN',
    } as BoxMaster);

    await expect(
      target.update('BOX-001', { status: 'CLOSED' } as any),
    ).rejects.toThrow(BadRequestException);

    expect(mockBoxRepo.update).not.toHaveBeenCalled();
  });

  it('delete blocks boxes that already entered packing flow', async () => {
    mockBoxRepo.findOne.mockResolvedValue({
      boxNo: 'BOX-003',
      itemCode: 'ITEM-001',
      status: 'CLOSED',
      qty: 1,
      serialList: JSON.stringify(['FG-100']),
      oqcStatus: 'PENDING',
      palletNo: null,
    } as BoxMaster);

    await expect(target.delete('BOX-003')).rejects.toThrow(BadRequestException);
    expect(mockBoxRepo.delete).not.toHaveBeenCalled();
  });

  it('delete allows only empty open boxes', async () => {
    mockBoxRepo.findOne.mockResolvedValue({
      boxNo: 'BOX-004',
      itemCode: 'ITEM-001',
      status: 'OPEN',
      qty: 0,
      serialList: null,
      oqcStatus: null,
      palletNo: null,
    } as BoxMaster);

    await expect(target.delete('BOX-004')).resolves.toEqual({ id: 'BOX-004', deleted: true });
    expect(mockBoxRepo.delete).toHaveBeenCalledWith({ boxNo: 'BOX-004' });
  });

  it('closeBox creates an automatic OQC request and marks the box pending', async () => {
    mockSysConfig.isEnabled.mockResolvedValue(true);
    mockPackableFgWip([
      { fgBarcode: 'FG-001' } as FgLabel,
      { fgBarcode: 'FG-002' } as FgLabel,
    ]);
    mockBoxRepo.findOne
      .mockResolvedValueOnce({
        boxNo: 'BOX-001',
        itemCode: 'ITEM-001',
        status: 'OPEN',
        qty: 2,
        serialList: JSON.stringify(['FG-001', 'FG-002']),
        company: 'HANES',
        plant: 'P01',
      } as BoxMaster)
      .mockResolvedValueOnce({
        boxNo: 'BOX-001',
        status: 'CLOSED',
        oqcStatus: 'PENDING',
      } as BoxMaster);

    mockOqcRequestRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    } as any);

    const manager = {
      update: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((entity, payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (_entity, payload) => payload ?? _entity),
    };
    (mockQueryRunner as any).manager = manager;

    const result = await target.closeBox('BOX-001');

    expect(result.oqcStatus).toBe('PENDING');
    expect(manager.save).toHaveBeenCalledWith(
      OqcRequest,
      expect.objectContaining({ remark: 'AUTO_CREATED_FROM_BOX:BOX-001', status: 'PENDING' }),
    );
    expect(manager.save).toHaveBeenCalledWith(
      OqcRequestBox,
      expect.objectContaining({ boxNo: 'BOX-001', qty: 2 }),
    );
    // 인자 company/plant가 없어도 대차 해제는 box.company/box.plant로 테넌트를 건다.
    // (인자를 그대로 넘기면 undefined가 되어 clearInTx의 where에서 테넌트 필터가 빠진다)
    expect(mockCarrierFlow.clearInTx).toHaveBeenCalledWith(mockQueryRunner, 'FG', ['FG-001', 'FG-002'], 'HANES', 'P01');
    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(mockQueryRunner.release).not.toHaveBeenCalled();
  });

  it('reopenBox clears pending OQC state and deletes auto-created request', async () => {
    mockBoxRepo.findOne
      .mockResolvedValueOnce({
        boxNo: 'BOX-001',
        itemCode: 'ITEM-001',
        status: 'CLOSED',
        qty: 2,
        serialList: JSON.stringify(['FG-001']),
        palletNo: null,
      } as BoxMaster)
      .mockResolvedValueOnce({
        boxNo: 'BOX-001',
        status: 'OPEN',
        oqcStatus: null,
      } as BoxMaster);

    const manager = {
      update: jest.fn().mockResolvedValue(undefined),
      find: jest
        .fn()
        .mockResolvedValueOnce([{ requestNo: 'OQC-20260408-001', boxNo: 'BOX-001' }] as OqcRequestBox[])
        .mockResolvedValueOnce([{ requestNo: 'OQC-20260408-001', status: 'PENDING', remark: 'AUTO_CREATED_FROM_BOX:BOX-001' }] as OqcRequest[]),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;

    const result = await target.reopenBox('BOX-001');

    expect(result.status).toBe('OPEN');
    expect(manager.delete).toHaveBeenCalledTimes(2);
    expect(manager.delete.mock.calls[0][0]).toBe(OqcRequestBox);
    expect(manager.delete.mock.calls[1][0]).toBe(OqcRequest);
    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(mockQueryRunner.release).not.toHaveBeenCalled();
  });

  it('reopenBox blocks boxes whose OQC has already been completed', async () => {
    mockBoxRepo.findOne.mockResolvedValue({
      boxNo: 'BOX-002',
      itemCode: 'ITEM-001',
      status: 'CLOSED',
      qty: 1,
      serialList: JSON.stringify(['FG-010']),
      palletNo: null,
      oqcStatus: 'PASS',
    } as BoxMaster);

    await expect(target.reopenBox('BOX-002')).rejects.toThrow(
      'OQC 단계부터 먼저 정리해 주세요.',
    );
    expect(mockTx.run).not.toHaveBeenCalled();
  });

  it('reopenBox blocks boxes that already have product inbound', async () => {
    mockBoxRepo.findOne.mockResolvedValue({
      boxNo: 'BOX-003',
      itemCode: 'ITEM-001',
      status: 'CLOSED',
      qty: 1,
      serialList: JSON.stringify(['FG-020']),
      palletNo: null,
      oqcStatus: 'PENDING',
    } as BoxMaster);
    (mockBoxRepo.manager.findOne as jest.Mock).mockResolvedValue({
      transNo: 'PTX-BOX',
      refType: 'BOX',
      refId: 'BOX-003',
      transType: 'FG_IN',
      status: 'DONE',
    } as ProductTransaction);

    await expect(target.reopenBox('BOX-003')).rejects.toThrow(
      '제품입고가 완료된 박스는 다시 열 수 없습니다',
    );
    expect(mockTx.run).not.toHaveBeenCalled();
  });

  it('assignToPallet uses TransactionService', async () => {
    mockBoxRepo.findOne
      .mockResolvedValueOnce({ boxNo: 'BOX-001', status: 'CLOSED', palletNo: null } as BoxMaster)
      .mockResolvedValueOnce({ boxNo: 'BOX-001', status: 'CLOSED', palletNo: 'P-001' } as BoxMaster);
    mockPalletRepo.findOne.mockResolvedValue({ palletNo: 'P-001', status: 'OPEN' } as PalletMaster);
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ count: '1', totalQty: '2' }),
    };
    (mockQueryRunner.manager.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    await target.assignToPallet('BOX-001', { palletId: 'P-001' } as any);

    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(mockQueryRunner.release).not.toHaveBeenCalled();
  });

  it('assignToPallet blocks non-PASS boxes when OQC is enabled', async () => {
    mockSysConfig.isEnabled.mockResolvedValue(true);
    mockBoxRepo.findOne.mockResolvedValue({
      boxNo: 'BOX-001',
      status: 'CLOSED',
      palletNo: null,
      oqcStatus: 'PENDING',
    } as BoxMaster);
    mockPalletRepo.findOne.mockResolvedValue({ palletNo: 'P-001', status: 'OPEN' } as PalletMaster);

    await expect(
      target.assignToPallet('BOX-001', { palletId: 'P-001' } as any),
    ).rejects.toThrow('OQC 합격(PASS) 박스만 팔레트에 할당할 수 있습니다');
    expect(mockTx.run).not.toHaveBeenCalled();
  });

  it('removeFromPallet uses TransactionService', async () => {
    mockBoxRepo.findOne
      .mockResolvedValueOnce({ boxNo: 'BOX-001', status: 'CLOSED', palletNo: 'P-001' } as BoxMaster)
      .mockResolvedValueOnce({ boxNo: 'BOX-001', status: 'CLOSED', palletNo: null } as BoxMaster);
    mockPalletRepo.findOne.mockResolvedValue({ palletNo: 'P-001', status: 'OPEN' } as PalletMaster);
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ count: '0', totalQty: '0' }),
    };
    (mockQueryRunner.manager.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    await target.removeFromPallet('BOX-001');

    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(mockQueryRunner.release).not.toHaveBeenCalled();
  });
});
