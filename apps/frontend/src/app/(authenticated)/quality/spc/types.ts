/**
 * @file src/app/(authenticated)/quality/spc/types.ts
 * @description 고전압 하네스 SPC 관리도 화면 타입 — 백엔드 `/quality/spc/hv/*` 응답 계약.
 *
 * 초보자 가이드:
 * - 원본: WebDisplay `src/lib/hanes/spc-source.ts`, `spc-rules.ts`, `spc-targets.ts`, `src/lib/mxvc/spc-math.ts`
 *   에서 화면이 쓰는 타입만 복사했다. 계산(관리한계·Cpk·규칙 판정)은 전부 백엔드가 하고,
 *   프론트는 값을 읽어 색만 입힌다.
 * - `SpcTargetsResponse` = GET /quality/spc/hv/targets 의 data
 * - `SpcTargetData`     = GET /quality/spc/hv/targets/:targetId 의 data
 */

/** 규격 (LSL/Target/USL). 단측 규격이면 없는 쪽이 null */
export interface SpcSpec {
  lsl: number | null;
  target: number | null;
  usl: number | null;
}

/** 관리한계·기본 통계 (spc-math SpcStats) */
export interface SpcStats {
  xbarBar: number;
  rBar: number;
  xbarUCL: number;
  xbarLCL: number;
  xbarCL: number;
  rUCL: number;
  rLCL: number;
  rCL: number;
  /** 스펙이 없으면 null — 0 으로 내리면 '공정능력 0' 으로 오해된다 */
  cp: number | null;
  cpk: number | null;
  sigmaEst: number;
  usl: number | null;
  lsl: number | null;
  target: number | null;
  sampleSize: number;
  subgroupCount: number;
  totalAvailable: number;
  kLimit: number;
  oocPoints: number[];
}

/** 서브그룹 원자료 — 소스가 돌려주는 최소 단위 */
export interface SpcSubgroupRaw {
  /** 조회 구간 안에서 1..n */
  id: number;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm */
  time: string;
  /** 차트 x축 라벨 (MM/DD 또는 MM/DD(n)) */
  dateLabel: string;
  equipCode: string;
  lotNo: string;
  samples: number[];
}

/** 화면용 서브그룹 — 원자료 + 통계 */
export interface SpcSubgroupRow extends SpcSubgroupRaw {
  xbar: number;
  range: number;
}

/** 공정능력 확장 — 단측 규격과 전체 산포(Ppk)까지 */
export interface SpcCapability {
  cp: number | null;
  cpk: number | null;
  pp: number | null;
  ppk: number | null;
  /** R̄/d2 (군내 산포) */
  sigmaWithin: number;
  /** 전체 표본 표준편차 (군간 포함) */
  sigmaOverall: number;
}

export type SpcHealth = "STABLE" | "WARN" | "OOC";

/** 관리도 이상 판정 규칙 — Western Electric 4규칙(X̄) + R 관리도 상한 이탈 */
export type SpcRuleCode = "R1" | "R2" | "R3" | "R4" | "RR1";

export interface SpcRuleViolation {
  /** 위반이 확정된 서브그룹 id (패턴 규칙은 마지막 점) */
  subgroupId: number;
  rule: SpcRuleCode;
  chart: "XBAR" | "R";
  /** 위반을 구성한 서브그룹 id 목록 (R1 은 1개) */
  members: number[];
}

/** 서브그룹별 최고 심각도 플래그 — 차트 점 색과 표 배지에 쓴다 */
export type SpcPointFlag = "OOC" | "WARN" | null;

export type SpcSourceKind = "MOCK" | "ORACLE";

export interface SpcTargetSummary {
  id: string;
  processCode: string;
  processName: string;
  itemCode: string;
  characteristic: string;
  characteristicEn: string;
  unit: string;
  subgroupSize: number;
  spec: SpcSpec;
  decimals: number;
  equipCodes: string[];
  /** 목록 화면용 요약 */
  cpk: number | null;
  health: SpcHealth;
  oocCount: number;
  warnCount: number;
  subgroupCount: number;
  lastSampleAt: string | null;
}

export interface SpcTargetData {
  target: SpcTargetSummary;
  dateFrom: string;
  dateTo: string;
  subgroups: SpcSubgroupRow[];
  stats: SpcStats | null;
  capability: SpcCapability | null;
  violations: SpcRuleViolation[];
  /** 데이터 출처 표기 — 화면 배너용 */
  sourceKind: SpcSourceKind;
}

/** GET /quality/spc/hv/targets 응답 data */
export interface SpcTargetsResponse {
  sourceKind: SpcSourceKind;
  dateFrom: string;
  dateTo: string;
  targets: SpcTargetSummary[];
}

export const SPC_DAY_OPTIONS = [7, 14, 30, 60] as const;
export const SPC_K_OPTIONS = [0, 25, 50] as const;
