import { BadRequestException } from '@nestjs/common';
import { CrimpInspectService } from './crimp-inspect.service';
import { InspectResult } from '../../../../entities/inspect-result.entity';

/** 운영 데이터(MAG_EAD65942601-AGN001)와 같은 모양 — 단자 2종이 서로 다른 규격을 쓴다 */
const ORDER = { orderNo: 'WO1', itemCode: 'SEMI-1', itemName: 'SEMI', processCode: 'GCRMP', processName: '일반압착', processType: 'CRIMPING', status: 'RUNNING' };
const BOM = [
  { childItemCode: 'WIRE-GN', side: '3', seq: 1, itemName: 'LEAD WIRE', spec: '0.5SQ GN', productType: 'WIRE', itemType: 'RAW_MATERIAL' },
  { childItemCode: 'TER-A', side: '1', seq: 2, itemName: 'TERMINAL', spec: 'A', productType: 'TERMINAL', itemType: 'RAW_MATERIAL' },
  { childItemCode: 'TER-B', side: '2', seq: 3, itemName: 'TERMINAL', spec: 'B', productType: 'TERMINAL', itemType: 'RAW_MATERIAL' },
];
const spec = (id: number, terminal: string, wire: string | null, chLsl: number, chUsl: number, pull: number) => ({
  SPEC_ID: id, TERMINAL_ITEM_CODE: terminal, WIRE_SIZE: '0.5SQ', WIRE_ITEM_CODE: wire,
  CRIMP_HEIGHT_LSL: chLsl, CRIMP_HEIGHT_USL: chUsl, CRIMP_WIDTH_LSL: null, CRIMP_WIDTH_USL: null,
  INS_CRIMP_HEIGHT_LSL: null, INS_CRIMP_HEIGHT_USL: null, PULL_FORCE_MIN: pull,
  STRIP_LENGTH_MIN: null, STRIP_LENGTH_MAX: null, APPLICATOR_CODE: null,
});
const SPECS = [
  spec(1, 'TER-A', 'WIRE-GN', 1.1, 1.2, 70),
  spec(2, 'TER-B', 'WIRE-GN', 1.2, 1.3, 80),
  // 전선 품목이 없는 일반 사이즈 행 — 판정에 쓰지 않는다
  spec(3, 'TER-A', null, 9, 9, 999),
];
const VISUAL = [{ code: 'SHAPE', name: '압착형상' }, { code: 'MIXUP', name: '이종' }];

function setup(overrides: { bom?: Record<string, unknown[]>; specs?: unknown[] } = {}) {
  const bom = overrides.bom ?? { 'SEMI-1': BOM };
  const specs = overrides.specs ?? SPECS;
  const query = jest.fn(async (sql: string, params: unknown[]) => {
    if (sql.includes('FROM JOB_ORDERS')) return [ORDER];
    if (sql.includes('FROM WORKER_MASTERS')) return [{ 1: 1 }];
    if (sql.includes('FROM BOM_MASTERS')) return (params.slice(2) as string[]).flatMap((code) => bom[code] ?? []);
    if (sql.includes('FROM TERMINAL_CRIMP_SPECS')) return specs;
    if (sql.includes('FROM COM_CODES')) return VISUAL;
    throw new Error(`unexpected sql: ${sql}`);
  });
  const manager = {
    query,
    create: jest.fn((_entity: unknown, payload: unknown) => payload),
    save: jest.fn(async (_entity: unknown, payload: unknown) => payload),
  };
  const qr = { manager, query };
  const repo = { manager, find: jest.fn() };
  const seq = { getNo: jest.fn().mockResolvedValue('IR-1') };
  const tx = { run: jest.fn(async (cb: (q: unknown) => unknown) => cb(qr)) };
  const service = new CrimpInspectService(repo as never, seq as never, tx as never);
  return { service, manager };
}

const okVisual = [{ code: 'SHAPE', result: 'OK' as const }, { code: 'MIXUP', result: 'OK' as const }];

