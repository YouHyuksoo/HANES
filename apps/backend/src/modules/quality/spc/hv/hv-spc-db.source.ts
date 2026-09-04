/**
 * @file hv-spc-db.source.ts
 * @description HV 하네스 SPC 실DB 소스 — SPC_CHARTS(관리대상) + SPC_DATA(서브그룹) 를 `SpcDataSource` 계약으로 매핑.
 *
 * 초보자 가이드:
 * - 시스템 설정 `SPC_HV_SOURCE=DB` 일 때 hv-spc.service.ts 가 요청마다 이 클래스를 만든다(회사/공장 스코프 고정).
 * - 관리대상 id = SPC_CHARTS.CHART_NO. 규격 LSL/USL/TARGET 은 SPC_CHARTS 컬럼. 공정명/품목명은 PROCESS_MASTERS/ITEM_MASTERS 를 In() 으로 일괄 조인(N+1 금지).
 * - SPC_DATA.VALUES 는 측정값 문자열이다. 기존 spc.service 는 JSON 배열("[1.2, 1.3]")로 저장하고,
 *   외부 적재는 쉼표 구분("1.2,1.3")일 수 있어 두 형식 모두 `parseSampleValues` 로 읽는다.
 * - X̄-R 계산이므로 CHART_TYPE='XBAR_R' 관리도만 관리대상으로 올린다. 다른 유형은 이 화면 대상이 아니다.
 * - 데이터가 없으면 빈 배열을 그대로 돌려준다. 목업으로 몰래 바꾸지 않는다(조용한 폴백 금지).
 */
import { Logger } from '@nestjs/common';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { SpcChart } from '../../../../entities/spc-chart.entity';
import { SpcData } from '../../../../entities/spc-data.entity';
import { ProcessMaster } from '../../../../entities/process-master.entity';
import { ItemMaster } from '../../../../entities/item-master.entity';
import type { SpcDataSource, SpcSubgroupRaw } from './hv-spc-source';
import type { SpcTarget } from './hv-spc-targets';
import { fmtDateLocal, fmtLabel, fmtTimeLocal, rangeStart } from './hv-spc-date';

/** 회사/공장 스코프 — 멀티테넌시 필수 */
export interface SpcTenantScope {
  company: string;
  plant: string;
}

export interface DbSpcRepos {
  chartRepo: Repository<SpcChart>;
  dataRepo: Repository<SpcData>;
  processRepo: Repository<ProcessMaster>;
  itemRepo: Repository<ItemMaster>;
}

/** 규격값이 없을 때 표시 소수 자릿수 기본 */
const DEFAULT_DECIMALS = 3;

/** DECIMAL 컬럼은 드라이버에 따라 string 으로 올 수 있어 숫자로 정규화한다. NULL 은 null. */
export function toNullableNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * SPC_DATA.VALUES → number[]
 * - "[1.2, 1.3, 1.4]" (JSON 배열, 기존 spc.service 저장 형식)
 * - "1.2,1.3,1.4"      (쉼표 구분)
 * 숫자로 읽을 수 없는 토큰은 버린다. 결과가 비면 [] — 호출 측이 행을 제외한다.
 */
export function parseSampleValues(raw: string | null | undefined): number[] {
  if (!raw) return [];
  const body = raw.trim().replace(/^\[/, '').replace(/\]$/, '');
  if (!body) return [];
  return body
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
}

/** 규격값의 소수 자릿수 중 최대값 — 표시 자릿수로 쓴다 */
export function decimalsFromSpec(values: (number | null)[]): number {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return DEFAULT_DECIMALS;
  return Math.max(
    ...present.map((v) => {
      const s = String(v);
      const i = s.indexOf('.');
      return i < 0 ? 0 : s.length - i - 1;
    }),
  );
}

/** SPC_CHARTS 행 + 조인 이름 → 관리대상 */
export function mapChartToTarget(
  chart: SpcChart,
  processName: string | undefined,
  itemName: string | undefined,
): SpcTarget {
  const spec = {
    lsl: toNullableNumber(chart.lsl),
    target: toNullableNumber(chart.target),
    usl: toNullableNumber(chart.usl),
  };
  return {
    id: chart.chartNo,
    processCode: chart.processCode,
    processName: processName ?? chart.processCode,
    equipCodes: [],
    itemCode: chart.itemCode,
    itemName: itemName ?? chart.itemCode,
    characteristic: chart.characteristicName,
    characteristicEn: chart.characteristicName,
    unit: '',
    chartType: 'XBAR_R',
    subgroupSize: Number(chart.subgroupSize) || 5,
    spec,
    decimals: decimalsFromSpec([spec.lsl, spec.target, spec.usl]),
  };
}

