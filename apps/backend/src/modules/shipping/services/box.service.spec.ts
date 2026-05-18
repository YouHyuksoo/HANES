import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { BoxService } from './box.service';
import { BoxMaster } from '../../../entities/box-master.entity';
import { PalletMaster } from '../../../entities/pallet-master.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { OqcRequest } from '../../../entities/oqc-request.entity';
import { OqcRequestBox } from '../../../entities/oqc-request-box.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('BoxService', () => {
  let target: BoxService;
  let mockBoxRepo: DeepMocked<Repository<BoxMaster>>;
  let mockPalletRepo: DeepMocked<Repository<PalletMaster>>;
  let mockPartRepo: DeepMocked<Repository<PartMaster>>;
  let mockLotRepo: DeepMocked<Repository<MatLot>>;
  let mockFgLabelRepo: DeepMocked<Repository<FgLabel>>;
  let mockOqcRequestRepo: DeepMocked<Repository<OqcRequest>>;
  let mockOqcRequestBoxRepo: DeepMocked<Repository<OqcRequestBox>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockBoxRepo = createMock<Repository<BoxMaster>>();
    mockPalletRepo = createMock<Repository<PalletMaster>>();
    mockPartRepo = createMock<Repository<PartMaster>>();
    mockLotRepo = createMock<Repository<MatLot>>();
    mockFgLabelRepo = createMock<Repository<FgLabel>>();
    mockOqcRequestRepo = createMock<Repository<OqcRequest>>();
    mockOqcRequestBoxRepo = createMock<Repository<OqcRequestBox>>();
    mockDataSource = createMock<DataSource>();
    mockQueryRunner = createMock<QueryRunner>();

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
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
        { provide: getRepositoryToken(PartMaster), useValue: mockPartRepo },
        { provide: getRepositoryToken(MatLot), useValue: mockLotRepo },
        { provide: getRepositoryToken(FgLabel), useValue: mockFgLabelRepo },
        { provide: getRepositoryToken(OqcRequest), useValue: mockOqcRequestRepo },
        { provide: getRepositoryToken(OqcRequestBox), useValue: mockOqcRequestBoxRepo },
        { provide: DataSource, useValue: mockDataSource },
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

  it('addSerial rejects labels that did not pass inspection', async () => {
    mockBoxRepo.findOne.mockResolvedValue({
      boxNo: 'BOX-001',
      itemCode: 'ITEM-001',
      status: 'OPEN',
      serialList: null,
    } as BoxMaster);
    mockLotRepo.find.mockResolvedValue([]);
    mockPartRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', packUnit: '10' } as PartMaster);
    mockFgLabelRepo.find.mockResolvedValue([
      { fgBarcode: 'FG-001', itemCode: 'ITEM-001', inspectPassYn: 'N', status: 'ISSUED' } as FgLabel,
    ]);

    await expect(
      target.addSerial('BOX-001', { serials: ['FG-001'] } as any),
    ).rejects.toThrow(BadRequestException);
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
  });
});
