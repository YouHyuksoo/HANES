/**
 * @file crimp-measurement-spec.ts
 * @description 절압물검사 — 단자 1개(BOM SIDE)의 압착 실측값을 단자별 압착 규격(TERMINAL_CRIMP_SPECS)과 대조한다.
 *              서버(최종 판정)와 화면(입력 중 표시)이 같은 함수를 쓴다.
 *
 * 초보자 가이드:
 * 1. 규격에 하한/상한이 하나라도 있는 항목만 측정 대상이다(비워 둔 항목은 판정 제외).
 * 2. 측정 대상인데 값이 없으면 판정하지 않고 missing 으로 돌려준다 — 서버는 이 경우 저장을 거부한다.
 * 3. 인장력은 하한(최소값)만 있다.
 */

export const CRIMP_INSPECT_TIMING_VALUES = ['FIRST', 'MID', 'LAST'] as const;
export type CrimpInspectTiming = typeof CRIMP_INSPECT_TIMING_VALUES[number];

export const CRIMP_MEASURE_KEYS = ['crimpHeight', 'crimpWidth', 'insCrimpHeight', 'pullForce', 'stripLength'] as const;
export type CrimpMeasureKey = typeof CRIMP_MEASURE_KEYS[number];

/** TERMINAL_CRIMP_SPECS 의 판정용 상하한 */
export interface CrimpSpecLimits {
  crimpHeightLsl?: number | null;
  crimpHeightUsl?: number | null;
  crimpWidthLsl?: number | null;
  crimpWidthUsl?: number | null;
  insCrimpHeightLsl?: number | null;
  insCrimpHeightUsl?: number | null;
  pullForceMin?: number | null;
  stripLengthMin?: number | null;
  stripLengthMax?: number | null;
}

export type CrimpMeasuredValues = Partial<Record<CrimpMeasureKey, number | null>>;

export interface CrimpMeasureFailure {
  key: CrimpMeasureKey;
  value: number;
  lsl: number | null;
  usl: number | null;
}

export interface CrimpSideJudgeResult {
  passYn: 'Y' | 'N';
  failures: CrimpMeasureFailure[];
  /** 측정 대상인데 값이 없는 항목 */
  missing: CrimpMeasureKey[];
}

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 항목별 하한/상한 — 둘 다 null 이면 측정 대상이 아니다 */
export function crimpLimits(spec: CrimpSpecLimits, key: CrimpMeasureKey): { lsl: number | null; usl: number | null } {
  switch (key) {
    case 'crimpHeight': return { lsl: num(spec.crimpHeightLsl), usl: num(spec.crimpHeightUsl) };
    case 'crimpWidth': return { lsl: num(spec.crimpWidthLsl), usl: num(spec.crimpWidthUsl) };
    case 'insCrimpHeight': return { lsl: num(spec.insCrimpHeightLsl), usl: num(spec.insCrimpHeightUsl) };
    case 'pullForce': return { lsl: num(spec.pullForceMin), usl: null };
    case 'stripLength': return { lsl: num(spec.stripLengthMin), usl: num(spec.stripLengthMax) };
  }
}

/** 규격에 상하한이 있는 측정 항목 목록 (입력칸·필수값 기준) */
export function crimpMeasureTargets(spec: CrimpSpecLimits): CrimpMeasureKey[] {
  return CRIMP_MEASURE_KEYS.filter((key) => {
    const { lsl, usl } = crimpLimits(spec, key);
    return lsl !== null || usl !== null;
  });
}

/** 값 하나가 규격 안인지 — 값이 없으면 null */
export function isCrimpValueInSpec(spec: CrimpSpecLimits, key: CrimpMeasureKey, value: number | string | null | undefined): boolean | null {
  const v = num(value);
  if (v === null) return null;
  const { lsl, usl } = crimpLimits(spec, key);
  return (lsl === null || v >= lsl) && (usl === null || v <= usl);
}

export function judgeCrimpSide(spec: CrimpSpecLimits, measured: CrimpMeasuredValues | null | undefined): CrimpSideJudgeResult {
  const m = measured ?? {};
  const failures: CrimpMeasureFailure[] = [];
  const missing: CrimpMeasureKey[] = [];
  for (const key of crimpMeasureTargets(spec)) {
    const value = num(m[key]);
    if (value === null) {
      missing.push(key);
      continue;
    }
    if (!isCrimpValueInSpec(spec, key, value)) {
      const { lsl, usl } = crimpLimits(spec, key);
      failures.push({ key, value, lsl, usl });
    }
  }
  return { passYn: failures.length === 0 && missing.length === 0 ? 'Y' : 'N', failures, missing };
}
