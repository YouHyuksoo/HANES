/**
 * @file hv-spc-targets.ts
 * @description 고전압 하네스(HV Harness) 공정 SPC 관리대상 카탈로그 — 목업 소스(MOCK) 전용 기준.
 *
 * 초보자 가이드:
 * - "어느 공정의 어떤 특성을 어떤 규격으로 관리하는가"를 정의한다. 측정값은 여기 없다.
 * - 규격(LSL/Target/USL)은 HV 하네스 일반 공차를 참고한 예시값이다. 실제 도면 규격으로 바꿔야 한다.
 * - `mock` 블록은 목업 생성기(hv-spc-mock.source.ts)만 읽는다. DB 소스(hv-spc-db.source.ts)는 SPC_CHARTS 를 읽으므로 무시된다.
 * - 관리대상을 추가하려면 배열에 한 항목을 append 한다. 공정 코드는 HANES PROCESS_MASTERS 코드를 따른다.
 * - 원본: C:\project\webdisplay\src\lib\hanes\spc-targets.ts
 */

export interface SpcSpec {
  lsl: number | null;
  target: number | null;
  usl: number | null;
}

/** 목업 생성기 힌트 — 실제 데이터 소스에서는 사용하지 않는다 */
export interface SpcMockShape {
  /** 공정 평균 */
  mean: number;
  /** 개별 측정 표준편차 */
  sigma: number;
  /** 하루 서브그룹 수 */
  perDay: number;
  /** 이 일자(0-based, 기간 시작 기준)부터 평균이 이동 */
  shiftAtDay?: number;
  /** 이동 폭(σ 배수) */
  shiftSigma?: number;
  /** 일별 추세(σ 배수/일) */
  trendPerDay?: number;
  /** 이 서브그룹(1-based) 에 단일 이상점 주입 */
  outlierAtSubgroup?: number;
  /** 이상점 폭(σ 배수) */
  outlierSigma?: number;
}

export interface SpcTarget {
  /** 관리대상 ID (URL/조회 키). DB 소스에서는 SPC_CHARTS.CHART_NO */
  id: string;
  processCode: string;
  processName: string;
  /** 측정 설비 후보 — 서브그룹마다 순환 배정. DB 소스는 빈 배열 */
  equipCodes: string[];
  /** 대표 품목 (하네스 반제품 코드) */
  itemCode: string;
  /** 품목명 — DB 소스(ITEM_MASTERS 조인)에서만 채운다 */
  itemName?: string;
  characteristic: string;
  characteristicEn: string;
  unit: string;
  chartType: 'XBAR_R';
  /** 서브그룹 크기 — 목업은 5 고정, DB 는 SPC_CHARTS.SUBGROUP_SIZE(2~10) */
  subgroupSize: number;
  spec: SpcSpec;
  /** 표시 소수 자릿수 */
  decimals: number;
  /** 목업 힌트 — DB 소스 관리대상에는 없다 */
  mock?: SpcMockShape;
}

/**
 * HV 하네스 SPC 관리대상 12건.
 * 공정 순서: 절단탈피 → 실드편조절단 → 압착 → 육각압착 → 열수축 → 조립 → 종합검사
 */
