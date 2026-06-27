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

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockTx.run.mockImplementation(async (callback) => callback(mockQueryRunner));
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

  it('closeBox stamps FG_LABELS with boxNo so box stock can find packed serials', async () => {
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
  });

  it('addSerial validates lots, part and fg labels within tenant only', async () => {
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
