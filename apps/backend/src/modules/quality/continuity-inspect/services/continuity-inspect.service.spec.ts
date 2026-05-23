import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { ContinuityInspectService } from './continuity-inspect.service';
import { InspectResult } from '../../../../entities/inspect-result.entity';
import { FgLabel } from '../../../../entities/fg-label.entity';
import { JobOrder } from '../../../../entities/job-order.entity';
import { EquipProtocol } from '../../../../entities/equip-protocol.entity';
import { ProdResult } from '../../../../entities/prod-result.entity';
import { SeqGeneratorService } from '../../../../shared/seq-generator.service';
import { SysConfigService } from '../../../system/services/sys-config.service';
import { MockLoggerService } from '../../../../common/test/mock-logger.service';

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
    mockQueryRunner = createMock<QueryRunner>();

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
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

  it('inspect links the matching prod result in ON_INSPECT mode', async () => {
    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ orderNo: 'JO-001', company: 'C1', plant: 'P1' } as JobOrder),
      create: jest.fn((entity, payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (_entity, payload) => payload ?? _entity),
      increment: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };
    (mockQueryRunner as any).manager = manager;

    mockSysConfigService.getValue.mockResolvedValue('ON_INSPECT');
    mockProdResultRepo.findOne.mockResolvedValue({ resultNo: 'PR-001', orderNo: 'JO-001', prdUid: null } as ProdResult);
    mockSeqGen.getNo.mockResolvedValue('IR-001');
    mockSeqGen.nextFgBarcode.mockResolvedValue('FG-001');

    const result = await target.inspect({
      orderNo: 'JO-001',
      prodResultNo: 'PR-001',
      itemCode: 'ITEM-001',
      passYn: 'Y',
      workerId: 'U1',
    } as any, 'C1', 'P1');

    expect(result.inspectResult.prodResultNo).toBe('PR-001');
    expect(manager.findOne).toHaveBeenCalledWith(
      JobOrder,
      expect.objectContaining({ where: expect.objectContaining({ orderNo: 'JO-001', company: 'C1', plant: 'P1' }) }),
    );
    expect(manager.update).toHaveBeenCalledWith(
      ProdResult,
      { resultNo: 'PR-001' },
      { prdUid: 'FG-001' },
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

    mockSysConfigService.getValue.mockResolvedValue('ON_INSPECT');

    await expect(target.inspect({
      orderNo: 'JO-001',
      itemCode: 'ITEM-001',
      passYn: 'Y',
    } as any, 'C1', 'P1')).rejects.toThrow(BadRequestException);
    expect(manager.create).not.toHaveBeenCalled();
  });

  it('getPendingLabels applies tenant scope', async () => {
    mockFgLabelRepo.find.mockResolvedValue([] as FgLabel[]);

    await target.getPendingLabels('JO-001', 'C1', 'P1');

    expect(mockFgLabelRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orderNo: 'JO-001', status: 'PENDING', company: 'C1', plant: 'P1' }),
      }),
    );
  });

  it('preIssue blocks when request tenant differs from loaded job order tenant', async () => {
    mockJobOrderRepo.findOne.mockResolvedValue({
      orderNo: 'JO-001',
      itemCode: 'ITEM-001',
      planQty: 10,
      company: 'OTHER',
      plant: 'P1',
    } as JobOrder);

    await expect(target.preIssue({ orderNo: 'JO-001', qty: 1 } as any, 'C1', 'P1')).rejects.toThrow(BadRequestException);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
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
  });

  it('voidLabel blocks labels that already progressed downstream', async () => {
    mockFgLabelRepo.findOne.mockResolvedValue({
      fgBarcode: 'FG-999',
      status: 'PACKED',
    } as FgLabel);

    await expect(target.voidLabel('FG-999', 'mistake')).rejects.toThrow(BadRequestException);
  });

  it('getStats excludes canceled prod results from continuity totals', async () => {
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ passed: '2', failed: '1' }),
    };

    mockFgLabelRepo.count.mockResolvedValue(4);
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
