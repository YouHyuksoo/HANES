/**
 * @file hipot-leak-inspect.spec.ts
 * @description 내전압(절연저항 포함)·리크 스테이션 — 실측값 스펙 대조 판정과 검사유형별 대기 라벨 조회
 */
import { ContinuityInspectService } from './continuity-inspect.service';
import type { ContinuityInspectDto } from '../dto/continuity-inspect.dto';

type Verdict = { passYn: string; errorCode?: string; errorDetail?: string; inspectData: string | null };
type Judge = (qr: unknown, dto: ContinuityInspectDto, company?: string, plant?: string) => Promise<Verdict>;

function buildService(specRows: unknown[] = [], fgLabelRepo: unknown = {}) {
  const service = Object.create(ContinuityInspectService.prototype) as ContinuityInspectService;
  Object.assign(service, { fgLabelRepo });
  const qr = { manager: { find: jest.fn().mockResolvedValue(specRows) } };
  const judge = (service as unknown as { applyMeasurementJudgement: Judge }).applyMeasurementJudgement.bind(service);
  return { service, qr, judge };
}

const hipotSpec = { inspectType: 'HIPOT', connectorKey: '*', testVoltageKv: 3, testSeconds: 2, maxCurrentMa: 2, minInsulationMohm: 100 };

describe('HIPOT/LEAK 실측값 판정', () => {
  const base = { orderNo: 'W1', itemCode: 'ITEM-1', passYn: 'Y' } as ContinuityInspectDto;

  it('통전·단자는 측정 판정을 거치지 않고 작업자 판정을 그대로 둔다', async () => {
    const { qr, judge } = buildService([hipotSpec]);
    const v = await judge(qr, { ...base, inspectType: 'CONTINUITY' }, 'C1', 'P1');
    expect(v).toEqual({ passYn: 'Y', errorCode: undefined, errorDetail: undefined, inspectData: null });
    expect(qr.manager.find).not.toHaveBeenCalled();
  });

  it('스펙을 만족하면 작업자 합격을 유지하고 측정값을 inspectData 로 남긴다', async () => {
    const { qr, judge } = buildService([hipotSpec]);
    const v = await judge(qr, { ...base, inspectType: 'HIPOT', voltageKv: 3, currentMa: 0.8, testSeconds: 2, insulationMohm: 950 }, 'C1', 'P1');
    expect(v.passYn).toBe('Y');
    expect(JSON.parse(v.inspectData!)).toMatchObject({ voltageKv: 3, currentMa: 0.8, insulationMohm: 950 });
    expect(qr.manager.find).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      where: expect.objectContaining({ itemCode: 'ITEM-1', inspectType: 'HIPOT', useYn: 'Y', company: 'C1', plant: 'P1' }),
    }));
  });

  it('누설전류가 허용치를 넘으면 작업자 합격이라도 불합격(SPEC)으로 뒤집는다', async () => {
    const { qr, judge } = buildService([hipotSpec]);
    const v = await judge(qr, { ...base, inspectType: 'HIPOT', voltageKv: 3, currentMa: 2.5, insulationMohm: 950 }, 'C1', 'P1');
    expect(v.passYn).toBe('N');
    expect(v.errorCode).toBe('SPEC');
    expect(v.errorDetail).toContain('전류 2.5 mA > 허용 2 mA');
  });

  it('절연저항이 하한 미만이면 불합격이고, 하한이 있는데 측정이 없어도 불합격이다', async () => {
    const { qr, judge } = buildService([hipotSpec]);
    const low = await judge(qr, { ...base, inspectType: 'HIPOT', voltageKv: 3, currentMa: 0.5, insulationMohm: 80 }, 'C1', 'P1');
    expect(low.passYn).toBe('N');
    expect(low.errorDetail).toContain('절연저항 80 MΩ < 하한 100 MΩ');
    const missing = await judge(qr, { ...base, inspectType: 'HIPOT', voltageKv: 3, currentMa: 0.5 }, 'C1', 'P1');
    expect(missing.passYn).toBe('N');
    expect(missing.errorDetail).toContain('절연저항 측정값이 없습니다');
  });

  it('스펙 하한이 없으면 절연저항을 판정하지 않는다', async () => {
    const { qr, judge } = buildService([{ ...hipotSpec, minInsulationMohm: null }]);
    const v = await judge(qr, { ...base, inspectType: 'HIPOT', voltageKv: 3, currentMa: 0.5 }, 'C1', 'P1');
    expect(v.passYn).toBe('Y');
  });

  it('작업자가 준 불량코드가 있으면 SPEC 으로 덮지 않는다', async () => {
    const { qr, judge } = buildService([hipotSpec]);
    const v = await judge(qr, { ...base, inspectType: 'HIPOT', passYn: 'N', errorCode: 'BROKEN', currentMa: 9 }, 'C1', 'P1');
    expect(v).toMatchObject({ passYn: 'N', errorCode: 'BROKEN' });
  });

  it('스펙이 없으면 작업자 판정을 유지하되 측정값은 남긴다', async () => {
    const { qr, judge } = buildService([]);
    const v = await judge(qr, { ...base, inspectType: 'LEAK', chargeBar: 0.7, holdBar: 0.65, holdSeconds: 2 }, 'C1', 'P1');
    expect(v.passYn).toBe('Y');
    expect(JSON.parse(v.inspectData!)).toMatchObject({ chargeBar: 0.7, holdBar: 0.65, holdSeconds: 2 });
  });

  it('리크 측정압이 하한 미만이면 불합격이다', async () => {
    const { qr, judge } = buildService([{ inspectType: 'LEAK', connectorKey: '*', chargeBar: 0.7, chargeTolBar: 0.2, holdSeconds: 2, minHoldBar: 0.3 }]);
    const v = await judge(qr, { ...base, inspectType: 'LEAK', chargeBar: 0.7, holdBar: 0.1, holdSeconds: 2 }, 'C1', 'P1');
    expect(v).toMatchObject({ passYn: 'N', errorCode: 'SPEC' });
    expect(v.errorDetail).toContain('측정압 0.1 bar < 하한 0.3 bar');
  });

  it('토크 실측값을 TORQUE 스펙으로 판정하고 이력 데이터에 남긴다', async () => {
    const { qr, judge } = buildService([{ inspectType: 'TORQUE', connectorKey: '*', torqueLsl: 0.45, torqueUsl: 0.55 }]);
    const ok = await judge(qr, { ...base, inspectType: 'TORQUE', torque: 0.5 }, 'C1', 'P1');
    expect(ok.passYn).toBe('Y');
    expect(JSON.parse(ok.inspectData!)).toMatchObject({ torque: 0.5 });

    const ng = await judge(qr, { ...base, inspectType: 'TORQUE', torque: 0.7 }, 'C1', 'P1');
    expect(ng).toMatchObject({ passYn: 'N', errorCode: 'SPEC' });
    expect(ng.errorDetail).toContain('토크 0.7 > 상한 0.55');
  });
});

