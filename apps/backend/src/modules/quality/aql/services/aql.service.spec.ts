import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AqlService } from './aql.service';

function createRepoMock() {
  return {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

describe('AqlService', () => {
  let standardRepo: ReturnType<typeof createRepoMock>;
  let ruleRepo: ReturnType<typeof createRepoMock>;
  let sampleRepo: ReturnType<typeof createRepoMock>;
  let acceptanceRepo: ReturnType<typeof createRepoMock>;
  let policyRepo: ReturnType<typeof createRepoMock>;
  let partRepo: ReturnType<typeof createRepoMock>;
  let partnerRepo: ReturnType<typeof createRepoMock>;
  let iqcLogRepo: ReturnType<typeof createRepoMock>;
  let modeHistoryRepo: ReturnType<typeof createRepoMock>;
  let defectCodeRepo: ReturnType<typeof createRepoMock>;
  let specItemRepo: ReturnType<typeof createRepoMock>;
  let service: AqlService;

  beforeEach(() => {
    standardRepo = createRepoMock();
    ruleRepo = createRepoMock();
    sampleRepo = createRepoMock();
    acceptanceRepo = createRepoMock();
    policyRepo = createRepoMock();
    partRepo = createRepoMock();
    partnerRepo = createRepoMock();
    iqcLogRepo = createRepoMock();
    modeHistoryRepo = createRepoMock();
    defectCodeRepo = createRepoMock();
    specItemRepo = createRepoMock();
    ruleRepo.find.mockResolvedValue([{ lotQtyFrom: 501, lotQtyTo: 1200, codeLetter: 'J' }]);
    sampleRepo.findOne.mockImplementation(async ({ where }) => {
      const sampleByLetter: Record<string, number> = {
        A: 2, B: 3, C: 5, D: 8, E: 13, F: 20, G: 32, H: 50,
        J: 80, K: 125, L: 200, M: 315, N: 500, P: 800, Q: 1250, R: 2000,
      };
      return { codeLetter: where.codeLetter, sampleSize: sampleByLetter[where.codeLetter] ?? 80 };
    });
    acceptanceRepo.findOne.mockImplementation(async ({ where }) => {
      const aqlValue = Number(where.aqlValue);
      const codeLetter = String(where.codeLetter ?? 'J');
      const key = `${codeLetter}:${aqlValue}`;
      const values: Record<string, [number, number, string]> = {
        'H:1': [1, 2, 'H'],
        'J:1': [2, 3, 'J'],
        'J:2.5': [5, 6, 'J'],
        'J:4': [7, 8, 'J'],
        'F:1': [0, 1, 'F'],
        'F:2.5': [1, 2, 'F'],
        'A:0.015': [0, 1, 'J'],
      };
      const [acceptQty, rejectQty, sampleCodeLetter] = values[key] ?? [0, 1, codeLetter];
      return { codeLetter, aqlValue, sampleCodeLetter, acceptQty, rejectQty };
    });
    service = new AqlService(
      standardRepo as any,
      ruleRepo as any,
      sampleRepo as any,
      acceptanceRepo as any,
      policyRepo as any,
      partRepo as any,
      partnerRepo as any,
      iqcLogRepo as any,
      modeHistoryRepo as any,
      defectCodeRepo as any,
      specItemRepo as any,
    );
  });

  it('rejects overlapping lot quantity ranges for one AQL code', async () => {
    standardRepo.findOne.mockResolvedValue(null);

    await expect(service.create({
      aqlCode: 'AQL-1.0',
      aqlName: 'AQL 1.0',
      inspectionLevel: 'II',
      aqlValue: 1,
      useYn: 'Y',
      rules: [
        { lotQtyFrom: 1, lotQtyTo: 50, sampleSize: 5, acceptQty: 0, rejectQty: 1 },
        { lotQtyFrom: 40, lotQtyTo: 100, sampleSize: 8, acceptQty: 1, rejectQty: 2 },
      ],
    }, '40', '1000', 'tester')).rejects.toThrow(BadRequestException);
  });

  it('allows ISO sampling plans whose standard sample size is greater than the LOT upper bound', async () => {
    standardRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ company: '40', plant: '1000', aqlCode: 'AQL-S-1-0.015' });
    ruleRepo.find.mockResolvedValue([{ lotQtyFrom: 2, lotQtyTo: 8, sampleSize: 80, acceptQty: 0, rejectQty: 1 }]);

    await expect(service.create({
      aqlCode: 'AQL-S-1-0.015',
      aqlName: 'AQL S-1 0.015',
      inspectionLevel: 'S-1',
      aqlValue: 0.015,
      useYn: 'Y',
      rules: [
        { lotQtyFrom: 2, lotQtyTo: 8, sampleSize: 80, acceptQty: 0, rejectQty: 1 },
      ],
    }, '40', '1000', 'tester')).resolves.toEqual(
      expect.objectContaining({ aqlCode: 'AQL-S-1-0.015' }),
    );
  });

  it('resolves a lot quantity to the matching rule', async () => {
    standardRepo.findOne.mockResolvedValue({
      company: '40',
      plant: '1000',
      aqlCode: 'AQL-1.0',
      aqlName: 'AQL 1.0',
      useYn: 'Y',
    });
    ruleRepo.find.mockResolvedValue([
      { lotQtyFrom: 1, lotQtyTo: 20, sampleSize: 3, acceptQty: 0, rejectQty: 1 },
      { lotQtyFrom: 21, lotQtyTo: 50, sampleSize: 5, acceptQty: 1, rejectQty: 2 },
    ]);

    await expect(service.resolveByAqlCode('AQL-1.0', 25, '40', '1000')).resolves.toEqual(
      expect.objectContaining({
        aqlCode: 'AQL-1.0',
        lotQty: 25,
        codeLetter: 'C',
        sampleSize: 5,
        acceptQty: 0,
        rejectQty: 1,
      }),
    );
  });

  it('resolves standard sample size and actual inspection quantity separately', async () => {
    standardRepo.findOne.mockResolvedValue({
      company: '40',
      plant: '1000',
      aqlCode: 'AQL-S-1-0.015',
      aqlName: 'AQL S-1 0.015',
      useYn: 'Y',
    });
    ruleRepo.find.mockResolvedValue([
      { lotQtyFrom: 2, lotQtyTo: 8, codeLetter: 'A', sampleSize: 80, acceptQty: 0, rejectQty: 1 },
    ]);

    await expect(service.resolveByAqlCode('AQL-S-1-0.015', 3, '40', '1000')).resolves.toEqual(
      expect.objectContaining({
        lotQty: 3,
        codeLetter: 'A',
        standardSampleSize: 80,
        actualInspectQty: 3,
        sampleSize: 80,
        acceptQty: 0,
        rejectQty: 1,
      }),
    );
  });

  it('rejects inactive AQL standards when resolving', async () => {
    standardRepo.findOne.mockResolvedValue({ aqlCode: 'AQL-1.0', useYn: 'N' });

    await expect(service.resolveByAqlCode('AQL-1.0', 25, '40', '1000')).rejects.toThrow(BadRequestException);
  });

  it('throws when no sampling rule matches the lot quantity', async () => {
    standardRepo.findOne.mockResolvedValue({ aqlCode: 'AQL-1.0', useYn: 'Y' });
    ruleRepo.find.mockResolvedValue([{ lotQtyFrom: 1, lotQtyTo: 20, sampleSize: 3, acceptQty: 0, rejectQty: 1 }]);

    await expect(service.resolveByAqlCode('AQL-1.0', 25, '40', '1000')).rejects.toThrow(NotFoundException);
  });

  it('creates an IQC AQL policy from active major/minor AQL standards', async () => {
    policyRepo.findOne.mockResolvedValue(null);
    standardRepo.find.mockResolvedValue([
      { company: '40', plant: '1000', aqlCode: 'AQL-II-1.0', useYn: 'Y' },
      { company: '40', plant: '1000', aqlCode: 'AQL-II-2.5', useYn: 'Y' },
    ]);

    const result = await service.createPolicy({
      policyCode: 'AQLP-II-1.0-2.5',
      policyName: 'II Major 1.0 Minor 2.5',
      inspectionLevel: 'II',
      majorAqlCode: 'AQL-II-1.0',
      minorAqlCode: 'AQL-II-2.5',
      useYn: 'Y',
    }, '40', '1000', 'tester');

    expect(policyRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      policyCode: 'AQLP-II-1.0-2.5',
      majorAqlCode: 'AQL-II-1.0',
      minorAqlCode: 'AQL-II-2.5',
      criticalMode: 'IMMEDIATE_FAIL',
    }));
    expect(result).toEqual(expect.objectContaining({ policyCode: 'AQLP-II-1.0-2.5' }));
  });

  it('blocks disabling an IQC AQL policy that is assigned to item masters', async () => {
    policyRepo.findOne.mockResolvedValue({ company: '40', plant: '1000', policyCode: 'AQLP-II-1.0-2.5', useYn: 'Y' });
    partRepo.count.mockResolvedValue(1);

    await expect(service.deletePolicy('AQLP-II-1.0-2.5', '40', '1000', 'tester')).rejects.toThrow(BadRequestException);
  });

  it('blocks disabling an AQL standard referenced by active IQC AQL policies', async () => {
    standardRepo.findOne.mockResolvedValue({ company: '40', plant: '1000', aqlCode: 'AQL-II-1.0', useYn: 'Y' });
    policyRepo.count.mockResolvedValue(1);

    await expect(service.delete('AQL-II-1.0', '40', '1000', 'tester')).rejects.toThrow(BadRequestException);
    expect(standardRepo.save).not.toHaveBeenCalled();
  });

  it('resolves item AQL policy and fails immediately on critical defects', async () => {
    partRepo.findOne.mockResolvedValue({
      itemCode: 'PCB',
      iqcAqlPolicyCode: 'AQLP-II-1.0-2.5',
    });
    policyRepo.findOne.mockResolvedValue({
      policyCode: 'AQLP-II-1.0-2.5',
      inspectionLevel: 'II',
      majorAqlCode: 'AQL-II-1.0',
      minorAqlCode: 'AQL-II-2.5',
      criticalMode: 'IMMEDIATE_FAIL',
      useYn: 'Y',
    });
    partnerRepo.findOne.mockResolvedValue({ partnerCode: 'SUP-A', inspectionMode: 'NORMAL' });
    standardRepo.findOne
      .mockResolvedValueOnce({ company: '40', plant: '1000', aqlCode: 'AQL-II-1.0', useYn: 'Y' })
      .mockResolvedValueOnce({ company: '40', plant: '1000', aqlCode: 'AQL-II-2.5', useYn: 'Y' });
    ruleRepo.find
      .mockResolvedValueOnce([{ lotQtyFrom: 501, lotQtyTo: 1200, sampleSize: 80, acceptQty: 2, rejectQty: 3 }])
      .mockResolvedValueOnce([{ lotQtyFrom: 501, lotQtyTo: 1200, sampleSize: 80, acceptQty: 5, rejectQty: 6 }]);

    const result = await service.resolveIqcPolicy({
      itemCode: 'PCB',
      vendorCode: 'SUP-A',
      lotQty: 1000,
      defectCounts: { critical: 1, major: 0, minor: 0 },
      company: '40',
      plant: '1000',
    });

    expect(result.result).toBe('FAIL');
    expect(result.judgeReason).toContain('Critical');
    expect(result.sampleQty).toBe(80);
  });

  it('uses item major AQL Ac/Re instead of trusting a caller supplied pass result', async () => {
    partRepo.findOne.mockResolvedValue({
      itemCode: 'HARNESS',
      iqcAqlPolicyCode: 'AQLP-II-1.0-2.5',
    });
    policyRepo.findOne.mockResolvedValue({
      policyCode: 'AQLP-II-1.0-2.5',
      inspectionLevel: 'II',
      majorAqlCode: 'AQL-II-1.0',
      minorAqlCode: 'AQL-II-2.5',
      criticalMode: 'IMMEDIATE_FAIL',
      useYn: 'Y',
    });
    partnerRepo.findOne.mockResolvedValue({ partnerCode: 'SUP-B', inspectionMode: 'NORMAL' });
    standardRepo.findOne
      .mockResolvedValueOnce({ company: '40', plant: '1000', aqlCode: 'AQL-II-1.0', useYn: 'Y' })
      .mockResolvedValueOnce({ company: '40', plant: '1000', aqlCode: 'AQL-II-2.5', useYn: 'Y' });
    ruleRepo.find
      .mockResolvedValueOnce([{ lotQtyFrom: 501, lotQtyTo: 1200, sampleSize: 80, acceptQty: 2, rejectQty: 3 }])
      .mockResolvedValueOnce([{ lotQtyFrom: 501, lotQtyTo: 1200, sampleSize: 80, acceptQty: 5, rejectQty: 6 }]);

    const result = await service.resolveIqcPolicy({
      itemCode: 'HARNESS',
      vendorCode: 'SUP-B',
      lotQty: 1000,
      defectCounts: { major: 3, minor: 0 },
      company: '40',
      plant: '1000',
    });

    expect(result.result).toBe('FAIL');
    expect(result.majorRule).toEqual(expect.objectContaining({ aqlCode: 'AQL-II-1.0', acceptQty: 2, rejectQty: 3 }));
  });

  it('aggregates IQC defect codes by mandatory severity and applies major/minor AQL independently', async () => {
    partRepo.findOne.mockResolvedValue({
      itemCode: 'HARNESS',
      iqcAqlPolicyCode: 'AQLP-II-1.0-2.5',
    });
    policyRepo.findOne.mockResolvedValue({
      policyCode: 'AQLP-II-1.0-2.5',
      inspectionLevel: 'II',
      majorAqlCode: 'AQL-II-1.0',
      minorAqlCode: 'AQL-II-2.5',
      criticalMode: 'IMMEDIATE_FAIL',
      useYn: 'Y',
    });
    partnerRepo.findOne.mockResolvedValue({ partnerCode: 'SUP-B', inspectionMode: 'NORMAL' });
    defectCodeRepo.find.mockResolvedValue([
      { defectCode: 'D-MAJ', defectGrade: 'MAJOR', useYn: 'Y' },
      { defectCode: 'D-MIN', defectGrade: 'MINOR', useYn: 'Y' },
    ]);
    standardRepo.findOne
      .mockResolvedValueOnce({ company: '40', plant: '1000', aqlCode: 'AQL-II-1.0', useYn: 'Y' })
      .mockResolvedValueOnce({ company: '40', plant: '1000', aqlCode: 'AQL-II-2.5', useYn: 'Y' });
    ruleRepo.find
      .mockResolvedValueOnce([{ lotQtyFrom: 501, lotQtyTo: 1200, sampleSize: 80, acceptQty: 2, rejectQty: 3 }])
      .mockResolvedValueOnce([{ lotQtyFrom: 501, lotQtyTo: 1200, sampleSize: 80, acceptQty: 5, rejectQty: 6 }]);

    const result = await service.resolveIqcPolicy({
      itemCode: 'HARNESS',
      vendorCode: 'SUP-B',
      lotQty: 1000,
      defectCodes: [
        { defectCode: 'D-MAJ', qty: 3 },
        { defectCode: 'D-MIN', qty: 1 },
      ],
      company: '40',
      plant: '1000',
    });

    expect(result.defectMajor).toBe(3);
    expect(result.defectMinor).toBe(1);
    expect(result.result).toBe('FAIL');
    expect(result.judgeReason).toContain('Major');
    expect(result.minorRule).toEqual(expect.objectContaining({ acceptQty: 5, rejectQty: 6 }));
  });

  it('fails immediately when an IQC defect code is critical regardless of major/minor Ac/Re', async () => {
    partRepo.findOne.mockResolvedValue({
      itemCode: 'HARNESS',
      iqcAqlPolicyCode: 'AQLP-II-1.0-2.5',
    });
    policyRepo.findOne.mockResolvedValue({
      policyCode: 'AQLP-II-1.0-2.5',
      inspectionLevel: 'II',
      majorAqlCode: 'AQL-II-1.0',
      minorAqlCode: 'AQL-II-2.5',
      criticalMode: 'IMMEDIATE_FAIL',
      useYn: 'Y',
    });
    partnerRepo.findOne.mockResolvedValue({ partnerCode: 'SUP-B', inspectionMode: 'NORMAL' });
    defectCodeRepo.find.mockResolvedValue([
      { defectCode: 'D-CRI', defectGrade: 'CRITICAL', useYn: 'Y' },
    ]);
    standardRepo.findOne
      .mockResolvedValueOnce({ company: '40', plant: '1000', aqlCode: 'AQL-II-1.0', useYn: 'Y' })
      .mockResolvedValueOnce({ company: '40', plant: '1000', aqlCode: 'AQL-II-2.5', useYn: 'Y' });
    ruleRepo.find
      .mockResolvedValueOnce([{ lotQtyFrom: 501, lotQtyTo: 1200, sampleSize: 80, acceptQty: 2, rejectQty: 3 }])
      .mockResolvedValueOnce([{ lotQtyFrom: 501, lotQtyTo: 1200, sampleSize: 80, acceptQty: 5, rejectQty: 6 }]);

    const result = await service.resolveIqcPolicy({
      itemCode: 'HARNESS',
      vendorCode: 'SUP-B',
      lotQty: 1000,
      defectCodes: [{ defectCode: 'D-CRI', qty: 1 }],
      company: '40',
      plant: '1000',
    });

    expect(result.defectCritical).toBe(1);
    expect(result.result).toBe('FAIL');
    expect(result.judgeReason).toContain('Critical');
  });

  it('judges per inspection item — a critical item with a defect fails the lot', async () => {
    specItemRepo.find.mockResolvedValue([
      { seq: 1, inspItemCode: 'FUNC', defectGrade: 'CRITICAL', inspectionLevel: 'S4', aql: null, useYn: 'Y' },
    ]);
    partRepo.findOne.mockResolvedValue({ itemCode: 'PCB', inspectionLevel: 'II', iqcAqlPolicyCode: 'AQLP-II-1.0-2.5' });
    policyRepo.findOne.mockResolvedValue({
      policyCode: 'AQLP-II-1.0-2.5',
      inspectionLevel: 'II',
      majorAqlCode: 'AQL-II-1.0',
      minorAqlCode: 'AQL-II-2.5',
      criticalMode: 'IMMEDIATE_FAIL',
      useYn: 'Y',
    });
    partnerRepo.findOne.mockResolvedValue(null);

    const result = await service.resolveIqcPolicyByItem({
      itemCode: 'PCB',
      vendorCode: null,
      lotQty: 100,
      itemDefectCounts: { 1: 1 },
      company: '40',
      plant: '1000',
    });

    expect(result.result).toBe('FAIL');
    expect(result.defectCritical).toBe(1);
    expect(result.itemResults?.find((r) => r.inspItemCode === 'FUNC')?.result).toBe('FAIL');
  });

  it('judges per inspection item — a major item exceeding its AQL Ac fails the lot', async () => {
    specItemRepo.find.mockResolvedValue([
      { seq: 1, inspItemCode: 'DIM', defectGrade: 'MAJOR', inspectionLevel: 'II', aql: 1.0, useYn: 'Y' },
    ]);
    partRepo.findOne.mockResolvedValue({ itemCode: 'PCB', inspectionLevel: 'II', iqcAqlPolicyCode: 'AQLP-II-1.0-2.5' });
    policyRepo.findOne.mockResolvedValue({
      policyCode: 'AQLP-II-1.0-2.5',
      inspectionLevel: 'II',
      majorAqlCode: 'AQL-II-1.0',
      minorAqlCode: 'AQL-II-2.5',
      criticalMode: 'IMMEDIATE_FAIL',
      useYn: 'Y',
    });
    partnerRepo.findOne.mockResolvedValue(null);
    standardRepo.find.mockResolvedValue([
      { company: '40', plant: '1000', aqlCode: 'AQL-II-1.0', useYn: 'Y' },
    ]);
    ruleRepo.find.mockResolvedValue([{ lotQtyFrom: 1, lotQtyTo: 200, sampleSize: 20, acceptQty: 1, rejectQty: 2 }]);

    const result = await service.resolveIqcPolicyByItem({
      itemCode: 'PCB',
      vendorCode: null,
      lotQty: 100,
      itemDefectCounts: { 1: 2 },
      company: '40',
      plant: '1000',
    });

    expect(result.result).toBe('FAIL');
    expect(result.defectMajor).toBe(2);
    expect(result.itemResults?.[0].acceptQty).toBe(0);
  });

  it('falls back to part-level policy when no inspection item has a defect grade', async () => {
    specItemRepo.find.mockResolvedValue([]);
    partRepo.findOne.mockResolvedValue({ itemCode: 'PCB', iqcAqlPolicyCode: 'AQLP-II-1.0-2.5' });
    policyRepo.findOne.mockResolvedValue({
      policyCode: 'AQLP-II-1.0-2.5',
      inspectionLevel: 'II',
      majorAqlCode: 'AQL-II-1.0',
      minorAqlCode: 'AQL-II-2.5',
      criticalMode: 'IMMEDIATE_FAIL',
      useYn: 'Y',
    });
    partnerRepo.findOne.mockResolvedValue(null);
    standardRepo.findOne
      .mockResolvedValueOnce({ company: '40', plant: '1000', aqlCode: 'AQL-II-1.0', useYn: 'Y' })
      .mockResolvedValueOnce({ company: '40', plant: '1000', aqlCode: 'AQL-II-2.5', useYn: 'Y' });
    ruleRepo.find
      .mockResolvedValueOnce([{ lotQtyFrom: 1, lotQtyTo: 200, sampleSize: 13, acceptQty: 0, rejectQty: 1 }])
      .mockResolvedValueOnce([{ lotQtyFrom: 1, lotQtyTo: 200, sampleSize: 13, acceptQty: 1, rejectQty: 2 }]);

    const result = await service.resolveIqcPolicyByItem({
      itemCode: 'PCB',
      vendorCode: null,
      lotQty: 100,
      itemDefectCounts: {},
      fallbackDefectCounts: { critical: 0, major: 0, minor: 0 },
      company: '40',
      plant: '1000',
    });

    expect(result.result).toBe('PASS');
    expect(result.policyCode).toBe('AQLP-II-1.0-2.5');
    expect(result.itemResults).toBeUndefined();
  });

  it('rejects IQC AQL resolution when an item has no policy and no item-level AQL criteria', async () => {
    specItemRepo.find.mockResolvedValue([]);
    partRepo.findOne.mockResolvedValue({ itemCode: 'PCB', iqcAqlPolicyCode: null });
    partnerRepo.findOne.mockResolvedValue(null);

    await expect(service.resolveIqcPolicyByItem({
      itemCode: 'PCB',
      vendorCode: null,
      lotQty: 100,
      itemDefectCounts: {},
      fallbackDefectCounts: { critical: 0, major: 1, minor: 0 },
      company: '40',
      plant: '1000',
    })).rejects.toThrow(BadRequestException);
  });

  it('rejects IQC defect codes without Critical/Major/Minor severity', async () => {
    partRepo.findOne.mockResolvedValue({
      itemCode: 'HARNESS',
      iqcAqlPolicyCode: 'AQLP-II-1.0-2.5',
    });
    policyRepo.findOne.mockResolvedValue({
      policyCode: 'AQLP-II-1.0-2.5',
      inspectionLevel: 'II',
      majorAqlCode: 'AQL-II-1.0',
      minorAqlCode: 'AQL-II-2.5',
      criticalMode: 'IMMEDIATE_FAIL',
      useYn: 'Y',
    });
    partnerRepo.findOne.mockResolvedValue({ partnerCode: 'SUP-B', inspectionMode: 'NORMAL' });
    defectCodeRepo.find.mockResolvedValue([
      { defectCode: 'D-NO-GRADE', defectGrade: null, useYn: 'Y' },
    ]);

    await expect(service.resolveIqcPolicy({
      itemCode: 'HARNESS',
      vendorCode: 'SUP-B',
      lotQty: 1000,
      defectCodes: [{ defectCode: 'D-NO-GRADE', qty: 1 }],
      company: '40',
      plant: '1000',
    })).rejects.toThrow(BadRequestException);
  });

  it('파괴검사 항목은 불량 1건이면 FAIL, AQL과 무관하게 판정한다', async () => {
    specItemRepo.find.mockResolvedValue([
      { seq: 1, inspItemCode: 'IQC-VISUAL', defectGrade: 'MINOR', inspectionLevel: 'II', aql: 2.5, inspectionType: 'AQL', sampleMethod: 'AQL', sampleQty: null },
      { seq: 2, inspItemCode: 'IQC-PULL', defectGrade: 'MAJOR', inspectionLevel: null, aql: null, inspectionType: 'DESTRUCTIVE', sampleMethod: 'FIXED', sampleQty: 5 },
    ]);
    partRepo.findOne.mockResolvedValue({ itemCode: 'CBL-A', inspectionLevel: 'II', iqcAqlPolicyCode: 'AQLP-II-1.0-2.5' });
    policyRepo.findOne.mockResolvedValue({
      policyCode: 'AQLP-II-1.0-2.5',
      inspectionLevel: 'II',
      majorAqlCode: 'AQL-II-1.0',
      minorAqlCode: 'AQL-II-2.5',
      criticalMode: 'IMMEDIATE_FAIL',
      useYn: 'Y',
    });
    partnerRepo.findOne.mockResolvedValue(null);
    // 외관 AQL Ac5/Re6 가정
    jest.spyOn(service as any, 'resolveSeverityRule').mockResolvedValue({ aqlCode: 'AQL-II-2.5', aqlValue: 2.5, codeLetter: 'F', sampleSize: 80, acceptQty: 5, rejectQty: 6 });

    const res = await service.resolveIqcPolicyByItem({
      itemCode: 'CBL-A', vendorCode: null, lotQty: 1200,
      itemDefectCounts: { 1: 0, 2: 1 },           // 외관 0, 인장 1
      itemInspectedCounts: { 2: 5 },
      company: '40', plant: '1000',
    });

    expect(res.result).toBe('FAIL');
    const pull = res.itemResults!.find((r) => r.inspItemCode === 'IQC-PULL')!;
    expect(pull.inspectionType).toBe('DESTRUCTIVE');
    expect(pull.requiredQty).toBe(5);
    expect(pull.inspectedQty).toBe(5);
    expect(pull.result).toBe('FAIL');
    const visual = res.itemResults!.find((r) => r.inspItemCode === 'IQC-VISUAL')!;
    expect(visual.result).toBe('PASS');   // 외관 0건은 PASS
  });

  it('switches NORMAL supplier inspection mode to TIGHTENED when recent 5 lots include 2 fails', async () => {
    partnerRepo.findOne.mockResolvedValue({
      company: '40',
      plant: '1000',
      partnerCode: 'SUP-C',
      inspectionMode: 'NORMAL',
    });
    iqcLogRepo.find.mockResolvedValue([
      { result: 'FAIL', defectCritical: 0, defectMajor: 1 },
      { result: 'PASS', defectCritical: 0, defectMajor: 0 },
      { result: 'FAIL', defectCritical: 0, defectMajor: 1 },
      { result: 'PASS', defectCritical: 0, defectMajor: 0 },
      { result: 'PASS', defectCritical: 0, defectMajor: 0 },
    ]);

    const result = await service.updateVendorInspectionModeAfterLot({
      vendorCode: 'SUP-C',
      itemCode: 'PCB',
      arrivalNo: 'R1',
      company: '40',
      plant: '1000',
    });

    expect(partnerRepo.save).toHaveBeenCalledWith(expect.objectContaining({ inspectionMode: 'TIGHTENED' }));
    expect(modeHistoryRepo.save).toHaveBeenCalledWith(expect.objectContaining({ newMode: 'TIGHTENED' }));
    expect(result).toEqual(expect.objectContaining({ changed: true, inspectionMode: 'TIGHTENED' }));
  });

  it('reverts supplier inspection mode when the latest mode history belongs to the canceled IQC lot', async () => {
    partnerRepo.findOne.mockResolvedValue({
      company: '40',
      plant: '1000',
      partnerCode: 'SUP-C',
      inspectionMode: 'TIGHTENED',
    });
    modeHistoryRepo.find.mockResolvedValue([
      {
        vendorCode: 'SUP-C',
        prevMode: 'NORMAL',
        newMode: 'TIGHTENED',
        refArrivalNo: 'ARR-1',
        refItemCode: 'ITEM-1',
      },
    ]);

    const result = await service.revertVendorInspectionModeForCanceledLot({
      vendorCode: 'SUP-C',
      arrivalNo: 'ARR-1',
      itemCode: 'ITEM-1',
      company: '40',
      plant: '1000',
    });

    expect(partnerRepo.save).toHaveBeenCalledWith(expect.objectContaining({ inspectionMode: 'NORMAL' }));
    expect(modeHistoryRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      prevMode: 'TIGHTENED',
      newMode: 'NORMAL',
      reason: 'IQC 판정 취소로 검사강도 원복',
    }));
    expect(result).toEqual(expect.objectContaining({ changed: true, inspectionMode: 'NORMAL' }));
  });
});