/**
 * SPC_DATA 행 목록(시간순) → 서브그룹 원자료.
 * id 는 1..n, 같은 날 여러 건이면 dateLabel 을 MM/DD(n) 으로 구분한다.
 * 측정값이 비어 있는 행은 제외하고 경고 로그를 남긴다.
 */
export function mapDataRowsToSubgroups(rows: SpcData[], logger?: Logger): SpcSubgroupRaw[] {
  const perDayCount = new Map<string, number>();
  for (const r of rows) {
    const key = fmtDateLocal(new Date(r.sampleDate));
    perDayCount.set(key, (perDayCount.get(key) ?? 0) + 1);
  }

  const seqInDay = new Map<string, number>();
  const out: SpcSubgroupRaw[] = [];
  for (const r of rows) {
    const samples = parseSampleValues(r.values);
    if (samples.length === 0) {
      logger?.warn(`SPC_DATA 측정값 파싱 불가 — chartId=${r.chartId}, subgroupNo=${r.subgroupNo}, seq=${r.seq}`);
      continue;
    }
    const d = new Date(r.sampleDate);
    const dateKey = fmtDateLocal(d);
    const nth = (seqInDay.get(dateKey) ?? 0) + 1;
    seqInDay.set(dateKey, nth);
    const multi = (perDayCount.get(dateKey) ?? 0) > 1;
    out.push({
      id: out.length + 1,
      date: dateKey,
      time: fmtTimeLocal(d),
      dateLabel: multi ? `${fmtLabel(d)}(${nth})` : fmtLabel(d),
      equipCode: '',
      lotNo: r.remark ?? '',
      samples,
    });
  }
  return out;
}

/** 실DB 소스 — 인터페이스 구현체 */
export class DbSpcSource implements SpcDataSource {
  readonly kind = 'ORACLE' as const;
  private readonly logger = new Logger(DbSpcSource.name);

  constructor(
    private readonly repos: DbSpcRepos,
    private readonly scope: SpcTenantScope,
    private readonly now: () => Date = () => new Date(),
  ) {
    if (!scope.company || !scope.plant) {
      throw new Error('HV SPC DB 소스에는 회사/공장 스코프가 필요합니다.');
    }
  }

  async listTargets(): Promise<SpcTarget[]> {
    const { company, plant } = this.scope;
    const charts = await this.repos.chartRepo.find({
      where: { company, plant, chartType: 'XBAR_R', status: 'ACTIVE' },
      order: { processCode: 'ASC', chartNo: 'ASC' },
    });
    if (charts.length === 0) return [];

    const processCodes = Array.from(new Set(charts.map((c) => c.processCode)));
    const itemCodes = Array.from(new Set(charts.map((c) => c.itemCode)));
    const [processes, items] = await Promise.all([
      this.repos.processRepo.find({
        where: { company, plant, processCode: In(processCodes) },
        select: ['processCode', 'processName'],
      }),
      this.repos.itemRepo.find({
        where: { company, plant, itemCode: In(itemCodes) },
        select: ['itemCode', 'itemName'],
      }),
    ]);
    const processNames = new Map(processes.map((p) => [p.processCode, p.processName]));
    const itemNames = new Map(items.map((i) => [i.itemCode, i.itemName]));

    return charts.map((c) => mapChartToTarget(c, processNames.get(c.processCode), itemNames.get(c.itemCode)));
  }

  async fetchSubgroups(target: SpcTarget, days: number): Promise<SpcSubgroupRaw[]> {
    const many = await this.fetchSubgroupsMany([target], days);
    return many.get(target.id) ?? [];
  }

  async fetchSubgroupsMany(targets: SpcTarget[], days: number): Promise<Map<string, SpcSubgroupRaw[]>> {
    const result = new Map<string, SpcSubgroupRaw[]>(targets.map((t) => [t.id, []]));
    if (targets.length === 0) return result;

    const { company, plant } = this.scope;
    const rows = await this.repos.dataRepo.find({
      where: {
        company,
        plant,
        chartId: In(targets.map((t) => t.id)),
        sampleDate: MoreThanOrEqual(rangeStart(days, this.now())),
      },
      order: { chartId: 'ASC', sampleDate: 'ASC', subgroupNo: 'ASC', seq: 'ASC' },
    });

    const byChart = new Map<string, SpcData[]>();
    for (const r of rows) {
      const list = byChart.get(r.chartId);
      if (list) list.push(r);
      else byChart.set(r.chartId, [r]);
    }
    for (const [chartId, list] of byChart) {
      result.set(chartId, mapDataRowsToSubgroups(list, this.logger));
    }
    return result;
  }
}
