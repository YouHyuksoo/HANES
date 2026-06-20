import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { ProductionSpecificationService } from './production-specification.service';
import { HarnessDrawingMaster } from '../../../entities/harness-drawing-master.entity';
import { HarnessDrawingRevision } from '../../../entities/harness-drawing-revision.entity';
import { HarnessCircuitSpec } from '../../../entities/harness-circuit-spec.entity';
import { BomMaster } from '../../../entities/bom-master.entity';
import { TransactionService } from '../../../shared/transaction.service';

describe('ProductionSpecificationService', () => {
  let target: ProductionSpecificationService;
  let masterRepo: DeepMocked<Repository<HarnessDrawingMaster>>;
  let revisionRepo: DeepMocked<Repository<HarnessDrawingRevision>>;
  let circuitRepo: DeepMocked<Repository<HarnessCircuitSpec>>;
  let bomRepo: DeepMocked<Repository<BomMaster>>;
  let tx: DeepMocked<TransactionService>;
  let qr: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    masterRepo = createMock<Repository<HarnessDrawingMaster>>();
    revisionRepo = createMock<Repository<HarnessDrawingRevision>>();
    circuitRepo = createMock<Repository<HarnessCircuitSpec>>();
    bomRepo = createMock<Repository<BomMaster>>();
    tx = createMock<TransactionService>();
    qr = createMock<QueryRunner>();

    tx.run.mockImplementation(async (callback: any) => callback(qr));
    qr.manager.create.mockImplementation((_entity: unknown, data: unknown) => data as never);
    qr.manager.save.mockImplementation(async (_entity: unknown, data: unknown) => data as never);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductionSpecificationService,
        { provide: getRepositoryToken(HarnessDrawingMaster), useValue: masterRepo },
        { provide: getRepositoryToken(HarnessDrawingRevision), useValue: revisionRepo },
        { provide: getRepositoryToken(HarnessCircuitSpec), useValue: circuitRepo },
        { provide: getRepositoryToken(BomMaster), useValue: bomRepo },
        { provide: TransactionService, useValue: tx },
      ],
    }).compile();

    target = module.get(ProductionSpecificationService);
  });

  afterEach(() => jest.clearAllMocks());

  it('creates a drawing master, draft revision, and circuit rows with Oracle sequences', async () => {
    qr.manager.query
      .mockResolvedValueOnce([{ NEXT_SEQ: 101 }])
      .mockResolvedValueOnce([{ NEXT_SEQ: 201 }])
      .mockResolvedValueOnce([{ NEXT_SEQ: 301 }])
      .mockResolvedValueOnce([{ NEXT_SEQ: 302 }]);
    masterRepo.findOne.mockResolvedValue(null);
    revisionRepo.findOne.mockResolvedValue({ revisionId: 201, drawingId: 101 } as HarnessDrawingRevision);
    circuitRepo.find.mockResolvedValue([
      { circuitId: 301, circuitNo: '1' },
      { circuitId: 302, circuitNo: '2' },
    ] as HarnessCircuitSpec[]);

    const result = await target.create({
      drawingNo: 'DWG-HNS-001',
      itemCode: 'HNS02',
      itemName: 'Harness HNS02',
      erpItemNo: 'EA060946255-S-M001',
      revisionCode: 'A',
      circuits: [
        { circuitNo: '1', wireSpec: 'VSF 0.75SQ', colorCode: 'BL', lengthMm: 828, stripA: 5, stripB: 5 },
        { circuitNo: '2', wireSpec: 'VSF 0.75SQ', colorCode: 'RD', lengthMm: 830, stripA: 5, stripB: 5 },
      ],
    }, '40', '1000', 'tester');

    expect(qr.manager.query).toHaveBeenCalledWith('SELECT SEQ_HARNESS_DRAWING_ID.NEXTVAL AS "NEXT_SEQ" FROM DUAL');
    expect(qr.manager.query).toHaveBeenCalledWith('SELECT SEQ_HARNESS_DRAWING_REV_ID.NEXTVAL AS "NEXT_SEQ" FROM DUAL');
    expect(qr.manager.query).toHaveBeenCalledWith('SELECT SEQ_HARNESS_CIRCUIT_ID.NEXTVAL AS "NEXT_SEQ" FROM DUAL');
    expect(qr.manager.save).toHaveBeenCalledWith(HarnessDrawingMaster, expect.objectContaining({ drawingId: 101, drawingNo: 'DWG-HNS-001' }));
    expect(qr.manager.save).toHaveBeenCalledWith(HarnessDrawingRevision, expect.objectContaining({ revisionId: 201, revisionCode: 'A', status: 'DRAFT' }));
    expect(qr.manager.save).toHaveBeenCalledWith(HarnessCircuitSpec, expect.objectContaining({ circuitId: 301, revisionId: 201, circuitNo: '1' }));
    expect(result.revision?.circuits).toHaveLength(2);
  });

  it('blocks direct circuit updates on approved revisions', async () => {
    revisionRepo.findOne.mockResolvedValue({ revisionId: 201, drawingId: 101, status: 'APPROVED' } as HarnessDrawingRevision);

    await expect(
      target.updateRevision(201, { circuits: [{ circuitNo: '1', lengthMm: 900 }] }, '40', '1000', 'tester'),
    ).rejects.toThrow(BadRequestException);

    expect(circuitRepo.delete).not.toHaveBeenCalled();
  });

  it('rejects circuit wire item codes that are not active BOM children for the drawing item', async () => {
    revisionRepo.findOne.mockResolvedValue({ revisionId: 201, drawingId: 101, status: 'DRAFT' } as HarnessDrawingRevision);
    masterRepo.findOne.mockResolvedValue({ drawingId: 101, itemCode: 'FG01' } as HarnessDrawingMaster);
    bomRepo.find.mockResolvedValue([{ parentItemCode: 'FG01', childItemCode: 'WIRE01', useYn: 'Y' }] as BomMaster[]);

    await expect(
      target.updateRevision(201, {
        circuits: [{ circuitNo: '1', wireItemCode: 'WIRE99', lengthMm: 900, stripA: 5, stripB: 5 }],
      }, '40', '1000', 'tester'),
    ).rejects.toThrow(BadRequestException);

    expect(qr.manager.delete).not.toHaveBeenCalledWith(HarnessCircuitSpec, expect.anything());
  });

  it('creates the next draft revision and clones existing circuits', async () => {
    revisionRepo.findOne.mockResolvedValueOnce({
      revisionId: 201,
      drawingId: 101,
      revisionCode: 'A',
      status: 'APPROVED',
    } as HarnessDrawingRevision);
    circuitRepo.find.mockResolvedValueOnce([
      { circuitNo: '1', wireSpec: '1007', lengthMm: 180, sortOrder: 1 },
      { circuitNo: '2', wireSpec: '1007', lengthMm: 180, sortOrder: 2 },
    ] as HarnessCircuitSpec[]);
    qr.manager.query
      .mockResolvedValueOnce([{ NEXT_SEQ: 202 }])
      .mockResolvedValueOnce([{ NEXT_SEQ: 303 }])
      .mockResolvedValueOnce([{ NEXT_SEQ: 304 }]);
    revisionRepo.findOne.mockResolvedValueOnce({ revisionId: 202, drawingId: 101 } as HarnessDrawingRevision);
    circuitRepo.find.mockResolvedValueOnce([
      { circuitId: 303, revisionId: 202, circuitNo: '1' },
      { circuitId: 304, revisionId: 202, circuitNo: '2' },
    ] as HarnessCircuitSpec[]);

    const result = await target.revise(201, { changeReason: 'terminal change' }, '40', '1000', 'tester');

    expect(qr.manager.save).toHaveBeenCalledWith(HarnessDrawingRevision, expect.objectContaining({
      revisionId: 202,
      drawingId: 101,
      revisionCode: 'B',
      status: 'DRAFT',
      changeReason: 'terminal change',
    }));
    expect(qr.manager.save).toHaveBeenCalledWith(HarnessCircuitSpec, expect.objectContaining({ circuitId: 303, revisionId: 202, circuitNo: '1' }));
    expect(result.revision?.circuits).toHaveLength(2);
  });

  it('throws when revising a missing revision', async () => {
    revisionRepo.findOne.mockResolvedValue(null);

    await expect(target.revise(999, {}, '40', '1000', 'tester')).rejects.toThrow(NotFoundException);
  });
});