describe('CrimpInspectService', () => {
  it('passes one positional bind per placeholder occurrence in the job-order query (DPY-4009)', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const service = new CrimpInspectService({ query } as never, {} as never, {} as never);
    await service.findJobOrders('C', 'P');
    const [sql, binds] = query.mock.calls[0] as [string, unknown[]];
    expect(binds).toHaveLength((sql.match(/:\d+\b/g) ?? []).length);
  });

  it('resolves each BOM terminal to its own exact (terminal, wire) spec', async () => {
    const { service } = setup();
    const ctx = await service.getContext('WO1', 'C', 'P');
    expect(ctx.ready).toBe(true);
    expect(ctx.sides.map((s) => [s.sideKey, s.status, s.spec?.specId])).toEqual([
      ['TER-A', 'OK', 1],
      ['TER-B', 'OK', 2],
    ]);
  });

  it('judges each side against its own limits on the server', async () => {
    const { service, manager } = setup();
    const saved = await service.create({
      orderNo: 'WO1', timing: 'FIRST', workerId: 'W1',
      sides: [
        { sideKey: 'TER-A', crimpHeight: 1.15, pullForce: 75 },
        // TER-A 기준이면 합격이지만 TER-B 규격(1.2~1.3)으로는 불합격
        { sideKey: 'TER-B', crimpHeight: 1.35, pullForce: 85 },
      ],
      visualChecks: okVisual,
    }, 'C', 'P', 'U1');

    expect(saved.passYn).toBe('N');
    expect(saved.errorCode).toBe('SPEC');
    expect(saved.errorDetail).toContain('TER-B 압착고 1.35 (1.2~1.3)');
    expect(saved.orderNo).toBe('WO1');
    expect(saved.inspectType).toBe('TERMINAL');
    expect(manager.save).toHaveBeenCalledWith(InspectResult, expect.objectContaining({ inspectScope: 'SAMPLE', inspectorId: 'W1' }));
    const data = JSON.parse(saved.inspectData as string);
    expect(data.sides.map((s: { passYn: string }) => s.passYn)).toEqual(['Y', 'N']);
  });

  it('passes when all measures are in spec and visual checks are OK, and fails on a visual NG', async () => {
    const { service } = setup();
    const sides = [
      { sideKey: 'TER-A', crimpHeight: 1.2, pullForce: 70 },
      { sideKey: 'TER-B', crimpHeight: 1.25, pullForce: 80 },
    ];
    const pass = await service.create({ orderNo: 'WO1', timing: 'MID', workerId: 'W1', sides, visualChecks: okVisual }, 'C', 'P', 'U1');
    expect(pass.passYn).toBe('Y');
    expect(pass.errorCode).toBeNull();

    const fail = await service.create({
      orderNo: 'WO1', timing: 'MID', workerId: 'W1', sides,
      visualChecks: [{ code: 'SHAPE', result: 'OK' }, { code: 'MIXUP', result: 'NG' }],
    }, 'C', 'P', 'U1');
    expect(fail.passYn).toBe('N');
    expect(fail.errorCode).toBe('VISUAL');
    expect(fail.errorDetail).toContain('외관 이종 NG');
  });

  it('rejects when a required measure is missing', async () => {
    const { service } = setup();
    await expect(service.create({
      orderNo: 'WO1', timing: 'FIRST', workerId: 'W1',
      sides: [{ sideKey: 'TER-A', crimpHeight: 1.15 }, { sideKey: 'TER-B', crimpHeight: 1.25, pullForce: 85 }],
      visualChecks: okVisual,
    }, 'C', 'P', 'U1')).rejects.toThrow('TER-A 실측값이 없습니다: 인장력');
  });

  it('does not fall back to the wire-less size row when the exact spec is missing', async () => {
    const { service } = setup({ specs: [SPECS[1], SPECS[2]] });
    const ctx = await service.getContext('WO1', 'C', 'P');
    expect(ctx.ready).toBe(false);
    expect(ctx.sides.find((s) => s.sideKey === 'TER-A')?.status).toBe('NO_SPEC');
    await expect(service.create({
      orderNo: 'WO1', timing: 'FIRST', workerId: 'W1',
      sides: [{ sideKey: 'TER-A', crimpHeight: 1.15, pullForce: 75 }, { sideKey: 'TER-B', crimpHeight: 1.25, pullForce: 85 }],
      visualChecks: okVisual,
    }, 'C', 'P', 'U1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('finds the wire one level down when the crimp item consumes a cut semi-product', async () => {
    const { service } = setup({
      bom: {
        'SEMI-1': [
          { childItemCode: 'CUT-1', side: null, seq: 1, itemName: 'CUT', spec: null, productType: 'SUB_ASSY', itemType: 'SEMI_PRODUCT' },
          BOM[1],
        ],
        'CUT-1': [BOM[0]],
      },
    });
    const ctx = await service.getContext('WO1', 'C', 'P');
    expect(ctx.sides).toEqual([expect.objectContaining({ sideKey: 'TER-A', wireItemCode: 'WIRE-GN', status: 'OK' })]);
  });

  it('descends semi-product BOM levels until the first level with a wire (N91 shape)', async () => {
    const semi = (code: string) => ({ childItemCode: code, side: null, seq: 1, itemName: code, spec: null, productType: 'SUB_ASSY', itemType: 'SEMI_PRODUCT' });
    // SEMI-1 → AB → C1/C2 → C1-A/C2-A → 같은 전선 (운영 N91H00-X9800-S-A 구조)
    const { service } = setup({
      bom: {
        'SEMI-1': [semi('AB'), BOM[1]],
        AB: [semi('C1'), semi('C2')],
        C1: [semi('C1-A')],
        C2: [semi('C2-A')],
        'C1-A': [BOM[0]],
        'C2-A': [BOM[0]],
      },
    });
    const ctx = await service.getContext('WO1', 'C', 'P');
    expect(ctx.sides).toEqual([expect.objectContaining({ sideKey: 'TER-A', wireItemCode: 'WIRE-GN', status: 'OK' })]);
  });

  it('blocks when the first level with wires has two different wires', async () => {
    const semi = (code: string) => ({ childItemCode: code, side: null, seq: 1, itemName: code, spec: null, productType: 'SUB_ASSY', itemType: 'SEMI_PRODUCT' });
    const otherWire = { ...BOM[0], childItemCode: 'WIRE-RD' };
    const { service } = setup({
      bom: { 'SEMI-1': [semi('C1'), semi('C2'), BOM[1]], C1: [BOM[0]], C2: [otherWire] },
    });
    const ctx = await service.getContext('WO1', 'C', 'P');
    expect(ctx.sides).toEqual([expect.objectContaining({ sideKey: 'TER-A', wireItemCode: null, status: 'MULTI_WIRE' })]);
  });
});

describe('CrimpInspectService 입력 확인', () => {
  it('작업지시 번호가 없으면 컨텍스트·이력 조회를 400 으로 막는다(이력이 전체 작업지시로 새지 않게)', async () => {
    const service = new CrimpInspectService({} as never, {} as never, {} as never);
    await expect(service.getContext('', 'C', 'P')).rejects.toThrow('작업지시 번호(orderNo)가 필요합니다.');
    await expect(service.findHistory(undefined as never, 'C', 'P')).rejects.toThrow('작업지시 번호(orderNo)가 필요합니다.');
  });
});
