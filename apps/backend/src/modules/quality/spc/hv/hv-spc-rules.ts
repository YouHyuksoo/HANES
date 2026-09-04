/**
 * @file hv-spc-rules.ts
 * @description 관리도 이상 판정 규칙 — Western Electric 4규칙(X̄ 관리도) + R 관리도 상한 이탈.
 *
 * 초보자 가이드:
 * - 입력은 서브그룹 평균 목록과 관리한계(CL/UCL/LCL)뿐이다. DB 도, 화면도 모른다.
 * - σ_x̄ = (UCL − CL) / 3 으로 1σ/2σ 구역을 나눈다.
 * - R1 은 관리한계 이탈(OOC)이고, R2~R4 는 한계 안이지만 "우연이 아닌 패턴"이다.
 * - 규칙을 추가하려면 `XBAR_RULES` 배열에 함수를 하나 append 한다.
 * - 원본: C:\project\webdisplay\src\lib\hanes\spc-rules.ts
 */

export type SpcRuleCode = 'R1' | 'R2' | 'R3' | 'R4' | 'RR1';

export interface SpcRuleViolation {
  /** 위반이 확정된 서브그룹 id (패턴 규칙은 마지막 점) */
  subgroupId: number;
  rule: SpcRuleCode;
  chart: 'XBAR' | 'R';
  /** 위반을 구성한 서브그룹 id 목록 (R1 은 1개) */
  members: number[];
}

interface XbarPoint {
  id: number;
  xbar: number;
}

interface RangePoint {
  id: number;
  range: number;
}

interface XbarLimits {
  cl: number;
  ucl: number;
  lcl: number;
}

/** 연속 window 안에서 같은 쪽으로 zone 을 넘은 점이 need 개 이상이면 위반 */
function runRule(
  points: XbarPoint[],
  limits: XbarLimits,
  zoneSigma: number,
  window: number,
  need: number,
  rule: SpcRuleCode,
): SpcRuleViolation[] {
  const sigma = (limits.ucl - limits.cl) / 3;
  if (sigma <= 0) return [];
  const out: SpcRuleViolation[] = [];
  for (let i = window - 1; i < points.length; i++) {
    const win = points.slice(i - window + 1, i + 1);
    const above = win.filter((p) => p.xbar - limits.cl > zoneSigma * sigma);
    const below = win.filter((p) => limits.cl - p.xbar > zoneSigma * sigma);
    const hit = above.length >= need ? above : below.length >= need ? below : null;
    if (hit) {
      // 마지막 점이 패턴에 포함될 때만 확정 — 같은 패턴을 window 이동마다 중복 보고하지 않는다
      if (hit[hit.length - 1].id === points[i].id) {
        out.push({ subgroupId: points[i].id, rule, chart: 'XBAR', members: hit.map((p) => p.id) });
      }
    }
  }
  return out;
}

/** R1: 3σ(관리한계) 밖 1점 */
function ruleR1(points: XbarPoint[], limits: XbarLimits): SpcRuleViolation[] {
  return points
    .filter((p) => p.xbar > limits.ucl || p.xbar < limits.lcl)
    .map((p) => ({ subgroupId: p.id, rule: 'R1' as const, chart: 'XBAR' as const, members: [p.id] }));
}

/** R2: 연속 3점 중 2점이 같은 쪽 2σ 밖 */
const ruleR2 = (p: XbarPoint[], l: XbarLimits) => runRule(p, l, 2, 3, 2, 'R2');
/** R3: 연속 5점 중 4점이 같은 쪽 1σ 밖 */
const ruleR3 = (p: XbarPoint[], l: XbarLimits) => runRule(p, l, 1, 5, 4, 'R3');
/** R4: 연속 8점이 중심선 같은 쪽 */
const ruleR4 = (p: XbarPoint[], l: XbarLimits) => runRule(p, l, 0, 8, 8, 'R4');

const XBAR_RULES: ((p: XbarPoint[], l: XbarLimits) => SpcRuleViolation[])[] = [ruleR1, ruleR2, ruleR3, ruleR4];

/** RR1: R 관리도 상한 이탈 (산포 급증) */
function ruleRR1(points: RangePoint[], rUCL: number): SpcRuleViolation[] {
  return points
    .filter((p) => p.range > rUCL)
    .map((p) => ({ subgroupId: p.id, rule: 'RR1' as const, chart: 'R' as const, members: [p.id] }));
}

export interface EvaluateInput {
  subgroups: { id: number; xbar: number; range: number }[];
  xbar: XbarLimits;
  rUCL: number;
}

/**
 * 같은 패턴 규칙이 연속 서브그룹에서 이어지면 한 구간(run)으로 합친다.
 * 평균이 이동한 뒤에는 R3/R4 가 점마다 새로 걸려 위반 목록이 수십 건이 되는데,
 * 현장에서는 "몇 번째부터 몇 번째까지 한쪽으로 쏠렸다" 한 줄이 필요하다.
 * R1/RR1 은 점 단위 사건이므로 합치지 않는다.
 */
function coalesceRuns(violations: SpcRuleViolation[]): SpcRuleViolation[] {
  const out: SpcRuleViolation[] = [];
  const openRun = new Map<SpcRuleCode, SpcRuleViolation>();
  for (const v of violations) {
    if (v.rule === 'R1' || v.rule === 'RR1') { out.push(v); continue; }
    const run = openRun.get(v.rule);
    if (run && v.members.some((id) => run.members.includes(id))) {
      run.members = Array.from(new Set([...run.members, ...v.members])).sort((a, b) => a - b);
      run.subgroupId = Math.max(run.subgroupId, v.subgroupId);
    } else {
      const fresh = { ...v, members: [...v.members] };
      openRun.set(v.rule, fresh);
      out.push(fresh);
    }
  }
  return out;
}

/** 모든 규칙을 평가해 서브그룹 id 순으로 돌려준다 (패턴 규칙은 구간으로 합쳐서) */
export function evaluateSpcRules(input: EvaluateInput): SpcRuleViolation[] {
  const xbarPts = input.subgroups.map((s) => ({ id: s.id, xbar: s.xbar }));
  const rangePts = input.subgroups.map((s) => ({ id: s.id, range: s.range }));
  const all = [
    ...XBAR_RULES.flatMap((rule) => rule(xbarPts, input.xbar)),
    ...ruleRR1(rangePts, input.rUCL),
  ].sort((a, b) => a.subgroupId - b.subgroupId || a.rule.localeCompare(b.rule));
  return coalesceRuns(all).sort((a, b) => a.subgroupId - b.subgroupId || a.rule.localeCompare(b.rule));
}

/** 서브그룹별 최고 심각도 플래그 — 차트 점 색과 표 배지에 쓴다 */
export type SpcPointFlag = 'OOC' | 'WARN' | null;

export function flagBySubgroup(violations: SpcRuleViolation[]): Map<number, SpcPointFlag> {
  const map = new Map<number, SpcPointFlag>();
  for (const v of violations) {
    const isOoc = v.rule === 'R1' || v.rule === 'RR1';
    // R1/RR1 은 해당 점만, 패턴 규칙은 구성 점 전부 경고로 칠한다
    const ids = isOoc ? [v.subgroupId] : v.members;
    for (const id of ids) {
      const cur = map.get(id);
      if (isOoc) map.set(id, 'OOC');
      else if (cur !== 'OOC') map.set(id, 'WARN');
    }
  }
  return map;
}
