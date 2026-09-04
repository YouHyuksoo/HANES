/**
 * @file hv-spc-db.source.spec.ts
 * @description DbSpcSource 매핑(VALUES 파싱, 테넌트 where, 이름 조인) 테스트
 */
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { SpcChart } from '../../../../entities/spc-chart.entity';
import { SpcData } from '../../../../entities/spc-data.entity';
import { ProcessMaster } from '../../../../entities/process-master.entity';
import { ItemMaster } from '../../../../entities/item-master.entity';
import {
  DbSpcSource,
  decimalsFromSpec,
  mapChartToTarget,
  mapDataRowsToSubgroups,
  parseSampleValues,
} from './hv-spc-db.source';

describe('hv-spc-db.source 순수 매핑', () => {
  it('parseSampleValues: JSON 배열과 쉼표 구분 모두 읽는다', () => {
    expect(parseSampleValues('[1.23, 1.25, 1.24]')).toEqual([1.23, 1.25, 1.24]);
    expect(parseSampleValues('1.23,1.25,1.24')).toEqual([1.23, 1.25, 1.24]);
    expect(parseSampleValues(' 1.2 , x , 3 ')).toEqual([1.2, 3]);
    expect(parseSampleValues('')).toEqual([]);
    expect(parseSampleValues(null)).toEqual([]);
    expect(parseSampleValues('[]')).toEqual([]);
  });

  it('decimalsFromSpec: 규격값 소수 자릿수 최대, 없으면 3', () => {
    expect(decimalsFromSpec([1.9, 1.95, 2])).toBe(2);
    expect(decimalsFromSpec([null, null, null])).toBe(3);
    expect(decimalsFromSpec([1200, null, 1203])).toBe(0);
  });

  it('mapChartToTarget: CHART_NO 가 id, 규격은 SPC_CHARTS 컬럼, 이름은 조인값', () => {
    const chart = {
      chartNo: 'SPC-20260904-001', itemCode: 'ITEM1', processCode: 'GCRMP', characteristicName: '크림프 높이',
      chartType: 'XBAR_R', subgroupSize: 5, usl: '2.0000', lsl: '1.9000', target: null,
    } as unknown as SpcChart;
    const t = mapChartToTarget(chart, '압착', '하네스 A');
    expect(t.id).toBe('SPC-20260904-001');
    expect(t.processName).toBe('압착');
    expect(t.itemName).toBe('하네스 A');
    expect(t.spec).toEqual({ lsl: 1.9, target: null, usl: 2 });
    expect(t.decimals).toBe(1);
    expect(t.equipCodes).toEqual([]);
    expect(t.subgroupSize).toBe(5);
  });

  it('mapDataRowsToSubgroups: 시간순 id, 같은 날 여러 건은 MM/DD(n), 파싱 불가 행 제외', () => {
    const rows = [
      { chartId: 'C', subgroupNo: 1, seq: 1, sampleDate: new Date(2026, 8, 1, 8, 30), values: '[1,2,3,4,5]', remark: 'LOT-A' },
      { chartId: 'C', subgroupNo: 2, seq: 2, sampleDate: new Date(2026, 8, 1, 14, 0), values: '2,3,4,5,6', remark: null },
      { chartId: 'C', subgroupNo: 3, seq: 3, sampleDate: new Date(2026, 8, 2, 9, 5), values: '', remark: null },
      { chartId: 'C', subgroupNo: 4, seq: 4, sampleDate: new Date(2026, 8, 3, 9, 5), values: '[9]', remark: null },
    ] as unknown as SpcData[];
    const out = mapDataRowsToSubgroups(rows);
    expect(out.map((s) => s.id)).toEqual([1, 2, 3]);
    expect(out[0]).toMatchObject({ date: '2026-09-01', time: '08:30', dateLabel: '09/01(1)', lotNo: 'LOT-A', equipCode: '', samples: [1, 2, 3, 4, 5] });
    expect(out[1]).toMatchObject({ date: '2026-09-01', time: '14:00', dateLabel: '09/01(2)', lotNo: '', samples: [2, 3, 4, 5, 6] });
    expect(out[2]).toMatchObject({ date: '2026-09-03', dateLabel: '09/03', samples: [9] });
  });
});