describe('검사유형별 대기 라벨', () => {
  function chainRepo() {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ fgBarcode: 'FG-1' }]),
    };
    return { repo: { createQueryBuilder: jest.fn().mockReturnValue(qb), find: jest.fn().mockResolvedValue([]) }, qb };
  }

  it('inspectType 이 오면 그 유형의 결과가 없는 ISSUED 라벨만 NOT EXISTS 로 고른다', async () => {
    const { repo, qb } = chainRepo();
    const { service } = buildService([], repo);
    const rows = await service.getPendingLabels('W1', 'C1', 'P1', 'HIPOT');
    expect(rows).toEqual([{ fgBarcode: 'FG-1' }]);
    expect(repo.createQueryBuilder).toHaveBeenCalledWith('fg');
    const notExists = qb.andWhere.mock.calls.find(([sql]) => String(sql).includes('NOT EXISTS'));
    expect(notExists?.[0]).toMatch(/ir\.INSPECT_TYPE = :inspectType/);
    expect(notExists?.[1]).toEqual({ inspectType: 'HIPOT' });
    expect(qb.andWhere).toHaveBeenCalledWith('fg.company = :company', { company: 'C1' });
    expect(qb.andWhere).toHaveBeenCalledWith('fg.plant = :plant', { plant: 'P1' });
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('inspectType 이 없으면 기존처럼 INSPECT_PASS_YN 이 비어 있는 ISSUED 라벨을 찾는다', async () => {
    const { repo } = chainRepo();
    const { service } = buildService([], repo);
    await service.getPendingLabels('W1', 'C1', 'P1');
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
    expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ orderNo: 'W1', status: 'ISSUED', company: 'C1', plant: 'P1' }),
    }));
  });
});
