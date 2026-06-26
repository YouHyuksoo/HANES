import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, IsNull, QueryRunner, Repository } from 'typeorm';
import { ContinuityInspectService } from './continuity-inspect.service';
import { InspectResult } from '../../../../entities/inspect-result.entity';
import { FgLabel } from '../../../../entities/fg-label.entity';
import { JobOrder } from '../../../../entities/job-order.entity';
import { EquipProtocol } from '../../../../entities/equip-protocol.entity';
import { ProdResult } from '../../../../entities/prod-result.entity';
import { SeqGeneratorService } from '../../../../shared/seq-generator.service';
import { SysConfigService } from '../../../system/services/sys-config.service';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../../shared/transaction.service';

describe('ContinuityInspectService', () => {
  let target: ContinuityInspectService;
  let mockInspectRepo: DeepMocked<Repository<InspectResult>>;
  let mockFgLabelRepo: DeepMocked<Repository<FgLabel>>;
  let mockJobOrderRepo: DeepMocked<Repository<JobOrder>>;
  let mockProtocolRepo: DeepMocked<Repository<EquipProtocol>>;
  let mockProdResultRepo: DeepMocked<Repository<ProdResult>>;
  let mockSeqGen: DeepMocked<SeqGeneratorService>;
  let mockSysConfigService: DeepMocked<SysConfigService>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockTx: DeepMocked<TransactionService>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockInspectRepo = createMock<Repository<InspectResult>>();
    mockFgLabelRepo = createMock<Repository<FgLabel>>();
    mockJobOrderRepo = createMock<Repository<JobOrder>>();
    mockProtocolRepo = createMock<Repository<EquipProtocol>>();
    mockProdResultRepo = createMock<Repository<ProdResult>>();
    mockSeqGen = createMock<SeqGeneratorService>();
    mockSysConfigService = createMock<SysConfigService>();
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
        ContinuityInspectService,
        { provide: getRepositoryToken(InspectResult), useValue: mockInspectRepo },
        { provide: getRepositoryToken(FgLabel), useValue: mockFgLabelRepo },
        { provide: getRepositoryToken(JobOrder), useValue: mockJobOrderRepo },
        { provide: getRepositoryToken(EquipProtocol), useValue: mockProtocolRepo },
        { provide: getRepositoryToken(ProdResult), useValue: mockProdResultRepo },
        { provide: SeqGeneratorService, useValue: mockSeqGen },
        { provide: SysConfigService, useValue: mockSysConfigService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get(ContinuityInspectService);
  });

  afterEach(() => jest.clearAllMocks());

  it('findFgLabel returns the label', async () => {
    mockFgLabelRepo.findOne.mockResolvedValue({ fgBarcode: 'FG001' } as FgLabel);

    await expect(target.findFgLabel('FG001', 'C1', 'P1')).resolves.toMatchObject({ fgBarcode: 'FG001' });
    expect(mockFgLabelRepo.findOne).toHaveBeenCalledWith({
      where: expect.objectContaining({ fgBarcode: 'FG001', company: 'C1', plant: 'P1' }),
    });
  });

  it('findFgLabel throws when missing', async () => {
    mockFgLabelRepo.findOne.mockResolvedValue(null);

    await expect(target.findFgLabel('FG001')).rejects.toThrow(NotFoundException);
  });

  it('inspect links the matching prod result and updates the scanned ISSUED label on PASS', async () => {
    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ orderNo: 'JO-001', company: 'C1', plant: 'P1' } as JobOrder)
        .mockResolvedValueOnce({ fgBarcode: 'FG-1', status: 'ISSUED', company: 'C1', plant: 'P1' } as FgLabel),
      create: jest.fn((entity, payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (_entity, payload) => payload ?? _entity),
      increment: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      count: jest.fn().mockResolvedValue(0),
    };
    (mockQueryRunner as any).manager = manager;

    mockProdResultRepo.findOne.mockResolvedValue({ resultNo: 'PR-001', orderNo: 'JO-001', prdUid: null } as ProdResult);
    mockSeqGen.getNo.mockResolvedValue('IR-001');

    const result = await target.inspect({
      orderNo: 'JO-001',
      prodResultNo: 'PR-001',
      itemCode: 'ITEM-001',
      passYn: 'Y',
      workerId: 'U1',
      fgBarcode: 'FG-1',
      circuitLabel: 'CL-1',
    } as any, 'C1', 'P1');

    expect(result.inspectResult.prodResultNo).toBe('PR-001');
    expect(result.fgBarcode).toBe('FG-1');
    expect(manager.findOne).toHaveBeenCalledWith(
      JobOrder,
      expect.objectContaining({ where: expect.objectContaining({ orderNo: 'JO-001', company: 'C1', plant: 'P1' }) }),
    );
    // 조립 발행된 ISSUED 라벨을 스캔해 판정만 갱신한다. 신규 채번 없음.
    expect(mockSeqGen.nextFgBarcode).not.toHaveBeenCalled();
    expect(manager.create).toHaveBeenCalledWith(
      InspectResult,
      expect.objectContaining({ prodResultNo: 'PR-001' }),
    );
    // 실적↔FG바코드 링크는 InspectResult.prodResultNo 로 추적한다.
    // (prod-result.prdUid 는 실적 자신의 시리얼로 유지하며 fgBarcode 로 덮어쓰지 않는다.)
    expect(manager.update).not.toHaveBeenCalledWith(
      ProdResult,
      { resultNo: 'PR-001' },
      expect.objectContaining({ prdUid: expect.anything() }),
    );
    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(mockQueryRunner.release).not.toHaveBeenCalled();
  });

  it('inspect stores the requested inspect type for terminal inspection', async () => {
    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ orderNo: 'JO-001', company: 'C1', plant: 'P1' } as JobOrder)
        .mockResolvedValueOnce({ fgBarcode: 'FG-1', status: 'ISSUED', company: 'C1', plant: 'P1' } as FgLabel),
      create: jest.fn((entity, payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (_entity, payload) => payload ?? _entity),
      increment: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      count: jest.fn().mockResolvedValue(0),
    };
    (mockQueryRunner as any).manager = manager;

    mockProdResultRepo.find.mockResolvedValue([]);
    mockSeqGen.getNo.mockResolvedValue('IR-001');

    const result = await target.inspect({
      orderNo: 'JO-001',
      itemCode: 'ITEM-001',
      passYn: 'Y',
      inspectType: 'TERMINAL',
      fgBarcode: 'FG-1',
      circuitLabel: 'CL-1',
    } as any, 'C1', 'P1');

    expect(result.inspectResult.inspectType).toBe('TERMINAL');
    expect(manager.create).toHaveBeenCalledWith(
      InspectResult,
      expect.objectContaining({ inspectType: 'TERMINAL' }),
    );
  });

  it('inspect blocks when request tenant differs from loaded job order tenant', async () => {
    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ orderNo: 'JO-001', company: 'OTHER', plant: 'P1' } as JobOrder),
      create: jest.fn((entity, payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (_entity, payload) => payload ?? _entity),
      increment: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;

    await expect(target.inspect({
      orderNo: 'JO-001',
      itemCode: 'ITEM-001',
      passYn: 'Y',
    } as any, 'C1', 'P1')).rejects.toThrow(BadRequestException);
    expect(manager.create).not.toHaveBeenCalled();
    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('getPendingLabels returns ISSUED + uninspected labels within tenant scope', async () => {
    mockFgLabelRepo.find.mockResolvedValue([] as FgLabel[]);

    await target.getPendingLabels('JO-001', 'C1', 'P1');

    expect(mockFgLabelRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orderNo: 'JO-001',
          status: 'ISSUED',
          inspectPassYn: IsNull(),
          company: 'C1',
          plant: 'P1',
        }),
      }),
    );
  });

  it('reInspect keeps the original prod result linkage and restores ISSUED on pass', async () => {
    mockFgLabelRepo.findOne.mockResolvedValue({
      fgBarcode: 'FG-001',
      orderNo: 'JO-001',
      inspectPassYn: 'N',
      inspectResultId: 'IR-OLD',
      status: 'VISUAL_FAIL',
      company: 'HANES',
      plant: 'P01',
    } as FgLabel);

    const manager = {
      findOne: jest.fn().mockResolvedValue({ resultNo: 'IR-OLD', prodResultNo: 'PR-001' } as InspectResult),
      create: jest.fn((entity, payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (_entity, payload) => payload ?? _entity),
    };
    (mockQueryRunner as any).manager = manager;
    mockSeqGen.getNo.mockResolvedValue('IR-NEW');

    const result = await target.reInspect('FG-001', {
      passYn: 'Y',
      remark: 'recheck ok',
    });

    expect(result.inspectResult.prodResultNo).toBe('PR-001');
    expect(result.fgLabel.status).toBe('ISSUED');
    expect(result.fgLabel.inspectPassYn).toBe('Y');
    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(mockQueryRunner.release).not.toHaveBeenCalled();
  });

  it('reInspect blocks when request tenant differs from label tenant', async () => {
    mockFgLabelRepo.findOne.mockResolvedValue({
      fgBarcode: 'FG-001',
      inspectPassYn: 'N',
      status: 'VISUAL_FAIL',
      company: 'OTHER',
      plant: 'P1',
    } as FgLabel);

    await expect(target.reInspect('FG-001', { passYn: 'Y' }, 'C1', 'P1')).rejects.toThrow(BadRequestException);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(mockTx.run).not.toHaveBeenCalled();
  });

  it('createProtocol rejects body tenant that differs from request tenant', async () => {
    await expect(
      target.createProtocol({ equipCode: 'EQ-001', company: 'OTHER', plant: 'P1' } as any, 'C1', 'P1'),
    ).rejects.toThrow(BadRequestException);

    expect(mockProtocolRepo.create).not.toHaveBeenCalled();
    expect(mockProtocolRepo.save).not.toHaveBeenCalled();
  });

  it('voidLabel blocks labels that already progressed downstream', async () => {
    mockFgLabelRepo.findOne.mockResolvedValue({
      fgBarcode: 'FG-999',
      status: 'PACKED',
    } as FgLabel);

    await expect(target.voidLabel('FG-999', 'mistake')).rejects.toThrow(BadRequestException);
  });

  it('inspect requires a circuit label on PASS', async () => {
    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ orderNo: 'JO-001', company: 'C1', plant: 'P1' } as JobOrder),
      create: jest.fn((entity, payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (_entity, payload) => payload ?? _entity),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;

    await expect(
      target.inspect(
        { orderNo: 'JO-001', itemCode: 'ITEM-001', passYn: 'Y', fgBarcode: 'FG-1' } as any,
        'C1',
        'P1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(manager.create).not.toHaveBeenCalled();
  });

  it('inspect blocks a duplicate circuit label on PASS', async () => {
    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ orderNo: 'JO-001', company: 'C1', plant: 'P1' } as JobOrder),
      create: jest.fn((entity, payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (_entity, payload) => payload ?? _entity),
      count: jest.fn().mockResolvedValue(1),
      update: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;

    await expect(
      target.inspect(
        { orderNo: 'JO-001', itemCode: 'ITEM-001', passYn: 'Y', fgBarcode: 'FG-1', circuitLabel: 'CL-DUP' } as any,
        'C1',
        'P1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(manager.count).toHaveBeenCalledWith(
      InspectResult,
      expect.objectContaining({ where: expect.objectContaining({ circuitLabel: 'CL-DUP', company: 'C1', plant: 'P1' }) }),
    );
    expect(manager.create).not.toHaveBeenCalled();
  });

  it('inspect stores the circuit label and updates the scanned ISSUED label on PASS', async () => {
    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ orderNo: 'JO-001', company: 'C1', plant: 'P1' } as JobOrder)
        .mockResolvedValueOnce({ fgBarcode: 'FG-1', status: 'ISSUED', company: 'C1', plant: 'P1' } as FgLabel),
      create: jest.fn((entity, payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (_entity, payload) => payload ?? _entity),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;
    mockProdResultRepo.findOne.mockResolvedValue(null);
    mockProdResultRepo.find.mockResolvedValue([]);
    mockSeqGen.getNo.mockResolvedValue('IR-001');

    const result = await target.inspect(
      { orderNo: 'JO-001', itemCode: 'ITEM-001', passYn: 'Y', fgBarcode: 'FG-1', circuitLabel: 'CL-1' } as any,
      'C1',
      'P1',
    );

    expect(result.fgBarcode).toBe('FG-1');
    expect(manager.create).toHaveBeenCalledWith(
      InspectResult,
      expect.objectContaining({ circuitLabel: 'CL-1' }),
    );
  });

  it('findFgLabelsByOrder maps circuit labels from inspect results', async () => {
    const qb = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { fgBarcode: 'FG-1', inspectResultId: 'IR-1' },
        { fgBarcode: 'FG-2', inspectResultId: null },
      ]),
    };
    mockFgLabelRepo.createQueryBuilder.mockReturnValue(qb as any);
    mockInspectRepo.find.mockResolvedValue([
      { resultNo: 'IR-1', circuitLabel: 'CL-1' },
    ] as InspectResult[]);

    const rows = await target.findFgLabelsByOrder('JO-1', 'C1', 'P1');

    expect(rows).toEqual([
      expect.objectContaining({ fgBarcode: 'FG-1', circuitLabel: 'CL-1' }),
      expect.objectContaining({ fgBarcode: 'FG-2', circuitLabel: null }),
    ]);
  });

  it('getStats excludes canceled prod results from continuity totals', async () => {
    const labelsQb = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(4),
    };
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ passed: '2', failed: '1' }),
    };

    mockFgLabelRepo.createQueryBuilder.mockReturnValue(labelsQb as any);
    mockJobOrderRepo.findOne.mockResolvedValue({ orderNo: 'JO-001', planQty: 10 } as JobOrder);
    mockInspectRepo.createQueryBuilder.mockReturnValue(qb as any);

    const result = await target.getStats('JO-001');

    expect(result).toMatchObject({
      orderNo: 'JO-001',
      total: 3,
      passed: 2,
      failed: 1,
      labelCount: 4,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('pr.status != :canceled', { canceled: 'CANCELED' });
  });
});
