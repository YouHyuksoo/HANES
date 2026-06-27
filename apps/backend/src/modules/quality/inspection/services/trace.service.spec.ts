import { TraceService } from './trace.service';

describe('TraceService', () => {
  const queryBuilder = () => {
    const qb: any = {
      where: jest.fn(() => qb),
      andWhere: jest.fn(() => qb),
      innerJoin: jest.fn(() => qb),
      orderBy: jest.fn(() => qb),
      addOrderBy: jest.fn(() => qb),
      getMany: jest.fn().mockResolvedValue([]),
    };
    return qb;
  };

  const createService = () => {
    const traceLogQb = queryBuilder();
    const equipQb = queryBuilder();
    const workerQb = queryBuilder();
    const processQb = queryBuilder();
    const controlPlanQb = queryBuilder();
    const fgLabelRepo = { findOne: jest.fn() };
    const prodResultRepo = { find: jest.fn() };
    const jobOrderRepo = { findOne: jest.fn() };
    const inspectResultRepo = { find: jest.fn().mockResolvedValue([]) };
    const matIssueRepo = { find: jest.fn() };
    const traceLogRepo = { createQueryBuilder: jest.fn(() => traceLogQb) };
    const itemMasterRepo = { findOne: jest.fn(), find: jest.fn() };
    const equipMasterRepo = { createQueryBuilder: jest.fn(() => equipQb) };
    const workerMasterRepo = { createQueryBuilder: jest.fn(() => workerQb) };
    const processMasterRepo = { createQueryBuilder: jest.fn(() => processQb) };
    const matLotRepo = { find: jest.fn() };
    const controlPlanItemRepo = { createQueryBuilder: jest.fn(() => controlPlanQb) };
    const partnerMasterRepo = { find: jest.fn().mockResolvedValue([]) };
    const boxMasterRepo = { find: jest.fn(), findOne: jest.fn() };
    const palletMasterRepo = { find: jest.fn(), findOne: jest.fn() };

    const service = new TraceService(
      fgLabelRepo as any,
      prodResultRepo as any,
      jobOrderRepo as any,
      inspectResultRepo as any,
      matIssueRepo as any,
      traceLogRepo as any,
      itemMasterRepo as any,
      equipMasterRepo as any,
      workerMasterRepo as any,
      processMasterRepo as any,
      matLotRepo as any,
      controlPlanItemRepo as any,
      partnerMasterRepo as any,
      boxMasterRepo as any,
      palletMasterRepo as any,
    );

    return {
      service,
      fgLabelRepo,
      prodResultRepo,
      jobOrderRepo,
      itemMasterRepo,
      inspectResultRepo,
      matIssueRepo,
      matLotRepo,
      equipQb,
      workerQb,
      processQb,
      controlPlanQb,
    };
  };

  it('scopes material lot and material part lookup to the same tenant as trace lookup', async () => {
    const {
      service,
      fgLabelRepo,
      prodResultRepo,
      jobOrderRepo,
      itemMasterRepo,
      inspectResultRepo,
      matIssueRepo,
      matLotRepo,
    } = createService();

    fgLabelRepo.findOne.mockResolvedValue({
      fgBarcode: 'FG-001',
      orderNo: 'JO-001',
      itemCode: null,
      issuedAt: new Date('2026-01-01T00:00:00Z'),
    });
    prodResultRepo.find.mockResolvedValue([]);
    jobOrderRepo.findOne.mockResolvedValue(null);
    itemMasterRepo.findOne.mockResolvedValue(null);
    matIssueRepo.find.mockResolvedValue([
      { orderNo: 'JO-001', matUid: 'MAT-001', issueQty: 2, issueDate: new Date('2026-01-01T01:00:00Z') },
    ]);
    matLotRepo.find.mockResolvedValue([
      { matUid: 'MAT-001', itemCode: 'RM-001', vendor: 'V001' },
    ]);
    itemMasterRepo.find.mockResolvedValue([
      { itemCode: 'RM-001', itemName: 'Raw Material', unit: 'EA' },
    ]);

    await service.findBySerial('FG-001', 'C1', 'P1');

    expect(matLotRepo.find).toHaveBeenCalledWith({
      where: { matUid: expect.anything(), company: 'C1', plant: 'P1' },
    });
    expect(itemMasterRepo.find).toHaveBeenCalledWith({
      where: { itemCode: expect.anything(), company: 'C1', plant: 'P1' },
    });
  });

  it('scopes process, equipment, and worker master cache lookups to the same tenant', async () => {
    const {
      service,
      fgLabelRepo,
      prodResultRepo,
      jobOrderRepo,
      itemMasterRepo,
      inspectResultRepo,
      matIssueRepo,
      equipQb,
      workerQb,
      processQb,
    } = createService();

    fgLabelRepo.findOne.mockResolvedValue({
      fgBarcode: 'FG-001',
      orderNo: 'JO-001',
      itemCode: null,
      equipCode: 'EQ-001',
      workerId: 'WK-001',
      issuedAt: new Date('2026-01-01T00:00:00Z'),
    });
    prodResultRepo.find.mockResolvedValue([
      {
        resultNo: 'PR-001',
        processCode: 'P-001',
        equipCode: 'EQ-001',
        workerId: 'WK-001',
        startAt: new Date('2026-01-01T01:00:00Z'),
      },
    ]);
    jobOrderRepo.findOne.mockResolvedValue(null);
    itemMasterRepo.findOne.mockResolvedValue(null);
    matIssueRepo.find.mockResolvedValue([]);
    inspectResultRepo.find.mockResolvedValue([]);

    await service.findBySerial('FG-001', 'C1', 'P1');

    expect(processQb.andWhere).toHaveBeenCalledWith('pm.company = :company', { company: 'C1' });
    expect(processQb.andWhere).toHaveBeenCalledWith('pm.plant = :plant', { plant: 'P1' });
    expect(equipQb.andWhere).toHaveBeenCalledWith('em.company = :company', { company: 'C1' });
    expect(equipQb.andWhere).toHaveBeenCalledWith('em.plant = :plant', { plant: 'P1' });
    expect(workerQb.andWhere).toHaveBeenCalledWith('wm.company = :company', { company: 'C1' });
    expect(workerQb.andWhere).toHaveBeenCalledWith('wm.plant = :plant', { plant: 'P1' });
  });

  it('joins control plan items to control plans by tenant-scoped plan key', async () => {
    const {
      service,
      fgLabelRepo,
      prodResultRepo,
      jobOrderRepo,
      itemMasterRepo,
      inspectResultRepo,
      matIssueRepo,
      controlPlanQb,
    } = createService();

    fgLabelRepo.findOne.mockResolvedValue({
      fgBarcode: 'FG-001',
      orderNo: 'JO-001',
      itemCode: 'FG-001',
      issuedAt: new Date('2026-01-01T00:00:00Z'),
    });
    prodResultRepo.find.mockResolvedValue([]);
    jobOrderRepo.findOne.mockResolvedValue(null);
    itemMasterRepo.findOne.mockResolvedValue(null);
    matIssueRepo.find.mockResolvedValue([]);
    inspectResultRepo.find.mockResolvedValue([]);

    await service.findBySerial('FG-001', 'C1', 'P1');

    expect(controlPlanQb.innerJoin).toHaveBeenCalledWith(
      expect.anything(),
      'cp',
      'cp.planNo = cpi.controlPlanId AND cp.company = cpi.company AND cp.plant = cpi.plant',
    );
  });
});