export const HV_SPC_TARGETS: SpcTarget[] = [
  {
    id: 'ATCUT-CUT-LEN', processCode: 'ATCUT', processName: '자동절단탈피',
    equipCodes: ['EQ-ATCUT-01', 'EQ-ATCUT-02'], itemCode: 'N91H00-X9800-C1',
    characteristic: '절단 길이', characteristicEn: 'Cut Length', unit: 'mm',
    chartType: 'XBAR_R', subgroupSize: 5, spec: { lsl: 1197, target: 1200, usl: 1203 }, decimals: 1,
    mock: { mean: 1200.2, sigma: 0.55, perDay: 3 },
  },
  {
    id: 'ATCUT-STRIP-LEN', processCode: 'ATCUT', processName: '자동절단탈피',
    equipCodes: ['EQ-ATCUT-01', 'EQ-ATCUT-02'], itemCode: 'N91H00-X9800-C1',
    characteristic: '탈피 길이', characteristicEn: 'Strip Length', unit: 'mm',
    chartType: 'XBAR_R', subgroupSize: 5, spec: { lsl: 11.5, target: 12.0, usl: 12.5 }, decimals: 2,
    mock: { mean: 12.05, sigma: 0.11, perDay: 3, trendPerDay: 0.035 },
  },
  {
    id: 'SHDCT-BRAID-LEN', processCode: 'SHDCT', processName: '실드편조절단',
    equipCodes: ['EQ-SHDRM-01'], itemCode: 'N91H00-X9800-C2',
    characteristic: '편조 절단 길이', characteristicEn: 'Braid Cut Length', unit: 'mm',
    chartType: 'XBAR_R', subgroupSize: 5, spec: { lsl: 24.0, target: 25.0, usl: 26.0 }, decimals: 2,
    mock: { mean: 25.1, sigma: 0.22, perDay: 2 },
  },
  {
    id: 'GCRMP-CRIMP-H', processCode: 'GCRMP', processName: '압착',
    equipCodes: ['EQ-CRMPF-01', 'EQ-CRMPF-02', 'EQ-CRMPR-01'], itemCode: 'N91H00-X9800-S-A',
    characteristic: '크림프 높이', characteristicEn: 'Crimp Height', unit: 'mm',
    chartType: 'XBAR_R', subgroupSize: 5, spec: { lsl: 1.90, target: 1.95, usl: 2.00 }, decimals: 3,
    mock: { mean: 1.952, sigma: 0.012, perDay: 4, shiftAtDay: 21, shiftSigma: 1.6 },
  },
  {
    id: 'GCRMP-CRIMP-W', processCode: 'GCRMP', processName: '압착',
    equipCodes: ['EQ-CRMPF-01', 'EQ-CRMPF-02', 'EQ-CRMPR-01'], itemCode: 'N91H00-X9800-S-A',
    characteristic: '크림프 폭', characteristicEn: 'Crimp Width', unit: 'mm',
    chartType: 'XBAR_R', subgroupSize: 5, spec: { lsl: 3.10, target: 3.20, usl: 3.30 }, decimals: 3,
    mock: { mean: 3.205, sigma: 0.02, perDay: 4 },
  },
  {
    id: 'GCRMP-PULL-F', processCode: 'GCRMP', processName: '압착',
    equipCodes: ['EQ-CRMPF-01', 'EQ-CRMPF-02'], itemCode: 'N91H00-X9800-S-A',
    characteristic: '인장강도', characteristicEn: 'Pull-off Force', unit: 'N',
    chartType: 'XBAR_R', subgroupSize: 5, spec: { lsl: 450, target: null, usl: null }, decimals: 0,
    mock: { mean: 612, sigma: 28, perDay: 2, outlierAtSubgroup: 49, outlierSigma: -8 },
  },
  {
    id: 'HEXCP-HEX-AF', processCode: 'HEXCP', processName: '육각압착',
    equipCodes: ['EQ-HEXCP-01', 'EQ-HEXCP-02'], itemCode: 'N91H00-X9800-S-AB',
    characteristic: '육각압착 대변거리', characteristicEn: 'Hex Crimp Across-Flats', unit: 'mm',
    chartType: 'XBAR_R', subgroupSize: 5, spec: { lsl: 12.80, target: 13.00, usl: 13.20 }, decimals: 3,
    mock: { mean: 13.01, sigma: 0.045, perDay: 3 },
  },
  {
    id: 'TUBHT-TUBE-OD', processCode: 'TUBHT', processName: '열수축',
    equipCodes: ['EQ-TUBHT-01'], itemCode: 'N91H00-X9800-S',
    characteristic: '수축 후 튜브 외경', characteristicEn: 'Shrunk Tube OD', unit: 'mm',
    chartType: 'XBAR_R', subgroupSize: 5, spec: { lsl: 14.5, target: 15.0, usl: 15.5 }, decimals: 2,
    mock: { mean: 15.02, sigma: 0.13, perDay: 2, shiftAtDay: 12, shiftSigma: -0.9 },
  },
  {
    id: 'MASSY-TORQUE', processCode: 'MASSY', processName: '조립',
    equipCodes: ['EQ-MASSY-01', 'EQ-MTASY-01'], itemCode: 'N91H00-X9800',
    characteristic: '체결 토크', characteristicEn: 'Fastening Torque', unit: 'N·m',
    chartType: 'XBAR_R', subgroupSize: 5, spec: { lsl: 7.2, target: 8.0, usl: 8.8 }, decimals: 2,
    mock: { mean: 8.02, sigma: 0.18, perDay: 3 },
  },
  {
    id: 'AINSP-INS-RES', processCode: 'AINSP', processName: '종합검사',
    equipCodes: ['EQ-AINSP-01', 'EQ-AINSP-02'], itemCode: 'N91H00-X9800',
    characteristic: '절연저항', characteristicEn: 'Insulation Resistance', unit: 'MΩ',
    chartType: 'XBAR_R', subgroupSize: 5, spec: { lsl: 100, target: null, usl: null }, decimals: 0,
    mock: { mean: 820, sigma: 95, perDay: 3 },
  },
  {
    id: 'AINSP-HIPOT-LEAK', processCode: 'AINSP', processName: '종합검사',
    equipCodes: ['EQ-AINSP-01', 'EQ-AINSP-02'], itemCode: 'N91H00-X9800',
    characteristic: '내전압 누설전류', characteristicEn: 'Hipot Leakage Current', unit: 'mA',
    chartType: 'XBAR_R', subgroupSize: 5, spec: { lsl: null, target: null, usl: 5.0 }, decimals: 2,
    mock: { mean: 1.35, sigma: 0.32, perDay: 3, trendPerDay: 0.06 },
  },
  {
    id: 'AINSP-COND-RES', processCode: 'AINSP', processName: '종합검사',
    equipCodes: ['EQ-AINSP-01', 'EQ-AINSP-02'], itemCode: 'N91H00-X9800',
    characteristic: '도체저항', characteristicEn: 'Conductor Resistance', unit: 'mΩ',
    chartType: 'XBAR_R', subgroupSize: 5, spec: { lsl: null, target: 2.4, usl: 3.0 }, decimals: 3,
    mock: { mean: 2.42, sigma: 0.09, perDay: 3 },
  },
];

export function findSpcTarget(id: string): SpcTarget | undefined {
  return HV_SPC_TARGETS.find((t) => t.id === id);
}
