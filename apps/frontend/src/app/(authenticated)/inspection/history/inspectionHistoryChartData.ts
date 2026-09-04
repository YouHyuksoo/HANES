/**
 * @file src/app/(authenticated)/inspection/history/inspectionHistoryChartData.ts
 * @description 검사이력 차트용 순수 집계 함수 (React 의존 없음)
 *
 * 초보자 가이드:
 * 1. 화면에 조회된 InspectHistoryRow[]를 그대로 받아 차트 데이터로 변환한다.
 * 2. 서버 재조회 없이 클라이언트 집계만 하므로 필터(기간/유형/판정)가 그대로 반영된다.
 * 3. 조회 기간이 하루면 시간대별, 여러 날이면 일별 추이로 묶는다.
 */
import type { InspectHistoryRow } from './types';

export type TrendGranularity = 'hour' | 'day';

export interface InspectionSummary {
  total: number;
  pass: number;
  fail: number;
  /** 합격률(%) 소수 1자리, 데이터 없으면 null */
  passRate: number | null;
}

export interface TrendPoint {
  bucket: string;
  pass: number;
  fail: number;
}

export interface TypePoint {
  type: string;
  pass: number;
  fail: number;
  passRate: number | null;
}

export interface DefectPoint {
  code: string;
  count: number;
}

/** 검사유형 고정 표시 순서 (범례 색은 순서에 종속되지 않고 유형에 종속) */
export const INSPECT_TYPE_ORDER = ['VISUAL', 'TERMINAL', 'CONTINUITY'] as const;

const isPass = (row: InspectHistoryRow) => row.passYn === 'Y';

function toRate(pass: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((pass / total) * 1000) / 10;
}

export function summarizeInspections(rows: InspectHistoryRow[]): InspectionSummary {
  const pass = rows.filter(isPass).length;
  const total = rows.length;
  return { total, pass, fail: total - pass, passRate: toRate(pass, total) };
}

export function resolveTrendGranularity(fromDate: string, toDate: string): TrendGranularity {
  return fromDate && fromDate === toDate ? 'hour' : 'day';
}

const pad2 = (n: number) => String(n).padStart(2, '0');

const DAY_MS = 86_400_000;

/**
 * 버킷 키를 정렬 가능한 숫자 인덱스로 변환
 * - hour: 시각 0~23
 * - day: 로컬 자정 기준 일 순번 (UTC 오프셋만큼 보정해 KST 등에서 하루 밀림 방지)
 */
function bucketIndex(date: Date, granularity: TrendGranularity): number {
  if (granularity === 'hour') return date.getHours();
  const localMidnightAsUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor(localMidnightAsUtc / DAY_MS);
}

function bucketLabel(index: number, granularity: TrendGranularity): string {
  if (granularity === 'hour') return `${pad2(index)}:00`;
  const d = new Date(index * DAY_MS);
  return `${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** 첫 버킷~마지막 버킷 사이 빈 구간은 0으로 채워 추이 축이 끊기지 않게 한다 */
export function buildTrendSeries(rows: InspectHistoryRow[], granularity: TrendGranularity): TrendPoint[] {
  const counts = new Map<number, { pass: number; fail: number }>();
  for (const row of rows) {
    const date = new Date(row.inspectAt);
    if (Number.isNaN(date.getTime())) continue;
    const idx = bucketIndex(date, granularity);
    const entry = counts.get(idx) ?? { pass: 0, fail: 0 };
    if (isPass(row)) entry.pass += 1; else entry.fail += 1;
    counts.set(idx, entry);
  }
  if (counts.size === 0) return [];
  const indexes = [...counts.keys()];
  const min = Math.min(...indexes);
  const max = Math.max(...indexes);
  const series: TrendPoint[] = [];
  for (let idx = min; idx <= max; idx += 1) {
    const entry = counts.get(idx) ?? { pass: 0, fail: 0 };
    series.push({ bucket: bucketLabel(idx, granularity), pass: entry.pass, fail: entry.fail });
  }
  return series;
}

export function buildTypeSeries(rows: InspectHistoryRow[]): TypePoint[] {
  const counts = new Map<string, { pass: number; fail: number }>();
  for (const row of rows) {
    const type = String(row.inspectType ?? '').toUpperCase() || '-';
    const entry = counts.get(type) ?? { pass: 0, fail: 0 };
    if (isPass(row)) entry.pass += 1; else entry.fail += 1;
    counts.set(type, entry);
  }
  const known: string[] = INSPECT_TYPE_ORDER.filter((type) => counts.has(type));
  const others = [...counts.keys()].filter((type) => !(INSPECT_TYPE_ORDER as readonly string[]).includes(type)).sort();
  return [...known, ...others].map((type) => {
    const { pass, fail } = counts.get(type) ?? { pass: 0, fail: 0 };
    return { type, pass, fail, passRate: toRate(pass, pass + fail) };
  });
}

export function buildTopDefects(rows: InspectHistoryRow[], limit = 10): DefectPoint[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (isPass(row)) continue;
    const code = (row.errorCode ?? '').trim();
    if (!code) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
    .slice(0, limit);
}