describe('DbSpcSource', () => {
  let chartRepo: DeepMocked<Repository<SpcChart>>;
  let dataRepo: DeepMocked<Repository<SpcData>>;
  let processRepo: DeepMocked<Repository<ProcessMaster>>;
  let itemRepo: DeepMocked<Repository<ItemMaster>>;
  let source: DbSpcSource;
  const today = new Date(2026, 8, 4, 15, 0);

  beforeEach(() => {
    chartRepo = createMock<Repository<SpcChart>>();
    dataRepo = createMock<Repository<SpcData>>();
    processRepo = createMock<Repository<ProcessMaster>>();
    itemRepo = createMock<Repository<ItemMaster>>();
    source = new DbSpcSource({ chartRepo, dataRepo, processRepo, itemRepo }, { company: '40', plant: '1000' }, () => today);
  });

  it('kind 는 ORACLE, 스코프 없으면 예외', () => {
    expect(source.kind).toBe('ORACLE');
    expect(() => new DbSpcSource({ chartRepo, dataRepo, processRepo, itemRepo }, { company: '', plant: '1000' })).toThrow();
  });

  it('listTargets: 테넌트+XBAR_R+ACTIVE where, 이름은 In() 일괄 조회(N+1 없음)', async () => {
    chartRepo.find.mockResolvedValue([
      { chartNo: 'SPC-1', itemCode: 'I1', processCode: 'P1', characteristicName: 'A', chartType: 'XBAR_R', subgroupSize: 5, usl: 2, lsl: 1, target: 1.5 },
      { chartNo: 'SPC-2', itemCode: 'I1', processCode: 'P2', characteristicName: 'B', chartType: 'XBAR_R', subgroupSize: 5, usl: null, lsl: null, target: null },
    ] as unknown as SpcChart[]);
    processRepo.find.mockResolvedValue([{ processCode: 'P1', processName: '압착' }] as ProcessMaster[]);
    itemRepo.find.mockResolvedValue([{ itemCode: 'I1', itemName: '하네스' }] as ItemMaster[]);

    const targets = await source.listTargets();

    expect(chartRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { company: '40', plant: '1000', chartType: 'XBAR_R', status: 'ACTIVE' } }),
    );
    expect(processRepo.find).toHaveBeenCalledTimes(1);
    expect(processRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { company: '40', plant: '1000', processCode: In(['P1', 'P2']) } }),
    );
    expect(itemRepo.find).toHaveBeenCalledTimes(1);
    expect(itemRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { company: '40', plant: '1000', itemCode: In(['I1']) } }),
    );
    expect(targets.map((t) => t.id)).toEqual(['SPC-1', 'SPC-2']);
    expect(targets[0].processName).toBe('압착');
    expect(targets[0].itemName).toBe('하네스');
    // 마스터에 없는 공정은 코드로 표시
    expect(targets[1].processName).toBe('P2');
    expect(targets[1].spec).toEqual({ lsl: null, target: null, usl: null });
  });

  it('listTargets: 관리도가 없으면 빈 배열 — 목업으로 대체하지 않는다', async () => {
    chartRepo.find.mockResolvedValue([]);
    expect(await source.listTargets()).toEqual([]);
    expect(processRepo.find).not.toHaveBeenCalled();
  });

  it('fetchSubgroupsMany: 테넌트+chartId In()+기간 where 한 번, 대상별 분배', async () => {
    dataRepo.find.mockResolvedValue([
      { chartId: 'SPC-1', subgroupNo: 1, seq: 1, sampleDate: new Date(2026, 8, 3, 8, 0), values: '[1,2,3,4,5]', remark: null },
      { chartId: 'SPC-1', subgroupNo: 2, seq: 2, sampleDate: new Date(2026, 8, 4, 8, 0), values: '[2,3,4,5,6]', remark: null },
    ] as unknown as SpcData[]);
    const t = (id: string) => ({ id } as unknown as Parameters<DbSpcSource['fetchSubgroupsMany']>[0][number]);

    const map = await source.fetchSubgroupsMany([t('SPC-1'), t('SPC-2')], 7);

    expect(dataRepo.find).toHaveBeenCalledTimes(1);
    expect(dataRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          company: '40', plant: '1000', chartId: In(['SPC-1', 'SPC-2']),
          sampleDate: MoreThanOrEqual(new Date(2026, 7, 29)),
        },
      }),
    );
    expect(map.get('SPC-1')!.map((s) => s.id)).toEqual([1, 2]);
    expect(map.get('SPC-2')).toEqual([]);
  });

  it('fetchSubgroups: 단건은 Many 위임', async () => {
    dataRepo.find.mockResolvedValue([]);
    const raw = await source.fetchSubgroups({ id: 'SPC-9' } as unknown as Parameters<DbSpcSource['fetchSubgroups']>[0], 30);
    expect(raw).toEqual([]);
  });
});
